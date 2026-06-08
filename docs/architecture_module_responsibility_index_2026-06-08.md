# 架构模块职责索引 / Architecture Module Responsibility Index

日期 / Date: 2026-06-08

状态 / Status: active technical document

用途 / Purpose:

这份文档是长期开发的模块地图 / module map。每次架构推进后都要同步更新这里，让后续开发者只读这份文档就能知道：

- 每个文件负责什么 / module responsibility
- 当前状态是什么 / stability status
- 公开类、函数、命令叫什么 / public classes, functions, commands
- 新功能应该从哪里扩展 / extension path
- 哪些文件不能继续塞职责 / legacy boundaries

## 0. 文档规范 / Documentation Convention

统一风格 / Standard style:

- 中文为主，英文用于模块名、函数名、架构关键词对照。
- Section titles use bilingual labels where useful, for example `负责 / Owns`.
- Code identifiers stay in English, for example `CanvasGameShell.ensureCanvasLayer()`.
- 每次修改模块职责、公开 API、扩展方式、状态，都必须同步更新本文件。

字段模板 / Module Entry Template:

```md
### `path/to/File.js`

状态 / Status: candidate

负责 / Owns:
- ...

公开 API / Public API:
- `functionName()`

扩展方式 / Extension Path:
- ...

回归 / Regression:
- `npm run test:architecture`
```

## 1. 如何使用 / How To Use

1. Find the target domain in the tables below.
2. Check whether the module is `stable`, `candidate`, `active-refactor`, or `legacy`.
3. If the module is stable, extend through the listed extension path instead of editing internals.
4. If the module is legacy, prefer adding an adapter/new module and then shrinking legacy responsibilities.
5. Update this document in the same change whenever a module's responsibility, public API, or extension path changes.

状态说明 / Status Meanings:

- `stable`: feature iteration should not edit internals except bug/perf/security/contract fixes.
- `candidate`: boundary is useful but still being proven by tests.
- `active-refactor`: currently being reshaped; changes are expected.
- `legacy`: oversized or mixed responsibility; do not add new responsibility here.
- `test`: regression owner.

## 2. 已完成或候选模块 / Completed Or Candidate Modules

### `frontend/js/config/GameConfig.js`

状态 / Status: candidate

负责 / Owns:

- 前端运行时常量 / frontend runtime constants
- 集中的 `FEATURES` 配置对象 / centralized feature config object
- 默认关闭战争迷雾：`FOG_OF_WAR_ENABLED: false`
- 默认关闭调试覆盖层：`DEBUG_OVERLAYS_ENABLED: false`

公开 API / Public API:

- `GameConfig.API_BASE`
- `GameConfig.SYNC_INTERVAL_MS`
- `GameConfig.HEARTBEAT_INTERVAL_MS`
- `GameConfig.UPDATE_CHECK_INTERVAL_MS`
- `GameConfig.TUTORIAL_*`
- `GameConfig.FEATURES.FOG_OF_WAR_ENABLED`
- `GameConfig.FEATURES.DEBUG_OVERLAYS_ENABLED`
- `GameConfig.TABS`

扩展方式 / Extension Path:

- 新增功能开关统一放到 `FEATURES`。
- 玩法或渲染模块不要直接读取 `FEATURES`；统一使用 `FeatureFlags`。

回归 / Regression:

- `node --check frontend/js/config/GameConfig.js`
- feature consumers should have focused tests.

### `frontend/js/config/FeatureFlags.js`

状态 / Status: candidate

负责 / Owns:

- 解析功能开关默认值 / resolving defaults
- 严格判断开关是否显式开启 / strict enable checks
- 支持测试或灰度时传入覆盖值 / runtime overrides

公开 API / Public API:

- `FeatureFlags.DEFAULTS`
- `FeatureFlags.resolve(config, overrides)`
- `FeatureFlags.isEnabled(config, key)`

扩展方式 / Extension Path:

- 新增开关时，先在 `DEFAULTS` 增加默认值。
- 消费方统一调用 `FeatureFlags.isEnabled(config, key)`。
- 除兼容 fallback 外，下游模块不要直接比较原始 config 值。

回归 / Regression:

- `node --test frontend/js/config/FeatureFlags.test.js`

### `frontend/js/config/AssetKeyRegistry.js`

状态 / Status: candidate

负责 / Owns:

- 稳定资源 key 到当前文件路径的映射 / stable asset key to current file path mapping
- 公共 UI、tech、building、world-site、tutorial、battle background 资源索引
- 预加载分组 key / preload group keys
- 扩展 registry 的无侵入创建 / extension registry creation without editing the base registry

公开 API / Public API:

- `AssetKeyRegistry.version`
- `AssetKeyRegistry.definitions`
- `AssetKeyRegistry.keys`
- `AssetKeyRegistry.createRegistry(definitions)`
- `AssetKeyRegistry.extend(extraDefinitions)`
- `AssetKeyRegistry.getAssetDefinition(key)`
- `AssetKeyRegistry.getAssetPath(key, fallbackPath)`
- `AssetKeyRegistry.getAssetPaths(assetKeys, options)`
- `AssetKeyRegistry.getPreloadAssetKeys(group)`
- `AssetKeyRegistry.getPreloadAssetPaths(group)`
- `AssetKeyRegistry.getDomainAssetKeys(domain)`

性能约束 / Performance Constraints:

- Registry 构建只做一次，默认导出冻结对象。
- 运行时不扫描目录、不发网络请求、不做异步发现。
- path 输出保持确定顺序并去重，适合预加载和缓存 warm-up。

扩展方式 / Extension Path:

- 新资源先增加稳定 key，再让 renderer/presenter/manifest 消费 key。
- 新玩法或新 UI 不要继续把文件名当公共 API 传播。
- 如果要灰度或替换资源，用 `extend()` 创建扩展 registry，而不是改调用方硬编码 path。

回归 / Regression:

- `node --test frontend/js/config/AssetKeyRegistry.test.js`

### `frontend/js/platform/CanvasLayerRegistry.js`

状态 / Status: candidate

负责 / Owns:

- Shell 拥有的画布层契约 / shell-owned canvas layer contracts
- 稳定 layer key
- 默认 `zIndex`
- 默认 `contextType`
- layer 级 feature gate

公开 API / Public API:

- `CanvasLayerRegistry.LAYERS`
- `CanvasLayerRegistry.getLayer(name)`
- `CanvasLayerRegistry.getLayerName(name)`
- `CanvasLayerRegistry.getLayerOptions(name, overrides)`
- `CanvasLayerRegistry.isLayerEnabled(name, config, options)`

当前图层 / Current Layers:

- `worldMap`: key `worldMap`, `zIndex: 997`, `contextType: 2d`
- `worldFog`: key `worldFog`, `zIndex: 998`, `contextType: webgl`, gated by `FOG_OF_WAR_ENABLED`

扩展方式 / Extension Path:

- 新增 shell-owned layer 必须先注册到这里。
- 需要开关控制的 layer 必须配置 `feature` key。
- 图层生命周期必须通过 `CanvasGameShell` helper，不允许 renderer 直接接管。

回归 / Regression:

- `node --test frontend/js/platform/CanvasLayerRegistry.test.js`

### `frontend/js/platform/CanvasGameShell.js`

状态 / Status: active-refactor

负责 / Owns:

- 组合 shell modules 的兼容 facade
- shell 状态字段 / shell state fields
- 注入 runtime/config/layer registry 依赖
- shell 层级 canvas layer helper
- H5 shell 静态挂载入口 / static mount entry

P0 新增公开 API / Public API Added During P0:

- `CanvasGameShell.mount(game, options)`
- `getCanvasLayerRegistry()`
- `getCanvasLayerName(name)`
- `getCanvasLayerOptions(name, overrides)`
- `isCanvasLayerEnabled(name)`
- `ensureCanvasLayer(name, overrides)`
- `getCanvasLayerCanvas(name)`
- `getCanvasLayerMetrics(name, fallback)`
- `setCanvasLayerTranslate(name, x, y)`
- `clearCanvasLayerTransform(name)`
- `setCanvasLayerVisible(name, visible)`
- `isFogOfWarEnabled()`
- `isDebugOverlayEnabled(name)`
- `createDebugOverlaySnapshot(context, options)`

扩展方式 / Extension Path:

- 只有跨 shell modules 共用的生命周期 helper 才能加到这里。
- 具体功能行为应放到 shell module、domain 或 system 文件。
- 新增 layer 必须先声明在 `CanvasLayerRegistry`。
- 调试覆盖层只通过 `DebugOverlayRegistry` 产出 snapshot，不在 shell 内拼字段。

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShell.test.js`

### `frontend/js/platform/CanvasGameShellMounting.js`

状态 / Status: candidate

负责 / Owns:

- 向 `CanvasGameShell` 安装 mounting 相关方法
- 创建主 renderer
- 创建 world map renderer layer
- 仅在 fog layer 启用时创建 fog renderer
- 在主 renderer 和 world map renderer 之间共享缓存

安装到 shell 的公开 API / Public API Installed On Shell:

- `createRenderer(canvas)`
- `mount(game)`

扩展方式 / Extension Path:

- 图层生命周期统一使用 `shell.ensureCanvasLayer()` 和 `shell.getCanvasLayerMetrics()`。
- 不要在这里硬编码 layer name、`zIndex` 或 `contextType`。
- 这里可以创建 renderer，但不能加入玩法规则。

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShell.test.js`

### `frontend/js/platform/CanvasGameShellWorldMapRuntime.js`

状态 / Status: active-refactor

负责 / Owns:

- world map runtime coordinator 集成
- world map layer metrics 同步
- world map layer 渲染请求
- 拖拽 compositor 行为 / drag compositor behavior
- 通过 shell helpers 管理 world map layer 可见性和 transform
- 仅在 fog feature 启用时分发 fog render
- fog 开启时通过 `WorldMapVisualPluginRegistry` 获取 visual plugin renderer context

重要安装方法 / Important Installed Methods:

- `ensureWorldMapRuntimeCoordinator()`
- `ensureWorldMapRuntime()`
- `isWorldMapHomeActive()`
- `syncWorldMapRendererLayerMetrics()`
- `renderWorldFogLayer(context)`
- `renderRuntimeWorldMap(state, options)`
- `shouldRenderRuntimeWorldMap(state, options)`
- `getWorldMapLayerPadding()`
- `updateWorldMapDragCompositor()`
- `clearWorldMapLayerTransform()`
- `setWorldMapLayerVisible(visible)`
- `refreshWorldMapLayerFromSnapshot(options)`
- `renderWorldMapLayerFrame(options)`
- `requestWorldMapRenderAnimationFrame(options)`
- `renderWorldMapLayer(state, options)`
- `startTileMapWaterTimer()`
- `stopTileMapWaterTimer()`

扩展方式 / Extension Path:

- 在 `WorldMapRuntime` 完全拆清之前，camera/runtime coordination 可以继续在这里收口。
- 图层生命周期必须走 `CanvasGameShell` helpers。
- visibility/fog 玩法规则不能加在这里；只能消费 `WorldMapVisualPluginRegistry` 输出的 renderer context。

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShell.test.js`

### `frontend/js/platform/renderers/WorldFogCanvasRenderer.js`

状态 / Status: frozen-candidate

负责 / Owns:

- WebGL fog mask rendering
- mask texture upload/cache
- fog shader program setup
- fog 视觉层 clear/render 行为

公开 API / Public API:

- `new WorldFogCanvasRenderer(options)`
- `setMetrics(metrics)`
- `clear()`
- `renderWorldFog(tileMapContext)`
- static shader sources: `VERTEX_SHADER_SOURCE`, `FRAGMENT_SHADER_SOURCE`

扩展方式 / Extension Path:

- 当 `FOG_OF_WAR_ENABLED` 为 false 时默认不使用。
- 后续 fog gameplay 不允许加在这里。
- P2-001 后，本 renderer 应优先接收 `WorldFogVisualSnapshot.toRendererContext()` 输出的 context。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js`

### `frontend/js/platform/renderers/CanvasPreloadAssetManifest.js`

状态 / Status: candidate

负责 / Owns:

- Canvas 运行时基础资源预加载清单 / base preload manifest for canvas runtime
- 通过 `AssetKeyRegistry` 将稳定 preload keys 解析为当前文件路径
- 组合动态资源：tutorial/world scout unit frames、tile map manifest paths、battle unit frames、famous portrait layers
- 保持旧接口返回 path 数组，兼容当前 asset cache 和 renderer preload 流程

公开 API / Public API:

- `CanvasPreloadAssetManifest.getBasePreloadAssetKeys()`
- `CanvasPreloadAssetManifest.getBasePreloadAssetPaths()`
- `CanvasPreloadAssetManifest.getTutorialMarchUnitFramePaths()`
- `CanvasPreloadAssetManifest.getWorldScoutUnitFramePaths()`
- `CanvasPreloadAssetManifest.getBattleUnitFramePaths(rendererClass)`
- `CanvasPreloadAssetManifest.getFamousPortraitLayerPaths(layout)`
- `CanvasPreloadAssetManifest.getTileMapPreloadAssetPaths(manifest)`
- `CanvasPreloadAssetManifest.getPreloadAssetPaths(options)`

性能约束 / Performance Constraints:

- 基础资源用冻结 key 列表，不在运行时扫描文件系统。
- 输出路径去重，避免同一帧或同一图标重复发起加载。
- 仍然只返回字符串路径，不持有 image/canvas/WebGL 对象。

扩展方式 / Extension Path:

- 新的公共静态资源先加到 `AssetKeyRegistry`，再加入 `getBasePreloadAssetKeys()` 使用的 key 列表。
- 动态资源仍由各自 manifest 产出 paths，但后续应逐步迁移到 stable keys。
- 不要在 renderer 内新建独立 preload 列表；统一从本 manifest 组合。

回归 / Regression:

- `node --test frontend/js/platform/renderers/CanvasPreloadAssetManifest.test.js`

### `frontend/js/domain/WorldMapVisibilityModel.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 visibility/explored/controlled 的纯 domain snapshot
- 将 tile、mission reveal、active mission position 合并为可序列化 visibility arrays
- 为后续 fog renderer、world map renderer、debug overlay 提供统一输入
- 性能友好的紧凑数据结构 / compact arrays for large maps

公开 API / Public API:

- `WorldMapVisibilityModel.createSnapshot(input, options)`
- `WorldMapVisibilityModel.getLevel(snapshot, id)`
- `WorldMapVisibilityModel.isExplored(snapshot, id)`
- `WorldMapVisibilityModel.isVisible(snapshot, id)`
- `WorldMapVisibilityModel.levelName(level)`
- `WorldMapVisibilityModel.normalizeLevel(value, options)`
- `WorldMapVisibilityModel.readTileVisibility(tile, options)`
- `WorldMapVisibilityModel.toSerializable(snapshot)`
- constants: `LEVEL_UNKNOWN`, `LEVEL_EXPLORED`, `LEVEL_VISIBLE`, `LEVEL_CONTROLLED`, `LEVEL_NAMES`

性能约束 / Performance Constraints:

- Snapshot stores parallel arrays: `tileIds`, `q`, `r`, `levels`, `intelLevels`.
- `indexById` is an object map for O(1) lookup.
- No renderer objects, DOM objects, canvas context, or WebGL resources.
- Signature uses incremental FNV-style hashing, not `JSON.stringify`.
- Avoid per-frame use until the caller can cache by `signature`.

扩展方式 / Extension Path:

- 新的 visibility 来源要通过 `createSnapshot()` 的 input 合并，不直接写 renderer。
- Fog of war P2 should consume this snapshot instead of reading raw tiles.
- 新增等级时必须同步 constants、tests、docs。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapVisibilityModel.test.js`

### `frontend/js/domain/WorldMapEntitySnapshot.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 entities/components 的纯 domain snapshot
- 将 tiles、sites、missions、actors 归一化成稳定实体集合
- 复用 `WorldMapVisibilityModel` 的 visibility snapshot
- 为 renderer、action adapter、debug overlay、fog rebuild 提供共同输入

公开 API / Public API:

- `WorldMapEntitySnapshot.createSnapshot(input, options)`
- `WorldMapEntitySnapshot.getEntity(snapshot, kind, id)`
- `WorldMapEntitySnapshot.normalizeTile(tile, visibilitySnapshot)`
- `WorldMapEntitySnapshot.normalizeSite(site)`
- `WorldMapEntitySnapshot.normalizeMission(mission)`
- `WorldMapEntitySnapshot.normalizeActor(actor)`
- `WorldMapEntitySnapshot.normalizeCoord(source, fallback)`
- `WorldMapEntitySnapshot.tileId(q, r)`

性能约束 / Performance Constraints:

- Snapshot keeps flat arrays: `tiles`, `sites`, `missions`, `actors`.
- Lookup uses `indexById.{tiles,sites,missions,actors}` for O(1) entity access.
- Does not deep-copy backend payloads or renderer objects.
- Signature uses incremental hashing over compact identity/status fields.
- Large map tests cover 4000 tiles without nested `entitiesById` maps.

扩展方式 / Extension Path:

- 新 world map entity type 先在这里定义 normalized shape，再由 renderer/action/debug 消费。
- 不要让 renderer 从 raw API state 自己推导 entity/component。
- 新增字段必须同步测试和本文件公开 API/职责说明。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapEntitySnapshot.test.js`

### `frontend/js/domain/WorldMapPerformanceBudget.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图大地图性能预算门禁 / large world-map performance budget gates
- 检查 visibility/entity/render snapshot 的结构预算
- 检查 compact arrays、O(1) index maps、serializable payload size
- 为后续 perf smoke 和 cache invalidation tests 提供统一报告格式

公开 API / Public API:

- `WorldMapPerformanceBudget.DEFAULT_BUDGETS`
- `WorldMapPerformanceBudget.checkVisibilitySnapshot(snapshot, budgets)`
- `WorldMapPerformanceBudget.checkEntitySnapshot(snapshot, budgets)`
- `WorldMapPerformanceBudget.checkRenderSnapshot(snapshot, budgets)`
- `WorldMapPerformanceBudget.combineReports(reports, meta)`
- `WorldMapPerformanceBudget.assertReport(report, message)`
- `WorldMapPerformanceBudget.createReport(checks, meta)`
- `WorldMapPerformanceBudget.getSerializableSizeBytes(value)`

性能约束 / Performance Constraints:

- 预算检查是纯同步函数，不依赖浏览器、canvas、DB、network。
- 不使用易波动的绝对 FPS 阈值作为硬门槛。
- 大地图结构退化时必须失败：nested entity maps、renderer tile payload copied into serializable output、parallel arrays 长度不一致。

扩展方式 / Extension Path:

- 新的大地图 snapshot 或 cache policy 先增加 check，再加入 tests 和 architecture smoke。
- 如需真实帧耗时采样，作为 meta 或单独 perf smoke，不替代结构预算。
- 不要在 gameplay/render hot path 每帧调用预算检查；它是测试/诊断边界。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapPerformanceBudget.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMarchProgressSnapshot.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图行军 progress/arrival 的纯 domain snapshot
- 将 raw mission 归一化成 `missions`、`actors`、`arrivals` 三类扁平行
- 统一手动行军抵达 `idle` 和随机探索抵达 `ready` 的结果语义
- 为 renderer、HUD、action adapter、debug overlay 提供可测试、可序列化的行军输入
- 保留 `remainingSeconds` 与 `travelRemainingSeconds` 的区别：前者兼容下一步/旧 HUD 倒计时，后者表示到终点的剩余总行程

公开 API / Public API:

- `WorldMarchProgressSnapshot.createSnapshot(input, options)`
- `WorldMarchProgressSnapshot.normalizeMissionProgress(mission, options)`
- `WorldMarchProgressSnapshot.getMission(snapshot, id)`
- `WorldMarchProgressSnapshot.getActor(snapshot, id)`
- `WorldMarchProgressSnapshot.getArrival(snapshot, id)`
- `WorldMarchProgressSnapshot.getArrivals(snapshot)`
- `WorldMarchProgressSnapshot.buildActorFromMission(mission, options)`
- `WorldMarchProgressSnapshot.buildActors(worldExplorerState, options)`
- `WorldMarchProgressSnapshot.buildActorFromProgress(row)`
- `WorldMarchProgressSnapshot.buildArrivalFromProgress(row)`
- `WorldMarchProgressSnapshot.deriveMissionForTime(mission, options)`
- `WorldMarchProgressSnapshot.getMissionProgress(mission, nowMs)`
- `WorldMarchProgressSnapshot.getEffectiveMissionStatus(mission, nowMs)`
- `WorldMarchProgressSnapshot.getCurrentCoord(mission, nowMs)`
- `WorldMarchProgressSnapshot.chooseStopTile(mission, nowMs)`
- `WorldMarchProgressSnapshot.getRemainingSeconds(mission, nowMs)`
- `WorldMarchProgressSnapshot.getTravelRemainingSeconds(mission, nowMs)`
- `WorldMarchProgressSnapshot.toSerializable(snapshot)`
- constants: `STATUS_ACTIVE`, `STATUS_READY`, `STATUS_IDLE`, `ARRIVAL_NONE`, `ARRIVAL_READY`, `ARRIVAL_IDLE`

性能约束 / Performance Constraints:

- Snapshot keeps flat arrays: `missions`, `actors`, `arrivals`.
- Lookup uses `indexById.{missions,actors,arrivals}` for O(1) access.
- Signature uses incremental FNV-style hashing over compact progress/status fields.
- Large-mission regression covers 2000 missions without nested `missionsById` or `entitiesById` maps.
- No renderer objects, DOM objects, canvas contexts, WebGL resources, or backend service imports.

扩展方式 / Extension Path:

- 新的行军结果类型先扩展 `arrivalKind` / constants，再通过 `buildArrivalFromProgress()` 输出新行。
- 新 UI/HUD 不要从 raw mission 自己推导抵达状态；消费 `createSnapshot()` 的 `missions`、`actors`、`arrivals`。
- 新功能需要额外展示字段时，优先在 `normalizeMissionProgress()` 增加稳定 row 字段，并同步测试和本索引。
- 旧 `WorldMarchSystem` 继续作为兼容 facade；不要把新的 gameplay march rule 加回旧文件。

回归 / Regression:

- `node --test frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/domain/WorldMarchSystem.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMarchSystem.js`

状态 / Status: active-refactor facade

负责 / Owns:

- 保留旧世界行军 public API，避免一次性改动 renderer/HUD/presenter 调用
- 继续承接 tile screen geometry、screen point to axial tile、march target UI state 等旧 helper
- 行军进度、抵达状态、actor 生成等 gameplay calculation 已委托 `WorldMarchProgressSnapshot`

公开 API / Public API:

- `WorldMarchSystem.getMissionProgress(mission, nowMs)`
- `WorldMarchSystem.getEffectiveMissionStatus(mission, nowMs)`
- `WorldMarchSystem.deriveMissionForTime(mission, options)`
- `WorldMarchSystem.getCurrentCoord(mission, nowMs)`
- `WorldMarchSystem.chooseStopTile(mission, nowMs)`
- `WorldMarchSystem.getRemainingSeconds(mission, nowMs)`
- `WorldMarchSystem.buildActorFromMission(mission, options)`
- `WorldMarchSystem.buildActors(worldExplorerState, options)`
- `WorldMarchSystem.getTileScreenCenter(coord, viewport, geometry)`
- `WorldMarchSystem.screenPointToNearestTile(point, tileMapView, viewport)`
- `WorldMarchSystem.screenPointToAxialTile(point, viewport, geometry)`
- `WorldMarchSystem.getMarchTargetUiState(uiState)`

扩展方式 / Extension Path:

- 新行军玩法规则加到 `WorldMarchProgressSnapshot` 或后续 `systems` 模块，不加到本文件。
- 新 screen/input mapping 应进入 input/action adapter，而不是继续扩大本 facade。
- 后续 P1/P2 可以逐步让 renderer/HUD 直接消费 `WorldMarchProgressSnapshot`，再缩小本文件。

回归 / Regression:

- `node --test frontend/js/domain/WorldMarchSystem.test.js frontend/js/domain/WorldMarchProgressSnapshot.test.js`

### `frontend/js/domain/WorldMapRenderSnapshot.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 renderer 的单一输入合同 / single render input contract
- 将 `tileMapView`、`frame`、`viewport`、`uiState`、render flags、march actors、arrival rows 收束为一个 snapshot
- 为 `WorldMapCanvasRenderer`、fog rebuild、hit target builder、debug overlay 后续拆分提供共同上下文
- 保留大数组引用而不是深拷贝 tiles，避免每帧制造大 payload

公开 API / Public API:

- `WorldMapRenderSnapshot.createSnapshot(input, options)`
- `WorldMapRenderSnapshot.getTileMapView(snapshot)`
- `WorldMapRenderSnapshot.getViewport(snapshot)`
- `WorldMapRenderSnapshot.getFrame(snapshot)`
- `WorldMapRenderSnapshot.getActors(snapshot)`
- `WorldMapRenderSnapshot.getArrivals(snapshot)`
- `WorldMapRenderSnapshot.normalizeViewport(tileMapView, frameInput, options)`
- `WorldMapRenderSnapshot.normalizeFrame(input)`
- `WorldMapRenderSnapshot.normalizeUiState(uiState)`
- `WorldMapRenderSnapshot.normalizeFlags(options)`
- `WorldMapRenderSnapshot.normalizeMarchTarget(target)`
- `WorldMapRenderSnapshot.toSerializable(snapshot)`

性能约束 / Performance Constraints:

- `tileMapView` is held by reference; large `tiles` arrays are not deep-copied.
- `counts` stores compact metrics for tiles/sites/scouts/actors/arrivals.
- Signature uses incremental FNV-style hashing over compact identity/layout fields.
- Serializable output excludes renderer payloads such as raw `tileMapView`, canvas contexts, DOM nodes, and cache objects.
- March actors come from `WorldMarchProgressSnapshot`, keeping gameplay status derivation outside renderers.

扩展方式 / Extension Path:

- 新 renderer 拆分模块应优先接收 `renderSnapshot`，而不是各自重新组合 `tileMapView + viewport + uiState`。
- 新 debug overlay 可以消费 `toSerializable()`，不要读取 canvas/runtime object。
- 新 render flag 先加到 `normalizeFlags()`，同步测试与本索引。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapRenderSnapshot.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapLayoutModel.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 tile layout/cache 的纯计算模块 / pure world-map layout/cache model
- 计算 tile screen center、draw rect、overlay anchor、site layout
- 从 local tile entries 推导 visible render entries
- 计算 static world cache、viewport cache、chunk cache、drag cache layout
- 为 `WorldMapCanvasRenderer` 提供兼容委托目标，先抽 math，不移动 canvas drawing

公开 API / Public API:

- `WorldMapLayoutModel.getWorldTileScreenCenter(tile, viewport, geometry, options)`
- `WorldMapLayoutModel.getWorldTileDrawRect(center, scale, geometry, options)`
- `WorldMapLayoutModel.getWorldOverlayAnchor(tile, viewport, geometry, targetKey, explicitOffset, centerOverride, options)`
- `WorldMapLayoutModel.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center, options)`
- `WorldMapLayoutModel.getWorldTileLocalEntriesCacheKey(tileMapView, viewport, geometry)`
- `WorldMapLayoutModel.getWorldTileRenderEntriesCacheKey(tileMapView, viewport, frame)`
- `WorldMapLayoutModel.getWorldTileLocalViewport(viewport)`
- `WorldMapLayoutModel.getWorldTileLocalEntries(tileMapView, viewport, geometry, options)`
- `WorldMapLayoutModel.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry, options)`
- `WorldMapLayoutModel.getWorldTileAtlasFramePadding(geometry, viewport)`
- `WorldMapLayoutModel.getWorldTileStaticCacheLayout(tileMapView, viewport, geometry, options)`
- `WorldMapLayoutModel.getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries)`
- `WorldMapLayoutModel.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry, options)`
- `WorldMapLayoutModel.getWorldTileStaticDragCacheLayout(tileMapView, viewport, frame, geometry, options)`

性能约束 / Performance Constraints:

- No canvas, DOM, WebGL, renderer instance, runtime object, or gameplay mutation.
- Cache keys use map signature/version/seed/count/rounded viewport fields; they do not serialize tile payloads.
- Entry generation uses indexed loops and can receive precomputed `localEntries` to avoid duplicate projection work.
- Static/chunk/drag cache layout receives renderer policy values (`chunkSize`, `pixelBudget`, `cacheScale`, `panRange`) as inputs instead of reading globals.
- Site image metrics are injected through `analyzeAssetAlphaBounds`; the model never loads assets directly.

扩展方式 / Extension Path:

- 新的 world-map layout/cache math should extend this model first, then expose compatibility methods through `WorldMapCanvasRenderer` only when old callers need them.
- 新 drawing, water animation, fog, hit-target, or gameplay rules should not enter this file.
- If a calculation becomes stable after more P3 steps, mark the specific API as stable and add focused regression before feature work depends on it.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapLayoutModel.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapLayoutFacade.js`

状态 / Status: candidate

职责 / Owns:

- compatibility facade around `WorldMapLayoutModel`
- projection and draw-rect helper fallback
- overlay anchor and site layout compatibility
- local and visible render-entry cache state
- static cache layout and viewport cache layout helper fallback
- chunk static layout and drag cache layout fallback
- rendered diamond center fallback
- split implementation for layout helper compatibility methods on `WorldMapCanvasRenderer`

公开 API / Public API:

- `new WorldMapLayoutFacade({ host })`
- `getWorldTileScreenCenter(tile, viewport, geometry)`
- `getWorldTileDrawRect(center, scale, geometry)`
- `getWorldOverlayAnchor(tile, viewport, geometry, targetKey, explicitOffset, centerOverride)`
- `getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center)`
- `getWorldTileRenderEntries(tileMapView, viewport, frame, geometry)`
- `getWorldTileLocalEntries(tileMapView, viewport, geometry)`
- `getWorldTileRenderedDiamondCenter(tile, drawRect)`
- `getWorldTileStaticCacheLayout(tileMapView, viewport, geometry)`
- `getWorldTileStaticViewportCacheLayout(tileMapView, viewport, frame, entries)`
- `getWorldTileAtlasFramePadding(geometry, viewport)`
- `getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, geometry)`
- `getWorldTileStaticDragCacheLayout(tileMapView, viewport, frame, geometry)`

性能约束 / Performance Constraints:

- Uses `WorldMapLayoutModel` cache keys when available.
- Local and visible entries are cached by compact signatures.
- Fallback layout loops are linear over provided tile/entry arrays.
- Cache keys do not serialize tile payloads.
- No canvas drawing, no asset loading, no gameplay mutation.

扩展方式 / Extension Path:

- 新 pure layout math 仍扩展 `WorldMapLayoutModel`。
- 新 compatibility cache/fallback behavior 先扩展本模块。
- 新 cache identity policy 仍扩展 `WorldMapCachePolicy`。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapRenderUtilityFacade.js`

