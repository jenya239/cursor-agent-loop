import type { ComposerBarProbe } from '../../cdp/composer-bar';
import type { ComposerPanelProbe } from '../../cdp/composer-panel';
import type {
  ComposerThreadProbe,
  CursorUiShell,
  CursorWindowKind,
  EditorAreaProbe,
  LayoutAgentItem,
  LayoutBlockersProbe,
  LayoutEditorTab,
  LayoutHistoryItem,
  ComposerHeaderProbe,
  LayoutNode,
  PanelContentProbe,
  WindowLayoutData,
} from './types';
function ctrl(id: string, label: string, state?: string, attrs?: LayoutNode['attrs']): LayoutNode {
  return { id, label, kind: 'control', state, attrs };
}

function btnNode(
  id: string,
  b: { visible: boolean; enabled: boolean; label: string },
  extra?: LayoutNode['attrs']
): LayoutNode | null {
  if (!b.visible) return null;
  return ctrl(id, b.label || id, b.enabled ? 'enabled' : 'disabled', extra);
}

function barControls(bar: ComposerBarProbe): LayoutNode[] {
  const out: LayoutNode[] = [];
  if (bar.model) out.push(ctrl('model', `model: ${bar.model}`));
  out.push(ctrl('agent-state', bar.busy ? 'stop (busy)' : 'send (idle)', bar.busy ? 'busy' : 'idle'));
  if (bar.slowCount > 0) out.push(ctrl('slow', `slow x${bar.slowCount}`, 'slow'));
  if (bar.reconnecting) out.push(ctrl('reconnect', 'reconnecting', 'bad'));
  if (bar.draftHasToken) out.push(ctrl('draft', `draft ${bar.draftLen}`, 'draft'));
  return out;
}

function panelNodes(prefix: string, panel: ComposerPanelProbe): LayoutNode[] {
  const p = `${prefix}-panel`;
  const inputLabel =
    panel.input.kind === 'missing'
      ? 'input: missing'
      : `input: ${panel.input.kind}${panel.input.draftLen ? ` ${panel.input.draftLen}ch` : ''}${panel.input.focused ? ' focused' : ''}`;
  const children: LayoutNode[] = [
    {
      id: `${p}-input`,
      label: inputLabel,
      kind: 'composer-input',
      state: panel.input.kind,
      attrs: {
        empty: panel.input.empty,
        hasToken: panel.input.hasToken,
        ...(panel.input.placeholder ? { placeholder: panel.input.placeholder.slice(0, 60) } : {}),
      },
    },
  ];
  if (panel.mode?.label) {
    children.push(
      ctrl(`${p}-mode`, `mode: ${panel.mode.label}`, panel.controls.mode.enabled ? 'enabled' : 'disabled', {
        id: panel.mode.id,
      })
    );
  }
  if (panel.model.label) {
    children.push(
      ctrl(
        `${p}-model`,
        `model: ${panel.model.label}`,
        panel.model.pickerOpen ? 'open' : panel.controls.model.enabled ? 'closed' : 'disabled'
      )
    );
  }
  const ctxChildren: LayoutNode[] = [];
  if (panel.context.usageVisible && panel.context.usagePct !== null) {
    ctxChildren.push(ctrl(`${p}-ctx-usage`, `context usage ${panel.context.usagePct}%`, 'usage'));
  }
  for (const [i, pill] of panel.context.pills.entries()) {
    ctxChildren.push({
      id: `${p}-ctx-${i}`,
      label: pill.label,
      kind: 'composer-context',
      state: pill.kind,
      attrs: pill.aria ? { aria: pill.aria } : undefined,
    });
  }
  if (ctxChildren.length) {
    children.push({ id: `${p}-context`, label: 'context', kind: 'region', children: ctxChildren });
  }
  const footer: LayoutNode[] = [];
  for (const [id, node] of [
    ['plus', btnNode(`${p}-plus`, panel.controls.plus)],
    ['submit', btnNode(`${p}-submit`, panel.controls.submit, { sendMode: panel.controls.submit.sendMode })],
    ['stop', btnNode(`${p}-stop`, panel.controls.stop)],
  ] as const) {
    if (node) footer.push(node);
    else if (id === 'stop' && panel.runState !== 'idle') {
      footer.push(ctrl(`${p}-stop`, 'stop (busy)', 'busy'));
    }
  }
  if (footer.length) {
    children.push({ id: `${p}-footer`, label: 'footer', kind: 'region', children: footer });
  }
  if (panel.slowCount > 0) children.push(ctrl(`${p}-slow`, `slow x${panel.slowCount}`, 'slow'));
  return children;
}

