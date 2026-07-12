---
name: world-march-passability
description: 行军通行规则单源（MARCH_BLOCKED_TERRAINS in shared/worldMarchCore）+ shore 海岸地形切片；boats 扩展点；命名冲突警告。
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

**2026-07-05 shore 切片后的现行规则**（提交 `c94dbeda` design / `b4f97aab` refactor，双部署+WSL 行为探针验收；沿用 2026-06-25 与用户定的原则）：

- **单源**：`shared/worldMarchCore.js` 的 `MARCH_BLOCKED_TERRAINS=['ocean','river']` + `isMarchBlockedTerrain()`（浏览器镜像 WorldMarchCoreAdapter 同步，parity 测试锁）。消费方：后端 RoutePlanner `canTraverseRouteTile`（已知格+雾格两分支；雾格由后端 chooseTerrain 重算判定——**前端只对已知格置灰按钮，雾里靠后端兜底，别把世界生成搬到前端**）、前端 `WorldMarchRoutePolicy.isRouteTerrainBlocked`。拒绝文案「行军路线被水域阻断。」注：旧记忆里的 shared/worldMarchPassability.js 从未存在。
- **地形 'shore'（显示"海岸"）**：ocean-template 为纯 edge/corner 组合的格（格心在陆地，17 张素材读图验证）→ 可走到格心、可作中间步（沿岸连走）+终点；含 `'full'` 或 `river-mouth-*` 的格心在水 → 仍 'ocean' 禁入。分类纯函数 `WorldMapTiles.classifyOceanTemplates(templates)`；`isWaterFamilyTerrain`=ocean/river/shore。
- **river 收紧（2026-07-05）**：河道格（水道直穿格心/河源 U 弯到格心）由"可直线蹚过"改为禁入；河岸=相邻陆地格天然可站。AI 同规则（river penalty 3→1000）。riverPorts=河水通道进出边，留给渡口/桥。
- **boats 扩展点不变**：水域禁行仍是陆军临时规则；加船/科技时扩展后端 `canTraverseRouteTile` 按单位能力放行（单源常量可加 per-unit 集合），别在客户端做地形预测。
- **存档自愈两层**：读侧（decorateTile/normalizeTile）——存量水系地形（ocean/river/shore）永不作权威、按 seed 重算（水系纯 seed 无 context 盐）；**存量陆地必须继续无条件信任**（hills 覆盖存活契约）。DB 侧——WorldMapAuthorityRepository 对水系不一致 blob 惰性重写（capital 污染修复同模式）。
- **命名警告**：新地形不能叫 'coast'——planning 命名空间已占用（ocean→planning'coast' 沿海城规划档案，TerritoryShared 裸值回退会双命名空间污染）。已加映射 `shore→'coast'`。
- **保守默认**（待用户拍板放开）：站点/出生点/教程空城不落 shore；沿海建城规划档案（CityPlanningService 'coast'）现成。
- **渲染像素不变**：TileMapAssetManifest.shore=ocean 条目逐字段拷贝（TileMapAssetManifest.test.js 锁死）；getTerrainAsset 对未知地形静默回退 plains 是陷阱（漏条目=丢水动画）。
- 验收：WSL 探针——行军到海岸格心成功→沿岸 shore→shore 成功→对真海格 EXPLORE_ROUTE_BLOCKED；教程全链回归 tutorial-completed。旧"clamp 到岸边"语义（2026-06-25）：对水目标现为直接拒绝；中途截断行为本轮未重验，动它前先查 buildManualRoute。
