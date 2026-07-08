# 自主执行手册：前后端共享确定性行军逻辑

> 这是一份可连续自主执行的手册。从步骤1做到步骤6，不要等人确认。
> 在 main 分支直接做。每完成一步：commit 存档 + 跑测试 + 更新进度文件，绿则继续下一步。
> 只有触发"熔断条件"时才停下并报告。正常情况一路做到底。

---

## 执行协议（最重要，先读懂再开始）

**循环逻辑（对每个步骤）：**

1. 读该步骤的"改什么"，执行改动。
2. 跑该步骤的"验证命令"。
3. **验证通过** → `git add -A && git commit -m "march-step-N: 描述"`（在 main 上提交）→ 在 PROGRESS.md 记一行 → **继续下一步**。
4. **验证失败** → 触发熔断（见下），停下报告，**不要重试、不要绕过、不要继续**。

**"继续"是默认行为。"停"只在熔断时发生。** 不存在"做完一步停下等确认"——做完且测试绿就自动进下一步。

**熔断条件（满足任一，立刻停，写进 PROGRESS.md，结束）：**

- 任何验证命令失败（测试红 / lint 红 / sentinel 红）。
- 找不到手册里写的文件或代码位置（说明代码与手册不符，不要猜）。
- 一个步骤需要的改动明显超出手册描述的范围（说明理解有偏差，停下问）。
- 同一步骤尝试 2 次仍不通过（不要无限试，停下报告）。

**熔断时报告格式**（写进 PROGRESS.md 并输出）：

```
熔断停止于：步骤N
原因：（测试红 / 找不到文件 / 超范围 / 2次失败）
具体：（哪个命令、什么报错、哪个文件）
已完成并commit的步骤：步骤1..N-1
```

**绝对禁止：**

- ❌ 切分支（就在 main 上做）。
- ❌ 做"核查报告""第0步核查"（这是实施手册，直接干活，不核查）。
- ❌ 停下等人确认（除非熔断）。
- ❌ push / merge（只在本地 main commit，不推远程）。
- ❌ 动 AoiSyncSnapshot / 动态对抗视野。
- ❌ 弱化或跳过任何 sentinel。

**开始前**：创建 `PROGRESS.md`，写"march 重构开始，共6步"。然后从步骤1开始。

---

## 背景（理解用，30秒）

把"行军位置 + 静态地形揭示"重做成**前后端共享的一个确定性纯函数**：
前端每帧调用（60帧流畅），后端复用现有 WorldWorkerService 低频 tick 校验。
同一份代码 + 同参数 → 同结果，前后端天然一致。
**禁止超越函数（sin/cos/pow等）；时间一律作参数传入，函数内不读 Date.now/全局。**
**只动静态地形（revealedTileIds，揭terrain/site）；AOI对抗视野不碰。**

验证命令（全程用这三个）：

- 测试：`npm test`
- lint：`npm run lint`
- 架构：`npm run test:architecture`

---

## 步骤1：后端 /game/state 增加 serverTime 字段

**为什么**：`/game/state` 现在只下发 `syncTime`，而前端 `WorldClock` 只认 `serverTime`，导致 state 刷新时对时断裂。补上 serverTime，前端预测才有准确时间轴。

**改什么**：

- 文件 `backend/routes/gameRoutes.js`，约 322 行，`/game/state` 的 response 对象：
  ```js
  const responsePayload = {
    ...buildGameView(gameState, tutorial, gameStateService, projection),
    syncTime: new Date().toISOString(),
  };
  ```
- 在 `syncTime` 那行旁边加一行 `serverTime: new Date().toISOString(),`（保留 syncTime，不删）。
- 若该接口有多个 response 出口（如 363 行附近也有 syncTime），同样各加一行 serverTime。

**验证**：

- `npm test` 绿、`npm run lint` 绿。
- 通过标准：测试 lint 都绿，response 里同时有 syncTime 和 serverTime。

**通过则**：commit `march-step-1: /game/state 补发 serverTime`，PROGRESS 记一行，进步骤2。

---

## 步骤2：抽出共享确定性纯函数 shared/worldMarchCore.js

**为什么**：前端 `WorldMarchProgressSnapshot.getMissionProgress` 和后端 `ServerTimelineSnapshot.getProgress` 是两份、且有细微差异（会导致前后端发散）。合并成一份共享纯函数。

