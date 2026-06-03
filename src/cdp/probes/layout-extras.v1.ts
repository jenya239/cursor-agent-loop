import type {
  ComposerHeaderPill,
  ComposerThreadTurn,
  LayoutBlocker,
  LayoutBlockerKind,
  LayoutExtrasProbe,
  PanelTabItem,
  ToolCallState,
  WindowLayoutData,
} from '../../cursor/layout/types';
import { SLOW_LABEL } from '../composer-bar';

export type {
  AgentItemState,
  ComposerHeaderProbe,
  ComposerThreadProbe,
  EditorAreaProbe,
  LayoutBlockersProbe,
  LayoutExtrasProbe,
} from '../../cursor/layout/types';
export { deriveAgentItemState } from '../../cursor/layout/agent-item-state';

export const LAYOUT_EXTRAS_PROBE_JS = `(() => {
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const vis = (el) => !!(el && (el.offsetParent || el.getClientRects?.().length));
  const slowMatch = (el) => norm(el.textContent) === ${JSON.stringify(SLOW_LABEL)};

  const pillKind = (label, aria) => {
    const s = (label + ' ' + aria).toLowerCase();
    if (/terminal/.test(s)) return 'terminal';
    if (/browser/.test(s)) return 'browser';
    if (/rule/.test(s)) return 'rule';
    if (/^@|mention/.test(s)) return 'mention';
    return 'unknown';
  };

  const toolState = (text) => {
    const t = norm(text).toLowerCase();
    if (/worked for|thinking|running|loading/.test(t)) return 'running';
    if (slowMatch({ textContent: text })) return 'slow';
    if (/finished|done|complete/.test(t)) return 'finished';
    return 'unknown';
  };

  const pairs = [...document.querySelectorAll('.composer-human-ai-pair-container')];
  const collapsibles = [...document.querySelectorAll('.composer-bar .ui-collapsible-header, .conversations .ui-collapsible-header')];
  const turns = pairs.slice(-5).map((pair) => {
    const preview = norm(pair.textContent).slice(0, 120);
    const calls = [...pair.querySelectorAll('.ui-tool-call-line, .ui-shell-tool-call')]
      .slice(0, 8)
      .map((el) => {
        const label = norm(el.textContent).slice(0, 80);
        const detail = norm(el.querySelector('.ui-tool-call-line-details, .ui-shell-tool-call__description-row')?.textContent || '').slice(0, 80);
        return { label, state: toolState(label), ...(detail ? { detail } : {}) };
      })
      .filter((c) => c.label);
    return {
      preview,
      slow: slowMatch(pair) || !!pair.querySelector('.ui-collapsible-shimmer') || [...pair.querySelectorAll('*')].some(slowMatch),
      toolCalls: calls,
    };
  });

  const runningCollapsible = collapsibles.find((el) => /worked for|thinking|running/i.test(norm(el.textContent)) && !/^finished/i.test(norm(el.textContent)));
  const activeTool = runningCollapsible ? norm(runningCollapsible.textContent).slice(0, 80) : null;
  const slowCount = [...document.querySelectorAll('.ui-collapsible-shimmer, .ui-collapsible-header, span, div')].filter(slowMatch).length;

  const blockers = [];
  const pretty = document.querySelector('.pretty-dialog-modal');
  if (pretty && vis(pretty)) {
    blockers.push({
      kind: 'pretty_dialog',
      label: norm(pretty.querySelector('.pretty-dialog-title, .pretty-dialog-message')?.textContent || 'dialog').slice(0, 80),
      blocking: true,
    });
  }
  for (const d of document.querySelectorAll('[role=dialog], .monaco-dialog-box, .dialog-box')) {
    const t = norm(d.textContent).toLowerCase();
    if (!t.includes('previous message') && !t.includes('revert file')) continue;
    if (vis(d)) blockers.push({ kind: 'revert', label: norm(d.textContent).slice(0, 80), blocking: true });
    break;
  }
  const quick = document.querySelector('.quick-input-widget, .quick-input-box');
  if (quick && vis(quick)) blockers.push({ kind: 'quick_open', label: 'Quick Open', blocking: true });
  const findW = document.querySelector('.composer-find-widget-container');
  if (findW && vis(findW) && findW.querySelector('input')) {
    blockers.push({ kind: 'composer_find', label: 'Find in composer', blocking: false });
  }
  for (const n of document.querySelectorAll('.notification-toast, .notifications-toasts .notification-list-item')) {
    if (!vis(n)) continue;
    blockers.push({ kind: 'notification', label: norm(n.textContent).slice(0, 80), blocking: false });
    if (blockers.length > 6) break;
  }

  const headerPills = [...document.querySelectorAll('.agent-panel-composer-pill, .agent-panel-header-pill.ui-pill')]
    .map((el) => ({
      label: norm(el.textContent).slice(0, 60),
      kind: pillKind(norm(el.textContent), norm(el.getAttribute('aria-label') || '')),
      aria: norm(el.getAttribute('aria-label') || '').slice(0, 80) || undefined,
    }))
    .filter((p) => p.label);

  const menuActions = [...document.querySelectorAll('.chat-title-tab-row button[aria-label], .agent-panel-header button[aria-label]')]
    .map((el) => norm(el.getAttribute('aria-label') || el.textContent || '').slice(0, 40))
    .filter(Boolean)
    .slice(0, 10);

  const panelEl = document.querySelector('.panel, .part.panel');
  const panelOpen = vis(panelEl);
  const panelTabs = panelOpen
    ? [...document.querySelectorAll('.panel .composite-bar-action-tab, .panel .composite-bar .action-item')]
        .map((el) => ({
          label: norm(el.textContent || el.getAttribute('aria-label') || '').slice(0, 40),
          active: el.classList.contains('checked') || el.classList.contains('active') || el.getAttribute('aria-checked') === 'true',
          badge: norm(el.querySelector('.badge, .codicon-dot')?.textContent || '').slice(0, 8) || undefined,
        }))
        .filter((t) => t.label)
        .slice(0, 12)
    : [];
  const activePanelTab = panelTabs.find((t) => t.active)?.label || panelTabs[0]?.label || null;

  let problemsCount = null;
  for (const el of document.querySelectorAll('.statusbar-item[aria-label*="Problem" i], .markers-panel .monaco-tl-contents')) {
    const m = norm(el.getAttribute('aria-label') || el.textContent || '').match(/(\\d+)\\s*Problem/i);
    if (m) {
      problemsCount = parseInt(m[1], 10);
      break;
    }
  }
  const terminalCount = panelOpen
    ? document.querySelectorAll('.terminal-tabs-entry, .tabs-container .tab[data-term-id], .panel .terminal-group .tab').length || null
    : null;

  const groups = document.querySelectorAll('.editor-group-container').length || (document.querySelector('.editor') ? 1 : 0);
  const activeEditorTab = norm(
    document.querySelector('.editor-group-container.active .tab.active, .editor-group-container .tab.active')?.textContent ||
      document.querySelector('.tabs-container .tab.active')?.textContent ||
      ''
  ).slice(0, 60) || null;
  const reviewEl = document.querySelector('.multi-diff-editor, .ui-step-group-preview, .diff-tab-content');
  const reviewOpen = !!(reviewEl && vis(reviewEl));

  return {
    thread: { turnCount: pairs.length, slowCount, activeTool, turns },
    blockers: { blockers, sendBlocked: blockers.some((b) => b.blocking) },
    header: {
      title: norm(document.querySelector('.chat-title-tab-title')?.textContent || '').slice(0, 80),
      environment: norm(document.querySelector('.chat-title-tab-environment')?.textContent || '').slice(0, 40),
      workspace: norm(
        document.querySelector('.window-title-text.agent-workspace-quickopen')?.getAttribute('aria-label') ||
          document.querySelector('.window-title-text.agent-workspace-quickopen')?.textContent ||
          document.querySelector('.statusbar-item[aria-label*="Workspace" i]')?.getAttribute('aria-label') ||
          ''
      ).replace(/^Workspace:\\s*/i, '').slice(0, 60),
      pills: headerPills,
      menuActions,
    },
    panelContent: {
      open: panelOpen,
      activeTab: activePanelTab,
      tabs: panelTabs,
      problemsCount,
      terminalCount: terminalCount || (panelOpen && activePanelTab && /terminal/i.test(activePanelTab) ? 1 : null),
    },
    editorArea: {
      groupCount: groups,
      activeTab: activeEditorTab,
      reviewOpen,
      reviewPreview: reviewOpen ? norm(reviewEl?.textContent || '').slice(0, 100) : null,
    },
  };
})()`;

