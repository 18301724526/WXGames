# 资源地系统 — 评审意见（模型：minimax-m3 / M3，2026-07-09）

> 输入：`00-brief-2026-07-09.md`（owner 需求冻结）+ `01-design-draft-glm-5.2.md`（glm-5.2 初稿）。
> 角色：数值/测试评审，只评不改。给设计者回炉用的反驳+测例+校准数。
> 校准基线：现有 `backend/config/GameConfig.js::resources`、`shared/buildingConfig.json`、`backend/calculators/ResourceTickCalculator.js`、`backend/config/generated/garrison.json`、`backend/config/generated/veteran_camp.json`、`backend/config/generated/ai_faction_profile.json`、`backend/config/WorldCampConfig.js`。
> 范围：不在本评审内——美术清单的具体资源（粒度已可，节点列 16 张基座 + 4 张徽标）、i18n catalog 翻译、tutorial 步的具体话术。
> 评级：
> - **blocker**：会破坏经济或破坏状态机一致性的硬问题；不改不进 P0。
> - **major**：量级/边界/可玩性层面的偏差，会让系统在 P1 暴露、必须进 P0 修复或限定为可调参。
> - **minor**：文笔/一致性/可优化项；记下但 P0 不阻塞。

---

## §0 评审总览（一句话）

设计整体方向对（嫁接营地+城占两条已落地闭环、tick 模型、复用 `WorldCombatSession`、60s 冻结、attacker-stays-as-occupier、attacker-snapshot 守军、"打了才知道"），但**收益表对铁资源、营+衰减组合、上限 12、以及 60s 部署期不可被攻击四项有量级或语义失衡**，必须在 P0 修。详见 §A-§C。

---

## §A 1-10 级 × 4 类型收益表 vs 现有经济（会不会碾压或废掉）

### A.0 现状基线（从仓库量出来的实数）

**A.0.1 人头基线**（`backend/config/GameConfig.js:8-19`）
- 1 农夫 = 1.0 粮/s
- 1 工匠 = 1.0 木 / 0.8 石 / 0.55 铁 /s（基线人头）
- 1 人 = 0.2 粮/s 消耗

**A.0.2 建筑基线**（`shared/buildingConfig.json`，production 类三建筑；公式 `craftsmen × basePerCraftsman × baseOutput` 见 `ResourceTickCalculator.js:62-97`）
- 伐木场 Lv1：`perLevel.woodOutputBase = 2`（解锁 era 1，max 3）→ 每个工匠在 Lv1 伐木场下产 1.0 × 2 = 2 木/s；Lv3 = 6 木/s/工匠
- 采石场 Lv1：`perLevel.stoneOutputBase = 1.5`（era 3，max 3）→ Lv1 = 1.2 石/s/工匠；Lv3 = 3.6 石/s/工匠
- 矿场 Lv1：`perLevel.ironOutputBase = 1.2`（era 4，max 3）→ Lv1 = 0.66 铁/s/工匠；Lv3 = 1.98 铁/s/工匠

> 注意：木材 1.0 / 石 0.8 / 铁 0.55 的`basePerCraftsman`差异已经在计算式里被建筑 base 放大或缩小；铁天然最难（要工匠 × 0.55 × ironOutputBase，矿场又最晚解锁 era 4）。

**A.0.3 野怪营地"一次性战利品"基线**（`WorldCampConfig.js:21-54`，作为产出对比）
- bandit（最近，0-3 环）：food 40 + wood 20 = 60 总资源
- raiders（4 环）：60 + 45 + 15 = 120 总资源
- warband（远 5+ 环）：90 + 70 + 35 + 20 = 215 总资源（且**含铁 20**）

### A.1 资源地产出 vs 单工匠建筑的量级比

把初稿收益表与"单工匠+Lv1 建筑"+"单工匠+Lv3 建筑"对照：

| 类型 | Lv1 节点 /s | 单工匠+Lv1 建筑 /s | 比值 | Lv10 节点 /s | 单工匠+Lv3 建筑 /s | 比值 |
|---|---|---|---|---|---|---|
| forest(wood) | 0.5 | 2.0 | 节点 = 0.25 工匠 | 6.0 | 6.0 | 节点 = 1.0 工匠 |
| stone | 0.4 | 1.2 | 0.33 工匠 | 5.2 | 2.88 | 1.81 工匠 |
| iron | 0.3 | 0.66 | 0.45 工匠 | 3.8 | 1.98 | 1.92 工匠 |
| farm(food) | 0.6 | 1.0 农夫 | 0.6 农夫 | 7.2 | 1.0 农夫×多田加成 | — |

**发现 #A1 [major]**：L10 节点对石/铁的单工匠建筑比 = 1.81 / 1.92，意味着 L10 石/铁节点的产出 = **约 2 个工匠在 Lv3 矿/采石场的稳定产出**。但 PvE 占领**无建筑投入、无工匠分配、不占工人位**，是纯被动收益。对一个拥有 4-6 城 + 2-3 个工匠/城的中期玩家：
- 1 座 L10 铁节点 = 2 工匠 × Lv3 矿场
- 中期城市总铁产 ≈ 6 城 × 2 工匠 × 1.98 = 23.76 铁/s
- 1 座 L10 铁节点 = 3.8/23.76 ≈ **+16% 全局铁产**（零消耗、零工人、零维护）
- 6 座 L10 铁节点（衰减到 0.85）≈ +34% 全局铁产

**结论**：P0 落地后 +1-2 座 Lv3 矿场的中期玩家抢到 1 座 L10 铁节点即可让铁脱离瓶颈——这**直接拉平"铁是瓶颈"的现有经济张力**。设计 §2.1 的"刻意低于...铁节点尤其低以维持铁是瓶颈"的判断**与数值结果不符**：铁确实比木/石数字小，但**等比下调没有补回"无建筑/无工人成本"这条不平等起跑线**。

