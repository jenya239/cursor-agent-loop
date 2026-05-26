import { probeComposerAgent, probeComposerAgentForComposer } from './composer-agent-probe';
import type { CdpPort } from './port';

export function cdpProbeFrom(
  port: CdpPort,
  hintsFor?: (composerId: string) => string[] | undefined
) {
  return async (ctx?: { composerId?: string; windowTitle?: string; workspaceHints?: string[] }) => {
    if (ctx?.composerId) {
      const hints = ctx.workspaceHints ?? hintsFor?.(ctx.composerId);
      const d = await probeComposerAgentForComposer(port, ctx.composerId, {
        windowTitle: ctx.windowTitle,
        workspaceHints: hints,
      });
      return {
        ok: d.cdpOk,
        busy: d.busy,
        reason: d.reason,
        windowTitle: d.windowTitle,
      };
    }
    const d = await probeComposerAgent(port);
    return {
      ok: d.cdpOk,
      busy: d.busy,
      reason: d.reason,
      windowTitle: d.windowTitle,
    };
  };
}
