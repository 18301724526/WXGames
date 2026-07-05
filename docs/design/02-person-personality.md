# 02 人物性格 + 相性（脊柱 B 扩展）

> 由设计 workflow 深化（已过单一事实源对抗审查）。审查结论：NEEDS_REVISION——文末「审查发现」是 codex 落地前要修正/补齐的点。

## 02 · 人物性格（性格）+ 相性（相性）+ 世界人物注册表

> 脊柱 B 的属性扩展与事实源升格。承接 `docs/design/00-vision-and-spine.md`。本文覆盖：性格模型（气性）、相性（隐藏兼容向量 + 投缘函数）、世界人物注册表（在野武将 + AI 势力武将 + 玩家花名册合一）。**关系网（羁绊/有向边）在 `03` 单独设计**——本文只做「性格/相性是人物身上的字段」，不引入 pairwise 存储。

---

### 1. 目标 + 三国志参照

**目标**：给每个人物一个**驱动行为的性格**和一个**决定两人是否投缘的相性**，并把所有人物（不只玩家花名册）收进**一个世界注册表**，使 ②b 捕获招降、好友来投、AI 登用、忠诚漂移都从**同一份人物事实**派生。

**RTK 参照**：
- 光荣三国志的**性格/気性**（冷静/勇猛/剛胆/慎重/温厚/野心…）驱动 AI 行为分支与事件触发率。本作采用**「主气性（archetype）+ 3 条连续性格轴（axes）」混合模型**（§2 论证）。
- **相性（相性）**：RTK 里是 0–255 的隐藏环形值，差值越小越投缘，影响登用成功率、义兄弟/婚姻、离反。本作用 **1 个环形标量 `affinitySeed`（0–359）+ 3 维性格轴**共同算投缘（§3）。
- **在野武将**：不隶属势力、可被登用。本作 = 注册表里 `factionId === null` 的人物（§4）。

---

### 2. 性格模型：主气性 + 性格轴（混合，含论证）

#### 2.1 为什么是「混合」而非纯 archetype 或纯 axes

- **纯枚举气性**（如 RTK 的十几种性格）易读、好配表、好写事件门槛，但组合性差——「勇猛且好游」需要为每个组合造新枚举，爆炸。
- **纯连续轴**组合性强、算投缘平滑，但**不可读**（策划面对一堆 0.6/0.3 无从下手）、无法直接挂「这种性格触发这个事件」。
- **混合**：用**一个主气性 `nature`（可读、驱动事件门槛、配表主键）**，其数值**由 3 条连续轴派生/对齐**（供相性与 AI 权重做平滑运算）。气性是「轴空间里的一个命名锚点」，既可读又可算。这与现有 `archetype`（职业原型）**正交且不重复**：archetype 决定**能力方向**（六维权重/技能对），nature 决定**行为倾向**（出游/结仇/守成）。

#### 2.2 三条性格轴（连续，−1.0 ~ +1.0，事实源）

存在人物身上的 `personality.axes`（单一权威副本，float，两位小数）：

| 轴 | 负极 (−1) | 正极 (+1) | 驱动的行为 |
|---|---|---|---|
| `boldness` 胆略 | 慎重（守成、少出击） | 勇猛（主动进攻、探索、易涉险） | AI 出兵/探索倾向；玩家侧影响事件涉险分支 |
| `sociability` 交游 | 孤高（少外出、少认识人） | 好游/风流（爱出游、社交广） | **认识新人的基础频率**（→ 好友来投，§6）；招降时的开放度 |
| `integrity` 义理 | 野心（重利、易叛、易被高官厚禄挖走） | 义理（重情义、忠诚稳、易结羁绊/宿敌） | 忠诚漂移速率、被登用抗性、羁绊/宿敌生成倾向（消费在 `03`） |

> 三轴取自 RTK 性格最载荷的三个语义主成分（勇怯、社交、义利），足以张成常见气性且互相近似正交。**不引入第四轴**，避免配表维度爆炸；若日后需要「智谋型性格」，用 archetype 六维已覆盖，不重复建轴。

#### 2.3 命名气性 `nature`（可读锚点，派生但持久化）

8 个命名气性，每个 = 轴空间中的一个**锚点向量 + 事件/行为 hook**。生成时先 roll 轴，再取**最近锚点**为 `nature`（可读标签 + 配表主键）；`nature` 与 `axes` **同存**（nature 是 axes 的量化命名，不是第二事实源——normalize 时若二者冲突以 axes 为准重算 nature，§7）。