**改什么**：

1. 新建 `shared/worldMarchCore.js`，纯 CommonJS（`module.exports = {...}`，**绝不挂 global**），导出：
   - `computeMarchState(missionParams, nowMs)` → `{ position:{q,r,tileId}, revealedTileIds:[...] }`
   - 及其纯子函数：progress 计算、相邻格线性插值、沿 route 的揭示判断。
2. 逻辑取自前端 `getMissionProgress`(WorldMarchProgressSnapshot.js:133) + `lerp`(:285) + 路径构造(:111) + 揭示判断(:202)，
   与后端 `ServerTimelineSnapshot.getProgress`(:74) 合并，**必须统一以下 3 个发散点**（前后端用完全相同的算法）：
   - **status 枚举**：统一"哪些状态 progress=1"。前端只认 idle，后端认 ready/idle/cancelled。
     统一为：`['ready','idle','cancelled'].includes(status)` → progress=1（以"已到终点/已结束"为准）。
   - **stepDuration 秒转毫秒**：统一为 `Math.max(1000, Math.floor(stepDurationSeconds * 1000))`
     （去掉前端的 `Math.max(1, seconds)` 地板，前后端都用 floor 版）。
   - **路径起点**：统一为 `mission.origin || mission.position`。
3. 纯函数纪律：时间全从 `nowMs` 参数进；**函数内不读 Date.now / new Date / global.WorldMarchTrace**；
   不修改入参对象。Date 格式化、trace、WorldMapService、gameState 读写**留在调用方**，不进 core。
4. 只用 IEEE 确定运算（`+ - * / Math.floor/max/min/round/abs`）；**禁止 sin/cos/sqrt/pow 等超越函数**。

**验证（本步最关键，必须写 sentinel）**：

- 新建测试 `shared/worldMarchCore.test.js`：构造若干 (missionParams, nowMs)，覆盖
  status ∈ {ready, cancelled, idle, active}、stepDurationSeconds ∈ {10, 0.5}、route 长度 ∈ {1, 3, 8}。
- **破坏性自检**：先确认 sentinel 能抓错——临时把 core 里 status 集合改错一个，跑测试必须变红；改回来必须变绿。
  （证明 sentinel 真在校验，不是空过。）
- `npm test` 绿、`npm run lint` 绿。

**通过则**：commit `march-step-2: 抽共享 worldMarchCore 并统一发散点`，PROGRESS 记一行，进步骤3。

---

## 步骤3：后端改用共享 core

**为什么**：让后端的位置/进度计算走共享 core，与前端同源。

**改什么**：

- 后端 `ServerTimelineSnapshot.js`（及 `WorldExplorerProgression.js` 里算位置/progress 处）
  `require('../../shared/worldMarchCore')`，把"算 progress / 算位置 / 算揭示"替换为调 core 函数。
- 推进持久状态（标记 revealed、写 mission.position）的 mutation 仍留在 service，但"算出什么"用 core。
- 不改 core 之外的业务行为。

**验证**：

- `npm test` 绿（后端现有 march/timeline 相关测试必须仍绿）、`npm run lint` 绿、`npm run test:architecture` 绿。
- 通过标准：后端走 core，所有现有测试不回归。

**通过则**：commit `march-step-3: 后端接入共享 core`，PROGRESS 记一行，进步骤4。

---

## 步骤4：前端接入共享 core + 满帧预测

**为什么**：让前端每帧用共享 core 连续算位置和揭示，实现 60 帧流畅，且与后端同源。

**改什么**：

1. 新建前端 adapter `frontend/js/shared/WorldMarchCoreAdapter.js`（classic script），
   `require`/内联 shared/worldMarchCore 的纯函数，挂到 `global.WorldMarchCore`。
   （adapter 是前端唯一允许把 core 暴露成 global 的地方；core 本身不挂 global。）
2. 在 `frontend/index.html` 的 domain 脚本顺序里（TileCoord/WorldClock/WorldTime/WorldMarchProgressSnapshot 之前）
   引入 adapter 的 `<script>`。
3. 前端原有 `WorldMarchProgressSnapshot` / `WorldMarchSystem` 里算位置/progress/揭示的地方，改用 `global.WorldMarchCore`。
4. 渲染循环（`CanvasGameAppRenderingRuntime` 的 `renderAnimationFrame('military')` / `buildFreshWorldMapActors` 路径）
   每帧对所有 active mission 调 `WorldMarchCore.computeMarchState(missionParams, WorldClock.getEpochNowMs())`。