**修法方向（不在本评审内做选择，只给区间）**：
- (a) 整张表 ×0.5（最简单：L10 iron 1.9/s、farm 3.6/s），但 L1 节点 → 0.15-0.3/s 又太小。
- (b) 引入"全服供给/需求弹性"——铁节点附近无城市时产率高、有城市时递减（难以维护）。
- (c) 给每种资源地加**额外消耗**（如铁节点消耗 coal，但 coal 是 mid-game 才有，制造小型资源耦合），用 P1 引入。
- (d) 限定"节点产出的资源不计入城市 trade 结算上限"——让收益真的"补充而非替代"，但这要改 `awardCampLoot` 写回路径。
- **建议 P0 走 (a)×0.6 + §C 衰减改紧**（见 #C3），后续 P1 评估 (c)(d)。

### A.2 资源地产出 vs 营地一次性战利品的"日化"对比

营地战利品按再生周期分摊到秒：
- bandit：60 资源 / (20×60s) = 0.05 总资源/s（远低于任何资源地）
- warband：215 / (90×60s) ≈ 0.04 总资源/s
- warband 里的 20 铁 / 5400s ≈ 0.0037 铁/s

**资源地产出比营地"日产化"高 1-2 个数量级**。这本身合理（持续 vs 一次性），但意味着**资源地一旦有收益就是"必抢"，而营地沦为低优先级**。设计 §6 没把营地收益做权衡——资源地会成为 PvE 主轴，营地沦为新手段。**不算 bug，但是产品层 minor**。

**发现 #A2 [minor]**：在 P0 UI 上，资源地面板的收益展示要刻意强调"持续型"（"+X.XX/s"），营地面板强调"战利品（一次）"，避免玩家误判。

### A.3 离线收益 ×0.8 上限 8h 的影响

`offlineEfficiency=0.8, offlineMaxHours=8`（对齐 `GameConfig.resources`）→ 上限 8 × 3600 × 0.8 = 23040 秒等效。

满占（12 个 + 6/type 上限均不触衰减）→ 离线一晚进账：
- 4 类型各 3 个 Lv10（极值）= 3×(6+5.2+3.8+7.2) = 66.6 总资源/s
- 离线 8h 一次性入账 = 66.6 × 23040 = 1,534,464 总资源 ≈ **150 万**

跟城市离线 8h（按 `CityService.calculateOfflineIncomeForAllCities` 经验 ≈ 中期玩家 30-50 万）比，**满资源地离线入账是城市 3-5 倍**。这是 "补足而非替代" 吗？数量级上**已经像替代**了。

**发现 #A3 [blocker]**：`offlineEfficiency/maxOfflineHours` 是给城市用的，资源地复用同一参数意味着：
- 离线 8h 的最大入账是城市 3-5 倍。
- 一上线就有一波巨大资源（与 `city.resources` 同 key 写回），触发"复活式囤积"，破坏 P2 资源稀缺感。
- 解决路径：把 `offlineEfficiency_forResourceNode` 与 `offlineMaxHours_forResourceNode` 拆成独立表项（建议值 0.5 / 4h），或在 `yieldDecayGracePerType=3` 之外**额外加一档"满占后整体效率折扣"**（如 ≥9 个 occupied → ×0.7）。

### A.4 收益与 city.resources 写回路径的钳位风险

设计 §3.6 写"写回玩家**首都活动城市** `city.resources`"。在 `economy-balance-model.js:119` 里 `state.resources[key] = Math.max(0, ...)`——会钳 0。**节点收益瞬间拉爆上限时（无 storage cap）**，只有 storage 时才卡。否则一晚上 150 万全塞首都是**账面上无法回收**的状态。

**发现 #A4 [major]**：要确认现有 `city.resources` 有无 storage cap（仓库/粮仓建筑限上）。如果有，资源地收益应在 cap 处停止累积（不溢出、不丢）；如果没有，要先于资源地加 cap 后再上资源地，否则会"印钱"。这条设计稿**没提 storage cap 行为**。

---

## §B 守军-收益-风险曲线（守军 vs 收益比 vs 攻占成本）

### B.1 守军兵力校准（设计初稿 vs 现有基线）

| 实体 | 配置 | 公式 | 实兵力 |
|---|---|---|---|
| 城市守军 near（`garrison.json`） | 260 + 90×scale | scale=4 → 620；scale=8 → 980 | 600-1000 |
| 城市守军 deep（`garrison.json`） | 520 + 170×scale | scale=4 → 1200；scale=8 → 1880 | 1200-1900 |
| 营地 warband（`WorldCampConfig.js`） | 70 + 16×ring | ring 5 → 150；ring 8 → 198 | 150-200 |
| 资源地 L1 | 50 + 18×1 | = 68 | 68 |
| 资源地 L5 | 160 + 56×5 | = 440 | 440 |
| 资源地 L10 | 410 + 148×10 | = 1890 | 1890 |

**发现 #B1 [blocker]**：L10 资源地 1890 + **legendary leader**（`garrison.json` 最强 deep 是 "great"），实际比"deep 城市 scale=8 + great leader"**更高、且 leader 更强**。设计 §2.2 末尾自评"弱于城市同档守军——资源地是据点不是城"是**错的**。L10 资源地是一个**"超 deep 城市"级**堡垒。**这是测例 B-1 必须 fail 的点**。

**修法方向**：
- (a) 系数收紧：L10 base 200、perLevel 80 → 200+800=1000（≤deep 城市 scale=4）。
- (b) leader 阶梯下调一档（great 而非 legendary，legendary 留给 city deep）。
- (c) 守军同品质下数量减半：`L10 → 945` 仍与 deep 城市相当。
- **建议 (a)+(b)**：让 L10 资源地守军 = 900-1000 + great leader，与"深城"对位而非超越。

