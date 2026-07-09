# 资源地系统 — 设计修订稿 v2（模型：glm-5.2，修订轮 2026-07-09）

> 输入：`00-brief-2026-07-09.md`（冻结需求）+ `01-design-draft-glm-5.2.md`（v1 初稿）+ 三份评审（`02-review-minimax-m3.md` / `02-review-kimi.md` / `02-review-deepseek-v4-pro.md`）+ `03-arbitration-directives.md`（仲裁指令）。
> 约束：冻结需求不改；数值全表驱动；嫁接现有系统不平行造轮子；不写代码，只给设计。本文为完整自含新版（非补丁）。
> 内容：评审处置表 / 概述 / 数据模型 / 配置表设计 / 占领状态机与服务端流程 / 客户端 UI 与文案 / 战争迷雾与可见性 / 与现有系统接缝 / 美术素材清单 / 待决问题决定 / 测试计划 / AI 接口形状 / 分阶段落地切片（含验收门）/ 引用真实路径一览。

---

## 0. 评审处置表（三份评审 blocker / major 逐条；minor 合并处置）

### 0.1 minimax-m3 评审处置

#### Blocker

| # | 位置 | 处置 | 修订动作 |
|---|---|---|---|
| B-1 | §2.2 守军 L10=1890 legendary > deep 城市 1880 great；自评"弱于城市"错误 | **采纳** | 守军线性重校为 `78+92×level`：L10≈998（＜ deep 城市 scale=4=1200）、L1=170 防 M-10 早期刷；L8-10 leader 降为 **great**（legendary 保留给城市 deep）；见 §3.2 定稿表 + §3.4 验收门 |
| B-2 | §3.4 占领方兵=0 快照 + 无安全期 → 1 帧掠夺链 | **采纳** | 部署完成时**立即注入系统驻军**（=该级守军 ×0.35，表驱动，不允许 0）；占领后**安全期**（表驱动，P0 默认 24h）内不可被第三方攻击；见 §4 状态机 |
| B-3 | §3.6 离线复用城市 `offlineEfficiency=0.8/maxHours=8h`，离线入账=城市 3-5 倍 | **采纳** | 资源地离线参数**独立表项**：`offlineEfficiency=0.5 / offlineMaxHours=4h`，不复用城市参数；见 §3 配置表 tuning |
| B-4 | §3.4 撤军=瞬间回 uncontrolled + 守军 0 → 第三方 1 帧掠夺 | **采纳** | 撤军改为 **30s 退场流程**（与部署镜像），退场中守军照常存在，不允许"瞬间回城即弃"；见 §4 状态机 |

#### Major

| # | 位置 | 处置 | 修订动作 |
|---|---|---|---|
| M-1 | §2.1 收益 L10 石/铁=2 工匠 Lv3 矿/采石场，破坏"铁是瓶颈" | **采纳** | 收益表整体 ×0.55 后重排，保持铁最稀；见 §3 收益表 + 量级对照（附 30 天模拟验收门） |
| M-2 | §3.6 写回 city.resources 无 storage cap 会"印钱" | **采纳（带前置风险声明）** | 结算前先查现有 storage cap；经核查现有 `city.resources` 无全局 storage cap（仓库/粮仓建筑不存在硬上限），故在 spec 中**显式标注前置风险**：资源地收益会无上限累积入 `active city`，建议 P1 前置加 cap，否则离线结算需依赖独立离线参数（B-3 已降风险） |
| M-3 | §2.2 legendary 留给资源地 L9-10 > 城市 deep great | **采纳** | 同 B-1，L8-10 改 great |
| M-4 | §2.2 respawn 120min 最长，第三方再生中白嫖 | **采纳** | 被夺/撤军后守军再生沿用 `respawnCooldownMs`，但部署完成注入系统驻军 + 安全期（B-2）使"再生中白嫖"窗口被守军占住；另加 `minSoldiersToClaimNode` 类门槛见 M-9 |
| M-5 | §6 高 L 守军/秒收益比越高级越划算，激励远征 | **部分采纳** | 依赖行军时长天然制动（`shared/worldMarchCore.js` 行军时长随距离增长）。收益重校（M-1）后高级节点绝对收益下降。**不在 P0 加额外远征税**；写入待决观察项，30 天模拟验收门监控 |
| M-6 | §2.4 12+6+grace3 满占=0% 衰减，单一最优终态 | **采纳** | **P0 砍掉衰减机制**（必采 4），只留双硬上限（`maxOwnedPerPlayer / maxOwnedPerType`）；上限判定为"占不下"硬拒绝而非"衰减着占"；衰减 P1 再议 |
| M-7 | §3.4 deploy 结束瞬间被第三方掠夺 | **采纳** | 同 B-2 安全期 + 必采 1 lazy-check：owned 态在生效后的**下一 tick**才可被投影为可攻击 encounter（封 TOCTOU） |
| M-8 | §3.4 撤军同 B-4 路径 | **采纳** | 同 B-4 的 30s 退场 |
| M-9 | §8.7 AI 扫光 L1-L3 节点 | **采纳（P1 形状现在定）** | AI 仅对 **≥L4 节点**或设 `minSoldiersToClaimNode=200` 门槛；`weightExpand` 内部拆 `expandCity/expandNode` 子权重；P1 开启。形状定义进第二段 AI 接口 |
| M-10 | §2.2 Lv1 守军 68 太低，早期批量刷 | **采纳** | L1 守军 ×2.5（≈170，对齐 near 城市 base 260 的下沿），低级线性系数随之重校；见 §3 配置表 |
| M-11 | §C.3 滚雪球无主动减产/税 | **拒绝（P0）+ 写为 P1 候选** | 证据：P0 已通过收益 ×0.55、离线独立参数 0.5/4h、双硬上限三件套压低产出；再叠加"时间衰减/打匪维护税"会提高 P0 实现成本且与"被动持续产出"心智冲突。**P0 不加主动减产**，30 天模拟验收门若仍滚雪球再议 P1 |
| M-12 | §3.4 deploy 完成禁止 client intent，只能 server timer | **采纳** | spec 显式声明 `completesAt` 只能服务端推进（lazy-check），不接受 client 推送；见 §4 状态机 |

#### Minor（合并处置）

| 项 | 处置 |
|---|---|
| m-1 持续 vs 一次性 UI 区分 | 采纳（第二段 UI 节，面板标注 `/s` 与"战利品(一次)"） |
| m-2 衰减下限 narrative 弱 | 随 M-6 一并：P0 砍衰减，n/a |
| m-3 类型权重 + 地形 filter 后铁偏少 | 采纳（第二段美术铺设核对），P0 用现值，模拟后调 |
| m-4 warband camp 改为节点冲突 | 拒绝：不清除营地，资源地走独立 `occupiedTiles` 单源见 Q6（第二段） |
| m-5 同节点多人围殴/排队策略未明确 | 采纳：P0 **1v1 单战斗在局**（`WORLD_COMBAT_SESSION_BUSY`），node-level 互斥拒绝后者；队列 P1 |
| m-6 panel 归哪个 group | 采纳（第二段 UI，独立 panel，注册进 `CanvasPanelRegistry`） |
| m-7 教程步未细化 | 采纳（第二段标后续） |
| m-8 "首都活动城市"是哪座 | 采纳：明确 = `gameState.activeCityId` 对应城市，见 §4 + 第二段 |
| m-9 leader 历史 UI | 采纳（第二段 UI 备注项） |
| m-10 粮节点与人口消耗耦合 | 采纳（第二段待决观察项，离线结算与城市粮食饿人解耦校验） |

### 0.2 kimi 评审处置

#### Blocker

| # | 位置 | 处置 | 修订动作 |
|---|---|---|---|
| 1.1 | 部署期移动/撤退交互流：被审稿拆成"被拒→中止→原地 idle→再点移动"3-4 步，违背需求直觉 | **采纳（原子化，必采 2）** | 主选**后端原子方案**：`WorldExplorerActions.startWorldMarch/returnWorldMarch` 增加 deploying 分支，确认后**原子执行"中止占领 + 继续原移动/撤退动作"**，部队**不得原地罚站**。冻结提示语原文不变。见 §4 状态机 |

#### Major

| # | 位置 | 处置 | 修订动作 |
|---|---|---|---|
| 2.1 | 状态机过度复杂：`contested` 持久态冗余 + `claimant/owner` 双字段 + `ownGarrison` dead code | **采纳（必采 1 重构）** | 单一数据源：node=持久收益实体（id/type/level/位置/owner/守军/收益游标），**争夺/战斗/部署状态全由现有 encounter 模型驱动**，不建平行状态机。`ownGarrison` 在 v2 重新启用为"系统驻军"（B-2），非 dead code。`claimantFactionId` 取消，deploying 的占领方信息挂在 encounter 侧。见 §2 数据模型 |
| 2.2 | 收益写回"首都活动城市"未澄清归属 | **采纳（必采 5）** | 写回 `gameState.activeCityId` 对应城市；面板显示"收益归入 {城市名}"；离线报表结构扩展区分城市自产 vs 资源地收益；被夺收益游标截止到失控时刻；见 §4 + 第二段 |
| 2.3 | `resource_node_garrison` 引入 P0 不启用列（captureChance 等） | **采纳（必采 8 减脂）** | P0 删 `captureChance`/未启用列，P1 再加列；见 §3 配置表 |
| 2.4 | 素材缺可执行 prompt，建筑类尺寸偏小 | **采纳（必采 7）** | 每档给英文 prompt + 风格锚点 + 品红底；尺寸阶梯 L1-3=256 / L4-6=384 / L7-10=512；建筑 one-by-one 不进 prop pack；命名 `frontend/assets/art/world-site-rnode-<type>-<tier>-cutout.png`；overlay 验证后 fallback 每状态独立变体。进第二段美术节 |
| 2.5 | 上限与衰减叠加，衰减几乎不触发 | **采纳** | P0 砍衰减只留双硬上限（同 M-6） |
| 2.6 | deploying tile 对第三方行军物理语义未明 | **采纳（必答，第二段答）** | 结合必采 3 安全期一并定：deploying 期间 tile 对第三方行军**可达但不可开战**（遇 `getActiveEncounterAt` 不命中，发起 `attackResourceNode` 得 `DEPLOY_IN_PROGRESS` 拒绝）；站上去不触发任何逻辑、不阻塞路由。完整规则见 §4 状态机 + 第二段必答 |

#### Minor

| 项 | 处置 |
|---|---|
| 3.1 在线 float / 离线 floor 精度不一致 | 采纳：资源地收益在线结算显式 `Math.floor(yieldPerSecond × elapsed)`，与离线一致（见 §4） |
| 3.2 recentReports 下沉每 node | 采纳：复用全局 `gameState.worldCombat.recentReports`，不下沉 |
| 3.3 4 张表 vs 3 张表 | 采纳（必采 8）：**3 张表**，placement 参数并入 tuning 表 |
| 3.4 4 状态徽标 overlay 未验证 | 采纳（必采 7 fallback）：先验证运行时 overlay，无则每状态独立变体 |
| 3.5 tierVisual 冗余 | 采纳（必采 8）：tierVisual 改代码映射 `Math.min(4, Math.floor((level-1)/3)+1)`，不进表 |
| 3.6 "继续部署" vs "继续占领" | 采纳：玩家文案统一用"继续占领" / "Keep Occupying" |

### 0.3 deepseek-v4-pro 评审处置

#### Blocker

| # | 位置 | 处置 | 修订动作 |
|---|---|---|---|
| §3.1 | `sharedResourceNodes` 与 encounter 双模型映射缺失，`contested→deploying` 与 `uncontrolled→contested` 并发双写竞态 | **采纳（必采 1）** | 单一数据源重构：给出 node↔encounter 投影映射层设计（谁创建 encounter、id 关联、status 归属、避免双写）+ node 级互斥；见 §2 数据模型 |
| §4.1 | 资源地→encounter 投影层缺失，`openSession/resolveSession/getActiveEncounterAt` 搜不到资源地 | **采纳（同必采 1）** | 资源地进入战斗时由 `ResourceNodeEncounterAdapter`（拟新增）创建 encounter 投影并注册进 `sharedEncounters`，id 关联 `nodeId`；status 归 encounter 单边驱动；见 §2 投影映射层 |

#### Major

