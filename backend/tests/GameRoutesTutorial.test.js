const test = require('node:test');
const assert = require('node:assert/strict');

const registerGameRoutes = require('../routes/gameRoutes');
const TutorialService = require('../services/TutorialService');
const GameStateService = require('../services/GameStateService');
const TerritoryService = require('../services/TerritoryService');
const WorldMapService = require('../services/WorldMapService');
const WorldExplorerService = require('../services/WorldExplorerService');

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

test('game action route persists tutorial returned by action handlers', () => {
  const { app, routes } = createAppHarness();
  const initialTutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.eraAdvancedTo1,
  );
  const gameState = {
    playerId: 'route-tutorial-test',
    tutorial: initialTutorial,
    currentEra: 0,
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-tutorial-test');
      return gameState;
    },
    save(state) {
      savedStates.push(JSON.parse(JSON.stringify(state)));
    },
  };
  const gameStateService = {
    normalizeState(state) {
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
    playerId: 'route-tutorial-test',
    body: { action: 'tutorialAdvance', step: TutorialService.TUTORIAL_STEPS.buildingsTabOpened },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].tutorial.currentStep, TutorialService.TUTORIAL_STEPS.buildingsTabOpened);
  assert.equal(res.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.buildingsTabOpened);
});

test('game action route builds the tutorial house before era one', () => {
  const { app, routes } = createAppHarness();
  const initialTutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.houseGuideReady,
  );
  const gameState = {
    playerId: 'route-tutorial-house-test',
    tutorial: initialTutorial,
    resources: { food: 130, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    population: { total: 3, max: 3, farmers: 3 },
    techs: {},
    currentEra: 0,
    updatedAt: '2026-06-04T00:00:00.000Z',
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-tutorial-house-test');
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
      return { playerId: state.playerId, buildings: state.buildings, resources: state.resources };
    },
    calculateEraProgress() {
      return { canAdvance: false, conditions: [] };
    },
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const req = {
    playerId: 'route-tutorial-house-test',
    body: { action: 'build', target: 'house' },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].buildings.house.level, 1);
  assert.equal(savedStates[0].tutorial.currentStep, TutorialService.TUTORIAL_STEPS.houseBuilt);
  assert.equal(res.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.houseBuilt);
});

test('game tasks route returns task definitions from task center service', () => {
  const { app, routes } = createAppHarness();
  const gameState = {
    playerId: 'route-tasks-test',
    resources: { food: 100, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: { house: { level: 1 } },
    population: {},
    tutorial: TutorialService.createInitialTutorialState(),
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
    tutorial: TutorialService.manualAdvance(
      TutorialService.createInitialTutorialState(),
      TutorialService.TUTORIAL_STEPS.eraAdvancedTo1,
    ),
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
      return { playerId: state.playerId, resources: state.resources, taskProgress: state.taskProgress };
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
  assert.equal(res.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.farmPrepReserved);
  assert.equal(savedStates[0].taskProgress.claimed.main_first_supplies.reward.resources.knowledge, 5);
  assert.equal(savedStates[0].tutorial.currentStep, TutorialService.TUTORIAL_STEPS.farmPrepReserved);
  assert.equal(res.payload.taskCenter.categories.main.tasks.find((task) => task.id === 'main_first_supplies').status, 'completed');
});

test('game action route syncs farm-built tutorial before second era advancement', () => {
  const { app, routes } = createAppHarness();
  const builtAt = '2026-06-04T00:00:00.000Z';
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.farmBuilt,
  );
  const resources = { food: 120, knowledge: 5, wood: 0, iron: 0, stone: 0, metal: 0 };
  const buildings = {
    house: { level: 1, builtAt, upgradedAt: builtAt },
    farm: { level: 1, builtAt, upgradedAt: builtAt },
  };
  const gameState = {
    playerId: 'route-era-two-sync-test',
    tutorial,
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
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-era-two-sync-test');
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
        currentEra: state.currentEra,
        resources: state.resources,
        eventQueue: state.eventQueue,
      };
    },
    calculateEraProgress: GameStateService.calculateEraProgress,
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const req = {
    playerId: 'route-era-two-sync-test',
    body: { action: 'advanceEra' },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.gameState.currentEra, 2);
  assert.equal(res.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.eraAdvancedTo2);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].currentEra, 2);
  assert.equal(savedStates[0].tutorial.currentStep, TutorialService.TUTORIAL_STEPS.eraAdvancedTo2);
  assert.equal(savedStates[0].eventQueue.some((event) => event.id === 'evt_settlement_forest_001'), true);
});

