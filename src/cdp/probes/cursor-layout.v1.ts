import type { WindowLayoutData } from '../../cursor/layout/types';
import { withAgentItemState } from '../../cursor/layout/agent-item-state';
import { COMPOSER_PANEL_PROBE_BODY } from '../composer-panel';
import { LAYOUT_EXTRAS_PROBE_BODY, mergeLayoutExtras, parseLayoutExtrasProbe } from './layout-extras.v1';
export const CURSOR_LAYOUT_PROBE_ID = 'cursor-layout.v1' as const;

export const CURSOR_LAYOUT_PROBE_JS = `(() => {
  const title = document.title || '';
  const isAgents = /^Cursor Agents\\b/i.test(title);
  const shell = isAgents
    ? 'agents-v3'
    : location.href.includes('workbench.html')
      ? 'workbench-v2'
      : 'unknown';
  const vis = (el) => !!(el && (el.offsetParent || el.getClientRects?.().length));
  const stripAge = (s) => String(s || '').replace(/\\d+[smhd]$/i, '').trim();
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();

  const activityItems = [...document.querySelectorAll('.titlebar .action-label, .titlebar-actions .action-label')]
    .map((el) => norm((el.getAttribute('aria-label') || el.textContent || '').split('\\n')[0]))
    .filter(Boolean)
    .slice(0, 20);

  const unifiedSidebar = document.querySelector('.unified-agents-sidebar, .agent-sidebar');
  const sidebar = document.querySelector('.sidebar, .part.sidebar') || unifiedSidebar;
  const panel = document.querySelector('.panel, .part.panel');
  const panelTab = document.querySelector('.composite-bar .composite-bar-action-tab.checked');

  const editorTabs = [...document.querySelectorAll('.tabs-container .tab, .editor-group-container .tab')]
    .filter((t) => !t.querySelector('.composer-tab-label'))
    .map((t) => ({
      label: norm(t.textContent || t.getAttribute('aria-label') || '').slice(0, 40),
      active: t.classList.contains('active') || t.classList.contains('selected') || t.getAttribute('aria-selected') === 'true',
    }))
    .filter((t) => t.label)
    .slice(0, 20);

  const composerTabs = [...document.querySelectorAll('.tab .composer-tab-label, .composer-tab-label')]
    .map((el) => {
      const tab = el.closest('.tab');
      return {
        label: norm(el.textContent || el.getAttribute('aria-label') || '').slice(0, 60),
        active: !!(tab && (tab.classList.contains('active') || tab.classList.contains('selected') || tab.getAttribute('aria-selected') === 'true')),
      };
    })
    .filter((t) => t.label)
    .slice(0, 30);

  const workbenchAgents = [...document.querySelectorAll('.agent-sidebar-list .agent-sidebar-cell, .agent-sidebar .agent-sidebar-cell')]
    .map((el) => ({
      composerId: '',
      label: norm(el.querySelector('.agent-sidebar-cell-text')?.textContent || '').slice(0, 60),
      active: el.classList.contains('selected') || el.getAttribute('aria-selected') === 'true' || !!el.querySelector('.spinning-loader'),
      busy: !!el.querySelector('.spinning-loader'),
    }))
    .filter((a) => a.label && a.label !== 'More')
    .slice(0, 40);

  const glassAgents = [...document.querySelectorAll('.glass-sidebar-agent-list-container .glass-sidebar-agent-menu-btn')]
    .map((el) => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.ui-ascii-loading-indicator, .glass-sidebar-agent-ascii-loader').forEach((n) => n.remove());
      const raw = norm(clone.textContent || '');
      const chatTitle = norm(document.querySelector('.chat-title-tab-title')?.textContent || '');
      const label = stripAge(raw).slice(0, 60);
      return {
        composerId: '',
        label,
        active: (!!chatTitle && (raw.startsWith(chatTitle) || label.startsWith(chatTitle) || chatTitle.startsWith(label))) || !!el.querySelector('.glass-sidebar-agent-ascii-loader, .ui-ascii-loading-indicator'),
        busy: !!el.querySelector('.glass-sidebar-agent-ascii-loader, .ui-ascii-loading-indicator'),
      };
    })
    .filter((a) => a.label && a.label !== 'More')
    .slice(0, 40);

  const activeComposer =
    document.querySelector('[data-composer-id]')?.getAttribute('data-composer-id')?.slice(0, 36) || '';
  const chatTitle = norm(document.querySelector('.chat-title-tab-title')?.textContent || '').slice(0, 60);

  const history = composerTabs.length
    ? composerTabs.map((t) => ({ composerId: activeComposer, label: t.label, active: t.active }))
    : chatTitle
      ? [{ composerId: activeComposer, label: chatTitle, active: true }]
      : [];

  const agentList = isAgents ? glassAgents : workbenchAgents;

  const sidebarView =
    norm(document.querySelector('.window-title-text.agent-workspace-quickopen')?.getAttribute('aria-label') ||
      document.querySelector('.window-title-text.agent-workspace-quickopen')?.textContent ||
      document.querySelector('.agent-sidebar-section-title-text')?.textContent ||
      sidebar?.querySelector('.pane-header, .title')?.textContent ||
      '') ||
    (vis(unifiedSidebar) ? 'Agents' : '');

  const barRoot =
    document.querySelector('.composer-bar-container') ||
    document.querySelector('.composer-bar') ||
    document.querySelector('.ui-prompt-input')?.closest('.composer-bar-container, .composer-bar');
  const composerPanel = (() => {
${COMPOSER_PANEL_PROBE_BODY}
  })();
  const layoutExtras = (() => {
${LAYOUT_EXTRAS_PROBE_BODY}
  })();
  const bar = composerPanel.ok
    ? {
        composerId: composerPanel.composerId,
        model: composerPanel.model.label,
        agentRole: composerPanel.agentRole,
        busy: composerPanel.runState !== 'idle',
        slowCount: composerPanel.slowCount,
        draftLen: composerPanel.input.draftLen,
        draftHasToken: composerPanel.input.hasToken,
        pairs: layoutExtras.thread.turns.slice(-3).map((t) => ({ preview: t.preview, slow: t.slow })),
      }
    : {
        composerId: activeComposer,
        model: (barRoot?.querySelector('.ui-model-picker__trigger')?.textContent || '').replace(/\\s+/g, ' ').trim(),
        agentRole: /opus|thinking|\\bo3\\b|gpt-5|sonnet.*think/i.test(
          barRoot?.querySelector('.ui-model-picker__trigger')?.textContent || ''
        )
          ? 'supervisor'
          : 'default',
        busy: !!barRoot?.querySelector('.codicon-debug-stop'),
        slowCount: 0,
        draftLen: (
          barRoot?.querySelector('[contenteditable=true], textarea.ui-prompt-input')?.innerText ||
          barRoot?.querySelector('[contenteditable=true], textarea.ui-prompt-input')?.value ||
          ''
        )
          .replace(/\\s+/g, ' ')
          .trim().length,
        draftHasToken: (
          barRoot?.querySelector('[contenteditable=true], textarea.ui-prompt-input')?.innerText || ''
        ).includes('AGENT_TOKEN='),
        pairs: [],
      };

  return {
    shell,
    activityItems,
    sidebarVisible: vis(sidebar) || !!document.querySelector('.glass-sidebar-agent-list-container'),
    sidebarView: (isAgents ? 'Agents' : sidebarView).slice(0, 40),
    panelVisible: vis(panel),
    panelView: norm(panelTab?.textContent || panelTab?.getAttribute('aria-label') || '').slice(0, 40) || null,
    editorTabs,
    composerPane: vis(unifiedSidebar) || !!document.querySelector('.composer-pane, .composer-bar, .agent-sidebar'),
    composerBar: !!document.querySelector('.composer-bar-container, .composer-bar'),
    history,
    agentList,
    menus: isAgents
      ? [...document.querySelectorAll('.chat-title-tab-row button[aria-label], .agent-panel-header button[aria-label]')]
          .map((m) => norm(m.getAttribute('aria-label') || m.textContent || '').slice(0, 40))
          .filter(Boolean)
          .slice(0, 10)
      : [],
    composerPanel,
    layoutExtras,
    bar,
  };
})()`;