状态 / Status: candidate

职责 / Owns:

- 世界地图 render utility compatibility facade / low-level render helper facade
- fallback iso diamond drawing through the host canvas context
- fallback terrain fill color policy
- deterministic `hashString(input)`
- deterministic `random01(seed, q, r, salt)` used by terrain/feature visual jitter
- compatibility method implementation for old `WorldMapCanvasRenderer` utility helper names

公开 API / Public API:

- `new WorldMapRenderUtilityFacade({ host })`
- `drawIsoDiamond(cx, cy, width, height, options)`
- `getFallbackTerrainFill(terrain)`
- `hashString(input)`
- `random01(seed, q, r, salt)`

性能约束 / Performance Constraints:

- Deterministic helpers use only primitive inputs and do not read gameplay or cache state.
- `drawIsoDiamond()` only performs the immediate canvas path draw requested by the caller.
- `random01()` is stable across runs and avoids allocating RNG objects.
- No layer lifecycle, cache ownership, hit-target registration, input mapping, or gameplay simulation.

扩展方式 / Extension Path:

- New generic renderer utility helpers can extend this facade when they are shared by multiple world-map renderers.
- New tile/site layout math still belongs in `WorldMapLayoutModel` or `WorldMapLayoutFacade`.
- New visual content rules still belong in the owning renderer module, such as `WorldMapStaticEntryRenderer`.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapRenderUtilityFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapCacheConfigFacade.js`

状态 / Status: candidate

职责 / Owns:

- 世界地图 cache performance config compatibility facade / cache tuning knob facade
- static chunk size: `getWorldTileStaticChunkSize()`
- static chunk cache limit and scale
- fast-drag cache pan reuse range
- static cache scale derived from `pixelRatio`
- static cache pixel budget
- compatibility method implementation for old `WorldMapCanvasRenderer` cache config helper names

公开 API / Public API:

- `new WorldMapCacheConfigFacade({ host })`
- `getWorldTileStaticChunkSize()`
- `getWorldTileStaticChunkCacheLimit()`
- `getWorldTileStaticChunkCacheScale()`
- `getWorldTileDragCachePanRange()`
- `getWorldTileStaticCacheScale()`
- `getWorldTileStaticCachePixelBudget()`

性能约束 / Performance Constraints:

- Long-term cache knobs live in one facade so layout/cache/render modules do not hard-code divergent values.
- `getWorldTileStaticCacheScale()` clamps invalid or low `pixelRatio` values to at least `1`.
- The facade does not allocate canvas work, resize caches, draw layers, inspect gameplay state, or mutate render snapshots.
- Cache/layout modules consume this as configuration; cache identity still belongs in `WorldMapCachePolicy`, and cache work still belongs in `WorldMapLayerCacheStore`.

扩展方式 / Extension Path:

- New cache performance knobs should extend this facade first, with a focused test and a compatibility pass-through on `WorldMapCanvasRenderer` only when legacy callers need the old host method name.
- New cache key/layout/prune decisions still belong in `WorldMapCachePolicy`.
- New cache work reuse/blit behavior still belongs in `WorldMapLayerCacheStore`.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapCacheConfigFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/platform/renderers/WorldMapCacheFacade.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.js`

状态 / Status: candidate

职责 / Owns:

- 世界地图 renderer facade dependency registry / dependency lookup table
- stable dependency keys for `WorldMapCanvasRenderer`
- browser `global` lookup before CommonJS fallback
- CommonJS module path fallback for Node tests and minigame entrypoints
- per-registry cached dependency lookups
- extension point for future split renderer/facade dependencies
- `WorldMapRendererCompositionFactory` dependency key
- `WorldMapRendererHostBridge` dependency key

公开 API / Public API:

- `WorldMapRendererDependencyRegistry.DEFINITIONS`
- `WorldMapRendererDependencyRegistry.createRegistry(options)`
- `WorldMapRendererDependencyRegistry.resolve(key, options)`
- `WorldMapRendererDependencyRegistry.get(key)`
- `WorldMapRendererDependencyRegistry.getOrFallback(key, fallback)`

当前依赖键 / Current Dependency Keys:

- config/domain: `tileMapAssetManifest`, `tileMapGeometry`, `worldTime`, `unitSpriteManifest`
- actor/HUD/tutorial renderers: `worldActorCanvasRenderer`, `worldMarchHudCanvasRenderer`, `tutorialIntroUnitRenderer`
- composition: `worldMapRendererCompositionFactory`
- host bridge: `worldMapRendererHostBridge`
- world-map models/facades: `worldMapLayoutModel`, `worldMapLayoutFacade`, `worldMapRenderUtilityFacade`, `worldMapHitTargetModel`, `worldMapHitTargetFacade`, `worldMapCachePolicy`, `worldMapLayerCacheStore`, `worldMapCacheFacade`, `worldMapCacheConfigFacade`
- split renderers: `worldMapStaticLayerRenderer`, `worldMapStaticEntryRenderer`, `worldMapStaticChunkRenderer`, `worldMapWaterLayerRenderer`, `worldMapWaterEntryRenderer`, `worldMapSnapshotCacheRenderer`, `worldMapFastDragCompositeRenderer`, `worldMapScoutRenderer`, `worldMapSiteOverlayRenderer`, `worldMapMilitaryViewRenderer`, `worldMapFogMaskContextRenderer`, `worldMapTileMapRenderer`, `worldMapActorHudRenderer`

性能约束 / Performance Constraints:

- Dependency lookup happens once per registry cache key, not inside per-frame rendering.
- The registry does not instantiate renderers, allocate canvases, draw, bind input, or touch gameplay state.
- Missing optional dependencies return `null` or the caller fallback instead of throwing in the facade hot path.
- Definitions are frozen so feature work adds explicit keys instead of mutating runtime dependency state.

扩展方式 / Extension Path:

- New split renderer/facade dependencies add one registry definition and a focused load-order test.
- `WorldMapCanvasRenderer` should consume registry keys and should not grow repeated `global`/`require` blocks again.
- New rendering behavior still belongs in the owning renderer/facade module; this registry only resolves dependencies.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCacheConfigFacade.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapRendererCompositionFactory.js`

状态 / Status: candidate

职责 / Owns:

- 世界地图 renderer composition factory / child renderer composition boundary
- `WorldMapCanvasRenderer` child-host proxy creation
- injected child instance precedence over class fallback
- child renderer/facade instantiation from registry-backed dependencies
- actor renderer + march HUD renderer + actor HUD renderer wiring
- split renderer/facade composition for layout, render utility, hit-target, cache, cache config, static/water/snapshot/drag/scout/site/military/fog/tile-map modules

公开 API / Public API:

- `new WorldMapRendererCompositionFactory(options)`
- `WorldMapRendererCompositionFactory.create(options)`
- `createComposition()`
- `createChildHost()`
- `createInstance(instanceOptionKey, classOptionKey, dependencyKey, childHost, extraOptions)`
- `getDependency(key)`
- `getClass(optionKey, dependencyKey)`

性能约束 / Performance Constraints:

- Composition happens once per `WorldMapCanvasRenderer` instance, not per frame.
- Child renderer/facade references are cached on the main renderer after construction.
- The factory does not draw, allocate layer caches, register hit targets, inspect gameplay state, or mutate render snapshots.
- Child-host proxy forwards calls without cloning renderer/host state.

扩展方式 / Extension Path:

- New child renderer/facade modules add a dependency key to `WorldMapRendererDependencyRegistry`, then compose in this factory.
- `WorldMapCanvasRenderer` should not grow child renderer instantiation branches in its constructor.
- New rendering behavior still belongs in the owning child module; this factory only wires modules together.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapRendererHostBridge.js`

状态 / Status: candidate

职责 / Owns:

- 世界地图 renderer host bridge / legacy host compatibility proxy
- renderer-first property reads
- host fallback method binding
- `worldTile*` host state passthrough
- known host field writes
- compatibility proxy creation for `WorldMapCanvasRenderer`

公开 API / Public API:

- `new WorldMapRendererHostBridge({ renderer })`
- `WorldMapRendererHostBridge.createProxy(renderer)`
- `createProxy()`

性能约束 / Performance Constraints:

- Bridge proxy is created once per `WorldMapCanvasRenderer` instance.
- It does not draw, instantiate child renderers, allocate caches, register hit targets, or inspect gameplay state.
- Forwarding does not clone renderer/host state.
- New host compatibility behavior extends this bridge instead of reopening `WorldMapCanvasRenderer` constructor.

扩展方式 / Extension Path:

- New legacy host passthrough behavior extends this bridge first.
- Child renderer composition still belongs in `WorldMapRendererCompositionFactory`.
- Dependency keys still belong in `WorldMapRendererDependencyRegistry`.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapRendererHostBridge.test.js frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapHitTargetModel.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 hit-target 数据构建 / pure world-map hit target data creation
- 生成背景拖拽目标：`worldMapDrag`
- 生成 tile site 点击目标：`openWorldSite`
- 生成行军目标 tile：`selectWorldMarchTarget`
- 复用注入的 `WorldMapLayoutModel`，但不直接注册 hit target

公开 API / Public API:

- `WorldMapHitTargetModel.getWorldMapDragHitTarget(frame)`
- `WorldMapHitTargetModel.createWorldTileSiteHitTargets(tileMapView, viewport, entries, options)`
- `WorldMapHitTargetModel.createWorldMarchTileHitTargets(tileMapView, viewport, frame, options)`

性能约束 / Performance Constraints:

- No canvas, DOM, renderer instance, runtime object, gameplay mutation, or direct `addHitTarget()` call.
- Target creation is linear over visible entries or tiles.
- Site targets reuse injected layout calculations and injected image metrics.
- March targets use frame margin culling before returning target data.

扩展方式 / Extension Path:

- 新 world-map tile/site/march hit target should be added here first as data, then registered by `WorldMapCanvasRenderer` or a future hit-target registrar.
- New input-to-action interpretation still belongs in `WorldMapInputActionMap`; this file only builds geometry/action payloads.
- Modal/HUD/city command hit targets are not owned here yet; extract them only when their layout model has been separated.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapHitTargetModel.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapHitTargetFacade.js`

状态 / Status: candidate

职责 / Owns:

- 世界地图 hit-target compatibility facade / hit-target registration compatibility layer
- 兼容旧 renderer hit-target helper method names while delegating target data to `WorldMapHitTargetModel`
- site hit-target registration for `openWorldSite`
- march tile hit-target registration for `selectWorldMarchTarget`
- injected layout/model/asset dependencies for target data creation
- fallback target registration when the pure model is unavailable

公开 API / Public API:

- `new WorldMapHitTargetFacade({ host })`
- `getWorldMapHitTargetModel()`
- `getWorldMapLayoutModel()`
- `getTileMapGeometry()`
- `getTileMapAssetManifest()`
- `registerHitTargets(targets)`
- `addWorldTileSiteHitTargets(tileMapView, viewport, entries, uiState)`
- `addWorldMarchTileHitTargets(tileMapView, viewport, frame)`

性能约束 / Performance Constraints:

- Pure target geometry/action payloads remain in `WorldMapHitTargetModel`.
- Registration is linear over returned target rows and does not inspect unrelated hit targets.
- Fallback site registration is linear over visible entries; fallback march registration is linear over tiles with frame-margin culling.
- No canvas drawing, cache lifecycle, gameplay simulation, or input interpretation.

扩展方式 / Extension Path:

- New world-map background/site/march target data extends `WorldMapHitTargetModel` first.
- New compatibility helper names or legacy registration fallback extend this facade.
- New input-to-action interpretation still belongs in `WorldMapInputActionMap`.
- Modal/HUD/city command hit targets remain with their owning overlay/HUD modules until their own facade is split.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapHitTargetFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapHitTargetModel.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapCachePolicy.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 cache policy 的纯策略模块 / pure world-map cache policy
- 生成 static tile cache key、chunk cache key、scout route cache key、water layer cache key
- 选择 world/chunk/viewport cache layout，封装 pixel budget 决策
- 计算 chunk cache prune 顺序，不直接删除 cache map
- 计算 water chunk frame cache id 和 snapshot draw layout

公开 API / Public API:

- `WorldMapCachePolicy.round(value, precision)`
- `WorldMapCachePolicy.getFramePixels(layout, cacheScale)`
- `WorldMapCachePolicy.getEntrySignature(entries, options)`
- `WorldMapCachePolicy.getWorldTileStaticCacheKey(tileMapView, viewport, frame, entries, uiState, options)`
- `WorldMapCachePolicy.getWorldTileStaticChunkCacheKey(tileMapView, viewport, layout, uiState, options)`
- `WorldMapCachePolicy.getWorldTileScoutRouteCacheKey(tileMapView, viewport, frame, options)`
- `WorldMapCachePolicy.getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, entries, options)`
- `WorldMapCachePolicy.getWorldTileWaterChunkCacheKey(tileMapView, viewport, layout, waterEntries, options)`
- `WorldMapCachePolicy.getWorldTileWaterChunkFrameCacheId(layout, frameIndex)`
- `WorldMapCachePolicy.getWorldTileSnapshotDrawLayout(cachedLayout, viewport)`
- `WorldMapCachePolicy.getWorldTileSnapshotChunkDrawLayout(work, viewport)`
- `WorldMapCachePolicy.intersectsFrame(layout, frame)`
- `WorldMapCachePolicy.resolveWorldTileStaticCacheLayout(input)`
- `WorldMapCachePolicy.getPrunableCacheKeys(cacheMap, activeKeys, limit)`

性能约束 / Performance Constraints:

- No canvas, DOM, WebGL, renderer instance mutation, offscreen work creation, or direct cache deletion.
- Cache key generation uses compact identity fields and rounded layout numbers.
- Pixel-budget layout choice is pure and deterministic.
- Prune calculation preserves active keys and returns least-recent stale keys first.
- Snapshot draw layout math can be tested without `drawImage()`.

扩展方式 / Extension Path:

- 新 cache key field、cache layout decision、chunk prune policy 先扩展本文件，再由 `WorldMapCanvasRenderer` 兼容方法委托。
- Actual cache canvas allocation, context reset, and layer drawing stay in renderer/cache renderer modules, not here.
- Water animation frame timing can later move to a sibling pure module; this policy only owns cache identity and frame cache IDs.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapCachePolicy.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapLayerCacheStore.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 offscreen layer cache work 的窄缓存模块 / narrow offscreen layer cache store
- 归一化 logical size、pixel size、cache scale
- 创建临时 layer work：`{ canvas, ctx, width, height, pixelWidth, pixelHeight, scale }`
- 复用/resize renderer 上的 named cache work
- 计算并执行 clipped cache blit

公开 API / Public API:

- `WorldMapLayerCacheStore.normalizeWorkSize(width, height, cacheScale)`
- `WorldMapLayerCacheStore.assignWorkSize(work, size)`
- `WorldMapLayerCacheStore.resizeCanvas(canvas, pixelWidth, pixelHeight)`
- `WorldMapLayerCacheStore.createLayerWork(width, height, cacheScale, options)`
- `WorldMapLayerCacheStore.getLayerCacheContext(store, cacheName, width, height, cacheScale, options)`
- `WorldMapLayerCacheStore.getVisibleBlit(work, layout, clipFrame)`
- `WorldMapLayerCacheStore.drawLayerCache(targetCtx, work, layout, clipFrame)`

性能约束 / Performance Constraints:

- Canvas creation is injected through `options.createCanvas`; the module does not know renderer/game state.
- Named cache work is reused and resized in place.
- Blit clipping avoids drawing fully clipped caches and bounds source rectangles to canvas dimensions.
- No gameplay, tile semantics, asset loading, or hit-target registration.

扩展方式 / Extension Path:

- 新 generic offscreen cache work helper 先加到本文件，再由 renderer/facade 委托。
- Layer-specific render content remains in renderer modules.
- Cache identity and prune decisions remain in `WorldMapCachePolicy`, not here.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapCacheFacade.js`

