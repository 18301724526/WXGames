# M0 Writer Inventory

- 扫描类别：8
- 源码发现：68
- 清单声明：68
- drift finding：0

## route

| Writer | 证据 | 说明 |
| --- | --- | --- |
| route:middleware:api-log | backend/server.js:133 | 跨路由响应审计日志写入口 |
| route:POST /api/buildings/build | backend/routes/buildingRoutes.js:42 | 写路由 POST /api/buildings/build |
| route:POST /api/client-events | backend/routes/clientEventsRoutes.js:40 | 写路由 POST /api/client-events |
| route:POST /api/client-operation-logs | backend/routes/clientEventsRoutes.js:73 | 写路由 POST /api/client-operation-logs |
| route:POST /api/game/action | backend/routes/gameRoutes.js:239 | 写路由 POST /api/game/action |
| route:POST /api/game/heartbeat | backend/routes/gameRoutes.js:180 | 写路由 POST /api/game/heartbeat |
| route:POST /api/game/tasks/claim | backend/routes/gameRoutes.js:221 | 写路由 POST /api/game/tasks/claim |
| route:POST /api/player/login | backend/routes/playerRoutes.js:108 | 写路由 POST /api/player/login |
| route:POST /api/player/reset | backend/routes/playerRoutes.js:150 | 写路由 POST /api/player/reset |

## command

| Writer | 证据 | 说明 |
| --- | --- | --- |
| command:acceptFamousPerson | backend/application/commands/CommandOwnerResolver.js:6 | 业务命令 acceptFamousPerson |
| command:advanceEra | backend/application/commands/CommandOwnerResolver.js:7 | 业务命令 advanceEra |
| command:applyTalentPolicy | backend/application/commands/CommandOwnerResolver.js:8 | 业务命令 applyTalentPolicy |
| command:assign | backend/application/commands/CommandOwnerResolver.js:9 | 业务命令 assign |
| command:assignFamousAttributePoint | backend/application/commands/CommandOwnerResolver.js:10 | 业务命令 assignFamousAttributePoint |
| command:build | backend/application/commands/CommandOwnerResolver.js:11 | 业务命令 build |
| command:claimConquest | backend/application/commands/CommandOwnerResolver.js:59 | 业务命令 claimConquest |
| command:claimEvent | backend/application/commands/CommandOwnerResolver.js:12 | 业务命令 claimEvent |
| command:claimTaskReward | backend/application/commands/CommandOwnerResolver.js:13 | 业务命令 claimTaskReward |
| command:clientEventIngest | backend/application/commands/CommandOwnerResolver.js:93 | 业务命令 clientEventIngest |
| command:clientOperationLogIngest | backend/application/commands/CommandOwnerResolver.js:94 | 业务命令 clientOperationLogIngest |
| command:deleteTalentPolicy | backend/application/commands/CommandOwnerResolver.js:14 | 业务命令 deleteTalentPolicy |
| command:dismissFamousPersonCandidate | backend/application/commands/CommandOwnerResolver.js:15 | 业务命令 dismissFamousPersonCandidate |
| command:heartbeat | backend/application/commands/CommandOwnerResolver.js:16 | 业务命令 heartbeat |
| command:heartbeatMarchSettlement | backend/application/commands/CommandOwnerResolver.js:17 | 业务命令 heartbeatMarchSettlement |
| command:playerLogin | backend/application/commands/CommandOwnerResolver.js:49 | 业务命令 playerLogin |
| command:playerReset | backend/application/commands/CommandOwnerResolver.js:50 | 业务命令 playerReset |
| command:renameCity | backend/application/commands/CommandOwnerResolver.js:67 | 业务命令 renameCity |
| command:renamePolity | backend/application/commands/CommandOwnerResolver.js:18 | 业务命令 renamePolity |
| command:research | backend/application/commands/CommandOwnerResolver.js:19 | 业务命令 research |
| command:resolveCapture | backend/application/commands/CommandOwnerResolver.js:20 | 业务命令 resolveCapture |
| command:resolveWorldCombat | backend/application/commands/CommandOwnerResolver.js:86 | 业务命令 resolveWorldCombat |
| command:returnWorldMarch | backend/application/commands/CommandOwnerResolver.js:21 | 业务命令 returnWorldMarch |
| command:saveTalentPolicy | backend/application/commands/CommandOwnerResolver.js:22 | 业务命令 saveTalentPolicy |
| command:seekFamousPerson | backend/application/commands/CommandOwnerResolver.js:23 | 业务命令 seekFamousPerson |
| command:setArmyFormation | backend/application/commands/CommandOwnerResolver.js:24 | 业务命令 setArmyFormation |
| command:startConquest | backend/application/commands/CommandOwnerResolver.js:51 | 业务命令 startConquest |
| command:startWorldCombat | backend/application/commands/CommandOwnerResolver.js:79 | 业务命令 startWorldCombat |
| command:startWorldMarch | backend/application/commands/CommandOwnerResolver.js:75 | 业务命令 startWorldMarch |
| command:stopWorldMarch | backend/application/commands/CommandOwnerResolver.js:25 | 业务命令 stopWorldMarch |
| command:switchCity | backend/application/commands/CommandOwnerResolver.js:26 | 业务命令 switchCity |
| command:upgrade | backend/application/commands/CommandOwnerResolver.js:27 | 业务命令 upgrade |
| command:veteranCampUpgrade | backend/application/commands/CommandOwnerResolver.js:28 | 业务命令 veteranCampUpgrade |
| command:veteranCampWithdraw | backend/application/commands/CommandOwnerResolver.js:29 | 业务命令 veteranCampWithdraw |
| command:worldMarchClientReportIngest | backend/application/commands/CommandOwnerResolver.js:30 | 业务命令 worldMarchClientReportIngest |

