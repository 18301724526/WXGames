# 05 AI 势力 + AI 城市 + 决策循环

> 由设计 workflow 深化（已过单一事实源对抗审查）。审查结论：NEEDS_REVISION——文末「审查发现」是 codex 落地前要修正/补齐的点。

## 1. 目标与 RTK 参照

**目标**：让世界里存在**会自己成长、会出兵、会外交、会登用**的 AI 势力（PVPVE 的对手）。玩家在共享世界里睁眼时，除了中立城/野怪营地，还应看见几股由 AI 君主统治的敌对/友好势力，它们各自占城、扩张、研发、招揽在野武将，并在满足条件时**主动行军攻打中立城、敌对 AI 城、乃至玩家城**（顺带交付被推迟的「夺回/驻防」：AI 军队打到玩家城，无驻防→直接夺走，有驻防→打一场）。

**RTK 参照**：光荣三国志的「势力 CPU 思考」——每回合每个 CPU 势力按君主性格（进取/慎重/理想…）分配行动点，做「征兵/建设/登用/外交/出阵」。本设计把三国志的**回合制 CPU 思考**映射到本作的**世界 tick 预算制思考**：一次 tick 里，每个 AI 势力消费一份有界的「行动预算」，读取君主性格/相性/关系做决策。三国志的**兵力=城的最大动员**、**武将带兵出阵**、**攻城=野战+城防**在本作分别复用 CityService.military、编队快照、BattleSimService。

**核心复用原则（单一事实源）**：
- AI 城 = `shared_world_territories` 里 `ownerPlayerId = 'ai_faction_<id>'` 的一条领土 + 一个 `cities[territoryId]` 城对象；**不新建第二套城模型**，直接复用 `CityService` / `TerritoryService`。
- AI 军队 = 复用 `startWorldMarch` 的行军 + `BattleSimService.resolveBattle` 的战斗，**不新建第二套行军/战斗**。
- AI 科技 = 每势力一份 `techs {researched, points…}`，复用 `TechTreeService.research`。
- AI 武将 = 复用 `FamousPersonGenerator` 生成、进 SHARED 人物注册表，`factionId` 指向该势力。
- AI 模拟**每 tick 只在 WorldWorkerService 里跑一次**（shared，绝不 per-player 复算）。

---

## 2. 单一事实源数据模型

### 2.1 现状（证据）
- 玩家城/领土：`game_states` 行（`GameStateRepository.findByPlayerId`），领土数组 `state.territories`（`TerritoryInitialState.createCapital` 形如 `{id,x,y,type,owner:'player',status,scale,threat,defense,...}`），城对象 `state.cities[territoryId]`（`CityService.createCityState`：`{resources,buildings,population,military:{soldiers,soldierCap,...},happiness,...}`）。
- 共享世界领土：**已存在** `shared_world_territories(id PK, territory JSON, ownerPlayerId, updatedAt)`（`GameStateRepository.js:118`），索引在 `ownerPlayerId`。玩家保存时 upsert 自己占的格（`getSharedTerritoryOwner` → `territory.ownerPlayerId || gameState.playerId`，`:474`）；投影时 `getSharedWorldTerritories({excludePlayerId})` 取别人占的格（`:451`），经 `getClientProjectionForPlayer`（`:205`）传给 `TerritoryClientAssembler.mergeProjectedTerritories`（`:55`，按 coord 去重、优先级合并、**只读**）。
- 人物：仅玩家自己的 roster `state.famousPeople[]`；**无世界注册表**。
- 世界 tick：`WorldWorkerService.tickOnce` → 对每个近期活跃玩家 `advanceState` → `gameStateService.advanceRuntimeState`（`GameStateNormalizer.advanceRuntimeState:155`）→ normalizeExplore/Combat/Territory/Cities + `EventService.maybeGenerate*`。**目前完全 per-player，没有任何 shared 势力模拟。**

### 2.2 新增：AI 势力状态（SHARED，与 shared_world_territories 平行）

**新表 `ai_faction_state`**（`GameStateRepository.createGameStateSchemaMigrations` 里加 `CREATE TABLE IF NOT EXISTS`，或走 `SchemaMigrationService` 迁移；参照 `:118` 现有建表风格）：

```
CREATE TABLE IF NOT EXISTS ai_faction_state (
  factionId   TEXT PRIMARY KEY,   -- 'ai_faction_<n>'，与 ownerPlayerId 命名一致
  faction     TEXT,               -- JSON：完整势力实体（见下）
  updatedAt   TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_faction_updated ON ai_faction_state(updatedAt DESC);
```

