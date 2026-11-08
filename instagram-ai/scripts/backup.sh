#!/usr/bin/env bash
# Back up the instagram_ai MariaDB database and the asset storage directory.
# Outputs timestamped files to ./backups and copies them to the durable store.
#   BACKUP_DIR  local output dir (default: <repo>/backups)
#   STORE_DIR   durable copy (default: /cursor/stores/self/backups/instagram-ai; skipped if parent missing)
#   KEEP        backups to retain per directory (default: 24)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
load_config

TS="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_NAME="${DB_NAME}-${TS}.sql.gz"
UPLOADS_NAME="uploads-${TS}.tar.gz"
mkdir -p "$BACKUP_DIR"

if ! command -v mysqldump >/dev/null; then echo "mysqldump not found" >&2; exit 1; fi

tmp="$BACKUP_DIR/.${DUMP_NAME}.tmp"
trap 'rm -f "$tmp" "$BACKUP_DIR/.${UPLOADS_NAME}.tmp"' EXIT

mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
  --single-transaction --routines --triggers --events --no-tablespaces \
  --default-character-set=utf8mb4 "$DB_NAME" | gzip -9 > "$tmp"
gunzip -t "$tmp"
mv "$tmp" "$BACKUP_DIR/$DUMP_NAME"
echo "db      $BACKUP_DIR/$DUMP_NAME ($(stat -c %s "$BACKUP_DIR/$DUMP_NAME") bytes)"

FILES=("$DUMP_NAME")
# Uploads are mostly incompressible media; skip the archive when nothing changed since the last one.
sig=""
if [ -d "$UPLOADS_DIR" ] && [ -n "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
  sig="$(cd "$UPLOADS_DIR" && find . -type f -printf '%p %s %T@\n' | LC_ALL=C sort | sha256sum | cut -d' ' -f1)"
  last_sig="$(cat "$BACKUP_DIR/.uploads.sig" 2>/dev/null || true)"
  last_archive="$(newest_file uploads- .tar.gz "$BACKUP_DIR")"
  if [ "$sig" = "$last_sig" ] && [ -n "$last_archive" ] && [ -z "${FORCE_UPLOADS:-}" ]; then
    echo "uploads unchanged since $(basename "$last_archive"); not re-archiving"
  else
    utmp="$BACKUP_DIR/.${UPLOADS_NAME}.tmp"
    tar -C "$(dirname "$UPLOADS_DIR")" -czf "$utmp" "$(basename "$UPLOADS_DIR")"
    tar -tzf "$utmp" >/dev/null
    mv "$utmp" "$BACKUP_DIR/$UPLOADS_NAME"
    echo "$sig" > "$BACKUP_DIR/.uploads.sig"
    FILES+=("$UPLOADS_NAME")
    echo "uploads $BACKUP_DIR/$UPLOADS_NAME ($(stat -c %s "$BACKUP_DIR/$UPLOADS_NAME") bytes)"
  fi
else
  echo "uploads dir $UPLOADS_DIR is empty or missing; nothing to archive"
fi

prune() {
  local dir="$1" pattern f
  for pattern in "${DB_NAME}-*.sql.gz" "uploads-*.tar.gz"; do
    ls -1 "$dir"/$pattern 2>/dev/null | sort | head -n "-${KEEP}" | while read -r f; do rm -f -- "$f"; done || true
  done
}
prune "$BACKUP_DIR"

if [ -d "$(dirname "$STORE_DIR")" ] || mkdir -p "$STORE_DIR" 2>/dev/null; then
  mkdir -p "$STORE_DIR"
  store_failed=""
  for f in "${FILES[@]}"; do
    # The store is a FUSE mount: renaming large files into place fails (ENOSPC), so copy directly
    # and remove the partial file if the copy does not complete.
    if cp -f "$BACKUP_DIR/$f" "$STORE_DIR/$f" && cmp -s "$BACKUP_DIR/$f" "$STORE_DIR/$f"; then
      echo "store   $STORE_DIR/$f"
    else
      rm -f "$STORE_DIR/$f"; echo "warning: failed to copy $f to $STORE_DIR" >&2; store_failed=1
    fi
  done
  prune "$STORE_DIR"
  [ -z "$store_failed" ] || exit 1
else
  echo "warning: durable store $STORE_DIR unavailable; only local copy written" >&2
fi
