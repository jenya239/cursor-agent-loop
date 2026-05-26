import { connectCdp, composerPageOrder, pageHasComposer, workbenchPages, type CdpTarget } from './client';
import type { CdpPort } from './port';
import { fixtureActiveIdForWindow, isFixtureCdp } from './fixture-cdp';
import { composerIdsMatch, filterTargetsByHints } from './window-match';
import {
  COMPOSER_ACTIVE_PROBE_JS,
  parseComposerActiveValue,
  type ComposerActiveValue,
} from './probes/composer-active.v1';

export interface ActiveComposer {
  composerId: string;
  windowTitle: string;
  reason: string;
}

function score(v: ComposerActiveValue): number {
  if (!v.ok || !v.composerId) return -1;
  let s = 0;
  if (v.hasFocus) s += 10;
  if (v.inComposer) s += 5;
  if (v.reason === 'composer-bar-id') s += 3;
  if (v.reason === 'active-tab') s += 2;
  return s;
}

async function probePage(page: CdpTarget): Promise<(ComposerActiveValue & { windowTitle: string }) | null> {
  const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');
    const r = (await send('Runtime.evaluate', {
      expression: COMPOSER_ACTIVE_PROBE_JS,
      returnByValue: true,
    })) as { result?: { value?: unknown } };
    const v = parseComposerActiveValue(r.result?.value);
    if (!v) return null;
    return { ...v, windowTitle: page.title || '' };
  } finally {
    close();
  }
}

async function pickBestAmongPages(
  cdp: CdpPort,
  pages: CdpTarget[]
): Promise<(ComposerActiveValue & { windowTitle: string }) | null> {
  let best: (ComposerActiveValue & { windowTitle: string }) | null = null;
  let bestScore = -1;
  for (const page of pages) {
    try {
      const hasBar = isFixtureCdp(cdp) ? cdp.pageHasComposer(page) : await pageHasComposer(page);
      if (!hasBar) continue;
      const v = await probePage(page);
      if (!v) continue;
      const s = score(v);
      if (s > bestScore && v.composerId) {
        best = v;
        bestScore = s;
      }
    } catch {
      /* next window */
    }
  }
  return best;
}

export async function liveProbeActive(
  cdp: CdpPort,
  opts?: { windowTitle?: string; workspaceHints?: string[] }
): Promise<ActiveComposer | null> {
  if (!(await cdp.isAvailable())) return null;

  const targets = await cdp.listTargets();
  let pages = composerPageOrder(targets);

  if (opts?.windowTitle) {
    const hit = targets.filter((t) => (t.title || '').includes(opts.windowTitle!));
    if (hit.length) pages = composerPageOrder(hit);
  } else if (opts?.workspaceHints?.length) {
    const filtered = filterTargetsByHints(targets, opts.workspaceHints);
    if (filtered.length) pages = composerPageOrder(filtered);
  }

  const best = await pickBestAmongPages(cdp, pages);
  if (!best?.composerId) return null;
  return {
    composerId: best.composerId,
    windowTitle: best.windowTitle,
    reason: best.reason,
  };
}

export async function liveFindWindowForComposer(
  cdp: CdpPort,
  composerId: string,
  workspaceHints?: string[]
): Promise<ActiveComposer | null> {
  if (!(await cdp.isAvailable())) return null;
  const targets = await cdp.listTargets();
  let pages = composerPageOrder(targets);
  if (workspaceHints?.length) {
    const hinted = filterTargetsByHints(targets, workspaceHints);
    const rest = targets.filter((t) => !hinted.some((h) => h.id === t.id));
    if (hinted.length) pages = composerPageOrder([...hinted, ...rest]);
  }
  for (const page of pages) {
    if (!(await pageHasComposer(page))) continue;
    const v = await probePage(page);
    if (v?.ok && v.composerId && composerIdsMatch(v.composerId, composerId)) {
      return {
        composerId: v.composerId,
        windowTitle: page.title || '',
        reason: 'composer-already-open',
      };
    }
  }
  return null;
}

export async function probeActiveComposer(
  cdp: CdpPort,
  opts?: { windowTitle?: string; workspaceHints?: string[] }
): Promise<ActiveComposer | null> {
  return cdp.probeActive(opts);
}

/** Window where .composer-bar already shows this composerId (skip switch). */
export async function findWindowForComposerId(
  cdp: CdpPort,
  composerId: string,
  workspaceHints?: string[]
): Promise<ActiveComposer | null> {
  return cdp.findWindowForComposer(composerId, { workspaceHints });
}

export async function workbenchHasComposerMap(
  cdp: CdpPort,
  targets: CdpTarget[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  const pages = workbenchPages(targets);
  await Promise.all(
    pages.map(async (p) => {
      if (isFixtureCdp(cdp)) {
        map.set(p.id, cdp.pageHasComposer(p));
        return;
      }
      map.set(p.id, await pageHasComposer(p));
    })
  );
  return map;
}
