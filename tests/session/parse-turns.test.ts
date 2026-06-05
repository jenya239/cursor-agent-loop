import { parseSessionTurnBlocks } from '../../src/session/parse-turns';

const SAMPLE = `
### Turn 2026-06-05 (Driver TRACK_ORCH_DEV step 3 — tmux)

| field | value |
|-------|-------|
| role | Driver |
| step | 3 |
| done | tmux transport |
| result | build ok |
`;

describe('parseSessionTurnBlocks', () => {
  it('parses turn table fields', () => {
    const turns = parseSessionTurnBlocks(SAMPLE, { limit: 5 });
    expect(turns).toHaveLength(1);
    expect(turns[0].role).toBe('Driver');
    expect(turns[0].step).toBe('3');
    expect(turns[0].done).toBe('tmux transport');
    expect(turns[0].gate).toBe('build ok');
    expect(turns[0].date.startsWith('2026-06-05')).toBe(true);
  });
});
