#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-/opt/wxgame-test/backend}"
DB_PATH="${DB_PATH:-$BACKEND_DIR/civilization.db}"
MAIN_DB_PATH="${MAIN_DB_PATH:-/opt/wxgame-workspace/backend/civilization.db}"
MAIN_BACKEND_DIR="${MAIN_BACKEND_DIR:-/opt/wxgame-workspace/backend}"
MAIN_ENV_PATH="${MAIN_ENV_PATH:-/opt/wxgame-workspace/backend/.env}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[prepare-test-server-runtime] Missing command: $1" >&2
        exit 1
    fi
}

copy_main_database_to_test() {
    if [ ! -f "$MAIN_DB_PATH" ]; then
        echo "[prepare-test-server-runtime] Main database not found, skipping copy: $MAIN_DB_PATH"
        return
    fi

    echo "[prepare-test-server-runtime] Copying main database snapshot to test DB"
    node - "$MAIN_DB_PATH" "$DB_PATH" "$MAIN_BACKEND_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');

const [sourcePath, targetPath, mainBackendDir] = process.argv.slice(2);

function loadDatabaseConstructor() {
  try {
    return require('better-sqlite3');
  } catch (error) {
    return require(path.join(mainBackendDir, 'node_modules', 'better-sqlite3'));
  }
}

const Database = loadDatabaseConstructor();
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(`${targetPath}${suffix}`, { force: true });
}

const db = new Database(sourcePath, { readonly: true, fileMustExist: true, timeout: 60000 });
try {
  db.backup(targetPath);
} finally {
  db.close();
}

console.log(JSON.stringify({
  schema: 'wxgame-test-db-copy-v1',
  sourcePath,
  targetPath,
  copiedAt: new Date().toISOString(),
}));
NODE

    chown www:www "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null || chown www:www "$DB_PATH" 2>/dev/null || true
}

sync_main_environment_to_test() {
    if [ ! -f "$MAIN_ENV_PATH" ]; then
        echo "[prepare-test-server-runtime] Main backend .env not found, relying on inherited environment: $MAIN_ENV_PATH"
        return
    fi

    mkdir -p "$BACKEND_DIR"
    cp "$MAIN_ENV_PATH" "$BACKEND_DIR/.env"
    chmod 600 "$BACKEND_DIR/.env" 2>/dev/null || true
    chown www:www "$BACKEND_DIR/.env" 2>/dev/null || true
    echo "[prepare-test-server-runtime] Synced backend environment file to isolated test backend"
}

require_command node

copy_main_database_to_test
sync_main_environment_to_test
