'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  GAME_ACTIONS,
  HANDLER_LOCK_PERSISTENCE_DEBT,
  ROUTE_ORCHESTRATION_DEBT,
  SERVER_WRITE_ENTRIES,
} = require('./command-owner-step1/inventories');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_FILES = Object.freeze([
  'backend/application/commands/BuildBuildingCommandHandler.js',
  'backend/application/commands/GameActionCommandHandler.js',
  'backend/application/commands/TaskClaimCommandHandler.js',
  'backend/application/commands/HeartbeatCommandHandler.js',
  'backend/application/commands/PlayerResetCommandHandler.js',
  'backend/application/commands/WorldCombatCommandHandler.js',
  'backend/application/commands/GameCommandDefinitionFactory.js',
  'backend/application/commands/CommandCommitter.js',
  'backend/repositories/GameStateRepository.js',
  'backend/repositories/WorldEncounterRepository.js',
  'backend/services/worldCombat/WorldCombatEncounterService.js',
  'backend/routes/gameRoutes.js',
  'backend/routes/buildingRoutes.js',
  'backend/routes/playerRoutes.js',
  'backend/services/authService.js',
  'backend/server.js',
  'frontend/js/api/GameAPI.js',
  'frontend/auth.js',
  'frontend/js/platform/CanvasGameApp.js',
]);

const FULLY_MIGRATED_ENTRIES = Object.freeze([
  'server:game-action-build-handler',
  'server:game-tasks-claim',
  'server:game-heartbeat-march-settlement',
  'server:game-heartbeat-client-report',
  'server:buildings-build-legacy-route',
  'server:player-reset',
]);

const PHASE6_DEFERRED_ACTIONS = Object.freeze([]);

function readSources(overrides = {}) {
  return Object.fromEntries(CORE_FILES.map((file) => [
    file,
    overrides[file] ?? fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'),
  ]));
}

