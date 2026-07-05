# 06 科技树 Civ 式重设计

> 由设计 workflow 深化（已过单一事实源对抗审查）。审查结论：NEEDS_REVISION——文末「审查发现」是 codex 落地前要修正/补齐的点。

> 本文档 = `docs/design/06-tech-tree-redesign.md`（脊柱见 `docs/design/00-vision-and-spine.md`）。目标：把只解锁建筑、只存玩家全局的科技树，升级为 **Civ 式多效果、每势力独立研究、单一效果 schema + 单一效果解析器** 的系统，且**迁移期 38 节点持续可用**。

## 1. 目标 + RTK/Civ 参照

- **现状（证据）**：`backend/config/TechTreeConfig.js` = 38 节点 / 5 时代 / 10 路线，DAG（`tree.parents`）。节点唯一"真效果"是 `effects.unlockedBuildings`；`effects.resourceEntrances` 是纯展示文案（`RESOURCE_LABELS`，无数值作用）。状态 `gameState.techs {points, researched, eraChoices, grants}` 是**玩家全局**（`TechTreeService.normalizeTechState`）。每时代"选 N 选 1"（`TECH_CHOICE_LIMITS`）而非可全解锁的科技网——这更像天赋抉择，不是文明科技树。
- **Civ 参照**：科技应产出**多类型效果**（解锁兵种/建筑、产出加成、战斗修正、能力/政策解锁、外交修正、人口/科研速率），组成**科技网**（多前置、跨路线依赖、时代纵深），驱动文明分化。
- **RTK 参照**：科技是势力级的长期成长，AI 势力同样研究、同样吃效果——**玩家=势力**（脊柱 A），不为玩家开特例。
- **本设计的三个不变量**：① 一份 `effect` schema；② 一个 `TechEffectResolver`（把某势力已研节点聚合成一份 effects 快照，派生、不落库）；③ 每势力 tech 状态 keyed by `factionId`（玩家 factionId==='player'）。

## 2. 单一事实源数据模型（每个事实只有一个权威副本）

### 2.1 节点定义（config，唯一权威）
节点定义住在 config（迁移前 `TechTreeConfig.js`，迁移后 `tech_nodes` 表 + `backend/config/generated/tech_nodes.json`）。每节点 schema：

```
{
  id: 'classical_workshop_guilds',      // 主键，稳定不可改（存档按 id 持久化）
  era: 5, route: 'industry',
  cost: 1,                              // 科技点成本（现固定隐含 1，显式化）
  parents: ['frontier_bloomery_signs', 'frontier_guard_forges'],
  parentMode: 'any',                    // 'any'(默认，保持现行 hasRequiredParent) | 'all'
  effects: [ <TypedEffect>, ... ],      // ← 核心：从单一 unlockedBuildings 升级为 typed effect 数组
  name, summary, core, routeLabel       // 展示文案（保留）
}
```

**关键**：`effects` 从 `{unlockedBuildings:[...], resourceEntrances:[...]}` 这种**按 key 散开的对象**，改为**统一的 typed effect 数组**（§3）。迁移期兼容层把旧 `unlockedBuildings` 读成 `{type:'unlockBuilding', ...}`（§7 slice 1）。

### 2.2 势力 tech 状态（唯一权威，per-faction）
- **权威副本位置**：跟随脊柱 A 的势力事实源。真人玩家 = `game_states.playerId` 行内的 `techs`（沿用今天位置，键名不变）；AI 势力 = 新 `ai_faction_state`（脊柱 A 定，`docs/design/01-faction-model.md` / `05-ai-factions-cities.md`）行内的 `techs`。**形状同构**：

```
faction.techs = {
  points: <int>,
  researched: { [nodeId]: { id, completedAt } },   // 唯一"已研"事实
  eraChoices: { [era]: [nodeId,...] },              // 派生自 researched（normalize 时重建，见现 normalizeTechState）
  grants:   { [era]: { points, grantedAt } },       // 防重复发点
}
```
- **派生、不落库的东西（用查询/投影）**：
  - 势力当前 effects 快照（解锁的建筑/兵种/各加成）→ `TechEffectResolver.resolve(faction)` 每次现算，**绝不存进 gameState**。今天 `getUnlockedBuildings` 已是"从 researched flatMap"的派生查询，本设计把它一般化。
  - `eraChoices` 已是从 `researched` 重建的派生（`normalizeTechState` L18-26），保持。
  - 客户端 DTO（`getClientState`）= 投影，存盘前不回写。

