import type { CdpTarget } from './client';
import type { ComposerAgentPageProbe } from './probes/composer-agent.v1';
import { COMPOSER_AGENT_PROBE_ID } from './probes/composer-agent.v1';
import { COMPOSER_SWITCH_PROBE_ID } from './probes/composer-switch.v1';

export type CdpProbeId = typeof COMPOSER_AGENT_PROBE_ID | typeof COMPOSER_SWITCH_PROBE_ID;

export { COMPOSER_AGENT_PROBE_ID, COMPOSER_SWITCH_PROBE_ID };

export interface CdpSendResult {
  ok: true;
  text: string;
  pageTitle: string;
  submitHow?: string;
}

export interface CdpPort {
  isAvailable(): Promise<boolean>;
  listTargets(): Promise<CdpTarget[]>;
  runProbe(
    probeId: typeof COMPOSER_AGENT_PROBE_ID
  ): Promise<ComposerAgentPageProbe[]>;
  switchComposer(
    composerId: string,
    opts?: { windowTitle?: string; chatName?: string }
  ): Promise<{ ok: boolean; reason: string; switchTarget?: string }>;
  sendMessage(
    text: string,
    opts?: { windowTitle?: string; allowBusy?: boolean }
  ): Promise<CdpSendResult>;
}
