# 01 势力实体 + 注册表（脊柱 A）

> 由设计 workflow 深化（已过单一事实源对抗审查）。审查结论：NEEDS_REVISION——文末「审查发现」是 codex 落地前要修正/补齐的点。

## 势力 (Faction) 实体 + 注册表 — 单一事实源脊柱设计

> RTK 参照：《三国志》的「勢力」——玩家与 AI 用**同一个** `Faction` 模型；玩家不是特例，只是 `factionId === playerId` 的那一个 faction。本文是所有其他系统（外交、AI、人物、占城招降）读取的地基。

### 0. 现状证据（本设计要替换/接管的东西）

- **玩家身份现状**：`gameState.polity = { name, namePrompted, capitalCityName, color }`（`backend/services/territory/TerritoryInitialState.js:7 createInitialPolity`，`normalizePolity:45`，仓储列 `backend/repositories/GameStateRepository.js:19/102/181/378`）。**纯身份，无 ruler / 无资源池 / 无外交 / 无 AI 画像**。
- **城市/领土归属现状**：`territory.owner ∈ {player, neutral, tribe, city_state, ruin_guardians}`（`TerritoryConstants.js:55/78/101/124/147`，`TerritoryStateNormalizer.js:126`）。归属是**字符串枚举**，无法表达「属于哪个具体势力」。
- **共享世界已就位**：`shared_world_territories(territory, ownerPlayerId)` 表**已存在并被查询**（`GameStateRepository.js:449 getSharedWorldTerritories`、`getClientProjectionForPlayer:205` → `projection.sharedWorldTerritories`），客户端在 `TerritoryClientAssembler.js:200` 只读合并。`player_spawn_allocations` 防撞点由 `SpawnAuthorityRepository.js` 管。
- **AI 势力表尚不存在**：`grep ai_faction_state / AiFactionRepository` = 0 命中。这是本设计要新建的。
- **人物现状**：`gameState.famousPeople[]`，属性 `{command,force,intelligence,politics,charisma,speed}`（`FamousPersonConstants.js:13 ATTRIBUTE_KEYS`），`status.loyalty(0-100)`（`FamousPersonService.js:48`），**只是玩家名册，无世界注册表、无 personality、无 factionId**。
- **世界 tick**：`WorldWorkerService.advanceState`（`realtime/WorldWorkerService.js:47`）→ `gameStateService.advanceRuntimeState`（`GameStateNormalizer.js:155`：normalizeExplore→normalizeCombat→[WorldAiExplorer]→normalizeTerritory→normalizeCities）+ `EventService.maybeGenerate*`。**这是 per-player 循环**——AI 势力模拟必须放在 tick 里但**只跑一次**（下文 §5）。
- **配置表管线**：`config/tables/*.xlsx`（现有 garrison/veteran_camp）→ `backend/config/generated/*.json` + `table-schemas.js` + 新鲜度门禁（`docs/config-tables/README.md`）。

---

### 1. 目标

把「势力」提升为**一等世界实体**，让下面这句话为真：*"玩家 = 一个 faction；AI = 平行的 faction；城市/领土只记 `factionId`，`faction.cities` 全部由查询派生。"* 交付一个 `Faction` schema、一个 `FactionRegistry`、`polity → factions[player]` 的迁移路径，以及归属从 `owner` 字符串迁移到 `ownerFactionId` 的方案。

---

### 2. 单一事实源数据模型（每个事实唯一的家）

#### 2.1 `Faction` 实体 schema

一份权威副本，存于**共享世界态**（见 §6）。字段：

```
Faction {
  id: string            // 势力主键。玩家: `player_<playerId>`；AI: `ai_<slug>`（如 `ai_wei`）。中立守军统一挂 `neutral`（不建实体，见下）
  kind: 'player' | 'ai'          // 派生/判定用，等价 isPlayer
  isPlayer: boolean              // = kind==='player'（DTO 冗余，非存储权威；存储只留 kind）
  name: string                   // 势力名（玩家迁自 polity.name）
  namePrompted: boolean          // 迁自 polity.namePrompted
  color: string                  // #hex，迁自 polity.color；AI 从调色板分配、注册表保证不撞色
  rulerPersonId: string | null   // → World Person Registry 的 person.id（君主），NOT 内联人物
  capitalCityName: string        // 迁自 polity.capitalCityName（都城显示名；真都城由 cities 查询定位）
  homePlayerId: string | null    // kind==='player' 时 = playerId；AI 为 null。用于把 faction 落回 game_states 行
  treasury: {                    // 见 §2.4 资源归属决策：AI 用势力级池；玩家仍走 per-city，treasury=null
    ...ResourceBag | null
  } | null
  tech: FactionTechState | null  // 见 §2.5：玩家复用 gameState.techs（此处 null）；AI 存精简 tech 画像
  aiProfile: FactionAiProfile | null   // kind==='ai' 才有；见 §2.6
  lifecycle: {
    state: 'alive' | 'collapsed', // collapsed = 无城且无都；不删行（保留历史/宿敌关系）
    foundedAt: iso,
    collapsedAt: iso | null,
    collapsedReason: string | null // 'conquered' | 'abandoned' | 'merged'
  }
  createdAt: iso,
  updatedAt: iso
}
```

