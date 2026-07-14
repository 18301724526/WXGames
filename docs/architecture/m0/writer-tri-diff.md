# M0 Writer 三集合差异

- 运行环境：WSL Ubuntu-24.04
- 运行入口：scripts/playtest-game-smoke.js
- 原始写入事件：175
- 已映射事件：175
- 运行时 writer：5
- 未知 writer：0

## 集合规模

| 集合 | 数量 |
| --- | ---: |
| 静态发现 | 67 |
| 清单声明 | 67 |
| 运行时命中 | 5 |

## 两两双向差集

### 静态发现 - 清单声明

无。

### 清单声明 - 静态发现

无。

### 静态发现 - 运行时命中

- admin:command:configReleasePublish
- admin:command:configReleaseRollback
- admin:command:opsLoginAudit
- admin:command:opsMaintenanceSet
- admin:command:opsRestartAccepted
- admin:route:POST /api/admin/config-releases/publish
- admin:route:POST /api/admin/config-releases/rollback
- admin:route:POST /api/admin/ops/login
- admin:route:POST /api/admin/ops/maintenance
- admin:route:POST /api/admin/ops/restart
- client-state-writer:frontend/js/state/StateWriter.js#commit
- command:acceptFamousPerson
- command:advanceEra
- command:applyTalentPolicy
- command:assign
- command:assignFamousAttributePoint
- command:build
- command:claimConquest
- command:claimEvent
- command:claimTaskReward
- command:clientEventIngest
- command:clientOperationLogIngest
- command:deleteTalentPolicy
- command:dismissFamousPersonCandidate
- command:heartbeat
- command:heartbeatMarchSettlement
- command:playerReset
- command:renameCity
- command:renamePolity
- command:research
- command:resolveCapture
- command:resolveWorldCombat
- command:returnWorldMarch
- command:saveTalentPolicy
- command:seekFamousPerson
- command:setArmyFormation
- command:startConquest
- command:startWorldCombat
- command:startWorldMarch
- command:stopWorldMarch
- command:switchCity
- command:veteranCampUpgrade
- command:veteranCampWithdraw
- command:worldMarchClientReportIngest
- migration:001-game-states-compat-columns
- migration:005-task-reward-grants-column
- migration:006-rebuild-game-states-current-schema
- repair-script:backend/scripts/cleanup-world-explorer-ready-state.js
- repair-script:scripts/repair-legacy-spawn-account.js
- repair-script:scripts/repair-legacy-spawn-batch.js
- repair-script:scripts/restore-runtime-state.sh
- route:POST /api/buildings/build
- route:POST /api/client-events
- route:POST /api/client-operation-logs
- route:POST /api/game/heartbeat
- route:POST /api/game/tasks/claim
- route:POST /api/player/reset
- worker:command:worldWorkerDiplomacyTick
- worker:command:worldWorkerPersonUpdate
- worker:command:worldWorkerPlayerTick
- worker:command:worldWorkerRuntimeTick
- worker:entry:backend/world-worker.js

### 运行时命中 - 静态发现

无。

### 清单声明 - 运行时命中

- admin:command:configReleasePublish
- admin:command:configReleaseRollback
- admin:command:opsLoginAudit
- admin:command:opsMaintenanceSet
- admin:command:opsRestartAccepted
- admin:route:POST /api/admin/config-releases/publish
- admin:route:POST /api/admin/config-releases/rollback
- admin:route:POST /api/admin/ops/login
- admin:route:POST /api/admin/ops/maintenance
- admin:route:POST /api/admin/ops/restart
- client-state-writer:frontend/js/state/StateWriter.js#commit
- command:acceptFamousPerson
- command:advanceEra
- command:applyTalentPolicy
- command:assign
- command:assignFamousAttributePoint
- command:build
- command:claimConquest
- command:claimEvent
- command:claimTaskReward
- command:clientEventIngest
- command:clientOperationLogIngest
- command:deleteTalentPolicy
- command:dismissFamousPersonCandidate
- command:heartbeat
- command:heartbeatMarchSettlement
- command:playerReset
- command:renameCity
- command:renamePolity
- command:research
- command:resolveCapture
- command:resolveWorldCombat
- command:returnWorldMarch
- command:saveTalentPolicy
- command:seekFamousPerson
- command:setArmyFormation
- command:startConquest
- command:startWorldCombat
- command:startWorldMarch
- command:stopWorldMarch
- command:switchCity
- command:veteranCampUpgrade
- command:veteranCampWithdraw
- command:worldMarchClientReportIngest
- migration:001-game-states-compat-columns
- migration:005-task-reward-grants-column
- migration:006-rebuild-game-states-current-schema
- repair-script:backend/scripts/cleanup-world-explorer-ready-state.js
- repair-script:scripts/repair-legacy-spawn-account.js
- repair-script:scripts/repair-legacy-spawn-batch.js
- repair-script:scripts/restore-runtime-state.sh
- route:POST /api/buildings/build
- route:POST /api/client-events
- route:POST /api/client-operation-logs
- route:POST /api/game/heartbeat
- route:POST /api/game/tasks/claim
- route:POST /api/player/reset
- worker:command:worldWorkerDiplomacyTick
- worker:command:worldWorkerPersonUpdate
- worker:command:worldWorkerPlayerTick
- worker:command:worldWorkerRuntimeTick
- worker:entry:backend/world-worker.js

