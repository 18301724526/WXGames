# 当前技术架构 / Current Technical Architecture

日期 / Date: 2026-06-09

状态 / Status: authoritative

用途 / Purpose:

这份文档是当前技术架构的唯一权威入口。旧的架构计划、Canvas 迁移计划、runtime handoff、tile map handoff 和历史实现步骤文档不再作为当前技术判断依据。

## 1. 架构原则 / Architecture Principles

- Canvas-only: 游戏内可见业务 UI 只能走 Canvas 渲染和 Canvas hitTargets。
- Backend-authoritative: 前端提交意图，后端拥有状态、时间线和结果。
- Modular blocks: 候选模块先有 tests 和 extension path，再晋升 stable。
- Stable blocks are closed: stable 内部不因功能迭代随意修改。
- Data-driven gameplay: 配置数据通过 schema、version 和 registry 管理。
- Large-map first: 地图、渲染、同步和快照不能按小地图全量数组设计。

## 2. 分层 / Layers

```text
backend config/domain/calculators
  -> backend services/actions/repositories
  -> backend API DTO
  -> frontend domain snapshots
  -> frontend state presenters
  -> frontend platform shell/runtime/action handlers
  -> frontend renderers
```

方向必须单向。Renderer 不拥有权威玩法状态；前端 runtime 不决定战斗、奖励、最终坐标或资源结果。

### 2.1 成熟引擎画布层契约 / Mature Engine Canvas Layer Contract

本项目的 Canvas 分层按成熟引擎共识固化：物理画布栈、逻辑渲染队列、命中优先级队列、动画类别、输入面和 debug 面分开建模。这个规则对齐 Unity `Canvas` render mode、Godot `CanvasLayer`、Phaser display list depth、Unreal UMG viewport `ZOrder`、Cocos Canvas priority 的共同思想：世界空间、屏幕 HUD、覆盖层、输入和 debug 不是同一个隐式顺序。

物理画布栈 / Physical canvas stack:

| Layer | zIndex | Context | Camera Space | Input | Role |
| --- | ---: | --- | --- | --- | --- |
| `worldMap` | 997 | `2d` | `world` | no | world playfield |
| `worldFog` | 998 | `webgl` | `world-overlay` | no | optional visual plugin, gated by `FOG_OF_WAR_ENABLED` |
| `worldActor` | 999 | `2d` | `world-dynamic` | no | units, march animation, actor hit-target source |
| `mainHud` | 1000 | `2d` | `screen` | yes | HUD, panels, tutorial, feedback, input capture |

逻辑渲染队列 / Logical render queue:

```text
worldPanel -> terrain -> water -> routes -> sites -> fogMask -> actors -> worldHud -> screenHud -> floatingControls -> panels -> modals -> tutorial -> feedback -> debug
```

命中优先级队列 / Hit priority queue:

```text
mapBackground -> mapTile -> mapSite -> mapActor -> worldHud -> screenHud -> floatingControls -> panel -> modal -> tutorialShield -> debug
```

硬规则 / Hard rules:

- `CanvasLayerRegistry` is the owner of the physical stack, render queue, and hit priority queue.
- `mainHud` is the only input surface and is created by `H5CanvasRuntime.ensureCanvas()`; it must not be created as a secondary layer.
- `worldMap`, `worldFog`, and `worldActor` use `pointer-events: none`; all player input is routed through `mainHud`.
- `worldHud` is a logical render/hit queue bucket, not permission for the physical `worldMap` layer to draw HUD. Map-home march HUD, formation picker controls, tutorial highlights, panels, and all input-capable HUD targets render/register on `mainHud`.
- The physical `worldMap` layer may publish `lastWorldTileMapContext` for later passes, but it must not draw actors, register actor hit targets, call `renderWorldMarchHud()`, or register formation-picker HUD targets.
- The physical `worldActor` layer is the sole owner of world-coordinate actor drawing and actor hit-target source data. Runtime input still enters through `mainHud` and consumes the synchronized hit-target list.
- The physical `mainHud` pass consumes the latest world-map / actor context and is the sole owner of map-home march command HUD drawing and command HUD hit targets.
- Background world-map taps enter through `mainHud` coordinates. `WorldMapRuntime.getLayerPointFromHudPoint()` is the coordinate-space boundary: it converts HUD-space input into padded world-layer space and subtracts any temporary drag-layer transform before tile inference.
- World-map entity picking is owned by `WorldMapPickingModel`, not renderer hitTargets. It builds a `world-map-picking-snapshot-v1` from the current `lastWorldTileMapContext` (frame, viewport, geometry, tile sites, actors) and `WorldMapRuntime` caches it by signature. Entity tile identity and picking signatures normalize site/tile coordinates through `TileCoord`, so stable `x/y` and legacy `q/r` describe the same world target. A changed view/entity context advances `inputEpoch`; repeated reads of the same context reuse the snapshot.
- `WorldMapInputIntent` owns the auditable input fact contract `world-map-input-intent-v1`. Each routed world-map tap records a stable compact `inputId`, monotonic `clientSequence`, HUD point, layer point, resolved action summary, target identity, picking epoch/signature/counts, frame/viewport/camera, and small diagnostics. It must stay pure data, JSON-serializable, and compact; it must not include renderer objects, browser events, full tile arrays, or gameplay payloads. Tile evidence inside `action` and `target` is canonicalized through `TileCoord` when `targetQ/targetR` or `q/r` are present, so stale caller-supplied `tileId` cannot pollute replay evidence. `WorldMapInputIntent.toSerializable()` is also a whitelist boundary for externally supplied intent-like objects, re-summarizing points/action/target/picking/view/diagnostics instead of trusting caller-shaped payloads.
- `WorldMapInputActionMap.resolveTapAction()` priority is explicit non-world UI/HUD hit targets first, stable picking snapshot for world sites/actors second, then background tile inference from camera/view/tile geometry. Background input action coordinates are normalized through `TileCoord`, accepting stable `x/y` and legacy `q/r` mapper output before producing compact `targetQ/targetR/tileId` payloads. Known tile lookup during background inference matches current `tileMapView.tiles` by normalized coordinates and emits canonical `tileId`, so stale or colliding raw `tile.id` cannot redirect the target coordinate or terrain evidence. Renderer-produced `openWorldSite`, `selectWorldActor`, `worldMapDrag`, and background `selectWorldMarchTarget` entries are not authority for world-surface picking: world-map renderers must mark them with `inputSurface: 'worldMap'`; they may prove the tap is on the world surface, but target identity must come from the stable picking snapshot or be recomputed from the current context.
- H5 `CanvasGameShellInputRouter` and minigame/compat `CanvasGameAppInputRouter` share `WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime()`: empty taps, `worldMapDrag`, renderer background `selectWorldMarchTarget`, and renderer world entity hits tagged `inputSurface: 'worldMap'` are routed through `WorldMapRuntime` before any action dispatch. These routers must not carry copied world-map routing rules; if the action-map authority is unavailable, non-empty renderer world-surface actions fail closed instead of using local compatibility logic. If runtime picking misses, renderer world-surface targets are not dispatched as fallback commands; `WorldMapInputActionMap` fails closed or recomputes a background tile target from current context.
- H5 shell forwarded actions preserve causality metadata and async result truth: `CanvasGameShellCommands.forwardCanvasAction(action, meta)` must call external `onAction(action, event, meta)`, preserve Promise results instead of collapsing them to boolean, sync local shell state only after the forwarded action resolves allowed, and keep `WorldMapInputIntent.inputId/clientSequence` comparable across local logs, API request logs, and backend authority evidence. Minigame/compat `CanvasGameAppInputRouter.observeAsyncActionResult()` applies the same diagnostic boundary to runtime-tap Promise failures without converting rejection into success.
- World-map runtime hit targets are a UI/HUD and compatibility input cache, not authoritative gameplay state. Full renders may replace the cache, including with an empty set. Snapshot, drag, or actor-only frames must not replace stable map/site/tile targets with a partial renderer source: `WorldMapRuntimeHitTargetPolicy` preserves the map layer targets, replaces actor-layer targets with the latest actor layer output, rejects partial snapshot map target sets, then applies the current drag offset. This stays front-end only: no server command, network sync, or multiplayer authority path may depend on this cache.
- Map-home march HUD buttons are state-gated on `mainHud`: active actors expose return + stop, idle parked actors expose return only.
- Fog is visual-only. It may cover terrain/static information when enabled, but must not become gameplay authority or silently block HUD/input.
- Renderer call order and hit-target registration must follow the registry queues or add a focused test that changes the contract intentionally.
- Debug overlays live last in render/hit priority and stay feature-gated/default-off.

