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
- Stable promotion must be machine-checkable in `docs/stable_block_manifest_2026-06-09.json`: every stable block records `promotionEvidence.matrixReviewed`, observation notes, public contract, extension path, reopen exceptions, and node/npm regression commands.
- Stable responsibility-index entries must document `Public Contract:` or `Public Command:`, `Extension Path:`, and `Regression:` with at least one node/npm command before the stable guard accepts them.
- `candidatePromotionQueue` tracks likely next promotions and must contain existing files that still have `candidate` responsibility-index entries.
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

- Mature engine canvas layer contract / 成熟引擎画布层契约
- Shell-owned physical canvas stack: `worldMap`, `worldFog`, `worldActor`, `mainHud`
- Stable layer keys, default `zIndex`, default `contextType`, camera space, input-surface role, and feature gates
- Logical render queue / 逻辑渲染队列
- Hit priority queue / 命中优先级队列
- Render/hit order comparison helpers

公开 API / Public API:

- `CanvasLayerRegistry.LAYERS`
- `CanvasLayerRegistry.PHYSICAL_LAYER_ORDER`
- `CanvasLayerRegistry.RENDER_QUEUE`
- `CanvasLayerRegistry.HIT_PRIORITY_QUEUE`
- `CanvasLayerRegistry.getLayer(name)`
- `CanvasLayerRegistry.getLayerName(name)`
- `CanvasLayerRegistry.getLayerOptions(name, overrides)`
- `CanvasLayerRegistry.getPhysicalLayerStack()`
- `CanvasLayerRegistry.getRenderQueue()`
- `CanvasLayerRegistry.getHitPriorityQueue()`
- `CanvasLayerRegistry.compareRenderOrder(left, right)`
- `CanvasLayerRegistry.compareHitPriority(left, right)`
- `CanvasLayerRegistry.isLayerEnabled(name, config, options)`

当前图层 / Current Layers:

- `worldMap`: key `worldMap`, `zIndex: 997`, `contextType: 2d`, `cameraSpace: world`, non-input world playfield
- `worldFog`: key `worldFog`, `zIndex: 998`, `contextType: webgl`, `cameraSpace: world-overlay`, gated by `FOG_OF_WAR_ENABLED`
- `worldActor`: key `worldActor`, `zIndex: 999`, `contextType: 2d`, `cameraSpace: world-dynamic`, non-input actor layer
- `mainHud`: key `mainHud`, `zIndex: 1000`, `contextType: 2d`, `cameraSpace: screen`, the only input surface

扩展方式 / Extension Path:

- 新增 shell-owned layer 必须先注册到这里。
- 需要开关控制的 layer 必须配置 `feature` key。
- 新增 renderer bucket 或 hit-target priority 必须先更新 `RENDER_QUEUE` / `HIT_PRIORITY_QUEUE` 并补 focused tests。
- 图层生命周期必须通过 `CanvasGameShell` helper，不允许 renderer 直接接管。
- `mainHud` is registered here for the contract, but its lifecycle is the primary canvas created by `H5CanvasRuntime.ensureCanvas()`, not a secondary `ensureLayerCanvas()` layer.
- `WorldMapLayerOwnershipContract.test.js` guards the current owner split: `worldMap` publishes context/static targets only, `worldActor` owns actor drawing/actor targets, and `mainHud` owns map-home march command HUD.

回归 / Regression:

- `node --test frontend/js/platform/CanvasLayerRegistry.test.js frontend/js/platform/H5CanvasRuntime.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameShell.js`

状态 / Status: candidate facade

负责 / Owns:

- 组合 shell modules 的兼容 facade
- shell 状态字段 / shell state fields
- 注入 runtime/config/layer registry 依赖
- shell 层级 canvas layer helper
- `mainHud` layer requests are routed to the primary input canvas through `runtime.ensureCanvas()`
- default action controller construction uses `awaitAsync: true` so H5 shell action logs preserve async failures instead of recording false success
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
- `mainHud` is the screen/input layer; do not allocate it through `runtime.ensureLayerCanvas()`.
- 调试覆盖层只通过 `DebugOverlayRegistry` 产出 snapshot，不在 shell 内拼字段。

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasLayerRegistry.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameShellCommands.js` - 407 lines

状态 / Status: candidate

负责 / Owns:

- shell command helpers installed onto `CanvasGameShell`
- local shell state transitions for city, tech, famous, resource, and map-home commands
- `forwardCanvasAction(action, meta)` external action forwarding
- forwarded action local selection sync through `syncForwardedLocalAction()`
- forwarded action Promise preservation; local sync runs only after the forwarded action resolves allowed
- causality metadata preservation when forwarding action meta, including `WorldMapInputIntent.inputId` and `clientSequence`

公开 API / Public API:

- `CanvasGameShellCommands.install(CanvasGameShell)`
- installed shell methods including `getCanvasGameHost()`, `getCanvasActionState()`, `runAction()`, `openCityManagement()`, `openArmyFormation()`, `resetLocalViewToResources()`, `forwardCanvasAction()`, `syncForwardedLocalAction()`, and `closeWorldSiteHud()`

扩展方式 / Extension Path:

- New shell-local command state transitions extend this module with focused tests.
- Action dispatch policy and handler-specific gameplay commands stay in `CanvasActionController` and focused action handler modules.
- Forwarded action metadata must keep the original `meta` object through the external `onAction(action, event, meta)` boundary; do not drop diagnostic input evidence at the shell edge.
- Forwarded async action results must not be collapsed to boolean; Promise rejection must remain observable by the input/action log chain.

回归 / Regression:

- `node --test frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/H5CanvasRuntime.js`

状态 / Status: candidate

负责 / Owns:

- H5 primary canvas lifecycle through `ensureCanvas()`
- Mature engine primary screen/HUD/input surface: `zIndex: 999`, `pointerEvents: auto`
- Secondary layer canvas lifecycle through `ensureLayerCanvas(name, options)`
- Non-input secondary layer styles: `pointerEvents: none`, explicit `zIndex`, frame alignment, padding and clipping
- Browser viewport frame sizing, pixel ratio resize, and input coordinate conversion

公开 API / Public API:

- `ensureCanvas()`
- `ensureLayerCanvas(name, options)`
- `getLayerCanvas(name)`
- `getLayerMetrics(name)`
- `setLayerTranslate(name, x, y)`
- `clearLayerTransform(name)`
- `setLayerVisible(name, visible)`
- `resize()`
- `toCanvasPoint(event)`
- `onTap(handler)`, `onDrag(handler)`, `onGesture(handler)`, `onPointerMove(handler)`, `onResize(handler)`

扩展方式 / Extension Path:

- New physical layer styles must be described in `CanvasLayerRegistry` first, then consumed through shell helpers.
- Keep primary input capture on the main canvas; do not create another input-enabled layer without a registry/test change.
- Secondary layers stay visual-only unless the mature engine layer contract is intentionally changed.

回归 / Regression:

- `node --test frontend/js/platform/H5CanvasRuntime.test.js frontend/js/platform/CanvasLayerRegistry.test.js`
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
- world-tile water animation frame timing, mobile device refresh floors, and layer padding policy
- world-map drag state, cooldown, transform limit, drag offset, and pan normalization
- runtime world-map frame option derivation and snapshot-water refresh detection

公开 API / Public API:

- `CanvasGameShellWorldMapRuntimePolicy.hasNumber(value)`
- `CanvasGameShellWorldMapRuntimePolicy.getSnapshotRenderOptions(waterTimeMs, fallbackWaterTimeMs)`
- `CanvasGameShellWorldMapRuntimePolicy.getWaterAnimationDeviceFloorMs(options)`
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
- freshly rendered snapshot `lastWorldTileMapContext` handoff to fog, actor, and runtime state before clearing transforms

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
- drag compositor snapshot refresh, successful baked-camera commit, transform clearing, and layer translate fallback

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
- Successful drag snapshot refreshes must commit the runtime baked camera; snapshot misses fall back to translating `worldMap`, `worldFog`, and `worldActor` together.
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

性能约束 / Performance Constraints:

- Fog render/cache identity must derive tile keys, projection centers, and mask cache signatures through `TileCoord` stable `x/y` semantics; raw `tile.id` / `tileId` values are never accepted as fog cache authority.
- Mask caching remains compact and frame-local: signatures summarize visible entries, dimensions, frame, viewport, and geometry rather than storing renderer objects or full tile payloads.

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

### `frontend/js/domain/TileCoord.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图稳定 tile 坐标契约 / stable tile coordinate contract
- `x/y` stable axes and `q/r` compatibility aliases
- deterministic `tileId` generation from stable axes
- coordinate offset, equality, and legacy `{ q, r }` conversion helpers

公开 API / Public API:

- `TileCoord.toNumber(value, fallback)`
- `TileCoord.toInteger(value, fallback)`
- `TileCoord.tileId(x, y)`
- `TileCoord.readCoordAxis(source, primaryKey, aliasKey, fallback)`
- `TileCoord.normalizeCoord(source, fallback, options)`
- `TileCoord.normalizeDelta(delta)`
- `TileCoord.offset(coord, delta, options)`
- `TileCoord.equals(left, right)`
- `TileCoord.toLegacy(coord)`

性能约束 / Performance Constraints:

- Pure synchronous helpers only.
- No renderer, DOM, canvas, backend, network, or storage dependencies.
- `normalizeCoord()` does not preserve stale tile ids unless explicitly requested.

扩展方式 / Extension Path:

- New stable tile-coordinate semantics extend this module with focused tests.
- Keep `q/r` as compatibility aliases only; new stable contracts should use `x/y` or later `col/row`.
- Do not add map generation, chunk loading, visibility, or movement rules here.

回归 / Regression:

- `node --test frontend/js/domain/TileCoord.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldTopology.js`

状态 / Status: candidate

负责 / Owns:

- full wrapping torus topology for world-map coordinates
- world-size normalization without freezing final map dimensions
- wrapped coordinate normalization and shortest wrapped delta/distance
- edge-crossing offset helpers for full-direction world loops

公开 API / Public API:

- `WorldTopology.DEFAULT_WORLD_SIZE`
- `WorldTopology.normalizeWorldSize(options)`
- `WorldTopology.normalizeCoord(coord, options)`
- `WorldTopology.getDelta(from, to, options)`
- `WorldTopology.getWrappedDistance(from, to, options)`
- `WorldTopology.offset(coord, delta, options)`
- `WorldTopology.modulo(value, size)`
- `WorldTopology.wrapDelta(delta, size)`

性能约束 / Performance Constraints:

- Pure synchronous calculations; no tile array scan.
- Works from world size and coordinates only.
- Does not own map generation, chunk streaming, reveal persistence, or renderer camera state.

扩展方式 / Extension Path:

- New topology helpers extend this module with focused tests.
- Chunk/window/reveal behavior belongs to P11-004 modules, not here.
- Camera or renderer panning behavior should consume this contract instead of redefining wrapping math.

回归 / Regression:

- `node --test frontend/js/domain/WorldTopology.test.js`
- `npm run test:architecture`

### `frontend/js/domain/TileMapGeometry.js`

状态 / Status: candidate

负责 / Owns:

- diamond isometric square-tile projection helpers
- stable `x/y` coordinate normalization while preserving `q/r` aliases
- coordinate-authoritative fallback tile identity when `TileCoord` is unavailable; raw `tileId` / `id` values are not preserved as geometry identity when coordinates exist
- screen center, draw rect, bounds, draw-order, and screen-point-to-coordinate conversion
- legacy geometry facade for existing renderer/HUD callers

公开 API / Public API:

- `TileMapGeometry.DEFAULT_GEOMETRY`
- `TileMapGeometry.normalizeCoord(tile, fallback)`
- `TileMapGeometry.normalizeGeometry(options)`
- `TileMapGeometry.projectTile(tile, options)`
- `TileMapGeometry.getTileDrawRect(center, scale, options)`
- `TileMapGeometry.getIsoSortValue(tile)`
- `TileMapGeometry.sortTilesForIsoDraw(tiles)`
- `TileMapGeometry.getBounds(tiles, options)`
- `TileMapGeometry.getTileScreenCenter(tile, viewport, options)`
- `TileMapGeometry.screenPointToCoord(point, viewport, options)`
- `TileMapGeometry.tileId(x, y)`

性能约束 / Performance Constraints:

- Geometry math is pure and allocation-light.
- Sorting remains caller-controlled and should not run in drag hot paths unless cached.
- No renderer object, DOM object, canvas context, backend state, or map-generation rule lives here.

扩展方式 / Extension Path:

- New diamond isometric projection helpers extend this module.
- New stable coordinate semantics extend `TileCoord`; wrapping topology extends `WorldTopology`.
- Do not add chunk/window/reveal, gameplay movement, or renderer cache policy here.

回归 / Regression:

- `node --test frontend/js/domain/TileMapGeometry.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldChunkAddress.js`

状态 / Status: candidate

负责 / Owns:

- 大地图 chunk address contract
- chunk size, chunk id, chunk coordinate, and chunk bounds normalization
- tile-to-chunk mapping through stable `x/y` coordinates
- wrapped tile-rect to unique chunk-list expansion

公开 API / Public API:

- `WorldChunkAddress.DEFAULT_CHUNK_SIZE`
- `WorldChunkAddress.normalizeChunkSize(options)`
- `WorldChunkAddress.normalizeTopologyOptions(options)`
- `WorldChunkAddress.chunkId(chunkX, chunkY)`
- `WorldChunkAddress.normalizeChunkCoord(input, options)`
- `WorldChunkAddress.getChunkCoordForTile(tile, options)`
- `WorldChunkAddress.getChunkBounds(chunk, options)`
- `WorldChunkAddress.getWrappedRanges(minValue, maxValue, size, wrapping)`
- `WorldChunkAddress.getChunksForTileRect(rect, options)`
- `WorldChunkAddress.containsTile(chunk, tile, options)`

性能约束 / Performance Constraints:

- Uses world size, chunk size, and coordinates only.
- Does not scan `worldMap.tiles` or assume a full world array exists on the frontend.
- Wrapped rect expansion returns unique chunk references and is bounded by the window rectangle.

扩展方式 / Extension Path:

- New chunk addressing helpers extend this module with focused tests.
- Window/AOI rules extend `WorldInterestWindow`.
- Reveal persistence extends `WorldRevealStore`.
- Do not add terrain generation, renderer cache internals, or server sync policy here.

回归 / Regression:

- `node --test frontend/js/domain/WorldChunkAddress.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldInterestWindow.js`

状态 / Status: candidate

负责 / Owns:

- large-map visible/preload/AOI window contract
- center coordinate normalization
- visible, preload, and AOI tile rectangles
- visible/preload/AOI chunk references for streaming and sync callers

公开 API / Public API:

- `WorldInterestWindow.DEFAULT_WINDOW`
- `WorldInterestWindow.normalizeWindowOptions(options)`
- `WorldInterestWindow.createTileRect(center, radiusX, radiusY)`
- `WorldInterestWindow.createWindow(center, options)`
- `WorldInterestWindow.getChunkIds(window, key)`
- `WorldInterestWindow.containsTile(window, tile, key)`

性能约束 / Performance Constraints:

- Does not read or clone world tile payloads.
- Window creation is bounded by window/chunk dimensions, not total world size.
- Returns chunk references for callers to request/load/sync data lazily.

扩展方式 / Extension Path:

- New interest-region or AOI shape rules extend this module with focused tests.
- Renderer camera adapters should translate camera state into this contract instead of opening raw world arrays.
- Multiplayer sync can consume `aoiChunks` but should not add networking behavior here.

回归 / Regression:

- `node --test frontend/js/domain/WorldInterestWindow.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldRevealStore.js`

状态 / Status: candidate

负责 / Owns:

- persistent revealed-terrain store contract
- tile reveal records indexed by tile id and chunk id
- coordinate-authoritative tile identity for revealed records, including the local fallback normalizer when `TileCoord` is unavailable; stale `tileId` / `id` values cannot become revealed-store index keys when coordinates exist
- materialized chunk id tracking
- window/chunk reveal queries without requiring full world map payloads

公开 API / Public API:

- `WorldRevealStore.createStore(input, options)`
- `WorldRevealStore.normalizeTileRecord(tile, options)`
- `WorldRevealStore.mergeTileRecord(previous, next)`
- `WorldRevealStore.getTile(store, idOrCoord)`
- `WorldRevealStore.isRevealed(store, idOrCoord)`
- `WorldRevealStore.getTilesForChunk(store, chunk)`
- `WorldRevealStore.getTilesForWindow(store, window)`
- `WorldRevealStore.toSerializable(store)`

性能约束 / Performance Constraints:

- Stores only revealed/materialized records, not full unknown world arrays.
- Uses O(1) tile lookup and chunk-to-tile indexes.
- Serializable form excludes renderer, canvas, DOM, and full `worldMap` payloads.

扩展方式 / Extension Path:

- New reveal record fields extend `normalizeTileRecord()` and tests.
- Server materialization and chunk persistence can consume this shape but should not add persistence IO here.
- Renderer/window consumers should query by chunk/window rather than scanning all revealed records every frame.

回归 / Regression:

- `node --test frontend/js/domain/WorldRevealStore.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMapVisibilityModel.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 visibility/explored/controlled 的纯 domain snapshot
- 将 tile、mission reveal、active mission position 合并为可序列化 visibility arrays
- 为后续 fog renderer、world map renderer、debug overlay 提供统一输入
- 性能友好的紧凑数据结构 / compact arrays for large maps
- Consumes `TileCoord` for tile, mission route, planned tile, and active-position identity so caller-supplied `id/tileId` cannot override stable `x/y`.

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
- Stable `x/y` and legacy `q/r` shapes merge into one canonical visibility entry.

扩展方式 / Extension Path:

- 新的 visibility 来源要通过 `createSnapshot()` 的 input 合并，不直接写 renderer。
- Fog of war P2 should consume this snapshot instead of reading raw tiles.
- 新增等级时必须同步 constants、tests、docs。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapVisibilityModel.test.js frontend/js/domain/WorldMapEntitySnapshot.test.js frontend/js/domain/WorldFogVisualSnapshot.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMapEntitySnapshot.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 entities/components 的纯 domain snapshot
- 将 tiles、sites、missions、actors 归一化成稳定实体集合
- 复用 `WorldMapVisibilityModel` 的 visibility snapshot
- 为 renderer、action adapter、debug overlay、fog rebuild 提供共同输入
- Consumes `TileCoord` through visibility/entity local normalization for tiles, sites, missions, and actors.

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
- Entity ids and indexes use canonical tile identity; stale raw tile/site/actor `id/tileId` values are not accepted as authority.
- World march actor entity identity uses `missionId` as the snapshot/index key; raw renderer `actor.id` is a compatibility input and must not override the mission-owned actor key.

扩展方式 / Extension Path:

- 新 world map entity type 先在这里定义 normalized shape，再由 renderer/action/debug 消费。
- 不要让 renderer 从 raw API state 自己推导 entity/component。
- World actor selection/index changes must preserve mission-id authority and add focused `WorldMapEntitySnapshot.test.js` coverage before renderer or HUD changes.
- 新增字段必须同步测试和本文件公开 API/职责说明。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapVisibilityModel.test.js frontend/js/domain/WorldMapEntitySnapshot.test.js frontend/js/domain/WorldFogVisualSnapshot.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMapPerformanceBudget.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图大地图性能预算门禁 / large world-map performance budget gates
- 检查 visibility/entity/render snapshot 的结构预算
- 检查 compact arrays、O(1) index maps、serializable payload size
- 检查 renderer frame work 的 visible entries、actors、hit targets、frame pixels、active chunks 和 per-chunk entries
- 为后续 perf smoke 和 cache invalidation tests 提供统一报告格式

公开 API / Public API:

- `WorldMapPerformanceBudget.DEFAULT_BUDGETS`
- `WorldMapPerformanceBudget.checkVisibilitySnapshot(snapshot, budgets)`
- `WorldMapPerformanceBudget.checkEntitySnapshot(snapshot, budgets)`
- `WorldMapPerformanceBudget.checkRenderSnapshot(snapshot, budgets)`
- `WorldMapPerformanceBudget.checkRendererFrameWork(frameWork, budgets)`
- `WorldMapPerformanceBudget.combineReports(reports, meta)`
- `WorldMapPerformanceBudget.assertReport(report, message)`
- `WorldMapPerformanceBudget.createReport(checks, meta)`
- `WorldMapPerformanceBudget.getFramePixelCount(frame, pixelRatio)`
- `WorldMapPerformanceBudget.getSerializableSizeBytes(value)`

性能约束 / Performance Constraints:

- 预算检查是纯同步函数，不依赖浏览器、canvas、DB、network。
- 不使用易波动的绝对 FPS 阈值作为硬门槛。
- 大地图结构退化时必须失败：nested entity maps、renderer tile payload copied into serializable output、parallel arrays 长度不一致。
- Renderer frame work 检查只做结构/容量预算，不用不稳定的 FPS 硬阈值替代真实 profiling。

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
- 将 raw mission 归一化成 `missions`、兼容 `actors`、`arrivals` 三类扁平行；`actors` 只保留历史 facade 输出，不代表最终大地图可见 actor 合同
- 统一手动行军抵达 `idle` 和随机探索抵达 `ready` 的结果语义
- 为 `WorldActorProjection`、HUD、action adapter、debug overlay 提供可测试、可序列化的行军输入
- 保留 `remainingSeconds` 与 `travelRemainingSeconds` 的区别：前者兼容下一步/旧 HUD 倒计时，后者表示到终点的剩余总行程
- Consumes `TileCoord` for mission `origin` / `homeOrigin` / `target` / `position` / route step identity so stale caller-supplied `id/tileId` cannot override stable `x/y` coordinates.

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
- constants: `STATUS_ACTIVE`, `STATUS_IDLE`, `ARRIVAL_NONE`, `ARRIVAL_IDLE`

性能约束 / Performance Constraints:

- Snapshot keeps flat arrays: `missions`, `actors`, `arrivals`.
- Lookup uses `indexById.{missions,actors,arrivals}` for O(1) access.
- Signature uses incremental FNV-style hashing over compact progress/status fields.
- Large-mission regression covers 2000 missions without nested `missionsById` or `entitiesById` maps.
- Renderable world actor collections are projected by `WorldActorProjection`; this snapshot preserves progress facts and compatibility rows.
- No renderer objects, DOM objects, canvas contexts, WebGL resources, or backend service imports.
- Tile identity normalization is O(1) per coordinate and keeps output rows compact as `{ q, r, tileId }` for compatibility.

扩展方式 / Extension Path:

- 新的行军结果类型先扩展 `arrivalKind` / constants，再通过 `buildArrivalFromProgress()` 输出新行。
- 新 UI/HUD 不要从 raw mission 自己推导抵达状态；消费 `createSnapshot()` 的 `missions` 与 `arrivals`。新的地图 actor 集合必须通过 `WorldActorProjection` 投影。
- 新功能需要额外展示字段时，优先在 `normalizeMissionProgress()` 增加稳定 row 字段，并同步测试和本索引。
- 旧 `WorldMarchSystem` 继续作为兼容 facade；集合级 `buildActors()` 走 `WorldActorProjection`，不要把新的 gameplay/projection rule 加回旧文件。

回归 / Regression:

- `node --test frontend/js/domain/WorldActorProjection.test.js frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/domain/WorldMapRenderSnapshot.test.js frontend/js/domain/WorldMarchSystem.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldActorProjection.js` - 82 lines

状态 / Status: candidate

负责 / Owns:

- Client-side projection boundary from march progress rows or raw world explorer state into renderable world actor DTOs.
- Applies world actor visibility semantics outside progress facts and outside renderers.
- Classifies progress rows as `worldRoute`, `parkedAwayFromHome`, or `garrisonedAtHome`.
- Keeps returned-home idle missions in explorer/progress state while excluding them from visible world actors.
- Consumes `TileCoord` for `coordKey()` and home/current comparisons so stale caller-supplied `tileId` cannot make a returned-home idle mission look parked away from home.

公开 API / Public API:

- `WorldActorProjection.projectWorldActors(input, options)`
- `WorldActorProjection.projectActorFromProgress(row)`
- `WorldActorProjection.getProjectionKind(row)`
- `WorldActorProjection.shouldRenderWorldActor(row)`
- `WorldActorProjection.isSameCoord(a, b)`
- `WorldActorProjection.coordKey(coord)`

性能约束 / Performance Constraints:

- Reuses `WorldMarchProgressSnapshot` rows and keeps projection linear over missions.
- Does not mutate explorer state, progress snapshots, renderer state, DOM, canvas, or WebGL objects.
- Projection metadata is compact: `{ kind, source }` on rendered actor DTOs.
- Coordinate comparison is canonical and allocation-light: stable `x/y` and legacy `q/r` shapes collapse to the same deterministic `tileId`.

扩展方式 / Extension Path:

- New world actor visibility/projection semantics start here with red tests before renderer changes.
- `WorldMarchProgressSnapshot` should preserve source facts such as `homeOrigin`; this module decides which facts become visible map actors.
- Renderers consume projected actors only and must not infer mission home/away business semantics.
- New projection rules must not trust raw `tileId` identity from renderer, caller, or persisted legacy rows; normalize through `TileCoord` first.

回归 / Regression:

- `node --test frontend/js/domain/WorldActorProjection.test.js frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/domain/WorldMapRenderSnapshot.test.js frontend/js/domain/WorldMarchSystem.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMarchGeometry.js`

状态 / Status: candidate

负责 / Owns:

- pure tile screen projection for world march actors and target controls
- nearest rendered world-tile lookup from screen points
- axial tile inference from screen points and viewport geometry
- march target UI-state normalization for HUD/render helpers
- `TileCoord`-normalized stable coordinate contract: stable `x/y` and legacy `q/r` inputs produce the same tile identity for nearest-tile lookup and march target UI state, while fractional march actor coordinates keep continuous projection for smooth movement

公开 API / Public API:

- `WorldMarchGeometry.toNumber(value, fallback)`
- `WorldMarchGeometry.toInteger(value, fallback)`
- `WorldMarchGeometry.tileId(q, r)`
- internal `TileCoord`-backed coordinate normalization for geometry-facing inputs
- `WorldMarchGeometry.getTileScreenCenter(coord, viewport, geometry)`
- `WorldMarchGeometry.screenPointToNearestTile(point, tileMapView, viewport)`
- `WorldMarchGeometry.screenPointToAxialTile(point, viewport, geometry)`
- `WorldMarchGeometry.getMarchTargetUiState(uiState)`

扩展方式 / Extension Path:

- 新 world-march screen/input geometry first extends this module with focused tests。
- New gameplay march progress or arrival rules stay in `WorldMarchProgressSnapshot` or later systems modules.
- `WorldMarchSystem` keeps compatibility methods only; do not add new geometry bodies back there.
- 新坐标语义先扩展 `TileCoord`/`WorldTopology`，本模块只消费稳定坐标契约，不再手写第二套 tile identity 规则。

回归 / Regression:

- `node --test frontend/js/domain/WorldMarchGeometry.test.js frontend/js/domain/WorldMarchSystem.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMarchSystem.js` - 64 lines

状态 / Status: candidate facade

负责 / Owns:

- 保留旧世界行军 public API，避免一次性改动 renderer/HUD/presenter 调用
- 行军进度、抵达状态、单 mission 兼容 actor 生成等 gameplay calculation 已委托 `WorldMarchProgressSnapshot`
- 集合级 world actor projection 已委托 `WorldActorProjection`
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

- 新行军玩法事实加到 `WorldMarchProgressSnapshot` 或后续 `systems` 模块，不加到本文件。
- 新 world actor 可见性/投影规则加到 `WorldActorProjection`。
- 新 screen/input geometry 应进入 `WorldMarchGeometry`；action mapping 进入 input/action adapter。
- Renderer/HUD can continue using this compatibility facade, but new callers should prefer `WorldMarchProgressSnapshot`, `WorldActorProjection`, or `WorldMarchGeometry` directly.

回归 / Regression:

- `node --test frontend/js/domain/WorldActorProjection.test.js frontend/js/domain/WorldMarchGeometry.test.js frontend/js/domain/WorldMarchSystem.test.js frontend/js/domain/WorldMarchProgressSnapshot.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMapRenderSnapshot.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图 renderer 的单一输入合同 / single render input contract
- 将 `tileMapView`、`frame`、`viewport`、`uiState`、render flags、march actors、arrival rows 收束为一个 snapshot
- 为 `WorldMapCanvasRenderer`、fog rebuild、hit target builder、debug overlay 后续拆分提供共同上下文
- 保留大数组引用而不是深拷贝 tiles，避免每帧制造大 payload
- Normalizes `worldMarchTarget` through `TileCoord` so stale UI/caller `tileId` values cannot override stable target coordinates.

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
- March actors come from `WorldActorProjection` over `WorldMarchProgressSnapshot` facts, keeping gameplay status and visibility projection outside renderers.
- `worldMarchTarget` identity remains compact and canonical; signatures hash the normalized target `tileId` rather than caller-supplied legacy identity.

