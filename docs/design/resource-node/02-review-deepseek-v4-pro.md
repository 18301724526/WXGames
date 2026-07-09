# 资源地系统 — 异步/边界/一致性评审 (deepseek-v4-pro)

> 审阅对象：`01-design-draft-glm-5.2.md`
> 冻结需求基准：`00-brief-2026-07-09.md`
> 审查镜头：异步路径 / 状态机漏洞 / PVPVE 共享世界一致性 / 文件路径真实性
> 评级：blocker（与冻结需求冲突）/ major（设计缺口导致实现受阻或上线风险）/ minor（可修正偏差）

---

## 一、需求一致性检验

逐条对照冻结需求 §一，未发现直接违反。所有 7 条冻结需求在初稿中均有对应设计：等级 1-10（§2.1）、四类型（§2.1 type 列）、每秒收益（§3.6）、1 分钟部署期（§3.3 deploySeconds=60）、部署期移动检查+中止确认框（§3.3+§4.2）、互相攻占（§3.2 contested→owned→被夺 闭环）、美术清单（§7）。

**但需求 #5 的实现覆盖存在精度问题：** "部署期内队伍不可移动、不可撤退" 初稿在 `WorldExplorerActions` 中对 `startWorldMarch`/`returnWorldMarch`/`stopWorldMarch` 做校验（§6.2），但未覆盖 "部署期内玩家被第三方夺占城市导致部队强制召回" 的边界 —— 如果部署中玩家的首都遭受攻击、游戏硬规则要求该编队回防，冻结需求并未给出豁免，需要 owner 决策是否允许此断开。

→ **分级：major**（不影响 P0 实现但需在 spec 阶段补充裁决）

---

## 二、异步路径三条腿一致性

### 2.1 部署期被攻击 —— 保护窗完整但有"部署结束瞬间"竞态

**初稿设计（§3.3）**：部署期 node `status='deploying'`，不作为可攻击 encounter 投影；`getActiveEncounterAt` 过滤 `status==='active'`。

**仓库证据**：`backend/services/worldCombat/WorldCombatEncounterService.js:363-376`

```js
function getActiveEncounterAt(...) {
  ...
  getSharedEncounters(...).find(
    (item) => item.status === 'active' && item.tileId === tileId,
  );
}
```

该函数只匹配 `status === 'active'` 的 encounter。deploying 态确实不会被命中，第三方发起 `openSession` 会收到 `WORLD_COMBAT_ENCOUNTER_NOT_FOUND`，保护窗有效。✅

**竞态 #A — 部署结束瞬间第三方抢攻**：部署 timer 到达 `completesAt` 的同一 tick 内，若第三方已在 tile 上且同时发起进攻，状态从 `deploying→owned` 与第三方 `openSession→resolveSession` 存在 TOCTOU 窗口。初稿 §3.3 末尾称"允许于部署期结束后立刻抢攻"，但未描述 status 原子写与 battle open 之间的顺序保证。

→ **分级：major**（需在 spec 中明确：deploy→owned 原子性与 encounter 投影的 happens-before 关系，建议 resource node 的 owned 态先不投影为 encounter，需下一个 tick 才可被攻）

### 2.2 离线/断线路径——两条战斗结算路径的 defeat 行为不一致

**初稿 §3.2** 称：败北后编队按 `returnWorldMarch` 同构自动返程（对齐 `WorldCombatSessionService.js:278-281`）。

**仓库证据**：

| 路径 | 代码位置 | defeat 行为 | returnWorldMarch? |
|---|---|---|---|
| 交互式 | `WorldCombatSessionService.js:278-281` | `returnWorldMarch` 回城 | ✅ 是 |
| 被动/离线 | `WorldCombatEncounterService.js:570-624` `resolveEncounterBattle` | 只更新 snapshot，**不返回** | ❌ 否 |

`resolveEngagedTimeouts`（`WorldCombatEncounterService.js:685`）→ 即 45s 离线兜底 → 调用的是 `resolveEncounterBattle`，它 **不调用** `returnWorldMarch`。这意味着：
- 玩家在攻打资源地守军时断线 → 45s 后被动结算 → 若败北，编队残兵留在 tile 上不返程。
- 初稿引用 `WorldCombatSessionService.js:278-281` 是交互式路径的行为，不适用于离线兜底路径。

