import type { ComposerAgentRole } from '../../cdp/composer-bar';

export type AgentItemState = 'idle' | 'busy' | 'active';
export type ToolCallState = 'running' | 'finished' | 'slow' | 'unknown';
export type LayoutBlockerKind =
  | 'pretty_dialog'
  | 'revert'
  | 'quick_open'
  | 'composer_find'
  | 'notification';

export type CursorUiShell = 'workbench-v2' | 'agents-v3' | 'settings' | 'unknown';

export type CursorWindowKind =
  | 'editor-workbench'
  | 'agents-dedicated'
  | 'settings'
  | 'walkthrough'
  | 'other';

export type LayoutNodeKind =
  | 'window'
  | 'region'
  | 'sidebar'
  | 'panel'
  | 'editor'
  | 'tab'
  | 'composer'
  | 'composer-bar'
  | 'composer-input'
  | 'composer-context'
  | 'composer-thread'
  | 'thread-turn'
  | 'tool-call'
  | 'blocker'
  | 'composer-header'
  | 'panel-tab'
  | 'editor-area'
  | 'control'
  | 'menu'
  | 'agent-list'
  | 'agent-item'
  | 'history'
  | 'history-item';

export interface LayoutNode {
  id: string;
  label: string;
  kind: LayoutNodeKind;
  state?: string;
  attrs?: Record<string, string | number | boolean | null>;
  children?: LayoutNode[];
}

export interface CursorWindowLayout {
  targetId: string;
  title: string;
  url: string;
  shell: CursorUiShell;
  kind: CursorWindowKind;
  tree: LayoutNode;
}

export interface CursorLayoutSnapshot {
  at: number;
  cdpOk: boolean;
  windows: CursorWindowLayout[];
}

export interface LayoutAgentItem {
  composerId: string;
  label: string;
  active?: boolean;
  busy?: boolean;
  state?: AgentItemState;
  agentRole?: ComposerAgentRole;
}

export interface ComposerThreadTurn {
  preview: string;
  slow: boolean;
  toolCalls: Array<{ label: string; state: ToolCallState; detail?: string }>;
}

export interface ComposerThreadProbe {
  turnCount: number;
  slowCount: number;
  activeTool: string | null;
  turns: ComposerThreadTurn[];
}

export interface LayoutBlocker {
  kind: LayoutBlockerKind;
  label: string;
  blocking: boolean;
}

export interface LayoutBlockersProbe {
  blockers: LayoutBlocker[];
  sendBlocked: boolean;
}

export interface ComposerHeaderPill {
  label: string;
  kind: string;
  aria?: string;
}

export interface ComposerHeaderProbe {
  title: string;
  environment: string;
  workspace: string;
  pills: ComposerHeaderPill[];
  menuActions: string[];
}

export interface PanelTabItem {
  label: string;
  active: boolean;
  badge?: string;
}

export interface PanelContentProbe {
  open: boolean;
  activeTab: string | null;
  tabs: PanelTabItem[];
  problemsCount: number | null;
  terminalCount: number | null;
}

export interface EditorAreaProbe {
  groupCount: number;
  activeTab: string | null;
  reviewOpen: boolean;
  reviewPreview: string | null;
}

export interface LayoutExtrasProbe {
  thread: ComposerThreadProbe;
  blockers: LayoutBlockersProbe;
  header: ComposerHeaderProbe;
  panelContent: PanelContentProbe;
  editorArea: EditorAreaProbe;
}

export interface LayoutHistoryItem {
  composerId: string;
  label: string;
  active?: boolean;
}

export interface LayoutEditorTab {
  label: string;
  active?: boolean;
}

/** Shared shape: fixture meta + live probe parse. */
export interface WindowLayoutData {
  activityBar?: string[];
  activeActivity?: string;
  sidebarOpen?: boolean;
  sidebarView?: string;
  panelOpen?: boolean;
  panelView?: string | null;
  editorTabs?: LayoutEditorTab[] | string[];
  activeEditorTab?: string;
  composerPaneOpen?: boolean;
  composerHistory?: LayoutHistoryItem[];
  agentList?: LayoutAgentItem[];
  menus?: string[];
  thread?: ComposerThreadProbe;
  blockers?: LayoutBlockersProbe;
  header?: ComposerHeaderProbe;
  panelContent?: PanelContentProbe;
  editorArea?: EditorAreaProbe;
}
