import type { CdpPort } from '../cdp/port';
import { parseComposerBarProbe, PROBE_COMPOSER_BAR_JS } from '../cdp/composer-bar';
import { parseComposerPanelProbe, PROBE_COMPOSER_PANEL_JS } from '../cdp/composer-panel';
import { liveCdp } from '../cdp/live-cdp';
import { evalOnPage } from '../cdp/live-page';

export interface WindowUsage {
  windowTitle: string;
  model: string;
  usagePct: number | null;
  usageVisible: boolean;
  composerId: string;
  busy: boolean;
  slowCount: number | null;
  reconnecting: boolean;
}

export async function probeWindowUsage(cdp: CdpPort = liveCdp): Promise<WindowUsage[]> {
  if (!(await cdp.isAvailable())) return [];
  const pages = (await cdp.listTargets()).filter(
    (t) => t.type === 'page' && /Cursor/i.test(t.title || '') && !/Settings/i.test(t.title || '')
  );
  const out: WindowUsage[] = [];
  for (const page of pages) {
    if (!page.webSocketDebuggerUrl) continue;
    try {
      const panelRaw = await evalOnPage(page, PROBE_COMPOSER_PANEL_JS, true);
      const p = parseComposerPanelProbe(panelRaw);
      if (!p?.ok) continue;
      const barRaw = await evalOnPage(page, PROBE_COMPOSER_BAR_JS, true);
      const bar = parseComposerBarProbe(barRaw);
      out.push({
        windowTitle: page.title || '',
        model: p.model.label,
        usagePct: p.context.usagePct,
        usageVisible: p.context.usageVisible,
        composerId: p.composerId,
        busy: bar?.busy ?? false,
        slowCount: bar?.slowCount ?? null,
        reconnecting: bar?.reconnecting ?? false,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export function maxUsagePct(windows: WindowUsage[]): number | null {
  const vals = windows.map((w) => w.usagePct).filter((x): x is number => x != null);
  return vals.length ? Math.max(...vals) : null;
}

export function isExpensiveModel(label: string): boolean {
  return /sonnet|opus|thinking|o3|gpt-5/i.test(label) && !/fast|medium/i.test(label);
}
