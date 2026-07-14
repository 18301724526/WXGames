#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    echo "Usage: WXGAME_RESTORE_CONFIRM=restore-runtime-state bash scripts/restore-runtime-state.sh <backup.tar.gz>"
    echo
    echo "Environment:"
    echo "  BACKEND_DIR=/opt/wxgame-workspace/backend"
    echo "  SHARED_DIR=/opt/wxgame-workspace/shared"
    echo "  DEPLOY_STATE_DIR=/opt/wxgame-workspace/.wxgame"
    echo "  BACKUP_ROOT=/opt/wxgame-workspace/backups"
    echo "  RESTORE_DEPLOY_STATE=1"
    echo "  ALLOW_RESTORE_WITHOUT_PM2_STOP=1"
    exit 2
fi

ARCHIVE_PATH="$1"
BACKEND_DIR="${BACKEND_DIR:-/opt/wxgame-workspace/backend}"
SHARED_DIR="${SHARED_DIR:-/opt/wxgame-workspace/shared}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-workspace/.wxgame}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/wxgame-workspace/backups}"
DB_PATH="${DB_PATH:-$BACKEND_DIR/civilization.db}"
PM2_APP_NAME="${PM2_APP_NAME:-server}"
RESTORE_WORK_DIR="${RESTORE_WORK_DIR:-/tmp/wxgame-runtime-restore}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[restore-runtime] Missing command: $1" >&2
        exit 1
    fi
}

require_safe_target() {
    local label="$1"
    local target="$2"
    if [ -z "$target" ] || [ "$target" = "/" ]; then
        echo "[restore-runtime] Refusing unsafe $label=$target" >&2
        exit 1
    fi
}

verify_checksum_if_present() {
    local archive="$1"
    local checksum="$archive.sha256"
    if [ ! -f "$checksum" ]; then
        echo "[restore-runtime] Checksum file not found, skipping: $checksum"
        return
    fi
    if command -v sha256sum >/dev/null 2>&1; then
        (cd "$(dirname "$archive")" && sha256sum -c "$(basename "$checksum")")
        return
    fi
    node - "$archive" "$checksum" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const [archivePath, checksumPath] = process.argv.slice(2);
const expected = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
const hash = crypto.createHash('sha256');
hash.update(fs.readFileSync(archivePath));
const actual = hash.digest('hex');
if (actual !== expected) {
  console.error(`checksum mismatch: expected=${expected} actual=${actual}`);
  process.exit(1);
}
NODE
}

maybe_stop_pm2() {
    if [ "${ALLOW_RESTORE_WITHOUT_PM2_STOP:-0}" = "1" ]; then
        echo "[restore-runtime] PM2 stop skipped by ALLOW_RESTORE_WITHOUT_PM2_STOP=1"
        return
    fi
    if command -v pm2 >/dev/null 2>&1; then
        if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
            pm2 stop "$PM2_APP_NAME"
            return
        fi
        echo "[restore-runtime] PM2 app not found, continuing: $PM2_APP_NAME"
        return
    fi
    echo "[restore-runtime] pm2 is missing. Set ALLOW_RESTORE_WITHOUT_PM2_STOP=1 only for an offline/non-production restore drill." >&2
    exit 1
}

remove_file_if_present() {
    local target="$1"
    if [ ! -e "$target" ] && [ ! -L "$target" ]; then
        return
    fi
    rm -f -- "$target"
}

maybe_restart_pm2() {
    if [ "${ALLOW_RESTORE_WITHOUT_PM2_STOP:-0}" = "1" ]; then
        echo "[restore-runtime] PM2 restart skipped by ALLOW_RESTORE_WITHOUT_PM2_STOP=1"
        return
    fi
    if ! command -v pm2 >/dev/null 2>&1; then
        echo "[restore-runtime] PM2 restart skipped because pm2 is unavailable."
        return
    fi
    if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
        pm2 restart "$PM2_APP_NAME" --update-env
    else
        pm2 start "$BACKEND_DIR/server.js" --name "$PM2_APP_NAME" --update-env
    fi
}

