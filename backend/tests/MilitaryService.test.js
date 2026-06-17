const test = require('node:test');
const assert = require('node:assert/strict');

const MilitaryService = require('../services/MilitaryService');

function createState(overrides = {}) {
  const state = {
    playerId: 'military-test',
    activeCityId: 'capital',
    buildings: { barracks: { level: 1 } },
    resources: { food: 500, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    famousPeople: [
      { id: 'hero-1', name: 'Hero 1' },
      { id: 'hero-2', name: 'Hero 2' },
    ],
    military: {
      soldiers: 500,
      soldierCap: 300,
      trainingProgress: 0,
      formations: {
        capital: [{ slot: 1, memberIds: [] }],
      },
    },
    cities: {
      capital: {
        id: 'capital',
        buildings: { barracks: { level: 1 } },
        resources: { food: 500, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        military: {
          soldiers: 500,
          soldierCap: 300,
          trainingProgress: 0,
          formations: {
            capital: [{ slot: 1, memberIds: [] }],
          },
        },
      },
    },
    exploreMissions: [],
    tutorial: { completed: true, disabled: true },
    ...overrides,
  };
  return state;
}

test('setArmyFormation assigns standing troops by deducting reserve soldiers and resources', () => {
  const state = createState();

  const result = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 200 },
  });

  assert.equal(result.success, true);
  assert.equal(state.cities.capital.military.soldiers, 100);
  assert.equal(state.cities.capital.resources.food, 300);
  assert.deepEqual(result.formation.soldierAssignments, { 'hero-1': 200 });
  assert.equal(result.formation.soldiersAssigned, 200);
});

test('setArmyFormation rejects assignments above city reserve or per-member cap', () => {
  const state = createState();

  const aboveReserve = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 400 },
  });

  assert.equal(aboveReserve.success, false);
  assert.equal(aboveReserve.error, 'INSUFFICIENT_CITY_SOLDIERS');

  const aboveCap = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 1001 },
  });

  assert.equal(aboveCap.success, false);
  assert.equal(aboveCap.error, 'FORMATION_SOLDIER_CAP_EXCEEDED');
});

test('setArmyFormation refunds resources without returning soldiers when standing troops are reduced', () => {
  const state = createState();
  MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 200 },
  });

  const result = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 80 },
  });

  assert.equal(result.success, true);
  assert.equal(state.cities.capital.military.soldiers, 100);
  assert.equal(state.cities.capital.resources.food, 360);
  assert.deepEqual(result.refund, { food: 60 });
});

test('setArmyFormation rejects editing a formation locked by an active march snapshot', () => {
  const state = createState({
    exploreMissions: [{
      id: 'mission-1',
      status: 'active',
      formation: { cityId: 'capital', slot: 1, memberIds: ['hero-1'] },
      formationSnapshot: {
        schema: 'formation-snapshot-v1',
        sourceCityId: 'capital',
        slot: 1,
        members: [{ personId: 'hero-1', soldiersCommitted: 100, soldiersRemaining: 100 }],
        soldiersCommitted: 100,
        soldiersRemaining: 100,
        lockedAt: '2026-06-06T00:00:00.000Z',
        settledAt: null,
      },
    }],
  });

  const result = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 100 },
  });

  assert.equal(result.success, false);
  assert.equal(result.error, 'FORMATION_LOCKED_BY_MISSION');
});

test('settleFormationSnapshot writes surviving march troops back to saved formation', () => {
  const state = createState({
    military: {
      soldiers: 300,
      soldierCap: 300,
      formations: {
        capital: [{ slot: 1, memberIds: ['hero-1'], soldierAssignments: { 'hero-1': 200 } }],
      },
    },
    cities: {
      capital: {
        id: 'capital',
        buildings: { barracks: { level: 1 } },
        resources: { food: 500, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        military: {
          soldiers: 300,
          soldierCap: 300,
          formations: {
            capital: [{ slot: 1, memberIds: ['hero-1'], soldierAssignments: { 'hero-1': 200 } }],
          },
        },
      },
    },
  });

  const result = MilitaryService.settleFormationSnapshot(state, {
    schema: 'formation-snapshot-v1',
    sourceCityId: 'capital',
    slot: 1,
    members: [{ personId: 'hero-1', soldiersCommitted: 200, soldiersRemaining: 75 }],
    soldiersCommitted: 200,
    soldiersRemaining: 75,
    lockedAt: '2026-06-06T00:00:00.000Z',
    settledAt: null,
  }, { now: new Date('2026-06-06T00:10:00.000Z') });

  assert.equal(result.success, true);
  assert.deepEqual(state.cities.capital.military.formations.capital[0].soldierAssignments, { 'hero-1': 75 });
  assert.equal(result.snapshot.settledAt, '2026-06-06T00:10:00.000Z');
});

test('advanceTraining consumes recruitment resources and writes back to the active city', () => {
  const state = createState({
    resources: { food: 15, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    military: { soldiers: 0, soldierCap: 300, trainingProgress: 0 },
    cities: {
      capital: {
        id: 'capital',
        buildings: { barracks: { level: 1 } },
        resources: { food: 15, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        military: { soldiers: 0, soldierCap: 300, trainingProgress: 0 },
      },
    },
  });

  const result = MilitaryService.advanceTraining(state, 30);

  assert.equal(result.trained, 10);
  assert.equal(state.cities.capital.military.soldiers, 10);
  assert.equal(state.cities.capital.resources.food, 5);
});
