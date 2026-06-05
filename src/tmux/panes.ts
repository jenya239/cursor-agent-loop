import { defaultTmuxRunner } from './runner';
import type { TmuxPane, TmuxRunner } from './types';

const PANE_FORMAT = '#{pane_id}\t#{session_name}\t#{pane_index}\t#{pane_current_command}';

function parsePaneLine(line: string): TmuxPane | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('\t');
  if (parts.length < 4) return null;
  const paneIndex = Number.parseInt(parts[2], 10);
  if (Number.isNaN(paneIndex)) return null;
  return {
    id: parts[0],
    sessionName: parts[1],
    paneIndex,
    command: parts.slice(3).join('\t'),
  };
}

export function listPanes(runner: TmuxRunner = defaultTmuxRunner()): TmuxPane[] {
  const output = runner.run(['list-panes', '-a', '-F', PANE_FORMAT]);
  if (!output) return [];
  return output
    .split('\n')
    .map(parsePaneLine)
    .filter((pane): pane is TmuxPane => pane !== null);
}

export function sendKeys(
  pane: string,
  text: string,
  runner: TmuxRunner = defaultTmuxRunner()
): void {
  const target = pane.trim();
  if (!target) throw new Error('tmux pane target is required');
  runner.run(['send-keys', '-t', target, '-l', text]);
  runner.run(['send-keys', '-t', target, 'Enter']);
}

export function capturePaneOutput(
  pane: string,
  lines: number,
  runner: TmuxRunner = defaultTmuxRunner()
): string {
  const target = pane.trim();
  if (!target) throw new Error('tmux pane target is required');
  const lineCount = Math.max(1, Math.floor(lines));
  return runner.run(['capture-pane', '-p', '-t', target, '-S', `-${lineCount}`]);
}
