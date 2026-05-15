#!/bin/bash
# 文明火种 - 部署脚本
# 位置：仓库根目录 deploy.sh
# 用法：在服务器上执行 ./deploy.sh [branch]

set -euo pipefail

REPO_DIR="/www/wwwroot/h5"
BACKEND_DIR="/opt/wxgame-workspace/backend"
SHARED_LINK="/opt/wxgame-workspace/shared"
BRANCH="${1:-main}"
PM2_APP_NAME="server"
API_PORT="${PORT:-3000}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[Deploy] 缺少命令: $1" >&2
        exit 1
    fi
}

echo "[Deploy] 开始部署..."

require_command git
require_command npm
require_command pm2
require_command rsync
require_command curl

echo "[Deploy] 强制对齐仓库到 origin/$BRANCH ..."
cd "$REPO_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd

echo "[Deploy] 同步 shared/ 目录..."
mkdir -p "$(dirname "$SHARED_LINK")"
ln -sfn "$REPO_DIR/shared" "$SHARED_LINK"

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
    "$REPO_DIR/backend/" "$BACKEND_DIR/"

echo "[Deploy] 安装后端依赖..."
cd "$BACKEND_DIR"
npm install --omit=dev --no-audit --no-fund

echo "[Deploy] 重启 PM2 服务..."
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP_NAME" --update-env
else
    pm2 start server.js --name "$PM2_APP_NAME" --update-env
fi

echo "[Deploy] 校验健康接口..."
for attempt in 1 2 3 4 5; do
    if curl -fsS "http://localhost:${API_PORT}/api/health"; then
        echo
        echo "[Deploy] 部署完成"
        echo "[Deploy] 前端: http://47.116.32.216/h5/"
        echo "[Deploy] API: http://47.116.32.216:${API_PORT}/api/health"
        exit 0
    fi
    sleep 2
done

echo "[Deploy] 健康检查失败，最近的 PM2 状态如下:" >&2
pm2 show "$PM2_APP_NAME" >&2 || true
exit 1
