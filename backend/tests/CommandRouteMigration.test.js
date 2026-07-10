'use strict';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const Database = require('better-sqlite3');

const { buildCommandPayload } = require('../application/commands/CommandEnvelope');
const { GameCommandDefinitionFactory } = require('../application/commands/GameCommandDefinitionFactory');
const { CommandExecutionPipeline } = require('../application/commands/CommandExecutionPipeline');
const { CommandIdempotencyStore } = require('../application/commands/CommandIdempotencyStore');
const GameStateRepository = require('../repositories/GameStateRepository');
const registerBuildingRoutes = require('../routes/buildingRoutes');
const registerGameRoutes = require('../routes/gameRoutes');
const registerPlayerRoutes = require('../routes/playerRoutes');
const GameStateService = require('../services/GameStateService');
const TutorialService = require('../services/TutorialService');
const {
  publishCurrentConfigRuntime,
  resetConfigRuntime,
} = require('./helpers/configRuntimeTestHarness');

before(() => publishCurrentConfigRuntime());
after(() => resetConfigRuntime());

function createAppHarness() {
  const routes = [];
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers });
    },
  };
  return { app, routes };
}

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function invokeRoute(route, req) {
  const res = createResponse();
  let index = 0;
  const next = () => {
    index += 1;
    return route.handlers[index]?.(req, res, next);
  };
  route.handlers[0](req, res, next);
  return res;
}

function commandRequest(route, playerId, type, body, id = 'route-migration-1') {
  const payload = buildCommandPayload(type, body);
  const commandId = `cmd-${id}`;
  const idempotencyKey = `idem-${id}`;
  const headers = { 'x-client-request-id': `api-${id}` };
  return {
    playerId,
    method: route.method,
    path: route.path,
    originalUrl: route.path,
    headers,
    get(name) {
      return headers[String(name).toLowerCase()] || '';
    },
    body: {
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
    },
  };
}

function createRuntime() {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  const idempotencyStore = new CommandIdempotencyStore(db);
  const commandExecutionPipeline = new CommandExecutionPipeline({
    repository,
    idempotencyStore,
  });
  const commandDefinitionFactory = new GameCommandDefinitionFactory({
    repository,
    gameStateService: GameStateService,
  });
  return {
    db,
    repository,
    commandExecutionPipeline,
    commandDefinitionFactory,
  };
}

function createBuildReadyState(playerId) {
  const state = GameStateService.createInitialGameState(playerId);
  state.tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.cityEntered,
  );
  return state;
}

test('Phase 5 build route replays a 100-request duplicate storm after one mutation', () => {
  const runtime = createRuntime();
  try {
    const playerId = 'phase5-build-storm';
    runtime.repository.save(createBuildReadyState(playerId));
    const { app, routes } = createAppHarness();
    registerGameRoutes(app, {
      authMiddleware: (req, res, next) => next(),
      repository: runtime.repository,
      gameStateService: GameStateService,
      presenceService: null,
      commandExecutionPipeline: runtime.commandExecutionPipeline,
      commandDefinitionFactory: runtime.commandDefinitionFactory,
    });
    const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
    const responses = [];
    for (let index = 0; index < 100; index += 1) {
      responses.push(invokeRoute(route, commandRequest(
        route,
        playerId,
        'build',
        { action: 'build', target: 'house' },
        'build-storm',
      )));
    }

    assert.equal(responses[0].statusCode, 200);
    responses.forEach((response) => assert.deepEqual(response.payload, responses[0].payload));
    const saved = runtime.repository.findByPlayerId(playerId);
    assert.equal(saved.cities.capital.buildings.house.level, 1);
    assert.equal(saved.revision, 2);
    assert.equal(
      runtime.db.prepare('SELECT COUNT(*) AS count FROM command_idempotency').get().count,
      1,
    );
  } finally {
    runtime.db.close();
  }
});