| `natureId` | 标签 | 锚点 (boldness,sociability,integrity) | 招牌行为 hook |
|---|---|---|---|
| `valiant` | 勇猛 | (+0.8, +0.1, +0.2) | 出击/探索率↑；到达接战不撤退 |
| `cautious` | 冷静 | (−0.7, −0.2, +0.3) | 守成；撤退窗口更常用；错误决策率↓ |
| `dutiful` | 义理 | (+0.1, +0.0, +0.9) | 忠诚衰减↓；羁绊生成↑；抗登用 |
| `ambitious` | 野心 | (+0.5, +0.2, −0.8) | 易被厚禄挖；自立/背叛倾向；登用他人积极 |
| `romantic` | 风流 | (+0.2, +0.9, +0.1) | **出游/社交率↑↑ → 好友来投主触发**；婚姻/义兄弟倾向 |
| `stoic` | 温厚 | (−0.3, −0.4, +0.5) | 稳定、低事件、和事佬（缓和敌对相性冲突） |
| `reckless` | 剛胆 | (+0.9, +0.3, −0.3) | 高风险高回报；易结宿敌 |
| `sage` | 达观 | (−0.1, −0.6, +0.4) | 中庸；智谋事件；招降说客加成 |

> 锚点表 = 配置表 `personality_natures`（§5）。8 个足以覆盖玩法，且每个都有明确 hook；不做满 RTK 十几种，避免无 hook 的空气性。

#### 2.4 性格 vs 现有 `traits`：不重复

现有 `person.traits`（如 `['突击领队','英杰']`）在代码里是**装饰性字符串标签**（`FamousPersonService.normalizePerson` 只 `.map(String).slice(0,4)`，无行为语义）。**保留 traits 为纯装饰**，性格是**新增的、有行为语义的独立字段** `personality`。二者不合并（traits 是 UI 徽章，personality 驱动逻辑），也不让 personality 去污染 traits。

---

### 3. 相性（相性）：隐藏值 + 投缘函数

#### 3.1 事实源：人物身上的 `affinitySeed`（环形标量）

- `person.affinitySeed`：整数 **0–359**（环形，像 RTK 的相性值），确定性生成（seed 派生，§7）。**单一权威副本，存在人物身上**，不另建全局相性矩阵。
- 语义：把「谁和谁天然投缘」压缩成一维环。两人 seed 的**环形距离**越小越投缘。为什么够用：一维环 + 性格轴叠加已能产生足够丰富的两两差异，且**O(1) 存储**（每人一个数，pairwise 投缘是**查询派生**，永不落库）。

#### 3.2 投缘函数 `computeRapport(a, b) → 0..100`（纯函数）

派生值，**从不存储**，随查随算（放 `shared/person/personalityCore.js`）：

```
ringDist(a, b)      = min(|a.affinitySeed − b.affinitySeed|, 360 − |…|)   // 0..180
affinityScore       = 1 − ringDist / 180                                  // 1=同点,0=正对
axisAlignment       = 1 − ( Σ_axis |a.axes[k] − b.axes[k]| / 2 ) / 3      // 1=三轴全同,0=全反
                     // 每轴差 ∈[0,2]，除2归一，三轴平均
rapport01           = W_AFFINITY * affinityScore + W_AXIS * axisAlignment // 见配表权重
rapport             = round( clamp(rapport01,0,1) * 100 )                 // 0..100
```

默认权重（配表 `compatibility_params`，§5）：`W_AFFINITY = 0.6`、`W_AXIS = 0.4`。

**义理修正（可选，默认开）**：`integrity` 高的人对「投缘门槛」更宽容（重情不重利），对 rapport 加一个小 bonus `+ INTEGRITY_RAPPORT_BONUS * max(0, a.axes.integrity)`（默认 `0.05`，钳回 0–1 前）。这让「义理型更容易和人结善缘」，呼应 RTK。

#### 3.3 rapport 的三个消费口（都在 §5 配表化，公式对齐）

1. **招降成功率**（②b 捕获面板「招降」，接 `garrison.recruitBaseRate`）：
   ```
   recruitRate = clamp01(
     garrison.recruitBaseRate
     + K_RAPPORT   * (rapport(说客, 目标) − 50)/50        // 投缘正负偏移
     + K_CHARISMA  * (说客.attributes.charisma − 60)/40    // 魅力加成
     + K_INTEGRITY * (−目标.axes.integrity)                // 义理者难招（野心者好招）
   )
   ```
   说客 = 发起招降的玩家/势力**魅力最高的在场武将**（或君主）。`K_*` 全在配表。**羁绊加成留给 `03`**（`03` 会往这个式子再加一项 `bondBonus`，本文只留公式插槽 `+ bondBonus(默认0)`）。
