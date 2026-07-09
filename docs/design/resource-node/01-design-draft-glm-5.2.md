# 资源地系统 — 设计初稿（模型：glm-5.2）

> 输入：`docs/design/resource-node/00-brief-2026-07-09.md`（第二节锚点按真实仓库逐项核对）。
> 约束：需求冻结不改；数值全表驱动；嫁接现有系统不平行造轮子；不写代码，只给设计。
> 所有"现有系统接缝"引用的均为真实仓库路径。新增表/文件以"拟新增"标注。

---

## 0. 概述

资源地是世界地图上可被玩家（及 PVPVE 势力）争夺、占领后按等级每秒产出基础资源的固定地表站点。

- **范围**：4 类型 × 10 等级 = 40 种规格，铺设为共享世界实体（与现有野怪营地同一"全局共享、玩家侧按视野投影"模型）。
- **闭环**：发现（视野内）→ 攻打守军（复用 BattleSimService 权威战斗）→ 胜利后进入 **1 分钟部署期**（冻结）→ 部署期结束归属玩家 → 玩家享有按等级/类型的每秒资源收益 → 可被第三方夺占（含 AI 势力）。
- **设计隐喻**：资源地是"野怪营地（一次性战利品）+ 城占领军（持续产出+被夺占）"两条已落地闭环的嫁接种——守军/铺设/可见性复用营地链路，归属/部署/被夺复用城占领链路。
- **数值宿主**：新增 4 张配置表（`resource_node_yield` / `resource_node_garrison` / `resource_node_placement` / `resource_node_tuning`），全部走现有 `config/tables/*.xlsx → scripts/build-config-tables.js → backend/config/generated/*.json → ConfigTables` 管线，不写常量在代码里。

---

## 1. リ数据模型

### 1.1 共享世界实体（服务端权威，多玩家共用）

资源地是**共享世界实体**，由确定性铺设器生成、由 `ResourceNodeRepository`（拟新增，见 §6.2）持久化，对齐现有 `backend/repositories/WorldEncounterRepository.js` 的"共享/玩家投影分离"约定。投影到单个玩家时按视野过滤（见 §5）。

`gameState.sharedResourceNodes`（拟新增，镜像 `sharedWorldEncounters` 的位置语义）：

```
schema: 'shared-resource-nodes-v1'
nodes: {
  [nodeId]: {
    id            // 'rnode_{q}_{r}'，确定性
    type          // 'forest' | 'stone' | 'iron' | 'farm'
    level         // 1..10
    q, r, tileId, terrain
    activityRegionId  // 铺设时归并的活动区，与营地同源
    status        // 'uncontrolled' | 'contested' | 'deploying' | 'owned'
    ownerFactionId // null | 'player' | ai 势力 factionId
    claimantFactionId // 部署期/争夺中的占领方（同 owner 字段语义）
    garrison {         // 守军（无主状态、被夺后再生）
      baseSoldiers, soldiers, quality, threat, leader, regenAt
    }
    ownGarrison {      // 占领方驻军（占领后防御体）
      soldiers, atFullAt
    }
    combat {           // 争夺中战斗状态，语义对齐 mission.combat
      status, battleId, encounterRef, engagedAt
    }
    deploy {           // 部署期
      startedAt, completesAt, claimantFactionId
    }
    income {            // 收益结算游标（服务端 tick）
      lastSettledAt
    }
    createdAt, updatedAt
  }
}
recentReports: []      // 最近夺占战报，限 5（对齐 worldCombat.recentReports）
updatedAt
```

> `ownerFactionId` 取 `'player'` 表示当前玩家（单服单玩家世界，沿用现有 `gameState.territories[].owner === 'player'` 约定）；AI 势力取 `shared/faction/factionCore.js::aiFactionId(slug)`。

### 1.2 玩家私有投影（DTO）

`gameState.resourceNodes`（玩家可见部分）由视野谓词过滤后下发，形状与 `WorldCombatEncounterService.getClientEncounter`（`backend/services/worldCombat/WorldCombatEncounterService.js`）一致：守军血量在"打过才显示"前不携带任何数字（沿用 §9 决定的"打了才知道"先例）。

---

## 2. 配置表设计（列结构）

新增 4 张表，全部登记进 `config/tables/table-schemas.js::TABLES`，跟随 `scripts/build-config-tables.js` 生成 `backend/config/generated/<table>.json`，由 `backend/config/ConfigTables.js::getRows/getById` 读取。字段说明承接现有表 `garrison`/`veteran_camp`/`ai_faction_profile` 的 `label/fill/effect` 文档风格。

### 2.1 `resource_node_yield`（收益主表）

主键 `yieldId`，4 类型 × 10 等级 = 40 行；唯一收益数字来源。

