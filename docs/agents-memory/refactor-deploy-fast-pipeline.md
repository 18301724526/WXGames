---
name: refactor-deploy-fast-pipeline
description: refactor 测试服部署管线已提速到 push→完成 ~17 秒（fast gate + lockfile 哈希缓存 + 失败自动回滚）；refactor 后端端口是 3003 不是 3002。
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

2026-07-04 修复（`2c891d2f`，用户标准「push→结果 ≤3 分钟」）。此前部署 20-60 分钟且失败后 502 挂死，三个根因全在 `deploy.sh`/`scripts/test-server-ci-gate.sh`：① 服务器把本地推送前已跑过的全套 CI 重跑一遍（两次 `npm ci` 全删重装走阿里云慢网络 + 1880 测试可能 OOM 挤死运行中服务）；② backend `npm install` 无条件跑；③ pm2 重启/健康检查失败无回滚，坏版本留在线上。

**修复**：① gate 加 `WXGAME_GATE_MODE`：`fast`=仅 backend `node --check` 语法冒烟（本地门禁是权威）；refactor 壳默认 fast，且 gate 内部对 `DEPLOY_ENVIRONMENT=refactor-test` 自动 fast（首推即生效）；其他环境保持 full。② `install_backend_dependencies_if_needed`：backend/package-lock.json sha256 与 `$DEPLOY_STATE_DIR/backend-deps.lock.sha256` 一致且 node_modules 在 → 跳过（hash 只在成功安装后写）。③ pm2-restart 前 `cp -al` 硬链接快照到 `${BACKEND_DIR}.rollback-prev`；verify/health 失败 → rsync 恢复（exclude db/env/logs，**数据不回滚**）+ pm2 重启旧版。**实测：空提交 push→succeeded = 17 秒。**

**Why**：dev 阶段部署速度就是开发速度；服务器端重复 CI 不提供任何本地没有的安全性，安全应由健康检查+回滚兜底。

**How to apply / 事实**：
- **refactor 后端端口 = 3003**（`http://47.116.32.216:3003/api/health` 本机；对外玩家链路 = `http://47.116.32.216/wxgame-refactor-api/health` 80 反代）。**3002 是 test 环境的口**——监控 refactor 时盯 3002 会误判 502（本次就犯了）。
- 部署排队是 flock 串行：前一个慢部署会让后续 push 看起来"无响应"，先查 `/opt/wxgame-refactor/.wxgame/push-deploy.log` 尾部（`=== push-triggered async deploy END rc=` 行）。
- 手动全量验证：服务器上 `WXGAME_GATE_MODE=full` 跑壳脚本。
- root SSH 可用（用户持密码，不存这里）；Windows 侧用 SSH_ASKPASS helper + `SSH_ASKPASS_REQUIRE=force`，用完删 helper 文件。
- 相关：[[refactor-server-push-deploy-502-fix]]（push 异步化，2026-06-25）、[[deploy-lint-gate]]（本地 lint 是权威门禁的一环）。
