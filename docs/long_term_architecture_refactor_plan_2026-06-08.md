# 长期架构重构计划 / Long-Term Architecture Refactor Plan

日期 / Date: 2026-06-08

状态 / Status: active

范围 / Scope: frontend H5/minigame runtime, world map, gameplay simulation boundary, backend API/service boundary, regression workflow.

## 0. 文档规范 / Documentation Convention

本计划和配套技术文档统一使用“中文为主 + 英文模块/API/架构关键词对照”的风格：

- 中文解释设计意图和推进策略。
- English identifiers stay unchanged, for example `FeatureFlags.isEnabled()` and `CanvasLayerRegistry`.
- 标题和关键字段尽量使用双语，例如 `目标 / Goal`、`回归 / Regression`。
- 每次推进后，同步更新本计划和 `architecture_module_responsibility_index_2026-06-08.md`。

## 1. 目标 / Goal

The project is moving from feature-first iteration to long-term operation architecture. The target is not to keep patching around legacy structure. The target is to build stable, testable "blocks" that can be extended without repeatedly modifying the same low-level files.

The refactor must keep the game runnable after every step. Every step below has an explicit rollback surface and regression test target.

## 2. 不可妥协规则 / Non-Negotiable Rules

### 2.1 模拟不进渲染器 / Simulation Does Not Live In Renderers

Renderers may draw, animate, cache visual assets, expose hit targets, and report render context. They must not own authoritative gameplay state such as ownership, exploration, march progress, combat result, city economy, or unlock rules.

### 2.2 稳定积木对功能迭代关闭 / Stable Blocks Are Closed For Feature Iteration

Once a block is declared stable, new gameplay features must extend it through:

- registries
- strategy objects
- system pipelines
- adapters
- events
- config
- narrow public methods
- new files next to the block

Feature work must not edit stable block internals.

Allowed exceptions:

- bug fix
- performance fix
- security fix
- contract hardening
- test-only repair after an external contract changes

When an exception happens, the commit or task note must say why the stable block was reopened.

### 2.3 优先 ECS 风格模块，不急着上重型 ECS 框架 / Prefer ECS-Style Modules, Not A Heavy ECS Framework Yet

The project should move toward ECS-like modularity:

- entities are plain IDs plus data
- components are serializable data
- systems read/write explicit component sets
- render adapters consume snapshots

Do not introduce a full third-party ECS framework before the current state ownership is cleaned up. The first phase should be an "ECS-lite" internal architecture so the team can stabilize contracts before adding framework dependency.

### 2.4 功能开关是架构工具 / Feature Flags Are Architecture Tools

Risky or unfinished systems must be behind explicit feature flags. Disabled systems should not allocate render layers, bind input behavior, mutate runtime state, or affect default smoke tests.

### 2.5 回归优先 / Regression First

Each refactor step must have at least one focused regression command. A step is not done if it only compiles but has no behavior lock.

## 3. 目标架构 / Target Architecture

### 3.1 分层 / Layers

```text
backend/config + backend/domain
  -> backend/services
  -> API DTO
  -> frontend/domain snapshot normalizers
  -> frontend/application controllers
  -> frontend/platform shell and runtime adapters
  -> renderers
```

Direction must stay one-way. Renderers do not call backend services. Backend services do not know canvas layout.

### 3.1b 成熟引擎画布层契约 / Mature Engine Canvas Layer Contract

Canvas layering follows the same separation used by mature engines: physical surface stack, logical render queue, hit priority queue, animation category, input surface, and debug surface are independent contracts.

Physical canvas stack:

| Layer | zIndex | Context | Camera Space | Input | Lifecycle |
| --- | ---: | --- | --- | --- | --- |
| `worldMap` | 997 | `2d` | `world` | no | secondary layer via `ensureLayerCanvas()` |
| `worldFog` | 998 | `webgl` | `world-overlay` | no | feature-gated visual plugin |
| `mainHud` | 999 | `2d` | `screen` | yes | primary canvas via `ensureCanvas()` |

Logical render queue:

```text
worldPanel -> terrain -> water -> routes -> sites -> fogMask -> actors -> worldHud -> screenHud -> floatingControls -> panels -> modals -> tutorial -> feedback -> debug
```

Hit priority queue:

```text
mapBackground -> mapTile -> mapSite -> mapActor -> worldHud -> screenHud -> floatingControls -> panel -> modal -> tutorialShield -> debug
```

Contract rules:

- `CanvasLayerRegistry` owns the layer metadata, physical order, render order, hit order, and comparison helpers.
- `CanvasGameShell.ensureCanvasLayer('mainHud')` must reuse the primary input canvas, not allocate a secondary layer.
- `worldHud` is a logical render/hit queue bucket rendered on `mainHud`; the physical `worldMap` layer publishes map/HUD context only and must not draw input-capable HUD controls.
- New renderer work must either fit an existing queue bucket or update the registry and tests first.
- New visual plugins must not own gameplay truth or input capture.
- `npm run test:architecture` must include the registry tests and H5 canvas stack tests.

### 3.2 前端运行时边界 / Frontend Runtime Boundary

The frontend should be split into these responsibilities:

- `domain`: pure rules and data transforms, runnable in Node tests.
- `systems`: gameplay systems that transform snapshots or commands.
- `state`: presenters and normalizers that convert API state into UI-ready state.
- `application`: controllers that own user intent and command dispatch.
- `platform`: H5/minigame runtime adapters, canvas shell, input routing, scheduling.
- `renderers`: drawing only, with caches and visual hit targets.
- `config`: feature flags, visual constants, manifest keys.

### 3.3 世界地图目标 / World Map Target

World map should become a separate feature island:

- `WorldMapRuntime` owns camera and baked-layer runtime state.
- world entities are data-only: tiles, sites, armies, missions, visibility.
- map simulation systems own exploration, marching, visibility, ownership, encounters.
- map renderers receive a render snapshot and do not infer gameplay truth.
- fog of war is a pluggable visual system, disabled until visibility rules are stable.

### 3.4 后端目标 / Backend Target

Backend should move toward:

- pure calculators for resource, combat, exploration, and progression rules
- services that orchestrate persistence and commands
- DTO mappers that define public API shape
- versioned migrations for saved game state
- deterministic test fixtures for each core loop

### 3.5 存档、调试、性能目标 / Save, Debug, Perf Target

Save data should contain serializable domain state, not renderer objects or temporary canvas runtime state.

Debug and performance tools should be toggled through config or dev-only adapters, not hard-coded inside renderers.

## 4. 稳定积木契约 / Stable Block Contract

A stable block needs:

- a clear owner file or folder
- public input/output contract
- focused tests
- no direct dependency on unrelated UI or renderer internals
- extension point for future iteration
- changelog entry when it becomes stable

Promotion rule:

- A module cannot be promoted from `candidate` to `stable` until it passes the product/architecture invariants in `docs/stable_block_promotion_matrix_2026-06-09.md`.
- The stable surface should freeze confirmed long-term mechanisms, not unfinished gameplay tuning.
- For world-map modules, stable contracts must use diamond isometric square-tile language. Historical `q/r` fields are compatibility aliases, not hex/axial public semantics.
- For realtime and multiplayer modules, stable contracts must keep the backend authoritative and separate server timeline, AOI sync, and frontend interpolation.

Suggested block lifecycle:

1. `experimental`: internal shape can change.
2. `candidate`: public contract exists, tests are added.
3. `stable`: feature iteration must extend instead of editing.
4. `archived`: replaced by a newer block; kept only for compatibility.

## 5. 优先级路线图 / Priority Roadmap

### P0 - 让当前游戏安全进入重构 / Make The Current Game Safe To Refactor

P0 work removes high-risk coupling and creates regression locks. The game must remain playable after each item.

| ID | 步骤 / Step | 结果 / Outcome | 回归 / Regression |
| --- | --- | --- | --- |
| P0-001 | Freeze fog of war by default | Main world map runs without fog layer allocation or fog renderer calls. Fog code remains available behind a feature flag. | `node --test frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js` |
| P0-002 | Add architecture status doc checkpoint | Every active refactor step records status, owner files, rollback surface, and tests. | documentation review + `git diff --check` |
| P0-003 | Define frontend feature flag contract | Feature flags are centralized under `GameConfig.FEATURES`, resolved through `FeatureFlags`, and passed into shell/app constructors. | `node --test frontend/js/config/FeatureFlags.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P0-004 | Lock render shell responsibilities | `CanvasGameShell` owns canvas layer lifecycle through `CanvasLayerRegistry`; renderers keep drawing responsibilities. The layer contract now follows mature engine separation: physical canvas stack, logical render queue, hit priority queue, single input surface, and debug-last ordering. | `node --test frontend/js/platform/CanvasLayerRegistry.test.js frontend/js/platform/H5CanvasRuntime.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P0-004b | Shell world-map runtime policy | `CanvasGameShellWorldMapRuntimePolicy` owns pure shell world-map snapshot option, device-aware water-frame timing, layer padding, drag cooldown, drag transform limit, drag offset, and frame option calculations. `CanvasGameShellWorldMapRuntime` delegates these policies while retaining shell/coordinator/render side effects, dropping to 455 lines. | `node --test frontend/js/platform/CanvasGameShellWorldMapRuntimePolicy.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P0-004c | Shell world-map runtime split | `CanvasGameShellWorldMapLayerBridge` owns layer metrics, fog dispatch, layer transform/visibility, and snapshot refresh; `CanvasGameShellWorldMapDragRuntime` owns shell drag water-time/cooldown/compositor helpers; `CanvasGameShellWorldMapFrameRuntime` owns world-map frame requests, fallback layer rendering, and water timer orchestration. `CanvasGameShellWorldMapRuntime` keeps coordinator/render decision integration only and drops to 122 lines as a candidate facade. | `node --test frontend/js/platform/CanvasGameShellWorldMapLayerBridge.test.js frontend/js/platform/CanvasGameShellWorldMapDragRuntime.test.js frontend/js/platform/CanvasGameShellWorldMapFrameRuntime.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P0-005 | Inventory oversized modules | `architecture_module_responsibility_index_2026-06-08.md` lists completed modules, legacy modules above 500 lines, public APIs, extension paths, and split order. | documentation review |
| P0-006 | Add architecture baseline command set | `npm run test:architecture` runs registered candidate/stable architecture syntax checks, focused tests, and `git diff --check`. `smoke` remains the historical script filename, but the command is the required baseline regression gate. | `npm run test:architecture` |

### P1 - 抽取稳定玩法积木 / Extract Stable Gameplay Blocks

