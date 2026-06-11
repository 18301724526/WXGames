#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/opt/wxgame-workspace/backups}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-26}"
REQUIRE_BACKUP_DB="${REQUIRE_BACKUP_DB:-1}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[verify-runtime-backup] Missing command: $1" >&2
        exit 1
    fi
}

latest_backup() {
    find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'wxgame-runtime-*.tar.gz' -printf '%T@ %p\n' \
        | sort -nr \
        | awk 'NR == 1 { $1=""; sub(/^ /, ""); print }'
}

verify_checksum() {
    local archive="$1"
    local checksum="$archive.sha256"
    if [ ! -f "$checksum" ]; then
        echo "[verify-runtime-backup] Missing checksum: $checksum" >&2
        exit 1
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

verify_archive_contents() {
    local archive="$1"
    local listing
    listing="$(tar -tzf "$archive")"

    for required_path in './backup-manifest.json' './shared/' './deploy-state/'; do
        if ! printf '%s\n' "$listing" | grep -Fqx "$required_path"; then
            echo "[verify-runtime-backup] Missing archive path: $required_path" >&2
            exit 1
        fi
    done

    if [ "$REQUIRE_BACKUP_DB" = "1" ] \
        && ! printf '%s\n' "$listing" | grep -Fqx './backend-db/civilization.db'; then
        echo "[verify-runtime-backup] Missing archive path: ./backend-db/civilization.db" >&2
        exit 1
    fi
}

verify_age() {
    local archive="$1"
    local max_seconds
    local age_seconds
    max_seconds="$(( ${MAX_BACKUP_AGE_HOURS//[^0-9]/} * 3600 ))"
    if [ "$max_seconds" -le 0 ]; then
        echo "[verify-runtime-backup] Invalid MAX_BACKUP_AGE_HOURS=$MAX_BACKUP_AGE_HOURS" >&2
        exit 1
    fi
    age_seconds="$(node - "$archive" <<'NODE'
const fs = require('node:fs');
const archivePath = process.argv[2];
const ageMs = Date.now() - fs.statSync(archivePath).mtimeMs;
process.stdout.write(String(Math.max(0, Math.floor(ageMs / 1000))));
NODE
)"
    if [ "$age_seconds" -gt "$max_seconds" ]; then
        echo "[verify-runtime-backup] Latest backup is too old: ageSeconds=$age_seconds maxSeconds=$max_seconds" >&2
        exit 1
    fi
}

require_command find
require_command sort
require_command awk
require_command tar
require_command node

if [ ! -d "$BACKUP_ROOT" ]; then
    echo "[verify-runtime-backup] Missing backup root: $BACKUP_ROOT" >&2
    exit 1
fi

archive="$(latest_backup)"
if [ -z "$archive" ]; then
    echo "[verify-runtime-backup] No runtime backup archive found in $BACKUP_ROOT" >&2
    exit 1
fi

verify_age "$archive"
verify_checksum "$archive"
verify_archive_contents "$archive"

echo "[verify-runtime-backup] latest: $archive"
echo "[verify-runtime-backup] passed"
