# 世界战斗 — 可交互 + 解耦架构（设计文档）

## 背景 / 问题
codex 的世界战斗把"战斗"寄生在"探索行军(explore mission)"上：
- 触发战斗 = 探索任务到达敌格（`startWorldMarch` → explore mission → `advanceExploreMissions` → `resolveEncounterBattle`）。
- "一支在战斗的队伍" = "一个到达敌格的探索任务"；战斗时序被迫用探索的 10s/步。
- 战斗结果直接写在 explore `mission` 上（`mission.formationSnapshot` / `mission.combat`）。

后果：每修一层冒下一层；**军令/技能本属于战斗输入,却要穿过行军层**；当前实现是"后端瞬间自动结算 + 前端播录像",**被动、无交互,降低体验**。

## 目标架构
两个清晰的域,只通过 **队伍状态 + 战斗 setup/result** 交互：

```
World/行军层 ──(队伍状态 + 战斗 setup)──▶ 战斗域(会话 + 纯模拟)
   ▲                                          │
   └──────────(result + 战报/replay)──────────┘
```

- **队伍(Squad)** 一等公民,状态机：`待命 / 行军中 / 撤退中 / 战斗中`（可扩展 驻守 等）。行军可因任意原因(探索/进攻/返回/增援)。战斗由「状态+位置接敌」触发,而非"探索到达"。
- **战斗域**：
  - `battleSimCore`（纯确定性模拟,已存在）。
  - `BattleSimService.resolveBattle(setup, inputStream) → {result, replay}`（纯,已存在）。
  - **战斗会话生命周期(新)**：`open(setup, seed)` →(客户端实时玩,录 inputStream)→ `resolve(inputStream)` → 权威 result。
- **军令/技能 = 战斗输入(inputStream)**,只在战斗域流动,行军层永不接触。

## 可交互 + 权威(反作弊)流程
1. 玩家进攻 encounter → 行军层把队伍置「战斗中」；战斗域 **开会话**：后端发 `seed` + 用真实属性建 `setup`,持久化 `{battleId, seed, setup, squadRef, encounterId}`,返回给客户端。**不结算**。
2. 客户端进入**可玩战斗场景**（沿用 `battle-scene-lab` 的实体渲染 + 军令按钮 + 技能图标 + 怒气 + 敌方 AI），用 `battleSimCore.createBattle(setup)` 实时推进,**逐 tick 记录** 玩家军令/技能为 `inputStream`。
3. 战斗结束(客户端) → 提交 `inputStream`。
4. 后端 **重算**：`BattleSimService.resolveBattle(setup_stored, inputStream)`（同 seed+属性）→ 权威 result → 扣兵、队伍「战斗中」→「待命/撤退中」、存战报、清会话。
5. 反作弊：seed 和属性后端定+后端重算；客户端只能提供"指令",改不了结果。

## 现状盘点
- ✅ 已是纯黑盒,直接复用：`battleSimCore`、`battleAI`、`BattleSimService`；`report.replay = {setup, inputStream}` 就是干净契约。
- ✅ `worldCombat` 已持久化（本会话加的列）；encounter 重生。
- ❌ 要抽离：`WorldCombatEncounterService.resolve*Arrival` / 触发逻辑目前嵌在 explore mission 流程里。
- ⚠️ 当前"瞬间自动结算 + 被动 replay 覆盖层"是**临时**：保留为"自动/无人值守"降级路径,交互路径就绪后作为可选。

## 分阶段实现（每步可独立部署/回滚）
1. **战斗会话后端**：新模块 `WorldCombatSessionService`：`openSession`(建 setup+seed,队伍→战斗中,持久化,不结算) + `resolveSession`(收 inputStream → 权威重算 → 应用 result + 状态 + 战报)。gameRoutes 增 `startWorldCombat` / `resolveWorldCombat` 两个 action。
2. **前端可玩战斗场景**：把 `battle-scene-lab` 的实体渲染 + 军令/技能 UI 抽成正式战斗场景组件；用 `startWorldCombat` 拿 setup → 实时玩 + 录 inputStream → `resolveWorldCombat` 提交 → 展示权威结果。替换被动 replay 覆盖层。
3. **队伍解耦**：把队伍建模为带状态的一等实体,行军/探索/进攻共用同一队伍;战斗由「状态+接敌」触发,彻底脱离 explore mission 生命周期与 10s 步长。
4. **平衡/扩展**：技能数据化(每将 2 技能:怒气大招+小技,自动/手动)、兵种、招牌动作 —— 都走 registry,不写死(core 已支持)。

## 不变量 / 原则
- 战斗域不 import 行军/地图/mission。
- 行军层不含战斗结算逻辑,只发"接敌"+收 result。
- 军令/技能只作为 inputStream 存在。
- 后端权威:seed + 属性 + 重算在后端。
