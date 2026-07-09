# 资源地系统设计 — 对照批判评审（Reviewer: kimi-k2.6）

> 输入：
> - 冻结需求 `docs/design/resource-node/00-brief-2026-07-09.md`
> - 被审稿 `docs/design/resource-node/01-design-draft-glm-5.2.md`
>
> 原则：不复述被审稿，独立思考同一需求我会怎么设计，逐条对比分歧并判定性质。只写本文件，不改初稿，不写其他文件。

---

## 0. 我的设计立场（同一需求我会怎么做）

资源地的核心闭环很短：**发现 → 打守军 → 60s 等待 → 收菜 → 被夺**。我会把它当作"野怪营地 + 城占领"的最小嫁接，而不是新增一个独立子系统。

- **状态机**：只用 2 个持久态 `idle`（无主/已占领，用 `owner` 区分）和 `deploying`，战斗中用 `combat.battleId` 做临时 overlay。不引入 `contested` 独立状态，因为战斗是 mission/session 层面的瞬态，不该污染共享实体状态。
- **配置表**：2 张数据表（`resource_node_yield`、`resource_node_garrison`）+ 1 张 key-value 调参表（`resource_node_tuning`）。铺设参数（`ringBands`、`typeWeight`、`terrainFilter`）复用 `WorldCampConfig.js` 的常量模式或并入 tuning 表，不单独成表——因为铺设算法是"世界生成参数"而非"游戏数值"，设计师调整频率远低于平衡数值。
- **部署期交互**：移动/撤退在部署期不是"被后端拒绝"，而是触发一个**复合意图**：玩家确认后，后端原子执行"中止占领 + 继续原动作"。一次点击、一次确认、一次完成。需求 5 的"确认则中止占领"里的"则"字，语义是"确认移动/撤退这个动作的同时，就中止占领"，不是"确认中止后再手动移动"。
- **收益结算**：资源地收益是 faction 级被动产出，写回**当前 active city**（或明确一个 faction 级资源池），而不是硬编码"首都活动城市"。
- **素材**：给出每张 cutout 的可执行 prompt 结构（英文、含风格锚点、尺寸明确为 384×384 或 512×512），大型站点（L7-9/L10）明确走 one-by-one 生成，不进 prop pack。

下面逐条对照被审稿的分歧。

---

## 1. Blocker

### 1.1 部署期移动/撤退交互流违背需求直觉

**被审稿方案**（§3.3、§4.2）：
- 后端在 `startWorldMarch`/`returnWorldMarch` 前校验 deploying 状态，返回 `{success:false, error:'DEPLOY_IN_PROGRESS', message:'移动/撤退将会中止占领进程'}`。
- 独立 `abortDeploy` 动作：确认后"编队返回-idle（不回城，保留 tile 上的部队）"。
- 这意味着：玩家点移动 → 被拒 → 点中止占领 → 部队原地变 idle → **再点一次移动**才能走。至少 3~4 次交互。

**我的方案**：
- 前端预判（或后端支持）一个**复合意图**：`marchWithAbortDeploy(target)` 或 `returnWithAbortDeploy()`。
- 交互流：玩家点移动/撤退 → 弹出确认框（标题/正文用冻结提示语）→ 确认 → 后端**原子执行**"中止占领 + 继续移动/撤退"。
- 部队不会停留在 tile 上罚站；"确认则中止占领"里的"则"，语义上就是"确认这个动作的同时，占领被中止，移动被执行"。

**判定：实质缺陷。**

**证据**：
- 冻结需求 §5 原文："玩家尝试移动/撤退时必须提示：'移动/撤退将会中止占领进程'（确认则中止占领）"。
- 被审稿把"提示"变成了"后端错误响应"，把"确认则中止"拆成了"先中止、再原地 idle、再手动移动"。交互步数翻倍，且最终状态（idle 在原地）与玩家最初意图（移动/撤退）不一致，违反最小惊讶原则。

