import {
  capturePaneOutput,
  listPanes,
  sendKeys,
  type TmuxRunner,
} from '../../src/tmux';

function mockRunner(responses: Record<string, string>): TmuxRunner {
  return {
    run(argumentsList: string[]): string {
      const key = argumentsList.join('\0');
      if (responses[key] !== undefined) return responses[key];
      throw new Error(`unexpected tmux args: ${argumentsList.join(' ')}`);
    },
  };
}

describe('tmux panes', () => {
  it('listPanes parses tmux list-panes output', () => {
    const runner = mockRunner({
      ['list-panes\0-a\0-F\0#{pane_id}\t#{session_name}\t#{pane_index}\t#{pane_current_command}']:
        '%0\torch\t0\tbash\n%1\torch\t1\tclaude',
    });
    expect(listPanes(runner)).toEqual([
      { id: '%0', sessionName: 'orch', paneIndex: 0, command: 'bash' },
      { id: '%1', sessionName: 'orch', paneIndex: 1, command: 'claude' },
    ]);
  });

  it('sendKeys sends literal text then Enter', () => {
    const calls: string[][] = [];
    const runner: TmuxRunner = {
      run(argumentsList: string[]): string {
        calls.push([...argumentsList]);
        return '';
      },
    };
    sendKeys('%0', 'ROLE=Driver\nSTEP=4', runner);
    expect(calls).toEqual([
      ['send-keys', '-t', '%0', '-l', 'ROLE=Driver\nSTEP=4'],
      ['send-keys', '-t', '%0', 'Enter'],
    ]);
  });

  it('capturePaneOutput requests last N lines', () => {
    const runner = mockRunner({
      ['capture-pane\0-p\0-t\0%0\0-S\0-25']: 'line one\nline two',
    });
    expect(capturePaneOutput('%0', 25, runner)).toBe('line one\nline two');
  });

  it('rejects empty pane target', () => {
    const runner: TmuxRunner = { run: () => '' };
    expect(() => sendKeys('  ', 'x', runner)).toThrow('tmux pane target is required');
    expect(() => capturePaneOutput('', 10, runner)).toThrow('tmux pane target is required');
  });
});