**明确「派生-by-query，绝不存储」的字段**（关键约束，直接对齐项目 north star）：

| 派生字段 | 权威源 | 查询 |
|---|---|---|
| `faction.cities[]` | `territory.ownerFactionId`（§2.3） | `SELECT ... WHERE ownerFactionId=? AND type in (city types)` |
| `faction.territories[]` | 同上 | `WHERE ownerFactionId=?` |
| `faction.cityCount / territoryCount` | 同上 | `COUNT(*)` |
| `faction.ruler`（人物完整对象） | World Person Registry | 按 `rulerPersonId` join |
| `faction.officers[]`（麾下武将） | Person.factionId（人物系统设计文档负责） | `WHERE factionId=?` |
| `faction.diplomacyStances`（对各方关系） | 外交表（外交设计文档负责，`(factionA,factionB)→stance`） | join |
| `faction.isPlayer` | `kind` | 布尔投影 |

> 铁律：`Faction` 行**不得**内联 cities 数组、officers 数组、resources-per-city、外交表。这些各有唯一权威源，`Faction` 只做 join 的锚点。

#### 2.2 `FactionRegistry`（按 factionId 索引的 map）

不是新存储层，是**共享世界态之上的服务门面** `FactionRegistryService`（`backend/services/faction/FactionRegistryService.js`，新建），封装 `FactionRepository`（新建，见 §6）：

```
FactionRegistryService {
  get(factionId): Faction | null
  getAll(): Faction[]                     // 含 collapsed
  getAlive(): Faction[]
  getPlayerFaction(playerId): Faction     // = get(`player_${playerId}`)；缺失时惰性物化（见 §3 迁移）
  getAiFactions(): Faction[]
  isPlayerFaction(factionId): boolean
  // 派生查询（委托 SharedWorldTerritoryRepository，绝不读 Faction 行的缓存）
  getCitiesOf(factionId, now): Territory[]
  getTerritoriesOf(factionId): Territory[]
  ownerFactionIdOf(territoryId): string | null
  // 生命周期（§4）
  createAiFaction(spec): Faction
  markCollapsedIfEmpty(factionId, now): boolean
}
```

Map 语义：`Map<factionId, Faction>`，key 全域唯一。玩家 key 命名空间 `player_*` 与 AI `ai_*` 天然不撞，也不撞现有 `ai_faction_<id>`（memory 里提到的 `ownerPlayerId=ai_faction_<id>` 约定——**建议统一收敛为 `ai_<slug>`**，见开放问题）。

#### 2.3 归属单一源：`territory.ownerFactionId`

用 `ownerFactionId` **取代** `owner` 字符串作为权威。迁移映射（`TerritoryStateNormalizer` + 一次性 migration）：

| 旧 `owner` | 新 `ownerFactionId` | 说明 |
|---|---|---|
| `player`（在 game_states 私有 territories 里） | `player_<该行 playerId>` | 私有行归属恒等本人 |
| `shared_world_territories.ownerPlayerId = <realPlayerId>` | `player_<playerId>` | 直接前缀化 |
| `neutral` / `tribe` / `city_state` / `ruin_guardians` | `ownerFactionId = null` + 保留 `garrisonType`（原值搬到独立字段） | **中立守军不是势力**——它们是 `GarrisonPolicy` 的守军类型，不进 FactionRegistry。保留 `owner` 语义为 `garrisonKind` |
| （新）AI 占的城 | `ai_<slug>` | AI 用**同一** `shared_world_territories` 表，`ownerPlayerId` 列直接存 `ai_<slug>`（列改名建议 → `ownerFactionId`，见开放问题） |

