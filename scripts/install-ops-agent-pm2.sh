#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-/opt/wxgame-workspace/backend}"
OPS_AGENT_PM2_NAME="${OPS_AGENT_PM2_NAME:-wxgame-ops-agent}"
OPS_AGENT_PM2_APP="${OPS_AGENT_PM2_APP:-server}"
OPS_AGENT_BIND_HOST="${OPS_AGENT_BIND_HOST:-127.0.0.1}"
OPS_AGENT_PORT="${OPS_AGENT_PORT:-3101}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-workspace/.wxgame}"
START_PM2="${START_PM2:-1}"
SAVE_PM2="${SAVE_PM2:-0}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[ops-agent-install] Missing command: $1" >&2
        exit 1
    fi
}

normalize_path() {
    local input_path="$1"
    while [ "$input_path" != "/" ] && [ "${input_path%/}" != "$input_path" ]; do
        input_path="${input_path%/}"
    done
    printf '%s' "$input_path"
}

BACKEND_DIR="$(normalize_path "$BACKEND_DIR")"
DEPLOY_STATE_DIR="$(normalize_path "$DEPLOY_STATE_DIR")"
AGENT_SCRIPT="$BACKEND_DIR/ops-agent/server.js"

require_command node
require_command pm2

if [ ! -f "$AGENT_SCRIPT" ]; then
    echo "[ops-agent-install] Missing ops-agent entrypoint: $AGENT_SCRIPT" >&2
    exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "[ops-agent-install] Warning: $BACKEND_DIR/.env not found; ops auth must be supplied by process environment." >&2
fi

echo "[ops-agent-install] backend: $BACKEND_DIR"
echo "[ops-agent-install] agent PM2 name: $OPS_AGENT_PM2_NAME"
echo "[ops-agent-install] target app: $OPS_AGENT_PM2_APP"
echo "[ops-agent-install] bind: $OPS_AGENT_BIND_HOST:$OPS_AGENT_PORT"
echo "[ops-agent-install] deploy state: $DEPLOY_STATE_DIR"

if [ "$START_PM2" != "1" ]; then
    echo "[ops-agent-install] START_PM2=$START_PM2; validation only."
    exit 0
fi

export NODE_ENV="${NODE_ENV:-production}"
export OPS_AGENT_PM2_APP
export OPS_AGENT_BIND_HOST
export OPS_AGENT_PORT
export WXGAME_DEPLOY_STATE_DIR="$DEPLOY_STATE_DIR"

if pm2 describe "$OPS_AGENT_PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$OPS_AGENT_PM2_NAME" --update-env
else
    pm2 start "$AGENT_SCRIPT" --name "$OPS_AGENT_PM2_NAME" --cwd "$BACKEND_DIR" --update-env
fi

pm2 show "$OPS_AGENT_PM2_NAME"

if [ "$SAVE_PM2" = "1" ]; then
    pm2 save
fi

cat <<EOF
[ops-agent-install] installed.
[ops-agent-install] Recommended reverse proxy:
location /ops-agent/ {
    proxy_pass http://127.0.0.1:${OPS_AGENT_PORT}/;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
}
EOF