function findMatching(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractRouteCall(source, method, route) {
  const marker = `app.${method}('${route}'`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const open = source.indexOf('(', start);
  const close = findMatching(source, open, '(', ')');
  return close > open ? source.slice(start, close + 1) : '';
}

function requireTokens(violations, source, label, tokens) {
  tokens.forEach((token) => {
    if (!source.includes(token)) violations.push(`${label} is missing ${token}`);
  });
}

function inspectRouteMigration(options = {}) {
  const sources = readSources(options.sources || {});
  const violations = [];
  const gameRoutes = sources['backend/routes/gameRoutes.js'];
  const buildingRoutes = sources['backend/routes/buildingRoutes.js'];
  const playerRoutes = sources['backend/routes/playerRoutes.js'];
  const authService = sources['backend/services/authService.js'];
  const buildHandler = sources['backend/application/commands/BuildBuildingCommandHandler.js'];
  const playerResetHandler = sources['backend/application/commands/PlayerResetCommandHandler.js'];
  const worldCombatHandler = sources['backend/application/commands/WorldCombatCommandHandler.js'];
  const definitionFactory = sources['backend/application/commands/GameCommandDefinitionFactory.js'];
  const committer = sources['backend/application/commands/CommandCommitter.js'];
  const gameStateRepository = sources['backend/repositories/GameStateRepository.js'];
  const worldEncounterRepository = sources['backend/repositories/WorldEncounterRepository.js'];
  const worldCombatEncounterService = sources['backend/services/worldCombat/WorldCombatEncounterService.js'];
  const server = sources['backend/server.js'];
  const gameApi = sources['frontend/js/api/GameAPI.js'];
  const auth = sources['frontend/auth.js'];
  const canvasApp = sources['frontend/js/platform/CanvasGameApp.js'];

  const deferredMatch = gameRoutes.match(/const PHASE6_DEFERRED_ACTIONS = new Set\(\[([\s\S]*?)\]\);/);
  const deferredActions = deferredMatch
    ? Array.from(deferredMatch[1].matchAll(/'([^']+)'/g)).map((match) => match[1]).sort()
    : [];
  if (JSON.stringify(deferredActions) !== JSON.stringify(PHASE6_DEFERRED_ACTIONS)) {
    violations.push(`Phase 6 deferred actions changed: ${deferredActions.join(', ')}`);
  }
  requireTokens(violations, gameRoutes, 'game action route', [
    "mode: 'blocking'",
    'requireClientIds: true',
    'requireOwner: true',
    'commandExecutionPipeline.execute(',
    'commandDefinitionFactory.createGameActionDefinition(',
    'commandDefinitionFactory.createWorldCombatDefinition(',
  ]);
  if (/PHASE6_DEFERRED_ACTIONS|deferredToPhase6|executeDeferredGameActionRequest/.test(gameRoutes)) {
    violations.push('game action route retains a Phase 6 deferred branch');
  }

  const taskRoute = extractRouteCall(gameRoutes, 'post', '/api/game/tasks/claim');
  requireTokens(violations, taskRoute, 'task claim route', [
    "mode: 'blocking'",
    'requireClientIds: true',
    'requireOwner: true',
    'commandExecutionPipeline.execute(',
    'createTaskClaimDefinition(',
  ]);
  const heartbeatPost = extractRouteCall(gameRoutes, 'post', '/api/game/heartbeat');
  requireTokens(violations, heartbeatPost, 'heartbeat POST route', [
    "mode: 'blocking'",
    'requireClientIds: true',
    'requireOwner: true',
    'commandExecutionPipeline.execute(',
    'createHeartbeatDefinition(',
  ]);
  const heartbeatGet = extractRouteCall(gameRoutes, 'get', '/api/game/heartbeat');
  if (/commandExecutionPipeline|repository\.save|advanceRuntimeState|prepareCommandEntry/.test(heartbeatGet)) {
    violations.push('heartbeat GET is not read-only');
  }

  requireTokens(violations, buildingRoutes, 'legacy build route', [
    "mode: 'blocking'",
    'requireClientIds: true',
    'requireOwner: true',
    'commandExecutionPipeline.execute(',
    "createGameActionDefinition('build')",
  ]);
  if (/BuildingActionService|withPlayerStateLock|repository\.save/.test(buildingRoutes)) {
    violations.push('legacy build route still owns domain execution, lock, or persistence');
  }

  const resetRoute = extractRouteCall(playerRoutes, 'post', '/api/player/reset');
  requireTokens(violations, resetRoute, 'player reset route', [
    "mode: 'blocking'",
    'requireClientIds: true',
    'requireOwner: true',
    'commandExecutionPipeline.execute(',
    'createPlayerResetDefinition(',
  ]);
  if (/withPlayerStateLock|authService\.resetPlayer|repository\.(?:save|resetPlayerState)/.test(resetRoute)) {
    violations.push('player reset route still owns lock, execution, or persistence');
  }
  if (/\n\s*resetPlayer\s*\(/.test(authService)) {
    violations.push('retired AuthService.resetPlayer persistence entry still exists');
  }

  if (/repository|withPlayerStateLock|\.save\(|CommandTrace|GameActionProjection/.test(buildHandler)) {
    violations.push('BuildBuildingCommandHandler still owns repository, lock, trace, save, or projection work');
  }
  if (/createResetStateForPlayer\s*\(/.test(playerResetHandler)) {
    violations.push('PlayerResetCommandHandler invokes reset persistence before CommandCommitter');
  }
  requireTokens(violations, worldCombatHandler, 'WorldCombatCommandHandler', [
    'context.sharedMutations.encounters',
    'stageEncounter:',
  ]);
  if (/\.upsertEncounter\(|repository\.save\(|withOwnerLocks/.test(worldCombatHandler)) {
    violations.push('WorldCombatCommandHandler persists or locks outside the command pipeline');
  }
  const encounterReadOptions = worldCombatEncounterService.match(
    /function getReadOnlyEncounterOptions\(now\) \{([\s\S]*?)\n\}/,
  )?.[1] || '';
  requireTokens(violations, encounterReadOptions, 'WorldCombatEncounterService read options', [
    'refreshRespawns: false',
    'projectRespawns: true',
  ]);
  if (/refreshRespawns:\s*true/.test(encounterReadOptions)) {
    violations.push('WorldCombatEncounterService read options can persist respawns');
  }
  requireTokens(violations, worldEncounterRepository, 'WorldEncounterRepository pure reads', [
    'options.refreshRespawns === true',
    'WORLD_ENCOUNTER_WRITE_REQUIRES_COMMAND_PIPELINE',
    'options.projectRespawns === true',
    'planSeeded(options = {})',
  ]);
  if (/\n\s+refreshRespawns\(now\s*=/.test(worldEncounterRepository)
      || /\n\s+ensureSeeded\(options\s*=/.test(worldEncounterRepository)) {
    violations.push('WorldEncounterRepository exposes direct respawn or seed persistence');
  }
  if (/options\.refreshRespawns\s*!==\s*false/.test(worldEncounterRepository)) {
    violations.push('WorldEncounterRepository still refreshes respawns by default');
  }
  requireTokens(violations, gameStateRepository, 'GameStateRepository command persistence', [
    'const sharedWorldEncounters = this.planWorldEncounters();',
    'this.saveSharedWorldTerritories(savedState, options);',
    'if (scopedOwnerKeys && authorizedTerritoryIds.size === 0) return;',
  ]);
  const clientProjection = gameStateRepository.match(
    /getClientProjectionForPlayer\(playerId\) \{([\s\S]*?)\n  \}/,
  )?.[1] || '';
  if (clientProjection.includes('ensureWorldEncountersSeeded')) {
    violations.push('GameStateRepository client projection persists encounter planning');
  }
  if (/ensureWorldEncountersSeeded\s*\(/.test(gameStateRepository)) {
    violations.push('GameStateRepository startup can persist encounter planning outside the command pipeline');
  }
  if (/repository\.(?:save|resetPlayerState)\(/.test(definitionFactory)) {
    violations.push('GameCommandDefinitionFactory persists outside CommandCommitter');
  }
  requireTokens(violations, committer, 'CommandCommitter', [
    'this.repository.save(context.state, { ownerKeys })',
    'this.repository.resetPlayerState(',
    'assertSharedMutationOwners(context, sharedMutations);',
    "'playerStates'",
    "strategy === 'save-if-changed'",
    "strategy === 'reset-player-state'",
    'createState: persistence.createState',
  ]);

  requireTokens(violations, gameApi, 'GameAPI heartbeat/reset facade', [
    "this.submitCommand('heartbeat'",
    "resetPlayer(commandOptions = {})",
    "this.submitCommand('playerReset'",
  ]);
  const heartbeatMethod = gameApi.match(/async heartbeat\(options = \{\}\) \{([\s\S]*?)\n    \}/)?.[1] || '';
  if (!/this\.request\('GET', '\/game\/heartbeat'\)/.test(heartbeatMethod)
      || !/this\.submitCommand\('heartbeat'/.test(heartbeatMethod)) {
    violations.push('GameAPI heartbeat does not split read-only GET from report POST');
  }
  if (!auth.includes('this.getGameApi().resetPlayer()')) {
    violations.push('auth reset path does not use GameAPI.resetPlayer');
  }
  if (/async apiPost\(/.test(canvasApp)) {
    violations.push('CanvasGameApp retains the retired direct POST helper');
  }

  requireTokens(violations, server, 'real server Phase 5 wiring', [
    'new GameCommandDefinitionFactory({',
    'commandDefinitionFactory,',
    'createRepositoryOwnerResolver(repository)',
  ]);

  FULLY_MIGRATED_ENTRIES.forEach((inventoryId) => {
    const entry = SERVER_WRITE_ENTRIES.find((item) => item.inventoryId === inventoryId);
    if (!entry || entry.migrationPhase !== 'pipeline-migrated-phase5'
        || entry.commandPipelinePhase !== 'live'
        || entry.idempotencyStorePhase !== 'live') {
      violations.push(`${inventoryId} is not recorded as a live Phase 5 pipeline entry`);
    }
  });
  const migratedActions = GAME_ACTIONS.filter((action) => !PHASE6_DEFERRED_ACTIONS.includes(action.action));
  if (migratedActions.some((action) => action.commandPipelinePhase !== 'live')) {
    violations.push('one or more Phase 6 game actions are not recorded as live');
  }
  const deferredInventory = GAME_ACTIONS
    .filter((action) => PHASE6_DEFERRED_ACTIONS.includes(action.action))
    .map((action) => action.action)
    .sort();
  if (JSON.stringify(deferredInventory) !== JSON.stringify(PHASE6_DEFERRED_ACTIONS)) {
    violations.push(`inventory Phase 6 deferred actions changed: ${deferredInventory.join(', ')}`);
  }
  if (HANDLER_LOCK_PERSISTENCE_DEBT.some((item) => item.inventoryId === 'handler:BuildBuildingCommandHandler')) {
    violations.push('retired build handler lock/save debt is still reported');
  }
  const allowedRouteDebt = new Set([
    'server:player-login',
    'admin:config-release-publish',
    'admin:config-release-rollback',
  ]);
  const unexpectedDebt = ROUTE_ORCHESTRATION_DEBT
    .filter((item) => !allowedRouteDebt.has(item.inventoryId))
    .map((item) => item.inventoryId);
  if (unexpectedDebt.length > 0) {
    violations.push(`migrated route debt remains: ${unexpectedDebt.join(', ')}`);
  }

  return {
    deferredActions,
    migratedActionCount: migratedActions.length,
    violations,
  };
}

function main() {
  const result = inspectRouteMigration();
  console.log('[command-route-migration] blocking gate');
  console.log(`Phase 6 migrated actions: ${result.migratedActionCount}`);
  console.log(`Phase 6 deferred actions: ${result.deferredActions.join(', ')}`);
  console.log(`violations: ${result.violations.length}`);
  result.violations.forEach((violation) => console.error(`- ${violation}`));
  if (result.violations.length > 0) process.exit(1);
  console.log('passed');
}

if (require.main === module) main();

module.exports = {
  CORE_FILES,
  FULLY_MIGRATED_ENTRIES,
  PHASE6_DEFERRED_ACTIONS,
  extractRouteCall,
  inspectRouteMigration,
};
