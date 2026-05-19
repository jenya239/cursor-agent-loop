import { checkCdpAvailable, cdpBaseUrl, listTargets } from './client';
import { runProbeOnTargets } from './probes/registry';
import { COMPOSER_AGENT_PROBE_ID, COMPOSER_SWITCH_PROBE_ID } from './port';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import type { CdpPort, CdpSendResult } from './port';
import { sendComposerMessage } from './send';

export class LiveCdp implements CdpPort {
  constructor(private readonly base = cdpBaseUrl()) {}

  async isAvailable(): Promise<boolean> {
    return checkCdpAvailable(this.base);
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
    opts?: { windowTitle?: string }
  ): Promise<{ ok: boolean; reason: string }> {
    if (!(await this.isAvailable())) {
      return { ok: false, reason: 'cdp-unavailable' };
    }
    const targets = await this.listTargets();
    if (opts?.windowTitle) {
      const t = targets.find((x) => (x.title || '').includes(opts.windowTitle!));
      if (!t) return { ok: false, reason: 'window-not-found' };
    }
    const rows = (await runProbeOnTargets(COMPOSER_SWITCH_PROBE_ID, targets, {
      composerId,
    })) as { ok: boolean; reason: string }[];
    if (rows.some((r) => r.ok)) return { ok: true, reason: 'clicked' };
    return { ok: false, reason: rows[0]?.reason || 'no-element' };
  }

  async sendMessage(text: string, opts?: { windowTitle?: string }): Promise<CdpSendResult> {
    const r = await sendComposerMessage(text, { windowTitle: opts?.windowTitle });
    return {
      ok: true,
      text: r.text,
      pageTitle: r.pageTitle,
      submitHow: r.submitHow,
    };
  }
}

export const liveCdp = new LiveCdp();
