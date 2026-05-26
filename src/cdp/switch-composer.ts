import type { CdpPort } from './port';
import { probeActiveComposer } from './active-composer';
import { composerPageOrder, type CdpTarget } from './client';
import { composerIdsMatch, filterTargetsByHints } from './window-match';
import { runProbeOnTargets } from './probes/registry';
import { COMPOSER_SWITCH_PROBE_ID } from './port';
import type { ComposerSwitchValue } from './probes/composer-switch.v1';
import { switchViaQuickOpen } from './switch-quick-open';

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

  const query = opts?.chatName || composerId.slice(0, 8);
  if (query.length >= 3) {
    const qo = await switchViaQuickOpen(targets, query, opts?.windowTitle);
    if (qo.ok && qo.switchTarget) {
      const active = await probeActiveComposer(cdp, { windowTitle: qo.switchTarget });
      if (!active || !composerIdsMatch(active.composerId, composerId)) {
        return { ok: false, reason: 'switch-mismatch', switchTarget: qo.switchTarget };
      }
    }
    return qo;
  }
  return { ok: false, reason: rows[0]?.reason || 'no-element' };
}