export function parseLayoutExtrasFromProbe(raw: unknown) {
  if (!raw || typeof raw !== 'object') return parseLayoutExtrasProbe(null);
  return parseLayoutExtrasProbe((raw as { layoutExtras?: unknown }).layoutExtras);
}

export function parseCursorLayoutProbe(raw: unknown): WindowLayoutData | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const layout: WindowLayoutData = {};
  if (Array.isArray(o.activityItems)) {
    layout.activityBar = o.activityItems.filter((x): x is string => typeof x === 'string');
  }
  if (typeof o.sidebarVisible === 'boolean') layout.sidebarOpen = o.sidebarVisible;
  if (typeof o.sidebarView === 'string' && o.sidebarView) layout.sidebarView = o.sidebarView;
  if (typeof o.panelVisible === 'boolean') layout.panelOpen = o.panelVisible;
  if (typeof o.panelView === 'string' && o.panelView) layout.panelView = o.panelView;
  if (typeof o.composerPane === 'boolean') layout.composerPaneOpen = o.composerPane;
  if (Array.isArray(o.editorTabs)) {
    layout.editorTabs = o.editorTabs
      .filter((t): t is { label: string; active?: boolean } => !!t && typeof t === 'object')
      .map((t) => ({
        label: String((t as { label?: unknown }).label || ''),
        active: (t as { active?: unknown }).active === true,
      }))
      .filter((t) => t.label);
  }
  if (Array.isArray(o.history)) {
    layout.composerHistory = o.history
      .filter((h): h is { composerId: string; label: string; active?: boolean } => !!h && typeof h === 'object')
      .map((h) => ({
        composerId: String((h as { composerId?: unknown }).composerId || ''),
        label: String((h as { label?: unknown }).label || ''),
        active: (h as { active?: unknown }).active === true,
      }))
      .filter((h) => h.label);
  }
  if (Array.isArray(o.agentList)) {
    layout.agentList = o.agentList
      .filter(
        (a): a is { composerId: string; label: string; active?: boolean; busy?: boolean } =>
          !!a && typeof a === 'object'
      )
      .map((a) =>
        withAgentItemState({
          composerId: String((a as { composerId?: unknown }).composerId || ''),
          label: String((a as { label?: unknown }).label || ''),
          active: (a as { active?: unknown }).active === true,
          busy: (a as { busy?: unknown }).busy === true,
        })
      )
      .filter((a) => a.label);
  }
  if (Array.isArray(o.menus)) {
    layout.menus = o.menus.filter((m): m is string => typeof m === 'string' && !!m);
  }
  return mergeLayoutExtras(layout, parseLayoutExtrasFromProbe(raw));
}

export function shellFromLayoutProbe(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const shell = (raw as { shell?: unknown }).shell;
  return typeof shell === 'string' ? shell : null;
}
