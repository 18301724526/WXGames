const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const GameStateRepository = require('../repositories/GameStateRepository');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const GameStateMigrationPipeline = require('../services/GameStateMigrationPipeline');
const WorldMapService = require('../services/WorldMapService');

test('GameStateRepository persists task progress with the game state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  const state = GameStateNormalizer.createInitialGameState('task-progress-repo-test');
  state.taskProgress.claimed.main_first_supplies = {
    claimedAt: '2026-06-05T00:00:00.000Z',
  };

  repository.save(state);
  const saved = repository.findByPlayerId('task-progress-repo-test');

  assert.deepEqual(saved.taskProgress.claimed.main_first_supplies, {
    claimedAt: '2026-06-05T00:00:00.000Z',
  });
  db.close();
});

test('GameStateRepository increments revision and rejects stale expected revisions', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const state = GameStateNormalizer.createInitialGameState('revision-repo-test');

    repository.save(state);
    assert.equal(state.revision, 1);

    state.resources.food += 10;
    repository.save(state);
    assert.equal(state.revision, 2);

    const staleState = { ...state, revision: 1, resources: { ...state.resources, food: 999 } };
    assert.throws(
      () => repository.save(staleState),
      (error) => error.code === 'GAME_STATE_REVISION_CONFLICT'
        && error.expectedRevision === 1
        && error.actualRevision === 2,
    );

    const saved = repository.findByPlayerId('revision-repo-test');
    assert.equal(saved.revision, 2);
    assert.notEqual(saved.resources.food, 999);
  } finally {
    db.close();
  }
});

test('GameStateRepository persists save metadata with the game state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  const state = GameStateNormalizer.createInitialGameState('save-metadata-repo-test');
  state.saveMetadata = GameStateMigrationPipeline.createSaveMetadata({
    schemaVersion: GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION,
    migrations: [{
      id: 'initialize-save-schema-v1',
      fromVersion: 0,
      toVersion: 1,
      migratedAt: '2026-06-08T00:00:00.000Z',
    }],
  });

  repository.save(state);
  const saved = repository.findByPlayerId('save-metadata-repo-test');

  assert.equal(saved.saveMetadata.schema, GameStateMigrationPipeline.SAVE_SCHEMA_NAME);
  assert.equal(saved.saveMetadata.schemaVersion, GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION);
  assert.equal(saved.saveMetadata.migrations[0].id, 'initialize-save-schema-v1');
  assert.equal(saved.saveMetadata.performanceCapacity.ok, true);
  assert.equal(saved.saveMetadata.performanceCapacity.meta.scope, 'save');
  db.close();
});

test('GameStateRepository records save performance capacity metadata', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const state = GameStateNormalizer.createInitialGameState('save-budget-repo-test');
    state.worldMap.tiles = Array.from({ length: 12 }, (_, index) => ({
      id: `tile_${index}`,
      q: index,
      r: -index,
    }));

    repository.save(state);
    const saved = repository.findByPlayerId('save-budget-repo-test');

    assert.equal(saved.saveMetadata.performanceCapacity.ok, true);
    assert.deepEqual(saved.saveMetadata.performanceCapacity.failedKeys, []);
    assert.equal(saved.saveMetadata.performanceCapacity.meta.playerId, 'save-budget-repo-test');
    assert.equal(saved.saveMetadata.performanceCapacity.failedChecks.length, 0);
  } finally {
    db.close();
  }
});

test('GameStateRepository persists world explorer missions with the game state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  const state = GameStateNormalizer.createInitialGameState('explore-mission-repo-test');
  state.exploreMissions = [{
    id: 'explore_random_1',
    status: 'active',
    route: [{ q: 1, r: 0, tileId: 'tile_1_0', revealed: false }],
    plannedTiles: [{ id: 'tile_1_0', q: 1, r: 0, terrain: 'plains' }],
    plannedSites: [{ siteId: 'site_1_0', tileId: 'tile_1_0', owner: 'neutral' }],
    formation: { cityId: 'capital', slot: 1, memberIds: ['fp-scout'] },
  }];

  repository.save(state);
  const saved = repository.findByPlayerId('explore-mission-repo-test');

  assert.equal(saved.exploreMissions.length, 1);
  assert.equal(saved.exploreMissions[0].id, 'explore_random_1');
  assert.equal(saved.exploreMissions[0].plannedTiles[0].id, 'tile_1_0');
  assert.equal(saved.exploreMissions[0].plannedSites[0].siteId, 'site_1_0');
  assert.equal(saved.exploreMissions[0].formation.memberIds[0], 'fp-scout');
  db.close();
});

