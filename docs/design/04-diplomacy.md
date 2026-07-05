# 04 外交：势力好感度 + 敌对/友好/中立/同盟/仇视

> 由设计 workflow 深化（已过单一事实源对抗审查）。审查结论：NEEDS_REVISION——文末「审查发现」是 codex 落地前要修正/补齐的点。

> 文档：`docs/design/04-diplomacy.md` · 系统：外交（势力↔势力好感度 + 5 态关系）
> 依赖脊柱 A（势力实体，`01-faction-model.md`）与脊柱 B（人物/性格·相性，`02`），供顶层 AI 决策（`05-ai-factions-cities.md`）消费。
> 强约束（同 `docs/design/00-vision-and-spine.md` §6）：单一事实源；玩家=势力（`factionId==='player'` 无特例分支）；纯规则核 + 服务层接线；数值走配置表；模拟只在 `WorldWorkerService` tick 跑一次。

## 1. 目标 + RTK 参照

**目标**：让势力之间有活的政治。任意两个势力有一个**好感度**（-100..100）和一个**关系状态**（敌对/友好/中立/同盟/仇视）。好感度随双方行为、君主性格·相性、边境压力、共同敌人、背叛、赠礼/朝贡漂移；越过阈值 + 特定动作触发状态迁移。状态决定谁能打谁、是否共享视野/贸易、AI 如何取舍。玩家与 AI 势力**同一套外交模型**。

**RTK 参照**：光荣三国志的外交是「**对称的关系状态**（同盟/停战/敌对是双方一致的事实）＋**每一侧独立的好感度/亲善度**（A 对 B 的观感 ≠ B 对 A）」。本设计照此：状态对称、好感度**每侧独立**。同盟需**双方同意**（RTK 的同盟提案要对方接受）；宣战单方即可（撕毁停战/破盟有代价）。这与 RTK「军师建议外交」「同盟到期」「背盟名声受损」一脉相承。

## 2. 单一事实源数据模型（每个事实一份，派生用查询）

### 2.1 事实源位置：外交边挂在势力上，对称部分「镜像成对写」

外交事实是**势力对**的属性。按脊柱 A 定论（`00` §4），势力事实源分三处：AI 势力在共享 `ai_faction_state`、真人势力是 `game_states.playerId`、城/领土归属在 `shared_world_territories`。外交边也必须是**共享世界状态**（跨玩家可见、tick 里统一模拟），**绝不能藏进某个玩家的 gameState**——否则 A 存的「A↔B 敌对」B 看不到，双分叉，违背铁律。

因此外交边落地为**独立的共享表 `faction_diplomacy`**（与 `shared_world_territories`、`ai_faction_state` 平行，同属 `GameStateRepository` 管理的共享世界层）：

```
CREATE TABLE IF NOT EXISTS faction_diplomacy (
  factionId       TEXT NOT NULL,   -- 观察方（本条目属于谁）
  otherFactionId  TEXT NOT NULL,   -- 对象方
  favorability    INTEGER NOT NULL DEFAULT 0,   -- 本方对对方的好感度 -100..100（每侧独立）
  state           TEXT NOT NULL DEFAULT 'neutral', -- 对称：hostile|friendly|neutral|allied|nemesis
  since           TEXT,            -- 当前 state 生效时间（ISO）
  treaties        TEXT,            -- JSON：见 §2.3
  lastActionAt    TEXT,            -- 最近一次外交动作时间（冷却/骚扰判定）
  updatedAt       TEXT,
  PRIMARY KEY (factionId, otherFactionId)
);
CREATE INDEX idx_faction_diplomacy_pair ON faction_diplomacy(factionId, otherFactionId);
```

概念上仍是「边挂在势力上」：`faction.diplomacy[otherFactionId] = { favorability, state, since, treaties }`。表只是这张稀疏 map 的持久化。运行期由新仓库 `FactionDiplomacyRepository` 读成 `getEdge(a,b)` / `getEdgesFor(a)`。

### 2.2 对称 vs 有向：一半有向、一半对称——「对称字段镜像成对写，好感度每侧独立」

- **好感度 `favorability`：有向**。A 对 B 的好感与 B 对 A 独立（RTK 亲善度即如此：你朝贡讨好对方，对方对你好感升，你对它未必）。存两条条目 `(A,B)` 与 `(B,A)`，各存各的 `favorability`。**这不是镜像**（两个独立事实）。
- **状态 `state`、`since`、`treaties`：对称**（同盟/停战/敌对是双方一致的事实，一个不可能「单方面同盟」）。

对称事实**为什么不「只存一份」而选「镜像成对写」**：SSOT 允许两种落地——(a) 只存 `min(a,b)` 单条、读时按序规范化；(b) 成对写 `(A,B)` 和 `(B,A)`、由**唯一的写命令**保证两条一致。本设计选 **(b) 镜像成对写**，理由：

1. **读路径是单向投影**（`getClientProjectionForPlayer(playerId)` 按 `factionId` 拉「我的全部外交边」），成对存让「A 的外交视图」一次 `WHERE factionId=A` 查完，无需为对称字段做 `OR (a=? OR b=?)` 的规范化排序读。
2. 违背「零镜像」铁律（`single-source-foundation-blueprint` §1）的是**能脱离真相被单独写**的镜像；这里对称两条**只能经唯一写命令 `setState(a,b,newState)` 同时改**，无第二写入口 → 属「派生一致性由单一命令保证」，非病态镜像。守卫要求：任何 `state`/`treaties` 写入必须走 `FactionDiplomacyService.applyStateChange`，禁止直接 UPDATE 单条（表征测试断言成对一致）。

