import { workbenchPages } from '../cdp/client';
import { probeComposerStuck, recoverSlowGeneration } from '../cdp/composer-stuck';
import type { CdpPort } from '../cdp/port';

export interface WindowObservation {
  windowTitle: string;
  composerId: string;
  model: string;
  busy: boolean;
  slowCount: number;
  draftLen: number;
  draftHasToken: boolean;
  pairs: Array<{ preview: string; slow: boolean }>;
}

export async function observeWindows(cdp: CdpPort): Promise<WindowObservation[]> {
  if (!(await cdp.isAvailable())) return [];
  const out: WindowObservation[] = [];
  for (const page of workbenchPages(await cdp.listTargets())) {
    try {
      const p = await probeComposerStuck(page);
      out.push({ windowTitle: page.title || page.id, ...p });
    } catch {
      /* skip frozen window */
    }
  }
  return out;
}

export async function recoverSlowWindow(
  cdp: CdpPort,
  windowTitle: string
): Promise<{ windowTitle: string; outcome: Awaited<ReturnType<typeof recoverSlowGeneration>> } | null> {
  if (!(await cdp.isAvailable())) return null;
  const page = workbenchPages(await cdp.listTargets()).find((t) => (t.title || '').includes(windowTitle));
  if (!page) return null;
  return { windowTitle: page.title || windowTitle, outcome: await recoverSlowGeneration(page) };
}