### 运行时命中 - 清单声明

无。

## 运行时命中明细

| Writer | 类别 | 命令类型 | 表 | 操作 | 证据 |
| --- | --- | --- | --- | --- | --- |
| command:playerLogin | command |  | game_states, owner_locks, player_world_visibility, players | delete, insert, update | backend/repositories/GameStateRepository.js:538, backend/repositories/GameStateRepository.js:602, backend/repositories/GameStateRepository.js:603, backend/repositories/GameStateRepository.js:614, backend/repositories/GameStateRepository.js:852, backend/repositories/OwnerLockRepository.js:123, backend/repositories/OwnerLockRepository.js:147, backend/repositories/OwnerLockRepository.js:161, backend/repositories/OwnerLockRepository.js:174, backend/repositories/OwnerLockRepository.js:191, backend/repositories/OwnerLockRepository.js:92, backend/repositories/WorldMapAuthorityRepository.js:319, backend/repositories/WorldMapAuthorityRepository.js:340, backend/routes/playerRoutes.js:74, backend/services/authService.js:193, backend/services/authService.js:211, backend/services/authService.js:223 |
| command:upgrade | command | upgrade | command_idempotency, game_states, player_world_visibility | insert, update | backend/application/commands/CommandCommitter.js:111, backend/application/commands/CommandExecutionPipeline.js:106, backend/application/commands/CommandIdempotencyStore.js:214, backend/repositories/GameStateRepository.js:538, backend/repositories/GameStateRepository.js:602, backend/repositories/GameStateRepository.js:603, backend/repositories/GameStateRepository.js:614, backend/repositories/WorldMapAuthorityRepository.js:319, backend/repositories/WorldMapAuthorityRepository.js:340 |
| route:middleware:api-log | route |  | api_logs | insert | backend/node:events:536, backend/server.js:133, backend/services/logService.js:70 |
| route:POST /api/game/action | route |  | command_idempotency, owner_locks | delete, insert, update | backend/application/commands/CommandExecutionPipeline.js:149, backend/application/commands/CommandExecutionPipeline.js:165, backend/application/commands/CommandIdempotencyStore.js:172, backend/application/commands/CommandIdempotencyStore.js:193, backend/repositories/GameStateRepository.js:852, backend/repositories/OwnerLockRepository.js:123, backend/repositories/OwnerLockRepository.js:147, backend/repositories/OwnerLockRepository.js:161, backend/repositories/OwnerLockRepository.js:191, backend/repositories/OwnerLockRepository.js:92, backend/routes/gameRoutes.js:259 |
| route:POST /api/player/login | route |  | game_states, owner_locks, player_world_visibility, players | delete, insert, update | backend/repositories/GameStateRepository.js:538, backend/repositories/GameStateRepository.js:602, backend/repositories/GameStateRepository.js:603, backend/repositories/GameStateRepository.js:614, backend/repositories/GameStateRepository.js:852, backend/repositories/OwnerLockRepository.js:123, backend/repositories/OwnerLockRepository.js:147, backend/repositories/OwnerLockRepository.js:161, backend/repositories/OwnerLockRepository.js:174, backend/repositories/OwnerLockRepository.js:191, backend/repositories/OwnerLockRepository.js:92, backend/repositories/WorldMapAuthorityRepository.js:319, backend/repositories/WorldMapAuthorityRepository.js:340, backend/routes/playerRoutes.js:74, backend/services/authService.js:193, backend/services/authService.js:211, backend/services/authService.js:223 |

## 未知运行时 writer

无。

## 解释边界

- 运行时集合只表示本次 playtest smoke 实际命中的 writer，不把未执行项伪装成命中。
- SQL 原文不落盘；探针只记录操作类型、表、命令类型与仓库内调用栈，避免把凭据或 token 写入证据。
- 静态发现与清单声明应完全相等；运行时命中必须能映射回这两个集合，或明确列出后续归属。