> 关键决策：`shared_world_territories.ownerPlayerId` 语义扩展为「ownerFactionId」，玩家值 `player_*`、AI 值 `ai_*`。这样 `getSharedWorldTerritories(excludePlayerId)`（`GameStateRepository.js:449`）天然把「别的玩家 + 所有 AI」一起投影给当前玩家，**零新增投影通道**。派生 `owner` 三态供旧渲染用：`ownerFactionId===当前玩家 → 'player'`，`ai_* 或别的 player → 'hostile'/'rival'`，`null → 'neutral'`。

#### 2.4 资源/国库归属

- **玩家**：维持现状，资源在 **per-city**（`gameState.cities` + `CityService`）。`faction.treasury = null`。理由：改动面最小，且玩家经济已围绕城市展开。
- **AI 势力**：用**势力级资源池** `faction.treasury: ResourceBag`。理由：AI 无需 per-city 微观经济，池化让 AI 决策（募兵/扩张预算）读一个数即可，tick 成本低。
- 判据（写进注释）：*"谁需要 per-city 微观操作，谁就 per-city；纯宏观决策的一方用势力池。"*

#### 2.5 tech 状态 per-faction

- **玩家**：复用现有 `gameState.techs {points, researched, eraChoices, grants}`（全局玩家级，`TechTreeService`）。`faction.tech = null`（权威在 gameState）。
- **AI**：`faction.tech = { era: number, researchedRoutes: string[], militaryTier, econTier }` 精简画像——**不跑完整 DAG**，只存对战斗/产出有影响的档位。理由：AI 不需要完整 38 节点 DAG 状态；只需能推导「这个势力现在多强」。era 推进由 AI tick 按简单规则递增（§5）。

#### 2.6 `FactionAiProfile`（AI 策略 + 君主性格）

```
FactionAiProfile {
  archetype: 'expansionist'|'defensive'|'opportunist'|'mercantile'|'zealot',  // 战略基调
  aggression: 0..100,        // 派生自 ruler 的 personality（人物系统提供）+ archetype 基线
  expansionBias: 0..100,
  diplomacyBias: 0..100,     // 结盟/背叛倾向
  riskTolerance: 0..100,
  strategyState: {           // AI 运行态（唯一权威，只此一份）
    goal: 'expand'|'consolidate'|'raid'|'defend'|'idle',
    targetTerritoryId: string|null,
    nextDecisionAt: iso,     // 节流：AI 不必每 tick 决策
    warBudgetSoldiers: number
  }
}
```

> `aggression` 等**行为数值派生自君主 person 的 personality**（RTK 相性/性格由人物系统设计文档定义）。这里存的是 faction 层的**运行态**（strategyState），性格本身不复制——按 `rulerPersonId` 查。

---

### 3. 玩家 faction 与 AI faction 的统一（`polity → factions[player]` 迁移）

**目标形态**：删除 `gameState.polity` 的身份职责，`FactionRegistry.getPlayerFaction(playerId)` 成为唯一读点。

**迁移策略（惰性物化 + 一次性回填，二选一或叠加）**：

1. **惰性物化**（推荐主路径，零停机）：`getPlayerFaction(playerId)` 若注册表无此 faction，则从该玩家 `game_states.polity` 现读现造 `player_<playerId>` faction（`name/color/capitalCityName/namePrompted` 来自 polity；`rulerPersonId` = 该玩家 famousPeople 里的君主/首位，或 null 待人物系统补），写入 FactionRepository。`GameStateMigrationPipeline.js` 挂一个 step 兜底。
2. **写回收敛**：`renamePolity`（`TerritoryService.js:467`）改为 `FactionRegistryService.rename(player_<id>, name)`，同时**双写** polity 直到旧读点全部迁完（过渡期），最后删 polity 列。

**统一后玩家零特例**：任何「取我的势力名/颜色/都城」的代码 → `getPlayerFaction(playerId)`；任何「取所有势力」→ `getAll()`，玩家自然在列。战斗/外交/招降只认 `factionId`，不再 `if (isPlayer)` 分叉。

**过渡期兼容**：DTO 里保留 `polity`-shaped 字段（`{name,color,capitalCityName}`）由 faction 投影，前端不动；polity 存储列在读点清零后由 migration 删除。

---

### 4. 势力的诞生 / 成长 / 崩溃

