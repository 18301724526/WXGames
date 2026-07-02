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

test('setArmyFormation assigns standing troops by deducting reserve soldiers without charging resources', () => {
  const state = createState();

  const result = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 200 },
  });

  assert.equal(result.success, true);
  assert.equal(state.cities.capital.military.soldiers, 100);
  assert.equal(state.cities.capital.resources.food, 500);
  assert.deepEqual(result.formation.soldierAssignments, { 'hero-1': 200 });
  assert.equal(result.formation.soldiersAssigned, 200);
});

test('setArmyFormation assigns reserve soldiers even when the city has no resources', () => {
  const state = createState();
  state.cities.capital.resources.food = 0;

  const result = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 200 },
  });

  assert.equal(result.success, true);
  assert.equal(state.cities.capital.military.soldiers, 100);
  assert.equal(state.cities.capital.resources.food, 0);
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
  assert.equal(state.cities.capital.resources.food, 560);
  assert.deepEqual(result.refund, { food: 60 });

  const oddDeltaResult = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 75 },
  });

  assert.equal(oddDeltaResult.success, true);
  assert.equal(state.cities.capital.military.soldiers, 100);
  assert.equal(state.cities.capital.resources.food, 562);
  assert.deepEqual(oddDeltaResult.refund, { food: 2 });
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

test('normalizeMilitaryState clamps soldiers purely to the barracks cap with no tutorial floor', () => {
  const TutorialService = require('../services/TutorialService');
  const state = createState({
    tutorial: {
      completed: false,
      disabled: false,
      currentStep: TutorialService.TUTORIAL_STEPS.firstCityDiscovered,
      grants: { firstExploreEmptyCity: { siteId: 'site_9_9' } },
    },
    territories: [{ id: 'site_9_9', owner: 'neutral', status: 'discovered' }],
  });
  const cap = Math.max(0, Math.floor(MilitaryService.getTrainingStats(state.buildings).soldierCap || 0));

  const normalized = MilitaryService.normalizeMilitaryState({ soldiers: 500 }, state);
  assert.equal(normalized.soldierCap, cap);
  assert.equal(normalized.soldiers, Math.min(cap, 500));

  const zero = MilitaryService.normalizeMilitaryState({ soldiers: 0 }, state);
  assert.equal(zero.soldiers, 0);
  assert.equal(zero.soldierCap, cap);
});

test('normalizeMilitaryState floors reserve and cap at the first-army grant during the formation guide', () => {
  const TutorialService = require('../services/TutorialService');
  const inWindowSteps = [
    TutorialService.TUTORIAL_STEPS.firstArmyClaimed,
    TutorialService.TUTORIAL_STEPS.scoutFamousGranted,
    TutorialService.TUTORIAL_STEPS.formationPanelOpened,
  ];
  for (const step of inWindowSteps) {
    const state = createState({
      tutorial: {
        completed: false,
        disabled: false,
        currentStep: step,
        grants: { firstArmy: { soldiers: 1000, grantedAt: '2026-07-03T00:00:00.000Z' } },
      },
    });
    const normalized = MilitaryService.normalizeMilitaryState({ soldiers: 1000 }, state);
    assert.equal(normalized.soldiers, 1000, `soldiers must survive at ${step}`);
    assert.equal(normalized.soldierCap, 1000, `cap must be floored at ${step}`);
  }
});

test('normalizeMilitaryState re-clamps the residual reserve after scoutFormationSaved', () => {
  const TutorialService = require('../services/TutorialService');
  const state = createState({
    tutorial: {
      completed: false,
      disabled: false,
      currentStep: TutorialService.TUTORIAL_STEPS.scoutFormationSaved,
      grants: { firstArmy: { soldiers: 1000, grantedAt: '2026-07-03T00:00:00.000Z' } },
    },
  });
  const cap = Math.max(0, Math.floor(MilitaryService.getTrainingStats(state.buildings).soldierCap || 0));

  const normalized = MilitaryService.normalizeMilitaryState({ soldiers: 1000 }, state);
  assert.equal(normalized.soldierCap, cap);
  assert.equal(normalized.soldiers, cap);
});

test('normalizeMilitaryState ignores the first-army floor without a grant record', () => {
  const TutorialService = require('../services/TutorialService');
  const state = createState({
    tutorial: {
      completed: false,
      disabled: false,
      currentStep: TutorialService.TUTORIAL_STEPS.firstArmyClaimed,
      grants: {},
    },
  });
  const cap = Math.max(0, Math.floor(MilitaryService.getTrainingStats(state.buildings).soldierCap || 0));

  const normalized = MilitaryService.normalizeMilitaryState({ soldiers: 1000 }, state);
  assert.equal(normalized.soldierCap, cap);
  assert.equal(normalized.soldiers, cap);
});
