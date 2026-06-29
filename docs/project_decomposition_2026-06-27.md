# 文明火种（WXGamesLocal）项目完整分解报告

> **生成日期**：2026-06-27
> **方法**：枚举全部源文件清单（`git ls-files '*.js'`，排除 node_modules/vendor/test）= **415 个玩家侧源文件**（frontend 238 + backend 173 + shared 4；另有 scripts 44 个工具文件单列、256 个测试文件不计入功能分解）。24 个聚类、25 个 agent **逐文件全文阅读**（非推理、非抽样），读取计数 **415/415 ✅**。
> **证据校验**：本报告所有可机械验证的论断已抽查复核——行数误差 ≤2 行、`GameStateNormalizer` 确为 require 16 个 service、`getWorldEpochNowMs` 确在两个 mixin 重复定义、`openBlockingPanelSnapshot` 确在 5 个非测试文件重复、mojibake 确实存在。**未发现夸大；个别项被低估（见 §3.4 修正）。**
> 架构：服务端权威（Node 服务为权威逻辑）+ 手写 Canvas 客户端（无打包器，模块挂全局，script 标签加载）+ `shared/` 纯规则。

---

## 1. 玩家能做什么 — 完整功能清单

下列每个功能给出**端到端关键文件**（前端入口/处理器 → 渲染器/presenter → 后端 service/route/action）。

### 1.1 登录 / 账号 / 会话

- 前端：`frontend/auth.js`（挂 login/logout/reset 到 host）、`frontend/js/api/GameAPI.js`、`frontend/js/ui/H5AuthStorageAdapter.js`（cf\_\* 凭据）、`frontend/js/ui/H5AuthRuntimeAdapter.js`、`frontend/js/platform/renderers/SystemCanvasRenderer.js`（登录面板）、`frontend/js/state/presenters/ShellPresenter.js`（auth 视图态）。
- 后端：`backend/routes/playerRoutes.js`（login/reset/whitelist）、`backend/services/authService.js`（白名单 + JWT + 单会话 + 离线收益）、`backend/config/SecurityConfig.js`、`backend/services/spawn/SpawnLifecycleService.js`（首次出生点 + 初始存档）。

### 1.2 城市管理 / 资源经济（核心循环）

- 前端渲染：`CityCanvasRenderer.js`、`CityPeopleCanvasRenderer.js`、`ResourceTopBarCanvasRenderer.js`、`OverlayCanvasRenderer.js`（资源详情）；presenter：`HomePresenter.js`、`state/GameStateManager.js`、`ECS/GameState.js`。
- 后端：`routes/gameRoutes.js`（/state、/heartbeat）、`services/CityService.js`（多城权威 + 派生统计 + 离线收益）、`calculators/ResourceTickCalculator.js`（每秒经济数学）、`services/CityPlanningService.js`、`services/ClientGameStateAssembler.js`。

### 1.3 建造 / 升级建筑

- 前端：`controllers/BuildingController.js`、`platform/GameCommandService.js`、`platform/CanvasCityActionHandlers.js`（build/upgrade handler）、渲染 `BuildingCanvasRenderer.js`、presenter `BuildingPresenter.js`、域 `ECS/BuildingState.js`。
- 后端：`routes/buildingRoutes.js`、`actions/BuildBuildingAction.js` → `services/BuildingActionService.js`、`validators/BuildingActionValidator.js`、`services/BuildingUnlockService.js`、`calculators/BuildingCostCalculator.js`/`BuildingEffectCalculator.js`、`ECS/BuildingState.js`、`modules/Building*`、`config/BuildingConfig.js`。

### 1.4 人口 / 职业分配 + 民政政策

- 前端：`CityPeopleCanvasRenderer.js`、presenter `HomePresenter.js`/`TalentPolicyPresenter.js`、`frontend/population.js`（已废空 stub）。
- 后端：`actions/AssignPopulationAction.js`、`ECS/Population.js`、`services/TalentPolicyService.js`、`calculators/ResourceTickCalculator.js`（人口增长/上限）。

