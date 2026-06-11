# 《文明火种》后端服务

Node.js + Express + SQLite 后端骨架，全服务端计算架构。

## 技术栈

- **API服务**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT
- **进程管理**: PM2

## 目录结构

```
backend/
├── server.js          # 主入口
├── package.json       # 依赖配置
├── .env.example       # 环境变量模板
├── .gitignore         # Git忽略规则
├── deploy.sh          # 部署脚本
├── data/              # 数据库目录（运行时创建）
└── node_modules/      # 依赖（npm install后）
```

## API接口

### 玩家认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/player/register | 注册新玩家 {deviceId} |
| POST | /api/player/login | 登录 {deviceId} |

### 游戏状态

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/game/state | 获取游戏状态（心跳，含离线收益计算） |
| POST | /api/game/action | 玩家操作（建造/分配/研发/进阶/招募/事件选择） |
| POST | /api/game/offline | 离线上报，记录快照 |

### 事件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/game/events | 获取事件列表 |
| POST | /api/game/event/choose | 选择事件选项 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查，包含版本和观测摘要 |
| GET | /api/version | 部署版本信息，支持 ETag / 304 |
| POST | /api/client-events | 前端加载/资源失败事件采集，写入进程内观测窗口 |
| GET | /api/metrics | 管理员观测指标，含性能预算告警，需登录且具备管理员权限 |

### 管理员配置发布

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/config-releases | 配置发布历史，需登录且具备管理员权限 |
| GET | /api/admin/config-releases/active | 当前 active 配置发布指针 |
| GET | /api/admin/config-releases/runtime-status | active release 与当前 registry 的漂移状态 |
| POST | /api/admin/config-releases/preview | 预览候选配置 snapshot 与 baseline/active 的 diff |
| POST | /api/admin/config-releases/publish | 校验并写入配置发布审计和 active 指针 |
| POST | /api/admin/config-releases/rollback | 回滚 active 指针到历史 release |

### 管理员运维控制台

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/ops/dashboard | 生产运维总览，需登录且具备管理员权限 |
| GET | /api/admin/ops/maintenance | 读取维护模式状态 |
| POST | /api/admin/ops/maintenance | 开启/关闭软停服维护模式并写入审计 |
| POST | /api/admin/ops/restart | 受审计的延迟 PM2 restart，用于健康重启 |

`/api/admin/ops/*` 使用独立运维管理员认证，不复用玩家登录 token。控制台入口 `/tools/ops-console.html` 会一直打开，并通过 `POST /api/admin/ops/login` 登录后把 ops token 存入 `cf_ops_token`。生产建议配置：

```bash
OPS_ADMIN_USERNAME=<operator>
OPS_ADMIN_PASSWORD_HASH=<bcrypt hash>
OPS_JWT_SECRET=<independent long secret>
OPS_SESSION_TTL=12h
OPS_SESSION_VERSION=<rotation id>
JWT_SECRET=<independent player long secret>
CORS_ORIGINS=https://your-game-origin.example
ADMIN_USERS=<operator player/admin ids>
CONFIG_RELEASE_GATE=required
```

生产不建议使用明文 `OPS_ADMIN_PASSWORD`；仅在临时抢修时可显式设置 `OPS_ALLOW_PLAINTEXT_PASSWORD=1`。

生产安全配置和轮换证据入口：

```bash
REPO_GIT_DIR=/home/git/wxgame.git node scripts/verify-production-security-config.js --env-file /opt/wxgame-workspace/backend/.env --evidence /opt/wxgame-workspace/.wxgame/security/production-security-check.json --rotation-id <rotation-id> --server-access-owner <owner> --deploy-credential-owner <owner> --cwd /www/wwwroot/h5

ROTATION_CONFIRM=rotate-production-secrets \
WXGAME_SERVER_ACCESS_OWNER=<owner> \
WXGAME_DEPLOY_CREDENTIAL_OWNER=<owner> \
JWT_SECRET=<new-player-secret> \
OPS_JWT_SECRET=<new-ops-secret> \
OPS_ADMIN_PASSWORD_HASH=<bcrypt-hash> \
RESTART_PM2=1 \
bash scripts/rotate-production-secrets.sh
```

`OPS_SESSION_VERSION` 必须随 secret rotation bump，用于让旧 ops token 立即失效。证据 JSON 只写入长度、短 hash fingerprint 和配置状态，不写明文 secret。

## 操作类型

```javascript
// 建造
{ action: "build", target: "farm" }

// 分配人口
{ action: "assign", profession: "farmer", count: 1 }

// 研发科技
{ action: "research", tech: "钻木取火" }

// 时代进阶
{ action: "advanceEra" }

// 手动招募
{ action: "recruit" }

// 选择事件选项
{ action: "chooseEvent", eventId: "xxx" }
```

## 本地开发

```bash
npm install
npm run dev
```

## 部署到服务器

```bash
# 需要配置SSH密钥访问 47.116.32.216
bash deploy.sh
```

Windows 本地校验部署脚本时使用 Git Bash。可先运行：

```powershell
node scripts/check-shell-scripts.js
```

服务器上可核验部署 hook 和执行回滚：

```bash
bash scripts/verify-deploy-hook.sh
bash scripts/rollback-deploy.sh <branch|tag|commit>
bash scripts/rotate-production-secrets.sh --help
```

运行时备份和恢复入口：

```bash
bash scripts/backup-runtime-state.sh
bash scripts/install-runtime-backup-cron.sh
bash scripts/verify-runtime-backup.sh
WXGAME_RESTORE_CONFIRM=restore-runtime-state bash scripts/restore-runtime-state.sh /opt/wxgame-workspace/backups/<backup>.tar.gz
```