### 2.3 effects 快照的落点（单一聚合缝）
证据：产出管线已有一个**扁平 effects 聚合对象**——`BuildingEffectCalculator.calculate()` 产出 `{foodOutputMultiplier, globalOutputMultiplier, woodOutputBase, knowledgeOutputMultiplier, threatDefense, ...}`，`ResourceTickCalculator` 逐项乘算（`* (effects.foodOutputMultiplier||1) * (effects.globalOutputMultiplier||1)` 等，见 `ResourceTickCalculator.js:13-95`），`CityService.applyDerivedStatsToCity` 把它挂到 `city.buildingEffects`。

**科技效果不新起并行管线**——它把自己的加成**并进这同一个 effects 对象**。新增 `TechEffectAggregator.mergeInto(effects, techEffectsSnapshot)`，在 `applyDerivedStatsToCity` 里 `BuildingEffectCalculator.calculate` 之后调用，science/combat 等新字段进同一对象。**单一事实源**：产出/战斗/人口只认一个 effects 对象，来源（建筑 or 科技 or 领土）无关。

## 3. 效果类型 schema（一份，唯一）

`shared/techEffectSchema.js`（纯常量 + 校验，前后端共享；纯规则核）。每个 typed effect：

```
{ type: <EFFECT_TYPE>, target: <string?>, op: <'add'|'mul'|'flag'>, value: <number?>, params: {..}? }
```

### 3.1 效果类型枚举（`EFFECT_TYPES`）

| type | 语义 | target 取值 | op | value | 落到哪个 effects 字段/系统 |
|---|---|---|---|---|---|
| `unlockBuilding` | 解锁可建建筑 | 建筑 id（`farm`…`temple`） | flag | — | `effects.unlockedBuildings[]`（今天已有，泛化） |
| `unlockUnit` | 解锁兵种 | 兵种 id（`barbarian_infantry`…） | flag | — | `effects.unlockedUnits[]`（新，喂 MilitaryService 可募列表 + `UnitSpriteManifest`） |
| `resourceOutput` | 资源产出加成 | `food\|wood\|stone\|iron\|knowledge` | mul/add | 数值 | `effects.<res>OutputMultiplier`(+=value) 或 `<res>OutputBase`(+=value) |
| `globalOutput` | 全资源产出 | — | mul | 数值 | `effects.globalOutputMultiplier`(+=value) |
| `combatModifier` | 战斗修正 | `attack\|defense\|<兵种>\|siege` | mul/add | 数值 | 新 `effects.combat.<target>`；战斗层读（§5.3） |
| `abilityUnlock` | 能力/政策解锁 | 能力 id（如 `talentPolicy.industry`、`veteranCamp`） | flag | — | `effects.abilities[]`（gate 政策/建筑动作） |
| `diplomacyModifier` | 外交修正 | `recruitRate\|favorabilityGain\|...` | add | 数值 | `effects.diplomacy.<target>`；被 `04-diplomacy` / ②b 招降消费 |
| `populationBonus` | 人口上限/增长 | `cap\|growth` | mul/add | 数值 | `effects.populationCapBonus` / `growthMultiplier` |
| `techRateBonus` | 科研/知识速率 | — | mul | 数值 | `effects.knowledgeOutputMultiplier`(复用) 或独立 `techRateMultiplier` |

- **op 规约**：`mul` 语义是"加进一个从 1 起算的乘数"（与 `BuildingEffectCalculator` 现行 `effects.foodOutputMultiplier += bonus`、初值 1 完全一致，保证可叠加、可与建筑加成同栈）。`add` 直接累加到 base。`flag` 只把 target 推进对应集合。
- **不允许**：把任意公式字符串塞进 effect（对齐 `docs/config-tables/README.md` 的"别外置任意公式"）。只有 `add/mul/flag` 三种算子 + 数值参数。
- **校验**：schema 暴露 `validateEffect(effect)`（type∈枚举、target 对该 type 合法、op 合法、value 数值），导表/加载期强校验。

