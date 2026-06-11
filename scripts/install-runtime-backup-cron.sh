#!/usr/bin/env bash
set -euo pipefail

WORK_TREE="${WORK_TREE:-/www/wwwroot/h5}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-$WORK_TREE/scripts/backup-runtime-state.sh}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/wxgame-workspace/backups}"
BACKUP_LOG="${BACKUP_LOG:-/opt/wxgame-workspace/.wxgame/backup.log}"
BACKUP_CRON_SCHEDULE="${BACKUP_CRON_SCHEDULE:-17 3 * * *}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CRON_MARKER="${CRON_MARKER:-WXGAME_RUNTIME_BACKUP}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[backup-cron] Missing command: $1" >&2
        exit 1
    fi
}

shell_quote() {
    printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

require_command crontab
require_command sed

if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "[backup-cron] Missing backup script: $BACKUP_SCRIPT" >&2
    exit 1
fi

mkdir -p "$(dirname "$BACKUP_LOG")" "$BACKUP_ROOT"

cron_command="BACKUP_ROOT=$(shell_quote "$BACKUP_ROOT") RETENTION_DAYS=$(shell_quote "$RETENTION_DAYS") bash $(shell_quote "$BACKUP_SCRIPT") >> $(shell_quote "$BACKUP_LOG") 2>&1"
cron_line="$BACKUP_CRON_SCHEDULE $cron_command # $CRON_MARKER"

current_cron="$(mktemp)"
next_cron="$(mktemp)"
trap 'rm -f "$current_cron" "$next_cron"' EXIT

crontab -l > "$current_cron" 2>/dev/null || true
grep -Fv "# $CRON_MARKER" "$current_cron" > "$next_cron" || true
printf '%s\n' "$cron_line" >> "$next_cron"
crontab "$next_cron"

echo "[backup-cron] installed: $cron_line"
echo "[backup-cron] log: $BACKUP_LOG"
echo "[backup-cron] backup root: $BACKUP_ROOT"