### 1.5 推进时代（Advance Era）

- 前端：`CivilizationCanvasRenderer.js`、presenter `CivilizationPresenter.js`、handler `CanvasCityActionHandlers.js`。
- 后端：`actions/AdvanceEraAction.js`、`config/EraConfig.js`、`services/TechTreeService.js`（点数授予）、`services/EventService.js`（时代事件）、`services/TutorialService.js`、`modules/BuildingSystem.js`（硬编码时代条件 era1–6）。

### 1.6 科技树研究

- 前端：`TechCanvasRenderer.js`、`TechTreeCanvasRenderer.js`、`TechTreeLayoutModel.js`、交互 `interactions/TechTreeInteractionModel.js`、presenter `TechPresenter.js`、命令 `GameCommandService.js`。
- 后端：`services/TechTreeService.js`、`config/TechTreeConfig.js`、`services/BuildingUnlockService.js`（科技解锁建筑）。

### 1.7 事件系统（普通/威胁/定居特殊）

- 前端：`controllers/EventController.js`、`EventCanvasRenderer.js`、presenter `EventPresenter.js`、域 `ECS/RewardText.js`。
- 后端：`actions/ClaimEventAction.js`、`services/EventService.js`、`ECS/Event.js`、`calculators/EventRewardCalculator.js`；事件生成在 `gameRoutes.js` 每次变更请求后触发。

### 1.8 名人（招募/求贤/委任/技能/属性）

- 前端：handler `CanvasFamousActionHandlers.js`、渲染 `FamousCanvasRenderer.js` + `FamousPanel/Portrait/Skill/Model` 子渲染、配置 `config/FamousPortraitLayout.js`、presenter `FamousPersonPresenter.js`。
- 后端：`services/FamousPersonService.js` + `famousPerson/*`（Constants/Generator/Progression/Shared/RandomAuthority）、`services/SkillGeneratorService.js` + `skillGenerator/*`。

### 1.9 军队 / 阵型编辑器

- 前端：`ArmyFormationEditorCanvasRenderer.js`、`MilitaryCanvasRenderer.js`、presenter `MilitaryPresenter.js`、命令在 `CanvasGameAppCommands.js`/`CanvasGameShellCommands.js`。
- 后端：`services/MilitaryService.js`、`services/military/FormationStrengthService.js`。

### 1.10 世界地图探索 / 行军（World March）

- 前端域：`ECS/WorldMarch*`（System/ProgressSnapshot/Geometry/RoutePolicy/OptimisticState）、`ECS/WorldMap*`（VisibilityModel/RenderSnapshot/EntitySnapshot/InputActionMap/PickingModel/SelectionResolver）、`shared/worldMarchCore.js`/`WorldMarchCoreAdapter.js`。
- 前端运行时/渲染：`platform/WorldMapRuntime*`、`platform/WorldMapRuntimeCoordinator.js`、`CanvasGameShellWorldMap*`、`renderers/WorldMap*`（~30 文件）、`controllers/TerritoryController.js`、handler `CanvasTerritoryActionHandlers.js`。
- 后端：`actions/TerritoryAction.js`、`services/WorldExplorerService.js` + `worldExplorer/*`、`services/WorldMapService.js` + `worldMap/*`、`services/WorldAiExplorerService.js`、`services/realtime/*`、`backend/world-worker.js`。

### 1.11 领地 / 侦察 / 征服

- 前端：`MilitaryCanvasRenderer.js`（侦察 3x3 网格）、`WorldMapSiteOverlayRenderer.js`、presenter `WorldSitePresenter.js`、`TerritoryController.js`。
- 后端：`services/TerritoryService.js` + `territory/*`（16+ 工厂）、`services/TerritoryClientAssembler.js`、`services/DefenderLeaderService.js`、`repositories/SpawnAuthorityRepository.js`/`WorldMapAuthorityRepository.js`。

### 1.12 世界战斗 / 战斗场景