> 决策落点：**好感度有向、双条独立；状态/条约对称、成对镜像但唯一写命令**。规范化 helper `orderedPair(a,b)` 仅用于生成事件 id / 日志去重，不用于存储。

### 2.3 `treaties` 结构（对称，成对镜像）

```jsonc
{
  "alliance":  { "since": "ISO", "expiresAt": "ISO|null", "sharedVision": true },
  "truce":     { "since": "ISO", "expiresAt": "ISO" },   // 停战协议，到期回中立
  "tribute":   { "payer": "faction_ai_3", "amountPerTick": {"grain":80}, "expiresAt": "ISO" }, // 朝贡（有向义务，但登记在对称条约块里，payer 字段标方向）
  "nonAggression": { "since": "ISO", "expiresAt": "ISO" } // 互不侵犯（弱于同盟：不共享视野、不连带参战）
}
```

`treaties` 里**只放协议事实**（起止 + 参数）；协议**产生的效果**（能否攻击、共享视野、每 tick 转移资源）由 §4 规则核**现算**，不烘焙成第二份状态。

### 2.4 派生数据（一律查询，不落第二份）

- 「A 的所有盟友」= `getEdgesFor(A).filter(e => e.state==='allied')`，不存 `faction.allies[]`。
- 「谁在跟我打」= 边 `state∈{hostile,nemesis}`，不存 war 列表。
- 「共同敌人数」= `getEdgesFor(A)` 与 `getEdgesFor(B)` 的 hostile 集合交集大小，tick 里现算喂给好感漂移。
- 客户端外交面板显示的关系，全部来自投影下发的 `diplomacyEdges`，无本地权威副本（同 `single-source-foundation-blueprint` §9 的服务端权威 + 客户端和解态）。

## 3. 机制/规则（纯规则核 vs 服务层）

分两层，严守 `00` §6.3：

- **纯规则核 `shared/diplomacy/DiplomacyRules.js`**（无 IO、无 gameState 写，纯函数，可单测）：
  - `nextState(edge, action, ctx)` → `{ state, since } | null`（状态机，见 §3.1）。
  - `clampFavorability(v)` → `max(-100,min(100,v))`。
  - `favorabilityDrift(edgeAtoB, ctx, tables)` → `deltaPerTick`（自然漂移 + 情境项，见 §3.2）。
  - `applyActionDelta(edge, action, tables)` → `deltaFavorability`（动作即时好感变化）。
  - `canAttack(edge)`, `sharesVision(edge)`, `canTrade(edge)`, `defenseAllies(edgesForDefender)`（效果查询，见 §4）。
  - `evaluateStateTransitionsFromFavorability(edge, tables)` → 好感越阈值触发的**被动**迁移建议。
  - 所有阈值/系数从传入的 `tables`（配置表行）取，规则核**不硬编码数字**。
- **服务层 `backend/services/diplomacy/FactionDiplomacyService.js`**（读写共享表、发事件、供玩家动作与 tick 调用）：
  - `getEdge(a,b)` / `getEdgesFor(a)`（经 `FactionDiplomacyRepository`）。
  - `applyStateChange(a, b, newState, cause)`：**唯一**改 `state`/`since`/`treaties` 的写命令（成对镜像 §2.2）。
  - `adjustFavorability(a, b, delta, cause)`：改**单侧** `(a,b).favorability`。
  - 玩家动作入口 `declareWar/proposeAlliance/acceptAlliance/gift/demandTribute/breakTreaty/sueForPeace`（§6）。
  - tick 入口 `advanceDiplomacy(now)`（§5）。

### 3.1 状态机（5 态 + 迁移）

状态集：`neutral`（中立·默认）、`friendly`（友好）、`allied`（同盟）、`hostile`（敌对）、`nemesis`（仇视）。

**两类迁移**：①**好感被动迁移**（跨阈值自动，双向由 `min(fav_AtoB, fav_BtoA)` 取对称口径——见下）；②**动作主动迁移**（宣战/提盟/破盟/求和，可无视好感）。

对称态由**双侧好感的对称聚合**驱动：定义 `mutualFav = min(favAtoB, favBtoA)`（取小值：只要一方冷淡，关系上不去；符合直觉，也防单方刷礼强推同盟）。

被动迁移（`evaluateStateTransitionsFromFavorability`，每 tick 检查，带滞回防抖）：

| 当前 | 条件（默认阈值，配置表 `diplomacy_state`） | 迁移到 |
|---|---|---|
| neutral | `mutualFav ≥ +40` | friendly |
| friendly | `mutualFav < +25`（滞回，低于进入阈） | neutral |
| neutral | `mutualFav ≤ -40` | hostile |
| hostile | `mutualFav > -25`（滞回） | neutral |
| hostile | `mutualFav ≤ -80` **且** 持续 ≥ `nemesisTicks` | nemesis |
| nemesis | `mutualFav > -60` | hostile |

**同盟/停战不走好感被动迁移**，只能由动作进入/退出（RTK：同盟是签的，不是好感自动升成的）：

动作主动迁移（`nextState`）：