test('GameStateRepository persists world AI exploration state with the game state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const state = GameStateNormalizer.createInitialGameState('world-ai-repo-test');
    state.worldAi = {
      schema: 'world-ai-explorer-v1',
      version: 1,
      explorers: [{
        id: 'ai-frontier-1',
        factionId: 'ai-frontier',
        position: { q: 12, r: -3, tileId: 'tile_12_-3', canonicalId: 'tile_12_1021' },
        revealedTileIds: ['tile_12_-3'],
        revealedCanonicalIds: ['tile_12_1021'],
        stepDurationMs: 15000,
        nextStepAt: '2026-06-06T00:00:15.000Z',
        startedAt: '2026-06-06T00:00:00.000Z',
        updatedAt: '2026-06-06T00:00:00.000Z',
      }],
      playerSyncedCanonicalIds: ['tile_1023_0'],
      lastAdvancedAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    };

    repository.save(state);
    const saved = repository.findByPlayerId('world-ai-repo-test');

    assert.deepEqual(saved.worldAi, state.worldAi);
  } finally {
    db.close();
  }
});

test('GameStateRepository commits first explored terrain globally and later explorers read the same tile', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-12T00:00:00.000Z');
    const first = GameStateNormalizer.createInitialGameState('world-first-explorer');
    const second = GameStateNormalizer.createInitialGameState('world-second-explorer');

    const firstTile = WorldMapService.revealTile(first, 9, 2, now, {
      terrain: 'forest',
      visibility: 'scouted',
      generationContext: {
        source: 'player-scout',
        playerId: first.playerId,
        direction: 'east',
        eventEpoch: 'calm',
        nearbyStateHash: 'frontier-a',
      },
    });
    const secondTile = WorldMapService.revealTile(second, 9, 2, now, {
      terrain: 'desert',
      visibility: 'scouted',
      generationContext: {
        source: 'player-scout',
        playerId: second.playerId,
        direction: 'west',
        eventEpoch: 'storm',
        nearbyStateHash: 'frontier-b',
      },
    });

    repository.save(first);
    repository.save(second);

    const firstReloaded = repository.findByPlayerId(first.playerId);
    const secondReloaded = repository.findByPlayerId(second.playerId);
    const canonicalId = firstTile.canonicalId || secondTile.canonicalId;
    const firstReloadedTile = firstReloaded.worldMap.tiles.find((tile) => tile.canonicalId === canonicalId);
    const secondReloadedTile = secondReloaded.worldMap.tiles.find((tile) => tile.canonicalId === canonicalId);
    const globalRows = db.prepare('SELECT canonicalId, tile, generationContext FROM global_world_tiles WHERE canonicalId = ?').all(canonicalId);

    assert.equal(globalRows.length, 1);
    assert.equal(JSON.parse(globalRows[0].tile).terrain, 'forest');
    assert.equal(JSON.parse(globalRows[0].generationContext).direction, 'east');
    assert.equal(firstReloadedTile.terrain, 'forest');
    assert.equal(secondReloadedTile.terrain, 'forest');
  } finally {
    db.close();
  }
});

test('GameStateRepository keeps global terrain hidden until a player gains visibility', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-12T00:00:00.000Z');
    const first = GameStateNormalizer.createInitialGameState('world-visible-owner');
    const spectator = GameStateNormalizer.createInitialGameState('world-hidden-spectator');
    const tile = WorldMapService.revealTile(first, 13, -4, now, {
      terrain: 'hills',
      visibility: 'scouted',
    });

    repository.save(first);
    repository.save(spectator);

    const spectatorReloaded = repository.findByPlayerId(spectator.playerId);

    assert.equal(
      spectatorReloaded.worldMap.tiles.some((item) => item.canonicalId === tile.canonicalId),
      false,
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM global_world_tiles WHERE canonicalId = ?').get(tile.canonicalId).count, 1);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM player_world_visibility WHERE playerId = ? AND canonicalId = ?')
        .get(spectator.playerId, tile.canonicalId).count,
      0,
    );
  } finally {
    db.close();
  }
});