- **诞生**：
  - 玩家 faction：注册/首次加载时惰性物化（§3）。
  - AI faction：`FactionRegistryService.createAiFaction(spec)` — 由**世界初始化种子**（DEFAULT_WORLD_SEED 确定性生成 N 个开局 AI）或 tick 中的「群雄割据」规则（空城被 AI 认领时诞生）。诞生即：分配 `ai_<slug>`、调色板取色、生成/指派君主 person（人物系统 `FamousPersonGenerator` 确定性种子）、认领 1 座起始城（写 `shared_world_territories`，`ownerFactionId=ai_<slug>`）、写 `FactionAiProfile`。
- **成长**：AI tick（§5）里推进 `strategyState`；占城 = 新增 `shared_world_territories` 行；`cityCount` 自动由查询涨。tech era 按规则递增。
- **崩溃**：`markCollapsedIfEmpty(factionId)` — 当查询得 `cityCount===0`（末城被夺）→ `lifecycle.state='collapsed'`、`collapsedAt`、`collapsedReason='conquered'`。**不删行**：宿敌/义兄弟关系、历史战报仍引用它；崩溃势力从 `getAlive()` 消失但 `get()` 仍可查。君主 person → 转「在野」或被俘（人物系统处理）。
- **合并/吞并**（后续）：`collapsedReason='merged'`，territories 归属改写为吞并方 factionId。

---

### 5. 世界 tick / 事件钩子

AI 势力模拟**必须只跑一次**（不能 per-player 复制），但 tick 目前是 per-player 循环。方案：

- 在 `WorldWorkerService.runTick`（`realtime/WorldWorkerService.js`）里，**per-player 循环之外**插入一个 **`advanceSharedWorld(now)`** 单次调用（每个 worker tick 一次），内部：
  1. `FactionAiSimulationService.tick(now)`（新建 `backend/services/faction/FactionAiSimulationService.js`）：遍历 `getAiFactions()`，对 `strategyState.nextDecisionAt <= now` 的势力做决策（选扩张目标、发起对空城/对敌行军、递增 tech era、结算募兵预算）。**共享态，写 FactionRepository + shared_world_territories**。
  2. `markCollapsedIfEmpty` 扫描。
  3. （外交/关系模拟由各自设计文档挂在同一单次钩子里——本设计只保证这个「共享单次」入口存在）。
- 节流：`nextDecisionAt` 让每个 AI 每 N 秒才决策一次，tick 成本 O(alive AI)。
- 与 per-player 的关系：per-player `advanceState` 仍照跑（推进该玩家自己的行军/城市）；玩家看到 AI 变化通过 `getClientProjectionForPlayer` → `sharedWorldTerritories` 投影（§2.3），**无需 per-player 重算 AI**。
- 事件钩子：AI 占城/宣战可 `EventService` 生成世界事件（复用 `maybeGenerateThreatEvent` 旁路），推给受影响玩家。

---

### 6. 存储位置：共享世界态 vs per-player gameState（含判据）

**判据（写进架构文档）**：*"一个事实被多个玩家共同观察、或由 AI 独立于任一玩家演化 → 共享世界态（独立表/repo）；一个事实只属于某个玩家的私有进度 → 该玩家 game_states 行。"*

据此：

| 事实 | 位置 | 理由 |
|---|---|---|
| **AI 势力（Faction 行）** | **共享世界态**：新表 `factions` + 新 `FactionRepository`（`backend/repositories/FactionRepository.js`） | AI 在 tick 单次演化、被所有玩家观察，**绝不能进任何玩家 gameState**（会 per-player 复制→分叉） |
| **玩家 faction 行** | **共享世界态 `factions` 表**（`homePlayerId` 关联），身份权威在此；玩家私有进度（techs/military/cities）仍在 game_states | 让「所有势力」一个查询到齐；玩家 faction 与 AI faction 同表同模型 = 零特例。身份（name/color/都城名）是别的玩家也要看的（外交面板），属共享 |
| 领土归属 `ownerFactionId` | **共享 `shared_world_territories`**（已存在，`ownerPlayerId`→语义扩为 `ownerFactionId`） | 已是单一源，直接复用 |
| 玩家私有 techs/military/scout/tutorial | **per-player game_states** | 纯私有进度 |

**推荐**：新建 `factions` 表 + `FactionRepository`，**玩家和 AI faction 同表**。玩家 faction 的**易变私有数据不进此表**（仍在 game_states）；`factions` 表只放「势力身份 + AI 画像 + 生命周期」这类别人也要看/AI 要演化的字段。

