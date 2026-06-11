#!/bin/bash
# 文明火种 - 部署脚本
# 位置：仓库根目录 deploy.sh
# 用法：在服务器上执行 ./deploy.sh [branch]

set -euo pipefail

WORK_TREE="${WORK_TREE:-/www/wwwroot/h5}"
FRONTEND_PUBLIC_DIR="${FRONTEND_PUBLIC_DIR:-${WEB_ROOT:-$WORK_TREE}}"
BACKEND_DIR="/opt/wxgame-workspace/backend"
SHARED_LINK="/opt/wxgame-workspace/shared"
BRANCH="${1:-main}"
PM2_APP_NAME="server"
WORLD_WORKER_PM2_NAME="${WORLD_WORKER_PM2_NAME:-wxgame-world-worker}"
OPS_AGENT_PM2_NAME="${OPS_AGENT_PM2_NAME:-wxgame-ops-agent}"
API_PORT="${PORT:-3000}"
ALLOWED_WORK_TREE="/www/wwwroot/h5"
ALLOWED_FRONTEND_PUBLIC_DIR="/www/wwwroot/h5"
DEFAULT_REPO_GIT_DIR="/home/git/wxgame.git"
COCOS_PROJECT_ROOT="/www/wwwroot/civilization-fire-next"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-workspace/.wxgame}"

normalize_configured_path() {
    local input_path="$1"
    while [ "$input_path" != "/" ] && [ "${input_path%/}" != "$input_path" ]; do
        input_path="${input_path%/}"
    done
    printf '%s' "$input_path"
}

WORK_TREE="$(normalize_configured_path "$WORK_TREE")"
FRONTEND_PUBLIC_DIR="$(normalize_configured_path "$FRONTEND_PUBLIC_DIR")"
BACKEND_DIR="$(normalize_configured_path "$BACKEND_DIR")"
SHARED_LINK="$(normalize_configured_path "$SHARED_LINK")"
DEPLOY_STATE_DIR="$(normalize_configured_path "$DEPLOY_STATE_DIR")"

assert_not_under_path() {
    local label="$1"
    local path_value
    local forbidden_root

    path_value="$(normalize_configured_path "$2")"
    forbidden_root="$(normalize_configured_path "$3")"

    if [ "$path_value" = "$forbidden_root" ] || [[ "$path_value" == "$forbidden_root/"* ]]; then
        echo "[Deploy] Refusing to use $label=$path_value because it is inside protected path $forbidden_root" >&2
        exit 1
    fi
}

assert_safe_deploy_paths() {
    assert_not_under_path "WORK_TREE" "$WORK_TREE" "$COCOS_PROJECT_ROOT"
    assert_not_under_path "FRONTEND_PUBLIC_DIR" "$FRONTEND_PUBLIC_DIR" "$COCOS_PROJECT_ROOT"
    assert_not_under_path "BACKEND_DIR" "$BACKEND_DIR" "$COCOS_PROJECT_ROOT"
    assert_not_under_path "SHARED_LINK" "$SHARED_LINK" "$COCOS_PROJECT_ROOT"
    assert_not_under_path "DEPLOY_STATE_DIR" "$DEPLOY_STATE_DIR" "$COCOS_PROJECT_ROOT"

    if [ "${ALLOW_WXGAME_DEPLOY_PATH_OVERRIDE:-0}" != "1" ]; then
        if [ "$WORK_TREE" != "$ALLOWED_WORK_TREE" ]; then
            echo "[Deploy] Refusing WORK_TREE=$WORK_TREE. Expected $ALLOWED_WORK_TREE." >&2
            echo "[Deploy] Set ALLOW_WXGAME_DEPLOY_PATH_OVERRIDE=1 only for an intentional wxgame path migration." >&2
            exit 1
        fi
        if [ "$FRONTEND_PUBLIC_DIR" != "$ALLOWED_FRONTEND_PUBLIC_DIR" ]; then
            echo "[Deploy] Refusing FRONTEND_PUBLIC_DIR=$FRONTEND_PUBLIC_DIR. Expected $ALLOWED_FRONTEND_PUBLIC_DIR." >&2
            echo "[Deploy] This protects the separate Cocos deployment from accidental rsync --delete." >&2
            exit 1
        fi
    fi
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[Deploy] 缺少命令: $1" >&2
        exit 1
    fi
}

