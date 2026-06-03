# Continuity - cr orchestration agent

**INSTRUCTIONS_REV:** `2026-05-28-cleaner`

## Scope

?????? ??????????? `cr/` ? `cr/docs/agent/`. ?? ??????? `mlc/docs/agent/`, ?? enqueue ? mlc-composer, ?? ?????? mlc TRACK/SESSION � ??? ????? ?????.

## Each turn

1. CONTINUITY + ROLES.md + active TRACK + SESSION
2. `npm test` before commit
3. End: SESSION -> register -> enqueue next step

## Token

- Default: Composer **Fast**
- Sonnet/Opus: only on user request
- `npm run probe:usage` - pause enqueue if ring >= 88%

## MCP

`cursor_agent_register` with `composerId: "90b0b877-3af6-4ab7-91ae-4d259b3e6e21"`.

Roles and rotation: [ROLES.md](ROLES.md).

## Overnight

- `npm run overnight:loop` from cr repo
- Supervisor: `npm run supervisor` -> `~/.cursor/cr-supervisor.json`
- Guard blocks on: step_stuck, send_fail_loop, guard_error, no_window (6x)

## Prompt template

```
AGENT_TOKEN=cr-agent-...
INSTRUCTIONS_REV=2026-05-28-roles
ROLE=Driver|Planner|Meta|Critic|Orchestrator|Backlog|Cleaner
STEP=<n|plan-refresh|meta-review|critique-audit|roles-review|backlog-review|cleanup-sweep>
@docs/agent/CONTINUITY.md
@docs/agent/ROLES.md
@docs/agent/TRACK_ORCH.md
```