## 4. 效果应用管线（一个解析器，不散落）

### 4.1 `TechEffectResolver`（`backend/services/tech/TechEffectResolver.js`，纯派生）
```
resolve(faction) -> TechEffectSnapshot {
  unlockedBuildings: Set, unlockedUnits: Set, abilities: Set,
  resourceOutput: { food:{mul,add}, ... }, globalOutputMul, combat:{...},
  diplomacy:{...}, population:{...}, techRateMul,
}
```
- 输入：`faction.techs.researched` 的 id 列表 + 节点定义（`ConfigTables.getRows('tech_nodes')` 或迁移期 `TechTreeConfig.TECH_BY_ID`）。
- 逻辑：flatMap 每个已研节点的 `effects[]`，按 type/op 折叠（mul 累乘进乘数、add 累加、flag 入集合）。**纯函数，无副作用，可单测**（给定 researched 集合 → 确定 snapshot）。
- **这是唯一把"已研节点"翻译成"生效数值"的地方**。今天散在 `TechTreeService.getUnlockedBuildings` 的 flatMap 收敛到这里，`getUnlockedBuildings` 变成 `resolve(faction).unlockedBuildings` 的薄封装（保持 `BuildingUnlockService` 调用点不破）。

### 4.2 三个消费缝（都读同一个 snapshot，不复制）
1. **产出/人口**：`TechEffectAggregator.mergeInto(cityEffects, snapshot)` 在 `applyDerivedStatsToCity`（`CityService.js:197`）里合入 `city.buildingEffects`；`ResourceTickCalculator` 无需改（它已读 `effects.foodOutputMultiplier` 等）。
2. **建筑解锁**：`BuildingUnlockService.getUnlockedBuildings`（`backend/services/BuildingUnlockService.js:14`）改为读 `snapshot.unlockedBuildings`（等价泛化）。
3. **兵种/战斗/外交/能力**：MilitaryService 可募列表读 `snapshot.unlockedUnits`；战斗层读 `snapshot.combat`；②b 招降 & `04-diplomacy` 读 `snapshot.diplomacy`；政策/建筑动作 gate 读 `snapshot.abilities`。

> 单一事实源：**任何"这个势力现在能做什么/加成多少"都必须经 `TechEffectResolver.resolve(faction)`**，不得在别处二次判断 researched。

### 4.3 per-faction 落地（player 非特例）
- 今天所有入口传的是"玩家 gameState"。改为传 `faction`（player 势力的 faction 视图 = 其 gameState；AI 势力 = `ai_faction_state` 行）。`resolve/research/getClientState` 一律 `(faction, ...)`。
- **AI 研究**：AI 势力决策循环（`05-ai-factions-cities`，跑在 `WorldWorkerService` tick，共享、每 tick 一次）调用 `TechTreeService.research(aiFaction, nodeId)`——**同一个纯规则函数**，无第二套。AI 的 effects 快照同样经 `resolve` 派生，喂它的城产出/募兵/战斗。
- **兼容垫片**：迁移首阶段 faction 视图 = gameState 本体（`faction.techs === gameState.techs`），签名先切、语义不变；脊柱 A 落地后 AI 势力自然接入。

## 5. 机制/规则（纯规则核 vs 服务层）

### 5.1 纯规则核（`shared/` 或 `backend/services/tech/`，无 IO、可单测）
- `techEffectSchema.js`：类型枚举 + `validateEffect`。
- `TechEffectResolver.resolve(researchedIds, nodeDefs)`：折叠 → snapshot。
- `techGraph.js`：`getMissingParents` / `hasRequiredParent`（现 `TechTreeService` 内，抽出）+ **DAG 校验**（拓扑排序检测环、检测悬挂父引用、检测跨时代非法父）。
- `getTechStatus`（现有）：available/locked/researched/eraChoiceFull/missingPrerequisite/noPoints，保持。

### 5.2 服务层（`TechTreeService`，有状态、编排）
- `research(faction, nodeId)`：校验（时代/已研/选择上限/前置/点数）→ 扣点、写 researched、重建 eraChoices（现有逻辑，改吃 faction）。**研究成功后不写 effects**——effects 永远现算。
- `grantEraPoints` / `grantEarnedEraPoints`：吃 faction，语义不变。