## 3. 前端技术边界 / Frontend Boundary

当前代码事实：

- `frontend/js/domain`: pure rules, snapshots, time, geometry, performance budgets。
- `frontend/js/state`: presenters and normalizers。
- `frontend/js/platform`: Canvas shell, app runtime, action handlers, command service, feature registries。
- `frontend/js/platform/renderers`: drawing, layout, cache, hit targets, visual composition。
- `frontend/js/config`: feature flags, assets, tile assets, unit sprite manifest。
- `frontend/js/api/GameAPI.js`: browser/API transport boundary. It owns request id, timeout, GET retry policy, structured request errors, H5 load trace API spans, `/version` ETag cache reuse, and best-effort frontend client event reporting.
- `frontend/js/services/GameStateSync.js`: lightweight heartbeat/state authority refresh scheduler. It owns heartbeat failure counts, reconnecting state, and heartbeat backoff windows; it must not become gameplay authority.
- `frontend/js/services/UpdateChecker.js`: deployment version polling boundary. It owns `/version` polling and failure backoff; it must not drive gameplay state changes.
- `backend/server.js`: API gateway process only. It must not own world runtime background ticks or full active-player state sweeps.
- `backend/world-worker.js`: separate PM2 soft service for world runtime advancement through `WorldWorkerService`; production deploy starts it as `wxgame-world-worker`.
- `backend/services/DatabaseRuntime.js`: SQLite runtime opening/configuration boundary for every backend soft service; it applies WAL, `synchronous=NORMAL`, and bounded `busy_timeout` consistently across gateway and worker processes.
- `backend/services/realtime/PresenceService.js`: in-memory online presence and heartbeat persistence throttling; it absorbs heartbeat bursts and prevents per-request `lastActiveAt` writes.

Canvas-only 规则由文档、脚本和架构测试共同守护。`scripts/verify-refactor-plan-doc.js` 会扫描 Canvas 业务层是否引入 DOM UI API。

启动、API 和轮询硬规则：

- First state sync is a distinct `state:first-sync` phase after asset preload. `assets:preload` reaching 100% does not imply server state is ready.
- H5 asset preload waits for image resources, not full world-map tile cache prewarm. World-map metrics/mask/dry-template prewarm is scheduled after preload through `worldMapRenderer.scheduleWorldTileCachePrewarm()` as a device-tiered background task and traced as `assets:prewarm:deferred`. Low/mid mobile-class devices also use `CanvasGameShellWorldMapRuntimePolicy` water-refresh floors so ready-after-first-render animation timers do not repaint the world map at desktop cadence.
- `GameAPI` must attach `X-Client-Request-ID`, enforce timeout, and throw structured errors with method/path/requestId/attempts/status/code/duration metadata.
- Only safe methods such as GET/HEAD may auto-retry transient failures. Game action POST requests must not auto-retry because they submit player intent.
- Heartbeat and version polling must use backoff after network/server failures. Fixed interval timers may stay alive, but they must skip backend calls until the backoff window expires.
- `/version` requests use HTTP validators: the backend emits `ETag`, the frontend sends `If-None-Match`, and 304 responses reuse the last version snapshot instead of parsing a new body.
- H5 load failures are observable: `H5LoadTrace.setReporter()` wires phase/API/asset preload failures to `GameAPI.reportClientEvent()`, which posts allowlisted client events to `/api/client-events` without blocking boot or throwing back into the user flow.
- H5 operation traces are local-first but retrievable on demand: `ClientOperationLog` records input/action/API breadcrumbs in memory plus `sessionStorage`, scopes persisted entries to the current page-run `runId` so logs from older deployed code are discarded after an update/refresh, never uploads per operation, supports local JSON download through the settings-panel export button / `ClientOperationLog.download()`, and only posts an authenticated diagnostic snapshot to `/api/client-operation-logs` when `ClientOperationLog.upload()` is explicitly called. World-map taps, compat/minigame app tap-entry events, action begin/end/error entries, and API request/response/error entries include the compact `WorldMapInputIntent` / `clientInput` summary so a local log can replay both successful and failed input facts before comparing with backend `api_logs` request ids. `ClientOperationLog` re-summarizes coordinate-bearing action, intent target, and `worldMarchTarget` UI evidence through `TileCoord`, so stale caller-supplied `tileId` cannot pollute exported local logs when `targetQ/targetR` or `q/r` are present. `CanvasGameShellInputRouter` and `CanvasGameAppInputRouter` both record tap hit/routing/action breadcrumbs; async handled values are summarized as `'promise'`, not retained as Promise/runtime objects. `ClientOperationLog.sanitize()` also collapses any leaked thenable to `'promise'` before persistence/export, so a missed call-site summary cannot smuggle renderer, native event, or runtime payloads into local diagnostics. The backend persists explicitly uploaded snapshots in `client_operation_logs` for player-scoped replay.
- `WorldMarchTrace` is a frontend diagnostic summarizer only. Mission origin/target/position, route ids, revealed route ids, planned tile ids/terrain labels, and `revealedTileIds` summaries derive tile identity from `q/r` or `x/y` whenever coordinates exist; stale `tileId` / `id` fields cannot replace coordinate facts in console trace or exported operation-log evidence.
- World-march commands may carry `clientInputIntent` from the latest `WorldMapInputIntent`, but `GameAPI` and `CommandAuthorityContract` both reduce it to a compact evidence summary. The server never treats this evidence as coordinate, route, mission, or ownership authority; `WorldExplorerService` still computes route, stop tile, timeline, AOI, and acceptance from current server state.
- `CanvasTerritoryActionHandlers` consumes the same `TileCoord` contract at the action-handler boundary: `selectWorldMarchTarget` and `openWorldMarchFormationPicker` derive HUD `worldMarchTarget.tileId` from `targetQ/targetR` instead of trusting renderer/caller `tileId`, and `startWorldMarch` forwards canonical `targetQ/targetR` plus optional compact `clientInputIntent` without adding a top-level `tileId` authority field.
- `WorldExplorerActions` is the world-march command orchestration boundary. Trace summaries and mission rebasing for start/return/stop derive origin, route, planned-tile, target, and position tile identity from `q/r`, so stale caller/persisted `tileId` / `id` cannot override command diagnostics or mission writes.
- `backend/routes/gameRoutes.js` keeps explicitly requested `/api/game/state` world-march route traces diagnostic-only and coordinate-authoritative: `route:state:loaded` mission origin/target/position, route ids, and planned tile ids derive from `q/r` or `x/y` when coordinates exist; stale persisted `tileId` / `id` cannot replace coordinate facts in replay logs.
- `WorldExplorerRoutePlanner` derives route-planning tile identity from coordinates before mission creation: tutorial planned site selection keys planned tiles by `q/r`, reads terrain by coordinate-derived tile id, and emits planned site `tileId` from the chosen step coordinates, so stale route `tileId` / planned tile `id` cannot alter first-city planning.
- `WorldExplorerMissionNormalizer` is the server-side mission-row normalization boundary before progression, DTO, timeline, and AOI consumers. Route steps, origin/home origin, target, position, planned tiles, and planned sites now derive tile identity from `q/r` or `x/y`; stale persisted or caller-supplied `tileId` / `id` cannot override coordinate-bearing server mission facts. Its `revealedTileIds` merge resolves coordinate-bearing route step `tileId/id` aliases to canonical route ids before marking steps revealed, so stale persisted reveal ids cannot re-enter normalized mission rows.
- `ServerTimelineSnapshot` and `AoiSyncSnapshot` repeat the coordinate identity rule at realtime multiplayer sync exits: timeline coordinates, interpolation endpoints, AOI centers, AOI mission positions, and AOI tile ids derive identity from `q/r`; stale mission `tileId` or world-map tile `id` cannot become synchronized movement facts.
- `WorldExplorerProgression` recomputes coordinate identity at the runtime side-effect boundary: planned tile lookup, planned site materialization, step/reveal trace summaries, mission position writes, and mission `revealedTileIds` derive tile ids from `q/r`, so stale `step.tileId`, planned tile `id`, or `revealTiles()` result `tile.id` cannot redirect reveal materialization or persisted mission facts.
- `WorldExplorerDtoMapper` applies the same coordinate identity rule at the public API boundary: origin, home origin, target, position, route steps, planned tiles, planned sites, and route-backed `revealedTileIds` in world-explorer DTOs derive ids from their coordinates, so stale internal `tileId` / `id` cannot leak back to clients as public facts.
- `TerritoryStateNormalizer` applies the coordinate identity rule to legacy territory scout missions: scout `route` steps and `revealArea` entries derive `tileId` from `q/r`, preventing stale stored scout `tileId` values from re-entering mission progression or client projection.
- `TerritoryScoutAreas` applies the same rule at the legacy scout reveal-area write boundary: newly revealed area entries, appended `revealedTileIds`, and scout-trail tile ids derive from pending reveal coordinates, so stale `revealScoutArea()` tile `id` cannot enter mission facts even when called outside `TerritoryMilitaryMissions`.
- `TerritoryMilitaryMissions` applies the same rule at the legacy scout advancement write boundary: newly revealed route steps, reveal-area entries, appended `revealedTileIds`, and scout-trail tile ids derive from `q/r`, so stale route `tileId` or `revealScoutArea()` tile `id` cannot re-enter runtime mission facts.
- `TerritoryCombatTargets` applies the rule at the combat target normalization boundary: battle target `tile.id` derives from `q/r`, so stale raw `tile.id` or `tileId` cannot become conquest/combat target identity.
- `TerritoryService.getTerritoryBattleTileSnapshot()` applies the rule at the conquest/battle fact boundary: world-map terrain lookup reads tiles by `q/r`, so stale or colliding world-map `tile.id` cannot change `lastBattle.mapTerrain` or nested battle tile snapshots.
- `TerritoryScoutPlanner` applies the rule at the scout-origin planning boundary: controlled tile fallback origin ids derive from `q/r` when no territory or site id exists, so stale world-map `tile.id` cannot become scout origin identity.
- `TerritoryScoutRecords` applies the rule at the legacy scout report normalization boundary: scout reports and report reveal-area entries with `q/r` derive `tileId` and nested `tile.id` from coordinates, so stale report or reveal-area `tileId` cannot leak back to client-facing report facts.
- `TerritoryScoutResults` applies the rule at the legacy scout report generation boundary: generated report reveal-area snapshots derive `tileId` from `q/r`, so stale mission reveal-area `tileId` cannot leave result generation as a report fact.
- `TerritoryScoutResults` also applies the rule to scout candidate selection and generated report tile snapshots: revealed world-map candidate membership and map-terrain lookup read tiles by `q/r`, so a stale or colliding world-map tile `id` cannot change generated site coordinates or report terrain.
- `CommandReplayCorrelation` owns the replay/audit join contract `command-replay-correlation-v1`: local `ClientOperationLog` api request/response entries, backend `api_logs.operationLog`, `X-Client-Request-ID`, `WorldMapInputIntent.inputId/clientSequence`, and `CommandAuthorityContract` command metadata must line up by request id, input id, compact `clientInput`, and `authority.commandId`. When an API request id is available, local client entries must match that exact id; the correlator must not fall back to the last local input entry or guess by time. This contract is diagnostics-only and must not feed movement acceptance, coordinates, route generation, AOI, or multiplayer authority.
- Input/replay diagnostics are under explicit performance budgets: `WorldMapPerformanceBudget.checkInputIntent()` caps `WorldMapInputIntent` evidence at 2KB and rejects renderer/event/tile/hit-target payload leaks; `PerformanceCapacityBudget.checkCommandEvidence()` caps backend `clientInput` at 2KB, replay summaries at 4KB, and rejects timeline/AOI/response/gameState/worldMap/route payloads inside diagnostic evidence. These budgets are test-gated through the input-intent and replay-correlation suites.
- Frontend password persistence is not allowed. `H5AuthStorageAdapter` may remember username state but must not store or return plaintext password values.
- `frontend/index.html` remains a hand-written script entry for now; `scripts/check-frontend-script-manifest.js` guards local script existence, duplicate paths, required `?v=` cache-busting, and critical dependency order until a bundler/content-hash manifest replaces it.