2. **忠诚漂移**（`status.loyalty`，玩家侧）：世界 tick 里，武将忠诚向一个**目标忠诚**缓慢漂移，目标由 `integrity`（高→稳在高位）与「和君主的 rapport」共同决定（§6）。
3. **羁绊/宿敌生成倾向**（`03` 消费）：rapport 极高→倾向义兄弟/婚姻；极低 + 高 boldness→倾向宿敌。本文只保证 rapport 可查，不建边。

---

### 4. 世界人物注册表（单一事实源升格）

#### 4.1 现状与目标

- **现状**：人物只活在**每玩家 `gameState.famousPeople[]`**（`GameStateRepository.js`，playerId 主键），在野武将、AI 势力武将无处存身。
- **目标**：人物是**共享世界事实**（对齐 `00` §4 定论）。新建**共享人物注册表**，与 `shared_world_territories` / `ai_faction_state` 平行，**不放进任何玩家 gameState**。

#### 4.2 事实源分层（关键的单一事实源决策）

人物按**归属**决定住哪，避免双写：

| 人物类别 | `factionId` | 权威事实源 | 理由 |
|---|---|---|---|
| **玩家自己的武将** | `player_<playerId>` | 仍在 `game_states.famousPeople[]`（各玩家私有行） | 玩家 roster 与其存档强耦合（忠诚/编队/成长），保持现状零迁移风险；**玩家花名册 = 「注册表中 factionId===本玩家」的自然分区**，不是复制 |
| **在野武将** | `null` | **新表 `world_people`（共享）** | 世界级、跨玩家可见、可被任何势力登用 |
| **AI 势力武将** | `ai_faction_<id>` | **新表 `world_people`（共享）** | 与 AI 势力同为共享世界模拟对象 |

> **「注册表 = 一个逻辑视图，物理上两处存」**：玩家武将物理落在其 game_states 行，共享人物落在 `world_people`。**读侧**用 `WorldPersonRegistry.query({factionId})` 统一查询——玩家自己的走 gameState、其他走 world_people、投影合并。这样满足「一个源」的语义：**每个人物只有一处权威副本，roster 是对注册表按 factionId 的查询投影，绝不复制人物 JSON 进两张表**。
>
> 为什么不把玩家武将也搬进 `world_people`？会引入「玩家存档 ↔ 共享表」双写与一致性风暴（编队/成长每 tick 写），违反「不为效率牺牲底层、但也不制造新耦合」。玩家武将的 `factionId` 恒等于其 playerId，天然是注册表的一个分区，**逻辑单源、物理分区**是这里正确的单源形态。

#### 4.3 `world_people` 表（新建，共享）

物理表（SQLite，随 `shared_world_territories` 同库）：

| 列 | 类型 | 说明 |
|---|---|---|
| `personId` | TEXT PK | `wp_<hash>`；全局唯一 |
| `factionId` | TEXT NULL | `null`=在野；`ai_faction_<id>`=AI 势力武将；索引列 |
| `homeRegion` | TEXT | 在野武将游历锚点（tile 区域 id，供「就近来投/登用」查询） |
| `person` | TEXT(JSON) | 完整人物 JSON（六维/archetype/**personality**/**affinitySeed**/status…） |
| `updatedAt` | INTEGER | tick 更新戳 |

- 索引：`(factionId)`、`(homeRegion)`。
- **仓库** `WorldPeopleRepository.js`（平行 `GameStateRepository`）：`listByFaction / listRoaming / getById / upsert / setFaction`。
- **注册表门面** `WorldPersonRegistry.js`（服务层，唯一读写入口）：封装「玩家武将走 gameState、其余走 world_people」的分流；对上只暴露 `query/get/move`（move = 改 factionId，即登用/来投/背叛的唯一落地点）。

#### 4.4 投影下发（对齐 `getClientProjectionForPlayer`）

玩家客户端看到的人物 = 三段投影合并：
1. **自己的 roster**：`gameState.famousPeople`（含 loyalty 等私有字段，原样）。
2. **在野武将（可寻访/来投候选）**：`world_people where factionId is null`，**投影 strip** 掉 `status.loyalty`（他人忠诚不可见）、`affinitySeed`（隐藏值不下发，只下发**对本玩家君主的 rapport** 派生值，供 UI 显示「投缘度」）。
3. **敌对/他方势力武将**：`world_people where factionId=ai_faction_*`，**strip 到情报级**（名/六维档/所属势力，隐藏值全 strip）。