test('game action route grants scout famous person and persists tutorial formation save', () => {
  const { app, routes } = createAppHarness();
  const builtAt = '2026-06-04T00:00:00.000Z';
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.era3AdvanceReady,
  );
  const resources = { food: 500, knowledge: 100, wood: 200, iron: 0, stone: 0, metal: 0 };
  const buildings = {
    house: { level: 1, builtAt, upgradedAt: builtAt },
    farm: { level: 1, builtAt, upgradedAt: builtAt },
    lumbermill: { level: 1, builtAt, upgradedAt: builtAt },
  };
  const gameState = {
    playerId: 'route-scout-famous-formation-test',
    tutorial,
    currentEra: 2,
    resources,
    buildings,
    population: { total: 4, max: 4, maxPop: 4, farmers: 3, scholars: 0, craftsmen: 1, unassigned: 0 },
    techs: {},
    techEffects: {},
    eraHistory: [{ era: 0, advancedAt: builtAt }, { era: 1, advancedAt: builtAt }, { era: 2, advancedAt: builtAt }],
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
        population: { total: 4, max: 4, maxPop: 4, farmers: 3, scholars: 0, craftsmen: 1, unassigned: 0 },
        military: { soldiers: 0 },
      },
    },
    famousPeople: [],
    famousPersonState: { candidates: [], seek: { count: 0, lastAt: null } },
    military: { formations: { capital: [{ slot: 1, memberIds: [] }] } },
    taskProgress: { claimed: {} },
    updatedAt: builtAt,
  };
  const savedStates = [];
  const repository = {
    findByPlayerId(playerId) {
      assert.equal(playerId, 'route-scout-famous-formation-test');
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
    getClientGameState: GameStateService.getClientGameState,
    calculateEraProgress: GameStateService.calculateEraProgress,
  };
  const authMiddleware = (req, res, next) => next();

  registerGameRoutes(app, { authMiddleware, repository, gameStateService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/game/action');
  const advanceReq = {
    playerId: 'route-scout-famous-formation-test',
    body: { action: 'advanceEra' },
  };
  const advanceRes = createResponse();

  route.handlers[0](advanceReq, advanceRes, () => route.handlers[1](advanceReq, advanceRes));

  assert.equal(advanceRes.statusCode, 200);
  assert.equal(advanceRes.payload.gameState.currentEra, 3);
  assert.equal(advanceRes.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutFamousGranted);
  assert.equal(savedStates[0].famousPeople.length, 1);
  assert.equal(savedStates[0].famousPeople[0].quality, 'great');
  assert.equal(savedStates[0].famousPeople[0].archetype, 'scout');
  const personId = savedStates[0].tutorial.grants.scoutFamousPerson.personId;

  gameState.tutorial = TutorialService.manualAdvance(savedStates[0].tutorial, TutorialService.TUTORIAL_STEPS.formationPanelOpened);
  const formationReq = {
    playerId: 'route-scout-famous-formation-test',
    body: { action: 'setArmyFormation', cityId: 'capital', slot: 1, memberIds: [personId] },
  };
  const formationRes = createResponse();

  route.handlers[0](formationReq, formationRes, () => route.handlers[1](formationReq, formationRes));

  assert.equal(formationRes.statusCode, 200);
  assert.equal(formationRes.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutFormationSaved);
  assert.deepEqual(formationRes.payload.formation.memberIds, [personId]);
  assert.deepEqual(formationRes.payload.gameState.military.formations.capital[0].memberIds, [personId]);
  assert.equal(savedStates.at(-1).tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutFormationSaved);
  assert.deepEqual(savedStates.at(-1).cities.capital.military.formations.capital[0].memberIds, [personId]);
});

test('game action route starts guided world march with planned tiles in client state', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'route-guided-world-explorer-test';
  const gameState = GameStateService.createInitialGameState(playerId);
  const scoutPersonId = 'fp-route-scout';
  gameState.currentEra = 3;
  gameState.tutorial = {
    ...TutorialService.manualAdvance(
      gameState.tutorial,
      TutorialService.TUTORIAL_STEPS.scoutFormationSaved,
    ),
    grants: {
      scoutFamousPerson: { personId: scoutPersonId },
    },
  };
  gameState.famousPeople = [{
    id: scoutPersonId,
    name: 'Scout',
    archetype: 'scout',
    abilityArchetype: 'scout',
    quality: 'great',
  }];
  gameState.military = {
    ...gameState.military,
    formations: {
      capital: [{ slot: 1, memberIds: [scoutPersonId] }],
    },
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
        formations: {
          capital: [{ slot: 1, memberIds: [scoutPersonId] }],
        },
      },
    },
  };
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
  const req = {
    playerId,
    body: { action: 'startWorldMarch', targetQ: 2, targetR: 0, cityId: 'capital', formationSlot: 1 },
  };
  const res = createResponse();

  route.handlers[0](req, res, () => route.handlers[1](req, res));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.scoutExploreStarted);
  assert.equal(res.payload.gameState.worldExplorerState.activeMission.plannedTiles.length, 2);
  assert.equal(res.payload.gameState.worldExplorerState.activeMission.plannedSites.length, 1);
  assert.equal(savedStates.at(-1).exploreMissions[0].plannedTiles.length, 2);
  assert.equal(savedStates.at(-1).exploreMissions[0].plannedSites.length, 1);
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
    assert.equal(res.payload.error, 'UNKNOWN_ACTION');
  }

  assert.equal(savedStates.length, 0);
});