**更优替代**：
- 方案 A（后端原子）：在 `WorldExplorerActions.js` 的 `startWorldMarch`/`returnWorldMarch` 中增加分支：若 mission 关联资源地 deploying，直接推进 `abortDeploy` 逻辑后立即继续原路由。
- 方案 B（前端复合）：若 button-scheduler 的新契约支持动作链，前端在确认后顺序发送 `abortDeploy` + `startWorldMarch`，并在 `abortDeploy` 成功后自动转发原意图（需处理中间失败回退）。
- 无论 A 或 B，最终 UX 必须是"一次确认、一次完成"。

---

## 2. Major

### 2.1 占领状态机过度复杂：`contested` 状态冗余 + `claimantFactionId`/`ownerFactionId` 双归属字段

**被审稿方案**（§1.1、§3）：
- 持久状态 4 个：`uncontrolled → contested → deploying → owned`。
- 共享实体上同时存在 `ownerFactionId` 和 `claimantFactionId`，外加 `ownGarrison`（默认 base=0、regen=-1，当前不启用）。
- 战斗中还要挂 `combat { status, battleId, ... }` 子对象。

**我的方案**：
- 持久状态 2 个：`idle`（无主或已占领，`owner === null` vs `owner === 'player'`）和 `deploying`。
- 战斗 overlay 用 `combat.battleId` 存在性判断，不提升为独立 `status`。现有 `WorldCombatSessionService` 已经用 `mission.combat` 或 session 对象表达战斗瞬态（`backend/services/worldCombat/WorldCombatSessionService.js`），没有在共享 encounter 上新增持久状态。
- 不需要 `claimantFactionId`：deploying 时直接在 `deploy.claimant` 里放，idle 时只用 `owner`。
- 不需要 `ownGarrison`：P0 决定占领后无系统驻军（靠编队就地驻防），那 `ownGarrison` 字段就是 dead code。P1 若开系统驻军，再加字段不迟。

**判定：实质缺陷。**

**证据**：
- 现有 `WorldCampConfig.js` 的营地只有 `status: 'active'`，战斗靠 `WorldCombatSessionService` 的 session 对象追踪；城占领也只有 `territory.owner` 和 `occupiedAt`，没有 `contested` 持久状态。
- 被审稿的数据模型中，`contested` 与 `uncontrolled` 的唯一差异是"是否正在被打"，而这个信息完全可以用 `combat.battleId !== null` 表达；`owned` 与 `uncontrolled` 的唯一差异是"有无 owner"，这个信息完全可以用 `owner !== null` 表达。
- `ownGarrison` 在 §2.2 表中被设为 `ownGarrisonBaseSoldiers=0`、`ownGarrisonRegenSeconds=-1`（不启用），却在 §1.1 数据模型中占一整个对象，增加了持久化/反序列化/版本化复杂度。

**更优替代**：
```js
// 我的最小数据模型
{
  id, type, level, q, r, tileId, terrain, activityRegionId,
  owner: null | factionId,           // 无主=null；已占领=player/ai
  status: 'idle' | 'deploying',      // idle 内部由 owner 区分
  deploy: { startedAt, completesAt, claimant }, // 仅在 deploying
  garrison: { soldiers, quality, threat, leader, regenAt }, // 守军
  combat: { battleId, attacker, engagedAt },      // 战斗中 overlay
  income: { lastSettledAt },
}
```
状态空间更小，SSOT 更清晰。

---

### 2.2 收益写回"首都活动城市"，未澄清归属语义

**被审稿方案**（§3.6）：
- "写回玩家**首都活动城市** `city.resources`（对齐 `awardCampLoot` 直接写 `city.resources` 的写法）"。

**我的方案**：
- 资源地收益是 faction 级持续产出，应写回**当前 active city**（`gameState.activeCityId`），并在城市切换时明确是否携带收益结算游标；或者，如果游戏经济模型支持，应进入 faction 级资源池。
- 如果必须 city-centric，至少应说明：收益归属哪个 city、切换 active city 时资源地收益是否跟随、离线结算时按哪个 city 入账。