| key | type | label | fill | effect |
|---|---|---|---|---|
| yieldId | string | 收益档标识（主键） | `${type}_${level}`，唯一 | 代码按 type+level 取行 |
| type | string | 资源地类型 | forest / stone / iron / farm | 决定产出资源键 |
| level | int | 等级 | 1..10 | 等级 |
| resourceKey | string | 产出资源键 | wood / stone / iron / food | 必须在 `LOOT_RESOURCE_KEYS`（`WorldCombatEncounterService.js:19`）集合内 |
| yieldPerSecond | float | 每秒净产出 | 见下表 | 占领后 tick 入账的基础速率 |
| tierVisual | int | 视觉分档 | 1=1-3级 / 2=4-6级 / 3=7-9级 / 4=10级 | 美术选图用，见 §7 |

收益量级初稿（单位：资源/秒）。对照依据：现有城市产出基线 `backend/config/GameConfig.js::resources`（baseWoodPerCraftsman 1.0、baseStonePerCraftsman 0.8、baseIronPerCraftsman 0.55、baseFoodPerFarmer 1.0）并叠加建筑 `woodOutputBase` 等（`shared/buildingConfig.json`），产率来自 `backend/calculators/ResourceTickCalculator.js`。资源地产出刻意低于一座中期城市的单项产率，作为"补充产出"而非"替代城市"：

| level | forest(wood) | stone(stone) | iron(iron) | farm(food) |
|---|---|---|---|---|
| 1 | 0.5 | 0.4 | 0.3 | 0.6 |
| 2 | 0.8 | 0.6 | 0.5 | 1.0 |
| 3 | 1.1 | 0.9 | 0.7 | 1.4 |
| 4 | 1.5 | 1.2 | 0.9 | 1.9 |
| 5 | 2.0 | 1.6 | 1.2 | 2.5 |
| 6 | 2.6 | 2.1 | 1.6 | 3.2 |
| 7 | 3.3 | 2.7 | 2.0 | 4.0 |
| 8 | 4.1 | 3.4 | 2.5 | 5.0 |
| 9 | 5.0 | 4.2 | 3.1 | 6.0 |
| 10 | 6.0 | 5.2 | 3.8 | 7.2 |

> 量级关系：L1 节点 ≈ 0.5 个木匠的产出；L10 节点 ≈ 3 个木匠+中级伐木场（约 `baseWoodPerCraftsman×woodOutputBase≈2/s` 量级）的补充。稀缺资源（铁/石）按其城市基线偏低（0.55/0.8 vs 1.0）等比下调，铁节点尤其低以维持"铁是瓶颈资源"的现有经济张力（见 `scripts/economy-balance-model.js` 的产出/消耗台账）。

### 2.2 `resource_node_garrison`（守军/部署表）

主键 `level`，1..10 行；守军配置参照 `config/tables/garrison.xlsx`（`backend/services/territory/GarrisonPolicy.js::garrisonSoldiers = base + perScale×scale`）、野怪营地 `backend/config/WorldCampConfig.js::CAMP_ARCHETYPES`（`soldiersBase + soldiersPerRing×ring`）。

| key | type | label | fill | effect |
|---|---|---|---|---|
| level | int | 等级（主键） | 1..10 | |
| baseSoldiers | int | 守军基础兵力 | 如 50 | 守军 = base + soldiersPerLevel×level |
| soldiersPerLevel | int | 每级增量兵力 | 如 18 | 见上 |
| leaderQuality | string | 守将品质 | common/seasoned/elite/great/legendary | 喂 `DefenderLeaderService` 的 quality（对齐 `garrison.xlsx` 同名列） |
| threatTier | int | 威胁档 | 1..5 | 守军 leader 威胁（对齐营地 `threatTier`） |
| respawnCooldownMs | int | 守军被打败后再生周期（毫秒） | 20..120 min | 无主状态恢复；0=不自动再生 |
| deploySeconds | int | 部署期时长（秒） | 冻结需求=60 | `deploying→owned` 唯一门 |
| ownGarrisonBaseSoldiers | int | 占领方驻军基线 | 如 0 | 占领后 `ownGarrison` 起点；参照城市占领后无固定驻军的留白 |
| ownGarrisonRegenSeconds | int | 占领方驻军再生周期（秒） | -1=不自动再生 | 见待决问题 1/2 |
| captureChance | float | 夺占胜利后捕获守将概率 | 0..1，0=关闭 | 复用 `GarrisonCaptureResolver`；资源地默认 0（不进捕将流），可调 |

守军兵力初稿（守军 = base + perLevel×level）：

| level | base | perLevel | quality | threat | respawnCooldownMs | deploySeconds | ownGarrisonBase | ownRegen(s) | captureChance |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 50 | 18 | common | 1 | 1200000 | 60 | 0 | -1 | 0 |
| 2 | 70 | 26 | common | 1 | 1200000 | 60 | 0 | -1 | 0 |
| 3 | 95 | 34 | seasoned | 2 | 1500000 | 60 | 0 | -1 | 0 |
| 4 | 125 | 44 | seasoned | 2 | 1800000 | 60 | 0 | -1 | 0 |
| 5 | 160 | 56 | elite | 3 | 2400000 | 60 | 0 | -1 | 0 |
| 6 | 200 | 70 | elite | 3 | 3000000 | 60 | 0 | -1 | 0 |
| 7 | 245 | 86 | great | 4 | 3600000 | 60 | 0 | -1 | 0 |
| 8 | 295 | 104 | great | 4 | 4200000 | 60 | 0 | -1 | 0 |
| 9 | 350 | 124 | legendary | 5 | 5400000 | 60 | 0 | -1 | 0 |
| 10 | 410 | 148 | legendary | 5 | 7200000 | 60 | 0 | -1 | 0 |

