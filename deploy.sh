#!/bin/bash
# 文明火种 - 部署脚本
# 位置：仓库根目录 deploy.sh
# 用法：在服务器上执行 ./deploy.sh

set -e

REPO_DIR="/www/wwwroot/h5"
BACKEND_DIR="/opt/wxgame-workspace/backend"
SHARED_LINK="/opt/wxgame-workspace/shared"

echo "[Deploy] 开始部署..."

# 1. 拉取最新代码
echo "[Deploy] 拉取最新代码..."
cd "$REPO_DIR"
git pull origin main

# 2. 同步 shared/ 到后端目录（通过符号链接）
echo "[Deploy] 同步 shared/ 目录..."
if [ ! -L "$SHARED_LINK" ]; then
    # 如果存在旧的普通目录，备份后删除
    if [ -d "$SHARED_LINK" ] && [ ! -L "$SHARED_LINK" ]; then
        mv "$SHARED_LINK" "${SHARED_LINK}.bak.$(date +%Y%m%d_%H%M%S)"
    fi
    ln -sf "$REPO_DIR/shared" "$SHARED_LINK"
    echo "[Deploy] 已创建符号链接: $SHARED_LINK -> $REPO_DIR/shared"
fi

# 3. 同步 backend/ 到后端运行目录（如果需要的话）
# 当前 PM2 从 /opt/wxgame-workspace/backend/ 运行
# 如果仓库 backend/ 和运行目录不同步，需要额外同步
# 这里假设运行目录本身就是 git 工作区的一部分，或者通过符号链接

# 4. 重启后端服务
echo "[Deploy] 重启后端服务..."
cd "$BACKEND_DIR"
pm install --production 2>/dev/null || true
pm2 restart server --update-env

echo "[Deploy] 部署完成 ✅"
echo "[Deploy] 前端: http://47.116.32.216/h5/"
echo "[Deploy] API: http://47.116.32.216:3000/api/health"