→ **分级：major**（两条路径行为不一致，离线败北编队滞留不返程，与初稿声称的 "三条腿一致性" 矛盾）

### 2.3 离线收益结算——选型正确但接入点未详细化

**初稿 §3.6** 选用 tick 模型而非三条腿（与资源地"持续状态式被动产出"性质匹配）。接入点：
- 在线：`advanceAllCities`（`CityService.js:254`）
- 离线：`calculateOfflineIncomeForAllCities`（`CityService.js:298`）

**仓库证据**：
- `CityService.js:254-296` `advanceAllCities` 遍历 `gameState.cities`，追加资源地收益需要在此循环后/内外加遍历 `sharedResourceNodes`。`gameState` 可达，可行。✅
- `CityService.js:298-360` `calculateOfflineIncomeForAllCities` 同理，`gameState` 可及。但需注意该函数当前只产出 `incomeByCity`（per-city 离线报表），资源地收益需回写某一城市时需要一个明确的"归入城市"约定。初稿 §3.6 指定"首都活动城市"，但 `calculateOfflineIncomeForAllCities` 的返回值结构（`activeIncome`/`incomeByCity`）需要扩增才能表达"资源地贡献——非城市自身产出"这一信息。**设计未给出如何修改此返回值以让前端正确展示离线收益来源。**

→ **分级：major**（缺失离线收益报表的结构扩展设计，前端无法区分"城市自身离线产出"与"资源地离线收益"）

### 2.4 部署期内断线——部署 timer 过期检查时机未定义

初稿 §3.4：`deploy.completesAt` 到点 → tick 推进 `status='owned'`。但未指定这个 check 在哪个 tick 回路执行。
- 备选 A：`advanceAllCities` tick（每次心跳/worker tick 都执行）— 每个 player 的 gameState 独立，部署期 completion 是 player-private 事件；但 `sharedResourceNodes` 是该 player 的私有投影还是共享世界实体的一部分？初稿 §1.1 说 nodes 是 "共享世界实体"——但 completion 又是 player-private 事件（某个特定玩家的占领结果）。
- 这个结构矛盾意味着：要么 sharedResourceNodes 需要区分 per-player 状态投影（增加复杂度），要么 deployment completion 的逻辑必须能识别"当前处理的是哪个玩家"。

初稿 §1.1 `claimantFactionId` 和 `ownerFactionId` 已经区分了占领申请人，但 completion check 需要一个遍历所有 faction 的全局 tick（类似 AI faction tick），而不是当前 CityService 的 per-player tick。**现有 heartbeat/worker 架构没有"全局共享世界 tick"回路** —— WorldCampSpawner 的铺设是确定性生成的，encounter 的 respawn 是 lazy-check（首次访问时检查），没有全局定时回调。

→ **分级：major**（deploy→owned 的"到点触发"缺少可接入的定时回路，建议改用 lazy-check 模式：下次该 node 被任一玩家查询/行军抵达时，先检查 `completesAt` 是否已过期再返回当前状态，这样不需要新增全局 tick）

---

## 三、状态机漏洞

### 3.1 双写竞态：`contested→deploying` 与 `uncontrolled→contested` 并发

初稿 §3.2 战斗胜利后 `status='deploying'` 的 set 和第三方在别的 tick 对该 node 尝试行军→`resolveMarchTarget`→`getActiveEncounterAt` 有可能交叉：
- Tick A：战斗胜利，`status` 尚未写回 → node 仍是 `active` encounter
- Tick B：第三方行军到 tile，`getActiveEncounterAt` 命中该 encounter → 创建新的 combat mission
- Tick A：`status='deploying'` 写回
- 结果：两个玩家同时认为自己在处理同一个 node

**初稿未讨论 node 与 encounter 的状态切换原子性**。现有营地系统通过 `sharedWorldEncounters` 的单写者模式（`WorldEncounterRepository.upsertEncounter`）解决类似问题；但资源地同时存在于 `sharedResourceNodes`（新命名空间）和作为 encounter 投影，多 namespace 写入存在不一致窗口。