（守军实兵力：L1=68，L5=440，L10=1890，弱于城市同档守军——资源地是据点不是城。）

### 2.3 `resource_node_placement`（铺设/分布，key-value 表）

主键 `paramKey`，参照 `config/tables/diplomacy_tuning.xlsx`/`personality_tuning.xlsx` 的 key-value 风格。镜像 `backend/config/WorldCampConfig.js::PLACEMENT`。

| paramKey | value | 含义 |
|---|---|---|
| activityRegionSize | 8 | 活动区网度，对齐营地 `PLACEMENT.activityRegionSize` |
| safeRadiusFromActivity | 1 | 距活动源最近距离（保护出生区） |
| minSpacing | 2 | 两资源地最小镇布енсив间距（Chebyshev） |
| ringBands | json | `[{minRing:2,maxRing:3,targetNodes:2},{minRing:4,maxRing:5,targetNodes:2},{minRing:6,maxRing:8,targetNodes:2}]` 复用 `WorldCampSpawner.resolveRingBands` |
| tierByRing | json | 等级地理梯度：`[{minRing:2,levelMin:1,levelMax:3},{minRing:4,levelMin:2,levelMax:5},{minRing:6,levelMin:4,levelMax:7},{minRing:8,levelMin:6,levelMax:10}]`（离活动源越远等级上限越高，近弱远强） |
| typeWeightForest | 0.3 | 4 类型在地表的可铺设权重（按地形过滤后），用于确定性铺设抽签 |
| typeWeightStone | 0.2 | |
| typeWeightIron | 0.2 | |
| typeWeightFarm | 0.3 | |
| terrainFilterForest | csv | 允许铺设地形：`plains,forest,hills`（排除 `MARCH_BLOCKED_TERRAINS`） |
| terrainFilterStone | csv | `hills,mountain,waste` |
| terrainFilterIron | csv | `mountain,hills,waste` |
| terrainFilterFarm | csv | `plains,forest,shore` |

### 2.4 `resource_node_tuning`（占领/经济/可见性调参，key-value 表）

| paramKey | value | 含义 |
|---|---|---|
| maxOwnedPerPlayer | 12 | 单玩家占领总数上限（见待决问题 5） |
| maxOwnedPerType | 6 | 单类型上限，防独家垄断稀缺资源 |
| yieldDecayPerExtra | 0.05 | 每超出"前 N 个同类"后收益线性衰减：第 k 个(k>N)系数 = 1-(k-N)×0.05，下限 0.4 |
| yieldDecayGracePerType | 3 | 衰减宽限数：前 3 个同类不衰减 |
| offlineEfficiency | 0.8 | 离线资源地收益效率，对齐 `GameConfig.resources.offlineBaseEfficiency` |
| offlineMaxHours | 8 | 离线结算最多 8 小时，对齐 `GameConfig.resources.maxOfflineHours` |
| ownedAlwaysVisibleSelf | true | 己方已占领节点恒可见（即使脱离当前视野） |
| contestedGarrisonRegenAfterCaptureMs | 0 | 被夺后是否立即重置守军；0=沿用 `respawnCooldownMs` |
| abortDeployKeepGarrisonSoldiersRatio | 1.0 | 中止部署期时残留守军比例（1=按战后残兵定格） |
| aiCanOccupy | true | AI 势力是否参与夺占（PVPVE，见待决问题 6） |

---

## 3. 服务端流程 — 占领状态机

状态：`uncontrolled → contested → deploying → owned → (被夺) → contested/uncontrolled`。全流程在服务端权威推进，客户端只发"意图"。

### 3.1 uncontrolled（无主）
- 铺设器（拟新增 `backend/services/worldResource/ResourceNodeSpawner.js`）确定性生成，与 `backend/services/worldCombat/WorldCampSpawner.js::planCampsForActivitySources` 同一套活动区/环走/确定性排序逻辑；产出进 `ResourceNodeRepository`。
- 守军按 `resource_node_garrison` 行填充 `garrison.{baseSoldiers→soldiers, quality, threat}`，leader 由 `DefenderLeaderService.createDefenderLeader`（`backend/services/DefenderLeaderService.js`，对齐营地 `createDefenderLeader` 的 `type:'camp', owner:'tribe'`）生成。
- 可见性：见 §5。

