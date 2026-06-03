# Research � cr orchestration

## Stack (no extra LLM API for monitoring)

| Layer | Cost | Role |
|-------|------|------|
| watchdog | free | CDP poll, modals, slow recover |
| supervisor | free | `cursor_supervisor` MCP |
| overnight-guard | free | `cursor_overnight_state` MCP |
| Cursor agent | tokens | Driver/Planner only |

Optional cheap LLM: 1x/day meta summary if supervisor has critical alerts.

## Tools

- `npm run supervisor` ? `~/.cursor/cr-supervisor.json`
- `GET /api/supervisor/alerts`

## References

- mlc docs/agent/RESEARCH.md
- rustc fuzzing guide
