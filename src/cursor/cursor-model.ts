import { AgentModel, type AgentState } from '../agent-model';
import { probeComposerAgent } from '../cdp/composer-agent-probe';
import type { ChatStore } from '../chat-store';
import type { CdpPort } from '../cdp/port';
import { COMPOSER_AGENT_PROBE_ID } from '../cdp/probes/composer-agent.v1';
import { liveCdp } from '../cdp/live-cdp';
import { isSendStrict } from '../send-strict';
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
  private switchCache: {
    composerId: string;
    at: number;
    result: ComposerSwitchResult;
  } | null = null;

  constructor(
    private readonly store: ChatStore,
    private readonly cdp: CdpPort = liveCdp
  ) {
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
}