### 3.2 contested（攻打守军）
- 触发：玩家行军抵达资源地 tile（`WorldExplorerProgression` 现有的 arrival hook 命中），或玩家在 tile 上"发起进攻"。
- 战斗链路 **完全复用** `WorldCombatSessionService.openSession`（`backend/services/worldCombat/WorldCombatSessionService.js`）/`resolveSession`：服务端建 seed+setup，客户端打、记录 inputStream，服务端用 `BattleSimService.simulateSetup`（`backend/services/battle/BattleSimService.js`）权威重算。资源地作为一个 `encounterRef` 参与，与营地共用同一 session 槽（依旧受 `WORLD_COMBAT_SESSION_BUSY` 单战斗在局约束）。
  - 监军 general 由资源地 `garrison` 经 `WorldCombatEncounterService.getDefenderGenerals` 同构构造（资源地实体喂入 `encounter` 形状即可）。
- 胜利：
  - 调 `applyCampVictorySpoils` 等价逻辑——但资源地**不发一次性战利品**（产出来源是占领后的每秒收益），只置 `status='deploying'`、`deploy.startedAt=now`、`deploy.completesAt=now+deploySeconds×1000`、`claimantFactionId=玩家`，并把残存攻击方编队**就地停留**在 tile（不回城——它要守部署期）。
  - 败北：损伤写回编队快照（`WorldCombatEncounterService.settleMissionSnapshot`），编队按 `returnWorldMarch` 同构自动返程（对齐营地非胜利路径 `WorldCombatSessionService.js:278-281`）。
- 离线兜底：`resolveEngagedTimeouts`（`WorldCombatEncounterService.js:685`）现有 45s `AUTO_ENGAGE_FALLBACK_MS` 兜底，资源地战斗纳入同一 engaged 超时扫描即可。

### 3.3 deploying（部署期，冻结 60s）
- 编队**不可移动、不可撤退**（需求 5）。在 `WorldExplorerActions`（`backend/services/worldExplorer/WorldExplorerActions.js`）的 `startWorldMarch`/`returnWorldMarch` 之前加一道"该 mission 是否锁定部署期"的校验；客户端发起移动/撤退时返回 `{success:false, error:'DEPLOY_IN_PROGRESS', message:'移动/撤退将会中止占领进程'}`——**这句冻结提示语**是后端直发中文且同时进 i18n catalog（见 §4）。
  - "中止"分支：玩家在确认框选确定 → 后端 `abortDeploy`：置 `status='uncontrolled'`，按 `abortDeployKeepGarrisonSoldiersRatio` 残留守军，部署期清零，编队返回-idle（不回城，保留 tile 上的部队）。
- 部署期被第三方攻击 → 见 §待决问题 3 的决定：**部署期内资源地不可被第三方攻击**（战斗插入会破坏 60s 冻结语义；第三方打到 tile 上会被 `getActiveEncounterAt` 命中守军在的 `uncontrolled` 节点，而 `deploying` 节点不作为可攻击 encounter 投影给非占领方），但允许**于部署期结束后立刻抢攻**——即"部署期是 60s 安全窗"，进度明确、玩家体验可解释。

### 3.4 owned（已占领）
- `deploy.completesAt` 到点 → 服务端 tick 把 `status='owned'`、`ownerFactionId=claimantFactionId`、初始化 `ownGarrison`（按 `ownGarrisonBaseSoldiers`，默认 0 即"占领方驻军为 0，靠编队守在此 tile"——见待决问题 2 的决定）、`income.lastSettledAt=now`。
- 每秒收益：见 §3.6 结算模型。
- 被夺：第三方（玩家或 AI）行军到 tile 攻打**占领方驻军**→复用 contested 战斗；胜则该方进入新一次 deploying（属同一状态机的 contested 分支，但守方换编队），败则维持 owned。`status='owned'` 在战斗中临时进 `contested`，胜/负回写。

### 3.5 离线/边界
- 玩家下线：资源地收益按 `offlineEfficiency/maxOfflineHours` 在下次上线时一次性结算（对齐 `CityService.calculateOfflineIncomeForAllCities`）。
- 战斗在局时玩家下线：上层 `SESSION_STALE_MS`（5min）扫除 + engaged 45s 兜底已有，不改。

### 3.6 每秒收益结算模型（与现有结算模型一致性选型理由）
- **选型：复用"每秒 tick"模型，不引入行军式三条腿结算**。
- 依据：现有每秒资源产出由 `backend/calculators/ResourceTickCalculator.js::calculateOutputs` 计算、由 `backend/services/CityService.js::advanceAllCities`（`CityService.js:254-296`，`city.resources.X += outputs.XPerSecond * seconds`）应用、离线由 `calculateOfflineIncomeForAllCities`（`CityService.js:298-360`）。三条腿（worker tick / heartbeat / action 写，见 `backend/routes/gameRoutes.js` heartbeat 段 + `backend/actions/GameActionRegistry.js`）服务的是**行军 mission 的瞬态进度推进**——mission 是有起止的行进体，需要 worker 在线推进 + 心跳上报 + action 修正。资源地收益是**持续状态式被动产出**，没有"行进态"要推，只有"自上次结算时刻起积累多少秒"。因此正确选型是 tick 模型：
  - 在已有 `advanceAllCities` 同一 tick 回路里追加一步 `ResourceNodeIncomeService.settleOwnedNodes(gameState, now)`：遍历 `ownerFactionId==='player'` 的节点，`gain = yieldPerSecond × (1 − decayCoefficient) × min(now-lastSettledAt, 离线上限)`，写回玩家**首都活动城市** `city.resources`（对齐 `awardCampLoot` 直接写 `city.resources` 的写法，见 `WorldCombatEncounterService.js:208-221`，保证资源键与 `LOOT_RESOURCE_KEYS` 一致、clamp at 0）。
  - 这样 P0 不新增任何 worker/心跳/action 路由：结算点直接挂在现有 tick/离线路径上，与城市收益同生命周期、同样享受离线兜底。
