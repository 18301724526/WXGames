# EXECUTION-BLOCKER-REPORT：Step3 Phase 3 共享 owner 解析缺口

状态：**OPEN，2026-07-10。** 本记录只阻止下列三个写入块宣称完成迁移；其余 Phase 3
报告模式工作可独立继续。禁止用 `player:{playerId}` 回退、测试桩或路由后置推断绕过。

## 1. `startWorldCombat` 缺少稳定 `encounterId`

- 当前 `GameAPI.startWorldCombat` 只发送 `missionId`、编队、城市和坐标，见
  `frontend/js/api/GameAPI.js:842`。
- 活跃交战视图已经持有 `engagement.encounterId`，但
  `CanvasGameApp.enterInteractiveBattle` 调用 API 时没有传递它，见
  `frontend/js/platform/CanvasGameApp.js:2491`。
- 因而在加载玩家状态和执行世界战斗查找之前，服务端没有可验证的共享目标主键。
- `CommandOwnerResolver` 如实返回
  `OWNER_TARGET_ENCOUNTER_ID_MISSING`，且 `ownerKey` 为空。

停止范围：`server:game-action-world-combat-bypass` 中的 `startWorldCombat` 不得宣称已进入
共享 owner 锁或正式命令管线。

解除条件：客户端从权威交战投影携带稳定 `encounterId`；服务端在状态加载和领域校验前
解析 `encounter:{encounterId}`，并校验该 ID 与后续命中的 encounter 一致。

## 2. `resolveWorldCombat` 的 `battleId` 不能在加载前解析 encounter

- 当前请求只有 `battleId` 与 `inputStream`，见 `frontend/js/api/GameAPI.js:856`。
- `battleId -> encounterId` 关系保存在玩家状态的
  `gameState.worldCombat.session` 内，只有加载状态后才能读取，见
  `backend/services/worldCombat/WorldCombatSessionService.js:187` 和 `:209`。
- 这与 `COP-OWNER-002` 要求的“领域执行和状态加载前确定共享 owner”冲突。
- `CommandOwnerResolver` 如实返回
  `OWNER_TARGET_BATTLE_ENCOUNTER_UNRESOLVED`，且不回退 player owner。

停止范围：`resolveWorldCombat` 不得宣称已进入 encounter owner 锁或正式命令管线。

解除条件：请求同时携带可验证的 `encounterId`，或建立无需先加载玩家状态即可读取的稳定
`battleId -> encounterId` 索引；后续仍必须校验映射与会话一致。

## 3. `worldWorkerRuntimeTick` 是混合多 owner 批处理

- 一次 tick 先修改共享社交/外交状态，再循环多个玩家写入，见
  `backend/services/realtime/WorldWorkerService.js:288` 和 `:292`。
- 该批次无法诚实映射成“一个命令、一个主 owner”；把它标成任意 player 或全局 owner
  都会掩盖真实竞争关系。
- Phase 3 已在任何写入前记录报告，返回
  `OWNER_WORKER_COMMAND_SPLIT_REQUIRED`，见
  `backend/services/realtime/WorldWorkerService.js:276`。

停止范围：`worker:world-worker-runtime-writes` 不得宣称单一 owner、幂等或管线迁移完成。

解除条件：Phase 6 将批处理拆成明确的逐 owner 命令；玩家写使用
`player:{playerId}`，共享写使用各自稳定 owner，全部通过同一
`withOwnerLocks(ownerKeys, ...)` 与命令管线。

## 已执行验证

```powershell
node --test backend/tests/CommandEnvelope.test.js backend/tests/CommandOwnerResolver.test.js backend/tests/WorldWorkerService.test.js backend/tests/ObservabilityService.test.js scripts/check-command-owner-entry-coverage.test.js
node scripts/check-command-owner-entry-coverage.js
```

结果：35/35 通过；覆盖门禁 17 个服务端写入口、14 个报告调用、0 violation。
以上是报告模式证据，不是 Phase 5/6 迁移完成声明。
