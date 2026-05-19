import fs from 'fs';
import path from 'path';
import type { CrApi } from './cr-api';
import type {
  ChatDetailResponse,
  ChatsPayload,
  CursorSnapshot,
  SendResponse,
  StoreStatus,
} from './types';

export type UiFixtureScenario = 'idle' | 'busy' | 'cdp-down' | 'send-blocked';

const FIX = path.join(process.cwd(), 'tests/ui-fixtures');

function load<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8')) as T;
}

export class FixtureApi implements CrApi {
  constructor(private readonly scenario: UiFixtureScenario = 'idle') {}

  async snapshot(composerId?: string): Promise<CursorSnapshot> {
    if (this.scenario === 'cdp-down') {
      const s = load<CursorSnapshot>('snapshot-idle.json');
      return { ...s, cdp: { ok: false }, agent: { ...s.agent, cdpOk: false, phase: 'unknown' } };
    }
    const name = this.scenario === 'busy' ? 'snapshot-busy.json' : 'snapshot-idle.json';
    const s = load<CursorSnapshot>(name);
    return composerId ? s : s;
  }

  async chat(_composerId: string, _fresh?: boolean): Promise<ChatDetailResponse> {
    return load<ChatDetailResponse>('chat-detail.json');
  }

  async send(text: string): Promise<SendResponse> {
    if (this.scenario === 'send-blocked') {
      throw new Error('агент сейчас работает');
    }
    return { ok: true, text, pageTitle: 'cr - cr - Cursor' };
  }

  async refreshDb(): Promise<StoreStatus> {
    return { ready: true, loading: false, partial: false, count: 1, cachedAt: 1, error: null };
  }

  async listChats(): Promise<ChatsPayload> {
    const s = await this.snapshot();
    return { chats: s.chats, partial: false };
  }

  async status(): Promise<StoreStatus> {
    return this.refreshDb();
  }
}