### B.2 守军品质阶梯（quality/threat）

资源地 L1-2 common/L1 → L9-10 legendary/L5。营地：bandit common/L1 → warband elite/L3。城市 deep：great。

**发现 #B2 [major]**：资源地 L9-10 = legendary = 比城市 deep 的 great 还高一档。如果 L10 守军=1890 legendary 才是问题（#B1），单独把 leader 降一档到 great 同样缓解此项。建议：leg → great 适用于 L8-10（保留 L1-7 阶梯）。

### B.3 守军再生 vs 战利品再生 vs 城市守军再生

| 实体 | 再生周期 | 失效场景 |
|---|---|---|
| 城市守军（garrison.json） | 无（占城后为己方，敌方再占） | 玩家长期占有 |
| 营地（WorldCampConfig） | 20-90 分钟 | 玩家反复刷同一营地（"farm"行为）受同一 `cooldownKey` 防 |
| 资源地（设计 §2.2） | 20-120 分钟 | 同营地 + 衰减？ |

**发现 #B3 [major]**：资源地再生周期最长 120 分钟（L10），而营地 warband 90 分钟。**这意味着刷 L10 节点比刷 warband 营地更慢但**也意味着对资源地无冷却**——**第三方可以反复攻击被夺走/无人守的资源地**。需要：
- 玩家 A 占 L10 资源地 → 离开（撤军）→ uncontrolled 立刻重置守军再生（20-120 分钟）→ 玩家 B 立刻抢 → 20 分钟后再生 → 循环
- 这不一定是 bug，但**与"防 farm"目标相悖**。要确认"regenAfterCaptureMs=0"是不是把"被夺后立即重置"做错了。

### B.4 风险曲线（守军/收益比 = 难度/回报）

按"攻占一次要赢一场战斗，战斗消耗 ~ 兵力 × 战斗长度"做难度估值：

| 等级 | 守军 | 收益/s | 守军/收益比 | 营地对照 | 解读 |
|---|---|---|---|---|---|
| L1 | 68 | 0.5 木 | 136 | bandit: 24/60战利品/0.05日产 = 480 | 节点比营地"性价比"高约 3.5 倍（守军少、产出持续） |
| L5 | 440 | 2.0 木 | 220 | warband: 198/215 = 0.92（已含战利品 215，量纲不同） | 资源地 L5 性价比继续优于营地 |
| L10 | 1890 | 6 木 | 315 | — | 越高级越"划算" |

> 注：营地一次性 vs 资源地持续性，让"守军/秒收益"不能直接对比，但**单次投入/单位回报**的直觉是：资源地比营地"超赚"。

**发现 #B4 [major]**：高级资源地的边际收益（守军/秒收益比下降→性价比上升）会让玩家**优先冲高级**，跳过低级。这与设计 §6 "近弱远强、近多远少"在密度上 OK，但**在"性价比"上反而激励远征**——远环+深城的 L10 节点是终极目标。这没问题，但要让"远环行军成本"（距离×时间）成为天然制动——`shared/worldMarchCore.js` 的行军时长公式是什么我没逐行查，**这条要设计者确认行军时长足以"吃掉"L10 节点的高性价比**。

### B.5 风险曲线的另一个轴：被夺窗口

**发现 #B5 [blocker]**：设计 §3.4 + §8.2："占领方防御体 = 攻打用的那支编队就地转为驻防" + "玩家可换驻军（撤走→立即回 uncontrolled）"。

**这两个决定合起来构成"玻璃堡垒"**：
- 玩家 A 投入 500 兵拿下 L5 资源地（守军 440，A 战损 ~30%，剩 ~350）。
- 350 兵驻防 L5 节点。**任何带 200 兵以上的玩家 B 都能夺走**。
- A 撤走（想换更强的兵）→ 节点立刻回 uncontrolled → 守军再生中（2h 周期）→ 玩家 C 抢空档。
- A 不撤走 → 350 兵被锁在 L5 节点上，**失去机动作战能力**（60s deploy 后仍锁）。
- 玩家 B 反复"踢门"：200 兵 30 分钟踢一次，每次赢 350 守军、战损~80，余 120 兵回血 30 分钟再来。
- A 没有任何手段应对（被攻击时不能在节点补充兵）。

**这是 P0 最大的设计漏洞**。修法：
- (a) **占领方驻军 = 攻打编队快照 + 一定缓冲**（如 +30% 兵力保护期内免战），但太复杂。
- (b) **占领后注入"系统兵"**：把 `ownGarrisonBaseSoldiers` 从 0 调到 ≥ 守军 ×0.3，由 §2.1 `resource_node_garrison` 表配；玩家攻占/被夺时都按这个量自修复。
- (c) **"撤走=放弃" 改成 "撤走=资产转移"**：把驻防兵折算成"驻防积分"，节点保留，玩家撤走时积分带走，新编队来守时积分补成"驻防兵力"。复杂。
- (d) **占领后 24h 不可被第三方攻击**（"安全期"）：P0 实现简单，能给"投资回报窗口"。
- **建议 P0 走 (b)+(d) 简版**：`ownGarrisonBaseSoldiers = garrison.soldiers×0.4`（自修复周期 30 分钟）+ "安全期 24h 不可被夺"（超时后正常 PvP）。

---

## §C 占领上限 / 衰减的博弈漏洞

### C.1 12 个总占 + 6/type 上限的"最优解"博弈

