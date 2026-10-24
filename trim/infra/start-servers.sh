#!/usr/bin/env bash
# Start Serenity Universal without deleting stored data.
# Safe to run again. `restart` bounces containers and app processes and still
# keeps the database files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Logical backup. The agent store accepts this file and is remounted on a new
# machine. A MySQL datadir cannot live there (chmod and large files are rejected).
if [[ -d /cursor/stores/self ]]; then
  DATA_ROOT="${TRIM_DATA_ROOT:-/cursor/stores/self/trim-data}"
else
  DATA_ROOT="${TRIM_DATA_ROOT:-$ROOT/.data}"
fi
mkdir -p "$DATA_ROOT"

COMPOSE=(docker compose -f docker-compose.yml)
MODE="${1:-start}"

if [[ -d "$HOME/.nvm/versions/node" ]]; then
  latest="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin | sort -V | tail -1 || true)"
  if [[ -n "$latest" ]]; then
    export PATH="$latest:$PATH"
  fi
fi

TMUX_CMD=(tmux)
if [[ -f /exec-daemon/tmux.portal.conf ]]; then
  TMUX_CMD=(tmux -f /exec-daemon/tmux.portal.conf)
fi

port_open() {
  python3 - "$1" <<'PY'
import socket, sys
s = socket.socket()
s.settimeout(0.4)
try:
    s.connect(("127.0.0.1", int(sys.argv[1])))
except Exception:
    sys.exit(1)
finally:
    s.close()
PY
}

ensure_docker() {
  if docker info >/dev/null 2>&1; then
    return
  fi
  if [[ -S /var/run/docker.sock ]] && sudo docker info >/dev/null 2>&1; then
    sudo chmod 666 /var/run/docker.sock || true
    if docker info >/dev/null 2>&1; then
      return
    fi
  fi
  if ! "${TMUX_CMD[@]}" has-session -t "=trim-docker" 2>/dev/null; then
    "${TMUX_CMD[@]}" new-session -d -s trim-docker -- sudo dockerd --host=unix:///var/run/docker.sock
  fi
  local _i
  for _i in $(seq 1 30); do
    if sudo docker info >/dev/null 2>&1; then
      sudo chmod 666 /var/run/docker.sock || true
      if docker info >/dev/null 2>&1; then
        return
      fi
    fi
    sleep 1
  done
  echo "Docker did not start." >&2
  exit 1
}

stop_host_datastores() {
  if pgrep -x mysqld >/dev/null 2>&1; then
    echo "Copying the host MySQL database before Docker takes port 3306."
    sudo mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF trim \
      | gzip -c > "$DATA_ROOT/trim.sql.gz.tmp"
    mv "$DATA_ROOT/trim.sql.gz.tmp" "$DATA_ROOT/trim.sql.gz"
    sudo mysql --batch --raw -e "SELECT id, email FROM trim.users ORDER BY email" > "$DATA_ROOT/users-before.txt" || true
  fi
  if pgrep -x mysqld >/dev/null 2>&1; then
    sudo mysqladmin --protocol=socket shutdown || sudo service mysql stop || true
    local _i
    for _i in $(seq 1 30); do
      if ! port_open 3306; then
        break
      fi
      sleep 1
    done
  fi
  if pgrep -f '^/usr/bin/redis-server' >/dev/null 2>&1; then
    sudo service redis-server stop || sudo pkill -f '^/usr/bin/redis-server' || true
  fi
  if pgrep -f '/tmp/rustfs/rustfs server' >/dev/null 2>&1; then
    pkill -f '/tmp/rustfs/rustfs server' || true
    sleep 1
  fi
}

wait_mysql() {
  local _i
  for _i in $(seq 1 60); do
    if "${COMPOSE[@]}" exec -T mysql mysqladmin ping -h 127.0.0.1 -uroot -proot --silent >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  echo "MySQL did not become ready." >&2
  "${COMPOSE[@]}" logs mysql >&2 || true
  exit 1
}

mysql_scalar() {
  "${COMPOSE[@]}" exec -T mysql mysql -N -utrim -ptrim -e "$1" 2>/dev/null | tr -d '\r'
}

table_exists() {
  local count
  count="$(mysql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='trim' AND table_name='${1}'")"
  [[ "$count" == "1" ]]
}

