# 03 人物关系网 + 迭代 + 好友来投

> 由设计 workflow 深化（已过单一事实源对抗审查）。审查结论：NEEDS_REVISION——文末「审查发现」是 codex 落地前要修正/补齐的点。

> 目标文档：`docs/design/03-relationship-network.md`（系统 03，脊柱 B 之上的关系层）。本文与 `00-vision-and-spine.md` 的脊柱契约一致：**边存在人身上、稀疏、按需创建；网络=所有 person.relationships 的并集；模拟只在共享世界 tick 跑一次**。依赖 `02-person-personality.md`（性格/相性字段，尚未写，字段名在此文钉死并交叉引用）。

## 1. 目标 + 三国志（RTK）参照

**目标**：给世界上所有人物（玩家花名册 + AI 势力武将 + 在野武将）一张**有向、稀疏、随时间真实迭代**的人际关系网，由**性格**驱动。它产出玩法事件（好友来投、背叛投敌、结拜义兄弟、结成宿敌），并为 ②b 捕获面板的**招降**提供加成读数（"被俘将领在你势力里有好友 → 更易招降"）。

**RTK 参照**：光荣三国志的**相性（相性）**隐藏值 + **义兄弟/夫婦/主従/宿敌**羁绊 + **登用**（受君主魅力/相性/关系影响的招募）。本作已具备六维（含 `charisma` 魅力）与 `quality`，缺的正是"人与人之间的有向关系 + 迭代"。本系统补齐它，且复用现有 `charisma`、`02` 的 `personality`/`compatibility`。

**非目标（划清边界）**：势力↔势力好感度属于 `04-diplomacy.md`（外交是势力级有向条目，与本文人物级边**同构但不同实体**，各存各的，互不复制）；性格与相性种子的**定义**属于 `02`，本文只**消费**。

---

## 2. 单一事实源数据模型（每个事实的唯一权威副本）

### 2.1 边存在人身上（唯一权威副本）

在人物对象上扩展一个字段 `relationships`（`normalizePerson` 里 normalize，落在 `backend/services/FamousPersonService.js` 的 `person` 构造块，紧随 `traits`/`status` 之后）：

```
person.relationships: [
  {
    toPersonId: string,        // 对端人物的世界注册表 id（见 §2.3）
    affinity: int -100..100,   // 有向好感度（A→B 与 B→A 各存各的，不强制对称）
    kind: string,              // 关系类型枚举（§3），派生自 affinity+history+性格，但缓存落盘
    meetCount: int,            // 相遇/共事/交战累计次数（驱动 相识→好友 晋级）
    firstMetAt: iso,           // 首次建边时间
    lastInteractAt: iso,       // 最近一次互动（驱动衰减，§4.4）
    flags: string[],           // 结构化事件标记：['sworn'|'betrayed'|'rival_declared'|'romance'|'lord_bond'...]
    history: [                 // 有界事件日志（最多 N=8 条，FIFO），仅记录里程碑
      { at: iso, type: string, delta: int, note?: string }
    ]
  }, ...
]
```

**铁律**：
- **无全局关系矩阵、无独立关系图副本**。整张网络 = `⋃ person.relationships`。任何"全局图"视图（UI 关系图谱、AI 查询"我势力里谁认识被俘将"）都是**按需查询/投影**，不落盘第二份。
- **边有向**：A 对 B 的 affinity 存在 A 的 `relationships[toPersonId=B]`；B 对 A 的存在 B 上。互惠（§4.5）是**迭代规则**让两条边趋同，不是"存一条无向边"。这允许"单相思/单方面宿敌"这种 RTK 味道。
- **稀疏 + 有界**：只有**相遇过**的两人之间才有边（不是 N²）。每人边数上限 `MAX_EDGES_PER_PERSON=64`（配置）；超限时**淘汰**最弱边（`kind='陌生/相识'` 且 `|affinity|` 最小且 `lastInteractAt` 最旧的一条），保证 per-person 有界、可扩展。义兄弟/宿敌/主従等 `flags` 非空的边**永不淘汰**。

### 2.2 派生数据（一律查询，不落第二份）

| 需求 | 派生方式（不落盘） |
|---|---|
| "某人在势力 F 里的所有好友" | 遍历该人 `relationships`，filter `kind∈好友/义兄弟/恋慕` 且对端 `factionId===F` |
| "两人是否互为义兄弟" | A.rel(B).flags 含 `sworn` **且** B.rel(A).flags 含 `sworn`（双向确认才成立） |
| 关系图谱 UI | 投影：以查询人为中心 BFS 一跳，读边，前端渲染 |
| ②b 招降加成 | 见 §6，实时查询被俘者对"我方在场武将"的边 |

### 2.3 人物 id 与世界人物注册表（依赖脊柱 B）

`toPersonId` 引用的是**世界人物注册表**里的稳定 id。当前 id 形态是 `fp_...`（`FamousPersonGenerator.js:198`）、候选是 `fpc_...`。世界注册表（由 `02`/脊柱建）应给每个世界人物一个**跨势力稳定 id** `wp_<seed>`（在野、AI 武将、玩家武将同构）。