`factions` 表 DDL 草案（对齐 `GameStateRepository` 风格，SQLite，JSON 列）：
```
CREATE TABLE IF NOT EXISTS factions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,            -- 'player' | 'ai'
  homePlayerId TEXT,             -- FK-ish → players.playerId（player 类）
  name TEXT, namePrompted INTEGER, color TEXT,
  capitalCityName TEXT,
  rulerPersonId TEXT,
  treasury TEXT,                 -- JSON | null
  tech TEXT,                     -- JSON | null
  aiProfile TEXT,               -- JSON | null
  lifecycle TEXT,               -- JSON {state,foundedAt,collapsedAt,collapsedReason}
  createdAt TEXT, updatedAt TEXT
);
CREATE INDEX idx_factions_kind ON factions(kind);
CREATE UNIQUE INDEX idx_factions_home ON factions(homePlayerId) WHERE homePlayerId IS NOT NULL;
```

---

### 7. 配置表映射（哪些数字进 Excel + 校验）

沿用管线（`config/tables/*.xlsx` → `backend/config/generated/*.json`，`table-schemas.js` 契约，新鲜度门禁）：

- **`faction_ai_archetypes.xlsx`**：`archetype`(PK) → `aggressionBase, expansionBias, diplomacyBias, riskTolerance, decisionIntervalSec, warBudgetPct`。校验：archetype ∈ 枚举、0..100 范围、interval>0。
- **`faction_seed_roster.xlsx`**（开局 AI 种子）：`factionId, name, colorHex, archetype, spawnBand(距首都距离带), rulerSeed, startTechEra`。校验：`factionId` 唯一且匹配 `ai_*`、colorHex 合法且互不撞、spawnBand 与 `garrison.xlsx` 距离带一致、rulerSeed 确定性。
- **`faction_lifecycle.xlsx`**（可选）：`collapseGraceTicks, mergeEnabled, aiSpawnCapPerWorld, aiEraAdvanceTicks`。
- 颜色调色板可做成 `faction_palette.xlsx` 供注册表分配不撞色。

DAG/枚举校验挂进 `build-config-tables` 的 check 阶段（对齐 tech_nodes 计划做法）。

---

### 8. 客户端 / UI 表面

- **投影**：`getClientProjectionForPlayer(playerId)`（`GameStateRepository.js:205`）扩加 `factions: FactionRegistryService.projectForPlayer(playerId)` —— 返回**所有 alive 势力的只读 DTO**（id/name/color/kind/rulerName/cityCount/我方对其外交 stance），玩家自己那条标 `isPlayer:true`。**投影后从 save 剥离**（对齐现有 sharedWorldTerritories 剥离约定）。
- `TerritoryClientAssembler`（已合并 `sharedWorldTerritories`）：每块领土 DTO 加 `ownerFactionId` + 派生 `ownerFactionColor/ownerFactionName`，让地图能按势力上色（RTK 势力色块）。
- 新 UI：势力总览面板（我方国力 + 已知他方势力列表 + 外交入口）；地图 legend 势力色；占城招降面板的「目标所属势力」显示。
- 前端保持 `polity`-shaped 兼容字段直到迁移完成，避免大改。

---

### 9. 实施切片（有序，每片可测）

- **F-0 特征测试基线**：锁定现有 `polity` 读写、`getSharedWorldTerritories` 投影、`territory.owner` 三态渲染的当前行为（等价证明用）。
- **F-1 `factions` 表 + `FactionRepository`**（纯存储 + 单测）：DDL、CRUD、`getAlive/getByKind`。不接任何读点。
- **F-2 `FactionRegistryService` + 玩家惰性物化**：`getPlayerFaction` 从 polity 造 `player_<id>`；`renamePolity` 改双写 faction。测试：老存档加载→物化正确、rename 落到 faction。
- **F-3 `ownerFactionId` 迁移**：`shared_world_territories.ownerPlayerId` 语义扩展 + `territory.owner`→`ownerFactionId` 归一（保留 `garrisonKind`），派生 `owner` 三态兼容层。`TerritoryStateNormalizer` 迁移映射。测试：玩家/中立/AI 归属正确、旧渲染不炸。
- **F-4 投影 + 客户端 DTO**：`getClientProjectionForPlayer` 加 `factions`；`TerritoryClientAssembler` 加势力色。前端势力总览面板（读投影，不改写路径）。
- **F-5 AI 势力诞生 + 配置表**：`faction_seed_roster/ai_archetypes` 表 + `createAiFaction` + 世界种子生成开局 AI（认领起始城）。测试：确定性生成、不撞色、不撞 spawn。
- **F-6 AI tick 单次钩子**：`advanceSharedWorld` + `FactionAiSimulationService.tick`（先做最简：AI 认领邻近空城 / era 递增）。测试：多玩家 tick 下 AI 只演化一次、玩家投影看得到。
- **F-7 崩溃生命周期**：`markCollapsedIfEmpty`、末城被夺→collapsed、collapsed 势力退出 getAlive 但可查。
- **F-8 收敛**：删 `polity` 存储列（读点全迁完后）+ 删旧 `owner` 字符串权威。门禁 + 双部署 + 真机终验。