P1 work starts moving rules into stable, pure modules.

| ID | 步骤 / Step | 结果 / Outcome | 回归 / Regression |
| --- | --- | --- | --- |
| P1-001 | World map visibility domain model | `WorldMapVisibilityModel` produces compact serializable visibility snapshots independent from rendering. | `node --test frontend/js/domain/WorldMapVisibilityModel.test.js` |
| P1-002 | World map entity/component snapshot | `WorldMapEntitySnapshot` exposes normalized tiles, sites, missions, and actors over compact indexes. | `node --test frontend/js/domain/WorldMapEntitySnapshot.test.js` |
| P1-003 | March system boundary | `WorldMarchProgressSnapshot` owns march progress, actors, and arrival rows; UI/renderers consume snapshot outputs instead of deriving authoritative results. | `node --test frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/domain/WorldMarchSystem.test.js` |
| P1-003b | March geometry boundary | `WorldMarchGeometry` owns pure tile screen projection, nearest-tile lookup, axial point inference, and march target UI-state normalization. `WorldMarchSystem` keeps compatibility method names and delegates geometry helpers, dropping to 53 lines as a candidate facade. | `node --test frontend/js/domain/WorldMarchGeometry.test.js frontend/js/domain/WorldMarchSystem.test.js` |
| P1-004 | World map render snapshot adapter | `WorldMapRenderSnapshot` normalizes tile map view, frame, viewport, UI state, render flags, march actors, and arrivals into one renderer input contract. | `node --test frontend/js/domain/WorldMapRenderSnapshot.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P1-005 | Input action map | `WorldMapInputActionMap` maps world-map hit targets/background taps into named actions before runtime or gameplay handling. | `node --test frontend/js/domain/WorldMapInputActionMap.test.js frontend/js/platform/WorldMapRuntime.test.js` |
| P1-006 | Backend DTO mapper cleanup | `WorldExplorerDtoMapper` owns world explorer API DTO shape; client state orchestration calls progression then mapper. | `node --test backend/tests/WorldExplorerDtoMapper.test.js backend/tests/WorldExplorerArchitecture.test.js` |

### P2 - 通过扩展点重新接入高级系统 / Reintroduce Advanced Systems Through Extension Points

P2 work adds richer gameplay after core boundaries are stable.

| ID | 步骤 / Step | 结果 / Outcome | 回归 / Regression |
| --- | --- | --- | --- |
| P2-001 | Rebuild fog of war as plugin system | `WorldFogVisualSnapshot` and `WorldMapVisualPluginRegistry` let fog consume visibility/render snapshots without gameplay authority. Fog remains default-off. | `node --test frontend/js/domain/WorldFogVisualSnapshot.test.js frontend/js/platform/WorldMapVisualPluginRegistry.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js` |
| P2-002 | Debug overlay registry | `DebugOverlaySnapshot` and `DebugOverlayRegistry` expose FPS, map bake state, visibility, and input traces as default-off pure debug rows. | `node --test frontend/js/domain/DebugOverlaySnapshot.test.js frontend/js/platform/DebugOverlayRegistry.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P2-003 | Asset manifest hardening | `AssetKeyRegistry` defines stable asset keys for common UI/world/battle resources; `CanvasPreloadAssetManifest` now composes preload paths from keys while preserving legacy path output. | `node --test frontend/js/config/AssetKeyRegistry.test.js frontend/js/platform/renderers/CanvasPreloadAssetManifest.test.js` |
| P2-004 | Save migration pipeline | `GameStateMigrationPipeline` upgrades legacy saves to `saveMetadata.schemaVersion`, records applied migrations, and runs before normalizer/service derived state. | `node --test backend/tests/GameStateMigrationPipeline.test.js backend/tests/GameStateServiceSplit.test.js` |
| P2-005 | Performance budget gates | `WorldMapPerformanceBudget` adds code-level structural gates for large world-map snapshots: compact arrays, O(1) indexes, bounded serializable payloads, and no copied renderer tile payloads. | `node --test frontend/js/domain/WorldMapPerformanceBudget.test.js` |

### P3 - 缩小遗留大文件 / Shrink Legacy Large Files

P3 work turns oversized compatibility files into thin facades. Each split extracts a pure or narrow module first, keeps the old public methods, and adds focused tests before moving more drawing or action behavior.

| ID | 步骤 / Step | 结果 / Outcome | 回归 / Regression |
| --- | --- | --- | --- |
| P3-001 | World map layout/cache model | `WorldMapLayoutModel` owns pure tile center, draw rect, overlay anchor, site layout, visible entry, static cache, chunk cache, and drag cache layout calculations. `WorldMapCanvasRenderer` keeps compatibility methods and delegates layout/cache math to the model. | `node --test frontend/js/platform/renderers/WorldMapLayoutModel.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-002 | World map hit-target model | `WorldMapHitTargetModel` owns pure background drag, site, and march tile hit-target data creation. `WorldMapCanvasRenderer` keeps registration methods and delegates target calculation to the model. | `node --test frontend/js/platform/renderers/WorldMapHitTargetModel.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-003 | World map cache policy | `WorldMapCachePolicy` owns pure cache key, pixel-budget layout selection, chunk prune order, water chunk frame IDs, and snapshot draw layout policy. `WorldMapCanvasRenderer` keeps canvas cache creation/rendering and delegates policy decisions. | `node --test frontend/js/platform/renderers/WorldMapCachePolicy.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-004 | World map layer cache store | `WorldMapLayerCacheStore` owns reusable offscreen layer work creation, named cache resize/reuse, and clipped cache blit helpers. `WorldMapCanvasRenderer` delegates generic cache work/draw helpers while keeping layer render content. | `node --test frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js` |
| P3-005 | World map static layer renderer | `WorldMapStaticLayerRenderer` owns static tile layer and scout route cache render orchestration. `WorldMapCanvasRenderer` keeps compatibility methods and delegates static/scout layer rendering to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapStaticLayerRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-006 | World map water layer renderer | `WorldMapWaterLayerRenderer` owns animated water frame cache, water chunk frame cache, fast-drag reuse, and water animation timing orchestration. `WorldMapCanvasRenderer` keeps compatibility methods and delegates water layer orchestration to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapWaterLayerRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-007 | World map static chunk renderer | `WorldMapStaticChunkRenderer` owns static chunk cache work creation/reuse, chunk repaint, draw, and stale prune orchestration. `WorldMapCanvasRenderer` keeps compatibility methods and delegates static chunk rendering to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapStaticChunkRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-008 | World map snapshot cache renderer | `WorldMapSnapshotCacheRenderer` owns snapshot-only cache redraw orchestration for layer caches and chunk caches, including fog-mask refresh after successful snapshot redraw. `WorldMapCanvasRenderer` keeps compatibility methods and delegates snapshot cache rendering to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-009 | World map fast-drag composite renderer | `WorldMapFastDragCompositeRenderer` owns fast-drag composite cache signature, cache rebuild, temporary render-context swap, and composite blit orchestration for scout/water/static layer caches. `WorldMapCanvasRenderer` keeps compatibility methods and delegates fast-drag composite cache rendering to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-010 | World map static entry renderer | `WorldMapStaticEntryRenderer` owns static tile entry drawing orchestration: fallback terrain, selection outlines, terrain features, tile features, site drawing, overlay shadow/asset helpers, and site hit-target registration during static repaint. `WorldMapCanvasRenderer` keeps compatibility methods and delegates static entry rendering to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-011 | World map scout renderer | `WorldMapScoutRenderer` owns scout route line/marker drawing and legacy scout unit route/progress/frame helpers. `WorldMapCanvasRenderer` keeps compatibility methods and delegates scout route helper rendering to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapScoutRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-012 | World map water entry renderer | `WorldMapWaterEntryRenderer` owns the linear water-entry draw loop and delegates pixel/texture drawing to `drawWorldTileWater()`. `WorldMapCanvasRenderer` keeps the compatibility method and delegates water entry rendering to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapWaterEntryRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-013 | World map site overlay renderer | `WorldMapSiteOverlayRenderer` owns world-site dialog view-state fallback, site action buttons, expedition config controls, occupied-city command overlays, anchor lookup, and city-command hit-target action mapping. `WorldMapCanvasRenderer` keeps compatibility methods and delegates site overlay rendering to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-014 | World map military view renderer | `WorldMapMilitaryViewRenderer` owns the military world-view panel composition, tile-map branch, reset controls, empty exploration fallback, and legacy radar fallback site hit targets. `WorldMapCanvasRenderer` keeps `renderMilitaryWorldView()` as a compatibility method and delegates world-view composition to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-015 | World map fog mask context renderer | `WorldMapFogMaskContextRenderer` owns fog-mask context capture, fog reveal entry filtering, and `lastWorldFogContext` host publication. `WorldMapCanvasRenderer` keeps compatibility methods and delegates fog context handoff to the split renderer while fog visuals remain feature-gated/default-off. | `node --test frontend/js/platform/renderers/WorldMapFogMaskContextRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-016 | World map tile-map renderer | `WorldMapTileMapRenderer` owns one-frame world tile-map orchestration: render snapshot context creation/publication, panel/clip setup, drag target registration, snapshot-only redraw, hit-target-only pass for map/site/actor targets, world-layer render ordering, HUD context publication, and fast-drag state restoration. `WorldMapCanvasRenderer` keeps `renderWorldTileMap()` as a compatibility method and delegates the frame flow. | `node --test frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-017 | World map actor/HUD renderer | `WorldMapActorHudRenderer` owns world-map actor derivation from march missions/render snapshots, actor render/hit-target handoff, march HUD state publication, nearest-tile lookup, and epoch-now resolution. Actual map-home march HUD rendering is consumed by the `mainHud` pass through `HudOverlayCanvasRenderer` / `CanvasFrameRenderer`; world-map layers must not call it during map rendering. `WorldMapCanvasRenderer` keeps compatibility actor/HUD methods and delegates them to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapActorHudRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-018 | World map layout facade | `WorldMapLayoutFacade` owns compatibility layout/cache helper delegation and fallback behavior around `WorldMapLayoutModel`: projection, draw rects, overlay anchors, site layout, local/visible entry caches, static cache layouts, chunk layouts, drag cache layouts, and rendered diamond centers. `WorldMapCanvasRenderer` keeps old helper method names as short pass-throughs. | `node --test frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-019 | World map cache facade | `WorldMapCacheFacade` owns compatibility cache helper delegation and fallback behavior around `WorldMapCachePolicy` and `WorldMapLayerCacheStore`: static/scout cache keys, named layer cache context reuse, temporary layer work, clipped layer blits, and static cache layout resolution. `WorldMapCanvasRenderer` keeps old cache helper method names as short pass-throughs. | `node --test frontend/js/platform/renderers/WorldMapCacheFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCachePolicy.test.js frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js` |
| P3-020 | World map hit-target facade | `WorldMapHitTargetFacade` owns compatibility hit-target registration and fallback behavior around `WorldMapHitTargetModel`: site targets, march tile targets, target registration, injected layout/model dependencies, and old hit-target helper pass-throughs. `WorldMapCanvasRenderer` keeps old hit-target helper method names as short pass-throughs. | `node --test frontend/js/platform/renderers/WorldMapHitTargetFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapHitTargetModel.test.js` |
| P3-021 | World map render utility facade | `WorldMapRenderUtilityFacade` owns compatibility render utility helpers: fallback iso diamond drawing, terrain fallback colors, deterministic hash, and deterministic `random01()`. `WorldMapCanvasRenderer` keeps old utility helper method names as short pass-throughs for split renderers. | `node --test frontend/js/platform/renderers/WorldMapRenderUtilityFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js` |
| P3-022 | World map cache config facade | `WorldMapCacheConfigFacade` owns compatibility cache performance knobs: static chunk size, chunk cache limit/scale, drag cache pan range, static cache scale, and static cache pixel budget. `WorldMapCanvasRenderer` keeps old config helper names as short pass-throughs so cache/layout modules consume one centralized performance config boundary. | `node --test frontend/js/platform/renderers/WorldMapCacheConfigFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/platform/renderers/WorldMapCacheFacade.test.js` |
| P3-023 | World map renderer dependency registry | `WorldMapRendererDependencyRegistry` owns the `global`/CommonJS dependency lookup table for `WorldMapCanvasRenderer`: config/domain modules, renderer facades, split renderers, actor/HUD renderers, and tutorial unit renderer. `WorldMapCanvasRenderer` now consumes one registry-backed dependency object instead of embedding repeated `try require` blocks. | `node --test frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCacheConfigFacade.test.js` |
| P3-024 | World map renderer composition factory | `WorldMapRendererCompositionFactory` owns `WorldMapCanvasRenderer` child-host creation and child renderer/facade composition: actor renderer, march HUD renderer, actor HUD renderer, layout/render/cache/hit-target facades, layer renderers, overlay renderers, fog context renderer, and tile-map renderer. `WorldMapCanvasRenderer` now delegates composition and keeps only facade pass-throughs. | `node --test frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-025 | World map renderer host bridge | `WorldMapRendererHostBridge` owns the compatibility proxy between `WorldMapCanvasRenderer` and its legacy host: renderer-first reads, host fallback reads, `worldTile*` host state passthrough, and known host field writes. `WorldMapCanvasRenderer` now delegates host bridging instead of constructing the proxy inline. | `node --test frontend/js/platform/renderers/WorldMapRendererHostBridge.test.js frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |

### P4 - 缩小动作控制器 / Shrink Action Controller

P4 work keeps the historical `CanvasActionController.handle_*` surface compatible while moving domain-specific action handlers into focused modules.

| ID | 步骤 / Step | 结果 / Outcome | 回归 / Regression |
| --- | --- | --- | --- |
| P4-001 | Territory action handler boundary | `CanvasTerritoryActionHandlers` owns territory/world-site/world-march/expedition/battle-scene action handlers and installs them onto `CanvasActionController` as compatibility methods. `CanvasActionController` remains the dispatch facade and drops from 1727 to 1208 lines. | `node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P4-002 | City action handler boundary | `CanvasCityActionHandlers` owns city-management/event/task-center/city-selection/building/tech/task-reward/building-list action handlers and installs them onto `CanvasActionController` as compatibility methods. `CanvasActionController` remains the dispatch facade and drops from 1208 to 797 lines. | `node --test frontend/js/platform/CanvasCityActionHandlers.test.js frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P4-003 | Famous action handler boundary | `CanvasFamousActionHandlers` owns famous-person panel/detail/search/accept/dismiss/attribute/page actions and installs legacy `handle_*` methods onto `CanvasActionController`. | `node --test frontend/js/platform/CanvasFamousActionHandlers.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P4-004 | Talent policy action handler boundary | `CanvasTalentPolicyActionHandlers` owns the legacy `openTalentPolicy` compatibility route into city management people tab and direct `applyTalentPolicy` finalization helpers. The standalone talent-policy canvas panel was deleted; talent allocation now happens in the entered-city people tab. | `node --test frontend/js/platform/CanvasTalentPolicyActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js` |
| P4-005 | Shell action handler boundary | `CanvasShellActionHandlers` owns tab switching, command/resource/settings/logs/advisor/guidebook/army-formation/auth/reset/logout/naming modal actions. `CanvasActionController` is now a 226-line dispatch/helper facade. | `node --test frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/CanvasGameApp.test.js` |

### P5 - Shrink Canvas Game Renderer

P5 work keeps the historical `CanvasGameRenderer` public render/helper surface compatible while moving composition and facade method installation out of the root renderer.

| ID | Step | Outcome | Regression |
| --- | --- | --- | --- |
| P5-001 | Canvas game renderer composition factory | `CanvasGameRendererCompositionFactory` owns child renderer dependency resolution, injected instance precedence, construction with the game renderer host, child renderer ordering, and presenter sync helpers. `CanvasGameRenderer` delegates composition and drops from 2003 to 1638 lines. | `node --test frontend/js/platform/CanvasGameRendererCompositionFactory.test.js frontend/js/platform/renderers/CanvasFrameRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P5-002 | Canvas game renderer core facades | `CanvasGameRendererCoreFacades` installs the core surface/asset/world-tile-water/famous compatibility methods onto `CanvasGameRenderer`. It owns delegate fallback behavior and H5/minigame load-order coverage; `CanvasGameRenderer` drops to 1144 lines. | `node --test frontend/js/platform/CanvasGameRendererCoreFacades.test.js frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/renderers/CanvasAssetRenderer.test.js frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js` |
| P5-003 | Canvas game renderer page facades | `CanvasGameRendererPageFacades` installs page, panel, HUD, world-map-layer, command, tutorial, tech, building, event, city, home, overlay, advisor, and frame compatibility methods onto `CanvasGameRenderer`. `CanvasGameRenderer` is now a 303-line compatibility facade. | `node --test frontend/js/platform/CanvasGameRendererPageFacades.test.js frontend/js/platform/renderers/CanvasFrameRenderer.test.js frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js` |

### P6 - Shrink Tutorial Guide Controller

P6 work keeps the historical `TutorialGuideController` surface compatible while moving pure step policy, target resolution, and phase-specific guide branches into focused modules.

| ID | Step | Outcome | Regression |
| --- | --- | --- | --- |
| P6-001 | Tutorial guide step policy | `TutorialGuideStepPolicy` owns tutorial step constants, tab access rules, and guide-active range predicates. `TutorialGuideController` keeps the legacy `TUTORIAL_STEPS` static API and delegates pure step gating to the policy. | `node --test frontend/js/tutorial/TutorialGuideStepPolicy.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/GameCommandService.test.js` |
| P6-002 | Tutorial target resolver | `TutorialGuideTargetResolver` owns canvas target lookup, retry-after-render highlight dispatch, rect normalization, viewport visibility checks, and open-world-site highlight dispatch. `TutorialGuideController` preserves its compatibility helper methods and delegates target resolution. | `node --test frontend/js/tutorial/TutorialGuideTargetResolver.test.js frontend/js/tutorial/TutorialGuideController.test.js` |
| P6-003 | Tutorial phase highlight installer | `TutorialGuidePhaseHighlights` owns the historical `refreshCurrentHighlight()` phase branching for first-era, farm, era2, scout, first-city, post-naming, and final-tech guide highlights. It installs the compatibility method onto `TutorialGuideController`. | `node --test frontend/js/tutorial/TutorialGuidePhaseHighlights.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/GameCommandService.test.js` |
| P6-004 | Tutorial UI state coordinator | `TutorialGuideUiStateCoordinator` owns guide UI state helper methods for command panel cleanup, soft guide dialogue state, army formation editor reset, guided map/capital focus, building guide visibility, resources guide visibility, and generic building guide display. `TutorialGuideController` drops to 665 lines as a candidate orchestration facade. | `node --test frontend/js/tutorial/TutorialGuideUiStateCoordinator.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/GameCommandService.test.js` |

### P7 - Shrink Canvas Game App Rendering Runtime

P7 work keeps the historical `CanvasGameAppRenderingRuntime` install surface compatible while moving render policy, scheduling, and world-map runtime bridge behavior into focused modules.

| ID | Step | Outcome | Regression |
| --- | --- | --- | --- |
| P7-001 | Canvas game app render policy | `CanvasGameAppRenderPolicy` owns map-home view-state resolution, tab order, and preferred military-view selection from guide state. `CanvasGameAppRenderingRuntime` delegates pure render policy decisions. | `node --test frontend/js/platform/CanvasGameAppRenderPolicy.test.js frontend/js/platform/CanvasGameApp.test.js` |
| P7-002 | Canvas game app render scheduler | `CanvasGameAppRenderScheduler` owns injected clock/wait/interval/requestAnimationFrame helpers and frame-duration defaults, delegating world-map water timing to `CanvasGameShellWorldMapRuntimePolicy` when available. `CanvasGameAppRenderingRuntime` delegates timing behavior and tile-map water timer setup. | `node --test frontend/js/platform/CanvasGameAppRenderScheduler.test.js frontend/js/platform/CanvasGameApp.test.js` |
| P7-003 | Canvas game app world-map runtime bridge | `CanvasGameAppWorldMapRuntimeBridge` installs world-map runtime, drag snapshot, baked-layer refresh, and coordinator compatibility methods onto `CanvasGameApp`. `CanvasGameAppRenderingRuntime` is now a 666-line candidate render orchestration facade. | `node --test frontend/js/platform/CanvasGameAppWorldMapRuntimeBridge.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js` |

### P8 - Shrink World Tile Map Presenter

P8 work keeps the historical `WorldTileMapPresenter` and `UIStatePresenter` surfaces compatible while moving tile and explorer normalization into focused presenter helpers.