test('game action route returns stopped world march as an idle client mission', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'route-world-march-stop-idle-test';
  const gameState = GameStateService.createInitialGameState(playerId);
  const scoutPersonId = 'fp-route-scout';
  gameState.currentEra = 3;
  gameState.tutorial = {
    ...TutorialService.manualAdvance(
      gameState.tutorial,
      TutorialService.TUTORIAL_STEPS.scoutFormationSaved,
    ),
    completed: true,
    disabled: true,
    grants: {
      scoutFamousPerson: { personId: scoutPersonId },
    },
  };
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
    formations: {
      capital: [{ slot: 1, memberIds: [scoutPersonId] }],
    },
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
        formations: {
          capital: [{ slot: 1, memberIds: [scoutPersonId] }],
        },
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
    body: { action: 'startWorldMarch', targetQ: 3, targetR: 3, cityId: 'capital', formationSlot: 1 },
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

test('game action route enforces guided first empty city occupation target', () => {
  const { app, routes } = createAppHarness();
  const playerId = 'route-tutorial-first-city-test';
  const siteId = 'site_3_1';
  const otherSiteId = 'site_9_9';
  const gameState = {
    playerId,
    activeCityId: 'capital',
    currentEra: 3,
    tutorial: {
      ...TutorialService.manualAdvance(
        TutorialService.createInitialTutorialState(),
        TutorialService.TUTORIAL_STEPS.firstCityDiscovered,
      ),
      grants: {
        [WorldExplorerService.TUTORIAL_FIRST_SITE_GRANT_KEY]: { siteId },
      },
    },
    resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
    military: { soldiers: 0, soldierCap: 0 },
    polity: TerritoryService.createInitialPolity(),
    territories: [
      { id: 'capital', x: 0, y: 0, naturalName: 'Origin', cityName: 'Capital', type: 'capital', owner: 'player', status: 'occupied' },
      { id: siteId, x: 3, y: 1, naturalName: 'River Bend', type: 'town', owner: 'neutral', status: 'discovered', scale: 2, defense: 100, recommendedSoldiers: 100 },
      { id: otherSiteId, x: 9, y: 9, naturalName: 'Wrong Site', type: 'town', owner: 'neutral', status: 'discovered', scale: 2, defense: 100, recommendedSoldiers: 100 },
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
    worldMap: WorldMapService.createInitialWorldMap('route-tutorial-first-city-test'),
    warMissions: [],
    exploreMissions: [],
  };
  WorldMapService.bindSiteToTile(gameState, 3, 1, siteId, new Date('2026-06-06T00:00:00.000Z'), { visibility: 'scouted' });
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

  const blockedReq = { playerId, body: { action: 'startConquest', territoryId: otherSiteId } };
  const blockedRes = createResponse();
  route.handlers[0](blockedReq, blockedRes, () => route.handlers[1](blockedReq, blockedRes));
  assert.equal(blockedRes.statusCode, 403);
  assert.equal(savedStates.length, 0);

  const allowedReq = { playerId, body: { action: 'startConquest', territoryId: siteId } };
  const allowedRes = createResponse();
  route.handlers[0](allowedReq, allowedRes, () => route.handlers[1](allowedReq, allowedRes));

  assert.equal(allowedRes.statusCode, 200);
  assert.equal(allowedRes.payload.success, true);
  assert.equal(allowedRes.payload.tutorial.currentStep, TutorialService.TUTORIAL_STEPS.firstCityConquestStarted);
  assert.equal(savedStates.at(-1).warMissions[0].status, 'ready');
  assert.equal(savedStates.at(-1).cities.capital.military.soldiers, TerritoryService.MIN_EXPEDITION_SOLDIERS);
});