sanitize_git_env() {
    unset GIT_DIR
    unset GIT_WORK_TREE
    unset GIT_INDEX_FILE
    unset GIT_PREFIX
    unset GIT_OBJECT_DIRECTORY
    unset GIT_ALTERNATE_OBJECT_DIRECTORIES
    unset GIT_COMMON_DIR
    unset GIT_IMPLICIT_WORK_TREE
    unset GIT_NAMESPACE
}

normalize_path() {
    local input_path="$1"
    if [ -z "$input_path" ]; then
        return 1
    fi
    (cd "$input_path" 2>/dev/null && pwd -P)
}

resolve_git_dir() {
    if [ -n "${REPO_GIT_DIR:-}" ]; then
        normalize_path "$REPO_GIT_DIR"
        return
    fi
    if [ -d "$DEFAULT_REPO_GIT_DIR" ]; then
        normalize_path "$DEFAULT_REPO_GIT_DIR"
        return
    fi
    if [ -d "$WORK_TREE/.git" ]; then
        if [ "${ALLOW_WORK_TREE_GIT_DEPLOY:-0}" != "1" ]; then
            echo "[Deploy] Refusing to deploy from $WORK_TREE/.git. Set REPO_GIT_DIR=$DEFAULT_REPO_GIT_DIR or ALLOW_WORK_TREE_GIT_DEPLOY=1 intentionally." >&2
            return 1
        fi
        normalize_path "$WORK_TREE/.git"
        return
    fi
    if git -C "$WORK_TREE" rev-parse --absolute-git-dir >/dev/null 2>&1; then
        git -C "$WORK_TREE" rev-parse --absolute-git-dir
        return
    fi
    if git rev-parse --absolute-git-dir >/dev/null 2>&1; then
        git rev-parse --absolute-git-dir
        return
    fi
    return 1
}

git_repo() {
    git --git-dir="$GIT_DIR_PATH" --work-tree="$WORK_TREE" "$@"
}

resolve_deploy_commit() {
    git_repo rev-parse --verify "$BRANCH^{commit}"
}

write_deploy_version() {
    local deployed_commit
    local deployed_at
    local deploy_manifest
    local current_deploy_path
    local deploy_log_path

    deployed_commit="$(git_repo rev-parse HEAD)"
    deployed_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    mkdir -p "$DEPLOY_STATE_DIR"
    deploy_manifest="$(mktemp)"
    node -e "const fs=require('fs'); const data={branch:process.argv[1],commit:process.argv[2],deployedAt:process.argv[3],workTree:process.argv[4],frontendPublicDir:process.argv[5]}; fs.writeFileSync(process.argv[6], JSON.stringify(data, null, 2) + '\n');" \
        "$BRANCH" "$deployed_commit" "$deployed_at" "$WORK_TREE" "$FRONTEND_PUBLIC_DIR" "$deploy_manifest"
    cp "$deploy_manifest" "$FRONTEND_PUBLIC_DIR/.wxgame-deploy-version.json"
    current_deploy_path="$DEPLOY_STATE_DIR/current-deploy.json"
    deploy_log_path="$DEPLOY_STATE_DIR/deploy.log"
    cp "$deploy_manifest" "$current_deploy_path"
    rm -f "$deploy_manifest"
    printf '%s branch=%s commit=%s workTree=%s frontendPublicDir=%s\n' \
        "$deployed_at" "$BRANCH" "$deployed_commit" "$WORK_TREE" "$FRONTEND_PUBLIC_DIR" >> "$deploy_log_path"
    export WXGAME_DEPLOY_MANIFEST_PATH="$current_deploy_path"
    echo "[Deploy] 部署状态文件: $current_deploy_path"
    echo "[Deploy] 部署日志: $deploy_log_path"
}

read_config_version() {
    local config_path="$1"
    node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(String(data.version || 'unknown'));" "$config_path"
}

ensure_shared_link() {
    local expected_shared
    local resolved_shared

    mkdir -p "$(dirname "$SHARED_LINK")"
    expected_shared="$(readlink -f "$WORK_TREE/shared")"
    resolved_shared="$(readlink -f "$SHARED_LINK" 2>/dev/null || true)"

    if [ "$resolved_shared" = "$expected_shared" ]; then
        echo "[Deploy] shared 链接已正确，复用: $SHARED_LINK"
        return
    fi

    if ln -sfn "$WORK_TREE/shared" "$SHARED_LINK"; then
        return
    fi

    resolved_shared="$(readlink -f "$SHARED_LINK" 2>/dev/null || true)"
    if [ "$resolved_shared" = "$expected_shared" ]; then
        echo "[Deploy] shared 链接可用，跳过重建: $SHARED_LINK"
        return
    fi

    echo "[Deploy] 无法创建 shared 链接: $SHARED_LINK" >&2
    exit 1
}

