import {
  type ComposerAgentRole,
  type ComposerBarProbe,
  SLOW_LABEL,
  inferAgentRole,
} from './composer-bar';

export type ComposerPanelShell = 'workbench-v2' | 'agents-v3' | 'none';
export type ComposerRunState = 'idle' | 'busy' | 'slow';
export type ComposerInputKind = 'editable' | 'readonly' | 'missing';

export interface ComposerContextPill {
  label: string;
  kind: 'file' | 'terminal' | 'rule' | 'mention' | 'unknown';
  aria?: string;
}

export interface ComposerPanelInput {
  kind: ComposerInputKind;
  placeholder: string;
  draftLen: number;
  empty: boolean;
  focused: boolean;
  hasToken: boolean;
}

export interface ComposerPanelModel {
  label: string;
  pickerOpen: boolean;
}

export interface ComposerPanelMode {
  id: string;
  label: string;
}

export interface ComposerPanelContext {
  pills: ComposerContextPill[];
  usagePct: number | null;
  usageVisible: boolean;
}

export interface ComposerPanelButton {
  visible: boolean;
  enabled: boolean;
  label: string;
}

export interface ComposerPanelControls {
  mode: ComposerPanelButton & { id: string };
  model: ComposerPanelButton;
  submit: ComposerPanelButton & { sendMode: string };
  stop: ComposerPanelButton;
  plus: ComposerPanelButton;
}

export interface ComposerPanelProbe {
  ok: boolean;
  reason?: string;
  shell: ComposerPanelShell;
  composerId: string;
  agentRole: ComposerAgentRole;
  runState: ComposerRunState;
  slowCount: number;
  input: ComposerPanelInput;
  model: ComposerPanelModel;
  mode: ComposerPanelMode | null;
  context: ComposerPanelContext;
  controls: ComposerPanelControls;
}

const SUPERVISOR_MODEL = /opus|thinking|\bo3\b|gpt-5|sonnet.*think/i;

