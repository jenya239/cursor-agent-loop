import type { CdpTarget } from './client';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import { COMPOSER_AGENT_PROBE_ID } from './probes/composer-agent.v1';

export type CdpProbeId = typeof COMPOSER_AGENT_PROBE_ID;

export interface CdpPort {
  isAvailable(): Promise<boolean>;
  listTargets(): Promise<CdpTarget[]>;
  runProbe(probeId: CdpProbeId): Promise<ComposerAgentPageProbe[]>;
}