### 5.3 战斗修正的接入（谨慎）
`snapshot.combat` 需喂进战斗层。证据：实时战斗是 bitecs（`shared/battleSimCore.js`，`docs/config-tables/README.md` 标注 battle 系列"无兜底、错格 NaN"）。**规约**：科技战斗修正**作为战前一次性乘子注入队伍强度**（`FormationStrengthService` / 战斗初始化时把 `snapshot.combat.attack` 等折进单位属性），**不逐 tick 读**——避免污染 tick 热循环、避免 NaN 面。value 缺省 fail-closed 为中性（mul→1、add→0）。

## 6. 配置表映射（`tech_nodes` + `tech_era_grants`，对齐 P2 路线）

`docs/config-tables/README.md` 已登记 `tech_nodes`(7 字段) / `tech_era_grants`(3 字段) 为 P2。本设计给出字段契约（进 `config/tables/table-schemas.js`）：

### 6.1 `tech_nodes` 表
| 字段 | 类型 | 含义 | 校验 |
|---|---|---|---|
| `id` | string | 节点主键（稳定） | 唯一；存档按此持久化，**禁改名** |
| `era` | int | 所属时代 1-5 | 1..maxEra |
| `route` | string | 路线 id | ∈ `TECH_ROUTE_META` 键 |
| `cost` | int | 科技点成本 | ≥0 |
| `parents` | csv | 前置节点 id 列表 | 每项存在于本表；**DAG 无环**；父 era ≤ 本 era |
| `parentMode` | string | any/all | ∈{any,all}，默认 any |
| `effects` | json | typed effect 数组 | 每项过 `validateEffect`；target 引用的建筑/兵种/资源 id 必须存在 |

- **展示文案**（name/summary/core/routeLabel）与**布局**（column/lane/row）：建议**留在代码**（`TECH_TREE_LAYOUT` + `TECH_ROUTE_META`，纯前端排版，非数值），表只管数值/结构/效果——避免把 30+ 中文文案塞进 Excel 单元格。或单开只读 `name/summary` 两列供策划参考。**决策见开放问题 Q4。**
- **导表 DAG 校验（硬门禁）**：`build-config-tables.js` 加 per-table `validate(rows)` 钩子（现无，需加通用钩子机制）。对 `tech_nodes`：拓扑排序检测环（打错字造环，编译期查不出——README 明确点名）、悬挂父引用、跨时代非法父、`effects` JSON 每项过 schema、target id 交叉引用存在性（unlockBuilding→建筑表、unlockUnit→兵种表）。任一失败 → 导表 exit≠0 → 部署门禁红。

### 6.2 `tech_era_grants` 表
`{ era:int(主键), points:int, choiceLimit:int }`——收编 `TECH_POINT_GRANTS` + `TECH_CHOICE_LIMITS`。

> 兼容：`GameplayConfigRuntime` 里 `TechTreeConfig` 的 `TECH_BY_ID` 等在迁移终态改为从 `ConfigTables.getRows('tech_nodes')` 构建（读法收敛），调用点 API 不变。

## 7. 世界 tick / 事件挂钩

- **发点**：`grantEarnedEraPoints` 已在时代推进时发点（`AdvanceEraAction`）。per-faction 后，AI 势力升代同样经此发点。
- **AI 研究决策**：挂 `WorldWorkerService` tick 的 AI 势力循环（`05-ai-factions-cities`）——每 tick 对活跃 AI 势力评估"研哪个可用节点"（按势力战略偏好权重，走配置表），调 `TechTreeService.research`。**共享世界只跑一次**，不每玩家复算。
- **effects 生效点**：产出经 `advanceAllCities → applyDerivedStatsToCity`（每 tick 已跑），mergeInto 在此自然生效。**无新调度**。

## 8. 客户端/UI 面