> 投影字段**存盘前 strip**（同 territory 的 canonical isolation 铁律）。`affinitySeed` 永不出后端；rapport 是**后端算好的派生数**下发。

#### 4.5 生成器接线（复用，不另造）

- `FamousPersonGenerator.createFamousPersonCandidate` / `createTutorialScoutFamousPerson` **增补两块**：`personality`（roll 轴→取 nature）与 `affinitySeed`（seed 派生）。见 §7。
- 在野武将 & AI 武将由**世界 tick 播种**：`WorldPeopleSeeder`（新，走同一 `createFamousPersonCandidate` 核，`source.type='roaming'|'ai_officer'`，seed 加 region/faction）写入 `world_people`。**同一套生成核**，杜绝「玩家武将和世界武将两套生成逻辑」。

---

### 5. 配置表映射（Excel → JSON，走既有 pipeline）

沿用 `docs/config-tables/README.md` 的 `table-schemas.js` + `build-config-tables` + 新鲜度门禁。新增 3 张表（性格/相性属于「P1 自成一体数值」）：

#### 5.1 `personality_natures`（行表，8 行 = 8 气性）
主键 `natureId`。字段：
| 字段 | 类型 | 说明 |
|---|---|---|
| `natureId` | string | 主键：`valiant/cautious/dutiful/…` |
| `label` | string | 中文标签「勇猛」 |
| `anchorBoldness` | float | 锚点 boldness（−1~1） |
| `anchorSociability` | float | 锚点 sociability |
| `anchorIntegrity` | float | 锚点 integrity |
| `meetRateMult` | float | 认识新人频率倍率（风流=1.8、孤高=0.5）→ §6 |
| `loyaltyDriftMult` | float | 忠诚漂移速率倍率（义理<1 稳、野心>1 易变） |
| `weight` | int | 生成时被抽中的相对权重 |

> **校验（导表脚本加）**：锚点三值 ∈[−1,1]；`weight≥0`；natureId 覆盖生成器枚举（缺一即红，防止改名静默漏气性）。

#### 5.2 `compatibility_params`（key-value）
| key | 类型 | 默认 | 作用 |
|---|---|---|---|
| `wAffinity` | float | 0.6 | rapport 中 affinitySeed 权重 |
| `wAxis` | float | 0.4 | rapport 中性格轴权重 |
| `integrityRapportBonus` | float | 0.05 | 义理者 rapport 加成系数 |
| `recruitKRapport` | float | 0.30 | 招降 rapport 系数 |
| `recruitKCharisma` | float | 0.20 | 招降魅力系数 |
| `recruitKIntegrity` | float | 0.25 | 招降义理抗性系数 |
| `loyaltyDriftPerTick` | float | 0.5 | 每 tick 忠诚基础漂移步长 |

> **校验**：`wAffinity + wAxis` 应 ≈1（导表 warn 不等于 1；不强红，允许调权）。

#### 5.3 `personality_axis_gen`（key-value，生成分布）
| key | 类型 | 默认 | 作用 |
|---|---|---|---|
| `axisJitter` | float | 0.25 | 从锚点抖动生成实际轴的幅度（保证同 nature 的人也有差异） |
| `natureBiasByArchetype` | json | `{}` | 可选：archetype→nature 权重偏置（如 `warden` 偏 `stoic`），空=不偏 |

> `natureBiasByArchetype` **整块存 JSON 列**（README 风险条：嵌套语义别拆散）。

---

### 6. 世界 tick / 事件挂钩

全部挂进现有 `GameStateNormalizer.advanceRuntimeState`（玩家侧）与 `WorldWorkerService` tick（共享侧），**不新起调度器**（对齐 `00` §6.5）。

#### 6.1 好友来投（`romantic`/高 sociability 的招牌产出）——玩家侧
在 `advanceRuntimeState` 里新增 `normalizePersonSocial(gameState, now)`：
- 对玩家每个 roster 武将，累计一个 `person.social.meetProgress += meetRateMult(nature) * SOCIABILITY_FACTOR(axes.sociability) * dtHours`。
- `meetProgress ≥ MEET_THRESHOLD` 时触发一次「结识」：确定性从 `world_people where factionId is null`（就近 `homeRegion`）挑一个**与该武将 rapport 最高**的在野武将，作为**好友来投候选**写进 `famousPersonState.candidates`（复用现成候选面板），并清零 progress。
- 交游轴决定**频率**，rapport 决定**来投的是谁**——「风流→到处认识人→好友来投」的机制闭环。

