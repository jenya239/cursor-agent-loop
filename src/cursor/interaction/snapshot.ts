import { isFixtureCdp } from '../../cdp/fixture-cdp';
import { fixturePageMeta } from '../../cdp/fixture-page-meta';
import { evalOnPage } from '../../cdp/live-page';
import type { CdpPort } from '../../cdp/port';
import { COMPOSER_AGENT_PROBE_ID } from '../../cdp/port';
import { probeComposerAgentWindow } from '../../cdp/composer-agent-probe';
import type { InteractionSnapshot } from './types';
import {
  emptyInteractionSnapshot,
  INTERACTION_SNAPSHOT_JS,
  parseInteractionSnapshot,
} from './snapshot-probe';

function pickPageTitle(pages: { title?: string }[], windowTitle?: string): string {
  if (windowTitle) {
    const hit = pages.find((p) => (p.title || '').includes(windowTitle));
    if (hit?.title) return hit.title;
  }
  return pages[0]?.title || '';
}

async function captureFixture(
  cdp: import('../../cdp/fixture-cdp').FixtureCdp,
  windowTitle?: string
): Promise<InteractionSnapshot> {
  const pages = await cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
  const page = windowTitle
    ? pages.find((p) => (p.title || '').includes(windowTitle))
    : pages.find((p) => p.reason !== 'no-bar') || pages[0];
  const title = page?.title || windowTitle || '';
  const bar = cdp.probeComposerBar(title);
  const layout = cdp.layoutDataForWindow(title);
  const agent = await probeComposerAgentWindow(cdp, title);
  return (
    parseInteractionSnapshot(
      {
        windowTitle: title,
        agent: { busy: agent.busy, reason: agent.reason },
        bar: {
          busy: bar.busy,
          draftLen: bar.draftLen,
          slowCount: bar.slowCount,
          model: bar.model,
          composerId: bar.composerId,
        },
        thread: {
          activeTool: layout.thread?.activeTool ?? null,
          slowCount: layout.thread?.slowCount ?? bar.slowCount,
          turnCount: layout.thread?.turnCount ?? 0,
        },
        blockers: {
          sendBlocked: layout.blockers?.sendBlocked ?? false,
          kinds: layout.blockers?.blockers.map((b) => b.kind) ?? [],
        },
      },
      title
    ) ?? emptyInteractionSnapshot(title)
  );
}

async function captureLive(cdp: CdpPort, windowTitle?: string): Promise<InteractionSnapshot> {
  const targets = (await cdp.listTargets()).filter((t) => t.type === 'page');
  const page = windowTitle
    ? targets.find((t) => (t.title || '').includes(windowTitle))
    : targets.find((t) => /Cursor/i.test(t.title || '') && !/Settings/i.test(t.title || '')) ||
      targets[0];
  if (!page?.webSocketDebuggerUrl) {
    return emptyInteractionSnapshot(windowTitle || '');
  }
  const raw = await evalOnPage(page, INTERACTION_SNAPSHOT_JS, true);
  return (
    parseInteractionSnapshot(raw, page.title || windowTitle || '') ??
    emptyInteractionSnapshot(page.title || windowTitle || '')
  );
}

export async function captureSnapshot(
  cdp: CdpPort,
  windowTitle?: string
): Promise<InteractionSnapshot> {
  if (!(await cdp.isAvailable())) {
    return emptyInteractionSnapshot(windowTitle || '');
  }
  if (isFixtureCdp(cdp)) {
    const title =
      windowTitle ||
      pickPageTitle(await cdp.listTargets(), undefined) ||
      fixturePageMeta('cr')?.title ||
      '';
    return captureFixture(cdp, title);
  }
  return captureLive(cdp, windowTitle);
}

export async function observeInteraction(
  cdp: CdpPort,
  opts?: { windowTitle?: string }
): Promise<InteractionSnapshot> {
  return captureSnapshot(cdp, opts?.windowTitle);
}
