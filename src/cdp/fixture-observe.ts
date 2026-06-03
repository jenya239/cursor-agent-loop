import { workbenchPages } from './client';
import type { FixtureCdp } from './fixture-cdp';
import type { WindowObservation } from '../watchdog/window-observation';

export async function observeWindowsFixture(cdp: FixtureCdp): Promise<WindowObservation[]> {
  const out: WindowObservation[] = [];
  for (const page of workbenchPages(await cdp.listTargets())) {
    if (!cdp.pageHasComposer(page)) continue;
    const title = page.title || page.id;
    out.push({ windowTitle: title, ...cdp.probeComposerBar(title) });
  }
  return out;
}