**faction JSON 的权威字段**（每个事实只此一份）：
```
{
  factionId: 'ai_faction_1',
  name: '赤狼部',           color: '#b5462f',
  rulerPersonId: 'wp_00031',    // 指向 SHARED 人物注册表（君主本人只此一份）
  strategyProfile: 'aggressive' | 'economic' | 'diplomatic' | 'balanced',
  aggression: 0.72,             // 0~1，由性格派生的缓存值（派生但缓存以省算，权威=personality）
  capitalTerritoryId: 't_57_12',
  // 资源/科技：势力级，与玩家的 techs 同结构
  techs: { points, researched:[], eraChoices, grants },
  currentEra: 1,
  treasury: { food, wood, iron, ... },   // 势力金库（AI 城产出汇总的蓄水池，见 §5.3）
  officerIds: ['wp_00031','wp_00044'],   // 麾下武将（人物本体在注册表，这里只存 id）
  // 决策调度
  ai: {
    lastTickAt: '...ISO...',
    actionBudget: 3,            // 本周期剩余行动点（每 cadence 重置）
    nextDecisionAtMs: 1720...,  // 下次思考的世界时刻（错峰）
    seedCounter: 41,            // 决策 RNG 计数器（determinism，见 §7）
    pendingMarches: [ {marchId, targetTerritoryId, ...} ],  // 已发出的 AI 行军句柄
  },
  diplomacyVersion: 3,
  createdAt, updatedAt,
}
```

- **AI 城不在这里**。AI 城仍是 `shared_world_territories` 里 `ownerPlayerId='ai_faction_1'` 的领土 + 一份城对象。城对象存哪？→ **新表 `ai_faction_cities(territoryId PK, factionId, city JSON, updatedAt)`**（与领土解耦，正如玩家 territory↔city 分离），或简化为把城 JSON 塞进 `shared_world_territories.territory.city`。**推荐前者**（独立城表），理由：`CityService.advanceAllCities` 吃的是 `{cities:{}}` 形状，AI 城独立表能让 tick 直接组装一个临时 `{cities}` 交给同一个 `advanceAllCities`，零分叉。
- `aggression` 等是**派生缓存**：真值是君主的 `personality`（在人物注册表里）。缓存字段在生成势力时写一次，君主更替时重算——绝不与 personality 各写一份可漂移的独立数字。

### 2.3 新增：SHARED 世界人物注册表

**新表 `world_people(personId PK, person JSON, factionId, updatedAt)`**（`factionId` 可为 `''`=在野）。
- person JSON 复用 `FamousPersonGenerator` 产物结构（`{attributes:{command,force,intelligence,strategy,politics,governance,charisma,speed}, quality, abilityKit, appearance, archetype, roles}`），**扩展**三个新字段（本 doc 不细化，但预留，由「人物/关系」姊妹 doc 定义）：`personality`（驱动行为）、`compatibility`（相性隐藏值）、`relationships[]`（羁绊）。
- AI 君主/武将、在野武将都住这张表。玩家 roster (`state.famousPeople`) 保持不变（玩家已招募的人物是其私有投影/引用）；**登用成功**时把 `world_people` 里一个在野 person 的 `factionId` 改为该 AI 势力 id 并 push 进 `officerIds`——**人物本体只此一份**。

### 2.4 客户端投影（AI 势力如何被玩家看见）
- 领土：AI 城已经通过现有 `getSharedWorldTerritories({excludePlayerId})` 自动流进玩家的领土 DTO（`ownerPlayerId='ai_faction_*'` 的格，`mergeProjectedTerritories` 只读合并）。**唯一要做的**：`territory` JSON 里带上 `factionId/factionName/factionColor`，让前端能给 AI 城染色 + 显示势力名。
- 势力名录/外交：`getClientProjectionForPlayer` 扩展返回 `aiFactions: [{factionId,name,color,rulerName,relationToPlayer}]`（从 `ai_faction_state` + diplomacy 读，见姊妹外交 doc），前端「诸国/外交」面板消费。
- 来袭行军：AI 发起、目标为玩家城的行军，作为一条 `incomingMarch` 投影进玩家 DTO（见 §5.5）。

---

## 3. 机制与规则（纯规则核 vs 服务层）

分层遵循项目北极星「shared/ 纯规则、server 管线」。

### 3.1 纯规则核（`shared/aiFactionCore.js`，无 IO、可单测、确定性）
纯函数，输入快照、输出「意图」，不触库、不改状态：
- `chooseFactionActions(factionSnapshot, worldSnapshot, rng) -> ActionIntent[]`：读预算+性格，产出本 tick 的行动意图列表（下方枚举）。
- `scoreExpansionTargets(faction, candidateTerritories, worldSnapshot) -> [{territoryId, score}]`：给可扩张目标打分（距离、守军强度、资源价值、是否玩家城×aggression）。
- `scoreRecruitCandidates(faction, roamingPeople) -> [{personId, score}]`：登用打分（相性、品质、角色缺口）。
- `decideBuildOrder(faction, city) -> buildingId|null`：建设序（复用玩家的建筑解锁规则）。
- `decideResearch(faction) -> nodeId|null`：科技序（复用 `TechTreeService` 的可研判定，纯读）。
- `personalityToWeights(personality) -> {expand,build,research,recruit,war,diplo}`：性格→行动权重（配置表驱动，见 §4）。

**ActionIntent 枚举**（本作术语）：
`SETTLE_NEUTRAL`（占无守空城）、`ATTACK_CITY`（攻中立守军城/敌AI城/玩家城）、`BUILD`（造/升建筑）、`RESEARCH`（研发）、`RECRUIT_OFFICER`（登用在野）、`TRAIN`（征兵）、`DIPLOMACY`（外交动作，具体委托外交 doc）、`IDLE`。

