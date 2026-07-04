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
  const { safeRadiusFromCapital } = WorldCampConfig.PLACEMENT;
  const camps = WorldCampSpawner.planCamps(SEED, CAPITAL);
  for (const camp of camps) {
    const ring = Math.max(Math.abs(camp.q - CAPITAL.q), Math.abs(camp.r - CAPITAL.r));
    assert.ok(
      ring > safeRadiusFromCapital,
      `camp ring ${ring} is inside safe radius ${safeRadiusFromCapital}`,
    );
  }
});

test('planCamps honors the maxCamps cap', () => {
  // Force every candidate to pass the density gate so the cap is the only limiter.
  const camps = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  assert.equal(camps.length, WorldCampConfig.PLACEMENT.maxCamps);
});

test('planCamps enforces minimum Chebyshev spacing between camps', () => {
  const minSpacing = 3;
  const camps = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    densityRoll: 1,
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
    densityRoll: 1,
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
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  });
  assert.ok(dense.length > 0, 'expected camps to place before occupancy filter');
  const occupiedTileIds = new Set([dense[0].tileId]);
  const filtered = WorldCampSpawner.planCamps(SEED, CAPITAL, {
    densityRoll: 1,
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

function createSeededState() {
  return {
    worldMap: { seed: SEED, origin: { q: 0, r: 0 } },
    territories: [{ id: 'capital', q: 0, r: 0 }],
    worldCombat: { encounters: [] },
  };
}

test('seedCampEncounters is idempotent: a second call does not duplicate camps', () => {
  const state = createSeededState();
  const now = new Date('2026-07-05T00:00:00.000Z');
  WorldCampSpawner.seedCampEncounters(state, now);
  const firstCount = state.worldCombat.encounters.length;
  assert.ok(firstCount > 0, 'expected camps to be seeded');
  WorldCampSpawner.seedCampEncounters(state, now);
  assert.equal(
    state.worldCombat.encounters.length,
    firstCount,
    'second seed must not add duplicates',
  );
  const ids = state.worldCombat.encounters.map((encounter) => encounter.id);
  assert.equal(new Set(ids).size, ids.length, 'camp ids must be unique');
});

test('seedCampEncounters does not overwrite the live progress of an existing camp', () => {
  const state = createSeededState();
  const now = new Date('2026-07-05T00:00:00.000Z');
  WorldCampSpawner.seedCampEncounters(state, now);
  const target = state.worldCombat.encounters[0];
  // Simulate a resolved camp mid-cooldown.
  target.status = 'resolved';
  target.resolvedAt = now.toISOString();
  target.respawnAt = new Date(now.getTime() + 60000).toISOString();
  target.defender.soldiers = 0;
  WorldCampSpawner.seedCampEncounters(state, now);
  const after = state.worldCombat.encounters.find((encounter) => encounter.id === target.id);
  assert.equal(after.status, 'resolved', 'resolved status must be preserved');
  assert.equal(after.respawnAt, target.respawnAt, 'respawnAt must be preserved');
  assert.equal(after.defender.soldiers, 0, 'depleted garrison must be preserved');
});

test('seedCampEncounters emits encounters carrying the camp passthrough fields', () => {
  const state = createSeededState();
  const now = new Date('2026-07-05T00:00:00.000Z');
  const encounters = WorldCampSpawner.seedCampEncounters(state, now);
  const camp = encounters.find((encounter) => encounter.campArchetypeKey);
  assert.ok(camp, 'expected at least one camp encounter');
  assert.equal(camp.kind, 'hostileForce');
  assert.equal(typeof camp.lootTable, 'object');
  assert.ok(camp.respawnCooldownMs > 0);
  assert.equal(camp.respawnAt, null);
  assert.ok(camp.defender.baseSoldiers > 0);
  assert.equal(camp.defender.soldiers, camp.defender.baseSoldiers);
});
