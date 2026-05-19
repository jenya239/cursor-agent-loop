import { checkCdpAvailable, cdpBaseUrl, composerPageOrder, connectCdp, listTargets } from './client';
import {
  COMPOSER_AGENT_PROBE_ID,
  COMPOSER_AGENT_PROBE_JS,
  parseComposerAgentProbeValue,
} from './probes/composer-agent.v1';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import type { CdpPort, CdpProbeId } from './port';

export class LiveCdp implements CdpPort {
  constructor(private readonly base = cdpBaseUrl()) {}

  async isAvailable(): Promise<boolean> {
    return checkCdpAvailable(this.base);
  }

  async listTargets() {
    return listTargets(this.base);
  }

  async runProbe(probeId: CdpProbeId): Promise<ComposerAgentPageProbe[]> {
    if (probeId !== COMPOSER_AGENT_PROBE_ID) {
      throw new Error(`unknown probe: ${probeId}`);
    }
    const pages = composerPageOrder(await this.listTargets());
    const out: ComposerAgentPageProbe[] = [];
    for (const page of pages) {
      try {
        const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
        try {
          await send('Runtime.enable');
          const r = (await send('Runtime.evaluate', {
            expression: COMPOSER_AGENT_PROBE_JS,
            returnByValue: true,
          })) as { result?: { value?: unknown } };
          const v = parseComposerAgentProbeValue(r.result?.value);
          if (v) out.push({ title: page.title, ...v });
        } finally {
          close();
        }
      } catch {
        /* try next window */
      }
    }
    return out;
  }
}

export const liveCdp = new LiveCdp();
