'use strict';

const CATEGORIES = Object.freeze([
  'route',
  'command',
  'worker',
  'admin',
  'migration',
  'repair_script',
  'consumer',
  'client_state_writer',
]);

const ROUTE_WRITERS = Object.freeze([
  'route:POST /api/buildings/build',
  'route:POST /api/client-events',
  'route:POST /api/client-operation-logs',
  'route:POST /api/game/action',
  'route:POST /api/game/heartbeat',
  'route:POST /api/game/tasks/claim',
  'route:POST /api/player/login',
  'route:POST /api/player/reset',
  'route:middleware:api-log',
]);

const COMMAND_TYPES = Object.freeze([
  'acceptFamousPerson',
  'advanceEra',
  'applyTalentPolicy',
  'assign',
  'assignFamousAttributePoint',
  'build',
  'claimConquest',
  'claimEvent',
  'claimTaskReward',
  'clientEventIngest',
  'clientOperationLogIngest',
  'deleteTalentPolicy',
  'dismissFamousPersonCandidate',
  'heartbeat',
  'heartbeatMarchSettlement',
  'playerLogin',
  'playerReset',
  'renameCity',
  'renamePolity',
  'research',
  'resolveCapture',
  'resolveWorldCombat',
  'returnWorldMarch',
  'saveTalentPolicy',
  'seekFamousPerson',
  'setArmyFormation',
  'startConquest',
  'startWorldCombat',
  'startWorldMarch',
  'stopWorldMarch',
  'switchCity',
  'upgrade',
  'veteranCampUpgrade',
  'veteranCampWithdraw',
  'worldMarchClientReportIngest',
]);

const WORKER_COMMAND_TYPES = Object.freeze([
  'worldWorkerDiplomacyTick',
  'worldWorkerPersonUpdate',
  'worldWorkerPlayerTick',
  'worldWorkerRuntimeTick',
]);

const ADMIN_COMMAND_TYPES = Object.freeze([
  'configReleasePublish',
  'configReleaseRollback',
  'opsLoginAudit',
  'opsMaintenanceSet',
  'opsRestartAccepted',
]);

function declare(ids) {
  return Object.freeze(ids.map((id) => Object.freeze({ id })));
}

const WRITER_DECLARATIONS = Object.freeze({
  route: declare(ROUTE_WRITERS),
  command: declare(COMMAND_TYPES.map((type) => `command:${type}`)),
  worker: declare([
    'worker:entry:backend/world-worker.js',
    ...WORKER_COMMAND_TYPES.map((type) => `worker:command:${type}`),
  ]),
  admin: declare([
    'admin:route:POST /api/admin/config-releases/publish',
    'admin:route:POST /api/admin/config-releases/rollback',
    'admin:route:POST /api/admin/ops/login',
    'admin:route:POST /api/admin/ops/maintenance',
    'admin:route:POST /api/admin/ops/restart',
    ...ADMIN_COMMAND_TYPES.map((type) => `admin:command:${type}`),
  ]),
  migration: declare([
    'migration:001-game-states-compat-columns',
    'migration:005-task-reward-grants-column',
    'migration:006-rebuild-game-states-current-schema',
    'migration:007-create-release-manifests',
    'migration:008-create-command-receipts',
  ]),
  repair_script: declare([
    'repair-script:backend/scripts/cleanup-world-explorer-ready-state.js',
    'repair-script:scripts/repair-legacy-spawn-account.js',
    'repair-script:scripts/repair-legacy-spawn-batch.js',
    'repair-script:scripts/restore-runtime-state.sh',
  ]),
  consumer: declare([]),
  client_state_writer: declare([
    'client-state-writer:frontend/js/state/StateWriter.js#commit',
  ]),
});

const EMPTY_CATEGORY_REASONS = Object.freeze({
  consumer: '当前后端没有消息队列或事件流 consumer；后台定时写入统一归入 worker。',
});

module.exports = {
  ADMIN_COMMAND_TYPES,
  CATEGORIES,
  COMMAND_TYPES,
  EMPTY_CATEGORY_REASONS,
  WORKER_COMMAND_TYPES,
  WRITER_DECLARATIONS,
};
