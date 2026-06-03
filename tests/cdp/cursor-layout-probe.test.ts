import { parseCursorLayoutProbe } from '../../src/cdp/probes/cursor-layout.v1';

describe('parseCursorLayoutProbe', () => {
  it('parses workbench regions', () => {
    const p = parseCursorLayoutProbe({
      shell: 'workbench-v2',
      activityItems: ['Toggle Agents (Ctrl+Alt+J)', 'New Agent (Ctrl+N)'],
      sidebarVisible: true,
      sidebarView: 'mlc',
      panelVisible: true,
      panelView: 'Terminal',
      composerPane: true,
      editorTabs: [{ label: 'plan.md', active: true }],
      history: [{ composerId: 'abc', label: 'chat mlc', active: true }],
      agentList: [{ composerId: '', label: 'mlc worker', active: true, busy: true }],
      menus: [],
      layoutExtras: {
        thread: { turnCount: 1, slowCount: 0, activeTool: null, turns: [] },
        blockers: { blockers: [], sendBlocked: false },
        header: { title: '', environment: '', workspace: '', pills: [], menuActions: [] },
        panelContent: { open: true, activeTab: 'Terminal', tabs: [], problemsCount: 0, terminalCount: 1 },
        editorArea: { groupCount: 1, activeTab: 'plan.md', reviewOpen: false, reviewPreview: null },
      },
    });
    expect(p?.activityBar?.[0]).toContain('Toggle Agents');
    expect(p?.agentList?.[0].state).toBe('busy');
    expect(p?.panelContent?.terminalCount).toBe(1);
  });

  it('parses agents-v3 agent list with extras', () => {
    const p = parseCursorLayoutProbe({
      shell: 'agents-v3',
      agentList: [{ composerId: '', label: 'Agent in workspaces/mlc', active: true, busy: false }],
      history: [{ composerId: 'x', label: 'Agent in workspaces/mlc', active: true }],
      menus: ['New Agent'],
      layoutExtras: {
        header: {
          title: 'Agent in workspaces/mlc',
          environment: 'local',
          workspace: 'mlc',
          pills: [{ label: '1 Terminal', kind: 'terminal' }],
          menuActions: ['New Agent'],
        },
        thread: {
          turnCount: 1,
          slowCount: 0,
          activeTool: 'Worked for 1s',
          turns: [{ preview: 'hi', slow: false, toolCalls: [] }],
        },
        blockers: { blockers: [], sendBlocked: false },
        panelContent: { open: false, activeTab: null, tabs: [], problemsCount: null, terminalCount: null },
        editorArea: { groupCount: 0, activeTab: null, reviewOpen: false, reviewPreview: null },
      },
    });
    expect(p?.header?.title).toContain('mlc');
    expect(p?.thread?.activeTool).toBe('Worked for 1s');
    expect(p?.menus).toEqual(['New Agent']);
  });
});
