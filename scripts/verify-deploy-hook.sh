#!/usr/bin/env bash
set -euo pipefail

BARE_REPO_DIR="${BARE_REPO_DIR:-/home/git/wxgame.git}"
WORK_TREE="${WORK_TREE:-/www/wwwroot/h5}"
BRANCH="${BRANCH:-main}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-workspace/.wxgame}"
HOOK_PATH="${HOOK_PATH:-$BARE_REPO_DIR/hooks/post-receive}"
DEPLOY_SCRIPT="${DEPLOY_SCRIPT:-$WORK_TREE/deploy.sh}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[verify-deploy-hook] Missing command: $1" >&2
        exit 1
    fi
}

require_file() {
    if [ ! -f "$1" ]; then
        echo "[verify-deploy-hook] Missing file: $1" >&2
        exit 1
    fi
}

require_command git
require_command bash
require_command node

if [ ! -d "$BARE_REPO_DIR" ]; then
    echo "[verify-deploy-hook] Missing bare repo: $BARE_REPO_DIR" >&2
    exit 1
fi

if [ "$(git --git-dir="$BARE_REPO_DIR" rev-parse --is-bare-repository)" != "true" ]; then
    echo "[verify-deploy-hook] Not a bare repo: $BARE_REPO_DIR" >&2
    exit 1
fi

if ! git --git-dir="$BARE_REPO_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "[verify-deploy-hook] Missing branch refs/heads/$BRANCH in $BARE_REPO_DIR" >&2
    exit 1
fi

require_file "$HOOK_PATH"
require_file "$DEPLOY_SCRIPT"

if [ ! -x "$HOOK_PATH" ]; then
    echo "[verify-deploy-hook] Hook is not executable: $HOOK_PATH" >&2
    exit 1
fi

bash -n "$HOOK_PATH"

for required_text in 'deploy.sh' 'REPO_GIT_DIR' 'WORK_TREE'; do
    if ! grep -Fq "$required_text" "$HOOK_PATH"; then
        echo "[verify-deploy-hook] Hook does not contain required text: $required_text" >&2
        exit 1
    fi
done

if ! grep -Fq "$WORK_TREE" "$HOOK_PATH"; then
    echo "[verify-deploy-hook] Hook does not mention expected WORK_TREE=$WORK_TREE" >&2
    exit 1
fi

echo "[verify-deploy-hook] hook: $HOOK_PATH"
echo "[verify-deploy-hook] repo: $BARE_REPO_DIR"
echo "[verify-deploy-hook] branch: $BRANCH -> $(git --git-dir="$BARE_REPO_DIR" rev-parse "$BRANCH")"
echo "[verify-deploy-hook] work tree: $WORK_TREE"
echo "[verify-deploy-hook] deploy script: $DEPLOY_SCRIPT"

current_deploy="$DEPLOY_STATE_DIR/current-deploy.json"
if [ -f "$current_deploy" ]; then
    deployed_commit="$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(String(data.commit || ''));" "$current_deploy")"
    if [ -n "$deployed_commit" ]; then
        git --git-dir="$BARE_REPO_DIR" cat-file -e "$deployed_commit^{commit}"
        echo "[verify-deploy-hook] current deploy commit is reachable: $deployed_commit"
    fi
else
    echo "[verify-deploy-hook] current deploy manifest not found yet: $current_deploy"
fi

echo "[verify-deploy-hook] passed"