| 动作 | 前置 | 结果 state | 备注 |
|---|---|---|---|
| `declareWar` | 非 allied（盟内需先 `breakTreaty`） | hostile（若已 hostile 且 `mutualFav≤-80`→nemesis） | 单方即可；有停战协议则附带「破盟」名声惩罚 |
| `proposeAlliance`→`acceptAlliance` | 双方均 friendly 及以上、无互相 hostile | allied，写 `treaties.alliance` | **需对方同意**（AI 用 §5.3 接受判定；玩家↔玩家走待处理提案） |
| `breakTreaty`（破盟） | state==allied | neutral，清 alliance | 施加 `betrayalPenalty` 好感与名声（§3.2） |
| `sueForPeace`（求和/停战） | state∈{hostile,nemesis} | neutral + `treaties.truce`（`truceHours`） | 需对方同意；停战期内 `canAttack=false` |
| truce/alliance 到期（tick） | expiresAt ≤ now | 回 neutral | tick 里 `advanceDiplomacy` 处理 |

滞回（进入阈 ≠ 退出阈）避免好感在阈值附近抖动导致状态每 tick 翻转。`nemesisTicks` 要求「深仇」需持续，避免一次大跌就永久宿敌。

### 3.2 好感度的驱动因素（`applyActionDelta` 即时 + `favorabilityDrift` 漂移）

**即时（动作触发，配置表 `diplomacy_favor_delta`，作用于对应单侧或双侧）**：

| 来源 | 对谁 | 默认 Δ | 说明 |
|---|---|---|---|
| 攻击对方城/领土 | 被攻方对我 | -30 | 攻击驱动，接 P0 占城/夺城链 |
| 攻击对方盟友 | 该盟友及其盟主对我 | -15 | 连带 |
| 赠礼 gift | 受礼方对我 | +f(礼值,魅力) | 见公式，边际递减 |
| 朝贡 tribute（每 tick 转移） | 收贡方对贡方 | +5/期 | 持续讨好 |
| 提盟被接受 | 双侧 | +10 | |
| 破盟 betrayal | 被弃方对我 + **全世界**对我 | -50 / 全局 -8 | 名声：对所有第三方轻微 -（RTK 背盟名声） |
| 撕毁停战偷袭 | 被袭方对我 + 全局 | -40 / -6 | |
| 求和被接受 | 双侧 | +8 | |
| 索要/威胁 demand 被拒后开战 | 被威胁方对我 | -20 | |

**漂移（每 tick，`favorabilityDrift`，配置表 `diplomacy_drift`，累加后 clamp）**：

```
drift(A→B) =
    towardNeutralPull                          // 无事件时好感缓慢回归 0（±driftToNeutral/tick，向 0）
  + rulerAffinity(rulerA, rulerB)              // 君主相性：见下
  + sharedEnemyBonus * countSharedEnemies(A,B) // 共同敌人 → 亲近
  + borderPressurePenalty * borderContactLen(A,B) // 接壤越多越紧张
  + allyBonus (若 state==allied)               // 同盟持续增好感
  + warDecay  (若 state∈{hostile,nemesis})     // 交战持续减好感
```

- **君主相性 `rulerAffinity`**（消费脊柱 B `02-person-personality.md` 的 `compatibility` 相性种子 + `personality` 性格）：`affinityDelta = affinityTable[personalityA][personalityB] * affinityScale + compatibilityCloseness(seedA, seedB)`。相性表是配置表 `diplomacy_personality_affinity`（性格×性格 → -3..+3/tick）。相性种子接近（`|seedA-seedB| mod 环距` 小）额外 +。**这条把「活的政治由君主性格决定」落地**。
- `countSharedEnemies`、`borderContactLen` 现查（§2.4），不落副本。`borderContactLen` 复用 `shared_world_territories` 邻接（两势力领土相邻格数）。

**赠礼公式**（`gift`，`diplomacy_favor_delta.giftBase` + 魅力/边际递减）：
```
giftGain = round( giftBase
                  * log2(1 + giftValueGrain / giftValueUnit)   // 礼值边际递减
                  * (1 + rulerCharisma/200)                     // 送礼方君主魅力加成（脊柱B君主 charisma）
                  * diminishing(recentGiftsThisWeek) )          // 短期重复送礼衰减，防刷
```
`recentGiftsThisWeek` 从 `lastActionAt` + 一个轻量计数（存 `treaties._giftLedger` 或独立 tick 计数，避免与好感度混存）。

## 4. 各状态的效果（`DiplomacyRules` 查询，规则核现算，不落第二份）

| 效果查询 | neutral | friendly | allied | hostile | nemesis |
|---|---|---|---|---|---|
| `canAttack`（能否对其城/军行军攻击） | 是* | 是* | **否** | 是 | 是 |
| 主动攻击是否触发好感/名声罚 | 是（-30） | 是（-30，友好背刺额外名声） | 需先破盟 | 否（已敌对） | 否 |
| `sharesVision`（共享视野/雾） | 否 | 否 | **是**（`treaties.alliance.sharedVision`） | 否 | 否 |
| `canTrade`（贸易/资源协议、可发起朝贡） | 是 | 是（优惠率） | 是（最优） | 否 | 否 |
| `defenseAllies`（被第三方攻击时连带参战） | — | — | **是**（盟友可被拉入防御战） | — | — |
| AI 是否倾向对其开战（喂 `05`） | 视利益 | 低 | 极低（除非破盟） | 高 | **最高（优先攻击目标）** |
| 停战期 `truce` 覆盖 | canAttack=否 | — | — | canAttack=否（停战中） | 停战中同样禁攻 |

\* neutral/friendly 攻击**技术上允许**但触发好感暴跌 + 名声（这就是「宣战」的经济：你可以偷袭中立，但代价是全世界好感）。真正的「宣战」动作把 state 显式推到 hostile 并登记，便于 AI 与 UI 识别，且清掉任何 truce/nonAggression。

