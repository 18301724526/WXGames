# 自主执行手册：理顺行军身份——出发对齐回城的 id 模式

> 把"出发(startWorldMarch)"从"靠 cityId:slot 反推部队"改为"用真实 mission id 识别部队"，
> 对齐系统里回城(returnWorldMarch)已经在用的纯粹模式。
> 核心目标：操作已有部队时带真实 id，杜绝"凭空从首都新建部队再跳回"。
> 从步骤1做到步骤4，绿则自动继续，只有熔断条件才停。在 main 上做，每步 commit。

## 执行协议（先读懂）

对每个步骤：

1. 执行改动。
2. 跑验证命令（npm.cmd test / npm.cmd run lint / npm.cmd run test:architecture）。
3. **通过** → `git add -A && git commit -m "march-id-步骤N: 描述"` → 更新根目录 PROGRESS.md → **继续下一步**。
4. **失败** → 熔断，停下报告，不重试、不绕过、不继续。

**"继续"是默认。"停"只在熔断时。** 不存在"做完一步停下等确认"。

**熔断条件（满足任一立刻停，写进 PROGRESS.md，结束）：**

- 任何验证命令失败（测试红/lint红）。
- 找不到手册写的文件或代码位置。
- 改动明显超出手册范围。
- 同一步骤 2 次仍不通过。

**熔断报告格式**（写进 PROGRESS.md 并输出）：

```
熔断停止于：步骤N
原因：（测试红/找不到位置/超范围/2次失败）
具体：（哪个命令、什么报错、哪个文件）
已完成并commit：步骤1..N-1
```

**绝对禁止：**

- ❌ 切分支（在 main 上做）。❌ push/merge。❌ 停下等确认（除非熔断）。
- ❌ 动 AoiSyncSnapshot。❌ 改 worldExplorer 存档模型/做大迁移。
- ❌ 用 Date.now（用 WorldClock.getEpochNowMs）。❌ 弱化 sentinel。

**开始前**：确认 `git status` clean、在 main；`npm.cmd test` 基线绿（不绿先停下报告）。然后从步骤1开始。

---

## 背景与核心规则（理解用）

**现象**：城外已有唯一一支 idle 部队，再次点行军，前端先从首都凭空派一支乐观部队，再跳回城外部队。
**根因**：部队真实身份是 `mission.id`，但出发链路把它丢了，改用 `cityId:slot` 反推 idle mission，
认不出已有部队就乐观新建。回城(returnWorldMarch)反而是干净按 missionId 找的。
**修复**：让出发对齐回城——操作已有部队时带真实 id，所有环节用 id 识别。

**核心规则（所有步骤遵守）：**

- 有现存部队操作 → 带真实 `missionId/actorId`；`cityId:slot` 只作创建/编队属性，不参与识别已有部队。
- **传了 id 但找不到对应部队 → 不要乐观新建，应失败或等后端**（这条最关键，杜绝凭空造兵）。
- 只有"确实没有 id、是全新出发" → 才按 formation 创建新部队。

**回城的样板（出发照着改）：**

- `handle_returnWorldMarch`(CanvasTerritoryActionHandlers.js:577)：`const missionId = action.missionId || action.actorId || ''` → 传给后端。
- 乐观层 `beginReturn`(WorldMarchOptimisticState.js:438)：`getMissionList(explorer).find((item) => item.id === missionId)` 按 id 找。
- 首发临时 id 机制已存在：`optimistic_manual_${nowMs}_${seq}`（WorldMarchOptimisticState.js:394），无 id 首发用它。

验证命令：`npm.cmd test` / `npm.cmd run lint` / `npm.cmd run test:architecture`。

---

## 步骤1：前端出发请求带上选中部队的真实 id

**为什么**：出发请求现在只带 cityId/formationSlot，丢了用户选中的部队 id。

**改什么**：

1. HUD 出征 action（WorldMarchHudCanvasRenderer.js:446 附近，构造 startWorldMarch action 的地方）：
   把当前选中部队的 id（actorId/missionId）加进 action（现在只有 formationSlot/cityId）。
2. `handle_startWorldMarch`(CanvasTerritoryActionHandlers.js:548)：
   从 action 或 `uiState.selectedWorldActorId` 取真实 id，放进 options（如 `options.missionId = action.missionId || action.actorId || uiState.selectedWorldActorId || ''`）。
   照回城 handle_returnWorldMarch:577 的取法（`action.missionId || action.actorId`）。
   注意：现有逻辑出发后会清空 selectedWorldActorId，确保是在构造 options **之后**才清空，别在取 id 之前清掉。
3. 保持：没有选中部队的首次出发，options 不带 missionId（只带 cityId/formationSlot），走首发语义。

**验证**：npm.cmd test / lint / test:architecture 全绿。
sentinel：选中一支部队（selectedWorldActorId 有值）发起出发，options 里带上了该 id；无选中时不带。

**通过则**：commit `march-id-步骤1: 出发请求带选中部队id`，PROGRESS 记一行，进步骤2。

---

## 步骤2：乐观层用 id 匹配已有部队，不靠 cityId:slot