> 复用现有 `candidates` 通道（`FamousPersonService`），不新建 UI；来投候选带 `source.type='referral'` + `referrerId`，接受走 `acceptFamousPerson`（内部 `WorldPersonRegistry.move(personId, player_<id>)`，把在野武将从 `world_people` 迁到玩家 roster——**唯一一次物理搬迁，即入伙**）。

#### 6.2 忠诚漂移——玩家侧
`normalizePersonLoyalty`：每 tick `loyalty += loyaltyDriftPerTick * loyaltyDriftMult(nature) * dir`，`dir` 指向 `targetLoyalty = clamp(50 + 40*axes.integrity + 10*(rapport(君主,该武将)−50)/50, 0, 100)`。义理者稳在高位，野心者+低 rapport 会掉忠诚（为 `03` 的背叛/被挖埋伏笔，但**背叛判定在 `03`**）。

#### 6.3 在野/AI 武将播种与游历——共享侧
`WorldWorkerService` tick 调 `WorldPeopleSeeder`：维持在野武将池规模（配表 `spawn_generation` 复用/新增少量参数即可，本文不新建播种表），确定性补员；在野武将 `homeRegion` 缓慢游走（供就近来投/登用查询）。**每 tick 跑一次，全局共享**，绝不每玩家复制。

---

### 7. 数据模型落地：`person.personality` / `affinitySeed`（精确字段 + normalize）

新增字段挂在人物对象上（与六维 `attributes`、`progression` 平级），normalize 在 `FamousPersonService.normalizePerson` 里补两段，**pure 计算放 `shared/person/personalityCore.js`**（客户端也可 import，算 rapport/UI 投缘度）。

```js
// person.personality —— 事实源
personality: {
  axes: { boldness: 0.62, sociability: 0.88, integrity: 0.10 },  // −1..1, 2dp
  natureId: 'romantic',                                          // 派生自 axes（最近锚点）
  natureLabel: '风流',                                            // 派生自配表 label
},
// person.affinitySeed —— 隐藏事实源（永不下发前端；投影时 strip）
affinitySeed: 218,                                               // 0..359
// person.social —— 玩家侧 tick 累计（派生进度，可重算）
social: { meetProgress: 0.0, lastMeetAt: null },
```

**生成（`FamousPersonGenerator`，确定性）**：
```
axesRaw = anchor(pickNature(weights, source))            // 抽气性→取锚点
axes    = anchor 各分量 + (rollUnit(source)*2−1)*axisJitter，钳 [−1,1]
natureId= nearestAnchor(axes)   // 抖动后可能落到邻近气性——以 axes 为准重算，axes 是唯一源
affinitySeed = Math.floor(rollUnit(source) * 360)
```
> **单源纪律**：`natureId/natureLabel` 是 `axes` 的派生命名，**normalize 时永远从 axes 重算 nature**（存档里的 natureId 只当缓存，冲突以 axes 为准）。避免「改了轴忘了改标签」的双源漂移。

**normalize（`normalizePerson`）**：
- `normalizePersonality(raw.personality)`：axes 三轴 `clamp(−1,1)` 缺省 0；由 axes 重算 nature；老存档无 personality → 从 `person.source.seed`（或 id）**确定性补生成**（保证已有武将平滑获得性格，无需数据迁移脚本）。
- `affinitySeed`：`toInteger` 后 `((v % 360)+360)%360`；缺省从 seed 派生。
- `social`：`meetProgress` 钳 `≥0`。

> **兼容**：这三块都是**加字段**，`normalizePerson` 对老数据 fail-safe 补齐（同现有 appearance/progression 的补齐套路），`GameStateMigrationPipeline` **无需破坏性迁移**。

---

### 8. 客户端 / UI 面

- **武将详情面板**：现六维旁新增「性格：风流」徽章 + 三轴条（boldness/sociability/integrity 小型 diverging bar）。`FamousPersonPresenter.js`（`frontend/js/state/presenters/`）加 personality 投影。
- **候选/招降面板**：显示**投缘度**（后端下发的 rapport 数，0–100，不显示 affinitySeed），招降按钮旁给「投缘 +X% / 义理者难招 −Y%」的成功率拆解（消费 §3.3 公式）。
- **在野武将名录**（新，可选切片）：世界人物注册表的在野分区列表（名/六维档/性格/就近区域/投缘度），供玩家主动寻访/登用——复用现有寻访通道。
- **i18n**：气性标签、轴名走 `t()` 双语成对（对齐仓库 i18n 门禁）；后端消息直发中文。

---

### 9. 实施切片（有序、每片可测）