| ID | Step | Outcome | Regression |
| --- | --- | --- | --- |
| P8-001 | World tile map tile normalizer | `WorldTileMapTileNormalizer` owns pure terrain/site/template/water/intel normalization for individual world tiles. `WorldTileMapPresenter.normalizeWorldTile()` delegates to it and `WorldTileMapPresenter` drops to 479 lines. | `node --test frontend/js/state/presenters/WorldTileMapTileNormalizer.test.js frontend/js/state/UIStatePresenter.test.js` |
| P8-002 | World tile map explorer normalizer | `WorldTileMapExplorerNormalizer` owns world-explorer mission merging/time derivation, planned tile/site filtering, coordinate normalization, and tile-id creation. `WorldTileMapPresenter` delegates explorer mission/planned tile/site helpers and drops to 319 lines as a candidate map view-state composer. | `node --test frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js frontend/js/state/presenters/WorldTileMapTileNormalizer.test.js frontend/js/state/UIStatePresenter.test.js` |

### P9 - Shrink World Map Runtime

P9 work keeps the historical `WorldMapRuntime` runtime API compatible while moving pure bake/input/camera/render policy into focused modules.

| ID | Step | Outcome | Regression |
| --- | --- | --- | --- |
| P9-001 | World map runtime bake policy | `WorldMapRuntimeBakePolicy` owns world-map data signature generation, signature sync result derivation, and pure bake-dirty checks. `WorldMapRuntime` delegates bake policy while keeping runtime logging, renderer cache invalidation, and compatibility methods, dropping to 565 lines. | `node --test frontend/js/platform/WorldMapRuntimeBakePolicy.test.js frontend/js/platform/WorldMapRuntime.test.js` |
| P9-002 | World map runtime camera policy | `WorldMapRuntimeCameraPolicy` owns initial camera normalization, camera UI-state composition, UI camera sync, camera change resolution, drag camera math, baked-camera offset, and drag-layer hit-target offset application. `WorldMapRuntime` delegates camera/drag pure calculations while keeping map guards, callbacks, hit-target sync, and render side effects, dropping to 541 lines. | `node --test frontend/js/platform/WorldMapRuntimeCameraPolicy.test.js frontend/js/platform/WorldMapRuntimeBakePolicy.test.js frontend/js/platform/WorldMapRuntime.test.js` |
| P9-003 | World map runtime input policy | `WorldMapRuntimeInputPolicy` owns pure input-layout availability, map input rectangle resolution, and point-in-map bounds checks. `WorldMapRuntime` delegates input geometry while keeping renderer/runtime state collection and drag/tap side effects, dropping to 491 lines. | `node --test frontend/js/platform/WorldMapRuntimeInputPolicy.test.js frontend/js/platform/WorldMapRuntime.test.js` |
| P9-004 | World map runtime render pipeline | `WorldMapRuntimeRenderPolicy` owns pure render context, throttling, renderer option, and trace payload derivation; `WorldMapRuntimeRenderPipeline` owns render-state publication, cannot-render reset, snapshot/full frame orchestration, and render trace dispatch. `WorldMapRuntime.render()` delegates to the pipeline and the runtime drops to 411 lines as a candidate facade. | `node --test frontend/js/platform/WorldMapRuntimeRenderPolicy.test.js frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js frontend/js/platform/WorldMapRuntime.test.js` |

### P10 - Shrink UI State Presenter

P10 work keeps the historical `UIStatePresenter` static API compatible while moving dependency resolution and static delegate installation into a focused facade module.

| ID | Step | Outcome | Regression |
| --- | --- | --- | --- |
| P10-001 | UI state presenter delegate registry | `UIStatePresenterDelegates` owns presenter dependency resolution, direct static delegate registration, and custom guidebook/home/tech facade delegates. `UIStatePresenter` becomes a 23-line candidate facade that only defines compatibility constants and installs delegates. | `node --test frontend/js/state/UIStatePresenterDelegates.test.js frontend/js/state/UIStatePresenter.test.js frontend/js/state/presenters/TechPresenter.test.js` |

### P11 - Stable Block Hardening

P11 work promotes only well-proven candidate modules into stable blocks after the product invariants are confirmed.

| ID | Step | Outcome | Regression |
| --- | --- | --- | --- |
| P11-001 | Stable promotion matrix | `stable_block_promotion_matrix_2026-06-09.md` records confirmed invariants for Canvas-only UI, diamond isometric full-wrapping world maps, chunk/window loading, reveal persistence, backend-authoritative commands, AOI sync, performance tiers, config versions, reproducible world generation, and season carryover boundaries. | documentation review + `npm run test:architecture` |
| P11-002 | Stable block guard manifest | `stable_block_manifest_2026-06-09.json` and `scripts/check-stable-blocks.js` define machine-readable stable files, allowed extension points, and allowed reopen reasons. Feature work must fail architecture checks if it edits stable internals without an explicit bug/perf/security/contract/governance exception. | `npm run test:architecture` |
| P11-002b | Official document set | `current_product_design_2026-06-09.md`, `current_gameplay_design_2026-06-09.md`, and `current_technical_architecture_2026-06-09.md` replace early v0.x design, handoff, release-note, and implementation-plan documents as the current authority. `scripts/verify-refactor-plan-doc.js` now guards the official doc set and obsolete-doc cleanup. | `npm run test:architecture` |
| P11-003 | Tile topology contract | Add `TileCoord`/`WorldTopology` contracts for diamond isometric square tiles, `x/y` or `col/row` stable coordinates, `q/r` compatibility aliases, and full-direction world wrapping. | focused topology tests + `npm run test:architecture` |
| P11-004 | Large-map streaming contract | Add `WorldChunkAddress`, `WorldInterestWindow`, and `WorldRevealStore` contracts so frontends render current windows and persistent revealed terrain without assuming a full world array. | focused large-map tests + `npm run test:architecture` |
| P11-005 | Realtime authority contract | Add `CommandAuthorityContract`, `ServerTimelineSnapshot`, and `AoiSyncSnapshot` so realtime movement, pending commands, AOI deltas, and interpolation stay backend-authoritative. | focused realtime contract tests + `npm run test:architecture` |
| P11-006 | Config/version hardening | Add config schema/version tooling for Excel/table-to-JSON registries, automatic minor version prompts, and server-authoritative random result boundaries. `ConfigRegistryContract` owns registry metadata, stable content hash, entry id validation, version comparison, and bump recommendations. Task definitions, building config, and core backend config domains (`GameConfig`, `EraConfig`, `TutorialFlowConfig`, `BattleConfig`, `TechTreeConfig`) expose registry metadata/validation. `ServerRandomAuthorityContract` owns random roll envelopes; territory scout outcome/template rolls, famous-person candidate generation, defender-leader generation, skill ability-kit generation, and deterministic world-map materialization now consume explicit backend authority modules while preserving deterministic test injection or seeded reproducibility. `TalentPolicyService` custom policy IDs now use backend crypto entropy. Business-code `Math.random` scan is clean. Battle reward output is currently deterministic formula logic, not a random migration target until chance drops/rewards are introduced. | `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js backend/tests/ServerRandomAuthorityContract.test.js backend/tests/WorldMapArchitecture.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/FamousPersonArchitecture.test.js backend/tests/SkillGeneratorArchitecture.test.js backend/tests/BattleArchitecture.test.js backend/tests/TalentPolicyService.test.js` + `npm run test:architecture` |

### P12 - 生产工程化 / Production Engineering

P12 work is documented in `docs/production_engineering_roadmap_2026-06-09.md`. It treats the completed P0-P11 architecture refactor as the local code baseline and adds production operation guardrails so the project does not fall back into undocumented deploys, unobservable runtime behavior, untested backups, or ungoverned config releases.

| ID | Step | Outcome | Regression |
| --- | --- | --- | --- |
| P12-001 | CI architecture gate | Run the architecture baseline before merge/deploy: syntax checks, focused candidate/stable tests, stable block guard, official doc guard, and `git diff --check`. | CI pass + `npm run test:architecture` |
| P12-002 | Release and deploy governance | Define release identity, deploy command, restart boundary, health check, rollback command, and deploy log location while preserving unrelated running services. | deploy dry-run or documented command verification |
| P12-003 | Observability and alerts | Track health endpoint state, backend errors, action failures, API latency, frontend asset/load failures, and alert thresholds. | health check test + observable sample output |
| P12-004 | Backup and restore | Current scope defines save/config/database backup schedule, retention, restore command, cron install, backup verification, and restore drill checklist; 2026-06-11 host evidence installed the cron marker, verified a production archive, restored a real archive to a non-production target, and confirmed post-required-gate backups include config release state. | restore drill on non-production target |
| P12-005 | Performance and capacity | Current scope covers world-map snapshots, renderer frame work, backend action latency, API payload size, save size, chunk/window behavior, repeatable local H5 browser profiling, and simulated 2026 phone low/mid/flagship profiling. | performance budget tests + sampled browser profiling when visual paths change |
| P12-006 | Security and access control | Harden admin/config/ops endpoints, deployment credentials, server access, API auth assumptions, secret handling, runtime version compatibility, and dependency audit remediation. Current runtime scope upgraded production to Node 20 and rebuilt `better-sqlite3`. | security checklist + focused auth tests |
| P12-007 | Config pipeline | Current scope validates registered config registries, snapshots `docs/config_registry_snapshot_2026-06-11.json`, compares schema/hash/entries/version against baseline, blocks missing recommended version bumps, and provides audit-only admin preview/publish/rollback/runtime-status release records plus a standalone admin console, health drift summary, startup release gate, read-only runtime bundle loader, and explicit gameplay runtime facade consumption for game/building/era/tutorial/tech config. 2026-06-11 host evidence completed publish A/B, rollback B -> A, active restoration, production `CONFIG_RELEASE_GATE=required`, and active-release bundle health. Future scope is adding new config domains through the same facade pattern. | `npm run config:validate` + config/release validation tests + registry diff output |
| P12-008 | Stable promotion CI | Require candidate observation notes, public contract, extension path, reopen exceptions, tests, and manifest updates for stable promotion. | stable guard + responsibility-index verification |
| P12-009 | Operations runbook | Document and expose deploy, rollback, logs, health checks, backup/restore, config publish, maintenance soft-stop, PM2 restart, and emergency disable switches. Current scope includes `/tools/ops-console.html` with independent ops-admin login through `/api/admin/ops/login`; dashboard health uses a default `local-process` summary and reserves `OPS_HEALTH_URL` for explicit external probes; true hard stop/start remains an external ops-agent/control-plane follow-up. | runbook command review |

## 6. P0-001 实施计划 / Implementation Plan

### 决策 / Decision

