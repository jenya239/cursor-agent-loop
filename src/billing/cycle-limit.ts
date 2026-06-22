import Database from 'better-sqlite3';
import path from 'path';
import { crRepoRoot } from '../db/cr-paths';

export interface CycleLimitConfig {
  /** Day of month when billing cycle starts (1-31). Default: env CR_CYCLE_START_DAY or 1 */
  cycleStartDay: number;
  /** Max sends allowed per full 30-day cycle. Default: env CR_CYCLE_MAX_SENDS or 150 */
  cycleMaxSends: number;
  /** Path to cr.db. Default: cr-paths default */
  dbPath?: string;
}

export interface CycleLimitResult {
  allowed: boolean;
  sendsToday: number;
  sendsSinceCycleStart: number;
  allowedSoFar: number;
  daysElapsed: number;
  config: CycleLimitConfig;
}

function resolveCycleLimitConfig(overrides?: Partial<CycleLimitConfig>): CycleLimitConfig {
  return {
    cycleStartDay: overrides?.cycleStartDay ?? (Number(process.env.CR_CYCLE_START_DAY) || 1),
    cycleMaxSends: overrides?.cycleMaxSends ?? (Number(process.env.CR_CYCLE_MAX_SENDS) || 150),
    dbPath: overrides?.dbPath,
  };
}

function cycleStartDate(startDay: number, now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const dom = now.getUTCDate();
  if (dom >= startDay) {
    return new Date(Date.UTC(year, month, startDay));
  }
  // previous month
  const prev = new Date(Date.UTC(year, month - 1, startDay));
  return prev;
}

function sendsSince(dbPath: string, since: Date): number {
  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      const row = db.prepare(
        `SELECT COUNT(*) AS n FROM cost_entries WHERE event_type='enqueue' AND created_at >= ?`
      ).get(since.toISOString().replace('T', ' ').slice(0, 19)) as { n: number };
      return row?.n ?? 0;
    } finally {
      db.close();
    }
  } catch {
    return 0;
  }
}

function sendsToday(dbPath: string): number {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return sendsSince(dbPath, start);
}

export function checkCycleLimit(overrides?: Partial<CycleLimitConfig>): CycleLimitResult {
  const cfg = resolveCycleLimitConfig(overrides);
  const dbPath = cfg.dbPath ?? path.join(crRepoRoot(), 'db', 'cr.db');
  const now = new Date();
  const cycleStart = cycleStartDate(cfg.cycleStartDay, now);
  const msElapsed = now.getTime() - cycleStart.getTime();
  const daysElapsed = Math.max(1, msElapsed / (1000 * 60 * 60 * 24));
  // proportional allowance so far in the cycle
  const allowedSoFar = Math.floor((daysElapsed / 30) * cfg.cycleMaxSends);
  const sendsSinceCycleStart = sendsSince(dbPath, cycleStart);
  const today = sendsToday(dbPath);
  return {
    allowed: sendsSinceCycleStart <= allowedSoFar,
    sendsToday: today,
    sendsSinceCycleStart,
    allowedSoFar,
    daysElapsed: Math.floor(daysElapsed),
    config: cfg,
  };
}
