import crypto from 'crypto';
import { AgentModel, type AgentState } from '../agent-model';
import { probeComposerAgent } from '../cdp/composer-agent-probe';
import type { ChatStore } from '../chat-store';
import type { CdpPort } from '../cdp/port';
import { COMPOSER_AGENT_PROBE_ID } from '../cdp/probes/composer-agent.v1';
import { liveCdp } from '../cdp/live-cdp';
import { isSendStrict } from '../send-strict';
import { isAgentBusySendError, SendQueue, type QueuedSend } from '../send-queue';
import type {
  ChatDetailView,
  ComposerSwitchResult,
  ComposerUiState,
  CursorSnapshot,
  CursorWindow,
} from './types';

const SWITCH_CACHE_MS = 4000;

function cdpProbeFrom(port: CdpPort) {
  return async () => {
    const d = await probeComposerAgent(port);
    return {
      ok: d.cdpOk,
      busy: d.busy,
      reason: d.reason,
      windowTitle: d.windowTitle,
    };
  };
}

export class CursorModel {
  private readonly agent: AgentModel;
  private readonly sendQueue: SendQueue;
  private switchCache: {
    composerId: string;
    at: number;
    result: ComposerSwitchResult;
  } | null = null;

  constructor(
    private readonly store: ChatStore,
    private readonly cdp: CdpPort = liveCdp,
    sendQueue?: SendQueue
  ) {
    this.sendQueue = sendQueue ?? new SendQueue();
    this.agent = new AgentModel(store.reader, cdpProbeFrom(cdp));
  }

  private async resolveSwitch(composerId: string): Promise<ComposerSwitchResult | null> {
    if (!(await this.cdp.isAvailable())) return null;
    const hit = this.switchCache;
    if (hit && hit.composerId === composerId && Date.now() - hit.at < SWITCH_CACHE_MS) {
      return hit.result;
    }
    const data = this.store.reader.getComposerData(composerId);
    const raw = await this.cdp.switchComposer(composerId, { chatName: data?.name });
    const result: ComposerSwitchResult = {
      ok: raw.ok,
      reason: raw.reason,
      switchTarget: raw.switchTarget,
    };
    this.switchCache = { composerId, at: Date.now(), result };
    return result;
  }

  async snapshot(
    composerId?: string,
    opts?: { includeChats?: boolean }
  ): Promise<CursorSnapshot> {
    const cdpOk = await this.cdp.isAvailable();
    let windows: CursorWindow[] = [];
    let composerByWindow: ComposerUiState[] = [];
    if (cdpOk) {
      try {
        const targets = await this.cdp.listTargets();
        const probes = await this.cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
        windows = targets
          .filter(
            (t) =>
              (t.type === 'page' && (t.url || '').includes('workbench.html')) ||
              t.type === 'webview'
          )
          .map((t) => ({
            id: t.id,
            title: t.title,
            type: t.type,
            url: t.url,
            hasComposer: probes.some((p) => p.title === t.title),
          }));
        composerByWindow = probes.map((p) => ({ windowTitle: p.title, probe: p }));
      } catch {
        /* leave empty */
      }
    }
    const agent = composerId
      ? await this.agent.forComposer(composerId)
      : await this.agent.forCdp();
    const sw = composerId && cdpOk ? await this.resolveSwitch(composerId) : null;
    const snap: CursorSnapshot = {
      at: Date.now(),
      cdp: { ok: cdpOk },
      windows,
      composerByWindow,
      agent,
      switch: sw,
    };
    if (opts?.includeChats) {
      snap.chats = this.store.getChats().chats;
    }
    return snap;
  }

  async chat(composerId: string, fresh = false): Promise<ChatDetailView | null> {
    if (!this.store.reader.getComposerData(composerId)) return null;
    const { summary, messages } = this.store.getChat(composerId, fresh);
    const agent = await this.agent.forComposer(composerId);
    return {
      summary: summary ?? { composerId, name: 'Untitled' },
      composerId,
      messages,
      agent,
    };
  }

  agentState(composerId?: string): Promise<AgentState> {
    return composerId ? this.agent.forComposer(composerId) : this.agent.forCdp();
  }

  async send(
    text: string,
    opts?: { composerId?: string; windowTitle?: string }
  ): Promise<{ ok: true; text: string; pageTitle: string }> {
    if (opts?.composerId) {
      const sw = await this.resolveSwitch(opts.composerId);
      if (sw && !sw.ok && isSendStrict()) {
        throw new Error(`switch failed: ${sw.reason}`);
      }
    }
    const r = await this.cdp.sendMessage(text, { windowTitle: opts?.windowTitle });
    return { ok: true, text: r.text, pageTitle: r.pageTitle };
  }

  async enqueueSend(
    text: string,
    opts?: { composerId?: string; windowTitle?: string }
  ): Promise<QueuedSend & { position: number; native?: boolean; pageTitle?: string }> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('empty message');
    let windowTitle = opts?.windowTitle;
    if (opts?.composerId) {
      const sw = await this.resolveSwitch(opts.composerId);
      if (sw?.switchTarget) windowTitle = sw.switchTarget;
    }
    try {
      const r = await this.cdp.sendMessage(trimmed, { windowTitle, allowBusy: true });
      return {
        id: crypto.randomUUID(),
        at: Date.now(),
        text: trimmed,
        composerId: opts?.composerId,
        windowTitle,
        position: 0,
        native: true,
        pageTitle: r.pageTitle,
      };
    } catch {
      const item = this.sendQueue.enqueue(trimmed, opts);
      void this.drainSendQueue();
      return { ...item, position: this.sendQueue.length };
    }
  }

  listSendQueue(): QueuedSend[] {
    return this.sendQueue.list();
  }

  private async canSendNow(composerId?: string): Promise<boolean> {
    if (!(await this.cdp.isAvailable())) return false;
    const st = composerId
      ? await this.agent.forComposer(composerId)
      : await this.agent.forCdp();
    return st.cdpOk && !st.cdpBusy && !st.busy;
  }

  async drainSendQueue(): Promise<{ sent: number; remaining: number; lastPageTitle?: string }> {
    let sent = 0;
    let lastPageTitle: string | undefined;
    while (this.sendQueue.peek()) {
      const item = this.sendQueue.peek()!;
      if (!(await this.canSendNow(item.composerId))) break;
      this.sendQueue.shift();
      try {
        const r = await this.send(item.text, {
          composerId: item.composerId,
          windowTitle: item.windowTitle,
        });
        lastPageTitle = r.pageTitle;
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isAgentBusySendError(msg)) {
          this.sendQueue.unshift(item);
          break;
        }
        throw e;
      }
    }
    return { sent, remaining: this.sendQueue.length, lastPageTitle };
  }
}
