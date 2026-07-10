const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const registerGameRoutesImpl = require('../routes/gameRoutes');
const registerPlayerRoutesImpl = require('../routes/playerRoutes');
const GameStateService = require('../services/GameStateService');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const TerritoryService = require('../services/TerritoryService');
const WorldAiExplorerService = require('../services/WorldAiExplorerService');
const WorldMapService = require('../services/WorldMapService');
const ClientGameStateAssembler = require('../services/ClientGameStateAssembler');
const {
  publishCurrentConfigRuntime,
  resetConfigRuntime,
} = require('./helpers/configRuntimeTestHarness');
const {
  attachClientCommand,
  createCommandPipelineTestDependencies,
} = require('./helpers/commandPipelineTestHarness');

const pipelineHarnesses = [];

before(() => {
  publishCurrentConfigRuntime();
});

after(() => {
  pipelineHarnesses.splice(0).forEach((harness) => harness.close());
  resetConfigRuntime();
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAppHarness() {
  const routes = [];
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
    post(path, ...handlers) {
      const route = { method: 'POST', path, handlers };
      const firstHandler = handlers[0];
      route.handlers[0] = (req, res, next) => {
        attachClientCommand(route, req);
        return firstHandler(req, res, next);
      };
      routes.push(route);
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

function pipelineDeps(deps) {
  const pipeline = createCommandPipelineTestDependencies(
    deps.repository,
    deps.gameStateService,
  );
  pipelineHarnesses.push(pipeline);
  return { ...deps, ...pipeline };
}

function registerGameRoutes(app, deps) {
  return registerGameRoutesImpl(app, pipelineDeps(deps));
}

function registerPlayerRoutes(app, deps) {
  return registerPlayerRoutesImpl(app, pipelineDeps(deps));
}

function invokeRoute(route, req, res = createResponse()) {
  let index = 0;
  const next = () => {
    index += 1;
    if (route.handlers[index]) return route.handlers[index](req, res, next);
    return undefined;
  };
  route.handlers[0](req, res, next);
  return res;
}

function createNormalizedRouteState(playerId = 'projection-route-test') {
  return {
    playerId,
    tutorial: { completed: true, currentStep: 99 },
    currentEra: 0,
    activeCityId: 'capital',
    resources: { food: 100, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    buildingEffects: {},
    population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
    military: { soldiers: 0, soldierCap: 0 },
    techs: {},
    techEffects: {},
    happiness: 100,
    gameDay: 1,
    eraHistory: [],
    eventQueue: [],
    eventHistory: [],
    regularEventState: {},
    threatEventState: {},
    activeBuffs: [],
    taskProgress: { claimed: {} },
    territories: [{ id: 'capital', x: 0, y: 0, type: 'capital', owner: 'player', status: 'occupied' }],
    worldMap: { version: 1, seed: 'projection-test', tiles: [] },
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        name: 'Capital',
        resources: { food: 100, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        buildings: {},
        population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
        military: { soldiers: 0, soldierCap: 0 },
        buildingEffects: {},
      },
    },
    scoutedCoordinates: [],
    scoutState: {},
    exploreMissions: [],
    worldAi: { explorers: [], playerSyncedCanonicalIds: [] },
    warMissions: [],
    scoutReports: [],
    updatedAt: '2026-06-10T00:00:00.000Z',
  };
}

test('client projection and era progress expose normalized-state-only APIs that do not advance world simulation', () => {
  assert.equal(typeof GameStateService.getClientGameStateFromNormalized, 'function');
  assert.equal(typeof GameStateService.calculateEraProgressFromNormalized, 'function');

  const rawState = GameStateNormalizer.createInitialGameState('projection-boundary-test');
  rawState.updatedAt = '2026-06-10T00:00:00.000Z';
  const normalized = GameStateService.normalizeState(clone(rawState));

  const originalAdvance = WorldAiExplorerService.advanceAiExploration;
  let advanceCalls = 0;
  WorldAiExplorerService.advanceAiExploration = (...args) => {
    advanceCalls += 1;
    return originalAdvance(...args);
  };
  try {
    const clientState = GameStateService.getClientGameStateFromNormalized(normalized);
    const eraProgress = GameStateService.calculateEraProgressFromNormalized(normalized);

    assert.equal(clientState.playerId, normalized.playerId);
    assert.equal(clientState.activeCityId, normalized.activeCityId);
    assert.equal(Array.isArray(eraProgress.conditions), true);
    assert.equal(advanceCalls, 0);
  } finally {
    WorldAiExplorerService.advanceAiExploration = originalAdvance;
  }
});

test('client projection is a read-only DTO boundary for explorer and territory runtime state', () => {
  const now = new Date('2026-06-10T00:00:05.000Z');
  const normalized = GameStateService.normalizeState(GameStateNormalizer.createInitialGameState('projection-readonly-test'));
  normalized.worldMap = WorldMapService.createInitialWorldMap('projection-readonly-test', now);
  normalized.military = { soldiers: 20, soldierCap: 20 };
  normalized.cities.capital.military = { soldiers: 20, soldierCap: 20 };
  normalized.exploreMissions = [{
    id: 'world-mission-readonly',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    target: { q: 1, r: 0, tileId: 'tile_1_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [{ q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: false }],
    plannedTiles: [],
    plannedSites: [],
    formation: { cityId: 'capital', slot: 1 },
    revealedTileIds: [],
    stepDurationMs: 1000,
    // The DTO serves a TIME-DERIVED mission view; keep this fixture mid-march (future
    // completesAt) or the projection correctly reports it finished.
    startedAt: new Date(Date.now() - 200).toISOString(),
    nextStepAt: new Date(Date.now() + 60 * 1000).toISOString(),
    completesAt: new Date(Date.now() + 60 * 1000).toISOString(),
  }];
  normalized.territories = [
    ...normalized.territories,
    { id: 'site_2_0', x: 2, y: 0, type: 'town', owner: 'neutral', status: 'discovered', naturalName: 'Frontier Town' },
  ];
  normalized.warMissions = [{
    id: 'territory-mission-readonly',
    kind: 'conquest',
    status: 'active',
    territoryId: 'site_2_0',
    sourceCityId: 'capital',
    soldiersCommitted: 100,
    soldierAllocations: [{ cityId: 'capital', soldiers: 100 }],
    startedAt: '2026-06-10T00:00:00.000Z',
    completesAt: new Date(Date.now() + 60 * 1000).toISOString(),
  }];
  const before = clone(normalized);

  const clientState = GameStateService.getClientGameStateFromNormalized(normalized);

  assert.equal(clientState.worldExplorerState.activeMission.id, 'world-mission-readonly');
  assert.equal(clientState.worldExplorerState.activeMission.route[0].revealed, false);
  assert.equal(clientState.territoryState.warMissions[0].kind, 'conquest');
  assert.deepEqual(normalized, before);
});

test('client projection receives shared world visibility through explicit projection context', () => {
  const normalized = GameStateService.normalizeState(GameStateNormalizer.createInitialGameState('projection-context-test'));
  const sharedSite = {
    id: 'site_projection_context_1',
    x: 6,
    y: 0,
    naturalName: 'Projection Context',
    type: 'town',
    owner: 'player',
    ownerPlayerId: 'other-player',
    status: 'occupied',
  };

  const clientState = GameStateService.getClientGameStateFromNormalized(normalized, {
    sharedWorldTerritories: [sharedSite],
  });

  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'sharedWorldTerritories'), false);
  assert.equal(clientState.territoryState.territories.some((site) => site.id === sharedSite.id), true);
  assert.equal(clientState.territoryState.occupiedCount, 1);
  assert.equal(clientState.territoryState.namingPrompt, null);
});

test('client projection does not read shared world visibility from canonical state shape', () => {
  const normalized = GameStateService.normalizeState(GameStateNormalizer.createInitialGameState('projection-context-only-test'));
  const sharedSite = {
    id: 'site_projection_leak_1',
    x: 7,
    y: 0,
    type: 'town',
    owner: 'player',
    ownerPlayerId: 'other-player',
    status: 'occupied',
  };
  normalized.sharedWorldTerritories = [sharedSite];

  const clientState = ClientGameStateAssembler.getClientGameStateFromNormalized(normalized);

  assert.equal(clientState.territoryState.territories.some((site) => site.id === sharedSite.id), false);
});

test('state normalization is structural only and world AI advancement requires explicit opt-in', () => {
  assert.equal(typeof GameStateService.advanceRuntimeState, 'function');

  const rawState = GameStateNormalizer.createInitialGameState('runtime-boundary-test');
  rawState.updatedAt = '2026-06-10T00:00:00.000Z';

  const originalAdvanceAi = WorldAiExplorerService.advanceAiExploration;
  const originalNormalizeTerritory = TerritoryService.normalizeTerritoryState;
  let phase = 'normalize';
  let aiAdvanceCalls = 0;
  let territoryAdvanceCalls = 0;

  WorldAiExplorerService.advanceAiExploration = (...args) => {
    if (phase === 'normalize') throw new Error('normalizeState must not advance world AI');
    aiAdvanceCalls += 1;
    return originalAdvanceAi(...args);
  };
  TerritoryService.normalizeTerritoryState = (...args) => {
    if (phase === 'normalize') throw new Error('normalizeState must not advance territory runtime');
    territoryAdvanceCalls += 1;
    return originalNormalizeTerritory(...args);
  };

  try {
    const normalized = GameStateService.normalizeState(clone(rawState));
    assert.equal(normalized.playerId, rawState.playerId);
    assert.equal(aiAdvanceCalls, 0);
    assert.equal(territoryAdvanceCalls, 0);

    phase = 'runtime';
    GameStateService.advanceRuntimeState(normalized, new Date('2026-06-10T00:00:05.000Z'));

    assert.equal(aiAdvanceCalls, 0);
    assert.equal(territoryAdvanceCalls, 1);

    GameStateService.advanceRuntimeState(normalized, new Date('2026-06-10T00:00:06.000Z'), {
      advanceWorldAi: true,
    });

    assert.equal(aiAdvanceCalls, 1);
    assert.equal(territoryAdvanceCalls, 2);
  } finally {
    WorldAiExplorerService.advanceAiExploration = originalAdvanceAi;
    TerritoryService.normalizeTerritoryState = originalNormalizeTerritory;
  }
});

test('game action route advances canonical state once and uses read-only projections for response assembly', () => {
  const { app, routes } = createAppHarness();
  const state = createNormalizedRouteState('projection-action-test');
  const calls = [];
  const repository = {
    findByPlayerId(playerId) {
      calls.push(`find:${playerId}`);
      return state;
    },
    save(savedState) {
      calls.push(`save:${savedState.playerId}`);
    },
    getClientProjectionForPlayer(playerId) {
      calls.push(`projection:${playerId}`);
      return { sharedWorldTerritories: [{ id: 'route-shared-site' }] };
    },
  };
  const gameStateService = {
    applyOnlineProgress(rawState, _now, options) {
      calls.push('applyOnlineProgress');
      assert.equal(options.planningContext.sharedWorldTerritories[0].id, 'route-shared-site');
      return rawState;
    },
    normalizeState() {
      throw new Error('route must not normalize after applyOnlineProgress');
    },
    getClientGameState() {
      throw new Error('route must not use raw client projection');
    },
    calculateEraProgress() {
      throw new Error('route must not use raw era progress');
    },
    getClientGameStateFromNormalized(normalized, projection) {
      calls.push('getClientGameStateFromNormalized');
      assert.equal(projection.sharedWorldTerritories[0].id, 'route-shared-site');
      return { playerId: normalized.playerId, activeCityId: normalized.activeCityId };
    },
    calculateEraProgressFromNormalized() {
      calls.push('calculateEraProgressFromNormalized');
      return { canAdvance: false, conditions: [] };
    },
  };
  registerGameRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    repository,
    gameStateService,
  });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');

  const res = invokeRoute(route, {
    playerId: 'projection-action-test',
    body: { action: 'switchCity', cityId: 'capital' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.deepEqual(calls.filter((item) => item === 'applyOnlineProgress'), ['applyOnlineProgress']);
  assert.equal(calls.includes('projection:projection-action-test'), true);
  assert.equal(calls.includes('getClientGameStateFromNormalized'), true);
  assert.equal(calls.includes('calculateEraProgressFromNormalized'), true);
});

test('game task claim route passes projection context into online progression', () => {
  const { app, routes } = createAppHarness();
  const state = createNormalizedRouteState('projection-task-claim-test');
  state.taskProgress = { claimed: {} };
  const calls = [];
  const repository = {
    findByPlayerId(playerId) {
      calls.push(`find:${playerId}`);
      return state;
    },
    save(savedState) {
      calls.push(`save:${savedState.playerId}`);
    },
    getClientProjectionForPlayer(playerId) {
      calls.push(`projection:${playerId}`);
      return { sharedWorldTerritories: [{ id: 'task-shared-site' }] };
    },
  };
  const gameStateService = {
    applyOnlineProgress(rawState, _now, options) {
      calls.push('applyOnlineProgress');
      assert.equal(options.planningContext.sharedWorldTerritories[0].id, 'task-shared-site');
      return rawState;
    },
    normalizeState() {
      throw new Error('task route must not normalize after applyOnlineProgress');
    },
    getClientGameStateFromNormalized(normalized, projection) {
      calls.push('getClientGameStateFromNormalized');
      assert.equal(projection.sharedWorldTerritories[0].id, 'task-shared-site');
      return { playerId: normalized.playerId, activeCityId: normalized.activeCityId };
    },
    calculateEraProgressFromNormalized() {
      calls.push('calculateEraProgressFromNormalized');
      return { canAdvance: false, conditions: [] };
    },
  };
  registerGameRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    repository,
    gameStateService,
  });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/tasks/claim');

  const res = invokeRoute(route, {
    playerId: 'projection-task-claim-test',
    body: { taskId: 'missing-task' },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(calls.filter((item) => item === 'applyOnlineProgress'), ['applyOnlineProgress']);
  assert.equal(calls.includes('projection:projection-task-claim-test'), true);
});

test('game state read route is a read-only projection without runtime advance or persistence', () => {
  const { app, routes } = createAppHarness();
  const state = createNormalizedRouteState('projection-state-readonly-test');
  const calls = [];
  const repository = {
    findByPlayerId(playerId) {
      calls.push(`find:${playerId}`);
      return state;
    },
    touchPlayerActiveAt() {
      throw new Error('GET /api/game/state must not update active timestamps');
    },
    save() {
      throw new Error('GET /api/game/state must not persist state');
    },
    getClientProjectionForPlayer(playerId) {
      calls.push(`projection:${playerId}`);
      return { sharedWorldTerritories: [{ id: 'route-state-shared-site' }] };
    },
  };
  const gameStateService = {
    applyOnlineProgress() {
      throw new Error('GET /api/game/state must not advance runtime state');
    },
    normalizeState(rawState) {
      calls.push('normalizeState');
      return rawState;
    },
    getClientGameState() {
      throw new Error('route must not use raw client projection');
    },
    calculateEraProgress() {
      throw new Error('route must not use raw era progress');
    },
    getClientGameStateFromNormalized(normalized, projection) {
      calls.push('getClientGameStateFromNormalized');
      assert.equal(projection.sharedWorldTerritories[0].id, 'route-state-shared-site');
      return { playerId: normalized.playerId, activeCityId: normalized.activeCityId };
    },
    calculateEraProgressFromNormalized() {
      calls.push('calculateEraProgressFromNormalized');
      return { canAdvance: false, conditions: [] };
    },
  };
  registerGameRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    repository,
    gameStateService,
  });
  const route = routes.find((item) => item.method === 'GET' && item.path === '/api/game/state');

  const res = invokeRoute(route, {
    playerId: 'projection-state-readonly-test',
    body: {},
    get() { return ''; },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.gameState.playerId, 'projection-state-readonly-test');
  assert.deepEqual(calls, [
    'find:projection-state-readonly-test',
    'normalizeState',
    'projection:projection-state-readonly-test',
    'getClientGameStateFromNormalized',
    'calculateEraProgressFromNormalized',
  ]);
});

test('game state route world-march trace derives mission tile ids from coordinates', () => {
  const { app, routes } = createAppHarness();
  const state = createNormalizedRouteState('projection-state-trace-coordinate-test');
  state.exploreMissions = [{
    id: 'trace-coordinate-mission',
    mode: 'manual',
    status: 'active',
    origin: { q: 1, r: -1, tileId: 'legacy-origin-tile' },
    target: { q: 3, r: -2, tileId: 'legacy-target-tile' },
    position: { q: 2, r: -1, tileId: 'legacy-position-tile' },
    route: [
      { q: 2, r: -1, tileId: 'legacy-route-step', step: 1 },
      { q: 3, r: -2, tileId: 'legacy-route-target', step: 2 },
    ],
    plannedTiles: [
      { id: 'legacy-planned-tile', q: 3, r: -2, terrain: 'forest' },
    ],
    plannedSites: [],
    revealedTileIds: [],
  }];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, state.playerId);
      return state;
    },
    getClientProjectionForPlayer() {
      return {};
    },
    save() {
      throw new Error('GET /api/game/state must not persist state');
    },
  };
  const gameStateService = {
    normalizeState(rawState) {
      return rawState;
    },
    getClientGameStateFromNormalized(normalized) {
      return { playerId: normalized.playerId, worldExplorerState: { missions: [] } };
    },
    calculateEraProgressFromNormalized() {
      return { canAdvance: false, conditions: [] };
    },
  };
  registerGameRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    repository,
    gameStateService,
  });
  const route = routes.find((item) => item.method === 'GET' && item.path === '/api/game/state');
  const traceLogs = [];
  const originalInfo = console.info;
  console.info = (...args) => {
    traceLogs.push(args);
  };
  try {
    const res = invokeRoute(route, {
      playerId: state.playerId,
      body: {},
      get(header) {
        return header === 'X-World-March-Trace' ? '1' : '';
      },
    });
    assert.equal(res.statusCode, 200);
  } finally {
    console.info = originalInfo;
  }

  const loadedTrace = traceLogs.find((entry) => entry[1] === 'route:state:loaded')?.[2];
  const mission = loadedTrace?.missions?.find((item) => item.id === 'trace-coordinate-mission');

  assert.ok(mission);
  assert.equal(mission.origin.tileId, 'tile_1_-1');
  assert.equal(mission.target.tileId, 'tile_3_-2');
  assert.equal(mission.position.tileId, 'tile_2_-1');
  assert.deepEqual(mission.routeIds, ['tile_2_-1', 'tile_3_-2']);
  assert.deepEqual(mission.plannedTileIds, ['tile_3_-2']);
  assert.equal(JSON.stringify(mission).includes('legacy-'), false);
});