扩展方式 / Extension Path:

- 新 renderer 拆分模块应优先接收 `renderSnapshot`，而不是各自重新组合 `tileMapView + viewport + uiState`。
- 新 debug overlay 可以消费 `toSerializable()`，不要读取 canvas/runtime object。
- 新 render flag 先加到 `normalizeFlags()`，同步测试与本索引。
- New render-facing target state must preserve this boundary: UI flags may pass through, but tile identity is derived by `TileCoord`.

回归 / Regression:

- `node --test frontend/js/domain/WorldActorProjection.test.js frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/domain/WorldMapRenderSnapshot.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
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
- Layout entity signatures derive tile identity through stable `x/y` semantics, accepting legacy `q/r` as input while never using raw `tile.id` / `tileId` as cache authority.
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
- Fallback entity signatures use the same stable coordinate identity as `WorldMapLayoutModel`; raw `tile.id` / `tileId` values are not layout cache authority.
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
- `WorldMapHitTargetModel.normalizeTileCoord(tile, options)`
- `WorldMapHitTargetModel.createWorldTileSiteHitTargets(tileMapView, viewport, entries, options)`
- `WorldMapHitTargetModel.createWorldMarchTileHitTargets(tileMapView, viewport, frame, options)`

性能约束 / Performance Constraints:

- No canvas, DOM, renderer instance, runtime object, gameplay mutation, or direct `addHitTarget()` call.
- Target creation is linear over visible entries or tiles.
- Site targets reuse injected layout calculations and injected image metrics.
- March targets use frame margin culling before returning target data.
- Site and march action payload identity uses stable `x/y` semantics, accepting legacy `q/r` while never using raw renderer `tile.id` / `tileId` as action authority.

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
- `normalizeTileCoord(tile)`
- `registerHitTargets(targets)`
- `addWorldTileSiteHitTargets(tileMapView, viewport, entries, uiState)`
- `addWorldMarchTileHitTargets(tileMapView, viewport, frame)`

性能约束 / Performance Constraints:

- Pure target geometry/action payloads remain in `WorldMapHitTargetModel`.
- Registration is linear over returned target rows and does not inspect unrelated hit targets.
- Fallback site registration is linear over visible entries; fallback march registration is linear over tiles with frame-margin culling.
- Fallback action payload identity uses stable `x/y` semantics, accepting legacy `q/r` while never using raw renderer `tile.id` / `tileId` as action authority.
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
- Static, water, and scout-route cache identity derives tile ids from stable `x/y` semantics, accepting legacy `q/r` while never using raw `tile.id` or route `tileId` as cache authority.
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
- Fallback cache key generation uses the same stable coordinate identity as `WorldMapCachePolicy`; raw `tile.id` / `tileId` values are not cache authority when policy helpers are unavailable.
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
- `getTileMapGeometry()`
- `normalizeTileCoord(tile)`
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
- Optional direct site hit-target registration uses stable `x/y` semantics, accepting legacy `q/r` while never using raw renderer `tile.id` / `tileId` as action authority.
- No cache ownership, no gameplay mutation, no unit-frame ownership, no visibility decision, no asset discovery.

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
- `normalizeTileCoord(tile)`
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
- Fallback water cache identity uses stable `x/y` semantics, accepting legacy `q/r` while never using raw `tile.id` / `tileId` as cache authority.
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
- No cache ownership, no gameplay mutation, no unit-frame ownership, no visibility decision, no asset discovery.

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
- Split implementation for current `WorldMapCanvasRenderer.renderWorldScoutRoutes()` only; legacy scout helper methods are retired.

公开 API / Public API:

- `new WorldMapScoutRenderer({ host })`
- `renderWorldScoutRoutes(tileMapView, viewport)`

性能约束 / Performance Constraints:

- Route drawing is linear over mission route points.
- No cache ownership, no gameplay mutation, no unit-frame ownership, no visibility decision, no asset discovery.

扩展方式 / Extension Path:

- 新 scout route visual rule 先扩展本文件。
- New active scout actor rendering still goes through `WorldMapActorHudRenderer` / `WorldActorCanvasRenderer` / `WorldMarchSystem`; do not add it back here.
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
- occupied-city command overlay, title badge, rename button, primary/side command buttons
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
- 作为 `WorldMapCanvasRenderer.renderMilitaryWorldView()` 的拆分实现

公开 API / Public API:

- `new WorldMapMilitaryViewRenderer({ host })`
- `renderMilitaryWorldView(state, x, y, width, height, options)`

性能约束 / Performance Constraints:

- Rendering is a bounded branch over tile-map view or empty world copy.
- Tile-map drawing delegates to `renderWorldTileMap()` instead of owning tile rendering.
- Hit-target registration is bounded to current tile-map reset controls.
- No cache lifecycle, no gameplay simulation, no asset discovery, no visibility decision.

扩展方式 / Extension Path:

- 新 military world-view panel composition 先扩展本文件。
- 新 tile-map rendering details 仍扩展 world-map split renderers, not this module.
- 新 world-site modal/action overlay 仍扩展 `WorldMapSiteOverlayRenderer`。
- New presenter data rules still extend `WorldSitePresenter` or related current presenter modules; `WorldRadarPresenter` is retired.

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
- snapshot-layer refresh also publishes the current `lastWorldTileMapContext` so split fog and actor layers consume the same viewport/camera frame
- the freshly published layer context is the authoritative per-frame coordinate source; stale runtime contexts are fallback only and must not override it
- world-map panel background and clip setup
- world-map drag hit-target registration
- snapshot-only cache redraw branch
- hit-target-only pass for map-owned march tile and site targets
- main layer render ordering: scout route, water, static entries, fog context, and map-owned hit targets
- publishes `lastWorldTileMapContext` for `worldActor` and `mainHud` passes; it does not paint actors, register actor targets, paint map-home march HUD, or register formation-picker HUD targets
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
- `renderWorldTileMapHitTargets(tileMapView, viewport, frame, geometry, visibleEntries, uiState)`
- `renderWorldTileMapLayers(tileMapView, viewport, frame, geometry, visibleEntries, uiState)`
- `renderWorldTileMap(tileMapView, x, y, width, height, uiState, options)`

性能约束 / Performance Constraints:

- Visible entries are calculated once per normal frame and reused by layer renderers and hit-target registration.
- Tile-map context stores existing snapshot/tile/view references instead of cloning large tile payloads.
- Layer rendering delegates to existing cache-aware split renderers; this module does not repaint cache internals.
- Snapshot-only redraw blits existing caches and skips visible-entry calculation.
- `worldTileFastDragActive` is restored in `finally` even if a downstream renderer fails.
- No gameplay mutation, no asset discovery, no fog visual rule ownership, no actor drawing/targets, no physical world-map HUD painting.
- Extension note: new actor drawing details still extend `WorldActorCanvasRenderer`; map-home march HUD drawing belongs to the `mainHud` pass (`HudOverlayCanvasRenderer` / `CanvasFrameRenderer`) through the published world-map HUD context.

扩展方式 / Extension Path:

- 新 world tile-map frame sequencing rule 先扩展本模块并补 focused tests。
- 新 tile/site/water/scout/cache drawing details 仍扩展对应 split renderer，不要写回本模块。
- 新 actor drawing / actor hit-target details 仍扩展 `WorldActorCanvasRenderer` 或 `WorldMapLayerCanvasRenderer` actor pass。
- 新 march command HUD details 仍扩展 `WorldMarchHudCanvasRenderer` 并由 `mainHud` pass 调用。
- 新 fog visual rules 仍扩展 `WorldFogVisualSnapshot` / `WorldMapVisualPluginRegistry`。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/WorldMapActorHudRenderer.js`

状态 / Status: candidate

职责 / Owns:

- world-map actor derivation from `WorldMapRenderSnapshot` actors or active march missions
- epoch-now resolution for march actor calculation
- actor render handoff to `WorldActorCanvasRenderer`
- actor hit-target handoff to `WorldActorCanvasRenderer`
- march HUD state publication to renderer/host/HUD renderer for `mainHud` callers
- compatibility march HUD render helper for `mainHud` callers; physical `worldActor` pass must not invoke command HUD
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
- No tile layout/cache orchestration, no fog visual rule ownership, no gameplay mutation, no physical world-map or worldActor command HUD painting.
- Extension note: new march HUD visual/detail still extends `WorldMarchHudCanvasRenderer`; map-home invocation happens from `HudOverlayCanvasRenderer` / `CanvasFrameRenderer`, never from the physical `worldMap` or `worldActor` layer.

扩展方式 / Extension Path:

- 新 actor handoff rule 先扩展本模块。
- 新 actor pixel drawing 仍扩展 `WorldActorCanvasRenderer`。
- 新 march HUD visual/detail 仍扩展 `WorldMarchHudCanvasRenderer`。
- 新 march domain calculation 仍扩展 `WorldMarchSystem` / domain snapshots。

回归 / Regression:

- `node --test frontend/js/platform/renderers/WorldMapActorHudRenderer.test.js frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldFogVisualSnapshot.js`

状态 / Status: candidate

负责 / Owns:

- 战争迷雾 visual input contract 的纯 domain snapshot
- 将 `WorldMapVisibilityModel` 的 visibility levels 映射成 renderer-safe fog mask levels
- 消费 `WorldMapRenderSnapshot` 的 frame、viewport、geometry，不让 fog renderer 自己推导地图语义
- 为旧 `WorldFogCanvasRenderer` 或后续替代 visual plugin 输出稳定 renderer context
- 保持 fog 玩法权威来自 visibility snapshot，本文件只做视觉输入适配
- Consumes `TileCoord` through visibility/fallback normalization so fog visual ids and signatures cannot be polluted by stale raw `id/tileId`.

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
- Stable `x/y` and legacy `q/r` shapes produce the same fog visual tile id and signature.

扩展方式 / Extension Path:

- 新 fog visual 规则先通过 visibility level 或 mask level 扩展，不写进 `WorldFogCanvasRenderer`。
- 新 renderer 需要 fog 输入时，消费 `toRendererContext()`，不要读 raw tile visibility。
- 如果未来加入多阵营视野、临时侦察、debug fog overlay，应先扩展 snapshot input/options 和测试，再由 registry 分发。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapVisibilityModel.test.js frontend/js/domain/WorldMapEntitySnapshot.test.js frontend/js/domain/WorldFogVisualSnapshot.test.js`
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

### `frontend/js/domain/WorldMapPickingModel.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图实体 picking snapshot / world-map entity picking snapshot
- 从当前 `lastWorldTileMapContext` 的 frame、viewport、geometry、tile sites、actors 生成可缓存的 `world-map-picking-snapshot-v1`
- 通过 `TileCoord` 归一化 site/tile identity 和 picking signature；stable `x/y` 与 legacy `q/r` 不能生成不同实体身份
- 保持 renderer hitTargets 只是输入证据，世界城池/部队目标身份由当前 picking snapshot 或 context 重算

公开 API / Public API:

- `WorldMapPickingModel.createSnapshot(context, options)`
- `WorldMapPickingModel.resolveAction(point, snapshot)`
- `WorldMapPickingModel.buildSignature(context)`
- `WorldMapPickingModel.createSiteTargets(context)`
- `WorldMapPickingModel.createActorTargets(context)`
- `WorldMapPickingModel.containsPoint(target, point)`
- `WorldMapPickingModel.targetSignature(target)`

性能约束 / Performance Constraints:

- Snapshot 只保存 compact target rect/action，不复制完整 tileMapView。
- Signature 只哈希 view/entity identity 与必要绘制参数，避免把 renderer/native event/runtime 对象带入输入证据。
- Tile identity normalization 必须复用 `TileCoord`，不要在 picking 模型里手写第二套 tile id 规则。

扩展方式 / Extension Path:

- 新世界实体命中类型先在 picking snapshot 增加 target builder 和测试，再由 action map/runtime 消费。
- Renderer 可以提供 surface evidence，但不能把 renderer hitTarget 重新升级为世界实体权威。
- 坐标字段迁移先扩展 `TileCoord`/`WorldTopology`，再让 picking/runtime/presenter 消费。

回归 / Regression:

- `node --test frontend/js/domain/WorldMapPickingModel.test.js frontend/js/domain/WorldMapInputActionMap.test.js frontend/js/platform/WorldMapRuntime.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMapInputIntent.js` - 337 lines

状态 / Status: candidate

负责 / Owns:

- auditable world-map input fact contract `world-map-input-intent-v1`
- compact tap evidence: `inputId`, `clientSequence`, points, action summary, target identity, picking epoch/signature/counts, view/camera, and small diagnostics
- whitelist serialization for externally supplied intent-like objects
- `TileCoord`-canonicalized tile evidence inside action and target summaries when coordinate evidence is present
- local replay/client-log evidence shape only; no gameplay authority, route decision, server validation, renderer access, or network IO

公开 API / Public API:

- `WorldMapInputIntent.createTapIntent(options)`
- `WorldMapInputIntent.toSerializable(intent)`
- `WorldMapInputIntent.getSerializableSizeBytes(intent)`
- `WorldMapInputIntent.summarizeAction(action)`
- `WorldMapInputIntent.summarizePoint(point)`
- `WorldMapInputIntent.summarizePicking(snapshot)`
- `WorldMapInputIntent.summarizeTarget(action)`
- constants: `SCHEMA`

性能约束 / Performance Constraints:

- Serializable evidence must stay compact and pass `WorldMapPerformanceBudget.checkInputIntent()`.
- Serialization is whitelist-based and must reject renderer objects, native/browser events, full tile arrays, hit target arrays, Promise/thenable payloads, and raw context objects.
- Tile target evidence uses canonical `tileId` derived from `targetQ/targetR` or `q/r`; stale caller-supplied `tileId` is not authority when coordinates exist.
- No backend service imports, renderer imports, DOM/canvas/WebGL objects, or gameplay mutation.

扩展方式 / Extension Path:

- New input evidence fields start here with focused tests and a performance-budget assertion.
- New server-authority fields do not belong here; this module records client-side input facts only.
- If target identity rules change, first extend `TileCoord` / input action mapping, then update this serializer and replay-correlation tests.

回归 / Regression:

- `node --test frontend/js/domain/WorldMapInputIntent.test.js frontend/js/domain/WorldMapPerformanceBudget.test.js frontend/js/platform/WorldMapRuntime.test.js frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/api/GameAPI.test.js backend/tests/CommandReplayCorrelation.test.js backend/tests/PerformanceCapacityBudget.test.js`
- `npm run test:architecture`

### `frontend/js/domain/WorldMapInputActionMap.js`

状态 / Status: candidate

负责 / Owns:

- 世界地图输入到动作的纯映射 / input-to-action mapping
- hit target 反向命中优先级：foreground action 优先，background action 只做兜底
- 过滤 world-map runtime 允许处理的 action types
- single authority for H5 Shell and minigame/compat App world-map tap routing; Shell/App routers must not duplicate these routing rules
- `TileCoord`-normalized background input coordinates: stable `x/y` and legacy `q/r` mapper output both produce deterministic compact action payloads
- coordinate-authoritative known-tile lookup for background inference: `findKnownTile()` matches current `tileMapView.tiles` by normalized coordinates and `buildSelectWorldMarchTargetAction()` emits canonical `tileId`, so stale or colliding raw tile ids cannot redirect target coordinates
- 将地图背景点击通过 `screenPointToAxialTile` 推断为 `selectWorldMarchTarget`
- 生成稳定 action payload，不直接修改游戏状态、不调 renderer、不调 backend

公开 API / Public API:

- `WorldMapInputActionMap.DEFAULT_ALLOWED_ACTIONS`
- `WorldMapInputActionMap.normalizeHitTargets(targets, options)`
- `WorldMapInputActionMap.normalizeHitTarget(target, options)`
- `WorldMapInputActionMap.getHitTarget(point, targets)`
- `WorldMapInputActionMap.resolveTapAction(point, input, options)`
- renderer world-surface targets (`openWorldSite`, `selectWorldActor`, `worldMapDrag`, background `selectWorldMarchTarget`) marked with `inputSurface: 'worldMap'` as non-authoritative surface evidence only; stable picking/context recomputation owns target identity
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

- `node --test frontend/js/domain/WorldMapInputActionMap.test.js frontend/js/platform/WorldMapRuntime.test.js frontend/js/platform/WorldMapInputAuthority.contract.test.js`
- `npm run test:architecture`

### `backend/services/config/ConfigRegistryContract.js`

状态 / Status: candidate

职责 / Owns:

- 配置 registry 的纯契约 / pure config registry contract
- registry id、schema、schemaVersion、version、contentHash、entryCount、entryIds metadata
- stable JSON hashing with sorted object keys and stable entry ordering
- entry id uniqueness validation and optional object-key/id match validation
- config version comparison and bump recommendation: none/minor/major
- no gameplay rule, route, repository, renderer, DOM, or filesystem write

公开 API / Public API:

- `ConfigRegistryContract.normalizeVersion(value, fallback)`
- `ConfigRegistryContract.createStableContentHash(value, options)`
- `ConfigRegistryContract.stableStringify(value)`
- `ConfigRegistryContract.createRegistryMetadata(input, options)`
- `ConfigRegistryContract.validateRegistry(input, options)`
- `ConfigRegistryContract.compareRegistryVersions(before, after, options)`
- `ConfigRegistryContract.recommendVersionBump(before, after, options)`

性能约束 / Performance Constraints:

- Linear scan over registry entries plus one `Set`/`Map` for id checks.
- Stable hash sorts object keys recursively, so callers should pass compact config registry payloads, not full runtime state.
- No deep copy of renderer/game state, no async I/O, no network, no database.

扩展方式 / Extension Path:

- New config domains consume this module through metadata/validation adapters instead of re-implementing version/hash rules.
- Automatic client update prompts should consume `compareRegistryVersions()` / `recommendVersionBump()` outputs.
- Server-authoritative random-result boundaries stay in later P11 config/random modules; do not add random generation here.

回归 / Regression:

- `node --test backend/tests/ConfigRegistryContract.test.js`
- `npm run test:architecture`

### `backend/services/config/ConfigPipeline.js`

状态 / Status: candidate

职责 / Owns:

- P12-007 local config pipeline orchestration
- collecting registered config registry metadata/validation reports
- generating `config-pipeline-snapshot-v1` snapshots
- comparing current snapshots against a baseline
- surfacing registry additions/removals, schema/content/version drift, entry diffs, and version bump recommendations
- no gameplay rule ownership, no admin auth, no production publish side effects

公开 API / Public API:

- `ConfigPipeline.buildCurrentSnapshot(options)`
- `ConfigPipeline.buildPipelineReport(options)`
- `ConfigPipeline.collectRegistryReports(options)`
- `ConfigPipeline.compareSnapshots(baseline, current, options)`
- `ConfigPipeline.createSnapshot(registryReports, options)`
- `ConfigPipeline.getDefaultRegistryLoaders()`
- `ConfigPipeline.readSnapshot(filePath)`
- `ConfigPipeline.writeSnapshot(filePath, snapshot)`

扩展方式 / Extension Path:

- New config domains must expose `getRegistryMetadata()` / `validateRegistry()` and register a loader here.
- Preview/publish/rollback workflow should consume this module instead of reimplementing registry comparison in routes or UI code.
- Production config bundle loading and audit persistence should remain outside this pure pipeline boundary.

回归 / Regression:

- `node --test backend/tests/ConfigPipeline.test.js`
- `npm run config:validate`
- `npm run test:architecture`

### `backend/services/config/ConfigReleaseService.js`

状态 / Status: candidate

职责 / Owns:

- P12-007 audit-only config release workflow
- config release preview built on `ConfigPipeline`
- publish records with release history and active release pointer persistence
- rollback records that restore the active release pointer to a previous audited snapshot
- active-vs-current registry runtime drift status
- startup release gate policy for active-vs-current registry matching
- default production release state under `/opt/wxgame-workspace/.wxgame/config-release/` so backups include release history and the active pointer
- public record shaping that hides full snapshots unless explicitly requested
- no gameplay runtime hot-loading, no admin authentication, no UI ownership

公开 API / Public API:

- `ConfigReleaseService.previewRelease(payload, options)`
- `ConfigReleaseService.publishRelease(payload, options)`
- `ConfigReleaseService.rollbackRelease(releaseId, options)`
- `ConfigReleaseService.loadReleaseHistory(options)`
- `ConfigReleaseService.getActiveRelease(options)`
- `ConfigReleaseService.getRuntimeStatus(options)`
- `ConfigReleaseService.resolveRuntimeGatePolicy(env, options)`
- `ConfigReleaseService.assertRuntimeReleaseReady(options)`
- `ConfigReleaseService.validateSnapshot(snapshot)`
- `ConfigReleaseService.findReleaseRecord(releaseId, options)`

扩展方式 / Extension Path:

- Production gameplay config loading now goes through `GameplayConfigRuntime`; release service remains audit/pointer/gate ownership and must not gain gameplay hot-load side effects.
- Durable storage can move behind a repository/DB adapter while preserving the public record shape.
- Admin UI and CLI publish commands should call this service instead of duplicating release validation or active-pointer writes.
- Production path changes must keep config release state inside a backed-up deploy-state scope or update `scripts/backup-runtime-state.sh`, `scripts/verify-runtime-backup.sh`, and this index together.

回归 / Regression:

- `node --test backend/tests/ConfigReleaseService.test.js backend/tests/AdminRoutes.test.js`
- `npm run test:architecture`

### `backend/services/config/ConfigRuntimeLoader.js`

状态 / Status: candidate

职责 / Owns:

- P12-007 read-only runtime config bundle boundary
- requiring `ConfigReleaseService.assertRuntimeReleaseReady()` before payload loading
- collecting current registered config payloads through `ConfigPipeline` loaders after release gate match
- validating payload hashes against the active release snapshot
- compact loader readiness status for health/admin surfaces
- no gameplay module mutation, no hot reload side effects, no release history persistence

公开 API / Public API:

- `ConfigRuntimeLoader.buildRuntimeBundle(options)`
- `ConfigRuntimeLoader.getRuntimeLoaderStatus(options)`
- `ConfigRuntimeLoader.validatePayloadHashes(snapshot, registryReports)`
- `ConfigRuntimeLoader.createStablePayloadHash(value, options)`

扩展方式 / Extension Path:

- Gameplay modules consume this bundle through `GameplayConfigRuntime`; keep loader output read-only and avoid adding gameplay-specific behavior here.
- Bundle payload shape should follow registered config `raw()` outputs; new config domains must still register through `ConfigPipeline`.
- Real rollback drills should verify the active release pointer, startup gate, bundle readiness, and gameplay consumption path together.

回归 / Regression:

- `node --test backend/tests/ConfigRuntimeLoader.test.js backend/tests/ConfigReleaseService.test.js`
- `npm run test:architecture`

### `backend/services/config/GameplayConfigRuntime.js`

状态 / Status: candidate

职责 / Owns:

- P12-007 gameplay-facing config runtime facade
- initializing gameplay config consumption from `ConfigRuntimeLoader` after release gate match
- required-mode startup failure when the active bundle is not ready or invalid
- warn/off observe-mode fallback to module config for local development and diagnostics
- dynamic proxies for `GameConfig`, `BuildingConfig`, `EraConfig`, `TutorialFlowConfig`, and `TechTreeConfig`
- no admin publish ownership, no release history persistence, no hot reload side effects

公开 API / Public API:

- `GameplayConfigRuntime.initializeRuntimeConfig(options)`
- `GameplayConfigRuntime.getRuntimeConfigStatus()`
- `GameplayConfigRuntime.configureRuntimeConfig(options)`
- `GameplayConfigRuntime.resetRuntimeConfig()`
- `GameplayConfigRuntime.GameConfig`
- `GameplayConfigRuntime.BuildingConfig`
- `GameplayConfigRuntime.EraConfig`
- `GameplayConfigRuntime.TutorialFlowConfig`
- `GameplayConfigRuntime.TechTreeConfig`

扩展方式 / Extension Path:

- New gameplay config domains should add registry coverage through `ConfigPipeline` first, then expose a dynamic facade here.
- Gameplay services should import this facade instead of importing raw `backend/config/*` modules directly, except registry contract tests and this module's fallback boundary.
- Rollback drills should verify active release pointer, startup gate, loader readiness, and representative gameplay reads through this facade.

回归 / Regression:

- `node --test backend/tests/GameplayConfigRuntime.test.js backend/tests/ConfigRuntimeLoader.test.js backend/tests/ConfigReleaseService.test.js`
- `npm run test:architecture`

### `frontend/tools/config-release-console.html`

状态 / Status: candidate

职责 / Owns:

- standalone P12-007 admin console for config release audit workflow
- reading active config release and release history
- triggering current config preview and audit-only publish
- showing active-vs-current registry runtime drift status
- showing runtime bundle loader readiness
- triggering active release pointer rollback from history
- no main-game runtime ownership and no production config hot-loading

公开 API / Public API:

- Tool URL: `/tools/config-release-console.html`
- Query override: `?apiBase=/api`
- Uses admin API routes under `/api/admin/config-releases*`

扩展方式 / Extension Path:

- UI changes should stay a thin console over `ConfigReleaseService` / `ConfigRuntimeLoader` responses.
- Any production runtime activation must be implemented in backend config loading modules, not by adding side effects to this tool.
- Keep this page out of the main H5 boot script chain.

回归 / Regression:

