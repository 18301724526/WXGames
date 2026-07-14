---
name: march-settlement-architecture
description: 行军结算三条腿架构（worker=离线、心跳=在线挂机、动作写=交互中）；纯等待会话曾饿死结算的完整证据链与修复。
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

2026-07-04 下午，fog 切片终验连环挖出两个服务器端结构缺陷（提交 `ebf90103`/`5576645f` 收敛推进 + `dfcc4c4e`/`31e06676` 心跳结算，双分支已部署已验证）。


**缺陷2（结算单点依赖 worker）**：`players.lastActiveAt` 只由登录 + 心跳持久化（**60s 节流**）更新，worker 活跃窗口 **120s**；纯等待会话（看行军不点操作）会掉出 worker 活跃集 → 行军到达结算（reveal 持久化/站点发现）没人做。真人没感知是因为任意点击的动作写路径 `loadProgressedGameState→advanceRuntimeState→save` 顺带结算；无人值守（harness march-wait）必死。修复=心跳 handler `settleDueMarchesOnHeartbeat`：raw state 有 active mission 过 `nextStepAt` 时 advance+save（revision 冲突容忍，下次心跳/worker 重试）。**三条腿**：worker=关页会话、心跳=在线挂机、动作写=交互中；读路径永不推进不落库。

**排查坑（很贵的教训）**：
- `/game/state` 的 DTO 是时间投影（deriveMissionForTime）——mission 显示 idle **不证明** worker 活着/结算已持久化；判结算要看 revealedTileIds 持久数。
- 我的探针 login 会顶掉 harness 的单会话 token（互相污染实验）；也会经登录写路径把搁浅态"治好"——观察者效应两连。
- worker 日志静默≠死：tick 摘要只在 errorCount||slow 时打印；`started {running:false}` 横幅正常（tick 间隙态）。
- `database is locked` 不在 worker 的 revision-conflict 重试范围内（直接抛）——遗留观察点。
- WSL pm2 命令经 wsl.exe 挂起；读日志用 UNC `\\wsl.localhost\Ubuntu-24.04\root\.pm2\logs\`（PowerShell Get-Content）可靠。

**行军"疯狂回弹"根因=世界时钟每同步向后跳**(2026-07-05, workflow `wikyqf9vr` 确定性复现 + 隔离)：`WorldClock.runClockSyncSystem` 每次 syncFromServer 把 `serverEpochAtSyncMs` 锚到 payload 的 `serverTime`(=服务器**构建响应时**的时间戳,已过时 latency 毫秒,源 AoiSyncSnapshot/ServerTimelineSnapshot 的 `now.toISOString()`),而 `clientMonoAtSyncMs` 锚到**接收时**单调钟 → 重锚后 `epochNowMs=同步前值−latency`,每秒向后跳。服务器 march `startedAt`/route **稳定**(WorldExplorerProgression 只标 revealed、只推离散 position,永不改 startedAt),`getCurrentCoord=(now−startedAt)/duration` 是 nowMs 单调函数,故位置回弹**唯一来源=nowMs 倒退**。spine 把 root 钉路线只是**放大器**;对账器 authority-wins 无关(隔离:单调钟+对账=0 回退,倒退钟+关对账=10 回退)。**修复 `9e2869e0`**：`runClockSyncSystem` 前向单调钳制 `anchoredEpoch=max(serverEpochMs, prevEpochNow)`——陈旧 serverTime 永不拉回、真前跳仍生效 → 回退帧 10→0。WorldClock 是 bitecs bundle 输入必重建;回归测试锁死。**教训:世界时钟=时间的单一事实源,任何"重锚服务器时间"必须单调钳制,否则所有时间派生视觉每同步抖一次。**

**行军路线双写(套壳)→回弹伏笔 + 门禁**：SPINE-1 把服务器 planner + 客户端预览切格轴,漏改**客户端乐观 `MarchCommandBuilder.buildLinearRoute`**(仍自造对角线走法)→乐观/权威路线签名不符、对账反复修正。修 `254d1433`：删自造走法委托 `WorldMarchCore.evaluateLinearMarchRoute`(逐字对齐服务器 options)。门禁 `786ca172`：`scripts/check-duplicate-march-builders.js`(architecture-smoke) 禁 `remainingQ/remainingR` 走法变量对出现在 canonical(worldMarchCore+adapter)之外——回答"门禁怎么过双写":之前无防算法重复的门禁。委托包装放行,复制走法拦截。**剩余单源债(未做,跨切/后端风险,建议在场做)**：①地图尺寸 1024 硬编码于 MarchCommandBuilder+WorldMarchRoutePolicy+WorldChunkAddress(vs 服务器 WorldMapConstants/WorldMapTopology,当前全=1024 非 bug,真单源需服务器经 DTO 下发、客户端消费);②后端 reveal-tile helper(createRouteTileAliasMap/createRevealedTileSet)三处(worldMarchCore/WorldExplorerDtoMapper/WorldExplorerMissionNormalizer)。

相关：[[overnight-ssot-server-perf]]（worker 饿死第一章）、[[fog-facts-slice]]、[[march-spine-four-direction]]、[[playtest-march-wait-server-truth]]。