| # | 位置 | 处置 | 修订动作 |
|---|---|---|---|
| §一 | 需求 #5 部署期内玩家首都受攻击导致部队强制召回边界未覆盖 | **采纳（必答，第二段答）** | 决定：部署期编队锁定（需求 5 "不可移动/不可撤退"优先级最高），**即使首都被攻也不强制回防**；该编队不参与城防战斗。理由：冻结需求明示部署期不可移动，强制召回会破坏 60s 冻结语义。首都防御由其他编队/系统驻军承担。第二段必答详述 |
| §2.1 | 部署结束瞬间第三方抢攻 TOCTOU | **采纳（必采 1）** | deploy→owned 用 lazy-check（下次被查询/抵达时先检查 `completesAt`）；owned 态在生效后**下一 tick**才可被投影为可攻击 encounter（封 TOCTOU）；见 §4 |
| §2.2 | 离线兜底 defeat 路径不返程（`resolveEncounterBattle` 不调 `returnWorldMarch`） | **采纳（必采 6）** | 资源地 encounter 在 `resolveEncounterBattle` 败北时补 `returnWorldMarch`；spec 标注"这是现有引擎两路径不一致"为实现注意事项；见 §4 |
| §2.3 | 离线收益报表结构未扩展，前端无法区分城市自产 vs 资源地收益 | **采纳（必采 5）** | `calculateOfflineIncomeForAllCities` 返回值扩增 `resourceNodeIncome` 段（按 type 汇总 + 归入城市名）；见 §4 + 第二段 |
| §2.4 | deploy→owned timer 缺可接入定时回路 | **采纳（必采 1）** | 改用 lazy-check：下次该 node 被任一玩家查询/行军抵达时先检查 `completesAt` 过期再返回当前状态，**不新增全局 tick**；owned→可攻也用同一 lazy 闸（下一 tick）；见 §4 |
| §3.2 | owned 驻防被撤检测机制缺失（tile-formation-node 三向引用） | **采纳** | v2 改为系统驻军（B-2）防御，编队不再"就地驻防"，撤走编队不触发弃节点；节点防御靠系统驻军 + 安全期。三向引用问题随之消解（mission 不再 `defendingNodeId`）。换防走新行军闭环见 §4 |
| §3.3 | node-level 战斗互斥锁缺失（player-level session 锁不够） | **采纳（必采 1）** | node 级互斥：deploying/contested 状态的 node 拒绝第二个 `openSession`（encounter 侧 status 非可攻击 + node 侧 `combatBattleId` 存在性双判）；见 §2 |
| §4.3 | DefenderLeaderService 缺资源地 owner profile | **采纳（必采 10）** | 补 `type:'resource_node'` profile；quality 枚举 fallback 行为写明（seasoned/elite 在 `QUALITY_BY_THREAT` 外 fallback common）；进第二段 |
| §4.4 | AI 候选评分函数签名缺失 | **采纳（必采 11）** | P1 AI 接口形状现在定（候选评分字段签名 + `expandCity/expandNode` 子权重拆分）；进第二段 |
| §5.2① | `frontend/js/platform/CanvasPanelActionRegistry.js` 不存在（上游 button-scheduler 依赖） | **采纳（必采 9）** | spec 显式声明上游依赖：面板/action 注册走 button-scheduler 重构后的 `CanvasPanelActionRegistry`，**该文件由重构移植统一提供**；写明依赖顺序与 fallback（移植前走旧 dispatcher/runner 路径）；第二段接缝节 |

#### Minor

| 项 | 处置 |
|---|---|
| §4.2 aiFactionId 路径错 | 采纳：修正为 `shared/faction/factionCore.js::aiFactionId`（行 27） |
| §4.5 seasoned/elite 与 DefenderLeaderService 枚举不一致 | 采纳：随必采 10 在第二段写明 fallback 行为 |
| §5.2② panel 路径模糊 `...` | 采纳：写全 `frontend/js/platform/panels/` |
| §6.2 美术命名缺 `frontend/` 前缀与 `-cutout` 后缀 | 采纳：命名 `frontend/assets/art/world-site-rnode-<type>-<tier>-cutout.png` |
| §6.1 多城收益归属 | 采纳：随必采 5，写回 `activeCityId`；多城场景 P1 决策 |
| §6.3 冻结提示语双源一致 | 采纳：后端直发中文 + 前端 catalog 双源，验收测例 T-10.6 保证 |

---

## 1. 概述

资源地是世界地图上可被玩家（及 PVPVE 势力）争夺、占领后按等级每秒产出基础资源的**固定地表站点**。本稿在 v1 基础上按三份评审与仲裁指令（必采 1-12）做了结构性修订。

- **范围**：4 类型 × 10 等级 = 40 种规格，铺设为共享世界实体（与野怪营地同一"全局共享、玩家侧按视野投影"模型）。
- **闭环**：发现（视野内）→ 攻打守军（复用 `BattleSimService` 权威战斗）→ 胜利进入 **60s 部署期**（冻结需求）→ 部署期结束归属玩家并**立即注入系统驻军 + 安全期**（必采 3，修复 v1 玻璃堡垒）→ 玩家享有按等级/类型的每秒资源收益 → 可被第三方夺占（含 AI 势力，P1）。
- **设计隐喻**：资源地 = "野怪营地（一次性战利品）+ 城占领军（持续产出+被夺占）"两条已落地闭环的嫁接种——守军/铺设/可见性复用营地链路，归属/部署/被夺复用城占领链路。

### 1.1 v1 → v2 结构性改动一览（对接仲裁必采）

| 必采 | v1 做法 | v2 改动 |
|---|---|---|
| 1 单一数据源 | node 自带 4 状态机 + `claimantFactionId` + `ownGarrison` + 平行 `combat` 子对象 | **node = 持久收益实体**；争夺/战斗/部署全由现有 encounter 模型驱动；新增 **node↔encounter 投影映射层**；node 级战斗互斥；deploy→owned 走 **lazy-check**（不新增全局 tick）；owned 下一 tick 才可被投影为可攻击 encounter（封 TOCTOU） |
| 2 中止原子化 | abort 后部队原地 idle，玩家再点移动 | 后端 `WorldExplorerActions` 原子分支：确认 = "中止占领 + 继续原移动/撤退"，部队**不罚站** |
| 3 玻璃堡垒 | `ownGarrisonBase=0` 无安全期，撤军瞬间回 uncontrolled | 部署完成**立即注入系统驻军**（守军 ×0.35）+ **安全期**（默认 24h 不可被夺）+ **撤军 30s 退场流程** |
| 4 数值重校 | L10 守军 1890 legendary；收益未压量；离线复用城市 0.8/8h；含衰减 | L10 守军≈1000 great；收益量校 0.55×；L8-10 leader→great；铁最稀；L1 守军×2.5；离线独立 0.5/4h；**P0 砍衰减，只留双硬上限** |
| 5 收益归属 | "首都活动城市"含糊 | 写回 `gameState.activeCityId`；面板显示归入城市；离线报表区分城市自产 vs 资源地收益；被夺游标截止失控时刻 |
| 6 离线败北返程 | 引用交互路径返程，离线路径不返程 | 资源地 encounter 在 `resolveEncounterBattle` 败北补 `returnWorldMarch`，标注两路径不一致 |

### 1.2 非目标（本稿明确不做 / 留 P1）

- P0 不开 AI 夺占（`aiCanOccupy=false`），但 AI 接口形状现在就定（必采 11，第二段）。
- P0 不开捕将流（`captureChance`），不预留 dead 列，P1 再加。
- P0 不做收益时间衰减 / 打匪维护税 / 收益上线后随时间递减（M-11 拒绝；30 天模拟验收门监控，若仍滚雪球 P1 再议）。
- P0 不做 storage cap（M-2 标前置风险），由独立离线参数 0.5/4h 压低离线爆发。

---

## 2. 数据模型（按必采 1 重写：encounter 单源驱动，node=持久收益实体）

### 2.1 单一数据源原则

资源地被拆成**两层**，职责严格分离，**任何"战斗/争夺/部署"瞬态都不在 node 上落字段**：

1. **`sharedResourceNodes`（持久收益实体层）**：只存"这地是什么/归谁/守军是什么/上次结算到哪"，由 `ResourceNodeRepository`（拟新增，镜像 `backend/repositories/WorldEncounterRepository.js` 同构 upsert/get/按 tile 取）持久化。**status 语义压成两值** `idle | deploying`：`idle` 内部用 `owner` 区分无主/已占领，不再有独立 `contested` 持久态（采纳 kimi 2.1）。
2. **`sharedWorldEncounters`（战斗瞬态层，复用现有）**：资源地进入战斗时由适配器把 node 投影成一个 encounter 注册进现有 `gameState.worldCombat.sharedEncounters`，战斗/部署期全程由 encounter 的 status（`active | resolved`）单边驱动；node 侧只在战斗**结算回写时刻**与**部署 completion 时刻**被存一字段写回。**不存在两份并行 status**（修复 deepseek §3.1/§4.1 双写竞态 blocker）。

> SSOT：谁是"当前战斗在不在、归哪个 battle"——encounter 说了算；谁是"谁占领、守军多少、收益游标"——node 说了算。二者通过 `node.combatEncounterId ↔ encounter.id` 双向单引用关联，`ResourceNodeEncounterAdapter` 是唯一在两者间搬运状态的组件，**其它路径禁止跨层写**。

### 2.2 node 持久实体结构（`gameState.sharedResourceNodes`）

镜像 `sharedWorldEncounters` 的位置语义（`backend/services/worldCombat/WorldCombatEncounterService.js`）。

```
schema: 'shared-resource-nodes-v2'
nodes: {
  [nodeId]: {
    id              // 'rnode_{q}_{r}'，确定性
    type            // 'forest' | 'stone' | 'iron' | 'farm'
    level           // 1..10
    q, r, tileId, terrain, activityRegionId
    owner           // null=无主 | 'player' | ai factionId（取代 v1 ownerFactionId）
    status          // 'idle' | 'deploying'   ← 仅两值
    garrison {      // 守军（无主态、夺占失败定格）
      soldiers, baseSoldiers, quality, threat, leader, regenAt
    }
    systemGarrison { // 占领后系统驻军（必采 3，立即注入，非 0）
      soldiers, injectedAt, regenAt   // 自修复周期 30min
    }
    safeUntil       // 占领后安全期截止时刻（owned 后 now+safePeriodMs）；>now 期间不可被夺
    deploy {        // 仅 status='deploying' 时有
      startedAt, completesAt, claimant   // claimant=player|ai factionId
    }
    combatEncounterId  // null=当前无战斗；非空=投影出的 encounter id（node↔encounter 单引用）
    income {        // 收益结算游标（服务端 tick）
      lastSettledAt
    }
    createdAt, updatedAt
  }
}
updatedAt
```

> v1 删除项：`claimantFactionId` 双字段（claimant 进 `deploy.claimant`）、`ownGarrison` dead 字段（被 `systemGarrison` 取代并启用）、`combat {status,battleId,...}` 子对象（瞬态归 encounter，node 只存 `combatEncounterId`）、每节点 `recentReports`（采纳 kimi 3.2 复用全局 `gameState.worldCombat.recentReports`）、`abortDeployKeepGarrisonSoldiersRatio`（数值进配置表）。
> `owner='player'` 沿用现有 `gameState.territories[].owner==='player'` 约定（单服单玩家世界）；AI factionId 经 `shared/faction/factionCore.js::aiFactionId`（行 27，修正 v1 误引为 `aiFactionCore.js`，采纳 deepseek §4.2 minor）。

### 2.3 node↔encounter 投影映射层（`ResourceNodeEncounterAdapter`，拟新增）

唯一在 node 与 encounter 间搬运状态的组件，封 deepseek §4.1 blocker。职责与契约：

| 时机 | 方向 | 动作 |
|---|---|---|
| 玩家行军抵达可攻打 node（`status='idle', owner!=claimant, safeUntil<=now, garrison 待打`）| node→encounter | adapter 依 node 造一个 encounter（id=`enc_<nodeId>`、`tileId/terrain` 复制、`type` 标 `resource_node`、leader 经 `DefenderLeaderService.createDefenderLeader(type:'resource_node',...)`、守军 = `node.garrison` 或 `node.systemGarrison` 视 owner 而定）upsert 进 `sharedEncounters`；node 设 `combatEncounterId=enc_id` |
| 战斗在局（encounter.status='active'）| node 侧只读 | `getActiveEncounterAt`（`WorldCombatEncounterService.js:363`）天然命中该 encounter；node 的 `status` 维持 `idle`（owner occupied）或 `deploying`（被夺不进此分支），**不改 node.status** |
| 战斗结算胜利 | encounter→node | adapter 监友方胜利回写：置 `node.status='deploying'`、`deploy.{startedAt,completesAt=now+deploySeconds×1000,claimant}`、`node.combatEncounterId=null`、encounter 置 `resolved`；残存攻击方编队**就地停留 tile**（不回城，守部署期） |
| 战斗结算败北 | encounter→node | adapter 回写：node owner/守军定格（保留残兵），`node.combatEncounterId=null`；**败北补 `returnWorldMarch`** 必采 6）；encounter 置 `resolved` |
| 部署 completion（lazy-check）| node 内部 | 见 §4 |
| 占领后 next-tick 可攻闸 | node→encounter | owned 生效后**下一 tick**才允许 adapter 投影为可攻击 encounter（封 TOCTOU，必采 1） |

> ID 关联：`node.combatEncounterId === enc_<nodeId>`，一对一；encounter 侧 `ref.nodeId = nodeId`。`status` 归属：**战斗在不在**看 encounter，**占领/部署**看 node——单边驱动，无双写。
> 互斥：同一 node 同时只能有一个 encounter（`combatEncounterId` 非空则 adapter 拒绝再造，`openSession` 对该 tile 命中"已存在 encounter 即 `WORLD_COMBAT_SESSION_BUSY`"）。node 级互斥即由"单一 encounter + player-level session 锁"双闸达成（采纳 deepseek §3.3）。

### 2.4 玩家私有投影（DTO）

`gameState.resourceNodes`（玩家可见部分）由视野谓词过滤断下发，形状对齐 `WorldCombatEncounterService.getClientEncounter`（守军血量"打了才知道"前不携数字，沿用 v1 §9 决定）。投影来源仍是 `sharedResourceNodes` 经 adapter 之外的只读 clone 通道——投影层不另起 status。

---

## 3. 配置表设计（按必采 4/8：3 张表、数值重校、独立离线参数、P0 无衰减双硬上限）