**判定：实质缺陷（设计未澄清）。**

**证据**：
- `CityService.advanceAllCities`（`backend/services/CityService.js:254`）遍历每个 city 独立计算产出，每个 city 有自己独立的 `resources` 对象；`gameState` 没有顶层 `resources` 槽。
- `awardCampLoot`（`WorldCombatEncounterService.js:208-221`）是一次性掠夺，写回当下 active city 是合理的（战利品运回当前城市）。但资源地收益是"远程站点持续产出"，与"战利品"的物理语义不同。
- 现有 `calculateOfflineIncomeForAllCities` 按 city 分别计算离线收益，资源地若只进首都，那离线结算时其他城市不享受资源地产出，这会在多城阶段造成玩家困惑。

**更优替代**：
- P0 写回 `gameState.activeCityId` 对应的 city，并在资源地面板显示"收益归入 {cityName}"；P1 考虑增加"资源地绑定城市"的分配机制。无论如何，文档必须明确归属规则，不能含糊说"首都活动城市"。

---

### 2.3 配置表 `resource_node_garrison` 引入 P0 不启用字段，增加认知负担与代码负债

**被审稿方案**（§2.2）：
- `captureChance` 全表填 `0`（关闭捕将流）。
- `ownGarrisonBaseSoldiers` 全表填 `0`。
- `ownGarrisonRegenSeconds` 全表填 `-1`（不启用）。
- 这三个字段在 P0 完全没有生效路径，却占用了 10 行表的横向空间，也占用了代码读取时的认知负荷。

**我的方案**：
- P0 表只保留生效字段：`level`、`baseSoldiers`、`soldiersPerLevel`、`leaderQuality`、`threatTier`、`respawnCooldownMs`、`deploySeconds`。
- `captureChance` 等字段在 P1 "接入捕将流"时再新增列。`config/tables/table-schemas.js` 支持后续加列（`--scaffold` 会补缺失列），不存在技术障碍。

**判定：实质缺陷（过度设计）。**

**证据**：
- 现有 `config/tables/table-schemas.js` 中的 `garrison` 表没有为未来扩展预留未启用字段；`veteran_camp` 表也没有。
- 被审稿自己在 §9 说 "P1 … 表上 `captureChance` 可选打开"，说明这些字段本就是为 P1 预留的。P0 设计不应该为 P1 预埋 dead code。

**更优替代**：
- `resource_node_garrison` P0 版只含 7 个生效列；P1 扩展时在 `table-schemas.js` 中追加列定义，`--scaffold` 会自动补空值。

---

### 2.4 素材清单缺少可执行 prompt，建筑类站点尺寸估计不足

**被审稿方案**（§7）：
- 列出 16 张"基座"的中文概念描述（如"林地小伐木栈""大型林场砦"）。
- 尺寸建议 256×256~384×384。
- 未给出任何英文 image_gen prompt 结构或风格锚点参考。

**我的方案**：
- 每张给出可执行的 prompt 片段（英文），含风格锚点（`world-site-city-cutout.png` 等距手绘、低饱和、轻描边）。
- L1-3 用 256×256；L4-6 用 384×384；L7-9/L10 用 512×512（大型建筑在等距视角下需要更大画布才能表现细节层次）。
- 明确生成方式：one-by-one（因为都是 buildings / large sites），不走 square prop pack。

**判定：实质缺陷（可执行性风险）。**

**证据**：
- `generate2dsprite` SKILL.md（`.agents/skills/generate2dsprite/SKILL.md`）明确：
  - "Do not put platforms, floors, bridges, walls, ladders, gates, doors, buildings, large trees, checkpoints, exits, or build pads into square prop packs" → 大型林场/矿场/屯田仓明确属于 buildings，必须 one-by-one。
  - "Write the art prompt yourself" → 被审稿只给中文概念名，执行端需要重新发明 prompt，风格一致性风险高。
