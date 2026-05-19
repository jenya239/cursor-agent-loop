import { checkCdpAvailable, cdpBaseUrl, listTargets } from './client';
import { switchViaQuickOpen } from './switch-quick-open';
import { runComposerSend } from './composer-send';
import { runProbeOnTargets } from './probes/registry';
import { COMPOSER_AGENT_PROBE_ID, COMPOSER_SWITCH_PROBE_ID } from './port';
import type { ComposerSwitchValue } from './probes/composer-switch.v1';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import type { CdpPort, CdpSendResult } from './port';

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
    opts?: { windowTitle?: string; chatName?: string }
  ): Promise<{ ok: boolean; reason: string; switchTarget?: string }> {
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
      chatName: opts?.chatName,
    })) as ComposerSwitchValue[];
    const hit = rows.find((r) => r.ok);
    if (hit) {
      return {
        ok: true,
        reason: hit.reason,
        switchTarget: hit.target ?? opts?.windowTitle,
      };
    }
    const query = opts?.chatName || composerId.slice(0, 8);
    if (query.length >= 3) {
      return switchViaQuickOpen(targets, query, opts?.windowTitle);
    }
    return { ok: false, reason: rows[0]?.reason || 'no-element' };
  }

  async sendMessage(text: string, opts?: { windowTitle?: string }): Promise<CdpSendResult> {
    const r = await runComposerSend(text, { windowTitle: opts?.windowTitle, base: this.base });
    return { ok: true, text: r.text, pageTitle: r.pageTitle, submitHow: r.submitHow };
  }
}

export const liveCdp = new LiveCdp();
