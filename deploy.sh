#!/bin/bash
# 文明火种 - 部署脚本
# 位置：仓库根目录 deploy.sh
# 用法：在服务器上执行 ./deploy.sh [branch]

set -Eeuo pipefail

WORK_TREE="${WORK_TREE:-/www/wwwroot/h5}"
FRONTEND_PUBLIC_DIR="${FRONTEND_PUBLIC_DIR:-${WEB_ROOT:-$WORK_TREE}}"
BACKEND_DIR="${BACKEND_DIR:-/opt/wxgame-workspace/backend}"
SHARED_LINK="${SHARED_LINK:-/opt/wxgame-workspace/shared}"
BRANCH="${1:-main}"
PM2_APP_NAME="${PM2_APP_NAME:-server}"
WORLD_WORKER_PM2_NAME="${WORLD_WORKER_PM2_NAME:-wxgame-world-worker}"
OPS_AGENT_PM2_NAME="${OPS_AGENT_PM2_NAME:-wxgame-ops-agent}"
API_PORT="${PORT:-3000}"
ALLOWED_WORK_TREE="/www/wwwroot/h5"
ALLOWED_FRONTEND_PUBLIC_DIR="/www/wwwroot/h5"
DEFAULT_REPO_GIT_DIR="/home/git/wxgame.git"
COCOS_PROJECT_ROOT="/www/wwwroot/civilization-fire-next"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/opt/wxgame-workspace/.wxgame}"
DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:-production}"
DEPLOY_GATE_SCRIPT="${DEPLOY_GATE_SCRIPT:-scripts/pre-deploy-gate.sh}"
FRONTEND_API_BASE="${FRONTEND_API_BASE:-}"
FRONTEND_DEPLOY_STATUS_PATH="${FRONTEND_DEPLOY_STATUS_PATH:-}"
FRONTEND_ENVIRONMENT_LABEL="${FRONTEND_ENVIRONMENT_LABEL:-}"
POST_BACKEND_SYNC_SCRIPT="${POST_BACKEND_SYNC_SCRIPT:-}"
DEPLOY_STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DEPLOY_STAGE="initializing"
DEPLOY_TARGET_COMMIT=""
DEPLOY_PREVIOUS_COMMIT=""
DEPLOY_FINISHED=0
DEPLOY_ERROR_RECORDED=0

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
DEPLOY_STATUS_PATH="$DEPLOY_STATE_DIR/deploy-status.json"
DEPLOY_STATUS_PUBLIC_PATH="$FRONTEND_PUBLIC_DIR/.wxgame-deploy-status.json"
DEPLOY_LOG_PATH="$DEPLOY_STATE_DIR/deploy.log"
DEPLOY_ASYNC_LOG_PATH="${DEPLOY_ASYNC_LOG_PATH:-$DEPLOY_STATE_DIR/push-deploy.log}"

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

read_previous_deploy_commit() {
    node -e "const fs=require('fs'); const p=process.argv[1]; try { const data=JSON.parse(fs.readFileSync(p, 'utf8')); process.stdout.write(String(data.commit || data.deployedCommit || '')); } catch (_) {}" "$DEPLOY_STATE_DIR/current-deploy.json"
}

