import {
  inferPendingFromHeader,
  parseTrackContent,
  parseTrackInProgress,
  pendingStepsFromRows,
  parseStepTable,
  stepStatusInContent,
} from '../../../src/orchestration/track/parse-content';

const BOOTSTRAP_DRIFT = `# Track: Bootstrap

## Status: **open** STEP=6 **done (partial)** ? STEP=6-gate

| Step | Item | Status |
|------|------|--------|
| 5 | types emit | done (partial) |
| 6 | bootstrap gate | done (partial � emit ok; bootstrap gate pending) |
`;

const OPEN_HEADER_ONLY = `# Track: X

## Status: **open** STEP=6

| Step | Item | Status |
|------|------|--------|
| 5 | prev | done |
| 6 | gate work | done (partial) |

**STEP=6**
`;

describe('parseTrackContent', () => {
  it('parses classic pending row', () => {
    const c = parseTrackContent('TRACK_T', [
      '## Status: in progress',
      '| 1 | a | done |',
      '| 2 | b | pending |',
      '**STEP=2**',
    ].join('\n'));
    expect(c.inProgress).toBe(true);
    expect(c.pendingSteps).toEqual([2]);
  });

  it('detects **Status:** **open**', () => {
    expect(parseTrackInProgress('## Status: **open** STEP=1', false)).toBe(true);
  });

  it('treats gate-pending partial as pending step', () => {
    const c = parseTrackContent('TRACK_BOOTSTRAP_LINK', BOOTSTRAP_DRIFT);
    expect(c.inProgress).toBe(true);
    expect(c.pendingSteps).toEqual([6]);
  });

  it('infers pending from header when table row is done partial without pending word', () => {
    const c = parseTrackContent('TRACK_X', OPEN_HEADER_ONLY);
    expect(c.inProgress).toBe(true);
    expect(c.pendingSteps).toEqual([]);
  });

  it('stepStatusInContent uses classifier', () => {
    expect(stepStatusInContent(BOOTSTRAP_DRIFT, '6')).toBe('pending');
    expect(stepStatusInContent(BOOTSTRAP_DRIFT, '5')).toBe('done');
  });

  it('parseStepTable ignores header row', () => {
    const rows = parseStepTable('| Step | Item | Status |\n| 1 | a | pending |');
    expect(rows).toHaveLength(1);
    expect(rows[0].step).toBe(1);
  });

  it('inferPendingFromHeader skips when row is pure done', () => {
    const content = [
      '## Status: **open** STEP=5',
      '| 5 | x | done |',
      '**STEP=5**',
    ].join('\n');
    expect(inferPendingFromHeader(content, parseStepTable(content))).toEqual([]);
  });

  it('pendingStepsFromRows collects meta-review', () => {
    const { pending, meta } = pendingStepsFromRows(parseStepTable('| 3 | meta-review audit | pending |'));
    expect(pending).toEqual([3]);
    expect(meta.has(3)).toBe(true);
  });
});
