import type { CdpTarget } from './client';
import { fixturePageMeta } from './fixture-page-meta';
import type { FixtureCdp } from './fixture-cdp';
import { buildWindowTree } from '../cursor/layout/build-tree';
import { classifyWindow } from '../cursor/layout/classify';
import type { CursorLayoutSnapshot, CursorWindowLayout } from '../cursor/layout/types';

export async function observeLayoutFixture(cdp: FixtureCdp): Promise<CursorLayoutSnapshot> {
  const targets = await cdp.listTargets();
  const windows: CursorWindowLayout[] = [];
  for (const t of targets) {
    if (t.type !== 'page') continue;
    const title = t.title || t.id;
    const meta = fixturePageMeta(title);
    if (!meta) continue;
    const classified = classifyWindow(title, t.url || '');
    const shell = meta.shell ?? classified.shell;
    const bar = meta.hasComposer ? cdp.probeComposerBar(title) : undefined;
    const panel = meta.hasComposer ? cdp.probeComposerPanel(title) : undefined;
    windows.push({
      targetId: t.id,
      title,
      url: t.url || '',
      shell,
      kind: classified.kind,
      tree: buildWindowTree({
        targetId: t.id,
        title,
        shell,
        kind: classified.kind,
        layout: cdp.layoutDataForWindow(title),
        bar,
        panel,
        activeComposerId: meta.activeComposerId,
      }),
    });
  }
  return { at: Date.now(), cdpOk: true, windows };
}