function composerBarNode(
  prefix: string,
  bar: ComposerBarProbe | undefined,
  panel: ComposerPanelProbe | undefined
): LayoutNode | null {
  if (panel?.ok) {
    return {
      id: `${prefix}-bar`,
      label: 'composer-bar',
      kind: 'composer-bar',
      state: panel.runState,
      attrs: {
        shell: panel.shell,
        role: panel.agentRole,
        ...(panel.composerId ? { composerId: panel.composerId.slice(0, 8) } : {}),
      },
      children: panelNodes(prefix, panel),
    };
  }
  if (!bar) return null;
  return {
    id: `${prefix}-bar`,
    label: 'composer-bar',
    kind: 'composer-bar',
    state: bar.busy ? 'busy' : 'idle',
    children: barControls(bar),
  };
}

function historyNodes(items: LayoutHistoryItem[] | undefined, prefix: string): LayoutNode[] {
  if (!items?.length) return [];
  return [
    {
      id: `${prefix}-history`,
      label: 'composer-history',
      kind: 'history',
      children: items.map((h, i) => ({
        id: `${prefix}-hist-${i}`,
        label: h.label,
        kind: 'history-item',
        state: h.active ? 'active' : undefined,
        attrs: h.composerId ? { composerId: h.composerId.slice(0, 8) } : undefined,
      })),
    },
  ];
}

function agentListNodes(items: LayoutAgentItem[] | undefined, prefix: string): LayoutNode[] {
  if (!items?.length) return [];
  return [
    {
      id: `${prefix}-agents`,
      label: 'agent-list',
      kind: 'agent-list',
      children: items.map((a, i) => ({
        id: `${prefix}-agent-${i}`,
        label: a.label,
        kind: 'agent-item',
        state: a.state ?? (a.busy ? 'busy' : a.active ? 'active' : 'idle'),
        attrs: {
          composerId: a.composerId.slice(0, 8),
          ...(a.agentRole ? { role: a.agentRole } : {}),
          ...(a.busy ? { busy: true } : {}),
        },
      })),
    },
  ];
}

function blockersNodes(blockers: LayoutBlockersProbe | undefined, prefix: string): LayoutNode[] {
  if (!blockers?.blockers.length) return [];
  return [
    {
      id: `${prefix}-blockers`,
      label: blockers.sendBlocked ? 'blockers (send blocked)' : 'blockers',
      kind: 'region',
      state: blockers.sendBlocked ? 'blocking' : 'open',
      children: blockers.blockers.map((b, i) => ({
        id: `${prefix}-blk-${i}`,
        label: b.label,
        kind: 'blocker',
        state: b.kind,
        attrs: { blocking: b.blocking },
      })),
    },
  ];
}

function headerNodes(header: ComposerHeaderProbe | undefined, prefix: string): LayoutNode[] {
  if (!header || (!header.title && !header.pills.length && !header.menuActions.length)) return [];
  const children: LayoutNode[] = [];
  if (header.title) {
    children.push({
      id: `${prefix}-hdr-title`,
      label: `title: ${header.title}`,
      kind: 'composer-header',
      attrs: {
        ...(header.environment ? { env: header.environment } : {}),
        ...(header.workspace ? { workspace: header.workspace } : {}),
      },
    });
  }
  for (const [i, pill] of header.pills.entries()) {
    children.push({
      id: `${prefix}-hdr-pill-${i}`,
      label: pill.label,
      kind: 'composer-context',
      state: pill.kind,
      attrs: pill.aria ? { aria: pill.aria } : undefined,
    });
  }
  for (const [i, action] of header.menuActions.entries()) {
    children.push(ctrl(`${prefix}-hdr-act-${i}`, action));
  }
  return [{ id: `${prefix}-header`, label: 'composer-header', kind: 'composer-header', children }];
}