export const PROBE_COMPOSER_PANEL_JS = `(() => {
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const vis = (el) => !!(el && (el.offsetParent || el.getClientRects?.().length));
  const disabled = (el) => !el || el.disabled === true || el.getAttribute('aria-disabled') === 'true';
  const title = document.title || '';
  const isAgents = /^Cursor Agents\\b/i.test(title);
  const shell = isAgents ? 'agents-v3' : document.querySelector('.composer-bar') ? 'workbench-v2' : 'none';
  const root =
    document.querySelector('.composer-bar-container') ||
    document.querySelector('.composer-bar') ||
    document.querySelector('.ui-prompt-input')?.closest('.composer-bar-container, .composer-bar');
  if (!root) return { ok: false, reason: 'no-bar', shell, composerId: '' };

  const slowMatch = (el) => norm(el.textContent) === ${JSON.stringify(SLOW_LABEL)};
  const slowEls = [...root.querySelectorAll('.ui-collapsible-shimmer, .ui-collapsible-header, span, div')].filter(slowMatch);
  const composerId =
    root.getAttribute('data-composer-id') ||
    document.querySelector('[data-composer-id]')?.getAttribute('data-composer-id') ||
    '';

  const readonlyRoot = root.querySelector('.ui-prompt-input-tiptap-readonly');
  const editable =
    root.querySelector(
      "[data-lexical-editor='true'][contenteditable='true'], .aislash-editor-input[contenteditable='true'], .ui-prompt-input-editor__input[contenteditable='true'], textarea.ui-prompt-input"
    ) || null;
  const inputEl = editable || readonlyRoot?.querySelector('.ui-prompt-input-editor__input, [contenteditable]') || null;
  const draft = norm(inputEl?.innerText || inputEl?.value || readonlyRoot?.textContent || '');
  const placeholderEl = root.querySelector('.aislash-editor-placeholder, .ui-prompt-input-placeholder');
  const placeholder = norm(placeholderEl?.textContent || inputEl?.getAttribute('placeholder') || '');
  const placeholderVisible = !!(placeholderEl && vis(placeholderEl) && window.getComputedStyle(placeholderEl).opacity !== '0');
  const inputKind = editable ? 'editable' : readonlyRoot ? 'readonly' : inputEl ? 'readonly' : 'missing';
  const focused = !!(inputEl && (document.activeElement === inputEl || root.contains(document.activeElement)));

  const modelLabel = norm(
    root.querySelector('.ui-model-picker__trigger-text')?.textContent ||
      root.querySelector('.ui-model-picker__trigger')?.textContent ||
      ''
  );
  const pickerOpen = !!document.querySelector('.ui-model-picker__list, [class*="model-picker"][role="listbox"]');

  const modeEl = root.querySelector('.composer-unified-dropdown[data-mode]');
  const modeId = norm(modeEl?.getAttribute('data-mode') || '');
  const modeLabel = modeEl
    ? norm(modeEl.textContent || '')
        .replace(modelLabel, '')
        .replace(/\\s+/g, ' ')
        .trim()
        .split(/\\s+/)[0] || modeId
    : '';

  const footer = root.querySelector('.composer-bar-input-buttons') || root.querySelector('.composer-button-area')?.parentElement;
  const stopEl = root.querySelector('.codicon-debug-stop')?.closest('button,[role=button],.anysphere-icon-button');
  const busy = !!stopEl;

  const sendEl =
    root.querySelector('.send-with-mode .anysphere-icon-button') ||
    root.querySelector('.ui-prompt-input-submit-button') ||
    [...root.querySelectorAll('.anysphere-icon-button, button, [role=button]')].find((btn) =>
      btn.querySelector('.codicon-arrow-up-two, .codicon-arrow-up')
    ) ||
    null;
  const sendMode = norm(sendEl?.getAttribute('data-mode') || '');
  const sendAria = norm(sendEl?.getAttribute('aria-label') || '');
  const sendVisible = !!(sendEl && vis(sendEl));
  const sendEnabled =
    sendVisible && !disabled(sendEl) && !busy && !/stop|cancel|abort/i.test(sendAria) && draft.length > 0;

  const plusEl =
    root.querySelector('.ui-prompt-input-plus-button') ||
    root.querySelector('[aria-label*="Attach" i], [aria-label*="attach" i]') ||
    root.querySelector('.codicon-add, .codicon-plus')?.closest('button,[role=button],.anysphere-icon-button') ||
    null;

  const tokenRing = root.querySelector('.token-ring-progress');
  const dash = parseFloat(tokenRing?.getAttribute('stroke-dasharray') || '');
  const off = parseFloat(tokenRing?.getAttribute('stroke-dashoffset') || '');
  const usagePct =
    Number.isFinite(dash) && dash > 0 && Number.isFinite(off)
      ? Math.max(0, Math.min(100, Math.round((1 - off / dash) * 100)))
      : null;
  const usageVisible = !!(tokenRing && vis(tokenRing.closest('.composer-context-usage-indicator') || tokenRing));

  const pillKind = (label, aria) => {
    const s = (label + ' ' + aria).toLowerCase();
    if (/terminal/.test(s)) return 'terminal';
    if (/rule/.test(s)) return 'rule';
    if (/^@|mention/.test(s)) return 'mention';
    if (/\\.(rb|ts|js|json|md|py)\\b|file/.test(s)) return 'file';
    return 'unknown';
  };
  const barPills = [...root.querySelectorAll('.ui-prompt-input-context-pill, .composer-context-item, [class*="context-pill"]')]
    .filter((el) => !el.closest('.conversations'))
    .map((el) => ({
      label: norm(el.textContent).slice(0, 60),
      kind: pillKind(norm(el.textContent), norm(el.getAttribute('aria-label') || '')),
      aria: norm(el.getAttribute('aria-label') || '').slice(0, 80) || undefined,
    }))
    .filter((p) => p.label);
  const headerPills = [...document.querySelectorAll('.agent-panel-composer-pill, .agent-panel-header-pill.ui-pill')]
    .map((el) => ({
      label: norm(el.textContent).slice(0, 60),
      kind: pillKind(norm(el.textContent), norm(el.getAttribute('aria-label') || '')),
      aria: norm(el.getAttribute('aria-label') || '').slice(0, 80) || undefined,
    }))
    .filter((p) => p.label);
  const pills = [...barPills, ...headerPills.filter((h) => !barPills.some((b) => b.label === h.label))];

  const runState = busy ? (slowEls.length ? 'slow' : 'busy') : slowEls.length ? 'slow' : 'idle';

  return {
    ok: true,
    shell,
    composerId,
    agentRole: ${SUPERVISOR_MODEL.toString()}.test(modelLabel) ? 'supervisor' : 'default',
    runState,
    slowCount: slowEls.length,
    input: {
      kind: inputKind,
      placeholder,
      draftLen: draft.length,
      empty: !draft,
      focused,
      hasToken: draft.includes('AGENT_TOKEN='),
    },
    model: { label: modelLabel, pickerOpen },
    mode: modeId ? { id: modeId, label: modeLabel || modeId } : null,
    context: { pills, usagePct, usageVisible },
    controls: {
      mode: {
        id: modeId || 'unknown',
        visible: !!modeEl && vis(modeEl),
        enabled: !!modeEl && !disabled(modeEl),
        label: modeLabel || modeId || '',
      },
      model: {
        visible: !!root.querySelector('.ui-model-picker__trigger') && vis(root.querySelector('.ui-model-picker__trigger')),
        enabled: !!root.querySelector('.ui-model-picker__trigger') && !disabled(root.querySelector('.ui-model-picker__trigger')),
        label: modelLabel,
      },
      submit: {
        visible: sendVisible,
        enabled: sendEnabled,
        label: sendAria || 'Send',
        sendMode: sendMode || modeId || 'agent',
      },
      stop: {
        visible: !!stopEl && vis(stopEl),
        enabled: !!stopEl && !disabled(stopEl),
        label: norm(stopEl?.getAttribute('aria-label') || '') || 'Stop',
      },
      plus: {
        visible: !!(plusEl && vis(plusEl)),
        enabled: !!(plusEl && !disabled(plusEl)),
        label: norm(plusEl?.getAttribute('aria-label') || '') || 'Attach',
      },
    },
  };
})()`;

