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
5. Before promoting a module to `stable`, verify it against `docs/stable_block_promotion_matrix_2026-06-09.md`.
6. Update this document in the same change whenever a module's responsibility, public API, extension path, or stability status changes.

状态说明 / Status Meanings:

- `stable`: feature iteration should not edit internals except bug/perf/security/contract fixes.
- `candidate`: boundary is useful but still being proven by tests.
- `active-refactor`: currently being reshaped; changes are expected.
- `legacy`: oversized or mixed responsibility; do not add new responsibility here.
- `test`: regression owner.

回归约定 / Regression Convention:

- 每个模块的 `回归 / Regression` 先列自己的 focused command，再列 `npm run test:architecture` if the module is part of the current architecture baseline.
- `npm run test:architecture` is the required final gate before commit/deploy. It runs baseline syntax checks, all candidate/stable focused tests currently registered in `scripts/run-architecture-smoke.js`, and `git diff --check`.
- 新 candidate/stable 模块进入 baseline 时，必须同步加入 `scripts/run-architecture-smoke.js` 的 `CHECK_FILES` and, when it has tests, `TEST_FILES`.
- P3-001 through P3-025 are complete in the plan, but their split modules remain `candidate` here until they have survived longer feature iteration without contract churn.

Stable 晋升约定 / Stable Promotion Convention:

- `stable` means the block is closed for feature iteration. Feature work must extend through the listed extension path instead of editing internals.
- A `candidate` module can become `stable` only after its stable surface is checked against `docs/stable_block_promotion_matrix_2026-06-09.md`.
- World-map stable contracts must use diamond isometric square-tile terminology; legacy `q/r` fields are compatibility aliases, not hex/axial public semantics.
- Realtime/multiplayer stable contracts must stay backend-authoritative: frontend submits intent, server owns timeline/result, frontend interpolates confirmed state.
- Large-map stable contracts must not assume a full world array in frontend memory. They must support chunk/window loading, persistent revealed terrain, and full-direction wrapping.

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
- `npm run test:architecture`

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
- `npm run test:architecture`

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
- `npm run test:architecture`

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
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameShell.js`

状态 / Status: candidate facade

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
- `npm run test:architecture`

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
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameShellWorldMapRuntimePolicy.js`

状态 / Status: candidate

负责 / Owns:

- pure snapshot render option resolution for shell world-map refreshes
- world-tile water animation frame timing and layer padding policy
- world-map drag state, cooldown, transform limit, drag offset, and pan normalization
- runtime world-map frame option derivation and snapshot-water refresh detection

公开 API / Public API:

- `CanvasGameShellWorldMapRuntimePolicy.hasNumber(value)`
- `CanvasGameShellWorldMapRuntimePolicy.getSnapshotRenderOptions(waterTimeMs, fallbackWaterTimeMs)`
- `CanvasGameShellWorldMapRuntimePolicy.getWaterAnimationFrameMs(options)`
- `CanvasGameShellWorldMapRuntimePolicy.getLayerPadding(options)`
- `CanvasGameShellWorldMapRuntimePolicy.getDragCooldownMs(value)`
- `CanvasGameShellWorldMapRuntimePolicy.isDragging(waterTimeMs)`
- `CanvasGameShellWorldMapRuntimePolicy.isDragCoolingDown(cooldownUntil, nowMs)`
- `CanvasGameShellWorldMapRuntimePolicy.getDragTransformLimit(layerPadding)`
- `CanvasGameShellWorldMapRuntimePolicy.isDragTransformNearLimit(offset, options)`
- `CanvasGameShellWorldMapRuntimePolicy.getDragOffset(runtime)`
- `CanvasGameShellWorldMapRuntimePolicy.getWorldMapPan(uiState)`
- `CanvasGameShellWorldMapRuntimePolicy.resolveRuntimeFrameOptions(options, state)`
- `CanvasGameShellWorldMapRuntimePolicy.isSnapshotWaterRefresh(options)`

扩展方式 / Extension Path:

- 新 shell world-map runtime pure policy first extends this module with focused tests。
- Shell/coordinator/render side effects stay in `CanvasGameShellWorldMapRuntime`.
- Rendering and cache internals stay in renderer/runtime modules, not this policy.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShellWorldMapRuntimePolicy.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameShellWorldMapLayerBridge.js`

状态 / Status: candidate

负责 / Owns:

- world map renderer layer metrics sync
- fog renderer metrics sync when fog is enabled
- fog render dispatch through `WorldMapVisualPluginRegistry`
- world map/fog layer transform and visibility helpers
- world-map snapshot layer refresh and baked-camera commit

公开 API / Public API:

- `CanvasGameShellWorldMapLayerBridge.install(CanvasGameShell)`

安装到 shell 的公开 API / Public API Installed On Shell:

- `syncWorldMapRendererLayerMetrics()`
- `renderWorldFogLayer(context)`
- `clearWorldMapLayerTransform()`
- `setWorldMapLayerVisible(visible)`
- `refreshWorldMapLayerFromSnapshot(options)`

扩展方式 / Extension Path:

- New shell-owned world-map layer/fog/snapshot side effects extend this bridge with focused tests.
- Pure shell world-map policy stays in `CanvasGameShellWorldMapRuntimePolicy`.
- Renderer drawing/cache internals stay in renderer modules.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShellWorldMapLayerBridge.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameShellWorldMapDragRuntime.js`

状态 / Status: candidate

负责 / Owns:

- shell world-map snapshot water-time lifecycle
- drag cooldown and drag state checks
- drag offset/transform-limit helpers through `CanvasGameShellWorldMapRuntimePolicy`
- drag compositor snapshot refresh, transform clearing, and layer translate fallback

公开 API / Public API:

- `CanvasGameShellWorldMapDragRuntime.install(CanvasGameShell)`

安装到 shell 的公开 API / Public API Installed On Shell:

- `getWorldMapSnapshotRenderOptions(waterTimeMs)`
- `getWorldMapLayerPadding()`
- `getFrozenWorldMapWaterTimeMs()`
- `isWorldMapDragging()`
- `isWorldMapDragCoolingDown()`
- `getWorldMapDragCooldownMs()`
- `hasPendingWorldMapCompositeCommit()`
- `getWorldMapPan()`
- `startWorldMapSnapshotDrag()`
- `finishWorldMapSnapshotDrag()`
- `getWorldMapRuntimeDragOffset()`
- `getWorldMapDragTransformLimit()`
- `isWorldMapDragTransformNearLimit(offset)`
- `updateWorldMapDragCompositor()`

扩展方式 / Extension Path:

- New shell drag/compositor side effects extend this runtime with focused tests.
- Pure drag math and option derivation stay in `CanvasGameShellWorldMapRuntimePolicy`.
- Render frame scheduling stays in `CanvasGameShellWorldMapFrameRuntime`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShellWorldMapDragRuntime.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameShellWorldMapFrameRuntime.js`

状态 / Status: candidate

负责 / Owns:

- world-map frame request queuing
- runtime/snapshot frame option handoff through `CanvasGameShellWorldMapRuntimePolicy`
- fallback non-runtime world-map layer rendering
- tile-map water timer lifecycle

公开 API / Public API:

- `CanvasGameShellWorldMapFrameRuntime.install(CanvasGameShell)`

安装到 shell 的公开 API / Public API Installed On Shell:

- `getWorldTileWaterAnimationFrameMs()`
- `renderWorldMapLayerFrame(options)`
- `requestWorldMapRenderAnimationFrame(options)`
- `renderWorldMapLayer(state, options)`
- `startTileMapWaterTimer()`
- `stopTileMapWaterTimer()`

扩展方式 / Extension Path:

- New world-map frame/timer orchestration extends this runtime with focused tests.
- Layer/fog/snapshot refresh side effects stay in `CanvasGameShellWorldMapLayerBridge`.
- Coordinator integration stays in `CanvasGameShellWorldMapRuntime`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShellWorldMapFrameRuntime.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameShellWorldMapRuntime.js` - 122 lines

状态 / Status: candidate facade

负责 / Owns:

- world map runtime coordinator integration
- coordinator-backed map-home active checks
- runtime drag routing through the coordinator
- runtime world-map render dispatch and dirty-check decision handoff

公开 API / Public API:

- `CanvasGameShellWorldMapRuntime.install(CanvasGameShell)`

安装到 shell 的公开 API / Public API Installed On Shell:

- `ensureWorldMapRuntimeCoordinator()`
- `ensureWorldMapRuntime()`
- `isWorldMapHomeActive()`
- `canRouteWorldMapRuntimeDrag(point)`
- `handleWorldMapRuntimeDrag(phase, point, event)`
- `renderRuntimeWorldMap(state, options)`
- `shouldRenderRuntimeWorldMap(state, options)`

扩展方式 / Extension Path:

- New coordinator integration behavior extends this facade only when it cannot belong to layer, drag, or frame runtime modules.
- Layer/fog/snapshot behavior extends `CanvasGameShellWorldMapLayerBridge`.
- Drag water-time/compositor behavior extends `CanvasGameShellWorldMapDragRuntime`.
- Frame/timer behavior extends `CanvasGameShellWorldMapFrameRuntime`.
- Pure shell world-map runtime calculations extend `CanvasGameShellWorldMapRuntimePolicy`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShellWorldMapLayerBridge.test.js frontend/js/platform/CanvasGameShellWorldMapDragRuntime.test.js frontend/js/platform/CanvasGameShellWorldMapFrameRuntime.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

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
- `npm run test:architecture`

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
- `npm run test:architecture`

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
- `npm run test:architecture`

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
- `npm run test:architecture`

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

- 新的大地图 snapshot 或 cache policy 先增加 check，再加入 tests 和 architecture baseline。
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

### `frontend/js/domain/WorldMarchGeometry.js`

状态 / Status: candidate

负责 / Owns:

- pure tile screen projection for world march actors and target controls
- nearest rendered world-tile lookup from screen points
- axial tile inference from screen points and viewport geometry
- march target UI-state normalization for HUD/render helpers

公开 API / Public API:

- `WorldMarchGeometry.toNumber(value, fallback)`
- `WorldMarchGeometry.toInteger(value, fallback)`
- `WorldMarchGeometry.tileId(q, r)`
- `WorldMarchGeometry.getTileScreenCenter(coord, viewport, geometry)`
- `WorldMarchGeometry.screenPointToNearestTile(point, tileMapView, viewport)`
- `WorldMarchGeometry.screenPointToAxialTile(point, viewport, geometry)`
- `WorldMarchGeometry.getMarchTargetUiState(uiState)`

扩展方式 / Extension Path:

- 新 world-march screen/input geometry first extends this module with focused tests。
- New gameplay march progress or arrival rules stay in `WorldMarchProgressSnapshot` or later systems modules.
- `WorldMarchSystem` keeps compatibility methods only; do not add new geometry bodies back there.

回归 / Regression:

- `node --test frontend/js/domain/WorldMarchGeometry.test.js frontend/js/domain/WorldMarchSystem.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMarchSystem.js` - 53 lines

状态 / Status: candidate facade

负责 / Owns:

- 保留旧世界行军 public API，避免一次性改动 renderer/HUD/presenter 调用
- 行军进度、抵达状态、actor 生成等 gameplay calculation 已委托 `WorldMarchProgressSnapshot`
- tile screen geometry、screen point to axial tile、march target UI state 等旧 helper 已委托 `WorldMarchGeometry`

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
- 新 screen/input geometry 应进入 `WorldMarchGeometry`；action mapping 进入 input/action adapter。
- Renderer/HUD can continue using this compatibility facade, but new callers should prefer `WorldMarchProgressSnapshot` or `WorldMarchGeometry` directly.

回归 / Regression:

- `node --test frontend/js/domain/WorldMarchGeometry.test.js frontend/js/domain/WorldMarchSystem.test.js frontend/js/domain/WorldMarchProgressSnapshot.test.js`
- `npm run test:architecture`

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
- `npm run test:architecture`

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
- `npm run test:architecture`

### `frontend/js/platform/CanvasTerritoryActionHandlers.js`

状态 / Status: candidate

负责 / Owns:

- `CanvasActionController` 的 territory/world-site/world-march/expedition/battle-scene action handlers
- world map drag target selection and expedition launch/cancel orchestration
- battle scene close/skip action compatibility
- installed legacy `handle_*` method names for the territory action domain

公开 API / Public API:

- `CanvasTerritoryActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 territory/world-site/world-march action 先扩展本模块，再让 `CanvasActionController` 只保留 facade/dispatch 行为。
- 新 gameplay simulation 不进入本模块；本模块只负责 action-to-controller/API/UI-state orchestration。
- 如果 action 属于 building/event/tech/famous/talent policy/shell domain，扩展对应 domain handler module。

回归 / Regression:

- `node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasCityActionHandlers.js`

状态 / Status: candidate

负责 / Owns:

- `CanvasActionController` city-management/event/task-center/city-selection action handlers
- building and tech action forwarding plus local pending state sync
- city enter/selection and task reward orchestration
- installed legacy `handle_*` method names for the city action domain

公开 API / Public API:

- `CanvasCityActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 city-management/event/task-center/building/tech action 先扩展本模块。
- 新 territory/world-map actions stay in `CanvasTerritoryActionHandlers`.
- 新 famous-person/talent-policy/shell actions stay in their focused handler modules.

回归 / Regression:

- `node --test frontend/js/platform/CanvasCityActionHandlers.test.js frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasFamousActionHandlers.js`

状态 / Status: candidate

负责 / Owns:

- famous-person panel/detail/search action handlers
- famous-person accept/dismiss/attribute/page action forwarding
- tutorial refresh hooks for famous-person UI actions
- installed legacy `handle_*` method names for the famous-person action domain

公开 API / Public API:

- `CanvasFamousActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 famous-person canvas action 先扩展本模块。
- Famous-person view-state shape stays in presenter modules; gameplay/service changes stay outside this handler.
- Do not add famous-person handlers directly to `CanvasActionController`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasFamousActionHandlers.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasTalentPolicyActionHandlers.js`

状态 / Status: candidate

负责 / Owns:

- talent-policy panel/draft/apply/confirm/save/delete action handlers
- talent-policy draft normalization and finalization helper behavior previously embedded in `CanvasActionController`
- tutorial and shell/game panel sync hooks for talent-policy UI actions
- installed legacy `handle_*` method names for the talent-policy action domain

公开 API / Public API:

- `CanvasTalentPolicyActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 talent-policy canvas action 先扩展本模块。
- Talent policy data derivation belongs in state/domain presenters or services, not in the controller facade.
- Do not add talent-policy handlers directly to `CanvasActionController`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasTalentPolicyActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasShellActionHandlers.js`

状态 / Status: candidate

负责 / Owns:

- shell/system/account/naming/advisor/guidebook/army-formation action handlers
- tab switching, command panel, reward reveal, settings/logs/auth/reset/logout action orchestration
- naming finalization helper behavior previously embedded in `CanvasActionController`
- installed legacy `handle_*` method names for shell/system action domains

公开 API / Public API:

- `CanvasShellActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 shell/system/account/naming/advisor/guidebook action 先扩展本模块。
- Domain gameplay actions stay in territory/city/famous/talent-policy handlers.
- Do not add shell/system handlers directly to `CanvasActionController`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/CanvasGameApp.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameRendererCompositionFactory.js`

状态 / Status: candidate

负责 / Owns:

- `CanvasGameRenderer` child renderer dependency lookup and construction
- injected instance precedence over class/global/CommonJS fallback
- child renderer property ordering and presenter sync helpers
- H5/minigame load-order contract before `CanvasGameRenderer`

公开 API / Public API:

- `CanvasGameRendererCompositionFactory.create(options)`
- `CanvasGameRendererCompositionFactory.getChildRendererSpecs()`
- `CanvasGameRendererCompositionFactory.getChildRendererKeys()`
- `CanvasGameRendererCompositionFactory.getChildRenderers(host, rendererKeys)`
- `CanvasGameRendererCompositionFactory.syncChildRendererPresenter(host, renderer)`
- `CanvasGameRendererCompositionFactory.syncChildRendererPresenters(host, rendererKeys)`

性能约束 / Performance Constraints:

- Composition happens once per `CanvasGameRenderer` instance.
- Per-frame rendering uses cached child renderer references.
- Dependency lookup does not scan directories or allocate per frame.

扩展方式 / Extension Path:

- 新 child renderer wiring 先扩展 `CHILD_RENDERER_SPECS` and focused tests。
- Do not add child renderer construction branches back into `CanvasGameRenderer`.
- New rendering behavior still belongs in the owning renderer; this factory only wires modules.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameRendererCompositionFactory.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameRendererCoreFacades.js`

状态 / Status: candidate

负责 / Owns:

- core `CanvasGameRenderer` compatibility method installation for surface, asset, world-tile-water, and famous helpers
- delegate fallback behavior for historical renderer method names
- H5/minigame load-order contract before `CanvasGameRenderer`

公开 API / Public API:

- `CanvasGameRendererCoreFacades.CORE_FACADE_METHODS`
- `CanvasGameRendererCoreFacades.installCoreFacades(CanvasGameRenderer)`

扩展方式 / Extension Path:

- 新 core surface/asset/world-tile-water/famous compatibility method 先扩展 `CORE_FACADE_METHODS` with a focused test。
- New page/panel/HUD compatibility methods belong in `CanvasGameRendererPageFacades`.
- Do not add these compatibility methods directly to `CanvasGameRenderer`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameRendererCoreFacades.test.js frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/renderers/CanvasAssetRenderer.test.js frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameRendererPageFacades.js`

状态 / Status: candidate

负责 / Owns:

- page/panel/HUD/frame compatibility method installation for `CanvasGameRenderer`
- command, tutorial, tech, building, event, city, home, overlay, advisor, tab compatibility helpers
- render routing pass-through methods historically exposed by `CanvasGameRenderer`
- H5/minigame load-order contract before `CanvasGameRenderer`

公开 API / Public API:

- `CanvasGameRendererPageFacades.PAGE_FACADE_METHODS`
- `CanvasGameRendererPageFacades.installPageFacades(CanvasGameRenderer)`

扩展方式 / Extension Path:

- 新 page/panel/HUD/frame compatibility method 先扩展 `PAGE_FACADE_METHODS` with a focused test。
- New core surface/asset/famous/world-tile-water compatibility methods belong in `CanvasGameRendererCoreFacades`.
- Do not add page/panel compatibility methods directly to `CanvasGameRenderer`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameRendererPageFacades.test.js frontend/js/platform/renderers/CanvasFrameRenderer.test.js frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameAppRenderPolicy.js`

状态 / Status: candidate

负责 / Owns:

- pure app render policy for map-home view-state resolution
- stable canvas tab order
- guide-driven preferred military-view selection

公开 API / Public API:

- `CanvasGameAppRenderPolicy.TAB_ORDER`
- `CanvasGameAppRenderPolicy.resolveMapHomeViewState(state, options)`
- `CanvasGameAppRenderPolicy.getTabOrder()`
- `CanvasGameAppRenderPolicy.getPreferredMilitaryView(tabId, guide)`

扩展方式 / Extension Path:

- 新 map-home render policy or tab-order behavior 先扩展本模块，并同步 focused tests。
- Presenter-specific view-state formatting stays in presenter modules.
- Do not add pure render policy branches back into `CanvasGameAppRenderingRuntime`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameAppRenderPolicy.test.js frontend/js/platform/CanvasGameApp.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameAppRenderScheduler.js`

状态 / Status: candidate

负责 / Owns:

- app render clock, wait, interval, and `requestAnimationFrame` adapter helpers
- transition duration and animation frame defaults
- world tile water animation frame duration
- world-map drag cooldown default

公开 API / Public API:

- `CanvasGameAppRenderScheduler.now(host)`
- `CanvasGameAppRenderScheduler.wait(host, ms)`
- `CanvasGameAppRenderScheduler.getRequestAnimationFrame(host)`
- `CanvasGameAppRenderScheduler.getAnimationFrameMs(host)`
- `CanvasGameAppRenderScheduler.getTransitionDurationMs(host)`
- `CanvasGameAppRenderScheduler.getWorldMapDragCooldownMs(host)`
- `CanvasGameAppRenderScheduler.getWorldTileWaterAnimationFrameMs(host)`
- `CanvasGameAppRenderScheduler.getIntervalHost(host)`
- `CanvasGameAppRenderScheduler.setIntervalForHost(host, callback, delay)`
- `CanvasGameAppRenderScheduler.clearIntervalForHost(host, timer)`

扩展方式 / Extension Path:

- 新 render scheduling/timing rule 先扩展本模块，并保留 injected scheduler/runtime fallback tests。
- Do not add direct `setInterval` / `clearInterval` fallback branches back into `CanvasGameAppRenderingRuntime`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameAppRenderScheduler.test.js frontend/js/platform/CanvasGameApp.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameAppWorldMapRuntimeBridge.js`

状态 / Status: candidate

负责 / Owns:

- world-map runtime compatibility method installation for `CanvasGameApp`
- runtime coordinator creation and map-runtime ownership bridge
- snapshot drag water-time lifecycle and drag cooldown state
- runtime world-map render decision and baked-layer refresh helpers
- H5/minigame load-order contract before `CanvasGameAppRenderingRuntime`

公开 API / Public API:

- `CanvasGameAppWorldMapRuntimeBridge.WORLD_MAP_RUNTIME_METHODS`
- `CanvasGameAppWorldMapRuntimeBridge.install(CanvasGameApp)`

安装到 `CanvasGameApp` 的主要方法 / Main Installed Methods:

- `ensureWorldMapRuntimeCoordinator()`
- `ensureWorldMapRuntime()`
- `isWorldMapHomeActive()`
- `renderRuntimeWorldMap(options)`
- `shouldRenderRuntimeWorldMap(options)`
- `refreshWorldMapLayerFromSnapshot(options)`
- `startWorldMapSnapshotDrag()`
- `finishWorldMapSnapshotDrag()`
- `renderWorldMapSnapshotDragFrame()`

扩展方式 / Extension Path:

- 新 world-map runtime bridge behavior 先扩展 `WORLD_MAP_RUNTIME_METHODS` with focused tests。
- World-map gameplay rules stay in world-map domain/systems/services.
- Renderer-layer drawing stays in world-map renderer modules.
- Do not add world-map runtime compatibility methods back into `CanvasGameAppRenderingRuntime`.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameAppWorldMapRuntimeBridge.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/state/presenters/WorldTileMapTileNormalizer.js`

状态 / Status: candidate

负责 / Owns:

- pure single world-tile normalization for presenter/view-state consumption
- terrain asset, feature, template, water, and site overlay normalization
- tile visibility/intel field normalization
- mountain neighbor count derivation from injected tile terrain index

公开 API / Public API:

- `WorldTileMapTileNormalizer.toNumber(value, fallback)`
- `WorldTileMapTileNormalizer.toInteger(value, fallback)`
- `WorldTileMapTileNormalizer.getTileMapManifest(options)`
- `WorldTileMapTileNormalizer.getWorldTileId(q, r)`
- `WorldTileMapTileNormalizer.getMountainNeighborCount(tile, siteById)`
- `WorldTileMapTileNormalizer.normalizeIntel(intel)`
- `WorldTileMapTileNormalizer.normalizeTemplateAssets(templateAssets)`
- `WorldTileMapTileNormalizer.normalizeWaterAsset(manifest, terrainAsset)`
- `WorldTileMapTileNormalizer.normalizeFeature(manifest, terrainAsset)`
- `WorldTileMapTileNormalizer.normalizeSite(manifest, site)`
- `WorldTileMapTileNormalizer.normalizeWorldTile(tile, siteById, options)`

扩展方式 / Extension Path:

- 新单 tile render/view-state 字段先扩展本模块，并同步 focused tests。
- Multi-tile map composition stays in `WorldTileMapPresenter`.
- Gameplay visibility or exploration rules stay in domain/systems, not this normalizer.

回归 / Regression:

- `node --test frontend/js/state/presenters/WorldTileMapTileNormalizer.test.js frontend/js/state/UIStatePresenter.test.js`
- `npm run test:architecture`

### `frontend/js/state/presenters/WorldTileMapExplorerNormalizer.js`

状态 / Status: candidate

负责 / Owns:

- pure world-explorer mission normalization for world tile-map presenter data
- mission merge from list/active/ready/idle slots with richer-array preservation
- epoch-time based mission derivation through injected `WorldMarchSystem` / `WorldTime`
- planned tile and planned site reveal filtering for presenter view-state composition
- coordinate and world tile id normalization shared by explorer presenter helpers

公开 API / Public API:

- `WorldTileMapExplorerNormalizer.toNumber(value, fallback)`
- `WorldTileMapExplorerNormalizer.toInteger(value, fallback)`
- `WorldTileMapExplorerNormalizer.getWorldTileId(q, r)`
- `WorldTileMapExplorerNormalizer.getEpochNowMs(options)`
- `WorldTileMapExplorerNormalizer.normalizeCoord(coord)`
- `WorldTileMapExplorerNormalizer.normalizeWorldExplorerMission(mission)`
- `WorldTileMapExplorerNormalizer.mergeWorldExplorerMissions(worldExplorerState)`
- `WorldTileMapExplorerNormalizer.getWorldExplorerMissions(worldExplorerState, options)`
- `WorldTileMapExplorerNormalizer.getWorldExplorerPlannedTiles(worldExplorerState, options)`
- `WorldTileMapExplorerNormalizer.getWorldExplorerPlannedSites(worldExplorerState, options)`

扩展方式 / Extension Path:

- 新 world-explorer presenter-only mission/planned-tile/planned-site normalization 先扩展本模块，并同步 focused tests。
- Map-level composition stays in `WorldTileMapPresenter`.
- Gameplay progression, march timing rules, or persistence DTO mapping stay in domain/client-state modules, not this normalizer.

回归 / Regression:

- `node --test frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js frontend/js/state/UIStatePresenter.test.js`
- `npm run test:architecture`

### `frontend/js/platform/WorldMapRuntimeBakePolicy.js`

状态 / Status: candidate

负责 / Owns:

- pure world-map data signature generation for runtime bake decisions
- presenter-backed signature delegation with fallback compact serialization
- signature sync result derivation without mutating runtime state
- pure bake-dirty checks from runtime state plus current map data

公开 API / Public API:

- `WorldMapRuntimeBakePolicy.getMapDataSignature(state, options)`
- `WorldMapRuntimeBakePolicy.getSignatureSyncResult(previousSignature, nextSignature)`
- `WorldMapRuntimeBakePolicy.isMapBakeDirty(runtimeState, state, options)`

扩展方式 / Extension Path:

- 新 map-bake signature fields or bake-dirty policy first extend this module with focused tests。
- Runtime side effects such as logging, renderer cache invalidation, and camera/baked-layer state stay in `WorldMapRuntime`.
- Renderer cache key policy stays in renderer/cache modules, not this runtime policy.

回归 / Regression:

- `node --test frontend/js/platform/WorldMapRuntimeBakePolicy.test.js frontend/js/platform/WorldMapRuntime.test.js`
- `npm run test:architecture`

### `frontend/js/platform/WorldMapRuntimeCameraPolicy.js`

状态 / Status: candidate

负责 / Owns:

- pure world-map runtime camera initialization and UI-state composition
- UI camera sync and set-camera change resolution
- drag start/move/end camera math without renderer/runtime side effects
- baked-camera offset calculation
- drag-layer hit-target offset normalization and application

公开 API / Public API:

- `WorldMapRuntimeCameraPolicy.toNumber(value, fallback)`
- `WorldMapRuntimeCameraPolicy.toLegacyAxis(value, fallback)`
- `WorldMapRuntimeCameraPolicy.createInitialCamera(options)`
- `WorldMapRuntimeCameraPolicy.createCameraUiState(base, camera)`
- `WorldMapRuntimeCameraPolicy.syncCameraFromUi(camera, uiState)`
- `WorldMapRuntimeCameraPolicy.resolveCameraChange(camera, x, y)`
- `WorldMapRuntimeCameraPolicy.getCameraOffsetFromBaked(camera, bakedCamera)`
- `WorldMapRuntimeCameraPolicy.createDragState(point, camera)`
- `WorldMapRuntimeCameraPolicy.resolveDragCamera(drag, point)`
- `WorldMapRuntimeCameraPolicy.canEndDrag(drag, point)`
- `WorldMapRuntimeCameraPolicy.normalizeDragLayerOffset(x, y)`
- `WorldMapRuntimeCameraPolicy.applyOffsetToHitTargets(hitTargets, offset)`

扩展方式 / Extension Path:

- 新 camera/drag pure calculation first extends this module with focused tests。
- Map bounds, render scheduling, callbacks, and renderer cache side effects stay in `WorldMapRuntime`.
- Input action mapping stays in `WorldMapInputActionMap`.

回归 / Regression:

- `node --test frontend/js/platform/WorldMapRuntimeCameraPolicy.test.js frontend/js/platform/WorldMapRuntime.test.js`
- `npm run test:architecture`

### `frontend/js/platform/WorldMapRuntimeInputPolicy.js`

状态 / Status: candidate

负责 / Owns:

- pure runtime input-layout availability checks
- map input rectangle fallback resolution from layout, renderer, runtime, and system metrics
- inclusive point-in-map bounds checks without renderer/runtime side effects

公开 API / Public API:

- `WorldMapRuntimeInputPolicy.hasInputLayout(layout)`
- `WorldMapRuntimeInputPolicy.createInputMapRect(options)`
- `WorldMapRuntimeInputPolicy.isPointInMap(point, map)`

扩展方式 / Extension Path:

- 新 world-map input geometry calculations first extend this module with focused tests。
- Runtime state collection, drag/tap side effects, and renderer calls stay in `WorldMapRuntime`.
- Input action mapping stays in `WorldMapInputActionMap`.

回归 / Regression:

- `node --test frontend/js/platform/WorldMapRuntimeInputPolicy.test.js frontend/js/platform/WorldMapRuntime.test.js`
- `npm run test:architecture`

### `frontend/js/platform/WorldMapRuntimeRenderPolicy.js`

状态 / Status: candidate

负责 / Owns:

- pure runtime render context derivation
- snapshot/full render option composition for `WorldMapRuntimeRenderPipeline`
- render throttling predicate
- cannot-render state reset payloads
- render trace key/data payload derivation without renderer/runtime mutation

公开 API / Public API:

- `WorldMapRuntimeRenderPolicy.createRenderContext(options, runtimeState)`
- `WorldMapRuntimeRenderPolicy.canUseSnapshotLayer(renderContext, runtimeState)`
- `WorldMapRuntimeRenderPolicy.shouldThrottleRender(options, timing)`
- `WorldMapRuntimeRenderPolicy.createCannotRenderState()`
- `WorldMapRuntimeRenderPolicy.createCannotRenderTrace(runtimeState, state)`
- `WorldMapRuntimeRenderPolicy.createRenderBeginTrace(state, renderContext, runtimeState)`
- `WorldMapRuntimeRenderPolicy.createSnapshotRenderOptions(options, context)`
- `WorldMapRuntimeRenderPolicy.createSnapshotTrace(state, rendered, context)`
- `WorldMapRuntimeRenderPolicy.createFullRenderOptions(options, context)`
- `WorldMapRuntimeRenderPolicy.createFullTrace(state, rendered, runtimeState, epochNowMs)`

扩展方式 / Extension Path:

- New pure world-map runtime render calculations first extend this module with focused tests.
- Renderer calls, runtime state publication, and trace dispatch stay in `WorldMapRuntimeRenderPipeline`.
- Camera, bake, and input geometry calculations stay in their P9 policy modules.

回归 / Regression:

- `node --test frontend/js/platform/WorldMapRuntimeRenderPolicy.test.js frontend/js/platform/WorldMapRuntime.test.js`
- `npm run test:architecture`

### `frontend/js/platform/WorldMapRuntimeRenderPipeline.js`

状态 / Status: candidate

负责 / Owns:

- historical `WorldMapRuntime.render()` flow orchestration
- render-state publication onto split renderer instances
- cannot-render trace dispatch and runtime bake/input state reset
- snapshot-layer render branch and full-layer render branch
- runtime render trace dispatch while delegating pure trace payloads to `WorldMapRuntimeRenderPolicy`

公开 API / Public API:

- `WorldMapRuntimeRenderPipeline.publishStateToRenderer(host, state)`
- `WorldMapRuntimeRenderPipeline.handleCannotRender(host, state)`
- `WorldMapRuntimeRenderPipeline.renderSnapshotLayer(host, state, options, context)`
- `WorldMapRuntimeRenderPipeline.renderFullLayer(host, state, options, context)`
- `WorldMapRuntimeRenderPipeline.render(host, options)`

扩展方式 / Extension Path:

- New render-flow side effects for `WorldMapRuntime.render()` extend this pipeline with focused tests.
- Pure render decisions, option composition, and trace payloads stay in `WorldMapRuntimeRenderPolicy`.
- New renderer drawing details still belong in renderer modules, not in this pipeline.

回归 / Regression:

- `node --test frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js frontend/js/platform/WorldMapRuntime.test.js`
- `npm run test:architecture`

### `frontend/js/state/UIStatePresenterDelegates.js`

状态 / Status: candidate

负责 / Owns:

- dependency resolution for the `UIStatePresenter` compatibility facade
- direct static delegate method registration from focused presenter modules
- custom facade delegates for guidebook, home feature, and tech fallback composition
- load-order contract before `UIStatePresenter`

公开 API / Public API:

- `UIStatePresenterDelegates.DEPENDENCY_DEFINITIONS`
- `UIStatePresenterDelegates.DELEGATE_METHODS`
- `UIStatePresenterDelegates.createDependencies(overrides)`
- `UIStatePresenterDelegates.install(UIStatePresenter, overrides)`

扩展方式 / Extension Path:

- 新 static UI presenter compatibility method first adds a focused presenter implementation, then registers a delegate here with tests。
- Cross-presenter composition stays in custom delegate installers here until it deserves its own presenter module.
- Do not add method bodies back into `UIStatePresenter`.

回归 / Regression:

- `node --test frontend/js/state/UIStatePresenterDelegates.test.js frontend/js/state/UIStatePresenter.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasActionController.js` - 226 lines

状态 / Status: candidate facade

负责 / Owns:

- compatibility dispatch facade for historical `handle_*` action methods
- shared host/state/controller lookup helpers used by installed action modules
- shared panel closing, render routing, async finalization, action forwarding, and world-map refresh helpers
- tech-tree drag/zoom delegation to `TechTreeInteractionModel`

重要公开模式 / Important Public Pattern:

- `new CanvasActionController(host, options)`
- `handle(action)`
- installed `handle_<actionType>(action)` methods from focused handler modules

目标拆分 / Target Split:

1. Keep territory/world-site/world-march handlers in `CanvasTerritoryActionHandlers`.
2. Keep city-management/event/task-center/building/tech handlers in `CanvasCityActionHandlers`.
3. Keep famous-person handlers in `CanvasFamousActionHandlers`.
4. Keep talent-policy handlers in `CanvasTalentPolicyActionHandlers`.
5. Keep shell/system/account/naming/advisor/guidebook/army-formation handlers in `CanvasShellActionHandlers`.
6. Keep this file as the dispatch/helper facade.

当前扩展方式 / Extension Path Now:

- Territory/world-site/world-march actions extend `CanvasTerritoryActionHandlers`.
- City-management/event/task-center/building/tech actions extend `CanvasCityActionHandlers`.
- Famous-person actions extend `CanvasFamousActionHandlers`.
- Talent-policy actions extend `CanvasTalentPolicyActionHandlers`.
- Shell/system/account/naming/advisor/guidebook/army-formation actions extend `CanvasShellActionHandlers`.
- Avoid adding direct `handle_*` implementations here; add or extend a focused handler module instead.

回归 / Regression:

- `node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/CanvasCityActionHandlers.test.js frontend/js/platform/CanvasFamousActionHandlers.test.js frontend/js/platform/CanvasTalentPolicyActionHandlers.test.js frontend/js/platform/CanvasShellActionHandlers.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameRenderer.js` - 303 lines

状态 / Status: candidate facade

负责 / Owns:

- main canvas renderer compatibility facade
- shared constructor state for legacy renderer callers
- static asset/preload helper surface
- child renderer composition through `CanvasGameRendererCompositionFactory`
- core renderer compatibility methods installed by `CanvasGameRendererCoreFacades`
- page/panel/HUD compatibility methods installed by `CanvasGameRendererPageFacades`
- world map and battle compatibility methods installed by `CanvasWorldMapFacade` and `CanvasBattleFacade`
- presenter sync delegation for split child renderers

重要公开方法 / Important Public Methods:

- `new CanvasGameRenderer(options)`
- static asset helpers: `getPreloadAssetPaths()`, `getAssetRequestPath()`, `getBattleUnitFramePath()`, `getTileMapAssetManifest()`, `getTileMapGeometry()`
- composition helpers: `setPresenter()`, `getChildRenderers()`, `syncChildRendererPresenter()`, `syncChildRendererPresenters()`
- installed compatibility methods from `CanvasGameRendererCoreFacades`, `CanvasGameRendererPageFacades`, `CanvasWorldMapFacade`, and `CanvasBattleFacade`

目标拆分 / Target Split:

1. Keep child renderer composition in `CanvasGameRendererCompositionFactory`.
2. Keep core surface/asset/world-tile-water/famous compatibility methods in `CanvasGameRendererCoreFacades`.
3. Keep page/panel/HUD/frame compatibility methods in `CanvasGameRendererPageFacades`.
4. Keep world-map and battle compatibility installers in their focused facade modules.
5. Keep this file as a compatibility facade.

当前扩展方式 / Extension Path Now:

- New child renderer wiring extends `CanvasGameRendererCompositionFactory`.
- New core surface/asset/world-tile-water/famous compatibility methods extend `CanvasGameRendererCoreFacades`.
- New page/panel/HUD/frame compatibility methods extend `CanvasGameRendererPageFacades`.
- New world-map compatibility helpers extend `CanvasWorldMapFacade` or the owning world-map split renderer/facade.
- New battle compatibility helpers extend `CanvasBattleFacade` or `BattleCanvasRenderer`.
- New visual surfaces should prefer standalone renderer modules.
- Do not add gameplay state derivation or direct render method implementations here.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameRendererCompositionFactory.test.js frontend/js/platform/CanvasGameRendererCoreFacades.test.js frontend/js/platform/CanvasGameRendererPageFacades.test.js`
- `npm run test:architecture`

### `frontend/js/tutorial/TutorialGuideStepPolicy.js`

状态 / Status: candidate

负责 / Owns:

- tutorial step constants used by the frontend guide controller
- pure tab access gating rules
- pure guide-active range predicates for house, first-era, farm, era2, scout, first-city, post-naming, and final-tech phases
- compatibility source for `TutorialGuideController.TUTORIAL_STEPS`

公开 API / Public API:

- `TutorialGuideStepPolicy.TUTORIAL_STEPS`
- `TutorialGuideStepPolicy.normalizeStep(step)`
- `TutorialGuideStepPolicy.canOpenTab(tabId, context)`
- `TutorialGuideStepPolicy.isGuideRangeActive(step, completed, startStep, endStep, options)`
- `TutorialGuideStepPolicy.isHouseGuideActive(step, completed)`
- `TutorialGuideStepPolicy.isFirstEraGuideActive(step, completed)`
- `TutorialGuideStepPolicy.isFarmGuideActive(step, completed)`
- `TutorialGuideStepPolicy.isEra2GuideActive(step, completed)`
- `TutorialGuideStepPolicy.isScoutFormationGuideActive(step, completed)`
- `TutorialGuideStepPolicy.isScoutExploreGuideActive(step, completed)`
- `TutorialGuideStepPolicy.isFirstCityGuideActive(step, completed)`
- `TutorialGuideStepPolicy.isFinalTechGuideActive(step, completed)`
- `TutorialGuideStepPolicy.isPostNamingSystemGuideActive(step, completed)`
- `TutorialGuideStepPolicy.isLumbermillGuideActive(step, completed)`

扩展方式 / Extension Path:

- 新 frontend tutorial step or tab gate first extends this policy, then `TutorialGuideController` consumes it.
- Keep this file pure: no game object, API calls, renderer, shell, canvas target lookup, or tutorial highlight side effects.
- Backend tutorial step contracts still belong in backend tutorial services; keep values synchronized through tests and docs.

回归 / Regression:

- `node --test frontend/js/tutorial/TutorialGuideStepPolicy.test.js frontend/js/tutorial/TutorialGuideController.test.js`
- `npm run test:architecture`

### `frontend/js/tutorial/TutorialGuideTargetResolver.js`

状态 / Status: candidate

负责 / Owns:

- canvas target lookup through the shell
- retry-after-render highlight dispatch for temporarily missing targets
- canvas target rect normalization
- viewport visibility checks for tutorial targets
- open-world-site highlight dispatch used by capital/first-city guide steps

公开 API / Public API:

- `new TutorialGuideTargetResolver({ host })`
- `getCanvasTarget(type, predicate)`
- `showHighlight(type, predicate, message, allowedAction, options)`
- `getCanvasTargetRect(target)`
- `isCanvasTargetVisible(target, padding)`
- `showOpenWorldSiteHighlight(options)`

扩展方式 / Extension Path:

- New target geometry, visibility, or generic highlight dispatch behavior extends this resolver.
- Phase-specific guide decisions still belong in current/future phase guide modules, not in this resolver.
- Keep this file free of tutorial step progression, API calls, backend state mutation, and gameplay rules.

回归 / Regression:

- `node --test frontend/js/tutorial/TutorialGuideTargetResolver.test.js frontend/js/tutorial/TutorialGuideController.test.js`
- `npm run test:architecture`

### `frontend/js/tutorial/TutorialGuidePhaseHighlights.js`

状态 / Status: candidate

负责 / Owns:

- historical `TutorialGuideController.refreshCurrentHighlight()` compatibility method installation
- first-era, farm, era2, scout, first-city, post-naming, and final-tech guide highlight branching
- phase-specific highlight action/message selection while delegating target lookup and UI state helpers

公开 API / Public API:

- `TutorialGuidePhaseHighlights.install(TutorialGuideController)`

扩展方式 / Extension Path:

- New phase highlight branch behavior extends this installer or a future smaller phase module.
- Pure step range gates stay in `TutorialGuideStepPolicy`.
- Generic target lookup/visibility/highlight dispatch stays in `TutorialGuideTargetResolver`.
- UI state setup helpers stay in `TutorialGuideUiStateCoordinator`.

回归 / Regression:

- `node --test frontend/js/tutorial/TutorialGuidePhaseHighlights.test.js frontend/js/tutorial/TutorialGuideController.test.js`
- `npm run test:architecture`

### `frontend/js/tutorial/TutorialGuideUiStateCoordinator.js`

状态 / Status: candidate

负责 / Owns:

- guide UI state helper method installation for `TutorialGuideController`
- command panel cleanup and soft guide dialogue state
- army formation editor reset helpers
- guided capital/first-city focus helpers
- building guide visibility, resources guide visibility, and generic building guide display

公开 API / Public API:

- `TutorialGuideUiStateCoordinator.UI_STATE_METHODS`
- `TutorialGuideUiStateCoordinator.install(TutorialGuideController)`

扩展方式 / Extension Path:

- New tutorial UI state setup helper extends this coordinator when it mutates shell/game UI flags for guide visibility.
- Phase-specific guide branch selection stays in `TutorialGuidePhaseHighlights`.
- Target geometry and highlight dispatch stay in `TutorialGuideTargetResolver`.
- Keep backend/tutorial progression and gameplay rules out of this module.

回归 / Regression:

- `node --test frontend/js/tutorial/TutorialGuideUiStateCoordinator.test.js frontend/js/tutorial/TutorialGuideController.test.js`
- `npm run test:architecture`

### `scripts/run-architecture-smoke.js`

状态 / Status: candidate

负责 / Owns:

- P0/P1/P2/P3/P4/P5/P6 candidate/stable baseline 的快速架构回归
- 架构相关文件语法检查 / syntax checks
- all currently registered candidate/stable baseline focused tests: feature flags, asset key registry, preload asset manifest, layer registry, shell lifecycle, frozen fog renderer, world map snapshots, world map performance budget, march progress snapshot, world map render snapshot, fog visual snapshot, visual plugin registry, debug overlay snapshot, debug overlay registry, world map input action map, world map renderer split modules, canvas action handler split modules, canvas game renderer composition/facade modules, tutorial guide policy/resolver/phase/UI-state modules, game state migration pipeline, and world explorer DTO mapper
- `git diff --check`

公开命令 / Public Command:

- `npm run test:architecture`

扩展方式 / Extension Path:

- 新的 stable/candidate 架构模块成为 baseline 后，把语法检查加入 `CHECK_FILES`。
- 新 baseline 模块有 focused test 时，把测试文件加入 `TEST_FILES`。
- 不要加入耗时全量测试；这个脚本必须足够快，适合每个小步重构后运行。
- `smoke` is a historical filename; the command is the mandatory architecture baseline regression gate before commit/deploy.

回归 / Regression:

- `npm run test:architecture`

### `docs/stable_block_promotion_matrix_2026-06-09.md`

状态 / Status: stable governance

负责 / Owns:

- confirmed product and architecture invariants used to promote modules from `candidate` to `stable`
- Canvas-only UI and cross-platform frontend rules
- diamond isometric square-tile world-map contract, full-direction wrapping, chunk/window loading, and reveal persistence
- backend-authoritative command, server timeline, AOI sync, and frontend interpolation principles
- performance-tier, config-version, reproducible world generation, and season carryover boundaries
- first-pass lists for stable candidates, interface-only candidates, and modules that must remain flexible

公开约定 / Public Contract:

- `stable` promotion must freeze long-term mechanisms, not unfinished gameplay tuning.
- New stable world-map contracts use `x/y` or `col/row`; old `q/r` names are compatibility aliases.
- Frontend command code sends intent and pending state only; backend owns accepted results.
- Large-map modules must support window/chunk data and persistent revealed terrain.
- Config/data registries must be versioned and schema-validated before becoming stable.

扩展方式 / Extension Path:

- New confirmed invariants are added here first, then reflected in module entries when a file is promoted.
- Do not use this document to freeze volatile gameplay numbers, map generation formulas, battle simulation details, or season carryover rewards.
- If a future design decision contradicts this matrix, update this matrix and the affected module entries in the same architecture task.

回归 / Regression:

- documentation review
- `npm run test:architecture`

### `docs/stable_block_manifest_2026-06-09.json`

状态 / Status: stable governance

负责 / Owns:

- machine-readable stable block file list
- allowed reopen reason vocabulary
- extension-path metadata for guarded stable blocks
- candidate promotion queue for later hardening

公开约定 / Public Contract:

- `stableBlocks[].files` lists stable files guarded by `scripts/check-stable-blocks.js`.
- `reopenPolicy.allowedReasons` is the only accepted reason list for stable reopen work.
- A module is not a sealed stable block until it is listed here and in its responsibility-index entry.

扩展方式 / Extension Path:

- Add newly promoted stable files here in the same task that changes their responsibility-index status.
- Do not list candidate files here until their stable surface has passed the promotion matrix.

回归 / Regression:

- `node scripts/check-stable-blocks.js`
- `npm run test:architecture`

### `scripts/check-stable-blocks.js`

状态 / Status: stable governance

负责 / Owns:

- stable block manifest validation
- responsibility-index stable entry coverage checks
- stable file change detection
- explicit stable reopen reason enforcement

公开命令 / Public Command:

- `node scripts/check-stable-blocks.js`

扩展方式 / Extension Path:

- New stable guard behavior extends this script with focused syntax/architecture checks.
- Keep slow full-test behavior out of this script; it must remain part of the fast architecture gate.

回归 / Regression:

- `node --check scripts/check-stable-blocks.js`
- `node scripts/check-stable-blocks.js`
- `npm run test:architecture`

### `docs/current_product_design_2026-06-09.md`

状态 / Status: authoritative

负责 / Owns:

- current product positioning
- platform principles
- long-term retained product domains
- account/season, performance, and update-experience product rules

公开约定 / Public Contract:

- This is the current product design authority.
- Early roadmap, handoff, v0.x, and release-note documents are not product authority.

扩展方式 / Extension Path:

- Product-level direction changes update this file and the stable promotion matrix when they affect stable boundaries.

回归 / Regression:

- `node scripts/verify-refactor-plan-doc.js`
- `npm run test:architecture`

### `docs/current_gameplay_design_2026-06-09.md`

状态 / Status: authoritative

负责 / Owns:

- current gameplay loops and domain boundaries
- backend-authoritative command rules
- current city/resource/building/technology/famous-person/world-map/exploration/battle/task/tutorial facts
- flexible gameplay areas that must not be prematurely sealed

公开约定 / Public Contract:

- This is the current gameplay design authority.
- Specific volatile formulas remain flexible unless promoted through stable block governance.

扩展方式 / Extension Path:

- Gameplay additions update this file when they change a current domain boundary or stable/flexible classification.

回归 / Regression:

- `node scripts/verify-refactor-plan-doc.js`
- `npm run test:architecture`

### `docs/current_technical_architecture_2026-06-09.md`

状态 / Status: authoritative

负责 / Owns:

- current technical architecture summary
- layer direction
- Canvas-only boundary
- world-map technical boundary
- backend authority, realtime sync, config/data, stable guard, and official-doc rules

公开约定 / Public Contract:

- This is the current technical design authority.
- Historical architecture plans are not the active technical entrypoint unless this file links to them.

扩展方式 / Extension Path:

- Architecture changes update this file when they change layer direction, official guardrails, or stable block governance.

回归 / Regression:

- `node scripts/verify-refactor-plan-doc.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapCanvasRenderer.js` - 718 lines

状态 / Status: candidate facade

负责 / Owns:

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

候选边界说明 / Candidate Boundary Notes:

- P3-001 through P3-025 are complete for the world-map renderer split. This file is no longer classified as a legacy blocker.
- It remains a compatibility facade because older callers still use the historical public method names.
- Its remaining direct ownership is limited to the world-map renderer facade surface and low-level drawing compatibility; new feature logic still belongs in the split modules listed above.
- If future work wants to shrink the facade further, add a new roadmap item instead of treating P3 as incomplete.

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

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapRendererHostBridge.test.js`
- `npm run test:architecture`

