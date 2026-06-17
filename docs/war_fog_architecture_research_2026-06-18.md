# 战争迷雾架构研究：WXGamesLocal

日期：2026-06-18
分支：`codex/warfog-research`

## 当前研究分支运行说明

本分支已把 `GameConfig.FEATURES.FOG_OF_WAR_ENABLED` 临时开启，用于测试服直接验收战争迷雾观感；这不是要求所有后续主线默认永久开启。旧的硬格子/菱形拼接雾效已经从 `WorldFogCanvasRenderer` 删除，当前实现拆成：

- `WorldFogVisionModel`：收集视野来源，区分玩家城市、单位、已探索记忆。
- `WorldFogMaskGenerator`：生成 explored/visible 双 soft mask。
- `WorldFogCanvasRenderer`：只负责 WebGL 合成和贴图上传。

当前视觉规则按两层处理：unknown 为纯黑；explored-but-not-visible 为灰暗记忆层；单位中心清晰，周围一圈已经进入柔和衰减；玩家首都/分城提供约 2 格软视野。AI/中立城市不会给玩家当前视野。

## 结论先行

当前仓库已经有战争迷雾的核心骨架，不建议另起一套地图或渲染系统。推荐路线是：后端继续作为玩家视野权威，前端只消费压缩后的可见性快照和视觉遮罩；先把“永久探索记忆”和“当前实时可见”分开，再把敌方单位、据点详情、命令合法性接到同一套视野查询上。

这套实现更接近成熟 RTS 的分层：

1. 每个玩家有独立 shroud/visibility state。
2. 单位、建筑、侦察任务只是 visibility source，不直接拥有地图事实。
3. 命令校验、目标暴露、DTO 裁剪都走服务端视野查询。
4. 渲染层只画 fog mask，不参与玩法判定。
5. Debug/god mode 是显式 visibility mode，不混入普通玩家状态。

## 成熟项目参考

### OpenRA：玩家级 Shroud 权威

OpenRA 的 trait 文档把 `RevealsShroud` 作为单位/对象能力暴露给 mod 数据，说明“视野来源”是 actor trait，而不是渲染器特例。OpenRA 早期合入 per-player shrouds 时也明确了几个关键目标：每个玩家拥有自己的 shroud；单位和建筑不能瞄准视野外对象；已经探索过的建筑可作为记忆目标；GPS 这类能力提供额外 fog visibility。

对本项目的启发：

- 用 `player_world_visibility` 继续做玩家维度权威表。
- 不让 Canvas hit target 或前端 route 结果成为视野权威。
- 将“探索过”和“当前可见”拆成两个等级，避免所有 scouted tile 都被当成 live visible。
- 命令层增加 visibility guard，例如不能攻击/拦截当前不可见的移动目标，但可以对已探索静态据点发起特殊命令。

### 0 A.D.：组件拆分

0 A.D. 的 entity XML 文档体现了典型 RTS 的组件化边界：实体由多个组件组成，其中 fog/visibility/vision 是独立能力，不塞进移动、攻击或渲染组件。也就是说，可见性是 simulation concern，视觉雾效只是其投影。

对本项目的启发：

- 后端新增或抽出 `WorldVisibilityService`，输入为玩家、单位/据点/行军快照、当前时间，输出 visibility snapshot。
- `WorldExplorerProgression` 继续负责行军推进和 reveal side effect，但不应长期承载所有 fog 规则。
- `ClientGameStateAssembler` / `TerritoryService.getClientTerritoryState()` 做最终 DTO 裁剪，避免未可见对象泄露到客户端。

### Godot Open RTS：视觉遮罩和单位显隐分离

Godot Open RTS 明确把 Fog of War 和 Unit Visibility Handler 分成两个系统：前者负责视觉暗化/遮罩，后者根据 sight range 和 player visibility 决定单位是否显示；建筑离开视野后还会留下 dummy/memory 表示“玩家记得这里曾经有建筑”。

对本项目的启发：

- 现有 `WorldFogCanvasRenderer` / `WorldFogVisualSnapshot` 只保留视觉职责。
- 单位显隐、敌方据点详情、旧情报记忆应该由 DTO 和 entity snapshot 决定。
- 已探索静态对象可以保留 memory projection，但动态单位不能保留实时坐标。
- 小地图、主地图、命令 hit target 要消费同一份 visibility snapshot。

