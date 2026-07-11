const test = require('node:test');
const assert = require('node:assert/strict');

const MilitaryService = require('../services/MilitaryService');
const TaskRewardGrantLedger = require('../services/taskCenter/TaskRewardGrantLedger');

function firstArmyGrantLedger(soldiers = 1000) {
  return {
    soldiers: {
      firstArmy: { soldiers, grantedAt: '2026-07-03T00:00:00.000Z' },
    },
  };
}

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

const T0 = 1_700_000_000_000; // fixed deposit epoch for deterministic drain math
const HOUR = 60 * 60 * 1000;

test('setArmyFormation parks dismissed soldiers in the veteran camp instead of instant-refunding', () => {
  const state = createState();
  MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 200 },
  });
  const foodBefore = state.cities.capital.resources.food;

  const result = MilitaryService.setArmyFormation(state, {
    cityId: 'capital',
    slot: 1,
    memberIds: ['hero-1'],
    soldierAssignments: { 'hero-1': 80 },
    nowMs: T0,
  });

  assert.equal(result.success, true);
  // Dismissed soldiers do NOT return to the reserve and are NOT instantly refunded — they park.
  assert.equal(state.cities.capital.military.soldiers, 100);
  assert.deepEqual(result.refund, {}); // capacity 300 fits all 120; nothing overflows
  assert.equal(state.cities.capital.resources.food, foodBefore); // no instant refund
  const view = MilitaryService.getVeteranCampView(state.cities.capital.military, T0);
  assert.equal(view.level, 1);
  assert.equal(view.parkedTotal, 120);
});

test('veteran camp drains parked soldiers over time, trickling grain refunds (no floor loss)', () => {
  const state = createState();
  MilitaryService.setArmyFormation(state, {
    cityId: 'capital', slot: 1, memberIds: ['hero-1'], soldierAssignments: { 'hero-1': 200 },
  });
  MilitaryService.setArmyFormation(state, {
    cityId: 'capital', slot: 1, memberIds: ['hero-1'], soldierAssignments: { 'hero-1': 80 }, nowMs: T0,
  }); // park 120 at T0
  const foodBefore = state.cities.capital.resources.food;

  // Half the 12h retention -> ~60 drained -> 60 * refundRatio(0.5) = 30 food.
  const settled = MilitaryService.settleVeteranCampDrain(
    state.cities.capital.military, state.cities.capital.resources, T0 + 6 * HOUR,
  );
  assert.equal(MilitaryService.getVeteranCampView(settled.military, T0 + 6 * HOUR).parkedTotal, 60);
  assert.equal(settled.resources.food - foodBefore, 30);

  // Settling again at the same instant credits nothing more (idempotent).
  const again = MilitaryService.settleVeteranCampDrain(settled.military, settled.resources, T0 + 6 * HOUR);
  assert.equal(again.resources.food, settled.resources.food);
});

test('veteranCampWithdraw pulls parked soldiers back into the reserve, capped by reserve space', () => {
  const state = createState();
  MilitaryService.setArmyFormation(state, {
    cityId: 'capital', slot: 1, memberIds: ['hero-1'], soldierAssignments: { 'hero-1': 200 },
  });
  MilitaryService.setArmyFormation(state, {
    cityId: 'capital', slot: 1, memberIds: ['hero-1'], soldierAssignments: { 'hero-1': 80 }, nowMs: T0,
  }); // reserve 100, parked 120, cap 300 -> space 200

  const w = MilitaryService.veteranCampWithdraw(state, { cityId: 'capital', soldiers: 50, nowMs: T0 });
  assert.equal(w.success, true);
  assert.equal(w.withdrawnSoldiers, 50);
  assert.equal(state.cities.capital.military.soldiers, 150);
  assert.equal(w.veteranCamp.parkedTotal, 70);

  // An explicit request of 0 is a no-op — it must NOT be read as "withdraw everything".
  const zero = MilitaryService.veteranCampWithdraw(state, { cityId: 'capital', soldiers: 0, nowMs: T0 });
  assert.equal(zero.success, false);
  assert.equal(state.cities.capital.military.soldiers, 150); // reserve unchanged
  assert.equal(MilitaryService.getVeteranCampView(state.cities.capital.military, T0).parkedTotal, 70); // camp intact
});

test('veteranCampUpgrade spends grain to raise the level and capacity', () => {
  const state = createState();
  state.cities.capital.resources.food = 5000;

  const up = MilitaryService.veteranCampUpgrade(state, { cityId: 'capital' });
  assert.equal(up.success, true);
  assert.equal(up.level, 2);
  assert.equal(state.cities.capital.resources.food, 5000 - up.cost);
  assert.equal(MilitaryService.getVeteranCampView(state.cities.capital.military).capacity, 600);
});

test('veteran camp overflow beyond capacity is refunded immediately', () => {
  const state = createState();
  // Pre-seed the camp near capacity (290/300), then dismiss 20 -> 10 park, 10 overflow.
  state.cities.capital.military.veteranCamp = {
    level: 1, batches: [{ soldiers: 290, originalSoldiers: 290, atMs: T0 }],
  };
  MilitaryService.setArmyFormation(state, {
    cityId: 'capital', slot: 1, memberIds: ['hero-1'], soldierAssignments: { 'hero-1': 200 },
  });
  const foodBefore = state.cities.capital.resources.food;
  const result = MilitaryService.setArmyFormation(state, {
    cityId: 'capital', slot: 1, memberIds: ['hero-1'], soldierAssignments: { 'hero-1': 180 }, nowMs: T0,
  }); // dismiss 20; camp has 10 free -> 10 park, 10 overflow -> refund 10 * 0.5 = 5 food

  assert.equal(result.success, true);
  assert.equal(result.refund.food, 5);
  assert.equal(state.cities.capital.resources.food, foodBefore + 5);
  assert.equal(MilitaryService.getVeteranCampView(state.cities.capital.military, T0).parkedTotal, 300);
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
  assert.deepEqual(state.cities.capital.military.formations[0].soldierAssignments, { 'hero-1': 75 });
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
        grants: {},
      },
      taskRewardGrants: firstArmyGrantLedger(),
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
      grants: {},
    },
    taskRewardGrants: firstArmyGrantLedger(),
  });
  const cap = Math.max(0, Math.floor(MilitaryService.getTrainingStats(state.buildings).soldierCap || 0));

  const normalized = MilitaryService.normalizeMilitaryState({ soldiers: 1000 }, state);
  assert.equal(normalized.soldierCap, cap);
  assert.equal(normalized.soldiers, cap);
});

test('normalizeMilitaryState reads legacy first-army tutorial grants into the task reward ledger', () => {
  const TutorialService = require('../services/TutorialService');
  const state = createState({
    tutorial: {
      completed: false,
      disabled: false,
      currentStep: TutorialService.TUTORIAL_STEPS.firstArmyClaimed,
      grants: { firstArmy: { soldiers: 1000, grantedAt: '2026-07-03T00:00:00.000Z' } },
    },
  });

  const normalized = MilitaryService.normalizeMilitaryState({ soldiers: 1000 }, state);
  assert.equal(normalized.soldiers, 1000);
  assert.equal(normalized.soldierCap, 1000);
  assert.equal(
    TaskRewardGrantLedger.getSoldierGrant(state, TaskRewardGrantLedger.FIRST_ARMY_GRANT_KEY).soldiers,
    1000,
  );
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