- **画布**：`TechTreeLayoutModel.js` / `TechTreeCanvasRenderer.js` / `TechTreeInteractionModel.js` 吃 `getClientState` 的 `eras[].techs[]`。DTO 需扩展：`buildClientTech`（`TechTreeService.js:124`）当前只投影 `resourceEntrances`/`unlockedBuildings` 文案，需泛化为**渲染 typed effects 列表**（每 effect → 一行本地化描述，如"步兵 攻击 +15%"、"知识产出 ×1.2"）。
- **本地化**：effect 描述走 `t()`（见 MEMORY i18n 约定），schema 提供 `describeEffect(effect, locale)` → key。**禁把中文烘焙进 DTO/存档**。
- **布局影响**：更深的科技网（更多前置/跨路线边）会让 `TECH_TREE_LAYOUT` 手工 column/lane 难维护——建议迁移期保留手工布局（38 节点可控），内容扩张阶段引入按 era 分层 + 路线泳道的**自动布局回退**（拓扑层级定 column，route lane 定 y），手工覆盖优先。**决策见 Q4。**
- **per-faction 视角**：玩家永远只看**自己势力**的科技树（`getClientState(playerFaction)`）；AI 势力科技是共享世界事实，仅在外交/侦察情报面板里以"对方已入某时代/某路线"的粗粒度投影出现（不泄露完整 researched，避免信息过载与作弊感）。**决策见 Q5。**

## 9. 实施切片（有序、各自可测，38 节点全程可用）

- **Slice T1 — 效果类型框架（不改内容/不改状态位置）**：建 `shared/techEffectSchema.js` + `TechEffectResolver` + `TechEffectAggregator`。**兼容读**：把现有 38 节点的 `effects.unlockedBuildings` 在 resolver 内映射成 `{type:'unlockBuilding'}`，`resourceEntrances` 暂映射为空效果（纯文案保留在 DTO）。`BuildingUnlockService` 改读 resolver。特征测试：`getUnlockedBuildings` 前后逐 gameState 等价（读证等价基线）。**此片零行为变化。**
- **Slice T2 — mergeInto 接入产出管线**：`applyDerivedStatsToCity` 调 `TechEffectAggregator.mergeInto`。此时所有节点 effects 仍等价旧值（无数值 effect），产出快照必须**逐字节不变**（特征测试锁 `ResourceTickCalculator` 输出）。为后续内容扩张打好缝。
- **Slice T3 — 内容扩张（typed effects 上数值）**：给部分节点加 `resourceOutput/globalOutput/populationBonus/unlockUnit/combatModifier` 等真效果；补齐科技网（跨路线前置、时代纵深）。**仍在 `TechTreeConfig.js`**（未迁表），改的是 `effects` 数组内容。每类效果一个单测（研某节点 → snapshot 对应字段变化 → 产出/募兵/战斗对应变化）。
- **Slice T4 — per-faction 签名切换**：`research/resolve/getClientState/getUnlockedBuildings/grant*` 全部 `(faction, ...)`。玩家 faction 视图 = gameState（垫片）。特征测试：玩家路径行为不变。为 AI 接入留好接口（AI 势力落地时直接传 `ai_faction_state` 行）。
- **Slice T5 — 表迁移**：`tech_nodes` + `tech_era_grants` 进 `table-schemas.js`（种子 = 现 38 节点 dump）；`build-config-tables.js` 加 per-table validate 钩子 + DAG/schema/交叉引用校验；`TechTreeConfig` 改从 `ConfigTables` 构建 `TECH_BY_ID`。`--check` 新鲜度门禁生效。**行为等价**（表种子=旧常量）。
- **Slice T6 — 客户端 typed-effect 渲染 + AI 研究循环接线**：DTO/画布渲染 effect 列表 + `describeEffect` i18n；AI 势力决策循环调 `research`（依赖脊柱 A / `05`）。

> 纪律（对齐 MEMORY `refactor-no-debt-for-safety`）：T1/T2/T4/T5 均为**读证等价**切片（特征测试锁定，不需中途人工验），只有 T3/T6 是**新行为/新内容**，需正常测试 + 一次性 live 终验。

## 10. 引用的真实文件（交接锚点）