v2 由 v1 的 4 张表收敛为 **3 张表**（采纳 kimi 2.3/3.3 + 必采 8）：`resource_node_yield` / `resource_node_garrison` / `resource_node_tuning`。铺设参数（ringBands、typeWeight、terrainFilter）并入 `resource_node_tuning`（或按 v1 备选走 `WorldCampConfig.js` 式代码常量，二选一在第二段定；本段按并入 tuning 表给）。全部登记进 `config/tables/table-schemas.js::TABLES`，跟 `scripts/build-config-tables.js` 生成 `backend/config/generated/<table>.json`，由 `backend/config/ConfigTables.js::getRows/getById` 读取。P0 删除 v1 的 `captureChance`/未启用列（采纳 kimi 2.3 + 必采 8），P1 扩展时 `--scaffold` 自动补列。`tierVisual` 改代码映射 `Math.min(4, Math.floor((level-1)/3))+1`（采纳 kimi 3.5），不进表。

### 3.1 `resource_node_yield`（收益主表）

主键 `yieldId`，4 类型 × 10 等级 = 40 行；唯一收益数字来源。

| key | type | label | fill | effect |
|---|---|---|---|---|
| yieldId | string | 收益档标识（主键） | `${type}_${level}`，唯一 | 代码按 type+level 取行 |
| type | string | 资源地类型 | forest / stone / iron / farm | 决定产出资源键 |
| level | int | 等级 | 1..10 | |
| resourceKey | string | 产出资源键 | wood / stone / iron / food | 必须在 `LOOT_RESOURCE_KEYS`（`WorldCombatEncounterService.js:19`）集合内 |
| yieldPerSecond | float | 每秒净产出 | 见下表 | 占领后 tick 入账的基础速率（在线 `Math.floor(yieldPerSecond×elapsed)`，见 §4 精度统一） |

**收益量级 v2 表**（单位：资源/秒；v1 表整体 ×0.55 后重排，保持铁最稀；采纳 minimax B-3/M-1）。

对照依据：城市人头基线 `backend/config/GameConfig.js::resources`（1 工匠=1.0 木 / 0.8 石 / 0.55 铁 /s、1 农夫=1.0 粮/s），建筑放大 `shared/buildingConfig.json`（Lv1 伐木场 woodOutputBase=2 → 2 木/s/工匠，Lv1 矿场 ironOutputBase=1.2 → 0.66 铁/s/工匠），计算式 `backend/calculators/ResourceTickCalculator.js`。v2 让 L10 节点 ≈ 1 个工匠带 Lv3 矿场产出的一半以下，真正回到"补充而非替代"。

| level | forest(wood) | stone(stone) | iron(iron) | farm(food) |
|---|---|---|---|---|
| 1 | 0.28 | 0.22 | 0.17 | 0.33 |
| 2 | 0.44 | 0.33 | 0.28 | 0.55 |
| 3 | 0.61 | 0.50 | 0.39 | 0.77 |
| 4 | 0.83 | 0.66 | 0.50 | 1.05 |
| 5 | 1.10 | 0.88 | 0.66 | 1.38 |
| 6 | 1.43 | 1.16 | 0.88 | 1.76 |
| 7 | 1.82 | 1.49 | 1.10 | 2.20 |
| 8 | 2.26 | 1.87 | 1.38 | 2.75 |
| 9 | 2.75 | 2.31 | 1.71 | 3.30 |
| 10 | 3.30 | 2.86 | 2.09 | 3.96 |

> 量级复核：L1≈0.28 木/s ≈ 0.14 个 Lv1 伐木场工匠；L10 iron 2.09/s ≈ Lv3 矿场 1 工匠(1.98)的补充，但无工匠/无建筑投入。v1 时铁节点曾拉平瓶颈，v2 ×0.55 后铁节点总贡献对中期玩家(6 城 ~23.76 铁/s)最高约 +8.8%（满占 6 个 Lv10 铁节点满收益，但受双硬上限+离线独立参数共压），不再是 v1 的 +34%。

### 3.2 `resource_node_garrison`（守军/部署/系统驻军表）

主键 `level`，1..10 行。守军配置参照 `config/tables/garrison.xlsx`（`GarrisonPolicy.js::garrisonSoldiers = base + perScale×scale`）与营地 `backend/config/WorldCampConfig.js::CAMP_ARCHETYPES`（`soldiersBase + soldiersPerRing×ring`）。

| key | type | label | fill | effect |
|---|---|---|---|---|
| level | int | 等级（主键） | 1..10 | |
| baseSoldiers | int | 守军基础兵力 | 见下 | 守军 = base + perLevel×level |
| soldiersPerLevel | int | 每级增量兵力 | 见下 | 见上 |
| leaderQuality | string | 守将品质 | common/good/great | 对齐 `DefenderLeaderService.QUALITY_BY_THREAT`，**legendary 不出现在资源地（留给城市 deep）**，seasoned/elite 走 fallback 见必采 10（第二段） |
| threatTier | int | 威胁档 | 1..5 | |
| respawnCooldownMs | int | 守军败后再生周期(ms) | 20..120 min | 无主态恢复 |
| deploySeconds | int | 部署期时长(s) | **冻结需求=60** | deploying→owned 唯一门 |
| systemGarrisonRatio | float | 占领后注入系统驻军比例 | 0.35 | 见必采 3：= `baseSoldiers + soldiersPerLevel×level` 的 0.35 倍，部署完成立即注入，**不允许 0** |
| systemGarrisonRegenSeconds | int | 系统驻军自修复周期(s) | 1800 (30min) | 受损后回血至注入量 |
| safePeriodMs | int | 占领后安全期(ms) | 默认 86400000 (24h) | safeUntil > now 期间不可被第三方攻击（必采 3） |
| abandonSeconds | int | 撤军退场时长(s) | 30 | 与部署镜像的退场流程（必采 3） |

**守军 v2 表（三件校准合并定稿）**

校准依据：① B-1 上界——v1 L10=1890(410+148×10)+legendary 与 deep 城市 scale=8(1880+great) 持平偏高，v2 让 L10≈**1000**（≤ deep 城市 scale=4 的 1200），L8-10 leader 改 **great**（legendary 留给城市 deep，采纳 M-3）；② M-10 下界——v1 L1=68 太低可批量刷，v2 L1 设 **170**（≈ near 城市 base 260 下沿的 0.65×）；③ B-2 系统驻军——占领后立即注入 = 守军×**0.35**（圆整，不允许 0），自修复 30min。线性单系数 `守军 = 78 + 92×level` 同时满足 L1=170、L10=998（≈1000），单调。

| level | base | perLevel | 守军实兵力 | leaderQuality | threatTier | respawnCooldownMs | deploySeconds | 系统驻军(×0.35 圆整) | safePeriodMs | abandonSeconds |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 78 | 92 | 170 | common | 1 | 1,200,000 | 60 | 60 | 86,400,000 | 30 |
| 2 | 78 | 92 | 262 | common | 1 | 1,200,000 | 60 | 92 | 86,400,000 | 30 |
| 3 | 78 | 92 | 354 | good | 2 | 1,500,000 | 60 | 124 | 86,400,000 | 30 |
| 4 | 78 | 92 | 446 | good | 2 | 1,800,000 | 60 | 156 | 86,400,000 | 30 |
| 5 | 78 | 92 | 538 | good | 3 | 2,400,000 | 60 | 188 | 86,400,000 | 30 |
| 6 | 78 | 92 | 630 | good | 3 | 3,000,000 | 60 | 221 | 86,400,000 | 30 |
| 7 | 78 | 92 | 722 | great | 4 | 3,600,000 | 60 | 253 | 86,400,000 | 30 |
| 8 | 78 | 92 | 814 | great | 4 | 4,200,000 | 60 | 285 | 86,400,000 | 30 |
| 9 | 78 | 92 | 906 | great | 5 | 5,400,000 | 60 | 317 | 86,400,000 | 30 |
| 10 | 78 | 92 | 998 | great | 5 | 7,200,000 | 60 | 349 | 86,400,000 | 30 |

> 上界对照：L10 资源地 998 + great leader ＜ deep 城市 scale=8 1880 + great，且 leader 不超 deep 城市，"据点不是城"自评成立。下界：L1 170 与 near 城市下沿对位，1-2 城早期玩家无法 60 兵 5 分钟批量刷。系统驻军最低 60（L1），杜绝 v1 "ownGarrison=0 → 1 帧掠夺链"（B-2/B-4）。

(注明：L1 实兵力复校见下)

### 3.3 `resource_node_tuning`（占领 / 经济 / 离线 / 可见性 / 铺设 key-value 表）

参照 `config/tables/diplomacy_tuning.xlsx` key-value 风格。包含 v1 `resource_node_tuning` + v1 `resource_node_placement` 全部参数（3 张表收敛，采纳 kimi 3.3）。

#### 3.3.1 占领上限与归属（P0 无衰减双硬上限，采纳必采 4）

| paramKey | value | 含义 |
|---|---|---|
| maxOwnedPerPlayer | 12 | 单玩家占领总数上限（"占不下"硬拒绝，非衰减）|
| maxOwnedPerType | 6 | 单类型上限，防独家垄断稀缺资源 |
| yieldDecayEnabled | false | **P0 关闭衰减**；P1 再议（必采 4）|
| resourceNodeIncomeTarget | activeCity | 收益写回 `gameState.activeCityId` 对应城市（必采 5）|

#### 3.3.2 离线参数（独立，不复用城市，采纳 B-3）

| paramKey | value | 含义 |
|---|---|---|
| offlineEfficiencyForResourceNode | 0.5 | 资源地离线收益效率（城市沿用 `GameConfig.resources.offlineBaseEfficiency=0.8`）|
| offlineMaxHoursForResourceNode | 4 | 资源地离线结算最多 4h（城市沿用 `maxOfflineHours=8`）|

> 离线 4h ×0.5 = 7200s 等效。满占 12 个 Lv10（保守按双硬上限制 3/type）= 3×(3.30+2.86+2.09+3.96) = 36.63 总资源/s × 7200 ≈ 26.4 万总资源，与城市离线 8h（中期 30-50 万）量级相当而不再爆 150 万（采纳 A3 blocker）。在线结算走 §4 `Math.floor` 统一。

#### 3.3.3 可见性 / 安全期 / 退场

| paramKey | value | 含义 |
|---|---|---|
| ownedAlwaysVisibleSelf | true | 己方已占领节点恒可见（远景 main city 看自己也可见）|
| enemyOwnedVisibleRule | currentVision | 敌方已占领节点按当前视野投影（玩家要靠近才能看到掠夺点）|
| deployTileWalkable | true | deploying tile 对第三方行军可达但 `getActiveEncounterAt` 不命中（站上去无逻辑、不阻塞路由；见 §4）|
| abandonLocksCombat | false | 安全期内 owned 节点对第三方不可开战（safeUntil>now）|
| lazyCheckDeployCompletesAt | true | deploy→owned 走 lazy-check，不新增全局 tick（必采 1）|

#### 3.3.4 铺设参数（并入 tuning，采纳 kimi 3.3）

| paramKey | value | 含义 |
|---|---|---|
| activityRegionSize | 8 | 活动区网度，对齐营地 `WorldCampSpawner` |
| safeRadiusFromActivity | 1 | 距活动源最近距离（保护出生区）|
| minSpacing | 2 | 两资源地最小间距(Chebyshev) |
| ringBands | json | `[{minRing:2,maxRing:3,targetNodes:2},{minRing:4,maxRing:5,targetNodes:2},{minRing:6,maxRing:8,targetNodes:2}]` |
| tierByRing | json | 地理梯度：`[{minRing:2,levelMin:1,levelMax:3},{minRing:4,levelMin:2,levelMax:5},{minRing:6,levelMin:4,levelMax:7},{minRing:8,levelMin:6,levelMax:10}]`（近弱远强）|
| typeWeightForest | 0.3 | 4 类型可铺设权重 |
| typeWeightStone | 0.2 | |
| typeWeightIron | 0.2 | |
| typeWeightFarm | 0.3 | |
| terrainFilterForest | csv | 允许地形：`plains,forest,hills`（排除 `MARCH_BLOCKED_TERRAINS`）|
| terrainFilterStone | csv | `hills,mountain,waste` |
| terrainFilterIron | csv | `mountain,hills,waste` |
| terrainFilterFarm | csv | `plains,forest,shore` |
| sharedOccupiedTilesSource | true | 与营地共享一处 `occupiedTiles` 单源避免同 tile 冲突（Q6，第二段答）|

#### 3.3.5 AI（P1 开关，形状现在定）

| paramKey | value | 含义 |
|---|---|---|
| aiCanOccupy | false | P0 关闭；P1 打开 |
| aiMinLevelToClaim | 4 | AI 仅对 ≥L4 节点发起夺占（采纳 M-9）|
| aiMinSoldiersToClaimNode | 200 | AI 夺占最小可用兵力门槛 |
| weightExpandCity | 0.6 | `weightExpand` 内部拆 expandCity/expandNode 子权重（必采 11）|
| weightExpandNode | 0.4 | |
| aiCandidateShape | json | 候选评分字段签名 `[{nodeId,type,level,yieldPerSecond,defenderSoldiers,distanceFromAiFaction,protected}]`（第二段详）|

### 3.4 验收门（必采 4，spec 内含）

- 把最终收益表（§3.1）+ 离线参数（§3.3.2）+ 双硬上限灌进 `scripts/economy-balance-model.js` 跑 **30 天在线 + 30 天离线** 双场景模拟，产出对比报告：满占玩家 vs 不占玩家在 30 天末的资源量级差、铁瓶颈是否仍成立、是否再现 v1 的"150 万/滚雪球"现象。报告作为 P0 进 P1 的硬门（不达标则调 §3.1 系数或上限）。

---

## 4. 占领状态机与服务端流程（按必采 2/3/6：中止原子化、系统驻军+安全期+30s 退场、离线败北补返程）

### 4.0 形态总览

node 侧 status 仅两态：`idle`（owner 区分无主/已占领）与 `deploying`。战斗瞬间由 encounter 投影承载（§2.3）。完整生命周期：