export const LAYOUT_EXTRAS_PROBE_BODY = LAYOUT_EXTRAS_PROBE_JS.replace(/^\(\(\) => \{\n/, '').replace(
  /\n\}\)\(\)$/,
  ''
);

function parseToolCalls(raw: unknown): ComposerThreadTurn['toolCalls'] {
  if (!Array.isArray(raw)) return [];
  const states = new Set(['running', 'finished', 'slow', 'unknown']);
  const out: ComposerThreadTurn['toolCalls'] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.label !== 'string' || !o.label) continue;
    out.push({
      label: o.label,
      state: states.has(String(o.state)) ? (o.state as ToolCallState) : 'unknown',
      ...(typeof o.detail === 'string' && o.detail ? { detail: o.detail } : {}),
    });
  }
  return out;
}

function parseTurns(raw: unknown): ComposerThreadTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ComposerThreadTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.preview !== 'string') continue;
    out.push({
      preview: o.preview,
      slow: o.slow === true,
      toolCalls: parseToolCalls(o.toolCalls),
    });
  }
  return out;
}

function parseBlockers(raw: unknown): LayoutBlocker[] {
  if (!Array.isArray(raw)) return [];
  const kinds = new Set<LayoutBlockerKind>([
    'pretty_dialog',
    'revert',
    'quick_open',
    'composer_find',
    'notification',
  ]);
  const out: LayoutBlocker[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const kind = kinds.has(o.kind as LayoutBlockerKind) ? (o.kind as LayoutBlockerKind) : null;
    if (!kind || typeof o.label !== 'string') continue;
    out.push({ kind, label: o.label, blocking: o.blocking === true });
  }
  return out;
}