- 前端：`CanvasGameAppBattleScene.js`、渲染 `BattleCanvasRenderer.js` + `BattleCanvasModel/EffectRenderer/FloatingTextRenderer`、域 `ECS/BattleCameraPolicy.js`、presenter `BattleScenePresenter.js`、`shared/battleSimCore.js`/`battleAI.js`。
- 后端：`services/BattleService.js` + `battle/*`、`services/battle/BattleSimService.js`（新实体战）、`services/worldCombat/WorldCombatEncounterService.js`/`WorldCombatSessionService.js`。

### 1.13 任务中心

- 前端：`GuideTaskCanvasRenderer.js`、presenter `TaskGuidePresenter.js`、`MapCommandCanvasRenderer.js`。
- 后端：`services/TaskCenterService.js` + `taskCenter/*`、`services/TaskDefinitionService.js` + `taskDefinitions/*`、`routes/adminRoutes.js`（导入/回滚）。

### 1.14 新手引导 / 教程

- 前端：`tutorial/TutorialGuideController.js` + `TutorialGuide*`（StepPolicy/TargetResolver/PhaseHighlights/FlowRegistry/EventRegistry/UiStateCoordinator）、`TutorialIntroOverlay.js`、渲染 `Tutorial*CanvasRenderer.js`、`SpineWebglPlayer.js`。
- 后端：`services/TutorialService.js` → `TutorialProgressService.js` → `tutorial/*`、`config/TutorialFlowConfig.js`；并散落于 `worldExplorer/WorldExplorerTutorial.js`、`MilitaryService.js`、`TaskCenterService.js`。

### 1.15 设置 / 日志 / 运维

- 前端：`frontend/logs.js`、`SystemCanvasRenderer.js`、`debug/ClientOperationLog.js`、`debug/H5LoadTrace.js`、`services/UpdateChecker.js`、`H5UpdateRuntimeAdapter.js`。
- 后端：`routes/clientEventsRoutes.js`、`routes/opsRoutes.js`、`routes/metricsRoutes.js`、`services/logService.js`、`services/ObservabilityService.js`、`services/OpsControlService.js`/`OpsAuthService.js`、`ops-agent/*`。

---

## 2. 系统 / 子系统树

