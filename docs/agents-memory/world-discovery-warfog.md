---
name: world-discovery-warfog
description: World discovery model — pre-placed cities+camps revealed only by march vision (fog-gated), garrison strength hidden at the backend projection boundary until fought, and all "侦察/scout" player vocabulary removed. Deployed on codex/pvpve-systems.
metadata:
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

用户改主意后的世界发现模型定论（分支 `codex/pvpve-systems`，权威设计 = [docs/design/10-march-discovery-refactor.md](../../docs/design/10-march-discovery-refactor.md)）：**一个共享持久世界，地形 seed 程序生成→冻成固定世界，城池预置，靠行军视野揭雾发现**。已删掉旧的"定向侦察 spawn 城"临时实现(S1)。

**已建 + 已部署 WSL(cd9e0982)：**
- **行军发现重构 S1–S5**：删定向侦察系统 + `WorldCitySpawner` 纯规划器 + 共享中立城存储(world_cities 表, world-anchor 0,0)/投影 + 行军视野→预置城发现钩(`WorldExplorerProgression.revealStep` 记持久 'city' 视野源) + 教程改行军发现。
- **战争迷雾 A(v2,根治版)**：野怪(hostileForce encounters)= **当前视野内才显示**(真单位语义,用户拍板)。**v1 教训(重要)**:第一版门用 `gameState.worldMap.tiles` 当"已揭格集"——但那是**被污染的持久历史**(`revealSolidKnownWorldTiles` 每次 normalize 把锚点间空隙成片补成 visible=true + AI 探索写 hidden 格进同一数组),门运行时形同虚设,真机穿雾照见。**任何实体门禁绝不能拿 raw worldMap.tiles 当可见集**。v2 = `WorldExplorerVision.computeCurrentVisionCoordSet(gameState)`(玩家占领城×START_REVEAL_RADIUS=2 + fielded 队伍×EXPLORE_REVEAL_RADIUS=1,切比雪夫,实时算零迁移);**fielded 含 idle 驻外**(到达/胜利驻扎/战败滞留都 idle 停野外,"有兵 sprite 处必有眼",对抗验证抓的高危)。可见性谓词 SSOT = `WorldMapService.isTileRevealed`+`getRevealedTileCoordSet`+`getTileCoordinateKey`,城门(发现常驻档)/地图 DTO/AI 探索全复用,4 份手写谓词收敛 1 份。只门控**客户端投影**，服务端 encounter 状态/战斗结算一动不动。**残留**:①solid-fill 填充格上的共享中立城仍会现形(城侧语义切片待做) ②前端雾亮区半径(1.55/1.68/3.05)与后端门(1/2)非同源,边缘一格可能"亮无怪" ③getWorldMapOrigin 3 份手写待 dedup。
- **战争迷雾 B（"打了才知道"）**：未战斗过的实体(野怪 + 中立城)守军 **兵力/守将/技能/防御/威胁/scale 在后端投影边界就不进 DTO**(key 缺席非置 0)，不靠前端藏。判据单源：野怪=`encounter.battleReport` 存在性；城=`territory.lastBattle` 存在性。玩家靠**战后战报**得知强度(战报路径没动)。前端 `WorldSitePresenter` 缺失显示"未知/兵力不明"，expedition 兜底 1 不显 0 兵。**坑**：scale 也编码守军档(deep_stronghold=3…)，最初漏藏，对抗验证抓到补掉；渲染用的 `tile.site.scale` 来自美术清单(`WorldTileMapTileNormalizer.js` `siteAsset?.scale||0.46`)与守军档 scale **两条独立投影**，藏一个不影响另一个。
- **去侦察化**：全项目**玩家可见**"侦察/侦查/侦知/斥候/scout" → "行军/探索"；教程首将 侦察官→**先驱(Pathfinder)**、任务奖励 侦察名人→开拓名人；名人属性 `scoutReportBonusPct`/`scoutTrait` 标签→军情视野/探路特质(**占位死属性:无战斗/机制消费,仅改标签**,可日后删或改成"揭雾范围"类真机制)；名人 scout 原型 label 斥候游骑→**先驱游骑**(保留 `id:'scout'`)。规则=**改玩家可见 VALUE、保留 code-referenced KEY/函数名/action id/技能槽名**(scoutActive/scoutTrait slot、main_scout_officer、visibility:'scouted'、SCOUT_REVEAL_RADIUS 等全留)。对抗验证:i18n 25 key 全 zh+en 成对、931 key 各恰 2 次无重复、KEY 零改名。

**2026-07-08 更新(Codex bdd2e930,已并入)**:野怪营地已从"每玩家一份"迁到**共享 `world_encounters` 表**(绕 WORLD_ANCHOR{0,0} 播种,WorldCampSpawner 变纯规划器);"打了才知道"事实源从 encounter.battleReport 迁到**每玩家 `worldCombat.encounterIntel`**(共享写入 stripPlayerIntel 强制剥情报——修掉了共享世界里 A 的战报泄给 B 的隐患);我们的当前视野门原样幸存(getClientState 仍 filter computeCurrentVisionCoordSet)。fc28c01e 补了"发现的中立城不当前端雾视野源"(与我们 isPlayerVisionCity 判据两端一致)。**新回归风险:营地绕原点而 capital 出生在环上→远玩家附近可能零营地(任务 #57)**。

相关：[[world-march-passability]]、[[p0-combat-in-world]]、[[garrison-occupy-2a]]、[[fog-facts-slice]]、[[i18n-conventions-and-gates]]、[[pvpve-systems-branch]]、[[local-dev-env]]（部署 config-release 版本漂移坑）。