test('game task read route is a read-only projection without runtime advance or persistence', () => {
  const { app, routes } = createAppHarness();
  const state = createNormalizedRouteState('projection-task-readonly-test');
  const calls = [];
  const repository = {
    findByPlayerId(playerId) {
      calls.push(`find:${playerId}`);
      return state;
    },
    touchPlayerActiveAt() {
      throw new Error('GET /api/game/tasks must not update active timestamps');
    },
    save() {
      throw new Error('GET /api/game/tasks must not persist state');
    },
  };
  const gameStateService = {
    applyOnlineProgress() {
      throw new Error('GET /api/game/tasks must not advance runtime state');
    },
    normalizeState(rawState) {
      calls.push('normalizeState');
      return rawState;
    },
  };
  registerGameRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    repository,
    gameStateService,
  });
  const route = routes.find((item) => item.method === 'GET' && item.path === '/api/game/tasks');

  const res = invokeRoute(route, {
    playerId: 'projection-task-readonly-test',
    query: { tab: 'main' },
    body: {},
    get() { return ''; },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.taskCenter.activeTab, 'main');
  assert.deepEqual(calls, [
    'find:projection-task-readonly-test',
    'normalizeState',
  ]);
});

test('reset route returns the newly created state without reloading or re-normalizing destructive writes', () => {
  const { app, routes } = createAppHarness();
  const resetState = createNormalizedRouteState('projection-reset-test');
  const calls = [];
  const authService = {};
  const repository = {
    findByPlayerId() {
      throw new Error('reset response must not re-read after committing the destructive write');
    },
    save(gameState) {
      calls.push(`save:${gameState.playerId}`);
    },
    getClientProjectionForPlayer(playerId) {
      calls.push(`projection:${playerId}`);
      return { sharedWorldTerritories: [] };
    },
  };
  const gameStateService = {
    createInitialGameState(playerId) {
      calls.push(`createInitialGameState:${playerId}`);
      return { ...clone(resetState), playerId };
    },
    getClientGameState() {
      throw new Error('reset route must not use raw client projection');
    },
    calculateEraProgress() {
      throw new Error('reset route must not use raw era progress');
    },
    getClientGameStateFromNormalized(gameState, projection) {
      calls.push('getClientGameStateFromNormalized');
      assert.deepEqual(projection.sharedWorldTerritories, []);
      return { playerId: gameState.playerId, activeCityId: gameState.activeCityId };
    },
    calculateEraProgressFromNormalized() {
      calls.push('calculateEraProgressFromNormalized');
      return { canAdvance: false, conditions: [] };
    },
  };
  registerPlayerRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    authService,
    repository,
    gameStateService,
    logService: { getPlayerLogs: () => [] },
  });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/player/reset');

  const res = invokeRoute(route, {
    playerId: 'projection-reset-test',
    body: {},
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.gameState.playerId, 'projection-reset-test');
  assert.deepEqual(calls, [
    'createInitialGameState:projection-reset-test',
    'save:projection-reset-test',
    'projection:projection-reset-test',
    'getClientGameStateFromNormalized',
    'calculateEraProgressFromNormalized',
  ]);
});

