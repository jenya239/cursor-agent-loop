import type { CdpTarget } from '../../cdp/client';
import { isFixtureCdp } from '../../cdp/fixture-cdp';
import { observeLayoutFixture } from '../../cdp/fixture-layout';
import { evalOnPage } from '../../cdp/live-page';
import type { CdpPort } from '../../cdp/port';
import { parseComposerBarProbe } from '../../cdp/composer-bar';
import { parseComposerPanelProbe } from '../../cdp/composer-panel';
import {
  CURSOR_LAYOUT_PROBE_JS,
  parseCursorLayoutProbe,
  shellFromLayoutProbe,
} from '../../cdp/probes/cursor-layout.v1';
import { buildWindowTree } from './build-tree';
import { classifyWindow } from './classify';
import type { CursorLayoutSnapshot, CursorUiShell, CursorWindowLayout } from './types';

export async function observeCursorLayout(cdp: CdpPort): Promise<CursorLayoutSnapshot> {
  const cdpOk = await cdp.isAvailable();
  if (!cdpOk) return { at: Date.now(), cdpOk: false, windows: [] };
  if (isFixtureCdp(cdp)) return observeLayoutFixture(cdp);

  const targets = (await cdp.listTargets()).filter((t) => t.type === 'page');
  const settled = await Promise.all(
    targets.map(async (page) => {
      try {
        return await layoutForPage(page);
      } catch {
        return null;
      }
    })
  );
  return {
    at: Date.now(),
    cdpOk: true,
    windows: settled.filter((w): w is CursorWindowLayout => w !== null),
  };
}

async function layoutForPage(page: CdpTarget): Promise<CursorWindowLayout> {
  const title = page.title || page.id;
  const classified = classifyWindow(title, page.url || '');
  const raw = await evalOnPage(page, CURSOR_LAYOUT_PROBE_JS, true);
  const parsed = parseCursorLayoutProbe(raw) ?? {};
  const probeShell = shellFromLayoutProbe(raw);
  const shell = (probeShell as CursorUiShell | null) ?? classified.shell;
  const bar =
    parseComposerBarProbe((raw as Record<string, unknown> | null)?.bar) ?? undefined;
  const panel =
    parseComposerPanelProbe((raw as Record<string, unknown> | null)?.composerPanel) ?? undefined;
  return {
    targetId: page.id,
    title,
    url: page.url || '',
    shell,
    kind: classified.kind,
    tree: buildWindowTree({
      targetId: page.id,
      title,
      shell,
      kind: classified.kind,
      layout: parsed,
      bar,
      panel,
      activeComposerId: bar?.composerId || panel?.composerId || null,
    }),
  };
}