### 3.2 服务层（`backend/services/ai/AiFactionService.js` + 子模块）
执行意图、读写库、复用既有服务：
- `AiFactionService.tick(worldContext, now)`：本 tick 的总入口（被 WorldWorkerService 调用，见 §5.1）。内部：装载到期思考的势力 → 对每个势力调纯核拿意图 → 逐条 `executeIntent`。
- `AiFactionCityGrowth`：把 AI 城组装成 `{cities}` 交给 `CityService.advanceAllCities(pseudoState, deltaSeconds)`（**复用玩家城成长**：资源产出、人口、征兵进度全部同一条公式），再拆回独立城表。
- `AiFactionArmyService`：`executeIntent(ATTACK_CITY/SETTLE_NEUTRAL)` → 组一份「AI 编队快照」（由该势力麾下武将 + 城内 soldiers 构成）→ 复用 `startWorldMarch` 的路由/行军（`WorldExplorerActions.startWorldMarch`，走 `buildAxisAlignedRoute` 四方向格轴）→ 到达时 `AiFactionArmyService.resolveArrival` 调 `BattleSimService.resolveBattle`（与玩家 `resolveEncounterBattle` 同一个 sim）。
- `AiFactionRecruitService`：`executeIntent(RECRUIT_OFFICER)` → 复用 `FamousPersonService` 的候选/接受逻辑改 `world_people.factionId`。
- `AiFactionSeeder`：世界初始化时铺设初始 AI 势力首都（见 §5.2）。

### 3.3 攻城/占城规则（复用 GarrisonPolicy，双向）
- AI 打**中立守军城**：目标城的守军由 `GarrisonPolicy.isNeutralCityDefended(territory, distToAiCapital)` 判定——注意距离基准改为「到该 AI 势力首都」而非玩家首都（`resolveBand` 吃距离参数，本就参数化，无需改核）。无守军→直接 SETTLE，占领改 `ownerPlayerId`；有守军→行军到达打一场。
- AI 打**玩家城**（夺回/来袭）：读玩家城 `cities[id].military.soldiers`。=0（无驻防）→ 到达即夺（territory.ownerPlayerId 改为 AI，城转入 AI 表）；>0（有驻防）→ `BattleSimService.resolveBattle`（攻=AI 编队，守=玩家城守军 + 城内守将）。**这条同时兑现了被推迟的驻防语义**：玩家在城里留 soldiers 就是「驻防」，留了就打一场，没留就丢城。
- AI 打**敌对 AI 城**：对称，两边都从各自城 military 取兵，resolveBattle 结算，败方城易主。

---

## 4. 配置表映射（Excel + 校验）

全部走既有管线（`config/tables/*.xlsx` → `table-schemas.js` 契约 → `build-config-tables` → `backend/config/generated/*.json` → `ConfigTables.getRows`，新鲜度门禁）。在 `config/tables/table-schemas.js` 的 `TABLES` 数组新增三张表：

### 4.1 `ai_faction_profile`（性格→行为权重 + 攻击性）
主键 `profileId`。字段：
| key | type | 含义 |
|---|---|---|
| profileId | string | aggressive/economic/diplomatic/balanced（主键） |
| aggression | float | 0~1，攻击倾向基线（喂 §3.1 attack 权重与打玩家城的意愿） |
| weightExpand | float | 扩张（占城/攻城）意图权重 |
| weightBuild | float | 建设权重 |
| weightResearch | float | 科技权重 |
| weightRecruit | float | 登用权重 |
| weightDiplomacy | float | 外交权重 |
| targetPlayerBias | float | 0~1，同等分数下优先打玩家城 vs 中立城的偏置 |
| minSoldiersToAttack | int | 城内兵力低于此不出阵（自保阈值） |
| expansionRange | int | 从势力城出发的最大攻击/扩张半径（格） |

种子行（示例）：`aggressive`: aggression 0.8, weightExpand 0.5, targetPlayerBias 0.6, minSoldiersToAttack 300, expansionRange 14；`economic`: aggression 0.3, weightBuild 0.45, weightResearch 0.3, targetPlayerBias 0.15；`diplomatic`: weightDiplomacy 0.4, aggression 0.35；`balanced`: 均衡。

### 4.2 `ai_faction_cadence`（思考节奏 + 行动预算 + determinism）
主键 `bandId`（可按时代或难度分档，先用单行 `default`）。字段：
| key | type | 含义 |
|---|---|---|
| bandId | string | 主键（default / era0 / era1…） |
| decisionIntervalMs | int | 一个势力两次思考的最小间隔（如 30000=30s，错峰见 §7） |
| actionBudgetPerCycle | int | 每思考周期的行动点数（如 3） |
| maxFactionsPerTick | int | 单 tick 最多推进的势力数（性能上界，如 5） |
| maxMarchesPerFactionCycle | int | 单势力单周期最多发起的行军数（如 1，防蜂拥） |
| growthTickSeconds | int | AI 城成长的等效秒数（喂 advanceAllCities，通常=tick 间隔） |