- **行军三条腿与此解耦**：行军任务（去打资源地/去夺占）依旧走三条腿，不动。

---

## 4. 客户端 UI 与文案

遵守 UI 公理（`docs/architecture/button-scheduler-manager-panel-refactor-spec-2026-07-09.md`）：按钮只发意图 → dispatcher → registry → panel 独立文件。

### 4.1 资源地信息面板（拟新增独立 panel 文件）
- 文件：`frontend/js/.../panels/ResourceNodePanel.js`（参照 `FamousPersonsPanel` 独立 panel + 注册进 `frontend/js/.../panels/CanvasPanelRegistry.js`）。
- 注册动作描述符（filer `frontend/js/platform/CanvasPanelActionRegistry.js`，对齐 spec §6.1 形状）：
  - `openResourceNode`（panelKey `resourceNode`，operation `open`，dirty `['modal']`）
  - `closeResourceNode`
  - `attackResourceNode`（发起攻占，发 API 意图）
  - `abortDeploy`（带"中止占领进程"确认）
- 面板展示字段：类型 / 等级 / 守军情报 / 每秒收益 / 归属 / 部署进度。守军情报沿用"打了才知道"投影（未打过不显示数字，见待决问题 10）。

### 4.2 文案与双语 catalog
一切显示文本走 `t(key, params)`（catalog 在 `frontend/js/config/LocaleTextRegistry.js`），后端确认框消息直发中文。新增 key：

| key | zh-CN | en |
|---|---|---|
| world.resourceNode.forest.name | 林场 | Forest |
| world.resourceNode.stone.name | 采石场 | Quarry |
| world.resourceNode.iron.name | 铁矿场 | Iron Mine |
| world.resourceNode.farm.name | 农田 | Farmland |
| world.resourceNode.field.level | Lv.{level} | Lv.{level} |
| world.resourceNode.field.yield | 每秒 +{amount} {resource} | +{amount} {resource}/s |
| world.resourceNode.field.owner.self | 己方 | Ours |
| world.resourceNode.field.owner.enemy | 敌方 | Enemy |
| world.resourceNode.field.owner.none | 无主 | Uncontrolled |
| world.resourceNode.deploy.progress | 部署中 {left}s | Deploying {left}s |
| world.resourceNode.deploy.abortTitle | 中止占领进程 | Abort Occupation |
| world.resourceNode.deploy.abortMessage | 移动/撤退将会中止占领进程 | Moving/withdrawing will abort the occupation. |
| world.resourceNode.deploy.abortConfirm | 确认中止 | Confirm Abort |
| world.resourceNode.deploy.abortCancel | 继续部署 | Keep Deploying |
| world.resourceNode.garrison.unknown | 守军情报未知 | Garrison strength unknown |

> **冻结提示语**："移动/撤退将会中止占领进程"——同时满足需求 5 的"必须提示"要求，且双语成对。后端校验失败时直发中文同一句（对齐 `WorldCombatSessionService` 直发中文 `message` 的约定），前端面板另以 catalog 渲染本地化版本。

### 4.3 教程（后续项，提及）
参照 `backend/services/tutorial/TutorialActionValidator.js`（白名单/限流模式）：把 `attackResourceNode`/`abortDeploy` 登记进白名单；"占领第一座资源地"作为教程后段可选步，P0 标记为后续。

---

## 5. 战争迷雾与可见性（复用 SSOT）

- 无主/敌方资源地：复用**当前视野谓词** `backend/services/worldExplorer/WorldExplorerVision.js::computeCurrentVisionCoordSet`（与营地 `WorldCombatEncounterService.isEncounterVisibleToPlayer` 同一规则，见 `WorldCombatEncounterService.js:819-821`）——视野内才投影，走开就隐。**不复用** `getRevealedTileCoordSet`（那是"发现一次→永久可见"的城市规则）。
- 己方已占领资源地：当 `ownedAlwaysVisibleSelf=true` 时恒投影（与城市被占后 controlled 的语义一致：你的资产你看得见）。
- 坐标键 SSOT：`WorldMapService.getTileCoordinateKey`（`backend/services/WorldMapService.js:309`），与营地投影同一来源。

---

## 6. 与现有系统接缝（逐文件列）

