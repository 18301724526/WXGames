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
| P0-004 | Lock render shell responsibilities | `CanvasGameShell` owns canvas layer lifecycle through `CanvasLayerRegistry`; renderers keep drawing responsibilities. | `node --test frontend/js/platform/CanvasLayerRegistry.test.js frontend/js/platform/CanvasGameShell.test.js` |
| P0-005 | Inventory oversized modules | `architecture_module_responsibility_index_2026-06-08.md` lists completed modules, legacy modules above 500 lines, public APIs, extension paths, and split order. | documentation review |
| P0-006 | Add architecture baseline command set | `npm run test:architecture` runs registered candidate/stable architecture syntax checks, focused tests, and `git diff --check`. `smoke` remains the historical script filename, but the command is the required baseline regression gate. | `npm run test:architecture` |

### P1 - 抽取稳定玩法积木 / Extract Stable Gameplay Blocks

P1 work starts moving rules into stable, pure modules.

| ID | 步骤 / Step | 结果 / Outcome | 回归 / Regression |
| --- | --- | --- | --- |
| P1-001 | World map visibility domain model | `WorldMapVisibilityModel` produces compact serializable visibility snapshots independent from rendering. | `node --test frontend/js/domain/WorldMapVisibilityModel.test.js` |
| P1-002 | World map entity/component snapshot | `WorldMapEntitySnapshot` exposes normalized tiles, sites, missions, and actors over compact indexes. | `node --test frontend/js/domain/WorldMapEntitySnapshot.test.js` |
| P1-003 | March system boundary | `WorldMarchProgressSnapshot` owns march progress, actors, and arrival rows; UI/renderers consume snapshot outputs instead of deriving authoritative results. | `node --test frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/domain/WorldMarchSystem.test.js` |
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
| P3-016 | World map tile-map renderer | `WorldMapTileMapRenderer` owns one-frame world tile-map orchestration: render snapshot context creation, panel/clip setup, drag target registration, snapshot-only redraw, hit-target-only pass, layer render ordering, actor/HUD handoff, and fast-drag state restoration. `WorldMapCanvasRenderer` keeps `renderWorldTileMap()` as a compatibility method and delegates the frame flow. | `node --test frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-017 | World map actor/HUD renderer | `WorldMapActorHudRenderer` owns world-map actor derivation from march missions/render snapshots, actor render/hit-target handoff, march HUD state publication, nearest-tile lookup, and epoch-now resolution. `WorldMapCanvasRenderer` keeps compatibility actor/HUD methods and delegates them to the split renderer. | `node --test frontend/js/platform/renderers/WorldMapActorHudRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-018 | World map layout facade | `WorldMapLayoutFacade` owns compatibility layout/cache helper delegation and fallback behavior around `WorldMapLayoutModel`: projection, draw rects, overlay anchors, site layout, local/visible entry caches, static cache layouts, chunk layouts, drag cache layouts, and rendered diamond centers. `WorldMapCanvasRenderer` keeps old helper method names as short pass-throughs. | `node --test frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-019 | World map cache facade | `WorldMapCacheFacade` owns compatibility cache helper delegation and fallback behavior around `WorldMapCachePolicy` and `WorldMapLayerCacheStore`: static/scout cache keys, named layer cache context reuse, temporary layer work, clipped layer blits, and static cache layout resolution. `WorldMapCanvasRenderer` keeps old cache helper method names as short pass-throughs. | `node --test frontend/js/platform/renderers/WorldMapCacheFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCachePolicy.test.js frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js` |
| P3-020 | World map hit-target facade | `WorldMapHitTargetFacade` owns compatibility hit-target registration and fallback behavior around `WorldMapHitTargetModel`: site targets, march tile targets, target registration, injected layout/model dependencies, and old hit-target helper pass-throughs. `WorldMapCanvasRenderer` keeps old hit-target helper method names as short pass-throughs. | `node --test frontend/js/platform/renderers/WorldMapHitTargetFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapHitTargetModel.test.js` |
| P3-021 | World map render utility facade | `WorldMapRenderUtilityFacade` owns compatibility render utility helpers: fallback iso diamond drawing, terrain fallback colors, deterministic hash, and deterministic `random01()`. `WorldMapCanvasRenderer` keeps old utility helper method names as short pass-throughs for split renderers. | `node --test frontend/js/platform/renderers/WorldMapRenderUtilityFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js` |
| P3-022 | World map cache config facade | `WorldMapCacheConfigFacade` owns compatibility cache performance knobs: static chunk size, chunk cache limit/scale, drag cache pan range, static cache scale, and static cache pixel budget. `WorldMapCanvasRenderer` keeps old config helper names as short pass-throughs so cache/layout modules consume one centralized performance config boundary. | `node --test frontend/js/platform/renderers/WorldMapCacheConfigFacade.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/platform/renderers/WorldMapCacheFacade.test.js` |
| P3-023 | World map renderer dependency registry | `WorldMapRendererDependencyRegistry` owns the `global`/CommonJS dependency lookup table for `WorldMapCanvasRenderer`: config/domain modules, renderer facades, split renderers, actor/HUD renderers, and tutorial unit renderer. `WorldMapCanvasRenderer` now consumes one registry-backed dependency object instead of embedding repeated `try require` blocks. | `node --test frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCacheConfigFacade.test.js` |
| P3-024 | World map renderer composition factory | `WorldMapRendererCompositionFactory` owns `WorldMapCanvasRenderer` child-host creation and child renderer/facade composition: actor renderer, march HUD renderer, actor HUD renderer, layout/render/cache/hit-target facades, layer renderers, overlay renderers, fog context renderer, and tile-map renderer. `WorldMapCanvasRenderer` now delegates composition and keeps only facade pass-throughs. | `node --test frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |
| P3-025 | World map renderer host bridge | `WorldMapRendererHostBridge` owns the compatibility proxy between `WorldMapCanvasRenderer` and its legacy host: renderer-first reads, host fallback reads, `worldTile*` host state passthrough, and known host field writes. `WorldMapCanvasRenderer` now delegates host bridging instead of constructing the proxy inline. | `node --test frontend/js/platform/renderers/WorldMapRendererHostBridge.test.js frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js` |

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