test('GameStateRepository strips legacy hidden terrain instead of promoting it into global authority', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-12T00:00:00.000Z');
    const state = GameStateNormalizer.createInitialGameState('hidden-ai-prune-test');
    for (let index = 0; index < 120; index += 1) {
      WorldMapService.revealTile(state, 80 + index, 40, now, {
        terrain: index % 2 === 0 ? 'plains' : 'forest',
        visibility: 'hidden',
        visible: false,
        discoveredBy: 'ai-frontier',
      });
    }

    repository.save(state);
    const reloaded = repository.findByPlayerId(state.playerId);
    const storedWorldMap = JSON.parse(db.prepare('SELECT worldMap FROM game_states WHERE playerId = ?').get(state.playerId).worldMap);

    assert.equal(storedWorldMap.tiles.some((tile) => tile.visibility === 'hidden' || tile.visible === false), false);
    assert.equal(reloaded.worldMap.tiles.some((tile) => tile.visibility === 'hidden' || tile.visible === false), false);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM global_world_tiles WHERE firstDiscoveredBy = ?').get(state.playerId).count, 25);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM player_world_visibility WHERE playerId = ? AND visibility = ?')
        .get(state.playerId, 'hidden').count,
      0,
    );
  } finally {
    db.close();
  }
});

test('GameStateRepository keeps test1-scale AI hidden exploration out of the player save budget', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-12T00:00:00.000Z');
    const state = GameStateNormalizer.createInitialGameState('test1-scale-hidden-ai');
    state.worldMap.tiles = [
      ...state.worldMap.tiles,
      ...Array.from({ length: 2100 }, (_, index) => WorldMapService.createTile(
        state.worldMap.seed,
        100 + (index % 70),
        75 + Math.floor(index / 70),
        now,
        {
        terrain: index % 3 === 0 ? 'forest' : 'plains',
        visibility: 'hidden',
        visible: false,
        discoveredBy: 'ai-frontier',
        },
      )),
      WorldMapService.createTile(state.worldMap.seed, 9, 2, now, {
        terrain: 'hills',
        visibility: 'scouted',
      }),
    ];

    repository.save(state);
    const row = db.prepare('SELECT worldMap FROM game_states WHERE playerId = ?').get(state.playerId);
    const storedMap = JSON.parse(row.worldMap);
    const reloaded = repository.findByPlayerId(state.playerId);

    assert.equal(storedMap.tiles.length, 0);
    assert.equal(reloaded.worldMap.tiles.some((tile) => tile.visibility === 'hidden' || tile.visible === false), false);
    assert.equal(reloaded.worldMap.tiles.some((tile) => tile.canonicalId === 'tile_9_2'), true);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM global_world_tiles').get().count, 26);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM player_world_visibility WHERE playerId = ?').get(state.playerId).count < 40, true);
  } finally {
    db.close();
  }
});

test('GameStateRepository migrates legacy player worldMap tiles into global authority tables on init', () => {
  const db = new Database(':memory:');
  let repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-12T00:00:00.000Z');
    const state = GameStateNormalizer.createInitialGameState('legacy-world-map-migration');
    WorldMapService.revealTile(state, 15, 2, now, { terrain: 'forest', visibility: 'scouted' });
    repository.save(state);

    const legacyMap = {
      ...state.worldMap,
      tiles: [
        ...state.worldMap.tiles,
        WorldMapService.createTile(state.worldMap.seed, 16, 2, now, {
          terrain: 'hills',
          visibility: 'scouted',
        }),
        WorldMapService.createTile(state.worldMap.seed, 60, 60, now, {
          terrain: 'forest',
          visibility: 'hidden',
          visible: false,
        }),
      ],
    };
    db.prepare('UPDATE game_states SET worldMap = ? WHERE playerId = ?')
      .run(JSON.stringify(legacyMap), state.playerId);

    repository = new GameStateRepository(db);
    repository.init();
    const migratedRow = db.prepare('SELECT worldMap FROM game_states WHERE playerId = ?').get(state.playerId);
    const migratedMap = JSON.parse(migratedRow.worldMap);
    const reloaded = repository.findByPlayerId(state.playerId);

    assert.equal(migratedMap.tiles.length, 0);
    assert.equal(reloaded.worldMap.tiles.some((tile) => tile.canonicalId === 'tile_16_2' && tile.terrain === 'hills'), true);
    assert.equal(reloaded.worldMap.tiles.some((tile) => tile.canonicalId === 'tile_60_60'), false);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM global_world_tiles WHERE canonicalId = ?').get('tile_60_60').count, 0);
  } finally {
    db.close();
  }
});

