# 自动接战 + 撤退窗口设计（2026-07-05）

## 教训（先写下来）
用户要"自动接战 → 撤退窗口 → 撤退远离野怪"。我第一反应是**凭空设计一套撤退机制并追问参数**——错了。用户点破："你没看过我战斗内容吗？" 深读 `shared/battleSimCore.js` 后确认：**撤退机制早已完整存在**，"撤退窗口"就是交互式战斗本身。此设计把功能落到既有战斗上，不新造。

## 既有战斗逻辑（证据）
`shared/battleSimCore.js` 是**实时逐 tick 可指挥的 RTS 战斗**：
- 小队指令：`advance/soldierAttack/defend/retreat`（5s 冷却）。
- **主帅令（一次性，之后交自动）：`allOut`（全军出击）/ `allRetreat`（全军撤退）**。
- 战法/怒气/技能（三国式）；主将阵亡 `routChance=0.5` 溃逃。
- 撤退=单位往自家边缘逃，越界 `left=true`（离场）。战斗在只剩 ≤1 方"在场"时结束（winner=场上有兵的一方）。
- **伤亡账**：`survivorsByGid` = 存活且未离场。**逃离的兵不计入 survivors → 算作损失**（撤退散失逃兵，是既定设计）。
- 前端 `EntityBattleController`：interactive 模式下 AI 控敌方(side1)、玩家控 side0，`master('allRetreat')` = 玩家下全军撤退令；`BattleCanvasRenderer.drawEntityBattleControls` **已有「全军撤退」按钮**（locale `battle.entity.master.allRetreat`）。
- 结算：录制的 inputStream 交 `resolveWorldCombat` 后端权威重算。

**结论**：交互式战斗 = 自动接战后的"撤退窗口"。缺的只有两个连接点。

## 我之前的过度修正（要部分前进修复）
上一提交 `e3ba83e7`：为修"隔空进攻"，我把前端 `enterInteractiveBattle` 整个删了 → 攻击变成"行军+到达allOut自动结算"，**顺手把交互式战斗和撤退也删了**。位置门（openSession 要求在敌军格）是对的，保留；但交互式战斗要恢复，只是改成"到达才开"。

## 本切片：两个连接点
### 连接点 1：自动接战（到达打开交互式战斗，而非 allOut 秒结算）
- **后端**：行军到达敌军格时（`resolveMissionArrival` 及 `resolveImmediateArrival`），不再立即 `resolveEncounterBattle`，而是置 `mission.combat.status='engaged'` + `engagedAt`，**不结算**。
- **前端**：检测到"自己的部队 engaged 在敌军格且无战斗场景打开" → 自动 `startWorldCombat`（openSession 因部队在格上过位置门）→ 打开交互式战斗。
- **离线兜底**：玩家没在看（不开战斗场景）时，`engaged` 会永远挂着。在已有的心跳结算钩子（`settleDueMarchesOnHeartbeat`）+ worker 里加：`engaged` 超过 `AUTO_ENGAGE_FALLBACK_MS`（如 45s）且**无该 encounter 的 open session** → 用 allOut `resolveEncounterBattle` 兜底结算。防止部队卡死。
### 连接点 2：撤退后自动远离野怪
- `resolveSession` 结算后：若**非胜利**（玩家撤退/败退但有幸存兵）→ 触发部队**返程行军**（复用 `returnWorldMarch`，走回出发城），达成"远离野怪"。胜利则营地清空+战利品+重生（既有）。

## 单源/可回退
- `engaged` 状态是新增字段，旧存档缺省无该状态；删掉"arrival 置 engaged"改回直接 `resolveEncounterBattle` 即回退到 allOut 自动结算。
- 兜底 timeout 是一个常量；关掉（设 0/删块）则依赖前端开战斗，engaged 无兜底（仅开发期风险）。
- 撤退返程复用现有 returnWorldMarch，删该 hook 则撤退后部队原地 idle。
- 位置门（`WORLD_COMBAT_NOT_IN_RANGE`）保留——无论如何不能隔空开战。

## 验收
门禁全绿；WSL：派兵打营地→到达**自动弹出交互式战斗**→点「全军撤退」→部队**自动返程离开**、营地仍在；不撤打赢→战利品+营地清空+重生；离线兜底（不开战斗场景，等 45s）→ allOut 自动结算。不再出现隔空开战。