test('reset route uses spawn lifecycle service when creating the new state', () => {
  const { app, routes } = createAppHarness();
  const resetState = createNormalizedRouteState('projection-reset-spawn-test');
  resetState.territories = [{ id: 'capital', x: 18, y: -4, type: 'capital', owner: 'player', status: 'occupied' }];
  resetState.worldMap = { ...resetState.worldMap, origin: { q: 18, r: -4 } };
  const calls = [];
  const authService = {};
  const repository = {
    resetPlayerState(playerId, gameState) {
      calls.push(`resetPlayerState:${playerId}:${gameState.worldMap.origin.q},${gameState.worldMap.origin.r}`);
    },
    getClientProjectionForPlayer(playerId) {
      calls.push(`projection:${playerId}`);
      return { sharedWorldTerritories: [] };
    },
  };
  const gameStateService = {
    createInitialGameState() {
      throw new Error('reset route must use spawn lifecycle service when it is provided');
    },
    getClientGameState() {
      throw new Error('reset route must not use raw client projection');
    },
    calculateEraProgress() {
      throw new Error('reset route must not use raw era progress');
    },
    getClientGameStateFromNormalized(gameState) {
      calls.push('getClientGameStateFromNormalized');
      return { playerId: gameState.playerId, origin: gameState.worldMap.origin };
    },
    calculateEraProgressFromNormalized() {
      calls.push('calculateEraProgressFromNormalized');
      return { canAdvance: false, conditions: [] };
    },
  };
  const spawnLifecycleService = {
    resetInitialStateForPlayer(playerId) {
      calls.push(`spawnReset:${playerId}`);
      return { ...clone(resetState), playerId };
    },
  };
  registerPlayerRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    authService,
    repository,
    gameStateService,
    spawnLifecycleService,
    logService: { getPlayerLogs: () => [] },
  });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/player/reset');

  const res = invokeRoute(route, {
    playerId: 'projection-reset-spawn-test',
    body: {},
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.gameState.origin, { q: 18, r: -4 });
  assert.deepEqual(calls, [
    'spawnReset:projection-reset-spawn-test',
    'resetPlayerState:projection-reset-spawn-test:18,-4',
    'projection:projection-reset-spawn-test',
    'getClientGameStateFromNormalized',
    'calculateEraProgressFromNormalized',
  ]);
});

