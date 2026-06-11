#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)}"
cd "$REPO_ROOT"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[pre-deploy-gate] Missing command: $1" >&2
        exit 1
    fi
}

require_command node
require_command npm
require_command git

echo "[pre-deploy-gate] repo: $REPO_ROOT"
echo "[pre-deploy-gate] commit: $(git rev-parse --short HEAD)"

if [ "${WXGAME_GATE_INSTALL:-0}" = "1" ]; then
    echo "[pre-deploy-gate] installing root dependencies"
    npm ci --no-audit --no-fund
    echo "[pre-deploy-gate] installing backend dependencies"
    npm ci --prefix backend --no-audit --no-fund
fi

echo "[pre-deploy-gate] running architecture gate"
npm run test:architecture

echo "[pre-deploy-gate] passed"