export const COMPOSER_PANEL_PROBE_BODY = PROBE_COMPOSER_PANEL_JS.replace(/^\(\(\) => \{\n/, '').replace(
  /\n\}\)\(\)$/,
  ''
);

function parsePills(raw: unknown): ComposerContextPill[] {
  if (!Array.isArray(raw)) return [];
  const kinds = new Set(['file', 'terminal', 'rule', 'mention', 'unknown']);
  const out: ComposerContextPill[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.label !== 'string' || !o.label) continue;
    const kind = kinds.has(String(o.kind)) ? (o.kind as ComposerContextPill['kind']) : 'unknown';
    out.push({
      label: o.label,
      kind,
      ...(typeof o.aria === 'string' && o.aria ? { aria: o.aria } : {}),
    });
  }
  return out;
}

function parseButton(raw: unknown): ComposerPanelButton {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    visible: o.visible === true,
    enabled: o.enabled === true,
    label: typeof o.label === 'string' ? o.label : '',
  };
}

function parseModeButton(raw: unknown): ComposerPanelControls['mode'] {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    ...parseButton(raw),
    id: typeof o.id === 'string' ? o.id : 'unknown',
  };
}

function parseSubmitButton(raw: unknown): ComposerPanelControls['submit'] {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    ...parseButton(raw),
    sendMode: typeof o.sendMode === 'string' ? o.sendMode : 'agent',
  };
}

