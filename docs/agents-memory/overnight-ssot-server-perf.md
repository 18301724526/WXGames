---
name: overnight-ssot-server-perf
description: 2026-07-04 整夜自主：SSOT 重构（别名收敛+formations 单键）、worker 行军饿死修复、观测分库+迁移锁等待、服务器 VACUUM+nginx 缓存；关键机制与坑。
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

用户指令"自主推进架构优化/单一事实源/服务器优化/暴力猎BUG，别问我"。工作在 refactor 分支，提交链 `efab0af7(观测分库+迁移锁)→1baf7146(worker重试)→ecd062bb(别名收敛)→f5e0595e(formations单键)→…`，每步全门禁+双推送部署。

**服务器侧修复（全部已部署）：**
- **观测日志分库**：api_logs 曾 124 万行/313MB（占游戏库 78%，清理定时器从未被接线！），且与游戏事务同写锁域 = "database is locked" 主凶。现 LogService 用独立 `observability.db`（`LOGS_DB_PATH`，server.js 组装根开第二连接），retention 每小时分批短事务删（`cleanupOldLogs` batchSize 5000）。主库 DROP 旧表 + VACUUM：**399MB→2.4MB**。
- **迁移锁等待语义**：server+world-worker 部署后并发跑迁移，败者曾直接 SCHEMA_MIGRATION_LOCKED 崩溃+pm2 重启（153 次重启的元凶之一）。现 acquireLock 等待（60s/250ms poll）+过期锁回收（>10min）+**锁内重新 plan**（等待期间对方可能已应用完）。
- **worker 行军饿死**：WorldWorkerService 曾用循环前快照保存、revision 冲突即弃不重试——活跃玩家（正看行军的人）每 tick 必冲突、行军永不推进。现 `advancePlayerWithRetry`：按玩家重读最新 revision+冲突重试 3 次。**重要事实：行军推进=worker 每 5s tick 写库；/game/state 读路径不做时间推进**；mission 数据本身是 startedAt+route 的时间投影（deriveMissionForTime），10s/步。
- **nginx**：refactor 静态资产（带 v=deploy-hash）加 `Cache-Control: public, immutable` + 30d expires（嵌套 location 正则捕获 + alias $1；备份 `backend.conf.bak-cache-*`）；index.html/*.json 刻意不缓存（部署检测）。gzip 全局本来就开。**refactor 后端端口=3003**，对外=80 `/wxgame-refactor-api`。

**SSOT 重构（Rank1/2 已部署，Rank3 进行中）：**
- **Rank1 别名收敛**：CUT7 后顶层 resources/buildings/population/military 列存 null，内存重建为零值拷贝——全部顶层读者读假数据（lumbermill 可负担门恒 false 的活 BUG，已修：读活动城+shared buildingConfig 的 buildCost）。结构修复=顶层字段是活动城对象的**同引用别名**（不是投影拷贝）：`normalizeCities` 尾部内联 alias（谁重建城市谁重建别名——一次性 alias 会被 applyDerivedStats 的二次 normalizeCities 打断，踩过）；`applyDerivedStatsToCity` 替换 city.military 处、`setActiveCity`、`setCityMilitary/Resources`（已导出为规范入口）同步维护。不变量测试 GameStateSingleSourceAlias.test.js。
- **Rank2 formations 单键**：曾双键 `cities[X].military.formations[X]`+normalizeArmyFormations 给每城注入他城空条目（403 真根源，读优先级补丁只是面罩）。现=城内 **3 槽纯数组**；`pickCityFormationsSource` 读时迁移旧 map（cityId→capital→首个数组）；normalizeArmyFormations 删除；前端 presenter/queries/ActionController 3 处兼容双形状。
- **Rank3（进行中）**：`MAX_MANUAL_ROUTE_LENGTH` 上移 shared/worldMarchCore（曾后端私有+前端拷贝+DTO 被忽略三方分裂）；前端 RoutePolicy fail-closed（core 缺失即 throw，删 `{success:true}` 静默放行洞）+ 优先读 DTO 的 maxManualRouteLength；WorldMarchProgressSnapshot 17 个漂移 fallback 由 agent 删除中（硬依赖 shared）。**注意：这些 ecs 文件是 bundle 输入，改后必须 `npm run build:ecs-runtime`（主 repo 有自己 node_modules）再提交**。

**Rank3 终态（`d80814f3` 已部署）**：MAX_MANUAL_ROUTE_LENGTH 单源化（shared/worldMarchCore + 浏览器 adapter 镜像同步，parity 测试锁定）；RoutePolicy fail-closed；ProgressSnapshot 19 个 fallback 全删（-356 行，agent 执行）；**getMissionDto 服务端时间投影**（deriveMissionForTime(now)）——行军对客户端实时（单元验证：中途 step 准时 reveal/过点自动 idle），读侧不再被 worker 5s 写库节奏绑架。改 ecs/march 文件后必须 build:ecs-runtime；改 shared/worldMarchCore 导出必须同步 WorldMarchCoreAdapter.js 的镜像 export（adapter 测试会拦）。遗留：playtest harness 在 firstCityDiscovered 的 march-wait 仍偶发 stall 误报（工具时序，产品行军链单元+库层已验证健康）。

**playtest harness 教训（多轮踩坑）**：行军等待必须 (a) 单 action 槽长等 ≤5min（`waitForActiveMarchToArrive`）；(b) 每轮 `window.Game.syncOnce()` 主动拉服务器状态——**页面闲置时不轮询 /game/state**，不拉就假 stall；(c) 进度感知（mission JSON 变化重置 stall 钟，60s 无变化=真饿死报错，保住抓 worker BUG 的能力）。SSOT 审计完整结果在 workflow 输出（Rank4/5 未做：happiness 标量、顶层序列化冗余删除、gameState.military= 顶层 fallback 的 throw 化）。