5. 删除"直接把后端离散 revealedTileIds 当唯一显示源"的旧逻辑：前端按时间连续算揭示。
6. **禁止 Date.now() 兜底**：时间一律 `WorldClock.getEpochNowMs()`。

**验证**：

- `npm test` 绿、`npm run lint` 绿、`npm run test:architecture` 绿。
- sentinel：模拟 nowMs 每帧 +16ms，断言位置连续变化、揭示沿 route 连续推进（不是 10 秒一跳）。
- 通过标准：前端走 core、连续预测、测试绿。

**通过则**：commit `march-step-4: 前端接入 core 满帧预测`，PROGRESS 记一行，进步骤5。

---

## 步骤5：乐观执行 + 对账（点了立即动 + 不回跳）

**为什么**：消除"点了等很久"，且 state 刷新时不让前端预测被后端离散数据拉回跳帧。

**改什么**：

1. **乐观执行**：`handle_startWorldMarch`(CanvasTerritoryActionHandlers.js:548) /
   `handle_returnWorldMarch`(:577)，点击 → 立即本地构造 missionParams 用 core 起步渲染 + 并行 POST，不 await 阻塞。
2. **对账**（在 `GameStateManager.sync`(GameStateManager.js:8) / `applyState`(CanvasGameAppStateSync.js) 覆盖
   worldExplorerState 之前，新增 mission 级对账，保留 optimistic 本地坐标 + pending）：
   - 后端 payload 到达，用后端权威 missionParams 喂 core 算权威位置：
     - 差异在阈值内（正常，后端离散落后）→ 以前端预测为准，**不回跳**，平滑切权威 timeline。
     - 差异超阈值 → 显示"网络连接缓慢，正在尝试同步"蒙版 + 平滑拉回。
3. **出发/回城回滚不同**：
   - 出发被拒绝（EXPLORE_FORMATION_BUSY / EXPLORE_LIMIT_REACHED / EXPLORE_ROUTE_EMPTY 等）→ 撤销 optimistic、回原位 + 反馈。
   - 回城返回成功但 route 被 rebase（含 rebase 成空，这不是拒绝）→ 按返回的权威 route 平滑对账，识别 route 变化重置基准。
4. 阈值可配置。

**验证**：

- `npm test` 绿、`npm run lint` 绿、`npm run test:architecture` 绿。
- sentinel：点击后 UI 立即反映（不等 resolve）；模拟后端发"落后位置"→不回跳；出发拒绝→干净回滚；回城 route 变→按权威对账不当拒绝。
- 通过标准：乐观执行 + 对账不回跳 + 回滚正确，测试绿。

**通过则**：commit `march-step-5: 乐观执行+对账`，PROGRESS 记一行，进步骤6。

---

## 步骤6：后端低频校验 + 清理

**为什么**：后端权威校验差异（反作弊+弱网），并清掉旧逻辑。

**改什么**：

1. 在 `WorldWorkerService.tickOnce → advanceState → ... → advanceExploreMissions` 链路里
   （**不新建 tick、不提频**），用 core 算权威位置，与前端上报对比，产出差异级别下发。
   命令合法性仍归 CommandAuthorityContract（不混入位置校验）。
2. 清理：删除前端"直接用后端离散结果作唯一显示源"的旧逻辑、前后端各一份的重复计算（已合并到 core）、本轮临时调试日志。

**验证**：

- `npm test` 绿、`npm run lint` 绿、`npm run test:architecture` 绿。
- sentinel：正常→一致无蒙版；模拟前端时间快进→大差异→蒙版+拉回；轻微抖动→小差异→静默对齐。
- 通过标准：校验生效、清理完成、全绿。

**通过则**：commit `march-step-6: 后端校验+清理`，PROGRESS 记"全部完成"，结束。

---

## 全部完成后

在 PROGRESS.md 写最终汇总：

- 6 步全部完成、各步 commit hash。
- 最终 `npm test` / `npm run lint` / `npm run test:architecture` 状态。
- 提示：所有改动在本地 main，未 push（等人 review 后再推）。
  然后结束。不要 push，不要做额外的事。