**同盟效果细节**：
- **互不攻击**：`applyStateChange(...,'allied')` 后 `canAttack=false`；要打必须先 `breakTreaty`（承受 §3.2 背叛惩罚）。
- **共享视野**：`sharesVision=true` 时，投影阶段把盟友已揭示的 tile 只读并入本玩家 fog 投影（复用 `getClientProjectionForPlayer` 的合并机制，投影字段存盘前 strip，不污染本方 fog SSOT）。
- **连带防御**：第三方攻击 A 的城时，结算读 `defenseAllies(getEdgesFor(A))`，允许把在场盟友军队计入防御方（是否自动参战由 AI/玩家在 `05` 决定；本 tick 仅提供「可参战盟友集」查询，不强制）。

## 5. 世界 tick / 事件挂钩

外交模拟**只在 `WorldWorkerService` tick 跑一次**（共享，不每玩家重复；`00` §4.5）。挂载点：`backend/services/realtime/WorldWorkerService.js` 的 `advanceState` 之外，新增一个**每 tick 一次的全局阶段**（不是每玩家一次）。

现状 `advanceState(rawState, now)` 是**每玩家**推进（`getRecentlyActive` 循环）。外交是**世界级共享事实**，必须在玩家循环**之外**跑一次。方案：在 `WorldWorkerService` tick 主循环里，玩家推进循环**前或后**加一个 `advanceWorldSimulation(now)`，其中调用：

```
FactionDiplomacyService.advanceDiplomacy(now):
  for each edge (A,B) in faction_diplomacy:            // 稀疏，只遍历存在的边
    ctx = buildContext(A, B)   // 共同敌人数、接壤格数、君主性格·相性、条约到期
    delta = DiplomacyRules.favorabilityDrift(edge, ctx, tables)
    adjustFavorability(A, B, delta)                    // 单侧
  for each pair:
    handleTreatyExpiry(now)                            // 同盟/停战到期→neutral
    passiveState = DiplomacyRules.evaluateStateTransitionsFromFavorability(edge, tables)
    if passiveState: applyStateChange(A,B,passiveState,'drift')  // 成对镜像
  AiFactionDiplomacyBrain.decide(now)  // 见 05：AI 发起提盟/宣战/赠礼/求和（消费上面算好的边）
```

- **AI 决策入口喂给 `05`**：`AiFactionDiplomacyBrain` 属 `05` 的实现，但**接口在此定义**：它读 `getEdgesFor(aiFactionId)` + AI 势力实力/扩张欲/君主性格，产出外交动作，走**同一批** `FactionDiplomacyService` 玩家动作命令（`declareWar` 等）。玩家和 AI 走同一套写命令，无特例分支。
- **事件挂钩**：外交状态迁移触发 `EventService` 通知（复用 `maybeGenerateRegularEvent` 旁路或新增 `diplomacyEvents`）：「X 势力向你宣战」「Y 提议同盟」「盟友 Z 请求参战」。玩家收到的提盟/求和/参战请求作为**待处理外交提案**（存 `faction_diplomacy.treaties._pendingProposals` 或独立轻表），玩家在外交面板接受/拒绝。
- **频率**：好感漂移每 tick（~5s）幅度极小（±driftToNeutral 量级为「数十 tick 才移动 1 点」，配置 `driftToNeutral≈0.05/tick`），避免好感抖动；状态迁移检查每 tick 但受滞回 + `nemesisTicks` 保护。可选：外交模拟降频到每 N tick（配置 `diplomacyTickEveryN`），减轻负载。

## 6. 玩家外交动作（客户端 UI 面）

外交面板（新 UI 屏，或挂在世界地图势力信息里），对每个已知势力显示：君主头像/名/势力色、`favorability` 条（双向可展开）、`state` 徽章、条约列表、可用动作按钮。动作走后端命令（服务端权威，客户端乐观 + 和解，同 `single-source-foundation-blueprint` §9）：

| 动作 | 后端命令 | 前置/代价 | 结果 |
|---|---|---|---|
| 宣战 | `declareWar(target)` | 非盟；若有停战/互不侵犯附名声罚 | state→hostile，清 truce |
| 提议同盟 | `proposeAlliance(target)` | 双方 friendly+、无互 hostile；消耗提案冷却 | 生成待处理提案，对方接受→allied |
| 接受/拒绝提案 | `respondProposal(id, accept)` | 有待处理提案 | 接受→执行迁移 |
| 赠礼 | `gift(target, {grain,...})` | 扣本方资源（`diplomacy_treaty_cost.giftMin`） | 对方对我好感 +（§3.2 公式） |
| 索要/威胁 | `demand(target, {type})` | 本方实力/君主魅力判定 | 对方屈服（给资源/停战）或拒绝（好感 -） |
| 提出朝贡 | `offerTribute` / `demandTribute` | 强弱势力间 | 写 `treaties.tribute`，tick 每期转移资源 + 好感 |
| 求和/停战 | `sueForPeace(target)` | state∈{hostile,nemesis} | 对方同意→neutral + truce |
| 破盟 | `breakTreaty(target)` | state==allied | neutral + `betrayalPenalty` + 全局名声 - |

玩家↔玩家外交：提案/求和/朝贡是**异步双方确认**（对方玩家下次上线在面板处理待处理提案）。玩家↔AI：AI 用 §5 的接受判定**同 tick 或下 tick**给出应答。

**教程/新手保护**：出生安全区（`garrison.bandId==='safe'`，`≤3` 格）势力对玩家默认 neutral 且 AI 不主动宣战新手（配置 `diplomacy_ai` 的 `newbieProtectTicks`），避免刚出生被打崩。

