import { defaultCursorUserDir, globalDbPath } from '../src/db/paths';

describe('paths', () => {
  it('globalDbPath ends with state.vscdb', () => {
    expect(globalDbPath()).toMatch(/globalStorage[/\\]state\.vscdb$/);
  });

  it('defaultCursorUserDir is non-empty', () => {
    expect(defaultCursorUserDir().length).toBeGreaterThan(0);
  });
});
