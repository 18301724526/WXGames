#!/usr/bin/env bash
set -euo pipefail

WORK_TREE="${WORK_TREE:-/www/wwwroot/h5}"
BACKEND_DIR="${BACKEND_DIR:-/opt/wxgame-workspace/backend}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-workspace/.wxgame}"
REPO_GIT_DIR="${REPO_GIT_DIR:-/home/git/wxgame.git}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$DEPLOY_STATE_DIR/security}"
PM2_APP_NAME="${PM2_APP_NAME:-server}"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"
ROTATION_ID="${ROTATION_ID:-$(date -u +"%Y%m%dT%H%M%SZ")}"
SESSION_VERSION="${OPS_SESSION_VERSION:-$ROTATION_ID}"
SERVER_ACCESS_OWNER="${SERVER_ACCESS_OWNER:-${WXGAME_SERVER_ACCESS_OWNER:-}}"
DEPLOY_CREDENTIAL_OWNER="${DEPLOY_CREDENTIAL_OWNER:-${WXGAME_DEPLOY_CREDENTIAL_OWNER:-}}"
RESTART_PM2="${RESTART_PM2:-0}"
ROTATION_CONFIRM="${ROTATION_CONFIRM:-}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[rotate-production-secrets] Missing command: $1" >&2
        exit 1
    fi
}

require_file() {
    if [ ! -f "$1" ]; then
        echo "[rotate-production-secrets] Missing file: $1" >&2
        exit 1
    fi
}

upsert_env_value() {
    local key="$1"
    local value="$2"
    local file="$3"
    WXGAME_ENV_KEY="$key" WXGAME_ENV_VALUE="$value" WXGAME_ENV_FILE="$file" node <<'NODE'
const fs = require('fs');
const key = process.env.WXGAME_ENV_KEY;
const value = process.env.WXGAME_ENV_VALUE;
const file = process.env.WXGAME_ENV_FILE;
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
  throw new Error(`Invalid env key: ${key}`);
}
if (/[\r\n]/u.test(value) || /[\s#'"`]/u.test(value)) {
  throw new Error(`${key} contains characters that are unsafe for this dotenv updater. Use base64url/hex secrets or a bcrypt hash without spaces/quotes.`);
}
const text = fs.readFileSync(file, 'utf8');
const prefix = `${key}=`;
let found = false;
const lines = text.split(/\r?\n/).map((line) => {
  if (line.startsWith(prefix)) {
    found = true;
    return `${prefix}${value}`;
  }
  return line;
});
if (!found) {
  if (lines.length && lines[lines.length - 1] !== '') lines.push('');
  lines.push(`${prefix}${value}`);
}
fs.writeFileSync(file, `${lines.join('\n').replace(/\n*$/u, '')}\n`, { mode: 0o600 });
NODE
    chmod 600 "$file"
}

print_usage() {
    cat <<'USAGE'
Usage:
  ROTATION_CONFIRM=rotate-production-secrets \
  WXGAME_SERVER_ACCESS_OWNER=<owner> \
  WXGAME_DEPLOY_CREDENTIAL_OWNER=<owner> \
  JWT_SECRET=<new player secret> \
  OPS_JWT_SECRET=<new ops secret> \
  OPS_ADMIN_PASSWORD_HASH=<bcrypt hash> \
  bash scripts/rotate-production-secrets.sh

Optional:
  ENV_FILE=/opt/wxgame-workspace/backend/.env
  ROTATION_ID=20260612T010000Z-security-rotation
  OPS_SESSION_VERSION=20260612T010000Z-security-rotation
  RESTART_PM2=1
USAGE
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    print_usage
    exit 0
fi

if [ "$ROTATION_CONFIRM" != "rotate-production-secrets" ]; then
    echo "[rotate-production-secrets] Refusing to run without ROTATION_CONFIRM=rotate-production-secrets" >&2
    print_usage >&2
    exit 1
fi

require_command node
require_file "$ENV_FILE"
require_file "$WORK_TREE/scripts/verify-production-security-config.js"

if [ -z "${JWT_SECRET:-}" ] || [ -z "${OPS_JWT_SECRET:-}" ] || [ -z "${OPS_ADMIN_PASSWORD_HASH:-}" ]; then
    echo "[rotate-production-secrets] JWT_SECRET, OPS_JWT_SECRET, and OPS_ADMIN_PASSWORD_HASH must be supplied through environment variables." >&2
    exit 1
fi

mkdir -p "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_DIR"

upsert_env_value "JWT_SECRET" "$JWT_SECRET" "$ENV_FILE"
upsert_env_value "OPS_JWT_SECRET" "$OPS_JWT_SECRET" "$ENV_FILE"
upsert_env_value "OPS_ADMIN_PASSWORD_HASH" "$OPS_ADMIN_PASSWORD_HASH" "$ENV_FILE"
upsert_env_value "OPS_SESSION_VERSION" "$SESSION_VERSION" "$ENV_FILE"
upsert_env_value "WXGAME_SECRET_ROTATION_ID" "$ROTATION_ID" "$ENV_FILE"
upsert_env_value "WXGAME_SERVER_ACCESS_OWNER" "$SERVER_ACCESS_OWNER" "$ENV_FILE"
upsert_env_value "WXGAME_DEPLOY_CREDENTIAL_OWNER" "$DEPLOY_CREDENTIAL_OWNER" "$ENV_FILE"

evidence_path="$EVIDENCE_DIR/production-security-$ROTATION_ID.json"
REPO_GIT_DIR="$REPO_GIT_DIR" node "$WORK_TREE/scripts/verify-production-security-config.js" \
    --env-file "$ENV_FILE" \
    --evidence "$evidence_path" \
    --rotation-id "$ROTATION_ID" \
    --server-access-owner "$SERVER_ACCESS_OWNER" \
    --deploy-credential-owner "$DEPLOY_CREDENTIAL_OWNER" \
    --cwd "$WORK_TREE"

if [ "$RESTART_PM2" = "1" ]; then
    require_command pm2
    pm2 restart "$PM2_APP_NAME" --update-env
    echo "[rotate-production-secrets] PM2 restarted: $PM2_APP_NAME"
else
    echo "[rotate-production-secrets] PM2 restart skipped. Set RESTART_PM2=1 to restart after verification."
fi

echo "[rotate-production-secrets] evidence: $evidence_path"