test('GameStateRepository exposes shared world ownership across player saves', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-06T00:00:00.000Z');
    const ownerState = GameStateNormalizer.createInitialGameState('shared-world-owner');
    const spectatorState = GameStateNormalizer.createInitialGameState('shared-world-spectator');
    const sharedSite = {
      id: 'site_4_0',
      x: 4,
      y: 0,
      naturalName: 'Shared Frontier',
      type: 'town',
      owner: 'player',
      ownerPlayerId: ownerState.playerId,
      status: 'occupied',
    };

    ownerState.territories = [...ownerState.territories, sharedSite];
    WorldMapService.bindSiteToTile(ownerState, 4, 0, sharedSite.id, now, { visibility: 'controlled' });

    repository.save(ownerState);
    repository.save(spectatorState);
    const spectatorReloaded = repository.findByPlayerId(spectatorState.playerId);
    const projection = repository.getClientProjectionForPlayer(spectatorState.playerId);
    const visibleSharedSite = (projection.sharedWorldTerritories || []).find((site) => (
      site.id === sharedSite.id || (site.x === sharedSite.x && site.y === sharedSite.y)
    ));

    assert.ok(visibleSharedSite, 'Shared world ownership must not be trapped inside one player save.');
    assert.equal(visibleSharedSite.ownerPlayerId, ownerState.playerId);
    assert.equal(visibleSharedSite.status, 'occupied');
    assert.equal(spectatorReloaded.territories.some((site) => site.id === sharedSite.id), false);
  } finally {
    db.close();
  }
});

test('GameStateRepository canonical reads do not carry shared world projection fields', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const ownerState = GameStateNormalizer.createInitialGameState('shared-world-owner-canonical-read');
    const spectatorState = GameStateNormalizer.createInitialGameState('shared-world-spectator-canonical-read');
    const sharedSite = {
      id: 'site_canonical_read_1',
      x: 11,
      y: 0,
      naturalName: 'Canonical Boundary',
      type: 'town',
      owner: 'player',
      ownerPlayerId: ownerState.playerId,
      status: 'occupied',
    };

    ownerState.territories = [...ownerState.territories, sharedSite];
    repository.save(ownerState);
    repository.save(spectatorState);

    const spectatorReloaded = repository.findByPlayerId(spectatorState.playerId);

    assert.equal(Object.prototype.hasOwnProperty.call(spectatorReloaded, 'sharedWorldTerritories'), false);
    assert.equal(spectatorReloaded.territories.some((site) => site.id === sharedSite.id), false);

    const projection = repository.getClientProjectionForPlayer(spectatorState.playerId);
    assert.equal(projection.sharedWorldTerritories.some((site) => site.id === sharedSite.id), true);
  } finally {
    db.close();
  }
});

test('GameStateRepository removes stale shared world ownership for a player save', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const ownerState = GameStateNormalizer.createInitialGameState('shared-world-owner-clear');
    const spectatorState = GameStateNormalizer.createInitialGameState('shared-world-spectator-clear');
    const sharedSite = {
      id: 'site_5_0',
      x: 5,
      y: 0,
      naturalName: 'Retired Frontier',
      type: 'town',
      owner: 'player',
      ownerPlayerId: ownerState.playerId,
      status: 'occupied',
    };

    ownerState.territories = [...ownerState.territories, sharedSite];
    repository.save(ownerState);
    repository.save(spectatorState);
    assert.ok(repository.getClientProjectionForPlayer(spectatorState.playerId).sharedWorldTerritories.some((site) => site.id === sharedSite.id));

    ownerState.territories = ownerState.territories.filter((site) => site.id !== sharedSite.id);
    repository.save(ownerState);
    const projection = repository.getClientProjectionForPlayer(spectatorState.playerId);

    assert.equal(projection.sharedWorldTerritories.some((site) => site.id === sharedSite.id), false);
  } finally {
    db.close();
  }
});

test('GameStateRepository strips projection-only fields during canonical save', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const state = GameStateNormalizer.createInitialGameState('projection-field-save-strip');
    state.sharedWorldTerritories = [{
      id: 'site_projection_only_1',
      x: 12,
      y: 0,
      owner: 'player',
      ownerPlayerId: 'other-player',
      status: 'occupied',
    }];

    const saved = repository.save(state);
    const reloaded = repository.findByPlayerId(state.playerId);

    assert.equal(Object.prototype.hasOwnProperty.call(state, 'sharedWorldTerritories'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(saved, 'sharedWorldTerritories'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(reloaded, 'sharedWorldTerritories'), false);
  } finally {
    db.close();
  }
});

