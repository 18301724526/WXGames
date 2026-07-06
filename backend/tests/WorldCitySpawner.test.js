const test = require('node:test');
const assert = require('node:assert/strict');

const WorldCitySpawner = require('../services/worldCombat/WorldCitySpawner');
const WorldCityConfig = require('../config/WorldCityConfig');
const WorldMapService = require('../services/WorldMapService');
const { isMarchBlockedTerrain } = require('../../shared/worldMarchCore');
const { SITE_ART } = require('../services/territory/TerritoryConstants');

// A fixed WORLD anchor (NOT any player capital) — the shared layout keys off this so every player
// sees the SAME cities (docs/design/10 §6-R3). Kept off world-origin to prove the anchor is honored.
const ANCHOR = { q: 40, r: -30 };
const SEED = 'city-spec-seed';

function chebyshevFromAnchor(city, anchor = ANCHOR) {
  return Math.max(Math.abs(city.q - anchor.q), Math.abs(city.r - anchor.r));
}

test('planCities is deterministic: same seed + anchor yields identical cities', () => {
  const first = WorldCitySpawner.planCities(SEED, ANCHOR);
  const second = WorldCitySpawner.planCities(SEED, ANCHOR);
  assert.deepEqual(first, second);
  assert.ok(first.length > 0, 'expected at least one city for the probe seed');
});

test('planCities is anchored on the world coord, not implicitly world-origin', () => {
  // A different anchor must produce a different layout (offset placement), proving planCities keys off
  // the passed world anchor rather than a hardcoded origin.
  const atAnchor = WorldCitySpawner.planCities(SEED, ANCHOR);
  const atOrigin = WorldCitySpawner.planCities(SEED, { q: 0, r: 0 });
  assert.notDeepEqual(atAnchor, atOrigin);
});

test('all placed cities are Chebyshev distance > safe band (3) from the anchor', () => {
  const { safeRadiusFromAnchor } = WorldCityConfig.PLACEMENT;
  assert.equal(safeRadiusFromAnchor, 3, 'safe radius must mirror garrison.json safe band (maxDistance 3)');
  const cities = WorldCitySpawner.planCities(SEED, ANCHOR);
  for (const city of cities) {
    const ring = chebyshevFromAnchor(city);
    assert.ok(
      ring > safeRadiusFromAnchor,
      `city ring ${ring} is inside the undefended safe radius ${safeRadiusFromAnchor}`,
    );
    // ring is stamped on the spec and must match the true Chebyshev distance from the anchor.
    assert.equal(city.ring, ring, 'stamped ring must equal Chebyshev distance from anchor');
  }
});