**为什么**：乐观层 beginStart 现在靠 `findIdleMissionForFormation`(cityId:slot) 决定复用/新建，认不出城外部队就新建。

**改什么**（WorldMarchOptimisticState.js）：

1. `beginStart`(:379)：优先用传入的 id 在现有 missions 里精确匹配——
   `getMissionList(explorer).find((item) => item.id === missionId)`（照 beginReturn:440 的写法）。
2. **传了 id 但找不到对应部队 → 不要乐观新建**：返回 null（失败/等后端），不要 fallback 到 capital 造兵。
   这是杜绝"凭空首都部队"的关键。
3. 匹配到已有部队 → 用它的当前 position 作为起点（resolveStartOrigin 对这种情况返回 mission 的当前位置，
   不 fallback 首都），让这支部队动起来。
4. 只有"没传 id（首发）" → 才走原来的 formation 路径 + `optimistic_manual_*` 临时 id 新建。
5. resolveStartOrigin(:291)：当是"已有部队再行军（有 id）"时，起点 = 那支部队当前 position；不反推首都。

**验证**：npm.cmd test / lint / test:architecture 全绿。
sentinel（关键）：

- 城外已有一支 idle 部队（其 formation.cityId 与 activeCityId 不同也要覆盖），带这支部队 id 再次出发
  → 乐观层复用这支部队、起点是它当前 position，**不新建首都部队**。
- 传了一个不存在的 id → 乐观层返回 null，**不乐观造兵**。
- 没传 id（首发）→ 仍按 formation 正常新建（不回归）。

**通过则**：commit `march-id-步骤2: 乐观层按id匹配不凭空造兵`，PROGRESS 记一行，进步骤3。

---

## 步骤3：后端 startWorldMarch 认 id，复用已有部队

**为什么**：后端 startWorldMarch 现在靠 `getIdleFormationMission`(cityId:slot) 决定复用/新建，
应像 returnWorldMarch 一样优先用 id。后端入口已允许 missionId 进 payload（TerritoryAction.js 传整个 payload），只是 start 没用。

**改什么**（backend/services/worldExplorer/WorldExplorerActions.js）：

1. `startWorldMarch(gameState, options, ...)`(:147)：若 `options.missionId || options.actorId` 存在，
   按 id 在 exploreMissions 里找对应 mission（照 findReturnableMission:298 的 `item.id === missionId` 写法），
   校验它属于该玩家、状态可出发，然后 rebase 它的 route（复用这支，不新建）。
2. 若没有 id → 才走原来的 `getIdleFormationMission` + 新建逻辑（首发语义，不回归）。
3. 传了 id 但找不到对应可用 mission → 返回明确错误（如 EXPLORE_MISSION_NOT_FOUND），不静默新建。
4. 不动存档模型；mission.formation 结构保留（它仍是编队属性，只是不再用于"识别已有部队"）。

**验证**：npm.cmd test / lint / test:architecture 全绿。
sentinel：

- 带已有 idle mission 的 id 调 startWorldMarch → 复用那支 mission（id 不变）、rebase route，不新建。
- 带不存在的 id → 返回错误，不新建。
- 不带 id → 按 formation 新建（首发，不回归）。

**通过则**：commit `march-id-步骤3: 后端start认id复用已有部队`，PROGRESS 记一行，进步骤4。

---

## 步骤4：对账按 id + 清理验证

**为什么**：确保乐观↔后端用 id 对账，端到端验证"城外部队再行军不再凭空造兵"。

**改什么**：

1. 乐观对账（WorldMarchOptimisticState.js:512 附近）：明确 id 操作按 id 对账；
   formation-key fallback 只保留给"无 id 首发/旧客户端 pending"，不覆盖明确 id 操作。
2. 端到端 sentinel（覆盖完整链路）：
   选中城外 idle 部队 → 出发（带 id）→ 乐观层复用该部队从当前位置起步 → 后端按 id 复用同一 mission →
   对账按 id 无缝衔接 → 全程没有"首都新建的乐观部队"出现。

**验证**：npm.cmd test / lint / test:architecture 全绿。

**通过则**：commit `march-id-步骤4: 对账按id+端到端验证`，PROGRESS 记"全部完成 + 各步commit hash"，结束。不 push。

---

## 全部完成后

PROGRESS.md 写最终汇总：4步完成、各步 commit hash、最终 npm.cmd test/lint/test:architecture 状态、未 push。
然后结束。不 push，不做额外的事。

## 验收总览

- [ ] 出发请求带选中部队真实 id（步骤1）。
- [ ] 乐观层按 id 匹配；传了不存在的 id 不乐观造兵（步骤2，关键）。
- [ ] 后端 start 认 id 复用已有部队；不带 id 才新建（步骤3）。
- [ ] 对账按 id；端到端"城外部队再行军不凭空造兵"（步骤4）。
- [ ] 首发（无 id）行为不回归。
- [ ] 不动 AOI、不动存档模型、无 Date.now。
- [ ] 全量 test/lint/architecture 全绿。