## 7. 配置表映射（Excel → `backend/config/generated/*.json`，走 `config/tables/table-schemas.js` 契约 + 新鲜度门禁）

新增 5 张表（P1/P2，按 `docs/config-tables/README.md` 流程 scaffold + 门禁）：

**`diplomacy_state`（状态阈值 + 滞回）** — 主键 `stateId`：

| 字段 | 类型 | 含义 |
|---|---|---|
| stateId | string | hostile/friendly/neutral/allied/nemesis（主键） |
| enterFavor | int | 进入本态的好感阈（对称 mutualFav），不适用填空 |
| exitFavor | int | 退出本态的好感阈（滞回，≠enter） |
| minTicks | int | 进入本态前需满足条件的最少 tick（如 nemesis 的深仇持续） |
| canAttack | bool | 本态默认能否攻击对方 |
| sharesVision | bool | 是否共享视野 |
| canTrade | bool | 是否可贸易 |
| defenseAlly | bool | 是否连带防御 |

**`diplomacy_favor_delta`（动作即时好感）** — 主键 `actionId`：

| 字段 | 类型 | 含义 |
|---|---|---|
| actionId | string | attackCity/attackAlly/gift/tributeTick/allianceForm/betrayal/truceBreak/sueForPeace/demandRefusedWar（主键） |
| targetDelta | int | 对直接对象方的好感 Δ |
| globalDelta | int | 对全世界第三方的名声 Δ（背盟/偷袭用，其余 0） |
| giftBase | float | 赠礼基数（仅 gift 行用） |
| giftValueUnit | int | 赠礼边际递减单位（粮） |

**`diplomacy_drift`（每 tick 漂移系数）** — 主键 `factorId`（单行多字段或每因子一行）：

| 字段 | 类型 | 含义 |
|---|---|---|
| factorId | string | 主键（如 `default`） |
| driftToNeutral | float | 无事件时向 0 回归速度/tick（如 0.05） |
| sharedEnemyBonus | float | 每个共同敌人 +/tick |
| borderPressurePenalty | float | 每格接壤 -/tick |
| allyBonus | float | 同盟持续 +/tick |
| warDecay | float | 交战持续 -/tick |
| affinityScale | float | 君主相性表整体缩放 |
| diplomacyTickEveryN | int | 外交模拟每 N tick 跑一次（降频） |
| nemesisTicks | int | 深仇持续多少 tick 才升 nemesis |
| newbieProtectTicks | int | 新手保护期 tick |

**`diplomacy_personality_affinity`（君主性格×性格相性）** — 主键 `pairId`（`性格A_性格B`），字段 `personalityA/personalityB/affinityPerTick(-3..3)`。性格枚举来自脊柱 B `02-person-personality.md`（如 刚直/义气/野心/温厚/多疑/…）。

**`diplomacy_treaty_cost`（动作代价/门槛）** — 主键 `treatyId`：

| 字段 | 类型 | 含义 |
|---|---|---|
| treatyId | string | alliance/truce/tribute/gift/nonAggression（主键） |
| truceHours | float | 停战协议时长 |
| allianceHours | float | 同盟默认时长（0=无限，需破盟解除） |
| giftMin | int | 赠礼最小资源门槛 |
| proposalCooldownHours | float | 同一对提案冷却 |
| minFavorToPropose | int | 提盟所需最低 mutualFav |
| betrayalFavorPenalty | int | 破盟对被弃方好感 Δ |

**校验**（`--check` 门禁 + scaffold 时）：`diplomacy_state.stateId` 必须恰好覆盖 5 态；`enterFavor/exitFavor` 需构成有效滞回（exit 在 enter 内侧）；相性表覆盖性格枚举全对；漂移系数非负性。

## 8. 实现切片（有序、每片可测）

> 每片：纯规则核先行 + 单测（表征/等价），再服务层接线，再对抗性 review，最后合入。数值全走配置表。**依赖脊柱 A/B 已落地**（本 doc 假定 `01`/`02` 先行；若并行，切片 D0 先用桩势力/桩君主性格）。

- **D0 · 共享外交存储**：建 `faction_diplomacy` 表 + `FactionDiplomacyRepository`（`getEdge/getEdgesFor/upsertEdge/setStatePaired`），接入 `GameStateRepository` 共享世界层与 `getClientProjectionForPlayer`（下发 `diplomacyEdges`，存盘前 strip）。测：成对镜像一致、投影只读、单侧好感独立。
- **D1 · 规则核**：`shared/diplomacy/DiplomacyRules.js`（状态机 `nextState`、`favorabilityDrift`、`applyActionDelta`、效果查询、滞回/clamp）。纯函数单测覆盖全部迁移矩阵 + 阈值边界 + 相性项。
- **D2 · 配置表**：5 张表 schema + 种子 + scaffold + 门禁校验（§7）。测：`--check` 新鲜度、5 态覆盖、滞回合法。
- **D3 · 服务层 + 好感即时/漂移接线**：`FactionDiplomacyService`（读写 + 唯一写命令 + 事件）。把攻击城/领土（接 P0 占城/夺城链）挂 `attackCity` 好感罚；tick 里接 `advanceDiplomacy` 好感漂移 + 到期处理 + 被动状态迁移。测：一次攻击→好感/状态正确迁移；漂移收敛。
- **D4 · 世界 tick 全局阶段**：`WorldWorkerService` 加 `advanceWorldSimulation(now)`（每 tick 一次，非每玩家），调 `advanceDiplomacy`。测：多玩家一 tick 只模拟一次外交（不重复）。
- **D5 · 玩家动作命令 + 投影**：`declareWar/proposeAlliance/respondProposal/gift/demand/offerTribute/sueForPeace/breakTreaty` 后端命令 + 路由；待处理提案存储 + 玩家应答。测：宣战清 truce、提盟需双方、破盟名声全局罚、赠礼公式。
- **D6 · 效果落地**：同盟互不攻击（拦 P0 行军/攻击对盟友）、共享视野（投影并入盟友 fog）、连带防御可参战集、贸易/朝贡 tick 转移。测：盟内 canAttack=false、sharedVision 投影、朝贡每期转移 + 好感 +。
- **D7 · AI 外交接口**：定义 `AiFactionDiplomacyBrain.decide(now)` 契约（读边 + 势力实力/君主性格 → 走同一批命令），桩实现（保守：只应答提案、不主动开战），把真正决策留给 `05`。测：AI 应答提盟/求和的接受判定。
- **D8 · 客户端外交面板**：势力列表 + 好感条 + 状态徽章 + 条约 + 动作按钮 + 待处理提案；乐观 + 和解，无本地权威副本。真机验收（唯一一次实机）。

