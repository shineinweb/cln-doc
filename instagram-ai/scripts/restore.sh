#!/usr/bin/env bash
# Restore a database dump (and optionally the uploads archive).
#   scripts/restore.sh [dump.sql.gz|latest] [--uploads archive.tar.gz|none] [--yes]
# With no dump argument (or "latest") the newest dump in ./backups or the durable store is used.
# Without --uploads, the newest uploads archive taken at or before the dump is restored.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_config

DUMP="latest"; UPLOADS=""; YES=""
while [ $# -gt 0 ]; do
  case "$1" in
    --uploads) UPLOADS="$2"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) DUMP="$1"; shift ;;
  esac
done

if [ "$DUMP" = "latest" ]; then
  DUMP="$(newest_file "${DB_NAME}-" .sql.gz "$BACKUP_DIR" "$STORE_DIR")"
  [ -n "$DUMP" ] || { echo "No dumps found in $BACKUP_DIR or $STORE_DIR" >&2; exit 1; }
fi
[ -f "$DUMP" ] || { echo "Dump not found: $DUMP" >&2; exit 1; }
gunzip -t "$DUMP"

if [ -z "$UPLOADS" ]; then
  stamp="$(basename "$DUMP" .sql.gz)"; stamp="${stamp##*-}"
  UPLOADS="$(for d in "$BACKUP_DIR" "$STORE_DIR"; do ls -1 "$d"/uploads-*.tar.gz 2>/dev/null; done \
    | awk -F/ -v s="$stamp" '{n=$NF; sub(/^uploads-/,"",n); sub(/\.tar\.gz$/,"",n); if (n<=s) print n "\t" $0}' | sort | tail -n1 | cut -f2-)"
fi

echo "Database : $DB_NAME on $DB_HOST:$DB_PORT (user $DB_USER)"
echo "Dump     : $DUMP"
echo "Uploads  : ${UPLOADS:-none} -> $UPLOADS_DIR"
if [ -z "$YES" ]; then
  read -r -p "This overwrites existing tables and files with the same names. Continue? [y/N] " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "Aborted."; exit 1; }
fi

db_mysql -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4" 2>/dev/null || true
gunzip -c "$DUMP" | db_mysql "$DB_NAME"
echo "Database restored ($(table_count) tables)."

if [ -n "$UPLOADS" ] && [ "$UPLOADS" != "none" ]; then
  mkdir -p "$(dirname "$UPLOADS_DIR")"
  tar -C "$(dirname "$UPLOADS_DIR")" -xzf "$UPLOADS"
  echo "Uploads restored to $UPLOADS_DIR ($(ls -1 "$UPLOADS_DIR" | wc -l) files)."
fi
