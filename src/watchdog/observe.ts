import { workbenchPages, type CdpTarget } from '../cdp/client';
import { isFixtureCdp } from '../cdp/fixture-cdp';
import { observeWindowsFixture } from '../cdp/fixture-observe';
import { probeComposerStuck, recoverSlowGeneration } from '../cdp/composer-stuck';
import type { CdpPort } from '../cdp/port';
import type { WindowObservation } from './window-observation';
export type { WindowObservation } from './window-observation';

export async function observeWindowsFromTargets(targets: CdpTarget[]): Promise<WindowObservation[]> {
  const out: WindowObservation[] = [];
  for (const page of workbenchPages(targets)) {
    try {
      const p = await probeComposerStuck(page);
      out.push({ windowTitle: page.title || page.id, ...p });
    } catch {
      /* skip frozen window */
    }
  }
  return out;
}

export async function observeWindows(cdp: CdpPort): Promise<WindowObservation[]> {
  if (!(await cdp.isAvailable())) return [];
  if (isFixtureCdp(cdp)) return observeWindowsFixture(cdp);
  return observeWindowsFromTargets(await cdp.listTargets());
}

export async function recoverSlowWindow(
  cdp: CdpPort,
  windowTitle: string,
  cachedTargets?: CdpTarget[]
): Promise<{ windowTitle: string; outcome: Awaited<ReturnType<typeof recoverSlowGeneration>> } | null> {
  if (!(await cdp.isAvailable())) return null;
  const targets = cachedTargets ?? (await cdp.listTargets());
  const page = workbenchPages(targets).find((t) => (t.title || '').includes(windowTitle));
  if (!page) return null;
  return { windowTitle: page.title || windowTitle, outcome: await recoverSlowGeneration(page, cdp) };
}