- 总占 12 + 分类型 6 + 衰减 grace 3/类型 = 满占 12 个全在 grace = 0% 衰减。
- 等比例 3/type × 4 type = 12。**满占 = 0% 衰减的充要条件是 3/type**。
- 但 maxOwnedPerType=6 留了"溢出空间"：单类型可堆 6 个，后 3 个衰减 0.85-0.95-...（最低 0.4）。
- 衰减公式 `1-(k-3)×0.05`：k=4→0.95, k=5→0.90, k=6→0.85, k=7→0.80（下限 0.4）。
- 所以单类型堆 6 个（k=4..6）= 3 满 + (0.95+0.90+0.85) = 2.7 = 衰减 10%。

**发现 #C1 [major]**：12 个总占 + 6/类型上限 + grace 3/类型的设计有一个**最优占法**：3 满 grace（铁、石各 3 个 Lv10 高收益）+ 3 木 + 3 粮（各 3 个 Lv10）= 12 满。**但每个 Lv10 节点是 1890 legendary 守军（#B1）**，不可能同时 12 满。需要 P0 调整上限/衰减，让"满占"是分阶段的合理路径而非单一终态。

### C.2 小号/刷级漏洞（"多开小号"或"早期刷级"）

**发现 #C2 [major]**：设计没明确：
- 是不是单玩家世界（设计 §1.1 写"单服单玩家世界"）？如果是，PVPVE 怎么体现？
- 设计 §3.2 "被第三方攻击" 是否包括同账号多角色？单服多号？
- AI 势力在 P0 是否能成为"白嫖工具"——AI 占领后玩家夺取？

`ownerFactionId === 'player'`（`WorldExplorerProgression` 已有约定）应该是单服单玩家模型。如果是单服单玩家，则"小号刷级"是单账号内决策（如"重新开局"），不是真小号。**这条要在 P0 与 owner 确认**。

**升级刷资源**漏洞（更严重）：早期玩家（1-2 城，2-3 工匠）可以：
1. 用 60 兵 5 分钟攻下 L1 节点 → 60s 部署 → +0.5 木/s。
2. 离开主城去占 L1 节点（同 L1 易守）。
3. 24h 拿 12 个 L1 节点 ≈ +6 总资源/s = 518,400/天。
4. 城市期 2-3 天累计产出 = 500-800k 总资源，资源地**额外 +50%**。

**这是 P0 漏算**：Lv1 守军 68 soldiers 极低（设计 §2.2），但 `offlineEfficiency=0.8, maxOfflineHours=8` 让离线囤积正反馈。**建议 L1 守军 ×2.5**（170 = 与"near 城市"基线对齐），或加 §C.3 的方案。

### C.3 滚雪球（先发优势、永久积累）

**发现 #C3 [major]**：满占 12 个 Lv10 节点（理想态）离线 8h 进账 150 万总资源——**一周 7 次登录 = 千万级**。这意味着先发玩家在两周内资源量级 = 后发玩家一个月的产出。

修法：
- (a) 资源地收益**等级随时间衰减**（如占 7 天后 ×0.5，占 30 天后 ×0.3）——"占而不管"无奖励。
- (b) **守军骚扰**：周期性在 owned 节点生成小股"匪"（bandit 级），玩家要定期打匪维持收益。
- (c) **主动减产**：`yieldDecayGracePerType=3` 缩到 1（首占不衰减，二占起 0.95 起算）。
- (d) **"采集者税"**：每节点收益的 10% 流失到"地方势力"，不归任何玩家——逼玩家维护而非纯挂机。
- **建议 (c)+(d) 简版**：衰减更紧 + 每周自动扣 5%（用 `tribute` 字段或衰减系数乘 0.95）。

### C.4 第三方"PvP 收割"漏洞

**发现 #C4 [major]**：60s 部署期不可被攻击（#B5 提到），但部署结束立刻可攻击。**`attackResourceNode` 不需要前置动作**——任何玩家 B 在节点 deploy 结束的瞬间能行军到节点，**A 的 350 兵驻防被 B 200 兵 5 分钟攻破**。这是"掠守"——专门找正在 deploy/刚 deploy 的高级节点。

- 玩家 A 投入大代价拿下 L10 节点 → 60s 后 ownership 落地 → 30 秒内被玩家 B 掠夺。
- 玩家 A 的资源产出 1 帧 = 6 wood/s = 0.1 wood，0 收益。
- A 的 500 兵全军覆没或被锁。

修法：
- (a) 部署期结束后给 5 分钟 "安全窗"（P0 可加）。
- (b) 占领后注入"系统兵" 30% + 12-24h 安全期（#B5 的方案）。
- (c) 限制"刚部署完"的节点对非占领方不可见直到 1h 后（**太破坏经济，不建议**）。

### C.5 "Abuse chain" 串联漏洞

**发现 #C5 [blocker]**：考虑以下链式漏洞：
1. 玩家 A 攻下 L10 节点（耗 500 兵，战损 200，余 300）。
2. 60s deploy 结束，A 撤走 300 兵回主城。
3. 节点守军按 respawnCooldownMs=120min 进入再生期，**garrison 字段 soldiers=0、respawnAt=now+7200000**。
4. 玩家 B 在 A 撤走后 1 秒抵达节点，**节点守军为 0（再生中）**，B 一场不打就占据 deploy。
5. B 60s deploy 结束 → 节点归 B，**B 守军 = 0 + 系统兵 0**。
6. 玩家 C 在 B 占领 1 秒后抵达，攻 B 守军 0 → 立即赢得 contested → C 部署。
7. 循环：每个玩家拿 60s deploy 之后立即换手。**节点永远无人长期持有**。

如果 §2.2 `ownGarrisonBaseSoldiers=0` 严格执行 + `ownGarrisonRegenSeconds=-1`，上面这条链是**完全合法的玩法**——抢高资源节点"白嫖 60s 资源"或者"卡 deploy 期不被攻击"。