- 现有 `world-site-city-cutout.png` 等 Site ART 的实际尺寸我不确定，但 256×256 对于"大型屯田仓"这种需要表现建筑群+粮仓+围栏的等距 cutout 来说，分辨率偏低。

**更优替代**：
- 文档至少给出每档 1~2 张参考 prompt（英文），并建议尺寸梯度。例如 L10 的 forest：
  > "Isometric hand-painted game asset, large fortified lumber fortress with waterwheel, wooden palisades, sawmill buildings, low saturation earthy tones, light outline, solid #FF00FF background, clean HD style, centered in frame, 512×512"

---

### 2.5 占领上限与衰减机制冗余，衰减几乎不触发

**被审稿方案**（§2.4 `resource_node_tuning`）：
- `maxOwnedPerPlayer=12`，`maxOwnedPerType=6`。
- `yieldDecayGracePerType=3`，`yieldDecayPerExtra=0.05`，下限 0.4。
- 这意味着：玩家最多拥有 6 个同类资源地，其中前 3 个满收益，第 4 个衰减 5%，第 5 个 10%，第 6 个 15%。

**我的方案**：
- **二选一**：要么上限放宽（如 20）让衰减成为真正的软限制，要么取消衰减只靠硬上限。
- 当前两者叠加，`maxOwnedPerType=6` 已经把同类堆叠压死了，衰减只是"多占 3 个后轻微惩罚"，边际效用极低，却增加了客户端/服务端的双重计算逻辑。

**判定：实质缺陷（设计意图未兑现）。**

**证据**：
- 无直接代码冲突，但数值常识：如果设计意图是"防独家垄断稀缺资源"，硬上限 `maxOwnedPerType=6` 已经完成了这个意图；如果意图是"鼓励多类型分散占领"，衰减太轻（最多-15%）不足以改变玩家行为。
- 被审稿自己的 §2.4 说"上限防独家垄断稀缺资源（铁/石），衰减鼓励多类型分散占领"——两个机制互相削弱对方的存在意义。

**更优替代**：
- 方案 A：取消 `yieldDecay*` 参数，只靠 `maxOwnedPerPlayer / maxOwnedPerType` 双硬上限。P0 最小可玩。
- 方案 B：若坚持衰减，将 `maxOwnedPerType` 提升到 10+，`yieldDecayPerExtra` 提升到 0.15~0.20，让衰减真正影响决策。这需要 owner 的经济验证，不宜在 P0 引入。

---

### 2.6 `deploying` 对第三方不可攻击，未解决 tile 占用与行军阻塞语义

**被审稿方案**（§3.3、§待决问题 3）：
- "部署期内资源地不可被第三方攻击"，"第三方打到 tile 上会被 `getActiveEncounterAt` 命中守军在的 `uncontrolled` 节点，而 `deploying` 节点不作为可攻击 encounter 投影给非占领方"。

**我的方案**：
- 允许第三方行军到达 deploying tile 并**打断部署**：部署期立即清零，资源地回到 `idle`（无主），守军按战后残兵比例重置，第三方进入 `contested`（攻打守军）。
- 或者，若坚持保护窗口，则必须明确 deploying tile 对第三方是**阻塞不可达**的（行军路由绕开），否则第三方部队走到 tile 上却不触发任何逻辑，会造成世界地图状态不一致。

**判定：合理多解，但有隐患，需补充约束。**

**说明**：
- 保护窗口是最小惊讶的设计（"我好不容易打赢了，给我 60s 保护"），这在很多 SLG 中常见。但前提是**tile 在 deploying 期间对其他行军不可达**，否则物理上站上去却无事发生是反直觉的。
- 被审稿没有说明第三方行军到 deploying tile 时会发生什么（是阻塞？是允许站上去但无战斗？还是 encounter 投影被过滤导致看不到？）。这需要在设计文档中明确。

---

