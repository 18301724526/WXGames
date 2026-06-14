# 大地图输入 Picking 架构重建任务推进

## 背景事实

账号 `test1` 导出的 `wxgame-oplog-test1-20260613-214234Z.json` 显示：

- 初始 `worldMap:hitTargetsSynced` 为 `hitTargetCount=48`。
- 一次大地图拖拽快照后，runtime 同步到 `hitTargetCount=2`、`baseHitTargetCount=2`、`mapTargetCount=2`。
- 拖拽结束时 `camera` 与 `bakedCamera` 对齐，`dragLayerOffset` 已回到 `{ x: 0, y: 0 }`。
- 后续背景点击时，外层 Canvas 命中 `worldMapDrag`，但 `WorldMapRuntime` 二次命中为 `null`，因此没有产生 `worldMap:backgroundTarget`，也不会出现行军 HUD。

结论：这不是单纯的拖拽 offset 未清零，而是 snapshot / fast-drag 渲染把 runtime 的输入命中索引污染成残缺索引。画面仍能显示，但输入模型已不是同一份稳定地图。

## 正确架构目标

大地图输入必须对齐成熟在线游戏的边界：

- Renderer 只负责绘制和临时视觉缓存，不拥有玩法输入权威。
- 地图背景点击通过 `screen point -> current camera/view transform -> world tile coordinate -> tileId` 推导。
- 城池、部队、HUD 等前景命中可以使用空间索引，但索引由稳定 state / presenter / picking model 生成，不能由 snapshot 渲染副作用覆盖。
- snapshotOnly、reuseCachedWorldTileView、fast drag 只能影响视觉层，不能提交完整地图输入索引。
- 输入处理读取同一份 view/camera epoch；发现 renderer 输入源是 partial/snapshot 结果时，必须保留或重建稳定输入索引。
- 客户端只提交 tileId / siteId / actorId 等意图，后端继续做解锁、可达性、部队状态和多人同步校验。

## 旧代码隔离策略

- 不在 `frontend/`、`backend/`、`docs/` 或任何仓库内可扫描目录保存旧实现副本。
- 必要历史快照只能放在项目外备份目录，本轮备份目录为：`F:\AI Project\WXGamesLocal_outside_backups\20260614-world-map-input-picking`。
- 当前源码里不保留 legacy fallback、废弃入口或隐藏旧路径。
- 如果某段旧逻辑被新 picking 边界替代，应删除或降级为内部 helper，不能继续作为可调用业务入口存在。

## TDD 推进

### 第一阶段：暴露问题

- `WorldMapRuntime` 红测：当 runtime 的 hitTargets 被 snapshot 残缺目标污染后，背景点击仍必须通过 tile context 推导 `selectWorldMarchTarget`。
- `WorldMapRuntimeHitTargetPolicy` 红测：snapshot / preserve 模式下，非空但明显 partial 的 map targets 不能覆盖稳定地图输入索引。
- `WorldMapInputActionMap` 红测：背景 picking 不依赖 `worldMapDrag` hit target；只要点在 map frame 内且 context 可用，就能推导 tile action。

### 第二阶段：建立正确边界

- 新增 `WorldMapPickingModel`，由 `lastWorldTileMapContext` 的 frame / viewport / geometry / sites / actors 生成 `world-map-picking-snapshot-v1`，世界城池与部队命中不再依赖 renderer hitTargets。
- `WorldMapRuntime` 增加 picking snapshot 缓存和 `inputEpoch`：同一份 context 重复读取不推进 epoch，camera/view/entity context 变化时推进 epoch 并重建 picking snapshot。
- `WorldMapInputActionMap.resolveTapAction()` 先处理显式非 world UI/HUD hit target，再处理稳定 picking snapshot，最后才用 context 推导背景 tile；renderer 产出的 world-surface hitTargets 不再压过稳定 picking。
- `WorldMapRuntime.handleTap()` 使用稳定 picking 与独立背景 picking 推导 action，不能因为 runtime hitTargets 缺少 `worldMapDrag` 就直接失败。
- `WorldMapRuntimeHitTargetPolicy` 在 snapshot / preserve 模式中识别 partial map target，同步时保留旧地图目标，只替换 actor layer 目标。

### 第三阶段：移除旧依赖

- renderer snapshot frame 不再作为完整输入索引来源。
- `WorldMapRuntime` 不再把 renderer hitTargets 视为背景 tile picking 或世界实体 picking 的权威。
- 更新 `frontend/index.html` cache key 并加入 `WorldMapPickingModel.js`，避免浏览器继续加载旧 runtime / action map。