→ **分级：blocker**（需设计原子状态转换，建议部署期保护由 encounter 本身驱动——战胜后 encounter 的 status 直接变为 `'contested_by_playerX'` 而非先设为 `'resolved'` 再新开 resource node 状态，保持单数据源）

### 3.2 owned→被夺时的守军构造竞态

初稿 §3.4：`status='owned'` 时被第三方攻击，"胜则该方进入新一次 deploying"。但被夺时的**防御方**是谁？
- 初稿决策 #2 说防御体 = 当场攻打用的那支编队就地转为驻防
- 但若占领编队已被玩家撤回（决策 #2 说 "撤走即触发被夺窗口：tile 无人则资源地立刻回到 uncontrolled"）

"立刻回到 uncontrolled" 没有 tick 回路执行。当前代码中没有任何机制检测"某 formation 离开某 tile 后释放某 resource node"。需要在 `startWorldMarch`/`returnWorldMarch`/`stopWorldMarch` 中遍历 `sharedResourceNodes` 检查当前 mission 是否为某 node 的唯一驻防。

→ **分级：major**（缺少 tile-formation-node 三向引用，建议在 mission 上增加 `defendingNodeId` 字段，离开时触发 releaseNode 清理）

### 3.3 重入防护缺失

初稿 §3.2 称"复用同一 session 槽（`WORLD_COMBAT_SESSION_BUSY`）"——但这是 **player-level** 锁（一个玩家同时只能有一个战斗 session），不是 **node-level** 锁。两个不同玩家可以同时开启对同一 resource node 的 battle session（如果 node 同时被两个 encounter 投影暴露给两个玩家）。现有营地系统也有这个问题——营地是 per-player client projection，共享 world encounter 只有一个——与资源地的 entity-per-node 模型不同。

→ **分级：major**（需要 node-level 互斥，否则 A、B 两玩家同时战胜同一 node 守军时，谁的 deploying 生效？）

---

## 四、PVPVE 与现有 march/battle/garrison 链路一致性

### 4.1 共享世界 entity 投影断裂

**初稿 §1.1** 将资源地定义为 `gameState.sharedResourceNodes` 命名空间，独立于 `gameState.worldCombat.sharedEncounters`。

**仓库证据**：
- `getActiveEncounterAt` (`WorldCombatEncounterService.js:363`) 搜索 `sharedEncounters`
- `openSession` (`WorldCombatSessionService.js:79`) 调用 `getActiveEncounterAt` 找 encounter
- `resolveMissionArrival` (`WorldCombatEncounterService.js:660`) 通过 `getArrivedEncounterForMission`→`getActiveEncounterAt` 找 encounter

**所有 combat 入口搜索的都是 `sharedEncounters`，不是 `sharedResourceNodes`。** 初稿 §6 称 "资源地作为共享 encounter 喂入开/结战斗"——但初稿未给出从 `sharedResourceNodes` 到 encounter 的**转换/投影映射层**的设计。如果期望资源地在 combat 系统中表现为一个 encounter，那么：
- 谁负责创建这个资源地 encounter？
- 它的 `id` 如何与 `resource node id` 关联？
- 它的 status 属于 encounter 的 status（active/resolved）还是 node 的 status（uncontrolled/contested...）？
- 两者之间的 dual-write 如何保持一致性？

→ **分级：blocker**（不解决此双模型映射，§3.2 声称的"完全复用 WorldCombatSessionService.openSession / resolveSession"无法实现——这些函数找不到 resource node）

### 4.2 aiFactionId 引用路径错误

**初稿 §1.1（第 62 行）**：`shared/faction/aiFactionCore.js::aiFactionId(slug)`

**仓库证据**：
- `shared/faction/aiFactionCore.js` ✅ 存在，但**不包含** `aiFactionId` 函数
- `shared/faction/factionCore.js:27` ✅ 包含 `function aiFactionId(slug) { return 'ai_' + toStr(slug); }`

