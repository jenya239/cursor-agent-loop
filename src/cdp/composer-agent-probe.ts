import type { CdpPort } from './port';
import { COMPOSER_AGENT_PROBE_ID } from './probes/composer-agent.v1';
import { liveCdp } from './live-cdp';

export interface ComposerAgentDetail {
  busy: boolean;
  cdpOk: boolean;
  reason: string;
  windowTitle?: string;
}

export async function probeComposerAgent(cdp: CdpPort = liveCdp): Promise<ComposerAgentDetail> {
  try {
    if (!(await cdp.isAvailable())) {
      return { busy: false, cdpOk: false, reason: 'cdp-unavailable' };
    }
    const pages = await cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
    if (!pages.length) {
      return { busy: false, cdpOk: false, reason: 'no-window' };
    }
    let first = pages[0];
    for (const p of pages) {
      if (p.busy) {
        return { busy: true, cdpOk: true, reason: p.reason, windowTitle: p.title };
      }
      first = p;
    }
    return { busy: false, cdpOk: true, reason: first.reason, windowTitle: first.title };
  } catch {
    return { busy: false, cdpOk: false, reason: 'cdp-error' };
  }
}