### 4.3 `ai_faction_seed`（初始势力铺设）
主键 `factionId`。字段：`factionId, name, color, profileId, capitalRing(距世界原点的环距,决定首都选址带), initialSoldiers, initialEra, rulerArchetype(喂 FamousPersonGenerator 的 archetype 池), officerCount`。种子 3~5 行=开局世界里的 3~5 股 AI 势力。

**校验**（在 `build-config-tables --check` / schema 里）：profileId 引用必须存在于 ai_faction_profile；所有 weight/aggression ∈ [0,1]；expansionRange>0；capitalRing 互不重叠到会撞出生保护区。

---

## 5. 世界 tick / 事件挂钩

### 5.1 挂点（唯一入口，shared 单次）
现状 `WorldWorkerService.tickOnce` 只循环 per-player。新增：在 `tickOnce` 的**玩家循环之外**（每 tick 一次，非 per-player）调用一次 `AiFactionService.tick`：

```
// WorldWorkerService.tickOnce()，在 for(rawState of gameStates) 之后：
if (this.aiFactionService?.tick) {
  const aiSummary = this.aiFactionService.tick({ repository: this.repository, now });
  summary.aiProcessed = aiSummary.processedFactions;
  summary.aiMarches = aiSummary.marchesStarted;
}
```
- `aiFactionService` 走构造注入（`options.aiFactionService`），保持 WorldWorkerService 可测、无硬依赖。
- **单次**：AI 势力模拟与「哪些玩家在线」无关，绝不塞进 per-player 的 `advanceState`。
- 到期结算 AI 行军也在这里（`AiFactionArmyService.settleArrivals(now)`），与玩家行军结算的三条腿（worker/心跳/动作写）里的 **worker 腿**对齐——AI 没有客户端心跳，所以 **worker tick 是 AI 行军结算的唯一腿**，务必每 tick 跑（参照 march-settlement 备忘：纯等待会饿死结算，AI 无动作写腿，故 worker 腿必须无条件跑）。

### 5.2 世界初始化（种子）
- 触发点：世界首次创建（`DEFAULT_WORLD_SEED` 初始化路径）或一个幂等的 `AiFactionSeeder.ensureSeeded(repository)`（每次服务启动跑一次，已存在则跳过——参照现有 ensure* 幂等风格）。
- 逻辑：读 `ai_faction_seed` 表 → 对每行：用 `capitalRing` 在世界地图上确定性选一块可落城的格（复用 spawn 选址/`player_spawn_allocations` 的碰撞检查，AI 首都也占一个 spawn 名额防和玩家/别的 AI 撞）→ 写 `shared_world_territories`(ownerPlayerId=factionId, type='capital', 带 factionId) + `ai_faction_cities` 一份满编城 + `world_people` 生成君主(rulerArchetype)+officerCount 个武将 → 写 `ai_faction_state`。

### 5.3 AI 城成长（每 tick）
`AiFactionService.tick` 里对每个「本 tick 要推进的势力」的每座城：组 `pseudoState={cities:{[tid]:aiCity}, buildings, population...}` → `CityService.advanceAllCities(pseudoState, cadence.growthTickSeconds)` → 城产出的资源结余汇入 `faction.treasury`（势力金库统一调度征兵/建设/科技开销）。**复用玩家城的全部产出/征兵公式**，零分叉。

### 5.4 决策循环（每势力，按预算）
对到期思考（`now >= ai.nextDecisionAtMs`）的势力（≤ `maxFactionsPerTick` 个/tick，超出的下 tick 再轮）：
1. 组 `factionSnapshot`（势力状态 + 其城 + 麾下武将）与 `worldSnapshot`（可见的邻近领土/别的势力/玩家城，按 expansionRange 裁剪）。
2. `aiFactionCore.chooseFactionActions(snapshot, world, rng)` 拿 ≤`actionBudgetPerCycle` 条意图（权重=profile×性格）。
3. 逐条 `executeIntent`：`BUILD/RESEARCH/TRAIN` 直接改城/势力状态并扣 treasury；`RECRUIT_OFFICER` 走 AiFactionRecruitService；`SETTLE_NEUTRAL/ATTACK_CITY` 走 AiFactionArmyService.startMarch（每周期 ≤`maxMarchesPerFactionCycle`）；`DIPLOMACY` 委托外交 doc。
4. 更新 `ai.nextDecisionAtMs = now + decisionIntervalMs`（±错峰抖动），`ai.seedCounter++`，save 势力。

### 5.5 AI 行军 → 玩家城（来袭投影 + 事件）
- AI 发起攻玩家城的行军时，除写进自己的 `ai.pendingMarches`，还在被攻玩家的投影里冒出一条 `incomingMarch:{fromFactionId,fromFactionName,targetCityId,etaMs,soldiers(可模糊)}`（`getClientProjectionForPlayer` 读「目标为该 playerId 的 AI 行军」）。
- 同时 `EventService.maybeGenerateThreatEvent` 的邻接：AI 军队进入玩家视野/开拔攻城时，生成一条威胁事件（复用现有事件队列），让玩家有反应窗口（回防、留兵驻防）。
- 到达结算：`AiFactionArmyService.settleArrivals` 在 worker tick 里判定 ETA 到点 → 读玩家城守军 → 无守直接易主（改 `shared_world_territories` + 从玩家 `game_states` 移除该领土/城，走既有城易主写路径）/有守 `resolveBattle` → 生成战报（复用 battle report + replay 结构，玩家下次登录能重放这场「被攻」）。