→ **分级：minor**（函数在 `factionCore.js`，不在 `aiFactionCore.js`，引用者会找错文件）

### 4.3 GarrisonPolicy 守军公式对照

**初稿 §2.2**：守军 = `baseSoldiers + soldiersPerLevel × level`（纯等级线性）

**仓库证据**：`backend/services/territory/GarrisonPolicy.js:37-42`

```js
function garrisonSoldiers(band, scale) {
  return base + perScale * scale;
}
```

现有守军公式：`base + soldiersPerScale × scale`（scale 是地盘规模，不是等级）。初稿改用 level 作为因数，与现有 band-based 模型不同形，但初稿明示资源地守军 "自有 resource_node_garrison 表，不走城 garrison 表"（§6 行 275）。这是有意识的设计分歧而非疏漏。✅

BUT：初稿 §2.2 称守军 leader 生成 "走同一 DefenderLeaderService" —— 对齐 `createDefenderLeader` 的 `type:'camp', owner:'tribe'`。资源地的 type 应取何值？现有 type 只有 `camp`/`ruin_guardians` 等，资源地需要新 profile。**初稿未定义资源地守将的 `owner` profile 值。**

→ **分级：major**（DefenderLeaderService 无资源地对口 profile，缺失 profile 定义则 leader 生成会失败或 fallback 到意外行为）

### 4.4 AI 势力行动 token 注册

**初稿 §8 决策 #7**：新增 `CLAIM_RESOURCE_NODE` 并入 `'expand'` 权重类。

**仓库证据**：`shared/faction/aiFactionCore.js:17-26`

```js
const ACTIONS = Object.freeze({
  SETTLE_NEUTRAL: 'SETTLE_NEUTRAL',
  ATTACK_CITY: 'ATTACK_CITY',
  BUILD: 'BUILD',
  ...
});
```

新增 `CLAIM_RESOURCE_NODE` 需要在 `ACTIONS` 枚举中注册。`scoreExpansionTargets` 函数（`aiFactionCore.js:78`）当前接受 `candidates` 数组，candidates 的形状（`territoryId, distance, ownerKind, defenderSoldiers, value, protected`）是城市和营地专用形状——资源地的候选评分需要不同的字段（`nodeId, type, level, yieldPerSecond, ...`）。**初稿未给出 resource node 的候选评分函数签名或如何复用 `scoreExpansionTargets`。**

→ **分级：major**（P0 虽标 `aiCanOccupy=false`，但 spec 阶段必须给出 AI 接口形状，否则 P1 时会发现现有 AI core 不接受资源地候选）

### 4.5 garrison 表中 `leaderQuality` 字段名对照

**初稿 §2.2**：表 `resource_node_garrison` 含列 `leaderQuality`，称 "对齐 `garrison.xlsx` 同名列"。

**仓库证据**：`config/tables/garrison.xlsx` 需经 build 生成 `backend/config/generated/garrison.json`。查看 `DefenderLeaderService.js:10-15` 的 `QUALITY_BY_THREAT`，quality 值的枚举为 `common/good/great/legendary`。但初稿 §2.2 用 `seasoned/elite` 作为品质值——这两个值不在现有枚举中。

**仓库证据**：`WorldCampConfig.js:25,35,45` camp archetype 的 `quality` 字段值为 `common/seasoned/elite`。所以 `seasoned/elite` 是营地系统自有的 quality 值，不在 DefenderLeaderService 的 `QUALITY_BY_THREAT` 表中（该表只有 `common/good/great/legendary`）。

**但** DefenderLeaderService 的 `createDefenderLeader` 接受 `quality` 参数并直接传给 leader 构造（`DefenderLeaderService.js:130-140` 不校验 quality 是否为枚举值）。所以 `seasoned/elite` 可以传入，但属性的 quality-based 分配会 fallback 到 common。这可能是预期行为（营地也是这么用的），需要显式说明。

→ **分级：minor**（seasoned/elite 为营地已有值，但需注明 DefenderLeaderService 的 quality→attribute 分档对此值的 fallback 行为）

---

## 五、文件路径校验

### 5.1 真实路径核对表

