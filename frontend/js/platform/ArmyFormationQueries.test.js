const test = require('node:test');
const assert = require('node:assert/strict');

const ArmyFormationQueries = require('./ArmyFormationQueries');

// SHAPE-A dedup contract: the module only ever reads host.getState(), so ONE
// implementation serves both an app-like host (getState -> this.state) and a shell-like
// host (getState -> this.lastGame.state). We build both host shapes over the same fixture
// and assert identical results -- this is the regression guard for the old App:3042 vs
// Shell:1466 divergence that this slice collapsed.

const FIXTURE = {
  activeCityId: 'capital',
  military: {
    soldiers: 700,
    formations: { capital: [{ slot: 1, maxSoldiersPerMember: 250 }, { slot: 2 }] },
  },
  cities: { border: { military: { soldiers: 40 } } },
  cityState: { activeCityId: 'fallbackCity' },
};

function appHost(state) {
  return { getState: () => state, sumArmyFormationAssignments: sumStub };
}
function shellHost(state) {
  const lastGame = { state };
  return { lastGame, getState: () => lastGame.state, sumArmyFormationAssignments: sumStub };
}
function sumStub(assignments = {}) {
  return Object.values(assignments).reduce((a, v) => a + (Number(v) || 0), 0);
}

test('getArmyFormation finds by slot, then by index, then null -- identical for app/shell hosts', () => {
  for (const host of [appHost(FIXTURE), shellHost(FIXTURE)]) {
    assert.deepEqual(host && ArmyFormationQueries.getArmyFormation(host, 'capital', 1), {
      slot: 1,
      maxSoldiersPerMember: 250,
    });
    // slot 3 is absent -> index fallback (cityFormations[2]) is undefined -> null
    assert.equal(ArmyFormationQueries.getArmyFormation(host, 'capital', 3), null);
    // unknown city -> no formations -> null
    assert.equal(ArmyFormationQueries.getArmyFormation(host, 'nowhere', 1), null);
  }
});

test('getArmyFormation resolves cityId: arg -> activeCityId -> cityState -> capital', () => {
  const host = appHost({
    military: { formations: { onlyCity: [{ slot: 1, tag: 'x' }] } },
    cityState: { activeCityId: 'onlyCity' },
  });
  // no arg, no activeCityId -> falls through to cityState.activeCityId = onlyCity
  assert.deepEqual(ArmyFormationQueries.getArmyFormation(host, undefined, 1), {
    slot: 1,
    tag: 'x',
  });
});

test('getArmyFormationSoldierCap reads maxSoldiersPerMember (default 1000)', () => {
  const host = appHost(FIXTURE);
  assert.equal(ArmyFormationQueries.getArmyFormationSoldierCap(host, 'capital', 1), 250);
  assert.equal(ArmyFormationQueries.getArmyFormationSoldierCap(host, 'capital', 2), 1000);
});

test('getArmyFormationReserveSoldiers prefers cities[cityId].military over top-level military', () => {
  const host = appHost(FIXTURE);
  assert.equal(ArmyFormationQueries.getArmyFormationReserveSoldiers(host, 'border'), 40);
  assert.equal(ArmyFormationQueries.getArmyFormationReserveSoldiers(host, 'capital'), 700);
});

test('getArmyFormationEditablePool = assigned-in-slot + city reserve (via host.sumArmyFormationAssignments)', () => {
  const host = appHost({
    activeCityId: 'capital',
    military: {
      soldiers: 100,
      formations: { capital: [{ slot: 1, soldierAssignments: { a: 30, b: 20 } }] },
    },
  });
  // previousAssigned (30+20=50) + reserve (100) = 150
  assert.equal(
    ArmyFormationQueries.getArmyFormationEditablePool(host, { cityId: 'capital', slot: 1 }),
    150,
  );
});