每片独立 gate 绿提交；tests 当 oracle；最后一次实机验外交面板 + 一场「宣战→交战→求和→同盟→破盟」完整闭环。

---

## 审查发现（单一事实源 + 缺口，落地前修正）

### 单一事实源违规（须改为查询/投影，不得复制）
1. 【朝贡 amountPerTick 与 payer 存进对称镜像的 treaties 块 = 有向事实塞进对称载体】§2.3 把 tribute（{payer, amountPerTick, expiresAt}）登记在 treaties 里，而 treaties 被 §2.2 定为『对称、成对镜像写 (A,B) 与 (B,A)』。tribute 本质有向（谁向谁进贡、每 tick 转移多少），靠一个 payer 字段标方向。这就是把一份有向事实复制进了两条镜像条目：(A,B).treaties.tribute 和 (B,A).treaties.tribute 会存同一个 {payer, amountPerTick}。任何一条被单独改（例如调贡额）另一条即分叉，且 tick 里遍历边时会对同一贡约转移两次资源（A 侧一次、B 侧一次），除非额外去重——文档未给去重规则。应把 tribute 从对称 treaties 剥离，做成独立有向事实（单条 (payer→payee) 或复用 favorability 的有向条目侧），不要塞进镜像块。
2. 【giftLedger / recentGiftsThisWeek 混存进对称 treaties._giftLedger】§3.2 赠礼公式的 diminishing(recentGiftsThisWeek) 说『存 treaties._giftLedger 或独立 tick 计数』。赠礼计数是有向的（A 向 B 送礼的短期次数 ≠ B 向 A），塞进对称镜像的 treaties 块又是把有向事实放进对称载体，且『_giftLedger』这种下划线私有键混进条约事实块违反 §2.3『treaties 里只放协议事实』的自订铁律。文档自己也含糊（『或独立轻量计数』），说明落点未定。应钉死为有向条目 (A,B) 的独立字段，不进 treaties。
3. 【_pendingProposals 存进 treaties 违反自订约束且方向不清】§5 把待处理外交提案存 faction_diplomacy.treaties._pendingProposals。提案是有向的（A 向 B 提盟），再次塞进被定义为对称镜像的 treaties 块；且提案在被接受前根本不是『协议事实』（§2.3 说 treaties 只放已生效协议的起止+参数），把未决提案混进去让『成对镜像一致』表征测试与『提案只存单侧』矛盾。文档给了『或独立轻表』的逃生口，等于承认落点未定，应直接定为独立表，从 treaties 移除。
4. 【since 字段与 treaties.alliance.since / truce.since 重复】表结构顶层有 since（当前 state 生效时间），而 treaties.alliance.since、treaties.truce.since 又各存一份『本协议起始时间』。当 state==allied 且由结盟动作进入时，顶层 since 与 treaties.alliance.since 记录的是同一事件时间戳，两份可分叉（例如破盟后重结盟只更新其一）。需明确：顶层 since 派生自当前 state 对应 treaty 的 since（查询），或直接不在 treaties 内重复存 since。
5. 【mutualFav = min(favAtoB, favBtoA) 每 tick 现算 vs 状态被动迁移落地——对称态由两条独立有向事实驱动，但滞回/minTicks 需要跨 tick 记忆，文档未指明该记忆存哪】§3.1 nemesis 要求『mutualFav≤-80 且持续≥nemesisTicks』，滞回要求记住『进入本态的时刻』。这份『已持续多少 tick』的计数是对称态的派生记忆，但设计既没说它存在顶层（哪条条目？两条都存=镜像）也没说由 since 派生。若两条镜像条目各存一份 tickCounter,即镜像;若只存一条则破坏『WHERE factionId=A 一次查完』的成对读理由。need 单源澄清:该计数应由 since 派生现算(now-since)/tickMs,不落第二份。
6. 【globalDelta 全局名声惩罚是对『全世界每个第三方对我的 favorability』逐条 -8，实际是把一次背盟事件的后果烘焙成 N 条有向事实的批量写，而非存一次『名声/污点』事实由查询派生】§3.2 背盟 -8/全局、偷袭 -6/全局，写法是遍历所有其它势力的 (X, me) 条目各减。这不算镜像，但把『我背过盟』这一条声誉事实物化成了对全体条目的一次性烘焙写入，之后无法回答『我的名声值是多少』（已摊进各条 favorability 无法分离），也无法让新加入世界的势力继承这份名声。更单源的做法是存一个有向/无向的 reputation/infamy 标量事实，favorability 读取时把它作为项现算。文档把它做成批量写是可用但非单源。