> 每片：先特征测试锁行为 → 手术 → 读证等价，符合 memory「no debt for safety」纪律。F-6/F-7 是唯一需要 live 验证的残留（AI 演化的时序）。


---

## 审查发现（单一事实源 + 缺口，落地前修正）

### 单一事实源违规（须改为查询/投影，不得复制）
1. 【capitalCityName 二次复制】设计 §2.1 把 `faction.capitalCityName` 当作从 polity 迁移来的一等存储字段，并注明「真都城由 cities 查询定位」。但代码里这个事实已经是派生的：`TerritoryNaming.js:93 getCapitalName` = `territory.cityName || polity.capitalCityName || '首都'`，权威在 `territory(id='capital').cityName`，polity 只是回退。设计把一个已经『派生+回退』的值提升为 faction 行里的存储列，等于把都城名复制到第三处（territory.cityName / polity / faction.capitalCityName）。应当:faction 不存 capitalCityName，改为按 `rulerFactionId` 查该势力 capital 城的 cityName。这直接违反本设计自己的铁律。
2. 【owner ↔ ownerFactionId 双写风险】设计 §2.3 迁移表把私有 `owner:'player'` 映射成 `ownerFactionId=player_<id>`，但 `TerritoryStateNormalizer.js:126` 里 `owner` 本身是派生的：`owner = rawTerritory.owner || (status==='occupied' ? 'player' : 'neutral')`——归属根本没独立存储，是从 `status==='occupied'` 现算的。设计新增 `ownerFactionId` 存储列后，`owner` 三态兼容层（§2.3 末）与 `status` 派生逻辑会形成两个独立的归属真相源（status 派生的 owner vs 存储的 ownerFactionId），normalizer 每次都会用 status 重算覆盖，除非删掉 line126 的派生。设计没提到要拆掉这条派生规则，会双源打架。
3. 【shared_world_territories 已内嵌 ownerPlayerId 冗余】`GameStateRepository.js:458` 每行 territory JSON 里已经内嵌了一份 `ownerPlayerId`，同时列 `ownerPlayerId` 又存一份（line 492 upsert 双写同一值）。设计 §2.3 要把该列语义扩为 ownerFactionId，但没处理『territory JSON 内嵌副本 + 列副本』这个既存双写——扩展语义会把冗余从 1 处变 2 处（JSON 里 + 列里各一个 factionId），且 `getSharedWorldTerritories:458` 用 `territory.ownerPlayerId || row.ownerPlayerId` 做回退，两者不一致时行为未定义。
4. 【faction.color / polity.color 迁移后回退双源】§8 说前端保留 `polity`-shaped 兼容字段由 faction 投影，同时 §3 过渡期 rename『双写 polity 直到旧读点全迁完』。过渡期内 name/color/capitalCityName 同时活在 polity 列与 factions 行两处，且没有指明哪个是过渡期权威。这是设计自己制造的临时双源，缺一个『过渡期读点一律走 faction，polity 只写不读』的硬约束来避免漂移。
5. 【AI tech era 双账本】§2.5 AI `faction.tech={era,...}` 与 §2.6 `strategyState` 都是 faction 行内 JSON，而 §5 说 era 由 AI tick『按简单规则递增』。同时玩家侧 era 权威在 `gameState.currentEra`。AI 势力的 era 与玩家 currentEra 是两套独立字段两套推进规则，若未来有『跨势力时代同步/领先判定』就会需要一个统一的 era 事实源——设计未定义势力 era 的统一查询口径。

