export type TrackFocus = 'stability' | 'security' | 'performance' | 'architecture' | 'tooling';

export type StepStatusKind = 'pending' | 'done' | 'skip';

export interface TrackRow {
  step: number;
  item: string;
  status: string;
}

export interface TrackContent {
  name: string;
  closed: boolean;
  closedAt?: string;
  inProgress: boolean;
  rows: TrackRow[];
  pendingSteps: number[];
  pendingMeta: Set<number>;
  nextStep?: number;
  previousFile?: string;
  hasBlockedSkip: boolean;
  focus: TrackFocus;
}