Frontend city-people ownership rule: talent allocation and policy UI is owned by `CityPeopleCanvasRenderer` inside city management. The obsolete `HomeCanvasRenderer` and resources-page home feature grid were deleted; resource HUD bars are owned by `ResourceTopBarCanvasRenderer`. The resources page and map command panels must not render people allocation or policy shortcuts; the old frontend `openTalentPolicy` shortcut handler is deleted.
## 4. 世界地图技术边界 / World Map Technical Boundary

Stable 目标使用 diamond isometric square-tile 语言，而不是 hex/axial 语言。

长期 stable contract:

- `TileCoord`: `x/y` 或 `col/row` stable 坐标，`q/r` compatibility alias。
- `WorldTopology`: full wrapping torus、坐标归一化、最短环绕距离。
- `WorldChunkAddress`: chunk id、chunk 坐标、chunk 覆盖范围。
- `WorldInterestWindow`: 当前视野、预加载窗口、AOI 描述。
- `WorldRevealStore`: 已揭开地形和已物化 chunk 的持久契约。
- `WorldMapRenderSnapshot`: 当前窗口、已揭开地形、通过 `WorldActorProjection` 得到的可见 actor 的 renderer input。

当前代码事实：

- `TileCoord` 已提供 `x/y` stable coordinates、`q/r` compatibility aliases 和 deterministic `tileId`。
- `WorldTopology` 已提供 full wrapping torus、坐标归一化、最短环绕 delta/distance。
- `WorldMarchGeometry` 已消费 `TileCoord` stable coordinate contract：screen projection、nearest-tile lookup、march target UI state 接受 stable `x/y` 和 legacy `q/r`，行军 actor 的 fractional 坐标仍走 continuous projection 以保持本地动画平滑。
- `WorldTileMapTileNormalizer`、`WorldTileMapExplorerNormalizer`、`WorldTileMapPresenter` 和 `WorldMapRuntimeBakePolicy` 已消费 `TileCoord` stable coordinate contract：presenter/view-state 组合与 map-bake signature 阶段接受 stable `x/y` 与 legacy `q/r`，对外仍保留 `q/r/tileId` facade 形状，但 tile identity 由 canonical coordinate 生成，不再保留 renderer/raw planned `id` 或 legacy `tileId` 作为世界实体权威或缓存签名事实；即使 presenter 不可用，runtime bake fallback signature 也不得回退 raw-shape serialization。`WorldMapRuntimeBakePolicy` fallback also folds coordinate-bearing route/revealArea/planned-tile aliases before summarizing `revealedTileIds`, so stale reveal ids cannot churn map-bake cache signatures.
- `WorldTileMapPresenter.buildWorldTileMapViewState()` 的 `view.sites[].tileId` 来自 normalized draw tile identity；raw world tile `id` 或 territory `tileId` 即使为旧值，也不能覆盖 stable `x/y` 生成的 site view identity。
- `WorldTileMapExplorerNormalizer` 的 presenter trace / diagnostic summary 也消费同一坐标身份契约：`presenter:plannedTiles` trace key 从 `normalizeCoord()` 输出生成，不再通过 raw `tile.id` fallback 留下旧身份入口。
- `WorldMarchProgressSnapshot`、`WorldActorProjection` 和 `WorldMapRenderSnapshot.normalizeMarchTarget()` 已消费 `TileCoord` stable coordinate contract：行军 mission row、returned-home actor projection、world march target UI state 均由 stable `x/y` 或 legacy `q/r` 生成 canonical `tileId`，不再信任 caller-supplied `id/tileId` 作为地图实体身份。`WorldMarchProgressSnapshot.deriveMissionForTime()` 的 route reveal set 也会把 coordinate-bearing route step 的旧 `tileId/id` alias 折回 canonical route tile identity，输出 `revealedTileIds` 不再透传 stale route id。
- `WorldMapVisibilityModel`、`WorldMapEntitySnapshot` 和 `WorldFogVisualSnapshot` 已消费 `TileCoord` stable coordinate contract：visibility arrays、entity indexes、fog visual signature 均由 canonical tile identity 合并与索引，不再让 caller-supplied `id/tileId` 覆盖 stable `x/y`。`WorldMapVisibilityModel` also folds coordinate-bearing mission route/planned-tile `tileId/id` aliases into canonical reveal ids before applying `revealedTileIds`, so stale mission reveal ids cannot hide explored visibility entries.
- `WorldMapEntitySnapshot.normalizeActor()` uses world-march `missionId` as the actor entity/index key. Renderer-provided `actor.id` remains a compatibility input only when no mission id exists, so a stale render actor id cannot split selection, HUD, or picking identity away from the mission-owned actor.
- `WorldFogCanvasRenderer` consumes the same `TileCoord` stable coordinate contract at the render/cache boundary: fog tile keys, screen centers, draw rects, and mask cache signatures derive from stable `x/y` or legacy `q/r`, while raw `tile.id` / `tileId` cannot change fog cache identity.
- `WorldMapLayoutModel` / `WorldMapLayoutFacade` layout cache identity consumes the same stable coordinate contract: entity signatures and local/visible entry cache keys derive tile identity from stable `x/y` or legacy `q/r`, while raw `tile.id` / `tileId` cannot force cache churn or stale layout reuse.
- `WorldMapCachePolicy` / `WorldMapCacheFacade` cache signatures consume the same stable coordinate contract for static entries, water entries, and scout route steps. Cache keys derive tile identity from `x/y` or `q/r`, so stale renderer `tile.id` or route `tileId` cannot create extra cache churn or hide a coordinate change.
- `WorldMapWaterLayerRenderer` fallback water cache identity now follows the same stable coordinate contract when `WorldMapCachePolicy` is unavailable: fallback keys derive water entry identity from `x/y` or `q/r`, and raw `tile.id` / `tileId` cannot become water cache authority.
- `WorldMapHitTargetModel` / `WorldMapHitTargetFacade` action payloads consume stable coordinate identity: site and march hit targets derive `tileId`, `targetQ`, and `targetR` from stable `x/y` or legacy `q/r`, while raw renderer `tile.id` / `tileId` only remains non-authoritative surface evidence.
- `WorldMapStaticEntryRenderer` direct site hit-target registration consumes the same stable coordinate action identity: the optional static-entry `openWorldSite` fallback derives `tileId` from `x/y` or `q/r`, and raw renderer `tile.id` / `tileId` cannot become action authority.
- `backend/services/worldMap/WorldMapTopology.js` 已提供后端同口径 topology metadata、canonical tile id、display tile id、wrapped delta/distance 和 generation coordinate。
- `WorldMapService` 仍保留前端兼容的 display `q/r`，但 tile 已写入 `worldQ/worldR/canonicalId`；upsert/normalize 按 canonical id 合并，避免环绕边缘生成重复世界格。
- `WorldMapTiles.createTile()` / `normalizeTile()` and `WorldMapBatch.mergeTiles()` are server write-boundary identity gates: tile `id` is always derived from display `q/r`, while `canonicalId` remains the wrapped global merge key. Caller-supplied `overrides.id`, raw persisted `id`, or merged stale `id` values cannot become authoritative world-map tile identity.
- `WorldMapService` 默认使用服务器共享 `DEFAULT_WORLD_SEED`；旧的 `world-${playerId}` 派生 seed 在 normalize 时迁移到共享世界 seed，避免每个账号生成不同世界。
- `backend/repositories/WorldMapAuthorityRepository.js` 是当前后端全局世界权威边界：`global_world_chunks` / `global_world_tiles` 保存全局物化地形，`player_world_visibility` 保存玩家可见性；`game_states.worldMap` 只保存 seed/topology/scout trail 等壳数据，`tiles` 在持久化时清空。
- `WorldMapAuthorityRepository.createGlobalTilePayload()` is a global persistence identity gate: the stored tile JSON `id` is derived from display `q/r`, while `canonicalId` remains the wrapped global key. Legacy caller/persisted `tile.id` cannot be written into `global_world_tiles.tile`.
- 世界地图物化是 first-writer-wins：第一个真正 reveal/探索到某 canonical tile 的玩家提交全局地形，后续玩家获得可见性后读取同一全局 tile。规划中的 `plannedTiles` 只是探索计划，不在 reveal 前提交为世界事实。
- 旧玩家存档迁移只接收可见/已探索 tile；历史 `visibility: hidden` 或 `visible: false` 的 per-player/AI 污染不会晋升为全局世界，也不会进入玩家可见性表。
- `WorldExplorerRoutePlanner.createGenerationContext()` 记录玩家、模式、服务端计算的方向、origin/target/step、事件 epoch 和附近 AOI 状态 hash；`WorldMapTiles.chooseMaterializedTerrain()` 让首次探索上下文参与地形物化。一旦写入 `global_world_tiles`，后续读取只服从全局权威结果。
- `TileMapGeometry` 已接入 stable coordinate semantics，并继续承担 diamond isometric projection 兼容 facade。Its local fallback coordinate normalizer derives `tileId` from `x/y` or `q/r` rather than preserving raw `tileId` / `id`, so geometry callers cannot reintroduce stale tile identity when `TileCoord` is unavailable.
- `WorldChunkAddress` 已提供 candidate chunk addressing contract: chunk size, chunk id, tile-to-chunk mapping, chunk bounds, and wrapped tile-rect expansion.
- `WorldInterestWindow` 已提供 candidate visible/preload/AOI window contract, including topology summary, wrapped chunk lists, and wrapped tile membership checks.
- `WorldRevealStore` 已提供 candidate revealed-terrain persistence contract, storing revealed tile records and materialized chunk ids without renderer payloads or full `worldMap` arrays. Its local fallback coordinate normalizer also derives tile identity from `x/y` or `q/r`, so revealed-store indexes cannot be polluted by stale persisted `tileId` or `id` values if `TileCoord` is unavailable.
- `WorldMapRenderSnapshot`、`WorldMapEntitySnapshot`、`WorldMapVisibilityModel`、`WorldMapPerformanceBudget` 已有 compact snapshot 和性能预算。
- `WorldMarchProgressSnapshot` now owns march progress/arrival facts, including `homeOrigin` on normalized mission rows. `WorldActorProjection` is the client projection boundary that turns those facts into renderable world actors: active route missions render as `worldRoute`, away-from-home idle missions render as `parkedAwayFromHome`, and returned-home idle missions stay in explorer/progress state as `garrisonedAtHome` without a visible map actor.
- `WorldMarchSystem` remains a compatibility facade. Single-mission actor helpers still delegate to progress facts for old/debug callers, while collection-level `buildActors()` delegates to `WorldActorProjection.projectWorldActors()`.
- `WorldMapCanvasRenderer` 已拆成 layout/cache/static/water/site/military/tile-map/actor/HUD 等候选模块。
- `WorldMapRuntime` 已拆出 bake、camera、input、render policy 和 render pipeline。
- `WorldMapLayerOwnershipContract.test.js` 已纳入 `npm run test:architecture`，守护 `worldMap` 不拥有 actor，`worldActor` 不拥有 command HUD，`mainHud` 拥有 march command HUD。
- Retired world-map legacy entries are not active source: `renderWorldScoutUnitsLegacy()`, `renderWorldCityCommandLegacyOverlay()`, `WorldRadarPresenter`, `worldRadarDrag`, and old scout-unit route/progress/frame helpers were deleted. `scripts/check-retired-legacy-code.js` is part of `npm run test:architecture` and blocks those symbols from returning to production source.

