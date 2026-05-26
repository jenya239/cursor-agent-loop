import type { CdpTarget } from './client';
import { evalOnPage } from './live-page';
import {
  DISMISS_PRETTY_DIALOG_JS,
  DISMISS_REVERT_MODAL_JS,
  SUBMIT_COMPOSER_JS,
} from './composer-input';

export const SLOW_LABEL = 'Taking longer than expected…';

export const PROBE_COMPOSER_STUCK_JS = `(() => {
  const root =
    document.querySelector('.composer-bar-container') ||
    document.querySelector('.composer-bar') ||
    document.querySelector('.ui-prompt-input')?.closest('.composer-bar-container, .composer-bar');
  const slowMatch = (el) => (el.textContent || '').trim() === ${JSON.stringify(SLOW_LABEL)};
  const slowEls = [...document.querySelectorAll('.ui-collapsible-shimmer, .ui-collapsible-header, span, div')].filter(slowMatch);
  const composerId =
    document.querySelector('[data-composer-id]')?.getAttribute('data-composer-id') ||
    document.querySelector('.composer-bar[data-composer-id]')?.getAttribute('data-composer-id') ||
    '';
  const model = (root?.querySelector('.ui-model-picker__trigger')?.textContent || '').replace(/\\s+/g, ' ').trim();
  const busy = !!root?.querySelector('.codicon-debug-stop');
  const input = root?.querySelector('[contenteditable=true], textarea.ui-prompt-input');
  const draft = (input?.innerText || input?.value || '').replace(/\\s+/g, ' ').trim();
  const pairs = [...document.querySelectorAll('.composer-human-ai-pair-container')].slice(-3).map((pair) => ({
    preview: (pair.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
    slow: slowMatch(pair) || !!pair.querySelector('.ui-collapsible-shimmer') || [...pair.querySelectorAll('*')].some(slowMatch),
  }));
  return {
    composerId,
    model,
    busy,
    slowCount: slowEls.length,
    draftLen: draft.length,
    draftHasToken: draft.includes('AGENT_TOKEN='),
    pairs,
  };
})()`;

export const STOP_AGENT_JS = `(() => {
  const root =
    document.querySelector('.composer-bar-container') ||
    document.querySelector('.composer-bar') ||
    document.querySelector('.ui-prompt-input')?.closest('.composer-bar-container, .composer-bar');
  if (!root) return { ok: false, reason: 'no-bar' };
  const stop = root.querySelector('.codicon-debug-stop')?.closest('button,[role=button],.anysphere-icon-button');
  if (!stop) return { ok: false, reason: 'no-stop' };
  stop.click();
  return { ok: true, reason: 'clicked-stop' };
})()`;

export interface ComposerStuckProbe {
  composerId: string;
  model: string;
  busy: boolean;
  slowCount: number;
  draftLen: number;
  draftHasToken: boolean;
  pairs: Array<{ preview: string; slow: boolean }>;
}

export interface RecoverSlowOutcome {
  stopped: boolean;
  dismissed: Array<{ kind: string; action?: string }>;
  submitted: boolean;
  submitHow?: string;
  reason?: string;
}

export async function probeComposerStuck(page: CdpTarget): Promise<ComposerStuckProbe> {
  const v = (await evalOnPage(page, PROBE_COMPOSER_STUCK_JS, true)) as ComposerStuckProbe | null;
  return (
    v ?? {
      composerId: '',
      model: '',
      busy: false,
      slowCount: 0,
      draftLen: 0,
      draftHasToken: false,
      pairs: [],
    }
  );
}

export async function recoverSlowGeneration(page: CdpTarget): Promise<RecoverSlowOutcome> {
  const stop = (await evalOnPage(page, STOP_AGENT_JS, true)) as { ok?: boolean; reason?: string };
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
  return {
    stopped: stop?.ok === true,
    dismissed,
    submitted: submit?.ok === true,
    submitHow: submit?.how,
    reason: submit?.ok ? undefined : submit?.reason ?? stop?.reason,
  };
}
