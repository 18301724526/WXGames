const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const registerGameRoutesImpl = require('../routes/gameRoutes');
const GameStateService = require('../services/GameStateService');
const TerritoryService = require('../services/TerritoryService');
const WorldMapService = require('../services/WorldMapService');
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

function createAppHarness() {
  const routes = [];
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
    post(path, ...handlers) {
      const route = { method: 'POST', path, handlers };
      const authHandler = handlers[0];
      route.handlers[0] = (req, res, next) => {
        attachClientCommand(route, req);
        return authHandler(req, res, next);
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

function registerGameRoutes(app, deps) {
  const pipeline = createCommandPipelineTestDependencies(
    deps.repository,
    deps.gameStateService,
  );
  pipelineHarnesses.push(pipeline);
  return registerGameRoutesImpl(app, { ...deps, ...pipeline });
}

test('game action route reports committed build commands when projection fails after save', () => {
  const { app, routes } = createAppHarness();
  const gameState = {
    playerId: 'route-build-projection-failure-test',
    revision: 7,
    resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    population: { total: 3, max: 3, farmers: 3 },
    techs: {},
    currentEra: 0,
    updatedAt: '2026-06-04T00:00:00.000Z',
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-build-projection-failure-test');
      return JSON.parse(JSON.stringify(gameState));
    },
    save(state) {
      state.revision = 8;
      savedStates.push(JSON.parse(JSON.stringify(state)));
      return state;
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState() {
      throw new Error('forced projection failure');
    },
    calculateEraProgress() {
      return { canAdvance: false, conditions: [] };
    },
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const req = {
    playerId: 'route-build-projection-failure-test',
    headers: { 'x-client-request-id': 'api-build-projection-1' },
    body: { action: 'build', target: 'house' },
  };
  const res = createResponse();
  const errorLogs = [];
  const originalError = console.error;
  console.error = (...args) => {
    errorLogs.push(args);
  };

  try {
    route.handlers[0](req, res, () => route.handlers[1](req, res));
  } finally {
    console.error = originalError;
  }

  assert.equal(res.statusCode, 202);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].cities.capital.buildings.house.level, 1);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.error, 'PROJECTION_FAILED_AFTER_COMMIT');
  assert.equal(res.payload.command.type, 'build');
  assert.equal(res.payload.command.requestId, 'api-build-projection-1');
  assert.equal(res.payload.command.phase, 'responding');
  assert.ok(res.payload.command.phases.some((phase) => phase.phase === 'projection_failed'));
  assert.equal(res.payload.command.committed, true);
  assert.equal(res.payload.command.revisionBefore, 7);
  assert.equal(res.payload.command.revisionAfter, 8);
  assert.equal(res.payload.committed, true);
  assert.equal(res.payload.resyncRequired, true);
  assert.equal(Object.hasOwn(res.payload, 'tutorial'), false);
  assert.equal(errorLogs.length, 1);
  assert.equal(errorLogs[0][1].command.phase, 'projecting');
  assert.equal(errorLogs[0][1].command.committed, true);
  assert.match(errorLogs[0][1].error.stack, /forced projection failure/);
});

test('game tasks route returns task definitions from task center service', () => {
  const { app, routes } = createAppHarness();
  const gameState = {
    playerId: 'route-tasks-test',
    resources: { food: 100, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: { house: { level: 1 } },
    population: {},
    currentEra: 1,
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        resources: { food: 100, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        buildings: { house: { level: 1 } },
        population: {},
      },
    },
    activeCityId: 'capital',
    taskProgress: { claimed: {} },
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-tasks-test');
      return gameState;
    },
    touchPlayerActiveAt(playerId) {
      assert.equal(playerId, 'route-tasks-test');
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState(state) {
      return { playerId: state.playerId };
    },
    calculateEraProgress() {
      return { canAdvance: false, conditions: [] };
    },
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'GET' && item.path === '/api/game/tasks');
  const req = {
    playerId: 'route-tasks-test',
    query: { tab: 'main' },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(savedStates.length, 0);
  assert.equal(res.payload.taskCenter.activeTab, 'main');
  assert.equal(res.payload.taskCenter.summary.totalCount >= 3, true);
  assert.equal(res.payload.taskCenter.categories.main.tasks.some((task) => task.id === 'main_first_supplies'), true);
});

test('game task claim route pays main task reward and persists progress', () => {
  const { app, routes } = createAppHarness();
  const gameState = {
    playerId: 'route-task-claim-test',
    resources: { food: 10, knowledge: 1, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: { house: { level: 1 } },
    population: {},
    currentEra: 1,
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        resources: { food: 10, knowledge: 1, wood: 0, iron: 0, stone: 0, metal: 0 },
        buildings: { house: { level: 1 } },
        population: {},
      },
    },
    activeCityId: 'capital',
    taskProgress: { claimed: {} },
    eventQueue: [],
    eventHistory: [],
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-task-claim-test');
      return gameState;
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState(state) {
      return {
        playerId: state.playerId,
        resources: state.cities[state.activeCityId].resources,
        taskProgress: state.taskProgress,
      };
    },
    calculateEraProgress() {
      return { canAdvance: false, conditions: [] };
    },
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/tasks/claim');
  const req = {
    playerId: 'route-task-claim-test',
    body: { taskId: 'main_first_supplies', category: 'main' },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.deepEqual(res.payload.reward.resources, { food: 120, knowledge: 5 });
  assert.equal(res.payload.gameState.resources.food, 130);
  assert.equal(savedStates[0].taskProgress.claimed.main_first_supplies.reward.resources.knowledge, 5);
  assert.equal(Object.hasOwn(res.payload, 'tutorial'), false);
  assert.equal(Object.hasOwn(savedStates[0], 'tutorial'), false);
  assert.equal(res.payload.taskCenter.categories.main.tasks.find((task) => task.id === 'main_first_supplies').status, 'completed');
});

test('game action route returns a clean domain rejection for ineligible era advance', () => {
  const { app, routes } = createAppHarness();
  const builtAt = '2026-07-10T00:00:00.000Z';
  const resources = { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 };
  const buildings = {
    house: { level: 1, builtAt, upgradedAt: builtAt },
    farm: { level: 1, builtAt, upgradedAt: builtAt },
  };
  const gameState = {
    playerId: 'route-era-rejection-test',
    currentEra: 1,
    resources,
    buildings,
    population: { total: 3, max: 4, maxPop: 4, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
    techs: {},
    techEffects: {},
    eraHistory: [{ era: 0, advancedAt: builtAt }, { era: 1, advancedAt: builtAt }],
    eventQueue: [],
    eventHistory: [],
    activeBuffs: [],
    activeCityId: 'capital',
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        resources: { ...resources },
        buildings: { ...buildings },
        population: { total: 3, max: 4, maxPop: 4, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
        military: { soldiers: 0 },
      },
    },
    taskProgress: { claimed: {} },
    updatedAt: builtAt,
  };
  const repository = {
    findByPlayerId() {
      return gameState;
    },
    save() {},
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState(state) {
      return { playerId: state.playerId, currentEra: state.currentEra, resources: state.resources };
    },
    calculateEraProgress: GameStateService.calculateEraProgress,
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const req = { playerId: gameState.playerId, body: { action: 'advanceEra' } };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error, 'INSUFFICIENT_RESOURCES');
  assert.equal(res.payload.message, '资源不足，无法进入下一时代');
  assert.equal(res.payload.gameState.currentEra, 1);
  assert.equal(Object.hasOwn(res.payload, 'tutorial'), false);
});

test('game task claim route rejects the removed homestead supplies task', () => {
  const { app, routes } = createAppHarness();
  const gameState = {
    playerId: 'route-homestead-claim-test',
    resources: { food: 10, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    population: {},
    currentEra: 0,
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        resources: { food: 10, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        buildings: {},
        population: {},
      },
    },
    activeCityId: 'capital',
    taskProgress: { claimed: {} },
    eventQueue: [],
    eventHistory: [],
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-homestead-claim-test');
      return gameState;
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState(state) {
      return {
        playerId: state.playerId,
        resources: state.cities[state.activeCityId].resources,
        taskProgress: state.taskProgress,
      };
    },
    calculateEraProgress() {
      return { canAdvance: false, conditions: [] };
    },
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/tasks/claim');
  const req = {
    playerId: 'route-homestead-claim-test',
    body: { taskId: 'main_homestead_supplies', category: 'main' },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error, 'TASK_NOT_FOUND');
  assert.equal(res.payload.gameState.resources.food, 10);
  assert.equal(Object.hasOwn(res.payload, 'tutorial'), false);
  assert.equal(Object.hasOwn(savedStates[0], 'tutorial'), false);
  assert.equal(Boolean(savedStates[0].taskProgress.claimed.main_homestead_supplies), false);
});

test('game action route rejects an empty world march formation with structured 400', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'route-empty-world-march-test';
  const gameState = GameStateService.createInitialGameState(playerId);
  gameState.cities.capital.military.formations = [
    { slot: 1, memberIds: [], soldierAssignments: {} },
  ];
  gameState.military = gameState.cities.capital.military;
  const savedStates = [];
  const repository = {
    findByPlayerId(id) {
      assert.equal(id, playerId);
      return gameState;
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState(state) {
      return { playerId: state.playerId };
    },
    calculateEraProgress() {
      return { canAdvance: false, conditions: [] };
    },
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const req = {
    playerId,
    body: { action: 'startWorldMarch', targetQ: 1, targetR: 0, cityId: 'capital', formationSlot: 1 },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error, 'FORMATION_EMPTY');
  assert.equal(res.payload.message, '编队为空，无法出征');
  assert.equal(res.payload.blocker.code, 'FORMATION_EMPTY');
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].exploreMissions.length, 0);
});

test('game action route accepts a world march formation with a soldiered primary', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'route-valid-world-march-test';
  const primaryId = 'route-valid-world-march-primary';
  const gameState = GameStateService.createInitialGameState(playerId);
  gameState.famousPeople = [{ id: primaryId, name: 'Primary' }];
  gameState.cities.capital.military.formations = [
    { slot: 1, memberIds: [primaryId], soldierAssignments: { [primaryId]: 25 } },
  ];
  gameState.military = gameState.cities.capital.military;
  const savedStates = [];
  const repository = {
    findByPlayerId(id) {
      assert.equal(id, playerId);
      return gameState;
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState(state) {
      return { playerId: state.playerId };
    },
    calculateEraProgress() {
      return { canAdvance: false, conditions: [] };
    },
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const req = {
    playerId,
    body: { action: 'startWorldMarch', targetQ: 1, targetR: 0, cityId: 'capital', formationSlot: 1 },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.mission.formationSnapshot.soldiersCommitted, 25);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].exploreMissions.length, 1);
});

test('heartbeat stores compact world march client reports without returning game state', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'heartbeat-world-march-report-test';
  let gameState = GameStateService.createInitialGameState(playerId);
  const savedStates = [];
  const repository = {
    findByPlayerId(id) {
      assert.equal(id, playerId);
      return gameState;
    },
    save(state) {
      gameState = JSON.parse(JSON.stringify(state));
      savedStates.push(gameState);
    },
  };
  const gameStateService = {
    normalizeState(state) {
      return GameStateService.normalizeState(state);
    },
  };

  registerGameRoutes(app, {
    authMiddleware: (req, res, next) => next(),
    repository,
    gameStateService,
  });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/heartbeat');
  const req = {
    playerId,
    body: {
      worldMarchClientReport: {
        missions: [{
          missionId: 'march-report-1',
          clientTime: '2026-06-21T00:00:02.000Z',
          position: { q: 1.25, r: 0 },
          extraLargePayload: 'x'.repeat(1000),
        }],
      },
    },
    get() { return ''; },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.type, 'heartbeat');
  assert.equal(Boolean(res.payload.gameState), false);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].worldMarchClientReports.missions['march-report-1'].position.q, 1.25);
  assert.equal(JSON.stringify(savedStates[0].worldMarchClientReports).includes('extraLargePayload'), false);
});

