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

WXGAME_GATE_INSTALL="${WXGAME_GATE_INSTALL:-auto}"

git_for_worktree() {
    if [ -n "${REPO_GIT_DIR:-}" ]; then
        git --git-dir="$REPO_GIT_DIR" --work-tree="$REPO_ROOT" "$@"
        return
    fi
    git "$@"
}

lock_hash() {
    node -e "const crypto=require('crypto'); const fs=require('fs'); process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'));" "$1"
}

dependency_tree_ready() {
    local work_dir="$1"
    local lock_file="$2"
    local marker_file="$3"
    local require_check="$4"
    local expected_hash
    local actual_hash

    if [ ! -f "$lock_file" ] || [ ! -d "$work_dir/node_modules" ] || [ ! -f "$marker_file" ]; then
        return 1
    fi

    expected_hash="$(lock_hash "$lock_file")"
    actual_hash="$(cat "$marker_file" 2>/dev/null || true)"
    if [ "$actual_hash" != "$expected_hash" ]; then
        return 1
    fi

    (cd "$work_dir" && node -e "$require_check" >/dev/null)
}

install_dependency_tree() {
    local label="$1"
    local work_dir="$2"
    local lock_file="$3"
    local marker_file="$4"

    echo "[pre-deploy-gate] installing $label dependencies"
    if [ "$work_dir" = "." ]; then
        npm ci --no-audit --no-fund
    else
        npm ci --prefix "$work_dir" --no-audit --no-fund
    fi
    mkdir -p "$(dirname "$marker_file")"
    lock_hash "$lock_file" > "$marker_file"
}

ensure_dependency_tree() {
    local label="$1"
    local work_dir="$2"
    local lock_file="$3"
    local marker_file="$4"
    local require_check="$5"

    case "$WXGAME_GATE_INSTALL" in
        0|false|never)
            echo "[pre-deploy-gate] dependency install disabled for $label"
            return
            ;;
        1|true|always)
            install_dependency_tree "$label" "$work_dir" "$lock_file" "$marker_file"
            return
            ;;
        auto|"")
            if dependency_tree_ready "$work_dir" "$lock_file" "$marker_file" "$require_check"; then
                echo "[pre-deploy-gate] reusing $label dependencies"
            else
                install_dependency_tree "$label" "$work_dir" "$lock_file" "$marker_file"
            fi
            return
            ;;
        *)
            echo "[pre-deploy-gate] Invalid WXGAME_GATE_INSTALL=$WXGAME_GATE_INSTALL; expected auto, always, or never" >&2
            exit 1
            ;;
    esac
}

echo "[pre-deploy-gate] repo: $REPO_ROOT"
echo "[pre-deploy-gate] commit: $(git_for_worktree rev-parse --short HEAD)"

ensure_dependency_tree "root" "." "package-lock.json" "node_modules/.wxgame-lock-sha256" "require('playwright'); require('pngjs');"
ensure_dependency_tree "backend" "backend" "backend/package-lock.json" "backend/node_modules/.wxgame-lock-sha256" "require('xlsx'); require('better-sqlite3');"

echo "[pre-deploy-gate] running architecture gate"
npm run test:architecture

echo "[pre-deploy-gate] passed"