write_deploy_status() {
    local status="$1"
    local message="${2:-}"
    local exit_code="${3:-0}"
    local finished_at="${4:-}"
    local updated_at

    updated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    mkdir -p "$DEPLOY_STATE_DIR" 2>/dev/null || true
    mkdir -p "$FRONTEND_PUBLIC_DIR" 2>/dev/null || true

    if ! node - "$DEPLOY_STATUS_PATH" "$DEPLOY_STATUS_PUBLIC_PATH" \
        "$status" "$DEPLOY_ENVIRONMENT" "$BRANCH" "$DEPLOY_TARGET_COMMIT" "$DEPLOY_PREVIOUS_COMMIT" \
        "$DEPLOY_STAGE" "$DEPLOY_STARTED_AT" "$updated_at" "$finished_at" "$exit_code" "$message" \
        "$WORK_TREE" "$FRONTEND_PUBLIC_DIR" "$DEPLOY_LOG_PATH" "$DEPLOY_ASYNC_LOG_PATH" <<'NODE'
const fs = require('fs');
const path = require('path');

const [statusPath, publicPath] = process.argv.slice(2, 4);
const [
  status,
  environment,
  branch,
  targetCommit,
  previousDeployedCommit,
  stage,
  startedAt,
  updatedAt,
  finishedAt,
  exitCode,
  message,
  workTree,
  frontendPublicDir,
  deployLogPath,
  asyncLogPath,
] = process.argv.slice(4);

function text(value, limit = 240) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

function readRecentLogLines(filePath, maxLines = 120) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .replace(/\u001b\[[0-9;]*m/g, '')
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-maxLines)
      .map((line) => text(line, 500));
  } catch (_error) {
    return [];
  }
}

function writeJsonAtomic(filePath, payload) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n');
  fs.renameSync(tempPath, filePath);
}

const normalizedStatus = ['running', 'succeeded', 'failed'].includes(status) ? status : 'running';
const payload = {
  schema: 'wxgame-deploy-status-v1',
  status: normalizedStatus,
  environment: text(environment, 80),
  branch: text(branch, 160),
  targetCommit: text(targetCommit, 80) || null,
  previousDeployedCommit: text(previousDeployedCommit, 80) || null,
  stage: text(stage, 120),
  startedAt: text(startedAt, 80),
  updatedAt: text(updatedAt, 80),
  finishedAt: text(finishedAt, 80) || null,
  exitCode: Number.isFinite(Number(exitCode)) ? Number(exitCode) : null,
  workTree: text(workTree, 240),
  frontendPublicDir: text(frontendPublicDir, 240),
  logPath: text(asyncLogPath || deployLogPath, 240),
};

if (message) {
  payload.error = {
    stage: payload.stage,
    message: text(message, 600),
  };
}

if (normalizedStatus === 'failed') {
  payload.recentLogLines = readRecentLogLines(asyncLogPath || deployLogPath);
}

writeJsonAtomic(statusPath, payload);
if (publicPath && publicPath !== statusPath) writeJsonAtomic(publicPath, payload);
NODE
    then
        echo "[Deploy] Failed to write deploy status: $DEPLOY_STATUS_PATH" >&2
    fi
}

set_deploy_stage() {
    DEPLOY_STAGE="$1"
    if [ -n "${DEPLOY_TARGET_COMMIT:-}" ]; then
        write_deploy_status "running" "" "0" ""
    fi
}

record_deploy_failure() {
    local exit_code="$1"
    local message="$2"

    if [ "$DEPLOY_ERROR_RECORDED" = "1" ]; then
        return
    fi

    DEPLOY_ERROR_RECORDED=1
    write_deploy_status "failed" "$message" "$exit_code" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}

describe_deploy_command() {
    local args=()
    local arg

    for arg in "$@"; do
        args+=("$(printf '%q' "$arg")")
    done

    local IFS=" "
    printf '%s' "${args[*]}"
}

run_with_deploy_status_heartbeat() {
    local heartbeat_interval="${DEPLOY_STATUS_HEARTBEAT_SECONDS:-20}"
    local heartbeat_pid=""
    local command_status

    if [ -n "${DEPLOY_TARGET_COMMIT:-}" ] && [ "${heartbeat_interval:-0}" -gt 0 ] 2>/dev/null; then
        (
            while true; do
                sleep "$heartbeat_interval"
                write_deploy_status "running" "" "0" ""
            done
        ) &
        heartbeat_pid="$!"
    fi

    if "$@"; then
        command_status=0
    else
        command_status="$?"
    fi

    if [ -n "$heartbeat_pid" ]; then
        kill "$heartbeat_pid" >/dev/null 2>&1 || true
        wait "$heartbeat_pid" >/dev/null 2>&1 || true
    fi

    if [ "$command_status" -ne 0 ]; then
        record_deploy_failure "$command_status" "command failed: $(describe_deploy_command "$@")"
    fi

    return "$command_status"
}