## 3. 遗留或未完成模块 / Legacy Or Not Yet Completed Modules

These files are not "bad"; they are high-risk because they own too many responsibilities. New feature work should avoid adding more responsibility to them.

### `frontend/js/tutorial/TutorialGuideController.js` - 665 lines

状态 / Status: candidate facade

负责 / Owns:

- tutorial step state
- tutorial API sync
- tutorial progression event callbacks
- compatibility static `TUTORIAL_STEPS` API
- compatibility helper methods installed by `TutorialGuidePhaseHighlights` and `TutorialGuideUiStateCoordinator`
- compatibility access to `TutorialGuideStepPolicy` through `TUTORIAL_STEPS`
- compatibility helper methods delegated to `TutorialGuideTargetResolver`

已拆出 / Extracted:

- P6-001: step constants, tab access gates, and guide-active range predicates moved to `TutorialGuideStepPolicy`.
- P6-002: canvas target lookup, retry-after-render highlight dispatch, rect normalization, visibility checks, and open-world-site highlight dispatch moved to `TutorialGuideTargetResolver`.
- P6-003: historical `refreshCurrentHighlight()` phase branching moved to `TutorialGuidePhaseHighlights`.
- P6-004: guide UI state setup helpers moved to `TutorialGuideUiStateCoordinator`.

仍需拆分 / Remaining Split:

1. Future small-step work may split tutorial progression event callbacks if they grow again.
2. Keep controller as API sync and orchestration facade.

当前扩展方式 / Extension Path Now:

- New frontend tutorial step constants or tab gates extend `TutorialGuideStepPolicy`.
- New target lookup/highlight geometry extends `TutorialGuideTargetResolver`.
- New phase highlight selection extends `TutorialGuidePhaseHighlights`.
- New guide UI state setup helper extends `TutorialGuideUiStateCoordinator`.
- Add new tutorial data as definitions/config where possible.
- Avoid adding new phase branches or UI state helpers directly to the controller facade.

### `frontend/js/platform/CanvasGameAppRenderingRuntime.js` - 712 lines

状态 / Status: candidate facade

负责 / Owns:

- app-level render orchestration compatibility facade
- loading/render active/read-only behavior
- render surface option assembly for `CanvasGameRenderer`
- transition and tab switch orchestration
- local view reset and compatibility render helpers
- policy delegation through `CanvasGameAppRenderPolicy`
- scheduler delegation through `CanvasGameAppRenderScheduler`
- world-map runtime compatibility methods installed by `CanvasGameAppWorldMapRuntimeBridge`

已拆出 / Extracted:

1. P7-001: map-home render policy, tab order, and preferred military-view selection moved to `CanvasGameAppRenderPolicy`.
2. P7-002: clock/wait/interval/requestAnimationFrame helpers and timing defaults moved to `CanvasGameAppRenderScheduler`.
3. P7-003: world-map runtime coordinator, drag snapshot lifecycle, render decisions, and baked-layer refresh helpers moved to `CanvasGameAppWorldMapRuntimeBridge`.
4. Keep this file as the render orchestration facade.

当前扩展方式 / Extension Path Now:

- New pure app render policy extends `CanvasGameAppRenderPolicy`.
- New render timing or injected scheduler behavior extends `CanvasGameAppRenderScheduler`.
- New world-map runtime bridge compatibility methods extend `CanvasGameAppWorldMapRuntimeBridge`.
- New gameplay rules stay in domain/systems/services, not in this facade.
- Avoid adding new direct world-map runtime or scheduling helper methods here.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameAppRenderPolicy.test.js frontend/js/platform/CanvasGameAppRenderScheduler.test.js frontend/js/platform/CanvasGameAppWorldMapRuntimeBridge.test.js frontend/js/platform/CanvasGameApp.test.js`
- `npm run test:architecture`

### `frontend/js/state/UIStatePresenter.js` - 23 lines

状态 / Status: candidate facade

负责 / Owns:

- compatibility static facade for historical UI state presenter API
- compatibility constants `POPULATION_PER_OFFICIAL` and `MIN_EXPEDITION_SOLDIERS`
- delegate installation through `UIStatePresenterDelegates`

目标拆分 / Target Split:

1. Keep as compatibility facade.
2. Done: P10-001 moved dependency resolution and static method delegate installation into `UIStatePresenterDelegates`.
3. Domain-specific helpers stay in `frontend/js/state/presenters/*`.

当前扩展方式 / Extension Path Now:

- Add or extend presenter modules under `frontend/js/state/presenters`.
- Register compatibility static delegates in `UIStatePresenterDelegates`.
- Do not add method bodies back into this facade.

### `frontend/js/platform/WorldMapRuntime.js` - 411 lines

状态 / Status: candidate facade

当前负责 / Currently Owns:

- world map camera state
- drag/pinch camera movement
- map bake runtime state and renderer cache invalidation side effects
- hit target sync
- render requests
- world-map input action map integration
- bake policy delegation through `WorldMapRuntimeBakePolicy`
- camera policy delegation through `WorldMapRuntimeCameraPolicy`
- input geometry delegation through `WorldMapRuntimeInputPolicy`
- render pipeline delegation through `WorldMapRuntimeRenderPipeline`

重要公开方法 / Important Public Methods:

- `canRender(state)`
- `getLayerLayout(state, options)`
- `getInputMapRect(state)`
- `isMapBakeDirty(state, options)`
- `invalidateBake()`
- `setCamera(x, y, options)`
- `handleDrag(phase, point)`
- `handleTap(point, event)`
- `requestRender(options)`
- `render(options)`
- `getBackgroundMarchTargetAction(point)`

目标拆分 / Target Split:

1. Keep runtime focused on camera/bake/input runtime compatibility state.
2. Done: P9-001 moved map signature generation, signature sync result derivation, and pure bake-dirty checks into `WorldMapRuntimeBakePolicy`.
3. Done: P9-002 moved initial camera normalization, camera UI-state composition, UI camera sync, camera change resolution, drag math, baked-camera offset, and drag-layer hit-target offsets into `WorldMapRuntimeCameraPolicy`.
4. Done: P9-003 moved input-layout availability, map input rectangle fallback resolution, and point-in-map bounds checks into `WorldMapRuntimeInputPolicy`.
5. Done: P9-004 moved pure render decisions into `WorldMapRuntimeRenderPolicy` and render-flow orchestration into `WorldMapRuntimeRenderPipeline`.

当前扩展方式 / Extension Path Now:

- Add pure camera/drag calculations through `WorldMapRuntimeCameraPolicy`.
- Add render-flow side effects through `WorldMapRuntimeRenderPipeline`.
- Add new world-map input mapping through `WorldMapInputActionMap`.
- Add pure world-map input geometry through `WorldMapRuntimeInputPolicy`.
- Add map-bake signature or dirty-check changes through `WorldMapRuntimeBakePolicy`.
- Add pure render context, throttle, renderer option, and trace payload changes through `WorldMapRuntimeRenderPolicy`.
- Do not add gameplay simulation or rendering details.

### `frontend/js/state/presenters/WorldTileMapPresenter.js` - 319 lines

状态 / Status: candidate facade

负责 / Owns:

- map-level normalized world tile map view-state composition
- world tile-map signature composition across territory/world-explorer state
- compatibility delegation for `normalizeWorldTile()`
- compatibility delegation for world-explorer mission/planned tile/planned site helpers

重要公开方法 / Important Public Methods:

- `getWorldTileMapSignature(territoryState, worldExplorerState, options)`
- `normalizeWorldTile(tile, siteById)`
- `normalizeWorldExplorerMission(mission)`
- `getWorldExplorerMissions(worldExplorerState, options)`
- `getWorldExplorerPlannedTiles(worldExplorerState, options)`
- `getWorldExplorerPlannedSites(worldExplorerState, options)`
- `buildWorldTileMapViewState(territoryState, options)`

目标拆分 / Target Split:

1. Done: P8-001 extracted tile/site/terrain/template/water/intel normalization to `WorldTileMapTileNormalizer`.
2. Done: P8-002 extracted explorer mission normalization, mission merge/time derivation, planned tile/site filtering, and tile-id creation to `WorldTileMapExplorerNormalizer`.
3. Future visibility/exploration state changes should land under P1 domain modules before this facade composes the view state.

当前扩展方式 / Extension Path Now:

- Single-tile normalization extends `WorldTileMapTileNormalizer`.
- World-explorer mission/planned tile/planned site normalization extends `WorldTileMapExplorerNormalizer`.
- Add pure presenter helpers here only if they compose map-level render/view state.
- Do not add renderer behavior.

回归 / Regression:

- `node --test frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js frontend/js/state/presenters/WorldTileMapTileNormalizer.test.js frontend/js/state/UIStatePresenter.test.js`
- `npm run test:architecture`

## 4. P0-005 拆分顺序 / Split Order

Recommended first split sequence:

1. Done: `WorldMapCanvasRenderer.js` is a candidate facade after P3-001 through P3-025.
2. Done: `CanvasActionController.js` is a candidate facade after P4-001 through P4-005.
3. Done: `CanvasGameRenderer.js` is a candidate facade after P5-001 through P5-003.
4. Done: `TutorialGuideController.js` is a candidate facade after P6-001 through P6-004.
5. Done: `CanvasGameAppRenderingRuntime.js` is a candidate facade after P7-001 through P7-003.
6. Done: `WorldTileMapPresenter.js` is a candidate facade after P8-001 through P8-002.
7. Done: `WorldMapRuntime.js` is a candidate facade after P9-001 through P9-004 moved bake, camera, input geometry, render policy, and render pipeline behavior into focused modules.
8. Done: `UIStatePresenter.js` is a candidate facade after P10-001 moved delegate installation into `UIStatePresenterDelegates`.
9. Done: `CanvasGameShellWorldMapRuntime.js` is a candidate facade after P0-004b/P0-004c moved pure shell world-map policy, layer/fog/snapshot bridge behavior, drag runtime behavior, and frame/timer runtime behavior into focused modules.
10. Next: watch `CanvasGameAppRenderingRuntime.js`, `CanvasGameRendererPageFacades.js`, and `CanvasGameShell.js` for future growth; current oversized legacy list no longer has an urgent presenter facade.

## 5. 更新日志 / Update Log

| Date | Change |
| --- | --- |
| 2026-06-08 | Created module responsibility index. Added completed P0 modules, current public APIs, extension paths, and P0-005 oversized-module split order. |
| 2026-06-08 | Added architecture baseline script responsibility and public command `npm run test:architecture`; `run-architecture-smoke.js` remains the historical script filename. |
| 2026-06-08 | Standardized documentation style: Chinese-first explanations with English module/API/architecture keyword labels. |
| 2026-06-08 | Added `CanvasGameShellWorldMapRuntimePolicy` candidate module for pure shell world-map snapshot options, water timing, layer padding, drag cooldown/limit checks, drag offset/pan normalization, and frame option derivation; `CanvasGameShellWorldMapRuntime` delegates these policies and dropped to 455 lines. |
| 2026-06-08 | Added `CanvasGameShellWorldMapLayerBridge`, `CanvasGameShellWorldMapDragRuntime`, and `CanvasGameShellWorldMapFrameRuntime` for P0-004c; `CanvasGameShellWorldMapRuntime` now keeps coordinator/render decision integration only and dropped to 122 lines as a candidate facade. |
| 2026-06-08 | Added `WorldMapVisibilityModel` candidate module with compact visibility snapshot API and performance constraints. |
| 2026-06-08 | Added `WorldMapEntitySnapshot` candidate module for normalized world map entities/components with compact indexes. |
| 2026-06-08 | Added `WorldMarchProgressSnapshot` candidate module for pure march progress, actor rows, and arrival result rows; `WorldMarchSystem` now acts as a compatibility facade for march calculations. |
| 2026-06-08 | Added `WorldMarchGeometry` candidate module for pure tile screen projection, nearest-tile lookup, axial point inference, and march target UI-state normalization; `WorldMarchSystem` now delegates progress and geometry helpers and dropped to 53 lines as a candidate facade. |
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
| 2026-06-08 | Reclassified `WorldMapCanvasRenderer` as a `candidate facade` after P3-001 through P3-025 passed architecture regression; P3 split modules remain `candidate` while their contracts are observed through later feature work. |
| 2026-06-08 | Standardized regression documentation: module entries list focused commands plus `npm run test:architecture`, and the architecture command is documented as the baseline gate covering registered candidate/stable tests, syntax checks, and `git diff --check`. |
| 2026-06-08 | Added `CanvasTerritoryActionHandlers` candidate module for P4-001; `CanvasActionController` now delegates territory/world-site/world-march/expedition/battle-scene handlers and dropped to 1208 lines. |
| 2026-06-08 | Added `CanvasCityActionHandlers` candidate module for P4-002; `CanvasActionController` now delegates city-management/event/task-center/city-selection/building/tech/task-reward/building-list handlers and dropped to 797 lines. |
| 2026-06-08 | Added `CanvasFamousActionHandlers`, `CanvasTalentPolicyActionHandlers`, and `CanvasShellActionHandlers` for P4-003 through P4-005; `CanvasActionController` now delegates famous-person, talent-policy, shell/system/account/naming/advisor/guidebook/army-formation handlers and dropped to 226 lines as a candidate facade. |
| 2026-06-08 | Added `CanvasGameRendererCompositionFactory`, `CanvasGameRendererCoreFacades`, and `CanvasGameRendererPageFacades` for P5-001 through P5-003; `CanvasGameRenderer` now delegates child composition and compatibility method installation, dropping to 303 lines as a candidate facade. |
| 2026-06-08 | Added `TutorialGuideStepPolicy` candidate module for P6-001; `TutorialGuideController` now delegates step constants, tab access gates, and guide-active range predicates while remaining legacy for target resolution and phase guide branching. |
| 2026-06-08 | Added `TutorialGuideTargetResolver` candidate module for P6-002; `TutorialGuideController` now delegates canvas target lookup, retry-after-render highlight dispatch, rect normalization, visibility checks, and open-world-site highlight dispatch while dropping to 1368 lines. |
| 2026-06-08 | Added `TutorialGuidePhaseHighlights` and `TutorialGuideUiStateCoordinator` for P6-003 through P6-004; `TutorialGuideController` now delegates phase highlight branching and guide UI state helpers, dropping to 665 lines as a candidate facade. |
| 2026-06-08 | Added `CanvasGameAppRenderPolicy`, `CanvasGameAppRenderScheduler`, and `CanvasGameAppWorldMapRuntimeBridge` for P7-001 through P7-003; `CanvasGameAppRenderingRuntime` now delegates pure render policy, timing helpers, and world-map runtime bridge methods, dropping to 666 lines as a candidate facade. |
| 2026-06-08 | Added `WorldTileMapTileNormalizer` for P8-001; `WorldTileMapPresenter` now delegates single tile terrain/site/template/water/intel normalization and dropped to 479 lines. |
| 2026-06-08 | Added `WorldTileMapExplorerNormalizer` for P8-002; `WorldTileMapPresenter` now delegates explorer mission, planned tile, planned site, and tile-id helpers and dropped to 319 lines as a candidate facade. |
| 2026-06-08 | Added `WorldMapRuntimeBakePolicy` for P9-001; `WorldMapRuntime` now delegates map data signature generation, signature sync results, and pure bake-dirty checks while retaining runtime side effects, dropping to 565 lines. |
| 2026-06-08 | Added `WorldMapRuntimeCameraPolicy` for P9-002; `WorldMapRuntime` now delegates initial camera normalization, camera UI-state composition, UI sync, drag math, baked-camera offsets, and drag-layer hit-target offsets, dropping to 541 lines. |
| 2026-06-08 | Added `WorldMapRuntimeInputPolicy` for P9-003; `WorldMapRuntime` now delegates input-layout availability, map input rectangle resolution, and point-in-map checks while retaining runtime state collection, dropping to 491 lines. |
| 2026-06-08 | Added `WorldMapRuntimeRenderPolicy` and `WorldMapRuntimeRenderPipeline` for P9-004; `WorldMapRuntime.render()` now delegates render context/throttle/option/trace decisions and snapshot/full render flow, dropping to 411 lines as a candidate facade. |
| 2026-06-08 | Added `UIStatePresenterDelegates` for P10-001; `UIStatePresenter` now delegates dependency resolution and static method installation to the registry and dropped to 23 lines as a candidate facade. |