状态 / Status: candidate

职责 / Owns:

- 世界地图 cache compatibility facade / cache compatibility composition layer
- 兼容旧 renderer cache helper method names while delegating to sealed lower-level blocks
- static tile cache key and scout route cache key handoff to `WorldMapCachePolicy`
- named layer cache context reuse and temporary layer work handoff to `WorldMapLayerCacheStore`
- clipped cache blit handoff to `WorldMapLayerCacheStore`
- static cache layout resolution handoff to `WorldMapCachePolicy`
- fallback behavior only when policy/store helpers are unavailable

公开 API / Public API:

- `new WorldMapCacheFacade({ host })`
- `getWorldMapCachePolicy()`
- `getWorldMapLayerCacheStore()`
- `getWorldTileStaticCacheKey(tileMapView, viewport, frame, entries, uiState, options)`
- `getWorldTileLayerCacheContext(cacheName, width, height, cacheScale)`
- `getWorldTileStaticCacheContext(width, height, cacheScale)`
- `getWorldTileScoutRouteCacheContext(width, height, cacheScale)`
- `getWorldTileWaterLayerCacheContext(width, height, cacheScale)`
- `createWorldTileLayerWork(width, height, cacheScale)`
- `drawWorldTileLayerCache(work, layout, clipFrame)`
- `resolveWorldTileStaticCacheLayout(tileMapView, viewport, frame, entries)`
- `getWorldTileScoutRouteCacheKey(tileMapView, viewport, frame, options)`

性能约束 / Performance Constraints:

- Policy and store remain sealed lower-level blocks: this facade composes them and preserves legacy call shapes.
- Named cache work is reused and resized in place through `WorldMapLayerCacheStore`.
- Temporary work creation uses injected `createTileWorkCanvas()` and does not scan assets or gameplay state.
- Clipped blits are delegated to deterministic source/destination math.
- Cache key/layout policy remains browser-free and testable without renderer drawing.

扩展方式 / Extension Path:

- New pure cache key/layout/prune decisions extend `WorldMapCachePolicy` first.
- New generic offscreen work or blit helpers extend `WorldMapLayerCacheStore` first.
- New compatibility method names or fallback glue extend this facade.
- Layer-specific repaint/render orchestration remains in the relevant layer renderer modules.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapCacheFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCachePolicy.test.js frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapStaticLayerRenderer.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 static tile layer 的 cache render orchestration
- 世界地图 scout route layer 的 cache render orchestration
- offscreen cache context reset、clear、scale、translate 生命周期
- fast-drag static/scout cache reuse path
- chunk static layout handoff to existing chunk renderer
- 作为 `WorldMapCanvasRenderer.renderWorldTileStaticLayer()` 和 `renderWorldScoutRouteLayer()` 的拆分实现

公开 API / Public API:

- `new WorldMapStaticLayerRenderer({ host })`
- `withCacheContext(work, callback)`
- `renderStaticEntriesIntoCache(tileMapView, layout, uiState)`
- `renderScoutRoutesIntoCache(tileMapView, layout)`
- `renderWorldTileStaticLayer(tileMapView, viewport, frame, entries, uiState)`
- `renderWorldScoutRouteLayer(tileMapView, viewport, frame, entries)`

性能约束 / Performance Constraints:

- Repaint only when static/scout cache keys change.
- Fast-drag path reuses existing cache canvas and blits through `WorldMapLayerCacheStore`.
- Cache work is requested through existing renderer helpers; this module does not allocate canvases directly.
- Host proxy writes cache keys/layouts back to the renderer host so static/scout cache state remains shared with compatibility callers.
- No gameplay mutation, no asset discovery, no hit-target registration.

扩展方式 / Extension Path:

- 新 static/scout layer cache orchestration 先扩展本文件。
- 新 cache key/layout/prune policy 仍然扩展 `WorldMapCachePolicy`。
- 新 generic offscreen work/clip blit helper 仍然扩展 `WorldMapLayerCacheStore`。
- 新 tile/site visual content 仍然由具体 entry renderer methods 负责，不在这里推导 gameplay state。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapStaticLayerRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapStaticEntryRenderer.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 static tile entry drawing orchestration
- static entry two-phase draw：先画地块/选中态/terrain feature/tile feature，再画 site overlay
- fallback terrain diamond 和 selected-site outline
- terrain feature drawing from tile-map manifest
- explicit tile feature drawing：tree cluster、mountain ridge、generic feature asset
- site drawing：selected halo、shadow、asset fallback label、owner marker、name label
- overlay shadow and clipped overlay asset helper methods
- static repaint 中可选 site hit-target registration
- 作为 `WorldMapCanvasRenderer.renderWorldTileStaticEntries()` 与 overlay/site helper methods 的拆分实现

公开 API / Public API:

- `new WorldMapStaticEntryRenderer({ host })`
- `getWorldTileImageAspect(assetPath)`
- `drawWorldOverlayShadow(baseX, baseY, drawW, drawH, profile)`
- `drawWorldOverlayAsset(assetPath, metrics, x, y, width, height, alpha)`
- `drawWorldTerrainFeature(tile, viewport, geometry, tileWidth, tileHeight)`
- `drawWorldTileFeature(tile, viewport, geometry, tileWidth, tileHeight)`
- `drawWorldTileSite(tile, viewport, geometry, tileWidth, tileHeight, uiState, options)`
- `renderWorldTileStaticEntries(tileMapView, viewport, frame, entries, uiState, options)`

性能约束 / Performance Constraints:

- Static entries are drawn in linear passes; no nested tile scans.
- Tile/site layout, alpha metrics, assets, text, and hit-target writes are injected through host APIs.
- Terrain feature randomness is deterministic through host `random01()`.
- Static layer and static chunk cache renderers reuse this module through the same compatibility method.
- No cache ownership, no gameplay mutation, no visibility decision, no asset discovery.

扩展方式 / Extension Path:

- 新 static tile feature/site visual rule 先扩展本文件。
- 新 tile/site layout math 仍扩展 `WorldMapLayoutModel`。
- 新 static layer cache lifecycle 仍扩展 `WorldMapStaticLayerRenderer`。
- 新 static chunk cache lifecycle 仍扩展 `WorldMapStaticChunkRenderer`。
- 新 asset key/manifest identity 仍扩展 `AssetKeyRegistry` 或 tile-map manifest。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapWaterLayerRenderer.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 animated water layer 的 cache render orchestration
- water frame cache 创建、复用、resize、key 更新
- water chunk frame cache 渲染、active key 维护、stale prune
- fast-drag water frame cache reuse path
- water animation timing helpers：fps、frame count、frame ms、frame index、frame time
- 作为 `WorldMapCanvasRenderer.renderWorldTileWaterLayer()` 和 water cache helper methods 的拆分实现

公开 API / Public API:

- `new WorldMapWaterLayerRenderer({ host })`
- `getWaterEntries(entries)`
- `getWorldTileWaterChunkCacheKey(tileMapView, viewport, layout, waterEntries, options)`
- `pruneWorldTileWaterChunkCaches(activeKeys)`
- `getWorldTileWaterChunkFrameCacheId(layout, frameIndex)`
- `renderWorldTileWaterChunk(tileMapView, layout, cacheScale, frameIndex)`
- `renderWorldTileWaterChunkFrames(tileMapView, layout, cacheScale)`
- `renderWorldTileWaterChunks(tileMapView, chunkLayouts, frame)`
- `getWorldTileWaterAnimationFps()`
- `getWorldTileWaterAnimationFrameCount()`
- `getWorldTileWaterAnimationFrameMs()`
- `getWorldTileWaterTimeMs()`
- `getWorldTileWaterAnimationFrame(timeMs)`
- `getWorldTileWaterAnimationFrameIndex(timeMs)`
- `getWorldTileWaterFrameTimeMs(frameIndex)`
- `getWorldTileWaterLayerCacheKey(tileMapView, viewport, frame, entries, options)`
- `resolveWorldTileWaterLayerCacheLayout(tileMapView, viewport, frame, entries)`
- `withWaterFrameCacheContext(work, layout, callback)`
- `renderWaterEntriesIntoFrameCache(tileMapView, layout, waterEntries, frameIndex)`
- `renderWorldTileWaterFrameCache(tileMapView, layout, waterEntries, cacheScale, frameIndex, cacheMap, cacheId, kind)`
- `getWorldTileWaterFrameCache(frameIndex)`
- `renderWorldTileWaterFrameCaches(tileMapView, layout, waterEntries, cacheScale)`
- `renderWorldTileWaterLayer(tileMapView, viewport, frame, entries)`

性能约束 / Performance Constraints:

- Full water frame set is cached once per cache key; animation draw only blits the current frame.
- Fast-drag path reuses existing frame cache and skips repaint.
- Chunk water caches store per-frame works and prune stale entries by active cache IDs.
- Cache key/policy decisions delegate to `WorldMapCachePolicy` when available.
- Actual water pixel/texture drawing remains in `WorldTileWaterCanvasRenderer`; this module only calls `renderWorldTileWaterEntries()`.
- No gameplay mutation, no asset discovery, no hit-target registration.

扩展方式 / Extension Path:

- 新 water layer cache orchestration、frame cache lifecycle、chunk frame reuse 先扩展本文件。
- 新 water cache identity/chunk frame id policy 仍然扩展 `WorldMapCachePolicy`。
- 新 water pixel/texture visual behavior 仍然扩展 `WorldTileWaterCanvasRenderer`。
- 不要在这里推导 visibility、exploration、resource、site 等 gameplay state。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapWaterLayerRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapWaterEntryRenderer.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 water entry drawing loop
- 过滤 water entries：只绘制带 `water.kind` 和 `water.asset` 的 tile
- 调用 host `drawWorldTileWater()` 并关闭 dry-template 二次绘制
- 为 `WorldMapWaterLayerRenderer` 和主渲染器直接水面绘制提供同一个 entry draw boundary
- 作为 `WorldMapCanvasRenderer.renderWorldTileWaterEntries()` 的拆分实现

公开 API / Public API:

- `new WorldMapWaterEntryRenderer({ host })`
- `renderWorldTileWaterEntries(tileMapView, viewport, entries, waterTimeMs)`

性能约束 / Performance Constraints:

- Linear loop over provided render entries.
- Water pixel/texture drawing remains in `WorldTileWaterCanvasRenderer`.
- No cache ownership, no gameplay mutation, no visibility decision, no asset discovery.

扩展方式 / Extension Path:

- 新 water entry filtering/draw handoff rule 先扩展本文件。
- 新 water layer cache orchestration 仍扩展 `WorldMapWaterLayerRenderer`。
- 新 water pixel/texture visual behavior 仍扩展 `WorldTileWaterCanvasRenderer`。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapWaterEntryRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapStaticChunkRenderer.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 static chunk cache render orchestration
- static chunk cache work 创建、复用、resize、metadata 更新
- static chunk cache key 更新与 repaint 判断
- cache repaint 时 suppress hit targets
- active chunk draw 和 stale chunk prune
- 作为 `WorldMapCanvasRenderer.renderWorldTileStaticChunk(s)` 与 static chunk cache helper methods 的拆分实现

公开 API / Public API:

- `new WorldMapStaticChunkRenderer({ host })`
- `getWorldTileStaticChunkCacheKey(tileMapView, viewport, layout, uiState, options)`
- `pruneWorldTileStaticChunkCaches(activeKeys)`
- `getStaticChunkWork(layout, cacheScale)`
- `withStaticChunkContext(work, layout, callback)`
- `renderStaticChunkEntriesIntoCache(tileMapView, layout, uiState)`
- `renderWorldTileStaticChunk(tileMapView, layout, uiState, cacheScale)`
- `renderWorldTileStaticChunks(tileMapView, chunkLayouts, frame, uiState)`

性能约束 / Performance Constraints:

- Chunk cache work is reused by `chunkX,chunkY` and resized in place.
- Unchanged static chunk cache keys skip repaint.
- Stale chunk caches prune by active chunk IDs and least-recent use.
- Cache repaint suppresses hit-target writes.
- Actual tile/site drawing remains in `renderWorldTileStaticEntries()`; this module only owns chunk cache orchestration.
- No gameplay mutation, no asset discovery, no visibility decisions.

扩展方式 / Extension Path:

- 新 static chunk cache lifecycle、draw/prune orchestration 先扩展本文件。
- 新 static chunk cache identity/prune policy 仍扩展 `WorldMapCachePolicy`。
- 新 chunk layout math 仍扩展 `WorldMapLayoutModel`。
- 新 tile/site visual content 不写进这里，继续走具体 tile/site renderer methods。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapStaticChunkRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 snapshot-only cache redraw orchestration
- layer cache snapshot blit：water/static/scout route layer cache
- chunk cache snapshot blit：current water frame chunks + static chunks
- snapshot draw layout 委托到 `WorldMapCachePolicy`
- 成功 snapshot redraw 后刷新 fog mask context
- 作为 `WorldMapCanvasRenderer.renderWorldTileSnapshotCache()` 与 snapshot cache helper methods 的拆分实现

公开 API / Public API:

- `new WorldMapSnapshotCacheRenderer({ host })`
- `renderWorldTileSnapshotChunkCacheMap(cacheMap, viewport, frame)`
- `getWorldTileSnapshotDrawLayout(cachedLayout, viewport)`
- `renderWorldTileSnapshotLayerCache(work, cachedLayout, viewport, frame)`
- `renderWorldTileSnapshotFogMask(tileMapView, viewport, frame)`
- `renderWorldTileSnapshotCache(tileMapView, viewport, frame)`