**修法**：
- `ownGarrisonBaseSoldiers` 默认调到 `garrison.soldiers × 0.3`（=L10 节点 567 系统兵），且 deploy 完成时**立即注入**，不允许"占领方兵=0"。
- deploy 完成后**安全期 24h** 不可被第三方攻击。
- 撤军触发"放弃"流程而非"瞬间回城"——撤军需 30s 退场动画（与 deploy 镜像），退场中节点照常有 garrison，**给被夺窗口的"宽限"时间**。

### C.6 AI 势力参与节点夺占的副作用

**发现 #C6 [major]**：P1 AI 参与后（§8.7）会引入：
- AI 势力资源池被节点收益"灌入"——AI 经济从内部脱钩到外部补血。
- `weightExpand` 类别已经有 `SETTLE_NEUTRAL/ATTACK_CITY/train`（`aiFactionCore.js:163`），加 `CLAIM_RESOURCE_NODE` 后**每 tick 仍是单选**（`aiFactionCore.js:190`），但**多了一种"低成本扩张"路径**：AI 不需要打城就能扩，每 tick 概率从 25% expand → 20% expand(其中 1/3 可能 expandNode) = ~7% 概率。`minSoldiersToAttack` 300-450 拦截高级节点，但 L1-L3 节点（68-188 兵）AI 经济就敢打——**AI 会扫光 L1-L3 节点**。

修法：
- 给 AI 加 `minSoldiersToClaimNode=200`（拦截低 L 节点），或**只让 ≥L4 节点对 AI 可见**。
- `weightExpand` 内部分项：`expandCity: 0.6, expandNode: 0.4`，让 AI 不全走"低风险节点"。

### C.7 "守军 = 0 部署完成" 时的反作弊

**发现 #C7 [major]**：客户端发"完成 deploy"的意图？应该**纯服务端 timer 推进**。设计稿 §3.4 写"服务端 tick 把 status='owned'、ownerFactionId=claimantFactionId..."，但 §3.3 "abortDeploy 玩家意图"是 client intent。两者写法对称，**但要明确 deploy 完成不允许 client intent，只能 server timer**。**这条 review 看着 OK，但要在 spec 显式强调**——`completesAt` 只能 server side 增加，不接受 client 推送。

---

## §D 状态机测试用例清单（每个转换的必测）

> 记号：状态 = `S0=uncontrolled, S1=contested, S2=deploying, S3=owned, S4=cooldown`（cooldown 用于"被打败后再生中"）。
> 假设：`garrison.regenAt > 0 && garrison.soldiers < base` ⇒ 处于 S4。
> 共用前置：每条用例需给出输入（`now`、`playerState`、`resourceNodeState`、`attackerForce`）和期望输出（`status`、`garrison.soldiers`、`ownerFactionId`、`income.lastSettledAt` 等）。

### D.1 uncontrolled → contested (S0→S1)
- **T-1.1** 正常进入：玩家 500 兵抵达节点，发起 attack → `status=S1, combat.status='engaged', battleId=X`。
- **T-1.2** 同节点已有 S1 战斗（玩家 B 在打）：玩家 A 抵达 → `error='ALREADY_IN_COMBAT'`（沿用 `WORLD_COMBAT_SESSION_BUSY` 规则，要确认 S1 占用单槽或允许多玩家围殴——**spec 未明确**，需设计者决）。
- **T-1.3** 节点守军再生中（S4）：玩家抵达 → **视为可打，但守军 0**。预期：玩家进入 S1，0 守军 → 1 帧胜利 → S2 部署。要确认 spec 行为。
- **T-1.4** 节点守军已为 0 但 `respawnAt > now`：玩家抵达 → S1 进入，0 兵判定胜 → deploy。这条与"防白嫖 60s 资源"（#C5）矛盾。

### D.2 contested → deploying (S1→S2)
- **T-2.1** 玩家胜利：守军 `soldiers=0` → `status=S2, deploy.startedAt=now, deploy.completesAt=now+60s, claimantFactionId=player`。
- **T-2.2** 玩家败北：编队残兵返程，节点保持 S0，garrison 残兵定格（`abortDeployKeepGarrisonSoldiersRatio=1.0`）。
- **T-2.3** 玩家在战斗中掉线（45s 兜底）：`resolveEngagedTimeouts` 触发 → 视为败（T-2.2 同）。
- **T-2.4** 玩家在战斗中掉线（5min SESSION_STALE）：上层扫除触发 → 同 T-2.3。
- **T-2.5** 战斗平局（无）：BattleSimService 是否产生平局？需要确认——若平局，按败处理（T-2.2）。
- **T-2.6** 玩家胜利但行军 0 兵：error='EMPTY_FORMATION'。要 spec 明确。
- **T-2.7** 玩家在 deploy **结束后**0.1s 立即被第三方攻击（#C4）：T-2.7 与 D.5 的 T-5.2 同时发生，谁先？

### D.3 deploying → owned (S2→S3)
- **T-3.1** 60s 自然到期：`now >= deploy.completesAt` → `status=S3, ownerFactionId=claimant, ownGarrison.soldiers=ownGarrisonBaseSoldiers(0), income.lastSettledAt=now`。
- **T-3.2** 服务端在 deploy 期间重启/玩家掉线：deploy 状态在持久层（`ResourceNodeRepository`）保留，重启后 `now` 仍小于 `completesAt` → 等到点。**测试重启 + 离线 deploy 计时**。
- **T-3.3** 玩家在 deploy 期被 `attackResourceNode` 攻击（来自 #B5 漏洞测试）：spec §3.3 说"不允许" → 第三方得 `DEPLOY_IN_PROGRESS` 拒绝。要测拒绝信息**双语文案**（后端中文、前端 catalog）。
- **T-3.4** deploy 期玩家**试图**让 mission 移动/撤退：spec §3.3 写"返回 `DEPLOY_IN_PROGRESS` 错误 + 冻结提示语"。要测：
  - 后端是否真的锁 `WorldExplorerActions.startWorldMarch`（#接缝 §6.2）。
  - 前端面板触发 `abortDeploy` 时是否二次确认。
  - 二次确认取消后 deploy 继续（`now` 推进）。
  - 二次确认确定后走 D.4 (D.3 中断分支)。
