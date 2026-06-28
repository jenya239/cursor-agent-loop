import type { TrackFocus } from './track/types';

export type AgentRole =
  | 'Driver'
  | 'Planner'
  | 'Backlog'
  | 'Meta'
  | 'Critic'
  | 'Orchestrator'
  | 'Cleaner'
  | 'Blogger'
  | 'Reviewer'
  | 'OrchestratorDev'
  | 'Monitor'
  | 'Researcher';

export interface TrackInfo {
  file: string;
  name: string;
  closed: boolean;
  closedAt?: string;
  inProgress: boolean;
  pendingSteps: number[];
  pendingMeta?: Set<number>;
  nextStep?: number;
  focus: TrackFocus;
  previousFile?: string;
  hasBlockedSkip?: boolean;
}

export interface SessionInfo {
  driverTurnsSincePlan: number;
  roleLast?: string;
  stepLast?: string;
  activeTrack?: string;
}

export interface NextAgentStep {
  role: AgentRole;
  step: string;
  trackFile: string;
  focus: TrackFocus;
  reason: string;
  refs: string[];
}

export type ChatLine = { role: string; text: string };

export interface LoopDecision {
  allow: boolean;
  reason?: string;
  adjustedText?: string;
}

export type GuardPlan =
  | { action: 'skip'; reason: string }
  | { action: 'send'; text: string; role: string; step: string }
  | { action: 'recovery'; text: string; reason: string; role: string; step: string };