test('game action route rejects unknown world exploration report actions without saving', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'route-retired-world-explorer-test';
  const gameState = GameStateService.createInitialGameState(playerId);
  const savedStates = [];
  const repository = {
    findByPlayerId(id) {
      assert.equal(id, playerId);
      return gameState;
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return GameStateService.normalizeState(state);
    },
    getClientGameState: GameStateService.getClientGameState,
    calculateEraProgress: GameStateService.calculateEraProgress,
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  for (const action of ['startExplore', 'claimExplore']) {
    const req = { playerId, body: { action, missionId: 'explore-old' } };
    const res = createResponse();
    route.handlers[0](req, res, () => route.handlers[1](req, res));
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.error, 'OWNER_DECLARATION_MISSING');
  }

  assert.equal(savedStates.length, 0);
});

test('game action route returns stopped world march as an idle client mission', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'route-world-march-stop-idle-test';
  const gameState = GameStateService.createInitialGameState(playerId);
  const scoutPersonId = 'fp-route-scout';
  gameState.currentEra = 3;
  gameState.famousPeople = [{
    id: scoutPersonId,
    name: 'Scout',
    archetype: 'scout',
    abilityArchetype: 'scout',
    quality: 'great',
  }];
  gameState.military = {
    ...gameState.military,
    soldiers: 10,
    soldierCap: 10,
    formations: [{
        slot: 1,
        memberIds: [scoutPersonId],
        soldierAssignments: { [scoutPersonId]: 10 },
      }],
  };
  gameState.cities = {
    capital: {
      id: 'capital',
      territoryId: 'capital',
      isCapital: true,
      resources: { ...gameState.resources },
      buildings: { ...gameState.buildings },
      population: { ...gameState.population },
      military: {
        ...gameState.military,
        formations: [{
            slot: 1,
            memberIds: [scoutPersonId],
            soldierAssignments: { [scoutPersonId]: 10 },
          }],
      },
    },
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(id) {
      assert.equal(id, playerId);
      return savedStates.at(-1) || gameState;
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return GameStateService.normalizeState(state);
    },
    getClientGameState: GameStateService.getClientGameState,
    calculateEraProgress: GameStateService.calculateEraProgress,
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const startReq = {
    playerId,
    body: { action: 'startWorldMarch', targetQ: 1, targetR: 0, cityId: 'capital', formationSlot: 1 },
  };
  const startRes = createResponse();
  route.handlers[0](startReq, startRes, () => route.handlers[1](startReq, startRes));
  assert.equal(startRes.statusCode, 200);

  const missionId = startRes.payload.mission.id;
  const stopReq = { playerId, body: { action: 'stopWorldMarch', missionId } };
  const stopRes = createResponse();
  route.handlers[0](stopReq, stopRes, () => route.handlers[1](stopReq, stopRes));

  assert.equal(stopRes.statusCode, 200);
  assert.equal(stopRes.payload.mission.status, 'idle');
  assert.equal(stopRes.payload.gameState.worldExplorerState.idleMissions[0].id, missionId);
  assert.equal(stopRes.payload.gameState.worldExplorerState.missions.length, 1);
  assert.equal(savedStates.at(-1).exploreMissions[0].status, 'idle');
  assert.equal(savedStates.at(-1).exploreMissions[0].route.length, 0);
});

