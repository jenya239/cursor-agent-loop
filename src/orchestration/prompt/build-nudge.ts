import type { NextAgentStep } from '../types';
import { INSTRUCTIONS_REV } from '../pick/constants';

export function buildNudgePrompt(next: NextAgentStep, token: string, targetId?: string): string {
  const focusLine =
    next.role === 'Planner'
      ? 'Priority: stability > security > performance.'
      : next.role === 'Meta'
        ? 'Log + supervisor. Update RESEARCH/TRACK. Mark meta steps done.'
        : next.role === 'Critic'
          ? 'Skeptical re-audit of last done steps vs git/tests. Reopen or fix sub-step if wrong.'
          : next.role === 'Orchestrator'
            ? 'Update ROLES.md rotation if needed. No code.'
            : next.role === 'Cleaner'
              ? 'Remove junk only: debug artifacts, stale docs, orphan dot-dirs. Keep active TRACK/PLAN/CONTINUITY/.cursor/rules. git status before delete.'
              : next.role === 'Backlog'
                ? 'PLAN vs TRACK vs git; flag drift. No compiler edits.'
                : next.role === 'Blogger'
                  ? 'Write blog post about recently closed tracks. See BLOG.md for format and deploy instructions. Skip if nothing significant since last post.'
                  : next.role === 'Reviewer'
                    ? 'Review last 5-7 closed TRACK_*.md files for missed steps, TODOs, deferred work. Create new tracks or RESEARCH entries as needed. See REVIEWER.md.'
                    : next.role === 'OrchestratorDev'
                      ? 'Take next pending step from TRACK_ORCH_DEV.md. Work in cr workspace only. npm test gate. No compiler/ changes.'
                      : next.role === 'Monitor'
                        ? 'Check process health: SESSION.md updated, tracks progressing, cr logs fresh, role rotation working, plans non-empty. See MONITOR.md checklist. Output: one line "Monitor: OK" or "Monitor: WARN � <reason>" in SESSION. Queue corrective role if needed.'
                        : `Focus: ${next.focus}. Verify gate from TRACK.`;

  const tail =
    targetId === 'cr' || targetId === 'loop'
      ? 'npm test gate. SESSION. register+enqueue Driver next pending step.'
      : 'SESSION. register+enqueue Driver next pending step.';

  return [
    `AGENT_TOKEN=${token}`,
    `INSTRUCTIONS_REV=${INSTRUCTIONS_REV}`,
    `ROLE=${next.role}`,
    `STEP=${next.step}`,
    ...next.refs,
    '',
    `${next.reason}. ${focusLine}`,
    tail,
  ].join('\n');
}
