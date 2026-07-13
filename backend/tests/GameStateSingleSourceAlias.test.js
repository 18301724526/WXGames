const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const CityService = require('../services/CityService');
const MilitaryService = require('../services/MilitaryService');

// Single-source-of-truth invariant: after normalization the top-level
// resources/buildings/population/military fields ARE the active city's objects — the
// SAME reference, not sibling copies. This is the structural fix for the family of bugs
// where post-CUT7 saves kept the truth city-scoped while legacy readers saw a zeroed
// top-level rebuild (world-march 403, lumbermill affordability gate).

function makeNormalizedState() {
  const raw = {
    playerId: 'ssot-test',
    resources: { food: 77, wood: 33, knowledge: 5, stone: 0, iron: 0, metal: 0 },
  };
  return gameStateService.normalizeState(raw);
}

test('top-level facts alias the active city objects after normalize', () => {
  const state = makeNormalizedState();
  const city = CityService.getActiveCity(state);

  assert.equal(state.resources, city.resources, 'resources: same reference');
  assert.equal(state.buildings, city.buildings, 'buildings: same reference');
  assert.equal(state.population, city.population, 'population: same reference');
  assert.equal(state.military, city.military, 'military: same reference');
});

test('field-level writes are visible through both paths (one fact, two names)', () => {
  const state = makeNormalizedState();
  const city = CityService.getActiveCity(state);

  state.resources.food = 12345;
  assert.equal(city.resources.food, 12345, 'top-level write lands on the city truth');

  city.military.soldiers = 999;
  assert.equal(state.military.soldiers, 999, 'city write is visible to legacy top-level readers');
});

test('setCityMilitary/setCityResources keep the top-level alias intact', () => {
  const state = makeNormalizedState();
  const activeCityId = state.activeCityId || 'capital';

  const nextMilitary = { ...MilitaryService.getCityMilitary(state, activeCityId), soldiers: 555 };
  MilitaryService.setCityMilitary(state, activeCityId, nextMilitary);
  assert.equal(
    state.military,
    state.cities[activeCityId].military,
    'military alias survives replacement',
  );
  assert.equal(state.military.soldiers, 555);

  const nextResources = { ...MilitaryService.getCityResources(state, activeCityId), food: 4242 };
  MilitaryService.setCityResources(state, activeCityId, nextResources);
  assert.equal(
    state.resources,
    state.cities[activeCityId].resources,
    'resources alias survives replacement',
  );
  assert.equal(state.resources.food, 4242);
});

test('re-normalizing a saved state keeps city truth as the only source', () => {
  const state = makeNormalizedState();
  state.resources.food = 888;

  // Simulate save→load: serialize (both shapes get written redundantly but identically),
  // then normalize the parsed copy — the alias must be re-established, and the value must
  // come from the city truth.
  const reloaded = gameStateService.normalizeState(JSON.parse(JSON.stringify(state)));
  const city = CityService.getActiveCity(reloaded);
  assert.equal(reloaded.resources, city.resources);
  assert.equal(reloaded.resources.food, 888, 'value round-trips through the city truth');
});

test('city formations are a plain slot array — no inner cityId keying survives', () => {
  // The double-keyed shape (cities[X].military.formations[X]) was the root of the
  // world-march 403: a key mismatch silently read as an empty formation. The owned
  // shape is a 3-slot array; legacy maps (including historically mis-keyed 'capital'
  // entries) migrate on read.
  const legacy = {
    playerId: 'shape-test',
    activeCityId: 'capital',
    military: {
      soldiers: 100,
      formations: {
        capital: [{ slot: 1, memberIds: [], soldierAssignments: {} }],
        site_ghost: [{ slot: 2, memberIds: [] }],
      },
    },
  };
  const state = gameStateService.normalizeState(legacy);
  const formations = CityService.getActiveCity(state).military.formations;

  assert.equal(Array.isArray(formations), true, 'owned shape is an array');
  assert.equal(formations.length, 3, 'always exactly 3 slots');
  assert.deepEqual(
    formations.map((f) => f.slot),
    [1, 2, 3],
  );
  for (const city of Object.values(state.cities)) {
    assert.equal(
      Array.isArray(city.military.formations),
      true,
      `city ${city.id} carries only its own slots`,
    );
  }
});