### 第四阶段：输入意图契约

- 新增纯 domain 模块 `WorldMapInputIntent`，产出 `world-map-input-intent-v1`。
- 每一次 `WorldMapRuntime.handleTap()` 在 action 分发前生成同一份 input intent，记录稳定 `inputId`、单调 `clientSequence`、HUD 坐标、layer 坐标、action 摘要、target identity、picking epoch/signature/counts、frame/viewport/camera 和小型诊断字段。
- input intent 只允许保存可序列化小对象；不得包含 renderer/context 原对象、浏览器 event、完整 tiles、完整 targets 或大 payload。
- `WorldMapRuntime` 保存 `lastInputIntent`，并通过第三参数 `meta.inputIntent` 传给 coordinator、shell/app bridge 和 `CanvasActionController`；H5 shell 的 `CanvasGameShellCommands.forwardCanvasAction()` 继续把同一份 `meta` 传给外部 `onAction`，不能在转发边界吞掉 `inputIntent`，也不能把外部 Promise action 失败压成同步成功。
- `ClientOperationLog` 在 `worldMap:tapHit`、`worldMap:backgroundTarget`、`action:begin`、`action:end`、`action:error`、`api:request`、`api:response`、`api:error` 记录 compact input intent / clientInput 摘要，用于本地导出日志与后端请求日志对账；失败路径不能丢 `inputId` / `clientSequence`。
- `CanvasActionController` -> `CanvasTerritoryActionHandlers` -> `GameAPI` 的失败世界行军链路已用端到端测试锁定：同一个 `inputId` 必须同时出现在 `action:error` 与 `api:error`，且 `api:error.clientInput` 不得包含 renderer payload。`CanvasActionController.finalizeForwarded()`、`WorldMapRuntime.dispatchAction()` 和 `CanvasGameShellInputRouter.observeAsyncActionResult()` 共同保证异步 forwarded action / runtime tap 失败不会被记录成 `action:end true` 或浏览器未观察拒绝。
- 当前阶段仍不把 input intent 直接发给服务器；它是后续多人同步、服务端权威校验、回放诊断和反作弊审计的输入事实边界。

### 第五阶段：服务端权威命令证据

- `CanvasTerritoryActionHandlers` 将 `meta.inputIntent` 作为 `clientInputIntent` 传入 `startWorldMarch` / `returnWorldMarch` / `stopWorldMarch`。
- `GameAPI` 只发送 `clientInputIntent` 的白名单摘要，不发送 renderer/context 原对象、完整 tiles、完整 targets 或大 payload。
- `GameActionRegistry` 保留 `clientInputIntent` 到 world-march payload；`TerritoryAction` 将 return/stop/start 的 payload 交给 `WorldExplorerService`。
- `CommandAuthorityContract` 在 `authority.command.clientInput` 中保存 compact evidence，用于回放和审计。
- `WorldExplorerService` 仍只用服务器 gameState、mission、targetQ/targetR、missionId 计算路线、停止点、timeline 和 AOI；`clientInputIntent` 不能覆盖坐标、路线、任务状态或多人同步权威。
- `LogService` 的 `operationLog.clientInput` 记录同一份 compact evidence，便于与本地导出的 `ClientOperationLog` 和 `/api/game/action` request id 对账。

### 第六阶段：可回放诊断对账

- 新增 `CommandReplayCorrelation`，产出 `command-replay-correlation-v1`，只负责把前端导出的 `ClientOperationLog`、后端 `api_logs.operationLog`、`X-Client-Request-ID` 与 `CommandAuthorityContract` 的 `commandId/status` 串成可对账摘要。
- 回放对账必须同时匹配 `requestId`、`WorldMapInputIntent.inputId`、compact `clientInput` 与 `authority.commandId`；不能在高频点击或多人同步排查里退化为按时间猜测。
- `GameAPI` 的本地 `api:request` 记录 compact `clientInput`，`api:response` 记录 compact authority command metadata；这不增加自动上传，也不改变业务请求权威。
- `LogService` 的 `operationLog.authority` 只保存 compact commandId/status/command/clientInput/rejection，不保存 timeline/AOI/完整 response，避免日志膨胀和泄露 renderer payload。
- 该阶段用于复盘一次 world-map tap -> action -> API request -> server authority result 的证据链；服务端路线、停止点、timeline、AOI 和接受/拒绝仍只由服务器当前状态计算。

### 第七阶段：输入/回放证据性能预算