```
文明火种
├── A. 后端权威逻辑 (backend/)
│   ├── A1 动作分发层 (actions/, 6 文件) — 玩家动作路由 → service [GameActionRegistry 为总线]
│   ├── A2 经济/建筑域 (calculators/ 4 + ECS/BuildingState + modules/Building* 5) — 资源/成本/效果纯算
│   ├── A3 城市经济服务 (CityService/CityPlanningService/ClientGameStateAssembler, ~4) — 多城权威 + 视图组装
│   ├── A4 事件系统 (EventService + ECS/Event + EventRewardCalculator, 3) — 事件生成/结算
│   ├── A5 时代/科技 (TechTreeService + config/EraConfig/TechTreeConfig + BuildingUnlockService, ~4)
│   ├── A6 名人/技能生成 (famousPerson/* 5 + skillGenerator/* 6 + SkillGeneratorService/FamousPersonService) — ~13
│   ├── A7 军队/阵型 (MilitaryService + military/FormationStrengthService, 2)
│   ├── A8 领地/侦察/征服 (TerritoryService + territory/* 16 + TerritoryClientAssembler + DefenderLeaderService) — ~19
│   ├── A9 世界地图生成/雾 (WorldMapService + worldMap/* 8) — 9
│   ├── A10 世界行军/探索 (WorldExplorerService + worldExplorer/* 9 + WorldAiExplorerService) — ~11
│   ├── A11 世界战斗 (BattleService + battle/* 5 + BattleSimService + worldCombat/* 2) — ~9
│   ├── A12 教程后端 (TutorialService/TutorialProgressService + tutorial/* 6) — 8
│   ├── A13 任务中心 (TaskCenterService + taskCenter/* 4 + TaskDefinitionService + taskDefinitions/* 5) — ~11
│   ├── A14 游戏态生命周期 (GameStateNormalizer + GameStateService + GameStateMigrationPipeline) — 3 [god 编排]
│   ├── A15 出生点分配 (spawn/* 7)
│   ├── A16 实时/世界 tick (realtime/* 7 + world-worker.js) — 8
│   ├── A17 配置治理 (config/Config* 5 + GameplayConfigRuntime) — 6
│   ├── A18 持久化 (repositories/* 3, SQLite) — GameStateRepository 为 god-file
│   ├── A19 HTTP 路由层 (routes/* 8 + server.js)
│   └── A20 运维/可观测/中间件 (Ops*/Observability/Schema/Performance + middleware/* 3 + ops-agent/* 3) — ~12
│
├── B. 客户端平台/壳 (frontend/js/platform/)
│   ├── B1 CanvasGameApp 主机 (CanvasGameApp + 9 mixin) — god-object
│   ├── B2 CanvasGameShell 壳 (CanvasGameShell + ~13 mixin) — god-object
│   ├── B3 动作分发 (CanvasActionController/DispatchRegistry/Dispatcher + 4 ActionHandlers)
│   ├── B4 模式/模态所有权 (CanvasModeOwnershipBridge/ModalSnapshotAdapter/ModalCallbackRegistry) — ECS 边界
│   ├── B5 世界地图运行时 (WorldMapRuntime + 7 policy + Coordinator + RenderPipeline) — ~10
│   ├── B6 平台抽象 (PlatformRuntime/H5Canvas* 4 + MiniGame* + H5* 别名 shim)
│   └── B7 命令服务 (GameCommandService)
│
├── C. 客户端渲染层 (platform/renderers/, ~60 文件)
│   ├── C1 Canvas 绘图原语 (CanvasSurface*/CanvasAsset*/CanvasFrame*/HudOverlay/HudTabPage)
│   ├── C2 渲染器组合根 (CanvasGameRenderer + CompositionFactory + Core/Page Facades)
│   ├── C3 每功能面板渲染 (Building/City/CityPeople/Civilization/Event/Famous*/Military/Tech*/Map* …)
│   ├── C4 战斗渲染 (Battle* 4)
│   ├── C5 世界地图渲染管线 (WorldMap* ~35 + WorldTileWater/WorldActor/WorldFog) — 最大子树
│   └── C6 教程渲染 (Tutorial* 7 + Spine)
│
├── D. 客户端域/状态/presenter (ECS/, state/)
│   ├── D1 世界地图域纯规则 (WorldMarch*/WorldMap*/Tile*/World{Clock,Time,Topology,Chunk}) — ~25
│   ├── D2 i18n/本地化 (LocaleTextRegistry 1856行 + LocaleText + RewardText)
│   ├── D3 状态容器 (GameStateManager + ECS/GameState/BuildingState)
│   ├── D4 presenter 层 (UIStatePresenter + Delegates + presenters/* 13)
│   └── D5 调试/遥测 (ClientOperationLog/CodexWorldMapDiag/H5LoadTrace/WorldMarchTrace/DebugOverlaySnapshot)
│
├── E. ECS 模式/模态运行时 (ecs/, 14 文件)
│   └── ModeKeys/ModeResolver/ModeWorld/ModeComponents + ModalWorld + RendererSnapshotBoundary
│       + InputIntent* + BattleOwner + EcsModeRuntimeBundle(生成产物 2502行)
│
├── F. shared/ 纯规则 (4 文件)
│   └── worldMarchCore / battleSimCore / battleAI / signatureHash
│
├── G. 客户端引导 (ui/H5* + app.js + minigame/game.js + logs.js/population.js)
│
└── H. 工具/labs (tools/* 3 + backend/scripts + frontend-api-example.js) — 独立非生产
```

---

## 3. 边界不清的"混沌"系统（按严重度排序）

### 🔴 极严重（fix-any-bug-requires-global-search 重灾区）