> **过渡期约定（本文假设）**：在世界人物注册表落地前，切片 A（§7）先在**单玩家 gameState.famousPeople 内部**跑关系（`toPersonId` 用现有 `fp_` id），验证纯规则核 + 迭代 + 招降读数；切片 C 起把 `toPersonId` 切到世界注册表 `wp_` id。**边字段结构不变**，只换 id 空间——这是保证"改一处"的关键。

### 2.4 与 `02` 性格/相性的接口（消费，不定义）

本文假设 `02` 在人物上提供：
- `person.personality`: 枚举（提案值见 §3.4，最终以 `02` 为准）：`义侠 / 刚直 / 冷徹 / 野心 / 温厚 / 风流 / 忠义 / 狡诈 / 怯懦 / 豪放`。
- `person.compatibility`: `int 0..255` 隐藏相性种子（RTK 相性圈）。两人相性距离 `compatDist(A,B)=min(|a-b|, 256-|a-b|)`（环形，0=最投缘，128=最相克）。

若 `02` 未就绪，本系统 fail-safe：`personality` 缺失按 `温厚`、`compatibility` 缺失按 `hash(personId)%256`，规则核不崩（切片 A 单测覆盖此回退）。

---

## 3. 关系类型（kind）与晋级/降级规则（纯规则核）

### 3.1 kind 枚举（有序等级 + 特殊态）

普通轴（由 affinity 阈值驱动，随好感升降自动流动）：

| kind | 中文 | affinity 进入阈值 | 含义 |
|---|---|---|---|
| `stranger` | 陌生 | 默认（无边即陌生） | 未相遇 |
| `acquaintance` | 相识 | 建边即此（affinity 起始 0±） | 见过面 |
| `friend` | 好友 | affinity ≥ 40 且 meetCount ≥ 3 | 友善 |
| `enemy` | 政敌 | affinity ≤ -40 | 敌对但未死仇 |

特殊态（由**事件**打上 `flags`，不随普通 affinity 漂移自动解除；`kind` 覆盖普通轴）：

| kind | 中文 | 形成条件 | flag |
|---|---|---|---|
| `sworn` | 义兄弟 | 双向 affinity ≥ 80 + 相性距离 ≤ 32 + 结拜事件触发（§5.3） | `sworn` |
| `romance` | 恋慕 | 双向 affinity ≥ 75 + 性别/取向可配 + 相性距离 ≤ 24 | `romance` |
| `lord_bond` | 主従 | 同势力 + 对君主 affinity ≥ 70 + loyalty 高（§6 招降后可生成） | `lord_bond` |
| `nemesis` | 宿敌 | 双向 affinity ≤ -80 + 战场对阵/杀友触发（§5.4） | `rival_declared` |

**kind 解析函数（纯）** `resolveKind(edgeA, edgeB?)`：优先看 `flags` 特殊态（sworn/romance/nemesis/lord_bond），否则按 affinity 阈值落普通轴。特殊态解除需**专门降级事件**（如义兄弟因背叛→`nemesis`，见 §5.5），不因 affinity 抖动自动掉。

### 3.2 晋级/降级由性格调制阈值

阈值不是死数，性格给 ±修正（配置表 `relationship_kind_thresholds` × 性格系数 `personality_affinity_mods`）：
- `义侠/忠义`：友好阈值 -10（更易交友、更易结拜）。
- `刚直/野心`：宿敌阈值 +10（更易结仇，`|阈值|` 更小即更快到 nemesis）。
- `温厚`：所有阈值向"中性"收（不易极端）。

### 3.3 affinity → kind 的迟滞（防抖）

晋级/降级用**迟滞带**避免边界抖动：进入 `friend` 需 ≥40，跌回 `acquaintance` 需 <30（回差 10）。同理 enemy 进 ≤-40 / 出 >-30。回差常量 `KIND_HYSTERESIS=10`（配置）。

### 3.4 性格枚举（提案，最终归 `02`）

`义侠 刚直 冷徹 野心 温厚 风流 忠义 狡诈 怯懦 豪放` — 每个性格在配置表里给一组行为系数（相遇率倍率、affinity 漂移倍率、结拜倾向、背叛倾向、阈值修正）。见 §4.2 与配置表 §5。

---

## 4. 迭代规则（世界 tick / 事件驱动，纯规则核 + 服务层）

核心循环两类触发：**(a) 相遇建边/加权**（谁遇见谁）、**(b) affinity 漂移**（已有边随性格/势力/事件变化）。全部有界、可确定性重放（用世界 tick 的 seeded RNG，与 `FamousPersonGenerator` 同风格）。

### 4.1 谁遇见谁（meet 选择，性格驱动，稀疏）

每个共享世界 tick，对**每个势力**跑一次"社交撮合"（不是每人 O(N)，而是每势力抽样 `MEET_PAIRS_PER_TICK` 对，默认 3，配置）：

**相遇候选池**（决定"共处"= 有机会相遇）：
1. **同势力共事**：同一 `factionId` 的人（同城权重更高）——主要来源。
2. **战场交手**：本 tick 结算的战斗里，双方在场武将两两配对（跨势力建边的主要来源，喂宿敌/惺惺相惜）。
3. **在野游历**：`factionId==='ronin'` 的在野武将，按 `风流`/`豪放` 性格加权，随机遇到附近势力的人（喂"在野结识→将来来投"）。

