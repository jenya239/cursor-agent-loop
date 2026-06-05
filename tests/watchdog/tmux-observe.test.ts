import { observeTmuxTarget } from '../../src/watchdog/tmux-observe';
import type { AgentTarget } from '../../src/cursor/agent-targets';
import type { TmuxRunner } from '../../src/tmux/types';

describe('tmux observe', () => {
  const target: AgentTarget = {
    id: 'mlc',
    transport: 'tmux',
    composerId: 'composer-1',
    paneId: '%1',
    agentDir: '/tmp/agent',
    windowHint: 'mlc',
    fastOnly: true,
  };

  it('maps pane output to window observation', () => {
    const runner: TmuxRunner = {
      run: () => 'AGENT_TOKEN=cr-agent-1\nROLE=Driver\n$ ',
    };
    const observation = observeTmuxTarget(target, { runner });
    expect(observation?.windowTitle).toBe('tmux:mlc');
    expect(observation?.draftHasToken).toBe(true);
    expect(observation?.busy).toBe(false);
  });

  it('marks busy when pane tail has no shell prompt', () => {
    const runner: TmuxRunner = {
      run: () => 'running task...\nstill working',
    };
    const observation = observeTmuxTarget(target, { runner });
    expect(observation?.busy).toBe(true);
  });
});