### 5.6 与既有系统的复用清单
- `WorldWorkerService` tick（新增一次 shared 调用）
- `startWorldMarch` / `buildAxisAlignedRoute` / `MARCH_BLOCKED_TERRAINS`（AI 行军走同样的四方向格轴、同样的水系禁行）
- `BattleSimService.resolveBattle` + battle report/replay（AI 战斗 = 玩家战斗）
- `GarrisonPolicy`（距离档决定守军，AI 攻城/被占同一判定）
- `DefenderLeaderService`（若 AI 城被打，其守将也走这套生成；或直接用势力麾下武将当守将）
- `CityService.advanceAllCities` / `TechTreeService.research`（成长与科技）
- `FamousPersonGenerator` / `FamousPersonService`（君主/武将/登用）

---

## 6. 客户端/UI 面

（本系统偏后端；前端只需消费投影，最小面）
1. **AI 城染色 + 势力名**：世界地图上 `ownerPlayerId='ai_faction_*'` 的城用 `factionColor` 边框 + 势力名标签（数据已在合并后的领土 DTO 里）。
2. **诸国/外交面板**：列 `projection.aiFactions`（名、色、君主、与我关系）——外交交互属姊妹 doc。
3. **来袭预警**：`incomingMarch` 投影 → 世界地图画一条敌军行军线 + 顶部预警条 + 威胁事件卡（复用现有事件 UI），提示玩家回防/驻防。
4. **被攻战报**：玩家登录后，若离线期间被 AI 打过，弹一份战报（复用现有 battle 重放场景）。
5. 攻打 AI 城对玩家而言与攻中立守军城**同一操作流**（选目标→编队→行军→到达战斗），前端无需新交互。

---

## 7. 确定性 / 性能（有界、可复现）

- **每 tick 有界工作**：`maxFactionsPerTick`（如 5）封顶单 tick 推进的势力数；超出的靠 `nextDecisionAtMs` 错峰轮转，永不一次跑完所有势力。城成长按 `growthTickSeconds` 定量推进（不吃真实墙钟差，避免 DTO 时间投影伪装成长——参照 march-settlement 陷阱备忘）。
- **错峰**：初始 `nextDecisionAtMs` 用 `factionId` 哈希打散在 `[0, decisionIntervalMs)`，避免所有势力同 tick 思考造成尖峰。
- **确定性 RNG**：决策用 `createSeedRandom(`${factionId}:${ai.seedCounter}`)`（复用 FamousPerson 那套 seed random），`seedCounter` 每次思考自增并持久化——同一份存档重跑 tick 得到同一串决策（可回放、可测）。铺设选址、武将生成同样 seed 化。
- **写放大控制**：只 save「本 tick 真被推进/发生变更」的势力/城，未到期思考的势力零写。AI 行军句柄存进势力状态，避免每 tick 全表扫描找 pending。
- **与玩家写的隔离**：AI 城/势力在独立表（`ai_faction_state`/`ai_faction_cities`/`shared_world_territories`），不进 `game_states` 行，不参与玩家的 `GAME_STATE_REVISION_CONFLICT` 重试，天然无锁冲突。城易主时写玩家 `game_states` 的那一下，走既有领土易主写路径（已处理 revision）。

---

## 8. 实现切片（有序、每片可测）