**抽样权重** `meetWeight(A,B) = base × personalityMeetMult(A) × personalityMeetMult(B) × coLocationFactor`：
- `personalityMeetMult`：`风流=2.0, 豪放=1.5, 温厚=1.0, 冷徹=0.6, 怯懦=0.5`（配置 `personality_meet_mult`）。
- `coLocationFactor`：同城 1.0、同势力异城 0.5、跨势力战场 0.8、在野邻近 0.3。
- 已存在边者也可再被抽中（累加 `meetCount`、推进晋级），但**权重 ×0.5** 以偏向拓展新边。

**建边**：抽中的 (A,B) 若无边则各建一条 `acquaintance`（affinity 初值由相性决定，见 4.3），`meetCount=1`；有边则 `meetCount++` 并走 4.3 漂移。

**有界保证**：每 tick 每势力 ≤ `MEET_PAIRS_PER_TICK` 对 → 全局每 tick 建边数 = 势力数 × 常量，与人口无关，线性可控。

### 4.2 affinity 漂移公式（纯函数 `driftAffinity`）

单次相遇/共事的漂移量：

```
delta = BASE_DRIFT
      × compatFactor(A,B)          // 相性：投缘为正、相克为负
      × personalityDriftMult(A)    // A 的性格放大/缩小
      + factionFactor(A,B)         // 同势力+、敌对势力−
      + eventBias                  // 由触发事件带入（战场杀敌−、并肩作战+）
affinity' = clamp(affinity + round(delta), -100, 100)
```

- `compatFactor(A,B)`：由相性距离映射，`d≤32 → +1.0`，`d=128 → -1.0`，线性插值：`compatFactor = 1 - d/64`（d 环形距离 0..128；配置分段表 `compat_affinity_curve`）。
- `BASE_DRIFT`：默认 `6`（配置）。
- `personalityDriftMult`：`义侠/义气=1.3（爱憎分明）, 温厚=0.8, 冷徹=0.6`。
- `factionFactor`：同势力 `+2`，敌对势力（外交为宣战/仇视，读 `04` 投影）`-3`，中立 `0`。
- `eventBias`：见 §5 各事件。

每次漂移写入 `edge.history`（仅当 `|delta|≥MILESTONE_DELTA=8` 或跨越 kind 阈值时记，避免日志爆炸），更新 `lastInteractAt`，重算 `kind=resolveKind(...)`。

### 4.3 建边初值（相性定第一印象）

新边 affinity 初值 `initialAffinity = round(INIT_BASE + compatFactor(A,B) × INIT_SCALE)`，`INIT_BASE=0, INIT_SCALE=25`（配置）。即相性极佳的两人一见如故（+25 起步），相克的一见生厌（-25）。

### 4.4 衰减（realistic constraint：疏于往来则淡）

每 `DECAY_TICK_INTERVAL`（默认每 12 tick ≈ 1 分钟，配置）对**未在本窗口互动**的边施加向 0 的衰减：`affinity *= DECAY_RATE(0.98)`，`|affinity|<2 → 归 0`。归 0 且 `kind∈{acquaintance}` 且 `meetCount` 长期不增 → 该边成为淘汰候选（§2.1）。**特殊态边（flags 非空）不衰减**（义兄弟不会因不见面就淡）。

### 4.5 互惠（reciprocity，让有向趋对称但不强制）

漂移后按 `RECIPROCITY_RATE=0.3` 把 A→B 的变化**部分**传导到 B→A：`B.rel(A).affinity += round(delta × 0.3)`。这让关系趋向对称，但保留"A 热情 B 冷淡"的不对称空间。若 B 无 A 的边则不创建（避免密度膨胀）——只在双方都已建边时互惠。

### 4.6 有界速率与确定性

- 每 tick 每势力 meet 对数上限（4.1）+ 每边每 tick 至多漂移一次 → 单 tick 计算 O(势力数 × MEET_PAIRS)，**与总人口解耦**。
- RNG 用 tick 级 seeded source（`seed = hash(worldSeed, tickIndex, factionId)`），关系演化**确定性可重放**（对齐仓库既有确定性生成风格，便于单测与 playtest）。

---

## 5. 触发的事件（EventService + 世界 tick 挂钩）

关系网的价值在**产出玩法事件**。事件在共享世界 tick 里检测条件，产出：给玩家的走 `EventService`（进玩家事件队列，`backend/services/EventService.js` 的 regular/threat 队列旁新增一类 `relationEvents`）；纯 AI↔AI 的直接改世界状态（不打扰玩家 UI）。

### 5.1 好友来投（friend-joins-your-faction）
**条件**：在野武将 R（`factionId==='ronin'`）对**玩家势力某在职武将** M 的边 `affinity≥60` 且 `kind∈friend/sworn`，且 R 未在登用冷却。
**产出**：给玩家一个 regular 事件 `relation.friendJoins`（选项：接纳/婉拒）。接纳 → R 的 `factionId` 改为玩家、进 `famousPeople`，与 M 生成 `lord_bond` 潜在种子。**这是登用系统的关系驱动入口**，与 §6 招降同源。
**RTK 味**："因为你麾下有他的好友，他慕名来投。"