test('login route normalizes once and assembles the response from normalized-only projections', () => {
  const { app, routes } = createAppHarness();
  const rawState = createNormalizedRouteState('projection-login-test');
  const normalizedState = { ...rawState, normalized: true };
  const calls = [];
  const authService = {
    loginPlayer(username, password, getGameState, _calculateOfflineIncome, saveGameState) {
      calls.push(`login:${username}:${password}`);
      const loaded = getGameState(username);
      saveGameState(loaded);
      return {
        playerId: username,
        username,
        token: 'login-token',
        gameState: loaded,
        offlineIncome: null,
      };
    },
  };
  const repository = {
    findByPlayerId(playerId) {
      calls.push(`find:${playerId}`);
      return rawState;
    },
    save(gameState) {
      calls.push(`save:${gameState.playerId}`);
    },
    getClientProjectionForPlayer(playerId) {
      calls.push(`projection:${playerId}`);
      return { sharedWorldTerritories: [{ id: 'login-shared-site' }] };
    },
  };
  const gameStateService = {
    createInitialGameState() {
      throw new Error('existing login must not create a new state');
    },
    calculateOfflineIncome() {
      throw new Error('offline income should not be needed in this test');
    },
    normalizeState(gameState) {
      calls.push('normalizeState');
      assert.equal(gameState, rawState);
      return normalizedState;
    },
    getClientGameState() {
      throw new Error('login route must not use raw client projection');
    },
    calculateEraProgress() {
      throw new Error('login route must not use raw era progress');
    },
    getClientGameStateFromNormalized(gameState, projection) {
      calls.push('getClientGameStateFromNormalized');
      assert.equal(gameState, normalizedState);
      assert.equal(projection.sharedWorldTerritories[0].id, 'login-shared-site');
      return { playerId: gameState.playerId };
    },
    calculateEraProgressFromNormalized(gameState) {
      calls.push('calculateEraProgressFromNormalized');
      assert.equal(gameState, normalizedState);
      return { canAdvance: false, conditions: [] };
    },
  };
  registerPlayerRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    authService,
    repository,
    gameStateService,
    logService: { getPlayerLogs: () => [] },
  });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/player/login');

  const res = invokeRoute(route, {
    body: { username: 'projection-login-test', password: '123456' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.gameState.playerId, 'projection-login-test');
  assert.deepEqual(calls, [
    'login:projection-login-test:123456',
    'find:projection-login-test',
    'save:projection-login-test',
    'normalizeState',
    'projection:projection-login-test',
    'getClientGameStateFromNormalized',
    'calculateEraProgressFromNormalized',
  ]);
});