待硬化：

- 让剩余 world map runtime/renderer 逐步消费 `TileCoord`, `WorldTopology`, `WorldChunkAddress`, `WorldInterestWindow`, and `WorldRevealStore`，减少各自重复坐标 math。
- 把全量 tile array 假设改成 chunk/window/reveal model，并保持已揭开地形可持久查询。
- 后端 canonical topology 仍是 `candidate`，需要前端 presenter/runtime/renderer 和后续多人 AOI 消费后再评估 stable promotion。
- 这些大地图契约仍是 `candidate`，不得在下游消费者证明 extension surface 前晋升 `stable`。

## 5. 后端权威和实时同步 / Authority And Realtime Sync

稳定目标：

- `CommandAuthorityContract`: 所有玩家命令走后端确认，失败原因结构化返回；world-march authority envelope may include compact `command.clientInput` evidence for replay/audit, but command validation and movement remain server-owned.
- `ServerTimelineSnapshot`: 后端权威时间线，前端按确认时间线插值。
- `AoiSyncSnapshot`: 同区域事件和增量快照，不同步全世界。
- 前端渲染帧率和服务端同步频率解耦。

当前代码事实：

- `backend/actions/GameActionRegistry.js` 统一注册游戏动作。
- `backend/services/VersionService.js` 已有部署 ID、git commit、源码 hash、部署 manifest 元数据和 ETag。
- `WorldExplorerDtoMapper` 是当前世界探索 DTO 边界。
- `GameStateMigrationPipeline` 是存档迁移边界。
- `CommandAuthorityContract` is the candidate backend-authoritative command envelope for accepted/rejected intent results.
- `ServerTimelineSnapshot` is the candidate server-owned movement timeline and frontend interpolation boundary.
- `AoiSyncSnapshot` is the candidate bounded AOI delta/snapshot boundary.
- `backend/services/VersionService.js` ignores local SQLite/log/playtest runtime artifacts when computing `deploymentId`, so local persistence writes do not trigger false update reloads during active sessions.
- `backend/routes/versionRoutes.js` owns `/api/version` HTTP caching semantics. It returns `Cache-Control: private, max-age=5, must-revalidate`, emits `ETag`, and returns 304 when `If-None-Match` matches.
- World exploration uses the actor march command surface only: `startWorldMarch`, `returnWorldMarch`, and `stopWorldMarch`. The retired scout-report commands are not registered by `GameActionRegistry`.
- World-march stop commands are intent-only and derive the stop tile from the server timeline instead of frontend final coordinates. Return accepts active missions and idle parked missions; stop remains active-only. Deployment runs `backend/scripts/cleanup-world-explorer-ready-state.js` once to convert persisted `ready` missions to `idle`, instead of carrying runtime compatibility branches. That deploy cleanup also canonicalizes coordinate-bearing ready mission `origin` / `target` / `position` / `route` tile ids from `q/r` or `x/y`, so stale persisted `tileId` values are not written back during the migration.
- Territory scout/conquest/claim actions attach the same command authority envelope.
- `backend/services/WorldAiExplorerService.js` 是候选 AI 探索服务：AI reveal 写入服务器地图但保持 `visibility: hidden`，客户端输出、玩家路线选择、领地侦察和 AOI snapshot 都过滤 hidden tile。
- AI 与玩家 reveal frontier 相遇后，服务端按有界上限同步 AI 已解锁地形给玩家；同步时保留 canonical identity，并将 display `q/r` 投影到玩家附近，避免环绕边缘 tile 在当前前端坐标系里跳到远处。
- `WorldAiExplorerService` is also a coordinate-authoritative runtime side-effect boundary: AI reveal state, including `explorer.revealedTileIds`, must derive tile identity from revealed `q/r`, not from `WorldMapService.revealTiles()` return `tile.id`. `revealedCanonicalIds` remains canonical-coordinate based for hidden/global frontier sync.