- 节点定义 + 布局：`backend/config/TechTreeConfig.js`
- 状态/研究/DTO：`backend/services/TechTreeService.js`
- 建筑解锁消费点：`backend/services/BuildingUnlockService.js:14`
- 产出聚合缝：`backend/calculators/BuildingEffectCalculator.js` + `backend/calculators/ResourceTickCalculator.js` + `backend/services/CityService.js:197`（`applyDerivedStatsToCity`）
- 时代/发点：`backend/config/EraConfig.js`、`backend/actions/AdvanceEraAction.js`
- 配置表管线：`scripts/build-config-tables.js`、`config/tables/table-schemas.js`、`docs/config-tables/README.md`（`tech_nodes`/`tech_era_grants` 登记于 P2）
- 兵种：`frontend/js/config/UnitSpriteManifest.js`（`unlockUnit` 的前端消费）
- 客户端画布：`frontend/js/platform/renderers/TechTreeLayoutModel.js` / `TechTreeCanvasRenderer.js` / `interactions/TechTreeInteractionModel.js`
- 脊柱：`docs/design/00-vision-and-spine.md`（§4 共享世界结论；faction/person 事实源）

---

## 审查发现（单一事实源 + 缺口，落地前修正）

### 单一事实源违规（须改为查询/投影，不得复制）
1. 【eraChoices 双写，非纯派生】设计 §2.2 声称 `eraChoices` 是「派生自 researched（normalize 时重建）」并「保持」。但证据相反：`research()`（TechTreeService.js:224）在写 `researched[techId]` 的同时**手动写** `techs.eraChoices[String(tech.era)] = [...choices, techId]`，`getClientState`/`getTechStatus` 都直接读这个存下来的 `eraChoices`（L118/L169 读它做「选择上限」判定）。也就是说 `eraChoices` 是一个**被持久化的第二副本**，`normalizeTechState` 只在加载时做补重建（L18-26），运行期是 research 直写。设计把它当既有的「派生查询」照抄进新架构，会把这个既存双写原封不动带过去。真正的单源做法应是删掉存储的 eraChoices，`getEraChoices(era)` 每次从 `researched` + 节点 era 现算（就像 getUnlockedBuildings 那样）。设计没识别这点，反而写「保持」，等于批准了一处 SSOT 违规。
2. 【`cost` 字段与「隐含 1」并存，产生权威二义】设计 §2.1/§6.1 引入显式 `cost` 字段，但 `research()`（TechTreeService.js:219）硬编码 `techs.points -= 1`。设计只说「现固定隐含 1，显式化」，却没规定 research 必须改成扣 `tech.cost`。若迁移只加字段不改扣点逻辑，则「一项科技要花几点」这个事实同时住在 config 的 `cost` 和 service 的字面量 `1` 里——两处一旦不一致（T3 内容扩张给某节点 cost=2 时必然发生），谁是权威无定义。设计必须明确 research 读 `tech.cost` 且删除字面量 1，否则是新造的双源。
3. 【战斗修正的落点存在双系统歧义，且注入锚点不成立】设计 §5.3 说把 `snapshot.combat` 作为「战前一次性乘子注入队伍强度（FormationStrengthService / 战斗初始化时把 combat.attack 折进单位属性）」。但代码里有**两套不共享数值的战斗**：(a) 世界结算是纯兵力数（WorldCombatEncounterService 用 `attacker.soldiers` vs `defender.soldiers`，无 atk/def 概念）；(b) 战术 bitecs（battleSimCore.js:92-94 读 per-unit `stats.hp/atk/def`）。设计说的「队伍强度」在世界结算里不存在（那里只有 soldier 计数，没有强度标量可乘），在 battleSimCore 里则是 per-unit 属性。设计没指明 combat 修正注入哪一套、如何映射，等于把「一个势力的战斗加成」这个事实悬空——两套战斗都可能各自解读一遍 snapshot.combat，正是设计自己 §4.2 禁止的「在别处二次判断」。
4. 【`knowledgeOutputMultiplier` 一字段两语义来源，techRateBonus 复用制造隐性耦合】设计 §3.1 让 `techRateBonus` 复用 `effects.knowledgeOutputMultiplier`（「复用」或「独立 techRateMultiplier」二选一未定）。但该字段今天已由建筑（BuildingEffectCalculator.js:42-46 学院）写入，且 ResourceTickCalculator.js:57 用它算「知识产出」而非「科研/研究速率」。若 techRateBonus 折进同一字段，则「知识产出加成」和「科研速率加成」两个语义上不同的事实被塞进同一个权威副本，任何想区分二者的逻辑（如科技点获取 vs 资源产出）都无法从单一字段还原来源。这是把两个事实压成一个副本的反向 SSOT 问题，设计把它列为开放选项而非定论，等于把双语义风险留给实现者。