function threadNodes(thread: ComposerThreadProbe | undefined, prefix: string): LayoutNode[] {
  if (!thread?.turns.length && !thread?.activeTool) return [];
  const children: LayoutNode[] = [];
  if (thread.activeTool) {
    children.push(ctrl(`${prefix}-thread-active`, `active: ${thread.activeTool}`, 'running'));
  }
  if (thread.slowCount > 0) {
    children.push(ctrl(`${prefix}-thread-slow`, `slow x${thread.slowCount}`, 'slow'));
  }
  for (const [i, turn] of thread.turns.entries()) {
    const turnChildren: LayoutNode[] = [];
    for (const [j, tc] of turn.toolCalls.entries()) {
      turnChildren.push({
        id: `${prefix}-turn-${i}-tc-${j}`,
        label: tc.label,
        kind: 'tool-call',
        state: tc.state,
        attrs: tc.detail ? { detail: tc.detail.slice(0, 60) } : undefined,
      });
    }
    children.push({
      id: `${prefix}-turn-${i}`,
      label: turn.preview || `turn ${i + 1}`,
      kind: 'thread-turn',
      state: turn.slow ? 'slow' : undefined,
      children: turnChildren.length ? turnChildren : undefined,
    });
  }
  return [
    {
      id: `${prefix}-thread`,
      label: `composer-thread (${thread.turnCount})`,
      kind: 'composer-thread',
      children,
    },
  ];
}

function panelContentNodes(panel: PanelContentProbe | undefined, prefix: string, fallbackOpen: boolean): LayoutNode {
  const open = panel?.open ?? fallbackOpen;
  const children: LayoutNode[] = [];
  if (panel?.tabs.length) {
    children.push(
      ...panel.tabs.map((t, i) => ({
        id: `${prefix}-ptab-${i}`,
        label: t.label,
        kind: 'panel-tab' as const,
        state: t.active ? 'active' : undefined,
        attrs: t.badge ? { badge: t.badge } : undefined,
      }))
    );
  }
  if (panel?.problemsCount !== null && panel?.problemsCount !== undefined) {
    children.push(ctrl(`${prefix}-problems`, `problems: ${panel.problemsCount}`));
  }
  if (panel?.terminalCount !== null && panel?.terminalCount !== undefined) {
    children.push(ctrl(`${prefix}-terminals`, `terminals: ${panel.terminalCount}`));
  }
  return {
    id: `${prefix}-panel`,
    label: 'bottom-panel',
    kind: 'panel',
    state: open ? 'open' : 'closed',
    attrs: panel?.activeTab ? { view: panel.activeTab } : undefined,
    children: children.length ? children : undefined,
  };
}

function editorAreaNodes(
  tabs: LayoutEditorTab[] | string[] | undefined,
  editor: EditorAreaProbe | undefined,
  prefix: string
): LayoutNode[] {
  if (!tabs?.length && !editor?.groupCount) return [];
  const children: LayoutNode[] = editorTabNodes(tabs, prefix);
  if (editor?.groupCount && editor.groupCount > 1) {
    children.unshift(ctrl(`${prefix}-groups`, `groups: ${editor.groupCount}`));
  }
  if (editor?.reviewOpen) {
    children.push({
      id: `${prefix}-review`,
      label: editor.reviewPreview ? `review: ${editor.reviewPreview.slice(0, 50)}` : 'review open',
      kind: 'editor-area',
      state: 'review',
    });
  }
  return [
    {
      id: `${prefix}-editor`,
      label: 'editor',
      kind: 'editor',
      state: 'open',
      attrs: editor?.activeTab ? { activeTab: editor.activeTab.slice(0, 40) } : undefined,
      children,
    },
  ];
}

function composerPaneChildren(
  prefix: string,
  layout: WindowLayoutData,
  bar: ComposerBarProbe | undefined,
  panel: ComposerPanelProbe | undefined
): LayoutNode[] {
  const out: LayoutNode[] = [];
  out.push(...blockersNodes(layout.blockers, `${prefix}-cp`));
  out.push(...headerNodes(layout.header, `${prefix}-cp`));
  out.push(...threadNodes(layout.thread, `${prefix}-cp`));
  const barNode = composerBarNode(prefix, bar, panel);
  if (barNode) out.push(barNode);
  out.push(...historyNodes(layout.composerHistory, prefix));
  return out;
}
function editorTabNodes(tabs: LayoutEditorTab[] | string[] | undefined, prefix: string): LayoutNode[] {
  if (!tabs?.length) return [];
  const norm: LayoutEditorTab[] = tabs.map((t) => (typeof t === 'string' ? { label: t } : t));
  return norm.map((t, i) => ({
    id: `${prefix}-tab-${i}`,
    label: t.label,
    kind: 'tab',
    state: t.active ? 'active' : undefined,
  }));
}