```
[idle:owner=null] ──抵达/发起进攻──▶ (encounter active 战斗中) ──胜──▶
   [deploying:claimant] ──部署完成(lazy-check)──▶ [idle:owner=claimant + systemGarrison + safeUntil]
        │                                                  │
        │ 玩家中止(原子)                                    │ 第三方在 safeUntil 之后抵达
        ▼                                                  ▼
   [idle:owner=null + 守军残留/再生]                    (encounter active 被夺战斗) ──胜──▶ [deploying:新claimant]
        │                                                  │败
        ▼                                                  ▼
   (encounter active 败北) ──补返程必采6──▶ 编队返城      [idle:owner 原主不变 + systemGarrison 残留]
```

全流程服务端权威，客户端只发"意图"。`completesAt` 只能服务端 lazy-check 推进，**不接受 client 推送**（采纳 M-12）。

### 4.1 `[idle:owner=null]` → 战斗（攻打守军）

- 触发：玩家行军抵达 node tile（`WorldExplorerProgression.resolveMissionArrival`，`WorldExplorerProgression.js:324` 现有 arrival hook 命中），或玩家在 tile 上"发起进攻"。
- 前置闸：① `node.status!=='deploying'`；② `node.owner!==claimant`；③ 若 `node.safeUntil>now` 且 node 已 owned 拒绝（安全期）；④ `node.combatEncounterId===null`（node 级互斥，必采 1）；⑤ player-level `WORLD_COMBAT_SESSION_BUSY` 单战斗在局。任一不满足返回对应 error（`DEPLOY_IN_PROGRESS` / `SAFE_PERIOD` / `ALREADY_IN_COMBAT`）。
- 战斗链路**完全复用** `WorldCombatSessionService.openSession`/`resolveSession`（`backend/services/worldCombat/WorldCombatSessionService.js`）：服务端建 seed+setup；适配器 `ResourceNodeEncounterAdapter` 按 §2.3 把 node 投影成 encounter（leader 走 `DefenderLeaderService.createDefenderLeader(type:'resource_node',...)`，必采 10 profile 第二段定）注册进 `sharedEncounters`，设 `node.combatEncounterId`；客户端打、录 inputStream，服务端用 `BattleSimService.simulateSetup` 权威重算。
- **node 级互斥**：encounter 与 player session 锁双闸。第二个玩家对同 node `openSession` → `getActiveEncounterAt` 命中已存在 encounter 或 `combatEncounterId` 非空 → `ALREADY_IN_COMBAT`（采纳 deepseek §3.3）。
- 胜利回写（encounter→node）：置 `node.status='deploying'`、`deploy.{startedAt=now, completesAt=now+deploySeconds×1000, claimant=玩家}`、`node.combatEncounterId=null`、encounter 置 `resolved`。残存攻击方编队**就地停留 tile**（不回城，守部署期）。
- 败北回写（encounter→node）：node owner/守军定格（保留残兵），`node.combatEncounterId=null`，encounter 置 `resolved`；**编队按 `returnWorldMarch` 返程**——⚠️实现注意事项：`WorldCombatSessionService.js:278-281`（交互式路径）已调 `returnWorldMarch`，但 `resolveEncounterBattle`（`WorldCombatEncounterService.js:570-624`，被动/离线兜底路径）**不调**。资源地 encounter 在 `resolveEncounterBattle` 败北路径补一次 `returnWorldMarch`，使两条路径败北行为一致（必采 6）。spec 显式标注"这是现有引擎两路径不一致"为开发者已知 caveat。
- 离线兜底：`resolveEngagedTimeouts`（`WorldCombatEncounterService.js:685`）现有 45s `AUTO_ENGAGE_FALLBACK_MS` 兜底纳入同一 engaged 超时扫描；补返程后即同 T-2.3 测例。

### 4.2 `deploying` 部署期（冻结 60s）

- 编队**不可移动、不可撤退**（需求 5）。在 `WorldExplorerActions`（`backend/services/worldExplorer/WorldExplorerActions.js`）的 `startWorldMarch`/`returnWorldMarch`/`stopWorldMarch` 之前加一道"该 mission 是否锁定部署期"校验（mission 侧 `attackingNodeId` 或 node 侧 `deploy.claimant` 关联 player 判定）。
- **中止占领原子化（必采 2，主选后端原子）**：玩家尝试移动/撤退时**后端不先返回错误**，而是直接弹确认（前端）——玩家确认后，后端 `WorldExplorerActions` 的 `startWorldMarch`/`returnWorldMarch` 分支在检测到 mission 关联 node deploying 时，**原子执行**：
  1. 中止占领：置 `node.status='idle'`（owner 保持 null，回到无主）、`deploy={}`、守军按残兵定格 + `regenAt=now+respawnCooldownMs`、`node.combatEncounterId=null`；
  2. **立即继续**玩家原本的移动/撤退动作（创建/恢复 march）。
  → 部队**不原地 idle、不罚站**，"一次确认、一次完成"。冻结提示语"移动/撤退将会中止占领进程"原文不变，作为确认框正文（文案双语 catalog 见第二段，后端直发中文同一句）。
  - 该原子分支在 `WorldExplorerActions` 单事务内完成（owner/garrison 写回与 march 写回不可分割），避免"中止了但没走成"的中间态。
- **部署期被第三方攻击**：采纳 v1 §3.3 决定 + 必采 3 安全期前置：部署期内 node 不作为可攻击 encounter 投影（`getActiveEncounterAt` 不命中，因 `combatEncounterId=null` 且 node 非 encounter）。第三方行军到 deploying tile —— tile **可达但不可开战**（`deployTileWalkable=true`，站上去无逻辑、不阻塞路由，见 kimi 2.6 必答第二段细化）；第三方发起 `attackResourceNode` 得 `DEPLOY_IN_PROGRESS` 拒绝。
- **部署 completion 走 lazy-check（必采 1，不新增全局 tick）**：deploy→owned 不挂全局定时器。下次该 node 被任一玩家查询（视野投影/`getActiveEncounterAt`/行军抵达/收益结算）时，`ResourceNodeRepository` 先检查 `node.status==='deploying' && now>=deploy.completesAt`，过期则原子推进到 owned（见 4.3）。
  - 若一直无人查询，node 维持 deploying 持久态——无副作用（无收益、无被夺），下次被触及才落地。这避免了 deepseek §2.4 提出的"deploy→owned 缺可接入定时回路"，复用营地 `respawnCampIfReady` 同 lazy 模式（`WorldCombatEncounterService.js:188-202`）。

### 4.3 `deploying` → `idle:owner=claimant`（部署完成落地）

lazy-check 命中 `deploy.completesAt` 过期时原子执行：
1. `node.status='idle'`、`node.owner=deploy.claimant`、`deploy={}`；
2. **立即注入系统驻军**（必采 3 修复玻璃堡垒）：`node.systemGarrison.soldiers = round((baseSoldiers+perLevel×level) × systemGarrisonRatio=0.35)`、`injectedAt=now`、`regenAt=now+systemGarrisonRegenSeconds×1000`（自修复 30min），**不允许 0**；
3. 设安全期：`node.safeUntil = now + safePeriodMs`（默认 24h），安全期内不可被第三方攻击；
4. `node.income.lastSettledAt = now`（收益游标起点）。
- **TOCTOU 封堵**：owned 落地后**当前 tick 内**不立即把 node 投影为可攻击 encounter；须到**下一 tick**（或下次 lazy-check）才允许 adapter 重新投影为可攻 encounter（必采 1 + deepseek §2.1）。实现：adapter 投影前查 `safeUntil>now` 闸（24h）天然覆盖此窗口；即便安全期为 0，也加一个 `ownedEffectiveAt=now` 标记，投影前 `now > ownedEffectiveAt + 1 tick` 才放行。
- 系统驻军自修复：被夺/损伤后按 `systemGarrisonRegenSeconds` 回血至注入量；占领方**不获得**系统驻军控制权（不能调动/换防系统兵），系统驻军是固定防御体。
- 占领方编队换防：v1 的"攻打编队就地驻防"在 v2 取消（采纳 deepseek §3.2，规避 tile-formation-node 三向引用）。占领方编队在部署完成后**即可自由移动**（不再锁），节点防御完全交给系统驻军 + 安全期。玩家想增防 → 行军新编队到 tile → 该编队作为"额外攻击方"在 node 被夺时参与防御战斗（第二段细则）。

### 4.4 `idle:owner=玩家` 已占领（收益 + 被夺）

#### 4.4.1 每秒收益结算（tick 模型，必采 5 归属）
- **选型保持 v1：tick 模型而非三条腿**。资源地收益是持续状态式被动产出，与现有 `CityService.advanceAllCities`（`CityService.js:254`）城市 tick 同回路；新增 `ResourceNodeIncomeService.settleOwnedNodes(gameState, now)` 在 `advanceAllCities` 末尾调用一次。
- 结算：遍历 `owner==='player'` 的 node，`gain = Math.floor(yieldPerSecond × max(0, now - income.lastSettledAt))`（**在线也 floor**，与离线一致，采纳 kimi 3.1），写回 `gameState.activeCityId` 对应城市 `city.resources[resourceKey]`（`Math.max(0, ...)`，对齐 `awardCampLoot` 写法 `WorldCombatEncounterService.js:208-221`），更新 `income.lastSettledAt=now`。
- 归属显示：面板标注"收益归入 {activeCityName}"（必采 5，第二段 UI）；切换 activeCity 时收益结算游标不回溯，下次 tick 起新归入城市。
- **被夺游标截止**：node 被夺走时（owner 变更），原主最后一笔结算截止到**失控时刻**（即夺占战斗胜利回写时刻），不让"被夺瞬间把原主未来收益入账"（采纳 minimax T-6.5/6.6）。
- **storage cap 行为（M-2 前置风险）**：现有 `city.resources` 无全局 storage cap，资源地收益会无上限累积入 active city。P0 由独立离线参数 0.5/4h（B-3）压低离线爆发；spec 显式标注：**P1 前建议前置加 storage cap（仓库/粮仓建筑硬上限），否则在线长期累计仍可能膨胀**。

#### 4.4.2 被夺（`idle:owner=玩家` → 战斗 → `deploying:新claimant`）
- 触发：第三方（玩家或 AI）行军抵达 owned node tile。前置闸：① `safeUntil<=now`（安全期内拒绝 `SAFE_PERIOD`）；② owned-effective 下一 tick 闸（4.3）；③ `combatEncounterId===null`。
- 防御方 = `node.systemGarrison`（不是原主编队，必采 3）；原主若在 tile 上留有编队，作为额外防御方加入战斗（第二段细则；P0 可先只取系统驻军）。
- 胜：进入新 `deploying:claimant=第三方`（同 4.2，60s 后落地 4.3 系统驻军重注入）；原主 owner 失效，收益游标按 4.4.1 截止。
- 败：node 保持 `idle:owner=原主`，systemGarrison 残兵定格 + regenAt 启动自修复；第三方编队败北补 `returnWorldMarch`（4.1，必采 6 两路径统一）。

### 4.5 撤军退场流程（必采 3，30s 镜像部署）

修复 v1 "撤军=瞬间回 uncontrolled + 守军 0 → 1 帧掠夺"（B-4）。占领方主动放弃节点（行军撤走编队离开 tile，或主动 `abandonNode` 意图）触发：
1. 立即开启 **30s 退场**（`abandonSeconds`，与部署镜像）：node 进入 `abandoning` 子态（`status` 仍 `idle:owner=原主`，附加 `abandonStartedAt=now`），**在此期间 systemGarrison 照常存在、安全期内不可被夺**，不允许"瞬间回城即弃"。
2. 退场 30s 到点（lazy-check 同 §4.2 模式）：`node.owner=null`、`node.status='idle'`、`systemGarrison={}`、守军 `garrison` 按 `respawnCooldownMs` 启动再生（`regenAt=now+respawnCooldownMs`）、`safeUntil={}`。
3. 退场中若被中断（owner 重新发 march 回 tile）→ 取消退场，恢复 `idle:owner=原主`。
- 此设计让 v1 "撤退→1 帧被白嫖" 链（C5）不可行：退场 30s 内守军常在，第三方无法在撤走的瞬间无伤占领；最差也是与正在退场的系统驻军打一场。

### 4.6 离线场景

- 玩家下线：资源地收益按独立离线参数（`offlineEfficiencyForResourceNode=0.5 / offlineMaxHoursForResourceNode=4h`，B-3）在下次上线时一次性结算，走 `CityService.calculateOfflineIncomeForAllCities`（`CityService.js:298`）扩增出口：返回值新增 `resourceNodeIncome` 段（按 type 汇总 + 归入 activeCityName），供前端区分"城市自产 vs 资源地收益"（必采 5 + deepseek §2.3）。结算同样 `Math.floor` 与在线一致。被夺节点的原主离线入账按 4.4.1 截止到失控时刻（采纳 T-6.6）。
- 战斗在局时玩家下线：上层 `SESSION_STALE_MS`（5min）扫除 + engaged 45s 兜底已有，败北路径补返程（4.1 必采 6），不改其它。
- 部署期玩家下线：deploy 状态在 `ResourceNodeRepository` 持久层保留，服务端 lazy-check 在下次被触及/上线时推进 owned（不依赖 client）。

---

## 5. 客户端 UI 与文案

遵守 UI 公理（`docs/architecture/button-scheduler-manager-panel-refactor-spec-2026-07-09.md`）：按钮只发意图 → `CanvasActionDispatcher` → `CanvasPanelActionRegistry`（描述符表）→ `PanelActionRunner` → panel 独立文件。**不走旧 controller `handle_*` 路径**（spec §6.11 / 8b 退役闸）。