### 缺口 / 待补机制
1. 【grantEarnedEraPoints 的挂钩点描述与代码不符】设计 §7 与 §5.2 称「grantEarnedEraPoints 已在时代推进时发点（AdvanceEraAction）」。实际 AdvanceEraAction.js:73 调的是 `grantEraPoints(gameState, config.nextEra)`（单代补发），不是 `grantEarnedEraPoints`（后者是 1..currentEra 的补齐扫描，见 TechTreeService.js:71-78，用途是补历史欠发）。设计据此推导「per-faction 后 AI 升代同样经此发点」，但它指错了函数。per-faction 化时到底切哪个入口、AI 势力的 grants 幂等键（现按 `grants[era]` 防重）在多势力共存时是否会串——未定义。
2. 【§10 交接锚点把 FormationStrengthService 的真实路径写丢】设计 §5.3/§10 引用 `FormationStrengthService` 作为战斗修正注入锚点，但真实文件在 `backend/services/military/FormationStrengthService.js`，且其职责纯为兵力配置/征兵成本/快照归一化（buildFormationSnapshot、scaleResourceCost 等），**根本没有「队伍强度/战力标量」概念**，没有可乘的 attack/defense 属性面。设计把它当作「折进单位属性」的落点，是对该文件能力的误判——注入 combat 修正需要新建战力计算层或改 battleSimCore 的 team 构建，工作量与风险被设计完全遮蔽。
3. 【unlockUnit 是纯新增机制，无既有消费面，设计假装是「泛化」】设计 §3.1/§4.2 说 unlockedUnits「喂 MilitaryService 可募列表」。但全仓 grep 无 `recruitable/unlockedUnits/availableUnits` 任何招募门控——MilitaryService 目前不按兵种解锁筛选可募单位。这不是「把散落逻辑收敛到 resolver」，而是要**从零建**一条兵种解锁→可募门控链路（含前端 UnitSpriteManifest 消费、招募校验、存档兼容）。设计把它与 unlockBuilding（确有既存 BuildingUnlockService 消费面）并列称为泛化，掩盖了它是全新机制、无等价基线可锁的事实——T3 的「读证等价」纪律对它不适用。
4. 【AI 势力事实源 `ai_faction_state` 尚不存在，per-faction 是纸面依赖】设计 §2.2/§4.3 把 AI 势力 techs 落在 `ai_faction_state` 行，但该表/该脊柱 A 落地状态未验证（设计自己标注「脊柱 A 定」「AI 势力落地时」）。§4.3 的垫片方案（faction 视图 = gameState 本体）能让玩家路径先切签名，但「per-faction keyed by factionId」这个核心不变量在 AI 侧完全悬空——normalizeTechState 的 grants 幂等、eraChoices 重建、points 归一全是按单 gameState 写的，多 faction 并存时的实例化/隔离/持久化位置一个都没设计。这使 §1 三不变量之③在可预见的迁移期内不可验证。
5. 【resourceEntrances 迁移丢数据/丢展示未闭环】设计 §7 slice 1 说 `resourceEntrances` 「暂映射为空效果（纯文案保留在 DTO）」。但现状是 38 节点里**大量节点唯一的 effects 就是 resourceEntrances**（如 era1 全部 5 节点只有 resourceEntrances），且前端 TechPresenter.js 实际消费它渲染。若 T1 把它映射成空效果，这些节点在新 resolver 下产出**零 effect**，DTO 侧还要靠旁路保留文案——「一个节点的展示事实」被劈成 typed-effects(空) + 旁挂 resourceEntrances 两条路。设计没说这些「纯入口文案」节点在 Civ 化终态是获得真数值效果、还是永久保留为无效果装饰；若后者，getTechStatus/画布如何区分「有效果节点」与「纯文案节点」未定义。
6. 【DAG 校验是新造能力，但设计未处理迁移期 config 与表的双权威窗口】设计 §5.1/§6.1 要求导表期做拓扑排序/环检测/悬挂父/跨代父校验，并承认 build-config-tables 现无 per-table validate 钩子（需新建通用机制）。但迁移期（T1-T4）节点仍在 `TechTreeConfig.js`，此时 DAG 校验**无处运行**（表还没迁，钩子挂在导表管线上）。也就是说内容扩张 T3（在 config 里加跨路线前置、加深科技网、最容易打错造环）恰好发生在校验门禁尚未生效的窗口。设计把 DAG 校验放在 T5，却把最容易造环的 T3 放在它前面——顺序性缺口。
7. 【effects `op:'mul'` 的叠加语义在跨来源（建筑+科技）混算时未定义边界】设计 §3.1 规定 mul 是「加进从 1 起算的乘数」并与建筑加成同栈（`+= value`）。但多个科技 + 多个建筑同时给 foodOutputMultiplier 时，最终是 `1 + Σbonus` 的线性叠加（当前 BuildingEffectCalculator 语义），不是连乘。设计在表格里既写 op=`mul`（暗示乘法）又要求语义等价于 `+=`（实为加法叠加到乘数基），术语与实现语义冲突；策划按「mul=乘 1.2」填两个节点期望得到 1.44，实际得到 1.4。这个歧义会静默产出错误数值且不报错（fail-closed 只兜 NaN，不兜语义）。
8. 【client DTO 泛化后 buildClientTech 的等价基线断裂未评估】设计 §8 要 buildClientTech（TechTreeService.js:124）从投影 resourceEntrances/unlockedBuildings 文案，改为渲染 typed-effects 列表 + describeEffect i18n。但 T1 声称「零行为变化 / 读证等价」。DTO 形状变了（新增 effects 数组、去/留 resourceText/unlockText 未定），前端 TechPresenter.js 与其快照测试（TechPresenter.test.js 存在）必然要改——这属于行为变化，不能靠特征测试「锁定不变」。设计把 DTO 泛化放 T6 但把 resolver 接入放 T1，中间 T1-T5 的 DTO 到底保持旧形状还是新形状、前端何时切，缺一个明确的兼容契约。

