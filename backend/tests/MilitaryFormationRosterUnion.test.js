const test = require('node:test');
const assert = require('node:assert/strict');

const MilitaryService = require('../services/MilitaryService');

// Regression: formation members must validate against the FULL famous-person
// roster, not just the legacy flat `gameState.famousPeople`. The persisted
// single-source is `famousPersons.people`; when the tutorial scout grant became
// a one-shot task reward (nothing repopulated the flat copy on load),
// formation normalization silently dropped the scout from formation slot 1,
// which tripped the world-march tutorial gate (403 TUTORIAL_BLOCKED) even though
// the scout was correctly in the formation. See TutorialSelectors.hasTutorialScoutFormation.

test('city formations normalization keeps members present only in famousPersons.people', () => {
  const scoutId = 'fp_tutorial_scout_alus23';
  const gameState = {
    activeCityId: 'capital',
    // flat famousPeople is ABSENT (the failing production shape after reload)
    famousPersons: { people: [{ id: scoutId, archetype: 'scout' }] },
    buildings: { barracks: { level: 3 } },
  };
  const formations = MilitaryService.normalizeMilitaryState(
    {
      formations: {
        capital: [{ slot: 1, memberIds: [scoutId], soldierAssignments: { [scoutId]: 1000 } }],
      },
      buildings: gameState.buildings,
    },
    gameState,
  ).formations;
  assert.deepEqual(formations[0].memberIds, [scoutId]);
});

test('city formations normalization still honors the flat famousPeople roster', () => {
  const heroId = 'fp_hero_1';
  const gameState = {
    activeCityId: 'capital',
    famousPeople: [{ id: heroId }],
    buildings: { barracks: { level: 3 } },
  };
  const formations = MilitaryService.normalizeMilitaryState(
    { formations: { capital: [{ slot: 1, memberIds: [heroId] }] }, buildings: gameState.buildings },
    gameState,
  ).formations;
  assert.deepEqual(formations[0].memberIds, [heroId]);
});

test('city formations normalization drops members absent from BOTH roster collections', () => {
  const gameState = {
    activeCityId: 'capital',
    famousPersons: { people: [{ id: 'fp_present' }] },
    buildings: { barracks: { level: 3 } },
  };
  const formations = MilitaryService.normalizeMilitaryState(
    {
      formations: { capital: [{ slot: 1, memberIds: ['fp_present', 'fp_ghost'] }] },
      buildings: gameState.buildings,
    },
    gameState,
  ).formations;
  assert.deepEqual(formations[0].memberIds, ['fp_present']);
});
