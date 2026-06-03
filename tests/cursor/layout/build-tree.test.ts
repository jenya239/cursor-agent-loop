import { buildWindowTree } from '../../../src/cursor/layout/build-tree';

describe('buildWindowTree', () => {
  it('workbench-v2 tree with detailed composer panel', () => {
    const tree = buildWindowTree({
      targetId: 'page-cr',
      title: 'cr - cr - Cursor',
      shell: 'workbench-v2',
      kind: 'editor-workbench',
      layout: {
        activityBar: ['Explorer', 'Agents'],
        activeActivity: 'Agents',
        sidebarOpen: true,
        sidebarView: 'Agents',
        editorTabs: [{ label: 'cr', active: true }],
        composerPaneOpen: true,
        agentList: [
          { composerId: '11111111-1111-1111-1111-111111111111', label: 'cr worker', active: true },
        ],
      },
      panel: {
        ok: true,
        shell: 'workbench-v2',
        composerId: '11111111-1111-1111-1111-111111111111',
        agentRole: 'default',
        runState: 'idle',
        slowCount: 0,
        input: {
          kind: 'editable',
          placeholder: 'Plan, Build',
          draftLen: 0,
          empty: true,
          focused: false,
          hasToken: false,
        },
        model: { label: 'Composer 1', pickerOpen: false },
        mode: { id: 'agent', label: 'Agent' },
        context: { pills: [], usagePct: 12, usageVisible: true },
        controls: {
          mode: { id: 'agent', visible: true, enabled: true, label: 'Agent' },
          model: { visible: true, enabled: true, label: 'Composer 1' },
          submit: { visible: true, enabled: false, label: 'Send', sendMode: 'agent' },
          stop: { visible: false, enabled: false, label: 'Stop' },
          plus: { visible: false, enabled: false, label: 'Attach' },
        },
      },
      activeComposerId: '11111111-1111-1111-1111-111111111111',
    });
    const flat = JSON.stringify(tree);
    expect(flat).toContain('composer-input');
    expect(flat).toContain('mode: Agent');
    expect(flat).toContain('context usage 12%');
    expect(flat).toContain('composer-bar');
  });

  it('workbench-v2 tree with sidebar agents and composer bar', () => {
    const tree = buildWindowTree({
      targetId: 'page-cr',
      title: 'cr - cr - Cursor',
      shell: 'workbench-v2',
      kind: 'editor-workbench',
      layout: {
        activityBar: ['Explorer', 'Agents'],
        activeActivity: 'Agents',
        sidebarOpen: true,
        sidebarView: 'Agents',
        editorTabs: [{ label: 'cr', active: true }],
        composerPaneOpen: true,
        agentList: [
          { composerId: '11111111-1111-1111-1111-111111111111', label: 'cr worker', active: true },
        ],
      },
      bar: {
        composerId: '11111111-1111-1111-1111-111111111111',
        model: 'Composer 1',
        agentRole: 'default',
        busy: false,
        slowCount: 0,
        reconnecting: false,
        draftLen: 0,
        draftHasToken: false,
        pairs: [],
      },
      activeComposerId: '11111111-1111-1111-1111-111111111111',
    });
    const flat = JSON.stringify(tree);
    expect(flat).toContain('activity-bar');
    expect(flat).toContain('Agents');
    expect(flat).toContain('composer-bar');
    expect(flat).toContain('agent-list');
  });

  it('agents-v3 tree with thread header blockers and busy agents', () => {
    const tree = buildWindowTree({
      targetId: 'page-agents',
      title: 'Cursor Agents',
      shell: 'agents-v3',
      kind: 'agents-dedicated',
      layout: {
        menus: ['Agents'],
        agentList: [
          {
            composerId: 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
            label: 'mlc supervisor',
            active: true,
            busy: true,
            state: 'busy',
            agentRole: 'supervisor',
          },
        ],
        header: {
          title: 'Agent in mlc',
          environment: 'local',
          workspace: 'mlc',
          pills: [{ label: '1 Terminal', kind: 'terminal' }],
          menuActions: ['New Agent'],
        },
        thread: {
          turnCount: 1,
          slowCount: 0,
          activeTool: 'Worked for 2s',
          turns: [
            {
              preview: 'run tests',
              slow: false,
              toolCalls: [{ label: 'Finishednpm test', state: 'finished' }],
            },
          ],
        },
        blockers: {
          blockers: [{ kind: 'pretty_dialog', label: 'Confirm', blocking: true }],
          sendBlocked: true,
        },
        panelContent: {
          open: true,
          activeTab: 'Terminal',
          tabs: [{ label: 'Terminal', active: true }],
          problemsCount: 0,
          terminalCount: 1,
        },
      },
      activeComposerId: 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
    });
    const flat = JSON.stringify(tree);
    expect(flat).toContain('composer-thread');
    expect(flat).toContain('composer-header');
    expect(flat).toContain('blockers (send blocked)');
    expect(flat).toContain('tool-call');
    expect(flat).toContain('"state":"busy"');
    expect(flat).toContain('panel-tab');
  });

  it('agents-v3 tree with global agent list', () => {
    const tree = buildWindowTree({
      targetId: 'page-agents',
      title: 'Cursor Agents',
      shell: 'agents-v3',
      kind: 'agents-dedicated',
      layout: {
        menus: ['Agents'],
        agentList: [
          {
            composerId: 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
            label: 'mlc supervisor',
            active: true,
            agentRole: 'supervisor',
          },
        ],
      },
      bar: {
        composerId: 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
        model: 'claude-opus',
        agentRole: 'supervisor',
        busy: true,
        slowCount: 0,
        reconnecting: false,
        draftLen: 0,
        draftHasToken: false,
        pairs: [],
      },
      activeComposerId: 'f8e0a645-1610-4a1e-b19f-63f502235a2e',
    });
    const flat = JSON.stringify(tree);
    expect(flat).toContain('agents-sidebar');
    expect(flat).toContain('agent-thread');
    expect(flat).toContain('supervisor');
  });
});