性能约束 / Performance Constraints:

- Snapshot redraw only blits existing caches; it does not repaint tile content.
- Water chunk snapshot redraw filters to the current animation frame index.
- Fully clipped chunk caches are skipped before draw.
- Draw layout and frame intersection use `WorldMapCachePolicy` when available.
- Fog mask refresh runs only after at least one cache was redrawn.
- No gameplay mutation, no asset loading, no hit-target registration.

扩展方式 / Extension Path:

- 新 snapshot-only redraw behavior 先扩展本文件。
- 新 snapshot draw layout/intersection policy 仍扩展 `WorldMapCachePolicy`。
- 新 cache creation/repaint 仍留在 static/water/static-chunk modules，不写进这里。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 fast-drag composite cache orchestration
- composite cache signature：static layer cache key + scout route cache key + water layer cache key
- fast-drag composite work 创建和复用，委托 host 的 generic layer cache store
- composite cache repaint 时临时切换 host render context
- 按 scout route、water、static 的顺序把已有 layer cache 合成到一个 cache
- fast-drag 期间把 composite cache 按最新 layout 重定位后单次 blit
- 作为 `WorldMapCanvasRenderer` fast-drag composite helper methods 的拆分实现

公开 API / Public API:

- `new WorldMapFastDragCompositeRenderer({ host })`
- `getWorldTileFastDragCompositeSignature()`
- `renderWorldTileFastDragComposite(tileMapView, viewport, frame, entries)`
- `withFastDragCompositeContext(work, callback)`
- `updateWorldTileFastDragComposite(layout, frame)`

性能约束 / Performance Constraints:

- Composite cache is built from already-rendered layer caches; it does not repaint tile/site/water content.
- Stale composite signatures are rejected before blit.
- Chunk layouts are rejected because fast-drag composite is a single world/viewport cache.
- Cache work is reused through `getWorldTileLayerCacheContext()`.
- Repaint draws scout/water/static caches once into a local frame, then fast-drag uses one clipped cache blit.
- No gameplay mutation, no asset loading, no hit-target registration.

扩展方式 / Extension Path:

- 新 fast-drag composite cache rule 先扩展本文件。
- 新 layer cache creation/blit helper 仍扩展 `WorldMapLayerCacheStore`。
- 新 static/scout/water layer cache repaint 仍扩展各自 split renderer，不写进这里。
- 新 cache identity policy that is not composite-specific should stay in `WorldMapCachePolicy`.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapScoutRenderer.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 scout route drawing
- scout route polyline and route-point marker drawing
- legacy scout unit route point projection
- legacy scout progress interpolation from epoch time
- legacy scout unit frame path selection from `UnitSpriteManifest`
- legacy unit renderer handoff through `TutorialIntroUnitRenderer`
- 作为 `WorldMapCanvasRenderer.renderWorldScoutRoutes()` 与 legacy scout helper methods 的拆分实现

公开 API / Public API:

- `new WorldMapScoutRenderer({ host })`
- `renderWorldScoutRoutes(tileMapView, viewport)`
- `getWorldScoutUnitRoutePoints(mission, viewport, geometry)`
- `getWorldScoutUnitProgress(mission)`
- `getWorldScoutUnitPoint(mission, viewport, geometry)`
- `getWorldScoutUnitFramePath(mission)`
- `renderWorldScoutUnitsLegacy(tileMapView, viewport)`

性能约束 / Performance Constraints:

- Route drawing is linear over mission route points.
- Progress interpolation uses epoch time and does not read frame time.
- `WorldTime`, `UnitSpriteManifest`, and `TutorialIntroUnitRenderer` are injected through host/static APIs.
- No cache ownership, no gameplay mutation, no visibility decision, no asset discovery.

扩展方式 / Extension Path:

- 新 scout route visual rule 先扩展本文件。
- 新 active scout actor rendering 仍走 `WorldActorCanvasRenderer`/`WorldMarchSystem`，不要塞回这里。
- 新 route/input hit target 仍扩展 `WorldMapHitTargetModel` 或 `WorldMapInputActionMap`。
- 新 unit frame manifest 仍扩展 `UnitSpriteManifest` 或 asset registry。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapScoutRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.js`

状态 / Status: candidate

职责 / Owns:

- 世界地图 world-site modal/action overlay drawing
- world-site dialog presenter fallback view-state creation
- site action button layout and hit-target registration
- expedition config controls for leader/soldier/launch interactions
- occupied-city command overlay, legacy overlay fallback, title badge, rename button, primary/side command buttons
- selected site/city canvas anchor lookup through injected world-tile layout helpers
- city-command button action mapping for `enterCity`, `renameCity`, `territoryAction`, and `people` tab routing
- 作为 `WorldMapCanvasRenderer.renderWorldSiteModal()` and related site overlay helper methods 的拆分实现

公开 API / Public API:

- `new WorldMapSiteOverlayRenderer({ host })`
- `getWorldSiteDialogPresenter()`
- `buildWorldSiteDialogViewState(territories, territoryState, uiState)`
- `buildFallbackWorldSiteDialogViewState(territories, territoryState, uiState)`
- `renderWorldSiteAction(actionView, x, y, width)`
- `renderWorldExpeditionConfig(config, x, y, width)`
- `renderWorldSiteModal(state, options)`
- `renderWorldCityCommandLegacyOverlay(detail, territories, state, options)`
- `getWorldCityCommandAnchor(detail, territories, state, options)`
- `getWorldSiteCanvasAnchor(siteId, state, options)`
- `getWorldCityCommandButtonAction(button)`
- `drawWorldCityCommandPrimaryButton(button, x, y, size)`
- `drawWorldCityCommandSideButton(button, x, y, width, height)`
- `renderWorldCityCommandOverlay(detail, territories, state, options)`

性能约束 / Performance Constraints:

- Overlay rendering runs only for selected/open site state; no per-frame map cache ownership.
- Action button traversal is bounded by the presenter-provided visible button list.
- Anchor lookup reuses existing tile-map layout/render-entry helpers instead of duplicating projection math.
- Presenter fallback view state is linear over territories and does not scan tile payloads.
- No gameplay simulation, no cache lifecycle, no asset discovery, no visibility decision.

扩展方式 / Extension Path:

- 新 world-site modal/action/city-command visual rule 先扩展本文件。
- 新 world-site view-state/business rules 仍扩展 `WorldSitePresenter` 或相关 presenter；本文件只保留 renderer-safe fallback。
- 新 anchor/layout math 仍扩展 `WorldMapLayoutModel` or existing world-tile layout helpers。
- 新 input/action routing policy 仍扩展 `WorldMapInputActionMap` or action controller boundary；这里只映射 overlay hit targets.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.js`

状态 / Status: candidate

职责 / Owns:

- military world-view panel composition
- territory summary header drawing for the world view
- tile-map render branch and reset control overlay
- empty exploration fallback copy
- legacy radar fallback drawing for non-tile world-map state
- legacy radar drag, reset, and world-site hit-target registration
- 作为 `WorldMapCanvasRenderer.renderMilitaryWorldView()` 的拆分实现

公开 API / Public API:

- `new WorldMapMilitaryViewRenderer({ host })`
- `renderMilitaryWorldView(state, x, y, width, height, options)`

性能约束 / Performance Constraints:

- Rendering is a bounded branch over tile-map view, empty state, or legacy radar fallback.
- Tile-map drawing delegates to `renderWorldTileMap()` instead of owning tile rendering.
- Radar fallback is linear over presenter-provided sites.
- Hit-target registration is bounded to visible fallback controls/sites.
- No cache lifecycle, no gameplay simulation, no asset discovery, no visibility decision.

扩展方式 / Extension Path:

- 新 military world-view panel composition 先扩展本文件。
- 新 tile-map rendering details 仍扩展 world-map split renderers, not this module.
- 新 world-site modal/action overlay 仍扩展 `WorldMapSiteOverlayRenderer`。
- 新 presenter data rules 仍扩展 `WorldRadarPresenter`, `WorldSitePresenter`, or related presenter modules.

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapFogMaskContextRenderer.js`

状态 / Status: candidate

职责 / Owns:

- world-map fog mask context capture handoff
- fog reveal entry filtering for fully surrounded inner entries
- stable world tile key formatting used by fog context helpers
- `lastWorldFogContext` publication on the renderer host
- split implementation for `WorldMapCanvasRenderer.renderWorldTileFogMask()` and related fog compatibility helpers

公开 API / Public API:

- `new WorldMapFogMaskContextRenderer({ host })`
- `getWorldTileKey(tile)`
- `getWorldTileFogRevealEntries(entries)`
- `createWorldTileFogMaskContext(tileMapView, viewport, frame, entries, options)`
- `renderWorldTileFogMask(tileMapView, viewport, frame, entries)`

性能约束 / Performance Constraints:

- Context capture stores existing snapshot/tile/view references instead of cloning large tile payloads.
- Reveal filtering is linear over provided visible entries and uses one local `Set` for O(1) neighbor lookup.
- No fog layer allocation, no canvas/WebGL drawing, no gameplay visibility decisions.
- Fog visuals remain feature-gated through `WorldMapVisualPluginRegistry` and default-off config.

扩展方式 / Extension Path:

- 新 fog context handoff 字段先扩展 `createWorldTileFogMaskContext()` 并补测试。
- 新 fog visual rules 仍扩展 `WorldFogVisualSnapshot` / `WorldMapVisualPluginRegistry`，不要写进本模块。
- 新 fog renderer drawing 仍由 visual plugin 或 fog renderer 消费 context，本模块只做 renderer-safe handoff。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapFogMaskContextRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapTileMapRenderer.js`

状态 / Status: candidate

职责 / Owns:

- one-frame world tile-map render orchestration
- `WorldMapRenderSnapshot` context creation and `lastWorldTileMapContext` publication
- world-map panel background and clip setup
- world-map drag hit-target registration
- snapshot-only cache redraw branch
- hit-target-only pass for march tiles, sites, actors, and march HUD
- main layer render ordering: scout route, water, static entries, fog context, actors, march HUD, hit targets
- fast-drag state enable/restore around the frame
- split implementation for `WorldMapCanvasRenderer.renderWorldTileMap()`

公开 API / Public API:

- `new WorldMapTileMapRenderer({ host })`
- `getWorldMapHitTargetModel()`
- `getWorldTileMapNowMs()`
- `createWorldTileMapContext(tileMapView, x, y, width, height, uiState, options)`
- `publishWorldTileMapContext(context)`
- `getWorldTileMapActors(tileMapView, renderSnapshot)`
- `drawWorldTileMapPanel(x, y, width, height, hitTargetsOnly, options)`
- `addWorldMapDragHitTarget(x, y, width, height)`
- `withWorldTileMapClip(x, y, width, height, callback)`
- `renderWorldTileMapSnapshotOnly(tileMapView, viewport, frame, x, y, width, height)`
- `renderWorldTileMapHitTargets(tileMapView, viewport, frame, geometry, visibleEntries, uiState, options, renderSnapshot)`
- `renderWorldTileMapLayers(tileMapView, viewport, frame, geometry, visibleEntries, uiState, options, renderSnapshot)`
- `renderWorldTileMap(tileMapView, x, y, width, height, uiState, options)`

性能约束 / Performance Constraints:

- Visible entries are calculated once per normal frame and reused by layer renderers and hit-target registration.
- Tile-map context stores existing snapshot/tile/view references instead of cloning large tile payloads.
- Layer rendering delegates to existing cache-aware split renderers; this module does not repaint cache internals.
- Snapshot-only redraw blits existing caches and skips visible-entry calculation.
- `worldTileFastDragActive` is restored in `finally` even if a downstream renderer fails.
- No gameplay mutation, no asset discovery, no fog visual rule ownership.

扩展方式 / Extension Path:

- 新 world tile-map frame sequencing rule 先扩展本模块并补 focused tests。
- 新 tile/site/water/scout/cache drawing details 仍扩展对应 split renderer，不要写回本模块。
- 新 actor/HUD rendering details 仍扩展 `WorldActorCanvasRenderer` / `WorldMarchHudCanvasRenderer` 或后续 actor/HUD boundary。
- 新 fog visual rules 仍扩展 `WorldFogVisualSnapshot` / `WorldMapVisualPluginRegistry`。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapActorHudRenderer.js`

状态 / Status: candidate

职责 / Owns:

- world-map actor derivation from `WorldMapRenderSnapshot` actors or active march missions
- epoch-now resolution for march actor calculation
- actor render handoff to `WorldActorCanvasRenderer`
- actor hit-target handoff to `WorldActorCanvasRenderer`
- march HUD state publication to renderer/host/HUD renderer
- march HUD render handoff to `WorldMarchHudCanvasRenderer`
- nearest world-tile lookup through `WorldMarchSystem`
- split implementation for actor/HUD compatibility helpers on `WorldMapCanvasRenderer`

公开 API / Public API:

- `new WorldMapActorHudRenderer({ host, worldActorRenderer, worldMarchHudRenderer })`
- `getEpochNowMs()`
- `buildWorldMapActors(tileMapView, renderSnapshot)`
- `renderWorldScoutUnits(tileMapView, viewport)`
- `renderWorldActors(actors, viewport, geometry)`
- `addWorldActorHitTargets(actors, viewport, geometry)`
- `publishWorldMarchHudState(state)`
- `renderWorldMarchHud(state, uiState, actors, viewport, geometry, frame)`
- `getNearestWorldTileAtPoint(point, tileMapView, viewport)`

性能约束 / Performance Constraints:

- Snapshot actors are reused by reference when present.
- Mission actors are derived once per caller pass with epoch time, not frame time.
- Actor rendering and hit-target registration remain delegated to `WorldActorCanvasRenderer`.
- HUD state is published by reference; no deep clone of game state.
- No tile layout/cache orchestration, no fog visual rule ownership, no gameplay mutation.

扩展方式 / Extension Path:

- 新 actor/HUD handoff rule 先扩展本模块。
- 新 actor pixel drawing 仍扩展 `WorldActorCanvasRenderer`。
- 新 march HUD visual/detail 仍扩展 `WorldMarchHudCanvasRenderer`。
- 新 march domain calculation 仍扩展 `WorldMarchSystem` / domain snapshots。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapActorHudRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldFogVisualSnapshot.js`

状态 / Status: candidate

负责 / Owns:

- 战争迷雾 visual input contract 的纯 domain snapshot
- 将 `WorldMapVisibilityModel` 的 visibility levels 映射成 renderer-safe fog mask levels
- 消费 `WorldMapRenderSnapshot` 的 frame、viewport、geometry，不让 fog renderer 自己推导地图语义
- 为旧 `WorldFogCanvasRenderer` 或后续替代 visual plugin 输出稳定 renderer context
- 保持 fog 玩法权威来自 visibility snapshot，本文件只做视觉输入适配

公开 API / Public API:

- `WorldFogVisualSnapshot.createSnapshot(input, options)`
- `WorldFogVisualSnapshot.toRendererContext(snapshot, options)`
- `WorldFogVisualSnapshot.toRendererEntries(snapshot, options)`
- `WorldFogVisualSnapshot.toSerializable(snapshot)`
- `WorldFogVisualSnapshot.getEntry(snapshot, index)`
- `WorldFogVisualSnapshot.getTile(snapshot, index)`
- `WorldFogVisualSnapshot.getTileScreenCenter(tile, viewport, geometry)`
- `WorldFogVisualSnapshot.getTileDrawRect(center, viewport, geometry)`
- `WorldFogVisualSnapshot.maskLevelForVisibility(level)`
- `WorldFogVisualSnapshot.normalizeCoord(source, fallback)`
- `WorldFogVisualSnapshot.normalizeFrame(input)`
- `WorldFogVisualSnapshot.normalizeGeometry(input)`
- `WorldFogVisualSnapshot.normalizeViewport(input, geometry)`
- constants: `MASK_UNKNOWN`, `MASK_EXPLORED`, `MASK_VISIBLE`

性能约束 / Performance Constraints:

- Snapshot uses parallel arrays: `tileIds`, `q`, `r`, `levels`, `maskLevels`, `centerX`, `centerY`, `drawX`, `drawY`, `drawWidth`, `drawHeight`, `inView`.
- `indexById` gives O(1) tile lookup.
- Signature uses incremental FNV-style hashing over compact visual identity/layout fields.
- Large-map regression covers 5000 tiles and asserts no `entries`, `tileMapView`, or `renderSnapshot` payload is stored on the snapshot.
- No canvas, WebGL, DOM, renderer instance, or gameplay mutation.

扩展方式 / Extension Path:

- 新 fog visual 规则先通过 visibility level 或 mask level 扩展，不写进 `WorldFogCanvasRenderer`。
- 新 renderer 需要 fog 输入时，消费 `toRendererContext()`，不要读 raw tile visibility。
- 如果未来加入多阵营视野、临时侦察、debug fog overlay，应先扩展 snapshot input/options 和测试，再由 registry 分发。

回归 / Regression:

- `node --test frontend/js/domain/WorldFogVisualSnapshot.test.js`
- `npm run test:architecture`

### `frontend/js/platform/WorldMapVisualPluginRegistry.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图视觉插件注册表 / visual plugin registry
- 通过 `FeatureFlags` 控制 visual plugin 是否启用
- 默认声明 `worldFog` 插件，但 `FOG_OF_WAR_ENABLED` 为 false 时不产出 snapshot/context
- 为 shell/runtime 提供 `createPluginSnapshot()` 和 `createRendererContext()` 的统一入口
- 保持 visual plugin 分发逻辑在 platform 层，具体数据合同在 domain snapshot 层

公开 API / Public API:

- `WorldMapVisualPluginRegistry.DEFAULT_PLUGINS`
- `WorldMapVisualPluginRegistry.getPluginDefinitions(options)`
- `WorldMapVisualPluginRegistry.getPlugin(key, options)`
- `WorldMapVisualPluginRegistry.isPluginEnabled(pluginOrKey, config, options)`
- `WorldMapVisualPluginRegistry.getEnabledPlugins(config, options)`
- `WorldMapVisualPluginRegistry.createPluginSnapshot(key, context, options)`
- `WorldMapVisualPluginRegistry.createRendererContext(key, context, options)`
- `WorldMapVisualPluginRegistry.runPlugins(context, options)`

性能约束 / Performance Constraints:

- Disabled plugins return early and do not allocate snapshots.
- Enabled plugin result uses keyed snapshot map plus compact counts/signature.
- Registry owns dispatch only; it does not copy large tile arrays or perform canvas/WebGL work.
- Feature flag checks use `FeatureFlags.isEnabled()` when available.

扩展方式 / Extension Path:

- 新世界地图视觉系统先新增 plugin definition，再新增对应 domain snapshot/adapter。
- feature-gated visual systems 必须在 registry 里声明 `feature`，默认关闭的系统不能分配图层或 renderer context。
- 不要让 shell/runtime 直接 new 新视觉模块；通过 registry 获取 snapshot/context。

回归 / Regression:

- `node --test frontend/js/platform/WorldMapVisualPluginRegistry.test.js`
- `node --test frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/domain/DebugOverlaySnapshot.js`

状态 / Status: candidate

负责 / Owns:

- 调试覆盖层的纯数据 snapshot / debug overlay row contract
- 将 FPS、world map bake state、visibility counts、input trace 归一化为稳定 rows
- 为后续 HUD/canvas/debug UI 提供可序列化输入
- 避免 renderer/runtime 对象泄漏进 debug payload

公开 API / Public API:

- `DebugOverlaySnapshot.DEFAULT_OVERLAY_KEYS`
- `DebugOverlaySnapshot.createSnapshot(input, options)`
- `DebugOverlaySnapshot.getRow(snapshot, keyOrIndex)`
- `DebugOverlaySnapshot.toRows(snapshot)`
- `DebugOverlaySnapshot.toSerializable(snapshot)`
- `DebugOverlaySnapshot.normalizeOverlayKeys(keys)`
- `DebugOverlaySnapshot.readFps(input)`
- `DebugOverlaySnapshot.readWorldMapBake(input)`
- `DebugOverlaySnapshot.readVisibility(input)`
- `DebugOverlaySnapshot.readInputTrace(input)`
- constants: `STATUS_UNKNOWN`, `STATUS_OK`, `STATUS_WARN`, `STATUS_BAD`

性能约束 / Performance Constraints:

- Snapshot uses parallel arrays: `keys`, `labels`, `values`, `statuses`, `details`.
- `indexByKey` gives O(1) row lookup.
- Signature uses incremental FNV-style hashing over compact row identity/value/status fields.
- Serializable output excludes renderer, runtime, canvas, DOM, and action objects.
- Overlay key filtering deduplicates rows before work is done.

扩展方式 / Extension Path:

- 新 debug row 先新增 row builder，再加入 registry definition 和 tests。
- 只读已存在的 snapshot/runtime metrics；不要在这里推进游戏状态或触发渲染。
- 后续可视化层消费 `toRows()` 或 `toSerializable()`，不要直接读取 runtime 对象。

回归 / Regression:

- `node --test frontend/js/domain/DebugOverlaySnapshot.test.js`
- `npm run test:architecture`

### `frontend/js/platform/DebugOverlayRegistry.js`

状态 / Status: candidate

负责 / Owns:

- 调试覆盖层注册表 / debug overlay registry
- 通过 `DEBUG_OVERLAYS_ENABLED` master feature flag 控制 overlay 是否启用
- 声明默认 overlay：`fps`、`worldMapBake`、`visibility`、`inputTrace`
- 为 shell/runtime 提供 `createOverlaySnapshot()` 的统一入口
- 保持 overlay 分发在 platform 层，row 数据合同在 `DebugOverlaySnapshot`

公开 API / Public API:

- `DebugOverlayRegistry.DEFAULT_OVERLAYS`
- `DebugOverlayRegistry.getOverlayDefinitions(options)`
- `DebugOverlayRegistry.getOverlay(key, options)`
- `DebugOverlayRegistry.getRequestedOverlayKeys(config, options)`
- `DebugOverlayRegistry.isOverlayEnabled(overlayOrKey, config, options)`
- `DebugOverlayRegistry.getEnabledOverlays(config, options)`
- `DebugOverlayRegistry.createOverlaySnapshot(context, options)`

性能约束 / Performance Constraints:

- `DEBUG_OVERLAYS_ENABLED` 为 false 时直接返回空 enabled list / null snapshot。
- 默认不开启，不改变普通游戏帧的渲染和状态。
- Registry only dispatches; it does not copy large map arrays or perform canvas drawing.
- Feature flag checks use `FeatureFlags.isEnabled()` when available.

扩展方式 / Extension Path:

- 新 debug overlay 必须先在 registry 声明 key/label/stage/feature。
- 默认关闭的 debug overlay 不能分配图层、不能写 renderer、不能影响 runtime state。
- Shell 只调用 `createOverlaySnapshot()`；不要在 shell/renderers 里手工拼 debug rows。

回归 / Regression:

- `node --test frontend/js/platform/DebugOverlayRegistry.test.js`
- `node --test frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMapInputActionMap.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图输入到动作的纯映射 / input-to-action mapping
- hit target 反向命中优先级：foreground action 优先，background action 只做兜底
- 过滤 world-map runtime 允许处理的 action types
- 将地图背景点击通过 `screenPointToAxialTile` 推断为 `selectWorldMarchTarget`
- 生成稳定 action payload，不直接修改游戏状态、不调 renderer、不调 backend

公开 API / Public API:

- `WorldMapInputActionMap.DEFAULT_ALLOWED_ACTIONS`
- `WorldMapInputActionMap.normalizeHitTargets(targets, options)`
- `WorldMapInputActionMap.normalizeHitTarget(target, options)`
- `WorldMapInputActionMap.getHitTarget(point, targets)`
- `WorldMapInputActionMap.resolveTapAction(point, input, options)`
- `WorldMapInputActionMap.getBackgroundMarchTargetAction(point, context, options)`
- `WorldMapInputActionMap.inferTileFromPoint(point, context, options)`
- `WorldMapInputActionMap.buildSelectWorldMarchTargetAction(tile, options)`
- `WorldMapInputActionMap.containsPoint(target, point)`
- `WorldMapInputActionMap.isAllowedAction(action, allowedActions)`
- `WorldMapInputActionMap.findKnownTile(tileMapView, inferred)`
- `WorldMapInputActionMap.isKnownTile(tile)`

性能约束 / Performance Constraints:

- Hit test uses one reverse linear scan over already-filtered hit targets.
- No deep copy of renderer hit target lists beyond compact normalized entries.
- Tile inference scans current visible `tileMapView.tiles`; later large-map optimization can inject a tile index without changing action payloads.
- No DOM/canvas/backend references are stored.

扩展方式 / Extension Path:

- 新 world-map input action 先加入 `DEFAULT_ALLOWED_ACTIONS`，再补测试和 dispatcher/controller 实现。
- 新物理输入类型应先映射为 named action，再交给 runtime/controller。
- 教程门控只消费 action payload，不把教程规则加进本模块。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapInputActionMap.test.js frontend/js/platform/WorldMapRuntime.test.js`
- `npm run test:architecture`

### `backend/services/GameStateMigrationPipeline.js`

状态 / Status: candidate

负责 / Owns:

- 后端存档 schema 迁移管线 / backend save-schema migration pipeline
- 读取 legacy/current/future schema version
- 按版本顺序执行纯数据迁移步骤
- 写入 `saveMetadata.schemaVersion` 和 `saveMetadata.migrations`
- 在业务 normalizer 之前处理存档结构，不做玩法推进

公开 API / Public API:

- `GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION`
- `GameStateMigrationPipeline.LEGACY_SCHEMA_VERSION`
- `GameStateMigrationPipeline.SAVE_SCHEMA_NAME`
- `GameStateMigrationPipeline.MIGRATIONS`
- `GameStateMigrationPipeline.createPipeline(migrations, options)`
- `GameStateMigrationPipeline.migrateState(rawState, options)`
- `GameStateMigrationPipeline.getSaveSchemaVersion(state)`
- `GameStateMigrationPipeline.createSaveMetadata(options)`
- `GameStateMigrationPipeline.normalizeSaveMetadata(metadata, options)`
- `GameStateMigrationPipeline.normalizeMigrationHistory(history)`
- `GameStateMigrationPipeline.normalizeMigrations(migrations)`

性能约束 / Performance Constraints:

- 每次迁移只 clone plain save data 一次。
- 迁移步骤有序、有限、同步执行，不访问 DB/network/renderer。
- 缺失版本步骤直接抛错，避免静默读坏存档。
- future schema 不降级，只保持 metadata。

扩展方式 / Extension Path:

- 新存档结构变更先新增 migration step，再接 normalizer/service 兼容逻辑。
- migration 只处理数据 shape，不计算在线收益、不推进探索、不生成战斗结果。
- 新版本必须同步本文件、tests、`GameStateNormalizer` 接入测试、文档。

回归 / Regression:

- `node --test backend/tests/GameStateMigrationPipeline.test.js backend/tests/GameStateServiceSplit.test.js`
- `npm run test:architecture`

### `backend/services/GameStateNormalizer.js`

状态 / Status: candidate facade

负责 / Owns:

- 创建初始游戏状态 / initial game state factory
- 在归一化前调用 `GameStateMigrationPipeline.migrateState()`
- 补齐资源、人口、科技、教程、城市、领土、探索、名人、任务等派生兼容字段
- 保留旧接口 `createInitialGameState()` / `normalizeState()`

公开 API / Public API:

- `GameStateNormalizer.createInitialGameState(playerId)`
- `GameStateNormalizer.normalizeState(rawState)`

扩展方式 / Extension Path:

- 存档 schema 变更先进入 `GameStateMigrationPipeline`。
- 新业务派生状态优先进入对应 domain/service normalizer，本文件只做 orchestration。
- 不要在这里加入 DB、route、renderer、网络调用。

回归 / Regression:

- `node --test backend/tests/GameStateServiceSplit.test.js`
- `npm run test:architecture`

### `backend/repositories/GameStateRepository.js`

状态 / Status: candidate

负责 / Owns:

- SQLite `game_states` 表结构初始化和向后兼容列补齐
- 保存/读取游戏状态持久化字段
- 持久化 `saveMetadata`，保证迁移幂等
- 不执行业务 normalizer 和 gameplay 规则

公开 API / Public API:

- `new GameStateRepository(db)`
- `init()`
- `findByPlayerId(playerId)`
- `findAll()`
- `findRecentlyActive(activeSinceIso, limit)`
- `save(gameState)`
- `touchPlayerActiveAt(playerId)`

扩展方式 / Extension Path:

- 新持久化字段先增加列迁移、读写 JSON 解析、repository tests。
- 存档 shape 迁移逻辑放在 `GameStateMigrationPipeline`，不要放进 repository。
- repository 返回 raw persisted state，由 service/normalizer 决定如何升级和派生。

回归 / Regression:

- `node --test backend/tests/GameStateRepository.test.js`

### `backend/services/worldExplorer/WorldExplorerDtoMapper.js`

状态 / Status: candidate

负责 / Owns:

- 后端 world explorer API DTO 输出形状 / API response DTO shape
- 将 normalized mission 转成 public mission DTO
- 将 mission DTO 分组为 `activeMission`、`readyMissions`、`idleMissions`、`busyFormations`
- 保留世界探索客户端常量字段：`maxActiveMissions`、`randomRouteLength`、`maxManualRouteLength`、`stepDurationSeconds`
- 不推进任务、不写存档、不依赖 routes

公开 API / Public API:

- `WorldExplorerDtoMapper.getClientStateDto(missions, options)`
- `WorldExplorerDtoMapper.getMissionDto(mission, now)`
- `WorldExplorerDtoMapper.getBusyFormationDto(mission)`
- `WorldExplorerDtoMapper.getRouteDto(route)`
- `WorldExplorerDtoMapper.getPlannedTileDto(tile)`
- `WorldExplorerDtoMapper.getPlannedSiteDto(site)`
- `WorldExplorerDtoMapper.getPositionSource(mission, route)`
- `WorldExplorerDtoMapper.getRemainingSeconds(mission, now)`
- `WorldExplorerDtoMapper.normalizeCoord(source, fallback)`