test('login route retries once when worker saves a newer revision first', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'projection-login-revision-retry-test';
  let currentState = { ...createNormalizedRouteState(playerId), revision: 1 };
  const calls = [];
  let saveCount = 0;
  const authService = {
    loginPlayer(username, password, getGameState, _calculateOfflineIncome, saveGameState) {
      calls.push(`login:${username}:${password}`);
      const loaded = getGameState(username);
      saveGameState(loaded);
      return {
        playerId: username,
        username,
        token: 'login-token',
        gameState: loaded,
        offlineIncome: null,
      };
    },
  };
  const repository = {
    findByPlayerId(playerIdArg) {
      calls.push(`find:${playerIdArg}`);
      return clone(currentState);
    },
    save(gameState) {
      saveCount += 1;
      calls.push(`save:${gameState.playerId}:${gameState.revision}`);
      if (saveCount === 1) {
        currentState = { ...currentState, revision: 2 };
        const error = new Error('Game state revision conflict');
        error.code = 'GAME_STATE_REVISION_CONFLICT';
        error.expectedRevision = gameState.revision;
        error.actualRevision = 2;
        throw error;
      }
      currentState = { ...clone(gameState), revision: 3 };
    },
    getClientProjectionForPlayer(playerIdArg) {
      calls.push(`projection:${playerIdArg}`);
      return { sharedWorldTerritories: [] };
    },
  };
  const gameStateService = {
    createInitialGameState() {
      throw new Error('existing login must not create a new state');
    },
    calculateOfflineIncome() {
      throw new Error('offline income should not be needed in this test');
    },
    normalizeState(gameState) {
      calls.push(`normalizeState:${gameState.revision}`);
      return gameState;
    },
    getClientGameStateFromNormalized(gameState) {
      calls.push(`getClientGameStateFromNormalized:${gameState.revision}`);
      return { playerId: gameState.playerId, revision: gameState.revision };
    },
    calculateEraProgressFromNormalized(gameState) {
      calls.push(`calculateEraProgressFromNormalized:${gameState.revision}`);
      return { canAdvance: false, conditions: [] };
    },
  };
  registerPlayerRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    authService,
    repository,
    gameStateService,
    logService: { getPlayerLogs: () => [] },
  });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/player/login');

  const res = invokeRoute(route, {
    body: { username: playerId, password: '123456' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.gameState.playerId, playerId);
  assert.equal(res.payload.gameState.revision, 2);
  assert.equal(saveCount, 2);
  assert.deepEqual(calls, [
    `login:${playerId}:123456`,
    `find:${playerId}`,
    `save:${playerId}:1`,
    `login:${playerId}:123456`,
    `find:${playerId}`,
    `save:${playerId}:2`,
    'normalizeState:2',
    `projection:${playerId}`,
    'getClientGameStateFromNormalized:2',
    'calculateEraProgressFromNormalized:2',
  ]);
});

