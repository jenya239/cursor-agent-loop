import type { CdpPort } from '../cdp/port';
import { probeWindowUsage } from '../cursor/probe-usage';
import { recordCostEntry } from '../db/cost-entries';

export async function recordEnqueueCost(
  cdp: CdpPort,
  options: { agentToken: string; composerId: string; databasePath?: string }
): Promise<void> {
  if (process.env.CR_BILLING_RECORD === '0') return;
  try {
    let contextPercent: number | null = null;
    let model: string | null = null;
    const windows = await probeWindowUsage(cdp);
    const match = windows.find((window) => window.composerId === options.composerId);
    if (match) {
      contextPercent = match.usagePct;
      model = match.model;
    }
    recordCostEntry({
      agentToken: options.agentToken,
      composerId: options.composerId,
      contextPercent,
      model,
      eventType: 'enqueue',
      databasePath: options.databasePath,
    });
  } catch {
    /* billing must not break enqueue */
  }
}
