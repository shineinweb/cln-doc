#!/usr/bin/env bash
# Shared helpers for backup/restore/ensure-db. Source this file; do not run it.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

# Read KEY=value from the .env file without executing it.
env_value() {
  local key="$1" line
  [ -f "$ENV_FILE" ] || return 0
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 || true)"
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  printf '%s' "$line"
}

load_config() {
  DATABASE_URL="${DATABASE_URL:-$(env_value DATABASE_URL)}"
  if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set (checked environment and $ENV_FILE)" >&2
    return 1
  fi
  # mysql://user:pass@host:port/db
  local rest="${DATABASE_URL#*://}"
  local creds="${rest%%@*}" hostdb="${rest#*@}"
  DB_USER="${creds%%:*}"
  DB_PASS="${creds#*:}"
  [ "$creds" = "$DB_USER" ] && DB_PASS=""
  local hostport="${hostdb%%/*}"
  DB_NAME="${hostdb#*/}"; DB_NAME="${DB_NAME%%\?*}"
  DB_HOST="${hostport%%:*}"
  DB_PORT="${hostport#*:}"; [ "$DB_PORT" = "$hostport" ] && DB_PORT=3306
  DB_PASS="$(printf '%b' "${DB_PASS//%/\\x}")"
  export MYSQL_PWD="$DB_PASS"

  # The API runs with cwd apps/api, so a relative STORAGE_DIR resolves there.
  local storage="${STORAGE_DIR:-$(env_value STORAGE_DIR)}"
  storage="${storage:-./data/media}"
  case "$storage" in
    /*) UPLOADS_DIR="$storage" ;;
    *)  UPLOADS_DIR="$ROOT_DIR/apps/api/$storage" ;;
  esac
  UPLOADS_DIR="$(readlink -m "$UPLOADS_DIR")"

  BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
  STORE_DIR="${STORE_DIR:-/cursor/stores/self/backups/instagram-ai}"
  KEEP="${KEEP:-24}"
}


db_mysql() { mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$@"; }

db_reachable() { db_mysql -e 'select 1' >/dev/null 2>&1; }

table_count() {
  db_mysql -N -B -e "select count(*) from information_schema.tables where table_schema='${DB_NAME}'" 2>/dev/null || echo 0
}

# Newest file matching a glob prefix/suffix across the given directories (names embed a UTC timestamp).
newest_file() {
  local prefix="$1" suffix="$2"; shift 2
  local d f
  for d in "$@"; do
    [ -d "$d" ] || continue
    for f in "$d"/${prefix}*${suffix}; do if [ -e "$f" ]; then echo "$f"; fi; done
  done | awk -F/ '{print $NF "\t" $0}' | sort | tail -n1 | cut -f2- || true
}
