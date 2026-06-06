#!/usr/bin/env bash
# Start a terminal agent in a tmux session and configure cr to use it.
#
# Usage:
#   CR_MLC_TRANSPORT=tmux ./scripts/tmux-agent-start.sh [mlc|cr] [claude|opencode|codex]
#
# After running, restart cr server with the exported env vars.
set -euo pipefail

TARGET="${1:-mlc}"
AGENT="${2:-claude}"

case "$TARGET" in
  mlc) WORKDIR="${MLC_DIR:-$HOME/workspaces/current/mlc}" ;;
  cr)  WORKDIR="${CR_DIR:-$HOME/workspaces/current/cr}" ;;
  *) echo "unknown target: $TARGET"; exit 1 ;;
esac

SESSION="cr-agent-${TARGET}"
WINDOW="${SESSION}:0"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "session $SESSION already exists"
else
  case "$AGENT" in
    claude)   CMD="claude --no-tui" ;;
    opencode) CMD="opencode" ;;
    codex)    CMD="codex" ;;
    *) CMD="$AGENT" ;;
  esac

  tmux new-session -d -s "$SESSION" -c "$WORKDIR"
  tmux send-keys -t "$WINDOW" "$CMD" Enter
  echo "started $AGENT in tmux session $SESSION"
fi

PANE_ID=$(tmux list-panes -t "$WINDOW" -F '#{pane_id}' | head -1)

ENV_VAR_TRANSPORT="CR_$(echo "$TARGET" | tr '[:lower:]' '[:upper:]')_TRANSPORT"
ENV_VAR_PANE="CR_$(echo "$TARGET" | tr '[:lower:]' '[:upper:]')_TMUX_PANE"

echo ""
echo "Set these env vars and restart cr server:"
echo "  export ${ENV_VAR_TRANSPORT}=tmux"
echo "  export ${ENV_VAR_PANE}=${PANE_ID}"
echo ""
echo "Or add to .env:"
echo "  ${ENV_VAR_TRANSPORT}=tmux"
echo "  ${ENV_VAR_PANE}=${PANE_ID}"
echo ""
echo "Attach: tmux attach -d -t $SESSION"
echo "Detach: Ctrl+b d"
