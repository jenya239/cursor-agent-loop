/** Composer bar DOM (Cursor): model picker, stop, draft, slow pairs. */

export const SLOW_LABEL = 'Taking longer than expected\u2026';
export const RECONNECT_RE = /reconnect/i;

export type ComposerAgentRole = 'default' | 'supervisor';

export interface ComposerBarProbe {
  composerId: string;
  model: string;
  agentRole: ComposerAgentRole;
  busy: boolean;
  slowCount: number;
  reconnecting: boolean;
  draftLen: number;
  draftHasToken: boolean;
  pairs: Array<{ preview: string; slow: boolean }>;
}

export interface StopAgentResult {
  ok: boolean;
  reason: string;
}

const SUPERVISOR_MODEL = /opus|thinking|\bo3\b|gpt-5|sonnet.*think/i;

export const PROBE_COMPOSER_BAR_JS = `(() => {
  const root =
    document.querySelector('.composer-bar-container') ||
    document.querySelector('.composer-bar') ||
    document.querySelector('.ui-prompt-input')?.closest('.composer-bar-container, .composer-bar');
  const slowMatch = (el) => (el.textContent || '').trim() === ${JSON.stringify(SLOW_LABEL)};
  const reconnectMatch = (el) => ${RECONNECT_RE.toString()}.test((el.textContent || '').trim());
  const slowEls = [...document.querySelectorAll('.ui-collapsible-shimmer, .ui-collapsible-header, span, div')].filter(slowMatch);
  const reconnectEls = [...document.querySelectorAll('.composer-human-ai-pair-container span, .composer-human-ai-pair-container div, .composer-bar span, .composer-bar div')].filter(reconnectMatch);
  const composerId =
    document.querySelector('[data-composer-id]')?.getAttribute('data-composer-id') ||
    document.querySelector('.composer-bar[data-composer-id]')?.getAttribute('data-composer-id') ||
    '';
  const model = (root?.querySelector('.ui-model-picker__trigger')?.textContent || '').replace(/\\s+/g, ' ').trim();
  const agentRole = ${SUPERVISOR_MODEL.toString()}.test(model) ? 'supervisor' : 'default';
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
    agentRole,
    busy,
    slowCount: slowEls.length,
    reconnecting: reconnectEls.length > 0,
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

/** Discovery probe for fixture:record / npm run probe:bar */
export const COMPOSER_BAR_DUMP_JS = `(() => {
  const root =
    document.querySelector('.composer-bar-container') ||
    document.querySelector('.composer-bar');
  if (!root) return { ok: false, reason: 'no-bar' };
  const trigger = root.querySelector('.ui-model-picker__trigger');
  return {
    ok: true,
    model: (trigger?.textContent || '').replace(/\\s+/g, ' ').trim(),
    hasStop: !!root.querySelector('.codicon-debug-stop'),
    hasSend: !!root.querySelector('.ui-prompt-input-submit-button, .composer-send-button'),
    composerId:
      document.querySelector('[data-composer-id]')?.getAttribute('data-composer-id')?.slice(0, 36) || '',
    pickerOpen: !!document.querySelector('.ui-model-picker__list, [class*="model-picker"][role="listbox"]'),
  };
})()`;

/** Live only � open picker and click option by substring (case-insensitive). */
export const SELECT_MODEL_JS = `(modelNeedle) => {
  const root =
    document.querySelector('.composer-bar-container') ||
    document.querySelector('.composer-bar');
  if (!root) return { ok: false, reason: 'no-bar' };
  const trigger = root.querySelector('.ui-model-picker__trigger');
  if (!trigger) return { ok: false, reason: 'no-picker' };
  trigger.click();
  const needle = String(modelNeedle || '').trim().toLowerCase();
  if (!needle) return { ok: false, reason: 'empty-needle' };
  const opts = [
    ...document.querySelectorAll(
      '.ui-model-picker__model-name, [class*="model-picker"] [role="option"], [class*="model-picker"] button'
    ),
  ];
  const hit = opts.find((el) => (el.textContent || '').toLowerCase().includes(needle));
  if (!hit) return { ok: false, reason: 'no-match', seen: opts.slice(0, 8).map((el) => (el.textContent || '').trim().slice(0, 40)) };
  hit.click();
  const after = (root.querySelector('.ui-model-picker__trigger')?.textContent || '').replace(/\\s+/g, ' ').trim();
  return { ok: true, reason: 'selected', model: after };
}`;

function parsePairs(raw: unknown): ComposerBarProbe['pairs'] {
  if (!Array.isArray(raw)) return [];
  const out: ComposerBarProbe['pairs'] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.preview !== 'string' || typeof o.slow !== 'boolean') continue;
    out.push({ preview: o.preview, slow: o.slow });
  }
  return out;
}

export function inferAgentRole(model: string, explicit?: ComposerAgentRole): ComposerAgentRole {
  if (explicit === 'supervisor' || explicit === 'default') return explicit;
  return SUPERVISOR_MODEL.test(model) ? 'supervisor' : 'default';
}

export function parseComposerBarProbe(raw: unknown): ComposerBarProbe | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.composerId !== 'string') return null;
  const model = typeof o.model === 'string' ? o.model : '';
  const agentRole =
    o.agentRole === 'supervisor' || o.agentRole === 'default'
      ? o.agentRole
      : inferAgentRole(model);
  return {
    composerId: o.composerId,
    model,
    agentRole,
    busy: o.busy === true,
    slowCount: typeof o.slowCount === 'number' ? o.slowCount : 0,
    reconnecting: o.reconnecting === true,
    draftLen: typeof o.draftLen === 'number' ? o.draftLen : 0,
    draftHasToken: o.draftHasToken === true,
    pairs: parsePairs(o.pairs),
  };
}

export function parseStopAgentResult(raw: unknown): StopAgentResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'bad-result' };
  const o = raw as Record<string, unknown>;
  return {
    ok: o.ok === true,
    reason: typeof o.reason === 'string' ? o.reason : 'unknown',
  };
}

export function emptyComposerBarProbe(): ComposerBarProbe {
  return {
    composerId: '',
    model: '',
    agentRole: 'default',
    busy: false,
    slowCount: 0,
    reconnecting: false,
    draftLen: 0,
    draftHasToken: false,
    pairs: [],
  };
}
