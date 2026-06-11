#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    echo "Usage: bash scripts/rollback-deploy.sh <branch|tag|commit>"
    echo
    echo "Environment:"
    echo "  REPO_GIT_DIR=/home/git/wxgame.git"
    echo "  WORK_TREE=/www/wwwroot/h5"
    echo "  DEPLOY_STATE_DIR=/opt/wxgame-workspace/.wxgame"
    echo "  WXGAME_ROLLBACK_RUN_GATE=1  # run pre-deploy gate during rollback"
    exit 2
fi

TARGET_REF="$1"
REPO_GIT_DIR="${REPO_GIT_DIR:-/home/git/wxgame.git}"
WORK_TREE="${WORK_TREE:-/www/wwwroot/h5}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-workspace/.wxgame}"
DEPLOY_SCRIPT="${DEPLOY_SCRIPT:-$WORK_TREE/deploy.sh}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[rollback-deploy] Missing command: $1" >&2
        exit 1
    fi
}

require_command git
require_command bash

if [ ! -d "$REPO_GIT_DIR" ]; then
    echo "[rollback-deploy] Missing repo git dir: $REPO_GIT_DIR" >&2
    exit 1
fi

if [ ! -f "$DEPLOY_SCRIPT" ]; then
    echo "[rollback-deploy] Missing deploy script: $DEPLOY_SCRIPT" >&2
    exit 1
fi

TARGET_COMMIT="$(git --git-dir="$REPO_GIT_DIR" rev-parse --verify "$TARGET_REF^{commit}")" || {
    echo "[rollback-deploy] Cannot resolve rollback target: $TARGET_REF" >&2
    exit 1
}

if [ "${WXGAME_ROLLBACK_RUN_GATE:-0}" = "1" ]; then
    export SKIP_DEPLOY_GATE="${SKIP_DEPLOY_GATE:-0}"
else
    export SKIP_DEPLOY_GATE="${SKIP_DEPLOY_GATE:-1}"
fi

export REPO_GIT_DIR
export WORK_TREE
export DEPLOY_STATE_DIR

echo "[rollback-deploy] target ref: $TARGET_REF"
echo "[rollback-deploy] target commit: $TARGET_COMMIT"
echo "[rollback-deploy] work tree: $WORK_TREE"
echo "[rollback-deploy] deploy gate skipped: $SKIP_DEPLOY_GATE"

bash "$DEPLOY_SCRIPT" "$TARGET_COMMIT"

mkdir -p "$DEPLOY_STATE_DIR"
printf '%s rollback targetRef=%s targetCommit=%s skipDeployGate=%s\n' \
    "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$TARGET_REF" "$TARGET_COMMIT" "$SKIP_DEPLOY_GATE" \
    >> "$DEPLOY_STATE_DIR/deploy.log"

echo "[rollback-deploy] completed"