### 5.2 背叛/投敌（defect to a friend elsewhere）
**条件**：某在职武将 M 对**敌对势力**某武将 X 的边 `kind∈friend/sworn/romance` 且 `affinity≥70`，**同时** M 对本势力君主 loyalty < `DEFECT_LOYALTY_FLOOR(30)`，性格 `野心/狡诈` 概率加成。
**产出**：AI 武将 → 直接倒戈（改 `factionId`，带走可配比例兵力）；玩家武将 → threat 事件 `relation.defectRisk`（预警 + 可用政治/魅力/赏赐挽留，接 loyalty 系统）。
**约束**：忠义/义侠性格几乎不背叛（概率 ×0.1）。

### 5.3 义兄弟结拜（sworn brotherhood）
**条件**：双向 affinity≥80 + 相性距离≤32 + 至少一方性格 `义侠/豪放/忠义`。
**产出**：结拜事件（玩家可参与仪式/AI 自动）。双方边打 `flags+=['sworn']`、`kind=sworn`。**羁绊加成**（喂战斗/招降）：义兄弟同队作战给士气/属性小加成（数值归 `battle_rules`/`04` 协商，本文只标记 flag 供消费）；一方被俘时另一方招降倾向拉满（§6）。

### 5.4 宿敌形成（nemesis）
**条件**：双向 affinity≤-80，且发生**杀友/阵斩/夺城**里程碑事件之一（`edge.history` 里出现 `killed_ally`/`slain_in_battle`/`city_lost_to`）。
**产出**：`flags+=['rival_declared']`、`kind=nemesis`。宿敌相遇战斗时双方 `eventBias` 额外负向、士气修正（消费方 `battle_rules`）。宿敌**不衰减、不自动和解**，只能由特殊和解事件解除。

### 5.5 特殊降级（背叛导致义兄弟反目）
义兄弟中一方背叛/夺城 → 触发 `sworn→nemesis` 强制转换：清 `sworn` flag、打 `betrayed`+`rival_declared`，affinity 直接砸到 -90。这是最戏剧化的三国志桥段（如吕布），显式建模。

### 5.6 事件挂钩位置
- 检测入口：新增纯模块 `RelationshipNetworkCore`（`shared/` 或 `backend/services/relationship/`），导出 `advanceRelationships(worldPeople, context, now, rng)` 返回 `{ edgeMutations, triggeredEvents }`。
- 服务层 `RelationshipService.applyTick(...)` 在 `GameStateNormalizer.advanceRuntimeState` 的**共享世界分支**（对应 `advanceWorldAi` 那一档，即只在世界 tick 而非每玩家 worker 里跑，参见 `WorldWorkerService.js:50` 传的 `advanceWorldAi:false`）里调用，把 `triggeredEvents` 里面向玩家的推给 `EventService`。
- **绝不每玩家重复跑**（对齐 vision §4.5）：关系迭代是共享世界模拟，一 tick 一次。

---

## 6. ②b 招降如何读关系网（登用加成）

当前 ②b 招降成功率的基线来自 `GarrisonPolicy.bandRecruitBaseRate(band)`（`backend/services/territory/GarrisonPolicy.js:54`）。本系统提供一个**加成计算器**（纯函数 `RelationshipRecruitModifier.compute`），在捕获结算读被俘者与"我方在场/本势力武将"的关系：

```
recruitChance = clamp01(
    baseRate                                   // GarrisonPolicy 基线
  + charismaTerm(captorLeader.charisma)        // 招降者魅力（已存在字段）
  + compatTerm(captive, captorLeader)          // 相性：compatFactor × W_COMPAT
  + relationTerm(captive, myFactionPeople)     // 关系网加成（本系统核心）
  + loyaltyPenalty(captive)                    // 对旧主 loyalty 越高越难招
)
```

`relationTerm` = 取被俘者对**我方所有在职武将**的边里最强正向者：
- 边 `kind=sworn`（义兄弟在我方）：`+0.40`
- `kind=friend` 且 affinity≥60：`+0.25`
- `kind=romance`：`+0.35`
- `kind=nemesis`（我方有他宿敌）：`-0.30`（更难招，甚至宁死）
- 多条取**最大正项 + 最大负项之和**（一个好友拉、一个宿敌拽），系数配置化 `recruit_relation_weights`。

招降成功后：被俘者 `factionId→我方`，与"牵线的那位好友"生成/强化边（`lord_bond` 种子 + affinity+），闭环喂回关系网。所有权重进配置表（§7-4），`GarrisonPolicy` 只出基线、加成由本模块叠加——**职责单一、不改 GarrisonPolicy**。

---

## 7. 配置表映射（Excel → 生成 JSON，走既有管线）

遵循 `docs/config-tables/README.md`：先在 `config/tables/table-schemas.js` 写字段契约+种子，`npm run config:tables:scaffold` 生成 xlsx，导表提交，`architecture-smoke` 新鲜度门禁保新鲜。全部为 P2（依赖脊柱 B）。