deploy_exit_trap() {
    local exit_code="$?"
    if [ "$DEPLOY_FINISHED" = "1" ] || [ "$DEPLOY_ERROR_RECORDED" = "1" ] || [ "$exit_code" = "0" ]; then
        return
    fi
    record_deploy_failure "$exit_code" "deploy exited before completion"
}

deploy_error_trap() {
    local exit_code="$1"
    local failed_command="$2"
    record_deploy_failure "$exit_code" "command failed: $failed_command"
}

get_frontend_asset_version() {
    local deployed_commit
    deployed_commit="$(git_repo rev-parse HEAD)"
    printf 'deploy-%s' "${deployed_commit:0:12}"
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
    node -e "const fs=require('fs'); const data={environment:process.argv[1],branch:process.argv[2],commit:process.argv[3],deployedAt:process.argv[4],workTree:process.argv[5],frontendPublicDir:process.argv[6]}; fs.writeFileSync(process.argv[7], JSON.stringify(data, null, 2) + '\n');" \
        "$DEPLOY_ENVIRONMENT" "$BRANCH" "$deployed_commit" "$deployed_at" "$WORK_TREE" "$FRONTEND_PUBLIC_DIR" "$deploy_manifest"
    cp "$deploy_manifest" "$FRONTEND_PUBLIC_DIR/.wxgame-deploy-version.json"
    current_deploy_path="$DEPLOY_STATE_DIR/current-deploy.json"
    deploy_log_path="$DEPLOY_STATE_DIR/deploy.log"
    cp "$deploy_manifest" "$current_deploy_path"
    rm -f "$deploy_manifest"
    printf '%s environment=%s branch=%s commit=%s workTree=%s frontendPublicDir=%s\n' \
        "$deployed_at" "$DEPLOY_ENVIRONMENT" "$BRANCH" "$deployed_commit" "$WORK_TREE" "$FRONTEND_PUBLIC_DIR" >> "$deploy_log_path"
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

publish_runtime_config_release() {
    local release_source

    release_source="deploy:${DEPLOY_COMMIT:-$(git_repo rev-parse HEAD)}"
    echo "[Deploy] Publishing runtime config release: $release_source"
    WXGAME_CONFIG_RELEASE_SOURCE="$release_source" \
    node <<'NODE'
process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ quiet: true });
const ConfigReleaseService = require('./services/config/ConfigReleaseService');

const source = process.env.WXGAME_CONFIG_RELEASE_SOURCE || 'deploy';
const before = ConfigReleaseService.getRuntimeStatus({ env: process.env });
if (before.status === 'matched') {
  console.log(JSON.stringify({
    schema: 'deploy-config-release-v1',
    action: 'skip',
    status: before.status,
    activeRelease: before.activeRelease,
  }));
  process.exit(0);
}

const result = ConfigReleaseService.publishRelease(
  { source },
  {
    operator: process.env.DEPLOY_OPERATOR || 'deploy-hook',
    env: process.env,
  },
);
if (!result.success) {
  console.error(JSON.stringify({
    schema: 'deploy-config-release-v1',
    action: 'publish',
    success: false,
    before: {
      status: before.status,
      activeRelease: before.activeRelease,
      drift: before.drift,
      errors: before.errors,
      warnings: before.warnings,
    },
    errors: result.errors || [],
    warnings: result.warnings || [],
  }, null, 2));
  process.exit(1);
}

