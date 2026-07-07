const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { WorldCityRepository, WORLD_ANCHOR } = require('../repositories/WorldCityRepository');
const GameStateRepository = require('../repositories/GameStateRepository');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const GameStateService = require('../services/GameStateService');
const WorldMapService = require('../services/WorldMapService');
const WorldCitySpawner = require('../services/worldCombat/WorldCitySpawner');
const { DEFAULT_WORLD_SEED } = require('../services/worldMap/WorldMapConstants');

function freshCityRepo(options = {}) {
  const db = new Database(':memory:');
  const repo = new WorldCityRepository(db, { worldSeed: DEFAULT_WORLD_SEED, ...options });
  repo.init();
  return { db, repo };
}

test('WorldCityRepository upsert + getAll round-trips the raw neutral city (single source)', () => {
  const { db, repo } = freshCityRepo();
  try {
    const saved = repo.upsertCity({
      id: 'site_4_0',
      x: 4,
      y: 0,
      owner: 'neutral',
      type: 'town',
      status: 'discovered',
      scale: 1,
      naturalName: '河湾村镇',
    }, '2026-01-01T00:00:00.000Z');
    assert.equal(saved.id, 'site_4_0');

    const all = repo.getAllCities();
    assert.equal(all.length, 1);
    assert.equal(all[0].id, 'site_4_0');
    assert.equal(all[0].owner, 'neutral');
    assert.equal(all[0].naturalName, '河湾村镇');
    assert.equal(all[0].x, 4);
    assert.equal(all[0].y, 0);
  } finally {
    db.close();
  }
});

test('WorldCityRepository rejects owned cities (shared table stays world-authored neutral only)', () => {
  const { db, repo } = freshCityRepo();
  try {
    assert.throws(
      () => repo.upsertCity({ id: 'site_owned', x: 4, y: 0, owner: 'player', ownerPlayerId: 'p1' }),
      /shared_world_territories/,
    );
    assert.throws(() => repo.upsertCity({ x: 4, y: 0 }), /city\.id required/);
  } finally {
    db.close();
  }
});

test('WorldCityRepository ensureSeeded lays down the deterministic world-anchored layout', () => {
  const { db, repo } = freshCityRepo();
  try {
    const seeded = repo.ensureSeeded();
    assert.ok(seeded.length > 0, 'expected the seeder to place cities');

    // Placement is the pure WorldCitySpawner plan off the FIXED world anchor (0,0) — not a player
    // capital. The persisted set must equal that plan exactly (docs/design/10 §6-R3).
    const plan = WorldCitySpawner.planCities(DEFAULT_WORLD_SEED, WORLD_ANCHOR);
    assert.deepEqual(
      seeded.map((city) => city.id).sort(),
      plan.map((spec) => spec.id).sort(),
    );

    // Every city is neutral, world-authored (no owner), and authors NO derived combat fields
    // (garrison/capitalDistance/battleTarget are re-derived downstream — §4-4).
    for (const city of seeded) {
      assert.equal(city.owner, 'neutral');
      assert.ok(!city.ownerPlayerId);
      assert.ok(!city.garrison);
      assert.ok(!city.capitalDistance);
      assert.ok(!city.battleTarget);
    }
  } finally {
    db.close();
  }
});

test('WorldCityRepository ensureSeeded is idempotent (stable count, no write amplification)', () => {
  const { db, repo } = freshCityRepo();
  try {
    const first = repo.ensureSeeded();
    const count = first.length;
    assert.ok(count > 0);

    // Run the seeder N more times — the hasAny short-circuit keeps the set stable (§6-R8).
    for (let i = 0; i < 5; i += 1) {
      const again = repo.ensureSeeded();
      assert.equal(again.length, count);
    }
    assert.equal(repo.getAllCities().length, count);

    // The updatedAt column must not churn: a re-seed never re-writes existing rows.
    const before = db.prepare('SELECT id, updatedAt FROM world_cities ORDER BY id').all();
    repo.ensureSeeded();
    const after = db.prepare('SELECT id, updatedAt FROM world_cities ORDER BY id').all();
    assert.deepEqual(before, after);
  } finally {
    db.close();
  }
});

test('WorldCityRepository ensureSeeded avoids occupied tiles', () => {
  const { db, repo } = freshCityRepo();
  try {
    // Reserve one of the tiles the layout would otherwise occupy.
    const plan = WorldCitySpawner.planCities(DEFAULT_WORLD_SEED, WORLD_ANCHOR);
    const blockedId = plan[0].tileId;
    const seeded = repo.ensureSeeded({ occupiedTileIds: new Set([blockedId]) });
    const blockedCoordId = `tile_${plan[0].q}_${plan[0].r}`;
    assert.equal(
      seeded.some((city) => `tile_${city.x}_${city.y}` === blockedCoordId),
      false,
      'a reserved tile must not receive a city',
    );
  } finally {
    db.close();
  }
});

test('WorldCityRepository persists + reloads cities across a fresh repository instance (round-trip)', () => {
  const db = new Database(':memory:');
  try {
    const repo = new WorldCityRepository(db, { worldSeed: DEFAULT_WORLD_SEED });
    repo.init();
    const seeded = repo.ensureSeeded();
    assert.ok(seeded.length > 0);

    // A brand-new repository over the same DB reads the exact same set from the table.
    const reloadRepo = new WorldCityRepository(db, { worldSeed: DEFAULT_WORLD_SEED });
    reloadRepo.init();
    const reloaded = reloadRepo.getAllCities();
    assert.deepEqual(
      reloaded.map((city) => city.id).sort(),
      seeded.map((city) => city.id).sort(),
    );
  } finally {
    db.close();
  }
});