### 缺口 / 待补机制
1. 【致命遗漏：已存在的 worldAi/WorldAiExplorerService 子系统】设计 §0 断言『AI 势力表尚不存在，grep ai_faction = 0 命中，这是本设计要新建的』。但 `backend/services/WorldAiExplorerService.js` 已存在且在运行：`gameState.worldAi` 列（GameStateRepository:113/192/389）、explorer 带 `factionId` 字段、常量 `DEFAULT_AI_FACTION_ID='ai-frontier'`、`DEFAULT_AI_EXPLORER_ID='ai-frontier-1'`。设计对这个既有 AI faction 概念只字未提，既没说接管也没说共存。而且它用的 id 命名空间是 `ai-frontier`（连字符），与设计的 `ai_<slug>`（下划线）冲突——两套 AI faction id 规范。这是全设计最大的证据错误，动摇 §0/§2.2/§4/§5 的地基。
2. 【致命遗漏：worldAi 存在 game_states 是 per-player 的，正是 §5 警告的反模式】既有 `gameState.worldAi` 存在每个玩家的 game_states 行里（per-player 复制）。设计 §5 大篇幅论证『AI 必须只跑一次、绝不能进任何玩家 gameState』，却没意识到现状恰恰已经把 AI explorer 状态 per-player 存了。迁移这份既有 per-player worldAi 到共享 factions 表的路径完全缺失——这是本设计真正要解决的问题，却被『表尚不存在』的错误前提掩盖了。
3. 【tick 证据反了：advanceWorldAi 现为 false】§0 描述 tick 管线为『normalizeExplore→normalizeCombat→[WorldAiExplorer]→normalizeTerritory』，暗示 WorldAiExplorer 在 per-player 管线里跑。实际 `WorldWorkerService.advanceState:50-54` 明确传 `advanceWorldAi:false`，`GameStateNormalizer.js:162` 只有 `advanceWorldAi===true` 才跑 AI。现状 AI 在 worker 里是关闭的。设计 §5 要新加的 `advanceSharedWorld` 单次钩子与这个既有的（被关闭的）per-player AI 开关如何取舍，完全没交代。
4. 【文件路径与行号大面积不符】设计引用 `realtime/WorldWorkerService.js:47` 与 `GameStateNormalizer.js:155`（作为 tick pipeline 起点），实际 WorldWorkerService 在 `services/realtime/`，`advanceRuntimeState` 在 GameStateNormalizer.js:155 但它调用的是 WorldExplorer/WorldCombat/TerritoryService 而非文中列的顺序。`TerritoryConstants.js:55/78/101/124/147` 声称是 owner 枚举定义处，实际那些行是 `SITE_TEMPLATES` 里各模板的字段，`owner` 值散落在 57/80/103/126/149，且根本没有集中的 owner 枚举常量。审阅者据错误坐标无法定位，实施者会改错文件。
5. 【owner 枚举缺 player/capital 态】§0 与 §2.3 把 owner 枚举列为 {player,neutral,tribe,city_state,ruin_guardians}。但 SITE_TEMPLATES 里根本没有 owner:'player' 模板，player 态是 normalizer 从 status 现算的（line126），capital 恒为 owner:'player'（TerritoryInitialState:25）。迁移映射表把 'player' 当作一个存储枚举值来 prefix 化，忽略了它是运行时派生态，迁移脚本会漏掉从未被物化成字符串 'player' 的行。
6. 【空城守军占城链未接：占城=先打一场是 pending】memory 与任务表显示 P0-1『空城守军——占城=先打一场』仍 pending。设计 §4 AI『认领 1 座起始城』『占邻近空城』直接写 shared_world_territories，但占城要过战斗结算这条链还没做。AI 占城如何与既有 conquest/battle 结算交互（还是 AI 绕过战斗直接改归属？）完全未定义，会造成玩家打城要战斗、AI 占城白嫖的不对称。
7. 【中立守军 owner→null + garrisonKind 的读取面未清点】§2.3 决定把 neutral/tribe/city_state/ruin_guardians 的 owner 搬到独立 `garrisonKind` 字段、ownerFactionId=null。但现有大量代码按 `territory.owner === 'neutral'` 等字符串分支（如 TerritoryStateNormalizer syncScout line284 判 `owner==='player'`，SITE_TEMPLATES 用 owner 选美术/守军）。设计没清点所有读 owner 字符串的消费点，改成 null 会让这些分支静默失效。派生 owner 兼容层只覆盖了 player/hostile/neutral 三态，丢了 tribe/city_state/ruin_guardians 的区分。
8. 【惰性物化的并发/幂等未定义】§3 `getPlayerFaction` 缺失时『现读现造并写 FactionRepository』。这在 per-player worker tick + API 并发下会有竞态：两个请求同时物化同一 player_<id> faction。DDL 有 UNIQUE(homePlayerId) 能兜底，但设计没说物化用 INSERT OR IGNORE / 事务，也没说 read-path 写库（getPlayerFaction 是读却有副作用）对 GameStateRepository 的 revision 事务模型有何影响。
9. 【崩溃后 rulerPersonId / capitalCityName 悬挂】§4 collapsed 势力『不删行』，末城被夺 cityCount=0。但 faction.capitalCityName 仍指向已失去的城，rulerPersonId 指向的君主 §4 说『转在野或被俘（人物系统处理）』——人物系统尚无 factionId（已核实 famousPerson 无 factionId 字段）。collapsed 势力的都城名/君主引用悬挂后，投影 §8 的 rulerName/cityCount 如何呈现未定义。
10. 【treasury per-faction vs per-city 的战斗/招降读取不对称】§2.4 玩家资源 per-city、AI 用 faction.treasury 势力池。但占城招降、掠夺战利品（P0-3 老兵营地/战利品链）需要读『打下这座城抢到多少资源』——玩家的在 city，AI 的在势力池，没有统一的『某城可掠资源』查询口径。攻击 AI 城时资源从哪扣、玩家城被 AI 打时怎么算，跨两套模型且未定义。
11. 【配置表新鲜度/枚举校验未落到既有门禁的具体挂点】§7 列了 4 张新 xlsx，说『DAG/枚举校验挂进 build-config-tables 的 check 阶段（对齐 tech_nodes 计划做法）』。但 tech_nodes 表按 memory 尚是计划、非既成，援引一个未落地的先例做校验模板等于无参照。colorHex『互不撞』的校验是跨行全局约束，现有 table-schemas per-row 契约能否表达跨行唯一性未验证。
12. 【DDL 缺 ai id 唯一性 / kind 约束 / 外键】factions DDL 只对 homePlayerId 建 UNIQUE。ai_<slug> 的 id 唯一性靠 PK 兜底 ok，但 kind 无 CHECK 约束、rulerPersonId/homePlayerId 无外键或清理策略。玩家删档（resetPlayerState:433 删 game_states+shared_world_territories）时不会清 factions 行——设计 §4『不删行』的历史保留意图与删档清理冲突，会留下孤儿 player_<id> faction。