| 表名 | 形态 | 主键 | 关键字段 | 作用 |
|---|---|---|---|---|
| `relationship_kind_thresholds` | 行表 | `kind` | `enterAffinity, exitAffinity, minMeetCount, requiresCompatMaxDist` | kind 晋级/降级阈值 + 迟滞 |
| `personality_affinity_mods` | 行表 | `personality` | `meetMult, driftMult, swornBias, betrayBias, friendThresholdMod, nemesisThresholdMod` | 每性格行为系数（消费 `02` 的枚举） |
| `compat_affinity_curve` | 行表 | `maxDist` | `compatFactor` | 相性距离→漂移/初值系数分段 |
| `relationship_iteration` | key-value | — | `BASE_DRIFT, INIT_BASE, INIT_SCALE, MEET_PAIRS_PER_TICK, MAX_EDGES_PER_PERSON, DECAY_TICK_INTERVAL, DECAY_RATE, RECIPROCITY_RATE, KIND_HYSTERESIS, MILESTONE_DELTA, MAX_HISTORY` | 迭代常量单源 |
| `relationship_events` | 行表 | `eventId` | `type, minAffinity, loyaltyFloor, cooldownMs, personalityGate, queue(regular/threat)` | 好友来投/背叛/结拜/宿敌 触发参数 |
| `recruit_relation_weights` | key-value | — | `W_COMPAT, W_SWORN, W_FRIEND, W_ROMANCE, W_NEMESIS, W_CHARISMA, W_LOYALTY` | ②b 招降加成权重 |

**校验**（`table-schemas.js` 的 validate 钩子）：`personality` 主键必须 ⊆ `02` 性格枚举；`kind` 主键 ⊆ §3.1 枚举；`enterAffinity>exitAffinity`（迟滞正确）；概率类 ∈[0,1]。

---

## 8. 世界 tick / 事件挂钩（落点）

1. **纯核** `RelationshipNetworkCore`（新建 `backend/services/relationship/RelationshipNetworkCore.js`，pure，无 IO）：`advanceRelationships(people, ctx, now, rng)`、`driftAffinity`、`resolveKind`、`selectMeetPairs`、`applyDecay`。全部单测覆盖，确定性可重放。
2. **服务层** `RelationshipService`：normalize（`normalizeRelationships` 挂进 `normalizePerson`）、`applyTick`、`computeRecruitModifier`、把玩家向事件塞进 `EventService`。
3. **世界 tick 挂钩**：在 `GameStateNormalizer.advanceRuntimeState`（`backend/services/GameStateNormalizer.js:155`）的共享世界档（当前由 `options.advanceWorldAi` 表征、只在世界 tick 而非 `WorldWorkerService` 每玩家路径开启）调用 `RelationshipService.applyTick(sharedWorldPeople, now)`。**每 tick 一次，全局共享。**
4. **②b 挂钩**：捕获结算处（TerritoryCombatTargets/占城结算读 `GarrisonPolicy.bandRecruitBaseRate` 的调用点）叠加 `RelationshipService.computeRecruitModifier(...)`。
5. **normalize 幂等**：`normalizeRelationships` 去重（同 `toPersonId` 取一条）、裁剪到 `MAX_EDGES_PER_PERSON`、裁 history 到 `MAX_HISTORY`、修复越界 affinity——存档自愈两层，对齐仓库既有 normalize 风格。

---

## 9. 客户端 / UI 表面

1. **人物详情页新增「人际」页签**：投影该人一跳边（好友/义兄弟/宿敌/恋慕分组），头像+关系类型 icon+affinity 条。数据经 `getClientProjectionForPlayer` 投影（**投影字段存盘前 strip**，对齐共享世界隔离约定）。
2. **关系事件卡**：好友来投/背叛预警/结拜复用现有 EventService 事件 UI（`relationEvents` 走同一渲染）。
3. **②b 招降面板**：显示"关系加成 +25%（麾下好友 XX）/ -30%（宿敌 XX 在你军中）"分解，让玩家看懂为何这将好招。
4. **i18n**：全部文案走 `t()` 双语成对（对齐 i18n 门禁）；kind/personality label 注册 key，不烘焙进存档（存 kind 枚举值，显示时 t()）。

---

## 10. 实施切片（有序、每片可测）

- **切片 A — 纯规则核 + 单玩家内跑**：`RelationshipNetworkCore`（drift/resolveKind/selectMeetPairs/decay）+ `normalizeRelationships` 挂 `normalizePerson`；`toPersonId` 暂用现有 `fp_` id、在 `gameState.famousPeople` 内部撮合。配置表 `relationship_iteration/kind_thresholds/compat_curve/personality_mods` 落地。**单测**：确定性重放、有界（边数上限）、迟滞防抖、相性初值、衰减、淘汰。无 UI、无世界注册表依赖。
- **切片 B — ②b 招降读数**：`RelationshipRecruitModifier` + 配置 `recruit_relation_weights`，接捕获结算；招降面板加成分解 UI。**单测**：好友+/宿敌−/相性/魅力/忠诚各项。（此片即可让关系网产生**可玩价值**，即使世界注册表未就绪。）
- **切片 C — 世界注册表接入**：`toPersonId` 切到脊柱 B 的 `wp_` 世界 id；关系迭代移到共享世界 tick（`advanceRuntimeState` 共享档），在野武将参与撮合。**依赖 `01`/`02`/脊柱人物注册表。**
- **切片 D — 关系事件**：`relationship_events` 表 + 好友来投/背叛/结拜/宿敌 事件，接 `EventService`。**单测**：各事件触发条件、冷却、性格门。
- **切片 E — 人际 UI + i18n**：详情页人际页签 + 投影 + 双语 key + 覆盖率门禁。
- **切片 F — AI↔AI 演化**：AI 势力武将间关系纯自动演化（不打扰玩家），喂 `05` AI 决策（背叛/结盟倾向）。