恢复默认会先创建 pre-restore 备份；生产恢复前应先在非生产目录用 `ALLOW_RESTORE_WITHOUT_PM2_STOP=1` 完成演练。

配置流水线当前本地入口：

```powershell
npm run config:validate
node scripts/validate-config-pipeline.js --baseline docs/config_registry_snapshot_2026-06-11.json
node scripts/validate-config-pipeline.js --write-baseline docs/config_registry_snapshot_2026-06-11.json
```

默认校验会列出 game/era/tutorial/battle/tech/building/task-definitions registry 的 version、schema、entry count、content hash 和 source；架构门禁会用 baseline diff 拦截未按建议升级版本的配置内容变化。

配置发布当前是审计、指针、漂移观测、启动门禁、只读 runtime bundle loader 和显式 gameplay runtime facade 边界，不会热加载 gameplay 运行时配置。`/api/health` 会输出 compact `configRuntime` 摘要并包含 gate policy、loader readiness 与 gameplay config runtime 状态。默认运行态文件：

- 生产：`/opt/wxgame-workspace/.wxgame/config-release/configReleases.json` 和 `/opt/wxgame-workspace/.wxgame/config-release/configActiveRelease.json`。该目录在 deploy state 下，运行时备份会一起带走 release history 和 active pointer。
- 本地/测试：`data/config-release/configReleases.json` 和 `data/config-release/configActiveRelease.json`。

启动门禁默认策略：`NODE_ENV=production` 时要求 active release 与当前 registry 匹配；开发/测试默认只告警。首次引导或诊断可显式设置 `CONFIG_RELEASE_GATE=warn`，禁用可用 `CONFIG_RELEASE_GATE=off`，正式生产应保持 `required`。

`ConfigRuntimeLoader` 只在 active release 与当前 registry 匹配后构建只读配置 bundle，并校验 payload hash；`GameplayConfigRuntime` 是玩法侧读取入口，当前覆盖 game/building/era/tutorial/tech-tree 配置，生产 required 模式必须读取匹配的 active bundle，开发/测试 warn/off 模式可回退到模块配置用于本地引导和诊断。

2026-06-11 线上演练已确认：管理员 API publish/rollback 后，生产 `CONFIG_RELEASE_GATE=required` 重启健康，`/api/health.configRuntime` 为 `matched`，loader ready，gameplay source 为 `active-release-bundle`；post-required-gate 备份包包含 `deploy-state/config-release/configReleases.json` 和 `deploy-state/config-release/configActiveRelease.json`。

管理员工具页：

- `/tools/config-release-console.html`：读取 active/history/runtime status，预览当前配置，写入发布审计记录，回滚 active 指针。
- `/tools/ops-console.html`：独立运维管理员登录后读取服务器/PM2/health/deploy/config/metrics/在线玩家/日志/审计摘要，支持维护模式开关和受审计 PM2 restart。

运维控制台当前提供“软停服”：开启维护模式后，`/api/game*`、`/api/buildings*`、`/api/player/login`、`/api/player/register`、`/api/player/reset` 返回 `503 MAINTENANCE_MODE`，但 `/api/health`、`/api/version`、`/api/metrics` 和 `/api/admin/*` 保持可用。运维面板健康卡片默认使用 `local-process` 进程内健康汇总，不再在 dashboard 请求里同步 curl 本机 `/api/health`；只有显式配置 `OPS_HEALTH_URL` 时才作为外部探测地址展示。真正硬停服/开服会切断本网页依赖的后端连接，后续应由常驻 `ops-agent`、systemd/PM2 外部守护或主机面板侧进程实现。

性能/容量预算当前为观测和元数据边界：

- `GET /api/metrics` 可查看 `PERFORMANCE_BUDGET_EXCEEDED`、API/action 延迟和请求/响应体大小预算结果。
- `GameStateRepository.save()` 会把最近一次存档预算摘要写入 `saveMetadata.performanceCapacity`，用于检查存档体积、世界地图规模和 mission 数量。
- `npm run profile:h5-performance` 可在本地用 stub API 驱动真实 H5 入口，生成 `.local-logs/h5-performance/<runId>/profile.json`，用于记录 navigation/resource timing、long task、RAF、canvas、截图像素和资源失败证据。
- `npm run profile:h5-phone-sim` 会用 CPU throttling、移动视口/DPR/touch、navigator 核心数/内存注入、V8 heap 上限和 SwiftShader/低端 GPU flag 近似 2026 手机 low/mid/flagship 档位；这是无真机时的本地保守模拟，不等同物理真机热/驱动/浏览器实测。
- H5 启动期资源加载只等待图片可用；世界地图瓦片 metrics/mask/dry-template 预热由 `worldMapRenderer.scheduleWorldTileCachePrewarm()` 在 ready 周边按设备档位后台分片执行，并在 profile 中以 `assets:prewarm:deferred` 记录。低/中端移动档还会降低水面/探索刷新频率，避免 ready 后按桌面节奏重绘地图。2026-06-11 最新模拟报告为 `.local-logs/h5-performance/2026-06-11T09-23-29-025Z/profile.json`。

生产依赖注意：2026-06-11 已将生产 Node 从 `18.20.8` 升级到 `20.20.2`，并在 Node 20 下重装 PM2、重建 `better-sqlite3@12.10.0` 原生模块；`backend/package.json` engines 同步为 `node >=20.0.0`。`npm run security:audit` 现在只允许 `xlsx` high、无 npm-audit fix 的残余风险，其补偿控制是 `TaskDefinitionImportParser` 的 XLSX 导入限制；其他 unexpected/fixable 漏洞会阻断 architecture gate。

或手动部署：

```bash
# 在服务器上
mkdir -p /opt/wxgame-workspace/backend
cd /opt/wxgame-workspace/backend
npm install
npm start
```

## Nginx 反向代理配置

```nginx
location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```
