#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)}"
cd "$REPO_ROOT"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[test-server-ci-gate] Missing command: $1" >&2
        exit 1
    fi
}

require_command node
require_command npm
require_command git

if [ -n "${REPO_GIT_DIR:-}" ]; then
    export GIT_DIR="$REPO_GIT_DIR"
    export GIT_WORK_TREE="$REPO_ROOT"
fi

echo "[test-server-ci-gate] repo: $REPO_ROOT"
echo "[test-server-ci-gate] commit: $(git rev-parse --short HEAD)"

export CI="${CI:-1}"
export NODE_ENV="${WXGAME_GATE_NODE_ENV:-test}"
export CONFIG_RELEASE_GATE="${WXGAME_GATE_CONFIG_RELEASE_GATE:-warn}"
unset APP_VERSION
unset GAME_VERSION
unset WXGAME_DEPLOY_MANIFEST_PATH
unset WXGAME_DEPLOY_STATE_DIR

echo "[test-server-ci-gate] install root tooling dependencies"
npm ci --include=dev --ignore-scripts --no-audit --no-fund

echo "[test-server-ci-gate] run ESLint"
npm run lint

echo "[test-server-ci-gate] run Prettier check"
npm run format:check

echo "[test-server-ci-gate] check ESLint suppressions budget"
mkdir -p tmp
npm run lint:baseline:ci
if git cat-file -e main:eslint-suppressions.json 2>/dev/null; then
    git show main:eslint-suppressions.json > tmp/eslint-suppressions.base.json
else
    cp eslint-suppressions.json tmp/eslint-suppressions.base.json
fi
npm run lint:baseline:check -- --base tmp/eslint-suppressions.base.json

echo "[test-server-ci-gate] install backend dependencies"
npm ci --prefix backend --include=dev --no-audit --no-fund

echo "[test-server-ci-gate] run node tests"
npm test

echo "[test-server-ci-gate] run architecture checks"
npm run test:architecture

echo "[test-server-ci-gate] check backend syntax"
npm run check --prefix backend

echo "[test-server-ci-gate] passed"
