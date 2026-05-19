import { AgentModel, type AgentState } from '../agent-model';
import { probeComposerAgent } from '../cdp/composer-agent-probe';
import type { ChatStore } from '../chat-store';
import type { CdpPort } from '../cdp/port';
import { COMPOSER_AGENT_PROBE_ID } from '../cdp/probes/composer-agent.v1';
import { liveCdp } from '../cdp/live-cdp';
import type { ChatDetailView, ComposerUiState, CursorSnapshot, CursorWindow } from './types';

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

  constructor(
    private readonly store: ChatStore,
    private readonly cdp: CdpPort = liveCdp
  ) {
    this.agent = new AgentModel(store.reader, cdpProbeFrom(cdp));
  }

  async snapshot(composerId?: string): Promise<CursorSnapshot> {
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
    const { chats } = this.store.getChats();
    const agent = composerId
      ? await this.agent.forComposer(composerId)
      : await this.agent.forCdp();
    return {
      at: Date.now(),
      cdp: { ok: cdpOk },
      windows,
      composerByWindow,
      chats,
      agent,
    };
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
      const sw = await this.cdp.switchComposer(opts.composerId, {
        windowTitle: opts.windowTitle,
      });
      if (!sw.ok) throw new Error(`switch failed: ${sw.reason}`);
    }
    const r = await this.cdp.sendMessage(text, { windowTitle: opts?.windowTitle });
    return { ok: true, text: r.text, pageTitle: r.pageTitle };
  }
}