1. **PERS-1 · pure 核**：`shared/person/personalityCore.js`——axes/nature 锚点、`computeRapport`、招降/忠诚公式（纯函数）。单测：环形距离、rapport 对称性、边界钳制、招降率单调性。**零接线，纯可测**。
2. **PERS-2 · 生成 + normalize**：`FamousPersonGenerator` 补 personality/affinitySeed；`FamousPersonService.normalizePerson` 补齐 + 老存档确定性回填。特征测试：给定 seed 生成稳定；老存档进→性格补齐、无崩。
3. **PERS-3 · 配置表**：`personality_natures`/`compatibility_params`/`personality_axis_gen` 三表进 `table-schemas.js` + scaffold + 导表 + 校验（锚点范围/权重/natureId 覆盖/DAG 无关但加枚举校验）+ 新鲜度门禁；核公式改读 `ConfigTables`。
4. **PERS-4 · 世界人物注册表**：`world_people` 表 + `WorldPeopleRepository` + `WorldPersonRegistry` 门面（玩家/共享分流查询）；投影 strip（affinitySeed 不下发、rapport 派生下发）。单测：query 分区正确、strip 完整。
5. **PERS-5 · 招降接线**：②b 捕获面板「招降」成功率接 §3.3（`recruitBaseRate` + rapport + 魅力 + 义理），说客选取（在场最高魅力/君主）。留 `bondBonus` 插槽（默认 0，`03` 填）。
6. **PERS-6 · tick 社交 + 忠诚**：`advanceRuntimeState` 挂 `normalizePersonSocial`（好友来投候选）+ `normalizePersonLoyalty`（忠诚漂移）；`WorldWorkerService` 挂 `WorldPeopleSeeder`（在野池维持/游历）。特征测试：确定性来投、忠诚向目标漂移。
7. **PERS-7 · UI**：详情面板性格徽章/轴条、候选面板投缘度 + 招降率拆解、（可选）在野名录；i18n 成对。真机验收：性格显示、招降率随投缘变化、好友来投弹候选。

> 依赖顺序：PERS-1→2→3 是纯基座；4 是注册表；5/6 消费；7 收口。每片过 `npm test` + architecture-smoke + lint 门禁后双推部署（design + refactor 环境）。

---

### 10. 单一事实源自查（铁律核对）

- 性格/相性 = **人物身上的字段**（`personality`/`affinitySeed`），一处权威。✅
- **投缘 rapport = 纯查询派生，从不落库**。✅
- **nature = axes 的派生命名**，normalize 从 axes 重算，冲突以 axes 为准（无双源）。✅
- **玩家 roster = 注册表按 factionId 的分区查询**，人物 JSON 绝不双写两表；入伙 = `WorldPersonRegistry.move` 唯一物理搬迁点。✅
- **affinitySeed 隐藏值永不出后端**，前端只见派生 rapport。✅
- 数值全走配置表；无硬编码性格/相性数字。✅
- tick 模拟共享侧只跑一次；玩家侧只处理自己 roster。✅


---

## 审查发现（单一事实源 + 缺口，落地前修正）

### 单一事实源违规（须改为查询/投影，不得复制）
1. 【招降数字在两处】§3.3 招降公式把 recruitBaseRate 当输入，但真实代码里 recruitBaseRate 只是 TerritoryCombatTargets.js:69 把 GarrisonPolicy.bandRecruitBaseRate(band) 投影成只读 DTO 字段下发前端——没有任何后端『招降 action』消费它。设计 PERS-5『接 ②b 捕获面板招降成功率』预设一个消费入口存在，实际不存在（全仓 grep 招降/recruit 的写路径为空）。若照设计在前端算一遍成功率、后端再算一遍判定，就会出现同一 recruitRate 公式两处实现＝双源。必须先把『招降结算』做成后端单一 action（吃 config + 派生 rapport），前端只显示后端算好的数。
2. 【第三条人物生成路径未收编，且正是被招降对象】§4.5 号称『同一套生成核，杜绝玩家/世界武将两套生成逻辑』，只统一了 roaming/ai_officer 走 FamousPersonGenerator。但 DefenderLeaderService.createDefenderLeader (DefenderLeaderService.js:156) 是完全独立的第三套人物生成器：自建 attributes(createAttributes)、archetype(PROFILE_BY_OWNER)、appearance、abilityKit、id 前缀 df_，source.type='defender'，loyalty:0。守将恰恰就是被捕获招降后要变成玩家武将的人。设计对它只字未提，personality/affinitySeed 不会挂上守将，招降进来的人将缺少这两个新事实源，或需在招降落地处再补生成一次＝性格事实源出现第二个生成点。
3. 【nature 双源风险已被设计发现但仍留缓存字段落库】§2.3/§7 把 natureId/natureLabel 声明为 axes 的派生命名，又要求 persist 进 person JSON（world_people.person 与 famousPeople）。虽然写了『normalize 从 axes 重算、冲突以 axes 为准』，但 natureLabel 还额外派生自配表 personality_natures.label——label 改字（配表编辑）后，存档里烘焙的 natureLabel 就与配表脱钩，成为第三处真相。MEMORY『显示文本禁烘焙进存档』正是此坑。natureLabel 不应落库，应始终由 natureId→ConfigTables 现查。
4. 【rapport 对本玩家君主的派生值下发＝把君主身份隐性复制进投影】§4.4 下发在野武将时 strip affinitySeed，改下发『对本玩家君主的 rapport』。但『谁是本玩家君主』这一事实（玩家 roster 里魅力最高者/君主）此刻并无单一权威定义——§3.3 说客又定义为『在场最高魅力武将或君主』。同一个『代表本势力做人际判定的人』概念在投影(§4.4)、招降说客(§3.3)、忠诚漂移(§6.2 rapport(君主,该武将)) 三处各自口径，实质是把君主选取逻辑复制三份。应抽一个单源 getFactionEnvoy(factionId)。
5. 【meetProgress/social 既是派生又落库，重算口径未定】§7 注释 social.meetProgress 为『派生进度，可重算』，但 §6.1 又让它每 tick 累加并 persist。若它真可重算，重算函数的输入是什么（无 lastMeetAt 之外的锚点）？若不可重算而必须 persist，它就是真事实源，不该标『派生』。这个模糊会让人误以为能随时重置，从而与已 persist 的进度冲突。