性能约束 / Performance Constraints:

- Linear DTO mapping over missions/routes/planned records.
- Mapper does not call `normalizeExploreState()` or mutate persistence state.
- Clone only public nested DTO payloads that leave the service boundary.
- No API route, repository, renderer, DOM, or frontend imports.

扩展方式 / Extension Path:

- 新 API 字段先加到 mapper，并同步 mapper tests、client state tests、本索引。
- 新服务流程仍由 `WorldExplorerClientState` 或 service/action modules 调用；mapper 只做 shape。
- 不要在 route 里手写 world explorer response shape。

回归 / Regression:

- `node --test backend/tests/WorldExplorerDtoMapper.test.js backend/tests/WorldExplorerArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/worldExplorer/WorldExplorerClientState.js`

状态 / Status: candidate facade

负责 / Owns:

- world explorer client-state orchestration
- 调用 `normalizeExploreState(gameState, now)` 推进/归一化任务
- 委托 `WorldExplorerDtoMapper` 输出 public DTO
- 保留旧 API `getClientMission()` / `getClientState()`，避免 routes/assembler 改动

公开 API / Public API:

- `WorldExplorerClientState.getClientMission(mission, now)`
- `WorldExplorerClientState.getClientState(gameState, now)`

扩展方式 / Extension Path:

- 新 response 字段加到 `WorldExplorerDtoMapper`。
- 新 progression side effect 留在 `WorldExplorerProgression` 或 action modules。
- 本文件只保留 orchestration，不增加 DTO 拼装细节。

回归 / Regression:

- `node --test backend/tests/WorldExplorerDtoMapper.test.js backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js`

### `scripts/run-architecture-smoke.js`

状态 / Status: candidate

负责 / Owns:

- P0/P1/P2 refactor base 的快速架构回归
- 架构相关文件语法检查 / syntax checks
- feature flags、asset key registry、preload asset manifest、layer registry、shell lifecycle、frozen fog renderer、world map snapshots、world map performance budget、march progress snapshot、world map render snapshot、fog visual snapshot、visual plugin registry、debug overlay snapshot、debug overlay registry、world map input action map、world map renderer split modules、game state migration pipeline、world explorer DTO mapper 的 focused tests
- `git diff --check`

公开命令 / Public Command:

- `npm run test:architecture`

扩展方式 / Extension Path:

- 新的 stable/candidate 架构模块成为 baseline 后，把语法检查加入这里。
- P0/P1 边界成为强约束后，把 focused test 加入这里。
- 不要加入耗时全量测试；这个脚本必须足够快，适合每个小步重构后运行。

回归 / Regression:

- `npm run test:architecture`

## 3. 遗留或未完成模块 / Legacy Or Not Yet Completed Modules

These files are not "bad"; they are high-risk because they own too many responsibilities. New feature work should avoid adding more responsibility to them.

### `frontend/js/platform/renderers/WorldMapCanvasRenderer.js` - 718 lines

状态 / Status: active-refactor facade

当前负责 / Currently Owns:

- world tile drawing
- compatibility facade dependency consumption through `WorldMapRendererDependencyRegistry`
- compatibility host bridge through `WorldMapRendererHostBridge`
- compatibility facade composition through `WorldMapRendererCompositionFactory`
- compatibility facade for world tile layout helper APIs delegated to `WorldMapLayoutFacade` / `WorldMapLayoutModel`
- compatibility facade for render utility helper APIs delegated to `WorldMapRenderUtilityFacade`
- compatibility facade for cache performance config helper APIs delegated to `WorldMapCacheConfigFacade`
- compatibility facade for world tile cache helper APIs delegated to `WorldMapCacheFacade` / `WorldMapCachePolicy` / `WorldMapLayerCacheStore`
- compatibility facade for static tile layer and scout route cache orchestration delegated to `WorldMapStaticLayerRenderer`
- compatibility facade for static tile entry/overlay/site drawing delegated to `WorldMapStaticEntryRenderer`
- compatibility facade for static chunk cache orchestration delegated to `WorldMapStaticChunkRenderer`
- compatibility facade for water layer animation/cache orchestration delegated to `WorldMapWaterLayerRenderer`
- compatibility facade for water entry drawing delegated to `WorldMapWaterEntryRenderer`
- compatibility facade for snapshot-only cache redraw delegated to `WorldMapSnapshotCacheRenderer`
- compatibility facade for fast-drag composite cache orchestration delegated to `WorldMapFastDragCompositeRenderer`
- compatibility facade for scout route/legacy scout unit drawing delegated to `WorldMapScoutRenderer`
- compatibility facade for world-site modal/action overlay drawing delegated to `WorldMapSiteOverlayRenderer`
- compatibility facade for military world-view composition delegated to `WorldMapMilitaryViewRenderer`
- compatibility facade for fog mask context capture delegated to `WorldMapFogMaskContextRenderer`
- compatibility facade for one-frame tile-map orchestration delegated to `WorldMapTileMapRenderer`
- compatibility facade for actor/HUD runtime handoff delegated to `WorldMapActorHudRenderer`
- compatibility facade for cache key/layout/prune policy delegated to `WorldMapCachePolicy`
- compatibility facade for generic offscreen cache work delegated to `WorldMapLayerCacheStore`
- hit target compatibility facade delegated to `WorldMapHitTargetFacade` / `WorldMapHitTargetModel`

重要公开方法 / Important Public Methods:

- `render(tileMapView, x, y, width, height, uiState, options)`
- `renderWorldTileMap(tileMapView, x, y, width, height, uiState, options)` delegated to `WorldMapTileMapRenderer`
- `renderMilitaryWorldView(state, x, y, width, height, options)`
- `renderWorldTileStaticLayer(...)`
- `renderWorldTileWaterLayer(...)`
- `renderWorldScoutRouteLayer(...)`
- `renderWorldActors(...)`
- `renderWorldMarchHud(...)`
- `addWorldTileSiteHitTargets(...)`
- `addWorldMarchTileHitTargets(...)`
- `renderWorldSiteModal(state, options)`
- `renderWorldTileFogMask(tileMapView, viewport, frame, entries)`
- dependency static getters backed by `WorldMapRendererDependencyRegistry`: `getTileMapAssetManifest()`, `getTileMapGeometry()`, `getWorldTime()`, `getUnitSpriteManifest()`, `getTutorialIntroUnitRenderer()`, and all `getWorldMap*Renderer/Facade/Model/Policy/Store()` getters
- `getWorldMapRendererCompositionFactory()`
- `getWorldMapRendererHostBridge()`
- delegated layout helpers through `WorldMapLayoutFacade`: `getWorldTileScreenCenter()`, `getWorldTileDrawRect()`, `getWorldOverlayAnchor()`, `getWorldTileSiteLayout()`, `getWorldTileRenderEntries()`, `getWorldTileLocalEntries()`, `getWorldTileRenderedDiamondCenter()`, `getWorldTileStaticCacheLayout()`, `getWorldTileStaticViewportCacheLayout()`, `getWorldTileAtlasFramePadding()`, `getWorldTileStaticChunkLayouts()`, `getWorldTileStaticDragCacheLayout()`
- delegated render utility helpers through `WorldMapRenderUtilityFacade`: `drawIsoDiamond()`, `getFallbackTerrainFill()`, `hashString()`, `random01()`
- delegated cache config helpers through `WorldMapCacheConfigFacade`: `getWorldTileStaticChunkSize()`, `getWorldTileStaticChunkCacheLimit()`, `getWorldTileStaticChunkCacheScale()`, `getWorldTileDragCachePanRange()`, `getWorldTileStaticCacheScale()`, `getWorldTileStaticCachePixelBudget()`
- delegated cache helpers through `WorldMapCacheFacade`: `getWorldTileStaticCacheKey()`, `getWorldTileLayerCacheContext()`, `getWorldTileStaticCacheContext()`, `getWorldTileScoutRouteCacheContext()`, `getWorldTileWaterLayerCacheContext()`, `createWorldTileLayerWork()`, `drawWorldTileLayerCache()`, `resolveWorldTileStaticCacheLayout()`, `getWorldTileScoutRouteCacheKey()`
- delegated hit-target helpers through `WorldMapHitTargetFacade`: `addWorldTileSiteHitTargets()`, `addWorldMarchTileHitTargets()`
- delegated cache policy helpers: `getWorldTileStaticCacheKey()`, `getWorldTileScoutRouteCacheKey()`, `resolveWorldTileStaticCacheLayout()`, `getWorldTileSnapshotDrawLayout()`
- delegated cache work helpers: `getWorldTileLayerCacheContext()`, `getWorldTileStaticCacheContext()`, `getWorldTileScoutRouteCacheContext()`, `getWorldTileWaterLayerCacheContext()`, `createWorldTileLayerWork()`, `drawWorldTileLayerCache()`
- delegated static/scout layer helpers: `renderWorldTileStaticLayer()`, `renderWorldScoutRouteLayer()`
- delegated static entry helpers: `getWorldTileImageAspect()`, `drawWorldOverlayShadow()`, `drawWorldOverlayAsset()`, `drawWorldTerrainFeature()`, `drawWorldTileFeature()`, `drawWorldTileSite()`, `renderWorldTileStaticEntries()`
- delegated static chunk helpers: `getWorldTileStaticChunkCacheKey()`, `pruneWorldTileStaticChunkCaches()`, `renderWorldTileStaticChunk()`, `renderWorldTileStaticChunks()`
- delegated water layer helpers: `getWorldTileWaterLayerCacheKey()`, `getWorldTileWaterChunkCacheKey()`, `getWorldTileWaterChunkFrameCacheId()`, `pruneWorldTileWaterChunkCaches()`, `renderWorldTileWaterChunk()`, `renderWorldTileWaterChunkFrames()`, `renderWorldTileWaterChunks()`, `renderWorldTileWaterFrameCache()`, `getWorldTileWaterFrameCache()`, `renderWorldTileWaterFrameCaches()`, `renderWorldTileWaterLayer()`, `getWorldTileWaterAnimationFrameIndex()`
- delegated water entry helpers: `renderWorldTileWaterEntries()`
- delegated snapshot cache helpers: `renderWorldTileSnapshotChunkCacheMap()`, `getWorldTileSnapshotDrawLayout()`, `renderWorldTileSnapshotLayerCache()`, `renderWorldTileSnapshotCache()`
- delegated fast-drag composite helpers: `getWorldTileFastDragCompositeSignature()`, `renderWorldTileFastDragComposite()`, `updateWorldTileFastDragComposite()`
- delegated scout helpers: `renderWorldScoutRoutes()`, `getWorldScoutUnitRoutePoints()`, `getWorldScoutUnitProgress()`, `getWorldScoutUnitPoint()`, `getWorldScoutUnitFramePath()`, `renderWorldScoutUnitsLegacy()`
- delegated site overlay helpers: `getWorldSiteDialogPresenter()`, `buildWorldSiteDialogViewState()`, `buildFallbackWorldSiteDialogViewState()`, `renderWorldSiteAction()`, `renderWorldExpeditionConfig()`, `renderWorldSiteModal()`, `renderWorldCityCommandLegacyOverlay()`, `getWorldCityCommandAnchor()`, `getWorldSiteCanvasAnchor()`, `getWorldCityCommandButtonAction()`, `drawWorldCityCommandPrimaryButton()`, `drawWorldCityCommandSideButton()`, `renderWorldCityCommandOverlay()`
- delegated military world-view helper: `renderMilitaryWorldView()`
- delegated fog mask context helpers: `getWorldTileKey()`, `getWorldTileFogRevealEntries()`, `renderWorldTileFogMask()`
- delegated tile-map orchestration helper: `renderWorldTileMap()`
- delegated actor/HUD helpers: `renderWorldScoutUnits()`, `renderWorldActors()`, `addWorldActorHitTargets()`, `renderWorldMarchHud()`, `getNearestWorldTileAtPoint()`, `getEpochNowMs()`
- `lastWorldTileMapContext.renderSnapshot`

目标拆分 / Target Split:

1. Extract remaining legacy radar/non-tile world map view rendering.
2. Extract remaining fog context capture handoff once fog rebuild resumes.
3. Keep this file as a facade after extraction.

当前扩展方式 / Extension Path Now:

- P1-004 后，新拆分 renderer/helper 优先消费 `WorldMapRenderSnapshot`。
- P2-001 后，新 world map visuals 优先通过 `WorldMapVisualPluginRegistry` 注册，再消费自己的 domain snapshot。
- P3-001 后，新 world tile geometry/layout/cache math 先扩展 `WorldMapLayoutModel`，本文件只保留兼容委托。
- P3-002 后，新 world-map 背景/site/march tile hit-target 数据先扩展 `WorldMapHitTargetModel`。
- P3-003 后，新 cache key、pixel-budget layout choice、chunk prune policy 先扩展 `WorldMapCachePolicy`，本文件只负责 canvas/offscreen work。
- P3-004 后，新 generic layer cache work/clip blit helper 先扩展 `WorldMapLayerCacheStore`。
- P3-005 后，新 static/scout layer cache orchestration 先扩展 `WorldMapStaticLayerRenderer`，本文件只保留兼容委托和底层绘制能力。
- P3-006 后，新 water layer cache orchestration、animation frame cache、chunk water frame reuse 先扩展 `WorldMapWaterLayerRenderer`；water pixel/texture drawing 仍扩展 `WorldTileWaterCanvasRenderer`。
- P3-007 后，新 static chunk cache work/repaint/draw/prune 先扩展 `WorldMapStaticChunkRenderer`。
- P3-008 后，新 snapshot-only cache redraw 先扩展 `WorldMapSnapshotCacheRenderer`。
- P3-009 后，新 fast-drag composite cache orchestration 先扩展 `WorldMapFastDragCompositeRenderer`。
- P3-010 后，新 static tile entry、terrain feature、tile feature、site visual drawing 先扩展 `WorldMapStaticEntryRenderer`。
- P3-011 后，新 scout route visual 和 legacy scout unit fallback 先扩展 `WorldMapScoutRenderer`。
- P3-012 后，新 water entry filtering/draw handoff 先扩展 `WorldMapWaterEntryRenderer`；water pixel/texture drawing 仍扩展 `WorldTileWaterCanvasRenderer`。
- Do not add gameplay or visibility rules here.

- P3-013 后，新 world-site modal/action overlay、occupied-city command overlay、expedition config controls 先扩展 `WorldMapSiteOverlayRenderer`；presenter view-state rules 仍扩展 presenter。

