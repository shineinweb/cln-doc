#!/usr/bin/env bash
set -euo pipefail

for _ in $(seq 1 40); do
  if docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 -uroot -proot --silent >/dev/null 2>&1; then
    echo "MySQL is ready."
    exit 0
  fi
  sleep 2
done

echo "MySQL did not become ready. Check 'docker compose logs mysql'." >&2
exit 1
