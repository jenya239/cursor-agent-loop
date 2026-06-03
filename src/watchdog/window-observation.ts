import type { ComposerAgentRole } from '../cdp/composer-bar';

export interface WindowObservation {
  windowTitle: string;
  composerId: string;
  model: string;
  agentRole: ComposerAgentRole;
  busy: boolean;
  slowCount: number;
  reconnecting: boolean;
  draftLen: number;
  draftHasToken: boolean;
  pairs: Array<{ preview: string; slow: boolean }>;
}
