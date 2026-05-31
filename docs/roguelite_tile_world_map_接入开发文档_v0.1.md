# Roguelite Tile World Map 接入开发文档 v0.1

## 目标

把古典时代世界系统从“雷达点位图”升级为“侦察驱动的程序化 tile 大地图”。

核心变化不是换渲染皮肤，而是改变世界数据来源：

- 旧系统：侦察完成后生成一个 `territory` 点，前端把点压缩到圆形雷达上。
- 新系统：侦察队外出期间逐步揭开 `worldMap.tiles`，地形和地点在侦察过程中程序化生成，已生成部分写入玩家存档并保持固定。

## 非目标

- 第一版不做玩家手动逐格控制侦察队。
- 第一版不做全图预生成。
- 第一版不做敌方 AI 扩张、外交势力地图、补给线或多兵种行军。
- 第一版不把地形直接接入战斗公式，只把地形写入战报和地图表现。

## 数据边界

### `gameState.worldMap`

`worldMap` 是地图空间的唯一来源，保存已经生成并固定的 tile。

```js
worldMap: {
  version: 1,
  seed: "world-playerId-or-generated",
  origin: { q: 0, r: 0 },
  tiles: [
    {
      id: "tile_0_0",
      q: 0,
      r: 0,
      terrain: "plains",
      discovered: true,
      visible: true,
      generatedAt: "2026-06-01T00:00:00.000Z",
      riverPorts: [],
      oceanTemplates: [],
      transitionKey: "",
      siteId: "capital"
    }
  ],
  scoutTrails: [
    {
      missionId: "scout_e_...",
      direction: "e",
      tileIds: ["tile_1_0", "tile_2_0"],
      returned: false
    }
  ]
}
```

### `territories`

`territories` 仍然存在，但职责收窄为地点、占领、守军、收益、战斗入口。

- `territory.x/y` 第一阶段继续保留兼容旧代码。
- 新增逻辑应同时把地点绑定到 `worldMap.tiles[].siteId`。
- 后续可迁移到 `territory.q/r`，但第一批不强行破坏旧测试和旧存档。

## Tile 生成规则

第一版使用确定性生成：同一个 `seed + q + r` 永远得到同样的地形倾向。

基础地形：

- `capital`：首都 tile。
- `plains`：默认地形。
- `forest`：树丛覆盖物。
- `hills`：丘陵覆盖物。
- `mountain`：山脉覆盖物。
- `waste`：荒地覆盖物。
- `desert`：后续做区域过渡时使用。
- `ocean`：海洋/海岸体系接入后使用。

第一批只要求后端写入稳定地形；河流、海岸、河口模板先保留字段，后续将 tile-map-lab 中确认过的规则迁入 `WorldMapService`。

## 侦察状态机

旧状态机：

```text
startScout(direction)
  -> 创建一个目标坐标和倒计时
claimScout(missionId)
  -> 领取结果，生成 site 或 empty
```

新状态机：

```text
startScout(direction)
  -> 创建外出侦察队，带 actionPoints、route、nextStepAt
updateMissionReadiness(now)
  -> 按时间推进侦察步数
  -> 每一步生成并发现一个或多个 tile
  -> 可能在 tile 上生成 site
  -> actionPoints 耗尽后标记 returned/ready
claimScout(missionId)
  -> 只是领取/归档返回报告，移除已返回侦察任务
```

第一批实现保留 `claimScout` API，避免前端按钮和旧测试一次性大改；但实际世界生成发生在侦察推进过程中，而不是领取按钮按下的瞬间。

## 行动力

第一版默认：

- `SCOUT_ACTION_POINTS = 5`
- `SCOUT_STEP_DURATION_MS = 12 * 1000`
- 一个侦察任务最多揭开 5 个主路径 tile。
- 每步可以附带揭开少量邻近边缘 tile，形成可读区域，但第一批先只揭开主路径。

## 地点生成

第一批继续复用当前 `SITE_TEMPLATES` 的地点类型和守军逻辑，但触发点改变：

- 侦察每走到一个新 tile 时，按距离和空地 streak 判定是否生成 site。
- 若生成 site，则创建 `territory`，并把 tile 的 `siteId` 指向该 territory。
- 若没有 site，也会把 tile 固定为已发现地块。

## 前端接入

### 新 view state

新增 `UIStatePresenter.buildWorldTileMapViewState(territoryState, options)`，输出：

```js
{
  signature,
  pan: { x, y },
  zoom,
  tiles: [
    { id, q, r, terrain, riverPorts, oceanTemplates, siteId, discovered, visible }
  ],
  sites: [
    { id, tileId, q, r, type, owner, status, art, name }
  ],
  activeScouts: [
    { id, direction, q, r, actionPointsRemaining, route }
  ]
}
```

### 渲染器边界

不要直接引用 `frontend/tools/tile-map-lab.js`。需要抽出游戏侧渲染模块：

- `CanvasTileMapRenderer`：画 tile、模板、水面和覆盖物。
- `TileMapAssetManifest`：游戏使用的素材 key、路径、overlay offset。
- `TileMapGeometry`：q/r 到屏幕等距坐标、hit test、排序。

### 交互

- `worldRadarDrag` 重命名为 `worldMapDrag`。
- 点击有 `siteId` 的 tile 打开现有地点弹窗。
- 点击空 tile 显示地形信息或不响应，第一版可先不做弹窗。
- 保留“回到本城”。

## 开发批次

### 第一批：后端地基

- 新增 `WorldMapService`。
- 新增 `gameState.worldMap`。
- 仓库持久化 `worldMap`。
- 首都 tile 初始化。
- 侦察任务开始携带行动力、路线和已经揭开的 tile。
- `getClientTerritoryState` 输出 `worldMap`。

### 第二批：侦察推进

- `updateMissionReadiness` 按时间推进 scout step。
- 每步生成并固定 tile。
- 生成地点时同步 `territories` 和 tile `siteId`。
- `claimScout` 改为归档返回报告。

### 第三批：前端 tile 世界视图

- 新增 tile map view state。
- 替换 `renderMilitaryWorldView` 中的圆形雷达绘制。
- 保留现有地点弹窗、出征、占领、命名流程。

### 第四批：素材规则迁入

- 从 tile-map-lab 提取 tile 几何、水面、河流、海岸、覆盖物偏移配置。
- 接入 river/ocean/shore 模板选择。
- 前端只画后端返回的 tile 状态，不自行生成世界内容。

## 验收标准

- 新存档包含 `worldMap`，首都 tile 已发现且绑定 `capital`。
- 侦察不是“领取时生成一个点”，而是外出期间逐步写入 tile。
- 已发现 tile 在刷新和重进后保持不变。
- 世界视图不再使用圆形雷达布局。
- 现有地点详情、占领、出征、战斗入口仍然可用。
