import {
  filterTargetsByHints,
  workspaceHintsFromChat,
} from '../src/cdp/window-match';

describe('window-match', () => {
  it('hints from chat', () => {
    expect(
      workspaceHintsFromChat({
        workspacePath: '/home/jenya/workspaces/current/mlc',
        workspaceLabel: 'mlc',
      })
    ).toEqual(expect.arrayContaining(['mlc']));
  });

  it('filter targets by workspace', () => {
    const targets = [
      {
        id: '1',
        title: 'schema.json - nord (Workspace) - Cursor',
        type: 'page',
        url: '',
        webSocketDebuggerUrl: 'ws://1',
      },
      {
        id: '2',
        title: 'foo - mlc - Cursor',
        type: 'page',
        url: '',
        webSocketDebuggerUrl: 'ws://2',
      },
    ];
    const hit = filterTargetsByHints(targets, ['mlc']);
    expect(hit).toHaveLength(1);
    expect(hit[0].title).toContain('mlc');
  });
});
