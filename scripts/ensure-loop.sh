#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="${HOME}/.cursor/cursor-agent-loop.pid"
LOG="${CR_LOG:-${HOME}/.cursor/cursor-agent-loop.log}"

cd "$ROOT"
[ "${CR_ENSURE_BUILD:-0}" = 1 ] && npm run build >/dev/null

if [ -f "$PIDFILE" ]; then
  OLD="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then
    echo "loop already running pid=$OLD"
    exit 0
  fi
fi

rm -f "${HOME}/.cursor/cursor-agent-loop.lock" "$PIDFILE"
nohup env CR_GUARD_TARGET=mlc CR_LOOP_INTERVAL_SEC="${CR_LOOP_INTERVAL_SEC:-300}" CR_COOLDOWN_MS="${CR_COOLDOWN_MS:-240000}" npm run loop >>"$LOG" 2>&1 &
sleep 2
echo "loop pid=$(cat "$PIDFILE" 2>/dev/null || echo '?')"