- `node --test frontend/tools/config-release-console.test.js`
- `npm run test:architecture`

### `frontend/tools/ops-console.html`

状态 / Status: candidate

职责 / Owns:

- standalone P12-009 admin operations console
- reading server, PM2, health, deploy, config runtime, observability, player activity, logs, and audit snapshots
- toggling soft maintenance mode through admin ops APIs
- triggering audited PM2 restart through admin ops APIs
- connecting to a same-origin or explicitly configured ops-agent for hard stop/start after host installation
- storing backend ops token and agent token separately as `cf_ops_token` and `cf_ops_agent_token`
- no main-game boot ownership and no auth token creation ownership

公开 API / Public API:

- Tool URL: `/tools/ops-console.html`
- Query overrides: `?apiBase=/api` and `?agentBase=/ops-agent`
- Uses independent ops-admin login through `/api/admin/ops/login`
- Uses ops-agent login through `/ops-agent/login` when the Agent panel is configured
- Stores and sends only `cf_ops_token` and `cf_ops_agent_token`; it must not read player `cf_token` or `token`

扩展方式 / Extension Path:

- UI changes should stay a thin console over `OpsControlService` and ops-agent responses.
- New destructive controls must be audited on the backend and documented with hard-stop/recovery semantics.
- Keep this page out of the main H5 boot script chain.

回归 / Regression:

- `node --test frontend/tools/ops-console.test.js`
- `npm run test:architecture`

### `scripts/validate-config-pipeline.js`

状态 / Status: candidate

职责 / Owns:

- CLI entrypoint for P12-007 local config validation
- default current registry validation output
- `--write-baseline <path>` snapshot writing
- `--baseline <path>` snapshot diff and version-bump enforcement
- optional `--json` machine-readable report output

公开 API / Public API:

- `npm run config:validate`
- `node scripts/validate-config-pipeline.js`
- `node scripts/validate-config-pipeline.js --baseline docs/config_registry_snapshot_2026-06-11.json`
- `node scripts/validate-config-pipeline.js --write-baseline docs/config_registry_snapshot_2026-06-11.json`

扩展方式 / Extension Path:

- Keep this script as a thin CLI wrapper over `ConfigPipeline`.
- Add publish/rollback commands as explicit future entrypoints rather than hiding side effects behind default validation.

回归 / Regression:

- `node --test scripts/validate-config-pipeline.test.js`
- `npm run config:validate`
- `npm run test:architecture`

### `docs/config_registry_snapshot_2026-06-11.json`

状态 / Status: candidate

职责 / Owns:

- current P12-007 baseline config registry snapshot
- expected registry ids, schema versions, config versions, content hashes, entry counts, entry ids, and source paths
- baseline diff input for `scripts/validate-config-pipeline.js --baseline`

扩展方式 / Extension Path:

- Update this file with `node scripts/validate-config-pipeline.js --write-baseline docs/config_registry_snapshot_2026-06-11.json` only when a reviewed config release intentionally changes registry content and has the required version bump.
- Do not edit hashes by hand; regenerate from the pipeline.

回归 / Regression:

- `node scripts/validate-config-pipeline.js --baseline docs/config_registry_snapshot_2026-06-11.json`
- `npm run test:architecture`

### `backend/services/random/ServerRandomAuthorityContract.js`

状态 / Status: candidate

职责 / Owns:

- 后端权威随机数契约 / server-authoritative random roll contract
- stable random roll envelope: `schema`, `authority`, `domain`, `action`, `subjectId`, `seed`, `sequence`, `serverTime`, `value`, `rollId`
- bounded unit roll normalization in `[0, 0.999999]`
- injectable deterministic random source for tests while keeping default runtime entropy backend-owned
- chance roll helper that records threshold and server authority metadata
- no gameplay result selection, no frontend import, no renderer/DOM, no persistence writes

公开 API / Public API:

- `ServerRandomAuthorityContract.SCHEMA`
- `ServerRandomAuthorityContract.AUTHORITY`
- `ServerRandomAuthorityContract.createScope(input, options)`
- `ServerRandomAuthorityContract.createRoll(input, options)`
- `ServerRandomAuthorityContract.createRandomSource(input, options)`
- `ServerRandomAuthorityContract.rollChance(chance, input, options)`
- `ServerRandomAuthorityContract.normalizeUnitRoll(value, fallback)`
- `ServerRandomAuthorityContract.createRollId(roll)`

性能约束 / Performance Constraints:

- O(1) roll creation.
- Default runtime entropy uses Node backend crypto, not frontend-provided values.
- Roll envelopes are compact metadata and do not clone game state.

扩展方式 / Extension Path:

- New random-result domains first declare a `domain`/`action` and consume this contract through a narrow service adapter.
- Gameplay services decide what a successful roll means; this contract only owns random authority and bounded roll metadata.
- Future audit/persistence can store roll envelopes without changing frontend contracts.

回归 / Regression:

- `node --test backend/tests/ServerRandomAuthorityContract.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/FamousPersonArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/worldMap/WorldMapGenerationAuthority.js`

Status: candidate

Owns:

- world-map deterministic materialization authority
- stable `domain: worldMap`, `authority: server`, and `mode: seeded-hash` roll metadata
- FNV-1a hash and normalized seed/key/salt handling for reproducible terrain, water, river, and scout-reveal branch rolls
- compact `generationAuthority` metadata for persisted world maps
- compatibility-preserving roll semantics for string and numeric stable keys

Public API:

- `WorldMapGenerationAuthority.SCHEMA`
- `WorldMapGenerationAuthority.AUTHORITY`
- `WorldMapGenerationAuthority.DOMAIN`
- `WorldMapGenerationAuthority.DETERMINISTIC_MODE`
- `WorldMapGenerationAuthority.HASH_SCALE`
- `WorldMapGenerationAuthority.normalizeSeed(seed, fallback)`
- `WorldMapGenerationAuthority.hashString(input)`
- `WorldMapGenerationAuthority.createGenerationScope(input)`
- `WorldMapGenerationAuthority.createDeterministicRoll(input)`
- `WorldMapGenerationAuthority.createRollId(roll)`
- `WorldMapGenerationAuthority.roll01(seed, q, r, salt, options)`
- `WorldMapGenerationAuthority.createWorldMapGenerationMetadata(seed, options)`

Performance Constraints:

- O(length of stable key text) roll creation; no crypto, database, filesystem, renderer, DOM, or game-state clone.
- Reuses seeded hash semantics so existing world seeds remain reproducible.
- Metadata is compact and attached once per normalized world map, not per tile.

Extension Path:

- New world-map materialization decisions add a new `action`/`salt` here or consume `roll01()` through this module before changing terrain/water/tile services.
- Keep gameplay placement rules in `WorldMapService` / territory/explorer services; this module only owns deterministic authority and metadata.
- Do not add frontend visual randomness, renderer feature jitter, or non-world-map gameplay drops here.

Regression:

- `node --test backend/tests/WorldMapArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js`
- `npm run test:architecture`

### `backend/services/WorldMapService.js`

Status: candidate facade

Owns:

- backend world-map public facade for seed, version, origin, tile list, reveal, scout trail, and client map APIs
- `generationAuthority` metadata attachment during initial world-map creation and normalization
- delegation to focused world-map modules for terrain, water, tile normalization, IDs, and deterministic generation authority
- scout reveal area branch materialization through `WorldMapGenerationAuthority.roll01()`
- context-aware first materialization through `WorldMapTiles.chooseMaterializedTerrain(seed, q, r, generationContext)`; persisted global terrain authority is owned by `WorldMapAuthorityRepository`, not by this facade
- server-side tile write-boundary identity: `WorldMapTiles.createTile()` / `normalizeTile()` and `WorldMapBatch.mergeTiles()` derive public tile `id` from display `q/r`; caller-supplied `id`, stale persisted `id`, or merge-time `id` values cannot override coordinate identity

Public API:

- `WorldMapService.WORLD_MAP_VERSION`
- `WorldMapService.DEFAULT_WORLD_SEED`
- `WorldMapService.createWorldMapGenerationMetadata(seed, options)`
- `WorldMapService.createInitialWorldMap(seed, now)`
- `WorldMapService.normalizeWorldMap(rawWorldMap, options)`
- `WorldMapService.ensureWorldMap(gameState, now)`
- `WorldMapService.createTile(seed, q, r, now, overrides)`
- `WorldMapService.revealTile(gameState, q, r, now, overrides)`
- `WorldMapService.revealTileArea(gameState, q, r, now, options)`
- `WorldMapService.getScoutRevealArea(seed, route, direction, options)`
- `WorldMapService.revealScoutArea(gameState, revealArea, now)`
- `WorldMapService.bindSiteToTile(gameState, q, r, siteId, now, options)`
- `WorldMapService.buildScoutRoute(origin, direction, actionPoints, options)`
- `WorldMapService.recordScoutTrail(gameState, mission, tileIds, returned)`
- `WorldMapService.getClientWorldMap(gameState, now)`
- `WorldMapService.getClientWorldMapFromNormalized(worldMap)`

Performance Constraints:

- Facade stays under 500 lines and delegates terrain/water/tile/generation decisions to focused modules.
- Normalization uses one `Map` for tile upsert and stable sorting, with no renderer/frontend dependencies.
- Scout reveal branch rolls are deterministic O(route length * branch side count).
- `getClientWorldMapFromNormalized()` is read-only projection from an already-normalized world map and must not call `ensureWorldMap()` or reveal helpers.

Extension Path:

- New deterministic world-generation behavior first extends `WorldMapGenerationAuthority`.
- New terrain/tile fields first extend `WorldMapTiles`; new ocean/river behavior first extends `WorldMapWater`.
- New world-map tile write paths must preserve coordinate-derived public tile ids and canonical-id merge keys; add focused `WorldMapArchitecture.test.js` coverage before accepting any new persisted tile identity field.
- New global persistence/visibility behavior extends `WorldMapAuthorityRepository`; do not reintroduce full world bodies into player saves.
- Do not put renderer visuals, frontend hit targets, or territory battle/conquest rules into this facade.

Regression:

- `node --test backend/tests/WorldMapArchitecture.test.js backend/tests/WorldExplorerArchitecture.test.js backend/tests/TerritoryArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/famousPerson/FamousPersonRandomAuthority.js`

Status: candidate

Owns:

- famous-person candidate random authority adapter
- stable `domain: famousPerson` and `action: candidateGeneration` scope values
- candidate generation subject id and seed derivation from player/source/city/time
- attaching compact random authority metadata to candidate `source.randomAuthority`
- deterministic test injection by delegating to `ServerRandomAuthorityContract`

Public API:

- `FamousPersonRandomAuthority.DOMAIN`
- `FamousPersonRandomAuthority.DEFAULT_ACTION`
- `FamousPersonRandomAuthority.createCandidateRandomSource(gameState, sourceType, now, options)`
- `FamousPersonRandomAuthority.createCandidateSeed(gameState, sourceType, now)`
- `FamousPersonRandomAuthority.createCandidateSubjectId(gameState, sourceType)`
- `FamousPersonRandomAuthority.createSourceMetadata(randomSource)`
- `FamousPersonRandomAuthority.getAuthorityScope(randomSource)`

Performance Constraints:

- O(1) source setup; no game-state clone, database IO, frontend import, or persistence write.
- Random source is created once at candidate generation entry and reused through archetype, quality, name, ability, attribute, appearance, and loyalty rolls.

Extension Path:

- New famous-person random-result domains add a new action/scope here before changing gameplay services.
- Keep gameplay meaning in `FamousPersonService` / `FamousPersonGenerator`; this adapter only owns random authority metadata.
- Do not reintroduce default `Math.random` in famous-person candidate generation paths.

Regression:

- `node --test backend/tests/FamousPersonArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js`
- `npm run test:architecture`

### `backend/services/FamousPersonService.js`

Status: candidate facade

Owns:

- Famous-person normalization, candidate seek/accept/dismiss mutation, tutorial scout grants, progression helpers, and famous-person client DTO projection.
- `getClientState()` remains the compatibility API that ensures famous-person state before projection.
- `getClientStateFromNormalized()` and `getSeekAvailabilityFromState()` are read-only projection helpers for already-normalized state.

Public API:

- `FamousPersonService.createInitialFamousPersonState()`
- `FamousPersonService.normalizeFamousPeople(rawPeople)`
- `FamousPersonService.normalizeFamousPersonState(rawState)`
- `FamousPersonService.ensureFamousPersonState(gameState)`
- `FamousPersonService.getClientState(gameState)`
- `FamousPersonService.getClientStateFromNormalized(gameState)`
- `FamousPersonService.getSeekAvailabilityFromState(gameState, state)`
- `FamousPersonService.seekFamousPerson(gameState, payload, now, randomSource)`
- `FamousPersonService.acceptFamousPerson(gameState, candidateId, now)`
- `FamousPersonService.dismissFamousPersonCandidate(gameState, candidateId)`

Extension Path:

- New DTO fields go through `getClientStateFromNormalized()` and must not prune candidates, normalize people in place, or mutate seek counters.
- Candidate creation and accept/dismiss writes remain in mutation APIs and keep random authority metadata through `FamousPersonRandomAuthority`.

Regression:

- `node --test backend/tests/FamousPersonArchitecture.test.js backend/tests/GameStateProjectionArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/defenderLeader/DefenderLeaderRandomAuthority.js`

Status: candidate

Owns:

- defender-leader random authority adapter
- stable `domain: defenderLeader` and `action: leaderGeneration` scope values
- defender leader subject id and seed derivation from territory id/name, owner, threat, and defense
- compact random authority metadata for generated defender leaders at `source.randomAuthority`
- deterministic test injection by delegating to `ServerRandomAuthorityContract`

Public API:

- `DefenderLeaderRandomAuthority.DOMAIN`
- `DefenderLeaderRandomAuthority.DEFAULT_ACTION`
- `DefenderLeaderRandomAuthority.createLeaderRandomSource(territory, options)`
- `DefenderLeaderRandomAuthority.createLeaderSeed(territory)`
- `DefenderLeaderRandomAuthority.createLeaderSubjectId(territory)`
- `DefenderLeaderRandomAuthority.createSourceMetadata(randomSource)`
- `DefenderLeaderRandomAuthority.getAuthorityScope(randomSource)`

Performance Constraints:

- O(1) source setup; no game-state clone, route handling, database IO, frontend import, or persistence write.
- Random source is created once at defender-leader generation entry and reused through name, attribute, appearance, and related generated data.

Extension Path:

- New defender-leader random-result domains add a new action/scope here before changing gameplay services.
- Keep gameplay meaning in `DefenderLeaderService`; this adapter only owns random authority metadata.
- Do not reintroduce default `Math.random` in defender-leader generation paths.

Regression:

- `node --test backend/tests/TerritoryArchitecture.test.js backend/tests/BattleArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js`
- `npm run test:architecture`

### `backend/services/skillGenerator/SkillGeneratorRandomAuthority.js`

Status: candidate

Owns:

- skill/ability-kit random authority adapter
- stable `domain: skillGenerator` and default `action: abilityKitGeneration` scope values
- ability-kit seed and subject id derivation from source/archetype/quality
- fallback random source creation for low-level skill generator helpers that still need a random unit roll
- compact random authority metadata for generated ability kits through `randomAuthority`
- deterministic test injection by delegating to `ServerRandomAuthorityContract`

Public API:

- `SkillGeneratorRandomAuthority.DOMAIN`
- `SkillGeneratorRandomAuthority.DEFAULT_ACTION`
- `SkillGeneratorRandomAuthority.createAbilityKitSeed(input)`
- `SkillGeneratorRandomAuthority.createAbilityKitSubjectId(input)`
- `SkillGeneratorRandomAuthority.createAbilityKitRandomSource(input, options)`
- `SkillGeneratorRandomAuthority.createFallbackRandomSource(options)`
- `SkillGeneratorRandomAuthority.createSourceMetadata(randomSource)`
- `SkillGeneratorRandomAuthority.getAuthorityScope(randomSource)`

Performance Constraints:

- O(1) source setup; no game-state clone, route handling, database IO, frontend import, or persistence write.
- Random source is created once per ability-kit generation and reused through quality, archetype, active/passive/scout/civil ability rolls.

Extension Path:

- New skill random-result domains add a new action/scope here before changing skill generator services.
- Keep gameplay meaning in `SkillAbilityKitService` / `SkillAbilityFactory`; this adapter only owns random authority metadata.
- Do not reintroduce default `Math.random` in skill generator paths.

Regression:

- `node --test backend/tests/SkillGeneratorArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js`
- `npm run test:architecture`

### `backend/services/TerritoryService.js`

Status: candidate

Owns:

- legacy facade exports for territory modules while responsibilities continue moving into `backend/services/territory/*`
- cross-module wiring for conquest, scout, naming, state normalization, and client projection dependencies
- coordinate-authoritative conquest/battle tile snapshots: `getTerritoryBattleTileSnapshot()` derives output `tileId` from territory `x/y` and reads world-map terrain by `q/r`; stale or colliding world-map `tile.id` cannot override battle terrain facts

Public API:

- `TerritoryService.startConquest(gameState, territoryId, expeditionInput, now)`
- `TerritoryService.claimConquest(gameState, territoryId, now)`
- `TerritoryService.startScout(gameState, direction, now)`
- `TerritoryService.claimScout(gameState, missionId, now, randomSource)`
- `TerritoryService.getClientTerritoryState(gameState, now, projection)`
- legacy facade helpers listed in `TerritoryArchitecture.test.js`

Extension Path:

- New territory behavior should move into a focused `backend/services/territory/*` module with a TDD contract first.
- Keep facade-only helpers narrow and covered when they bridge two modules; do not reintroduce world-map lookup by raw `tile.id` when `q/r` coordinates exist.
- Do not put renderer visuals, frontend hit targets, or territory battle/conquest rules into this facade.

Regression:

- `node --test backend/tests/TerritoryArchitecture.test.js --test-name-pattern "battle tile snapshot terrain lookup"`
- `node --test backend/tests/TerritoryArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/territory/TerritoryCombatTargets.js`

Status: candidate

Owns:

- battle target and garrison normalization for territory combat/conquest callers
- coordinate-authoritative battle target tile identity: coordinate-bearing raw targets derive `tile.id` from `q/r`; stale `raw.tile.id` or `raw.tileId` cannot override target coordinates
- defender leader/garrison snapshot assembly for non-player, non-neutral sites

Public API:

- `createTerritoryCombatTargets(dependencies)`
- `normalizeBattleTarget(rawTarget, territory, now)`
- `normalizeGarrison(rawGarrison, territory, now)`

Extension Path:

- New battle-target facts add focused `TerritoryArchitecture` tests first.
- Map terrain choice stays in `WorldMapService`; conquest resolution stays in `TerritoryConquestMissions`.
- Do not let caller-supplied tile ids become combat target identity when coordinates are present.

Regression:

- `node --test backend/tests/TerritoryArchitecture.test.js --test-name-pattern "territory combat targets module"`
- `npm run test:architecture`

### `backend/services/territory/TerritoryMilitaryMissions.js`

Status: candidate

Owns:

- territory military/scout mission selectors, soldier availability calculation, and expedition allocation
- scout mission advancement, readiness updates, and active scout mission limit enforcement
- coordinate-authoritative legacy scout advancement writes: newly revealed route step `tileId`, reveal-area `tileId`, appended `revealedTileIds`, and `recordScoutTrail()` tile ids derive from `q/r`; stale stored route `tileId` or `WorldMapService.revealScoutArea()` tile `id` cannot override coordinates during advancement

Public API:

- `createTerritoryMilitaryMissions(dependencies)`
- `advanceScoutMission(gameState, mission, now, randomSource)`
- `allocateSoldiersForMission(gameState, requiredSoldiers)`
- `countActiveScoutMissions(gameState)`
- `countSoldiersOnMission(gameState, cityId)`
- `countTotalSoldiersOnMission(gameState)`
- `enforceScoutMissionLimit(gameState)`
- `getActiveMissionForTerritory(gameState, territoryId)`
- `getActiveScoutMission(gameState)`
- `getAvailableSoldiers(gameState)`
- `getAvailableSoldiersForCity(gameState, cityId)`
- `getCitySoldierEntries(gameState)`
- `getMissionKind(mission)`
- `getMissionSoldierAllocations(mission)`
- `getScoutMissions(gameState)`
- `getTotalSoldiers(gameState)`
- `updateMissionReadiness(gameState, now, randomSource)`

Extension Path:

- Keep scout route/reveal-area construction in `TerritoryScoutAreas`.
- Keep persisted mission-row shape normalization in `TerritoryStateNormalizer`.
- Keep scout outcome rolls and generated site/report payloads in `TerritoryScoutResults`.
- New scout advancement writes must add focused tests proving coordinate-derived tile identity before changing mission mutation or scout trail recording.

Regression:

- `node --test backend/tests/TerritoryArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/territory/TerritoryStateNormalizer.js`

Status: candidate

Owns:

- territory state normalization before territory runtime progression, client assembly, and persistence reuse
- territory/site migration normalization, polity normalization, scout reports, scout coordinates, scout state, and war mission normalization orchestration
- canonical tile identity for coordinate-bearing legacy territory scout mission fields: scout `route` steps and `revealArea` entries derive `tileId` from `q/r`, so stale stored `tileId` cannot override coordinates
- known-world bridge reveal batching and territory-to-world-map site binding coordination

Public API:

- `createTerritoryStateNormalizer(dependencies)`
- `normalizeTerritory(rawTerritory, now)`
- `normalizeTerritoryState(gameState, now, options)`
- `normalizeWarMissions(rawMissions)`
- `revealSolidKnownWorldTiles(gameState, now)`
- `syncScoutCoordinatesWithTerritories(gameState, now)`

Extension Path:

- New coordinate-bearing territory scout mission fields must be normalized here before progression or client projection consumes them.
- Do not clone or preserve raw `tileId` / `id` as authority when `q/r` or `x/y` coordinates are present.
- Keep scout result rolls and generated site payloads in `TerritoryScoutResults`; keep mission advancement in `TerritoryMilitaryMissions`.

Regression:

- `node --test backend/tests/TerritoryArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/territory/TerritoryScoutRecords.js`

Status: candidate

Owns:

- territory scout report normalization, scout coordinate records, and scout-area record normalization
- scout report tile snapshots and report reveal-area snapshots before client/state reuse
- coordinate-authoritative report identity: scout reports and reveal-area entries with `q/r` derive `tileId` and nested `tile.id` from coordinates; stale report `tileId`, nested tile `id`, or reveal-area `tileId` cannot override coordinate-bearing report facts

Public API:

- `createTerritoryScoutRecords(dependencies)`
- `getScoutAreaTileIds(mission)`
- `getScoutCoordinateRecord(gameState, x, y)`
- `normalizeScoutAreaRecords(rawAreas)`
- `normalizeScoutCoordinates(rawCoordinates)`
- `normalizeScoutReport(rawReport)`
- `normalizeScoutReportRevealArea(report)`
- `normalizeScoutReportTileSnapshot(report)`
- `normalizeScoutReports(rawReports)`
- `normalizeScoutState(rawState)`
- `upsertScoutAreaRecord(gameState, mission, result, options)`
- `upsertScoutCoordinateRecord(gameState, record)`

Extension Path:

- Keep scout mission advancement in `TerritoryMilitaryMissions`.
- Keep generated site/report text and outcome rolls in `TerritoryScoutResults`.
- New report fields that carry coordinates must normalize identity here before client assembly or persistence reuse.

Regression:

- `node --test backend/tests/TerritoryArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/territory/TerritoryScoutPlanner.js`

Status: candidate

Owns:

- controlled scout origin discovery from occupied territories and controlled world tiles
- scout frontier target scoring and route/reveal-area candidate evaluation
- coordinate-authoritative controlled tile fallback identity: when no territory/site id exists, fallback `cityId`/`territoryId` derives from `q/r`; stale world-map `tile.id` cannot become scout origin identity

Public API:

- `createTerritoryScoutPlanner(dependencies)`
- `getControlledScoutOrigins(gameState, fallbackOrigin)`
- `findNextCoordinate(gameState, direction, origin)`
- `findNextCoordinateFromOrigin(gameState, direction, origin, occupied, scouted, discovered, scoutedAreaTileIds)`
- `scoreScoutCandidateArea(gameState, direction, origin, distance, knownTileIds)`

Extension Path:

- New scout origin or frontier scoring rules add focused `TerritoryArchitecture` tests first.
- Mission creation stays in `TerritoryService.startScout`; route reveal math stays in `WorldMapService`.
- Preserve explicit territory/site ownership ids, but do not let raw world-map tile ids become fallback origin identity.

Regression:

- `node --test backend/tests/TerritoryArchitecture.test.js --test-name-pattern "territory scout planner module"`
- `npm run test:architecture`

### `backend/services/territory/TerritoryScoutResults.js`

状态 / Status: candidate

职责 / Owns:

- territory scout result decisions, reports, and generated site payloads
- scout outcome chance calculation using scout streak rules
- scout site coordinate scoring and terrain/distance weighting
- generated site template selection and report text
- first consumer of `ServerRandomAuthorityContract` for backend-authoritative scout outcome/template rolls
- coordinate-authoritative report generation: generated scout report reveal-area snapshots derive `tileId` from `q/r`; stale mission reveal-area `tileId` cannot leave this module as report facts
- coordinate-authoritative report tile snapshot terrain lookup: generated scout report map terrain reads world-map tiles by `q/r`, not by stale or colliding tile `id`

公开 API / Public API:

- `createTerritoryScoutResults(dependencies)`
- `rollScoutOutcome(gameState, randomSource, options)`
- `pickTemplateForScoutSite(options)`
- `pickWeightedTemplate(pool, terrain, distance, randomSource, options)`
- `createSiteFromScout(gameState, mission, now, randomSource)`
- `createEmptyScoutReport(gameState, mission, now, repeated)`
- `pickScoutSiteCoordinate(gameState, mission, now)`
- `recordScoutOutcome(gameState, outcome)`
- `recordDiscoveredSiteOwnership(gameState, owner)`

扩展方式 / Extension Path:

- New scout result tables/config should enter config registry modules first, then be consumed here through injected data.
- Random rolls must consume `ServerRandomAuthorityContract`; do not reintroduce default `Math.random` in this module.
- Keep map terrain selection in `WorldMapService` and battle target/garrison normalization in territory combat modules.

回归 / Regression:

- `node --test backend/tests/ServerRandomAuthorityContract.test.js backend/tests/TerritoryArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/taskDefinitions/TaskDefinitionNormalizer.js`

状态 / Status: candidate

职责 / Owns:

- task definition row/header normalization for JSON/xlsx import
- task condition/action/reward shape normalization
- task validation for required id/title, duplicate task id, condition/reward JSON, and reward formula errors
- legacy task definition output fields: `version`, `hash`, `tasks`, `errors`, `summary`
- task registry metadata/validation consumption through `ConfigRegistryContract`

公开 API / Public API:

- `TaskDefinitionNormalizer.HEADER_ALIASES`
- `TaskDefinitionNormalizer.CATEGORY_IDS`
- `TaskDefinitionNormalizer.RESOURCE_KEYS`
- `TaskDefinitionNormalizer.getHeaderValue(row, key)`
- `TaskDefinitionNormalizer.normalizeCategory(value)`
- `TaskDefinitionNormalizer.normalizeTask(rawTask, index)`
- `TaskDefinitionNormalizer.validateTasks(tasks)`
- `TaskDefinitionNormalizer.normalizeDefinitions(raw, options)`

扩展方式 / Extension Path:

- New task import fields first extend `HEADER_ALIASES`, normalizer helpers, and focused tests.
- Keep reward formula resolution in `TaskDefinitionRewardResolver`.
- Keep import file parsing in `TaskDefinitionImportParser`.
- Config version/hash rules stay in `ConfigRegistryContract`; this module only consumes registry metadata.

回归 / Regression:

- `node --test backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js backend/tests/ConfigRegistryContract.test.js`
- `npm run test:architecture`

### `backend/services/taskDefinitions/TaskDefinitionImportParser.js`

状态 / Status: candidate

负责 / Owns:

- task definition JSON import payload parsing
- task definition XLSX row extraction
- XLSX import safety limits for file size, worksheet count, row count, and column count
- XLSX formula and dangerous header rejection for the residual SheetJS audit risk
- sanitized row object creation before normalization

公开 API / Public API:

- `parseImportPayload(payload)`
- `parseJsonPayload(payload)`
- `rowsFromWorkbookBuffer(buffer)`
- `MAX_XLSX_BYTES`
- `MAX_XLSX_COLUMNS`
- `MAX_XLSX_ROWS`

扩展方式 / Extension Path:

- New import formats extend this parser and focused tests before touching `TaskDefinitionService`.
- Keep task field normalization in `TaskDefinitionNormalizer`.
- Keep XLSX residual-risk mitigation here while `xlsx` has no npm-audit fix available.
- Any relaxation of file size, row, column, formula, or dangerous-key limits must update security docs and tests in the same change.

回归 / Regression:

- `node --test backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js`
- `npm run security:audit`
- `npm run test:architecture`

### `backend/config/BuildingConfig.js`

状态 / Status: candidate

职责 / Owns:

- readonly building config accessors backed by `shared/buildingConfig.json`
- build cost, upgrade cost, max-level, open-ended scale, maintenance, and preview helpers
- effect bonus calculation for configured per-level building effects
- building config registry metadata/validation consumption through `ConfigRegistryContract`

公开 API / Public API:

- `BuildingConfig.raw()`
- `BuildingConfig.getVersion()`
- `BuildingConfig.getSourcePath()`
- `BuildingConfig.getRegistryMetadata()`
- `BuildingConfig.validateRegistry()`
- `BuildingConfig.getAllBuildings()`
- `BuildingConfig.getBuilding(buildingId)`
- `BuildingConfig.hasBuilding(buildingId)`
- `BuildingConfig.getBuildCost(buildingId)`
- `BuildingConfig.getUpgradeCost(buildingId, currentLevel)`
- `BuildingConfig.getMaxLevel(buildingId)`
- `BuildingConfig.canUpgrade(buildingId, currentLevel)`
- `BuildingConfig.calculateEffectBonus(buildingId, field, level)`
- `BuildingConfig.getScalePlan(buildingId)`
- `BuildingConfig.getMaintenancePolicy()`
- `BuildingConfig.getMaintenance(buildingId)`
- `BuildingConfig.isMaintenanceActive()`
- `BuildingConfig.getMaintenancePreview(buildingId)`
- `BuildingConfig.getScalePlanPreview(buildingId)`

性能约束 / Performance Constraints:

- Accessors are synchronous readonly lookups over already-loaded JSON.
- Cost/effect helpers clone only small public return payloads.
- Registry validation scans building definitions linearly and does not mutate config.

扩展方式 / Extension Path:

- New building data fields are added to `shared/buildingConfig.json` and then exposed through narrow accessors/tests here.
- New config registry/version behavior extends `ConfigRegistryContract`, not this module.
- Do not add database writes, route handling, renderer behavior, or task reward resolution here.

回归 / Regression:

- `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js`
- `npm run test:architecture`

### `backend/config/GameConfig.js`

Status: candidate

Owns:

- backend resource and population tuning config
- readonly `resources` and `population` compatibility exports
- config registry metadata/validation consumption through `ConfigRegistryContract`

Public API:

- `GameConfig.resources`
- `GameConfig.population`
- `GameConfig.raw()`
- `GameConfig.getVersion()`
- `GameConfig.getSourcePath()`
- `GameConfig.getRegistryMetadata()`
- `GameConfig.validateRegistry()`

Performance Constraints:

- Synchronous readonly access over small in-memory config objects.
- Registry validation scans two compact entries and hashes compact config content.

Extension Path:

- New resource/population tuning fields extend the config object and then focused service tests.
- Registry/version behavior stays in `ConfigRegistryContract`.
- Do not add runtime state mutation, database writes, routes, or renderer behavior here.

Regression:

- `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/GameStateServiceSplit.test.js`
- `npm run test:architecture`

### `backend/config/EraConfig.js`

Status: candidate

Owns:

- era names, descriptions, building unlocks, and advancement requirements
- readonly era query helpers
- config registry metadata/validation consumption through `ConfigRegistryContract`

Public API:

- `EraConfig.ERA_NAMES`
- `EraConfig.ERA_DESCRIPTIONS`
- `EraConfig.ERA_BUILDING_UNLOCKS`
- `EraConfig.ERA_ADVANCEMENT`
- `EraConfig.raw()`
- `EraConfig.getVersion()`
- `EraConfig.getSourcePath()`
- `EraConfig.getRegistryMetadata()`
- `EraConfig.validateRegistry()`
- `EraConfig.getEraName(era)`
- `EraConfig.getEraDescription(era)`
- `EraConfig.getAdvanceConfig(currentEra)`

Performance Constraints:

- Era lookups are O(1) by numeric era id.
- Registry validation scans the small era list and does not mutate config.

Extension Path:

- New era requirements or unlocks are added here and covered by advancement/task/tutorial tests.
- Registry/version behavior stays in `ConfigRegistryContract`.
- Do not add resource deduction, city mutation, route handling, or UI text rendering here.

Regression:

- `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionService.test.js`
- `npm run test:architecture`

### `backend/config/TutorialFlowConfig.js`

Status: candidate

Owns:

- backend tutorial step constants, event-step mapping, pass-through actions, and client step gates
- phase-completion summary helper
- config registry metadata/validation consumption through `ConfigRegistryContract`

Public API:

- `TutorialFlowConfig.TUTORIAL_STEPS`
- `TutorialFlowConfig.TUTORIAL_EVENT_STEPS`
- `TutorialFlowConfig.PASS_THROUGH_ACTIONS`
- `TutorialFlowConfig.CLIENT_TUTORIAL_STEP_GATES`
- `TutorialFlowConfig.raw()`
- `TutorialFlowConfig.getVersion()`
- `TutorialFlowConfig.getSourcePath()`
- `TutorialFlowConfig.getRegistryMetadata()`
- `TutorialFlowConfig.validateRegistry()`
- `TutorialFlowConfig.createPhaseCompleted(currentStep)`

Performance Constraints:

- Step/gate lookups use frozen in-memory constants.
- Registry validation builds compact step/action/gate entries only.

Extension Path:

- New tutorial steps update constants, event mapping/gates, tutorial services, frontend guide policy, and screenshot playtest expectations together.
- Registry/version behavior stays in `ConfigRegistryContract`.
- Do not add Canvas hit-target resolution or frontend highlight logic here.

Regression:

- `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/TutorialArchitecture.test.js backend/tests/TutorialProgressService.test.js`
- `npm run test:architecture`

### `backend/config/BattleConfig.js`

Status: candidate

Owns:

- battle rule constants, fallback leader/skills, battle-map assets, and defender profile config
- readonly battle config accessors
- config registry metadata/validation consumption through `ConfigRegistryContract`

Public API:

- `BattleConfig.DEFAULT_SOLDIER_SCALE`
- `BattleConfig.MIN_BATTLE_SOLDIERS`
- `BattleConfig.MAX_BATTLE_ROUNDS`
- `BattleConfig.BATTLE_SYSTEM`
- `BattleConfig.MORALE_EFFECT_ENABLED`
- `BattleConfig.SKILL_RULES`
- `BattleConfig.getBattleRules()`
- `BattleConfig.getFallbackLeader()`
- `BattleConfig.getFallbackSkill(role)`
- `BattleConfig.getBattleMapForType(type)`
- `BattleConfig.getBattleStageForType(type)`
- `BattleConfig.getDefenderProfileForOwner(owner, territoryName)`
- `BattleConfig.raw()`
- `BattleConfig.getVersion()`
- `BattleConfig.getSourcePath()`
- `BattleConfig.getRegistryMetadata()`
- `BattleConfig.validateRegistry()`

Performance Constraints:

- Accessors clone only small public payloads.
- Registry validation hashes compact config, not battle runtime reports or unit state.

Extension Path:

- New battle config values enter this module first, then battle service/runtime tests.
- Random battle rewards or drops must use `ServerRandomAuthorityContract` through a domain adapter before being consumed here.
- Do not add battle simulation, report generation, route handling, or persistence writes here.

Regression:

- `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/BattleArchitecture.test.js`
- `npm run test:architecture`

### `backend/config/TechTreeConfig.js`

Status: candidate

Owns:

- tech point grants, choice limits, labels, era tech data, route metadata, layout metadata, and tech id index
- tech tree metadata helper
- config registry metadata/validation consumption through `ConfigRegistryContract`

Public API:

- `TechTreeConfig.TECH_POINT_GRANTS`
- `TechTreeConfig.TECH_CHOICE_LIMITS`
- `TechTreeConfig.RESOURCE_LABELS`
- `TechTreeConfig.BUILDING_LABELS`
- `TechTreeConfig.TECH_ERAS`
- `TechTreeConfig.TECH_ROUTE_META`
- `TechTreeConfig.TECH_TREE_LAYOUT`
- `TechTreeConfig.TECHS`
- `TechTreeConfig.TECH_BY_ID`
- `TechTreeConfig.raw()`
- `TechTreeConfig.getVersion()`
- `TechTreeConfig.getSourcePath()`
- `TechTreeConfig.getRegistryMetadata()`
- `TechTreeConfig.validateRegistry()`

Performance Constraints:

- `TECH_BY_ID` is built once at module load for O(1) tech lookup.
- Registry validation scans the flat `TECHS` array and does not clone runtime research state.

Extension Path:

- New tech rows extend `TECH_ERAS`/`TECH_TREE_LAYOUT`, then service and presenter tests.
- Registry/version behavior stays in `ConfigRegistryContract`.
- Do not add research mutation, resource spending, renderer layout drawing, or persistence writes here.

Regression:

- `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/GameRoutesTutorial.test.js`
- `npm run test:architecture`

### `backend/services/CityService.js`

Status: candidate

Owns:

- City normalization, active/capital city lookup, city-derived stats, active-city legacy field sync, and city client DTO projection.
- `getClientCityState()` remains the compatibility API that normalizes before projection.
- `getClientCityStateFromNormalized()` is the read-only projection API for already-normalized game state.

Public API:

- `CityService.normalizeCities(gameState, now)`
- `CityService.getActiveCity(gameState)`
- `CityService.getCapitalCity(gameState)`
- `CityService.getClientCityState(gameState)`
- `CityService.getClientCityStateFromNormalized(gameState)`

Extension Path:

- New DTO-only city fields go through `getClientCityStateFromNormalized()` and must not trigger city normalization or derived-stat writes.
- New city mutation or runtime refresh stays in `normalizeCities()`, `advanceAllCities()`, or focused city services.

Regression:

- `node --test backend/tests/GameStateProjectionArchitecture.test.js backend/tests/GameStateServiceSplit.test.js`
- `npm run test:architecture`

### `backend/services/TechTreeService.js`

Status: candidate

Owns:

- Tech state normalization, era point grants, research mutation, unlock queries, and tech client DTO projection.
- `getClientState()` remains the compatibility API that normalizes `gameState.techs` before projection.
- `getClientStateFromNormalized()` is read-only projection from an already-normalized tech state.

Public API:

- `TechTreeService.normalizeTechState(raw)`
- `TechTreeService.normalizeGameStateTechs(gameState)`
- `TechTreeService.getClientState(gameState)`
- `TechTreeService.getClientStateFromNormalized(gameState)`
- `TechTreeService.research(gameState, techId)`

Extension Path:

- New tech DTO fields go through `getClientStateFromNormalized()` first.
- Research mutation, point spending, and grant writes remain in service mutation APIs, not client projection.

Regression:

- `node --test backend/tests/GameStateProjectionArchitecture.test.js backend/tests/GameActionRegistry.test.js`
- `npm run test:architecture`

### `backend/services/TalentPolicyService.js`

Status: candidate

Owns:

- backend talent-policy state normalization, draft policy creation, preview allocation, apply/save/delete behavior
- system policy and custom policy compatibility payloads
- custom policy id creation through backend crypto-backed entropy
- tutorial completion side effects for talent-policy milestones

Public API:

- `TalentPolicyService.DEFAULT_TIERS`
- `TalentPolicyService.ROLE_DEFINITIONS`
- `TalentPolicyService.TENDENCY_DEFINITIONS`
- `TalentPolicyService.SYSTEM_POLICIES`
- `TalentPolicyService.createInitialTalentPolicyState()`
- `TalentPolicyService.normalizeTalentPolicyState(raw)`
- `TalentPolicyService.normalizeTiers(raw)`
- `TalentPolicyService.makeCustomPolicyName(basePolicyId)`
- `TalentPolicyService.createCustomPolicyId(now, randomBytes)`
- `TalentPolicyService.getClientState(gameState)`
- `TalentPolicyService.getClientStateFromNormalized(gameState)`
- `TalentPolicyService.buildAllocationPreview(gameState, policy)`
- `TalentPolicyService.buildAllocationPreviewFromNormalized(gameState, policy, activeCity)`
- `TalentPolicyService.getPolicyById(gameState, policyId)`
- `TalentPolicyService.getPolicyByIdFromState(state, policyId)`
- `TalentPolicyService.applyPolicy(gameState, payload)`
- `TalentPolicyService.saveCustomPolicy(gameState, payload)`
- `TalentPolicyService.deleteCustomPolicy(gameState, payload)`

Performance Constraints:

- Policy allocation is bounded by role/tendency count and city population fields, not by world-map size.
- Custom policy id entropy is O(1) backend crypto metadata; no gameplay state clone or frontend-provided randomness.
- Normalized-only projection must not call `CityService.normalizeCities()` or mutate `talentPolicies`; it reads the already-normalized active city and policy state.

Extension Path:

- New policy formulas extend policy definitions and focused service tests.
- New probability-based policy outcomes must first declare a random authority adapter through `ServerRandomAuthorityContract`.
- Do not reintroduce `Math.random`, renderer logic, route handling, or database writes here.

Regression:

- `node --test backend/tests/TalentPolicyService.test.js`
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
- 结构归一化 / structural normalization: 补齐资源、人口、科技、教程、城市、名人、任务、world map shell、explore mission shape 等兼容字段
- 显式 runtime 推进 / explicit runtime advancement: `advanceRuntimeState()` 负责调用探索推进、AI reveal sync、领土 runtime normalization 和城市 runtime refresh
- 保留旧接口 `createInitialGameState()` / `normalizeState()`，其中 `normalizeState()` 是结构归一化入口，不再推进世界时间线

公开 API / Public API:

- `GameStateNormalizer.createInitialGameState(playerId)`
- `GameStateNormalizer.normalizeState(rawState)`
- `GameStateNormalizer.normalizeStateStructure(rawState)`
- `GameStateNormalizer.advanceRuntimeState(gameState, now)`

扩展方式 / Extension Path:

- 存档 schema 变更先进入 `GameStateMigrationPipeline`。
- 新业务结构兼容优先进入对应 domain/service structural normalizer，本文件只做 orchestration。
- 新的时间推进、AI、地图 reveal、任务 readiness、领土 bridging 不得塞回 `normalizeState()`；必须挂到显式 runtime advancement 入口或更下游的专责 runtime service。
- DTO/projection、era progress、task center、reset response 不得调用会推进世界的入口。
- 不要在这里加入 DB、route、renderer、网络调用。

回归 / Regression:

- `node --test backend/tests/GameStateServiceSplit.test.js backend/tests/GameStateProjectionArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/GameStateService.js`

状态 / Status: candidate facade

负责 / Owns:

- Game state facade over structural normalization, runtime advancement, projection, era progress, and offline income compatibility.
- `normalizeState()` remains structural-only; `advanceRuntimeState()` is the explicit world/runtime advancement boundary.
- Raw compatibility APIs remain for legacy callers, while normalized-only APIs protect route response assembly from repeated runtime advancement.
-普通 query route 使用 `normalizeState()` + normalized-only projection；写入型 command/tick route 才使用 `applyOnlineProgress()` / `advanceRuntimeState()` 并保存。
- Projection context is explicit. Route code that needs shared-world read visibility must call `GameStateRepository.getClientProjectionForPlayer(playerId)` and pass the returned context into client DTO assembly; it must not mutate canonical state.

公开 API / Public API:

- `GameStateService.createInitialGameState(playerId)`
- `GameStateService.normalizeState(rawState)`
- `GameStateService.advanceRuntimeState(gameState, now)`
- `GameStateService.getClientGameState(gameState, projection = {})`
- `GameStateService.getClientGameStateFromNormalized(gameState, projection = {})`
- `GameStateService.calculateEraProgress(gameState)`
- `GameStateService.calculateEraProgressFromNormalized(gameState)`
- `GameStateService.applyOnlineProgress(gameState, now)`
- `GameStateService.calculateOfflineIncome(gameState, offlineSeconds)`

扩展方式 / Extension Path:

- New request paths that already loaded/advanced canonical state must use `getClientGameStateFromNormalized()` and `calculateEraProgressFromNormalized()`.
- New request paths that need derived read visibility must pass projection context as the second argument to `getClientGameStateFromNormalized()`.
- New world-time advancement belongs behind `advanceRuntimeState()` or a focused runtime service called by it.
- Do not let DTO/projection helpers call world AI, territory runtime, map reveal, DB, or route code.
- New GET/query routes must not call `applyOnlineProgress()`, generate events, touch player activity, or save state unless they are explicitly changed into command/sync endpoints.

回归 / Regression:

- `node --test backend/tests/GameStateServiceSplit.test.js backend/tests/GameStateProjectionArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/ClientGameStateAssembler.js`

状态 / Status: candidate

负责 / Owns:

- Client game-state DTO projection from an already-normalized game state.
- Raw compatibility wrapper `getClientGameState()` for older callers.
- Normalized-only projection `getClientGameStateFromNormalized()` for route responses and reset/action payloads.
- Explicit projection context for derived read models such as shared-world territory visibility.
- Delegates to normalized-only downstream DTO helpers for city, talent policy, famous person, tech, territory, world-map, and world-explorer state.

公开 API / Public API:

- `getClientGameState(gameState, projection = {})`
- `getClientGameStateFromNormalized(gameState, projection = {})`
- `getBuildingCosts(buildings)`
- `getBuildingDefinitions()`
- `getBuildingCategories()`

扩展方式 / Extension Path:

- Add new client DTO fields here only as read-only projection from normalized canonical state.
- Projection-only fields must come from the explicit `projection` argument, not from ad hoc fields attached to `gameState`.
- Do not call runtime advancement, world AI, territory normalization, explorer progression, mission readiness, map reveal, DB, network, or route code from normalized-only projection.
- If a downstream service still only exposes a mutating compatibility projection, add a normalized-only helper there first before wiring it into this assembler.

回归 / Regression:

- `node --test backend/tests/GameStateServiceSplit.test.js backend/tests/GameStateProjectionArchitecture.test.js`
- `npm run test:architecture`

### `backend/repositories/GameStateRepository.js`

状态 / Status: candidate

负责 / Owns:

- SQLite `game_states` 表结构初始化和向后兼容列补齐
- 保存/读取游戏状态持久化字段
- 持久化 `saveMetadata`，保证迁移幂等
- 持久化最新存档性能容量预算摘要到 `saveMetadata.performanceCapacity`
- 持久化 `revision` 乐观版本号，并在 `saveAtomic()` 中递增
- 主状态行和 `shared_world_territories` 派生占有记录同事务提交
- `findByPlayerId()` returns canonical persisted state only and must not carry client/read projection fields such as `sharedWorldTerritories`
- `getClientProjectionForPlayer(playerId)` exposes derived read visibility such as shared-world territories for route DTO assembly
- `save()` / `saveAtomic()` strip projection-only fields before writing canonical state
- 委托 `WorldMapAuthorityRepository` 提交全局世界地图和玩家可见性，并在保存时清空 `game_states.worldMap.tiles`
- reset 时通过 `resetPlayerState()` 同事务清理玩家共享世界占有记录并写入新状态
- 不执行业务 normalizer 和 gameplay 规则

公开 API / Public API:

- `new GameStateRepository(db)`
- `init()`
- `findByPlayerId(playerId)`
- `getClientProjectionForPlayer(playerId)`
- `findAll()`
- `findRecentlyActive(activeSinceIso, limit)`
- `save(gameState)`
- `saveAtomic(gameState, options)`
- `resetPlayerState(playerId, gameState)`
- `touchPlayerActiveAt(playerId)`
- `getPlayerActivitySummary(options)`

扩展方式 / Extension Path:

- 新持久化字段先增加列迁移、读写 JSON 解析、repository tests。
- 需要写状态时优先调用 `save()` / `saveAtomic()`，不要绕过 repository 单独写 `game_states` 或 `shared_world_territories`。
- Do not reintroduce DTO/read projection fields into canonical repository reads. Add a dedicated projection method and route-level composition instead.
- 世界地图主体不得回到 `game_states.worldMap.tiles`；新增世界地图持久化语义必须在 `WorldMapAuthorityRepository` 增加 focused tests。
- destructive reset 必须走 `resetPlayerState()` 或等价 transaction，避免共享世界残留旧占有记录。
- 存档 shape 迁移逻辑放在 `GameStateMigrationPipeline`，不要放进 repository。
- 存档容量预算规则放在 `PerformanceCapacityBudget`，repository 只写入摘要，不承载容量规则。
- repository 返回 raw persisted state，由 service/normalizer 决定如何升级和派生。

回归 / Regression:

- `node --test backend/tests/GameStateRepository.test.js`
- `node --test backend/tests/GameStateProjectionArchitecture.test.js backend/tests/TerritoryClientAssembler.test.js`
- `node --test backend/tests/OpsControlService.test.js`
- `npm run test:architecture`

### `backend/repositories/WorldMapAuthorityRepository.js`

Status: candidate

Owns:

- authoritative global world-map persistence for materialized terrain
- `global_world_chunks` and `global_world_tiles` schema, indexed by canonical tile/chunk identity
- `player_world_visibility` schema for per-player visibility, discovered/scouted timestamps, and intel
- first-writer-wins terrain commits for real explored/revealed tiles
- hydration of player-visible `worldMap.tiles` from global authority plus visibility rows
- sanitizing player saves so `game_states.worldMap.tiles` stays empty on disk
- one-time legacy migration from old per-player visible tiles into authority tables

Public API:

- `new WorldMapAuthorityRepository(db, options)`
- `init()`
- `commitWorldMapForPlayer(gameState, nowIso)`
- `hydrateWorldMapForPlayer(playerId, worldMap)`
- `sanitizeWorldMapForSave(worldMap)`
- `migrateLegacyPlayerWorldMaps()`
- helper exports: `getCanonicalId(tile)`, `isPlayerVisibleTile(tile)`, `createGlobalTilePayload(tile)`, `createPlayerTile(globalTile, visibilityRow)`

Performance Constraints:

- Player save payload must not scale with hidden/global world size.
- Hidden or unknown legacy per-player tiles are discarded from player visibility and are not promoted to global authority.
- Hydration is bounded by `player_world_visibility` rows for one player, not by scanning all global tiles.

Extension Path:

- New world persistence semantics extend this repository with focused repository tests.
- Future distributed/chunk services may replace these tables behind the same authority/visibility contract.
- Do not put terrain generation rules here; generation belongs in `WorldMapTiles` / `WorldMapGenerationAuthority` and the first-explorer context comes from explorer services.

Regression:

- `node --test backend/tests/GameStateRepository.test.js backend/tests/WorldMapArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/VersionService.js`

Status: candidate

璐熻矗 / Owns:

- backend deployment version DTO for `/api/version` and `/api/health`
- package version, git commit, source hash, deploy manifest metadata, deployment id, ETag, and checked timestamp calculation
- source fingerprinting for `frontend`, `backend`, and `shared`
- runtime-artifact filtering for `.git`, `.local-logs`, `node_modules`, logs, data folders, `.env`, database files, SQLite runtime files, backups, and logs
- optional deployment manifest lookup from `WXGAME_DEPLOY_MANIFEST_PATH`, `.wxgame/current-deploy.json`, or `.wxgame-deploy-version.json`
- cached version calculation so frequent update polling does not scan the workspace every request

Public API:

- `new VersionService(options)`
- `VersionService.getVersionInfo()`
- `VersionService.matchesEtag(candidate, info)`

Performance Constraints:

- Source scan is cached by `cacheMs`.
- File hashing is limited to source directories and ignores runtime data.
- No repository write, API route dependency, renderer import, DOM, or frontend state.

Extension Path:

- New runtime artifact patterns must be added to the ignore lists with `VersionService.test.js` coverage.
- New deployment metadata fields must be derived from deploy manifest input here and covered by `VersionService.test.js`.
- Deployment identity semantics stay here; config registry schema/version hardening belongs to P11-006 modules.
- Do not make local database writes, screenshots, logs, or playtest evidence change `deploymentId`.

Regression:

- `node --test backend/tests/VersionService.test.js`
- `npm run test:architecture`

### `backend/services/DatabaseRuntime.js`

Status: candidate

Owns:

- SQLite runtime opening/configuration for backend soft services
- consistent `better-sqlite3` constructor timeout and `PRAGMA busy_timeout`
- WAL journal mode and `synchronous=NORMAL` defaults for the single-host gateway plus world-worker topology
- bounded env parsing for `SQLITE_BUSY_TIMEOUT_MS`, `SQLITE_JOURNAL_MODE`, and `SQLITE_SYNCHRONOUS`

Public API:

- `openDatabase(Database, dbPath, options)`
- `configureDatabase(db, options)`
- `resolveBusyTimeoutMs(env)`

Extension Path:

- Every backend process that opens `civilization.db` must use `openDatabase()`.
- Future shard, region-worker, backup-reader, or ops-side DB readers should extend this boundary rather than calling `new Database(...)` directly.
- If the runtime store moves away from SQLite, keep this module as the adapter boundary and update focused tests before touching gateway/worker code.

Regression:

- `node --test backend/tests/DatabaseRuntime.test.js`
- `npm run test:architecture`

### `backend/services/ObservabilityService.js`

状态 / Status: candidate

负责 / Owns:

- process-local backend observability snapshot for the current runtime
- bounded recent API event window
- bounded recent frontend client event window
- total/recent request counts, status counts, per-path request/failure/action-failure stats
- total/recent client event counts and event type counts
- latency summary, including average, p95, max duration, and slow request counts
- performance budget summaries and `PERFORMANCE_BUDGET_EXCEEDED` alert counts from `PerformanceCapacityBudget`
- threshold alert codes for recent 5xx rate, slow requests, action failures, frontend load failures, last server error, and last frontend load failure
- compact health summary consumed by `/api/health`

公开 API / Public API:

- `new ObservabilityService(options)`
- `recordApiRequest(input)`
- `recordClientEvent(input)`
- `getSnapshot(options)`
- `getHealthSummary()`

扩展方式 / Extension Path:

- New backend observability dimensions should be recorded here from route/middleware boundaries, not mixed into gameplay services.
- Durable metrics, exporters, and real alert delivery should extend this service or a sibling adapter while keeping the current in-memory snapshot cheap and testable.
- Frontend asset/load failure ingest enters through `backend/routes/clientEventsRoutes.js`; new client event types must be allowlisted at the route boundary and normalized before they enter snapshots.
- Hot-path route sampling must be an explicit policy change with focused tests; current server wiring skips very hot/read-only routes from API log/metrics middleware.

回归 / Regression:

- `node --test backend/tests/ObservabilityService.test.js`
- `npm run test:architecture`

### `backend/services/OpsAuthService.js`

鐘舵€?/ Status: candidate

鑱岃矗 / Owns:

- independent ops-admin credential validation
- `/api/admin/ops/login` session token issuance
- ops JWT purpose validation so player tokens cannot cross into the ops boundary
- ops session-version claim validation for token rotation through `OPS_SESSION_VERSION`
- failed-login rate limiting through `OPS_LOGIN_MAX_ATTEMPTS` and `OPS_LOGIN_WINDOW_MS`
- production weak secret/plaintext password rejection
- production ops auth configuration status from `OPS_ADMIN_USERNAME`, `OPS_ADMIN_PASSWORD_HASH`, `OPS_JWT_SECRET`, `OPS_SESSION_TTL`, and `OPS_SESSION_VERSION`

鍏紑 API / Public API:

- `new OpsAuthService(options)`
- `login(input)`
- `authMiddleware(req, res, next)`
- `getConfigStatus()`
- `resolveOpsAuthConfig(env)`

鎵╁睍鏂瑰紡 / Extension Path:

- Future RBAC should extend this service or a sibling role service; do not reintroduce player login tokens for ops routes.
- Production password storage should prefer bcrypt hashes and avoid plaintext environment values except explicit emergency overrides.
- Token payloads must keep an explicit ops-only purpose claim.
- Secret rotation should bump `OPS_SESSION_VERSION` so old ops tokens become invalid.
- Login failure policy changes must keep `backend/tests/OpsAuthService.test.js` and `backend/tests/OpsRoutes.test.js` coverage.

鍥炲綊 / Regression:

- `node --test backend/tests/OpsAuthService.test.js`
- `node --test backend/tests/OpsRoutes.test.js backend/tests/OpsAuthService.test.js`
- `npm run test:architecture`

### `backend/services/OpsControlService.js`

状态 / Status: candidate

职责 / Owns:

- P12-009 admin operations dashboard aggregation
- maintenance state persistence under deploy-state ops data
- ops audit log records for maintenance changes and PM2 restart requests
- system, disk, process, PM2, deploy, local-process health, optional `OPS_HEALTH_URL` external probe, config runtime, observability, player activity, and log snapshots
- delayed PM2 restart command execution through an explicit audited service method
- no login/admin authorization ownership, no gameplay state mutation, no hard process start ownership after backend shutdown

公开 API / Public API:

- `new OpsControlService(options)`
- `getDashboard(options)`
- `getMaintenanceState()`
- `setMaintenanceState(input, options)`
- `getAuditLog(options)`
- `getSystemSummary()`
- `getPm2Summary()`
- `getDeploySummary()`
- `getHealthSummary()`
- `getConfigRuntimeSummary()`
- `getLogSummary(options)`
- `restartService(options)`

扩展方式 / Extension Path:

- New ops dashboard fields should be gathered here and exposed through thin route/UI layers.
- Dashboard health should stay local-process by default; do not reintroduce a synchronous self-curl to `/api/health`.
- Hard stop/start belongs to `backend/ops-agent`, not to this stopped-backend dashboard service.
- Production path changes must keep ops state under backed-up deploy-state scope or update backup/restore/runbook docs in the same change.

回归 / Regression:

- `node --test backend/tests/OpsControlService.test.js`
- `npm run test:architecture`

### `backend/ops-agent/OpsAgentService.js`

状态 / Status: candidate

职责 / Owns:

- independent P12-009 host control-plane service logic for hard stop/start/restart
- fixed PM2 target app resolution through `OPS_AGENT_PM2_APP` / `PM2_APP_NAME`, defaulting to `server`
- PM2 status snapshots, system summary, and agent audit log records
- safe PM2 command construction for `start`, `stop`, and `restart` only
- no arbitrary shell command ownership, no gameplay/backend route ownership, no player-token ownership

公开 API / Public API:

- `new OpsAgentService(options)`
- `getHealth()`
- `getStatus(options)`
- `startService(options)`
- `stopService(options)`
- `restartService(options)`
- `getAuditLog(options)`

扩展方式 / Extension Path:

- Add new host actions only as explicit allowlisted methods with fixed arguments and audit records.
- Keep the target app pinned to one configured name; do not accept app names from HTTP request payloads.
- Keep agent state under deploy-state backup scope or document backup/runbook changes in the same patch.

回归 / Regression:

- `node --test backend/tests/OpsAgentService.test.js`
- `npm run test:architecture`

### `backend/ops-agent/OpsAgentHttpServer.js`

状态 / Status: candidate

职责 / Owns:

- independent Node HTTP boundary for the ops-agent process
- `/health`, `/login`, `/status`, `/pm2/start`, `/pm2/stop`, and `/pm2/restart`
- Bearer-token enforcement through `OpsAuthService` on protected agent routes
- route allowlist that rejects arbitrary PM2/control paths
- optional `OPS_AGENT_CORS_ORIGINS` headers for non-same-origin diagnostics

公开 API / Public API:

- `createOpsAgentHttpServer(options)`
- `createOpsAgentRequestHandler(options)`
- `parsePort(value, fallback)`
- `resolveBindHost(env)`
- `resolveCorsOrigins(env)`

扩展方式 / Extension Path:

- Keep host control endpoints small wrappers over `OpsAgentService`.
- New write endpoints must authenticate with ops-admin JWT and append audit evidence.
- Default binding should remain localhost-only; public exposure should happen through an authenticated reverse proxy.

回归 / Regression:

- `node --test backend/tests/OpsAgentHttpServer.test.js backend/tests/OpsAgentService.test.js backend/tests/OpsAuthService.test.js`
- `npm run test:architecture`

### `backend/ops-agent/server.js`

状态 / Status: candidate

职责 / Owns:

- PM2 entrypoint for the independent ops-agent process
- loading backend `.env` before constructing `OpsAuthService`
- resolving `OPS_AGENT_BIND_HOST` and `OPS_AGENT_PORT`
- logging agent listen target and auth configuration warning

公开 API / Public API:

- `node backend/ops-agent/server.js`
- `startOpsAgent(env)`

扩展方式 / Extension Path:

- Keep runtime setup minimal and leave command logic in `OpsAgentService`.
- Host install/update behavior belongs in `scripts/install-ops-agent-pm2.sh` and `deploy.sh`.

回归 / Regression:

- `node --check backend/ops-agent/server.js`
- `npm run test:architecture`

### `backend/world-worker.js`

Status: candidate

Owns:

- PM2 entrypoint for the local world runtime soft-service
- construction of `WorldWorkerService` with production repository, game-state, city, territory, and event services
- graceful stop and SQLite close on process signals
- no HTTP route ownership and no gateway request handling

Public API:

- `node backend/world-worker.js`
- PM2 app name: `wxgame-world-worker`

Extension Path:

- Deployments may run multiple future region workers, but the gateway must continue treating them as external worker processes.
- Environment tuning belongs to `WORLD_WORKER_INTERVAL_MS`, `WORLD_WORKER_ACTIVE_WINDOW_MS`, `WORLD_WORKER_ACTIVE_LIMIT`, and `WORLD_WORKER_SLOW_TICK_MS`.

Regression:

- `node --check backend/world-worker.js`
- `npm run test:architecture`

### `backend/services/PerformanceCapacityBudget.js`

状态 / Status: candidate

负责 / Owns:

- backend runtime performance/capacity budget checks
- API/action latency budget reports
- request/response body size budget reports
- save-state serializable size, world-map tile count, and mission count budget reports
- world-map window/chunk capacity budget reports
- compact report shape shared by observability and save metadata

公开 API / Public API:

- `PerformanceCapacityBudget.DEFAULT_BUDGETS`
- `PerformanceCapacityBudget.checkApiRequest(input, budgets)`
- `PerformanceCapacityBudget.checkSaveState(state, budgets)`
- `PerformanceCapacityBudget.checkWorldMapWindow(input, budgets)`
- `PerformanceCapacityBudget.combineReports(reports, meta)`
- `PerformanceCapacityBudget.assertReport(report, message)`
- `PerformanceCapacityBudget.summarizeReport(report)`
- `PerformanceCapacityBudget.getSerializableSizeBytes(value)`

扩展方式 / Extension Path:

- New backend capacity dimensions should add a pure check here first, then connect to observability or repository metadata.
- Keep this module side-effect free; deploy-blocking behavior should be an explicit caller policy, not hidden inside budget calculation.
- Production threshold changes should be accompanied by sampled evidence or a capacity drill note in the P12 roadmap.

回归 / Regression:

- `node --test backend/tests/PerformanceCapacityBudget.test.js`
- `npm run test:architecture`

### `backend/routes/clientEventsRoutes.js`

状态 / Status: candidate

负责 / Owns:

- unauthenticated `POST /api/client-events` route registration for early-boot frontend telemetry
- allowlisting frontend client event types before they enter observability
- attaching request user-agent metadata when the client payload omits it
- keeping client telemetry HTTP response shape outside `server.js`

公开 API / Public API:

- `registerClientEventsRoutes(app, { observabilityService })`

扩展方式 / Extension Path:

- New frontend telemetry kinds must be explicitly allowlisted and covered by `ClientEventsRoutes.test.js`.
- This route accepts best-effort client telemetry only; gameplay state and auth decisions must not depend on it.
- Persistent metrics/exporters should consume normalized `ObservabilityService` data or a sibling adapter, not add durable storage concerns here.

回归 / Regression:

- `node --test backend/tests/ClientEventsRoutes.test.js backend/tests/ObservabilityService.test.js`
- `npm run test:architecture`

### `backend/routes/metricsRoutes.js`

状态 / Status: candidate

负责 / Owns:

- authenticated/admin `/api/metrics` route registration
- query parsing for snapshot limits
- keeping metrics HTTP response shape outside `server.js`

公开 API / Public API:

- `registerMetricsRoutes(app, { authMiddleware, adminMiddleware, observabilityService })`

扩展方式 / Extension Path:

- New metrics response fields should come from `ObservabilityService` or a metrics adapter, while this route remains the HTTP boundary.
- Access control stays auth + admin; future RBAC changes should extend `adminMiddleware` or a role service instead of weakening this route.

回归 / Regression:

- `node --test backend/tests/MetricsRoutes.test.js`
- `npm run test:architecture`

### `backend/routes/opsRoutes.js`

状态 / Status: candidate

职责 / Owns:

- independent ops-admin `/api/admin/ops/*` route registration
- dashboard query parsing for log inclusion and log line limits
- maintenance mode read/write HTTP boundary
- accepted-before-restart response shape for delayed PM2 restart
- keeping ops HTTP response/status mapping outside `server.js`

公开 API / Public API:

- `registerOpsRoutes(app, { opsAuthService, opsControlService })`
- `POST /api/admin/ops/login`
- `GET /api/admin/ops/dashboard`
- `GET /api/admin/ops/maintenance`
- `POST /api/admin/ops/maintenance`
- `POST /api/admin/ops/restart`

扩展方式 / Extension Path:

- Route additions should remain thin wrappers over `OpsControlService`; hard stop/start stays in `backend/ops-agent`.
- Access control stays behind `OpsAuthService`; future RBAC should extend ops auth/role services rather than per-route ad hoc checks.
- Restart/hard-stop semantics must keep an audit record and avoid pretending the web backend can restart itself after a true hard stop.

回归 / Regression:

- `node --test backend/tests/OpsRoutes.test.js backend/tests/OpsAuthService.test.js backend/tests/OpsControlService.test.js`
- `npm run test:architecture`

### `backend/routes/versionRoutes.js`

状态 / Status: candidate

负责 / Owns:

- `/api/version` route registration
- version response cache headers
- `ETag` emission and `If-None-Match` 304 handling
- keeping HTTP cache semantics outside `server.js`

公开 API / Public API:

- `registerVersionRoutes(app, { versionService })`

扩展方式 / Extension Path:

- New version HTTP behavior, such as additional validators or response headers, should extend this route module.
- Deployment identity calculation stays in `VersionService`; this route only handles HTTP response semantics.
- Version route behavior must remain covered by `VersionRoutes.test.js`.

回归 / Regression:

- `node --test backend/tests/VersionRoutes.test.js`
- `npm run test:architecture`

### `backend/services/worldExplorer/WorldExplorerActions.js`

Status: candidate

Owns:

- world explorer command orchestration for accepted manual world-march actions
- formation validation, active/idle mission selection, start/return/stop result assembly, and authority envelope attachment
- route rebasing for existing idle missions after return/stop/start commands
- coordinate-authoritative trace summaries and mission rebasing: any coordinate-bearing origin, route step, planned tile, target, or position derives tile identity from `q/r`; stale caller/persisted `tileId` / `id` cannot override command logs or mission writes

Public API:

- `countActiveMissions(gameState)`
- `startWorldMarch(gameState, options, now)`
- `returnWorldMarch(gameState, missionId, options, now)`
- `stopWorldMarch(gameState, missionId, options, now)`

Extension Path:

- Keep route generation and tutorial planned-site selection in `WorldExplorerRoutePlanner`.
- Keep persisted mission-row normalization in `WorldExplorerMissionNormalizer`.
- Keep runtime reveal/materialization side effects in `WorldExplorerProgression`.
- New action flows must add command-boundary tests before changing mission rebasing, authority envelopes, or trace summaries.

Regression:

- `node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js`
- `npm run test:architecture`

### `backend/services/worldExplorer/WorldExplorerRoutePlanner.js`

Status: candidate

Owns:

- world explorer route planning for accepted manual world-march targets
- route generation, generation-context hashing, planned tile creation, and tutorial first empty-city planned site creation
- canonical tile identity for route-planner outputs: route steps and tutorial planned sites derive tile ids from `q/r`; planned tile lookup for tutorial site selection also keys by coordinates, so stale route `tileId` or planned tile `id` cannot change tutorial site terrain or tile identity

Public API:

- `getExploreOrigin(gameState)`
- `buildManualRoute(origin, target, seed)`
- `getEventEpoch(gameState)`
- `getNearbyGenerationState(gameState, center, radius)`
- `getStepDirection(from, to)`
- `createGenerationContext(gameState, step, options)`
- `createPlannedTiles(gameState, route, now, options)`
- `shouldGuaranteeTutorialEmptyCity(gameState)`
- `pickTutorialCityName(gameState, q, r)`
- `getPlanningTerrainForMapTerrain(mapTerrain)`
- `createTutorialEmptyCitySite(gameState, step, plannedTile, now)`
- `createTutorialPlannedSites(gameState, route, plannedTiles, now)`

Extension Path:

- New route-planning modes must add focused tests before changing action modules or progression consumers.
- Coordinate-bearing route/planned-tile/planned-site data must recompute tile identity here before mission creation.
- Keep mission row normalization in `WorldExplorerMissionNormalizer`, runtime side effects in `WorldExplorerProgression`, and DTO shape in `WorldExplorerDtoMapper`.

Regression:

- `node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js`
- `npm run test:architecture`

### `backend/services/worldExplorer/WorldExplorerMissionNormalizer.js`

Status: candidate

Owns:

- server-side world explorer mission row normalization before progression, DTO, timeline, and AOI consumers
- route step, origin, home origin, target, position, planned tile, and planned site coordinate normalization
- canonical tile identity for any mission sub-record with `q/r` or `x/y`; stale persisted or caller-supplied `tileId` / `id` cannot override coordinates
- revealed tile id merge from already-normalized route steps plus legacy id-only history that has no coordinate payload

Public API:

- `normalizeRouteStep(rawStep, index)`
- `normalizePlannedTile(rawTile)`
- `normalizePlannedSite(rawSite)`
- `normalizeMission(rawMission)`
- `normalizeMissions(rawMissions)`

Performance Constraints:

- Linear over one mission's route/planned arrays.
- No repository access, route planning, world-map materialization, API route dependency, renderer import, DOM, or frontend state.

Extension Path:

- New persisted mission fields extend this normalizer with focused tests before downstream DTO/progression consumers read them.
- New coordinate semantics must be normalized here before `WorldExplorerProgression`, `ServerTimelineSnapshot`, or `AoiSyncSnapshot` consume mission rows.
- Id-only legacy arrays may be preserved only when no coordinate payload exists; coordinate-bearing records must derive ids from coordinates.

Regression:

- `node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js backend/tests/RealtimeAuthorityContract.test.js`
- `npm run test:architecture`

### `backend/services/worldExplorer/WorldExplorerProgression.js`

Status: candidate

Owns:

- world explorer runtime progression for already-accepted missions
- step reveal batching through `WorldMapService.revealTiles()`
- planned tile override lookup, planned site materialization, tutorial first-site grant, and mission position/status advancement
- canonical runtime tile identity for coordinate-bearing progression inputs: step summaries, planned-tile lookup keys, planned-site materialization, and mission position writes derive tile ids from `q/r`; stale `step.tileId` / planned tile `id` cannot override coordinates

Public API:

- `getPlannedTileById(mission)`
- `materializePlannedSitesForStep(gameState, mission, step, now)`
- `revealCoordinate(gameState, mission, coord, now)`
- `revealStep(gameState, mission, step, now)`
- `advanceExploreMissions(gameState, now)`
- `normalizeExploreState(gameState, now)`

Extension Path:

- New progression side effects must be added here or in action modules with focused tests before client-state projection reads them.
- Coordinate-bearing progression data must recompute tile identity at this boundary instead of trusting raw `tileId` / `id`.
- Keep route planning in `WorldExplorerRoutePlanner`, DTO shape in `WorldExplorerDtoMapper`, and API/action acceptance in `WorldExplorerActions`.

Regression:

- `node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js backend/tests/GameStateProjectionArchitecture.test.js`
- `npm run test:architecture`

### `backend/services/worldExplorer/WorldExplorerDtoMapper.js`

状态 / Status: candidate

负责 / Owns:

- 后端 world explorer API DTO 输出形状 / API response DTO shape
- 将 normalized mission 转成 public mission DTO
- canonical public tile identity for coordinate-bearing DTO fields: origin, home origin, target, position, route steps, planned tiles, and planned sites derive ids from `q/r` or `x/y`; stale mission `tileId` / `id` cannot leak back to clients
- Groups mission DTOs as `activeMission`, `idleMissions`, and `busyFormations`; the old ready-report bucket is not emitted.
- Keeps current world-march client fields: `maxActiveMissions`, `maxManualRouteLength`, and `stepDurationSeconds`; retired random-route fields are not emitted.
- 不推进任务、不写存档、不依赖 routes

公开 API / Public API:

- `WorldExplorerDtoMapper.getClientStateDto(missions, options)`
- `WorldExplorerDtoMapper.getMissionDto(mission, now)`
- `WorldExplorerDtoMapper.getCoordDto(source, fallback)`
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
- Coordinate-bearing public fields must pass through `getCoordDto()` / `normalizeCoord()` instead of cloning raw mission objects.
- 新服务流程仍由 `WorldExplorerClientState` 或 service/action modules 调用；mapper 只做 shape。
- 不要在 route 里手写 world explorer response shape。

回归 / Regression:

- `node --test backend/tests/WorldExplorerDtoMapper.test.js backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js`
- `npm run test:architecture`

### `backend/services/worldExplorer/WorldExplorerClientState.js`

状态 / Status: candidate facade

负责 / Owns:

- world explorer client-state projection from an already-advanced mission snapshot
- 委托 `WorldExplorerDtoMapper` 输出 public DTO
- Does not call `normalizeExploreState()`; progression belongs to `advanceRuntimeState()` / action modules.
- 保留旧 API `getClientMission()` / `getClientState()`，避免 routes/assembler 改动

公开 API / Public API:

- `WorldExplorerClientState.getClientMission(mission, now)`
- `WorldExplorerClientState.getClientState(gameState, now)`

扩展方式 / Extension Path:

- 新 response 字段加到 `WorldExplorerDtoMapper`。
- 新 progression side effect 留在 `WorldExplorerProgression` 或 action modules。
- 本文件只保留 read-only orchestration，不增加 DTO 拼装细节，不推进路线、不 reveal 地图、不 materialize site。

回归 / Regression:

- `node --test backend/tests/WorldExplorerDtoMapper.test.js backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js`
- `npm run test:architecture`

### `backend/services/realtime/CommandAuthorityContract.js`

状态 / Status: candidate

负责 / Owns:

- backend-authoritative command envelope for accepted and rejected player intent
- stable command metadata shape: `schema`, `status`, `commandId`, `serverTime`, `command`, `authority`, `timeline`, `aoi`, `rejection`
- explicit frontend role declaration: frontend sends intent only; server owns validation, timeline, final coordinates, combat/occupation result, and AOI sync
- compact `command.clientInput` evidence preservation, including `WorldMapInputIntent.inputId` and `clientSequence` for replay correlation
- attaching the authority envelope to legacy action results without changing legacy `success`, `message`, `mission`, or `tutorial` fields

公开 API / Public API:

- `CommandAuthorityContract.createCommandId(input)`
- `CommandAuthorityContract.normalizeIntent(intent)`
- `CommandAuthorityContract.createAuthorityResult(intent, options)`
- `CommandAuthorityContract.accept(intent, options)`
- `CommandAuthorityContract.reject(intent, options)`
- `CommandAuthorityContract.attach(result, intent, options)`

性能约束 / Performance Constraints:

- O(1) envelope creation; no state scan, repository access, renderer import, or route dependency.
- Does not decide gameplay results; callers provide validated timeline/AOI payloads.

扩展方式 / Extension Path:

- New command classes extend the envelope through `command` metadata or optional sibling payloads, not by changing legacy action result fields.
- New rejection reasons stay structured under `rejection`.
- New client-input evidence fields must remain compact diagnostics under `command.clientInput`; they must not become gameplay authority.
- Do not add gameplay simulation, transport delivery, or frontend interpolation logic here.

回归 / Regression:

- `node --test backend/tests/RealtimeAuthorityContract.test.js backend/tests/WorldExplorerService.test.js backend/tests/GameActionRegistry.test.js`
- `npm run test:architecture`

### `backend/services/realtime/ServerTimelineSnapshot.js`

状态 / Status: candidate

负责 / Owns:

- server-owned movement timeline snapshot for realtime missions
- normalized route/path/progress calculation from server timestamps
- confirmed position, interpolated current coordinate, and server-derived `stopTile`
- frontend interpolation metadata that keeps final coordinates server-authoritative
- coordinate-authoritative realtime timeline identity: mission origin/position/route, confirmed position, stop tile, and interpolation endpoints derive `tileId` from `q/r`; stale mission `tileId` cannot enter synchronized movement facts

公开 API / Public API:

- `ServerTimelineSnapshot.normalizeCoord(coord, fallback)`
- `ServerTimelineSnapshot.normalizeRoute(route)`
- `ServerTimelineSnapshot.getStepDurationMs(mission)`
- `ServerTimelineSnapshot.getProgress(mission, options)`
- `ServerTimelineSnapshot.getInterpolatedCoord(mission, options)`
- `ServerTimelineSnapshot.getConfirmedPosition(mission)`
- `ServerTimelineSnapshot.chooseStopTile(mission, options)`
- `ServerTimelineSnapshot.createMissionSnapshot(mission, options)`

性能约束 / Performance Constraints:

- Linear over one mission route.
- No world-map tile scan, repository access, API route dependency, renderer import, DOM, or frontend state.

扩展方式 / Extension Path:

- New realtime movement modes add focused timeline tests first.
- Frontend interpolation may consume the snapshot, but may not feed final coordinates back into stop/arrival decisions.
- Transport delivery belongs to later realtime sync modules.

回归 / Regression:

- `node --test backend/tests/RealtimeAuthorityContract.test.js backend/tests/WorldExplorerService.test.js`
- `npm run test:architecture`

### `backend/services/realtime/PresenceService.js`

Status: candidate

Owns:

- in-memory online presence for heartbeat-scale traffic
- heartbeat persistence throttling before `players.lastActiveAt` writes
- online summary windows for health, ops, and load-test guardrails
- no gameplay simulation, no full game-state loading, no per-heartbeat SQLite write

Public API:

- `new PresenceService(options)`
- `recordHeartbeat(playerId, options)`
- `getOnlineSummary(options)`

Extension Path:

- Future Redis-backed presence should replace the storage adapter behind this service contract, not move presence writes back into route handlers.
- Heartbeat must remain liveness/presence only; mission progression and AOI delivery belong to world services.

Regression:

- `node --test backend/tests/PresenceService.test.js`
- `npm run test:architecture`

### `backend/services/realtime/WorldWorkerService.js`

Status: candidate

Owns:

- periodic world runtime advancement outside the API gateway process
- active-player batch selection through repository abstractions
- non-overlapping tick execution and slow/error tick summaries
- calling `GameStateService.advanceRuntimeState()`, city runtime advancement, territory readiness, event cleanup/generation, and persistence for each worker-owned batch

Public API:

- `new WorldWorkerService(options)`
- `tickOnce()`
- `start()`
- `stop()`
- `getStatus()`

Extension Path:

- Future region workers, event queues, or distributed schedulers should shard or replace this service boundary rather than adding `setInterval` world sweeps back into `backend/server.js`.
- Long-term partitioning should route by player/team/region/chunk while preserving the gateway/worker split.

Regression:

- `node --test backend/tests/WorldWorkerService.test.js backend/tests/ServerGatewayNoWorldTick.test.js`
- `npm run test:architecture`

### `backend/services/realtime/AoiSyncSnapshot.js`

状态 / Status: candidate

负责 / Owns:

- bounded AOI snapshot for world-map realtime sync
- AOI center/radius normalization
- nearby mission, terrain tile, and territory slices without full-world payload assumptions
- count metadata for transport/render consumers
- coordinate-authoritative AOI sync identity: center, nearby mission positions, and terrain tile slices derive ids from `q/r`; stale center `tileId` or world-map tile `id` cannot enter synchronized AOI facts

公开 API / Public API:

- `AoiSyncSnapshot.normalizeRadius(value, fallback)`
- `AoiSyncSnapshot.getDistance(a, b)`
- `AoiSyncSnapshot.normalizeCenter(options)`
- `AoiSyncSnapshot.isInRadius(coord, center, radius)`
- `AoiSyncSnapshot.getAoiMissions(gameState, center, radius, options)`
- `AoiSyncSnapshot.getAoiTiles(gameState, center, radius)`
- `AoiSyncSnapshot.getAoiTerritories(gameState, center, radius)`
- `AoiSyncSnapshot.createSnapshot(gameState, options)`

性能约束 / Performance Constraints:

- Linear over currently materialized missions/tiles/territories only.
- No renderer import, DOM, API route, persistence write, or full-map generation.

扩展方式 / Extension Path:

- New AOI shapes or chunk/window integration extend this module with focused tests.
- Multiplayer transport can consume the snapshot but should not add socket/session behavior here.
- Large-map chunk/window contracts remain in `WorldChunkAddress` and `WorldInterestWindow`.

回归 / Regression:

- `node --test backend/tests/RealtimeAuthorityContract.test.js backend/tests/WorldExplorerService.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasTerritoryActionHandlers.js`

状态 / Status: candidate

负责 / Owns:

- `CanvasActionController` 的 territory/world-site/world-march/expedition/battle-scene action handlers
- world map drag target selection and expedition launch/cancel orchestration
- `TileCoord`-normalized world march target handoff: HUD `worldMarchTarget.tileId` is derived from `targetQ/targetR`, stale renderer/caller `action.tileId` cannot override it, and `startWorldMarch` forwards target coordinates without adding a top-level `tileId` authority field
- battle scene close/skip action compatibility
- installed legacy `handle_*` method names for the territory action domain
- forwarded territory/world-map action Promise normalization through `CanvasActionController.finalizeForwarded()`

公开 API / Public API:

- `CanvasTerritoryActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 territory/world-site/world-march action 先扩展本模块，再让 `CanvasActionController` 只保留 facade/dispatch 行为。
- 新 gameplay simulation 不进入本模块；本模块只负责 action-to-controller/API/UI-state orchestration。
- 如果 action 属于 building/event/tech/famous/talent policy/shell domain，扩展对应 domain handler module。
- 转发到 shell/app bridge 的 action 不能用同步布尔表达式判定 Promise；必须保留异步拒绝给 `action:error` 证据链。

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
- forwarded city/building/event/task action Promise normalization through `CanvasActionController.finalizeForwarded()`

公开 API / Public API:

- `CanvasCityActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 city-management/event/task-center/building/tech action 先扩展本模块。
- 新 territory/world-map actions stay in `CanvasTerritoryActionHandlers`.
- 新 famous-person/talent-policy/shell actions stay in their focused handler modules.
- 转发 action 的本地收尾必须放到 `finalizeForwarded(..., afterAllowed)`，不能在 Promise resolve 前提前刷新 UI。

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
- forwarded famous-person action Promise normalization through `CanvasActionController.finalizeForwarded()`

公开 API / Public API:

- `CanvasFamousActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 famous-person canvas action 先扩展本模块。
- Famous-person view-state shape stays in presenter modules; gameplay/service changes stay outside this handler.
- Do not add famous-person handlers directly to `CanvasActionController`.
- Forwarded famous-person action results must preserve async rejection; do not collapse Promise results to synchronous success.

回归 / Regression:

- `node --test frontend/js/platform/CanvasFamousActionHandlers.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/renderers/CityPeopleCanvasRenderer.js`

Status: candidate

Owns:

- city-management people-tab population/talent allocation canvas rendering
- people-tab policy button hit target that reopens the same city-management people tab
- job assignment hit targets used by the strong tutorial manual-talent step

Public API:

- `new CityPeopleCanvasRenderer({ host })`
- `renderPopulation(state, startY)`

Extension Path:

- New talent allocation UI extends this renderer and city-management people-tab flow.
- Do not add people/talent/policy rendering back to the resources page, `ResourceTopBarCanvasRenderer`, or map command panels. The obsolete `HomeCanvasRenderer` owner was deleted.
- Backend/API talent-policy apply/save/delete services may remain service actions, but the old frontend `openTalentPolicy` shortcut handler is deleted.

Regression:

- `node --test frontend/js/platform/renderers/CityPeopleCanvasRenderer.test.js frontend/js/platform/renderers/ResourceTopBarCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasShellActionHandlers.js`

状态 / Status: candidate

负责 / Owns:

- shell/system/account/naming/advisor/guidebook/army-formation action handlers
- tab switching, command panel, reward reveal, settings/logs/auth/reset/logout action orchestration
- naming finalization helper behavior previously embedded in `CanvasActionController`
- installed legacy `handle_*` method names for shell/system action domains
- forwarded shell/system action Promise normalization when delegating to the shell/app bridge

公开 API / Public API:

- `CanvasShellActionHandlers.install(CanvasActionController)`

扩展方式 / Extension Path:

- 新 shell/system/account/naming/advisor/guidebook action 先扩展本模块。
- Domain gameplay actions stay in territory/city/famous/talent-policy handlers.
- Do not add shell/system handlers directly to `CanvasActionController`.
- If a shell/system action may return a Promise, success side effects must wait for resolution and rejection must remain observable by `CanvasActionController.handle()`.

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

### `frontend/js/platform/renderers/CanvasAssetRenderer.js`

状态 / Status: candidate

负责 / Owns:

- Canvas asset cache loading and request-path version handoff
- preload progress events for H5 loading UI
- lazy `getAsset()` loading and cache invalidation when assets change
- asset alpha-bound analysis for tile/site metrics
- world-tile template mask and dry-template prewarm helpers
- deferred world-tile cache prewarm scheduling for H5 startup performance

公开 API / Public API:

- `CanvasAssetRenderer.preloadAssets(assetPaths, onProgress, options)`
- `CanvasAssetRenderer.getAsset(assetPath)`
- `CanvasAssetRenderer.prewarmWorldTileCaches(assetPaths)`
- `CanvasAssetRenderer.scheduleWorldTileCachePrewarm(assetPaths, options)`
- `CanvasAssetRenderer.cancelWorldTileCachePrewarmTask()`
- `CanvasAssetRenderer.analyzeAssetAlphaBounds(assetPath)`
- `CanvasAssetRenderer.getWorldTileTemplateMetrics(template)`

性能约束 / Performance Constraints:

- Default preload waits for image resource availability only; it does not synchronously prewarm all world-tile metrics/masks/dry templates.
- H5 startup prewarm is scheduled explicitly by shell/world-map renderer through `scheduleWorldTileCachePrewarm()` and traced as `assets:prewarm:deferred`.
- Low-memory/low-core devices use smaller chunks and longer delay/interval defaults so background prewarm does not block first ready.
- Synchronous prewarm remains available only through explicit `deferPrewarm:false` or direct `prewarmWorldTileCaches()` calls.

扩展方式 / Extension Path:

- New asset categories should extend preload manifests or asset registries before adding renderer-specific paths.
- New startup warmup work must remain optional/deferred unless sampled profiling proves it is required before first render.
- Do not add API/state sync behavior here; this module only owns asset/cache preparation.

回归 / Regression:

- `node --test frontend/js/platform/renderers/CanvasAssetRenderer.test.js`
- `node --test frontend/js/platform/CanvasGameShell.test.js`
- `npm run test:architecture`

### `frontend/js/platform/CanvasGameRendererCoreFacades.js`

状态 / Status: candidate

负责 / Owns:

- core `CanvasGameRenderer` compatibility method installation for surface, asset, world-tile-water, and famous helpers
- delegate fallback behavior for historical renderer method names
- delegated background world-tile cache prewarm scheduling facade for H5 startup paths
- H5/minigame load-order contract before `CanvasGameRenderer`

公开 API / Public API:

- `CanvasGameRendererCoreFacades.CORE_FACADE_METHODS`
- `CanvasGameRendererCoreFacades.installCoreFacades(CanvasGameRenderer)`

扩展方式 / Extension Path:

- 新 core surface/asset/world-tile-water/famous compatibility method 先扩展 `CORE_FACADE_METHODS` with a focused test。
- New page/panel/HUD compatibility methods belong in `CanvasGameRendererPageFacades`.
- Do not add these compatibility methods directly to `CanvasGameRenderer`.
- Startup asset preload must not reintroduce synchronous world-tile cache prewarm unless an explicit caller opts into `deferPrewarm:false`.

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
- world tile water animation frame duration delegated to `CanvasGameShellWorldMapRuntimePolicy` when available
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
- compat app runtime-tap async failure observation through `CanvasGameAppInputRouter.observeAsyncActionResult()`
- compat app tap-entry operation-log parity for hit, runtime route, disabled, miss, and action dispatch breadcrumbs
- shell/app input-router runtime handled breadcrumbs summarize async results as compact state

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
- Snapshot drag and refresh frames must pass the renderer's freshly published `lastWorldTileMapContext` into actor rendering before falling back to runtime cache.
- Runtime tap Promise failures must stay rejected to callers and be observed by `CanvasGameAppInputRouter.observeAsyncActionResult()` for diagnostics.
- `CanvasGameAppInputRouter` operation-log breadcrumbs must remain compact and serializable; Promise handled values are recorded as `'promise'`, not as runtime objects.
- `CanvasGameShellInputRouter` follows the same compact handled-value rule for runtime routing, tap-miss logs, and forwarded tap-action logs.
- `ClientOperationLog.sanitize()` is the final operation-log boundary: thenable values collapse to `'promise'` before persistence/export, preventing renderer, native event, or runtime payload leaks if a call site misses its own compact summary.
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
- `TileCoord`-backed stable coordinate normalization: stable `x/y` wins over legacy `q/r`, and canonical `tileId` wins over renderer/raw ids for presenter view-state identity

公开 API / Public API:

- `WorldTileMapTileNormalizer.toNumber(value, fallback)`
- `WorldTileMapTileNormalizer.toInteger(value, fallback)`
- `WorldTileMapTileNormalizer.getTileMapManifest(options)`
- `WorldTileMapTileNormalizer.getWorldTileId(q, r)`
- `WorldTileMapTileNormalizer.normalizeCoord(coord, fallback)`
- `WorldTileMapTileNormalizer.getMountainNeighborCount(tile, siteById)`
- `WorldTileMapTileNormalizer.normalizeIntel(intel)`
- `WorldTileMapTileNormalizer.normalizeTemplateAssets(templateAssets)`
- `WorldTileMapTileNormalizer.normalizeWaterAsset(manifest, terrainAsset)`
- `WorldTileMapTileNormalizer.normalizeFeature(manifest, terrainAsset)`
- `WorldTileMapTileNormalizer.normalizeSite(manifest, site)`
- `WorldTileMapTileNormalizer.normalizeWorldTile(tile, siteById, options)`

扩展方式 / Extension Path:

- 新单 tile render/view-state 字段先扩展本模块，并同步 focused tests。
- 新坐标语义先扩展 `TileCoord`，本模块只消费 stable coordinate contract，不再手写第二套 tile identity 规则。
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
- `TileCoord`-backed route/planned tile/planned site identity: stable `x/y` wins over legacy `q/r`, and canonical `tileId` wins over raw/planned legacy ids
- diagnostic `WorldMarchTrace` planned-tile summaries derive ids from `normalizeCoord()` output; trace strings must not prefer raw `tile.id`

公开 API / Public API:

- `WorldTileMapExplorerNormalizer.toNumber(value, fallback)`
- `WorldTileMapExplorerNormalizer.toInteger(value, fallback)`
- `WorldTileMapExplorerNormalizer.getWorldTileId(q, r)`
- `WorldTileMapExplorerNormalizer.getEpochNowMs(options)`
- `WorldTileMapExplorerNormalizer.normalizeCoord(coord, fallback)`
- `WorldTileMapExplorerNormalizer.isCanonicalWorldTileId(id)`
- `WorldTileMapExplorerNormalizer.normalizeRevealedTileIds(revealedTileIds, route)`
- `WorldTileMapExplorerNormalizer.normalizeWorldExplorerMission(mission)`
- `WorldTileMapExplorerNormalizer.mergeWorldExplorerMissions(worldExplorerState)`
- `WorldTileMapExplorerNormalizer.getWorldExplorerMissions(worldExplorerState, options)`
- `WorldTileMapExplorerNormalizer.getWorldExplorerPlannedTiles(worldExplorerState, options)`
- `WorldTileMapExplorerNormalizer.getWorldExplorerPlannedSites(worldExplorerState, options)`

扩展方式 / Extension Path:

- 新 world-explorer presenter-only mission/planned-tile/planned-site normalization 先扩展本模块，并同步 focused tests。
- 新坐标语义先扩展 `TileCoord`，本模块只消费 stable coordinate contract，不再手写第二套 tile identity 规则。
- New trace or diagnostic summaries in this module must use normalized coordinate identity, not raw payload `id` fallback chains.
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
- `TileCoord`-backed fallback signature summaries for tiles, sites, scout routes, planned tiles/sites, and explorer missions when the presenter is unavailable
- signature sync result derivation without mutating runtime state
- pure bake-dirty checks from runtime state plus current map data

公开 API / Public API:

- `WorldMapRuntimeBakePolicy.getMapDataSignature(state, options)`
- `WorldMapRuntimeBakePolicy.getSignatureSyncResult(previousSignature, nextSignature)`
- `WorldMapRuntimeBakePolicy.isMapBakeDirty(runtimeState, state, options)`
- `WorldMapRuntimeBakePolicy.normalizeCoord(coord, fallback)`
- `WorldMapRuntimeBakePolicy.summarizeTile(tile)`
- `WorldMapRuntimeBakePolicy.summarizeSite(site)`
- `WorldMapRuntimeBakePolicy.summarizeMission(mission)`
- `WorldMapRuntimeBakePolicy.summarizeExplorerMission(mission)`

扩展方式 / Extension Path:

- 新 map-bake signature fields or bake-dirty policy first extend this module with focused tests。
- Fallback signatures must consume `TileCoord`; do not reintroduce raw `id/q/r/x/y/tileId` JSON serialization here.
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
- promotion of the freshly rendered `lastWorldTileMapContext` before actor-layer rendering so world actors share the same anchor/viewport as the map frame
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
- custom facade delegates for guidebook and tech fallback composition
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

### `frontend/js/platform/CanvasActionController.js` - 284 lines

状态 / Status: candidate facade

负责 / Owns:

- compatibility dispatch facade for historical `handle_*` action methods
- shared host/state/controller lookup helpers used by installed action modules
- shared panel closing, render routing, async finalization, action forwarding, and world-map refresh helpers
- forwarded action result normalization through `finalizeForwarded()`, preserving Promise rejection and running local after-allowed side effects only after async approval
- action begin/end/error operation-log evidence, including compact `WorldMapInputIntent` metadata when supplied
- failed world-march action evidence continuity from action error logs to `GameAPI` error logs, keyed by the same `inputId` / `clientSequence`
- tech-tree drag/zoom delegation to `TechTreeInteractionModel`

重要公开模式 / Important Public Pattern:

- `new CanvasActionController(host, options)`
- `handle(action)`
- installed `handle_<actionType>(action)` methods from focused handler modules

目标拆分 / Target Split:

1. Keep territory/world-site/world-march handlers in `CanvasTerritoryActionHandlers`.
2. Keep city-management/event/task-center/building/tech handlers in `CanvasCityActionHandlers`.
3. Keep famous-person handlers in `CanvasFamousActionHandlers`.
4. Keep city people/talent UI actions in `CanvasCityActionHandlers` and `CityPeopleCanvasRenderer`; the old frontend talent-policy shortcut handler module is deleted.
5. Keep shell/system/account/naming/advisor/guidebook/army-formation handlers in `CanvasShellActionHandlers`.
6. Keep this file as the dispatch/helper facade.

当前扩展方式 / Extension Path Now:

- Territory/world-site/world-march actions extend `CanvasTerritoryActionHandlers`.
- City-management/event/task-center/building/tech actions extend `CanvasCityActionHandlers`.
- Famous-person actions extend `CanvasFamousActionHandlers`.
- City people/talent UI actions extend `CanvasCityActionHandlers` and `CityPeopleCanvasRenderer`.
- Shell/system/account/naming/advisor/guidebook/army-formation actions extend `CanvasShellActionHandlers`.
- Avoid adding direct `handle_*` implementations here; add or extend a focused handler module instead.
- Forwarded actions in focused handler modules must use `finalizeForwarded()` when they can receive a Promise from the shell/app bridge; do not use `forwarded !== false` on possibly async results.

回归 / Regression:

- `node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/CanvasCityActionHandlers.test.js frontend/js/platform/CanvasFamousActionHandlers.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/renderers/CityPeopleCanvasRenderer.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
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
- building guide visibility, city-people guide visibility, and generic building guide display

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
- all currently registered candidate/stable baseline focused tests: feature flags, asset key registry, preload asset manifest, layer registry, shell lifecycle, frozen fog renderer, world map snapshots, world map performance budget, march progress snapshot, world map render snapshot, fog visual snapshot, visual plugin registry, debug overlay snapshot, debug overlay registry, world map input action map, world map renderer split modules, canvas action handler split modules, canvas game renderer composition/facade modules, tutorial guide policy/resolver/phase/UI-state modules, game state migration pipeline, world explorer DTO mapper, realtime authority contracts, config registry contract, server random authority contract, famous-person and defender-leader random authority consumers, and backend version service
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

### `scripts/playtest-online-tutorial.js`

状态 / Status: candidate QA harness

负责 / Owns:

- online/local tutorial browser playtest orchestration for the Canvas H5 game
- real browser login/reset/setup, prompt interception, and API call capture
- per-action before/after full screenshots
- target crop, exact target crop, and tutorial highlight crop evidence
- PNG-based visual checks for target visibility, crop variance, and guided gold highlight pixels
- center-point hitTarget verification and tutorial shield allowance checks
- expected outcome verification after each click/wait/fill action
- API response, bad-response, request-failure, page-error, and authority-envelope checks
- `summary.json`, `verification-report.json`, `manualReviewIndex`, and screenshot evidence paths

公开命令 / Public Command:

- `npm run playtest:online-tutorial`

扩展方式 / Extension Path:

- New tutorial actions must add explicit expected outcome rules before being accepted as automated browser coverage.
- New guided visual styles must extend the PNG/highlight metrics instead of weakening strict visual mode.
- Do not reintroduce direct internal state-push fallbacks for user-visible tutorial steps; visible/clickable targets are required.
- Do not treat this as a lightweight architecture smoke command. It is a slower browser-level acceptance gate for player visibility and clickability.

回归 / Regression:

- `node --check scripts/playtest-online-tutorial.js`
- local/online `npm run playtest:online-tutorial` when touched behavior affects real input, Canvas visibility, tutorial guide flow, API action feedback, or deployment verification

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
- promotion evidence shape for guarded stable blocks
- candidate promotion queue consistency for later promotion hardening

公开约定 / Public Contract:

- `stableBlocks[].files` lists stable files guarded by `scripts/check-stable-blocks.js`.
- `stableBlocks[].promotionEvidence` records matrix review, observation notes, public contract, extension path, reopen exceptions, and node/npm regression evidence for each stable block.
- `candidatePromotionQueue` lists existing candidate files that have responsibility-index entries and must not already be listed as stable.
- `reopenPolicy.allowedReasons` is the only accepted reason list for stable reopen work.
- A module is not a sealed stable block until it is listed here and in its responsibility-index entry.

扩展方式 / Extension Path:

- Add newly promoted stable files here in the same task that changes their responsibility-index status.
- Do not list candidate files here until their stable surface has passed the promotion matrix.

回归 / Regression:

- `node --test scripts/check-stable-blocks.test.js`
- `node scripts/check-stable-blocks.js`
- `npm run test:architecture`

### `scripts/check-stable-blocks.js`

状态 / Status: stable governance

负责 / Owns:

- stable block manifest validation
- stable block promotion evidence validation
- responsibility-index stable entry coverage checks
- candidate promotion queue consistency checks
- responsibility-index parsing through ASCII `Status:` anchors
- stable file change detection
- explicit stable reopen reason enforcement

公开命令 / Public Command:

- `node scripts/check-stable-blocks.js`

扩展方式 / Extension Path:

- New stable guard behavior extends this script with focused syntax/architecture checks.
- Promotion-rule behavior must add or update `scripts/check-stable-blocks.test.js` in the same change.
- Keep slow full-test behavior out of this script; it must remain part of the fast architecture gate.

回归 / Regression:

- `node --check scripts/check-stable-blocks.js`
- `node --test scripts/check-stable-blocks.test.js`
- `node scripts/check-stable-blocks.js`
- `npm run test:architecture`

### `scripts/check-stable-blocks.test.js`

状态 / Status: candidate

负责 / Owns:

- focused regression coverage for the stable block guard
- ASCII `Status:` responsibility-index parsing coverage
- promotion evidence validation coverage
- stable responsibility-index entry validation coverage

公开命令 / Public Command:

- `node --test scripts/check-stable-blocks.test.js`

扩展方式 / Extension Path:

- Add or update cases here whenever `scripts/check-stable-blocks.js` changes promotion evidence, responsibility-index, reopen, or candidate queue rules.
- Keep this test focused enough to remain part of `npm run test:architecture`.

回归 / Regression:

- `node --test scripts/check-stable-blocks.test.js`
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

### `docs/production_engineering_roadmap_2026-06-09.md`

状态 / Status: authoritative

负责 / Owns:

- P12 production engineering roadmap
- anti-mud production guardrails
- CI architecture gate direction
- release/deploy governance direction
- observability, backup/restore, performance/capacity, security, config pipeline, stable promotion CI, and operations runbook priorities

公开约定 / Public Contract:

- This is the current production-engineering authority for the post-P0-P11 phase.
- P12 implementation must update this document when production guardrails, deploy rules, CI gates, backup/restore rules, or operational runbooks change.

扩展方式 / Extension Path:

- Add or update P12 items through this roadmap and keep concrete modules/scripts/runbooks registered in this responsibility index.
- Do not create separate release, handoff, or operations notes outside the official doc set unless they are registered here and guarded by `scripts/verify-refactor-plan-doc.js`.

回归 / Regression:

- `node scripts/verify-refactor-plan-doc.js`
- `npm run test:architecture`

### `docs/6月11日重构与问题交接.md`

Status: authoritative daily handoff

Owns:

- 2026-06-11 production-engineering implementation handoff
- summary of committed production-engineering and follow-up result through `08639bab`
- deleted-stage-doc replacement record
- local validation result record
- dual-remote push result record
- server hook anomaly follow-up note
- host backup/restore and config release required-gate evidence

Public Contract:

- This document replaces the prior temporary refactor, issue, and handoff notes for 2026-06-11.
- It is not a product/gameplay/architecture source of truth; use it to resume operational follow-up and trace what changed today.
- Future daily handoff notes must be registered in `scripts/verify-refactor-plan-doc.js` before they are considered official.

Extension Path:

- Update this file only for corrections to the 2026-06-11 handoff facts.
- New-day handoff documents should not revive obsolete `handoff` filenames; use a dated Chinese title and register it in the guard.

Regression:

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
- compatibility facade for scout route drawing delegated to `WorldMapScoutRenderer`; legacy scout-unit helpers are retired
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
- delegated scout helpers: `renderWorldScoutRoutes()`
- delegated site overlay helpers: `getWorldSiteDialogPresenter()`, `buildWorldSiteDialogViewState()`, `buildFallbackWorldSiteDialogViewState()`, `renderWorldSiteAction()`, `renderWorldExpeditionConfig()`, `renderWorldSiteModal()`, `getWorldCityCommandAnchor()`, `getWorldSiteCanvasAnchor()`, `getWorldCityCommandButtonAction()`, `drawWorldCityCommandPrimaryButton()`, `drawWorldCityCommandSideButton()`, `renderWorldCityCommandOverlay()`
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
- After P3-011, new scout route visuals extend `WorldMapScoutRenderer`; legacy scout unit fallback is retired and must not return to active source.
- P3-012 后，新 water entry filtering/draw handoff 先扩展 `WorldMapWaterEntryRenderer`；water pixel/texture drawing 仍扩展 `WorldTileWaterCanvasRenderer`。
- Do not add gameplay or visibility rules here.

- P3-013 后，新 world-site modal/action overlay、occupied-city command overlay、expedition config controls 先扩展 `WorldMapSiteOverlayRenderer`；presenter view-state rules 仍扩展 presenter。

- After P3-014, new military world-view panel composition and tile-map branch handoff extend `WorldMapMilitaryViewRenderer`; legacy radar fallback, `WorldRadarPresenter`, and `worldRadarDrag` are retired and must not return to active source.
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

### `frontend/js/debug/H5LoadTrace.js`

状态 / Status: candidate

负责 / Owns:

- H5 boot/load phase tracing for asset preload, first state sync, and API spans
- console-facing boot diagnostics with elapsed time, durations, progress, request ids, and summarized payloads
- frontend load/asset/API failure telemetry preparation during boot
- best-effort reporter handoff without blocking user flow

公开 API / Public API:

- `new H5LoadTrace(options)`
- `H5LoadTrace.boot(detail)`
- `H5LoadTrace.mark(event, detail)`
- `H5LoadTrace.phaseStart(name, detail)`
- `H5LoadTrace.phaseEnd(name, detail)`
- `H5LoadTrace.phaseFail(name, error, detail)`
- `H5LoadTrace.progress(phase, progress)`
- `H5LoadTrace.apiStart(method, path, url, detail)`
- `H5LoadTrace.apiEnd(span, detail)`
- `H5LoadTrace.apiFail(span, error, detail)`
- `H5LoadTrace.ready(detail)`
- `H5LoadTrace.setReporter(reporter)`
- `H5LoadTrace.reportClientEvent(type, detail, dedupeKey)`

扩展方式 / Extension Path:

- New boot phases should use phase/progress/API span helpers so console trace and telemetry stay aligned.
- Reporter callbacks must remain best-effort: failures are swallowed, duplicate load failures are deduped, and boot cannot depend on telemetry success.
- New telemetry kinds must stay allowlisted by `backend/routes/clientEventsRoutes.js` before being emitted broadly.

回归 / Regression:

- `node --test frontend/js/debug/H5LoadTrace.test.js`
- `npm run test:architecture`

### `frontend/js/api/GameAPI.js`

状态 / Status: candidate

负责 / Owns:

- frontend API transport boundary
- request URL building and `/version` ETag cache reuse
- auth header and trace headers
- client request id, timeout, GET retry policy, and structured API errors
- H5 load trace API spans
- compact world-map `clientInputIntent` evidence forwarding for world-march commands, preserving `inputId` and `clientSequence`
- compact `clientInput` evidence on local `api:request`, `api:response`, and `api:error` operation-log entries
- best-effort frontend client event reporting to `/client-events`

公开 API / Public API:

- `new GameAPI(baseUrl, token, options)`
- `GameAPI.request(method, path, body)`
- `GameAPI.getState()`
- `GameAPI.heartbeat()`
- `GameAPI.getVersion()`
- `GameAPI.reportClientEvent(event)`
- existing game action helper methods

扩展方式 / Extension Path:

- New transport behavior goes through constructor `options` so tests can inject deterministic schedulers/transports.
- `/version` requests must reuse server `ETag` with `If-None-Match` and handle 304 by returning the cached version snapshot.
- Only safe methods such as GET/HEAD may auto-retry transient failures. POST action helpers must not auto-retry without an idempotency contract.
- New request metadata must remain structured on thrown errors and H5 load trace spans.
- World-map command evidence must pass through the compact allowlist summary before leaving the client or entering local request/error logs.
- Client event reporting is best-effort telemetry. It may include auth headers when available, but it must swallow transport failures and return a failure object instead of blocking boot.

回归 / Regression:

- `node --test frontend/js/api/GameAPI.test.js`
- `npm run test:architecture`

### `frontend/js/services/GameStateSync.js`

状态 / Status: candidate

负责 / Owns:

- lightweight heartbeat scheduling
- reconnecting/failure-count state
- heartbeat failure backoff window
- authority state refresh when active world exploration is near a server-owned milestone

公开 API / Public API:

- `new GameStateSync(api, intervalMs, scheduler)`
- `GameStateSync.fetchNow()`
- `GameStateSync.start()`
- `GameStateSync.stop()`
- `GameStateSync.setIntervalMs(intervalMs)`
- `GameStateSync.setStateProvider(getLocalState)`

扩展方式 / Extension Path:

- New polling behavior must preserve heartbeat as a lightweight liveness call.
- Runtime state refresh must stay reasoned and throttled; gameplay authority remains backend-owned.
- Failure handling should extend the backoff/reconnecting state here, not in renderers or presenters.

回归 / Regression:

- `node --test frontend/js/services/GameStateSync.test.js`
- `npm run test:architecture`

### `frontend/js/services/UpdateChecker.js`

状态 / Status: candidate

负责 / Owns:

- deployment version polling
- update prompt trigger when deployment id changes
- version-check failure backoff window

公开 API / Public API:

- `new UpdateChecker(options)`
- `UpdateChecker.start()`
- `UpdateChecker.stop()`
- `UpdateChecker.safeCheck(options)`
- `UpdateChecker.check(options)`

扩展方式 / Extension Path:

- New `/version` caching, ETag, or deploy-manifest behavior should be added here or behind its injected API.
- Version polling must not mutate gameplay state.
- Failure backoff must remain observable through tests.

回归 / Regression:

- `node --test frontend/js/services/UpdateChecker.test.js`
- `npm run test:architecture`

### `frontend/js/ui/H5AuthStorageAdapter.js`

状态 / Status: candidate

负责 / Owns:

- H5 auth token storage compatibility
- remembered username state
- tutorial/session local storage cleanup

公开 API / Public API:

- `H5AuthStorageAdapter.fromRuntime(runtime)`
- `H5AuthStorageAdapter.fromStorage(storage)`
- `getCredentialSnapshot()`
- `persistRememberedCredentials(username, password, rememberPassword)`
- `removeRememberedCredentials()`
- `clearSession()`

扩展方式 / Extension Path:

- This adapter must not store or return plaintext password values.
- Token storage hardening belongs here or a sibling auth storage adapter, not presenters/renderers.

回归 / Regression:

- `node --test frontend/js/ui/H5AuthStorageAdapter.test.js`
- `npm run test:architecture`

### `backend/middleware/adminMiddleware.js`

状态 / Status: candidate

负责 / Owns:

- admin authorization boundary after login authentication
- parsing explicit admin username configuration
- default local development admin fallback

公开 API / Public API:

- `createAdminMiddleware(options)`
- `parseUserList(value)`

扩展方式 / Extension Path:

- Future role tables or RBAC should replace/extend this middleware without moving role checks into `adminRoutes`.
- Production admin users must be explicit through environment/config.

回归 / Regression:

- `node --test backend/tests/AdminRoutes.test.js`
- `npm run test:architecture`

### `backend/routes/adminRoutes.js`

状态 / Status: candidate

负责 / Owns:

- authenticated/admin task-definition management HTTP routes
- authenticated/admin config release HTTP routes
- operator propagation from auth/admin middleware to admin services
- keeping admin response/status mapping outside `server.js`

公开 API / Public API:

- `registerAdminRoutes(app, { authMiddleware, adminMiddleware, configReleaseService, configRuntimeLoader })`
- `GET /api/admin/task-definitions`
- `GET /api/admin/task-definitions/history`
- `POST /api/admin/task-definitions/preview`
- `POST /api/admin/task-definitions/import`
- `POST /api/admin/task-definitions/rollback`
- `GET /api/admin/task-definitions/template.xlsx`
- `GET /api/admin/config-releases`
- `GET /api/admin/config-releases/active`
- `GET /api/admin/config-releases/runtime-status`
- `POST /api/admin/config-releases/preview`
- `POST /api/admin/config-releases/publish`
- `POST /api/admin/config-releases/rollback`

扩展方式 / Extension Path:

- Admin route additions should remain thin HTTP boundaries over services; validation and persistence belong in service modules.
- Access control stays behind `authMiddleware` + `adminMiddleware`; future RBAC should extend middleware/role services rather than per-route ad hoc checks.
- Config release routes provide audit-only release records plus loader/gameplay-runtime readiness. Gameplay consumption stays behind `GameplayConfigRuntime` and documented drill evidence, not route side effects.

回归 / Regression:

- `node --test backend/tests/AdminRoutes.test.js`
- `npm run test:architecture`

### `backend/middleware/maintenanceMiddleware.js`

状态 / Status: candidate

职责 / Owns:

- soft maintenance mode request blocking after admin routes are registered
- default blocked gameplay/player-write API path list
- `503 MAINTENANCE_MODE` response shape and `Retry-After` header
- preserving admin, health, version, metrics, and client-events reachability during soft stop
- no maintenance-state persistence ownership and no hard process stop/start ownership

公开 API / Public API:

- `createMaintenanceMiddleware({ opsControlService, blockedPrefixes, blockedPaths })`

扩展方式 / Extension Path:

- New player-facing write APIs must be added to the blocked path/prefix list when they should respect maintenance mode.
- Admin, health, version, and metrics reachability must stay covered so operators can reopen service during maintenance.
- Hard stop/start belongs to an external ops-agent/control plane, not this middleware.

回归 / Regression:

- `node --test backend/tests/OpsRoutes.test.js`
- `npm run test:architecture`

### `backend/config/SecurityConfig.js`

状态 / Status: candidate

负责 / Owns:

- backend startup security defaults
- production JWT secret requirement
- production CORS origin requirement
- development-only local fallback policy

公开 API / Public API:

- `resolveJwtSecret(env)`
- `resolveCorsOptions(env)`
- `parseAllowedOrigins(value)`

扩展方式 / Extension Path:

- New server security startup requirements should be centralized here instead of being embedded directly in `server.js`.
- Production defaults should fail closed; development may remain locally runnable when safe.

回归 / Regression:

- `node --test backend/tests/SecurityConfig.test.js`
- `npm run test:architecture`

### `scripts/run-architecture-smoke.js`

状态 / Status: candidate

负责 / Owns:

- local architecture baseline command behind `npm run test:architecture`
- registered syntax checks
- focused candidate/stable test list
- automatic discovery of `*Contract.test.js` and `*.contract.test.js`
- shell script syntax guard invocation
- config pipeline baseline diff guard invocation
- config release service syntax/test registration
- config runtime loader syntax/test registration
- gameplay config runtime facade syntax/test registration
- config release admin console test registration
- ops control service syntax/test registration
- ops-agent syntax/test registration
- ops routes and maintenance middleware syntax/test registration
- ops admin console test registration
- config runtime drift health summary and startup gate syntax/test registration
- architecture guard command sequencing

公开 API / Public API:

- `npm run test:architecture`
- `node scripts/run-architecture-smoke.js`
- exported helpers for tests: `discoverContractTests()`, `isContractTestFile()`, `uniqueFiles()`

扩展方式 / Extension Path:

- New focused architecture tests should usually be added to the explicit list.
- New contract tests named `*Contract.test.js` or `*.contract.test.js` are auto-discovered, but important non-contract regression tests still need explicit registration.
- New repo-wide guards should be invoked from this script so CI and deploy use the same baseline.
- Project-owned shell scripts must remain covered through `scripts/check-shell-scripts.js`.
- Config registry baseline changes must pass `scripts/validate-config-pipeline.js --baseline docs/config_registry_snapshot_2026-06-11.json`.
- Config release workflow changes must keep `backend/tests/ConfigReleaseService.test.js` and `backend/tests/AdminRoutes.test.js` registered.
- Config runtime bundle loader changes must keep `backend/tests/ConfigRuntimeLoader.test.js` registered.
- Gameplay config runtime facade changes must keep `backend/tests/GameplayConfigRuntime.test.js` registered.
- Config release console changes must keep `frontend/tools/config-release-console.test.js` registered.
- Ops console/backend operations changes must keep `backend/tests/OpsControlService.test.js`, `backend/tests/OpsRoutes.test.js`, `backend/tests/OpsAgentService.test.js`, `backend/tests/OpsAgentHttpServer.test.js`, and `frontend/tools/ops-console.test.js` registered.
- Browser profiling commands that are too slow/flaky for every CI run should still be listed in `CHECK_FILES` for syntax validation and documented separately as evidence commands.

回归 / Regression:

- `node --test scripts/run-architecture-smoke.test.js`
- `npm run test:architecture`

### `scripts/check-backend-security-audit.js`

状态 / Status: candidate

负责 / Owns:

- backend `npm audit --json` policy guard
- blocking unexpected or newly fixable backend dependency vulnerabilities
- documenting the only allowed residual audit risk: `xlsx` with no npm-audit fix
- shared `npm run security:audit` command behavior

公开命令 / Public Command:

- `npm run security:audit`
- `node scripts/check-backend-security-audit.js`

扩展方式 / Extension Path:

- New allowed residuals must include a specific reason and compensating control before being added.
- If `xlsx` becomes fixable, this guard must fail until the dependency is upgraded/replaced or the residual policy is removed.
- Keep this guard registered in `scripts/run-architecture-smoke.js` so CI/deploy run the same security baseline.

回归 / Regression:

- `node --test scripts/check-backend-security-audit.test.js`
- `npm run security:audit`
- `npm run test:architecture`

### `scripts/check-backend-security-audit.test.js`

状态 / Status: candidate

负责 / Owns:

- focused regression coverage for backend npm-audit residual policy
- coverage that unexpected vulnerabilities and fixable residuals fail the guard

公开命令 / Public Command:

- `node --test scripts/check-backend-security-audit.test.js`

### `scripts/verify-production-security-config.js`

状态 / Status: candidate

负责 / Owns:

- P12-006 production security posture evidence
- validating production secret strength without printing secret values
- validating independent ops JWT secret, bcrypt ops password hash, and `OPS_SESSION_VERSION` rotation
- validating explicit `ADMIN_USERS`, restricted `CORS_ORIGINS`, required config release gate, and named server/deploy credential owners
- inspecting Git remotes for embedded plaintext passwords and reporting only redacted URLs
- writing redacted JSON evidence with secret length and short SHA-256 fingerprints

公开命令 / Public Command:

- `npm run security:production`
- `node scripts/verify-production-security-config.js --env-file <path> --evidence <path>`

扩展方式 / Extension Path:

- Keep production policy checks aligned with `backend/config/SecurityConfig.js`, `backend/services/OpsAuthService.js`, `ConfigReleaseService.resolveRuntimeGatePolicy()`, and `adminMiddleware.parseUserList()`.
- New production security requirements should be added here with focused tests and a redacted evidence field.
- Do not print secret values; evidence may include configured flags, lengths, and short one-way fingerprints only.

回归 / Regression:

- `node --test scripts/verify-production-security-config.test.js`
- `npm run security:production -- --json`
- `npm run test:architecture`

### `scripts/verify-production-security-config.test.js`

状态 / Status: candidate

负责 / Owns:

- focused regression coverage for production security evidence checks
- dotenv parsing, secret strength policy, Git remote redaction, passing evidence, failing rotation/shared-secret evidence, and warning-only dev-admin review

公开命令 / Public Command:

- `node --test scripts/verify-production-security-config.test.js`

扩展方式 / Extension Path:

- Add a focused case whenever production security evidence policy changes.
- Use injected clean Git remote fixtures for passing tests so local development remotes do not hide real policy failures.

回归 / Regression:

- `node --test scripts/verify-production-security-config.test.js`
- `npm run test:architecture`

### `scripts/rotate-production-secrets.sh`

状态 / Status: candidate

负责 / Owns:

- guarded host-side production secret rotation entry
- updating the backend `.env` for `JWT_SECRET`, `OPS_JWT_SECRET`, `OPS_ADMIN_PASSWORD_HASH`, `OPS_SESSION_VERSION`, rotation id, and server/deploy credential owners
- running `scripts/verify-production-security-config.js` after rotation and writing evidence under deploy state
- optional PM2 restart through `RESTART_PM2=1`

公开命令 / Public Command:

- `ROTATION_CONFIRM=rotate-production-secrets bash scripts/rotate-production-secrets.sh`

扩展方式 / Extension Path:

- Keep the wrapper thin; policy belongs to `scripts/verify-production-security-config.js`.
- Keep destructive behavior behind explicit confirmation and avoid printing secret values.
- New host-side rotation steps must preserve evidence generation before restart is considered complete.

回归 / Regression:

- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

扩展方式 / Extension Path:

- Add focused cases whenever `scripts/check-backend-security-audit.js` changes residual policy or report parsing behavior.

回归 / Regression:

- `node --test scripts/check-backend-security-audit.test.js`
- `npm run test:architecture`

### `scripts/check-shell-scripts.js`

状态 / Status: candidate

负责 / Owns:

- project-owned shell script syntax guard
- locating `bash` from PATH or Git for Windows fallback paths
- running `bash -n` on `deploy.sh`, `scripts/pre-deploy-gate.sh`, `scripts/verify-deploy-hook.sh`, `scripts/rollback-deploy.sh`, `scripts/backup-runtime-state.sh`, `scripts/restore-runtime-state.sh`, `scripts/install-runtime-backup-cron.sh`, `scripts/verify-runtime-backup.sh`, `scripts/rotate-production-secrets.sh`, and `scripts/install-ops-agent-pm2.sh`

公开 API / Public API:

- `node scripts/check-shell-scripts.js`
- exported helpers for tests: `findBash()`, `checkScript()`

扩展方式 / Extension Path:

- Add new project-owned shell scripts to `SHELL_SCRIPTS` when they become deployment or CI entrypoints.
- Keep third-party scripts in `node_modules` out of this guard.
- If Windows tooling changes, update fallback paths with `check-shell-scripts.test.js` coverage.

回归 / Regression:

- `node --test scripts/check-shell-scripts.test.js`
- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

### `scripts/install-ops-agent-pm2.sh`

状态 / Status: candidate

负责 / Owns:

- host-side PM2 installation/restart wrapper for `backend/ops-agent/server.js`
- default localhost binding (`127.0.0.1:3101`) and fixed target PM2 app (`server`)
- preserving agent environment variables for `OPS_AGENT_PM2_APP`, `OPS_AGENT_BIND_HOST`, `OPS_AGENT_PORT`, and deploy-state path
- emitting the recommended same-origin `/ops-agent/` reverse-proxy snippet
- no direct public exposure and no secret generation ownership

公开 API / Public API:

- `bash scripts/install-ops-agent-pm2.sh`
- `START_PM2=0 bash scripts/install-ops-agent-pm2.sh`

扩展方式 / Extension Path:

- Keep the default bind host local; public access must remain a reverse-proxy/runbook decision.
- Deployment auto-restart behavior belongs in `deploy.sh`; this script remains the reusable host entrypoint.
- New required environment variables must be documented in `backend/README.md` and covered in `check-shell-scripts.test.js`.

回归 / Regression:

- `node --test scripts/check-shell-scripts.test.js`
- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

### `scripts/pre-deploy-gate.sh`

状态 / Status: candidate

负责 / Owns:

- shared local/CI/server deploy gate entry
- running `npm run test:architecture` before deploy
- optional dependency installation when `WXGAME_GATE_INSTALL=1`

公开 API / Public API:

- `bash scripts/pre-deploy-gate.sh [repoRoot]`

扩展方式 / Extension Path:

- New deploy-blocking local checks should be added to `npm run test:architecture` or invoked here only when they are truly deploy-specific.
- `deploy.sh` and GitHub Actions should keep using this same entrypoint.
- Contract tests are auto-discovered by `scripts/run-architecture-smoke.js`; deploy gate should not maintain a separate test list.

回归 / Regression:

- `npm run test:architecture`
- GitHub Actions workflow `.github/workflows/architecture-gate.yml`

### `scripts/verify-deploy-hook.sh`

状态 / Status: candidate

负责 / Owns:

- read-only production deploy hook verification
- checking `/home/git/wxgame.git` is a bare repo with the expected branch
- checking `hooks/post-receive` exists, is executable, is valid Bash, and points to the expected work tree/deploy script
- checking current deploy manifest commit reachability when `/opt/wxgame-workspace/.wxgame/current-deploy.json` exists

公开 API / Public API:

- `bash scripts/verify-deploy-hook.sh`
- environment overrides: `BARE_REPO_DIR`, `WORK_TREE`, `BRANCH`, `DEPLOY_STATE_DIR`, `HOOK_PATH`, `DEPLOY_SCRIPT`

扩展方式 / Extension Path:

- Keep this script read-only; deployment and rollback changes belong in `deploy.sh` or `rollback-deploy.sh`.
- New host topology assumptions should be explicit environment overrides with focused documentation.

回归 / Regression:

- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

### `scripts/rollback-deploy.sh`

状态 / Status: candidate

负责 / Owns:

- explicit deploy rollback entrypoint
- resolving a rollback branch/tag/commit in the server Git repo
- invoking `deploy.sh` with the resolved target commit
- appending rollback evidence to `/opt/wxgame-workspace/.wxgame/deploy.log`

公开 API / Public API:

- `bash scripts/rollback-deploy.sh <branch|tag|commit>`
- environment overrides: `REPO_GIT_DIR`, `WORK_TREE`, `DEPLOY_STATE_DIR`, `DEPLOY_SCRIPT`, `WXGAME_ROLLBACK_RUN_GATE`

扩展方式 / Extension Path:

- Rollback should keep reusing `deploy.sh` so PM2 restart, health checks, deploy manifest writing, and Cocos path protections stay single-sourced.
- Production rollback drills should record the target ref/commit and health-check result in the deploy log or operations notes.

回归 / Regression:

- `node --test scripts/check-shell-scripts.test.js`
- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

### `scripts/backup-runtime-state.sh`

状态 / Status: candidate

负责 / Owns:

- runtime backup entrypoint for save/config/deploy-state data
- online SQLite backup of `civilization.db` through `better-sqlite3` or sqlite CLI fallback
- copying shared config and deploy state into a staged backup directory, including production config release history and active pointer when they live under `deploy-state/config-release/`
- writing `backup-manifest.json`, archive `.tar.gz`, checksum, and retention pruning

公开 API / Public API:

- `bash scripts/backup-runtime-state.sh`
- environment overrides: `BACKEND_DIR`, `SHARED_DIR`, `DEPLOY_STATE_DIR`, `BACKUP_ROOT`, `DB_PATH`, `RETENTION_DAYS`, `BACKUP_LABEL`

扩展方式 / Extension Path:

- New runtime data roots should be added to the manifest and staged copy with tests in `check-shell-scripts.test.js`.
- If config release state ever moves outside deploy state, update backup, verify, restore, and P12 docs in the same change.
- Keep this script backup-only; restore behavior belongs in `restore-runtime-state.sh`.
- Production scheduling belongs to host cron/systemd or a runbook, while this script stays the deterministic command.

回归 / Regression:

- `node --test scripts/check-shell-scripts.test.js`
- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

### `scripts/restore-runtime-state.sh`

状态 / Status: candidate

负责 / Owns:

- explicit runtime restore entrypoint from a backup archive
- refusing destructive restore unless `WXGAME_RESTORE_CONFIRM=restore-runtime-state`
- pre-restore safety backup by default
- checksum verification when `.sha256` exists
- SQLite DB restore, WAL/SHM cleanup, shared config restore, optional deploy-state restore, and PM2 stop/restart boundary

公开 API / Public API:

- `WXGAME_RESTORE_CONFIRM=restore-runtime-state bash scripts/restore-runtime-state.sh <backup.tar.gz>`
- environment overrides: `BACKEND_DIR`, `SHARED_DIR`, `DEPLOY_STATE_DIR`, `BACKUP_ROOT`, `DB_PATH`, `PM2_APP_NAME`, `RESTORE_DEPLOY_STATE`, `ALLOW_RESTORE_WITHOUT_PM2_STOP`, `SKIP_PRE_RESTORE_BACKUP`

扩展方式 / Extension Path:

- Restore drills should run on non-production targets first and record archive path, manifest, restored DB/config checks, config release state checks when present, and health/API verification.
- Keep destructive directory cleanup scoped to explicit target directories and covered by script tests.
- Deploy-state restore remains opt-in so data restore does not silently rewrite release evidence.

回归 / Regression:

- `node --test scripts/check-shell-scripts.test.js`
- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

### `scripts/install-runtime-backup-cron.sh`

状态 / Status: candidate

负责 / Owns:

- runtime backup scheduling entrypoint
- installing or replacing the marked `WXGAME_RUNTIME_BACKUP` crontab line
- default backup schedule, backup root, retention, and backup log wiring
- keeping host scheduling explicit and reviewable instead of relying on manual memory

公开 API / Public API:

- `bash scripts/install-runtime-backup-cron.sh`
- environment overrides: `WORK_TREE`, `BACKUP_SCRIPT`, `BACKUP_ROOT`, `BACKUP_LOG`, `BACKUP_CRON_SCHEDULE`, `RETENTION_DAYS`, `CRON_MARKER`

扩展方式 / Extension Path:

- New scheduler implementations, such as systemd timers, should be separate scripts with the same marker/log/verify documentation.
- Keep this script idempotent: reruns replace the marked line instead of appending duplicates.
- Production installation should be followed by `bash scripts/verify-runtime-backup.sh` after the first scheduled or manual backup.

回归 / Regression:

- `node --test scripts/check-shell-scripts.test.js`
- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

### `scripts/verify-runtime-backup.sh`

状态 / Status: candidate

负责 / Owns:

- runtime backup health verification entrypoint
- selecting the latest `wxgame-runtime-*.tar.gz` archive
- checking max backup age, `.sha256`, required manifest/shared/deploy-state entries, config-release entries when deploy state includes them, and SQLite DB entry

公开 API / Public API:

- `bash scripts/verify-runtime-backup.sh`
- environment overrides: `BACKUP_ROOT`, `MAX_BACKUP_AGE_HOURS`, `REQUIRE_BACKUP_DB`

扩展方式 / Extension Path:

- New required backup contents must be checked here and covered in `check-shell-scripts.test.js`.
- If a non-production drill intentionally omits DB, set `REQUIRE_BACKUP_DB=0`; production verification should keep the default DB requirement.
- Alerting or cron monitoring should call this script rather than duplicating archive/checksum logic.

回归 / Regression:

- `node --test scripts/check-shell-scripts.test.js`
- `node scripts/check-shell-scripts.js`
- `npm run test:architecture`

### `scripts/profile-h5-performance.js`

状态 / Status: candidate

负责 / Owns:

- repeatable local H5 browser profiling evidence for P12-005
- local static frontend server with stub `/api/game/state`, `/api/game/heartbeat`, `/api/version`, `/api/client-events`, and action/task endpoints
- Playwright mobile/desktop viewport sampling over the real `frontend/index.html` entry
- simulated 2026 phone low/mid/flagship profiling through CPU throttling, mobile viewport/DPR/touch, browser-visible CPU/memory injection, V8 heap caps, and SwiftShader/low-end GPU flags
- navigation/resource timing, long task, RAF, canvas, screenshot pixel, console/page/request failure, API event, and client-event evidence
- JSON reports under `.local-logs/h5-performance/<runId>/profile.json`

公开 API / Public API:

- `npm run profile:h5-performance`
- `npm run profile:h5-phone-sim`
- `node scripts/profile-h5-performance.js`
- CLI flags: `--phone-sim`, `--viewports=<list>`, `--device-profiles=<list>`, `--sample-ms=<ms>`, `--wait-for-ready-ms=<ms>`
- environment overrides: `PROFILE_VIEWPORTS`, `PROFILE_DEVICE_PROFILES`, `PROFILE_PHONE_SIM`, `PROFILE_HEADLESS`, `PROFILE_SAMPLE_MS`, `PROFILE_TILE_RADIUS`, `PROFILE_OUTPUT_DIR`, and `PROFILE_MAX_*` / `PROFILE_MIN_*` budget variables
- exported helpers for tests or future contract checks: `createGameStatePayload()`, `createProfileServer()`, `collectBudgetFindings()`, `summarizeRaf()`, `parseViewports()`, `analyzePng()`

性能约束 / Performance Constraints:

- Hard failures cover broken boot/render paths: missing server state, API/script/style/asset/request/page/console failures, missing canvas, or blank/low-variance screenshots.
- Volatile browser timing stays warning-oriented where appropriate: long-task count and RAF p95 warn by default instead of replacing structural budgets with brittle FPS gates.
- Simulated-phone ready time above target can remain warning-only when server state and nonblank screenshots prove the app reached first render before the higher simulation cap.
- Benign `/api/version` aborts caused by closing a page after successful state application are recorded as ignored request failures rather than hard API failures.
- The 2026-06-11 simulated-phone pre-optimization baseline is `.local-logs/h5-performance/2026-06-11T08-40-57-526Z/profile.json`; it showed low-end `assets:preload` reached 100% at 12.60s but phase end was delayed to 27.44s by synchronous world-map cache prewarm.
- The 2026-06-11 deferred-prewarm sample is `.local-logs/h5-performance/2026-06-11T09-05-30-021Z/profile.json`; it passed hard budgets with low-end ready 14949ms, mid ready 9006ms, and flagship ready 4352ms, while low-end RAF/long-task warnings remained follow-up evidence.
- The 2026-06-11 current simulated-phone sample is `.local-logs/h5-performance/2026-06-11T09-23-29-025Z/profile.json`; after mobile water-refresh floors and H5 script-order coverage, it passed hard budgets with low-end ready 14790ms, navigation load 12495ms, RAF p95 250ms, and 82 long tasks; mid ready 8920ms with 19 long tasks; flagship ready 4175ms.
- The script is syntax-checked by `npm run test:architecture`, but the browser run remains an explicit evidence command.

扩展方式 / Extension Path:

- Add new stub API routes only when the real H5 boot path starts requiring them, and keep them close to backend response shapes.
- Add physical-device/online profiling as a separate command or option if a device becomes available; preserve this local deterministic simulation mode for regression comparison.
- Promote warning budgets to hard deploy blockers only after sampled evidence and P12 roadmap notes justify the threshold.
- Keep simulation limitations explicit: Chromium CPU throttling, SwiftShader GPU flags, navigator memory/core spoofing, and V8 heap caps are not equivalent to real phone thermals, drivers, OS memory pressure, or browser variance.

回归 / Regression:

- `node --check scripts/profile-h5-performance.js`
- `npm run profile:h5-performance`
- `npm run profile:h5-phone-sim`
- `npm run test:architecture`

### `scripts/loadtest-bot-heartbeat.js`

Status: candidate

Owns:

- controlled multiplayer BOT login and heartbeat load testing
- p50/p95/p99 heartbeat latency, timeout/error rate, and target-utilization summaries
- default 80% utilization target for the configured BOT account set
- no automatic production overload; thresholds fail the script when p95 or error rate exceeds limits

Public API:

- `node scripts/loadtest-bot-heartbeat.js --base-url <url> --bot-count <n> --concurrency <n> --rounds <n> --password <secret>`
- environment defaults: `LOADTEST_BASE_URL`, `LOADTEST_BOT_COUNT`, `LOADTEST_CONCURRENCY`, `LOADTEST_ROUNDS`, `BOT_ACCOUNT_PASSWORD`, `LOADTEST_TIMEOUT_MS`, `LOADTEST_TARGET_UTILIZATION`, `LOADTEST_MAX_P95_MS`, `LOADTEST_MAX_ERROR_RATE`

Extension Path:

- Host CPU/load integration should consume ops dashboard or ops-agent status before increasing concurrency; do not remove latency/error guardrails.
- BOT accounts must remain behind `ENABLE_BOT_ACCOUNTS=1`, `BOT_ACCOUNT_COUNT`, and `BOT_ACCOUNT_PASSWORD`.

Regression:

- `node --test scripts/loadtest-bot-heartbeat.test.js`
- `npm run test:architecture`

### `scripts/check-frontend-script-manifest.js`

状态 / Status: candidate

负责 / Owns:

- short-term guard for the hand-written H5 `frontend/index.html` script entry
- local script existence checks
- duplicate script path checks
- required `?v=` cache-busting checks
- critical dependency order checks

公开 API / Public API:

- `node scripts/check-frontend-script-manifest.js`

扩展方式 / Extension Path:

- Add only critical dependency pairs here while the project remains script-tag based.
- Long-term bundler/content-hash manifest should replace this short-term guard.

回归 / Regression:

- `node scripts/check-frontend-script-manifest.js`
- `npm run test:architecture`

### `scripts/check-repository-hygiene.js`

状态 / Status: candidate

负责 / Owns:

- tracked-file hygiene guard
- blocking tracked `.bak`, `.backup`, database, `.env`, key/certificate files, and local secret text files such as password/credential/secret notes

公开 API / Public API:

- `node scripts/check-repository-hygiene.js`

扩展方式 / Extension Path:

- Add new forbidden runtime artifact patterns here when deploy/playtest creates local files that must never enter Git.
- Do not use this script for generated source allow/deny decisions; keep it focused on secrets, backups, and runtime artifacts.

回归 / Regression:

- `node --test scripts/check-repository-hygiene.test.js`
- `node scripts/check-repository-hygiene.js`
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

### `frontend/js/platform/WorldMapRuntime.js` - 605 lines

状态 / Status: candidate facade

当前负责 / Currently Owns:

- world map camera state
- drag/pinch camera movement
- map bake runtime state and renderer cache invalidation side effects
- hit target sync
- render requests
- world-map input action map integration
- fail-closed tap resolution when `WorldMapInputActionMap` is unavailable; renderer hit targets remain input evidence, not dispatch fallback authority
- `dispatchAction()` result preservation for routed tap actions, including Promise rejection from shell/app action dispatch
- monotonic world-map input sequence assignment before delegating compact intent creation to `WorldMapInputIntent`
- HUD-to-world-layer point conversion for background/fog march target inference; this adds physical layer padding and removes temporary drag-layer transform before calling `WorldMapInputActionMap`
- bake policy delegation through `WorldMapRuntimeBakePolicy`
- camera policy delegation through `WorldMapRuntimeCameraPolicy`
- input geometry delegation through `WorldMapRuntimeInputPolicy`
- hit target collection and snapshot replacement policy delegation through `WorldMapRuntimeHitTargetPolicy`
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
- `dispatchAction(action, event, meta)`
- `requestRender(options)`
- `render(options)`
- `getLayerPointFromHudPoint(point)`
- `getBackgroundMarchTargetAction(point)`

目标拆分 / Target Split:

1. Keep runtime focused on camera/bake/input runtime compatibility state.
2. Done: P9-001 moved map signature generation, signature sync result derivation, and pure bake-dirty checks into `WorldMapRuntimeBakePolicy`.
3. Done: P9-002 moved initial camera normalization, camera UI-state composition, UI camera sync, camera change resolution, drag math, baked-camera offset, and drag-layer hit-target offsets into `WorldMapRuntimeCameraPolicy`.
4. Done: P9-003 moved input-layout availability, map input rectangle fallback resolution, and point-in-map bounds checks into `WorldMapRuntimeInputPolicy`.
5. Done: P9-003b moved renderer hit-target collection and empty snapshot preservation decisions into `WorldMapRuntimeHitTargetPolicy`.
6. Done: P9-004 moved pure render decisions into `WorldMapRuntimeRenderPolicy` and render-flow orchestration into `WorldMapRuntimeRenderPipeline`.

当前扩展方式 / Extension Path Now:

- Add pure camera/drag calculations through `WorldMapRuntimeCameraPolicy`.
- Add render-flow side effects through `WorldMapRuntimeRenderPipeline`.
- Add new world-map input mapping through `WorldMapInputActionMap`.
- Add compact input evidence shape and id derivation through `WorldMapInputIntent`; runtime should only hold the per-runtime monotonic input sequence.
- Runtime tap dispatch must preserve async action results; do not convert `onAction(...Promise...)` to immediate `true`.
- Add pure world-map input geometry through `WorldMapRuntimeInputPolicy`.
- Add pure hit-target collection and snapshot replacement rules through `WorldMapRuntimeHitTargetPolicy`.
- Add map-bake signature or dirty-check changes through `WorldMapRuntimeBakePolicy`.
- Add pure render context, throttle, renderer option, and trace payload changes through `WorldMapRuntimeRenderPolicy`.
- Do not add gameplay simulation, rendering details, or new diagnostic payload schemas.

### `frontend/js/state/presenters/WorldTileMapPresenter.js` - 408 lines

状态 / Status: candidate facade

负责 / Owns:

- map-level normalized world tile map view-state composition
- world tile-map signature composition across territory/world-explorer state
- compatibility delegation for `normalizeWorldTile()`
- compatibility delegation for world-explorer mission/planned tile/planned site helpers
- `TileCoord`-backed map merge keys and cache signatures for raw world tiles, planned tiles, territory sites, legacy scout routes/reveal areas, and scout-area coords

重要公开方法 / Important Public Methods:

- `getWorldTileMapSignature(territoryState, worldExplorerState, options)`
- `normalizeWorldTile(tile, siteById)`
- `normalizeWorldExplorerMission(mission)`
- `getWorldExplorerMissions(worldExplorerState, options)`
- `getWorldExplorerPlannedTiles(worldExplorerState, options)`
- `getWorldExplorerPlannedSites(worldExplorerState, options)`
- `normalizeCoord(coord, fallback)`
- `summarizeTileForSignature(tile)`
- `summarizeSiteForSignature(site)`
- `summarizeScoutMissionForSignature(mission)`
- `summarizeExplorerMissionForSignature(mission)`
- `buildWorldTileMapViewState(territoryState, options)`

目标拆分 / Target Split:

1. Done: P8-001 extracted tile/site/terrain/template/water/intel normalization to `WorldTileMapTileNormalizer`.
2. Done: P8-002 extracted explorer mission normalization, mission merge/time derivation, planned tile/site filtering, and tile-id creation to `WorldTileMapExplorerNormalizer`.
3. Future visibility/exploration state changes should land under P1 domain modules before this facade composes the view state.

当前扩展方式 / Extension Path Now:

- Single-tile normalization extends `WorldTileMapTileNormalizer`.
- World-explorer mission/planned tile/planned site normalization extends `WorldTileMapExplorerNormalizer`.
- Map-level merge identity and map-bake signatures must consume the normalizers' `TileCoord` contract; do not restore raw `tile.id || tile_${q}_${r}` merge keys or raw-shape signature payloads here.
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
| 2026-06-12 | Drag snapshot refresh now commits the baked camera on success and snapshot-only layer refresh publishes the current `lastWorldTileMapContext`, keeping `worldMap`, `worldFog`, and `worldActor` on one camera frame. Actor-layer handoff now promotes the freshly rendered layer context over stale runtime caches, with anchor-coordinate regressions for shell, app bridge, facade, and runtime pipeline paths. |
| 2026-06-08 | Added `WorldMapInputActionMap` candidate module for pure world-map input-to-action mapping and wired `WorldMapRuntime` to delegate hit-target filtering/background march target inference. |
| 2026-06-08 | Added `WorldExplorerDtoMapper` candidate module as the backend world explorer API DTO boundary; `WorldExplorerClientState` delegates response shape after explicit runtime advancement. |
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
| 2026-06-08 | Added `WorldMapScoutRenderer` candidate module for P3-011; `WorldMapCanvasRenderer` delegates scout route drawing. Legacy scout unit helpers were retired on 2026-06-14. |
| 2026-06-08 | Added `WorldMapWaterEntryRenderer` candidate module for P3-012; `WorldMapCanvasRenderer` now delegates water entry filtering and draw handoff. |
| 2026-06-08 | Added `WorldMapSiteOverlayRenderer` candidate module for P3-013; `WorldMapCanvasRenderer` now delegates world-site modal/action overlays and occupied-city command overlay helpers. |
| 2026-06-08 | Added `WorldMapMilitaryViewRenderer` candidate module for P3-014; `WorldMapCanvasRenderer` delegates military world-view panel composition. Legacy radar fallback was retired on 2026-06-14. |
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
| 2026-06-08 | Added `CanvasFamousActionHandlers`, the now-deleted `CanvasTalentPolicyActionHandlers`, and `CanvasShellActionHandlers` for the original P4 split; current frontend talent allocation/policy UI now belongs to `CityPeopleCanvasRenderer` and city-management people flows. |
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
| 2026-06-09 | Added `WorldChunkAddress`, `WorldInterestWindow`, and `WorldRevealStore` for P11-004 large-map streaming contracts; H5/minigame entrypoints and `npm run test:architecture` now include the new candidate modules. |
| 2026-06-09 | Added `CommandAuthorityContract`, `ServerTimelineSnapshot`, and `AoiSyncSnapshot` for P11-005 realtime authority contracts; world-march stop is now server-timeline derived, territory scout/conquest/claim actions attach authority envelopes, and `npm run test:architecture` includes realtime focused tests. |
| 2026-06-09 | Added `ConfigRegistryContract` for P11-006 config/version hardening phase 1; `TaskDefinitionNormalizer` and `BuildingConfig` now expose registry metadata/validation while preserving legacy gameplay/import fields, and `npm run test:architecture` includes the config registry focused test. |
| 2026-06-09 | Added `ServerRandomAuthorityContract` for P11-006 config/random hardening phase 2; territory scout outcome and site template rolls now consume backend-authoritative random sources instead of default `Math.random`, and `npm run test:architecture` includes the random authority focused test. |
| 2026-06-09 | Added `FamousPersonRandomAuthority` for P11-006 config/random hardening phase 3; famous-person candidate generation now consumes backend-authoritative random sources by default, exposes compact `source.randomAuthority` metadata, preserves deterministic injection for tests, and is included in `npm run test:architecture`. |
| 2026-06-09 | Added `DefenderLeaderRandomAuthority` for P11-006 config/random hardening phase 4; defender-leader generation now consumes backend-authoritative random sources by default, exposes compact `source.randomAuthority` metadata, preserves deterministic injection for tests, and is included in `npm run test:architecture`. |
| 2026-06-09 | Added `WorldMapGenerationAuthority` for P11-006 config/random hardening phase 5; world-map terrain, water, river, and scout-reveal branch materialization now consume a server-owned deterministic seeded-hash authority while `WorldMapShared.random01()` remains a compatibility wrapper. `WorldMapService` now attaches compact `generationAuthority` metadata, and `npm run test:architecture` includes `WorldMapArchitecture.test.js`. |
| 2026-06-09 | Added `SkillGeneratorRandomAuthority` for P11-006 config/random hardening phase 6; skill ability-kit generation now consumes backend-authoritative random sources by default, exposes compact `randomAuthority` metadata, preserves deterministic injection for tests, and is included in `npm run test:architecture`. |
| 2026-06-09 | Added registry metadata/validation for core backend config modules: `GameConfig`, `EraConfig`, `TutorialFlowConfig`, `BattleConfig`, and `TechTreeConfig`; `npm run test:architecture` now syntax-checks those config modules and `ConfigRegistryContract.test.js` verifies their registry contracts. |
| 2026-06-09 | Removed remaining business-code `Math.random` usage by moving talent-policy custom policy ids to backend crypto entropy; `TalentPolicyService.test.js` is included in `npm run test:architecture`. |
| 2026-06-09 | P11-006 is now documented as complete for current config/version/random hardening. Future chance/drop/generated-result domains must add explicit authority adapters when introduced. P3 renderer split modules remain `candidate` while their completed `done` plan status reflects implementation completion, not stable promotion. |
| 2026-06-09 | Added `docs/production_engineering_roadmap_2026-06-09.md` as the P12 production-engineering authority, registered it in the official doc set, and documented the next CI/deploy/observability/backup/performance/security/config/stable-promotion/runbook guardrails. |
| 2026-06-09 | Deleted the standalone `TalentPolicyCanvasRenderer` panel. Follow-up migration deleted the legacy frontend `openTalentPolicy` shortcut handler; city people/talent-policy UI is owned by `CityPeopleCanvasRenderer` inside city management. |
| 2026-06-10 | Hardened the mature engine canvas layer contract: `CanvasLayerRegistry` now owns physical stack, logical render queue, and hit priority queue; `mainHud` is locked to the primary input canvas, while `worldMap` and optional `worldFog` remain non-input secondary layers. `H5CanvasRuntime.test.js` is now part of `npm run test:architecture`. |
| 2026-06-10 | Moved map-home march HUD ownership back to the `mainHud` pass: `WorldMapTileMapRenderer` now publishes world HUD context and keeps only map/site/actor targets, while `HudOverlayCanvasRenderer` / `CanvasFrameRenderer` invoke `renderWorldMarchHud()` and prefer same-frame HUD context over stale runtime context. |
| 2026-06-10 | Fixed world-map input/HUD command contracts: `WorldMapRuntime.getLayerPointFromHudPoint()` converts `mainHud` taps into padded world-layer coordinates while subtracting drag-layer transform, `WorldMarchHudCanvasRenderer` shows stop only for active actors, and return-home now accepts idle parked world-march missions. |
| 2026-06-11 | Split backend game-state structural normalization, explicit runtime advancement, and read-only client projection. `GameStateProjectionArchitecture.test.js` now guards that action/reset responses use normalized-only DTOs, projection does not advance explorer/territory runtime state, and downstream City/Tech/Talent/Famous/WorldMap helpers expose read-only projection APIs for already-normalized snapshots. |
| 2026-06-11 | Closed world-map layer ownership P0-001: `worldMap` now publishes context and map-owned targets only, `worldActor` owns actor drawing and actor hit targets, `mainHud` owns march command HUD invocation, and `WorldMapLayerOwnershipContract.test.js` is registered in `npm run test:architecture`. |
| 2026-06-11 | Closed backend query/persistence P0-002/P0-003 for current scope: `GET /api/game/state` and `GET /api/game/tasks` are read-only projections, `GameStateRepository.save()` is transaction-backed through `saveAtomic()`, `revision` detects stale writes, and `resetPlayerState()` clears shared-world ownership in the same transaction. |
| 2026-06-11 | Closed frontend request/polling P1 current scope: `GameAPI` now owns timeout, request ids, structured errors, and safe-method retry; `GameStateSync` and `UpdateChecker` now own failure backoff windows; their focused tests are registered in `npm run test:architecture`. |
| 2026-06-11 | Closed admin/security P1/P2 current scope: `adminMiddleware` separates admin authorization from auth, `SecurityConfig` enforces production JWT/CORS configuration, and `H5AuthStorageAdapter` no longer stores or returns plaintext remembered passwords. |
| 2026-06-11 | Added production gates for CI/deploy and repo/frontend hygiene: `.github/workflows/architecture-gate.yml`, `scripts/pre-deploy-gate.sh`, `scripts/check-frontend-script-manifest.js`, and `scripts/check-repository-hygiene.js` are now documented and registered in the architecture baseline. |
| 2026-06-11 | Continued P12/P1 deploy-version hardening: `/api/version` now has a route module with ETag/304 semantics, `VersionService` reads deploy manifest metadata, `GameAPI` reuses `/version` ETag cache, `deploy.sh` writes fixed deploy state/log files, and `run-architecture-smoke.js` auto-discovers contract tests. |
| 2026-06-11 | Continued P12-003 observability current scope: added `ObservabilityService`, `metricsRoutes`, and `clientEventsRoutes` for in-memory backend/API/frontend metrics, `/api/health` observability summary, authenticated admin `/api/metrics`, `POST /api/client-events`, and alert threshold codes for 5xx rate, slow requests, action failures, and frontend load failures. |
| 2026-06-11 | Continued P12-002 release/deploy governance: `deploy.sh` now accepts deployable branch/tag/commit refs, `scripts/verify-deploy-hook.sh` verifies server hook wiring read-only, `scripts/rollback-deploy.sh` provides an explicit rollback entry, and shell syntax guard covers all project-owned deploy scripts. |
| 2026-06-11 | Continued P12-004 backup/restore current script scope: added `scripts/backup-runtime-state.sh` and `scripts/restore-runtime-state.sh` for runtime DB/shared/deploy-state archives, checksum/manifest/retention handling, strong restore confirmation, pre-restore safety backups, and shell syntax/test coverage. |
| 2026-06-11 | Extended P12-004 backup operations: added `scripts/install-runtime-backup-cron.sh` and `scripts/verify-runtime-backup.sh` for marked cron installation, backup log/root/retention wiring, latest archive age/checksum/content verification, and shell syntax/test coverage. |
| 2026-06-11 | Continued P12-005 performance/capacity current budget-contract scope: added backend `PerformanceCapacityBudget`, extended frontend `WorldMapPerformanceBudget` for renderer frame/window/chunk work, wired observability `PERFORMANCE_BUDGET_EXCEEDED`, persisted save budget summaries in `saveMetadata.performanceCapacity`, and registered focused tests in `npm run test:architecture`. |
| 2026-06-11 | Extended P12-005 local profiling evidence: added `scripts/profile-h5-performance.js` and `npm run profile:h5-performance` to run real H5 boot/render through a stub API, collect mobile/desktop browser timing/canvas/screenshot/API evidence, and write `.local-logs/h5-performance/<runId>/profile.json`; the 2026-06-11 local sample passed hard budgets with a mobile long-task warning. |
| 2026-06-11 | Extended P12-005 simulated phone profiling: added `npm run profile:h5-phone-sim` and 2026 phone low/mid/flagship profiles using Chromium CPU throttling, mobile viewport/DPR/touch, browser-visible CPU/memory injection, V8 heap caps, and SwiftShader/low-end GPU flags; `.local-logs/h5-performance/2026-06-11T08-40-57-526Z/profile.json` passed hard budgets with low-end long-task/RAF warnings. |
| 2026-06-11 | Continued P12-005 simulated low-end attribution: moved world-map tile metrics/mask/dry-template cache prewarm out of H5 startup blocking preload and into `worldMapRenderer.scheduleWorldTileCachePrewarm()` background chunks, then added mobile water-refresh floors shared by `CanvasGameShellWorldMapRuntimePolicy` and `CanvasGameAppRenderScheduler`. `.local-logs/h5-performance/2026-06-11T09-23-29-025Z/profile.json` passed hard budgets with low-end ready 14790ms, mid ready 8920ms, flagship ready 4175ms, and remaining warning-level RAF/long-task evidence. |
| 2026-06-11 | Continued P12-007 config pipeline current local gate: added `ConfigPipeline`, `scripts/validate-config-pipeline.js`, `npm run config:validate`, and `docs/config_registry_snapshot_2026-06-11.json` baseline diff evidence for 7 config registries; `npm run test:architecture` now blocks registry schema/hash/entry/version drift without a satisfying version bump. |
| 2026-06-11 | Continued P12-007 config release audit scope: added `ConfigReleaseService` plus admin `/api/admin/config-releases`, `/active`, `/runtime-status`, `/preview`, `/publish`, and `/rollback` routes for audit-only release history, active release pointer, active-vs-current registry drift status, rollback records, and startup release gate policy. |
| 2026-06-11 | Continued P12-007 runtime bundle consumption: added `ConfigRuntimeLoader` to build a read-only payload bundle only after active release gate match, validate payload hashes against the active snapshot, and expose loader readiness through health/admin status; `GameplayConfigRuntime` now consumes game/building/era/tutorial/tech-tree payloads for core gameplay with module fallback only in observe modes. |
| 2026-06-11 | Added `frontend/tools/config-release-console.html` as the P12-007 standalone admin console for active release/history, runtime drift status, preview, audit-only publish, and rollback actions; it stays outside the main H5 boot chain and does not hot-load gameplay config. |
| 2026-06-11 | Added `docs/6月11日重构与问题交接.md` as the official daily handoff for the production-engineering sequence through `08639bab`, replacing the prior temporary refactor/progress/issue handoff notes while recording local/server validation, dual-remote sync, server hook anomaly resolution, backup/restore drill evidence, config release publish/rollback evidence, and production `CONFIG_RELEASE_GATE=required` health. |
| 2026-06-11 | Closed current host evidence for P12-004 and P12-007: installed runtime backup cron, verified real backup/restore drill, moved production config release state under `.wxgame/config-release`, verified post-required-gate backup contents, published config releases A/B, rolled back B -> A, restored active B, and restarted production healthy with `CONFIG_RELEASE_GATE=required` on `08639bab086d5d87ebb7445a043ffb72cc88754c`. |
| 2026-06-11 | Continued P12-006/P12-009 operations hardening: production Node was upgraded to `20.20.2`, PM2 was reinstalled under Node 20, `better-sqlite3@12.10.0` was rebuilt, backend engines now require Node 20, and `OpsControlService` plus `/api/admin/ops/*`, maintenance middleware, and `/tools/ops-console.html` provide a protected admin operations console for status, soft maintenance, audited PM2 restart, and ops audit evidence. |
| 2026-06-12 | Fixed P12-009 ops dashboard health false negatives: `OpsControlService` now defaults dashboard health to a `local-process` summary assembled from version, observability, config runtime, loader, and gameplay runtime status; `OPS_HEALTH_URL` remains only an explicit external probe override, and regression asserts the default dashboard does not run `curl`. |
| 2026-06-12 | Added P12-006 production security evidence and guarded rotation mechanisms: `scripts/verify-production-security-config.js`, `npm run security:production`, `scripts/rotate-production-secrets.sh`, and focused tests now validate redacted secret strength evidence, independent ops JWT, `OPS_SESSION_VERSION` rotation, explicit admin/CORS/config gate posture, server/deploy credential ownership, Git remote password hygiene, and repository blocking for local secret text files. |
| 2026-06-12 | Added P12-009 minimum external ops-agent: `backend/ops-agent/*`, `scripts/install-ops-agent-pm2.sh`, deploy auto-restart for an existing `wxgame-ops-agent`, and `/tools/ops-console.html` Agent panel provide a localhost-bound, ops-authenticated, fixed-PM2-app hard stop/start/restart control plane with audit records. |
| 2026-06-12 | Split multiplayer runtime sync into gateway plus local soft services: `server.js` no longer owns active-player world ticks, `backend/world-worker.js` runs `WorldWorkerService` as PM2 app `wxgame-world-worker`, `PresenceService` absorbs heartbeat-scale online state with persistence throttling, `AuthService` caches player-existence checks for heartbeat bursts, and `scripts/loadtest-bot-heartbeat.js` provides controlled BOT login/heartbeat load-test evidence with an 80% utilization target. |
| 2026-06-14 | Added stable world-map input correlation identity: `WorldMapInputIntent` now preserves or derives compact `inputId`, `WorldMapRuntime` assigns monotonic `clientSequence`, `GameAPI` and `CommandAuthorityContract` keep those fields in compact evidence, and `CommandReplayCorrelation` matches request id, input id, compact client input, and authority command id. |
| 2026-06-14 | Tightened `CommandReplayCorrelation` request-id matching: when an API request id exists, local client operation-log entries must match that exact id and may not fall back to the latest input entry, preventing high-frequency or multiplayer replay audits from guessing by time. |
| 2026-06-14 | Hardened `WorldMapInputIntent.toSerializable()` as a whitelist boundary: externally supplied intent-like objects are re-summarized before export so renderer, native event, tileMapView, and thenable payloads cannot enter input evidence. |
| 2026-06-14 | Hardened `WorldMapInputIntent` tile evidence: action and target summaries now consume `TileCoord` when target coordinates are present, so stale caller-supplied `tileId` cannot pollute local replay or backend command evidence. |
| 2026-06-14 | Hardened `WorldMapInputActionMap` background known-tile lookup: inferred background tiles now match current `tileMapView.tiles` by normalized coordinates and emit canonical `tileId`, so colliding raw tile ids cannot redirect march target coordinates or terrain evidence. |
| 2026-06-14 | Hardened `WorldRevealStore` fallback coordinate identity: revealed records now derive fallback tile ids from `x/y` or `q/r` even when `TileCoord` is unavailable, so stale persisted `tileId` / `id` values cannot become store index keys. |
| 2026-06-14 | Hardened `TileMapGeometry` fallback coordinate identity: geometry fallback normalization now derives tile ids from `x/y` or `q/r`, so renderer geometry paths cannot preserve stale raw `tileId` / `id` values when `TileCoord` is unavailable. |
| 2026-06-14 | Hardened backend world-map tile write-boundary identity: `WorldMapTiles.createTile()` / `normalizeTile()` and `WorldMapBatch.mergeTiles()` now derive public tile ids from display coordinates, so stale caller, persisted, or merge-time `id` values cannot become authoritative world-map tile identity. |
| 2026-06-14 | Hardened world tile-map presenter coordinate identity: `WorldTileMapTileNormalizer`, `WorldTileMapExplorerNormalizer`, and `WorldTileMapPresenter` now consume `TileCoord` for raw tiles, planned tiles/sites, route/reveal entries, and scout-area coords; canonical tile ids override renderer/raw legacy ids in presenter view-state composition. |
| 2026-06-14 | Hardened runtime map-bake fallback signatures: `WorldMapRuntimeBakePolicy` now consumes `TileCoord` for fallback compact summaries when the presenter is unavailable, so stable `x/y` and legacy `q/r` shapes produce the same bake signature. |
| 2026-06-14 | Hardened march actor identity: `WorldMarchProgressSnapshot`, `WorldActorProjection`, and `WorldMapRenderSnapshot.normalizeMarchTarget()` now consume `TileCoord`, so stale caller-supplied `id/tileId` cannot override stable `x/y` in mission rows, returned-home actor projection, or march target UI state. |
| 2026-06-14 | Hardened visibility/entity/fog identity: `WorldMapVisibilityModel`, `WorldMapEntitySnapshot`, and `WorldFogVisualSnapshot` now consume `TileCoord`, so stale caller-supplied `id/tileId` cannot override stable `x/y` in visibility arrays, entity indexes, or fog visual signatures. |