verify_shared_sync() {
    local work_tree_config="$WORK_TREE/shared/buildingConfig.json"
    local shared_config="$SHARED_LINK/buildingConfig.json"
    local resolved_shared

    if [ ! -f "$work_tree_config" ]; then
        echo "[Deploy] 缺少配置文件: $work_tree_config" >&2
        exit 1
    fi
    if [ ! -L "$SHARED_LINK" ]; then
        echo "[Deploy] shared 链接不存在或不是符号链接: $SHARED_LINK" >&2
        exit 1
    fi
    if [ ! -f "$shared_config" ]; then
        echo "[Deploy] shared 配置文件不存在: $shared_config" >&2
        exit 1
    fi

    resolved_shared="$(readlink -f "$SHARED_LINK")"
    if [ "$resolved_shared" != "$(readlink -f "$WORK_TREE/shared")" ]; then
        echo "[Deploy] shared 链接目标不正确: $resolved_shared" >&2
        exit 1
    fi
    if ! cmp -s "$work_tree_config" "$shared_config"; then
        echo "[Deploy] shared/buildingConfig.json 内容不一致" >&2
        exit 1
    fi

    echo "[Deploy] shared 配置版本: $(read_config_version "$work_tree_config")"
}

verify_runtime_config() {
    local health_payload="$1"
    local expected_version
    local runtime_version

    expected_version="$(read_config_version "$WORK_TREE/shared/buildingConfig.json")"
    runtime_version="$(printf '%s' "$health_payload" | node -e "let input=''; process.stdin.on('data', (chunk) => input += chunk); process.stdin.on('end', () => { const data = JSON.parse(input || '{}'); process.stdout.write(String(data.buildingConfigVersion || 'unknown')); });")"

    if [ "$runtime_version" != "$expected_version" ]; then
        echo "[Deploy] 运行时配置版本不匹配: expected=$expected_version actual=$runtime_version" >&2
        exit 1
    fi

    echo "[Deploy] 运行时配置版本已确认: $runtime_version"
}

read_pm2_process() {
    local app_name="$1"
    pm2 jlist | node -e "const name=process.argv[1]; let input=''; process.stdin.on('data', (chunk) => input += chunk); process.stdin.on('end', () => { const list = JSON.parse(input || '[]'); const proc = list.find((item) => item && item.name === name); if (!proc) process.exit(2); const env = proc.pm2_env || {}; process.stdout.write([env.status || '', proc.pid || 0, env.pm_cwd || '', env.pm_exec_path || ''].join('\t')); });" "$app_name"
}

get_listener_pids() {
    ss -ltnp 2>/dev/null \
        | awk -v port=":${API_PORT}" '$4 ~ port "$" { print }' \
        | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' \
        | sort -u
}

verify_pm2_listener() {
    local app_name="${1:-$PM2_APP_NAME}"
    local require_listener="${2:-1}"
    local attempt
    local snapshot
    local status
    local pm2_pid
    local pm2_cwd
    local pm2_exec
    local listener_pids

    for attempt in 1 2 3 4 5 6 7 8 9 10; do
        snapshot="$(read_pm2_process "$app_name" 2>/dev/null || true)"
        status="$(printf '%s' "$snapshot" | awk -F '\t' '{print $1}')"
        pm2_pid="$(printf '%s' "$snapshot" | awk -F '\t' '{print $2}')"
        pm2_cwd="$(printf '%s' "$snapshot" | awk -F '\t' '{print $3}')"
        pm2_exec="$(printf '%s' "$snapshot" | awk -F '\t' '{print $4}')"
        listener_pids="$(get_listener_pids || true)"

        if [ "$status" = "online" ] \
            && [ -n "$pm2_pid" ] \
            && [ "$pm2_pid" != "0" ] \
            && { [ "$require_listener" != "1" ] || printf '%s\n' "$listener_pids" | grep -qx "$pm2_pid"; }; then
            if [ "$require_listener" = "1" ]; then
                echo "[Deploy] PM2 listener confirmed: app=$app_name pid=$pm2_pid port=$API_PORT cwd=$pm2_cwd script=$pm2_exec"
            else
                echo "[Deploy] PM2 process confirmed: app=$app_name pid=$pm2_pid cwd=$pm2_cwd script=$pm2_exec"
            fi
            return 0
        fi
        sleep 1
    done

    echo "[Deploy] PM2 verification failed: app=$app_name status=${status:-unknown} pm2_pid=${pm2_pid:-none} listener_pids=${listener_pids:-none}" >&2
    echo "[Deploy] Another PM2 user or stale process may own port $API_PORT." >&2
    pm2 show "$app_name" >&2 || true
    ss -ltnp >&2 || true
    exit 1
}