### 5.1 资源地信息面板（拟新增独立 panel 文件）

- 文件：`frontend/js/platform/panels/ResourceNodePanel.js`（参照 `FamousPersonsPanel.js`（`frontend/js/platform/panels/FamousPersonsPanel.js`）独立 IIFE panel；注册进目录 `frontend/js/platform/panels/CanvasPanelRegistry.js` 的 `PANELS` 映射，键 `resourceNode`）。
- 注册动作描述符 → `frontend/js/platform/CanvasPanelActionRegistry.js`（必采 9 上游依赖，见 §7 §17 项）：描述符按 button-scheduler spec §6.1/§6.2 形状（`panelKey` / `operation` / `dirty` / `disabled` / `hooks`）。

| 动作 token | panelKey | operation | dirty | 说明 |
|---|---|---|---|---|
| `openResourceNode` | `resourceNode` | `open` | `['modal']` | 打开面板（带 nodeId/processId 参数） |
| `closeResourceNode` | `resourceNode` | `close` | `['modal']` | 关闭 |
| `attackResourceNode` | `resourceNode` | `commit` | `['modal','world']` | 发起攻占意图（→后端 `GameActionRegistry`） |
| `abortDeploy` | `resourceNode` | `commit` | `['modal','world']` | 中止占领（带二次确认 hook，见 §5.3） |
| `abandonNode` | `resourceNode` | `commit` | `['modal','world']` | 主动撤军放弃节点（触发 §4.5 30s 退场） |
| `moveWithAbortDeploy` / `retreatWithAbortDeploy` | `resourceNode` | `commit` | `['modal','world']` | 见 §5.3：复合意图，前端 dispatcher 串行 `abortDeploy`→`startWorldMarch/returnWorldMarch` |

- 面板展示字段：类型 / 等级 / 守军情报（"打了才知道"，未打过显示"守军情报未知"，见 §6）/ 每秒收益（标注 `Lv.{level} 每秒 +{amount} {resource}/s`）/ 归属 / 归属城市"收益归入 {activeCityName}" / 部署进度 `部署中 {left}s` / 安全期倒计时 / 队列上限 `已占 {owned}/{maxOwnedPerPlayer}`。
- 持续 vs 一次性区分（minimax m-1）：资源地面板所有收益标注 `/s`（持续），营地面板标注"战利品（一次）"，避免玩家误判。

### 5.2 冻结提示语交互流（必采 2 原子化 — §4.2 详述，此处给客户端侧契约）

冻结需求 #5 要求"移动/撤退时必须提示：'移动/撤退将会中止占领进程'（确认则中止占领）"。v2 主选**后端原子**方案：前端只负责弹确认、发复合意图，后端在 `WorldExplorerActions` 单事务内"中止占领 + 继续原动作"（§4.2）。客户端不发"先中止→再移动"两步（避免 kimi blocker 的 3-4 步罚站）。

前端交互流（仅当 mission 关联 node 正处 deploying 时触发）：

```
1. 玩家点移动/撤退（dispatch `startWorldMarch` 或 `returnWorldMarch`）
2. dispatcher/runner 预检（或后端响应中携带 needsAbortDeployConfirm=true）
3. 弹出 modal 二次确认（标题="中止占领进程" / 正文="移动/撤退将会中止占领进程" / 按钮：确认中止 / 继续占领）
4a. 玩家选"继续占领" → 关闭 modal，部署继续（dispatch 不下发移动意图）
4b. 玩家选"确认中止" → dispatch 复合意图 moveWithAbortDeploy/retreatWithAbortDeploy
     → 后端 WorldExplorerActions 单事务：中止占领 + 继续原动作
     → 部队不原地 idle，直接开始行军
```

> 复合意图实现路径由 button-scheduler dispatcher 的 action chain 支持（spec §6.x：runner 接受顺序动作、中间失败回退）。若 dispatcher 尚未支持 chain，fallback 为前端在 `abortDeploy` 成功回调内自动转发原 `startWorldMarch/returnWorldMarch`——但**禁止**让玩家手动两次点击（必采 2 硬要求）。
> 冻结提示语原文不可改。前端走 catalog 本地化渲染，后端校验拒绝路径直发中文同一句（双源，T-10.6 一致性测例）。

### 5.3 文案与双语 catalog

一切显示文本走 `t(key, params)`（`frontend/js/config/LocaleTextRegistry.js`），后端确认框消息直发中文。新增 key（对齐现有 `world.combat.camp.*` 风格，行 856-858/1874-1876）：

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
| world.resourceNode.field.incomeCity | 收益归入 {cityName} | Income to {cityName} |
| world.resourceNode.field.ownedCount | 已占 {owned}/{max} | Occupied {owned}/{max} |
| world.resourceNode.deploy.progress | 部署中 {left}s | Deploying {left}s |
| world.resourceNode.safePeriod | 安全期 {left} | Safe {left} |
| world.resourceNode.deploy.abortTitle | 中止占领进程 | Abort Occupation |
| world.resourceNode.deploy.abortMessage | 移动/撤退将会中止占领进程 | Moving/withdrawing will abort the occupation. |
| world.resourceNode.deploy.abortConfirm | 确认中止 | Confirm Abort |
| world.resourceNode.deploy.abortCancel | 继续占领 | Keep Occupying |
| world.resourceNode.abandon.title | 撤离资源地 | Abandon Node |
| world.resourceNode.abandon.message | 撤离将开始 30 秒退场，期间守军照常驻防 | Withdrawal starts a 30s retreat; garrison stays during it. |
| world.resourceNode.abandon.confirm | 开始退场 | Start Retreat |
| world.resourceNode.abandon.cancel | 驻守 | Stay |
| world.resourceNode.garrison.unknown | 守军情报未知 | Garrison strength unknown |
| world.resourceNode.error.deployInProgress | 移动/撤退将会中止占领进程 | Moving/withdrawing will abort the occupation. |
| world.resourceNode.error.safePeriod | 安全期内不可攻打 | Target is in safe period |
| world.resourceNode.error.alreadyInCombat | 已有战斗在局 | Combat already in progress |
| world.resourceNode.error.ownedFull | 已达占领上限 | Occupation limit reached |

> 文案统一用"占领"（采纳 kimi 3.6），不混用"部署"作面向玩家术语（"部署"只作技术状态名）。冻结提示语 `abortMessage` 双语成对，后端 `DEPLOY_IN_PROGRESS` 错误 `message` 字段直发 zh-CN 同一字符串。
> leader 历史 UI（minimax m-9）作为面板"已击败守将"滚动列表，P1 添。

### 5.4 教程（后续项）

参照 `backend/services/tutorial/TutorialActionValidator.js`（白名单/限流）：`attackResourceNode`/`abortDeploy`/`abandonNode`/`moveWithAbortDeploy`/`retreatWithAbortDeploy` 进 `PASS_THROUGH_ACTIONS` 白名单（`TutorialActionValidator.js:24`）；"占领第一座资源地"作为教程后段可选步。P0 标记后续。

---

## 6. 战争迷雾与可见性（复用 SSOT）

- 无主节点：复用**当前视野谓词** `WorldExplorerVision.computeCurrentVisionCoordSet`（`backend/services/worldExplorer/WorldExplorerVision.js:118`）—— 视野内才投影，走开就隐。与营地 `WorldCombatEncounterService.isEncounterVisibleToPlayer`（`WorldCombatEncounterService.js:819-827`）同一规则。**不复用** `getRevealedTileCoordSet`（"发现一次→永久可见"的城市规则）。
- 己方已占领节点：`ownedAlwaysVisibleSelf=true` 时恒投影（含从远景主城可见，与城市受占后 controlled 语义一致：你的资产你看得见）。
- 敌方已占领节点：`enemyOwnedVisibleRule=currentVision`，按当前视野投影——玩家要靠近才能看到掠夺点（回答 minimax Q4：敌方节点需进入视野才可见，与无主节点同规则，避免远程全图报点）。
- 坐标键 SSOT：`WorldMapService.getTileCoordinateKey`（`backend/services/WorldMapService.js:309`）。
- 守军情报"打了才知道"：投影层对未打过该 node 的玩家不携 `garrison.soldiers` 数字，沿用 `WorldCombatEncounterService.hasFoughtEncounter` + `getClientEncounterBattleTarget` 的 `intelSnapshot.knownGarrison` 门控（`WorldCombatEncounterService.js:729-783`）。被夺后该玩家的 knownGarrison 擦除（新守军是系统驻军，玩家未打过新守军，T-8.2 测例）。

---

## 7. 与现有系统接缝（逐文件列）

| # | 现有文件 | 接缝动作 |
|---|---|---|
| 1 | `shared/worldMarchCore.js` | 铺设/可达复用 `MARCH_BLOCKED_TERRAINS` / `buildAxisAlignedRoute`；行军到资源地 tile 走现有 reachability，不另起路由。deploying tile 对第三方**可达但不可开战**（§4.2），路由算法不变 |
| 2 | `backend/services/worldExplorer/WorldExplorerActions.js` | 新增校验：mission 关联 node 处 deploying 锁定时，`startWorldMarch`/`returnWorldMarch`/`stopWorldMarch` 走**原子中止分支**（中止占领 + 继续原动作，§4.2）；新增 `abandonNode` 动作（30s 退场，§4.5）。沿用 `returnWorldMarch`（`WorldExplorerActions.js:414`）的 march authority 模式 |
| 3 | `backend/actions/GameActionRegistry.js` + `backend/services/WorldExplorerService.js` | 登记 `attackResourceNode`/`abortDeploy`/`abandonNode`/`moveWithAbortDeploy`/`retreatWithAbortDeploy`，参照已登记的 `returnWorldMarch`（`GameActionRegistry.js:21` 的 `TERRORY_ACTIONS`）。后端校验失败返回对应 error code + 直发中文 `message` |
| 4 | `backend/services/worldExplorer/WorldExplorerProgression.js` | arrival hook（`WorldExplorerProgression.js:324` 的 `resolveMissionArrival` 调用点）加分支：目标为资源地 node 时经 `ResourceNodeEncounterAdapter` 进入战斗，而非城占领 |
| 5 | `backend/services/worldCombat/WorldCombatSessionService.js` + `WorldCombatEncounterService.js` | 资源地 node 由 adapter 投影成 encounter 喂入开/结战斗；复用 `openSession`/`resolveSession`/`applyCampVictorySpoils`/`settleMissionSnapshot`/`resolveEngagedTimeouts` 链路；投影自 `getClientEncounter` 同构派生。新增 `ResourceNodeEncounterAdapter`（拟新增 `backend/services/worldResource/ResourceNodeEncounterAdapter.js`）作为唯一 node↔encounter 搬运层 |
| 6 | `backend/services/worldCombat/WorldCombatEncounterService.js` | `resolveEncounterBattle`（`570-624`，被动/离线路径）败北路径**补 `returnWorldMarch`**（必采 6）—— 规避 v1 错引交互路径返程。spec 显式标注"这是现有引擎两路径不一致"为开发者已知 caveat |
| 7 | `backend/services/battle/BattleSimService.js` | 权威战斗引擎直接复用，无改动；守军 general 经 `WorldCombatEncounterService.getDefenderGenerals` 同构 |
| 8 | `backend/services/territory/GarrisonPolicy.js` + `GarrisonCaptureResolver.js` | 资源地守军**不**走城 `garrison` 表（自有 `resource_node_garrison`）；leader 生成走同一 `DefenderLeaderService`（必采 10 profile 见 §7 #18）；P0 不接捕将流（不预留 `captureChance` 列），P1 `--scaffold` 再加列 |
| 9 | `backend/services/worldCombat/WorldCampSpawner.js` + `backend/config/WorldCampConfig.js` | 新增 `backend/services/worldResource/ResourceNodeSpawner.js`（拟新增）镜像其铺设算法（活动区/环走/确定性排序/占位避让/地形探针），**不修改**营地代码；两者**共享一处 `occupiedTiles` 单源**（回答 minimax Q6，新增 `paramKey sharedOccupiedTilesSource=true`，避免同 tile 同时为营地+节点）；activityRegion 复用 |
| 10 | `backend/repositories/WorldEncounterRepository.js` | 新增 `backend/repositories/ResourceNodeRepository.js`（拟新增，同构 upsert/getActive/getAll/按 tile 取/lazy-check 推进）；作为共享世界实体的持久层 |
| 11 | `backend/config/ConfigTables.js` + `config/tables/table-schemas.js` + `scripts/build-config-tables.js` | 登记 3 张新表（§3），跟现有 `--scaffold/--check` 流程走；P1 扩展列（`captureChance` 等）由 `--scaffold` 自动补空值 |
| 12 | `backend/calculators/ResourceTickCalculator.js` | 不改；资源地收益自带 `ResourceNodeIncomeService.settleOwnedNodes` |
| 13 | `backend/services/CityService.js` | `advanceAllCities`（`CityService.js:254`）末尾追加 `ResourceNodeIncomeService.settleOwnedNodes` 调用（写回 active city `resources`，与 `awardCampLoot` 同一写入约定）；`calculateOfflineIncomeForAllCities`（`CityService.js:298`）追加资源地段并**扩增返回值结构** `resourceNodeIncome`（按 type 汇总 + 归入 cityName），供前端区分城市自产 vs 资源地收益（必采 5 + deepseek §2.3） |
| 14 | `backend/services/WorldMapService.js` + `worldExplorer/WorldExplorerVision.js` | 资源地投影调 `computeCurrentVisionCoordSet`/`getTileCoordinateKey`，无新增视野来源；可见性规则见 §6 |
| 15 | `shared/faction/aiFactionCore.js` + `backend/services/faction/*` | 新增 action token `CLAIM_RESOURCE_NODE`；`weightExpand` 拆 `expandCity/expandNode` 子权重（必采 11）；候选形状 `aiCandidateShape` 见 §11；P0 不启用，仅定形状 |
| 16 | `frontend/js/config/LocaleTextRegistry.js` | 加 §5.3 全部 key（zh-CN + en 双 catalog，对齐 `world.combat.camp.*` 风格，`LocaleTextRegistry.js:856-858/1874-1876`） |
| 17 | `frontend/js/platform/panels/CanvasPanelRegistry.js` + `frontend/js/platform/CanvasPanelActionRegistry.js`（必采 9 上游依赖） | 注册 `ResourceNodePanel` 与动作描述符。**显式声明上游依赖**：`CanvasPanelActionRegistry.js` 是 button-scheduler spec 规划的**新文件**（`docs/architecture/button-scheduler-manager-panel-refactor-spec-2026-07-09.md` 643-649/1157）目前 repo 不存在。**依赖顺序**：button-scheduler 重构落地（Slice 1 descriptor 分支 + Slice 2 controller 退役）先于资源地面板注册。**fallback**：在 `CanvasPanelActionRegistry` 移植到位前，资源地动作暂走旧 `CanvasActionController`/dispatcher 兼容路径（spec §6.2 fallback 决策在 action 副作用之前：dispatcher 处理则不调 controller）；一旦 Slice 2 退役闸落地，资源地动作切到纯 dispatcher/runner 路径。SPEC 必须把"上游 button-scheduler 落地"列进 P0 前置门 |
| 18 | `backend/services/DefenderLeaderService.js`（必采 10 profile + fallback） | 在 `PROFILE_BY_OWNER`（` DefenderLeaderService.js:17`）新增 `resource_node` profile（见下）；`getProfileForOwner` 自动命中。但 **owner profile 是按 `territory.owner` 取的**，资源地 territory 形状要喂 `owner:'resource_node'` 给 `createDefenderLeader`（注意资源地不走 territory repository，adapter 造假 territory shape 传 {id, owner:'resource_node', threat, scale, defense}）。`quality` 经 `options.quality` 传入（走 `normalizeQuality`，§19 行 169）。**fallback 行为显式声明**：`normalizeQuality`（`backend/services/skillGenerator/SkillGeneratorNormalizer.js:17`）只认 `QUALITY_BUDGETS` 键 `common/good/great/legendary`（`SkillGeneratorConstants.js:70-74`），传入 `seasoned/elite`（营地系自有值，`WorldCampConfig.js:36/46`）会回退到 `'common'`。本 spec §3.2 garrison 表 leaderQuality 只用 `common/good/great`，规避 fallback 失配 |

