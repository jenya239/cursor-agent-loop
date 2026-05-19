import type { CdpTarget } from '../client';
import { connectCdp, composerPageOrder } from '../client';
import type { ComposerAgentPageProbe } from './composer-agent.v1';
import {
  COMPOSER_AGENT_PROBE_ID,
  COMPOSER_AGENT_PROBE_JS,
  parseComposerAgentProbeValue,
} from './composer-agent.v1';
import {
  COMPOSER_SWITCH_PROBE_ID,
  buildComposerSwitchJs,
  parseComposerSwitchValue,
} from './composer-switch.v1';
import type { CdpProbeId } from '../port';

export async function runProbeOnTargets(
  probeId: CdpProbeId,
  targets: CdpTarget[],
  params?: { composerId?: string }
): Promise<ComposerAgentPageProbe[] | { ok: boolean; reason: string }[]> {
  const pages = composerPageOrder(targets);
  if (probeId === COMPOSER_AGENT_PROBE_ID) {
    const out: ComposerAgentPageProbe[] = [];
    for (const page of pages) {
      try {
        const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
        try {
          await send('Runtime.enable');
          const r = (await send('Runtime.evaluate', {
            expression: COMPOSER_AGENT_PROBE_JS,
            returnByValue: true,
          })) as { result?: { value?: unknown } };
          const v = parseComposerAgentProbeValue(r.result?.value);
          if (v) out.push({ title: page.title, ...v });
        } finally {
          close();
        }
      } catch {
        /* next window */
      }
    }
    return out;
  }
  if (probeId === COMPOSER_SWITCH_PROBE_ID) {
    const js = buildComposerSwitchJs(params?.composerId || '');
    const out: { ok: boolean; reason: string }[] = [];
    for (const page of pages) {
      try {
        const { send, close } = await connectCdp(page.webSocketDebuggerUrl);
        try {
          await send('Runtime.enable');
          const r = (await send('Runtime.evaluate', {
            expression: js,
            returnByValue: true,
          })) as { result?: { value?: unknown } };
          const v = parseComposerSwitchValue(r.result?.value);
          if (v) out.push(v);
        } finally {
          close();
        }
      } catch {
        /* next */
      }
    }
    return out;
  }
  throw new Error(`unknown probe: ${probeId}`);
}
