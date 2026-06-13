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
- 每一次 `WorldMapRuntime.handleTap()` 在 action 分发前生成同一份 input intent，记录 HUD 坐标、layer 坐标、action 摘要、target identity、picking epoch/signature/counts、frame/viewport/camera 和小型诊断字段。
- input intent 只允许保存可序列化小对象；不得包含 renderer/context 原对象、浏览器 event、完整 tiles、完整 targets 或大 payload。
- `WorldMapRuntime` 保存 `lastInputIntent`，并通过第三参数 `meta.inputIntent` 传给 coordinator、shell/app bridge 和 `CanvasActionController`。
- `ClientOperationLog` 在 `worldMap:tapHit`、`worldMap:backgroundTarget`、`action:begin`、`action:end` 记录 input intent 摘要，用于本地导出日志与后端请求日志对账。
- 当前阶段仍不把 input intent 直接发给服务器；它是后续多人同步、服务端权威校验、回放诊断和反作弊审计的输入事实边界。

### 第五阶段：门禁

必须通过：

- `node --test frontend/js/domain/WorldMapInputIntent.test.js frontend/js/domain/WorldMapInputActionMap.test.js frontend/js/platform/WorldMapRuntimeHitTargetPolicy.test.js frontend/js/platform/WorldMapRuntime.test.js frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js`
- `node --test frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasGameShellWorldMapDragRuntime.test.js frontend/js/platform/CanvasGameShellWorldMapLayerBridge.test.js`
- `node scripts/check-frontend-script-manifest.js`
- `node scripts/run-architecture-smoke.js`
- `git diff --check`

## 完成标准

- 拖拽快照后，即使 renderer 产出 partial hit targets，runtime 仍保留稳定地图输入能力。
- 背景点击行军目标由 camera/view/tile geometry 推导，不依赖 renderer 是否仍保留完整 `worldMapDrag` hit target。
- 城池/部队/HUD 前景点击优先级不倒退。
- 每次大地图 tap 都有可导出、可 JSON 序列化、体积受控的 `WorldMapInputIntent`，并能从日志对齐输入事实与 action 执行。
- 文档与代码事实一致，旧实现不留在当前项目目录中。