每片：pure 核先测 → 服务接线 → 对抗性 review → 双部署（design + refactor 分支）→ playtest 终验。

---

## 11. 可扩展性论证（sparse + bounded）

- **存储**：per-person `MAX_EDGES_PER_PERSON=64`，义兄弟等特殊边永不淘汰但数量天然极少 → 每人边数 O(常数)，全网 O(人口) 而非 O(人口²)。
- **计算**：每 tick 撮合 = 势力数 × `MEET_PAIRS_PER_TICK`，与总人口解耦；衰减按 `DECAY_TICK_INTERVAL` 抽帧，非每 tick 全扫。
- **投影**：UI/AI 查询走一跳 BFS，不物化全局图。
- **确定性**：seeded RNG → 可重放、可测、可 playtest 复现。

---

## 审查发现（单一事实源 + 缺口，落地前修正）

### 单一事实源违规（须改为查询/投影，不得复制）
1. kind 字段既落盘又派生，是设计里最刺眼的复制。§2.1 把 `kind` 存进边（"派生自 affinity+history+性格，但缓存落盘"），而 §2.2/§3.1 又说 kind 由 `resolveKind(edgeA, edgeB?)` 从 affinity 阈值+flags 纯函数算出。这是把可派生事实缓存成第二副本——权威数值是 affinity+flags，kind 是投影。一旦阈值配置表(`relationship_kind_thresholds`)改动，落盘的 kind 立刻与规则脱钩，需要迁移重算全网边。铁律要求"派生一律查询不落第二份"，kind 违反了它自己。正确做法：kind 只在读取/投影时算，不进 person.relationships 落盘结构（或至少不作为权威，normalize 时无条件用 resolveKind 覆盖）。
2. "义兄弟/宿敌"这类特殊态同时存在于两条有向边的 flags 里，是无向事实的双副本。§2.2 明说"两人是否互为义兄弟 = A.rel(B).flags 含 sworn 且 B.rel(A).flags 含 sworn（双向确认才成立）"——即一个本质无向的羁绊事实被拆存在两条边上，靠"双向确认"约束两副本一致。§5.5 背叛降级要"清 sworn flag"必须同时改两条边，漏一条就产生"A 认为是义兄弟、B 不认为"的裂脑态，而系统又把这种不一致当"未成立"静默吞掉，掩盖数据损坏。这与 affinity 的有向性（A→B 与 B→A 各存合理）不同：结拜/宿敌是关系级里程碑事实，应有单一权威副本（如存在"关系事件账本"或规范化 pair-id 上），而非镜像 flag。
3. affinity 的有向双边 + 互惠规则(§4.5)构成"趋同的两副本"，与外交(§04)势力级好感度是"同构但各存各的"（§1 非目标明说）——这在**关系语义上**成立（单相思是特性），但设计没有给出"A→B 与 B→A 的 meetCount/firstMetAt/history"为何要各存一份的理由。meetCount（相遇次数）、firstMetAt（首次相遇）本质是**pair 级对称事实**，不是有向的——两人相遇一次，双方 meetCount 都++（§4.1 建边"各建一条…meetCount=1"）。把对称的 meetCount/firstMetAt 复制进两条有向边，就产生了"A 记得遇过 3 次、B 记得 2 次"的漂移可能（互惠只传导 affinity，不传导 meetCount）。对称事实应单源（pair 上），只有 affinity/kind/lastInteract 才真正需要有向双份。
4. 招降成功后"与牵线好友生成/强化 lord_bond 种子"(§5.1/§6 闭环)把"谁招降了谁"这条历史同时写进关系边 flags、被俘者 factionId、以及 lord_bond 边三处，未指明单一权威。lord_bond 的成立条件(§3.1)是"同势力 + 对君主 affinity≥70 + loyalty 高"——这三者全是可**派生**的（factionId 查势力、affinity 查边、loyalty 查 status），但 §3.1 又把 lord_bond 作为落盘 kind/flag。主従关系应是"同势力 且 affinity/loyalty 达标"的实时查询结果，不该固化成 flag，否则武将转会/loyalty 下跌后 lord_bond flag 变成陈腐副本。
5. 「某人在势力 F 里的所有好友」派生(§2.2)依赖"对端 factionId===F"，但对端 factionId 存在**对端人物对象**上，本人边里只存 toPersonId。这是正确的单源（好），但设计通篇假设能在关系迭代/招降计算时随手拿到"对端的 factionId/personality/compatibility/loyalty"——而这些都在另一个人物对象上，切片 A 在单玩家 gameState.famousPeople 内跑时尚可 O(N) 查，切片 C 切到 wp_ 世界注册表后，跨势力对端可能根本不在当前投影里（§4 vision：投影 strip 掉别人的 state）。设计没说明关系迭代在共享 tick 里如何拿到"不在任一玩家 gameState 内的在野/敌方武将"的权威人物对象——若为效率在边上冗余缓存对端 factionId/personality，就又造了副本。

