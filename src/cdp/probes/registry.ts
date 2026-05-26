import type { CdpTarget } from '../client';
import { composerPageOrder } from '../client';
import { evalOnPage } from '../live-page';
import type { ComposerAgentPageProbe } from './composer-agent.v1';
import {
  COMPOSER_AGENT_PROBE_ID,
  COMPOSER_AGENT_PROBE_JS,
  parseComposerAgentProbeValue,
} from './composer-agent.v1';
import { COMPOSER_AGENT_PROBE_V2_JS } from './composer-agent.v2';
import {
  COMPOSER_SWITCH_PROBE_ID,
  buildComposerSwitchJs,
  parseComposerSwitchValue,
  type ComposerSwitchValue,
} from './composer-switch.v1';
import type { CdpProbeId } from '../port';

async function evalAgentProbe(page: CdpTarget) {
  for (const expression of [COMPOSER_AGENT_PROBE_V2_JS, COMPOSER_AGENT_PROBE_JS]) {
    const v = parseComposerAgentProbeValue(await evalOnPage(page, expression, true));
    if (v) return v;
  }
  return null;
}

export async function runProbeOnTargets(
  probeId: CdpProbeId,
  targets: CdpTarget[],
  params?: { composerId?: string; chatName?: string; pages?: CdpTarget[] }
): Promise<ComposerAgentPageProbe[] | ComposerSwitchValue[]> {
  const pages = params?.pages ?? composerPageOrder(targets);
  if (probeId === COMPOSER_AGENT_PROBE_ID) {
    const out: ComposerAgentPageProbe[] = [];
    for (const page of pages) {
      try {
        const v = await evalAgentProbe(page);
        if (v) out.push({ title: page.title, ...v });
      } catch {
        /* next window */
      }
    }
    return out;
  }
  if (probeId === COMPOSER_SWITCH_PROBE_ID) {
    const js = buildComposerSwitchJs(params?.composerId || '', params?.chatName);
    const out: ComposerSwitchValue[] = [];
    for (const page of pages) {
      try {
        const v = parseComposerSwitchValue(await evalOnPage(page, js, true));
        if (v) out.push(v.ok ? { ...v, target: page.title } : v);
      } catch {
        /* next */
      }
    }
    return out;
  }
  throw new Error(`unknown probe: ${probeId}`);
}
