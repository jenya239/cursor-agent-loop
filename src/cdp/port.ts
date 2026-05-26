import type { ActiveComposer } from './active-composer';
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

export interface DismissOutcome {
  kind: 'pretty_dialog' | 'revert';
  open: boolean;
  action?: string;
  btn?: string;
  windowTitle?: string;
}

export interface CdpPort {
  isAvailable(): Promise<boolean>;
  status(): Promise<{ ok: boolean; url: string }>;
  listTargets(): Promise<CdpTarget[]>;
  runProbe(
    probeId: typeof COMPOSER_AGENT_PROBE_ID
  ): Promise<ComposerAgentPageProbe[]>;
  switchComposer(
    composerId: string,
    opts?: { windowTitle?: string; chatName?: string; workspaceHints?: string[] }
  ): Promise<{ ok: boolean; reason: string; switchTarget?: string }>;
  sendMessage(text: string, opts?: { windowTitle?: string }): Promise<CdpSendResult>;
  probeActive(opts?: {
    windowTitle?: string;
    workspaceHints?: string[];
  }): Promise<ActiveComposer | null>;
  findWindowForComposer(
    composerId: string,
    opts?: { workspaceHints?: string[] }
  ): Promise<ActiveComposer | null>;
  dismissModals(): Promise<DismissOutcome[]>;
}