### 缺口 / 待补机制
1. 【致命前置缺失：脊柱 B 的 personality/compatibility 根本不存在】rulerAffinity（§3.2，被文档称为『把活的政治由君主性格决定落地』的核心项）依赖 famousPerson 的 personality 枚举与 compatibility 相性种子。实测 backend/services/famousPerson/FamousPersonConstants.js 里没有任何 personality/compatibility/charisma 字段（grep 0 命中），02-person-personality.md 也未写（docs/design/ 下只有 00）。整套好感漂移的招牌驱动力没有事实源可读。D0『桩君主性格』只是占位，意味着 D1~D3 的相性单测全是对桩打的，相性表 diplomacy_personality_affinity 的性格枚举无权威来源可校验（§7 校验项『相性表覆盖性格枚举全对』无枚举可覆盖）。
2. 【AI 势力事实源与现状严重冲突，迁移未提】设计假定 AI 势力活在共享 ai_faction_state（平行 shared_world_territories）。实测现有唯一 AI（WorldAiExplorerService）活在【每玩家】gameState.worldAi.explorers（backend/services/WorldAiExplorerService.js:102/164/226），是 per-player 的，且 advanceState 里 advanceWorldAi:false。faction_diplomacy 的边、AI 决策、共享 tick 全建立在一个尚不存在、且与现有 per-player AI 语义冲突的 ai_faction_state 上。文档把 01/05 的存在当既成事实，但 D0 却要接 getEdgesFor(aiFactionId)——AI 势力 id 从哪来、如何与现有 worldAi 迁移/共存，完全空白。
3. 【advanceDiplomacy 的世界级阶段与现有 per-player tick 的事务/并发模型冲突】实测 tickOnce()（WorldWorkerService.js:95-126）是 per-player for 循环 + advancePlayerWithRetry（每玩家独立 findByPlayerId→advanceState→save，靠 revision 冲突重试）。faction_diplomacy 是跨玩家共享表，advanceDiplomacy 在循环外写它时，攻击城导致的好感即时罚（§3.2，由玩家动作在 API 线程写）与 tick 漂移写会并发。设计只说『玩家循环前或后加一个 advanceWorldSimulation』，完全没讲：(a) 共享表写的事务边界/锁（GameStateRepository 的 save 是 per-player transaction，faction_diplomacy 不在其中）；(b) 若 diplomacyTickEveryN 降频，则某 tick 跑某 tick 不跑，玩家动作触发的即时迁移与 tick 被动迁移的读写序不确定。
4. 【共享视野声称复用 getClientProjectionForPlayer 的 fog 合并，但该机制目前只合并 shared_world_territories，没有任何『把盟友已揭示 tile 并入本玩家 fog 投影』的能力】实测 getClientProjectionForPlayer（GameStateRepository.js:205-211）只返回 sharedWorldTerritories；fog 揭示历史存在 per-player 的 WorldMapVisionHistory（worldAi.playerSyncedCanonicalIds 等），是玩家私有的。§4『把盟友已揭示 tile 只读并入本玩家 fog 投影、存盘前 strip』所依赖的『盟友 fog 可跨玩家读取』的投影通道根本不存在，也没设计。这是 D6 的核心效果之一，却被一句『复用合并机制』带过。
5. 【玩家↔玩家异步双方确认外交完全欠规格】§6 说提盟/求和/朝贡对玩家↔玩家是『对方下次上线在面板处理待处理提案』。但：提案过期怎么办（无 TTL 字段）？提案冷却 proposalCooldownHours 在提案未决期间是否阻止再提？对方离线数周期间己方能否撤回？两个玩家同 tick 互相提盟的竞态如何解？respondProposal(id) 的 id 生成/去重（§2.2 说 orderedPair 只用于事件 id 不用于存储，那提案 id 谁发）？全部空白。
6. 【declareWar 的『破盟名声惩罚』与『必须先 breakTreaty』矛盾】§3.1 declareWar 前置写『非 allied（盟内需先 breakTreaty）』，但同表备注又写『有停战协议则附带破盟名声惩罚』且『清掉任何 truce/nonAggression』。allied 被前置排除、必须先 breakTreaty；那 declareWar 面对 truce/nonAggression 时是允许并附罚、还是也要求先撕约？§6 表格写『非盟；若有停战/互不侵犯附名声罚』=允许附罚。三处（§3.1 迁移表、§3.1 动作矩阵、§6）对『有约时能否直接宣战』口径不完全一致，边界未钉死。
7. 【canAttack 效果查询与实际拦截点（P0 行军/攻击链）未接】表格给出 canAttack(edge)=false 于 allied，但现有攻击是走 worldMarch/worldCombat 链（shared/worldMarchCore.js、worldCombat 服务）。D6 说『拦 P0 行军/攻击对盟友』，但没指明在 startWorldMarch 还是到达结算处拦、被拦时的错误码/回滚、以及行军途中关系变盟（tick 漂移到 allied 或对方接受提盟）时已在途军队怎么处理（继续打盟友？中途返程？）。in-flight 关系变更这一整类边界零处理。
8. 【favorabilityDrift 的收敛性与 clamp 顺序未定义】drift 每 tick 累加 towardNeutralPull + rulerAffinity + sharedEnemyBonus*n + borderPressurePenalty*len + allyBonus/warDecay。towardNeutralPull『向 0』但其它项可持续把好感推离 0：若 rulerAffinity=+3/tick 且 towardNeutral=0.05/tick，好感会被钉在 +100 而 towardNeutral 永远拉不回——所谓『无事件时回归 0』在有持续相性/接壤项时根本不成立，稳态值未分析。D3 测『漂移收敛』但收敛到哪个不动点没有定义。borderContactLen 无上限时 borderPressurePenalty*len 可能单 tick 就吃满 -100，滞回也压不住状态每 tick 在 hostile 边界抖。
9. 【朝贡/贸易的资源转移与城市资源事实源的接线缺失】§4 canTrade/tribute 每 tick 转移资源，但玩家资源事实源现在是 cities[] 内（GameStateRepository.js:350 注释：sole truth in cities[]，顶层 resources 已废）。tribute payer 是某个 AI 势力或玩家；从『谁的哪座城』扣粮、AI 势力资源存哪（ai_faction_state 未定义资源字段）、跨玩家转移的事务如何与 per-player save 协调，全无。§6『扣本方资源 diplomacy_treaty_cost.giftMin』同理：从活动城扣还是全城？不足时？
10. 【新手保护判定字段错位】§6 新手保护写『garrison.bandId===safe（≤3 格）势力对玩家默认 neutral』。但 garrison 表（table-schemas.js）的 bandId 是【城到首城的距离档】，描述的是空城守军强度，跟『某个 AI 势力是否为新手保护对象』无关。把 AI 势力的开战抑制挂在 garrison.bandId 上是张冠李戴；应有独立的 per-player 新手期（出生后 newbieProtectTicks 内）判定，且该判定需要玩家出生时间事实源（players.createdAt 存在，但设计没引用）。
11. 【diplomacy_drift 单行塞入 diplomacyTickEveryN/nemesisTicks/newbieProtectTicks 等非漂移全局常量，表语义混杂】§7 diplomacy_drift 主键 factorId=default，却把 tick 频率、深仇 tick、新手保护 tick 混进『每 tick 漂移系数』表。这些不是漂移系数而是调度/状态机常量，塞进 drift 表让主键『每因子一行』与『单行多字段』两种说法自相矛盾（文档括号自己写『单行多字段或每因子一行』未定），且校验项『漂移系数非负性』会误伤这些非系数字段。
12. 【favorability 初始化 / 边的惰性创建规则缺失】表 DEFAULT 0 + neutral，但边是稀疏的（§5『只遍历存在的边』）。两个此前无往来的势力第一次交互（第一次攻击/赠礼）时边不存在，adjustFavorability/applyStateChange 必须惰性 upsert 两条（有向各一 + 对称镜像两条）。谁负责首次建边、建几条、rulerAffinity 这类每 tick 项是否要求边必须预先对所有势力对存在（否则漂移永不发生在『还没结仇的邻居』之间，与 borderPressure 立意矛盾——接壤但从未交互的两势力好感永远 0 不漂移）。惰性建边 vs 全量建边的取舍直接决定 tick 遍历成本，未定。
13. 【状态机缺 friendly↔allied 的好感回落联动】allied 只能靠动作进入/退出，但 allied 期间若 mutualFav 因 warDecay 之外的因素跌破 friendly 甚至 hostile 阈值，state 仍是 allied（被动迁移不碰同盟）。于是出现『关系状态=同盟但双方好感已是敌对区间』的僵尸同盟，只能等 allianceHours 到期或主动破盟。是否需要『好感跌破阈值自动触发同盟破裂+名声罚』未定义，这是 RTK 里同盟因不满自动解除的常见机制，被完全省略。

