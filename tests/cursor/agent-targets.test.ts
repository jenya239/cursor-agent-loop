import { AGENT_TARGETS, resolveTargets, targetForComposer, managedWindowTitle } from '../../src/cursor/agent-targets';

describe('agent-targets', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('resolveTargets defaults to cr only', () => {
    delete process.env.CR_GUARD_TARGET;
    delete process.env.CR_AGENT_COMPOSER_ID;
    expect(resolveTargets().map((t) => t.id)).toEqual(['cr']);
  });

  it('resolveTargets all when explicit', () => {
    expect(resolveTargets('all').length).toBe(AGENT_TARGETS.length);
  });

  it('targetForComposer maps mlc', () => {
    const mlc = AGENT_TARGETS.find((t) => t.id === 'mlc')!;
    expect(targetForComposer(mlc.composerId)?.id).toBe('mlc');
  });

  it('managedWindowTitle ignores unrelated windows', () => {
    expect(managedWindowTitle('myproject - Cursor')).toBe(false);
    expect(managedWindowTitle('mlc - Cursor')).toBe(true);
    expect(managedWindowTitle('x', AGENT_TARGETS[0].composerId)).toBe(true);
  });
});