- **T-3.5** deploy 期玩家登出：deploy 继续在服务端推进。测试登出 30s + 重登：deploy 状态是否如期到点。
- **T-3.6** deploy 期 `now + 60s` 跨越午夜/跨日 tick：`advanceAllCities` 仍按时推进 deploy 与 income 写回。

### D.4 deploying → uncontrolled (S2→S0, 中断分支)
- **T-4.1** 玩家主动 abortDeploy（确认）→ `status=S0, deploy={}, garrison.soldiers=原值×abortDeployKeepGarrisonSoldiersRatio(1.0)`，编队回 idle。
- **T-4.2** abortDeploy 之前玩家已撤军（mission 试图 returnWorldMarch）：先收到 T-3.4 的 DEPLOY_IN_PROGRESS 拒绝；要测同时点 abortDeploy 抵达的处理顺序（**最后写者赢** or **abort 优先**）。
- **T-4.3** abortDeploy 后节点守军 `soldiers=0`（ratio=1.0 但原值已是战后残兵，可能是 0）：回 S0 但 `respawnAt=now+respawnCooldownMs`。
- **T-4.4** abortDeploy 在 `completesAt - 1s` 触发：节点应在 1s 内仍能 abort，不能 race lock。

### D.5 owned → contested (S3→S1, 被夺)
- **T-5.1** 第三方行军抵达 owned 节点 → S1（打 ownGarrison）。
- **T-5.2** owned 节点 ownGarrison=0（#C5 漏洞）：第三方 1 帧胜 → S2 → S3（换 owner）。这是 #C5 必须 fail 的 case。
- **T-5.3** 第三方战斗败 → 守方 ownGarrison 残兵仍驻防，节点保持 S3。
- **T-5.4** 占领方主队（A）正守 S3 节点，第三方（B）发起攻击，**同时** A 试图把主队撤走去支援别处：先发生撤走 → ownGarrison 残留 → 第三方打残留（**有或无**，取决于撤走是否触发 #B5 漏洞）。**这条要 spec 明确**。
- **T-5.5** AI 势力（P1）发起攻击：状态机同 T-5.1-T-5.4，但 `ownGarrison` 归属是 AI 势力。

### D.6 owned 状态下的二级状态（income/regen）
- **T-6.1** 在线 tick：每次 `advanceAllCities` 触发 `ResourceNodeIncomeService.settleOwnedNodes` → `gain = yieldPerSecond × decay × (now - lastSettledAt)` → 写回 active city。
- **T-6.2** 离线 8h 重登：`calculateOfflineIncomeForAllCities` 走同结算 → 等效 23040s（**用 #A3 提到的 0.5/4h 改后**）。
- **T-6.3** 玩家占领超过 `yieldDecayGracePerType=3` 个同类：第 4 个起按 `1-(k-3)×0.05` 衰减。
- **T-6.4** 玩家占领超过 `maxOwnedPerType=6`：**第 7 个 attempt 应被拒**（不是"占第 7 个但衰减 0.4"——是"占不下"）。要 spec 明确。`maxOwnedPerPlayer=12` 同。
- **T-6.5** 节点被第三方夺走：income 游标 `lastSettledAt` 重置 or 保留到原主？**保留到原主**——不能让"被夺瞬间把原主未来收益全入账"形成漏洞。
- **T-6.6** 节点被第三方夺走，原主已离线 8h 上线：原主的离线入账**包含已失去的节点**吗？要 spec 明确（建议"按 lastSettledAt 截止到失去控制权时刻"）。

### D.7 状态机与持久层（`ResourceNodeRepository`）
- **T-7.1** 服务端重启后所有节点状态从持久层恢复：S0/S1/S2/S3/S4 各抽样测试。
- **T-7.2** 并发：两个玩家同 tick 抵达同一节点 → `WORLD_COMBAT_SESSION_BUSY` 拒绝后者。
- **T-7.3** AI 在 P1 路径与玩家抢同一节点：单战斗在局约束 + AI 候选评估的"重新评估时机"——AI 选了一个节点，玩家先一步打，AI 是否会重选？**spec 未明确**。

### D.8 收益结算 + 守军情报投影
- **T-8.1** 玩家未打过某节点：客户端 DTO 不含 garrison.soldiers 数字（"打了才知道"）。要测面板 UI 是否真的"显示守军情报未知"。
- **T-8.2** 玩家打过但已被夺：玩家的 `intelSnapshot.knownGarrison` 是否被擦除？**应该是的**——新守军是占领方守军，玩家未打过新守军。
- **T-8.3** income 写回时 `city.resources` 钳 0 还是允许负数？测试 `Math.max(0, ...)` 行为（`economy-balance-model.js:119`）。

### D.9 边界（yield/decay 公式）
- **T-9.1** k=3 grace 内：`decay=1.0`。
- **T-9.2** k=4：`decay=0.95`。
- **T-9.3** k=12（最大可能）：`decay = max(0.4, 1-(12-3)*0.05) = max(0.4, 0.55) = 0.55`。
- **T-9.4** 同 type 占用 1-2-3 排序是否按"先占先 grace"——**应该是**（按 ownership 时刻）。要测"先占 1 Lv10 + 后占 1 Lv1" 的 grace 归属。
- **T-9.5** Lv1 节点 grace=3 占满，剩下 3 个 Lv10 抢占 type 内：它们都进 k=4 衰减（0.95）。**这与"高 Lv 收益大幅缩"组合后是否会逆转性价比？**——数学上是（Lv1 × 1.0 + 0.95 + 0.90 + 0.85）vs（Lv10 × 1.0 + 0.95 × 0 + 0.90 × 0 + 0.85 × 0），**满 type 占=3 个的 Lv10 比混占 Lv1-Lv10 更优**，**会激励"先到先抢 Lv10"**——这与"近弱远强"分布协同，是设计想要的，但**会让"占领竞赛"成为前 7 天的核心玩法**。

