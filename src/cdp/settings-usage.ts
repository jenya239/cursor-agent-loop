import type { CdpPort } from './port';
import { connectCdp } from './client';
import { openCrDatabase } from '../db/migrate';

export interface CursorUsageSnapshot {
  plan: string;
  autoComposerPct: number | null;
  apiPct: number | null;
  onDemandUsd: number | null;
  onDemandLimitUsd: number | null;
  resetsIn: string | null;
  rawText: string;
  fetchedAt: number;
}

// ??? JS injected into Cursor renderer ??????????????????????????????????????

const ACTIVATE_SETTINGS_TAB_JS = `(() => {
  // Find the Cursor Settings editor tab and click it if not active
  const tabs = [...document.querySelectorAll('.tab')];
  const settingsTab = tabs.find(el =>
    /Cursor Settings/i.test(el.getAttribute('aria-label') || el.textContent || '')
  );
  if (!settingsTab) return { ok: false, reason: 'no-settings-tab' };
  const isActive = settingsTab.classList.contains('active') || settingsTab.classList.contains('selected');
  if (!isActive) settingsTab.click();
  return { ok: true, wasActive: isActive };
})()`;

const ENSURE_PLAN_USAGE_JS = `(() => {
  const cells = [...document.querySelectorAll('.cursor-settings-sidebar-cell')];
  if (!cells.length) return { ok: false, reason: 'no-cells' };

  const planCell = cells.find(el => el.textContent?.trim() === 'Plan & Usage');
  if (!planCell) return { ok: false, reason: 'no-plan-cell' };

  // Check if already selected
  const isSelected = planCell.classList.contains('active') ||
    planCell.classList.contains('selected') ||
    planCell.getAttribute('aria-selected') === 'true';

  if (isSelected) {
    // Click another tab first to force refresh
    const other = cells.find(el => el.textContent?.trim() === 'General');
    if (other) { other.click(); return { ok: true, bounced: true }; }
  }

  planCell.click();
  return { ok: true, bounced: false };
})()`;

const CLICK_PLAN_USAGE_JS = `(() => {
  const cells = [...document.querySelectorAll('.cursor-settings-sidebar-cell')];
  const planCell = cells.find(el => el.textContent?.trim() === 'Plan & Usage');
  if (!planCell) return { ok: false, reason: 'no-plan-cell' };
  planCell.click();
  return { ok: true };
})()`;

const READ_SETTINGS_USAGE_JS = `(() => {
  const outer = document.querySelector('.cursor-settings-pane-outer-wrapper');
  if (!outer) return { ok: false, reason: 'no-pane' };
  const text = (outer.innerText || '').replace(/\\s+/g, ' ').trim();
  if (!text.includes('Plan & Usage')) return { ok: false, reason: 'wrong-pane', preview: text.slice(0, 80) };
  return { ok: true, text };
})()`;

/** Also extract what other settings sections are visible � useful for future probes */
export const READ_SETTINGS_SECTIONS_JS = `(() => {
  const cells = [...document.querySelectorAll('.cursor-settings-sidebar-cell')];
  return cells.map(el => ({
    label: el.textContent?.trim(),
    selected: el.classList.contains('active') || el.classList.contains('selected'),
  }));
})()`;

// ??? Parser ?????????????????????????????????????????????????????????????????

export function parseUsageText(text: string): Omit<CursorUsageSnapshot, 'fetchedAt' | 'rawText'> {
  const planMatch = text.match(/CURRENT PLAN\s+(\w+)/i);
  const plan = planMatch?.[1] ?? 'Unknown';

  // "2% Auto and 3% API used" or "Auto + Composer  2%"
  const autoMatch =
    text.match(/Auto \+ Composer\s+([\d.]+)%/i) ||
    text.match(/([\d.]+)%\s*Auto(?:\s+and|\s*\+)/i);
  const autoComposerPct = autoMatch ? parseFloat(autoMatch[1]) : null;

  const apiMatch =
    text.match(/(?:^|\s)API\s+([\d.]+)%/im) ||
    text.match(/and\s+([\d.]+)%\s*API/i);
  const apiPct = apiMatch ? parseFloat(apiMatch[1]) : null;

  const onDemandMatch = text.match(/On-Demand\s+\$([\d.]+)\s*\/\s*\$([\d.]+)/i);
  const onDemandUsd = onDemandMatch ? parseFloat(onDemandMatch[1]) : null;
  const onDemandLimitUsd = onDemandMatch ? parseFloat(onDemandMatch[2]) : null;

  const resetsMatch = text.match(/Resets on ([^\n(]+(?:\([^)]+\))?)/i);
  const resetsIn = resetsMatch ? resetsMatch[1].trim() : null;

  return { plan, autoComposerPct, apiPct, onDemandUsd, onDemandLimitUsd, resetsIn };
}