restart_ops_agent_if_configured() {
    if pm2 describe "$OPS_AGENT_PM2_NAME" >/dev/null 2>&1; then
        echo "[Deploy] Restarting existing ops-agent: $OPS_AGENT_PM2_NAME"
        OPS_AGENT_PM2_NAME="$OPS_AGENT_PM2_NAME" \
            OPS_AGENT_PM2_APP="$PM2_APP_NAME" \
            BACKEND_DIR="$BACKEND_DIR" \
            DEPLOY_STATE_DIR="$DEPLOY_STATE_DIR" \
            START_PM2=1 \
            bash "$WORK_TREE/scripts/install-ops-agent-pm2.sh"
        return
    fi

    if [ "${ENABLE_OPS_AGENT:-0}" = "1" ]; then
        echo "[Deploy] ENABLE_OPS_AGENT=1; installing ops-agent: $OPS_AGENT_PM2_NAME"
        OPS_AGENT_PM2_NAME="$OPS_AGENT_PM2_NAME" \
            OPS_AGENT_PM2_APP="$PM2_APP_NAME" \
            BACKEND_DIR="$BACKEND_DIR" \
            DEPLOY_STATE_DIR="$DEPLOY_STATE_DIR" \
            START_PM2=1 \
            bash "$WORK_TREE/scripts/install-ops-agent-pm2.sh"
    else
        echo "[Deploy] ops-agent PM2 app not installed; set ENABLE_OPS_AGENT=1 or run scripts/install-ops-agent-pm2.sh on the host."
    fi
}

publish_frontend_assets() {
    local frontend_source="$WORK_TREE/frontend"
    local resolved_source
    local resolved_public
    local resolved_work_tree

    if [ ! -d "$frontend_source" ]; then
        echo "[Deploy] 缺少前端目录: $frontend_source" >&2
        exit 1
    fi

    mkdir -p "$FRONTEND_PUBLIC_DIR"
    resolved_source="$(readlink -f "$frontend_source")"
    resolved_public="$(readlink -f "$FRONTEND_PUBLIC_DIR")"
    resolved_work_tree="$(readlink -f "$WORK_TREE")"

    if [ "$resolved_source" = "$resolved_public" ]; then
        echo "[Deploy] 前端目录已作为网站根目录: $FRONTEND_PUBLIC_DIR"
    elif [ "$resolved_public" = "$resolved_work_tree" ]; then
        echo "[Deploy] 发布 frontend/ 到仓库工作目录根: $FRONTEND_PUBLIC_DIR"
        rsync -a "$frontend_source/" "$FRONTEND_PUBLIC_DIR/"
    else
        echo "[Deploy] 发布 frontend/ 到网站根目录: $FRONTEND_PUBLIC_DIR"
        rsync -a --delete "$frontend_source/" "$FRONTEND_PUBLIC_DIR/"
    fi

    for required_file in index.html style.css app.js js/config/GameConfig.js js/state/GameStateManager.js; do
        if [ ! -f "$FRONTEND_PUBLIC_DIR/$required_file" ]; then
            echo "[Deploy] 前端发布校验失败，缺少: $FRONTEND_PUBLIC_DIR/$required_file" >&2
            exit 1
        fi
    done
}

echo "[Deploy] 开始部署..."

sanitize_git_env
assert_safe_deploy_paths

require_command git
require_command node
require_command npm
require_command pm2
require_command rsync
require_command curl
require_command ss

mkdir -p "$WORK_TREE"
GIT_DIR_PATH="$(resolve_git_dir)" || {
    echo "[Deploy] 未找到 Git 仓库，请设置 REPO_GIT_DIR 或确保 $WORK_TREE/.git 存在" >&2
    exit 1
}
IS_BARE_REPO="$(git --git-dir="$GIT_DIR_PATH" rev-parse --is-bare-repository)"