test('Phase 5 migrated routes reject missing client command ids before mutation', () => {
  const runtime = createRuntime();
  try {
    const playerId = 'phase5-envelope-required';
    runtime.repository.save(createBuildReadyState(playerId));
    const { app, routes } = createAppHarness();
    registerGameRoutes(app, {
      authMiddleware: (req, res, next) => next(),
      repository: runtime.repository,
      gameStateService: GameStateService,
      presenceService: null,
      commandExecutionPipeline: runtime.commandExecutionPipeline,
      commandDefinitionFactory: runtime.commandDefinitionFactory,
    });
    const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
    const response = invokeRoute(route, {
      playerId,
      method: 'POST',
      path: route.path,
      body: { action: 'build', target: 'house' },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.error, 'COMMAND_ENVELOPE_REQUIRED');
    assert.equal(runtime.repository.findByPlayerId(playerId).revision, 1);
  } finally {
    runtime.db.close();
  }
});

test('heartbeat GET is read-only while POST report ingestion is idempotent', () => {
  const runtime = createRuntime();
  try {
    const playerId = 'phase5-heartbeat';
    const state = GameStateService.createInitialGameState(playerId);
    runtime.repository.save(state);
    const { app, routes } = createAppHarness();
    registerGameRoutes(app, {
      authMiddleware: (req, res, next) => next(),
      repository: runtime.repository,
      gameStateService: GameStateService,
      presenceService: { recordHeartbeat() {} },
      commandExecutionPipeline: runtime.commandExecutionPipeline,
      commandDefinitionFactory: runtime.commandDefinitionFactory,
    });
    const getRoute = routes.find((item) => item.method === 'GET' && item.path === '/api/game/heartbeat');
    const postRoute = routes.find((item) => item.method === 'POST' && item.path === '/api/game/heartbeat');
    const beforeRevision = runtime.repository.findByPlayerId(playerId).revision;
    const readResponse = invokeRoute(getRoute, {
      playerId,
      method: 'GET',
      path: getRoute.path,
      body: {},
      get() { return ''; },
    });
    assert.equal(readResponse.statusCode, 200);
    assert.equal(runtime.repository.findByPlayerId(playerId).revision, beforeRevision);
    assert.equal(runtime.db.prepare('SELECT COUNT(*) AS count FROM command_idempotency').get().count, 0);

    const body = {
      worldMarchClientReport: {
        schema: 'world-march-client-report-batch-v1',
        missions: [{ missionId: 'march-1', position: { q: 1.25, r: 0 } }],
      },
    };
    const first = invokeRoute(postRoute, commandRequest(
      postRoute,
      playerId,
      'heartbeat',
      body,
      'heartbeat-report',
    ));
    const replay = invokeRoute(postRoute, commandRequest(
      postRoute,
      playerId,
      'heartbeat',
      body,
      'heartbeat-report',
    ));
    assert.equal(first.statusCode, 200);
    assert.deepEqual(replay.payload, first.payload);
    assert.equal(runtime.repository.findByPlayerId(playerId).revision, beforeRevision + 1);
  } finally {
    runtime.db.close();
  }
});

test('legacy build route delegates to the same pipeline contract', () => {
  const runtime = createRuntime();
  try {
    const playerId = 'phase5-legacy-build';
    runtime.repository.save(createBuildReadyState(playerId));
    const { app, routes } = createAppHarness();
    registerBuildingRoutes(app, {
      authMiddleware: (req, res, next) => next(),
      repository: runtime.repository,
      gameStateService: GameStateService,
      commandExecutionPipeline: runtime.commandExecutionPipeline,
      commandDefinitionFactory: runtime.commandDefinitionFactory,
    });
    const route = routes.find((item) => item.method === 'POST' && item.path === '/api/buildings/build');
    const response = invokeRoute(route, commandRequest(
      route,
      playerId,
      'build',
      { buildingType: 'house' },
      'legacy-build',
    ));
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.command.ownerKey, `player:${playerId}`);
    assert.equal(response.payload.command.idempotencyStatus, 'committed');
    assert.equal(runtime.repository.findByPlayerId(playerId).cities.capital.buildings.house.level, 1);
  } finally {
    runtime.db.close();
  }
});

test('player reset uses CommandCommitter once and replays duplicate requests', () => {
  const runtime = createRuntime();
  try {
    const playerId = 'phase5-reset';
    runtime.repository.save(GameStateService.createInitialGameState(playerId));
    let resetStateCreations = 0;
    const { app, routes } = createAppHarness();
    registerPlayerRoutes(app, {
      authMiddleware: (req, res, next) => next(),
      authService: {},
      repository: runtime.repository,
      gameStateService: GameStateService,
      logService: { getPlayerLogs: () => [] },
      spawnLifecycleService: {
        resetInitialStateForPlayer(id) {
          resetStateCreations += 1;
          return GameStateService.createInitialGameState(id);
        },
      },
      commandExecutionPipeline: runtime.commandExecutionPipeline,
      commandDefinitionFactory: runtime.commandDefinitionFactory,
    });
    const route = routes.find((item) => item.method === 'POST' && item.path === '/api/player/reset');
    const first = invokeRoute(route, commandRequest(
      route,
      playerId,
      'playerReset',
      {},
      'player-reset',
    ));
    const replay = invokeRoute(route, commandRequest(
      route,
      playerId,
      'playerReset',
      {},
      'player-reset',
    ));
    assert.equal(first.statusCode, 200);
    assert.deepEqual(replay.payload, first.payload);
    assert.equal(resetStateCreations, 1);
    assert.equal(runtime.repository.findByPlayerId(playerId).revision, 1);
  } finally {
    runtime.db.close();
  }
});
