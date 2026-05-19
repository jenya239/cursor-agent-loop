import type { CdpProbe } from '../agent-model';
import { probeComposerAgent } from './composer-agent-probe';
import { FixtureCdp, type FixtureScenario } from './fixture-cdp';
import type { CdpPort } from './port';

function cdpProbeFrom(port: CdpPort): CdpProbe {
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

/** Test doubles for Cursor CDP (use in unit/integration tests). */
export const CursorMock = {
  port(scenario: FixtureScenario = 'idle'): CdpPort {
    return new FixtureCdp(scenario);
  },
  idle: (): CdpProbe => cdpProbeFrom(new FixtureCdp('idle')),
  agentRunning: (): CdpProbe => cdpProbeFrom(new FixtureCdp('busy')),
  cdpDown: (): CdpProbe => cdpProbeFrom(new FixtureCdp('down')),
  probeFrom(port: CdpPort): CdpProbe {
    return cdpProbeFrom(port);
  },
};