| # | 现有文件 | 接缝动作 |
|---|---|---|
| 1 | `shared/worldMarchCore.js` | 铺设/可达复用 `MARCH_BLOCKED_TERRAINS`/`buildAxisAlignedRoute`；行军到资源地 tile 走现有 reachability，不另起路由 |
| 2 | `backend/services/worldExplorer/WorldExplorerActions.js` | 新增校验：mission 处于 `deploying` 锁定时，`startWorldMarch`/`returnWorldMarch`/`stopWorldMarch` 返回 `DEPLOY_IN_PROGRESS` + 冻结提示语；新增 `abortDeploy` 动作（沿用 `returnWorldMarch` 的 march authority 模式，`WorldExplorerActions.js:414`） |
| 3 | `backend/actions/GameActionRegistry.js` + `backend/services/WorldExplorerService.js` | 登记 `attackResourceNode`/`abortDeploy`，参照已登记的 `returnWorldMarch`（`GameActionRegistry.js:21`） |
| 4 | `backend/services/worldExplorer/WorldExplorerProgression.js` | arrival hook（现有 `resolveMissionArrival` 调用点 `WorldExplorerProgression.js:324`）加分支：目标为资源地时进入资源地 contested 战斗，而非城占领 |
| 5 | `backend/services/worldCombat/WorldCombatSessionService.js` + `WorldCombatEncounterService.js` | 资源地作为共享 encounter 喂入开/结战斗；复用 `openSession`/`resolveSession`/`applyCampVictorySpoils`/`settleMissionSnapshot`/`resolveEngagedTimeouts` 链路；投影自 `getClientEncounter` 同构派生 |
| 6 | `backend/services/battle/BattleSimService.js` | 权威战斗引擎直接复用，无改动；守军 general 经 `WorldCombatEncounterService.getDefenderGenerals` 同构 |
| 7 | `backend/services/territory/GarrisonPolicy.js` + `backend/services/territory/GarrisonCaptureResolver.js` | 资源地守军**不**走城 `garrison` 表（自有 `resource_node_garrison`），但 leader 生成走同一 `DefenderLeaderService`；`captureChance` 默认 0 → `maybeCaptureOnVictory` 直接返回 null，捕将流默认关闭，可表上调 |
| 8 | `backend/services/worldCombat/WorldCampSpawner.js` + `backend/config/WorldCampConfig.js` | 新增 `ResourceNodeSpawner` 镜像其铺设算法（活动区/环走/确定性排序/占位避让/地形探针），**不修改**营地代码；两者共享 `activityRegion` 逻辑 |
| 9 | `backend/repositories/WorldEncounterRepository.js` | 新增 `backend/repositories/ResourceNodeRepository.js`（同构 upsert/getActive/getAll/按 tile 取），作为共享世界实体的持久层 |
| 10 | `backend/config/ConfigTables.js` + `config/tables/table-schemas.js` + `scripts/build-config-tables.js` | 登记 4 张新表（§2），跟着现有 `--scaffold/--check` 流程走 |
| 11 | `backend/calculators/ResourceTickCalculator.js` | 不改；资源地收益自带结算服务 |
| 12 | `backend/services/CityService.js` | `advanceAllCities`（`CityService.js:254`）与 `calculateOfflineIncomeForAllCities`（`CityService.js:298`）追加一步资源地结算调用（写回 active city `resources`，与 `awardCampLoot` 同一写入约定） |
| 13 | `backend/services/WorldMapService.js` + `worldExplorer/WorldExplorerVision.js` | 资源地投影调 `computeCurrentVisionCoordSet`/`getTileCoordinateKey`，无新增视野来源 |
| 14 | `shared/faction/aiFactionCore.js` + `backend/services/faction/*` | 新增 action token `CLAIM_RESOURCE_NODE`，并入现有 `'expand'` 权重类（与 `SETTLE_NEUTRAL`/`ATTACK_CITY` 共享一个 weight，见 `aiFactionCore.js:18-19` 与 `personalityToWeights`），候选扫描由 AiFactionService 拼共享世界资源地快照喂入 |
| 15 | `frontend/js/config/LocaleTextRegistry.js` | 加 §4.2 全部 key（zh-CN + en 双 catalog，对齐现有 `world.combat.camp.*` 风格，`LocaleTextRegistry.js:856-858/1874-1876`） |
| 16 | `frontend/.../panels/CanvasPanelRegistry.js` + `frontend/js/platform/CanvasPanelActionRegistry.js` | 注册 `resourceNode` panel 与动作描述符（按 button-scheduler spec §6.1/§6.2 契约，第一阶段走 dispatcher/runner 路径，不走旧 controller handle_* 路径） |
| 17 | `backend/services/tutorial/TutorialActionValidator.js` | `attackResourceNode`/`abortDeploy` 进白名单；教程步标为后续 |

---

## 7. 美术素材清单

由 Codex 用 sprite-forge/generate2dsprite 生成，沿用现有地图元素品红底抠图管线（`MARCH_BLOCKED_TERRAINS` 决定土地与否、`Site` 在 `TerritoryConstants.SITE_ART` 给出 cutout 路径风格——`assets/art/world-site-*.png`）。

分档：4 类型 × 4 视觉分档（L1-3 / L4-6 / L7-9 / L10）= 16 张**基座**；叠加 4 状态标记（无主 / 攻占中 / 己方 / 敌方）以轻量小图标或边框区分（避免 ×16×4=64 张的爆炸）。推荐：