### 7.1 `DefenderLeaderService.PROFILE_BY_OWNER.resource_node`（必采 10，拟新增条目）

参照现有 `tribe/city_state/ruin_guardians/neutral` 同构，给资源地（据点而非城）一个 vianger/guardian 混合 profile，属性略低于 `city_state`（据点不是城）：

```
resource_node: {
  ownerLabel: '据点',
  archetype: 'vanguard',            // 资源地守将偏攻击型，与"伐木场/铁矿场守备"主题契合
  abilityArchetype: 'commander',
  titlePool: ['据点戍将', '采伐校尉', '矿场督尉', '屯田护军校'],
  surnamePool: ['勒', '焦', '邵', '岑', '茅'],
  givenPool: ['磐', '峙', '镐', '芟', '陨'],
  baseAttributes: { command: 58, force: 64, intelligence: 46, politics: 36, charisma: 42, speed: 50 },
}
```

> L8-10 用 great leader，对应 `getQualityForThreat(5)=great`（`QUALITY_BY_THREAT` maxThreat:Infinity→legendary，但本表强制 `options.quality='great'`），与"legendary 留给城市 deep"一致（B-1/M-3）。

---

## 8. 美术素材清单（必采 7：可执行 prompt + 尺寸阶梯 + one-by-one + 命名 + overlay 验证 + S1/S2 徽标）

由 Codex 用 `generate2dsprite` 技能生成，沿用现有地图元素品红底抠图管线（`TerritoryConstants.SITE_ART`，`backend/services/territory/TerritoryConstants.js:25-32`，路径 `assets/art/world-site-*-cutout.png`）。

### 8.1 生成方式与尺寸阶梯

- **生成方式：one-by-one**（`.agents/skills/generate2dsprite/SKILL.md` 明确禁止把 buildings/large sites 放进 square prop pack）。资源地全部 16 张主 cutout 均为建筑类 = one-by-one。
- **尺寸阶梯**（采纳 kimi 2.4 / 必采 7，大型站点需更大画布表现建筑群层次）：

| 视觉分档 | 等级 | 尺寸 | 适用 |
|---|---|---|---|
| tier 1 | L1-3 | 256×256 | 小型据点（散石采坑/新垦田畦/林地小伐木栈/露天矿苗） |
| tier 2 | L4-6 | 384×384 | 中型场站（阶梯采石场/引水梯田/围栏伐木场/木架铁坑） |
| tier 3 | L7-9 | 512×512 | 大型枢纽（深井采石矿/成片农庄/伐木水车林站/竖井铁矿场） |
| tier 4 | L10 | 512×512 | 顶级砦垒（雕柱巨石场/大型屯田仓/大型林场砦/大型熔炉矿场） |

> tierVisual 改代码映射（采纳 kimi 3.5）：`tier = Math.min(4, Math.floor((level-1)/3)+1)`，不进表。

### 8.2 主 cutout（16 张 = 4 类型 × 4 档）

命名规范（采纳 deepseek §6.2 + 必采 7）：`frontend/assets/art/world-site-rnode-<type>-<tier>-cutout.png`（对齐现有 `world-site-city-cutout.png` 前缀 + `-cutout` 后缀；`frontend/` 前缀必填，避免歧义）。每张给英文可执行 prompt（含风格锚点 + 品红底 + 等距手绘低饱和；Codex 用 image_gen 生成品红底 raw sheet 再本地 chroma-key 处理）：

**forest（木材）**
- `world-site-rnode-forest-1-cutout.png` (256) — prompt: `"Isometric hand-painted game asset, small lumber camp with a few log stacks and a rough timber shed, low saturation earthy tones, light outline, solid #FF00FF background, clean HD hand-painted style, centered, 256×256"`
- `world-site-rnode-forest-2-cutout.png` (384) — prompt: `"Isometric hand-painted game asset, fenced logging yard with palisade and saw racks, woodcutter shelters, low saturation earthy tones, light outline, solid #FF00FF background, clean HD hand-painted style, centered, 384×384"`
- `world-site-rnode-forest-3-cutout.png` (512) — prompt: `"Isometric hand-painted game asset, large lumber station with waterwheel-driven sawmill, wooden buildings, log ponds, low saturation earthy tones, light outline, solid #FF00FF background, clean HD hand-painted style, centered, 512×512"`
- `world-site-rnode-forest-4-cutout.png` (512) — prompt: `"Isometric hand-painted game asset, fortified lumber fortress with waterwheel, wooden palisades, sawmill buildings, watch towers, low saturation earthy tones, light outline, solid #FF00FF background, clean HD hand-painted style, centered, 512×512"`

**stone（石头）**
- `world-site-rnode-stone-1-cutout.png` (256) — `"…small quarry pit with scattered loose stones and a few picks, low saturation earthy tones, light outline, solid #FF00FF background, clean HD hand-painted style, centered, 256×256"`（前缀同 forest 替换 subject）
- `world-site-rnode-stone-2-cutout.png` (384) — `"…stepped quarry with terraced cuts and stone blocks stacked, wooden cranes, low saturation…384×384"`
- `world-site-rnode-stone-3-cutout.png` (512) — `"…deep shaft quarry with mine heads, scaffolding, rail carts, low saturation…512×512"`
- `world-site-rnode-stone-4-cutout.png` (512) — `"…monumental carved-pillar stone works with sculpted columns, grand crane, low saturation…512×512"`

**iron（铁矿）**
- `world-site-rnode-iron-1-cutout.png` (256) — `"…open-pit iron deposit with ore outcrop, a couple of pickaxes, low saturation…256×256"`
- `world-site-rnode-iron-2-cutout.png` (384) — `"…wooden-framed iron pit with support beams, ore carts, low saturation…384×384"`
- `world-site-rnode-iron-3-cutout.png` (512) — `"…shaft iron mine with headframe, smelting sheds, ore rails, low saturation…512×512"`
- `world-site-rnode-iron-4-cutout.png` (512) — `"…large blast-furnace iron works with chimneys, fortified walls, molten vats, low saturation…512×512"`

**farm（粮食）**
- `world-site-rnode-farm-1-cutout.png` (256) — `"…newly ploughed plots with small irrigation ditch, scarecrow, low saturation…256×256"`
- `world-site-rnode-farm-2-cutout.png` (384) — `"…terraced paddy fields with water channels, granary hut, low saturation…384×384"`
- `world-site-rnode-farm-3-cutout.png` (512) — `"…extensive farmstead with fields, barns, watch silo, windmill Pump, low saturation…512×512"`
- `world-site-rnode-farm-4-cutout.png` (512) — `"…large fortified granary complex with grain depots, walls, watchtowers, low saturation…512×512"`

### 8.3 状态徽标（S1/S2 + S3/S4，必采 7）

采纳 minimax Q7。状态枚举按 v2 状态机重新定义：

| 角色-状态类别 | 徽标文件 | 含义 |
|---|---|---|
| S1 uncontrolled | `frontend/assets/art/world-site-rnode-badge-uncontrolled-cutout.png` | 无主（玩家自己看 node owner=null） |
| S2 contested/deploying-self | `frontend/assets/art/world-site-rnode-badge-deploying-self-cutout.png` | 自己正在部署期 |
| S3 owned-self | `frontend/assets/art/world-site-rnode-badge-owned-self-cutout.png` | 己方已占领（含安全期"盾"小标叠加） |
| S4 owned-enemy | `frontend/assets/art/world-site-rnode-badge-owned-enemy-cutout.png` | 敌方已占领（掠夺目标提示，仅当前视野可见时显示） |

- 玩家看自己 deploying 时显示 **S2（部署中自我）** 而非 S3（Q7 答）。
- 徽标为小贴片 64×64，透明背景，品红底抠图，简笔阵营色边框 + 旗（己方蓝/敌方红/无主灰/部署中橙）。
- 配套 nameKey 走 §5.3 i18n，不烘焙进 cutout、不进存档。

### 8.4 overlay 能力前置验证 + fallback（采纳 kimi 3.4 / 必采 7）

**验证**：P0 第一周内由前端 owner 确认运行时地图渲染是否支持 sprite sprite overlay（在主 cutout 上叠加状态徽标）：
- 现有 same-namespace Site 已用单 PNG 渲染（`SITE_ART` 每类型一张），未发现多图层叠加管线 → **倾向不支持 overlay**。
- 若支持 overlay：4 张徽标方案可行（16 主 cutout + 4 徽标）。
- **若不支持 overlay（默认 fallback）**：每"类型×档×角色-状态"出独立变体 — P0 先生成最小覆盖：
  - P0 最小 8 张：4 类型 × tier 1（L1-3）× 状态（uncontrolled + owned-self 两态）—— 满足"首次占领最常见场景"；
  - P1 补全 16 主 × 4 态 = 64 变体（或只补 tier 2-4 的 owned-self/owned-enemy）。
- fallback 切换由配置项 `frontendArtOverlaySupported` (tuning 表新增) 读写，避免误以为默认 overlay 可用而产出"无状态区分"的占位资源。

---

## 9. 待决问题决定与理由（逐条给决定）

### 9.1 minimax Q1-Q8（必答）

**Q1 单服单玩家世界，"第三方"是谁？**
决定：单服单玩家世界（`owner==='player'` 单玩家）。**P0** "第三方"部署 0 — 资源地是 PvE 闭环（玩家打守军、占领收菜、被守军规则约束）。**P1** 开启 AI 势力夺占后"第三方"= AI 势力（`aiFactionId(slug)`，`shared/faction/factionCore.js:27`），按 §11 接口形状评估候选。理由：与"无 PVP 但有 AI 势力演进"的现有 PVPVE 蓝图一致；P0 不引入跨玩家打击，避免单玩家世界无意义判定。

**Q2 离线效率双档 vs 单档？**
决定：**在线/离线共用 1 档** `yieldPerSecond`（不变）；离线系数走资源地独立表项 `offlineEfficiencyForResourceNode=0.5 / offlineMaxHoursForResourceNode=4h`（B-3）。在线结算不受离线系数影响（在线收益不×0.5，那是离线专属）。理由：现有 `GameConfig.resources.offlineBaseEfficiency=0.8` 对城市在线时不应用，模型对称；多一档在线档无收益且增加认知。

**Q3 换防=撤军+重新行军 总时长？**
决定：v2 取消"攻打编队就地驻防"（deepseek §3.2 规避三向引用），占领方编队在部署完成后**即可自由移动**，节点防御完全交给系统驻军+安全期。因此 v2 不存在"换防"。前提"增加额外防御"= P1 把行军新编队到 tile 作为额外防御方加入节点被夺战斗（细则 P1）。理由：换防会重复锁定编队、放大 §4 玻璃堡垒漏洞；系统驻军已承担防御职能。