### 5.1 GameState Runtime Boundary

Operational sync rule: `server.js` is now a gateway/API process, while `world-worker.js` is the local soft-service that owns periodic player-runtime advancement. `GameStateService.advanceRuntimeState()` may still be used by explicit command/action boundaries, but periodic active-player sweeps belong only to `WorldWorkerService`. Heartbeat is presence/liveness only: `PresenceService` records online state in memory and throttles `players.lastActiveAt` persistence; it does not run world simulation, load full game state, or save player state on every heartbeat.

SQLite concurrency rule: every backend process that opens the runtime save DB must go through `DatabaseRuntime.openDatabase()`. The current single-host soft-service topology still shares SQLite, so WAL plus a bounded `busy_timeout` is required to prevent worker saves from surfacing as API/login/health tail latency spikes.

Canonical/projection ownership rule: `GameStateRepository.findByPlayerId()` returns canonical persisted state only. It must not attach client/read projection fields such as `sharedWorldTerritories`. Shared-world ownership for client DTOs is exposed through `GameStateRepository.getClientProjectionForPlayer(playerId)` and composed explicitly by routes before calling `getClientGameStateFromNormalized(gameState, projection)`. `ClientGameStateAssembler` and `TerritoryClientAssembler` may include shared-world visibility only from `projection.sharedWorldTerritories`; they must never read it from the canonical state shape.

当前后端状态边界按成熟服务端分成三类入口：

- `GameStateNormalizer.normalizeState()` / `normalizeStateStructure()` 只做结构归一化：schema migration、默认字段补齐、legacy 字段兼容、城市/资源/教程等形状修正。它不得推进 AI、探索路线、地图 reveal、领土 bridging、计时任务或任何会改变世界时间线的 runtime 行为。
- `GameStateService.advanceRuntimeState(gameState, now, options)` 是显式 runtime 推进入口。只有 action route、state sync、后台 tick 等写入型或同步型路径能调用它；默认只推进玩家 runtime（探索任务、领土 runtime、任务 readiness 等）。世界 AI/global world expansion 必须由专属世界服务显式传入 `{ advanceWorldAi: true }`，不能在普通玩家请求或 active-player worker tick 中隐式发生。
- `getClientGameStateFromNormalized()` 和 `calculateEraProgressFromNormalized()` 是只读 projection。DTO 组装、教程同步、任务中心、重置响应等不能为了响应再次调用 raw `normalizeState()` 或推进世界。下游 DTO helper 同步提供 normalized-only 入口，例如 `CityService.getClientCityStateFromNormalized()`、`TechTreeService.getClientStateFromNormalized()`、`TalentPolicyService.getClientStateFromNormalized()`、`FamousPersonService.getClientStateFromNormalized()`、`WorldMapService.getClientWorldMapFromNormalized()`；`WorldExplorerClientState` 和 `TerritoryClientAssembler` 只读取已经推进过的任务快照。
- `GET /api/game/state` 和 `GET /api/game/tasks` 是普通 query/projection 路径：只加载并结构归一化状态，然后组装 DTO；它们不得调用 `applyOnlineProgress()`、生成事件、`touchPlayerActiveAt()` 或 `repository.save()`。
- `GameStateRepository.save()` delegates to `saveAtomic()`。主 `game_states` 行、`shared_world_territories` 派生占有记录、`revision` 和 `updatedAt` 在同一个 SQLite transaction 中提交；传入 stale `revision` 会抛出 `GAME_STATE_REVISION_CONFLICT`。
- `GameStateRepository.resetPlayerState(playerId, gameState)` 同事务删除该玩家主状态和共享世界派生占有记录，再写入新初始状态；reset 响应使用本次提交对象组装。

硬规则 / Hard rules:

- 一次 API action request 最多进行一次 canonical state runtime advance。
- 玩家 API、heartbeat、read-only projection 和 `WorldWorkerService` active-player sweep 默认不得推进世界 AI；如需世界 AI 扩张，必须走独立 world-authority service 并显式 opt-in。
- 读 projection 不能触发 `applyOnlineProgress()`、`WorldAiExplorerService.advanceAiExploration()`、`TerritoryService.normalizeTerritoryState()`、`WorldExplorerService.normalizeExploreState()`、`TerritoryService.updateMissionReadiness()`、event generation、world-map reveal、`touchPlayerActiveAt()` 或 `repository.save()`。
- `reset` 等破坏性写操作提交后使用本次提交得到的 state 组装响应，不为了响应再次读库/再次归一化。
- Projection-only data must stay out of canonical saves. `GameStateRepository.save()` strips fields such as `sharedWorldTerritories`, and route/read DTO code must pass projection context as an explicit second argument instead of mutating `gameState`.
- 主存档、共享世界写入和全局世界地图提交必须通过 repository transaction；直接扩展保存字段时必须补 `GameStateRepository.test.js` 覆盖 revision、atomic rollback、reset 清理或世界权威可见性边界。
- 这些边界由 `backend/tests/GameStateProjectionArchitecture.test.js`、`backend/tests/GameStateRepository.test.js` 和 `npm run test:architecture` 守护。
- Shared-world projection regressions are guarded by `backend/tests/GameStateRepository.test.js`, `backend/tests/GameStateProjectionArchitecture.test.js`, and `backend/tests/TerritoryClientAssembler.test.js`.

待硬化：

- 所有移动、停止、战斗、占领命令统一收口到 authority contract。
- 停止移动不接受前端最终坐标，由后端根据服务器时间线计算。
- AOI 同步按几百支队伍目标设计。
- AI 探索同步当前是服务端状态闭环，不是多人 transport；后续需要接入真正 AOI delta delivery、压力测试和前端 chunk/window/reveal store。
- Realtime authority modules remain `candidate`; do not promote them before multiplayer transport and downstream presenters consume the contract without churn.
- Combat internals and occupation result calculation still need deeper contract hardening behind the authority envelope.
- AOI sync still needs stress checks for hundreds of teams and transport-level delta delivery.
- Future command routes should pass explicit `expectedRevision` when the client begins sending revision tokens, instead of relying only on latest-server-state saves.

## 6. 配置和数据 / Config And Data

稳定目标：

- Excel/table source -> validation tool -> JSON/registry。
- 配置必须有 version。
- 小版本自动提升。
- 大版本人工确认。
- 运行时模块读取 registry，不直接硬编码可配置玩法数据。

当前代码事实：

- `TaskDefinitionService` 已支持 JSON/xlsx 导入、预览、保存、回滚和模板 workbook。
- 建筑、科技、战斗、任务、教程已有配置模块或 JSON。
- `AssetKeyRegistry` 和 preload manifest 已经把资源 key 作为候选稳定边界。
- `ConfigRegistryContract` 已作为 P11-006 phase 1 candidate：统一 registry metadata、schemaVersion、version、stable content hash、entry id 校验、版本比较和 bump recommendation。
- `ConfigPipeline` 是 P12-007 当前配置流水线 candidate：统一收集已注册配置 registry，生成 `config-pipeline-snapshot-v1`，校验当前 registry，并可与 `docs/config_registry_snapshot_2026-06-11.json` baseline 比较，输出 diff 和版本 bump 建议。
- `ConfigReleaseService` 是 P12-007 当前发布审计 candidate：复用 `ConfigPipeline` 做 preview/publish/rollback 校验，写入配置 release history 和 active release pointer，并提供 active-vs-current registry runtime drift 状态与启动 release gate policy；生产默认把 release history 和 active pointer 放在 `/opt/wxgame-workspace/.wxgame/config-release/`，让运行时备份同时带走配置发布状态；`ConfigRuntimeLoader` 在 active release 匹配当前 registry 后构建只读 runtime bundle 并校验 payload hash；`GameplayConfigRuntime` 是 gameplay 显式配置消费 facade，在 release gate matched 后读取 active bundle，开发/测试 warn/off 模式才回退到模块配置；`frontend/tools/config-release-console.html` 提供独立管理员工具页。当前不做热加载，admin 发布接口只移动审计记录和 active 指针，不直接隐式改写 gameplay runtime。
- `TaskDefinitionNormalizer`, `BuildingConfig`, `GameConfig`, `EraConfig`, `TutorialFlowConfig`, `BattleConfig`, and `TechTreeConfig` 已暴露 registry metadata/validation，并已纳入 `npm run test:architecture`。
- `ServerRandomAuthorityContract` 已作为 P11-006 phase 2 candidate：统一后端权威 random roll envelope、bounded unit roll、chance roll、deterministic test injection。
- `TerritoryScoutResults` 已消费 `ServerRandomAuthorityContract`，侦察 outcome 和生成地点 template roll 默认不再直接依赖 `Math.random`。
- `FamousPersonRandomAuthority` 已作为 P11-006 phase 3 candidate：名士候选生成默认消费后端权威 random source，并在候选人 `source.randomAuthority` 写入紧凑审计 metadata。
- `DefenderLeaderRandomAuthority` 已作为 P11-006 phase 4 candidate：守军首领生成默认消费后端权威 random source，并在首领 `source.randomAuthority` 写入紧凑审计 metadata。
- `WorldMapGenerationAuthority` 已作为 P11-006 phase 5 candidate：世界地图地形、水域、河流和侦察揭示分支走 server-owned deterministic seeded-hash authority，`WorldMapService` 写入紧凑 `generationAuthority` metadata。
- `SkillGeneratorRandomAuthority` 已作为 P11-006 phase 6 candidate：技能/ability-kit 生成默认消费后端权威 random source，并在默认生成结果写入紧凑 `randomAuthority` metadata。
- `TalentPolicyService.createCustomPolicyId()` 已从业务 `Math.random` 迁移到 backend `crypto.randomBytes()`；业务代码 `Math.random` 扫描当前为 clean。
- 战斗经验/奖励当前是 `BattleReports.createExperienceSummary()` 中的确定性公式逻辑，不是随机权威迁移对象；未来引入掉落/概率奖励时再接入 random authority。

待硬化：

- 新增配置域必须统一进入可校验 registry，并注册到 `ConfigPipeline` / `npm run config:validate`；当前核心后端配置域已经接入 registry contract、baseline diff 门禁和 audit-only release 发布记录。
- 后续新增 gameplay 配置域必须继续通过显式 runtime facade 读取 active bundle，并保留加载/回滚演练证据；不能让 admin 发布接口直接隐式改写 gameplay runtime。当前启动会初始化 `GameplayConfigRuntime`，生产 required 模式下 active release 未匹配会失败，开发/测试 warn/off 模式保留 module fallback。
- 版本提示和配置版本差异走统一更新通道。
- 未来新增的掉落、概率奖励、更多生成结果继续收束到后端权威 random authority adapter/service。

## 7. Stable Block Guard

当前新增：

- `docs/stable_block_promotion_matrix_2026-06-09.md`
- `docs/stable_block_manifest_2026-06-09.json`
- `scripts/check-stable-blocks.js`

`scripts/check-stable-blocks.js` 负责：

- 校验 manifest 结构。
- 校验每个 stable block 的 `promotionEvidence`：matrix review、observation notes、public contract、extension path、reopen exceptions、node/npm regression。
- 校验责任索引中 `stable` 条目已登记到 manifest。
- 校验 stable 责任索引条目包含 public contract/command、extension path 和 regression 命令。
- 校验 `candidatePromotionQueue` 中的文件存在、仍是 candidate，并且尚未进入 stable manifest。
- 检测 stable 文件改动。
- 要求通过 `ALLOW_STABLE_BLOCK_REOPEN=1` 和 `STABLE_BLOCK_REOPEN_REASON` 显式声明 bug/performance/security/contract/governance reopen。

下一步：

- 逐步把成熟 candidate 加入 manifest。
- 加 dependency direction checks。
- 继续扩展 stable promotion 的跨模块依赖方向检查。

## 8. 官方文档集 / Official Docs

