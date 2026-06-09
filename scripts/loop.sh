#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INTERVAL="${CR_LOOP_INTERVAL_SEC:-300}"
PIDFILE="${HOME}/.cursor/cursor-agent-loop.pid"
LOG="${CR_LOG:-${HOME}/.cursor/cursor-agent-loop.log}"
LOCKFILE="${HOME}/.cursor/cursor-agent-loop.lock"

mkdir -p "$(dirname "$LOG")"

# Singleton: refuse second instance.
exec 9>"$LOCKFILE"
if ! flock -n 9; then
  echo "{\"at\":\"$(date -Iseconds)\",\"msg\":\"loop already running, exit\"}" >>"$LOG"
  exit 0
fi

echo "$$" >"$PIDFILE"
echo "{\"at\":\"$(date -Iseconds)\",\"msg\":\"loop start\",\"pid\":$$,\"intervalSec\":$INTERVAL}" >>"$LOG"
trap 'echo "{\"at\":\"$(date -Iseconds)\",\"msg\":\"loop exit\",\"pid\":$$,\"sig\":\"EXIT\"}" >>"$LOG"' EXIT
trap 'echo "{\"at\":\"$(date -Iseconds)\",\"msg\":\"loop exit\",\"pid\":$$,\"sig\":\"TERM\"}" >>"$LOG"; exit 1' TERM
trap 'echo "{\"at\":\"$(date -Iseconds)\",\"msg\":\"loop exit\",\"pid\":$$,\"sig\":\"HUP\"}" >>"$LOG"; exit 1' HUP

cd "$ROOT"
export CR_GUARD_TARGET="${CR_GUARD_TARGET:-mlc}"
while true; do
  # supervisor: only log if critical alerts present, not on every run
  SUPOUT=$(npx tsx scripts/supervisor.ts 2>&1) || true
  if echo "$SUPOUT" | grep -q '"severity":"critical"' 2>/dev/null; then
    echo "{\"at\":\"$(date -Iseconds)\",\"msg\":\"supervisor critical\"}" >>"$LOG"
  fi

  GUARDERR=$(mktemp)
  if ! npx tsx scripts/guard.ts 2>"$GUARDERR"; then
    ERRMSG=$(grep -v '^Node.js v' "$GUARDERR" | tail -3 | head -c 400 || true)
    echo "{\"at\":\"$(date -Iseconds)\",\"msg\":\"error\",\"err\":\"guard exit: $ERRMSG\"}" >>"$LOG"
  fi
  rm -f "$GUARDERR"

  sleep "$INTERVAL"
done
