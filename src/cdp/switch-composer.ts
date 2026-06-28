import type { CdpPort } from './port';
import { probeActiveComposer } from './active-composer';
import { composerIdsMatch, filterTargetsByHints } from './window-match';
import { composerPageOrder, type CdpTarget } from './client';
import { runProbeOnTargets } from './probes/registry';
import { COMPOSER_SWITCH_PROBE_ID } from './port';
import type { ComposerSwitchValue } from './probes/composer-switch.v1';

export interface SwitchComposerOpts {
  windowTitle?: string;
  chatName?: string;
  workspaceHints?: string[];
}

export interface SwitchComposerResult {
  ok: boolean;
  reason: string;
  switchTarget?: string;
}

export async function switchComposerVerified(
  cdp: CdpPort,
  composerId: string,
  listTargets: () => Promise<CdpTarget[]>,
  opts?: SwitchComposerOpts
): Promise<SwitchComposerResult> {
  let targets = await listTargets();
  const hints = opts?.workspaceHints ?? [];
  if (hints.length) {
    const filtered = filterTargetsByHints(targets, hints);
    if (!filtered.length) return { ok: false, reason: 'workspace-window-not-found' };
    targets = filtered;
  }
  if (opts?.windowTitle) {
    const t = targets.find((x) => (x.title || '').includes(opts.windowTitle!));
    if (!t) return { ok: false, reason: 'window-not-found' };
  }
  const pages = composerPageOrder(targets);
  const scope =
    opts?.windowTitle != null
      ? pages.filter((p) => (p.title || '').includes(opts.windowTitle!))
      : pages;
  for (const page of scope.length ? scope : pages.slice(0, 2)) {
    const active = await probeActiveComposer(cdp, { windowTitle: page.title });
    if (active && composerIdsMatch(active.composerId, composerId)) {
      return { ok: true, reason: 'already-active', switchTarget: page.title || page.id };
    }
  }

  const rows = (await runProbeOnTargets(COMPOSER_SWITCH_PROBE_ID, targets, {
    composerId,
    chatName: opts?.chatName,
    pages,
  })) as ComposerSwitchValue[];

  for (const row of rows) {
    if (!row.ok || !row.target) continue;
    const active = await probeActiveComposer(cdp, { windowTitle: row.target });
    if (active && composerIdsMatch(active.composerId, composerId)) {
      return { ok: true, reason: row.reason, switchTarget: row.target };
    }
  }

  return { ok: false, reason: rows[0]?.reason || 'no-element' };
}