test('planCities places nothing in the safe band even if minRing is mis-tuned below it', () => {
  // Force minRing to 0: the safe-radius floor must still keep every city > safeRadius.
  const { safeRadiusFromAnchor } = WorldCityConfig.PLACEMENT;
  const cities = WorldCitySpawner.planCities(SEED, ANCHOR, {
    minRingFromAnchor: 0,
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  for (const city of cities) {
    assert.ok(
      chebyshevFromAnchor(city) > safeRadiusFromAnchor,
      'safe-band floor must hold regardless of minRing',
    );
  }
});

test('planCities never places a city on march-blocked (water) terrain', () => {
  const cities = WorldCitySpawner.planCities(SEED, ANCHOR);
  for (const city of cities) {
    const terrain = WorldMapService.chooseTerrain(SEED, city.q, city.r);
    assert.equal(
      isMarchBlockedTerrain(terrain),
      false,
      `city at ${city.q},${city.r} sits on ${terrain}`,
    );
  }
});

test('planCities skips a seeded march-blocked tile', () => {
  // Blank all terrain to plains except one target tile which we force to a blocked terrain; assert no
  // city lands there while cities still place elsewhere.
  const blockedQ = ANCHOR.q + 4;
  const blockedR = ANCHOR.r; // ring 4 — inside the placement band
  const chooseTerrain = (seed, q, r) =>
    q === blockedQ && r === blockedR ? 'ocean' : 'plains';
  const cities = WorldCitySpawner.planCities(SEED, ANCHOR, {
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain,
  });
  assert.ok(cities.length > 0, 'expected cities to place on the plains fill');
  assert.equal(
    cities.some((city) => city.q === blockedQ && city.r === blockedR),
    false,
    'no city may sit on the seeded ocean tile',
  );
});

test('planCities honors the maxCities cap', () => {
  const cities = WorldCitySpawner.planCities(SEED, ANCHOR, {
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  assert.equal(cities.length, WorldCityConfig.PLACEMENT.maxCities);
});

test('planCities enforces minimum Chebyshev spacing between cities', () => {
  const minSpacing = WorldCityConfig.PLACEMENT.minSpacing;
  const cities = WorldCitySpawner.planCities(SEED, ANCHOR, {
    densityRoll: 1,
    minSpacing,
    chooseTerrain: () => 'plains',
  });
  for (let i = 0; i < cities.length; i += 1) {
    for (let j = i + 1; j < cities.length; j += 1) {
      const dist = Math.max(
        Math.abs(cities[i].q - cities[j].q),
        Math.abs(cities[i].r - cities[j].r),
      );
      assert.ok(dist >= minSpacing, `cities ${i} and ${j} are ${dist} apart (< ${minSpacing})`);
    }
  }
});

test('planCities avoids pre-occupied (reserved) tiles', () => {
  const dense = WorldCitySpawner.planCities(SEED, ANCHOR, {
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  assert.ok(dense.length > 0, 'expected cities to place before occupancy filter');
  const reservedTileId = dense[0].tileId;
  const occupiedTileIds = new Set([reservedTileId]);
  const filtered = WorldCitySpawner.planCities(SEED, ANCHOR, {
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
    occupiedTileIds,
  });
  assert.equal(
    filtered.some((city) => city.tileId === reservedTileId),
    false,
    'reserved tile should not receive a city',
  );
});

test('planCities applies the near→far archetype gradient by ring band', () => {
  const cities = WorldCitySpawner.planCities(SEED, ANCHOR, {
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  for (const city of cities) {
    const archetype = WorldCityConfig.getArchetypeForRing(city.ring);
    assert.equal(city.archetypeKey, archetype.key);
    assert.equal(city.type, archetype.type);
    assert.equal(city.scale, archetype.scale);
  }
});

test('every emitted city is raw neutral territory with a valid SITE_ART type + no derived fields', () => {
  const cities = WorldCitySpawner.planCities(SEED, ANCHOR);
  assert.ok(cities.length > 0);
  for (const city of cities) {
    // Position — never world-origin (normalizeTerritory drops x===0 && y===0).
    assert.equal(typeof city.x, 'number');
    assert.equal(typeof city.y, 'number');
    assert.ok(!(city.x === 0 && city.y === 0), 'a city must not sit on world-origin');
    assert.equal(city.x, city.q);
    assert.equal(city.y, city.r);
    // Identity — site_<q>_<r>, never the reserved 'capital' id.
    assert.equal(city.id, `site_${city.q}_${city.r}`);
    assert.notEqual(city.id, 'capital');
    // Owner / type / status.
    assert.equal(city.owner, 'neutral');
    assert.ok(SITE_ART[city.type], `type '${city.type}' must be a SITE_ART key`);
    assert.equal(city.status, 'discovered');
    assert.ok(typeof city.naturalName === 'string' && city.naturalName.length > 0);
    assert.ok(Number.isInteger(city.scale) && city.scale >= 1);
    // Derived-downstream fields must NOT be authored (normalizeTerritory re-derives them; §4-4).
    assert.equal('garrison' in city, false, 'raw city must NOT author garrison');
    assert.equal('defenderLeader' in city, false, 'raw city must NOT author defenderLeader');
    assert.equal('capitalDistance' in city, false, 'raw city must NOT author capitalDistance');
    assert.equal('battleTarget' in city, false, 'raw city must NOT author battleTarget');
  }
});

test('toRawTerritory yields exactly the raw store shape (position/owner/type/status/scale/names)', () => {
  const [spec] = WorldCitySpawner.planCities(SEED, ANCHOR);
  const raw = WorldCitySpawner.toRawTerritory(spec);
  assert.deepEqual(Object.keys(raw).sort(), [
    'id',
    'mapTerrain',
    'naturalName',
    'owner',
    'scale',
    'status',
    'type',
    'x',
    'y',
  ]);
  assert.equal(raw.owner, 'neutral');
  assert.ok(SITE_ART[raw.type]);
  // No derived fields leak through the store-shape projection.
  assert.equal('garrison' in raw, false);
  assert.equal('capitalDistance' in raw, false);
});

test('planCitiesForState is idempotent: a second call does not duplicate cities', () => {
  const first = WorldCitySpawner.planCitiesForState(SEED, ANCHOR, []);
  assert.ok(first.length > 0, 'expected cities to be seeded');
  const second = WorldCitySpawner.planCitiesForState(SEED, ANCHOR, first);
  assert.equal(second.length, first.length, 'second seed must not add duplicates');
  const ids = second.map((territory) => territory.id);
  assert.equal(new Set(ids).size, ids.length, 'city ids must be unique');
});

test('planCitiesForState never overwrites an existing entry and preserves foreign territories', () => {
  const capital = { id: 'capital', x: 0, y: 0, owner: 'player' };
  const seeded = WorldCitySpawner.planCitiesForState(SEED, ANCHOR, [capital]);
  // Capital survives; cities are appended as raw territories.
  assert.ok(seeded.some((territory) => territory.id === 'capital'));
  const cityCount = seeded.filter((t) => t.id.startsWith('site_')).length;
  assert.ok(cityCount > 0);
  // Mutate a seeded city, then re-run: the short-circuit must keep it untouched.
  const target = seeded.find((t) => t.id.startsWith('site_'));
  target.owner = 'player';
  target.status = 'occupied';
  const again = WorldCitySpawner.planCitiesForState(SEED, ANCHOR, seeded);
  const after = again.find((t) => t.id === target.id);
  assert.equal(after.owner, 'player', 'existing city ownership must be preserved');
  assert.equal(after.status, 'occupied', 'existing city status must be preserved');
});
