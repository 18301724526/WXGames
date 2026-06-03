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
| 5 | 前端 API 和基础探索入口 | 未开始 | - |
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