- P3-014 后，新 military world-view panel composition、tile-map branch handoff、legacy radar fallback 先扩展 `WorldMapMilitaryViewRenderer`。
- P3-015 后，新 fog mask context capture/handoff 先扩展 `WorldMapFogMaskContextRenderer`；新 fog visual rules 仍扩展 `WorldFogVisualSnapshot` / `WorldMapVisualPluginRegistry`。
- P3-016 后，新 world tile-map frame sequencing 先扩展 `WorldMapTileMapRenderer`；具体 layer/cache/actor/HUD/fog visual 细节仍扩展各自模块。
- P3-017 后，新 actor/HUD runtime handoff 先扩展 `WorldMapActorHudRenderer`；actor drawing 仍扩展 `WorldActorCanvasRenderer`，march HUD visual 仍扩展 `WorldMarchHudCanvasRenderer`。
- P3-018 后，新 compatibility layout fallback 先扩展 `WorldMapLayoutFacade`；pure layout math 仍扩展 `WorldMapLayoutModel`。
- P3-019 后，新 compatibility cache fallback 先扩展 `WorldMapCacheFacade`；pure cache policy 仍扩展 `WorldMapCachePolicy`，generic cache work/blit 仍扩展 `WorldMapLayerCacheStore`。
- P3-020 后，新 compatibility hit-target registration/fallback 先扩展 `WorldMapHitTargetFacade`；pure target data 仍扩展 `WorldMapHitTargetModel`。
- P3-021 后，新 shared render utility helper 先扩展 `WorldMapRenderUtilityFacade`；具体 tile/site visual content 仍扩展 owning renderer modules。
- P3-022 后，新 cache performance knob 先扩展 `WorldMapCacheConfigFacade`；cache key/layout/prune 仍扩展 `WorldMapCachePolicy`，cache work/blit 仍扩展 `WorldMapLayerCacheStore`。
- P3-023 后，新 renderer/facade dependency 先扩展 `WorldMapRendererDependencyRegistry`；不要在本文件顶部新增重复 `global`/`require` 解析块。
- P3-024 后，新 child renderer/facade composition 先扩展 `WorldMapRendererCompositionFactory`；不要在本文件 constructor 新增实例化分支。
- P3-025 后，新 legacy host compatibility proxy behavior 先扩展 `WorldMapRendererHostBridge`；不要在本文件 constructor 新增 proxy 分支。

### `frontend/js/platform/CanvasActionController.js` - 1727 lines

状态 / Status: legacy

当前负责 / Currently Owns:

- many canvas action handlers
- action-to-service calls
- local UI state mutation
- tutorial advancement hooks
- world map drag and action routing
- building/event/tech/military/world site commands

重要公开模式 / Important Public Pattern:

- `handle(action)`
- many `handle_<actionType>(action)` methods

目标拆分 / Target Split:

1. Extract action registry per domain.
2. Extract world map action handlers.
3. Extract building/event/tech action handlers.
4. Keep this file as a dispatch facade.

当前扩展方式 / Extension Path Now:

- Prefer adding new action dispatch entries to registry modules.
- Avoid adding more `handle_*` methods unless there is no domain handler yet.

### `frontend/js/platform/CanvasGameRenderer.js` - 1714 lines

状态 / Status: legacy

当前负责 / Currently Owns:

- main canvas renderer facade
- composition of many page/panel renderers
- HUD/page routing
- render options and view composition
- some world map facade coordination

目标拆分 / Target Split:

1. Extract route-to-renderer table.
2. Extract HUD composition.
3. Extract page render orchestration.
4. Keep this file as a compatibility facade.

当前扩展方式 / Extension Path Now:

- New visual surfaces should prefer standalone renderer modules.
- Do not add gameplay state derivation here.

### `frontend/js/tutorial/TutorialGuideController.js` - 1371 lines

状态 / Status: legacy

当前负责 / Currently Owns:

- tutorial step state
- tutorial target resolution
- tutorial gating rules
- tutorial API sync
- guide highlight progression
- special-case onboarding behavior

目标拆分 / Target Split:

1. Extract tutorial step definitions.
2. Extract target resolver.
3. Extract progression/gating state machine.
4. Keep controller as orchestration facade.

当前扩展方式 / Extension Path Now:

- Add new tutorial data as definitions/config where possible.
- Avoid hard-coding new guide branches in the controller.

### `frontend/js/platform/CanvasGameAppRenderingRuntime.js` - 887 lines

状态 / Status: legacy

当前负责 / Currently Owns:

- app-level render loop
- animation frame scheduling
- map-home render branching
- world map runtime fallback behavior
- loading/render active/read-only behavior

目标拆分 / Target Split:

1. Extract render scheduler.
2. Extract map-home render policy.
3. Extract app render mode policy.
4. Keep install module as facade.

当前扩展方式 / Extension Path Now:

- New render timing rules should become policy helpers first.

### `frontend/js/state/UIStatePresenter.js` - 672 lines

状态 / Status: legacy-candidate

当前负责 / Currently Owns:

- static facade over many presenter modules
- formatting helpers
- resource/building/event/famous/world/talent policy view helpers

目标拆分 / Target Split:

1. Keep as compatibility facade.
2. Move domain-specific helpers to `frontend/js/state/presenters/*`.
3. Stop adding new domain helper implementations directly here.

当前扩展方式 / Extension Path Now:

- Add or extend presenter modules under `frontend/js/state/presenters`.
- Expose pass-through static methods here only for compatibility.

### `frontend/js/platform/WorldMapRuntime.js` - 596 lines

状态 / Status: active-refactor

当前负责 / Currently Owns:

- world map camera state
- drag/pinch camera movement
- map bake signatures
- hit target sync
- render requests
- world-map input action map integration

重要公开方法 / Important Public Methods:

- `canRender(state)`
- `getLayerLayout(state, options)`
- `isMapBakeDirty(state, options)`
- `invalidateBake()`
- `setCamera(x, y, options)`
- `handleDrag(phase, point)`
- `handleTap(point, event)`
- `requestRender(options)`
- `render(options)`
- `getBackgroundMarchTargetAction(point)`

目标拆分 / Target Split:

1. Keep runtime focused on camera/bake/input runtime state.
2. Move map signature policy into a pure helper.
3. Continue shrinking raw input mapping now that P1-005 moved background target action mapping into `WorldMapInputActionMap`.

当前扩展方式 / Extension Path Now:

- Add camera/runtime behavior here only.
- Add new world-map input mapping through `WorldMapInputActionMap`.
- Do not add gameplay simulation or rendering details.

### `frontend/js/state/presenters/WorldTileMapPresenter.js` - 540 lines

状态 / Status: active-refactor

当前负责 / Currently Owns:

- building normalized world tile map view state
- tile/site normalization
- explorer mission normalization
- planned tile/site derivation
- world tile signature

重要公开方法 / Important Public Methods:

- `getWorldTileMapSignature(territoryState, worldExplorerState, options)`
- `normalizeWorldTile(tile, siteById)`
- `normalizeWorldExplorerMission(mission)`
- `getWorldExplorerMissions(worldExplorerState, options)`
- `getWorldExplorerPlannedTiles(worldExplorerState, options)`
- `getWorldExplorerPlannedSites(worldExplorerState, options)`
- `buildWorldTileMapViewState(territoryState, options)`

目标拆分 / Target Split:

1. Extract tile normalization.
2. Extract explorer mission normalization.
3. Extract visibility/exploration state later under P1.

当前扩展方式 / Extension Path Now:

- Add pure presenter helpers here only if they convert state to render/view state.
- Do not add renderer behavior.

## 4. P0-005 拆分顺序 / Split Order

Recommended first split sequence:

1. `WorldMapCanvasRenderer.js`: extract layout/cache/hit-target helper modules first because it blocks world map and fog rebuild work.
2. `CanvasActionController.js`: extract domain action handlers so new features stop adding `handle_*` methods to one file.
3. `CanvasGameRenderer.js`: extract render routing and HUD composition once action boundaries are clearer.
4. `TutorialGuideController.js`: extract step definitions and target resolver after action/render targets are stable.
5. `UIStatePresenter.js` and `WorldTileMapPresenter.js`: continue moving domain helpers into presenter modules as needed by P1 world map systems.

## 5. 更新日志 / Update Log

| Date | Change |
| --- | --- |
| 2026-06-08 | Created module responsibility index. Added completed P0 modules, current public APIs, extension paths, and P0-005 oversized-module split order. |
| 2026-06-08 | Added architecture smoke script responsibility and public command `npm run test:architecture`. |
| 2026-06-08 | Standardized documentation style: Chinese-first explanations with English module/API/architecture keyword labels. |
| 2026-06-08 | Added `WorldMapVisibilityModel` candidate module with compact visibility snapshot API and performance constraints. |
| 2026-06-08 | Added `WorldMapEntitySnapshot` candidate module for normalized world map entities/components with compact indexes. |
| 2026-06-08 | Added `WorldMarchProgressSnapshot` candidate module for pure march progress, actor rows, and arrival result rows; `WorldMarchSystem` now acts as a compatibility facade for march calculations. |
| 2026-06-08 | Added `WorldMapRenderSnapshot` candidate module as the single world-map renderer input contract and wired `WorldMapCanvasRenderer.renderWorldTileMap()` to expose `lastWorldTileMapContext.renderSnapshot`. |
| 2026-06-08 | Added `WorldMapInputActionMap` candidate module for pure world-map input-to-action mapping and wired `WorldMapRuntime` to delegate hit-target filtering/background march target inference. |
| 2026-06-08 | Added `WorldExplorerDtoMapper` candidate module as the backend world explorer API DTO boundary; `WorldExplorerClientState` now delegates response shape after progression. |
| 2026-06-08 | Added `WorldFogVisualSnapshot` and `WorldMapVisualPluginRegistry` candidate modules for P2-001 fog plugin rebuild; shell fog rendering now consumes registry output when `FOG_OF_WAR_ENABLED` is explicitly enabled. |
| 2026-06-08 | Added `DebugOverlaySnapshot` and `DebugOverlayRegistry` candidate modules for P2-002 debug overlay registry; shell can create default-off debug snapshots when `DEBUG_OVERLAYS_ENABLED` is explicitly enabled. |
| 2026-06-08 | Added `AssetKeyRegistry` candidate module for P2-003 asset key hardening and migrated `CanvasPreloadAssetManifest` base preload paths to stable keys while preserving legacy path output. |
| 2026-06-08 | Added `GameStateMigrationPipeline` candidate module for P2-004 save-schema migration; `GameStateNormalizer` now migrates raw saves before derived normalization and `GameStateRepository` persists `saveMetadata`. |
| 2026-06-08 | Added `WorldMapPerformanceBudget` candidate module for P2-005 structural performance gates over large visibility/entity/render snapshots. |
| 2026-06-08 | Added `WorldMapLayoutModel` candidate module for P3-001; `WorldMapCanvasRenderer` now delegates pure tile layout/cache math while keeping compatibility helper methods. |
| 2026-06-08 | Added `WorldMapHitTargetModel` candidate module for P3-002; `WorldMapCanvasRenderer` now delegates world-map background/site/march tile hit-target data creation. |
| 2026-06-08 | Added `WorldMapCachePolicy` candidate module for P3-003; `WorldMapCanvasRenderer` now delegates pure cache key, layout choice, chunk prune, and snapshot draw-layout policy. |
| 2026-06-08 | Added `WorldMapLayerCacheStore` candidate module for P3-004; `WorldMapCanvasRenderer` now delegates generic offscreen cache work creation/reuse and clipped cache blits. |
| 2026-06-08 | Added `WorldMapStaticLayerRenderer` candidate module for P3-005; `WorldMapCanvasRenderer` now delegates static tile layer and scout route cache render orchestration. |
| 2026-06-08 | Added `WorldMapWaterLayerRenderer` candidate module for P3-006; `WorldMapCanvasRenderer` now delegates animated water frame cache and water chunk cache orchestration. |
| 2026-06-08 | Added `WorldMapStaticChunkRenderer` candidate module for P3-007; `WorldMapCanvasRenderer` now delegates static chunk cache creation/repaint/draw/prune orchestration. |
| 2026-06-08 | Added `WorldMapSnapshotCacheRenderer` candidate module for P3-008; `WorldMapCanvasRenderer` now delegates snapshot-only layer/chunk cache redraw orchestration. |
| 2026-06-08 | Added `WorldMapFastDragCompositeRenderer` candidate module for P3-009; `WorldMapCanvasRenderer` now delegates fast-drag composite cache signature/rebuild/blit orchestration. |
| 2026-06-08 | Added `WorldMapStaticEntryRenderer` candidate module for P3-010; `WorldMapCanvasRenderer` now delegates static entry terrain/feature/site drawing orchestration. |
| 2026-06-08 | Added `WorldMapScoutRenderer` candidate module for P3-011; `WorldMapCanvasRenderer` now delegates scout route drawing and legacy scout unit helpers. |
| 2026-06-08 | Added `WorldMapWaterEntryRenderer` candidate module for P3-012; `WorldMapCanvasRenderer` now delegates water entry filtering and draw handoff. |
| 2026-06-08 | Added `WorldMapSiteOverlayRenderer` candidate module for P3-013; `WorldMapCanvasRenderer` now delegates world-site modal/action overlays and occupied-city command overlay helpers. |
| 2026-06-08 | Added `WorldMapMilitaryViewRenderer` candidate module for P3-014; `WorldMapCanvasRenderer` now delegates military world-view panel composition and legacy radar fallback rendering. |
| 2026-06-08 | Added `WorldMapFogMaskContextRenderer` candidate module for P3-015; `WorldMapCanvasRenderer` now delegates fog mask context capture and reveal-entry filtering while fog visuals remain default-off. |
| 2026-06-08 | Added `WorldMapTileMapRenderer` candidate module for P3-016; `WorldMapCanvasRenderer` now delegates one-frame tile-map orchestration and dropped to 1648 lines. |
| 2026-06-08 | Added `WorldMapActorHudRenderer` candidate module for P3-017; `WorldMapCanvasRenderer` now delegates actor/HUD runtime handoff and dropped to 1640 lines. |
| 2026-06-08 | Added `WorldMapLayoutFacade` candidate module for P3-018; `WorldMapCanvasRenderer` now delegates layout compatibility fallbacks and dropped to 1300 lines. |
| 2026-06-08 | Added `WorldMapCacheFacade` candidate module for P3-019; `WorldMapCanvasRenderer` now delegates cache compatibility fallbacks and dropped to 1132 lines. |
| 2026-06-08 | Added `WorldMapHitTargetFacade` candidate module for P3-020; `WorldMapCanvasRenderer` now delegates hit-target compatibility registration and dropped to 1093 lines. |
| 2026-06-08 | Added `WorldMapRenderUtilityFacade` candidate module for P3-021; `WorldMapCanvasRenderer` now delegates render utility helpers and dropped to 1088 lines. |
| 2026-06-08 | Added `WorldMapCacheConfigFacade` candidate module for P3-022; `WorldMapCanvasRenderer` now delegates cache performance config helpers and is 1113 lines after load-order/constructor wiring. |
| 2026-06-08 | Added `WorldMapRendererDependencyRegistry` candidate module for P3-023; `WorldMapCanvasRenderer` now consumes registry-backed dependencies and dropped to 822 lines. |
| 2026-06-08 | Added `WorldMapRendererCompositionFactory` candidate module for P3-024; `WorldMapCanvasRenderer` now delegates child renderer/facade composition and dropped to 741 lines. |
| 2026-06-08 | Added `WorldMapRendererHostBridge` candidate module for P3-025; `WorldMapCanvasRenderer` now delegates legacy host compatibility proxy behavior and dropped to 718 lines. |