// ??? Main probe ?????????????????????????????????????????????????????????????

type EvalResult = { result?: { value?: unknown } };

async function eval_<T>(
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
  expression: string
): Promise<T | null> {
  const res = (await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  })) as EvalResult;
  return (res?.result?.value ?? null) as T | null;
}

export async function probeSettingsUsage(cdp: CdpPort): Promise<CursorUsageSnapshot | null> {
  const targets = await cdp.listTargets();
  // prefer the window that already has settings open, otherwise pick any Cursor page (not Agents)
  const page =
    targets.find(
      (t) =>
        t.type === 'page' &&
        /Cursor Settings/i.test(t.title || '') &&
        !/Agents/i.test(t.title || '')
    ) ?? targets.find((t) => t.type === 'page' && /Cursor/i.test(t.title || '') && !/Agents/i.test(t.title || ''));

  if (!page?.webSocketDebuggerUrl) return null;

  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    // Step 1: make sure settings tab is active in the editor
    const activateResult = await eval_<{ ok: boolean; wasActive?: boolean; reason?: string }>(
      send,
      ACTIVATE_SETTINGS_TAB_JS
    );
    if (!activateResult?.ok) {
      // Settings tab not open � can't do anything without opening it
      return null;
    }
    if (!activateResult.wasActive) {
      await new Promise((r) => setTimeout(r, 600));
    }

    // Step 2: navigate to Plan & Usage (bounce via General if already there)
    const ensureResult = await eval_<{ ok: boolean; bounced?: boolean; reason?: string }>(
      send,
      ENSURE_PLAN_USAGE_JS
    );
    if (!ensureResult?.ok) return null;

    if (ensureResult.bounced) {
      // Clicked General first � wait, then click Plan & Usage
      await new Promise((r) => setTimeout(r, 500));
      await eval_<unknown>(send, CLICK_PLAN_USAGE_JS);
    }

    // Step 3: wait for panel content
    await new Promise((r) => setTimeout(r, 1200));

    // Step 4: read
    const readResult = await eval_<{ ok: boolean; text?: string; reason?: string }>(
      send,
      READ_SETTINGS_USAGE_JS
    );
    if (!readResult?.ok || !readResult.text) return null;

    return {
      ...parseUsageText(readResult.text),
      rawText: readResult.text.slice(0, 600),
      fetchedAt: Date.now(),
    };
  } finally {
    close();
  }
}

// ??? Daily log ???????????????????????????????????????????????????????????????

export interface UsageSnapshotRow {
  id: number;
  date: string;
  plan: string | null;
  auto_composer_pct: number | null;
  api_pct: number | null;
  on_demand_usd: number | null;
  on_demand_limit_usd: number | null;
  resets_in: string | null;
  raw_text: string | null;
  created_at: string;
}

/** Upsert today's snapshot (UTC date). Returns stored row. */
export function saveUsageSnapshot(
  snap: CursorUsageSnapshot,
  dbPath?: string
): UsageSnapshotRow {
  const db = openCrDatabase(dbPath);
  try {
    const date = new Date(snap.fetchedAt).toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO usage_snapshots
        (date, plan, auto_composer_pct, api_pct, on_demand_usd, on_demand_limit_usd, resets_in, raw_text)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(date) DO UPDATE SET
        plan=excluded.plan,
        auto_composer_pct=excluded.auto_composer_pct,
        api_pct=excluded.api_pct,
        on_demand_usd=excluded.on_demand_usd,
        on_demand_limit_usd=excluded.on_demand_limit_usd,
        resets_in=excluded.resets_in,
        raw_text=excluded.raw_text,
        created_at=datetime('now')
    `).run(
      date,
      snap.plan,
      snap.autoComposerPct ?? null,
      snap.apiPct ?? null,
      snap.onDemandUsd ?? null,
      snap.onDemandLimitUsd ?? null,
      snap.resetsIn ?? null,
      snap.rawText
    );
    return db.prepare('SELECT * FROM usage_snapshots WHERE date = ?').get(date) as UsageSnapshotRow;
  } finally {
    db.close();
  }
}

export function listUsageSnapshots(limit = 30, dbPath?: string): UsageSnapshotRow[] {
  const db = openCrDatabase(dbPath);
  try {
    return db
      .prepare('SELECT * FROM usage_snapshots ORDER BY date DESC LIMIT ?')
      .all(limit) as UsageSnapshotRow[];
  } finally {
    db.close();
  }
}
