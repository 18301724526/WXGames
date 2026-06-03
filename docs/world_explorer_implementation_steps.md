# 地图探索队伍实现步骤

## 提交规则

每完成一个阶段：

- 更新本文档的完成记录。
- 提交 Git commit。
- 推送到私服远端 `origin/main`。

## 阶段计划

| 阶段 | 内容 | 状态 | 完成记录 |
| --- | --- | --- | --- |
| 1 | 设计文档和实现步骤文档 | 已完成 | 2026-06-03：完成 `world_explorer_design.md` 和本文档。 |
| 2 | 新账号出生地图半径 2 初始化 | 已完成 | 2026-06-03：`WorldMapService` 初始化半径 2 地块，半径 1 安全陆地。 |
| 3 | 服务端探索任务模型、路线生成、进度推进 | 已完成 | 2026-06-03：新增 `WorldExplorerService`，支持随机/手动路线和时间推进揭示。 |
| 4 | 服务端 action 接口和客户端状态输出 | 已完成 | 2026-06-03：接入 `startExplore` / `claimExplore` action 和 `worldExplorerState`。 |
| 5 | 前端 API 和基础探索入口 | 已完成 | 2026-06-03：前端 API、action handler、地图 HUD 探索按钮和状态条已接入。 |
| 6 | 前端小人移动表现和增量渲染优化 | 未开始 | 后续 |
| 7 | 旧方向侦察迁移和完整玩法打磨 | 未开始 | 后续 |

## 设计决策

- 迷雾之外不保存真实地形。
- 服务端拥有路线和地块生成的权威状态。
- 前端只做动画、输入和增量合并。
- 第一版随机探索默认生成不重复路线。
- 第一版手动探索先支持服务端可校验的直线/折线路线。

## 完成记录

### 阶段 1

2026-06-03：完成探索队伍玩法设计和分阶段实现记录文档。

### 阶段 2

2026-06-03：`WorldMapService.createInitialWorldMap()` 改为生成首都半径 2 的初始已知区域；首都为 `controlled`，近郊为 `scouted`。`WORLD_MAP_VERSION` 升至 7，旧存档在 normalize 时补齐出生区域。半径 1 使用确定性安全陆地规则，避免海洋或河流贴近首都。

### 阶段 3

2026-06-03：新增 `WorldExplorerService`。服务端现在可以创建探索任务、生成不重复随机路线、生成手动直线路线、预生成路线地块快照，并按任务时间推进揭示 tile。随机路线优先走未知边界，手动路线会拒绝穿过海洋。

### 阶段 4

2026-06-03：`GameStateService` 初始化并归一化 `exploreMissions`，客户端状态新增 `worldExplorerState`。`TerritoryAction` 和 `/api/game/action` 接入 `startExplore`、`claimExplore`，支持随机探索和手动目标参数。

### 阶段 5

2026-06-03：前端 `GameAPI` 新增 `startExplore`、`claimExplore`；状态归一化保留 `worldExplorerState`；canvas action controller/dispatcher 支持探索 action；地图主视图左上角新增探索队 HUD，可以启动随机探索、查看进度、领取已返回探索队。

### 修复记录

2026-06-03: Reworked world map fog as a dedicated render mask. Terrain/water/sites render first, then a black overlay is drawn above the map and a single smooth gradient oval is cut over the known tile bounds. HUD/buttons remain above the fog. Removed obsolete generated fog-tile rendering from static terrain caches; H5 cache key updated to `world-map-reset-v6`.

2026-06-03: Adjusted the fog reveal range so the starting 25-tile visible area keeps its outer ring under fog. The mask now computes the clear cutout from tiles whose eight neighbors are also known; for the 5x5 starting area this uses the inner 3x3 as the clear area and lets the outer 16 tiles sit in the gradient band. H5 cache key updated to `world-map-reset-v7`.

2026-06-03: Reworked the selected player-city command HUD from a bottom modal frame into a compact overlay anchored to the selected world-map city site. The city command buttons now use the site's current screen position after pan, keep the map visible, and the selected HUD is cleared when world-map dragging starts on both normal and runtime drag paths. H5 cache key updated to `world-map-reset-v8`.

2026-06-03: Tuned the selected city HUD density. Removed Labor and Rename from the side command stack, moved Rename into the title badge next to the city name, and reduced the anchored command button sizes by about 30%. H5 cache key updated to `world-map-reset-v9`.

2026-06-03: Fixed selected city HUD dismissal. Empty map taps, map-drag start, and map pinch-pan start now clear selected site state and immediately repaint the foreground HUD layer before runtime map input continues. H5 cache key updated to `world-map-reset-v10`.

2026-06-03: Moved the selected city command HUD anchor from the city site's sprite base to the selected world tile center. The title badge and command cluster now sit higher and align to the tile that owns the city. H5 cache key updated to `world-map-reset-v11`.

2026-06-03：修复重置后新账号首屏仍显示旧首都背景、看不到首都地块的问题。服务端 reset 初始状态已经包含 25 个 `worldMap.tiles`，实际问题在前端地图 runtime 首帧未确认绘制成功时就让主画布跳过地图层；现在 H5 和小游戏路径都只在地图层实际渲染成功或已有 baked map 后才跳过主画布 tile 绘制。小游戏入口显式加载 `TileMapGeometry` 和 `TileMapAssetManifest`，H5 入口缓存串更新到 `world-map-reset-v1`。

2026-06-03：继续修复 H5 双 canvas 路径。线上 API 已确认 `test1` 返回 `worldMap.tiles=25`，但 H5 foreground canvas 在 `mode: 'hud'` 下不会绘制地图；当独立 `worldMap` layer 首帧未绘制成功时，v1 fallback 仍只画 HUD，导致旧背景露出。现在独立地图层失败时会隐藏 `worldMap` layer，并让 foreground canvas 退出 HUD-only 模式，直接绘制地图和 HUD；缓存串更新到 `world-map-reset-v2`。

2026-06-03：修复新账号 `currentEra=0` 时大地图仍不显示的问题。根因是旧验证玩法遗留的时代锁：前端 `buildMilitaryNavigationViewState` 会把 `world`/`scout` 在时代 5 前强制锁回 `army`，导致 `getWorldMapLayerLayout()` 返回 `null`，地图绘制分支根本没有执行。现在取消军事导航和侦察控制的时代锁，并移除服务端侦察/占领 action 的时代 5 拦截；新号 25 个起始地块可直接进入大地图渲染。H5 缓存串更新到 `world-map-reset-v3`。

2026-06-03：补上大地图战争迷雾显示。服务端仍只保存和返回已生成地块；前端根据已知 `worldMap.tiles` 的相邻未知坐标临时计算 fog entries，并画入静态地形缓存。迷雾不会写入 `worldMap.tiles`，探索生成真实地块后会自然替换对应雾块。H5 缓存串更新到 `world-map-reset-v4`。

2026-06-03：优化战争迷雾表现，从离散黑色菱形改为半透明椭圆径向渐变雾团。仍然只在前端渲染层计算，不生成迷雾外地形；H5 缓存串更新到 `world-map-reset-v5`。
