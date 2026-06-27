const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateManager = require('./GameStateManager');

function makeBuildingState(levels = {}) {
  return { getLevel: (_buildings, id) => levels[id] || 0 };
}

test('GameStateManager.sync merges server state and derives the canonical resource/era fields', () => {
  const manager = new GameStateManager(
    { currentTab: 'military', resources: {}, population: {} },
    { buildingState: makeBuildingState({ workshop: 2, lumbermill: 1 }) },
  );

  const result = manager.sync(
    {
      currentEra: 3,
      currentEraName: 'Bronze',
      resources: { food: 10, knowledge: 5, wood: 7, metal: 4, stone: 2 },
      population: { max: 8 },
      buildings: {},
    },
    { percentage: 50, canAdvance: true, conditions: [] },
  );

  assert.equal(result.currentEra, 3);
  assert.equal(result.era, 3);
  assert.equal(result.currentEraName, 'Bronze');
  assert.equal(result.food, 10);
  assert.equal(result.knowledge, 5);
  assert.equal(result.wood, 7);
  assert.equal(result.iron, 4); // resources.iron ?? resources.metal
  assert.equal(result.stone, 2);
  assert.equal(result.workshopCount, 2);
  assert.equal(result.lumbermillCount, 1);
  assert.equal(result.population.maxPop, 8);
  assert.deepEqual(result.eraProgress, { percentage: 50, canAdvance: true, conditions: [] });
});

test('GameStateManager.sync preserves the local currentTab over the server payload', () => {
  const manager = new GameStateManager(
    { currentTab: 'worldMap', resources: {}, population: {} },
    { buildingState: makeBuildingState() },
  );

  const result = manager.sync({
    currentEra: 1,
    currentTab: 'resources',
    resources: {},
    population: {},
  });

  assert.equal(result.currentTab, 'worldMap');
});

test('GameStateManager.sync applies default sub-state shapes (military/territory/explorer/city)', () => {
  const manager = new GameStateManager(
    { resources: {}, population: {} },
    { buildingState: makeBuildingState() },
  );

  const result = manager.sync({ currentEra: 0, resources: {}, population: {} });

  assert.equal(result.military.defensePerSoldier, 0.01);
  assert.equal(result.military.soldiers, 0);
  assert.ok(Array.isArray(result.territoryState.territories));
  assert.ok(Array.isArray(result.worldExplorerState.missions));
  assert.equal(result.worldExplorerState.maxActiveMissions, 1);
  assert.equal(result.activeCityId, 'capital');
  assert.equal(result.isCapitalCity, true);
  assert.deepEqual(result.guideTasks, { visible: false, tasks: [] });
});

test('GameStateManager.sync keeps existing sub-state values when the server omits them', () => {
  const manager = new GameStateManager(
    {
      resources: {},
      population: {},
      talentPolicies: { a: 1 },
      famousPersons: { p: 1 },
      territoryState: { occupiedCount: 5 },
    },
    { buildingState: makeBuildingState() },
  );

  const result = manager.sync({ currentEra: 0, resources: {}, population: {} });

  assert.deepEqual(result.talentPolicies, { a: 1 });
  assert.deepEqual(result.famousPersons, { p: 1 });
  assert.equal(result.territoryState.occupiedCount, 5);
});