ensure_schema() {
  local users="0"
  if ! table_exists users && [[ -s "$DATA_ROOT/trim.sql.gz" ]]; then
    echo "Restoring MySQL from the saved copy."
    gunzip -c "$DATA_ROOT/trim.sql.gz" | "${COMPOSE[@]}" exec -T mysql mysql -uroot -proot trim
  fi

  if [[ ! -d "$ROOT/node_modules" ]]; then
    pnpm install
  fi
  if [[ ! -f "$ROOT/packages/contracts/dist/index.js" || ! -f "$ROOT/packages/database/dist/index.js" ]]; then
    pnpm dev:prepare
  fi
  if [[ ! -f "$ROOT/packages/metrc-sandbox/dist/index.js" ]]; then
    pnpm --filter @trim/metrc-sandbox build
  fi
  if [[ ! -f "$ROOT/.env" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
  fi

  pnpm db:migrate

  if table_exists users; then
    users="$(mysql_scalar "SELECT COUNT(*) FROM trim.users")"
  fi
  if [[ "${users:-0}" == "0" ]]; then
    echo "Database has no users. Seeding the demo organization once."
    pnpm db:seed
  else
    echo "Database has ${users} user(s). Leaving stored rows in place."
  fi

  if table_exists users; then
    users="$(mysql_scalar "SELECT COUNT(*) FROM trim.users")"
    if [[ "${users:-0}" != "0" ]]; then
      "${COMPOSE[@]}" exec -T mysql mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF -uroot -proot trim \
        | gzip -c > "$DATA_ROOT/trim.sql.gz.tmp"
      mv "$DATA_ROOT/trim.sql.gz.tmp" "$DATA_ROOT/trim.sql.gz"
      "${COMPOSE[@]}" exec -T mysql mysql --batch --raw -utrim -ptrim -e "SELECT id, email FROM trim.users ORDER BY email" > "$DATA_ROOT/users.txt"
    fi
  fi
}

ensure_bucket() {
  local _i
  for _i in $(seq 1 30); do
    if port_open 9000; then
      pnpm storage:bucket || true
      return
    fi
    sleep 1
  done
  echo "File storage did not open port 9000." >&2
}

send_app() {
  local name="$1"
  local cmd="$2"
  if ! "${TMUX_CMD[@]}" has-session -t "=$name" 2>/dev/null; then
    "${TMUX_CMD[@]}" new-session -d -s "$name" -c "$ROOT" -- bash -l
    sleep 0.5
  elif [[ "$MODE" == "restart" ]]; then
    "${TMUX_CMD[@]}" send-keys -t "$name:0.0" C-c
    sleep 1
  fi
  "${TMUX_CMD[@]}" send-keys -t "$name:0.0" "$cmd" C-m
}

ensure_apps() {
  local path_cmd
  path_cmd="export PATH=\"$PATH\"; cd \"$ROOT\""
  if ! port_open 3000 || [[ "$MODE" == "restart" ]]; then
    send_app trim-api "$path_cmd; pnpm dev:api"
  fi
  if ! port_open 5173 || [[ "$MODE" == "restart" ]]; then
    send_app trim-web "$path_cmd; cd apps/web && pnpm exec vite --host 127.0.0.1 --port 5173"
  fi
  if ! "${TMUX_CMD[@]}" has-session -t "=trim-worker" 2>/dev/null || [[ "$MODE" == "restart" ]]; then
    send_app trim-worker "$path_cmd; pnpm dev:worker"
  fi
  if ! pgrep -f 'cloudflared tunnel --url http://127.0.0.1:5173' >/dev/null 2>&1; then
    if [[ -x /tmp/cloudflared ]]; then
      "${TMUX_CMD[@]}" has-session -t "=trim-tunnel" 2>/dev/null || \
        "${TMUX_CMD[@]}" new-session -d -s trim-tunnel -- /tmp/cloudflared tunnel --url http://127.0.0.1:5173 --http-host-header 127.0.0.1:5173 --no-autoupdate
    fi
  fi
}

ensure_docker
moved_off_host=0
db_was_down=0
if ! port_open 3306; then
  db_was_down=1
fi
if [[ "$MODE" == "restart" ]]; then
  "${COMPOSE[@]}" up -d mysql redis s3
  "${COMPOSE[@]}" restart mysql redis s3
else
  if pgrep -x mysqld >/dev/null 2>&1; then
    moved_off_host=1
  fi
  stop_host_datastores
  "${COMPOSE[@]}" up -d mysql redis s3
fi
wait_mysql
ensure_schema
ensure_bucket
if [[ "$moved_off_host" == "1" || "$db_was_down" == "1" ]]; then
  MODE=restart
fi
ensure_apps

echo "MySQL volume: trim_mysql_data"
echo "Backup: $DATA_ROOT/trim.sql.gz"
echo "Users:"
"${COMPOSE[@]}" exec -T mysql mysql --batch --raw -utrim -ptrim -e "SELECT id, email FROM trim.users ORDER BY email"
