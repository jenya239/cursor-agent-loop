import type { NextAgentStep } from '../types';

export interface RotationDeps {
  hasOrchDevPending?: () => boolean;
  shouldBlog?: () => boolean;
}

const defaultDeps: RotationDeps = {
  hasOrchDevPending: () => false,
  shouldBlog: () => false,
};

export function pickRoleByRotation(
  driverTurns: number,
  isCr: boolean,
  deps: RotationDeps = defaultDeps
): NextAgentStep | null {
  if (driverTurns <= 0) return null;
  if (driverTurns % 16 === 0) {
    return {
      role: 'Orchestrator',
      step: 'roles-review',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '16 driver turns - roles and rotation review',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/ROLES.md'],
    };
  }
  if (driverTurns % 20 === 0) {
    return {
      role: 'Backlog',
      step: 'backlog-review',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '20 driver turns - hygiene review',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_PLAN.md', '@docs/agent/PLAN.md'],
    };
  }
  if (driverTurns % 12 === 0) {
    return {
      role: 'Meta',
      step: 'meta-review',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '12 driver turns - process and supervisor log',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH.md', '@docs/agent/RESEARCH.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/RESEARCH.md'],
    };
  }
  if (driverTurns % 10 === 0) {
    return {
      role: 'Cleaner',
      step: 'cleanup-sweep',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '10 driver turns - junk files and stale docs sweep',
      refs: isCr
        ? ['@docs/agent/CONTINUITY.md', '@docs/agent/ROLES.md']
        : ['@docs/agent/CONTINUITY.md', '@docs/agent/ROLES.md', '@docs/agent/DEVELOPMENT.md'],
    };
  }
  if (!isCr && driverTurns % 25 === 0 && deps.shouldBlog?.()) {
    return {
      role: 'Blogger',
      step: 'blog-post',
      trackFile: 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '25 driver turns - write blog post about recent progress',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/BLOG.md', '@docs/agent/TRACK_PLAN.md'],
    };
  }
  if (!isCr && driverTurns % 8 === 0) {
    return {
      role: 'Planner',
      step: 'plan-refresh',
      trackFile: 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '8 driver turns - plan refresh',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/PLAN.md', '@docs/agent/TRACK_PLAN.md'],
    };
  }
  if (driverTurns % 18 === 0) {
    return {
      role: 'Monitor',
      step: 'process-monitor',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '18 driver turns - process health check',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/MONITOR.md', '@docs/agent/SESSION.md'],
    };
  }
  if (driverTurns % 6 === 0) {
    return {
      role: 'Critic',
      step: 'critique-audit',
      trackFile: isCr ? 'TRACK_ORCH.md' : 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '6 driver turns - re-audit recent done work',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/ROLES.md', '@docs/agent/SESSION.md'],
    };
  }
  if (!isCr && driverTurns % 35 === 0) {
    return {
      role: 'Reviewer',
      step: 'history-review',
      trackFile: 'TRACK_PLAN.md',
      focus: 'stability',
      reason: '35 driver turns - review closed tracks for missed work',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/REVIEWER.md', '@docs/agent/PLAN.md'],
    };
  }
  if (!isCr && driverTurns % 5 === 0 && deps.hasOrchDevPending?.()) {
    return {
      role: 'OrchestratorDev',
      step: 'orch-dev',
      trackFile: 'TRACK_ORCH_DEV.md',
      focus: 'stability',
      reason: '5 driver turns - orchestrator/cr development step',
      refs: ['@docs/agent/CONTINUITY.md', '@docs/agent/TRACK_ORCH_DEV.md'],
    };
  }
  return null;
}