## 待你确认的设计问题
1. 同盟连带防御是【自动参战】还是【可选参战】？RTK 里同盟被攻击会来请求援军但你可拒绝（拒绝掉好感/毁盟）。本设计默认『提供可参战盟友集，是否参战由玩家/AI 决定，拒援有好感惩罚』——确认这个粒度，还是要自动强制参战？
2. 玩家↔玩家外交的异步确认：对方玩家离线时，提盟/求和/朝贡提案是【挂起等其上线处理】还是【超时自动拒绝】？超时时长？（AI 势力是同 tick 应答，无此问题。）
3. 好感度对称聚合口径：本设计用 mutualFav=min(favAtoB,favBtoA) 驱动对称状态迁移（一方冷淡则关系上不去）。是否认可 min？还是要 average（更宽松，单方热情能拉动关系）？
4. 朝贡（tribute）是否纳入本外交系统的首版？它涉及每 tick 跨势力资源转移，和贸易/经济耦合较深。可以先只做 好感/状态/同盟/停战，把朝贡+贸易协议推到经济系统或 05 之后。
5. 破盟/偷袭的『全局名声惩罚』（对所有第三方 -8 好感）范围有多大？只对【认识/接壤】的势力，还是真的全世界所有势力？全世界在势力数量大时是 O(N) 广播，需确认。
6. 君主性格·相性驱动好感漂移强依赖脊柱 B（02-person-personality.md）的性格枚举与 compatibility 相性种子定义。这两者的字段名/取值范围需在 02 先钉死；本 doc 的 diplomacy_personality_affinity 表结构是否要等 02 的性格枚举确定后再填种子？
7. AI 主动外交（宣战/提盟发起）的决策实现归属 05（本 doc 只定接口 AiFactionDiplomacyBrain.decide 与桩）。确认这个边界——本 doc 不实现 AI 主动决策逻辑，只保证接口 + 保守桩，对吗？