test('login route passes spawn lifecycle creation into auth service for missing states', () => {
  const { app, routes } = createAppHarness();
  const createdState = createNormalizedRouteState('projection-login-spawn-test');
  createdState.territories = [{ id: 'capital', x: -18, y: 6, type: 'capital', owner: 'player', status: 'occupied' }];
  createdState.worldMap = { ...createdState.worldMap, origin: { q: -18, r: 6 } };
  const calls = [];
  const authService = {
    loginPlayer(username, password, _getGameState, _calculateOfflineIncome, _saveGameState, getDefaultGameState) {
      calls.push(`login:${username}:${password}`);
      const gameState = getDefaultGameState(username);
      return {
        playerId: username,
        username,
        token: 'login-token',
        gameState,
        offlineIncome: null,
      };
    },
  };
  const repository = {
    findByPlayerId() {
      throw new Error('login route test auth stub owns missing-state creation');
    },
    save() {
      throw new Error('login route test auth stub owns missing-state persistence');
    },
    getClientProjectionForPlayer(playerId) {
      calls.push(`projection:${playerId}`);
      return { sharedWorldTerritories: [] };
    },
  };
  const gameStateService = {
    createInitialGameState() {
      throw new Error('login route must use spawn lifecycle service when it is provided');
    },
    calculateOfflineIncome() {
      throw new Error('offline income should not be needed in this test');
    },
    normalizeState(gameState) {
      calls.push('normalizeState');
      return gameState;
    },
    getClientGameState() {
      throw new Error('login route must not use raw client projection');
    },
    calculateEraProgress() {
      throw new Error('login route must not use raw era progress');
    },
    getClientGameStateFromNormalized(gameState) {
      calls.push('getClientGameStateFromNormalized');
      return { playerId: gameState.playerId, origin: gameState.worldMap.origin };
    },
    calculateEraProgressFromNormalized() {
      calls.push('calculateEraProgressFromNormalized');
      return { canAdvance: false, conditions: [] };
    },
  };
  const spawnLifecycleService = {
    createInitialStateForPlayer(playerId) {
      calls.push(`spawnCreate:${playerId}`);
      return { ...clone(createdState), playerId };
    },
  };
  registerPlayerRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    authService,
    repository,
    gameStateService,
    spawnLifecycleService,
    logService: { getPlayerLogs: () => [] },
  });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/player/login');

  const res = invokeRoute(route, {
    body: { username: 'projection-login-spawn-test', password: '123456' },
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.gameState.origin, { q: -18, r: 6 });
  assert.deepEqual(calls, [
    'login:projection-login-spawn-test:123456',
    'spawnCreate:projection-login-spawn-test',
    'normalizeState',
    'projection:projection-login-spawn-test',
    'getClientGameStateFromNormalized',
    'calculateEraProgressFromNormalized',
  ]);
});