- 16 张主素材（4 类型 × 4 分档）—— 每张表现该等级段的"规模/雕琢度"递进。
- 4 张状态徽标（无主/占领中/己方/敌方）小贴片，复用现有"阵营色边框 + 旗"约定。

| 类型 | L1-3 | L4-6 | L7-9 | L10 | 状态徽标 |
|---|---|---|---|---|---|
| forest 木材 | 林地小伐木栈 | 围栏伐木场 | 伐木水车林站 | 大型林场砦 | 4 张 |
| stone 石头 | 散石采坑 | 阶梯采石场 | 深井采石矿 | 雕柱巨石场 | 4 张 |
| iron 铁矿 | 露天矿苗 | 木架铁坑 | 竖井铁矿场 | 大型熔炉矿场 | 4 张 |
| farm 粮食 | 新垦田畦 | 引水梯田 | 成片农庄 | 大型屯田仓 | 4 张 |

规格锚点（与现有 `world-site-*-cutout.png` 一致）：
- 尺寸：等距视角 cutout，建议基础地面 footprint 2×2~3×3 tile 投影，cutout PNG 约 256×256~384×384，透明背景，品红（#FF00FF）底走抠图→生成→裁切→对齐→QC 的 generate2dsprite 标准流程。
- 风格：与 `Site ART` 现有 `world-site-city-cutout.png` 风格同线（等距手绘风、低饱和、轻体积描边），不引入新画风。
- 命名：`assets/art/world-site-rnode-<type>-<tier>.png`（如 `world-site-rnode-forest-2.png`），状态徽标 `world-site-rnode-badge-<state>.png`。
- 配套 nameKey：见 §4.2，所有显示名走 i18n，不烘焙进 cutout 不进存档。

---

## 8. 待决问题的决定与理由（逐一回答§三全部 10 题）

**1. 守军规模/构成随等级缩放；守军是否随时间恢复/重生。**
决定：守军 = `resource_node_garrison.baseSoldiers + soldiersPerLevel×level`（纯等级线性，不引入第二 scale 维度，比城守军更简单）；品质/威胁随等级阶梯升档（common→legendary）。**无主状态下**守军被打败后按 `respawnCooldownMs` 再生（被夺分支也用同字段），与营地 `respawnCampIfReady`（`WorldCombatEncounterService.js:188-202`）同构。**占领后己方驻军**默认 `ownGarrisonBaseSoldiers=0` 且 `ownGarrisonRegenSeconds=-1`（不再生），即占领方不获得新增兵力，靠"部署期编队就地把守 + 之后留队"防御（决定 2 的延续）。理由：避免"占一座就免费拿一支永动军队"的经济失衡，且与城占领后"无固定驻军，靠玩家驻军"的现有体验一致。

**2. 占领后的防御方是什么；占领方可否增/换驻军。**
决定：占领方防御体 = **当场攻打用的那支编队就地转为驻防**（快照冻结在 tile），不另起"快照守军"也不再生；玩家**可换**驻军——把当前驻防编队撤走（撤走即触发被夺窗口：tile 无人则资源地立刻回到 `uncontrolled` 并按 respawn 再生守军）+ 行军新编队进驻。理由：复用现有 `formationSnapshot/mission` 机制最小造轮（与城占领编队语义同），换防走现有行军闭环，无需新增"驻军管理"子系统。`ownGarrisonBaseSoldiers` 字段保留以便后续 P1 若要"系统驻军"再开。

**3. 部署期被第三方攻击怎么办。**
决定：**部署期 60s 内资源地对第三方不可被攻击**（投影不作为可攻击 encounter 出现，第三方在 tile 上发起进攻得到 `DEPLOY_IN_PROGRESS` 类拒绝，需等部署结束）。理由：冻结需求明示部署期 60s 是确定窗口，若允许战斗插队则"1 分钟部署期"语义破裂、玩家心智模型崩塌；不让插队是最小惊讶且实现成本最低。第三方可在部署结束后立即抢攻（无冷却门）。被夺分支因此只在 `owned` 态发生，状态机闭环清晰。

**4. 每秒收益数值表与现有经济量级关系。**
决定：见 §2.1 表与量级说明。对照依据严格落在：`GameConfig.resources` 基线 + `shared/buildingConfig.json` 建筑产出基线 + `ResourceTickCalculator` 计算式 + `scripts/economy-balance-model.js` 产出/消耗台账。L1≈0.3-0.6/s（半个匠人）、L10≈3.8-7.2/s（约 2-3 个匠人带中级建筑的单项产出）。确定保守地"补充而非替代城市"。

**5. 单玩家占领上限 + 收益是否随占领数衰减。**
决定：`maxOwnedPerPlayer=12` 总数 + `maxOwnedPerType=6` 分类型双上限；超出 `yieldDecayGracePerType=3` 个同类后线性衰减 `1 - (k-3)×0.05`，下限 0.4。理由：上限防独家垄断稀缺资源（铁/石），衰减鼓励多类型分散占领而非堆同一类刷资源，保留长期"扩张以抢稀缺"动机。