| 初稿引用 | 初稿文件路径 | 仓库真实路径 | 状态 |
|---|---|---|---|
| §1 / §6.1 | `shared/worldMarchCore.js` | `shared/worldMarchCore.js` | ✅ |
| §1 / §6.4 / §6.5 | `backend/services/worldCombat/WorldCombatSessionService.js` | `backend/services/worldCombat/WorldCombatSessionService.js` | ✅ |
| §1 / §6.5 | `backend/services/worldCombat/WorldCombatEncounterService.js` | `backend/services/worldCombat/WorldCombatEncounterService.js` | ✅ |
| §1 / §6.6 | `backend/services/battle/BattleSimService.js` | `backend/services/battle/BattleSimService.js` | ✅ |
| §1 / §6.7 | `backend/services/territory/GarrisonPolicy.js` | `backend/services/territory/GarrisonPolicy.js` | ✅ |
| §1 / §6.7 | `backend/services/territory/GarrisonCaptureResolver.js` | `backend/services/territory/GarrisonCaptureResolver.js` | ✅ |
| §1 / §6.8 | `backend/services/worldCombat/WorldCampSpawner.js` | `backend/services/worldCombat/WorldCampSpawner.js` | ✅ |
| §1 / §6.8 | `backend/config/WorldCampConfig.js` | `backend/config/WorldCampConfig.js` | ✅ |
| §1 / §6.2 | `backend/services/worldExplorer/WorldExplorerActions.js` | `backend/services/worldExplorer/WorldExplorerActions.js` | ✅ |
| §1 / §6.4 | `backend/services/worldExplorer/WorldExplorerProgression.js` | `backend/services/worldExplorer/WorldExplorerProgression.js` | ✅ |
| §1 / §5 | `backend/services/worldExplorer/WorldExplorerVision.js` | `backend/services/worldExplorer/WorldExplorerVision.js` | ✅ |
| §1 / §6.11 | `backend/calculators/ResourceTickCalculator.js` | `backend/calculators/ResourceTickCalculator.js` | ✅ |
| §1 / §6.12 | `backend/services/CityService.js` | `backend/services/CityService.js` | ✅ |
| §1 / §6.13 | `backend/services/WorldMapService.js` | `backend/services/WorldMapService.js` | ✅ |
| §1 / §6.14 | `shared/faction/aiFactionCore.js` | `shared/faction/aiFactionCore.js` | ✅ |
| §1 / §1.1 | `shared/faction/factionCore.js::aiFactionId` | `shared/faction/factionCore.js` | ⚠️ 函数在此不在 aiFactionCore.js |
| §1 / §4.2 | `frontend/js/config/LocaleTextRegistry.js` | `frontend/js/config/LocaleTextRegistry.js` | ✅ |
| §1 / §6.16 | `frontend/js/.../panels/CanvasPanelRegistry.js` | `frontend/js/platform/panels/CanvasPanelRegistry.js` | ⚠️ 路径模糊 |
| §1 / §4.1 | `frontend/js/.../panels/ResourceNodePanel.js`（拟新增） | 目标应在 `frontend/js/platform/panels/` | ⚠️ 路径模糊 |
| §4.1 / §6.16 | `frontend/js/platform/CanvasPanelActionRegistry.js` | **不存在** — 此文件是 button-scheduler refactor spec 规划的新文件（spec §6.11），尚未实现 | ❌ |
| §6.3 | `backend/actions/GameActionRegistry.js` | `backend/actions/GameActionRegistry.js` | ✅ |
| §6.10 | `backend/config/ConfigTables.js` + `config/tables/table-schemas.js` + `scripts/build-config-tables.js` | 全部存在 | ✅ |
| §6.9 | `backend/repositories/WorldEncounterRepository.js` | `backend/repositories/WorldEncounterRepository.js` | ✅ |
| §2.1 | `backend/config/GameConfig.js::resources` | `backend/config/GameConfig.js` | ✅ |
| §2.1 | `shared/buildingConfig.json` | `shared/buildingConfig.json` | ✅ |
| §2.1 | `scripts/economy-balance-model.js` | `scripts/economy-balance-model.js` | ✅ |
| §6.17 | `backend/services/tutorial/TutorialActionValidator.js` | `backend/services/tutorial/TutorialActionValidator.js` | ✅ |
| §4.1 | `backend/services/DefenderLeaderService.js` | `backend/services/DefenderLeaderService.js` | ✅ |
| §6 | `docs/architecture/button-scheduler-manager-panel-refactor-spec-2026-07-09.md` | 存在（1187 行） | ✅ |
| §8 | `config/tables/garrison.xlsx` / `diplomacy_tuning.xlsx` / `ai_faction_profile.xlsx` / `personality_tuning.xlsx` | 全部存在 | ✅ |
| §7 | `assets/art/world-site-*` | `frontend/assets/art/world-site-*-cutout.png` (5 个文件) | ⚠️ 路径前缀缺少 `frontend/`，实际路径为 `frontend/assets/art/` |