当前官方文档只保留：

- `docs/current_product_design_2026-06-09.md`
- `docs/current_gameplay_design_2026-06-09.md`
- `docs/current_technical_architecture_2026-06-09.md`
- `docs/long_term_architecture_refactor_plan_2026-06-08.md`
- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/production_engineering_roadmap_2026-06-09.md`
- `docs/6月11日重构与问题交接.md`
- `docs/6月15日交接文档.md`
- `docs/stable_block_promotion_matrix_2026-06-09.md`
- `docs/stable_block_manifest_2026-06-09.json`

旧的 v0.x、handoff、release notes、xlsx 测试用例、早期任务计划和早期设计稿不再作为当前权威资料。

## 9. 浏览器视觉验收 / Browser Visual Acceptance

涉及真实玩家输入、Canvas 像素、教程高亮、按钮可见性、线上部署路径或浏览器兼容风险的改动，不能只用单元测试结论判断玩家是否看得见、点得到。

当前严格验收工具：

- `scripts/playtest-online-tutorial.js`
- `npm.cmd run playtest:online-tutorial`

该工具必须保留以下证据和检查：

- 每个关键动作的 before/after full screenshot。
- 点击目标裁剪图、精确目标裁剪图、教程高亮裁剪图。
- PNG 像素检查：目标可见比例、目标亮度/颜色复杂度、黄色高亮边框像素。
- 中心点 hitTarget 检查：点击中心必须命中预期 action。
- 教程遮罩检查：被引导 action 不得被 tutorial shield 阻挡。
- API/结果检查：涉及后端 action 的步骤必须看到成功回包或预期状态变化。
- Authority 检查：世界行军、征服、征服领取等步骤必须看到 server-owned authority envelope。
- 人工抽查：至少打开关键步骤截图，确认高亮、按钮和玩家反馈肉眼可见。

线上严格引导验收命令：

```powershell
$env:PLAYTEST_GAME_URL='http://47.116.32.216/wxgame/'
$env:PLAYTEST_API_BASE='http://47.116.32.216:3000/api'
$env:PLAYTEST_USERNAME='codexqa'
$env:PLAYTEST_PASSWORD='123456'
$env:PLAYTEST_RESET_ACCOUNT='1'
$env:PLAYTEST_MAX_ACTIONS='160'
$env:PLAYTEST_OUTPUT_DIR='.local-logs/online-tutorial-strict'
npm.cmd run playtest:online-tutorial
```

当修改只触达纯 domain/calculator/schema 且不影响真实输入或 Canvas 可见性时，仍以代码层回归为主；当修改触达教程、Canvas hitTargets、遮罩、高亮、线上资源加载或部署路径时，必须跑上述截图验收。

## 10. 生产工程化 / Production Engineering

P0-P11 已经完成当前范围的架构重构，下一阶段按 `docs/production_engineering_roadmap_2026-06-09.md` 推进生产工程化。生产工程化不是替代架构治理，而是把架构治理接到长期运营：CI architecture gate、release/deploy governance、observability and alerts、backup/restore、performance/capacity、security/access control、config pipeline、stable promotion CI 和 operations runbook。

核心规则：

- 本地通过不等于线上安全；合并或部署前必须有 CI/deploy-side architecture gate。
- 能部署不等于能运营；每次发布必须有版本身份、健康检查、回滚路径和日志位置。
- 配置改动按产品发布处理；当前本地门禁已有 schema、registry metadata、version、baseline diff、validation、audit-only publish/rollback 记录、runtime drift 可观测状态、生产默认 required 的启动 release gate、只读 runtime bundle loader，以及 gameplay 对 game/building/era/tutorial/tech config 的显式 runtime facade 消费；真实 host 已完成 publish/rollback drill、active release 恢复和 `CONFIG_RELEASE_GATE=required` 健康启动验证，未来新增配置域继续按同模式接入。
- 稳定积木不因功能迭代随意重开；新功能通过 extension path 增量接入。
- 涉及真实玩家输入、Canvas 可见性、教程高亮、线上路径、部署行为或后端 action 反馈时，必须保留浏览器截图/playtest 证据。

当前生产工程化事实：

- `.github/workflows/architecture-gate.yml` runs the same `scripts/pre-deploy-gate.sh` entry on GitHub push/PR.
- `deploy.sh` runs `scripts/pre-deploy-gate.sh` after checkout and before publishing assets/backend files unless `SKIP_DEPLOY_GATE=1` is explicitly set.
- `deploy.sh` can deploy a branch, tag, or commit ref that resolves to a commit in the configured Git repo, allowing explicit rollback deployments without a separate code path.
- `deploy.sh` writes release identity to `/opt/wxgame-workspace/.wxgame/current-deploy.json`, appends deploy records to `/opt/wxgame-workspace/.wxgame/deploy.log`, and still writes `.wxgame-deploy-version.json` for the frontend web root. After backend dependency install and one-time retired world-explorer ready-state cleanup, it publishes the current config release through `ConfigReleaseService.publishRelease()` before PM2 restart so `CONFIG_RELEASE_GATE=required` starts only against a matched active release.
- Server deploy state can be checked with `cat /opt/wxgame-workspace/.wxgame/current-deploy.json` and `tail -n 20 /opt/wxgame-workspace/.wxgame/deploy.log`.
- `scripts/verify-deploy-hook.sh` is the read-only production hook verification entry; run it on the host to prove `/home/git/wxgame.git/hooks/post-receive` is executable and wired to the expected work tree/deploy script.
- `scripts/rollback-deploy.sh <branch|tag|commit>` is the rollback entry; it resolves the target commit in the server repo, invokes `deploy.sh`, writes rollback evidence to `deploy.log`, and preserves the same PM2/health-check boundary.
- `scripts/backup-runtime-state.sh` is the runtime backup entry; by default it writes `/opt/wxgame-workspace/backups/wxgame-runtime-*.tar.gz` plus `.sha256`, including SQLite save data, shared config, deploy state, config release state under deploy-state, and a backup manifest.
- `scripts/restore-runtime-state.sh <backup.tar.gz>` is the explicit restore entry; it requires `WXGAME_RESTORE_CONFIRM=restore-runtime-state`, creates a pre-restore backup unless skipped, verifies checksum when present, restores SQLite/shared config, and restores deploy state only when `RESTORE_DEPLOY_STATE=1`.
- `scripts/install-runtime-backup-cron.sh` is the runtime backup scheduling entry; it installs a marked `WXGAME_RUNTIME_BACKUP` crontab line, defaulting to `17 3 * * *`, `/opt/wxgame-workspace/backups`, `/opt/wxgame-workspace/.wxgame/backup.log`, and 14-day retention.
- `scripts/verify-runtime-backup.sh` is the runtime backup health check; it verifies the latest archive age, `.sha256`, manifest entry, shared/deploy-state entries, and SQLite DB entry.
- 2026-06-11 host backup evidence: cron is installed, verified archive `/opt/wxgame-workspace/backups/wxgame-runtime-20260611T145310Z-drill.tar.gz` restored successfully into `/opt/wxgame-workspace/restore-drill/20260611T145324Z`, and post-required-gate archive `/opt/wxgame-workspace/backups/wxgame-runtime-20260611T152149Z-post-config-required.tar.gz` contains `deploy-state/config-release/configReleases.json` plus `deploy-state/config-release/configActiveRelease.json`.
- `backend/services/ObservabilityService.js` owns the current process-local observability window for non-skipped API routes and frontend client failures: request count, status counts, per-path latency/failure stats, p95/max latency, slow request flags, 5xx error rate, backend action failure counts, client event type counts, and recent frontend load/asset failures.
- `backend/services/PerformanceCapacityBudget.js` owns backend runtime capacity checks for API/action latency, request/response size, save size, world-map size, mission count, and window/chunk capacity. `GameStateRepository` persists the latest save budget summary in `saveMetadata.performanceCapacity`.
- `PerformanceCapacityBudget.checkCommandEvidence()` extends the backend capacity boundary to command replay diagnostics: compact `clientInput` evidence is limited to 2KB, replay summaries to 4KB, and heavy authority/runtime payloads are forbidden from operation-log evidence.
- `/api/health` includes a compact `observability` summary, unauthenticated `POST /api/client-events` accepts allowlisted frontend load/asset failure reports, and authenticated admin `GET /api/metrics` exposes the detailed in-memory snapshot with threshold alert codes such as `SERVER_ERROR_RATE_HIGH`, `SLOW_REQUESTS_HIGH`, `ACTION_FAILURES_HIGH`, `FRONTEND_LOAD_FAILURES_HIGH`, and `PERFORMANCE_BUDGET_EXCEEDED`.
- `backend/services/config/ConfigReleaseService.js` owns audit-only config release preview/publish/rollback, active-vs-current registry drift status, and startup release gate policy (`CONFIG_RELEASE_GATE=required|warn|off`). Production release state defaults to `/opt/wxgame-workspace/.wxgame/config-release/`; local/test state defaults to `data/config-release/`. `backend/services/config/ConfigRuntimeLoader.js` owns read-only runtime bundle construction after gate match. `backend/services/config/GameplayConfigRuntime.js` owns gameplay-facing consumption for game/building/era/tutorial/tech config, using active bundle payloads when ready and module fallback only in observe modes. Authenticated admin `/api/admin/config-releases*` endpoints, `/api/health.configRuntime`, and `frontend/tools/config-release-console.html` expose release history, active release pointer, runtime status, loader readiness, preview, publish, and rollback; deploy-driven publish is the production restart boundary and still does not hot-load gameplay runtime. 2026-06-11 host evidence published release A/B, rolled back B -> A, restored active to B, and restarted production with `CONFIG_RELEASE_GATE=required`, `configRuntime.status=matched`, loader ready, and `gameplay.source=active-release-bundle`.
- `backend/services/OpsControlService.js` owns the current P12-009 admin operations snapshot: system, disk, PM2, local-process health summary, optional explicit external health probe through `OPS_HEALTH_URL`, deploy evidence, config runtime, observability, player activity, PM2 logs, and ops audit log. `backend/services/OpsAuthService.js` owns independent ops-admin login, weak production secret/plaintext rejection, failed-login rate limiting, `OPS_SESSION_VERSION` token rotation, and JWT validation for `/api/admin/ops/login` plus protected `/api/admin/ops/dashboard`, `/maintenance`, and `/restart` registered by `backend/routes/opsRoutes.js`; `frontend/tools/ops-console.html` always opens and stores only `cf_ops_token`, not player login tokens. `backend/middleware/maintenanceMiddleware.js` implements soft maintenance mode by blocking player login/register/reset, gameplay, and building APIs with `503 MAINTENANCE_MODE` while leaving admin, health, version, and metrics reachable. Hard stop/start is intentionally outside the web backend and is implemented by `backend/ops-agent/server.js`: the agent defaults to `127.0.0.1:3101`, reuses `OpsAuthService`, exposes `/health`, `/login`, `/status`, `/pm2/start`, `/pm2/stop`, and `/pm2/restart`, pins actions to one configured PM2 app, writes `/opt/wxgame-workspace/.wxgame/ops-agent/ops-agent-audit.log`, and is installed/restarted by `scripts/install-ops-agent-pm2.sh` plus an optional same-origin `/ops-agent/` reverse proxy.
- Production backend runtime is now Node `20.20.2`; `backend/package.json` requires `node >=20.0.0` to match `better-sqlite3@12.10.0`. Backend dependency audit is guarded by `npm run security:audit`: unused `uuid` is removed, transitive `qs` is locked to a fixed version, and the only allowed residual is `xlsx` high severity with no npm-audit fix. The compensating control is `TaskDefinitionImportParser` XLSX containment: size/sheet/row/column limits, formula rejection, dangerous-header rejection, and sanitized row construction.
- `scripts/verify-production-security-config.js` / `npm run security:production` is the P12-006 production security evidence checker. It reuses `SecurityConfig`, `OpsAuthService`, `ConfigReleaseService`, and `adminMiddleware` parsing rules to validate production posture without printing secrets: production `NODE_ENV`, strong `JWT_SECRET`, explicit/restricted `CORS_ORIGINS`, explicit `ADMIN_USERS`, bcrypt `OPS_ADMIN_PASSWORD_HASH`, independent strong `OPS_JWT_SECRET`, bumped `OPS_SESSION_VERSION`, required config release gate, named server/deploy credential owners, and Git remotes without embedded plaintext passwords. It writes redacted JSON evidence with length and short SHA-256 fingerprints only. `scripts/rotate-production-secrets.sh` is the guarded host-side wrapper that updates `.env`, bumps `OPS_SESSION_VERSION`, runs the checker, and can restart PM2 with `RESTART_PM2=1`; actual host execution still requires server access.
- `frontend/js/domain/WorldMapPerformanceBudget.js` owns frontend structural performance gates for visibility/entity/render snapshots and renderer frame work: visible entries, actors, hit targets, frame pixels, active chunks, and per-chunk entries.
- `WorldMapPerformanceBudget.checkInputIntent()` extends the frontend budget boundary to input diagnostics: world-map input intents must remain compact serializable evidence and may not retain renderer objects, browser events, copied tiles, hit targets, or renderer payloads.
- `scripts/profile-h5-performance.js` owns repeatable local H5 profiling evidence. `npm run profile:h5-performance` serves the real frontend with stub API routes, collects navigation/resource timing, long tasks, RAF samples, canvas/screenshot signals, and writes `.local-logs/h5-performance/<runId>/profile.json`; the 2026-06-11 local sample passed hard budgets with a mobile long-task warning. `npm run profile:h5-phone-sim` runs documented 2026 phone low/mid/flagship approximations using CPU throttling, mobile viewport/DPR/touch, browser-visible CPU/memory injection, V8 heap caps, and SwiftShader/low-end GPU flags. The pre-optimization simulated sample `.local-logs/h5-performance/2026-06-11T08-40-57-526Z/profile.json` identified synchronous world-map cache prewarm as a startup blocker; after deferred prewarm and mobile water-refresh floors, `.local-logs/h5-performance/2026-06-11T09-23-29-025Z/profile.json` passed hard budgets with low-end ready 14790ms, mid ready 8920ms, and flagship ready 4175ms while retaining timing warnings for follow-up calibration.
- Current observability is an in-memory rolling window, not durable APM/exporter storage. Persistent metrics export, real alert delivery, alert drills, and explicit hot-path sampling policy remain expected P12-003 follow-up work.
- `backend/config/SecurityConfig.js` owns production JWT/CORS startup policy: production requires `JWT_SECRET` and `CORS_ORIGINS`; development stays locally runnable.
- `backend/middleware/adminMiddleware.js` separates login authentication from admin authorization. Production admin users must be explicit through `ADMIN_USERS`; development defaults to `codexqa`.
- `scripts/check-repository-hygiene.js` blocks tracked `.bak`, `.backup`, database, `.env`, key/certificate files, and local secret text files such as `password.txt`, `credentials.txt`, `secret.txt`, or Chinese password/credential filenames.
- `scripts/check-frontend-script-manifest.js` is the short-term guard for the hand-written H5 script entry until bundler/content-hash migration.
- `scripts/check-shell-scripts.js` verifies project-owned shell scripts with `bash -n`, including deploy, pre-deploy gate, hook verification, rollback, backup, restore, backup cron, and backup verification scripts. On Windows it accepts Git Bash through PATH or common Git for Windows fallback paths.

## 11. 回归 / Regression

架构改动必须运行：

```powershell
npm.cmd run test:architecture
```

该命令包含：

- registered syntax checks
- focused architecture tests
- world-map layer ownership contract
- auto-discovered `*Contract.test.js` and `*.contract.test.js` files
- stable block manifest guard
- stable promotion evidence and responsibility-index guard
- repository hygiene guard
- backend security audit guard
- production security evidence checker tests
- frontend script manifest guard
- shell script syntax guard
- official document guard
- `git diff --check`