Fog of war is disabled by default. The current WebGL fog renderer remains in the repository and keeps its direct tests, but the default H5 shell must not allocate the `worldFog` layer or call fog render/transform behavior.

### 原因 / Why

The current fog path mixes rendering layer lifecycle with world map runtime behavior before the visibility model is stable. Keeping it active forces all world map refactor work to preserve an unstable visual system. Freezing it gives the project a clean base map for architecture work.

### 文件 / Files

- `frontend/js/config/GameConfig.js`
- `frontend/app.js`
- `frontend/js/platform/CanvasGameShell.js`
- `frontend/js/platform/CanvasGameShellMounting.js`
- `frontend/js/platform/CanvasGameShellWorldMapRuntime.js`
- `frontend/js/platform/CanvasGameShell.test.js`

### 验收 / Acceptance

- `GameConfig.FEATURES.FOG_OF_WAR_ENABLED` defaults to `false`.
- `CanvasGameShell` receives config through constructor/static mount.
- default shell mount creates `worldMap`, not `worldFog`.
- default drag compositor translates `worldMap`, not `worldFog`.
- explicit `FOG_OF_WAR_ENABLED: true` still creates a WebGL `worldFog` layer.
- existing `WorldFogCanvasRenderer` tests still pass.

### 回滚 / Rollback

Set `GameConfig.FEATURES.FOG_OF_WAR_ENABLED = true` or pass `{ config: { FEATURES: { FOG_OF_WAR_ENABLED: true } } }` to `CanvasGameShell`.

## 7. 回归策略 / Regression Policy

Every implementation step should finish with:

- syntax check for touched JS files
- focused unit tests for touched behavior
- `npm run test:architecture` before commit/deploy when the touched module is in the candidate/stable architecture baseline
- `git status --short`
- note in this document if the step changes architectural direction

代码层优先 / Code-Level First:

- 能用 Node tests、syntax checks、architecture baseline 闭环的步骤，不再要求开发者打开游戏手测。
- 只有当改动触达真实输入、Canvas 像素、浏览器兼容、资源加载或线上部署风险时，才把 browser/playtest 作为额外验收。
- 当改动触达教程高亮、Canvas hitTargets、遮罩、玩家可见按钮、线上 H5 路径或后端 action 反馈时，browser/playtest 不是额外可选项，而是准入门槛。必须使用 `scripts/playtest-online-tutorial.js` 生成 before/after screenshots、目标裁剪图、highlight 裁剪图、PNG 像素指标、中心点命中检查、API/authority 结果检查，并人工抽查关键截图。

命令选择 / Which Command To Run:

- Run the step's focused command first while developing; it is the fastest signal for the module you just changed.
- Run `npm run test:architecture` before commit/deploy. It must include every candidate/stable baseline module's syntax check and focused test as those modules enter the baseline.
- If a focused command is not yet registered in `scripts/run-architecture-smoke.js`, add it to `CHECK_FILES` and/or `TEST_FILES` in the same step that promotes the module into the baseline.
- P3-001 through P3-025 are done in this plan. Their modules remain `candidate` in the responsibility index until later feature work proves the contracts stable.
- Before promoting any module to `stable`, review `docs/stable_block_promotion_matrix_2026-06-09.md` and update the module's responsibility-index entry with the stable surface, extension path, and reopen exceptions.

P0-001 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/config/GameConfig.js
node --check frontend/app.js
node --check frontend/js/platform/CanvasGameShell.js
node --check frontend/js/platform/CanvasGameShellMounting.js
node --check frontend/js/platform/CanvasGameShellWorldMapRuntime.js
node --test frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js
```

P0-003 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/config/FeatureFlags.js
node --check frontend/js/config/FeatureFlags.test.js
node --test frontend/js/config/FeatureFlags.test.js frontend/js/platform/CanvasGameShell.test.js
```

P0-004 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/CanvasLayerRegistry.js
node --check frontend/js/platform/CanvasLayerRegistry.test.js
node --check frontend/js/platform/CanvasGameShell.js
node --check frontend/js/platform/CanvasGameShellMounting.js
node --check frontend/js/platform/CanvasGameShellWorldMapRuntime.js
node --test frontend/js/platform/CanvasLayerRegistry.test.js frontend/js/config/FeatureFlags.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js
```

P0-005 文档检查 / Suggested Review:

```powershell
git diff --check
```

必需文档同步 / Required Documentation Sync:

- Update `docs/architecture_module_responsibility_index_2026-06-08.md` whenever a module responsibility, public API, extension path, or stability status changes.
- Update this plan's current status table whenever a P0/P1/P2 step changes status.

架构基线回归 / Architecture Baseline Regression:

```powershell
npm run test:architecture
```

P1-003 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/domain/WorldMarchProgressSnapshot.js
node --check frontend/js/domain/WorldMarchSystem.js
node --test frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/domain/WorldMarchSystem.test.js
```

P1-004 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/domain/WorldMapRenderSnapshot.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/domain/WorldMapRenderSnapshot.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P1-005 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/domain/WorldMapInputActionMap.js
node --check frontend/js/platform/WorldMapRuntime.js
node --test frontend/js/domain/WorldMapInputActionMap.test.js frontend/js/platform/WorldMapRuntime.test.js
```

P1-006 快速命令 / Suggested Quick Command:

```powershell
node --check backend/services/worldExplorer/WorldExplorerDtoMapper.js
node --check backend/services/worldExplorer/WorldExplorerClientState.js
node --test backend/tests/WorldExplorerDtoMapper.test.js backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js backend/tests/GameStateServiceSplit.test.js
```

P2-001 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/domain/WorldFogVisualSnapshot.js
node --check frontend/js/platform/WorldMapVisualPluginRegistry.js
node --check frontend/js/platform/CanvasGameShellWorldMapRuntime.js
node --test frontend/js/domain/WorldFogVisualSnapshot.test.js frontend/js/platform/WorldMapVisualPluginRegistry.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js
```

P2-002 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/domain/DebugOverlaySnapshot.js
node --check frontend/js/platform/DebugOverlayRegistry.js
node --check frontend/js/platform/CanvasGameShell.js
node --test frontend/js/config/FeatureFlags.test.js frontend/js/domain/DebugOverlaySnapshot.test.js frontend/js/platform/DebugOverlayRegistry.test.js frontend/js/platform/CanvasGameShell.test.js
```

P2-003 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/config/AssetKeyRegistry.js
node --check frontend/js/platform/renderers/CanvasPreloadAssetManifest.js
node --test frontend/js/config/AssetKeyRegistry.test.js frontend/js/platform/renderers/CanvasPreloadAssetManifest.test.js
```

P2-004 快速命令 / Suggested Quick Command:

```powershell
node --check backend/services/GameStateMigrationPipeline.js
node --check backend/services/GameStateNormalizer.js
node --test backend/tests/GameStateMigrationPipeline.test.js backend/tests/GameStateServiceSplit.test.js
```

P2-005 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/domain/WorldMapPerformanceBudget.js
node --test frontend/js/domain/WorldMapPerformanceBudget.test.js
```

P3-001 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapLayoutModel.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapLayoutModel.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-002 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapHitTargetModel.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapHitTargetModel.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-003 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapCachePolicy.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapCachePolicy.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-004 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapLayerCacheStore.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js
```

P3-005 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapStaticLayerRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapStaticLayerRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-006 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapWaterLayerRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapWaterLayerRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-007 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapStaticChunkRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapStaticChunkRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-008 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-009 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-010 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapStaticEntryRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-011 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapScoutRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapScoutRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-012 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapWaterEntryRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapWaterEntryRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-013 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-014 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-015 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapFogMaskContextRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapFogMaskContextRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-016 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapTileMapRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-017 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapActorHudRenderer.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapActorHudRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-018 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapLayoutFacade.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-019 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapCacheFacade.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapCacheFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCachePolicy.test.js frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js
```

P3-020 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapHitTargetFacade.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapHitTargetFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapHitTargetModel.test.js
```

P3-021 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapRenderUtilityFacade.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapRenderUtilityFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js
```

P3-022 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapCacheConfigFacade.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapCacheConfigFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/platform/renderers/WorldMapCacheFacade.test.js
```