## 当前仓库现状

### 已有可复用基础

- `backend/repositories/WorldMapAuthorityRepository.js`
  - 已有 `global_world_chunks` / `global_world_tiles` 全局地形表。
  - 已有 `player_world_visibility` 玩家可见性表。
  - 已经把 `game_states.worldMap.tiles` 存储裁剪为空，保存时再提交玩家可见 tile。

- `backend/services/WorldMapService.js`
  - `createInitialWorldMap()` 用 `START_REVEAL_RADIUS` 生成出生探索区。
  - `revealTile()` / `revealTiles()` / `revealScoutArea()` 已是探索写入口。
  - `getClientWorldMapFromNormalized()` 会过滤 hidden/unknown tile。

- `backend/services/worldExplorer/WorldExplorerProgression.js`
  - 行军推进会按 route step reveal 周边区域。
  - `revealStep()` 负责计划地块 materialize 和 planned site 曝光。

- `frontend/js/domain/WorldMapVisibilityModel.js`
  - 已有 `unknown/explored/visible/controlled` 四级快照模型。
  - 使用 parallel arrays 与 `indexById`，适合大地图性能预算。

- `frontend/js/domain/WorldFogVisualSnapshot.js`
  - 已能把 visibility/render snapshot 转为 fog renderer 输入。

- `frontend/js/platform/renderers/WorldFogCanvasRenderer.js`
  - 已有 WebGL 遮罩渲染、explored/visible 双 mask、soft feather、缓存复用。

- `frontend/js/platform/WorldMapVisualPluginRegistry.js`
  - `worldFog` 已作为默认关闭的视觉插件接入。

- `frontend/js/platform/CanvasLayerRegistry.js`
  - 已定义 `worldMap -> worldFog -> worldActor -> mainHud` 的物理层级。
  - `worldFog` 是 `pointer-events: none`，符合“视觉层无输入权威”原则。

### 当前缺口

1. 后端 visibility level 没有形成统一服务。
   `WorldMapService` 现在更多是 reveal/materialize；当前可见、已探索记忆、情报等级、单位视野来源还没有统一入口。

2. `scouted` 和 `visible` 容易语义混淆。
   `player_world_visibility.visibility` 常见值是 `scouted`，但 `createPlayerTile()` 会把非 hidden/unknown 都映射为 `visible: true`。这对早期探索 UI 够用，但正式 fog 会让“历史探索过”看起来像“当前看得见”。

3. DTO 裁剪还不完整。
   地形 tile 已经按玩家 hydrate，但共享据点、敌方单位、战斗目标、AI/其他玩家动态信息仍需要统一走 visibility guard。

4. 前端 fog 默认关闭且未成为验收主路径。
   视觉插件结构已经成熟，但还缺 feature flag 开启后的端到端测试：地图刷新、拖动、行军 reveal、移动端帧预算。

5. 命令合法性没有完全绑定视野。
   选择 tile、打开 site、发起攻击/征服/侦察等命令，最终都应以后端 `canSee/canRemember/canTarget` 为准。

## 推荐目标架构

### 数据模型

建议把玩家视野定义成三层，不再只依赖 `visible` boolean：

```text
unknown    从未探索，客户端不应获得真实地形/对象。
explored   探索过但当前不可见，可看到地形记忆和静态记忆，动态情报冻结。
visible    当前有视野来源覆盖，可看到实时对象和完整可见层情报。
controlled 玩家控制/驻军区域，等价于永久 visible，且 intel level 更高。
```

服务端存储可沿用 `player_world_visibility`，但建议扩展语义字段：

- `visibility`: `unknown | explored | visible | controlled`
- `exploredAt`: 第一次探索时间，可复用 `discoveredAt`
- `lastVisibleAt`: 最近实时可见时间，可复用或替换 `lastScoutedAt`
- `intel`: JSON，记录 `knownTerrain/knownSite/knownOwner/knownGarrison/knownLeader/knownSkill`
- `sourceSummary`: 可选，用于 debug，不作为玩法权威，例如 `capital`, `march`, `watchtower`

### 后端服务边界

新增 `backend/services/worldMap/WorldVisibilityService.js`，作为唯一查询入口：