- `WorldMapPerformanceBudget.checkInputIntent()` 将 `WorldMapInputIntent` 证据限制在 2KB，并递归拒绝 renderer/event/context、完整 tiles、hitTargets、visibleEntries、`picking.targets` 等重 payload；`picking.counts.targets` 这种计数字段允许存在。
- `PerformanceCapacityBudget.checkCommandEvidence()` 将服务端 `clientInput` 限制在 2KB、`CommandReplayCorrelation` summary 限制在 4KB，并递归拒绝 timeline/AOI/response/gameState/worldMap/route/tiles 等重权威或运行时 payload 进入诊断证据。
- `WorldMapInputIntent.test` 与 `CommandReplayCorrelation.test` 已接入预算检查，预算不是孤立工具，而是 input -> API -> server authority -> replay 链路门禁的一部分。

### 第八阶段：旧世界地图入口退役门禁

- 删除活动源码中的旧 `renderWorldScoutUnitsLegacy()`、旧 scout unit route/progress/frame helper、旧 `renderWorldCityCommandLegacyOverlay()`。当前 scout 路线由 `WorldMapScoutRenderer.renderWorldScoutRoutes()` 承担，单位/actor 由 `WorldMapActorHudRenderer` / `WorldActorCanvasRenderer` 承担，城市命令 HUD 只走当前 `renderWorldCityCommandOverlay()`。
- 删除旧雷达 fallback 链路：`WorldRadarPresenter` 文件、UIStatePresenter delegate、`worldRadarDrag` 输入动作、map-home 缺 tileMap 时回退 `renderMilitaryWorldView()` 的分支。缺 tileMap 只渲染空/加载态，不再复活第二套世界 UI。
- 新增 `scripts/check-retired-legacy-code.js`，并接入 `scripts/run-architecture-smoke.js`。它只扫描活动生产源码，拦截 `HomeCanvasRenderer`、`openTalentPolicy`、退役 scout-report action、旧 world-map renderer API、`WorldRadarPresenter` 和 `worldRadarDrag`；测试与文档中的退役说明不作为运行入口。

### 第九阶段：H5 / 小程序输入入口统一

- `WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime()` 是 H5 Shell 与 minigame/compat App 共用的 world-map tap 路由判定。
- `CanvasGameShellInputRouter` 与 `CanvasGameAppInputRouter` 都必须把空命中、`worldMapDrag`、renderer 背景 `selectWorldMarchTarget` 交给 `WorldMapRuntime`，由当前 camera/context/picking snapshot 重算。
- 如果 `WorldMapRuntime` 没有接住这些背景 tap，不能再把 renderer 的背景 hitTarget 当 fallback 命令分发；renderer 背景目标只允许作为输入缓存/提示，不是玩法输入权威。
- `CanvasGameApp.test.js` 已纳入 `scripts/run-architecture-smoke.js`，小程序/兼容入口不再游离在 H5 Shell 门禁之外。

### 第十阶段：门禁

必须通过：

- `node --test frontend/js/domain/WorldMapInputIntent.test.js frontend/js/domain/WorldMapPerformanceBudget.test.js frontend/js/domain/WorldMapInputActionMap.test.js frontend/js/platform/WorldMapRuntimeHitTargetPolicy.test.js frontend/js/platform/WorldMapRuntime.test.js frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js`
- `node --test frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasGameShellWorldMapDragRuntime.test.js frontend/js/platform/CanvasGameShellWorldMapLayerBridge.test.js frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/api/GameAPI.test.js`
- `node --test backend/tests/RealtimeAuthorityContract.test.js backend/tests/GameActionRegistry.test.js backend/tests/WorldExplorerService.test.js backend/tests/LogService.test.js backend/tests/CommandReplayCorrelation.test.js backend/tests/PerformanceCapacityBudget.test.js`
- `node scripts/check-frontend-script-manifest.js`
- `node scripts/run-architecture-smoke.js`
- `git diff --check`

## 完成标准

- 拖拽快照后，即使 renderer 产出 partial hit targets，runtime 仍保留稳定地图输入能力。
- 背景点击行军目标由 camera/view/tile geometry 推导，不依赖 renderer 是否仍保留完整 `worldMapDrag` hit target。
- 城池/部队/HUD 前景点击优先级不倒退。
- 每次大地图 tap 都有可导出、可 JSON 序列化、体积受控的 `WorldMapInputIntent`，并能从日志对齐输入事实与 action 执行。
- 世界行军命令可带 compact `clientInputIntent` evidence，但服务端路线、停止点、timeline、AOI 和接受/拒绝仍由服务器当前状态计算。
- 文档与代码事实一致，旧实现不留在当前项目目录中。
