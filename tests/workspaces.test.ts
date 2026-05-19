import {
  parseWorkspaceUri,
  resolveWorkspace,
  workspaceLabelFromPath,
} from '../src/db/workspaces';

describe('workspaces', () => {
  it('label from folder path', () => {
    expect(workspaceLabelFromPath('/home/u/proj/cr')).toBe('cr');
  });

  it('parses fsPath uri', () => {
    const p = parseWorkspaceUri({ fsPath: '/home/jenya/workspaces/current/mlc' });
    expect(p.label).toBe('mlc');
    expect(p.path).toContain('mlc');
  });

  it('resolves by workspace id from index', () => {
    const index = new Map([
      [
        'abc',
        { workspaceId: 'abc', path: '/x/y', label: 'y' },
      ],
    ]);
    const ws = resolveWorkspace('abc', undefined, index);
    expect(ws.label).toBe('y');
  });
});