```js
getPlayerVisibility(gameState, options)
getTileVisibility(gameState, coord, options)
getVisibleTileIds(gameState, options)
canRevealTile(gameState, coord, source)
canSeeTile(gameState, coord, options)
canRememberTile(gameState, coord, options)
canSeeEntity(gameState, entity, options)
filterEntitiesForClient(gameState, entities, options)
```

它不负责生成地形，不负责推进任务，不负责渲染；只把“当前有哪些 source 覆盖哪些 tile”和“历史探索记忆”合成查询结果。

### Visibility source

所有能提供视野的对象都规范成 source：

```js
{
  id: 'formation:capital:1',
  ownerPlayerId: 'player-1',
  kind: 'capital' | 'formation' | 'watchtower' | 'march' | 'site' | 'debug',
  q: 0,
  r: 0,
  radius: 2,
  level: 'visible',
  intelLevel: 2,
  expiresAt: null
}
```

第一阶段只需要这些来源：

- 出生点/首都：`controlled`，半径 `START_REVEAL_RADIUS`
- 活跃行军当前位置：`visible`，半径 `EXPLORE_REVEAL_RADIUS`
- 行军 reveal 过的 route step：`explored`
- 己方占领据点/瞭望塔：`visible/controlled`，半径来自配置

第二阶段再接：

- 盟友共享视野
- 科技/建筑提升视野
- 雷达/GPS 式全局能力
- 间谍/临时情报 source

### DTO 裁剪边界

建议在 `ClientGameStateAssembler.getClientGameStateFromNormalized()` 附近形成最终输出门：

1. `WorldMapAuthorityRepository.hydrateWorldMapForPlayer()` 只返回玩家已探索 tile。
2. `WorldVisibilityService.createClientVisibilitySnapshot()` 生成本次响应的可见性快照。
3. `TerritoryService.getClientTerritoryState()` 对 territories 做视野裁剪：
   - unknown tile：不返回真实 site。
   - explored tile：返回 memory site，隐藏实时兵力/领袖/技能/生产状态。
   - visible/controlled tile：返回实时 site。
4. 世界 actor/敌方行军/战斗目标也走同一规则：
   - visible：返回实时 actor。
   - explored：移动 actor 不返回；静态 building 可返回 memory。
   - unknown：不返回。

这样前端即使被改，也拿不到视野外实时对象。

### 前端渲染边界

前端保留现有分层：

```text
worldMap: terrain/water/routes/sites memory
worldFog: WebGL fog visual plugin, no hit targets
worldActor: visible actors only
mainHud: all input and command HUD
```

需要补的只是数据输入规则：

- `WorldMapVisibilityModel.createSnapshot()` 的输入应来自后端 DTO 中的正式 `visibilitySnapshot`，本地 mission fallback 只做过渡兼容。
- `WorldMapHitTargetModel.createWorldMarchTileHitTargets()` 的 `known` 应由 visibility snapshot 判断，而不是 tile 上的 `visibility !== 'unknown'` 临时规则。
- `WorldMapEntitySnapshot` 对 site/actor 输出要区分 memory 和 realtime。
- `WorldFogVisualSnapshot` 继续只接收 compact arrays，避免把 canvas/WebGL 对象放进 domain。

## 推荐落地阶段

### Phase 0：保持默认关闭，但补齐文档和测试

目标：不影响当前开发线，先把接口语义锁住。

- 新增本文档。
- 给 `WorldMapVisibilityModel` 补“scouted 不等于 visible”的测试计划。
- 写一组后端 contract test 草案，覆盖 `unknown/explored/visible/controlled`。
- 不开启 `FOG_OF_WAR_ENABLED`。

### Phase 1：服务端 visibility authority

目标：所有玩家视野查询有统一入口。

- 新增 `WorldVisibilityService`。
- 把 `WorldMapService.revealTile(s)` 写出的 `visibility` 从“全是 scouted”改为按语义写 `explored/visible/controlled`。
- 保持 repository 表结构尽量兼容，必要时只新增字段，不迁移全量地图。
- 后端测试：
  - 出生区 controlled。
  - 行军 route 已经过的 tile explored。
  - 当前行军位置 visible。
  - `visible` 过期后降为 explored，但不丢失地形记忆。

### Phase 2：DTO 裁剪

目标：客户端拿不到视野外实时对象。