- **AIF-0 证据勘察 & 契约冻结**：确认城易主的既有写路径（玩家占中立城时 `shared_world_territories` 的 owner 变更怎么落库）、`startWorldMarch` 能否被无 HTTP 上下文的服务端调用（可能需抽一个纯服务入口）、`advanceAllCities` 对 pseudoState 的最小字段需求。产出：复用点清单 + 缺口清单。**测试**：读证等价笔记。
- **AIF-1 表 + 存储层**：加 `ai_faction_state` / `ai_faction_cities` / `world_people` 三表（`SchemaMigrationService` 迁移）+ 各自 repository 方法（load/save/list/byOwner）。三张配置表进 `table-schemas.js` + 生成 JSON + 新鲜度门禁。**测试**：建表/读写/配置表 --check 绿。
- **AIF-2 Seeder（静态存在）**：`AiFactionSeeder.ensureSeeded` 铺 3~5 股势力首都（占城+满编城+君主+武将），确定性选址不撞出生区。此时 AI **不行动**，只是世界里多了几座染色 AI 城 + 投影可见。**测试**：seeded 后 `getClientProjectionForPlayer` 含 AI 城 & aiFactions；重复 ensure 幂等。
- **AIF-3 城成长**：`AiFactionCityGrowth` 每 tick 用 `advanceAllCities` 推进 AI 城，产出汇入 treasury。挂进 `WorldWorkerService.tickOnce`（shared 单次）。**测试**：跑 N tick 后 AI 城资源/兵力按玩家城同公式增长；有界（maxFactionsPerTick）。
- **AIF-4 纯决策核**：`shared/aiFactionCore.js`（chooseFactionActions + 打分 + personalityToWeights），纯函数全单测。**测试**：给定 snapshot+seed，输出意图确定且随 profile 变化（aggressive 多 attack，economic 多 build）。
- **AIF-5 非军事执行**：`executeIntent` 的 BUILD/RESEARCH/TRAIN/RECRUIT（登用改 world_people.factionId）。**测试**：势力会造建筑/研科技/征兵/招在野；treasury 正确扣减；预算/cadence 生效。
- **AIF-6 AI 行军 + 攻城（含夺回/驻防）**：`AiFactionArmyService.startMarch`（复用 startWorldMarch）+ `settleArrivals`（复用 resolveBattle）；SETTLE_NEUTRAL / ATTACK 中立守军城 / ATTACK 玩家城（无守夺城、有守打一场）/ ATTACK 敌 AI 城。来袭 `incomingMarch` 投影 + 威胁事件 + 被攻战报。**测试**：AI 行军到达触发 resolveBattle；玩家留兵→打一场、不留→丢城；确定性（seed 固定则结果固定）。
- **AIF-7 前端消费面**：AI 城染色+势力名、诸国面板、来袭预警条+事件卡、被攻战报重放。**测试**：真机/playtest——AI 城可见、能被玩家攻打易主、AI 能打玩家城并生成战报。
- **AIF-8 平衡 & 配置调优**：调 profile 权重/cadence/aggression，跑长 tick 模拟观测（是否有势力雪球/停滞/蜂拥）。**测试**：长程模拟脚本（无客户端，纯 worker tick loop）统计各势力城数/兵力曲线合理。

外交与「人物性格/相性/关系/羁绊」是**姊妹 doc**的产出；本 doc 在决策核里留好 `DIPLOMACY` 意图与 `personality/compatibility/relationships` 读取接口，登用打分先用 quality/role 缺口占位，待相性系统落地后接入。


---

## 审查发现（单一事实源 + 缺口，落地前修正）

### 单一事实源违规（须改为查询/投影，不得复制）
1. 【advanceAllCities 复用是伪单源，实为双源污染】§2.2/§5.3 断言把 AI 城组装成 `{cities}` 交给 `CityService.advanceAllCities` 是「零分叉」。证据反驳：`advanceAllCities`(CityService.js:255) 无条件先跑 `normalizeCities`(124-168)，后者(128-137)**强制注入一座 id='capital' 的城**、(147-154)遍历 `gameState.territories` 补城、(156-167)把 `gameState.resources/buildings/population/military` 全部重指向 activeCity。传入 `{cities:{aiCity}}` 会：(a)凭空造出一座玩家式 capital 混进 AI 城集合；(b)`applyDerivedStatsToCity`(197-233)读 `gameState.techEffects/activeBuffs/territories/planning` 算人口上限与幸福度——AI 若不铺一整套平行字段，产出就是错的。要么 AI 城真的复用这套（则 AI 势力必须持有和玩家 gameState 同构的一份 resources/buildings/population/military/techEffects/activeBuffs，产生**同一批事实的第二份镜像**），要么就是分叉。设计把这层冲突一句「零分叉」抹平了。
2. 【shared_world_territories 的唯一写入者是 player-save，AI 写入会被玩家存档反复擦除】§2.4/§5.5 依赖「既有城易主写路径」把 AI 占领的格写进 `shared_world_territories`。但该表唯一写者 `saveSharedWorldTerritories`(GameStateRepository.js:479-505) 完全由 `gameState.territories` 派生，且(496-504)**DELETE 掉该玩家名下不在当前 territories 列表里的所有行**。当 AI 夺走玩家城、从玩家 `state.territories` 删除该格后，该玩家下次存档就会把这行删掉——除非 AI 侧另有权威写入把该行改成 `ownerPlayerId='ai_faction_x'` 并**在玩家删除之后**执行。这个「territory 归属」事实现在同时被 player-save 循环和拟新增的 AI 写路径两处写，且没有任何冲突消解/顺序保证。设计所称「复用既有城易主写路径」——该路径根本不存在（现有代码只有玩家占中立格的自我 upsert，没有跨主体转移）。
3. 【GarrisonPolicy「双向复用」不成立——它只认 neutral】§3.3 称 AI 打敌 AI 城/玩家城复用 `GarrisonPolicy`，只把距离基准换成「到 AI 首都」。证据：`isNeutralCityDefended`(GarrisonPolicy.js:28-34) 头两行 `if (owner !== 'neutral') return false`、`if id==='capital' return false`——对 AI/玩家所有城一律返回 false。攻 AI/玩家城的守军事实**根本不走 GarrisonPolicy**，而是读对方城的 `military.soldiers`（设计在打玩家城处自己也承认了这条）。把这两条不同事实源（中立=配置表距离档 vs 有主城=城内 soldiers）统称「GarrisonPolicy 双向」是把两个来源混成一个，实施时必然分叉。
4. 【aggression 派生缓存的「更替时重算」缺执行者，天然会漂移】§2.2 声明 `aggression` 是 `personality` 的派生缓存、「君主更替时重算」。但设计没有指定谁在君主更替（登用顶替/战死/被夺）时触发重算，也没有把 `strategyProfile`（同样来自 profile/性格）纳入同一重算。§4.1 又把 `aggression` 独立列进 `ai_faction_profile` 配置表——于是同一个「攻击性」事实此刻有三处来源：君主 personality、faction.aggression 缓存字段、profile.aggression 配置行。三者无收敛函数即为三份可漂移副本。
5. 【AI 城「存哪」自己就是双源】§2.2 提出 `ai_faction_cities` 独立城表，同时该 AI 城又必须在 `shared_world_territories` 有一行（供投影/spawn 碰撞）。于是「这座 AI 城是否存在/归谁」这一事实分居两表，且 `SpawnAuthorityRepository`(26,173-179) 只认 `shared_world_territories` 行为占用。没有约束保证 `ai_faction_cities` 行与 territory 行同生同灭；城易主时要原子改两表+可能改玩家 game_states，三处写无事务边界说明。
6. 【faction.officerIds 与 world_people.factionId 互为反向索引，是同一归属关系的两份存储】§2.2/§2.3 让归属既存在 `ai_faction_state.officerIds[]` 又存在 `world_people(personId).factionId`。登用(§2.3)要同时改两处。这是经典双写反向索引：任何一处漏改（如战死移除只改了 officerIds 没清 factionId）即漂移。单源应是「factionId 为权威，officerIds 由查询 `world_people WHERE factionId=?` 投影」，设计却把两者都当权威存储。