test('GameStateRepository seeds the shared neutral cities once at world init', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();
    const count = repository.worldCityRepo.getAllCities().length;
    assert.ok(count > 0, 'world init must seed the shared neutral cities');

    // Re-running init (a fresh repository over the same DB — the deploy re-open case) must not grow
    // or duplicate the shared set.
    const reopened = new GameStateRepository(db);
    reopened.init();
    assert.equal(reopened.worldCityRepo.getAllCities().length, count);
  } finally {
    db.close();
  }
});

test('GameStateRepository projects the SAME shared cities to two different players (single copy, not forked)', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();
    const playerA = GameStateNormalizer.createInitialGameState('shared-city-player-a', {
      spawn: { q: 22, r: 18, spawnKey: '22,18' },
    });
    const playerB = GameStateNormalizer.createInitialGameState('shared-city-player-b', {
      spawn: { q: -22, r: -18, spawnKey: '-22,-18' },
    });
    repository.save(playerA);
    repository.save(playerB);

    const neutralIds = (projection) => projection.sharedWorldTerritories
      .filter((site) => site.owner === 'neutral')
      .map((site) => site.id)
      .sort();

    const idsA = neutralIds(repository.getClientProjectionForPlayer('shared-city-player-a'));
    const idsB = neutralIds(repository.getClientProjectionForPlayer('shared-city-player-b'));

    assert.ok(idsA.length > 0);
    assert.deepEqual(idsA, idsB, 'both players must see the identical shared city set');
    assert.equal(idsA.length, repository.worldCityRepo.getAllCities().length);
  } finally {
    db.close();
  }
});

test('GameStateRepository keeps undiscovered neutral cities OUT of the client map DTO (no reveal-at-spawn)', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();
    const player = GameStateNormalizer.createInitialGameState('shared-city-hidden', {
      spawn: { q: 30, r: 30, spawnKey: '30,30' },
    });
    repository.save(player);

    const projection = repository.getClientProjectionForPlayer('shared-city-hidden');
    // planningContext (S4) still sees the FULL set — every neutral city.
    const fullNeutral = projection.sharedWorldTerritories.filter((site) => site.owner === 'neutral');
    assert.equal(fullNeutral.length, repository.worldCityRepo.getAllCities().length);

    const reloaded = repository.findByPlayerId('shared-city-hidden');
    const normalized = GameStateService.normalizeState(reloaded);
    const client = GameStateService.getClientGameStateFromNormalized(normalized, projection);
    const clientTerritories = client.territoryState.territories;

    // Nothing has been discovered yet, so NO neutral city appears in the client DTO or on the map.
    assert.equal(clientTerritories.some((site) => site.owner === 'neutral'), false);
    assert.equal(
      client.territoryState.worldMap.tiles.some((tile) => typeof tile.siteId === 'string' && tile.siteId.startsWith('site_')),
      false,
    );
  } finally {
    db.close();
  }
});

test('GameStateRepository reveals a shared neutral city in the client DTO once its tile is discovered', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();
    const target = repository.worldCityRepo.getAllCities()[0];
    assert.ok(target, 'expected a seeded city to target');

    const player = GameStateNormalizer.createInitialGameState('shared-city-reveal', {
      spawn: { q: 40, r: 40, spawnKey: '40,40' },
    });
    // Discovery is S4; here we simulate a player who has already gained tile visibility at the city
    // coordinate and assert the projection flips it visible through the SAME path.
    WorldMapService.revealTile(player, target.x, target.y, new Date(), { visibility: 'scouted' });
    repository.save(player);

    const projection = repository.getClientProjectionForPlayer('shared-city-reveal');
    const reloaded = repository.findByPlayerId('shared-city-reveal');
    const normalized = GameStateService.normalizeState(reloaded);
    const client = GameStateService.getClientGameStateFromNormalized(normalized, projection);
    const discovered = client.territoryState.territories.filter((site) => site.owner === 'neutral');

    assert.equal(discovered.length, 1, 'only the discovered neutral city appears');
    assert.equal(discovered[0].id, target.id);
  } finally {
    db.close();
  }
});

test('GameStateRepository shared-city seeding does not perturb the player-owned territory projection', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();

    const owner = GameStateNormalizer.createInitialGameState('owned-projection-owner', {
      spawn: { q: 50, r: 50, spawnKey: '50,50' },
    });
    const spectator = GameStateNormalizer.createInitialGameState('owned-projection-spectator', {
      spawn: { q: -50, r: -50, spawnKey: '-50,-50' },
    });
    const ownedSite = {
      id: 'site_owned_projection_1',
      x: 55,
      y: 55,
      type: 'town',
      owner: 'player',
      ownerPlayerId: owner.playerId,
      status: 'occupied',
    };
    owner.territories = [...owner.territories, ownedSite];
    repository.save(owner);
    repository.save(spectator);

    const projection = repository.getClientProjectionForPlayer(spectator.playerId);
    // The owned site of the OTHER player is still projected exactly as before (unchanged behavior).
    assert.equal(
      projection.sharedWorldTerritories.some((site) => site.id === ownedSite.id && site.ownerPlayerId === owner.playerId),
      true,
    );
    // The owner's own projection excludes their own owned site (pre-existing excludePlayerId behavior).
    const ownerProjection = repository.getClientProjectionForPlayer(owner.playerId);
    assert.equal(ownerProjection.sharedWorldTerritories.some((site) => site.id === ownedSite.id), false);
  } finally {
    db.close();
  }
});
