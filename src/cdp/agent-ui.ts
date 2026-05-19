import { probeComposerAgent, type ComposerAgentDetail } from './composer-agent-probe';
import { liveCdp } from './live-cdp';
import type { CdpPort } from './port';

export type { ComposerAgentDetail } from './composer-agent-probe';

export async function readComposerAgentBusy(cdp: CdpPort = liveCdp): Promise<boolean> {
  return (await readComposerAgentDetail(cdp)).busy;
}

export async function readComposerAgentDetail(cdp: CdpPort = liveCdp): Promise<ComposerAgentDetail> {
  return probeComposerAgent(cdp);
}
