import { connectCdp, workbenchPages } from './client';
import { DISMISS_PRETTY_DIALOG_JS, DISMISS_REVERT_MODAL_JS } from './composer-input';
import type { CdpPort, DismissOutcome } from './port';

type EvalJs = (expr: string) => Promise<{
  result?: { value?: { open?: boolean; action?: string; btn?: string } };
}>;

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

export async function liveDismissModals(cdp: CdpPort): Promise<DismissOutcome[]> {
  if (!(await cdp.isAvailable())) return [];
  const results: DismissOutcome[] = [];
  const targets = workbenchPages(await cdp.listTargets());
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
}
