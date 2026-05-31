# Tile World Map V1 Codex 交接文档

交接时间：2026-06-01

当前应用版本：`0.1.187`

当前功能版本：`tile-world-map-v1`

## 当前状态

本轮已经把军事世界视图从旧雷达点位图接入到 tile 世界地图第一版。后端现在持久化 `gameState.worldMap`，侦察任务在外出期间逐步揭开 tile，并在任务过程中生成地点或空地结果。前端在 `territoryState.worldMap.tiles` 存在时优先渲染 tile 地图，旧雷达只作为兼容兜底保留。

## 关键文件

- `backend/services/WorldMapService.js`：世界地图数据结构、tile 生成、路线、trail。
- `backend/services/TerritoryService.js`：侦察任务状态机、侦察推进、地点生成、claim 兼容逻辑。
- `backend/services/GameStateService.js`：新存档初始化与 normalize。
- `backend/repositories/GameStateRepository.js`：SQLite `worldMap` 字段迁移和读写。
- `frontend/js/domain/TileMapGeometry.js`：标准等距投影，192x96 tile。
- `frontend/js/config/TileMapAssetManifest.js`：游戏端 tile 素材路径和 overlay offset。
- `frontend/js/state/UIStatePresenter.js`：`buildWorldTileMapViewState`。
- `frontend/js/platform/CanvasGameRenderer.js`：`renderWorldTileMap` 与军事世界视图 tile 分支。
- `frontend/tools/tile-map-lab.js`：素材语义调试工具，不应直接作为游戏运行时依赖。

## 数据约定

`gameState.worldMap` 是世界空间的主来源：

```js
{
  version: 1,
  seed: "world-playerId",
  origin: { q: 0, r: 0 },
  tiles: [
    {
      id: "tile_0_0",
      q: 0,
      r: 0,
      terrain: "capital",
      discovered: true,
      visible: true,
      generatedAt: "ISO time",
      riverPorts: [],
      oceanTemplates: [],
      transitionKey: "",
      siteId: "capital"
    }
  ],
  scoutTrails: []
}
```

`territories` 仍负责地点、占领、战斗和收益。新增或已有地点必须绑定到对应 tile 的 `siteId`，不能只存在于 `territories`。

## 侦察流程

1. `startScout(direction)` 创建 scout mission，写入 `actionPoints = 5`、`route`、`nextStepAt`。
2. `updateMissionReadiness(gameState, now)` 每 12 秒推进一步，调用 `WorldMapService.revealTile`。
3. 到达目标时调用 `resolveScoutMissionTarget`，结果写入 `territories`、`scoutedCoordinates`、`worldMap.tiles[].siteId`。
4. 行动力耗尽或任务完成后标记 `ready`，`claimScout` 只负责归档报告和移除任务。

## 前端流程

1. 服务端 `getClientTerritoryState` 返回 `worldMap`。
2. `UIStatePresenter.buildWorldTileMapViewState` 合并 tile、site、route 和 asset manifest。
3. `CanvasGameRenderer.renderMilitaryWorldView` 检测到 `tileMapView.tiles.length` 后调用 `renderWorldTileMap`。
4. 地图拖动走 `worldMapDrag`，重置走 `resetWorldPan`；旧 `worldRadarDrag` 仍会转到 `worldMapDrag`。

## 下一位 Codex 注意事项

- 不要把 `tile-map-lab.js` 直接接入游戏运行时。应把稳定规则抽成 manifest、geometry 或后端世界生成配置。
- 海岸四角、河口 T 字形、河流与海岸角冲突这些规则已经在 lab 中讨论并部分落素材，下一步应迁入后端生成逻辑。
- 游戏运行时现在还没有完整使用 `oceanTemplates`、`riverPorts`、`transitionKey`。这些字段是为下一版保留的。
- 如果要继续做模块化地图，请优先让后端返回语义清楚的模板 key，而不是让前端按文件名猜。
- 处理旧存档时不要删除 `territories` 兼容层；战斗、占领、命名和收益仍依赖它。

## 验证入口

自动化测试建议：

```powershell
node --check backend\services\WorldMapService.js backend\services\TerritoryService.js frontend\js\config\TileMapAssetManifest.js frontend\js\domain\TileMapGeometry.js frontend\js\state\UIStatePresenter.js frontend\js\platform\CanvasGameRenderer.js
node --test backend\tests\territory-service.test.js backend\tests\game-state-repository.test.js frontend\tests\ui-state-presenter.test.js frontend\tests\shared-canvas-renderer.test.js frontend\tests\resource-art.test.js frontend\tests\canvas-action-dispatcher.test.js frontend\tests\tile-map-lab.test.js frontend\tests\version-number.test.js frontend\tests\stage5-version.test.js
```

浏览器烟测：

```powershell
node scripts\local-preview-server.js
```

然后打开 `http://127.0.0.1:8080/`，进入游戏后检查军事世界视图是否显示 tile 地图，控制台是否有脚本或图片加载错误。

本轮浏览器烟测结果：8080 登录页可加载，canvas 非空，控制台无 error/warning；3000 `/api/version` 返回 `0.1.187`。未完成全自动登录到军事页，因为 H5 登录框使用 canvas hit target 和 `requestTextInput/prompt`，直接键盘输入不会进入凭据状态。接手者若要继续做端到端浏览器验收，建议先给 H5 runtime 加一个测试专用的可注入凭据入口，或用真实手工登录确认。

## 回退

推荐整提交回退：`git revert <tile-world-map-v1 commit>`。SQLite 里多出的 `worldMap` 列可以保留，旧代码不会依赖它。若只回退前端，需要确认旧雷达兜底仍可工作；若只回退后端，前端 tile 分支会缺少 `worldMap`，应一起关掉或回退。
