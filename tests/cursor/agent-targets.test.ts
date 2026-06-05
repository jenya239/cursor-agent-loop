import {
  AGENT_TARGETS,
  cdpAgentTargets,
  resolveTargets,
  targetForComposer,
  managedWindowTitle,
  tmuxAgentTargets,
  tmuxWindowTitle,
} from '../../src/cursor/agent-targets';

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
    expect(managedWindowTitle(tmuxWindowTitle('mlc'))).toBe(true);
  });

  it('defaults transport to cdp', () => {
    delete process.env.CR_MLC_TRANSPORT;
    delete process.env.CR_CR_TRANSPORT;
    jest.resetModules();
    const { AGENT_TARGETS: targets, cdpAgentTargets: cdpTargets } = require('../../src/cursor/agent-targets');
    expect(targets.every((target: { transport: string }) => target.transport === 'cdp')).toBe(true);
    expect(cdpTargets().length).toBe(targets.length);
    expect(tmuxAgentTargets().length).toBe(0);
  });

  it('enables tmux transport when pane id is configured', () => {
    process.env.CR_MLC_TRANSPORT = 'tmux';
    process.env.CR_MLC_TMUX_PANE = '%42';
    jest.resetModules();
    const module = require('../../src/cursor/agent-targets');
    const mlc = module.AGENT_TARGETS.find((target: { id: string }) => target.id === 'mlc');
    expect(mlc.transport).toBe('tmux');
    expect(mlc.paneId).toBe('%42');
    expect(module.tmuxAgentTargets().map((target: { id: string }) => target.id)).toEqual(['mlc']);
    expect(module.cdpAgentTargets().map((target: { id: string }) => target.id)).toEqual(['cr']);
  });
});