## 待你确认的设计问题
1. factionId 命名收敛：memory 记有 `ownerPlayerId=ai_faction_<id>` 约定，本设计建议统一为 `ai_<slug>`（玩家 `player_<playerId>`）。是否接受把 `shared_world_territories.ownerPlayerId` 列语义扩展为 `ownerFactionId`（甚至改列名），值域含 `player_*` 与 `ai_*` 两种前缀？还是保留列名、仅约定前缀？
2. 玩家 faction 是否与 AI faction 同表 `factions`（推荐，零特例但玩家身份从 game_states.polity 搬家），还是玩家身份继续留在 game_states.polity、只有 AI 进 factions 表（改动小但保留一个特例分叉）？
3. 资源归属：确认『玩家 per-city、AI 势力级 treasury 池』的分裂设计可接受吗？还是希望未来玩家也走势力级国库（那 city 经济要重构，属大改，需单列）？
4. AI tech：只存精简档位画像（era + 少量 tier）而非完整 38 节点 DAG——AI 是否永远不需要真实 tech 树？若未来 AI 要和玩家共享同一 DAG（对称性），tech 状态就该 per-faction 全量，存储会更重。
5. 开局 AI 数量与分布：由 DEFAULT_WORLD_SEED 确定性生成固定 N 个开局势力，还是随游戏进程动态『群雄割据』（空城被认领即诞生新势力）？两者的表现和平衡差异较大。
6. 中立守军（tribe/city_state/ruin_guardians）确认『不是势力、不进 FactionRegistry、`ownerFactionId=null` + `garrisonKind` 保留原值』吗？还是希望把它们也建成轻量『中立势力实体』以便统一招降/外交？
7. 崩溃势力的君主 person 去向（转在野/被俘/死亡）由人物系统设计文档定，本文只标记 collapsed——这个分工边界 OK 吗？
