# Agent roles (Orchestrator maintains this file)

**INSTRUCTIONS_REV:** `2026-05-28-cleaner`

| Role | STEP | Touches code? | Duty |
|------|------|---------------|------|
| **Driver** | `<n>` | yes | One TRACK sub-step, verify gate, commit when ready |
| **Verifier** | with Driver | - | Runs tests/self-host (mlc) |
| **Scribe** | every turn | docs | SESSION, TRACK status |
| **Planner** | `plan-refresh` | no | TRACK from PLAN/RESEARCH |
| **Backlog** | `backlog-review` | no | git vs TRACK, hygiene flags |
| **Cleaner** | `cleanup-sweep` | delete/docs | Remove junk files, stale docs; keep active docs |
| **Meta** | `meta-review` | no | overnight log, supervisor, process |
| **Critic** | `critique-audit` | fix-only | Re-audit done steps; find gaps, false done, regressions |
| **Orchestrator** | `roles-review` | no | Roles, rotation cadence, CONTINUITY/ROLES.md |

## Rotation (driver_turns_since_plan)

Checked in order - first match wins:

| Every N turns | ROLE |
|---------------|------|
| 16 | **Orchestrator** |
| 20 | **Backlog** |
| 12 | **Meta** |
| 10 | **Cleaner** |
| 8 | **Planner** (mlc only; cr skips to next rule) |
| 6 | **Critic** |
| else | **Driver** (pending step) |

After any non-Driver turn -> enqueue **Driver** on next pending STEP.

## Cleaner checklist (`STEP=cleanup-sweep`)

1. `git status` � list candidates; never touch uncommitted Driver WIP without noting in SESSION.
2. **Safe to remove (mlc):** `compiler/` root debug (`lexer_*.mlc`, `test_*.mlc`), `.tmp_*`, stray `test_t*.mlc`, duplicate stale markdown superseded by TRACK/PLAN.
3. **Safe to remove (cr):** orphan fixtures, dead scripts superseded by TRACK, `.tmp_*` in repo root.
4. **Dot dirs:** prune only obvious junk inside `.cursor/` (old caches); **keep** `.cursor/rules`, MCP config, hooks.
5. **Never delete:** `CONTINUITY.md`, `ROLES.md`, `SESSION.md`, active `TRACK_*`, `PLAN.md`, `.gitignore`, `node_modules/`, `compiler/out/` (regenerated; note bloat in SESSION instead).
6. **Stale docs:** fix or trim sections that contradict active TRACK (e.g. DEVELOPMENT step numbers); do not delete living agent docs.
7. One focused commit: `cleanup: <one line>` or docs-only; log removed paths in SESSION.
8. No `compiler/` logic changes this turn. Enqueue Driver next pending STEP.

## Critic checklist (`STEP=critique-audit`)

1. Last 3 `done` steps in TRACK - commit hash exists? diff matches claim?
2. Re-run verify gate spot-check (tests, not full re-implement).
3. `npm run supervisor` - any critical?
4. Done marked but tests/commit missing -> reopen step or add fix sub-step.
5. Max skepticism: what was skipped, hand-waved, or untested?
6. Output in SESSION; enqueue Driver (fix) or Planner (TRACK gap). No drive-by refactors.

## Orchestrator checklist (`STEP=roles-review`)

1. Read this file + CONTINUITY rotation - still match reality?
2. Token burn OK? Adjust N if needed (document in SESSION).
3. Missing role for recurring pain? Propose row here.
4. Update ROLES.md + CONTINUITY if changed; enqueue Driver.

## Overnight guard (cr repo)

From `/home/jenya/workspaces/current/cr`:

- `npm run overnight:loop` - supervisor + guard every 5m
- `npm run overnight:guard:mlc` - mlc only
- Log: `~/.cursor/cr-overnight.log`
- Pause at usage >= 88%; cooldown 15m per target
- Requires mlc Cursor window open
