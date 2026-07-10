'use strict';

const Database = require('better-sqlite3');

const { buildCommandPayload } = require('../../application/commands/CommandEnvelope');
const { GameCommandDefinitionFactory } = require('../../application/commands/GameCommandDefinitionFactory');
const { CommandExecutionPipeline } = require('../../application/commands/CommandExecutionPipeline');
const { CommandIdempotencyStore } = require('../../application/commands/CommandIdempotencyStore');
const GameStateRepository = require('../../repositories/GameStateRepository');

let commandSequence = 0;

function createLockContext(ownerKeys, scope) {
  return Object.freeze({
    schema: 'owner-lock-context-v1',
    ownerKeys: [...ownerKeys],
    scope,
    holderIds: ownerKeys.map((ownerKey) => `test:${ownerKey}`),
    waitMs: 0,
  });
}

function createPipelineRepository(repository) {
  return {
    withOwnerLocks(ownerKeys, scope, callback, options = {}) {
      if (typeof repository.withOwnerLocks === 'function') {
        return repository.withOwnerLocks(ownerKeys, scope, callback, options);
      }
      const context = createLockContext(ownerKeys, scope);
      const playerKey = ownerKeys.length === 1 && ownerKeys[0].startsWith('player:')
        ? ownerKeys[0]
        : '';
      if (playerKey && typeof repository.withPlayerStateLock === 'function') {
        return repository.withPlayerStateLock(
          playerKey.slice('player:'.length),
          () => callback(context),
          { ...options, scope },
        );
      }
      return callback(context);
    },
    findByPlayerId(...args) {
      return repository.findByPlayerId?.(...args);
    },
    save(...args) {
      return repository.save(...args);
    },
    resetPlayerState(...args) {
      if (typeof repository.resetPlayerState === 'function') {
        return repository.resetPlayerState(...args);
      }
      return repository.save(args[1]);
    },
  };
}

function createCommandPipelineTestDependencies(repository, gameStateService, options = {}) {
  const db = new Database(':memory:');
  const schemaRepository = new GameStateRepository(db);
  schemaRepository.init();
  const pipelineRepository = createPipelineRepository(repository);
  const idempotencyStore = new CommandIdempotencyStore(db);
  const commandExecutionPipeline = new CommandExecutionPipeline({
    repository: pipelineRepository,
    idempotencyStore,
  });
  const commandDefinitionFactory = new GameCommandDefinitionFactory({
    repository,
    gameStateService,
    now: options.now,
  });
  return {
    commandExecutionPipeline,
    commandDefinitionFactory,
    close() {
      db.close();
    },
  };
}

function commandTypeForRoute(route, req = {}) {
  if (route.path === '/api/game/action') return req.body?.action || '';
  if (route.path === '/api/game/tasks/claim') return 'claimTaskReward';
  if (route.path === '/api/game/heartbeat') return 'heartbeat';
  if (route.path === '/api/player/reset') return 'playerReset';
  if (route.path === '/api/buildings/build') return 'build';
  return '';
}

function attachClientCommand(route, req = {}, options = {}) {
  const type = options.type || commandTypeForRoute(route, req);
  if (!type) return req;
  commandSequence += 1;
  const commandId = options.commandId || `cmd-route-test-${commandSequence}`;
  const idempotencyKey = options.idempotencyKey || `idem-route-test-${commandSequence}`;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const payload = buildCommandPayload(type, body);
  req.body = {
    ...body,
    commandId,
    idempotencyKey,
    clientCommand: {
      schema: 'game-command-v1',
      type,
      commandId,
      idempotencyKey,
      payload,
    },
  };
  req.method = req.method || route.method;
  req.path = req.path || route.path;
  req.originalUrl = req.originalUrl || route.path;
  req.headers = req.headers || {};
  req.headers['x-client-request-id'] = req.headers['x-client-request-id']
    || `api-route-test-${commandSequence}`;
  if (typeof req.get !== 'function') {
    req.get = function get(name) {
      return this.headers[String(name).toLowerCase()] || '';
    };
  }
  return req;
}

module.exports = {
  attachClientCommand,
  createCommandPipelineTestDependencies,
};