export function parseComposerPanelProbe(raw: unknown): ComposerPanelProbe | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.ok !== true) {
    const shell =
      o.shell === 'workbench-v2' || o.shell === 'agents-v3' || o.shell === 'none' ? o.shell : 'none';
    return {
      ok: false,
      reason: typeof o.reason === 'string' ? o.reason : 'probe-failed',
      shell,
      composerId: typeof o.composerId === 'string' ? o.composerId : '',
      agentRole: 'default',
      runState: 'idle',
      slowCount: 0,
      input: emptyComposerPanelInput(),
      model: { label: '', pickerOpen: false },
      mode: null,
      context: { pills: [], usagePct: null, usageVisible: false },
      controls: emptyComposerPanelControls(),
    };
  }

  const shell =
    o.shell === 'workbench-v2' || o.shell === 'agents-v3' || o.shell === 'none' ? o.shell : 'none';
  const modelLabel =
    o.model && typeof o.model === 'object'
      ? String((o.model as { label?: unknown }).label || '')
      : '';
  const agentRole =
    o.agentRole === 'supervisor' || o.agentRole === 'default'
      ? o.agentRole
      : inferAgentRole(modelLabel);
  const runState =
    o.runState === 'busy' || o.runState === 'slow' || o.runState === 'idle' ? o.runState : 'idle';
  const inputRaw = o.input && typeof o.input === 'object' ? (o.input as Record<string, unknown>) : {};
  const kind =
    inputRaw.kind === 'editable' || inputRaw.kind === 'readonly' || inputRaw.kind === 'missing'
      ? inputRaw.kind
      : 'missing';

  const controlsRaw = o.controls && typeof o.controls === 'object' ? (o.controls as Record<string, unknown>) : {};
  const modeRaw = controlsRaw.mode && typeof controlsRaw.mode === 'object' ? controlsRaw.mode : {};
  const submitRaw =
    controlsRaw.submit && typeof controlsRaw.submit === 'object' ? controlsRaw.submit : {};

  return {
    ok: true,
    shell,
    composerId: typeof o.composerId === 'string' ? o.composerId : '',
    agentRole,
    runState,
    slowCount: typeof o.slowCount === 'number' ? o.slowCount : 0,
    input: {
      kind,
      placeholder: typeof inputRaw.placeholder === 'string' ? inputRaw.placeholder : '',
      draftLen: typeof inputRaw.draftLen === 'number' ? inputRaw.draftLen : 0,
      empty: inputRaw.empty === true,
      focused: inputRaw.focused === true,
      hasToken: inputRaw.hasToken === true,
    },
    model: {
      label: modelLabel,
      pickerOpen:
        o.model && typeof o.model === 'object'
          ? (o.model as { pickerOpen?: unknown }).pickerOpen === true
          : false,
    },
    mode:
      o.mode && typeof o.mode === 'object' && typeof (o.mode as { id?: unknown }).id === 'string'
        ? {
            id: String((o.mode as { id: string }).id),
            label: String((o.mode as { label?: unknown }).label || (o.mode as { id: string }).id),
          }
        : null,
    context: {
      pills: parsePills((o.context as { pills?: unknown } | undefined)?.pills),
      usagePct:
        o.context &&
        typeof o.context === 'object' &&
        typeof (o.context as { usagePct?: unknown }).usagePct === 'number'
          ? (o.context as { usagePct: number }).usagePct
          : null,
      usageVisible:
        o.context && typeof o.context === 'object'
          ? (o.context as { usageVisible?: unknown }).usageVisible === true
          : false,
    },
    controls: {
      mode: parseModeButton(modeRaw),
      model: parseButton(controlsRaw.model),
      submit: parseSubmitButton(submitRaw),
      stop: parseButton(controlsRaw.stop),
      plus: parseButton(controlsRaw.plus),
    },
  };
}

export function panelToBarProbe(panel: ComposerPanelProbe): ComposerBarProbe {
  return {
    composerId: panel.composerId,
    model: panel.model.label,
    agentRole: panel.agentRole,
    busy: panel.runState === 'busy' || panel.runState === 'slow',
    slowCount: panel.slowCount,
    reconnecting: false,
    draftLen: panel.input.draftLen,
    draftHasToken: panel.input.hasToken,
    pairs: [],
  };
}

export function emptyComposerPanelInput(): ComposerPanelInput {
  return {
    kind: 'missing',
    placeholder: '',
    draftLen: 0,
    empty: true,
    focused: false,
    hasToken: false,
  };
}

export function emptyComposerPanelControls(): ComposerPanelControls {
  const off = { visible: false, enabled: false, label: '' };
  return {
    mode: { ...off, id: 'unknown' },
    model: { ...off },
    submit: { ...off, sendMode: 'agent' },
    stop: { ...off },
    plus: { ...off, label: 'Attach' },
  };
}

export function emptyComposerPanelProbe(): ComposerPanelProbe {
  return {
    ok: false,
    reason: 'empty',
    shell: 'none',
    composerId: '',
    agentRole: 'default',
    runState: 'idle',
    slowCount: 0,
    input: emptyComposerPanelInput(),
    model: { label: '', pickerOpen: false },
    mode: null,
    context: { pills: [], usagePct: null, usageVisible: false },
    controls: emptyComposerPanelControls(),
  };
}
