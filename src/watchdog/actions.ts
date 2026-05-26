import { connectCdp, workbenchPages, listTargets, cdpBaseUrl } from '../cdp/client';
import { DISMISS_PRETTY_DIALOG_JS, DISMISS_REVERT_MODAL_JS } from '../cdp/composer-input';

export interface DismissOutcome {
  kind: 'pretty_dialog' | 'revert';
  open: boolean;
  action?: string;
  btn?: string;
  windowTitle?: string;
}

export interface WatchdogActions {
  dismissModals(): Promise<DismissOutcome[]>;
  drainQueue(): Promise<{ sent: number; remaining: number }>;
}

type EvalJs = (expr: string) => Promise<{ result?: { value?: { open?: boolean; action?: string; btn?: string } } }>;

const DISMISS_SCRIPTS: Array<{ kind: DismissOutcome['kind']; expr: string }> = [
  { kind: 'pretty_dialog', expr: DISMISS_PRETTY_DIALOG_JS },
  { kind: 'revert', expr: DISMISS_REVERT_MODAL_JS },
];

export async function runDismissOnPage(
  evalJs: EvalJs,
  windowTitle: string
): Promise<DismissOutcome[]> {
  const out: DismissOutcome[] = [];
  for (const { kind, expr } of DISMISS_SCRIPTS) {
    const r = await evalJs(expr);
    const v = r?.result?.value;
    if (v?.open) {
      out.push({ kind, open: true, action: v.action, btn: v.btn, windowTitle });
    }
  }
  return out;
}

export function createLiveCdpActions(drainQueue: () => Promise<{ sent: number; remaining: number }>): WatchdogActions {
  return {
    async dismissModals() {
      const results: DismissOutcome[] = [];
      const targets = workbenchPages(await listTargets(cdpBaseUrl()));
      for (const t of targets) {
        const { send, close } = await connectCdp(t.webSocketDebuggerUrl);
        try {
          await send('Runtime.enable');
          const evalJs: EvalJs = async (expr) =>
            (await send('Runtime.evaluate', { expression: expr, returnByValue: true })) as Awaited<
              ReturnType<EvalJs>
            >;
          const title = t.title?.slice(0, 40) ?? t.id;
          results.push(...(await runDismissOnPage(evalJs, title)));
        } catch {
          /* skip unresponsive window */
        } finally {
          close();
        }
      }
      return results;
    },
    drainQueue,
  };
}
