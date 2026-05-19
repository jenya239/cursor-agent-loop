import crypto from 'crypto';
import { readCacheFile, writeCacheFile } from './cache';
import type { CursorDbReader } from './db/reader';
import { isAgentBusy } from './db/agent-state';
import type { ChatMessage, ChatSummary } from './db/types';

const CHATS_CACHE_VERSION = 3;

function chatsCacheFile(dbPath: string): string {
  const id = crypto.createHash('sha1').update(dbPath).digest('hex').slice(0, 12);
  return `chats-v${CHATS_CACHE_VERSION}-${id}.json`;
}

export interface ChatsPayload {
  chats: ChatSummary[];
  partial: boolean;
}

export interface StoreStatus {
  ready: boolean;
  loading: boolean;
  partial: boolean;
  count: number;
  cachedAt: number | null;
  error: string | null;
}

export class ChatStore {
  private chats: ChatSummary[] = [];
  private cachedAt: number | null = null;
  private partial = false;
  private loading = false;
  private error: string | null = null;
  private messagesCache = new Map<string, { at: number; messages: ChatMessage[] }>();
  private readonly msgTtlMs: number;

  private readonly chatsFile: string;

  constructor(
    readonly reader: CursorDbReader,
    readonly dbPath: string,
    private readonly fullScan: boolean
  ) {
    this.msgTtlMs = Number(process.env.MSG_CACHE_TTL_MS) || 800;
    this.chatsFile = chatsCacheFile(dbPath);
    const disk = readCacheFile<ChatSummary[]>(this.chatsFile);
    if (disk?.data?.length) {
      this.chats = disk.data;
      this.cachedAt = disk.at;
      this.partial = false;
    }
  }

  status(): StoreStatus {
    return {
      ready: this.chats.length > 0,
      loading: this.loading,
      partial: this.partial,
      count: this.chats.length,
      cachedAt: this.cachedAt,
      error: this.error,
    };
  }

  getChats(): ChatsPayload {
    this.reconcileChatList();
    return { chats: this.chats, partial: this.partial };
  }

  private reconcileChatList(): void {
    if (!this.chats.length) return;
    const untitled = this.chats.filter((c) => c.name === 'Untitled').length;
    if (untitled === 0) return;
    const fresh = this.reader.listFromGlobalHeaders();
    if (fresh.length) {
      this.apply(fresh, false);
      writeCacheFile(this.chatsFile, this.chats);
    }
  }

  warm(): void {
    if (this.loading) return;
    setImmediate(() => void this.refresh());
  }

  async refresh(): Promise<void> {
    if (this.loading) return;
    this.messagesCache.clear();
    this.loading = true;
    this.error = null;
    try {
      const headers = this.reader.listFromGlobalHeaders();
      if (headers.length) {
        this.apply(headers, false);
        writeCacheFile(this.chatsFile, this.chats);
        return;
      }

      if (!this.fullScan) {
        if (this.chats.length) return;
        this.partial = true;
        this.error = 'Индекс пуст. Запустите с FULL_SCAN=1 для полного скана.';
        return;
      }

      const full = this.reader.listChats();
      this.apply(full, false);
      writeCacheFile(this.chatsFile, this.chats);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.loading = false;
    }
  }

  private apply(list: ChatSummary[], partial: boolean): void {
    this.chats = list;
    this.cachedAt = Date.now();
    this.partial = partial;
  }

  getChat(composerId: string, fresh = false): {
    summary: ChatSummary | undefined;
    messages: ChatMessage[];
    agentBusy: boolean;
    agentStatus?: string;
  } {
    const data = this.reader.getComposerData(composerId);
    const agentBusy = isAgentBusy(data);
    const agentStatus = data?.status;
    const summary = this.chats.find((c) => c.composerId === composerId);
    const hit = this.messagesCache.get(composerId);
    if (
      !fresh &&
      hit &&
      Date.now() - hit.at < this.msgTtlMs &&
      !messagesStale(hit.messages) &&
      !agentBusy
    ) {
      return { summary, messages: hit.messages, agentBusy, agentStatus };
    }
    const messages = this.reader.getMessages(composerId);
    this.messagesCache.set(composerId, { at: Date.now(), messages });
    return { summary, messages, agentBusy, agentStatus };
  }
}

function messagesStale(msgs: { role: string; text: string }[]): boolean {
  const assistant = msgs.filter((m) => m.role === 'assistant');
  if (!assistant.length) return false;
  const empty = assistant.filter((m) => !m.text.trim()).length;
  return empty > assistant.length * 0.05;
}