## 3. Minor

### 3.1 在线收益 float 累加 vs 离线收益 Math.floor 截断，数值不一致

**被审稿方案**（§3.6）：
- 在线 tick：`city.resources.wood += outputs.woodPerSecond * seconds`（不 floor）。
- 离线结算：被审稿对齐 `calculateOfflineIncomeForAllCities`，后者用 `Math.floor(...)`。
- 但资源地自身的 `yieldPerSecond` 是 float（如 0.5、1.1），在线累加精确到小数，离线却截断为整数。

**我的方案**：
- 明确统一：要么资源地收益也走 `Math.floor`（在线/offline 一致），要么说明 float 累加是设计意图。
- 或者，若城市资源本身允许 float（现有 `advanceAllCities` 确实允许），那离线结算也应避免 floor 造成"离线比在线亏"的感知问题。

**判定：实质缺陷（minor，数值精度）。**

**证据**：
- `CityService.advanceAllCities`（`backend/services/CityService.js:267`）：`city.resources.wood = Math.max(0, ... + outputs.woodPerSecond * seconds)`，无 floor。
- `CityService.calculateOfflineIncomeForAllCities`（`backend/services/CityService.js:316`）：`Math.max(0, Math.floor(outputs.woodPerSecond * actualOffline * efficiency))`，有 floor。
- 如果资源地收益挂在这两个函数里，就会出现同一产出源在线/offline 精度不同的问题。

**更优替代**：
- 资源地收益在线结算时显式 `Math.floor(yieldPerSecond * elapsed)`，保持与离线一致；或离线结算改为 `Math.round` 减少偏差。

---

### 3.2 `recentReports` 放在每个 node 上，存储膨胀且投影规则未澄清

**被审稿方案**（§1.1）：
- 每个 node 上存 `recentReports: []`，限 5 条。

**我的方案**：
- 复用全局 `gameState.worldCombat.recentReports`（或玩家私有的报告列表），不在每个 node 上重复存储。
- 若坚持 node 级报告，需说明：对非 owner 是否投影？对 owner 离线期间产生的报告如何同步？

**判定：合理多解（但偏向冗余）。**

**说明**：
- 现有 `WorldCombatEncounterService.js:23` 的 `RECENT_REPORT_LIMIT = 5` 是**全局**限制（`gameState.worldCombat.recentReports`），不是每个 encounter 5 条。被审稿把它下沉到每个 node，100 个节点就是 500 条，存储和带宽成本增加一个数量级。

---

### 3.3 配置表拆为 4 张，铺设参数单独成表

**被审稿方案**（§2）：
- 4 张表：`resource_node_yield`、`resource_node_garrison`、`resource_node_placement`、`resource_node_tuning`。

**我的方案**：
- 3 张表：yield、garrison、tuning。`placement` 的 `ringBands`、`typeWeight`、`terrainFilter` 并入 tuning 表或走 `WorldCampConfig.js` 式的代码常量。
- 理由：`WorldCampConfig.js`（`backend/config/WorldCampConfig.js:59-78`）的 `PLACEMENT` 就是代码常量，没有进配置表管线。铺设算法参数（活动区网度、间距、地形过滤）是"世界生成常量"，不像 yield/garrison 那样需要设计师频繁 tuning。

**判定：合理多解。**

**说明**：
- 被审稿的方案更"数值全表驱动"，但增加了 `--scaffold`、xlsx 维护、设计师认知的负担。我的方案更贴近现有营地的做法。两者各有利弊，不算缺陷。

---

### 3.4 4 张状态徽标叠加，假设了未验证的 runtime overlay 能力

**被审稿方案**（§7）：
- 16 张基座 + 4 张徽标（无主/攻占中/己方/敌方），"以轻量小图标或边框区分"。

