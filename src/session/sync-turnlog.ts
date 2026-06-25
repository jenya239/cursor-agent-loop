import fs from 'fs';
import {
  hashTurnLogLine,
  insertTurnAuditEvents,
  listTurnAuditEvents,
  type TurnAuditInsert,
  type TurnAuditRow,
} from '../db/turn-audit';
import { turnLogPath, type TurnAuditEvent } from './turn-audit';
import { workspaceFromAgentDir } from './parse-turns';

function parseTurnLogLines(content: string): { line: string; event: TurnAuditEvent }[] {
  const out: { line: string; event: TurnAuditEvent }[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push({ line: trimmed, event: JSON.parse(trimmed) as TurnAuditEvent });
    } catch {
      /* skip bad lines */
    }
  }
  return out;
}

function toInsert(workspace: string, line: string, event: TurnAuditEvent): TurnAuditInsert {
  return {
    workspace,
    lineHash: hashTurnLogLine(line),
    ts: event.ts,
    event: event.event,
    role: event.role ?? null,
    step: event.step ?? null,
    track: event.track ?? null,
    target: event.target ?? null,
    token: event.token ?? null,
    why: event.why ?? null,
    promptKey: event.prompt_key ?? null,
    dbStatus: event.db_status ?? null,
    pageTitle: event.page_title ?? null,
    model: event.model ?? null,
    usagePct: event.usage_pct ?? null,
  };
}

export function syncTurnLogFromAgentDir(
  agentDir: string,
  options?: { databasePath?: string }
): number {
  const file = turnLogPath(agentDir);
  if (!fs.existsSync(file)) return 0;
  const workspace = workspaceFromAgentDir(agentDir);
  const rows = parseTurnLogLines(fs.readFileSync(file, 'utf8')).map(({ line, event }) =>
    toInsert(workspace, line, event)
  );
  return insertTurnAuditEvents(rows, options?.databasePath);
}

export function loadTurnAuditEvents(
  agentDir: string,
  options?: { databasePath?: string; limit?: number }
): TurnAuditRow[] {
  syncTurnLogFromAgentDir(agentDir, options);
  return listTurnAuditEvents({
    workspace: workspaceFromAgentDir(agentDir),
    limit: options?.limit ?? 30,
    databasePath: options?.databasePath,
  });
}

export type TurnLogWatcher = { stop: () => void };

export function startTurnLogWatcher(
  agentDir: string,
  options?: {
    databasePath?: string;
    debounceMilliseconds?: number;
    watchFile?: typeof fs.watch;
  }
): TurnLogWatcher {
  const file = turnLogPath(agentDir);
  const debounceMilliseconds = options?.debounceMilliseconds ?? 300;
  const watchFile = options?.watchFile ?? fs.watch;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: fs.FSWatcher | undefined;

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      syncTurnLogFromAgentDir(agentDir, { databasePath: options?.databasePath });
    }, debounceMilliseconds);
  };

  syncTurnLogFromAgentDir(agentDir, { databasePath: options?.databasePath });

  try {
    watcher = watchFile(file, schedule);
  } catch {
    /* file may not exist yet */
  }

  return {
    stop() {
      if (timer) clearTimeout(timer);
      watcher?.close();
    },
  };
}