### 缺口 / 待补机制
1. 【startWorldMarch 无法被非玩家、无 HTTP 上下文调用——这是 §3.2/§5.6 整个「AI 行军复用」的地基裂缝】证据：`startWorldMarch`(WorldExplorerActions.js:125-240) 通篇吃玩家 `gameState`：读/写 `gameState.exploreMissions`、跑 `validateTutorialFormation`（备忘录已记：scout 不在编队槽1直接 403 TUTORIAL_BLOCKED）、`getExploreOrigin(gameState)`、`ensureWorldMap(gameState)`、`MAX_ACTIVE_EXPLORE_MISSIONS` 上限、并生成 `worldMarchClientReports`（客户端和解用）。AI 势力没有 exploreMissions/tutorial/worldMap/客户端。AIF-0 只把它列为「可能需要抽纯入口」，但设计正文（§3.2、§5.6 复用清单）已把它当既成事实。这不是切片细节，是核心复用假设不成立，需要在设计层就决定：抽公共行军核，还是 AI 走另一条到达结算——目前悬空。
2. 【AI 战斗的可重放 inputStream 从何而来，未定义】§5.5 承诺「玩家下次登录能重放这场被攻」，复用 battle report+replay。但 `resolveBattle`(BattleSimService.js:125-156) 的确定性重放依赖 `request.inputStream`（客户端录制的操作流，152行）。AI vs 离线玩家 / AI vs AI 没有任何客户端录操作。空 inputStream 下 resolve 走什么（自动结算？纯 seed 驱动？）、其结果能否被玩家客户端重放为一致画面——完全未指定。这直接决定 AIF-6「被攻战报重放」能不能做。
3. 【客户端投影不认 AI 归属，「自动流进 DTO」是空头支票】§2.4 称 AI 城已通过 `getSharedWorldTerritories` 自动进玩家领土 DTO，唯一要做是带 factionId。证据反驳：`mergeProjectedTerritories`(TerritoryClientAssembler.js:55-66) 按 `getTerritoryProjectionPriority`(47-53) 合并，优先级函数只认 `owner==='player'`；AI 城(owner 非 player)得**最低优先级 0**，只要玩家在该 coord 有任一 discovered(1)/contested(2) 就把 AI 城挤掉(61行 `>=`)。此外 81 行 visibility 特判也 hardcode `owner==='player'`。要让 AI 城稳定可见/染色，得改优先级函数、可见性、DTO 组装多处——设计当成零改动。
4. 【与既有 `worldAi` 命名/概念正面撞车】game_states 已有 `worldAi` 列(GameStateRepository.js:30,113,192) + 完整 `WorldAiExplorerService`（per-player 的 AI 探索者 explorers），`advanceRuntimeState` 有 `advanceWorldAi` 开关(GameStateNormalizer.js:162)、worker 里显式传 `advanceWorldAi:false`(WorldWorkerService.js:51)。本设计又造一个 `faction.ai.*` 决策块 + 「AI 势力」概念。两套「AI」语义完全不同却同名，文档零处澄清边界，实施期极易把 faction 决策误挂进 per-player worldAi 通道或反之。
5. 【城易主写玩家 game_states 会撞 GAME_STATE_REVISION_CONFLICT，§7「天然无锁冲突」自相矛盾】§7 一面说 AI 表独立、无锁冲突，一面承认「城易主时写玩家 game_states 的那一下走既有领土易主写路径（已处理 revision）」。但被夺城的玩家很可能正在线（正是 worker per-player 循环+API 写在争的那批 revision）。AI worker tick 从玩家 game_states 里删一座城属于对**活跃玩家存档的带外写**，`advancePlayerWithRetry`(74-93) 的重试模型只覆盖 worker 自己的推进，没覆盖「第三方（AI）改玩家存档」的冲突/丢城通知。丢城的原子性、玩家在线时的即时反映、冲突重试全缺。
6. 【treasury 势力金库与 AI 城 resources 的钱从哪扣、双计问题未闭环】§5.3 说 AI 城产出「结余汇入 faction.treasury 统一调度」，§5.4 说 BUILD/RESEARCH/TRAIN「直接改城/势力状态并扣 treasury」。但 `advanceAllCities` 把产出加到**城的 resources**里(CityService.js:267-272)，不会自动搬进 treasury；而征兵(MilitaryService.advanceTraining,287) 也消耗**城 resources**。到底钱记在城 resources 还是 treasury？若两处都记就是双计，若只 treasury 则复用的城成长公式（依赖城 resources 扣减）失真。资源事实的单一归属没定。
7. 【行军水系禁行/四方向对 AI 起点适配缺失】§5.6 说 AI 复用 `buildAxisAlignedRoute`/`MARCH_BLOCKED_TERRAINS`。但路由在 `startWorldMarch` 内用 `ensureWorldMap(gameState)` 的玩家专属 worldMap.seed(188行)与玩家已揭示地图算路。AI 首都若落在与玩家不同的地图区域，其行军起点、地图 seed、可达性判定用谁的 worldMap？共享世界地图 seed 的权威来源没在设计里指明。
8. 【maxFactionsPerTick 轮转下，AI 城成长与行军结算不能同节流】§5.1 把 `settleArrivals` 说成 AI 行军结算的唯一腿、必须每 tick 无条件跑；§5.4/§7 又用 `maxFactionsPerTick` 限制每 tick 只推进部分势力。若结算被势力轮转限制裹挟，到达的 AI 行军会像备忘录里「纯等待饿死结算」那样拖延。设计需明确 settleArrivals 扫的是全量 pendingMarches（与势力思考轮转解耦），但 §7「AI 行军句柄存进势力状态避免全表扫描」的优化恰恰把 pending 藏进了被轮转跳过的势力里——两处要求打架。
9. 【Seeder 的 spawn 名额占用与释放语义未定义】§5.2 让 AI 首都也占一个 `player_spawn_allocations` 名额防撞。但 spawn 分配是给真实玩家发号的池；AI 永不注销/换城时怎么释放、AI 城被玩家夺走后那个 spawn 名额归属谁、`ensureSeeded` 幂等重跑会不会重复占号，均未定义。`SpawnAuthorityRepository.isOccupied`(26) 已把任何 ownerPlayerId 行算占用，AI territory 行和 spawn allocation 行可能对同一格双重占用。
10. 【AIF-8 长程模拟的雪球/停滞判据与自愈缺失】§8 AIF-8 只说「跑长 tick 观测是否雪球/停滞/蜂拥」，但没有任何机制阻止：某势力灭亡后 factionId 行/城行/world_people.factionId 的清理，或一势力吞掉全部中立城后世界枯竭。势力死亡（首都被夺、officer 清零）的终止态与级联清理是核心机制，全 doc 未提。