### 5.2 关键不存在路径

**① `frontend/js/platform/CanvasPanelActionRegistry.js` ◆ 不存在**

初稿 §4.1 称在此文件中注册 `openResourceNode`/`closeResourceNode`/`attackResourceNode`/`abortDeploy` 动作描述符。此文件是 button-scheduler spec 中规划的**新文件**（spec 行 643-649 和 1157），目前 repo 中不存在。初稿 §6.16 也引用了它作为 "§6.1/§6.2 契约" 的目标注册点。

→ **分级：major**（引用的注册目标文件不存在，资源地 panel 注册依赖未完成的 button-scheduler 重构，存在上游阻塞风险）

**② `frontend/js/.../panels/` 路径模糊**

初稿 §4.1：`frontend/js/.../panels/ResourceNodePanel.js` 和 `frontend/js/.../panels/CanvasPanelRegistry.js`

实际 `FamousPersonsPanel.js` 和 `CanvasPanelRegistry.js` 位于 `frontend/js/platform/panels/`。`...` 不构成有效路径，实现者需要猜测。

→ **分级：minor**（建议改为 `frontend/js/platform/panels/`）

### 5.3 行号引用校验

| 初稿引用 | 声称行号 | 实际内容 | 状态 |
|---|---|---|---|
| `WorldCombatSessionService.js:278-281` | returnWorldMarch 非胜利路径 | 行 278-281 为 `const survivors=...; if(winner!=='attacker'){returnWorldMarch(...)}` | ✅ |
| `WorldCombatEncounterService.js:19` | `LOOT_RESOURCE_KEYS` | 行 19 为 `const LOOT_RESOURCE_KEYS = Object.freeze([...])` | ✅ |
| `WorldCombatEncounterService.js:188-202` | `respawnCampIfReady` | 行 188-202 为该函数完整定义 | ✅ |
| `WorldCombatEncounterService.js:208-221` | `awardCampLoot` | 行 208-221 为该函数，写回 `city.resources` | ✅ |
| `WorldCombatEncounterService.js:685` | `resolveEngagedTimeouts` | 行 685 为函数签名 | ✅ |
| `WorldCombatEncounterService.js:729-783` | `hasFoughtEncounter` + `getClientEncounterBattleTarget` | 行 729-783 为此二函数 | ✅ |
| `WorldCombatEncounterService.js:819-821` | `isEncounterVisibleToPlayer` | 行 819-821 为该函数定义 | ✅ |
| `CityService.js:254-296` | `advanceAllCities` | 行 254-296 为该函数定义 | ✅ |
| `CityService.js:298-360` | `calculateOfflineIncomeForAllCities` | 行 298-360 为该函数定义 | ✅ |
| `WorldExplorerProgression.js:324` | `resolveMissionArrival` 调用点 | 行 324 为 `WorldCombatEncounterService.resolveMissionArrival(...)` 调用 | ✅ |
| `WorldExplorerActions.js:414` | `returnWorldMarch` 函数 | 行 414 为 `function returnWorldMarch(...)` | ✅ |
| `GameActionRegistry.js:21` | `returnWorldMarch` | 行 21 为 `'returnWorldMarch',` 在 TERRITORY_ACTIONS 集合中 | ✅ |
| `aiFactionCore.js:18-19,62-73` | ACTIONS + personalityToWeights | 行 18-19 为 `SETTLE_NEUTRAL`/`ATTACK_CITY`，行 62-73 为 `personalityToWeights` | ✅ |
| `WorldMapService.js:309` | `getTileCoordinateKey` | 行 309 为函数签名 | ✅ |
| `LocaleTextRegistry.js:856-858/1874-1876` | camp 相关 key | 行 856-858 为 `world.combat.camp.*` (zh-CN)，行 1874-1876 为对应 en 翻译 | ✅ |

