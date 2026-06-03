import { SLOW_LABEL } from '../../cdp/composer-bar';
import type { InteractionSnapshot } from './types';

export const INTERACTION_SNAPSHOT_JS = `(() => {
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const slowMatch = (el) => norm(el.textContent) === ${JSON.stringify(SLOW_LABEL)};
  const root =
    document.querySelector('.composer-bar-container') ||
    document.querySelector('.composer-bar') ||
    document.querySelector('.ui-prompt-input')?.closest('.composer-bar-container, .composer-bar');
  const stop = !!root?.querySelector('.codicon-debug-stop');
  const input = root?.querySelector('[contenteditable=true], textarea.ui-prompt-input');
  const draft = norm(input?.innerText || input?.value || '');
  const model = norm(root?.querySelector('.ui-model-picker__trigger')?.textContent || '');
  const composerId =
    root?.getAttribute('data-composer-id') ||
    document.querySelector('[data-composer-id]')?.getAttribute('data-composer-id') ||
    '';
  const slowEls = [...document.querySelectorAll('.ui-collapsible-shimmer, .ui-collapsible-header, span, div')].filter(slowMatch);
  const collapsibles = [...document.querySelectorAll('.composer-bar .ui-collapsible-header, .conversations .ui-collapsible-header')];
  const running = collapsibles.find((el) => /worked for|thinking|running/i.test(norm(el.textContent)) && !/^finished/i.test(norm(el.textContent)));
  const activeTool = running ? norm(running.textContent).slice(0, 80) : null;
  const pairs = document.querySelectorAll('.composer-human-ai-pair-container').length;
  const blockers = [];
  if (document.querySelector('.pretty-dialog-modal')?.offsetParent) blockers.push('pretty_dialog');
  for (const d of document.querySelectorAll('[role=dialog], .monaco-dialog-box, .dialog-box')) {
    const t = norm(d.textContent).toLowerCase();
    if ((t.includes('previous message') || t.includes('revert file')) && d.offsetParent) {
      blockers.push('revert');
      break;
    }
  }
  if (document.querySelector('.quick-input-widget, .quick-input-box')?.offsetParent) blockers.push('quick_open');
  const agentReason = stop ? 'stop-icon' : activeTool ? 'running-tool' : 'idle';
  return {
    windowTitle: document.title || '',
    agent: { busy: stop, reason: agentReason },
    bar: {
      busy: stop,
      draftLen: draft.length,
      slowCount: slowEls.length,
      model,
      composerId: composerId.slice(0, 36),
    },
    thread: { activeTool, slowCount: slowEls.length, turnCount: pairs },
    blockers: {
      sendBlocked: blockers.some((k) => k === 'pretty_dialog' || k === 'revert' || k === 'quick_open'),
      kinds: blockers,
    },
  };
})()`;

export function parseInteractionSnapshot(raw: unknown, windowTitle = ''): InteractionSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const agentRaw = o.agent && typeof o.agent === 'object' ? (o.agent as Record<string, unknown>) : {};
  const barRaw = o.bar && typeof o.bar === 'object' ? (o.bar as Record<string, unknown>) : {};
  const threadRaw = o.thread && typeof o.thread === 'object' ? (o.thread as Record<string, unknown>) : {};
  const blockersRaw =
    o.blockers && typeof o.blockers === 'object' ? (o.blockers as Record<string, unknown>) : {};
  return {
    at: Date.now(),
    windowTitle: typeof o.windowTitle === 'string' && o.windowTitle ? o.windowTitle : windowTitle,
    agent: {
      busy: agentRaw.busy === true,
      reason: typeof agentRaw.reason === 'string' ? agentRaw.reason : 'unknown',
    },
    bar: {
      busy: barRaw.busy === true,
      draftLen: typeof barRaw.draftLen === 'number' ? barRaw.draftLen : 0,
      slowCount: typeof barRaw.slowCount === 'number' ? barRaw.slowCount : 0,
      model: typeof barRaw.model === 'string' ? barRaw.model : '',
      composerId: typeof barRaw.composerId === 'string' ? barRaw.composerId : '',
    },
    thread: {
      activeTool: typeof threadRaw.activeTool === 'string' ? threadRaw.activeTool : null,
      slowCount: typeof threadRaw.slowCount === 'number' ? threadRaw.slowCount : 0,
      turnCount: typeof threadRaw.turnCount === 'number' ? threadRaw.turnCount : 0,
    },
    blockers: {
      sendBlocked: blockersRaw.sendBlocked === true,
      kinds: Array.isArray(blockersRaw.kinds)
        ? blockersRaw.kinds.filter((k): k is string => typeof k === 'string')
        : [],
    },
  };
}

export function snapshotFingerprint(s: InteractionSnapshot): string {
  return JSON.stringify({
    busy: s.agent.busy,
    reason: s.agent.reason,
    draft: s.bar.draftLen,
    model: s.bar.model,
    activeTool: s.thread.activeTool,
    sendBlocked: s.blockers.sendBlocked,
    kinds: s.blockers.kinds,
    slow: s.bar.slowCount,
  });
}

export function emptyInteractionSnapshot(windowTitle = ''): InteractionSnapshot {
  return {
    at: Date.now(),
    windowTitle,
    agent: { busy: false, reason: 'empty' },
    bar: { busy: false, draftLen: 0, slowCount: 0, model: '', composerId: '' },
    thread: { activeTool: null, slowCount: 0, turnCount: 0 },
    blockers: { sendBlocked: false, kinds: [] },
  };
}
