import { classifyWindow } from '../../../src/cursor/layout/classify';

describe('classifyWindow', () => {
  it('workbench editor', () => {
    expect(classifyWindow('cr - cr - Cursor', 'workbench.html')).toEqual({
      shell: 'workbench-v2',
      kind: 'editor-workbench',
    });
  });

  it('agents v3 dedicated window', () => {
    expect(classifyWindow('Cursor Agents', 'workbench.html')).toEqual({
      shell: 'agents-v3',
      kind: 'agents-dedicated',
    });
  });

  it('settings', () => {
    expect(classifyWindow('Cursor Settings - mlc - Cursor', 'workbench.html')).toEqual({
      shell: 'settings',
      kind: 'settings',
    });
  });
});
