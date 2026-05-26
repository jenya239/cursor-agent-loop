import type { CursorModel } from '../../cursor/cursor-model';
import type { ChatStore } from '../../chat-store';
import type { ChatDetailView } from '../../cursor/types';
import type { CrApi } from './cr-api';
import type {
  ChatDetailResponse,
  ChatsPayload,
  CursorSnapshot,
  SendResponse,
  StoreStatus,
} from './types';

export interface ModelApiOpts {
  defaultComposerId?: string;
  token?: string;
  snapshotIncludeChats?: boolean;
}

function toChatDetailResponse(v: ChatDetailView): ChatDetailResponse {
  const { agent, messages, summary } = v;
  return {
    ...summary,
    composerId: v.composerId,
    messages,
    agent,
    agentBusy: agent.busy,
    agentBusyDb: agent.dbBusy,
    agentStatus: agent.dbStatus,
  };
}

export class ModelApi implements CrApi {
  constructor(
    protected readonly model: CursorModel,
    protected readonly store: ChatStore,
    private readonly opts: ModelApiOpts = {}
  ) {}

  async snapshot(composerId?: string): Promise<CursorSnapshot> {
    return this.model.snapshot(composerId ?? this.opts.defaultComposerId, {
      includeChats: this.opts.snapshotIncludeChats,
    });
  }

  async chat(composerId: string, fresh = false): Promise<ChatDetailResponse> {
    const v = await this.model.chat(composerId, fresh);
    if (!v) throw new Error('chat not found');
    return toChatDetailResponse(v);
  }

  async send(text: string, composerId?: string, windowTitle?: string): Promise<SendResponse> {
    const token = this.opts.token;
    if (!token) throw new Error('token required');
    const r = await this.model.send(text, {
      token,
      composerId: composerId ?? this.opts.defaultComposerId,
      windowTitle,
    });
    return { ok: true, text: r.text, pageTitle: r.pageTitle };
  }

  async refreshDb(): Promise<StoreStatus> {
    await this.store.refresh();
    return this.store.status();
  }

  async listChats(): Promise<ChatsPayload> {
    const { chats, partial } = this.store.getChats();
    return { chats, partial };
  }

  async status(): Promise<StoreStatus> {
    return this.store.status();
  }
}
