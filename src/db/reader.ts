import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bubbleText } from './bubble-text';
import { mergeMessages } from './merge-messages';
import { loadWorkspaceIndex, resolveWorkspace } from './workspaces';
import type {
  BubblePayload,
  ChatMessage,
  ChatSummary,
  ComposerData,
  ComposerHeaderEntry,
  GlobalComposerHeaders,
  WorkspaceComposerIndex,
} from './types';

export { bubbleText } from './bubble-text';

type TableName = 'ItemTable' | 'cursorDiskKV';

export function openDbReadonly(dbPath: string): Database.Database {
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

export function copyDbToTemp(dbPath: string): string {
  const tmp = path.join(os.tmpdir(), `cr-${process.pid}-${Date.now()}.vscdb`);
  fs.copyFileSync(dbPath, tmp);
  return tmp;
}

function parseJsonValue(raw: Buffer | string | null): unknown {
  if (raw == null) return null;
  const s = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}


function chatHasMessages(reader: CursorDbReader, composerId: string): boolean {
  const data = reader.getComposerData(composerId);
  return (data?.fullConversationHeadersOnly?.length ?? 0) > 0;
}

function dataToSummary(data: ComposerData, composerId: string): ChatSummary {
  return {
    composerId: data.composerId || composerId,
    name: data.name?.trim() || 'Untitled',
    createdAt: data.createdAt,
    lastUpdatedAt: data.lastUpdatedAt,
    unifiedMode: data.unifiedMode,
  };
}

export class CursorDbReader {
  private ownsTemp = false;
  private workspaceIndex;

  constructor(private db: Database.Database, userDir?: string) {
    this.workspaceIndex = loadWorkspaceIndex(userDir);
  }

  static fromPath(dbPath: string, opts?: { copy?: boolean }): CursorDbReader {
    const userDir = path.dirname(path.dirname(dbPath));
    if (opts?.copy) {
      const tmp = copyDbToTemp(dbPath);
      const reader = new CursorDbReader(openDbReadonly(tmp), userDir);
      reader.ownsTemp = true;
      return reader;
    }
    return new CursorDbReader(openDbReadonly(dbPath), userDir);
  }

  private headerToSummary(h: ComposerHeaderEntry): ChatSummary {
    const ws = resolveWorkspace(
      h.workspaceIdentifier?.id,
      h.workspaceIdentifier?.uri,
      this.workspaceIndex
    );
    const sub = h.subtitle?.trim();
    const name =
      h.name?.trim() ||
      (sub && sub !== 'New chat' ? sub : '') ||
      'Untitled';
    return {
      composerId: h.composerId,
      name,
      createdAt: h.createdAt,
      lastUpdatedAt: h.lastUpdatedAt,
      unifiedMode: h.unifiedMode,
      workspaceId: ws.workspaceId,
      workspacePath: ws.path,
      workspaceLabel: ws.label,
    };
  }

  close(): void {
    const dbPath = this.db.name;
    this.db.close();
    if (this.ownsTemp) {
      try {
        fs.unlinkSync(dbPath);
      } catch {
        /* ignore */
      }
    }
  }

  getJson(table: TableName, key: string): unknown {
    const row = this.db.prepare(`SELECT value FROM ${table} WHERE key = ?`).get(key) as
      | { value: Buffer | string }
      | undefined;
    return parseJsonValue(row?.value ?? null);
  }

  listFromGlobalHeaders(): ChatSummary[] {
    const raw = this.getJson('ItemTable', 'composer.composerHeaders') as GlobalComposerHeaders | null;
    if (!raw) return [];
    const list = raw.allComposers ?? raw.headers ?? raw.composers ?? [];
    return list
      .filter((h) => {
        if (!h.composerId || h.isArchived) return false;
        if (h.name?.trim()) return true;
        if (h.subtitle?.trim() && h.subtitle.trim() !== 'New chat') return true;
        return chatHasMessages(this, h.composerId);
      })
      .map((h) => this.headerToSummary(h));
  }

  listFromComposerDataKeys(): ChatSummary[] {
    const rows = this.db
      .prepare(`SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'`)
      .all() as { key: string; value: Buffer | string }[];

    return rows.map((row) => {
      const composerId = row.key.slice('composerData:'.length);
      const data = parseJsonValue(row.value) as ComposerData | null;
      return data ? dataToSummary(data, composerId) : { composerId, name: 'Untitled' };
    });
  }

  listChats(): ChatSummary[] {
    const byId = new Map<string, ChatSummary>();
    for (const c of this.listFromGlobalHeaders()) byId.set(c.composerId, c);
    for (const c of this.listFromComposerDataKeys()) {
      if (!byId.has(c.composerId)) byId.set(c.composerId, c);
    }
    return [...byId.values()].sort(
      (a, b) => (b.lastUpdatedAt ?? b.createdAt ?? 0) - (a.lastUpdatedAt ?? a.createdAt ?? 0)
    );
  }

  getComposerData(composerId: string): ComposerData | null {
    return this.getJson('cursorDiskKV', `composerData:${composerId}`) as ComposerData | null;
  }

  getBubble(composerId: string, bubbleId: string): BubblePayload | null {
    return this.getJson('cursorDiskKV', `bubbleId:${composerId}:${bubbleId}`) as BubblePayload | null;
  }

  getMessages(composerId: string): ChatMessage[] {
    const data = this.getComposerData(composerId);
    if (!data?.fullConversationHeadersOnly?.length) return [];

    const map = data.conversationMap ?? {};
    const out: ChatMessage[] = [];

    for (const h of data.fullConversationHeadersOnly) {
      const role = h.type === 1 ? 'user' : 'assistant';
      const fromMap = map[h.bubbleId];
      const bubble = fromMap ?? this.getBubble(composerId, h.bubbleId);
      const text = bubbleText(bubble);
      if (!text) continue;
      out.push({
        bubbleId: h.bubbleId,
        role,
        text,
        createdAt: bubble?.createdAt,
      });
    }
    return process.env.MERGE_MESSAGES === '0' ? out : mergeMessages(out);
  }
}

export function listWorkspaceChats(workspaceDbPath: string): ChatSummary[] {
  const wsId = path.basename(path.dirname(workspaceDbPath));
  const userDir = path.dirname(path.dirname(path.dirname(workspaceDbPath)));
  const ws =
    loadWorkspaceIndex(userDir).get(wsId) ??
    ({ workspaceId: wsId, path: '', label: wsId.slice(0, 8) } as const);

  const db = openDbReadonly(workspaceDbPath);
  try {
    const raw = db.prepare(`SELECT value FROM ItemTable WHERE key = ?`).get('composer.composerData') as
      | { value: Buffer | string }
      | undefined;
    const data = parseJsonValue(raw?.value ?? null) as WorkspaceComposerIndex | null;
    return (data?.allComposers ?? []).filter((c) => c.composerId).map((c) => ({
      composerId: c.composerId,
      name: c.name?.trim() || 'Untitled',
      createdAt: c.createdAt,
      lastUpdatedAt: c.lastUpdatedAt,
      unifiedMode: c.unifiedMode,
      workspaceId: ws.workspaceId,
      workspacePath: ws.path,
      workspaceLabel: ws.label,
    }));
  } finally {
    db.close();
  }
}