### D.10 接缝/API
- **T-10.1** `attackResourceNode` action 校验：未注册在 `GameActionRegistry` 之前调用 → 404/501。
- **T-10.2** `attackResourceNode` 同 mission deploy lock：返回 `DEPLOY_IN_PROGRESS`。
- **T-10.3** `abortDeploy` 在非 deploy 状态调用：`error='NOT_DEPLOYING'`。
- **T-10.4** 前端 dispatcher/runner 路径（按 button-scheduler spec §6）— 不走旧 controller `handle_*` 路径。
- **T-10.5** i18n key 缺失回退到 key 名（沿用 LocaleTextRegistry 行为）——**测试**。
- **T-10.6** 提示语"移动/撤退将会中止占领进程" 后端直发中文（不依赖 catalog）——前后端双源，**保证一致**的测例。

---

## §E 评审汇总（blocker / major / minor）

### E.1 Blocker（不进 P0 即破坏经济/状态机一致）

| # | 位置 | 描述 | 修法锚点 |
|---|---|---|---|
| B-1 | §2.2 守军 | L10 资源地守军 1890 legendary > deep 城市 1880 great，自评"弱于城市"错误 | 系数下调 + leader 降一档（#B1, #B2） |
| B-2 | §3.4 防御 | 占领方兵=0 快照 + 不可被夺安全期=0，导致 1 帧掠夺链 | 注入系统兵 30% + 24h 安全期（#B5, #C5） |
| B-3 | §3.6 离线 | `offlineEfficiency=0.8, maxOfflineHours=8` 复用城市参数，离线入账 = 城市 3-5 倍 | 拆成 `offlineEfficiency_forResourceNode=0.5` + `offlineMaxHours_forResourceNode=4h`（#A3） |
| B-4 | §3.4 撤军 | 占领方撤军 = 节点瞬间回 uncontrolled + 守军 0 → 第三方 1 帧掠夺 | 撤军 30s 退场动画 + ownGarrison 不可被瞬间清空（#C5） |

### E.2 Major（P0 落地后会暴露，需在 P0 修或可调参）

| # | 位置 | 描述 |
|---|---|---|
| M-1 | §2.1 收益 | L10 石/铁节点产出 = 2 工匠 + Lv3 矿/采石场，零消耗零工人，破坏"铁是瓶颈"经济张力（#A1） |
| M-2 | §3.6 storage | 写回 city.resources 无 storage cap 时会"印钱"（#A4） |
| M-3 | §2.2 守军品质 | legendary 留给资源地 L9-10 比城市 deep 的 great 更高（#B2） |
| M-4 | §2.2 respawn | 资源地再生周期最长 120min，第三方在再生中"白嫖"（#B3） |
| M-5 | §6 性价比 | 高 L 资源地"守军/秒收益比"越高级越划算，激励远征（#B4） |
| M-6 | §2.4 衰减 | 12+3+3 满占 grace = 0% 衰减，可被"3/type 满占"卡满（#C1） |
| M-7 | §3.4 安全期 | deploy 结束瞬间被第三方掠夺（#C4） |
| M-8 | §3.4 撤军 | 同 B-4（#B5, #C5）但与 M-7 路径独立 |
| M-9 | §8.7 AI | `weightExpand` 内 `CLAIM_RESOURCE_NODE` 与 SETTLE/ATTACK_CITY 共享权重后，AI 大量扫 L1-L3 节点（#C6） |
| M-10 | §2.2 早期 | Lv1 节点守军 68 太低，1-2 城玩家可批量刷（#C2） |
| M-11 | §C.3 滚雪球 | 无主动减产/税机制，先发优势会膨胀（#C3） |
| M-12 | §3.4 timer | deploy 完成禁止 client intent，只能 server timer——spec 显式（#C7） |

### E.3 Minor（P0 不阻塞，记下优化）

| # | 位置 | 描述 |
|---|---|---|
| m-1 | §2.1 体验 | 资源地 vs 营地量级差异大，UI 要明确"持续 vs 一次性"（#A2） |
| m-2 | §2.4 衰减下限 | 衰减下限 0.4（k=12）已接近 grace 数字（0.55）——数学一致但 narrative 弱 |
| m-3 | §2.1 类型权重 | 0.3/0.2/0.2/0.3 vs 地形 filter 联合后铁节点会偏少——统计后可能要改 |
| m-4 | §6.2 接缝 | "warband camp 改为节点" 是否会与现有 PVE 营地玩法冲突（spec 未提） |
| m-5 | §3.2 战斗 | 同节点多人围殴 / 排队策略未明确（spec §3.2 写"占用 session 槽"——意味着 1v1） |
| m-6 | §4.1 panel | 资源地面板归在哪个 panel group？是否进 `FamousPersonsPanel` 体系？spec 未提 |
| m-7 | §8.5 教学 | 教程步"占领第一座资源地"内容/触发条件未细化（spec 标 P0 后续，可接受） |
| m-8 | §3.6 写回 | "首都活动城市" 是哪一座？spec 未明（推测是 `activeCityId` / `firstCity`） |
| m-9 | §2.2 leader | leader 品质 common→legendary 跨度大，但与"打了才知道"组合后，玩家要在第一次战后立即记下品质——UI 要有"已击败的 leader 历史"视图（spec 未提） |
| m-10 | §2.1 farm | 粮节点"每秒 +0.6 粮"——粮同时是人口消耗资源，被夺会饿死人吗？（离线 8h 满占粮节点 +X 粮，但同时间城市粮食也可能耗尽） |

