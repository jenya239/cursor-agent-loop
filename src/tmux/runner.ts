import { execFileSync } from 'child_process';
import type { TmuxRunner } from './types';

export function defaultTmuxRunner(): TmuxRunner {
  return {
    run(argumentsList: string[]): string {
      return execFileSync('tmux', argumentsList, { encoding: 'utf8' }).trimEnd();
    },
  };
}
