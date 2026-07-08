const test = require('node:test');
const assert = require('node:assert/strict');

const WorldCampSpawner = require('../services/worldCombat/WorldCampSpawner');
const WorldCampConfig = require('../config/WorldCampConfig');
const WorldMapService = require('../services/WorldMapService');
const { isMarchBlockedTerrain } = require('../../shared/worldMarchCore');

const CAPITAL = { q: 0, r: 0 };
const SEED = 'camp-spec-seed';

test('planCamps is deterministic: same seed + capital yields identical camps', () => {
  const first = WorldCampSpawner.planCamps(SEED, CAPITAL);
  const second = WorldCampSpawner.planCamps(SEED, CAPITAL);
  assert.deepEqual(first, second);
  assert.ok(first.length > 0, 'expected at least one camp for the probe seed');
});

test('planCamps never places a camp on march-blocked (water) terrain', () => {
  const camps = WorldCampSpawner.planCamps(SEED, CAPITAL);
  for (const camp of camps) {
    const terrain = WorldMapService.chooseTerrain(SEED, camp.q, camp.r);
    assert.equal(
      isMarchBlockedTerrain(terrain),
      false,
      `camp at ${camp.q},${camp.r} sits on ${terrain}`,
    );
  }
});

test('planCamps keeps camps outside the capital safe ring', () => {
  const { safeRadiusFromActivity } = WorldCampConfig.PLACEMENT;
  const camps = WorldCampSpawner.planCamps(SEED, CAPITAL);
  for (const camp of camps) {
    const ring = Math.max(Math.abs(camp.q - CAPITAL.q), Math.abs(camp.r - CAPITAL.r));
    assert.ok(
      ring > safeRadiusFromActivity,
      `camp ring ${ring} is inside safe radius ${safeRadiusFromActivity}`,
    );
  }
});

test('planCamps honors per-region ring-band budgets', () => {
  const targetCount = WorldCampConfig.PLACEMENT.ringBands
    .reduce((sum, band) => sum + band.targetCamps, 0);
  const camps = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  assert.equal(camps.length, targetCount);
  for (const band of WorldCampConfig.PLACEMENT.ringBands) {
    const inBand = camps.filter((camp) => camp.ring >= band.minRing && camp.ring <= band.maxRing);
    assert.equal(inBand.length, band.targetCamps);
  }
});

test('planCampsForActivitySources shares a region and grows across distant activity', () => {
  const options = {
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  };
  const oneRegion = WorldCampSpawner.planCampsForActivitySources(SEED, [{ q: 0, r: 0 }], options);
  const sameRegion = WorldCampSpawner.planCampsForActivitySources(SEED, [
    { q: 0, r: 0 },
    { q: 3, r: 3 },
  ], options);
  const distantRegions = WorldCampSpawner.planCampsForActivitySources(SEED, [
    { q: 0, r: 0 },
    { q: 32, r: 0 },
  ], options);

  assert.deepEqual(sameRegion.map((camp) => camp.id), oneRegion.map((camp) => camp.id));
  assert.ok(distantRegions.length > oneRegion.length);
  assert.equal(new Set(distantRegions.map((camp) => camp.id)).size, distantRegions.length);
});

test('planCamps enforces minimum Chebyshev spacing between camps', () => {
  const minSpacing = 3;
  const camps = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    minSpacing,
    chooseTerrain: () => 'plains',
  });
  for (let i = 0; i < camps.length; i += 1) {
    for (let j = i + 1; j < camps.length; j += 1) {
      const dist = Math.max(Math.abs(camps[i].q - camps[j].q), Math.abs(camps[i].r - camps[j].r));
      assert.ok(dist >= minSpacing, `camps ${i} and ${j} are ${dist} apart (< ${minSpacing})`);
    }
  }
});

test('planCamps applies the near-weak / far-strong garrison gradient', () => {
  const camps = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  for (const camp of camps) {
    const archetype = WorldCampConfig.getArchetypeForRing(camp.ring);
    assert.equal(camp.archetypeKey, archetype.key);
    assert.equal(camp.soldiers, archetype.soldiersBase + archetype.soldiersPerRing * camp.ring);
  }
});

test('planCamps avoids pre-occupied tiles', () => {
  const dense = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  assert.ok(dense.length > 0, 'expected camps to place before occupancy filter');
  const occupiedTileIds = new Set([dense[0].tileId]);
  const filtered = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    minSpacing: 1,
    chooseTerrain: () => 'plains',
    occupiedTileIds,
  });
  assert.equal(
    filtered.some((camp) => camp.tileId === dense[0].tileId),
    false,
    'occupied tile should not receive a camp',
  );
});

test('campSpecToEncounter emits shared encounter rows carrying the camp passthrough fields', () => {
  const now = new Date('2026-07-05T00:00:00.000Z');
  const spec = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  })[0];
  const camp = WorldCampSpawner.campSpecToEncounter(spec, now);
  assert.ok(camp, 'expected at least one camp encounter');
  assert.equal(camp.kind, 'hostileForce');
  assert.equal(typeof camp.lootTable, 'object');
  assert.ok(camp.respawnCooldownMs > 0);
  assert.equal(camp.respawnAt, null);
  assert.ok(camp.defender.baseSoldiers > 0);
  assert.equal(camp.defender.soldiers, camp.defender.baseSoldiers);
});
