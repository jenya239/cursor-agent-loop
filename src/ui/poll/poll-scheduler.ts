import type { CrApi } from '../api/cr-api';
import type { ChatDetailResponse } from '../api/types';
import { applyAgentPoll } from '../../agent-session';
import type { CrStore } from '../state/store';
import { agentTransition, shouldRefreshChat } from './refresh-policy';
import { chatSignature } from '../views/chat-sig';

export const POLL_MS = 800;

export interface SchedulerClock {
  setInterval(fn: () => void, ms: number): () => void;
}

export const defaultClock: SchedulerClock = {
  setInterval(fn, ms) {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
};

export class PollScheduler {
  private stop?: () => void;
  private prevAgentBusy = false;

  constructor(
    private readonly api: CrApi,
    private readonly store: CrStore,
    private readonly clock: SchedulerClock = defaultClock
  ) {}

  start(): void {
    this.stop?.();
    void this.tick();
    this.stop = this.clock.setInterval(() => void this.tick(), POLL_MS);
  }

  halt(): void {
    this.stop?.();
    this.stop = undefined;
  }

  async tick(): Promise<void> {
    const state = this.store.get();
    const id = state.activeComposerId;
    const prevAgent = state.agent;
    try {
      const snap = await this.api.snapshot(id ?? undefined);
      const ev = prevAgent ? agentTransition(prevAgent, snap.agent) : null;
      this.store.dispatch({ type: 'SNAPSHOT', snap, agentEvent: ev });
      if (snap.chats.length) {
        this.store.dispatch({
          type: 'SET_CHATS',
          chats: snap.chats,
          partial: false,
          loading: false,
        });
      }
      if (id && ev) {
        applyAgentPoll(this.prevAgentBusy, id, {
          composerId: id,
          agentBusy: snap.agent.busy,
          agentStatus: snap.agent.dbStatus,
          messageCount: state.messages.length,
        });
      }
      this.prevAgentBusy = snap.agent.busy;

      if (
        id &&
        shouldRefreshChat({ prevAgent, snap, force: false, afterSend: false })
      ) {
        await this.refreshChat(id, true, true);
      }
    } catch {
      /* ignore poll errors */
    }
  }

  async refreshChat(
    id: string,
    fresh: boolean,
    force = false
  ): Promise<ChatDetailResponse | null> {
    try {
      const chat = await this.api.chat(id, fresh);
      const sig = chatSignature(chat);
      if (!force && sig === this.store.get().chatSig) return chat;
      this.store.dispatch({ type: 'CHAT_LOADED', chat, sig });
      return chat;
    } catch {
      return null;
    }
  }
}
