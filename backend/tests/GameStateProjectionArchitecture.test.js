const test = require('node:test');
const assert = require('node:assert/strict');

const registerGameRoutes = require('../routes/gameRoutes');
const registerPlayerRoutes = require('../routes/playerRoutes');
const GameStateService = require('../services/GameStateService');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const TerritoryService = require('../services/TerritoryService');
const WorldAiExplorerService = require('../services/WorldAiExplorerService');
const WorldMapService = require('../services/WorldMapService');

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
    startedAt: '2026-06-10T00:00:00.000Z',
    nextStepAt: '2026-06-10T00:00:01.000Z',
    completesAt: '2026-06-10T00:00:01.000Z',
  }];
  normalized.warMissions = [{
    id: 'territory-mission-readonly',
    kind: 'scout',
    status: 'active',
    direction: 'e',
    route: [{ q: 1, r: 0, step: 1, revealed: false }],
    revealArea: [{ q: 1, r: 0, step: 1, revealed: false }],
    revealedTileIds: [],
    actionPoints: 1,
    actionPointsRemaining: 1,
    startedAt: '2026-06-10T00:00:00.000Z',
    nextStepAt: '2026-06-10T00:00:01.000Z',
    completesAt: '2026-06-10T00:00:01.000Z',
    soldiersCommitted: 1,
  }];
  normalized.scoutState = {
    emptyStreak: 0,
    areas: [{
      id: 'area-readonly',
      missionId: 'territory-mission-readonly',
      direction: 'e',
      originX: 0,
      originY: 0,
      targetX: 1,
      targetY: 0,
      result: null,
      siteId: null,
      tileIds: [],
      coords: [],
      scoutedAt: null,
    }],
  };
  const before = clone(normalized);

  const clientState = GameStateService.getClientGameStateFromNormalized(normalized, now);

  assert.equal(clientState.worldExplorerState.activeMission.id, 'world-mission-readonly');
  assert.equal(clientState.worldExplorerState.activeMission.route[0].revealed, false);
  assert.equal(clientState.territoryState.scoutMissions[0].status, 'active');
  assert.deepEqual(normalized, before);
});

test('state normalization is structural only and runtime world advancement is explicit', () => {
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

    assert.equal(aiAdvanceCalls, 1);
    assert.equal(territoryAdvanceCalls, 1);
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
  };
  const gameStateService = {
    applyOnlineProgress(rawState) {
      calls.push('applyOnlineProgress');
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
    getClientGameStateFromNormalized(normalized) {
      calls.push('getClientGameStateFromNormalized');
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
  assert.equal(calls.includes('getClientGameStateFromNormalized'), true);
  assert.equal(calls.includes('calculateEraProgressFromNormalized'), true);
});

test('reset route returns the newly created state without reloading or re-normalizing destructive writes', () => {
  const { app, routes } = createAppHarness();
  const resetState = createNormalizedRouteState('projection-reset-test');
  const calls = [];
  const authService = {
    resetPlayer(playerId, getDefaultGameState, saveGameState) {
      calls.push(`reset:${playerId}`);
      const gameState = getDefaultGameState(playerId);
      saveGameState(gameState);
      return { success: true, message: 'reset', gameState };
    },
  };
  const repository = {
    findByPlayerId() {
      throw new Error('reset response must not re-read after committing the destructive write');
    },
    save(gameState) {
      calls.push(`save:${gameState.playerId}`);
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
    getClientGameStateFromNormalized(gameState) {
      calls.push('getClientGameStateFromNormalized');
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
    'reset:projection-reset-test',
    'createInitialGameState:projection-reset-test',
    'save:projection-reset-test',
    'getClientGameStateFromNormalized',
    'calculateEraProgressFromNormalized',
  ]);
});