## 待你确认的设计问题
1. 初始 AI 势力数量与强度：开局铺几股（建议 3~5）？它们初始就是满编城+成熟科技，还是和玩家一样从弱小起步随时间成长？（影响新手体验——太强会碾压出生区玩家）
2. AI 攻打玩家城的边界：是否要有『新手保护期/出生保护环』内 AI 永不主动攻玩家？还是仅靠 expansionRange 距离自然隔离？被 AI 夺走首都是否允许（会不会直接游戏结束）？
3. AI 城的『城对象』落库方式二选一：独立表 ai_faction_cities（与玩家 territory↔city 分离对称，推荐）vs 塞进 shared_world_territories.territory.city（少一张表但混装）。倾向哪个？
4. AI 行军是否要在世界地图上对所有玩家可见地『走』（spine/行军线实时移动），还是只有当它进入某玩家视野/以某玩家为目标时才对该玩家投影？（前者更有 PVPVE 临场感但投影/性能成本高）
5. 登用/外交依赖的『性格 personality / 相性 compatibility / 关系 relationships』属于姊妹 doc。本 doc 是否可以先用占位（登用只看 quality+角色缺口、外交先只做宣战/停战二态），待人物系统 doc 落地再接？还是要等两 doc 一起实现？
6. 被 AI 攻打的结算发生在玩家离线期间：玩家下次登录用『战报重放』补看即可，还是需要推送/离线事件日志专门记录『你在离线时丢了 X 城』？
7. AI 势力之间是否真的互相开战（AI vs AI），还是第一版只做 AI→中立 与 AI↔玩家？（AI vs AI 更真实但平衡与观测更复杂）