### 缺口 / 待补机制
1. 【tick 无 dtHours，且 advanceRuntimeState 每次 API 写都跑】设计 §6.1/§6.2 的 meetProgress += ...*dtHours 和 loyalty += loyaltyDriftPerTick*...*dir 假设一个按墙钟时间推进的 per-tick dt。但 GameStateNormalizer.advanceRuntimeState(GameStateNormalizer.js:155) 完全不计算 dt——它只收 now，不含 elapsed。真正的 elapsed 在 GameStateService.applyOnlineProgress(GameStateService.js:31-39) 里从 updatedAt 单独算、且 CAP 到 60 秒、且没传进 advanceRuntimeState。而 advanceRuntimeState 在每个 API 写(gameRoutes.js:393)和 worker tick 都跑。照设计直接在 advanceRuntimeState 里 += 会变成『每请求 +1』而非按时间——玩家点得越勤忠诚/社交涨得越快。必须显式引入 dtHours 事实源并想清楚它从哪来（updatedAt 差值？谁负责在 read 路径避免重复计时？）。
2. 【homeRegion『就近来投/登用』的 region 概念在代码里不存在】§4.3 world_people.homeRegion=『tile 区域 id』，§6.1 好友来投要『就近 homeRegion 挑在野武将』。但全仓 territory 服务没有任何 region/homeRegion 分区概念（只有 tile id 和 territory id）。设计凭空引入一个空间聚合层却不定义 tile→region 映射、region 粒度、跨玩家 spawn 分散下『就近』相对谁。这是一个未实现的地理索引，PERS-4/PERS-6 都依赖它却无规格。
3. 【捕获→招降→入伙的人物落地链完全缺失】被捕获守将当前是 encounter 内的 ephemeral 数据（WorldCombatEncounterService 每次现造 defender.leader），不进任何注册表。设计的 rapport/招降只覆盖『在野 world_people』分区，但招降的对象是守将(defender 分区，不存在)。从『打赢→captureChance 判定→守将进捕获面板→招降成功→变成玩家 famousPeople』这条链一步都没有现成实现，设计 PERS-5 只说『接成功率』，跳过了守将如何被持久化、招降失败的守将去哪、成功的守将如何 normalize 补 personality。
4. 【world_people 无跨库/事务/一致性设计】设计说 world_people 与 shared_world_territories 同库(SQLite)，但 §6.3 WorldPeopleSeeder 每 tick 全局写、§6.1 玩家侧 acceptFamousPerson 又要把人从 world_people 迁进玩家 game_states。这是一次跨表搬迁(delete world_people + insert famousPeople)，在并发 tick(WorldWorkerService 每 5s)与玩家 API 写之间无任何事务/锁/幂等设计。已知 MEMORY 有『reconciler local-wins 冻结』『march worker revision 冲突饿死』的前车之鉴，此处双写窗口更危险却未提。
5. 【affinitySeed 生成分布未随 archetype/nature 去偏，投缘会系统性偏斜】§7 affinitySeed=floor(rollUnit*360) 纯均匀，与 nature/archetype 独立。但 §6.1 好友来投挑『rapport 最高』者，§3.2 rapport 又含 axisAlignment。均匀 seed + 8 个 nature 锚点聚集的 axes，会让『同 nature』的人 axisAlignment 天然高，来投强烈偏向同气性——设计未分析这个耦合，也没说是否是想要的（可能导致风流只招风流）。
6. 【W_AFFINITY+W_AXIS≈1 只 warn 不 red，rapport 可越界后靠 clamp 掩盖】§5.2 校验权重和≈1 仅 warn。但 §3.2 rapport01 = W_AFFINITY*a + W_AXIS*b，若策划把两权重都调大，rapport01>1，再叠 integrity bonus，最终靠 clamp01 压回——招降/忠诚公式对 rapport 的边际敏感度被静默改变而无门禁拦截。要么强制归一，要么公式对未归一权重做显式归一。
7. 【老存档确定性回填 personality 用 source.seed，但历史 person 的 seed 语义不统一】§7 说老存档无 personality 时从 person.source.seed 或 id 确定性补生成。但现存 person 的 source.seed 形如 'playerId:timestamp:rollId'(FamousPersonGenerator.js:122)，defender 的是另一套，tutorial 又是另一套；用它当性格种子会让『同一次寻访 roll 出的人』性格与外观/技能种子强相关(都来自同一 seed)，可能产出可预测的性格-品质耦合。回填种子应独立命名空间(如 seed+':personality')，设计未指明。
8. 【投影 strip 只覆盖 sharedWorldTerritories，people 分区 strip 是全新面】现有 stripProjectionFields(GameStateRepository.js:58) 只 delete sharedWorldTerritories。设计 §4.4 要对三段人物投影做逐字段 strip(loyalty/affinitySeed)，这是全新的、字段级(而非整块 delete)的 strip 面，且要在『存盘前』执行以防污染玩家 state。设计只引用了 territory 的『canonical isolation 铁律』类比，但没给出 people 版本的 strip 实现位置与被谁调用，遗漏了 famousPersons 走的是 FamousPersonService.getClientStateFromNormalized(ClientGameStateAssembler.js:102) 这条完全不同的 DTO 路径。
9. 【8 nature 锚点在 axis 空间的 Voronoi 覆盖未验证，nearestAnchor 可能有死气性】§2.3/§7 生成先 roll 轴再取最近锚点。但 8 个锚点在 3 维[-1,1]立方体里的分布未做覆盖性分析：dutiful(+0.1,0,+0.9) 与 stoic(-0.3,-0.4,+0.5)、sage(-0.1,-0.6,+0.4) 在高 integrity 区扎堆，而低 integrity 只有 ambitious/reckless——axisJitter=0.25 抖动下，某些 nature 的 weight(生成权重)会被 nearestAnchor 覆盖区大小架空(配表 weight 说了不算)。weight 与 nearestAnchor 是两个互相打架的生成控制，设计没说谁赢。