### 缺口 / 待补机制
1. 招降/捕获**结算代码根本不存在**。§6/§8.4 把加成挂在"捕获结算读 GarrisonPolicy.bandRecruitBaseRate 的调用点"，但代码里 `recruitBaseRate`/`captureChance` 只在 `TerritoryCombatTargets.js:68-69` 作为**目标 DTO 字段**被surface，全仓没有任何地方 roll 它、没有捕获面板结算、没有"招降成功→改 factionId"的落点（grep 证实只有 GarrisonPolicy 定义 + TerritoryCombatTargets 读取两处）。切片 B 号称"即可让关系网产生可玩价值"，实则要先建整个捕获招降结算管线（这是 P0-1 空城守军任务 #39 仍 pending 的下游）。设计把一个未建系统当成"只需叠加加成"的既有钩子，严重低估切片 B。
2. **共享世界 tick 执行上下文不存在**。§5.6/§8.3 要求 RelationshipService.applyTick 在"advanceRuntimeState 的共享世界分支（advanceWorldAi 那一档）"里"每 tick 一次全局共享"跑。但实际 `WorldWorkerService.advanceState`(:47-66) 是**逐个活跃玩家**调 advanceRuntimeState 且**硬编码 advanceWorldAi:false**；`advanceWorldAi:true` 分支(GameStateNormalizer:162)只在别处、也仍是每玩家 state 内跑 WorldAiExplorer。没有"一个规范世界对象、一 tick 跑一次"的宿主。关系迭代要么错误地每玩家各跑一份（违反 vision §4.5 与本文自述），要么需要先建脊柱 A/B 的共享世界模拟宿主——这是切片 C 的真正前置，设计只把它当 id 空间切换。
3. **per-tick 确定性 seeded RNG 源不存在**。§4.6 声称"seed=hash(worldSeed, tickIndex, factionId)…对齐仓库既有确定性生成风格"。实测：仓库确定性 RNG 是 `ServerRandomAuthorityContract.createRandomSource` 按**候选生成种子**（`createCandidateSeed`）派生，是"生成一个人物"粒度，**没有世界 tick 粒度**的 seed 源，grep 无 worldSeed/tickIndex/seededRng 命中于世界模拟。可重放/可 playtest 复现的基础设施要新建，不是"对齐既有风格"。
4. **config 管线的 validate 钩子 + 跨表校验根本不存在**。§7 依赖"table-schemas.js 的 validate 钩子"做"personality 主键 ⊆ 02 枚举、enterAffinity>exitAffinity、概率∈[0,1]"。实测 `config/tables/table-schemas.js` 只有 `module.exports = { TABLES }`，**0 处 validate**，导表脚本(build-config-tables.js scaffold/build/check)也无跨表引用完整性校验能力。"personality 主键 ⊆ 02 枚举"是跨表外键约束，现管线不支持。这些校验器要先给配置系统加能力，不是填个钩子。
5. **fail-safe 回退破坏确定性且埋数值陷阱**。§2.4 说 compatibility 缺失按 `hash(personId)%256`。但 A 侧算 compatDist(A,B) 需要**两人**的 compatibility；若 A 有真值、B 走 hash 回退，得到的相性是半真半假的稳定噪声，会让切片 A 的单测"通过"却在 02 就绪后**行为漂移**（同一对人相性突变）→ 一批边的 affinity 初值/漂移方向翻转。回退"规则核不崩"≠"行为等价"，这正是 memory 里"需中途人验=红旗"该警惕的伪等价。
6. **淘汰规则(§2.1)与衰减(§4.4)存在竞态/饥饿边界未定**。淘汰"最弱边=kind∈陌生/相识 且 |affinity|最小 且 lastInteract 最旧"，但 §4.4 衰减把久不互动的边 affinity 归 0——于是**所有**老边都趋于 |affinity|=0，淘汰的"最小 affinity"判据退化成"只看最旧"，可能把一条正在缓慢升温、meetCount 快到 3 的准好友淘汰掉。且 MAX_EDGES_PER_PERSON=64 命中时若 64 条全是 flags 非空（永不淘汰）的特殊边，新边**无法建立**——设计没定义此溢出行为（丢弃？报错？扩容？）。
7. **meetCount 晋级阈值(friend 需 meetCount≥3)与稀疏抽样(§4.1 MEET_PAIRS_PER_TICK=3/势力)存在可达性问题**。全局每 tick 建/推进边数=势力数×3，与人口解耦（好），但反过来：一个 N=200 人的势力，任意特定两人被抽到 3 次以晋级 friend 的期望 tick 数 ~ O(N²/势力配额)，在人口稍大时"好友"几乎永不自然形成。设计用稀疏保住了性能，却没验算"晋级是否在合理时间内可达"——玩法事件(好友来投/结拜)的触发率可能趋近 0。缺一个"关系晋级期望时长"的数值论证。
8. **背叛(§5.2)/主従(§3.1)依赖 loyalty，但 vision 明说 status.loyalty 仅对玩家存在**（00-vision 表:34 "忠诚度 ✅仅对玩家"）。§5.2 DEFECT_LOYALTY_FLOOR、§6 loyaltyPenalty(captive)、lord_bond 的"loyalty 高"全需要 AI 势力武将/被俘者的 loyalty，而现模型这些人**没有 loyalty 字段**。设计未指出这是 02/脊柱必须补的前置，招降对"对旧主 loyalty 越高越难招"的核心机制在非玩家身上无数据源。
9. **史书 history 有界(N=8 FIFO)与 §5.4 宿敌形成条件冲突**。宿敌需"edge.history 里出现 killed_ally/slain_in_battle/city_lost_to"里程碑之一，但 history 是 8 条 FIFO——一条关键里程碑可能已被后续 8 条普通里程碑挤出，导致"曾杀友"的事实丢失、宿敌无法判定或判定漂移。里程碑事实(触发不可逆状态转换的)不该存在有界易失日志里，应升格为 flag/计数器。
10. **互惠(§4.5)顺序依赖 + 双向漂移在同 tick 撮合会双重计数**。§4.1 一个 tick 可能把 (A,B) 抽中，driftAffinity 改 A→B 再互惠改 B→A 0.3；但若同 tick 因战场配对又抽中 (B,A)，B→A 会被再算一次全量 drift + 反向互惠回 A→B，形成同 tick 双向叠加。设计只说"每边每 tick 至多漂移一次"(§4.6)却没说明 (A,B) 与 (B,A) 是否算"同一边"的两次——有向模型下它们是两条边，去重语义未定义。
11. **normalize 幂等去重(§8.5 "同 toPersonId 取一条")会静默吞掉合法数据**：正常一个人对同一 toPersonId 只该有一条边，出现两条即为损坏；"取一条"未定义取哪条（更高 affinity？更新 lastInteract？），随意取会丢失更"真"的那条。对齐仓库 normalize 风格没错，但缺"取哪条"的确定规则=不可重放。
12. **切片 A 在单玩家 gameState.famousPeople 内跑关系是伪切片**：玩家花名册只有己方在职武将（数人到数十人），彼此本就同势力、无在野、无敌对，§4.1 三类相遇候选池里"战场交手/在野游历"两类在切片 A 无数据，只剩"同势力共事"。这意味着切片 A 测不到跨势力建边、宿敌、好友来投的主路径，其"可玩价值"和测试覆盖被高估；它验证的只是 drift/decay/淘汰的算术，几乎所有玩法语义都推迟到依赖脊柱的切片 C。
13. EventService 结构被误描述：§5/§9.2 说"regular/threat 队列旁新增一类 relationEvents"，但实际是**单一 `gameState.eventQueue[]` 数组 + event.type 判别**(EventService.js:99-176 全按 event.type==='regular'/'threat' filter)，没有并列的独立队列对象。新增 relationEvents 若真建成第三个数组，就违反了现有"单队列多类型"的单源结构；正确做法是复用 eventQueue 加一个 type，设计的措辞会误导实现者建平行副本。