1. **`backend/routes/gameRoutes.js`（511 行 god-route）** — 把教程门控、era2 激活、事件生成（动作前后各调一次 `EventService`）、世界战斗会话（自有 `WORLD_COMBAT_ACTIONS` 绕过 `GameActionRegistry`）、~150 行行军 trace 插桩、心跳上报、revision 冲突重试全部塞进一个文件，几乎是所有玩家功能的唯一集成点。

2. **`backend/services/GameStateNormalizer.js`（165 行但 god 编排）** — `require()` **16 个** service（已核验），服务几乎每个玩家功能，是后端的中央耦合咽喉与全局搜索磁石。`GameStateService.js` 又与它职责重叠（两个文件都"拥有游戏态"）。

3. **`frontend/js/platform/CanvasGameShell.js`（323 行）+ 13 mixin（god-object）** — 所有功能共享一个扁平实例（~40 可变字段），文件拆分仅是表面的；mixin 间自由互相 reach（Commands 调 RenderingRuntime 的方法、ModalSnapshotAdapter 的方法等）。

4. **`frontend/js/platform/CanvasGameApp.js`（241 行）+ 9 mixin（god-object）** — 构造 ~12 协作者；**`CanvasGameAppCommands.js`（813 行 ← 比初估 740 更糟，已核验）** 一文件涵盖名人/阵型/建筑/行军/任务奖励五个无关功能；`renderCanvasSurface()` ~150 行 god-method。**`getWorldEpochNowMs()` 在 `CanvasGameAppRenderingRuntime.js:339` 与 `CanvasGameAppStateSync.js:358` 重复定义（已核验，后装的赢）。**

5. **`backend/repositories/GameStateRepository.js`（509 行 god-file）** — 单仓库序列化 ~40 列横跨每个功能；列清单在 CREATE TABLE、`GAME_STATE_COMPAT_COLUMNS`、INSERT/UPDATE 三处手工同步。子仓 `SpawnAuthorityRepository`/`WorldMapAuthorityRepository` 反向读写父仓的 `game_states` 表（双向耦合）。

### 🟠 严重

6. **`backend/actions/GameActionRegistry.js`（199 行 hub god-router）** — 单一 fan-out 点，任何新功能都要改它；`buildTerritoryPayload` 硬编码大字段白名单耦合 world-march 内部。

7. **`backend/services/TerritoryService.js`（521 行）** + `territory/*` — DI 工厂前向引用 hazard、lazy `require('./FamousPersonService')` 规避循环依赖；`TerritoryStateNormalizer.js`（412 行）经 ~12 注入 helper reach 整个子系统；侦察 reveal-area/route 逻辑在 ≥4 文件重复；站点评分公式在 `ScoutResults` 与 `SiteMigration` 近重复。

8. **`frontend/js/api/GameAPI.js`（668 行 god-file）** — HTTP 传输 + 行军 trace 烘进通用 `request()` 路径 + ~40 个全功能 RPC 方法三种无关职责混在一起。

9. **世界地图渲染 facade-of-facades** — `WorldMapCanvasRenderer.js`（~90 纯透传）、`WorldMapLayoutFacade.js` 与 `WorldMapLayoutModel.js` 全量重复实现、`WorldMapLayerCanvasRenderer.js`（1037 行第二 god-file）；遍布 Proxy 透传 `this.host` 致 `worldTileStaticCache`/`ctx` 所有权不明。

10. **`renderers/HudOverlayCanvasRenderer.js` + `CanvasFrameRenderer.js`** — `renderHudOverlay()` ~115 行 if-ladder 驱动每个功能；`CanvasFrameRenderer` 的 `renderMapHomeOverlays`/`renderStandardOverlays` 大段重复。两者均用 Proxy 隐式依赖宿主数十方法。

11. **教程横切 6+ 文件 / 三处副本** — `tutorial/*` + `worldExplorer/WorldExplorerTutorial.js`（重复 `advanceTutorialStep`/`getTutorialScoutPersonId`/`getFormationSnapshot`）+ `MilitaryService`/`TaskCenterService` 各自 roll 自己的 tutorial 推进；`TutorialActionValidator.js`（~300 行 god-validator）门控每个动作。前端侧 `TutorialGuideController`（~600 行）+ `TutorialGuideUiStateCoordinator`（半迁移、双 host 镜像）。