## worker

| Writer | 证据 | 说明 |
| --- | --- | --- |
| worker:command:worldWorkerDiplomacyTick | backend/application/commands/CommandOwnerResolver.js:111 | 后台命令 worldWorkerDiplomacyTick |
| worker:command:worldWorkerPersonUpdate | backend/application/commands/CommandOwnerResolver.js:104 | 后台命令 worldWorkerPersonUpdate |
| worker:command:worldWorkerPlayerTick | backend/application/commands/CommandOwnerResolver.js:100 | 后台命令 worldWorkerPlayerTick |
| worker:command:worldWorkerRuntimeTick | backend/application/commands/CommandOwnerResolver.js:117 | 后台命令 worldWorkerRuntimeTick |
| worker:entry:backend/world-worker.js | backend/world-worker.js:1 | 后台 world worker 入口 |

## admin

| Writer | 证据 | 说明 |
| --- | --- | --- |
| admin:command:configReleasePublish | backend/application/commands/CommandOwnerResolver.js:98 | 管理命令 configReleasePublish |
| admin:command:configReleaseRollback | backend/application/commands/CommandOwnerResolver.js:99 | 管理命令 configReleaseRollback |
| admin:command:opsLoginAudit | backend/application/commands/CommandOwnerResolver.js:95 | 管理命令 opsLoginAudit |
| admin:command:opsMaintenanceSet | backend/application/commands/CommandOwnerResolver.js:96 | 管理命令 opsMaintenanceSet |
| admin:command:opsRestartAccepted | backend/application/commands/CommandOwnerResolver.js:97 | 管理命令 opsRestartAccepted |
| admin:route:POST /api/admin/config-releases/publish | backend/routes/adminRoutes.js:83 | 管理写路由 POST /api/admin/config-releases/publish |
| admin:route:POST /api/admin/config-releases/rollback | backend/routes/adminRoutes.js:94 | 管理写路由 POST /api/admin/config-releases/rollback |
| admin:route:POST /api/admin/ops/login | backend/routes/opsRoutes.js:26 | 管理写路由 POST /api/admin/ops/login |
| admin:route:POST /api/admin/ops/maintenance | backend/routes/opsRoutes.js:73 | 管理写路由 POST /api/admin/ops/maintenance |
| admin:route:POST /api/admin/ops/restart | backend/routes/opsRoutes.js:86 | 管理写路由 POST /api/admin/ops/restart |

## migration

| Writer | 证据 | 说明 |
| --- | --- | --- |
| migration:001-game-states-compat-columns | backend/migrations/immutableGameStateMigrations.js:35 | SchemaMigrationService 迁移 001-game-states-compat-columns |
| migration:005-task-reward-grants-column | backend/migrations/immutableGameStateMigrations.js:49 | SchemaMigrationService 迁移 005-task-reward-grants-column |
| migration:006-rebuild-game-states-current-schema | backend/migrations/currentGameStateSchemaMigration.js:59 | SchemaMigrationService 迁移 006-rebuild-game-states-current-schema |
| migration:007-create-release-manifests | backend/migrations/releaseManifestMigration.js:6 | SchemaMigrationService 迁移 007-create-release-manifests |

## repair_script

| Writer | 证据 | 说明 |
| --- | --- | --- |
| repair-script:backend/scripts/cleanup-world-explorer-ready-state.js | backend/scripts/cleanup-world-explorer-ready-state.js:162 | 修复或恢复脚本 backend/scripts/cleanup-world-explorer-ready-state.js |
| repair-script:scripts/repair-legacy-spawn-account.js | scripts/repair-legacy-spawn-account.js:221 | 修复或恢复脚本 scripts/repair-legacy-spawn-account.js |
| repair-script:scripts/repair-legacy-spawn-batch.js | scripts/repair-legacy-spawn-batch.js:128 | 修复或恢复脚本 scripts/repair-legacy-spawn-batch.js |
| repair-script:scripts/restore-runtime-state.sh | scripts/restore-runtime-state.sh:161 | 修复或恢复脚本 scripts/restore-runtime-state.sh |

## consumer

该类为空。原因：当前后端没有消息队列或事件流 consumer；后台定时写入统一归入 worker。

## client_state_writer

| Writer | 证据 | 说明 |
| --- | --- | --- |
| client-state-writer:frontend/js/state/StateWriter.js#commit | frontend/js/state/StateWriter.js:49 | 客户端实时状态唯一写点 StateWriter.commit |

## Drift Findings

无。