## 待你确认的设计问题
1. 性别/取向建模：`romance`（恋慕/夫婦）是否要引入性别字段与取向配置？还是先做无性别的抽象「羁绊」、把 romance 折进义兄弟同一条特殊态轴，二期再拆？这影响 person 是否新增 gender 字段（属 `02` 还是本文）。
2. 背叛带兵：AI 武将背叛投敌时「带走可配比例兵力」——兵力属于势力/编队，武将叛逃是否真的抽走守军？还是只带走「个人亲兵」一个小额固定值？（涉及与 `05` AI 势力兵力事实源的边界，避免双扣）
3. 招降加成上限：②b 招降在有义兄弟(+0.40)+高魅力+好相性时可能逼近 100%，是否要设硬上限（如 0.9）保留失败戏剧性？宿敌在军中(-0.30)是否可让某些将「宁死不降」（成功率封顶 0）？
4. 关系迭代节奏：撮合放在每个共享世界 tick(~5s)会不会太快（几分钟就全员熟人）？是否改为每 N tick 撮合一次、或按「社交能量」预算？MEET_PAIRS_PER_TICK 与 DECAY 的平衡点需要 playtest 手感校准，先给保守默认(3 对/12 tick 衰减)是否可接受？
5. 在野武将来源：`factionId==='ronin'` 的在野武将池由谁生成、多大规模？本文假设脊柱 B/`01` 会建在野池；若短期没有在野池，切片 C 的「好友来投」是否先只在「敌对势力武将→因关系倒戈来投」这一条上跑？
6. 特殊态解除：义兄弟/宿敌设计为「不因 affinity 抖动自动解除」，只有专门事件能转换。是否需要一个「和解」正向事件让宿敌能被化解（如三国的化敌为友），还是宿敌永久（更硬核）？
