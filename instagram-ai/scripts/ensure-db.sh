#!/usr/bin/env bash
# Startup safeguard: make sure MariaDB is up and the database has data.
# If the database is missing or has no tables, restore the latest dump (and uploads
# if the storage dir is empty), then run `prisma db push` so the schema is current.
# Run before starting the API:  scripts/ensure-db.sh && pnpm dev:api
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_config

admin_sql() { sudo -n mariadb "$@" 2>/dev/null || sudo -n mysql "$@"; }

if ! db_reachable; then
  # Fresh server after a reset: the database and user may not exist yet.
  if ! (mysqladmin -h "$DB_HOST" -P "$DB_PORT" ping >/dev/null 2>&1 || pgrep -x mariadbd >/dev/null || pgrep -x mysqld >/dev/null); then
    echo "MariaDB is not running on $DB_HOST:$DB_PORT. Start it (e.g. sudo service mariadb start) and re-run." >&2
    exit 1
  fi
  echo "App user cannot connect; creating database and user via admin access..."
  esc_pass="${DB_PASS//\'/\'\'}"
  admin_sql -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4;
    CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$esc_pass';
    CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$esc_pass';
    GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
    GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
    GRANT ALL PRIVILEGES ON \`${DB_NAME}_test\`.* TO '$DB_USER'@'localhost';
    FLUSH PRIVILEGES;" || { echo "Could not create the database user; check MariaDB admin access." >&2; exit 1; }
  db_reachable || { echo "Still cannot connect as $DB_USER." >&2; exit 1; }
fi

db_mysql -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4" 2>/dev/null || true

tables="$(table_count)"
if [ "${tables:-0}" -gt 0 ]; then
  echo "ensure-db: $DB_NAME has $tables tables; nothing to restore."
else
  echo "ensure-db: $DB_NAME is empty or missing; looking for a dump to restore..."
  dump="$(newest_file "${DB_NAME}-" .sql.gz "$BACKUP_DIR" "$STORE_DIR")"
  if [ -n "$dump" ]; then
    uploads_flag=(--uploads none)
    if [ ! -d "$UPLOADS_DIR" ] || [ -z "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then uploads_flag=(); fi
    "$ROOT_DIR/scripts/restore.sh" "$dump" "${uploads_flag[@]}" --yes
  else
    echo "ensure-db: no dump found in $BACKUP_DIR or $STORE_DIR; creating an empty schema (run pnpm db:seed for staff login)." >&2
  fi
fi

echo "ensure-db: running prisma db push..."
( cd "$ROOT_DIR" && pnpm --silent db:push --skip-generate ) || ( cd "$ROOT_DIR" && pnpm db:push )
echo "ensure-db: ready ($(table_count) tables)."