test('game action route retries once when worker saves a newer revision first', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'route-action-revision-retry-test';
  const siteId = 'site_3_1';
  const createState = (revision) => ({
    playerId,
    revision,
    activeCityId: 'capital',
    currentEra: 3,
    resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
    military: { soldiers: 0, soldierCap: 0 },
    polity: TerritoryService.createInitialPolity(),
    territories: [
      { id: 'capital', x: 0, y: 0, naturalName: 'Origin', cityName: 'Capital', type: 'capital', owner: 'player', status: 'occupied' },
      { id: siteId, x: 3, y: 1, naturalName: 'River Bend', type: 'town', owner: 'neutral', status: 'discovered', scale: 2, defense: 100, recommendedSoldiers: 100 },
    ],
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        name: 'Capital',
        resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        buildings: {},
        population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
        military: { soldiers: 0, soldierCap: 0 },
      },
    },
    worldMap: WorldMapService.createInitialWorldMap('route-action-revision-retry-test'),
    warMissions: [],
    exploreMissions: [],
  });
  const savedStates = [];
  let currentState = createState(1);
  let findCount = 0;
  let saveCount = 0;
  const repository = {
    findByPlayerId(id) {
      assert.equal(id, playerId);
      findCount += 1;
      return JSON.parse(JSON.stringify(currentState));
    },
    save(state) {
      saveCount += 1;
      if (saveCount === 1) {
        currentState = { ...currentState, revision: 2 };
        const error = new Error('Game state revision conflict');
        error.code = 'GAME_STATE_REVISION_CONFLICT';
        error.expectedRevision = state.revision;
        error.actualRevision = 2;
        throw error;
      }
      const saved = JSON.parse(JSON.stringify({ ...state, revision: 3 }));
      currentState = saved;
      savedStates.push(saved);
    },
    getClientProjectionForPlayer() {
      return {};
    },
  };
  const gameStateService = {
    applyOnlineProgress(state) {
      return state;
    },
    getClientGameState: GameStateService.getClientGameState,
    calculateEraProgress: GameStateService.calculateEraProgress,
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const req = { playerId, body: { action: 'startConquest', territoryId: siteId } };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(findCount, 2);
  assert.equal(saveCount, 2);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].warMissions[0].status, 'ready');
  assert.equal(Object.hasOwn(res.payload, 'tutorial'), false);
});