echo "[Deploy] 使用工作目录: $WORK_TREE"
echo "[Deploy] 使用前端网站目录: $FRONTEND_PUBLIC_DIR"
echo "[Deploy] 使用 Git 目录: $GIT_DIR_PATH"
echo "[Deploy] 使用部署状态目录: $DEPLOY_STATE_DIR"

if [ "$IS_BARE_REPO" = "true" ]; then
    echo "[Deploy] 检测到 bare repo，直接检出 ref $BRANCH ..."
    if ! DEPLOY_COMMIT="$(resolve_deploy_commit 2>/dev/null)"; then
        echo "[Deploy] bare repo 中不存在可部署 ref/commit: $BRANCH" >&2
        exit 1
    fi
    git_repo checkout -f "$DEPLOY_COMMIT"
    git_repo clean -fd
else
    echo "[Deploy] 检测到普通仓库，强制对齐到 ref $BRANCH ..."
    if git_repo fetch origin "$BRANCH" >/dev/null 2>&1 \
        && DEPLOY_COMMIT="$(git_repo rev-parse --verify "origin/$BRANCH^{commit}" 2>/dev/null)"; then
        git_repo reset --hard "$DEPLOY_COMMIT"
    elif DEPLOY_COMMIT="$(resolve_deploy_commit 2>/dev/null)"; then
        echo "[Deploy] 使用本地可解析 ref/commit: $BRANCH"
        git_repo checkout -f "$DEPLOY_COMMIT"
    else
        echo "[Deploy] 无法解析可部署 ref/commit: $BRANCH" >&2
        exit 1
    fi
    git_repo clean -fd
fi

if [ "${SKIP_DEPLOY_GATE:-0}" != "1" ]; then
    echo "[Deploy] Running pre-deploy architecture gate..."
    REPO_GIT_DIR="$GIT_DIR_PATH" bash "$WORK_TREE/scripts/pre-deploy-gate.sh" "$WORK_TREE"
else
    echo "[Deploy] SKIP_DEPLOY_GATE=1 set; skipping pre-deploy architecture gate."
fi

echo "[Deploy] 发布前端静态文件..."
publish_frontend_assets
write_deploy_version

echo "[Deploy] 同步 shared/ 目录..."
ensure_shared_link
verify_shared_sync

echo "[Deploy] 同步 backend/ 到运行目录..."
mkdir -p "$BACKEND_DIR"
rsync -a --delete \
    --exclude '.env' \
    --exclude '.env.*' \
    --exclude 'node_modules' \
    --exclude 'logs' \
    --exclude '*.db' \
    --exclude '*.db-shm' \
    --exclude '*.db-wal' \
    --exclude '*.bak' \
    --exclude '*.bak.*' \
    --exclude '*.backup' \
    --exclude '*.backup.*' \
    --exclude '*.pre-tick' \
    "$WORK_TREE/backend/" "$BACKEND_DIR/"

echo "[Deploy] 安装后端依赖..."
cd "$BACKEND_DIR"
npm install --omit=dev --no-audit --no-fund

echo "[Deploy] 重启 PM2 服务..."
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP_NAME" --update-env
else
    pm2 start server.js --name "$PM2_APP_NAME" --update-env
fi
if pm2 describe "$WORLD_WORKER_PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$WORLD_WORKER_PM2_NAME" --update-env
else
    pm2 start world-worker.js --name "$WORLD_WORKER_PM2_NAME" --update-env
fi
verify_pm2_listener "$PM2_APP_NAME" 1
verify_pm2_listener "$WORLD_WORKER_PM2_NAME" 0
restart_ops_agent_if_configured

echo "[Deploy] 校验健康接口..."
for attempt in 1 2 3 4 5; do
    if health_payload="$(curl -fsS "http://localhost:${API_PORT}/api/health")"; then
        verify_runtime_config "$health_payload"
        printf '%s\n' "$health_payload"
        echo
        echo "[Deploy] 部署完成"
        echo "[Deploy] 前端静态目录: $FRONTEND_PUBLIC_DIR"
        echo "[Deploy] API: http://47.116.32.216:${API_PORT}/api/health"
        exit 0
    fi
    sleep 2
done

echo "[Deploy] 健康检查失败，最近的 PM2 状态如下:" >&2
pm2 show "$PM2_APP_NAME" >&2 || true
exit 1
