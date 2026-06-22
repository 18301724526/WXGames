#!/usr/bin/env bash
set -euo pipefail

TEST_BRANCH="${1:-${TEST_BRANCH:-codex/battle-core-test-server}}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

export DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:-test}"
export WORK_TREE="${WORK_TREE:-/www/wwwroot/h5-test-worktree}"
export FRONTEND_PUBLIC_DIR="${FRONTEND_PUBLIC_DIR:-/www/wwwroot/h5-test}"
export BACKEND_DIR="${BACKEND_DIR:-/opt/wxgame-test/backend}"
export SHARED_LINK="${SHARED_LINK:-/opt/wxgame-test/shared}"
export DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-test/.wxgame}"
export DB_PATH="${DB_PATH:-$BACKEND_DIR/civilization.db}"
export MAIN_DB_PATH="${MAIN_DB_PATH:-/opt/wxgame-workspace/backend/civilization.db}"
export MAIN_BACKEND_DIR="${MAIN_BACKEND_DIR:-/opt/wxgame-workspace/backend}"
export MAIN_ENV_PATH="${MAIN_ENV_PATH:-/opt/wxgame-workspace/backend/.env}"
export PORT="${PORT:-3002}"
export PM2_APP_NAME="${PM2_APP_NAME:-wxgame-test-server}"
export WORLD_WORKER_PM2_NAME="${WORLD_WORKER_PM2_NAME:-wxgame-test-world-worker}"
export OPS_AGENT_PM2_NAME="${OPS_AGENT_PM2_NAME:-wxgame-test-ops-agent}"
export DEPLOY_GATE_SCRIPT="${DEPLOY_GATE_SCRIPT:-scripts/test-server-ci-gate.sh}"
export POST_BACKEND_SYNC_SCRIPT="${POST_BACKEND_SYNC_SCRIPT:-scripts/prepare-test-server-runtime.sh}"
export FRONTEND_API_BASE="${FRONTEND_API_BASE:-/wxgame-test-api}"
export FRONTEND_ENVIRONMENT_LABEL="${FRONTEND_ENVIRONMENT_LABEL:-TEST SERVER}"
export APP_VERSION="${APP_VERSION:-0.2.1-test}"
export GAME_VERSION="${GAME_VERSION:-0.2.1-test}"
export ALLOW_WXGAME_DEPLOY_PATH_OVERRIDE=1
export NODE_ENV="${NODE_ENV:-production}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://47.116.32.216,https://47.116.32.216}"
export WXGAME_DEPLOY_STATE_DIR="$DEPLOY_STATE_DIR"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[deploy-test-server] Missing command: $1" >&2
        exit 1
    fi
}

require_command node
require_command npm

echo "[deploy-test-server] Deploying branch $TEST_BRANCH to isolated test server"
bash "$REPO_ROOT/deploy.sh" "$TEST_BRANCH"
