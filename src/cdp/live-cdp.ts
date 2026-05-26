import { checkCdpAvailable, cdpBaseUrl, listTargets } from './client';
import { runComposerSend } from './composer-send';
import { switchComposerVerified } from './switch-composer';
import { runProbeOnTargets } from './probes/registry';
import { liveProbeActive, liveFindWindowForComposer } from './active-composer';
import { liveDismissModals } from './dismiss-modals';
import { COMPOSER_AGENT_PROBE_ID } from './port';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import type { ActiveComposer } from './active-composer';
import type { CdpPort, CdpSendResult, DismissOutcome } from './port';

export class LiveCdp implements CdpPort {
  constructor(private readonly base = cdpBaseUrl()) {}

  async isAvailable(): Promise<boolean> {
    return checkCdpAvailable(this.base);
  }

  async status(): Promise<{ ok: boolean; url: string }> {
    return { ok: await this.isAvailable(), url: this.base };
  }

  async listTargets() {
    return listTargets(this.base);
  }

  async runProbe(probeId: typeof COMPOSER_AGENT_PROBE_ID): Promise<ComposerAgentPageProbe[]> {
    const targets = await this.listTargets();
    return runProbeOnTargets(probeId, targets) as Promise<ComposerAgentPageProbe[]>;
  }

  async switchComposer(
    composerId: string,
    opts?: { windowTitle?: string; chatName?: string; workspaceHints?: string[] }
  ) {
    if (!(await this.isAvailable())) {
      return { ok: false, reason: 'cdp-unavailable' };
    }
    return switchComposerVerified(this, composerId, () => listTargets(this.base), opts);
  }

  async sendMessage(text: string, opts?: { windowTitle?: string }): Promise<CdpSendResult> {
    const r = await runComposerSend(this, text, { windowTitle: opts?.windowTitle });
    return { ok: true, text: r.text, pageTitle: r.pageTitle, submitHow: r.submitHow };
  }

  async probeActive(opts?: {
    windowTitle?: string;
    workspaceHints?: string[];
  }): Promise<ActiveComposer | null> {
    return liveProbeActive(this, opts);
  }

  async findWindowForComposer(
    composerId: string,
    opts?: { workspaceHints?: string[] }
  ): Promise<ActiveComposer | null> {
    return liveFindWindowForComposer(this, composerId, opts?.workspaceHints);
  }

  async dismissModals(): Promise<DismissOutcome[]> {
    return liveDismissModals(this);
  }
}

export const liveCdp = new LiveCdp();