## 待你确认的设计问题
1. Q1 时代选择模型：现行是每时代『选 N 选 1』（TECH_CHOICE_LIMITS，本质是抉择/天赋），Civ 科技网是『时代内可全解锁、靠科技点节流』。要保留『选 1』的分化感，还是改成可全解锁的科技网（更 Civ、但削弱路线抉择）？这决定 eraChoices 是否保留。
2. Q2 科技点来源：现在科技点只按时代推进整包发放（TECH_POINT_GRANTS，era5=3 点）。Civ 更像『知识资源随时间累积→兑换研究』。是否把科技点改为由 knowledge 产出/学院持续产生（更活、更受 techRateBonus 影响），还是维持整包发点？影响 AI 研究节奏。
3. Q3 战斗修正注入点：combatModifier 我方案是『战前一次性折进队伍强度』（不进 bitecs tick 热循环，避免 NaN）。可接受吗？还是希望某些 combat 效果（如围城）在实时战斗 tick 内动态生效？后者需改 battleSimCore 且要强校验。
4. Q4 节点文案/布局是否入表：数值/结构/效果入 tech_nodes 表无疑问，但 30+ 节点的中文 name/summary/core 和手工 column/lane 布局，是留在代码（我倾向，避免 Excel 塞长中文 + 布局是纯前端排版）还是也入表由策划改？内容扩张后是否要自动布局？
5. Q5 AI 势力科技的对玩家可见度：玩家应看到敌对/中立 AI 势力的完整已研科技，还是只经外交/侦察情报看到粗粒度（『已入古典时代』『偏军事路线』）？我倾向粗粒度投影（防信息过载/作弊感），需确认。
6. Q6 现有 resourceEntrances：38 节点现有的 resourceEntrances 只是文案（无数值）。内容扩张时是把它们真正数值化成 resourceOutput 效果，还是保留为纯说明、另加独立的加成节点？这影响老存档已研节点的『追加生效』语义（已研旧节点是否突然获得新数值加成）。