12. **ECS 词表三/四处手工同步** — `ModeKeys` / `ModeResolver` / `RendererSnapshotBoundary` + `EcsBoundaryManifest.MODE_KEYS`（已过期）；`EcsModeRuntimeBundle.js`（2502 行生成产物）逐字复制每个 ecs 源文件，编辑后不重新生成即漂移。

### 🟡 中度

13. **跨 host 镜像普遍**（`game` vs `canvasShell` vs `lastGame`）— `openBlockingPanelSnapshot`/`closeBlockingPanelSnapshot` 在 **5 个非测试文件**逐字重复（已核验：CanvasCityActionHandlers / CanvasFamousActionHandlers / CanvasGameAppCommands / CanvasGameAppGuideUi / CanvasGameShellCommands）；actor-picking 诊断块在 ≥4 文件复制；阻塞遮罩 OR 链在 4 处。
14. **`WorldMarchOptimisticState.js` 边界违规** — 居于 `ECS/` 却直接 mutate host/canvasShell/stateManager 并调 render，实为伪装成域的 controller。
15. **配置非叶子层** — `config/` reach 进 `services/config/GameplayConfigRuntime`；`GameplayConfigRuntime.js` 一文件 owns 5 个无关功能配置 + 域数学；`GameConfig.FOG_OF_WAR_ENABLED:true` 与 `FeatureFlags` 默认 `false` 冲突。
16. **presenter 层样板重复** — 7 个 presenter 各自重声明 `t/toNumber/formatResourceAmount` 等；`ShellPresenter` 是 grab-bag 服务 6 个无关功能；`UIStatePresenter` 空壳 + 手维护 DELEGATE_METHODS 白名单。
17. **目录聚类而非功能聚类** — `backend/frontend-api-example.js`（后端树里的死浏览器示例代码）、taskDefinitions 与 territory 仅靠目录绑一起。
18. **死/stub 残留** — `frontend/population.js`、`CanvasGameAppGuideUi.js` 大量返回 false 的旧 guide 方法、`TutorialGrantService.ensureLumbermillGuideResources`、`GuideTaskCanvasRenderer` 空 stub。
19. **编码/i18n 损坏（已核验真实）** — `AdvanceEraAction.js:61` 含 mojibake 中文 `'鍙湁涓诲煄鍙互鎺ㄥ姩鏂囨槑杩涢樁'`（GBK 被当 UTF-8 解码的玩家可见文案，应为"只有主城可以推动文明进阶"）+ 文件首 UTF-8 BOM；同类散见于 `GameActionRegistry`/`BuildingActionValidator`/`CanvasGameAppRenderPolicy`。**这类 mojibake 因"看着像合法汉字"而躲过 U+FFFD 检测，需专项扫。**

---

## 4. 高扇入文件（被很多功能/文件依赖）

> 后端数字为**精确 require 依赖图**（机械解析，非估算）；前端为全局引用频次估算。**★ = 高扇入 AND 跨多系统 = 危险耦合枢纽。**

**后端精确扇入 TOP（被 N 个文件 require）：**

| 扇入 | 文件                                                                                                 | 跨系统？                                                |
| ---: | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
|   27 | ★ `services/config/GameplayConfigRuntime.js`                                                         | 是（building/era/tech/tutorial/game 五域配置 + 域数学） |
|   16 | ★ `services/WorldMapService.js`（483 行）                                                            | 是（领地/侦察/行军/出生/雾）                            |
|   15 | `ECS/BuildingState.js`                                                                            | 否（建筑域内聚，好的高扇入）                            |
|   14 | `services/territory/TerritoryConstants.js`                                                           | 否（常量，好的高扇入）                                  |
|   13 | ★ `services/CityService.js`                                                                          | 是（经济/建筑/人口/事件/领地）                          |
|   11 | `services/territory/TerritoryShared.js`                                                              | 否（共享规则）                                          |
|   10 | ★ `services/TutorialService.js`                                                                      | 是（横切几乎所有功能）                                  |
|    9 | `services/config/ConfigRegistryContract.js`                                                          | 否（配置内聚）                                          |
|    7 | ★ `services/FamousPersonService.js` / `TerritoryService.js` / `military/FormationStrengthService.js` | 部分是                                                  |