const after = ConfigReleaseService.getRuntimeStatus({ env: process.env });
if (after.status !== 'matched') {
  console.error(JSON.stringify({
    schema: 'deploy-config-release-v1',
    action: 'publish',
    success: false,
    release: result.release && {
      id: result.release.id,
      source: result.release.source,
      snapshotHash: result.release.snapshotHash,
      registryCount: result.release.registryCount,
    },
    after: {
      status: after.status,
      activeRelease: after.activeRelease,
      drift: after.drift,
      errors: after.errors,
      warnings: after.warnings,
    },
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  schema: 'deploy-config-release-v1',
  action: 'publish',
  success: true,
  release: {
    id: result.release.id,
    source: result.release.source,
    snapshotHash: result.release.snapshotHash,
    registryCount: result.release.registryCount,
  },
  activeRelease: after.activeRelease,
}, null, 2));
NODE
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

print_pm2_recent_logs() {
    local app_name="$1"
    pm2 jlist \
        | node -e "const name=process.argv[1]; let input=''; process.stdin.on('data', (chunk) => input += chunk); process.stdin.on('end', () => { const list = JSON.parse(input || '[]'); const proc = list.find((item) => item && item.name === name); const env = proc?.pm2_env || {}; [env.pm_err_log_path, env.pm_out_log_path].filter(Boolean).forEach((file) => process.stdout.write(file + '\n')); });" "$app_name" \
        | while IFS= read -r log_path; do
            echo "[Deploy] PM2 log tail: $log_path" >&2
            tail -n 80 "$log_path" >&2 || true
        done
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
    echo "[Deploy] Recent PM2 application logs: app=$app_name" >&2
    print_pm2_recent_logs "$app_name" || true
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
    local asset_version

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

    # Publish shared/ so the browser can load shared modules (e.g. battleSimCore).
    # Skipped when the work tree already IS the web root (shared/ is served in place).
    if [ "$resolved_public" != "$resolved_work_tree" ] && [ -d "$WORK_TREE/shared" ]; then
        echo "[Deploy] 发布 shared/ 到网站根目录: $FRONTEND_PUBLIC_DIR/shared"
        rsync -a "$WORK_TREE/shared/" "$FRONTEND_PUBLIC_DIR/shared/"
    fi

    for required_file in index.html style.css app.js js/config/GameConfig.js js/state/GameStateManager.js; do
        if [ ! -f "$FRONTEND_PUBLIC_DIR/$required_file" ]; then
            echo "[Deploy] 前端发布校验失败，缺少: $FRONTEND_PUBLIC_DIR/$required_file" >&2
            exit 1
        fi
    done

    asset_version="$(get_frontend_asset_version)"
    node "$WORK_TREE/scripts/rewrite-frontend-asset-version.js" \
        --frontend-dir "$FRONTEND_PUBLIC_DIR" \
        --version "$asset_version"
    node "$WORK_TREE/scripts/check-frontend-script-manifest.js" \
        --frontend-dir "$FRONTEND_PUBLIC_DIR" \
        --require-version "$asset_version"
}

apply_frontend_environment_overrides() {
    local label="$FRONTEND_ENVIRONMENT_LABEL"
    local api_base="$FRONTEND_API_BASE"
    local deploy_status_path="$FRONTEND_DEPLOY_STATUS_PATH"
    local config_file="$FRONTEND_PUBLIC_DIR/js/config/GameConfig.js"
    local index_file="$FRONTEND_PUBLIC_DIR/index.html"

    if [ -z "$label" ] && [ -z "$api_base" ] && [ -z "$deploy_status_path" ]; then
        return
    fi

    node - "$config_file" "$index_file" "$api_base" "$deploy_status_path" "$label" "$DEPLOY_ENVIRONMENT" <<'NODE'
const fs = require('fs');

const [configFile, indexFile, apiBase, deployStatusPath, label, environment] = process.argv.slice(2);

if (apiBase || deployStatusPath) {
  let config = fs.readFileSync(configFile, 'utf8');
  if (apiBase) {
    let replacements = 0;
    config = config.replace(
      /API_BASE:\s*['"][^'"]+['"],/,
      () => {
        replacements += 1;
        return `API_BASE: ${JSON.stringify(apiBase)},\n    ENVIRONMENT: { name: ${JSON.stringify(environment)}, label: ${JSON.stringify(label || environment)}, apiBase: ${JSON.stringify(apiBase)} },`;
      },
    );
    if (replacements !== 1) {
      throw new Error(`Expected to replace exactly one API_BASE in ${configFile}, replaced ${replacements}`);
    }
  }
  if (deployStatusPath) {
    let replacements = 0;
    config = config.replace(
      /DEPLOY_STATUS_PATH:\s*['"][^'"]+['"],/,
      () => {
        replacements += 1;
        return `DEPLOY_STATUS_PATH: ${JSON.stringify(deployStatusPath)},`;
      },
    );
    if (replacements !== 1) {
      throw new Error(`Expected to replace exactly one DEPLOY_STATUS_PATH in ${configFile}, replaced ${replacements}`);
    }
  }
  fs.writeFileSync(configFile, config);
}

if (label) {
  let html = fs.readFileSync(indexFile, 'utf8');
  const badge = `<div id="wxgame-environment-badge" aria-label="${label}">${label}</div>`;
  const style = [
    '<style id="wxgame-environment-badge-style">',
    '#wxgame-environment-badge{position:fixed;z-index:2147483647;left:10px;top:10px;padding:4px 8px;border:1px solid rgba(255,255,255,.65);background:rgba(20,20,20,.82);color:#fff;font:600 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0;border-radius:4px;pointer-events:none;}',
    '</style>',
  ].join('');
  html = html.replace(/<title>(.*?)<\/title>/i, `<title>${label} - $1</title>`);
  if (!html.includes('wxgame-environment-badge-style')) {
    html = html.replace('</head>', `    ${style}\n</head>`);
  }
  if (!html.includes('wxgame-environment-badge')) {
    html = html.replace('<body>', `<body>\n    ${badge}`);
  }
  fs.writeFileSync(indexFile, html);
}
NODE

    echo "[Deploy] Frontend environment override applied: environment=$DEPLOY_ENVIRONMENT label=${label:-none} apiBase=${api_base:-default}"
}

# Skip the multi-minute npm install when backend/package-lock.json is unchanged since the
# last successful install. The hash is only written AFTER a successful install, so an
# aborted install re-runs next deploy.
install_backend_dependencies_if_needed() {
    local lockfile="$BACKEND_DIR/package-lock.json"
    local hash_file="$DEPLOY_STATE_DIR/backend-deps.lock.sha256"
    local current_hash=""

    if [ -f "$lockfile" ] && command -v sha256sum >/dev/null 2>&1; then
        current_hash="$(sha256sum "$lockfile" | awk '{print $1}')"
    fi
    if [ -n "$current_hash" ] \
        && [ -d "$BACKEND_DIR/node_modules" ] \
        && [ -f "$hash_file" ] \
        && [ "$(cat "$hash_file" 2>/dev/null)" = "$current_hash" ]; then
        echo "[Deploy] 后端依赖未变化（lockfile hash 一致），跳过安装。"
        return 0
    fi
    run_with_deploy_status_heartbeat npm install --omit=dev --no-audit --no-fund
    if [ -n "$current_hash" ]; then
        mkdir -p "$DEPLOY_STATE_DIR"
        printf '%s' "$current_hash" > "$hash_file"
    fi
}

# Hardlink snapshot of the running backend before we touch it. npm/rsync replace files
# with new inodes, so the snapshot stays intact; runtime data (db/env/logs) is excluded
# from restore so a rollback never rolls back player data.
BACKEND_ROLLBACK_SNAPSHOT=""
snapshot_backend_for_rollback() {
    local snapshot_dir="${DEPLOY_STATE_DIR}/backend.rollback-prev"
    if [ ! -d "$BACKEND_DIR" ]; then
        return 0
    fi
    rm -rf "$snapshot_dir" 2>/dev/null || true
    if cp -al "$BACKEND_DIR" "$snapshot_dir" 2>/dev/null; then
        BACKEND_ROLLBACK_SNAPSHOT="$snapshot_dir"
        echo "[Deploy] 已创建回滚快照: $snapshot_dir"
    else
        echo "[Deploy] 回滚快照创建失败（继续部署，但失败时无法自动回滚）" >&2
    fi
}

rollback_backend_and_restart() {
    if [ -z "$BACKEND_ROLLBACK_SNAPSHOT" ] || [ ! -d "$BACKEND_ROLLBACK_SNAPSHOT" ]; then
        echo "[Deploy] 无可用回滚快照，服务可能停留在坏版本！" >&2
        return 1
    fi
    echo "[Deploy] 健康检查失败，自动回滚到上一版本..." >&2
    rsync -a --delete \
        --exclude '.env' \
        --exclude '.env.*' \
        --exclude 'logs' \
        --exclude '*.db' \
        --exclude '*.db-shm' \
        --exclude '*.db-wal' \
        "$BACKEND_ROLLBACK_SNAPSHOT/" "$BACKEND_DIR/" || return 1
    pm2 restart "$PM2_APP_NAME" --update-env >/dev/null 2>&1 || true
    pm2 restart "$WORLD_WORKER_PM2_NAME" --update-env >/dev/null 2>&1 || true
    local attempt
    for attempt in 1 2 3 4 5; do
        if curl -fsS "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
            echo "[Deploy] 回滚成功：上一版本已恢复运行。" >&2
            return 0
        fi
        sleep 2
    done
    echo "[Deploy] 回滚后健康检查仍失败，需要人工介入！" >&2
    return 1
}

run_deploy_gate() {
    local gate_script="$DEPLOY_GATE_SCRIPT"

    if [ "${SKIP_DEPLOY_GATE:-0}" = "1" ]; then
        echo "[Deploy] SKIP_DEPLOY_GATE=1 set; skipping deploy gate."
        return
    fi

    if [[ "$gate_script" != /* ]]; then
        gate_script="$WORK_TREE/$gate_script"
    fi

    echo "[Deploy] Running deploy gate: $gate_script"
    run_with_deploy_status_heartbeat env REPO_GIT_DIR="$GIT_DIR_PATH" bash "$gate_script" "$WORK_TREE"
}

run_post_backend_sync_script() {
    local hook_script="$POST_BACKEND_SYNC_SCRIPT"

    if [ -z "$hook_script" ]; then
        return
    fi

    if [[ "$hook_script" != /* ]]; then
        hook_script="$WORK_TREE/$hook_script"
    fi

    echo "[Deploy] Running post-backend sync script: $hook_script"
    run_with_deploy_status_heartbeat env \
        BACKEND_DIR="$BACKEND_DIR" \
        DB_PATH="${DB_PATH:-$BACKEND_DIR/civilization.db}" \
        DEPLOY_STATE_DIR="$DEPLOY_STATE_DIR" \
        bash "$hook_script"
}

echo "[Deploy] 开始部署..."

sanitize_git_env
assert_safe_deploy_paths

require_command node

export WXGAME_DEPLOY_STATUS_PATH="$DEPLOY_STATUS_PATH"
DEPLOY_PREVIOUS_COMMIT="$(read_previous_deploy_commit || true)"
write_deploy_status "running" "" "0" ""
trap 'deploy_error_trap "$?" "$BASH_COMMAND"' ERR
trap deploy_exit_trap EXIT

require_command git
require_command npm
require_command pm2
require_command rsync
require_command curl
require_command ss

set_deploy_stage "resolve-git"
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
    set_deploy_stage "checkout"
    echo "[Deploy] 检测到 bare repo，直接检出 ref $BRANCH ..."
    if ! DEPLOY_COMMIT="$(resolve_deploy_commit 2>/dev/null)"; then
        echo "[Deploy] bare repo 中不存在可部署 ref/commit: $BRANCH" >&2
        exit 1
    fi
    DEPLOY_TARGET_COMMIT="$DEPLOY_COMMIT"
    write_deploy_status "running" "" "0" ""
    git_repo checkout -f "$DEPLOY_COMMIT"
    git_repo clean -fd
else
    set_deploy_stage "checkout"
    echo "[Deploy] 检测到普通仓库，强制对齐到 ref $BRANCH ..."
    if git_repo fetch origin "$BRANCH" >/dev/null 2>&1 \
        && DEPLOY_COMMIT="$(git_repo rev-parse --verify "origin/$BRANCH^{commit}" 2>/dev/null)"; then
        DEPLOY_TARGET_COMMIT="$DEPLOY_COMMIT"
        write_deploy_status "running" "" "0" ""
        git_repo reset --hard "$DEPLOY_COMMIT"
    elif DEPLOY_COMMIT="$(resolve_deploy_commit 2>/dev/null)"; then
        echo "[Deploy] 使用本地可解析 ref/commit: $BRANCH"
        DEPLOY_TARGET_COMMIT="$DEPLOY_COMMIT"
        write_deploy_status "running" "" "0" ""
        git_repo checkout -f "$DEPLOY_COMMIT"
    else
        echo "[Deploy] 无法解析可部署 ref/commit: $BRANCH" >&2
        exit 1
    fi
    git_repo clean -fd
fi

set_deploy_stage "deploy-gate"
run_deploy_gate
export WXGAME_DEPLOY_MANIFEST_PATH="$DEPLOY_STATE_DIR/current-deploy.json"

set_deploy_stage "shared-sync"

echo "[Deploy] 同步 shared/ 目录..."
ensure_shared_link
verify_shared_sync

set_deploy_stage "backend-sync"

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
run_post_backend_sync_script

set_deploy_stage "backend-dependencies"

echo "[Deploy] 安装后端依赖..."
cd "$BACKEND_DIR"
install_backend_dependencies_if_needed
echo "[Deploy] Cleaning retired world-explorer ready state..."
run_with_deploy_status_heartbeat env DB_PATH="${DB_PATH:-$BACKEND_DIR/civilization.db}" node "$BACKEND_DIR/scripts/cleanup-world-explorer-ready-state.js"
set_deploy_stage "config-release"
publish_runtime_config_release

set_deploy_stage "pm2-restart"

snapshot_backend_for_rollback

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
if ! verify_pm2_listener "$PM2_APP_NAME" 1 || ! verify_pm2_listener "$WORLD_WORKER_PM2_NAME" 0; then
    record_deploy_failure 1 "pm2 verification failed after restart; automatic rollback attempted"
    rollback_backend_and_restart || true
    exit 1
fi
restart_ops_agent_if_configured

set_deploy_stage "health-check"

echo "[Deploy] 校验健康接口..."
for attempt in 1 2 3 4 5; do
    if health_payload="$(curl -fsS "http://localhost:${API_PORT}/api/health")"; then
        verify_runtime_config "$health_payload"
        set_deploy_stage "frontend-publish"
        echo "[Deploy] 发布前端静态文件..."
        publish_frontend_assets
        apply_frontend_environment_overrides
        set_deploy_stage "deploy-marker"
        write_deploy_version
        DEPLOY_STAGE="complete"
        write_deploy_status "succeeded" "" "0" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
        DEPLOY_FINISHED=1
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
record_deploy_failure 1 "health check failed after pm2 restart; automatic rollback attempted"
rollback_backend_and_restart || true
exit 1