## 待你确认的设计问题
1. 性格是否也要影响【战斗数值】（如勇猛+攻/冷静+防），还是只驱动世界行为/事件？我倾向只驱动行为（战斗数值留给六维+技能，避免双源），请确认。
2. 在野武将池规模与游历：世界里常驻多少在野武将？是固定池（如每区域 N 名）还是随时代/势力数增长？播种参数放 spawn_generation 表复用还是新建 world_people_gen 表？
3. 好友来投的目标池：只从【在野武将】挑，还是也能从【友好 AI 势力的低忠诚武将】挖角（挖角属于 03 关系网范畴）？本文默认只挑在野，挖角留 03。
4. affinitySeed 用一维环形标量（0–359，省存储、O(1)）是否够？还是要多维相性向量（更丰富但更重）？我选一维环 + 三性格轴叠加，认为已足够，请确认。
5. 忠诚（loyalty）目前是玩家专属字段。AI 势力武将也要 loyalty（供你未来【挖 AI 墙脚】玩法）吗？本文让 AI 武将也带 loyalty（存 world_people，投影 strip 不给敌方看），请确认这个方向。
6. 玩家武将保持在 game_states.famousPeople（逻辑单源、物理分区），不搬进 world_people——确认接受这个『物理分区、逻辑注册表视图』的单源形态，而非强行把玩家武将也塞进共享表（会引双写风暴）。
7. 气性数量定 8 个（每个带明确 hook）。是否需要更贴近 RTK 的十几种？我认为 8 个足够且每个都有玩法 hook，多了会有空气性，请确认。
