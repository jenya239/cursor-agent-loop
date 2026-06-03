import type { CdpTarget } from './client';
import { evalOnPage } from './live-page';
import { runComposerSend } from './composer-send';
import type { CdpPort } from './port';
import {
  DISMISS_PRETTY_DIALOG_JS,
  DISMISS_REVERT_MODAL_JS,
  SUBMIT_COMPOSER_JS,
} from './composer-input';
import {
  emptyComposerBarProbe,
  parseComposerBarProbe,
  parseStopAgentResult,
  PROBE_COMPOSER_BAR_JS,
  SLOW_LABEL,
  STOP_AGENT_JS,
  type ComposerBarProbe,
} from './composer-bar';

export { SLOW_LABEL };
export type ComposerStuckProbe = ComposerBarProbe;

export const PROBE_COMPOSER_STUCK_JS = PROBE_COMPOSER_BAR_JS;

export const EXTRACT_STUCK_PROMPT_JS = `(() => {
  const slowMatch = (el) => (el.textContent || '').trim() === ${JSON.stringify(SLOW_LABEL)};
  const pairs = [...document.querySelectorAll('.composer-human-ai-pair-container')];
  const pick =
    [...pairs].reverse().find(
      (p) =>
        [...p.querySelectorAll('*')].some(slowMatch) || !!p.querySelector('.ui-collapsible-shimmer')
    ) || pairs[pairs.length - 1];
  if (!pick) return '';
  const human = pick.querySelector('.composer-human-message-content, .composer-human-message');
  return (human?.innerText || pick.innerText || '').trim().slice(0, 8000);
})()`;

export interface RecoverSlowOutcome {
  stopped: boolean;
  dismissed: Array<{ kind: string; action?: string }>;
  submitted: boolean;
  submitHow?: string;
  resent?: boolean;
  reason?: string;
}

export async function probeComposerStuck(page: CdpTarget): Promise<ComposerStuckProbe> {
  const v = await evalOnPage(page, PROBE_COMPOSER_STUCK_JS, true);
  return parseComposerBarProbe(v) ?? emptyComposerBarProbe();
}

export async function recoverSlowGeneration(page: CdpTarget, cdp?: CdpPort): Promise<RecoverSlowOutcome> {
  const prompt = String((await evalOnPage(page, EXTRACT_STUCK_PROMPT_JS, true)) ?? '').trim();
  const stop = parseStopAgentResult(await evalOnPage(page, STOP_AGENT_JS, true));
  const dismissed: RecoverSlowOutcome['dismissed'] = [];
  for (const [kind, expr] of [
    ['pretty_dialog', DISMISS_PRETTY_DIALOG_JS],
    ['revert', DISMISS_REVERT_MODAL_JS],
  ] as const) {
    const v = (await evalOnPage(page, expr, true)) as { open?: boolean; action?: string };
    if (v?.open) dismissed.push({ kind, action: v.action });
  }
  const submit = (await evalOnPage(page, SUBMIT_COMPOSER_JS, true)) as {
    ok?: boolean;
    how?: string;
    reason?: string;
  };
  if (submit?.ok) {
    return {
      stopped: stop.ok,
      dismissed,
      submitted: true,
      submitHow: submit.how,
    };
  }
  if (prompt.includes('AGENT_TOKEN=') && cdp) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const sent = await runComposerSend(cdp, prompt, { windowTitle: page.title });
      return {
        stopped: stop.ok,
        dismissed,
        submitted: true,
        submitHow: sent.submitHow ?? 'resend',
        resent: true,
      };
    } catch (e) {
      return {
        stopped: stop.ok,
        dismissed,
        submitted: false,
        reason: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return {
    stopped: stop.ok,
    dismissed,
    submitted: false,
    reason: submit?.reason ?? stop.reason,
  };
}