function workbenchTree(
  prefix: string,
  layout: WindowLayoutData,
  bar: ComposerBarProbe | undefined,
  panel: ComposerPanelProbe | undefined,
  activeComposerId: string | null
): LayoutNode[] {
  const children: LayoutNode[] = [];
  if (layout.activityBar?.length) {
    children.push({
      id: `${prefix}-activity`,
      label: 'activity-bar',
      kind: 'region',
      state: 'open',
      children: layout.activityBar.map((a, i) =>
        ctrl(`${prefix}-act-${i}`, a, layout.activeActivity === a ? 'active' : undefined)
      ),
    });
  }
  if (layout.sidebarOpen !== false) {
    const sidebarChildren = [
      ...agentListNodes(layout.agentList, `${prefix}-sb`),
      ...(layout.sidebarView === 'Agents' || layout.agentList?.length
        ? []
        : historyNodes(layout.composerHistory, `${prefix}-sb`)),
    ];
    children.push({
      id: `${prefix}-sidebar`,
      label: layout.sidebarView === 'Agents' || layout.agentList?.length ? 'agents-sidebar' : 'sidebar',
      kind: 'sidebar',
      state: 'open',
      attrs: layout.sidebarView ? { view: layout.sidebarView } : undefined,
      children: sidebarChildren,
    });
  }
  if (layout.editorTabs?.length || layout.editorArea?.groupCount) {
    children.push(...editorAreaNodes(layout.editorTabs, layout.editorArea, prefix));
  }
  if (layout.composerPaneOpen !== false && (bar || panel || activeComposerId || layout.thread || layout.header)) {
    const composerChildren = composerPaneChildren(prefix, layout, bar, panel);
    children.push({
      id: `${prefix}-composer-pane`,
      label: 'composer-pane',
      kind: 'composer',
      state: 'open',
      attrs: activeComposerId ? { composerId: activeComposerId.slice(0, 8) } : undefined,
      children: composerChildren,
    });
  }
  children.push(
    panelContentNodes(layout.panelContent, prefix, layout.panelOpen === true)
  );
  return children;
}
function agentsV3Tree(
  prefix: string,
  layout: WindowLayoutData,
  bar: ComposerBarProbe | undefined,
  panel: ComposerPanelProbe | undefined,
  activeComposerId: string | null
): LayoutNode[] {
  const children: LayoutNode[] = [];
  if (layout.menus?.length) {
    children.push({
      id: `${prefix}-menu`,
      label: 'menu-bar',
      kind: 'menu',
      children: layout.menus.map((m, i) => ctrl(`${prefix}-menu-${i}`, m)),
    });
  }
  children.push({
    id: `${prefix}-agent-sidebar`,
    label: 'agents-sidebar',
    kind: 'sidebar',
    state: 'open',
    children: agentListNodes(layout.agentList, prefix),
  });
  const threadChildren: LayoutNode[] = [];
  threadChildren.push(...blockersNodes(layout.blockers, prefix));
  threadChildren.push(...headerNodes(layout.header, prefix));
  threadChildren.push(...threadNodes(layout.thread, prefix));
  const barNode = composerBarNode(prefix, bar, panel);
  if (barNode) threadChildren.push(barNode);
  threadChildren.push(...historyNodes(layout.composerHistory, prefix));
  children.push({
    id: `${prefix}-thread`,
    label: 'agent-thread',
    kind: 'composer',
    state: 'open',
    attrs: activeComposerId ? { composerId: activeComposerId.slice(0, 8) } : undefined,
    children: threadChildren,
  });
  children.push(panelContentNodes(layout.panelContent, prefix, false));
  return children;
}

export function buildWindowTree(opts: {
  targetId: string;
  title: string;
  shell: CursorUiShell;
  kind: CursorWindowKind;
  layout: WindowLayoutData;
  bar?: ComposerBarProbe;
  panel?: ComposerPanelProbe;
  activeComposerId?: string | null;
}): LayoutNode {
  const prefix = opts.targetId.replace(/[^a-z0-9]/gi, '') || 'win';
  const activeComposerId = opts.activeComposerId ?? null;
  const body =
    opts.shell === 'agents-v3'
      ? agentsV3Tree(prefix, opts.layout, opts.bar, opts.panel, activeComposerId)
      : workbenchTree(prefix, opts.layout, opts.bar, opts.panel, activeComposerId);

  return {
    id: prefix,
    label: opts.title,
    kind: 'window',
    state: opts.shell,
    attrs: { kind: opts.kind },
    children: body,
  };
}
