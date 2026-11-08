#!/usr/bin/env bash
# Run backup.sh every INTERVAL seconds (default 1800), keeping the last 24. Intended for tmux session `instagram-backup`.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
INTERVAL="${INTERVAL:-1800}"
while true; do
  echo "=== $(date -u +%FT%TZ) backup start ==="
  ./scripts/backup.sh || echo "backup FAILED (exit $?)" >&2
  sleep "$INTERVAL"
done