**我的方案**：
- 若运行时已有阵营色边框/旗帜 overlay 系统（如 `TerritoryConstants.SITE_ART` 支持 overlay），则 4 张徽标可行。
- 若运行时**没有** overlay 管线，则需提前知晓，否则 P0 会出现"占位 cutout 没有状态区分"的问题。应给出 fallback：若不支持 overlay，则 P0 至少生成"无主"和"己方占领"两张状态变体。

**判定：合理多解（前提未验证）。**

**说明**：
- 被审稿没有验证项目运行时是否支持 sprite overlay。如果当前地图渲染只能显示一张 PNG，那 4 张徽标方案在 P0 不可行。

---

### 3.5 `resource_node_yield` 的 `tierVisual` 字段冗余

**被审稿方案**（§2.1）：
- 每行（40 行）带 `tierVisual: 1|2|3|4`，用于美术选图。

**我的方案**：
- visual 分档是确定性的区间映射：`level 1-3 → tier 1`、`4-6 → 2`、`7-9 → 3`、`10 → 4`。不需要表字段，代码里一个 `Math.min(4, Math.floor((level-1)/3)+1)` 即可。

**判定：合理多解。**

**说明**：
- 表字段的好处是允许设计师以后改区间（如改成 1-2/3-5/6-8/9-10）；坏处是 40 行都填同一个重复数字，增加了 xlsx 维护量和出错概率。两者皆可，不算缺陷。

---

### 3.6 文案 "继续部署" vs "继续占领"

**被审稿方案**（§4.2）：
- `abortCancel`: "继续部署" / "Keep Deploying"。

**我的方案**：
- `abortCancel`: "继续占领" / "Keep Occupying"。
- 理由：需求原文用"占领"（占领资源地、占领进程），"部署"是技术术语（deploying 状态），面向玩家的文案应保持"占领"一词的一致性，避免引入两个概念让玩家困惑。

**判定：合理多解（文案偏好）。**

---

## 4. 综合评分

| 维度 | 评分 | 简述 |
|---|---|---|
| 需求符合度 | ⚠️ 有瑕疵 | 部署期交互流（§1.1 Blocker）与冻结需求 5 的语义有偏差；收益归属（§2.2）未澄清。 |
| 状态机简洁度 | ⚠️ 偏复杂 | `contested` 独立状态与 `claimant`/`owner` 双字段可精简；`ownGarrison` dead code。 |
| 配置表适度性 | ✅ 可接受 | 4 张表略多但不致命；P0 引入未启用字段（§2.3）是主要问题。 |
| 交互直觉度 | ❌ 有问题 | 中止占领后部队原地 idle（§1.1），玩家需要再点一次移动；"部署"文案不一致（§3.6）。 |
| 素材可执行度 | ⚠️ 有风险 | 缺少可执行 prompt，建筑类尺寸估计偏小（§2.4），overlay 前提未验证（§3.4）。 |
| 与现有系统接缝 | ✅ 较好 | 复用 BattleSimService、WorldCombatSessionService、advanceAllCities 等链路正确。 |
| P0 可落地性 | ⚠️ 需修订 | 若修复 Blocker + 2~3 个 Major，P0 可落地；当前状态不建议直接进实现。 |

---

## 5. 修订建议优先级

1. **立即修（Blocker）**：重新定义部署期移动/撤退交互流，改为"确认后原子执行中止+移动/撤退"，或至少文档明确中止后部队不原地 idle 而是继续执行原动作。
2. **P0 前修（Major）**：精简状态机（去掉 `contested` 持久态、`claimantFactionId`、`ownGarrison`）；澄清收益归属城市；`resource_node_garrison` 表移除 P0 不启用列；素材清单补充 prompt 与尺寸梯度。
3. **P0 可选修（Major/Minor）**：统一在线/offline 收益精度；`recentReports` 改为全局或 owner 私有；若 overlay 管线未验证，素材 fallback 为每状态独立变体。
4. **P1 再议**：占领上限/衰减机制数值重审（§2.5）；AI 势力参与夺占（已标记 P1，合理）。

---

*评审完成。未修改任何源文件。*
