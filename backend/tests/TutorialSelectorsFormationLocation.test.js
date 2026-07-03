const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialSelectors = require('../services/tutorial/TutorialSelectors');

// Regression for the new-chain world-march 403: formation writes land on
// cities[cityId].military (setCityMilitary) when the city slot exists, leaving
// the top-level gameState.military.formations as a stale/empty sibling. The
// tutorial gate's getFormationSnapshot read the top-level copy FIRST, saw an
// empty formation, and returned false -> 403 TUTORIAL_BLOCKED even though the
// scout was correctly deployed. The snapshot must resolve city-scoped first
// (matching getCityMilitary precedence), which is where the save wrote.

const scoutId = 'fp_tutorial_scout_alus23';

function stateWithSplitFormation() {
  return {
    activeCityId: 'capital',
    tutorial: {
      currentStep: 'scoutWorldPanelOpened',
      grants: { scoutFamousPerson: { personId: scoutId } },
    },
    famousPeople: [{ id: scoutId, archetype: 'scout' }],
    // top-level military: stale, empty-member slots (what normalize leaves here)
    military: {
      formations: {
        capital: [
          { slot: 1, memberIds: [] },
          { slot: 2, memberIds: [] },
          { slot: 3, memberIds: [] },
        ],
      },
    },
    // per-city military: the authoritative save target, has the scout
    cities: {
      capital: {
        military: {
          formations: {
            capital: [{ slot: 1, memberIds: [scoutId], soldierAssignments: { [scoutId]: 1000 } }],
          },
        },
      },
    },
  };
}

test('getFormationMembers reads the city-scoped formation over the stale top-level copy', () => {
  const members = TutorialSelectors.getFormationMembers(stateWithSplitFormation(), {
    cityId: 'capital',
    formationSlot: 1,
  });
  assert.deepEqual(members, [scoutId]);
});

test('hasTutorialScoutFormation passes when the scout is in the city-scoped formation', () => {
  assert.equal(
    TutorialSelectors.hasTutorialScoutFormation(stateWithSplitFormation(), {
      cityId: 'capital',
      formationSlot: 1,
    }),
    true,
  );
});

test('getFormationMembers still falls back to top-level military when no city slot exists', () => {
  const state = {
    activeCityId: 'capital',
    famousPeople: [{ id: scoutId }],
    military: { formations: { capital: [{ slot: 1, memberIds: [scoutId] }] } },
    // no cities[].military.formations
    cities: { capital: {} },
  };
  assert.deepEqual(
    TutorialSelectors.getFormationMembers(state, { cityId: 'capital', formationSlot: 1 }),
    [scoutId],
  );
});