**6. 地图铺设密度/分布/等级地理梯度；与 activity regions 关系。**
决定：完全复用营地 `activity regions` 模型（`WorldCampSpawner.normalizeActivitySources`）——同一活动区网内确定性铺设，互不争用；环走分档 `ringBands` 决定密度（近环多小节点、远环少高节点）；`tierByRing` 决定离活动源越远等级上限越高（近 1-3、远 6-10，"近弱远强"与营地 `RING_ARCHETYPE_BANDS` 同思想）。类型按 `typeWeight*` 抽签并受 `terrainFilter*` 过滤（石/铁倾向山地、林/农倾向平原林），不另创地理分层。与营地共享活动区、各占其环互不打架。

**7. AI 势力是否也占资源地；PVPVE 兼容性。**
决定（回答§三额外点名）：**是**，AI 势力占资源地。新增 `aiFactionCore.ACTIONS.CLAIM_RESOURCE_NODE` 并入现有 `'expand'` 权重类（与 `SETTLE_NEUTRAL`/`ATTACK_CITY` 共享 `weightExpand`，见 `aiFactionCore.js:18-19,62-73`），候选由 AiFactionService 拼共享世界资源地快照喂入；AI 攻打 + 部署期 + 占领走同一状态机，AI 占领后收益进入 AI 势力的经济（与 PVPVE 势力占地模型一致，见 `ai_faction_profile.xlsx` 的扩张权重）。**P0** 先以"无主守军"为最小可玩（玩家侧闭环），AI 占领为 **P1**（开关 `aiCanOccupy`）。

**8. 离线收益如何结算（与"三条腿"模型关系）。**
决定：见 §3.6——**tick 模型而非三条腿**。三条腿服务行军瞬态推进，资源地收益是持续状态式产出，二者解耦。离线结算走 `CityService.calculateOfflineIncomeForAllCities` 同一出口：`offlineEfficiency=0.8`、`offlineMaxHours=8`（对齐 `GameConfig.resources.offlineBaseEfficiency/maxOfflineHours`），下次上线一次性补给入账。在线每次 `advanceAllCities` 也带一步。

**9. UI 契约（含冻结提示语的中止确认框）。**
决定：见 §4。新增独立 panel 文件 `ResourceNodePanel` + dispatcher/runner 动作描述符，按 button-scheduler spec §6 走新契约（不写旧 controller handle_*）；中止确认框 = 独立 modal 二次确认（标题=中止占领进程，正文=冻结语"移动/撤退将会中止占领进程"），确认走 `abortDeploy`，取消保留部署。提示语双语 catalog，后端直发中文同一句。

**10. 服务端权威与防作弊边界（守军情报"打了才知道"先例是否沿用）。**
决定：**沿用**。守军血量/品质/威胁/leader 仅在玩家**对该资源地有过一次战斗结算**后投影给该玩家（同 `WorldCombatEncounterService.hasFoughtEncounter` + `getClientEncounterBattleTarget` 的 `intelSnapshot.knownGarrison` 门控，`WorldCombatEncounterService.js:729-783`）。战斗 seed+setup 由服务端 `BattleSimService.buildBattleSetup` 服务端发种子、客户端只录 inputStream、`simulateSetup` 服务端重算（防篡改）；占领/被夺归属由状态机服务端推进、客户端只发意图。收益由服务端 tick 写回 `city.resources`，客户端从不自计算资源地收入。

---

## 9. 分阶段落地切片

### P0 — 最小可玩（玩家侧闭环）
- 4 张配置表进 table-schemas + build-config-tables 流程；`ConfigTables` 读得通。
- `ResourceNodeSpawner` 铺设器（镜像 `WorldCampSpawner`）+ `ResourceNodeRepository`。
- 状态机 `uncontrolled → contested(复用 WorldCombatSession) → deploying(60s) → owned`；`abortDeploy` + 冻结提示语 + 锁定 mission。
- 收益 tick 结算挂进 `advanceAllCities` + 离线挂进 `calculateOfflineIncomeForAllCities`。
- 投影走 `WorldExplorerVision` + "打了才知道" 守军情报 + i18n 双语。
- 资源地信息面板（独立 panel，dispatcher 注册），美术用占位 cutout（先复用 `world-site-camp-cutout.png` 作 P0 视觉）。
- `aiCanOccupy=false`：AI 暂不参与。

### P1 — 完整（含 PVPVE + 美术 + 教程）
- AI 势力夺占（`CLAIM_RESOURCE_NODE` 行动 + AiFactionService 喂快照 + AI 收益进 AI 经济）。
- 美术素材 16 张主 cutout + 4 张状态徽标（generate2dsprite 生成、品红底抠图、对齐 §7 规格）。
- 占领上限/衰减/分类型上限生效。
- 教程步"占领第一座资源地"。
- 表上 `captureChance` 可选打开以接入现有捕将流（`GarrisonCaptureResolver`）。
- 性能/世界规模压测（节点数随玩家活动区增长的上界评估）。