test('GameStateRepository rolls back shared world writes when atomic save fails', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const ownerState = GameStateNormalizer.createInitialGameState('shared-world-atomic-owner');
    const sharedSite = {
      id: 'site_atomic_1',
      x: 7,
      y: 0,
      type: 'town',
      owner: 'player',
      ownerPlayerId: ownerState.playerId,
      status: 'occupied',
    };
    ownerState.territories = [...ownerState.territories, sharedSite];

    repository.save(ownerState);
    assert.equal(repository.getSharedWorldTerritories().some((site) => site.id === sharedSite.id), true);

    ownerState.territories = ownerState.territories.map((site) => (
      site.id === sharedSite.id ? { ...site, id: 'site_atomic_2' } : site
    ));
    const originalWriteGameStateRow = repository.writeGameStateRow.bind(repository);
    repository.writeGameStateRow = (...args) => {
      originalWriteGameStateRow(...args);
      throw new Error('forced write failure');
    };

    assert.throws(() => repository.save(ownerState), /forced write failure/);
    const sharedIds = repository.getSharedWorldTerritories().map((site) => site.id);
    assert.deepEqual(sharedIds, ['site_atomic_1']);
  } finally {
    db.close();
  }
});

test('GameStateRepository resetPlayerState clears previous shared world ownership atomically', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const playerId = 'shared-world-reset-owner';
    const ownerState = GameStateNormalizer.createInitialGameState(playerId);
    const spectatorState = GameStateNormalizer.createInitialGameState('shared-world-reset-spectator');
    const sharedSite = {
      id: 'site_reset_1',
      x: 8,
      y: 0,
      type: 'town',
      owner: 'player',
      ownerPlayerId: playerId,
      status: 'occupied',
    };
    ownerState.territories = [...ownerState.territories, sharedSite];

    repository.save(ownerState);
    repository.save(spectatorState);
    assert.equal(repository.getClientProjectionForPlayer(spectatorState.playerId).sharedWorldTerritories.some((site) => site.id === sharedSite.id), true);

    const freshState = GameStateNormalizer.createInitialGameState(playerId);
    repository.resetPlayerState(playerId, freshState);
    const projection = repository.getClientProjectionForPlayer(spectatorState.playerId);

    assert.equal(freshState.revision, 1);
    assert.equal(projection.sharedWorldTerritories.some((site) => site.id === sharedSite.id), false);
  } finally {
    db.close();
  }
});

test('GameStateRepository keeps shared world territories out of player canonical saves', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const ownerState = GameStateNormalizer.createInitialGameState('shared-world-owner-isolated');
    const spectatorState = GameStateNormalizer.createInitialGameState('shared-world-spectator-isolated');
    const sharedSite = {
      id: 'site_isolated_1',
      x: 10,
      y: 0,
      naturalName: 'Isolated Frontier',
      type: 'town',
      owner: 'player',
      ownerPlayerId: ownerState.playerId,
      status: 'occupied',
      cityName: 'Frontier City',
    };

    ownerState.territories = [...ownerState.territories, sharedSite];
    repository.save(ownerState);
    repository.save(spectatorState);

    const spectatorReloaded = repository.findByPlayerId(spectatorState.playerId);
    assert.equal(spectatorReloaded.territories.some((site) => site.id === sharedSite.id), false);
    assert.equal(repository.getClientProjectionForPlayer(spectatorState.playerId).sharedWorldTerritories.some((site) => site.id === sharedSite.id), true);

    spectatorReloaded.resources.food += 1;
    repository.save(spectatorReloaded);

    const canonical = JSON.parse(db.prepare('SELECT territories FROM game_states WHERE playerId = ?').get(spectatorState.playerId).territories);
    assert.equal(canonical.some((site) => site.id === sharedSite.id), false);
    assert.equal(repository.findByPlayerId(spectatorState.playerId).territories.some((site) => site.id === sharedSite.id), false);
  } finally {
    db.close();
  }
});

test('GameStateRepository resetPlayerState clears previous player world visibility', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const playerId = 'world-visibility-reset-owner';
    const now = new Date('2026-06-12T00:00:00.000Z');
    const state = GameStateNormalizer.createInitialGameState(playerId);
    const exploredTile = WorldMapService.revealTile(state, 19, 3, now, {
      terrain: 'forest',
      visibility: 'scouted',
    });

    repository.save(state);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM player_world_visibility WHERE playerId = ? AND canonicalId = ?')
        .get(playerId, exploredTile.canonicalId).count,
      1,
    );

    const freshState = GameStateNormalizer.createInitialGameState(playerId);
    repository.resetPlayerState(playerId, freshState);
    const reloaded = repository.findByPlayerId(playerId);

    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM player_world_visibility WHERE playerId = ? AND canonicalId = ?')
        .get(playerId, exploredTile.canonicalId).count,
      0,
    );
    assert.equal(
      reloaded.worldMap.tiles.some((tile) => tile.canonicalId === exploredTile.canonicalId),
      false,
    );
    assert.equal(
      reloaded.worldMap.tiles.some((tile) => tile.canonicalId === 'tile_0_0' && tile.visibility === 'controlled'),
      true,
    );
  } finally {
    db.close();
  }
});