---

## 六、其他发现

### 6.1 收益结算只写首都——未考虑多城市场景

初稿 §3.6：资源地收益写回 "首都活动城市"。但现有 `advanceAllCities`（`CityService.js:254`）遍历所有城市逐个 tick。资源地收益为何只归入首都而非按占领部队所属城市分配？初稿未给出理由。多城市世界中，玩家可能希望资源地的产出支援非首都城市的经济。

→ **分级：minor**（P0 单城市不受影响，P1 多城市场景需决策）

### 6.2 美术素材命名约定与仓库现有文件前缀不一致

初稿 §7 建议命名 `assets/art/world-site-rnode-<type>-<tier>.png`。

**仓库证据**：`frontend/assets/art/world-site-city-cutout.png`、`world-site-camp-cutout.png` 等，实际前缀为 `frontend/assets/art/world-site-`，带 `-cutout` 后缀。建议对齐现有约定：`frontend/assets/art/world-site-rnode-<type>-<tier>-cutout.png`。

→ **分级：minor**（不影响功能但命名一致性降低查找效率）

### 6.3 冻结提示语后端直发中文与 i18n 的张力

初稿 §4.2："后端校验失败时直发中文同一句（对齐 WorldCombatSessionService 直发中文 message 的约定）"。但冻结需求 §二要求 "前端文案全走 t() 双语成对；后端直发中文"。初稿 §3.3 的 `DEPLOY_IN_PROGRESS` 错误同时走了后端直发中文（`message` 字段）和前端 i18n catalog——这是符合现有约定的。✅

---

## 七、总结

| 级别 | 数量 | 关键项 |
|---|---|---|
| **blocker** | 2 | §3.1 sharedResourceNodes 与 encounter 双模型映射缺失（导致 §3.2 声称的 combat 复用不可行）；§4.1 资源地→encounter 投影层缺失（openSession/resolveSession/getActiveEncounterAt 搜不到资源地） |
| **major** | 8 | 部署结束 TOCTOU 竞态、离线兜底 defeat 路径不返程、离线收益报表结构缺失、deploy→owned timer 缺少定时回路、owned 驻防被撤检测机制缺失、node-level 战斗互斥锁缺失、DefenderLeaderService 缺少资源地 owner profile、CanvasPanelActionRegistry 文件不存在 |
| **minor** | 6 | aiFactionId 路径错、seasoned/elite 品质值与 DefenderLeaderService 枚举不一致、panel 路径模糊（`...`）、美术命名偏差、多城市收益归属、需求 #5 强制召回边界未覆盖 |

**未发现与冻结需求 §一 的直接冲突。** 初稿对需求 7 条的翻译整体正确，数值表驱动、i18n 双语、嫁接现有系统等约束均得到尊重。

建议修订方向：
1. 统一 `sharedResourceNodes` 与 encounter 的投影方案：每个 resource node 在进入 `contested` 时创建对应的 encounter（含 DefendLeader profile），status 由 encounter 自身驱动（active → deploying → resolved 增加新状态），避免双 namespace 双写
2. 对齐两条战斗结算路径的 defeat 行为（建议在 `resolveEncounterBattle` 中为资源地 encounter 增加 `returnWorldMarch` 调用）
3. 补齐 deploy→owned 的触发机制（推荐 lazy-check 而非全局 tick）
4. 添加 node-level 战斗互斥（`deploying`/`contested` 状态的 node 拒绝第二个 `openSession`）
5. 修正文件路径引用并标记 `CanvasPanelActionRegistry.js` 为上游依赖

(End of review)