function parseHeaderPills(raw: unknown): ComposerHeaderPill[] {
  if (!Array.isArray(raw)) return [];
  const out: ComposerHeaderPill[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.label !== 'string' || !o.label) continue;
    out.push({
      label: o.label,
      kind: typeof o.kind === 'string' ? o.kind : 'unknown',
      ...(typeof o.aria === 'string' && o.aria ? { aria: o.aria } : {}),
    });
  }
  return out;
}

function parsePanelTabs(raw: unknown): PanelTabItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PanelTabItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.label !== 'string' || !o.label) continue;
    out.push({
      label: o.label,
      active: o.active === true,
      ...(typeof o.badge === 'string' && o.badge ? { badge: o.badge } : {}),
    });
  }
  return out;
}

export function parseLayoutExtrasProbe(raw: unknown): LayoutExtrasProbe {
  const empty: LayoutExtrasProbe = {
    thread: { turnCount: 0, slowCount: 0, activeTool: null, turns: [] },
    blockers: { blockers: [], sendBlocked: false },
    header: { title: '', environment: '', workspace: '', pills: [], menuActions: [] },
    panelContent: { open: false, activeTab: null, tabs: [], problemsCount: null, terminalCount: null },
    editorArea: { groupCount: 0, activeTab: null, reviewOpen: false, reviewPreview: null },
  };
  if (!raw || typeof raw !== 'object') return empty;
  const o = raw as Record<string, unknown>;
  const threadRaw = o.thread && typeof o.thread === 'object' ? (o.thread as Record<string, unknown>) : {};
  const blockersRaw = o.blockers && typeof o.blockers === 'object' ? (o.blockers as Record<string, unknown>) : {};
  const headerRaw = o.header && typeof o.header === 'object' ? (o.header as Record<string, unknown>) : {};
  const panelRaw =
    o.panelContent && typeof o.panelContent === 'object' ? (o.panelContent as Record<string, unknown>) : {};
  const editorRaw = o.editorArea && typeof o.editorArea === 'object' ? (o.editorArea as Record<string, unknown>) : {};
  return {
    thread: {
      turnCount: typeof threadRaw.turnCount === 'number' ? threadRaw.turnCount : 0,
      slowCount: typeof threadRaw.slowCount === 'number' ? threadRaw.slowCount : 0,
      activeTool: typeof threadRaw.activeTool === 'string' ? threadRaw.activeTool : null,
      turns: parseTurns(threadRaw.turns),
    },
    blockers: {
      blockers: parseBlockers(blockersRaw.blockers),
      sendBlocked: blockersRaw.sendBlocked === true,
    },
    header: {
      title: typeof headerRaw.title === 'string' ? headerRaw.title : '',
      environment: typeof headerRaw.environment === 'string' ? headerRaw.environment : '',
      workspace: typeof headerRaw.workspace === 'string' ? headerRaw.workspace : '',
      pills: parseHeaderPills(headerRaw.pills),
      menuActions: Array.isArray(headerRaw.menuActions)
        ? headerRaw.menuActions.filter((x): x is string => typeof x === 'string')
        : [],
    },
    panelContent: {
      open: panelRaw.open === true,
      activeTab: typeof panelRaw.activeTab === 'string' ? panelRaw.activeTab : null,
      tabs: parsePanelTabs(panelRaw.tabs),
      problemsCount: typeof panelRaw.problemsCount === 'number' ? panelRaw.problemsCount : null,
      terminalCount: typeof panelRaw.terminalCount === 'number' ? panelRaw.terminalCount : null,
    },
    editorArea: {
      groupCount: typeof editorRaw.groupCount === 'number' ? editorRaw.groupCount : 0,
      activeTab: typeof editorRaw.activeTab === 'string' ? editorRaw.activeTab : null,
      reviewOpen: editorRaw.reviewOpen === true,
      reviewPreview: typeof editorRaw.reviewPreview === 'string' ? editorRaw.reviewPreview : null,
    },
  };
}

export function emptyLayoutExtrasProbe(): LayoutExtrasProbe {
  return parseLayoutExtrasProbe(null);
}

export function mergeLayoutExtras(layout: WindowLayoutData, extras: LayoutExtrasProbe): WindowLayoutData {
  return {
    ...layout,
    thread: extras.thread,
    blockers: extras.blockers,
    header: extras.header,
    panelContent: extras.panelContent,
    editorArea: extras.editorArea,
  };
}
