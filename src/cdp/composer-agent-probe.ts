import type { CdpPort } from './port';
import { COMPOSER_AGENT_PROBE_ID } from './probes/composer-agent.v1';
import { COMPOSER_AGENT_PROBE_V2_JS } from './probes/composer-agent.v2';
import { COMPOSER_AGENT_PROBE_JS, parseComposerAgentProbeValue } from './probes/composer-agent.v1';
import { isFixtureCdp } from './fixture-cdp';
import { liveCdp } from './live-cdp';
import { connectCdp } from './client';

export interface ComposerAgentDetail {
  busy: boolean;
  cdpOk: boolean;
  reason: string;
  windowTitle?: string;
}

async function evalAgentOnPage(
  webSocketDebuggerUrl: string
): Promise<{ busy: boolean; reason: string } | null> {
  const { send, close } = await connectCdp(webSocketDebuggerUrl);
  try {
    await send('Runtime.enable');
    for (const expression of [COMPOSER_AGENT_PROBE_V2_JS, COMPOSER_AGENT_PROBE_JS]) {
      const r = (await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      })) as { result?: { value?: unknown } };
      const v = parseComposerAgentProbeValue(r.result?.value);
      if (v) return { busy: v.busy, reason: v.reason };
    }
    return null;
  } finally {
    close();
  }
}

export async function probeComposerAgentWindow(
  cdp: CdpPort = liveCdp,
  windowTitle?: string
): Promise<ComposerAgentDetail> {
  try {
    if (!(await cdp.isAvailable())) {
      return { busy: false, cdpOk: false, reason: 'cdp-unavailable' };
    }
    if (isFixtureCdp(cdp)) {
      const pages = await cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
      const page = windowTitle
        ? pages.find((p) => (p.title || '').includes(windowTitle))
        : pages[0];
      if (!page) {
        return { busy: false, cdpOk: false, reason: 'window-not-found' };
      }
      return { busy: page.busy, cdpOk: true, reason: page.reason, windowTitle: page.title };
    }
    const targets = await cdp.listTargets();
    const pages = windowTitle
      ? targets.filter((t) => (t.title || '').includes(windowTitle))
      : targets;
    if (!pages.length) {
      return { busy: false, cdpOk: false, reason: 'window-not-found' };
    }
    for (const page of pages) {
      const v = await evalAgentOnPage(page.webSocketDebuggerUrl);
      if (!v) continue;
      return { busy: v.busy, cdpOk: true, reason: v.reason, windowTitle: page.title };
    }
    return { busy: false, cdpOk: false, reason: 'probe-failed' };
  } catch {
    return { busy: false, cdpOk: false, reason: 'cdp-error' };
  }
}

export async function probeComposerAgentForComposer(
  cdp: CdpPort = liveCdp,
  composerId: string,
  opts?: { windowTitle?: string; workspaceHints?: string[] }
): Promise<ComposerAgentDetail> {
  if (!(await cdp.isAvailable())) {
    return { busy: false, cdpOk: false, reason: 'cdp-unavailable' };
  }
  const windowTitle =
    opts?.windowTitle ??
    (await cdp.findWindowForComposer(composerId, { workspaceHints: opts?.workspaceHints }))?.windowTitle;
  if (windowTitle) {
    return probeComposerAgentWindow(cdp, windowTitle);
  }
  return { busy: false, cdpOk: false, reason: 'composer-window-not-found' };
}

export async function probeComposerAgent(cdp: CdpPort = liveCdp): Promise<ComposerAgentDetail> {
  try {
    if (!(await cdp.isAvailable())) {
      return { busy: false, cdpOk: false, reason: 'cdp-unavailable' };
    }
    const pages = await cdp.runProbe(COMPOSER_AGENT_PROBE_ID);
    if (!pages.length) {
      return { busy: false, cdpOk: false, reason: 'no-window' };
    }
    let first = pages[0];
    for (const p of pages) {
      if (p.busy) {
        return { busy: true, cdpOk: true, reason: p.reason, windowTitle: p.title };
      }
      first = p;
    }
    return { busy: false, cdpOk: true, reason: first.reason, windowTitle: first.title };
  } catch {
    return { busy: false, cdpOk: false, reason: 'cdp-error' };
  }
}