命令选择 / Which Command To Run:

- Run the step's focused command first while developing; it is the fastest signal for the module you just changed.
- Run `npm run test:architecture` before commit/deploy. It must include every candidate/stable baseline module's syntax check and focused test as those modules enter the baseline.
- If a focused command is not yet registered in `scripts/run-architecture-smoke.js`, add it to `CHECK_FILES` and/or `TEST_FILES` in the same step that promotes the module into the baseline.
- P3-001 through P3-025 are done in this plan. Their modules remain `candidate` in the responsibility index until later feature work proves the contracts stable.

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
| P0-004 | done | `CanvasLayerRegistry` defines shell-owned layer contracts; world map/fog lifecycle calls now go through shell helpers. Regression passed: `node --test frontend/js/platform/CanvasLayerRegistry.test.js frontend/js/config/FeatureFlags.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js`. |
| P0-005 | done | Added `architecture_module_responsibility_index_2026-06-08.md` with completed module responsibilities, unresolved legacy modules, public APIs, extension paths, and first split order. |
| P0-006 | done | Added `scripts/run-architecture-smoke.js` and `npm run test:architecture` for repeatable architecture baseline regression; `smoke` remains the historical script filename. |
| P1-001 | done | Added `WorldMapVisibilityModel` as a pure domain model for compact visibility snapshots. Performance constraint: parallel arrays + O(1) `indexById`, no renderer dependencies, no `JSON.stringify` signatures. Regression is included in `npm run test:architecture`. |
| P1-002 | done | Added `WorldMapEntitySnapshot` as a pure domain snapshot for tiles/sites/missions/actors. Performance constraint: flat entity arrays + O(1) per-kind indexes, no deep-copy entity maps. Regression is included in `npm run test:architecture`. |
| P1-003 | done | Added `WorldMarchProgressSnapshot` as a pure march boundary for mission progress rows, actor rows, and arrival result rows. `WorldMarchSystem` keeps its old public API as a compatibility facade for geometry/input helpers and delegates march calculation to the snapshot module. Performance constraint: flat arrays + O(1) indexes, incremental signatures, large-mission regression, no renderer dependencies. Regression is included in `npm run test:architecture`. |
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
| P3-016 | done | Added `WorldMapTileMapRenderer` as the world tile-map frame orchestration boundary. It owns render snapshot context creation/publication, panel and clip setup, drag target registration, snapshot-only redraw, hit-target-only pass, layer ordering, actor/HUD handoff, and fast-drag state restoration; `WorldMapCanvasRenderer` now delegates `renderWorldTileMap()`. Performance constraint: render flow reuses existing split layer/cache modules, stores context references instead of cloning tiles, keeps visible-entry calculation to one pass per frame, and restores fast-drag state in `finally`. Regression is included in `npm run test:architecture`. |
| P3-017 | done | Added `WorldMapActorHudRenderer` as the actor/HUD runtime handoff boundary. It owns actor derivation from render snapshots or march missions, epoch-now resolution, actor render and hit-target handoff, nearest-tile lookup, and march HUD state publication before rendering; `WorldMapCanvasRenderer` now delegates actor/HUD compatibility helpers. Performance constraint: snapshot actors are reused without recomputation, mission actors are derived once per caller pass, HUD state is published by reference, and no tile/cache/fog layer work is owned here. Regression is included in `npm run test:architecture`. |
| P3-018 | done | Added `WorldMapLayoutFacade` as the layout compatibility facade around `WorldMapLayoutModel`. It owns projection/draw-rect/site-layout compatibility, local/visible entry cache state, static cache layout helpers, chunk/drag cache layout fallback, and rendered diamond center fallback; `WorldMapCanvasRenderer` now delegates layout helper methods and dropped to 1300 lines. Performance constraint: layout model cache keys are reused, visible entries are cached by compact signatures, tile payloads are not serialized into cache keys, and fallback loops stay linear over provided entries. Regression is included in `npm run test:architecture`. |
| P3-019 | done | Added `WorldMapCacheFacade` as the cache compatibility facade around `WorldMapCachePolicy` and `WorldMapLayerCacheStore`. It owns static/scout cache key compatibility, named layer cache context reuse, temporary layer work, clipped cache blits, static cache layout fallback, and old cache helper pass-throughs; `WorldMapCanvasRenderer` now delegates cache helper methods and dropped to 1132 lines. Performance constraint: policy/store remain the lower-level sealed blocks, named cache work is reused/resized in place, clipped blits stay deterministic, and cache key/layout decisions stay testable without browser rendering. Regression is included in `npm run test:architecture`. |
| P3-020 | done | Added `WorldMapHitTargetFacade` as the hit-target compatibility facade around `WorldMapHitTargetModel`. It owns site/march target registration, model dependency injection, legacy fallback registration, and old hit-target helper pass-throughs; `WorldMapCanvasRenderer` now delegates hit-target helper methods and dropped to 1093 lines. Performance constraint: pure target data still comes from the sealed model, registration is linear over returned targets, fallback target loops stay bounded by visible entries/tiles, and no gameplay simulation is owned here. Regression is included in `npm run test:architecture`. |
| P3-021 | done | Added `WorldMapRenderUtilityFacade` as the render utility compatibility facade. It owns fallback diamond drawing, fallback terrain fills, deterministic string hashing, and deterministic `random01()`; `WorldMapCanvasRenderer` now delegates render utility helpers and dropped to 1088 lines. Performance constraint: deterministic utility behavior is tested without gameplay state, split renderers consume the same old host helper names, and no layer/cache/input state is owned here. Regression is included in `npm run test:architecture`. |
| P3-022 | done | Added `WorldMapCacheConfigFacade` as the cache performance config compatibility facade. It owns static chunk size, chunk cache limit/scale, drag cache pan range, static cache scale, and static cache pixel budget; `WorldMapCanvasRenderer` now delegates cache config helpers and is 1113 lines after constructor/load-order wiring. Performance constraint: long-term cache knobs are centralized, pixel ratio is clamped to at least 1, layout/cache modules can consume config without owning gameplay or draw work, and no cache allocation happens in the config facade. Regression is included in `npm run test:architecture`. |
| P3-023 | done | Added `WorldMapRendererDependencyRegistry` as the dependency lookup boundary for the world-map renderer facade. It owns stable dependency keys, `global`-first browser resolution, CommonJS fallback resolution, and per-registry cached lookups; `WorldMapCanvasRenderer` now consumes `sharedDependencies` and dropped to 822 lines. Performance constraint: dependencies resolve once at module load, no per-frame lookup occurs, missing modules return null/fallback, and future split modules extend the registry instead of reopening the main renderer's require block. Regression is included in `npm run test:architecture`. |
| P3-024 | done | Added `WorldMapRendererCompositionFactory` as the child renderer/facade composition boundary. It owns child-host proxy creation, injected instance precedence, renderer class fallback, actor/HUD wiring, and split renderer/facade instantiation; `WorldMapCanvasRenderer` now delegates composition and dropped to 741 lines. Performance constraint: composition happens once per renderer instance, per-frame rendering only uses cached child module references, and future child modules extend the factory instead of reopening the main renderer constructor. Regression is included in `npm run test:architecture`. |
| P3-025 | done | Added `WorldMapRendererHostBridge` as the legacy host compatibility proxy boundary. It owns renderer-first reads, host fallback method binding, `worldTile*` host state passthrough, and known host field writes; `WorldMapCanvasRenderer` now delegates host bridging and dropped to 718 lines. Performance constraint: bridge creation happens once per renderer instance, property forwarding does not clone host/renderer state, and new compatibility proxy behavior extends the bridge instead of reopening the main renderer constructor. Regression is included in `npm run test:architecture`. |