**Q4 敌方已占领节点可见性？**
决定：敌方已占领节点按 `enemyOwnedVisibleRule=currentVision`（当前视野才可见，与无主节点同规则）— 见 §6。理由：避免远程全图报点让玩家被连环掠夺而不自知；玩家要主动远征侦察才能找到掠夺点，与"远征收益"心智一致。

**Q5 mission 生命周期与驻防关系？**
决定：v2 mission 在 S1（战斗中）+ S2（部署期）期间**锁定在 tile**（不可移动/撤退，需求 5）；S3（owned）后 mission **立即解锁**，编队可自由移动（不再驻防抗战）。节点防御由系统驻军承担。理由：v1"编队永久锁在 S3 直到被夺/换走"正是 B-5 玻璃堡垒根源；v2 解锁后玩家投入兵力得到释放，编队没必要被correo绑在节点。

**Q6 与营地生成器的 occupiedTiles 单源？**
决定：是。`ResourceNodeSpawner` 与 `WorldCampSpawner` 共享一处 `occupiedTiles`（新增 `paramKey sharedOccupiedTilesSource=true`，§3.3.4）。两端铺设时先查该单源，避免两套独立生成器跑到同一 tile 既是营地又是资源地。理由：两个确定性生成器若独立跑会产生同 tile 冲突；共享单源是最小成本修复。

**Q7 状态徽标映射？**
决定：玩家看自己 deploying 时显示 **S2（部署中自我）** 而非 S3（"自己看自己是己方"会让部署进度信息丢失）；S3 = 己方已占领；S4 = 敌方已占领；S1 = 无主（Q7 回答见 §8.3）。

**Q8 离线 8h 期间 AI 夺走所有节点，上线崩溃感？**
决定：P0 `aiCanOccupy=false`，不存在该问题。**P1** 启用 AI 夺占后采取"节奏接管"而非"瞬间全部失控"：AI 每 tick 评估（`weightExpand×expandNode=0.25×0.4=0.1` 概率抢节点），单 AI 每 tick 最多夺占 1 个节点（新增 `aiMaxNodeClaimsPerTick=1`）；离线期 AI 的夺占在下次上线时回写不超过离线时长内累积次数。理由：避免主人来上线看到 12 个节点 1 秒全灰的崩溃感；让 AI 像对手而非扫描仪。

### 9.2 deepseek "部署期首都被攻 → 强制召回"边界（必答）

决定：**部署期编队锁定，即使首都被攻击也不强制回防**，该编队不参与城防战斗。理由：冻结需求 #5 "部署期内队伍不可移动、不可撤退"为硬约束；若部署中对首都回防会让 60s 冻结语义破裂、占领进程悬空。首都防御由其他未锁定编队或城市守军（`GarrisonPolicy`）承担。spec 显式标注"部署期编队不参与城防"为已知行为。

### 9.3 kimi 2.6 deploying tile 对第三方行军的物理语义（必答，结合必采 3）

决定：`deployTileWalkable=true` — 第三方行军可路由到 deploying tile，`getActiveEncounterAt` 不命中（`combatEncounterId=null` 且 node 不作 encounter 投影），站上去**不触发任何逻辑、不阻塞路由**，第三方发起 `attackResourceNode` 得 `DEPLOY_IN_PROGRESS` 拒绝。理由：（1）让 deploying tile 不可达会改变现有 `buildAxisAlignedRoute` 路由语义，引入新地形遮挡概念，成本高于收益；（2）让站上去触发战斗就让 60s 冻结破裂。两种中间态 选择"可达但不可开战+显式拒绝"是最小惊讶且实现最简。用语合同 kimi 同"允许站上去不触发战斗"备选。warning：第三方可能误判"已占领 tile"为无人，UI 状态需清晰区分（§5 状态徽标 S1-S4）。

### 9.4 其余待决观察项（P1 再议）

- 行军时长制动 L10 性价比（minimax M-5）：30 天模拟验收门观察，若仍激励远征过度 P1 加距离税。
- 粮节点与城市粮耗耦合（minimax m-10）：资源地粮收益与城市人口消耗是否在线解耦，验收门跑 30 天看人口饿死现象。
- 营地优先级被资源地降级（minimax m-4/A2）：资源地+营地收益权衡，靠 §5.1 UI 区分 + 验收门监控营地访问频率。

---

## 10. 测试计划（minimax §D.1-D.10 逐条保留编号，按 v2 状态机修正）

记号（v2 修正）：`S1a=idle:owner=null` / `S1b=idle:owner=player` / `S2=deploying` / `S2.x=abandoning 子态` / `S3=owned-effective（下一 tick 可攻闸）` / `S4=守军再生中`。共享前置：每条输入（now / playerState / sharedResourceNodes[idx] / attackerForce）+ 期望输出（status / systemGarrison / safeUntil / income.lastSettledAt）。

### D.1 uncontrolled → 战斗（S1a → encounter active）
- **T-1.1** 正常进入：玩家 500 兵抵达节点 → adapter 投影 encounter active、`node.combatEncounterId` 非空。
- **T-1.2** 同节点已有 encounter（玩家 B 在打）：玩家 A 抵达 → `node.combatEncounterId!=null` → `ALREADY_IN_COMBAT`（node 级互斥，必采 1）。
- **T-1.3** 节点守军再生中（S4）：玩家抵达 → adapter 仍投影（守军 0 也算 active，可打）→ 战斗推进；守军按 `regenAt` 恢复期间 `garrison.soldiers=0` 仍可被 attack；与"防白嫖"的闸是系统驻军+安全期（必采 3），不是 encounter 阻塞。
- **T-1.4** 同 T-1.3 0 守军节点：玩家一帧胜 → S2 部署；这不是漏洞而是weak-node 设计，ownd 后仍有系统驻军注入（必采 3）。

### D.2 战斗 → deploying（encounter 胜 → S2）
- **T-2.1** 玩家胜利：encounter resolved → `node.status='deploying'`、`deploy.{startedAt, completesAt=now+60s, claimant}`、`node.combatEncounterId=null`。
- **T-2.2** 玩家败北（交互路径）：`WorldCombatSessionService.js:278-281` → `returnWorldMarch` 回城。
- **T-2.2-被动** 玩家败北（被动/离线路径）：`resolveEncounterBattle`（`570-624`）**v2 补 `returnWorldMarch`**（必采 6）→ 等同 T-2.2（两路径一致测例）。
- **T-2.3** 战斗中掉线（45s engaged 兜底）：`resolveEncounterTimeouts` 被触发 → 走 T-2.2-被动。
- **T-2.4** 战斗中掉线（5min SESSION_STALE）：上层扫除 → 走 T-2.2-被动。
- **T-2.5** 战斗平局：BattleSim 无平局，按败处理（T-2.2）。
- **T-2.6** 玩家胜利但行军 0 兵：`error='EMPTY_FORMATION'`（spec 明确）。
- **T-2.7** 部署结束+下一 tick 瞬间被第三方攻击（TOCTOU）：v2 封 by `owned-effective + 1 tick` 闸 → 第三方 `attackResourceNode` 得 `NOT_YET_ATTACKABLE`，需下一 tick 放行（必采 1）。

### D.3 deploying → owned（S2 → S1b，lazy-check）
- **T-3.1** 60s 到期 lazy-check：下次该 node 被触及 → `status='idle'`、` owner=claimant`、**系统驻军士兵=守军×0.35 圆整注入**、`safeUntil=now+86400000`、`income.lastSettledAt=now`（必采 3）。
- **T-3.2** 服务端 deploy 期重启/掉线：deploy 在 `ResourceNodeRepository` 持久保留；重启后 lazy-check 在下次被触及推进（不依赖全局 timer，必采 1）。
- **T-3.3** deploy 期被第三方 `attackResourceNode`：返回 `DEPLOY_IN_PROGRESS` 拒绝（双语测例，后端中文）。
- **T-3.4** deploy 期玩家试图移动/撤退：v2 不返回错误而是弹确认 → 确认走 `moveWithAbortDeploy/retreatWithAbortDeploy` 原子分支（中止占领 + 继续动作），部队不原地 idle（必采 2）；取消保持 deployment。
- **T-3.5** deploy 期玩家登出：deploy 在持久层推进；下线 30s + 重连 lazy-check 推 owned。
- **T-3.6** deploy `completesAt` 跨越午夜/跨日 tick：lazy-check 仍按 now 判过期，不依赖日界。
- **T-3.7** client 推送"完成 deploy"意图：后端拒绝_ACCEPT（`lazyCheckDeployCompletesAt=true`，M-12）。

### D.4 deploying → uncontrolled（S2 → S1a 中断分支，原子化）
- **T-4.1** 玩家 `abortDeploy`（独立）→ `status='idle',owner=null, deploy={}`，守军残兵定格 + `regenAt`，编队留 tile 不返城（不复原子移动分支）。
- **T-4.1-复合** 玩家点移动/撤退→确认→`moveWithAbortDeploy`/`retreatWithAbortDeploy` → 原子单事务：S1a 回写 + 立刻 `startWorldMarch`/`returnWorldMarch`，部队直接开始行军不原地 idle（必采 2 测例）。
- **T-4.2** abort 与同时点 `returnWorldMarch` race：单事务保证 abort 先于 march 写，last-writer 由事务顺序定义（abort 内 march write）。
- **T-4.3** abort 后 `garrison.soldiers=0`（残兵=0）：`S1a` + `regenAt=now+respawnCooldownMs`。
- **T-4.4** abort 在 `completesAt-1s` 触发：1s 内仍可 abort，不 race-lock；若同一 tick lazy-check 先推 owned 则 abort 失败返回 `NOT_DEPLOYING`。

### D.5 owned → 被夺（S1b → encounter active）
- **T-5.1** 安全期内（`safeUntil>now`）：第三方抵达 → `SAFE_PERIOD` 拒绝。
- **T-5.2** 安全期外 + 下一 tick 后：第三方抵达 → adapter 投影 encounter active（守 `systemGarrison`）。
- **T-5.3** 第三方败：`systemGarrison` 残兵 + `regenAt` 启动；node 保留 S1b 原主；编队 `returnWorldMarch` (两路径)。
- **T-5.4** 第三方胜：进 S2 新 `deploying:claimant=第三方`；原主 owner 失效，`income.lastSettledAt` 截止失控时刻（T-6.5 回答）。
- **T-5.5** 原 attack leader 残兵已撤离 → 在 v2 由 `systemGarrison` 独立防御（必采 3）；原主是否行军增援 → P1"T-5.5+" 定。
- **T-5.6** AI（P1）发起：状态机同 T-5.1-T-5.4，但 `systemGarrison` 归属是 AI 势力的 factionId。

### D.6 owned 收益/再生
- **T-6.1** 在线 tick：`advanceAllCities` → `settleOwnedNodes` → `gain=Math.floor(yieldPerSecond×(now-lastSettledAt))`，写 `activeCityId`（必采 5）。
- **T-6.2** 离线 N（≤4）h 重登：`calculateOfflineIncomeForAllCities` → `resourceNodeIncome` 段（按 type 汇总+归入 cityName，前端能解析）。
- **T-6.3** 收益衰减：**v2 P0 删** (`yieldDecayEnabled=false`)，case 删除或标 P1。
- **T-6.4** 超 `maxOwnedPerType=6/Player=12`：`error='OWNED_FULL'` 硬拒绝（"占不下"而非衰减，必采 4）。
- **T-6.5** 节点被夺：原主 `income.lastSettledAt` 截止到失控时刻（owner 变更-bottom写入时刻），不让"被夺瞬间把未来收益入账"（采纳 minimax T-6.5/6.6）。
- **T-6.6** 原主离线 8h 期间节点被 AI 夺（P1）：原主上线时离线入账**只到失控时刻**（T-6.5）。
- **T-6.7** storage cap：v2 现 `city.resources` 无 cap。测例：满占 L10 离线 4h 不应该超过 §3.3.2 估算的 26.4 万常见量级（若超则独立离线参数失效，警验收门）。

### D.7 状态机与持久层 + 并发竞态/原子性
- **T-7.1** 重启恢复 `sharedResourceNodes` 各态抽样：S1a/S1b/S2/S2.x 各 1 例 lazy-check 不打自落（必采 1 lazy）。
- **T-7.2** 两玩家同 tick 抵达同 S1a 节点：叠加 node 级互斥（`combatEncounterId` 单引用 + player-level session 锁）后者 `ALREADY_IN_COMBAT`（必采 1 / deepseek §3.3）。
- **T-7.3** A 战斗中、B C 同时抵达同 node：A win 写 `S2` 同时 B/C 抵达 → B/C 命中 `combatEncounterId` 已 null 但 `status='deploying'` → `DEPLOY_IN_PROGRESS`。
- **T-7.4** AI P1 路径与玩家抢同 node：单战斗在局 + AI 重新评估时机（每 tick 60s 不可改）→ AI 退候选重选。
- **T-7.5** deploy→owned 与 encounter 抢攻 TOCTOU 见 T-2.7 / T-3.x。
- **T-7.6** abandon 30s 退场中 lazy-check：退场 completion 与 lazy-check 推 owned 互斥（abandoning 子态不进 owned）。

### D.8 收益结算 + 守军情报投影
- **T-8.1** 玩家未打过某节点：DTO 不携 `garrison.soldiers`（"打了才知道"），面板显示"守军情报未知"。
- **T-8.2** 玩家打过但 node 被夺：玩家 knownGarrison 擦除（新守军是系统驻军，玩家未打过）。
- **T-8.3** `Math.max(0, ...)` 与 `Math.floor` 在线+离线 一致（必采 5 / kimi 3.1）。
- **T-8.4** 切 activeCity 时收益游标 不回溯，下 tick 起新归入城市（§4.4.1）。