P3-023 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCacheConfigFacade.test.js
```

P3-024 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapRendererCompositionFactory.js
node --check frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

P3-025 快速命令 / Suggested Quick Command:

```powershell
node --check frontend/js/platform/renderers/WorldMapRendererHostBridge.js
node --check frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.js
node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js
node --test frontend/js/platform/renderers/WorldMapRendererHostBridge.test.js frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js
```

## 8. 当前状态 / Current Status

| ID | 状态 / Status | 备注 / Notes |
| --- | --- | --- |
| P0-001 | done | Fog of war is behind a default-off feature flag. Regression passed: `node --test frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js`. |
| P0-002 | done | This document is now the architecture checkpoint: completed P0 steps record status, changed boundary, and regression command. |
| P0-003 | done | `FeatureFlags` is the single frontend feature-flag resolver. Regression passed: `node --test frontend/js/config/FeatureFlags.test.js frontend/js/platform/CanvasGameShell.test.js`. |
| P0-004 | done | `CanvasLayerRegistry` defines shell-owned layer contracts plus mature engine physical stack, logical render queue, and hit priority queue. `mainHud` is locked as the primary screen/input canvas, while `worldMap` and optional `worldFog` remain secondary non-input layers. Regression passed: `node --test frontend/js/platform/CanvasLayerRegistry.test.js frontend/js/platform/H5CanvasRuntime.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/config/FeatureFlags.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js`. |
| P0-004b | done | Added `CanvasGameShellWorldMapRuntimePolicy` as the pure shell world-map runtime policy boundary. It owns snapshot render option resolution, water-frame timing, layer padding, drag cooldown/limit checks, drag offset/pan normalization, and runtime frame option derivation; `CanvasGameShellWorldMapRuntime` delegates these policies while retaining shell/coordinator/render side effects and dropped to 455 lines. Regression is included in `npm run test:architecture`. |
| P0-004c | done | Added `CanvasGameShellWorldMapLayerBridge`, `CanvasGameShellWorldMapDragRuntime`, and `CanvasGameShellWorldMapFrameRuntime` as focused shell world-map runtime boundaries. `CanvasGameShellWorldMapRuntime` now keeps coordinator/render decision integration only and dropped to 122 lines as a candidate facade. Regression is included in `npm run test:architecture`. |
| P0-005 | done | Added `architecture_module_responsibility_index_2026-06-08.md` with completed module responsibilities, unresolved legacy modules, public APIs, extension paths, and first split order. |
| P0-006 | done | Added `scripts/run-architecture-smoke.js` and `npm run test:architecture` for repeatable architecture baseline regression; `smoke` remains the historical script filename. |
| P1-001 | done | Added `WorldMapVisibilityModel` as a pure domain model for compact visibility snapshots. Performance constraint: parallel arrays + O(1) `indexById`, no renderer dependencies, no `JSON.stringify` signatures. Regression is included in `npm run test:architecture`. |
| P1-002 | done | Added `WorldMapEntitySnapshot` as a pure domain snapshot for tiles/sites/missions/actors. Performance constraint: flat entity arrays + O(1) per-kind indexes, no deep-copy entity maps. Regression is included in `npm run test:architecture`. |
| P1-003 | done | Added `WorldMarchProgressSnapshot` as a pure march boundary for mission progress rows, actor rows, and arrival result rows. `WorldMarchSystem` keeps its old public API as a compatibility facade for geometry/input helpers and delegates march calculation to the snapshot module. Performance constraint: flat arrays + O(1) indexes, incremental signatures, large-mission regression, no renderer dependencies. Regression is included in `npm run test:architecture`. |
| P1-003b | done | Added `WorldMarchGeometry` as the pure world-march geometry/input helper boundary. It owns tile screen projection, nearest rendered tile lookup, axial screen-point inference, and march target UI-state normalization; `WorldMarchSystem` keeps compatibility method names while delegating progress and geometry helpers and dropped to 53 lines as a candidate facade. Regression is included in `npm run test:architecture`. |
| P1-004 | done | Added `WorldMapRenderSnapshot` as the single world-map renderer input contract. `WorldMapCanvasRenderer.renderWorldTileMap()` now records `lastWorldTileMapContext.renderSnapshot` and consumes snapshot actors before falling back to legacy actor derivation. Performance constraint: no tile deep copy, compact counts/signature, renderer payload excluded from serializable output. Regression is included in `npm run test:architecture`. |
| P1-005 | done | Added `WorldMapInputActionMap` as a pure input-to-action mapper for world-map hit targets, background map taps, and march target inference. `WorldMapRuntime` now delegates hit-target selection, allowed-action filtering, and background march target action creation to this module. Performance constraint: linear reverse hit-test over filtered hit targets, no gameplay state mutation, no renderer dependencies beyond passed context. Regression is included in `npm run test:architecture`. |
| P1-006 | done | Added `WorldExplorerDtoMapper` as the backend API DTO boundary for world explorer missions/state. `WorldExplorerClientState` now performs progression orchestration and delegates public response shape to the mapper. Performance constraint: DTO mapping is linear over missions/routes/planned records, no persistence mutation in mapper, no API route dependency. Regression is included in `npm run test:architecture`. |
| P2-001 | done | Added `WorldFogVisualSnapshot` as the pure fog visual input contract and `WorldMapVisualPluginRegistry` as the feature-gated visual plugin boundary. `CanvasGameShell.renderWorldFogLayer()` now asks the registry for a fog renderer context when fog is explicitly enabled; default config still does not allocate or render fog. Performance constraint: fog visual data uses parallel arrays, O(1) `indexById`, incremental signatures, and no canvas/WebGL objects. Regression is included in `npm run test:architecture`. |
| P2-002 | done | Added `DebugOverlaySnapshot` as the pure debug row contract and `DebugOverlayRegistry` as the feature-gated overlay boundary. `CanvasGameShell.createDebugOverlaySnapshot()` can now produce selected debug rows only when `DEBUG_OVERLAYS_ENABLED` is explicitly true; default config remains silent. Performance constraint: disabled overlays return null, enabled snapshots use compact parallel arrays and do not store runtime/renderer objects. Regression is included in `npm run test:architecture`. |
| P2-003 | done | Added `AssetKeyRegistry` as the stable asset-key boundary for common UI/world-site/tech/building/tutorial/battle resources. `CanvasPreloadAssetManifest` now declares preload intent with keys and resolves to the same legacy paths for compatibility. Performance constraint: no runtime directory scan, no async discovery, frozen key lists, deterministic de-duped path output. Regression is included in `npm run test:architecture`. |
| P2-004 | done | Added `GameStateMigrationPipeline` as the backend save-schema migration boundary. `GameStateNormalizer.normalizeState()` now migrates raw saves before normalizing derived gameplay state, and new initial saves carry `saveMetadata`. `GameStateRepository` persists the metadata so migrations are idempotent after save. Performance constraint: migration is a bounded ordered pipeline, clones plain save data once, performs no DB/network/renderer work, and fails loudly on missing version steps. Regression is included in `npm run test:architecture`. |
| P2-005 | done | Added `WorldMapPerformanceBudget` as the large-map structural budget gate for visibility/entity/render snapshots. It checks tile/actor/site/mission budgets, parallel-array integrity, O(1) index maps, absence of nested entity maps, and bounded serializable render payload size. Performance constraint: no fragile FPS threshold, no browser required, deterministic code-level regression. Regression is included in `npm run test:architecture`. |
| P3-001 | done | Added `WorldMapLayoutModel` as the first P3 split from `WorldMapCanvasRenderer`. The model owns pure tile layout, overlay anchor, site layout, visible entry filtering, and static cache/chunk/drag cache layout calculations; `WorldMapCanvasRenderer` now delegates while preserving its public helper methods. Performance constraint: cache keys avoid serializing tile payloads, layout loops use indexed arrays, and no canvas/DOM/runtime objects enter the model. Regression is included in `npm run test:architecture`. |
| P3-002 | done | Added `WorldMapHitTargetModel` as the pure hit-target data boundary for world-map background drag, site taps, and march target tiles. `WorldMapCanvasRenderer` now delegates target calculation and only registers returned targets. Performance constraint: target generation is linear, reuses injected layout math, and does not touch canvas/DOM/runtime state. Regression is included in `npm run test:architecture`. |
| P3-003 | done | Added `WorldMapCachePolicy` as the pure cache policy boundary for static/scout/water cache keys, pixel-budget layout selection, chunk prune ordering, water chunk frame IDs, and snapshot draw layout math. `WorldMapCanvasRenderer` now delegates policy decisions while retaining canvas/offscreen work ownership. Performance constraint: no canvas/DOM/runtime mutation in policy, deterministic key strings, LRU prune list calculation without deleting active keys, and budget choice testable without browser rendering. Regression is included in `npm run test:architecture`. |
| P3-004 | done | Added `WorldMapLayerCacheStore` as the generic offscreen layer cache work boundary. It owns size normalization, named cache reuse/resize, temporary work creation, and clipped cache blits; `WorldMapCanvasRenderer` now delegates `getWorldTileLayerCacheContext()`, `createWorldTileLayerWork()`, and `drawWorldTileLayerCache()`. Performance constraint: cache work creation is injected, named work is reused and resized in place, and blit clipping is deterministic and testable without gameplay state. Regression is included in `npm run test:architecture`. |
| P3-005 | done | Added `WorldMapStaticLayerRenderer` as the static world-tile layer and scout-route cache orchestration boundary. `WorldMapCanvasRenderer` now delegates `renderWorldTileStaticLayer()` and `renderWorldScoutRouteLayer()` while preserving public compatibility methods and H5/minigame load order. Performance constraint: static/scout repaint work stays behind cache keys, fast-drag paths reuse existing cache blits, and renderer child-host bridging is tested without browser rendering. Regression is included in `npm run test:architecture`. |
| P3-006 | done | Added `WorldMapWaterLayerRenderer` as the animated water layer orchestration boundary. It owns water frame cache creation/reuse, chunk water frame cache rendering/pruning, fast-drag frame reuse, and water animation timing helpers; `WorldMapCanvasRenderer` now delegates water layer public methods while `WorldTileWaterCanvasRenderer` still owns pixel/texture drawing. Performance constraint: all water frame variants are cached deterministically, fast-drag skips repaint, stale chunk frames are pruned by active keys, and H5/minigame load order is covered by tests. Regression is included in `npm run test:architecture`. |
| P3-007 | done | Added `WorldMapStaticChunkRenderer` as the static chunk cache orchestration boundary. It owns static chunk cache work creation/reuse/resize, chunk repaint into cache, cache-key updates, drawing active chunks, and stale chunk prune; `WorldMapCanvasRenderer` now delegates static chunk public methods while `WorldMapStaticLayerRenderer` continues to route chunk layouts through the compatibility method. Performance constraint: unchanged chunk keys skip repaint, stale chunks prune by active chunk IDs, and chunk rendering suppresses hit targets during cache repaint. Regression is included in `npm run test:architecture`. |
| P3-008 | done | Added `WorldMapSnapshotCacheRenderer` as the snapshot-only cache redraw boundary. It owns snapshot layer cache redraw, current water/static chunk cache redraw, snapshot draw layout delegation, and fog-mask refresh after successful snapshot redraw; `WorldMapCanvasRenderer` now delegates snapshot cache public methods. Performance constraint: snapshot redraw never recomputes tile content, only blits existing caches, filters water chunk frames to the current frame index, and remains testable without browser rendering. Regression is included in `npm run test:architecture`. |
| P3-009 | done | Added `WorldMapFastDragCompositeRenderer` as the fast-drag composite cache orchestration boundary. It owns composite signatures, composite work rebuild, temporary cache render context switching, and final composite blits over scout/water/static layer caches; `WorldMapCanvasRenderer` now delegates fast-drag composite public methods. Performance constraint: one compact composite cache is built only from existing layer caches, stale signatures and chunk layouts are rejected, and fast-drag draws a single blit instead of repainting layers. Regression is included in `npm run test:architecture`. |
| P3-010 | done | Added `WorldMapStaticEntryRenderer` as the static world-tile entry drawing boundary. It owns static entry traversal, fallback terrain diamonds, selected-site outlines, terrain feature drawing, explicit tile feature drawing, site drawing, overlay shadow/asset helpers, and optional site hit-target registration during static repaint; `WorldMapCanvasRenderer` now delegates static entry public methods. Performance constraint: entries are drawn in two stable linear passes, tile/site layout and asset lookup remain injected through host APIs, static layer/chunk caches can reuse this renderer without duplicating draw loops, and no gameplay or visibility mutation happens here. Regression is included in `npm run test:architecture`. |
| P3-011 | done | Added `WorldMapScoutRenderer` as the scout route and legacy scout unit drawing boundary. It owns scout route polylines/markers, route point projection, legacy scout progress interpolation, frame path selection, and legacy unit render handoff; `WorldMapCanvasRenderer` now delegates scout public helper methods. Performance constraint: route rendering is linear over mission route points, progress math uses epoch time, manifest and unit renderer dependencies are injected through host APIs, and no gameplay or cache mutation happens here. Regression is included in `npm run test:architecture`. |
| P3-012 | done | Added `WorldMapWaterEntryRenderer` as the water-entry drawing boundary. It owns filtering water entries and invoking `drawWorldTileWater()` with dry-template drawing disabled for layer/cache water passes; `WorldMapCanvasRenderer` now delegates water entry public methods. Performance constraint: the loop is linear over provided render entries, water pixel/texture work stays in `WorldTileWaterCanvasRenderer`, and no cache or gameplay mutation happens here. Regression is included in `npm run test:architecture`. |
| P3-013 | done | Added `WorldMapSiteOverlayRenderer` as the world-site modal/action overlay boundary. It owns presenter fallback view state, site action buttons, expedition controls, occupied-city command overlays, anchor lookup, and city-command action mapping; `WorldMapCanvasRenderer` now delegates those public compatibility methods. Performance constraint: overlay rendering is event-driven, action button traversal is bounded by visible button lists, anchor lookup reuses existing tile-map layout helpers, and no gameplay simulation or cache lifecycle is owned here. Regression is included in `npm run test:architecture`. |
| P3-014 | done | Added `WorldMapMilitaryViewRenderer` as the military world-view composition boundary. It owns the world-view panel header, tile-map render branch, reset controls, empty exploration fallback, and legacy radar fallback site hit targets; `WorldMapCanvasRenderer` now delegates `renderMilitaryWorldView()`. Performance constraint: panel composition is a bounded branch over either the tile-map view or territory fallback sites, radar fallback is linear over presenter-provided sites, and no cache lifecycle or gameplay mutation is owned here. Regression is included in `npm run test:architecture`. |
| P3-015 | done | Added `WorldMapFogMaskContextRenderer` as the fog-mask context boundary. It owns fog reveal entry filtering, context creation, and `lastWorldFogContext` publication to the host; `WorldMapCanvasRenderer` now delegates `getWorldTileKey()`, `getWorldTileFogRevealEntries()`, and `renderWorldTileFogMask()`. Performance constraint: context capture is a linear handoff over provided entries, stores references instead of cloning tile payloads, and does not allocate fog layers or perform canvas/WebGL drawing while fog remains default-off. Regression is included in `npm run test:architecture`. |
| P3-016 | done | Added `WorldMapTileMapRenderer` as the world tile-map frame orchestration boundary. It owns render snapshot context creation/publication, panel and clip setup, drag target registration, snapshot-only redraw, hit-target-only pass for map/site/actor targets, world-layer ordering, HUD context publication, and fast-drag state restoration; `WorldMapCanvasRenderer` now delegates `renderWorldTileMap()`. Performance constraint: render flow reuses existing split layer/cache modules, stores context references instead of cloning tiles, calculates actors/visible entries once per frame, and restores fast-drag state in `finally`. Regression is included in `npm run test:architecture`. |
| P3-017 | done | Added `WorldMapActorHudRenderer` as the actor/HUD compatibility boundary. It owns actor derivation from render snapshots or march missions, epoch-now resolution, actor render and hit-target handoff, nearest-tile lookup, and march HUD state publication for the `mainHud` pass; `WorldMapCanvasRenderer` now delegates actor/HUD compatibility helpers. Performance constraint: snapshot actors are reused without recomputation, mission actors are derived once per caller pass, HUD state is published by reference, and no tile/cache/fog layer work or physical world-map HUD painting is owned here. Regression is included in `npm run test:architecture`. |
| P3-018 | done | Added `WorldMapLayoutFacade` as the layout compatibility facade around `WorldMapLayoutModel`. It owns projection/draw-rect/site-layout compatibility, local/visible entry cache state, static cache layout helpers, chunk/drag cache layout fallback, and rendered diamond center fallback; `WorldMapCanvasRenderer` now delegates layout helper methods and dropped to 1300 lines. Performance constraint: layout model cache keys are reused, visible entries are cached by compact signatures, tile payloads are not serialized into cache keys, and fallback loops stay linear over provided entries. Regression is included in `npm run test:architecture`. |
| P3-019 | done | Added `WorldMapCacheFacade` as the cache compatibility facade around `WorldMapCachePolicy` and `WorldMapLayerCacheStore`. It owns static/scout cache key compatibility, named layer cache context reuse, temporary layer work, clipped cache blits, static cache layout fallback, and old cache helper pass-throughs; `WorldMapCanvasRenderer` now delegates cache helper methods and dropped to 1132 lines. Performance constraint: policy/store remain the lower-level sealed blocks, named cache work is reused/resized in place, clipped blits stay deterministic, and cache key/layout decisions stay testable without browser rendering. Regression is included in `npm run test:architecture`. |
| P3-020 | done | Added `WorldMapHitTargetFacade` as the hit-target compatibility facade around `WorldMapHitTargetModel`. It owns site/march target registration, model dependency injection, legacy fallback registration, and old hit-target helper pass-throughs; `WorldMapCanvasRenderer` now delegates hit-target helper methods and dropped to 1093 lines. Performance constraint: pure target data still comes from the sealed model, registration is linear over returned targets, fallback target loops stay bounded by visible entries/tiles, and no gameplay simulation is owned here. Regression is included in `npm run test:architecture`. |
| P3-021 | done | Added `WorldMapRenderUtilityFacade` as the render utility compatibility facade. It owns fallback diamond drawing, fallback terrain fills, deterministic string hashing, and deterministic `random01()`; `WorldMapCanvasRenderer` now delegates render utility helpers and dropped to 1088 lines. Performance constraint: deterministic utility behavior is tested without gameplay state, split renderers consume the same old host helper names, and no layer/cache/input state is owned here. Regression is included in `npm run test:architecture`. |
| P3-022 | done | Added `WorldMapCacheConfigFacade` as the cache performance config compatibility facade. It owns static chunk size, chunk cache limit/scale, drag cache pan range, static cache scale, and static cache pixel budget; `WorldMapCanvasRenderer` now delegates cache config helpers and is 1113 lines after constructor/load-order wiring. Performance constraint: long-term cache knobs are centralized, pixel ratio is clamped to at least 1, layout/cache modules can consume config without owning gameplay or draw work, and no cache allocation happens in the config facade. Regression is included in `npm run test:architecture`. |
| P3-023 | done | Added `WorldMapRendererDependencyRegistry` as the dependency lookup boundary for the world-map renderer facade. It owns stable dependency keys, `global`-first browser resolution, CommonJS fallback resolution, and per-registry cached lookups; `WorldMapCanvasRenderer` now consumes `sharedDependencies` and dropped to 822 lines. Performance constraint: dependencies resolve once at module load, no per-frame lookup occurs, missing modules return null/fallback, and future split modules extend the registry instead of reopening the main renderer's require block. Regression is included in `npm run test:architecture`. |
| P3-024 | done | Added `WorldMapRendererCompositionFactory` as the child renderer/facade composition boundary. It owns child-host proxy creation, injected instance precedence, renderer class fallback, actor/HUD wiring, and split renderer/facade instantiation; `WorldMapCanvasRenderer` now delegates composition and dropped to 741 lines. Performance constraint: composition happens once per renderer instance, per-frame rendering only uses cached child module references, and future child modules extend the factory instead of reopening the main renderer constructor. Regression is included in `npm run test:architecture`. |
| P3-025 | done | Added `WorldMapRendererHostBridge` as the legacy host compatibility proxy boundary. It owns renderer-first reads, host fallback method binding, `worldTile*` host state passthrough, and known host field writes; `WorldMapCanvasRenderer` now delegates host bridging and dropped to 718 lines. Performance constraint: bridge creation happens once per renderer instance, property forwarding does not clone host/renderer state, and new compatibility proxy behavior extends the bridge instead of reopening the main renderer constructor. Regression is included in `npm run test:architecture`. |
| P4-001 | done | Added `CanvasTerritoryActionHandlers` as the first `CanvasActionController` domain split. It owns territory/world-site/world-march/expedition/battle-scene handlers, installs the legacy `handle_*` methods onto the controller facade, and is included in `npm run test:architecture`. |
| P4-002 | done | Added `CanvasCityActionHandlers` as the second `CanvasActionController` domain split. It owns city-management/event/task-center/city-selection/building/tech/task-reward/building-list handlers, installs the legacy `handle_*` methods onto the controller facade, preserves H5/minigame load order, and is included in `npm run test:architecture`. |
| P4-003 | done | Added `CanvasFamousActionHandlers` for famous-person panel/detail/search/accept/dismiss/attribute/page actions. It preserves the legacy controller method names, keeps tutorial refresh hooks with the famous domain, and is included in `npm run test:architecture`. |
| P4-004 | done | Added `CanvasTalentPolicyActionHandlers` for the legacy talent-policy shortcut and direct talent-policy apply finalization helpers. The old standalone talent-policy canvas panel was removed; `openTalentPolicy` now routes to the entered-city people tab, preserving tutorial hooks without owning panel/draft/confirm/save/delete UI state. It is included in `npm run test:architecture`. |
| P4-005 | done | Added `CanvasShellActionHandlers` for shell/system/naming/advisor/guidebook/army-formation/account actions. `CanvasActionController` now retains only shared dispatch/render/finalize/host helper behavior and dropped to 226 lines; P4 is at the intended thin-facade target. |
| P5-001 | done | Added `CanvasGameRendererCompositionFactory` as the child renderer composition boundary. It owns child renderer dependency lookup, injected instance precedence, construction with `{ host: renderer }`, child renderer ordering, and presenter sync helpers; `CanvasGameRenderer` delegates composition and dropped from 2003 to 1638 lines. Regression is included in `npm run test:architecture`. |
| P5-002 | done | Added `CanvasGameRendererCoreFacades` as the installer for core surface/asset/world-tile-water/famous compatibility methods. It owns delegate fallback behavior and H5/minigame load-order tests; `CanvasGameRenderer` dropped to 1144 lines. Regression is included in `npm run test:architecture`. |
| P5-003 | done | Added `CanvasGameRendererPageFacades` as the installer for page/panel/HUD/world-map-layer/command/tutorial/tech/building/event/city/home/overlay/advisor/frame compatibility methods. `CanvasGameRenderer` is now a 303-line compatibility facade. Regression is included in `npm run test:architecture`. |
| P6-001 | done | Added `TutorialGuideStepPolicy` as the pure tutorial step policy boundary. It owns step constants, tab access gates, and guide-active range predicates; `TutorialGuideController` preserves the static `TUTORIAL_STEPS` API while delegating pure step gating. Regression is included in `npm run test:architecture`. |
| P6-002 | done | Added `TutorialGuideTargetResolver` as the canvas target/highlight boundary. It owns target lookup, retry-after-render highlight dispatch, rect normalization, viewport visibility checks, and open-world-site highlight dispatch; `TutorialGuideController` keeps compatibility helper names while delegating target resolution and dropped to 1368 lines. Regression is included in `npm run test:architecture`. |
| P6-003 | done | Added `TutorialGuidePhaseHighlights` as the phase highlight branching boundary. It installs the historical `refreshCurrentHighlight()` method and owns first-era, farm, era2, scout, first-city, post-naming, and final-tech guide highlight selection; `TutorialGuideController` now delegates phase branching. Regression is included in `npm run test:architecture`. |
| P6-004 | done | Added `TutorialGuideUiStateCoordinator` as the guide UI state helper boundary. It owns command panel cleanup, soft guide dialogue state, army formation editor reset, guided capital/first-city focus, building/resources guide visibility, and generic building guide display; `TutorialGuideController` dropped to 665 lines as a candidate orchestration facade. Regression is included in `npm run test:architecture`. |
| P7-001 | done | Added `CanvasGameAppRenderPolicy` as the pure app render policy boundary. It owns map-home view-state resolution, tab order, and guide-driven preferred military-view selection; `CanvasGameAppRenderingRuntime` delegates those policy decisions. Regression is included in `npm run test:architecture`. |
| P7-002 | done | Added `CanvasGameAppRenderScheduler` as the app render scheduling boundary. It owns injected clock/wait/interval/requestAnimationFrame helpers, transition duration, water frame duration, and world-map drag cooldown defaults; `CanvasGameAppRenderingRuntime` delegates timing behavior. Regression is included in `npm run test:architecture`. |
| P7-003 | done | Added `CanvasGameAppWorldMapRuntimeBridge` as the world-map runtime bridge installer. It owns runtime coordinator creation, drag snapshot water-time lifecycle, baked-layer render decisions, and snapshot refresh helpers; `CanvasGameAppRenderingRuntime` dropped to 666 lines as a candidate render orchestration facade. Regression is included in `npm run test:architecture`. |
| P8-001 | done | Added `WorldTileMapTileNormalizer` as the pure tile normalization boundary for world tile map presenter data. It owns terrain/site/template/water/intel normalization for individual tiles; `WorldTileMapPresenter.normalizeWorldTile()` delegates to it and the presenter dropped to 479 lines. Regression is included in `npm run test:architecture`. |
| P8-002 | done | Added `WorldTileMapExplorerNormalizer` as the world-explorer presenter normalization boundary. It owns mission merge/time derivation, route coordinate normalization, planned tile/site reveal filtering, and tile-id creation; `WorldTileMapPresenter` delegates explorer helpers and dropped to 319 lines as a candidate map view-state composer. Regression is included in `npm run test:architecture`. |
| P9-001 | done | Added `WorldMapRuntimeBakePolicy` as the pure world-map runtime bake policy boundary. It owns map data signature generation, signature sync result derivation, and bake-dirty checks; `WorldMapRuntime` delegates bake policy while retaining runtime logging/cache invalidation and dropped to 565 lines. Regression is included in `npm run test:architecture`. |
| P9-002 | done | Added `WorldMapRuntimeCameraPolicy` as the pure world-map runtime camera/drag policy boundary. It owns initial camera normalization, camera UI-state composition, UI camera sync, camera change resolution, drag math, baked-camera offset, and drag-layer hit-target offsets; `WorldMapRuntime` delegates these calculations while retaining guards/callbacks/render side effects and dropped to 541 lines. Regression is included in `npm run test:architecture`. |
| P9-003 | done | Added `WorldMapRuntimeInputPolicy` as the pure world-map runtime input geometry boundary. It owns input-layout availability, map input rectangle fallback resolution, and point-in-map bounds checks; `WorldMapRuntime` delegates input geometry while retaining renderer/runtime state collection and dropped to 491 lines. Regression is included in `npm run test:architecture`. |
| P9-004 | done | Added `WorldMapRuntimeRenderPolicy` and `WorldMapRuntimeRenderPipeline` as the runtime render boundary. The policy owns pure render context/throttle/option/trace derivation; the pipeline owns render-state publication, cannot-render reset, snapshot/full frame orchestration, and trace dispatch. `WorldMapRuntime.render()` delegates to the pipeline and the runtime dropped to 411 lines as a candidate facade. Regression is included in `npm run test:architecture`. |
| P10-001 | done | Added `UIStatePresenterDelegates` as the UI presenter facade delegate registry. It owns presenter dependency resolution, direct static delegate installation, and custom guidebook/home/tech facade delegates; `UIStatePresenter` dropped to 23 lines as a compatibility constant/install facade. Regression is included in `npm run test:architecture`. |
| P11-001 | done | Added `stable_block_promotion_matrix_2026-06-09.md` as the governance matrix for confirmed invariants: Canvas-only UI, diamond isometric full-wrapping world maps, chunk/window loading, reveal persistence, backend-authoritative commands, AOI sync, performance tiers, config versions, reproducible world generation, and season carryover. Regression is included in `npm run test:architecture`. |
| P11-002 | done | Added `stable_block_manifest_2026-06-09.json` and `scripts/check-stable-blocks.js` as the stable block guard. Stable file edits now require explicit reopen env flags and an allowed reason. Regression is included in `npm run test:architecture`. |
| P11-002b | done | Replaced obsolete early docs with the current official document set and guarded it through `scripts/verify-refactor-plan-doc.js`. Regression is included in `npm run test:architecture`. |
| P11-003 | done | Added `TileCoord`, `WorldTopology`, and strengthened `TileMapGeometry` as candidate contracts for stable `x/y` tile coordinates, `q/r` compatibility aliases, diamond isometric square-tile projection, and full-direction wrapping topology. These modules are candidate, not stable, until downstream chunk/window/realtime contracts consume them. Regression is included in `npm run test:architecture`. |
| P11-004 | done | Added `WorldChunkAddress`, `WorldInterestWindow`, and `WorldRevealStore` as candidate large-map streaming contracts for chunk addressing, visible/preload/AOI windows, wrapped edge handling, persistent revealed terrain, and materialized chunk tracking without assuming a full frontend world array. These modules remain candidate until realtime authority and downstream renderer/presenter consumers prove the extension surface. Regression is included in `npm run test:architecture`. |
| P11-005 | done | Added `CommandAuthorityContract`, `ServerTimelineSnapshot`, and `AoiSyncSnapshot` as candidate realtime authority contracts. World-march start/return/stop responses now carry authority metadata, stop march is server-timeline derived instead of frontend-coordinate driven, territory scout/conquest/claim actions attach the same command authority envelope, and `npm run test:architecture` includes the realtime focused test. `VersionService` now ignores local SQLite runtime artifacts so local playtests do not trigger false update reloads. Local browser tutorial playtest completed step 36 with screenshot evidence. These modules remain candidate until downstream multiplayer transport and presenter/runtime consumers prove the extension surface. |
| P11-006 | done | Added `ConfigRegistryContract` as the candidate config registry/version contract and `ServerRandomAuthorityContract` as the candidate backend random authority contract. Task definitions, building config, and core backend config modules expose registry metadata/validation without changing legacy behavior. Territory scout outcome/generated-site template rolls, famous-person candidate generation, defender-leader generation, skill ability-kit generation, deterministic world-map materialization, and talent-policy custom IDs now use explicit backend authority/crypto boundaries while preserving deterministic test injection or seeded reproducibility. `FamousPersonRandomAuthority`, `DefenderLeaderRandomAuthority`, and `SkillGeneratorRandomAuthority` record compact authority metadata; `WorldMapService` records compact `generationAuthority` metadata. Business-code `Math.random` scan is clean. Regression is included in `npm run test:architecture`. Future true random-result domains must add explicit authority consumers when introduced. |
| P12-007 | current scope done | Added `ConfigPipeline`, `scripts/validate-config-pipeline.js`, `npm run config:validate`, and `docs/config_registry_snapshot_2026-06-11.json` as the current local config release gate. The pipeline validates game/era/tutorial/battle/tech/building/task-definition registries, writes snapshots, compares against the baseline, and blocks schema/hash/entry/version drift without a satisfying version bump. Added `ConfigReleaseService`, `ConfigRuntimeLoader`, `GameplayConfigRuntime`, admin `/api/admin/config-releases*` endpoints, `/api/health.configRuntime`, and `frontend/tools/config-release-console.html` for audit-only preview, publish, active release pointer, rollback records, runtime drift status, startup release gate policy, read-only runtime bundle loading after gate match, and explicit gameplay config consumption with observe-mode fallback. Production release state defaults to `/opt/wxgame-workspace/.wxgame/config-release/` so runtime backups include release history and active pointer. Host evidence on 2026-06-11 completed publish A/B, rollback B -> A, active restoration, production `CONFIG_RELEASE_GATE=required`, and active-release bundle health on `08639bab086d5d87ebb7445a043ffb72cc88754c`. Regression is included in `npm run test:architecture`. Future work is config-domain expansion through the same facade pattern. |
| P12-005 | in progress | Added backend `PerformanceCapacityBudget` for API/action latency, payload size, save size, world-map size, mission count, and window/chunk budgets; extended frontend `WorldMapPerformanceBudget` for renderer frame work; `ObservabilityService` now records `PERFORMANCE_BUDGET_EXCEEDED`, and `GameStateRepository` persists `saveMetadata.performanceCapacity`. Added `scripts/profile-h5-performance.js` / `npm run profile:h5-performance` for repeatable local H5 browser profiling, plus `npm run profile:h5-phone-sim` for simulated 2026 phone low/mid/flagship profiling. 2026-06-11 simulated evidence identified synchronous world-map cache prewarm as a low-end startup blocker; H5 preload now waits for image resources only and schedules tile cache prewarm in the background through `worldMapRenderer.scheduleWorldTileCachePrewarm()`. The latest simulated profile `.local-logs/h5-performance/2026-06-11T09-23-29-025Z/profile.json` passed hard budgets with low-end ready 14790ms after deferred prewarm and mobile water-refresh floors; remaining RAF/long-task findings are warning-level calibration evidence. Regression is included in `npm run test:architecture`. Remaining work is production sampling calibration and large save/map capacity smoke data. |