### E.4 评审者额外疑问（要 spec 答）

- **Q1** 单服单玩家世界的话，"被第三方攻击" 的"第三方"是谁？AI？Ghost 玩家？同一玩家多角色？spec §3.2 含糊，#C2 关注。
- **Q2** `offlineBaseEfficiency=0.8` 对城市生效，但城市玩家**在线**时也按 0.8 算吗？（看 `GameConfig.resources` 写法像全局系数，不是离线专用）资源地是否要"在线时 1.0 离线 0.8"双档？
- **Q3** 节点内**驻军**与**攻占者**——`ownGarrisonBaseSoldiers=0` + 攻占者原编队就地守。攻占者被换防时**老兵哪里去了**？spec 写"撤走=放弃"——老兵也回主城吗？需要 spec 明确"换防=撤军+重新行军" 的总时长。
- **Q4** `WorldCombatEncounterService.isEncounterVisibleToPlayer` 用 `computeCurrentVisionCoordSet` 投影。S3 owned 节点 `ownedAlwaysVisibleSelf=true` 时，从远处主城看，**S3 节点是否也对自己可见**？如果可见，那 S3 节点对**敌方**也可见吗（敌方也要看见哪里可掠夺）？spec §5 只说"己方恒可见"，**敌方可见规则没说**。
- **Q5** 行军 mission 的 `combatRef` 与节点 S1 战斗的 `battleId` 关系：玩家行军到节点 S0 → 进入 S1 → 战斗结束 → 进入 S2 → 战斗结束 60s 后 S3 —— mission 生命周期是否"锁"在 S1-S2 期间（行军 0 兵卡死），S3 之后 mission 怎样（队伍就地驻防 vs 任务结束）？spec §3.2 提"编队就地把守"——意味着 mission 一直在 S3——这与 #B5 漏洞直接相关。
- **Q6** `ResourceNodeSpawner` 镜像 `WorldCampSpawner` 时，**是否会与现有营地同 tile 冲突**？spec §2.3 提"minSpacing=2 + 与营地共享活动区各占其环"——但 `WorldCampSpawner` 也用 `minSpacing=2`，**两套生成器独立跑会否产出同 tile 营地+节点？**——需要 shared `occupiedTiles` 单源。
- **Q7** 美术 §7 4 状态徽标：敌方/己方判定在 S3 时是看"自己是不是 owner"——S1/S2 状态（contested/deploying）的徽标是什么？spec §7 写 4 张徽标覆盖"无主/攻占中/己方/敌方"——OK，但"自己 S2 deploy" 玩家看自己的徽标是"己方"还是"攻占中"？
- **Q8** 玩家下线期间，AI（P1）会夺取 S3 节点吗？会的。**离线 8h 满占 12 节点全被 AI 抢走**——上线后是"原主一瞬间全部失控"（崩溃感），还是"按节奏接管"（需要 AI 每节点每 tick 评估）？

---

## §F 给设计者的"如果不改会发生什么"快照

按 P0 现状+不加我提的 blocker 修复，预测 1-2 周后玩家实测：
1. **前 24h**：玩家意识到 1 座 Lv10 铁节点 = 16% 全局铁产（#A1）→ 第一波冲 Lv10 节点。守军 1890 legendary 难打，但先发帮会能冲下来。
2. **24-72h**：先发帮会满占 12 节点（#C1）→ 离线 8h 入账 150 万总资源（#A3）→ 经济滚雪球（#C3）。
3. **72-168h**：先发帮会与追赶帮会围绕 Lv10 节点进入"PvP 踢门"循环——第三方花 200 兵 5 分钟踢门，5-10 分钟回血（#B5 #C4）→ "资源地是 PVP 战场"而非"PVE 产出设施"。这与产品定位"补充产出"偏离。
4. **第 2 周**：营地从"主轴 PVE"沦为"低优先级"（#A2）→ 营地数值（`WorldCampConfig`）要不要同步下调？（产品决策）
5. **第 3 周**：满占帮会内部分配"节点权"成 P2 议程——外交/分配机制。
6. **第 4 周**：UI 反映"150 个 Lv10 节点争夺战"——但 spec §7 只画了 16 张基座 + 4 张徽标，**地图节点视觉密度上限是多少？渲染性能**？spec 未提。

**结论**：P0 在不开 #B-#C 修复下，资源地从"补充产出"快速演化为"PvP 战场 + 滚雪球引擎 + 营地降级"，与产品定位"嫁接城占+营地"的设计隐喻发生偏离。

---

## §G 评审者自评

- **覆盖度**：本评审聚焦经济/测试/博弈三条线，对美术（§7）仅确认粒度合理、对 i18n 仅确认双源（前+后）、对 UI 仅确认面板/契约抽象。
- **没核到的**：`WorldExplorerProgression.arrival` 的具体 hook（`WorldExplorerProgression.js:324` 没读全）；`WorldCombatSessionService` 完整战斗状态机；`WorldMapService.getTileCoordinateKey` 的坐标合法性边界；`DefenderLeaderService.createDefenderLeader` 的具体 leader pool 数量（是否够 L1-L10 × 4 type = 40 节点不重复？）。
- **建议**：设计稿在 P0 落地前**至少再过一遍经济模拟**——把 §A.1 收益表灌入 `scripts/economy-balance-model.js` 跑 30 天，离线 vs 在线两种场景，看是否触发本评审提到的"150 万 / 滚雪球"现象。
- **下一步**：等设计者回炉后再次评审本文件（不写 v2，加 v2 段即可）。

— 评审结束 —