restore_directory_contents() {
    local source_dir="$1"
    local target_dir="$2"
    local label="$3"
    if [ ! -d "$source_dir" ]; then
        echo "[restore-runtime] Backup does not include $label, skipping."
        return
    fi
    require_safe_target "$label" "$target_dir"
    mkdir -p "$target_dir"
    find "$target_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "$source_dir/." "$target_dir/"
    echo "[restore-runtime] Restored $label: $target_dir"
}

if [ "${WXGAME_RESTORE_CONFIRM:-}" != "restore-runtime-state" ]; then
    echo "[restore-runtime] Refusing restore without WXGAME_RESTORE_CONFIRM=restore-runtime-state" >&2
    exit 1
fi

if [ ! -f "$ARCHIVE_PATH" ]; then
    echo "[restore-runtime] Missing backup archive: $ARCHIVE_PATH" >&2
    exit 1
fi

require_command node
require_command tar
require_command find
require_safe_target "BACKEND_DIR" "$BACKEND_DIR"
require_safe_target "SHARED_DIR" "$SHARED_DIR"
require_safe_target "DEPLOY_STATE_DIR" "$DEPLOY_STATE_DIR"

if [ "${SKIP_PRE_RESTORE_BACKUP:-0}" != "1" ]; then
    BACKUP_LABEL="pre-restore" BACKEND_DIR="$BACKEND_DIR" SHARED_DIR="$SHARED_DIR" DEPLOY_STATE_DIR="$DEPLOY_STATE_DIR" BACKUP_ROOT="$BACKUP_ROOT" DB_PATH="$DB_PATH" \
        bash "$(dirname "$0")/backup-runtime-state.sh"
else
    echo "[restore-runtime] SKIP_PRE_RESTORE_BACKUP=1 set; skipping safety backup."
fi

verify_checksum_if_present "$ARCHIVE_PATH"

extract_dir="$RESTORE_WORK_DIR/restore-$(date -u +"%Y%m%dT%H%M%SZ")"
rm -rf "$extract_dir"
mkdir -p "$extract_dir"
tar -xzf "$ARCHIVE_PATH" -C "$extract_dir"

maybe_stop_pm2

if [ -f "$extract_dir/backend-db/civilization.db" ]; then
    mkdir -p "$(dirname "$DB_PATH")"
    restore_tmp="$DB_PATH.restore-tmp"
    remove_file_if_present "$restore_tmp"
    cp -- "$extract_dir/backend-db/civilization.db" "$restore_tmp"
    if [ ! -f "$restore_tmp" ]; then
        echo "[restore-runtime] Failed to prepare SQLite restore file: $restore_tmp" >&2
        exit 1
    fi
    remove_file_if_present "$DB_PATH-wal"
    remove_file_if_present "$DB_PATH-shm"
    if [ ! -f "$restore_tmp" ]; then
        echo "[restore-runtime] SQLite restore file disappeared before activation: $restore_tmp" >&2
        exit 1
    fi
    mv -f -- "$restore_tmp" "$DB_PATH"
    echo "[restore-runtime] Restored SQLite database: $DB_PATH"
else
    echo "[restore-runtime] Backup does not include SQLite database, skipping."
fi

restore_directory_contents "$extract_dir/shared" "$SHARED_DIR" "shared config"

if [ "${RESTORE_DEPLOY_STATE:-0}" = "1" ]; then
    restore_directory_contents "$extract_dir/deploy-state" "$DEPLOY_STATE_DIR" "deploy state"
else
    echo "[restore-runtime] Deploy state restore skipped. Set RESTORE_DEPLOY_STATE=1 to restore deploy metadata."
fi

maybe_restart_pm2
rm -rf "$extract_dir"

echo "[restore-runtime] completed"
