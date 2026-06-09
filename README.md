# cursor-agent-loop

Orchestration layer for autonomous Cursor agent sessions. Sends prompts based on role rotation and track state, monitors progress, detects stuck agents, and exposes a web UI for observability.

Part of the [mlc](https://github.com/jenya239/mlc) project infrastructure.

## What it does

- **Role rotation** — picks next agent role (Driver, Planner, Critic, Monitor, …) based on `SESSION.md` state and `TRACK_*.md` files
- **Watchdog** — detects stuck/busy agents, auto-stops via CDP, re-queues prompts
- **MCP server** — exposes tools so the agent can register itself, read its own session, and enqueue work
- **Progress UI** — web interface showing active tracks, step counts, turn history, cost, upcoming work
- **tmux transport** — parallel agents in tmux sessions alongside Cursor

## Setup

```bash
npm install
npm run build
npm run build:ui
npm run dev          # http://127.0.0.1:3847
```

Open in an external browser (not Cursor's built-in tab). Requires Cursor running with `--remote-debugging-port`.

## Key env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3847` | HTTP port |
| `CURSOR_DB` | auto | Path to `state.vscdb` |
| `CDP_PORT` | `9226` | Cursor remote debugging port |
| `CR_GUARD_TARGET` | `mlc` | Which agent target to nudge (`mlc`, `cr`, `all`) |
| `CR_MLC_TRANSPORT` | `cdp` | Transport for mlc agent (`cdp` or `tmux`) |
| `CR_MLC_TMUX_PANE` | — | tmux pane id when transport=tmux |
| `CR_COOLDOWN_MS` | `900000` | Min interval between nudges (15m) |
| `CR_WATCHDOG` | `1` | Set to `0` to disable watchdog |
| `CR_LOG` | `~/.cursor/cursor-agent-loop.log` | Log file path |

## Guard loop

```bash
npm run loop                        # runs guard on interval (every 5 min by default)
npm run guard:mlc                   # single guard tick for mlc target
./scripts/tmux-agent-start.sh mlc  # launch agent in tmux session
```

## MCP

Register in Cursor's `.cursor/mcp.json` after `npm run build`. Tools: `cursor_agent_register`, `cursor_agent_resolve`, `cursor_enqueue_send`, `cursor_send`, `cursor_session`, `cursor_snapshot`, `cursor_get_chat`.

## Tests

```bash
npm test
npm run test:e2e
```