- `ClientGameStateAssembler` 带上 `worldVisibilitySnapshot`。
- `TerritoryService.getClientTerritoryState()` 接入 visibility filter。
- 对共享据点、敌方驻军、世界 actor 做 memory/realtime 分级。
- 后端测试：
  - unknown territory 不出现在 DTO。
  - explored enemy city 只返回 memory fields。
  - visible enemy city 返回实时 owner/garrison/leader。
  - dynamic actor 离开 visible 后从 DTO 消失。

### Phase 3：前端接入视觉 fog

目标：开启 feature flag 后 fog 图层稳定可用。

- `FOG_OF_WAR_ENABLED=true` 时，`CanvasGameShell.renderWorldFogLayer()` 消费后端正式 snapshot。
- 主地图、拖动快照、行军 reveal、移动端尺寸都做 Playwright/像素烟测。
- 前端测试：
  - fog layer 不注册 input。
  - visible tile 透明，explored tile 半暗，unknown tile 深暗。
  - 拖动时 `worldMap/worldFog/worldActor` camera transform 同步。
  - snapshot cache miss 不留下错位 fog。

### Phase 4：玩法规则接入

目标：战争迷雾影响命令与战斗。

- `GameActionRegistry` 下的世界命令统一加 visibility guard。
- 攻击/征服/拦截：
  - 移动目标必须 current visible。
  - 已探索静态目标可发起“前往/侦察/攻击地块”，但命中结果以后端结算为准。
- AI/其他玩家动态行军只在 visible 时同步。
- 增加 debug/god mode，只通过服务端权限或本地开发 config 开启。

## 不建议的方案

- 不建议让前端根据 planned tiles 自己决定可见性。
  planned tile 是路径规划和预览数据，不应变成世界事实。

- 不建议把 fog 渲染写进 `WorldMapCanvasRenderer` 主流程。
  现有插件层已经正确，硬塞会破坏 layer ownership。

- 不建议把所有 explored tile 当作 `visible: true` 长期保留。
  这会让动态敌情、命令合法性、视觉 fog 全部语义混乱。

- 不建议一次性启用完整 RTS 视野。
  应先后端 authoritative snapshot，再前端视觉，再命令/战斗。

## 关键文件落点

推荐新增：

- `backend/services/worldMap/WorldVisibilityService.js`
- `backend/tests/WorldVisibilityService.test.js`
- `frontend/js/domain/WorldMapVisibilityModel.test.js` 扩展正式快照用例
- `frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js` 扩展 feature flag 集成用例

推荐改造：

- `backend/services/WorldMapService.js`
- `backend/repositories/WorldMapAuthorityRepository.js`
- `backend/services/worldExplorer/WorldExplorerProgression.js`
- `backend/services/ClientGameStateAssembler.js`
- `backend/services/TerritoryService.js`
- `frontend/js/state/presenters/WorldTileMapPresenter.js`
- `frontend/js/domain/WorldMapEntitySnapshot.js`
- `frontend/js/platform/renderers/WorldMapHitTargetModel.js`

## 验收标准

### 权威性

- 服务端是唯一 canSee/canTarget 判定来源。
- 客户端 DTO 不包含视野外实时对象。
- 前端 hit target payload 只能作为 intent/evidence，不能越权。

### 视觉

- unknown、explored、visible、controlled 四种状态在 fog 下可区分。
- fog layer 不影响输入，不产生独立命中目标。
- 地图拖动、缩放、快照缓存下 fog 不错位。

### 性能

- visibility snapshot 使用 parallel arrays 或紧凑结构。
- 大地图按 chunk/window 查询，不回到全量 tile array。
- fog mask 可复用缓存，行军推进只触发局部 signature 变化。

### 兼容

- `FOG_OF_WAR_ENABLED` 默认仍为 false。
- 旧存档 hidden/unknown tile 不晋升为全局地形。
- 已探索玩家不丢失地形记忆。

## 参考链接

- OpenRA trait documentation: https://docs.openra.net/en/release/traits/
- OpenRA per-player shrouds PR: https://github.com/OpenRA/OpenRA/pull/2507
- 0 A.D. entity component documentation: https://docs.wildfiregames.com/entity-docs/a25.html
- Godot Open RTS repository: https://github.com/lampe-games/godot-open-rts
- Godot Open RTS Fog of War and Visibility overview: https://deepwiki.com/lampe-games/godot-open-rts/2.4-fog-of-war-and-visibility
