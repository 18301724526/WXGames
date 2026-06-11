#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-/opt/wxgame-workspace/backend}"
SHARED_DIR="${SHARED_DIR:-/opt/wxgame-workspace/shared}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-workspace/.wxgame}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/wxgame-workspace/backups}"
DB_PATH="${DB_PATH:-$BACKEND_DIR/civilization.db}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_LABEL="${BACKUP_LABEL:-runtime}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[backup-runtime] Missing command: $1" >&2
        exit 1
    fi
}

normalize_path_value() {
    local input_path="$1"
    while [ "$input_path" != "/" ] && [ "${input_path%/}" != "$input_path" ]; do
        input_path="${input_path%/}"
    done
    printf '%s' "$input_path"
}

require_safe_backup_root() {
    local normalized
    normalized="$(normalize_path_value "$BACKUP_ROOT")"
    if [ -z "$normalized" ] || [ "$normalized" = "/" ]; then
        echo "[backup-runtime] Refusing unsafe BACKUP_ROOT=$BACKUP_ROOT" >&2
        exit 1
    fi
    BACKUP_ROOT="$normalized"
}

write_manifest() {
    local manifest_path="$1"
    local backup_id="$2"
    node - "$manifest_path" "$backup_id" "$BACKEND_DIR" "$DB_PATH" "$SHARED_DIR" "$DEPLOY_STATE_DIR" "$BACKUP_ROOT" <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const [
  manifestPath,
  backupId,
  backendDir,
  dbPath,
  sharedDir,
  deployStateDir,
  backupRoot,
] = process.argv.slice(2);
const data = {
  schemaVersion: 1,
  id: backupId,
  createdAt: new Date().toISOString(),
  host: os.hostname(),
  backendDir,
  dbPath,
  sharedDir,
  deployStateDir,
  backupRoot,
  includes: {
    sqliteDatabase: fs.existsSync(dbPath),
    sharedConfig: fs.existsSync(sharedDir),
    deployState: fs.existsSync(deployStateDir),
  },
};
fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2) + '\n');
NODE
}

backup_sqlite_database() {
    local source_db="$1"
    local target_db="$2"

    if [ ! -f "$source_db" ]; then
        echo "[backup-runtime] SQLite database not found, skipping: $source_db"
        return
    fi

    mkdir -p "$(dirname "$target_db")"
    if node - "$BACKEND_DIR" "$source_db" "$target_db" <<'NODE'
const path = require('node:path');
const [backendDir, sourcePath, targetPath] = process.argv.slice(2);
let Database = null;
try {
  Database = require(path.join(backendDir, 'node_modules', 'better-sqlite3'));
} catch (error) {
  try {
    Database = require('better-sqlite3');
  } catch (_) {
    console.error(error.message);
    process.exit(2);
  }
}
const db = new Database(sourcePath, { readonly: true, fileMustExist: true });
db.backup(targetPath)
  .then(() => {
    db.close();
  })
  .catch((error) => {
    try { db.close(); } catch (_) {}
    console.error(error.message);
    process.exit(1);
  });
NODE
    then
        echo "[backup-runtime] SQLite online backup written: $target_db"
        return
    fi

    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "$source_db" ".backup '$target_db'"
        echo "[backup-runtime] SQLite CLI backup written: $target_db"
        return
    fi

    echo "[backup-runtime] Could not create an online SQLite backup. Install runtime dependencies or sqlite3." >&2
    exit 1
}

write_checksum() {
    local archive_path="$1"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$archive_path" > "$archive_path.sha256"
        return
    fi
    node - "$archive_path" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const archivePath = process.argv[2];
const hash = crypto.createHash('sha256');
hash.update(fs.readFileSync(archivePath));
process.stdout.write(`${hash.digest('hex')}  ${archivePath}\n`);
NODE
}

prune_old_backups() {
    local days
    days="$(printf '%s' "$RETENTION_DAYS" | tr -cd '0-9')"
    if [ -z "$days" ] || [ "$days" = "0" ]; then
        echo "[backup-runtime] Retention pruning disabled: RETENTION_DAYS=$RETENTION_DAYS"
        return
    fi
    find "$BACKUP_ROOT" -maxdepth 1 \
        \( -name 'wxgame-runtime-*.tar.gz' -o -name 'wxgame-runtime-*.tar.gz.sha256' \) \
        -mtime +"$days" -print -delete
}

require_command node
require_command tar
require_command find
require_safe_backup_root

mkdir -p "$BACKUP_ROOT/.tmp"
backup_id="wxgame-runtime-$(date -u +"%Y%m%dT%H%M%SZ")-${BACKUP_LABEL}"
staging_dir="$BACKUP_ROOT/.tmp/$backup_id"
archive_path="$BACKUP_ROOT/$backup_id.tar.gz"

rm -rf "$staging_dir"
mkdir -p "$staging_dir"

write_manifest "$staging_dir/backup-manifest.json" "$backup_id"
backup_sqlite_database "$DB_PATH" "$staging_dir/backend-db/civilization.db"

if [ -d "$SHARED_DIR" ]; then
    mkdir -p "$staging_dir/shared"
    cp -aL "$SHARED_DIR/." "$staging_dir/shared/"
    echo "[backup-runtime] Shared config copied: $SHARED_DIR"
else
    echo "[backup-runtime] Shared config directory not found, skipping: $SHARED_DIR"
fi

if [ -d "$DEPLOY_STATE_DIR" ]; then
    mkdir -p "$staging_dir/deploy-state"
    cp -a "$DEPLOY_STATE_DIR/." "$staging_dir/deploy-state/"
    echo "[backup-runtime] Deploy state copied: $DEPLOY_STATE_DIR"
else
    echo "[backup-runtime] Deploy state directory not found, skipping: $DEPLOY_STATE_DIR"
fi

tar -czf "$archive_path" -C "$staging_dir" .
write_checksum "$archive_path"
rm -rf "$staging_dir"
prune_old_backups

echo "[backup-runtime] archive: $archive_path"
echo "[backup-runtime] checksum: $archive_path.sha256"
echo "[backup-runtime] passed"
