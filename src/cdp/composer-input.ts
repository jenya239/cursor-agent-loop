/** Lexical composer � no destructive clear (delete triggers revert modal). */

/** Cursor "Submit from a previous message?" — pretty-dialog-modal with non-button clickables */
export const DISMISS_PRETTY_DIALOG_JS = `(() => {
  const modal = document.querySelector('.pretty-dialog-modal');
  if (!modal) return { open: false };
  // Priority: "Don't revert" (submit without reverting files) > "Cancel" (dismiss submit)
  for (const el of modal.querySelectorAll('.pretty-dialog-button')) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (t.includes("don't") || t.includes("dont") || t.includes('without')) {
      el.click(); return { open: true, action: 'dont-revert', btn: el.textContent?.trim().slice(0, 40) };
    }
  }
  for (const el of modal.querySelectorAll('.pretty-dialog-button')) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (t.includes('cancel')) {
      el.click(); return { open: true, action: 'cancel', btn: el.textContent?.trim().slice(0, 40) };
    }
  }
  return { open: true, action: 'no-match',
    btns: [...modal.querySelectorAll('.pretty-dialog-button')].map(b => b.textContent?.trim().slice(0, 30)) };
})()`;

export const DISMISS_REVERT_MODAL_JS = `(() => {
  for (const d of document.querySelectorAll('[role=dialog], .monaco-dialog-box, .dialog-box')) {
    const t = (d.textContent || '').toLowerCase();
    if (!t.includes('previous message') && !t.includes('revert file')) continue;
    for (const btn of d.querySelectorAll('button')) {
      const bt = (btn.textContent || '').toLowerCase();
      if (bt.includes('without reverting') || bt.includes("don't revert")) {
        btn.click();
        return { open: true, action: 'continue-without-revert' };
      }
    }
    return { open: true, action: 'modal-stuck' };
  }
  return { open: false };
})()`;

export const REVERT_MODAL_JS = `(() => {
  for (const d of document.querySelectorAll('[role=dialog], .monaco-dialog-box, .dialog-box')) {
    const t = (d.textContent || '').toLowerCase();
    if (t.includes('previous message') || t.includes('revert file')) {
      return { open: true, text: (d.textContent || '').slice(0, 200) };
    }
  }
  return { open: false };
})()`;

export const FOCUS_CLEAR_INPUT_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  const el =
    bar?.querySelector(
      "[data-lexical-editor='true'][contenteditable='true'], [data-lexical-editor=true][contenteditable=true], .aislash-editor-input[contenteditable='true']"
    ) ||
    document.querySelector(
      ".ui-prompt-input-editor__input[contenteditable='true'], .ui-prompt-input [contenteditable='true'], textarea.ui-prompt-input"
    );
  if (!el) return { ok: false, reason: bar ? 'no-input' : 'no-bar' };
  const scope = bar || el.closest('.composer-bar') || el.closest('.ui-prompt-input') || el;
  const draft = (el.innerText || '').replace(/\\s+/g, ' ').trim();
  if (draft.length > 40 || draft.includes('AGENT_TOKEN=')) {
    return { ok: false, reason: 'composer-not-empty', draftLen: draft.length, draftPreview: draft.slice(0, 40) };
  }
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const inViewport = r.top >= 0 && r.left >= 0 && r.bottom <= vh && r.right <= vw && r.width > 0 && r.height > 0;
  if (!inViewport) {
    return { ok: false, reason: 'bar-not-in-viewport', rect: { top: r.top, bottom: r.bottom, vh } };
  }
  el.focus();
  const active = document.activeElement;
  return {
    ok: true,
    cleared: true,
    hadDraft: false,
    draftLen: 0,
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    inBar: active ? scope.contains(active) : false,
  };
})()`;

export const SUBMIT_COMPOSER_JS = `(() => {
  const bar = document.querySelector('.composer-bar');
  const root =
    document.querySelector('.composer-bar-container') ||
    bar?.closest('.composer-bar-container') ||
    bar ||
    document.querySelector('.ui-prompt-input')?.closest('.composer-bar-container, .composer-bar') ||
    document.querySelector('.ui-prompt-input');
  if (!root) return { ok: false, reason: 'no-bar' };
  if (root.querySelector('.codicon-debug-stop')) {
    return { ok: false, reason: 'agent-busy' };
  }
  const agentsSend = root.querySelector(
    'button.ui-prompt-input-submit-button, [class*="ui-prompt-input-submit-button"]'
  );
  if (agentsSend) {
    const aria = agentsSend.getAttribute('aria-label') || '';
    if (/stop|cancel|abort/i.test(aria)) {
      return { ok: false, reason: 'agent-busy' };
    }
    if (agentsSend.disabled || agentsSend.getAttribute('aria-disabled') === 'true') {
      return { ok: false, reason: 'send-disabled' };
    }
    agentsSend.click();
    return { ok: true, how: 'ui-prompt-submit' };
  }
  for (const btn of root.querySelectorAll('.anysphere-icon-button, button, [role="button"]')) {
    if (btn.querySelector('.codicon-debug-stop')) continue;
    const icon = btn.querySelector('.codicon-arrow-up-two, .codicon-arrow-up');
    if (!icon) continue;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      return { ok: false, reason: 'send-disabled' };
    }
    btn.click();
    return { ok: true, how: icon.className.includes('arrow-up-two') ? 'arrow-up-two' : 'arrow-up' };
  }
  const legacy =
    root.querySelector('button.composer-send-button:not([disabled])') ||
    root.querySelector('[data-testid="composer-send-button"]:not([disabled])');
  if (legacy) {
    legacy.click();
    return { ok: true, how: 'legacy-btn' };
  }
  return { ok: false, reason: 'no-send-btn' };
})()`;