**前端高扇入（全局引用估算）：** `LocaleText/LocaleTextRegistry`(65，i18n，全功能但纯净)、`TileCoord`(28，且各处有 fallback 副本)、`WorldMarchSystem→WorldMarchProgressSnapshot`(823 行，行军/雾/渲染/输入)、`SignatureHash`(18，双端基建)、`UIStatePresenter`(13 presenter 的咽喉)、`CanvasModalSnapshotAdapter`(15，模态桥)。

> 注：`numberUtils`(29)、`objectUtils`(19) 高扇入是**近期收口的共享工具**被广泛采用的证据，属"好的高扇入"。

**最危险的 5 个枢纽**（高扇入 + 跨系统 + 自身臃肿/混乱）：
`GameplayConfigRuntime`、`WorldMapService`、`CityService`、`FamousPersonService`、`WorldMarchProgressSnapshot`。改动它们任意一个的爆炸半径横跨多个功能。

---

## 5. 一句话体检结论

**整体结构是"清晰的分层意图 + 重度横切污染"的混合体：纯规则（`shared/`、多数 `ECS/` 与 `calculators/`）干净内聚，但每一条玩家功能链路都被三个反复出现的系统性缺陷拉穿——(1) 少数 god-file 充当全功能集成点（后端 `gameRoutes.js`/`GameStateNormalizer.js`/`GameStateRepository.js`/`GameActionRegistry.js`，前端 `CanvasGameShell`/`CanvasGameApp`/`GameAPI`/世界地图渲染 facade 群）；(2) 教程、行军 trace、坐标/tileId、阻塞面板快照、actor-picking 诊断等逻辑在 4–6 处复制粘贴且需手工同步；(3) `game`/`canvasShell`/`lastGame` 三宿主镜像与 Proxy 透传使"谁拥有这块状态"普遍不明。**

结构风险高度集中在三处：**世界地图/行军子系统**（横跨后端 worldMap/worldExplorer/realtime + 前端 ECS/runtime/~35 渲染器，是全项目最大且耦合最深的子树）、**教程系统**（横切 6+ 文件、3 处重复推进逻辑、半迁移的双 host 镜像）、以及 **ECS Batch 8F 模态迁移**（词表四处同步 + 2502 行生成 bundle 漂移风险 + 旧 OR 链 fallback 未清）。

**质量对齐计划的优先级建议**：先收口五大跨系统枢纽（§4★）的 fan-out → 再把三套复制逻辑（教程推进、坐标/tileId、阻塞面板快照）抽公共 util → 最后完成 Batch 8F 的单一所有权收敛并删除 §3.18 列出的死 stub。

---

## 附录：统计分布（来自 415 文件证据）

**分层文件数**：backend-service 86 · client-renderer 67 · client-platform 54 · client-scope 47 · backend-scope 31 · backend-infra 24 · backend-config 20 · client-presenter 19 · client-ecs 15 · backend-route 10 · client-controller 8 · client-tutorial 8 · shared 6 · tool 6。

**功能 → 触及文件数**（耦合广度）：世界地图/行军 **177** · 领地/侦察 103 · 世界战斗 96 · 城市管理 94 · 教程 86 · 建造 55 · 名人 53 · 科技 46 · 事件 43 · 任务中心 39 · 推进时代 35 · 阵型 30 · 登录 29 · 人口 21。

> 世界地图/行军触及 177 个文件、教程触及 86 个文件——这两条"触手最长"的链路与 §5 指认的两大风险区完全吻合。