### D.9 边界（v2 收益表）
- **T-9.1** L1-L9 各等级 yieldPerSecond 与 §3.1 表对应；铁最稀（同等级 iron < stone < farm < forest）。
- **T-9.2** 30 天模拟验收门：满占 vs 不占玩家 30 天末资源差是否在容忍区间（§12 验收门）。
- **T-9.3** storage cap 不在 P0，P1 前置风险标。

### D.10 接缝/API
- **T-10.1** `attackResourceNode` 未注册时调 → 404/未识别 action。
- **T-10.2** mission deploy lock → 复合意图走原子分支必采 2。
- **T-10.3** `abandonNode` 在非 owned 调用 → `error='NOT_OWNED'`。
- **T-10.4** 前端走 dispatcher/runner 路径（button-scheduler spec §6），不走旧 controller `handle_*`；上游 `CanvasPanelActionRegistry` 落地闸见 §7 #17。
- **T-10.5** i18n key 缺失回退到 key 名（同样本）。
- **T-10.6** 冻结提示语"移动/撤退将会中止占领进程" 后端直发中文 + 前端 catalog 双源一致性测例。
- **T-10.7** 部署完成禁 client 推送（M-12）；client 发 "completeDeploy" → 后端拒绝（必采1）。
- **T-10.8** 资源地 territory shape 喂 `createDefenderLeader({owner:'resource_node',...})` → 产 `resource_node` profile leader；quality `seasoned/elite` fallback common 测例（必采 10）。

---

## 11. AI 接口形状（必采 11，P1 启用但现在定形状）

P0 `aiCanOccypy=false`，不接 combat/leader 评分链路；但接口形状现在定，避免 P1 发现现有 AI core 不接受资源地候选回头重创。

### 11.1 action token 注册

`shared/faction/aiFactionCore.js::ACTIONS`（即 `shared/faction/aiFactionCore.js:17-26`）新增：

```
CLAIM_RESOURCE_NODE: 'CLAIM_RESOURCE_NODE',  // 占领资源地（需先打守军进入 encounter，胜则部署）
```

并入现有 `'expand'` 权重类（与 `SETTLE_NEUTRAL`/`ATTACK_CITY` 同类）。但 `weightExpand` 内部拆子权重（必采 11）：

```
expand: num(weightExpand, 0.25) * expandMult,
   expandCity: weightExpandCity (0.6)  → 分配给 SETTLE_NEUTRAL/ATTACK_CITY
   expandNode: weightExpandNode (0.4)  → 分配给 CLAIM_RESOURCE_NODE
```

实现位置：`personalityToWeights`（`aiFactionCore.js:56`）返回增加 `expandCity/expandNode`，`pickIntent`（`aiFactionCore.js:129+`）按子权重在 SETTLE_NEUTRAL/ATTACK_CITY/CLAIM_RESOURCE_NODE 之间分桶选。

### 11.2 候选评分函数

`scoreExpansionTargets`（`aiFactionCore.js:78`）现有 shape（`territoryId, distance, ownerKind, defenderSoldiers, value, protected`）城市/营地专用。新增 `scoreResourceNodeTargets`（即 `aiCandidateShape`）：

```
// candidate shape (AiFactionService 拼快照喂入)
{
  nodeId,                 // 'rnode_{q}_{r}'
  type,                   // forest/stone/iron/farm
  level,                  // 1..10
  yieldPerSecond,         // §3.1 表
  resourceKey,            // wood/stone/iron/food（AI 偏好稀缺资源 type）
  defenderSoldiers,       // 守军实兵力（含 systemGarrison if owned）
  distanceFromFaction,    // 距 AI 势力最近城市的 Chebyshev
  ownerKind,              // 'neutral'|'player'|'ai_self'|'ai_other'
  protected,              // safeUntil>now → true（安全期跳过）
  minSoldiersToClaim: 200 // AI 门槛（动 config 表 aiMinSoldiersToClaimNode）
}
```

评分公式（拟，对齐 `scoreExpansionTargets` 用 `value/distance*threatfactor` 思路）：

```
score(node, aiFaction) =
  yieldAttractiveness(yieldPerSecond, aiFaction.scareResourceBias) *
  scarcityWeight(node.type, aiFaction.demandedResourceKeys) *
  (1 - defenderSoldiers / aiFaction.armySize) *
  distanceDecay(distanceFromFaction) *
  (ownerKind=='neutral' ? 1 : ownerKind=='player' ? 0.5 : 0)  // AI 不抢自己
```

门槛闸（必采 11 + minimax M-9）：
- `node.level >= aiMinLevelToClaim=4` 否则不进候选（防止 AI 扫光 L1-L3）；
- AI 可用兵力 ≥ `aiMinSoldiersToClaimNode=200`；
- `protected=true` 跳过（安全期内不可夺）。

### 11.3 AI 命中后执行

AI `CLAIM_RESOURCE_NODE` 触发 → AiFactionService 调 `WorldCombatSessionService.openSession`（AI 视角 player session）→ adapter 投影 → 战斗 → 胜则部署 → lazy-check → owned=`aiFactionId(slug)`。AI 占领后收益进 AI 经济（`factionTreasuryCore.js`）。AI 限速：`aiMaxNodeClaimsPerTick=1`，避免单 AI 一 tick 抢光（Q8 节奏接管）。

### 11.4 P1 时序

P0 `aiCanOccupy=false`：候选不进 `scoreResourceNodeTargets`，`expandNode` 子权重直接归 0；P1 toggle 打开后 `AiFactionService` 把 `sharedResourceNodes` 快照喂入候选，全链路接通。

---

## 12. 分阶段落地切片

### 12.1 P0 — 最小可玩（玩家侧闭环 + AI 关闭）

- 3 张配置表（`resource_node_yield`/`resource_node_garrison`/`resource_node_tuning`）进 `table-schemas` + `build-config-tables`，`ConfigTables` 读通；离线独立表项 + 双硬上限 + 无衰减。
- `ResourceNodeSpawner`（镜像 `WorldCampSpawner` + 共享 `occupiedTiles` 单源） + `ResourceNodeRepository` + `ResourceNodeEncounterAdapter`（投影映射层，node↔encounter 单引用）。
- 状态机 `S1a → encounter active → S2 → S1b(+systemGarrison+safeUntil)`，lazy-check 推进；`abortDeploy` 原子分支（中止 + 继续动作，部队不 idle）；`abandonNode` 30s 退场。
- 收益 tick `settleOwnedNodes` 走 `advanceAllCities` + 离线 `calculateOfflineIncomeForAllCities` + `readResourceNodeIncome` 段；写回 `activeCityId`；在线/离线均 float。
- 玻璃堡垒修复三件套（必采 3）：系统驻军 ×0.35 立即注入 + 安全期 24h + 撤军 30s 退场。
- 战斗路径两路径败北 `returnWorldMarch` 一致（必采 6，`resolveEncounterBattle` 补调）。
- 投影走 `WorldExplorerVision` + `isEncounterVisibleToPlayer` + "打了才知道"；i18n 双语（含冻结提示语双源）。
- 资源地信息面板（独立 panel，注册 `CanvasPanelRegistry`）；动作描述符走 `CanvasPanelActionRegistry`（**上游依赖**：button-scheduler Slice 1/2 落地，前0 前置门）；fallback 走旧 dispatcher 控制器路径。
- `DefenderLeaderService.PROFILE_BY_OWNER.resource_node` profile 新增；leaderQuality 用 common/good/great。
- 美术最小覆盖：先验证 overlay 能力；fallback 下生成 P0 8 张（4 类型 × tier1 × 2 态）。
- `aiCanOccupy=false`：AI 候选/ action token/子权重接口形状定了但 toggle 关。

### 12.2 P1 — 完整（含 PVPVE + 美术 + 教程 + 上限再议）

- AI 势力夺占：`CLAIM_RESOURCE_NODE` action token + `scoreResourceNodeTargets` 候选 + `weightExpandCity/weightExpandNode` 子权重 + AI 收益进 `factionTreasuryCore`；limiter门槛 ≥L4 / ≥200 兵 / 安全期跳过 / `aiMaxNodeClaimsPerTick=1`。
- 美术素材全补：16 张主 cutout（4 类型 × 4 档）+ 4 张状态徽标（或 fallback 64 变体）一—one-by-one，品红底抠图，对齐 §8.2 prompt。
- 占领上限再议：30 天模拟验收门输出后，若经济仍向单一终态收敛，议"衰减重开"或"动态上限"或"时间衰减"；P1 前置加 storage cap（M-2）。
- 教程步"占领第一座资源地" + `attackResourceNode`/`abortDeploy`/`abandonNode` 进 `PASS_THROUGH_ACTIONS` 白名单。
- `captureChance` 进 `resource_node_garrison` 加列（`--scaffold` 补 0），接入现有捕将流 `GarrisonCaptureResolver`。
- 性能/世界规模压测（节点数随玩家活动区增长的上界评估；保证 §3.3.4 `ringBands×targetNodes` 不超渲染上限）。
- 行军制动 L10 性价比观察（M-5 最终决定）；粮节点与城市人口解耦（m-10）；营地优先级（m-4）。

### 12.3 经济模型 30 天模拟验收门（必采 4，硬门）

P0 进 P1 的硬门 — 不达标则回炉调 §3.1 / §3.3 / §3.4，不向上推节点功能：

- 跑通：把 §3.1 收益表 v2 数值 + §3.3.2 独立离线参数 0.5/4h + §3.3.1 双硬上限（12 总 / 6 类型）灌进 `scripts/economy-balance-model.js`。
- 双场景：
  - **30 天在线**：单玩家持续在线，tick 累计 30 天。
  - **30 天离线**：玩家每 24h 上线打卡一次（每次 8h+ 离线），30 天内 30 个离线周期。
- 对照指纹（vs v1 数值 + 现有城市基线 + 不占资源地玩家）：
  1. **铁瓶颈是否仍成立**：满占玩家 30 天末铁储量是否仍是瓶颈（不为 v1 的 +34% 全局铁产）。
  2. **滚雪球**：满占 vs 不占玩家 30 天末资源量比（目标 < 2.0 倍；v1 预测 5-7 倍即 fail）；先发 vs 后发（v1 14 天先发优势千万级 fail）。
  3. **离线爆发**：单次离线 8h 进账是否被独立参数压到城市同级（目标 26-50 万常见量级；v1 150 万即 fail）。
  4. **storage cap 缺失检测**：若 30 天模型 `city.resources` 累计触发负值钳零或膨胀异常 → P1 必须前置加 cap。
- 产出 `economy-balance-model.resource-node-v2.md` 报告（owner 确认位置）作为 P0 → P1 通过凭据。

---

## 13. 引用真实路径一览（v2 修正）

- `shared/worldMarchCore.js`、`backend/services/worldCombat/WorldCombatSessionService.js`、`WorldCombatEncounterService.js`（行 19/188-202/208-221/278-281/363/570-624/685/729-783/811-827）、`backend/services/battle/BattleSimService.js`、`backend/services/territory/GarrisonPolicy.js`（行 37）、`GarrisonCaptureResolver.js`、`backend/config/WorldCampConfig.js`、`backend/services/territory/TerritoryConstants.js`（行 25-32 `SITE_ART`）、`backend/services/worldExplorer/WorldExplorerProgression.js`（行 324）、`WorldExplorerActions.js`（行 414）、`WorldExplorerVision.js`（行 118）、`backend/repositories/WorldEncounterRepository.js`、`backend/actions/GameActionRegistry.js`（行 13/21）、`backend/services/CityService.js`（行 254/298）、`backend/calculators/ResourceTickCalculator.js`、`backend/config/GameConfig.js::resources`、`backend/config/generated/garrison.json`、`backend/config/ConfigTables.js`、`config/tables/table-schemas.js`、`scripts/build-config-tables.js`、`backend/services/WorldMapService.js`（行 309）、`backend/services/DefenderLeaderService.js`（行 17/87/156-211）、`backend/services/skillGenerator/SkillGeneratorNormalizer.js`（行 17）、`SkillGeneratorConstants.js`（行 70-74）、`shared/faction/aiFactionCore.js`（行 17-26/36/56-63/75/78/129）、`shared/faction/factionCore.js`（行 27 `aiFactionId`）、`shared/faction/factionTreasuryCore.js`、`frontend/js/config/LocaleNetRegistry.js`、`frontend/js/platform/panels/CanvasPanelRegistry.js`、`frontend/js/platform/panels/FamousPersonsPanel.js`、`frontend/assets/art/world-site-*-cutout.png`、`backend/services/tutorial/TutorialActionValidator.js`（行 24）、`docs/architecture/button-scheduler-manager-panel-refactor-spec-2026-07-09.md`（643-649/1157）。
- **上游未实现依赖**（必采 9）：`frontend/js/platform/CanvasPanelActionRegistry.js`（button-scheduler spec 规划，repo 现无，§7 #17 依赖声明 + fallback）。
- **拟新增**：`backend/services/worldResource/ResourceNodeSpawner.js`、`ResourceNodeEncounterAdapter.js`、`backend/services/worldResource/ResourceNodeIncomeService.js`、`backend/repositories/ResourceNodeRepository.js`、`frontend/js/platform/panels/ResourceNodePanel.js`、`frontend/assets/art/world-site-rnode-*-cutout.png`、`frontend/assets/art/world-site-rnode-badge-*-cutout.png`，`PROFILE_BY_OWNER.resource_node` profile 加到 `DefenderLeaderService.js:17`。

---

**v2 完整稿（修订轮 2026-07-09）。冻结需求不改；不写代码，只给设计；数值全表驱动；嫁接现有系统不平行造轮子。**