# Tile World Map V1 发布说明

发布日期：2026-06-01

应用版本：`0.1.187`

功能版本：`tile-world-map-v1`

数据版本：`worldMap.version = 1`

## 交付范围

这次提交把古典时代的世界探索从“雷达点位图”接入为程序化 tile 大地图第一版。核心变化不是换 UI 皮肤，而是把世界空间写进存档：侦察队外出后按行动点逐步揭开 tile，地形和地点在侦察推进过程中生成并固定，前端军事世界视图优先渲染 `worldMap.tiles`。

## 双端变更

后端：

- 新增 `backend/services/WorldMapService.js`，负责 `worldMap` 初始化、规范化、tile 生成、侦察路线和 trail 记录。
- `GameStateService` 为新存档创建首都 tile，并在 normalize 时保证 `worldMap` 存在。
- `GameStateRepository` 新增并迁移 `worldMap` 字段，保存和读取玩家已揭开的世界地图。
- `TerritoryService` 的侦察任务加入 `actionPoints`、`route`、`revealedTileIds`、`nextStepAt`、`resolvedTarget`，并在 `updateMissionReadiness` 中推进侦察。
- `claimScout` 现在主要负责领取已生成的结果；旧存档里已经 ready 但没有结果的任务仍保留兼容兜底。

前端：

- 新增 `TileMapGeometry`，统一等距 tile 的 192x96 几何、投影、排序和 bounds。
- 新增 `TileMapAssetManifest`，集中管理 tile 地形、水面、覆盖物路径和本次校准后的 overlay offset。
- `UIStatePresenter` 新增 `buildWorldTileMapViewState`，从持久化 `worldMap` 生成渲染态。
- `CanvasGameRenderer.renderMilitaryWorldView` 在有 `worldMap.tiles` 时渲染 tile 地图；无数据时保留旧雷达视图兜底。
- 新增 `worldMapDrag`，并保留 `worldRadarDrag` 兼容别名；“回到本城”继续复用 `resetWorldPan`。
- `frontend/index.html` 的关键地图脚本缓存版本更新为 `tile-world-map-v1`。

素材与工具：

- `frontend/assets/art/tile-map` 下的地形、海洋、河流和 transition template 已按前面讨论的标准等距素材线整理。
- `tile-feature-pond.png` 已移除，pond 不再作为本版地图覆盖物。
- `frontend/tools/tile-map-lab.*` 保留为素材语义、海岸、河口和 overlay offset 的调试工具。

## 已验证

- 后端侦察与地图持久化目标测试。
- 前端 view state、canvas renderer、action dispatcher、素材引用和 tile-map-lab 测试。
- 浏览器本地烟测以 `http://127.0.0.1:8080/` 为入口，已确认登录页可加载、canvas 非空、控制台无 error/warning；后端 `http://127.0.0.1:3000/api/version` 返回 `0.1.187`。
- 浏览器自动化没有完成完整“输入账号 -> 进入军事世界页”的点击流：当前 H5 登录框是 canvas hit target，文本输入依赖平台 `requestTextInput/prompt`，自动化直接键入不会写入 canvas 凭据。地图核心渲染用 renderer/view-state 自动化测试覆盖。
- 测试用例表：`docs/tile_world_map_v1_test_cases.xlsx`。

## 已知风险

- 游戏运行时当前只接入基础地形、地点覆盖物和侦察路线；海岸、河流、河口模板虽然素材和 lab 规则已准备，但还没有完整迁入后端世界生成规则。
- 侦察路线第一版仍沿用方向直线和 5 点行动力模型；当未来需要跨越已探索区域继续找更远边界时，需要补“从边界继续探索”的路径策略。
- `worldRadarDrag` 仍保留兼容入口，后续清理旧雷达时可以删除。
- 旧存档的 ready 侦察任务如果缺少 `resolvedTarget`，领取时会走兼容解析；这能避免卡档，但生成时机不等同于新任务。
- 不同屏幕尺寸下 tile 密度和覆盖物遮挡还需要更多视觉验收，尤其是大量地点集中出现时。

## 回退方案

首选回退：直接 revert 本次 `0.1.187 / tile-world-map-v1` 提交。数据库新增的 `worldMap` 列不会阻塞旧代码运行，旧代码不读取该列时可以继续使用原 `territories`、`warMissions` 和 `scoutedCoordinates`。

如果只需要前端快速回退，可以把 `renderMilitaryWorldView` 中 tile 分支关闭，让 `worldMap.tiles` 继续存在于服务端但前端走旧雷达兜底。这样风险较小，但会让新地图视觉不可见。

如果只需要后端快速回退，不建议保留新前端渲染分支，因为前端 tile 视图依赖 `territoryState.worldMap`。应同时回退 `WorldMapService`、仓库字段写入、侦察推进逻辑和前端 tile view state。

## 后续建议

下一版优先把 tile-map-lab 已确认的海岸、河流、河口语义迁入 `WorldMapService`，让后端直接返回可渲染模板 key。随后再做路径策略：从已探索边界出发、河口与海岸冲突约束、以及可视范围扩散。
