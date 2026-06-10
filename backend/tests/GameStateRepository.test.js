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
  db.close();
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
    const visibleSharedSite = (spectatorReloaded.territories || []).find((site) => (
      site.id === sharedSite.id || (site.x === sharedSite.x && site.y === sharedSite.y)
    ));

    assert.ok(visibleSharedSite, 'Shared world ownership must not be trapped inside one player save.');
    assert.equal(visibleSharedSite.ownerPlayerId, ownerState.playerId);
    assert.equal(visibleSharedSite.status, 'occupied');
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
    assert.ok(repository.findByPlayerId(spectatorState.playerId).territories.some((site) => site.id === sharedSite.id));

    ownerState.territories = ownerState.territories.filter((site) => site.id !== sharedSite.id);
    repository.save(ownerState);
    const spectatorReloaded = repository.findByPlayerId(spectatorState.playerId);

    assert.equal(spectatorReloaded.territories.some((site) => site.id === sharedSite.id), false);
  } finally {
    db.close();
  }
});
