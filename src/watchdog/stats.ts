export interface WatchdogEvent {
  ts: string;
  type: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface WatchdogStatsSnapshot {
  uptime_ms: number;
  polls_total: number;
  modals_dismissed: { pretty_dialog: number; revert: number };
  drain_sent_total: number;
  slow_recoveries_total: number;
  errors_total: number;
  last_dismiss_at: string | null;
  last_observe_at: string | null;
  paused: boolean;
  usageMax?: number | null;
  windows: Array<{
    windowTitle: string;
    composerId: string;
    model: string;
    busy: boolean;
    slowCount: number;
    reconnecting?: boolean;
    draftLen: number;
    draftHasToken: boolean;
    usagePct?: number | null;
  }>;
}

const MAX_LOG = 100;

export class WatchdogStats {
  private startedAt: number;
  private polls_total = 0;
  private modals_dismissed = { pretty_dialog: 0, revert: 0 };
  private drain_sent_total = 0;
  private slow_recoveries_total = 0;
  private errors_total = 0;
  private last_dismiss_at: string | null = null;
  private last_observe_at: string | null = null;
  private paused = false;
  private windows: WatchdogStatsSnapshot['windows'] = [];
  private log: WatchdogEvent[] = [];

  constructor(startedAt = Date.now()) {
    this.startedAt = startedAt;
  }

  snapshot(now = Date.now()): WatchdogStatsSnapshot {
    return {
      uptime_ms: Math.max(0, now - this.startedAt),
      polls_total: this.polls_total,
      modals_dismissed: { ...this.modals_dismissed },
      drain_sent_total: this.drain_sent_total,
      slow_recoveries_total: this.slow_recoveries_total,
      errors_total: this.errors_total,
      last_dismiss_at: this.last_dismiss_at,
      last_observe_at: this.last_observe_at,
      paused: this.paused,
      windows: this.windows.map((w) => ({ ...w })),
    };
  }

  events(limit = MAX_LOG): WatchdogEvent[] {
    return this.log.slice(-limit);
  }

  recordPoll(): void {
    this.polls_total++;
    this.push('poll', 'tick');
  }

  recordDismiss(kind: 'pretty_dialog' | 'revert', meta?: Record<string, unknown>): void {
    this.modals_dismissed[kind]++;
    this.last_dismiss_at = new Date().toISOString();
    this.push('dismiss', kind, meta);
  }

  recordDrain(sent: number): void {
    this.drain_sent_total += sent;
    if (sent > 0) this.push('drain', `sent=${sent}`);
  }

  recordObserve(
    windows: WatchdogStatsSnapshot['windows'],
    meta?: Record<string, unknown>
  ): void {
    this.windows = windows.map((w) => ({ ...w }));
    this.last_observe_at = new Date().toISOString();
    this.push('observe', `windows=${windows.length}`, meta);
  }

  recordSlowRecover(windowTitle: string, meta?: Record<string, unknown>): void {
    this.slow_recoveries_total++;
    this.push('slow_recover', windowTitle, meta);
  }

  recordError(message: string, meta?: Record<string, unknown>): void {
    this.errors_total++;
    this.push('error', message, meta);
  }

  /** Drop stale error count so CDP glitches do not block guard forever. */
  decayErrors(now = Date.now(), windowMs = 30 * 60_000): void {
    const cutoff = now - windowMs;
    const recent = this.log.filter((e) => e.type === 'error' && e.ts >= new Date(cutoff).toISOString()).length;
    if (recent === 0 && this.errors_total > 0) this.errors_total = 0;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.push('control', paused ? 'paused' : 'resumed');
  }

  private push(type: string, message: string, meta?: Record<string, unknown>): void {
    this.log.push({ ts: new Date().toISOString(), type, message, meta });
    if (this.log.length > MAX_LOG) this.log.shift();
  }
}
