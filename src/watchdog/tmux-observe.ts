import type { AgentTarget } from '../cursor/agent-targets';
import { tmuxWindowTitle } from '../cursor/agent-targets';
import { capturePaneOutput } from '../tmux/panes';
import type { TmuxRunner } from '../tmux/types';
import type { WindowObservation } from './window-observation';

function paneLooksBusy(tail: string): boolean {
  if (tail.length === 0) return false;
  if (/█|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|thinking|loading/i.test(tail)) return true;
  return !/[#$>]\s*$/.test(tail.trimEnd());
}

export function observeTmuxTarget(
  target: AgentTarget,
  options?: { lines?: number; runner?: TmuxRunner }
): WindowObservation | null {
  if (target.transport !== 'tmux' || !target.paneId) return null;
  try {
    const output = capturePaneOutput(target.paneId, options?.lines ?? 30, options?.runner);
    const tail = output.trimEnd().split('\n').slice(-8).join('\n');
    return {
      windowTitle: tmuxWindowTitle(target.id),
      composerId: target.composerId,
      model: 'tmux',
      agentRole: 'default',
      busy: paneLooksBusy(tail),
      slowCount: 0,
      reconnecting: false,
      draftLen: tail.length,
      draftHasToken: /AGENT_TOKEN=/.test(tail),
      pairs: [],
    };
  } catch {
    return null;
  }
}

export function observeTmuxTargets(
  targets: AgentTarget[],
  options?: { lines?: number; runner?: TmuxRunner }
): WindowObservation[] {
  return targets
    .filter((target) => target.transport === 'tmux' && target.paneId)
    .flatMap((target) => {
      const observation = observeTmuxTarget(target, options);
      return observation ? [observation] : [];
    });
}
