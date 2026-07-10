const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const GameStateRepository = require('../repositories/GameStateRepository');
const { createGlobalTilePayload } = require('../repositories/WorldMapAuthorityRepository');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const GameStateService = require('../services/GameStateService');
const GameStateMigrationPipeline = require('../services/GameStateMigrationPipeline');
const WorldMapService = require('../services/WorldMapService');
const WorldMapTiles = require('../services/worldMap/WorldMapTiles');

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

test('GameStateRepository persists captureDecisions (②b) with the game state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  const state = GameStateNormalizer.createInitialGameState('capture-decisions-repo-test');
  state.captureDecisions = [{
    id: 'cap_1_t_5_5', territoryId: 't_5_5', territoryName: '林城',
    captive: { id: 'df_1', name: '林烈' }, recruitChance: 0.42, seed: 's', status: 'pending', createdAt: '2026-07-06T00:00:00.000Z',
  }];

  repository.save(state);
  const saved = repository.findByPlayerId('capture-decisions-repo-test');
  assert.equal(saved.captureDecisions.length, 1);
  assert.equal(saved.captureDecisions[0].id, 'cap_1_t_5_5');
  assert.equal(saved.captureDecisions[0].captive.name, '林烈');
  assert.equal(saved.captureDecisions[0].status, 'pending');
  db.close();
});

test('GameStateRepository records schema migration ledger during init', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();

    const rows = db.prepare('SELECT id, status FROM schema_migrations ORDER BY id').all();
    assert.deepEqual(rows, [
      { id: '001-game-states-compat-columns', status: 'applied' },
      { id: '002-capture-decisions-column', status: 'applied' },
      { id: '003-owner-locks-generalization', status: 'applied' },
      { id: '004-command-idempotency-store', status: 'applied' },
    ]);

    const secondRepository = new GameStateRepository(db);
    secondRepository.init();
    const count = db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count;
    assert.equal(count, 4);
  } finally {
    db.close();
  }
});

test('GameStateRepository init and encounter planning do not materialize shared encounters', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();

    const countEncounters = () => db
      .prepare('SELECT COUNT(*) AS count FROM world_encounters')
      .get().count;
    assert.equal(countEncounters(), 0);
    repository.save(GameStateNormalizer.createInitialGameState('encounter-planning-activity-source'));
    assert.ok(repository.planWorldEncounters().length > 0);
    assert.equal(countEncounters(), 0);

    const secondRepository = new GameStateRepository(db);
    secondRepository.init();
    assert.equal(countEncounters(), 0);
  } finally {
    db.close();
  }
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

test('GameStateRepository commits player and shared command mutations atomically', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  try {
    const playerId = 'command-shared-atomic';
    repository.save(GameStateService.createInitialGameState(playerId));
    const state = repository.findByPlayerId(playerId);
    state.happiness = 77;
    const encounter = {
      id: 'command-shared-encounter',
      q: 3,
      r: -1,
      status: 'active',
      defender: { soldiers: 10 },
    };

    assert.throws(() => repository.commitCommandState(state, {
      encounters: [{ encounter, now: '2026-07-10T01:00:00.000Z' }],
      people: [{
        person: { id: 'invalid-player-person', factionId: `player_${playerId}` },
        now: '2026-07-10T01:00:00.000Z',
      }],
    }), /player-owned people live in game_states/);
    assert.equal(repository.findByPlayerId(playerId).revision, 1);
    assert.equal(repository.findByPlayerId(playerId).happiness, 100);
    assert.equal(repository.worldEncounterRepo.getEncounter(
      encounter.id,
      { refreshRespawns: false },
    ), null);

    const committed = repository.commitCommandState(state, {
      encounters: [{ encounter, now: '2026-07-10T01:00:00.000Z' }],
    });
    assert.equal(committed.savedState.revision, 2);
    assert.equal(committed.shared.encounterCount, 1);
    assert.equal(repository.findByPlayerId(playerId).happiness, 77);
    assert.equal(repository.worldEncounterRepo.getEncounter(
      encounter.id,
      { refreshRespawns: false },
    ).status, 'active');
  } finally {
    db.close();
  }
});

test('GameStateRepository commits multiple owner-locked player states atomically', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  try {
    repository.save(GameStateService.createInitialGameState('social-player-a'));
    repository.save(GameStateService.createInitialGameState('social-player-b'));
    const stateA = repository.findByPlayerId('social-player-a');
    const stateB = repository.findByPlayerId('social-player-b');
    stateA.happiness = 71;
    stateB.happiness = 72;

    const committed = repository.commitCommandState(null, {
      playerStates: [{ state: stateA }, { state: stateB }],
    }, {
      persistState: false,
      ownerKeys: ['player:social-player-a', 'player:social-player-b'],
    });

    assert.equal(committed.savedState, null);
    assert.equal(committed.shared.playerStateCount, 2);
    assert.equal(repository.findByPlayerId('social-player-a').happiness, 71);
    assert.equal(repository.findByPlayerId('social-player-b').happiness, 72);
    assert.equal(repository.findByPlayerId('social-player-a').revision, 2);
    assert.equal(repository.findByPlayerId('social-player-b').revision, 2);
  } finally {
    db.close();
  }
});

test('GameStateRepository serializes player state locks across repository instances', () => {
  const db = new Database(':memory:');
  const firstRepository = new GameStateRepository(db);
  firstRepository.init();
  const secondRepository = new GameStateRepository(db);
  secondRepository.init();

  try {
    firstRepository.withPlayerStateLock('locked-player', () => {
      let entered = false;
      assert.throws(
        () => secondRepository.withPlayerStateLock('locked-player', () => {
          entered = true;
        }, { scope: 'test-contender', waitMs: 0 }),
        (error) => error.code === 'OWNER_LOCK_TIMEOUT'
          && error.ownerKey === 'player:locked-player'
          && error.playerId === 'locked-player',
      );
      assert.equal(entered, false);
    }, { scope: 'test-held-lock', waitMs: 0, ttlMs: 60000 });

    const result = secondRepository.withPlayerStateLock(
      'locked-player',
      () => 'acquired-after-release',
      { scope: 'test-after-release', waitMs: 0 },
    );
    assert.equal(result, 'acquired-after-release');
  } finally {
    db.close();
  }
});

test('GameStateRepository migrates legacy player lock rows and retires the old table', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE player_state_locks (
      playerId TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      scope TEXT,
      lockedAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL
    );
  `);
  db.prepare(`
    INSERT INTO player_state_locks (playerId, ownerId, scope, lockedAt, expiresAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'legacy-player',
    'legacy-holder',
    'legacy-scope',
    '2026-07-10T00:00:00.000Z',
    '2099-07-10T00:00:00.000Z',
  );

  try {
    const repository = new GameStateRepository(db);
    repository.init();
    assert.deepEqual(
      db.prepare('SELECT ownerKey, holderId, scope FROM owner_locks').get(),
      {
        ownerKey: 'player:legacy-player',
        holderId: 'legacy-holder',
        scope: 'legacy-scope',
      },
    );
    assert.equal(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'player_state_locks'").get(),
      undefined,
    );
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

test('GameStateRepository persists world march verification report state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const state = GameStateNormalizer.createInitialGameState('march-verification-repo-test');
    state.worldMarchClientReports = {
      schema: 'world-march-client-report-batch-v1',
      missions: {
        'march-1': {
          missionId: 'march-1',
          position: { q: 1.25, r: 0, tileId: 'tile_1_0' },
        },
      },
    };
    state.worldMarchVerification = {
      schema: 'world-march-verification-summary-v1',
      status: 'pullback',
      results: [{ missionId: 'march-1', severity: 'large', diffTiles: 4 }],
    };

    repository.save(state);
    const saved = repository.findByPlayerId('march-verification-repo-test');

    assert.equal(saved.worldMarchClientReports.missions['march-1'].position.q, 1.25);
    assert.equal(saved.worldMarchVerification.status, 'pullback');
    assert.equal(saved.worldMarchVerification.results[0].severity, 'large');
  } finally {
    db.close();
  }
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

test('GameStateRepository derives global world tile payload identity from coordinates', () => {
  const payload = createGlobalTilePayload({
    id: 'legacy-global-tile-id',
    q: 6,
    r: -4,
    terrain: 'forest',
    visibility: 'scouted',
  });

  assert.equal(payload.id, 'tile_6_-4');
  assert.equal(payload.q, 6);
  assert.equal(payload.r, -4);

  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const state = GameStateNormalizer.createInitialGameState('global-payload-coordinate-id');
    state.worldMap.tiles = [{
      id: 'legacy-global-tile-id',
      q: 6,
      r: -4,
      terrain: 'forest',
      visibility: 'scouted',
    }];

    repository.save(state);

    const row = db.prepare('SELECT tile FROM global_world_tiles WHERE canonicalId = ?')
      .get(WorldMapService.getCanonicalTileId(6, -4));
    const storedTile = JSON.parse(row.tile);
    const reloaded = repository.findByPlayerId(state.playerId);

    assert.equal(storedTile.id, 'tile_6_-4');
    assert.equal(storedTile.q, 6);
    assert.equal(storedTile.r, -4);
    assert.equal(reloaded.worldMap.tiles.some((tile) => tile.id === 'legacy-global-tile-id'), false);
    assert.equal(reloaded.worldMap.tiles.some((tile) => tile.id === 'tile_6_-4'), true);
  } finally {
    db.close();
  }
});

test('GameStateRepository preserves authoritative empty world tile transition keys', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-12T00:00:00.000Z');
    const state = GameStateNormalizer.createInitialGameState('global-empty-transition-key');
    const transitionTile = WorldMapService.createTile('architecture-transition-seed', -10, -1, now, {
      terrain: 'plains',
      visibility: 'scouted',
      transitionKey: '',
    });
    state.worldMap = {
      ...state.worldMap,
      seed: 'architecture-transition-seed',
      tiles: [transitionTile],
    };

    repository.save(state);

    const row = db.prepare('SELECT tile FROM global_world_tiles WHERE canonicalId = ?')
      .get(WorldMapService.getCanonicalTileId(-10, -1));
    const storedTile = JSON.parse(row.tile);
    const reloaded = repository.findByPlayerId(state.playerId);
    const reloadedTile = reloaded.worldMap.tiles.find((tile) => tile.canonicalId === transitionTile.canonicalId);

    assert.equal(WorldMapTiles.getTerrainTransitionKey('architecture-transition-seed', -10, -1, 'plains'), 'se');
    assert.equal(storedTile.transitionKey, '');
    assert.equal(reloadedTile.transitionKey, '');
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

test('GameStateRepository preserves fog vision history while sanitizing saved tiles', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-12T00:00:00.000Z');
    const state = GameStateNormalizer.createInitialGameState('vision-history-repo-test', { now });
    WorldMapService.recordVisionPath(state, { q: 0, r: 0 }, { q: 1, r: 0 }, now, { kind: 'unit' });

    repository.save(state);

    const row = db.prepare('SELECT worldMap FROM game_states WHERE playerId = ?').get(state.playerId);
    const storedMap = JSON.parse(row.worldMap);
    const reloaded = repository.findByPlayerId(state.playerId);

    assert.equal(storedMap.tiles.length, 0);
    assert.equal(storedMap.visionHistory.schema, 'world-fog-vision-history-v1');
    assert.equal(storedMap.visionHistory.sources.some((source) => source.kind === 'unit' && source.q > 0 && source.q < 1), true);
    assert.equal(reloaded.worldMap.visionHistory.sources.some((source) => source.kind === 'unit' && source.q > 0 && source.q < 1), true);
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

test('GameStateRepository command saves only synchronize territory owners that were locked', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const playerId = 'shared-world-scoped-save';
    const state = GameStateNormalizer.createInitialGameState(playerId);
    const territoryId = 'site_scoped_save_1';
    state.territories = [...state.territories, {
      id: territoryId,
      x: 6,
      y: 1,
      type: 'town',
      owner: 'player',
      ownerPlayerId: playerId,
      status: 'occupied',
      cityName: 'Initial Name',
    }];
    repository.save(state);

    const stalePlayerState = repository.findByPlayerId(playerId);
    const canonicalState = repository.findByPlayerId(playerId);
    canonicalState.territories.find((territory) => territory.id === territoryId).cityName = 'Canonical Name';
    repository.save(canonicalState);

    stalePlayerState.revision = canonicalState.revision;
    stalePlayerState.happiness = 88;
    repository.save(stalePlayerState, { ownerKeys: [`player:${playerId}`] });
    assert.equal(repository.getSharedWorldTerritory(territoryId).cityName, 'Canonical Name');

    stalePlayerState.territories.find((territory) => territory.id === territoryId).cityName = 'Authorized Name';
    repository.save(stalePlayerState, {
      ownerKeys: [
        `player:${playerId}`,
        `territory-owner:${playerId}`,
        `territory:${territoryId}`,
      ],
    });
    assert.equal(repository.getSharedWorldTerritory(territoryId).cityName, 'Authorized Name');
  } finally {
    db.close();
  }
});

test('GameStateRepository territory transfers require previous and next owner collection locks', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const territoryId = 'site_owner_transfer_lock';
    const previousOwnerId = 'territory-transfer-previous';
    const nextOwnerId = 'territory-transfer-next';
    const previousState = GameStateNormalizer.createInitialGameState(previousOwnerId);
    previousState.territories = [...previousState.territories, {
      id: territoryId,
      x: 7,
      y: 2,
      type: 'town',
      owner: 'player',
      ownerPlayerId: previousOwnerId,
      status: 'occupied',
    }];
    repository.save(previousState);

    const nextState = GameStateNormalizer.createInitialGameState(nextOwnerId);
    nextState.territories = [...nextState.territories, {
      id: territoryId,
      x: 7,
      y: 2,
      type: 'town',
      owner: 'player',
      ownerPlayerId: nextOwnerId,
      status: 'occupied',
    }];
    assert.throws(
      () => repository.save(nextState, {
        ownerKeys: [
          `player:${nextOwnerId}`,
          `territory-owner:${nextOwnerId}`,
          `territory:${territoryId}`,
        ],
      }),
      (error) => (
        error?.code === 'COMMAND_SHARED_MUTATION_OWNER_NOT_LOCKED'
        && error.missingOwnerKeys?.includes(`territory-owner:${previousOwnerId}`)
      ),
    );
    assert.equal(repository.getSharedWorldTerritory(territoryId).ownerPlayerId, previousOwnerId);
    assert.equal(repository.findByPlayerId(nextOwnerId), null);

    repository.save(nextState, {
      ownerKeys: [
        `player:${nextOwnerId}`,
        `territory-owner:${previousOwnerId}`,
        `territory-owner:${nextOwnerId}`,
        `territory:${territoryId}`,
      ],
    });
    assert.equal(repository.getSharedWorldTerritory(territoryId).ownerPlayerId, nextOwnerId);
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

test('GameStateRepository command reset requires player and territory collection locks', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const playerId = 'shared-world-reset-locks';
    repository.save(GameStateNormalizer.createInitialGameState(playerId));

    assert.throws(
      () => repository.resetPlayerState(
        playerId,
        GameStateNormalizer.createInitialGameState(playerId),
        { ownerKeys: [`territory-owner:${playerId}`] },
      ),
      (error) => (
        error?.code === 'COMMAND_SHARED_MUTATION_OWNER_NOT_LOCKED'
        && error.missingOwnerKeys?.includes(`player:${playerId}`)
      ),
    );
    assert.throws(
      () => repository.resetPlayerState(
        playerId,
        GameStateNormalizer.createInitialGameState(playerId),
        { ownerKeys: [`player:${playerId}`] },
      ),
      (error) => (
        error?.code === 'COMMAND_SHARED_MUTATION_OWNER_NOT_LOCKED'
        && error.missingOwnerKeys?.includes(`territory-owner:${playerId}`)
      ),
    );
    assert.ok(repository.findByPlayerId(playerId));
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

test('GameStateRepository resetPlayerState persists the new spawn starting visibility', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const playerId = 'world-visibility-reset-spawn-owner';
    const now = new Date('2026-06-16T00:00:00.000Z');
    const state = GameStateNormalizer.createInitialGameState(playerId, { now });
    const exploredTile = WorldMapService.revealTile(state, 21, 5, now, {
      terrain: 'forest',
      visibility: 'scouted',
    });

    repository.save(state);

    const freshState = GameStateNormalizer.createInitialGameState(playerId, {
      now,
      spawn: { q: 18, r: -4, spawnKey: '18,-4' },
    });
    const savedState = repository.resetPlayerState(playerId, freshState);
    const reloaded = repository.findByPlayerId(playerId);
    const expectedTileIds = new Set(WorldMapService.getRevealArea(18, -4, WorldMapService.START_REVEAL_RADIUS)
      .map((coord) => WorldMapService.getCanonicalTileId(coord.q, coord.r)));
    const reloadedTileIds = new Set(reloaded.worldMap.tiles.map((tile) => tile.canonicalId));
    const capital = reloaded.territories.find((territory) => territory.id === 'capital');
    const capitalTile = reloaded.worldMap.tiles.find((tile) => tile.q === 18 && tile.r === -4);

    assert.deepEqual(savedState.worldMap.origin, { q: 18, r: -4 });
    assert.deepEqual(reloaded.worldMap.origin, { q: 18, r: -4 });
    assert.equal(savedState.worldMap.tiles.length, 25);
    assert.equal(reloaded.worldMap.tiles.length, 25);
    assert.deepEqual(reloadedTileIds, expectedTileIds);
    assert.equal(capital.x, 18);
    assert.equal(capital.y, -4);
    assert.equal(capitalTile.siteId, 'capital');
    assert.equal(capitalTile.visibility, 'controlled');
    assert.equal(
      reloaded.worldMap.tiles.some((tile) => tile.canonicalId === exploredTile.canonicalId),
      false,
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM player_world_visibility WHERE playerId = ?')
        .get(playerId).count,
      25,
    );
  } finally {
    db.close();
  }
});

test('GameStateRepository keeps other players capital identity out of shared global tiles', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-18T00:00:00.000Z');
    const firstPlayer = GameStateNormalizer.createInitialGameState('global-capital-owner', {
      now,
      spawn: { q: 23, r: 18, spawnKey: '23,18' },
    });
    repository.save(firstPlayer);

    const secondPlayer = GameStateNormalizer.createInitialGameState('global-capital-neighbor', {
      now,
      spawn: { q: 24, r: 16, spawnKey: '24,16' },
    });
    repository.save(secondPlayer);

    const globalTile = JSON.parse(db.prepare('SELECT tile FROM global_world_tiles WHERE canonicalId = ?')
      .get(WorldMapService.getCanonicalTileId(23, 18)).tile);
    const secondReloaded = repository.findByPlayerId(secondPlayer.playerId);
    const secondClient = GameStateService.getClientGameStateFromNormalized(
      GameStateService.normalizeState(secondReloaded),
    );
    const neighborTile = secondClient.territoryState.worldMap.tiles
      .find((tile) => tile.q === 23 && tile.r === 18);
    const secondCapitalTiles = secondClient.territoryState.worldMap.tiles
      .filter((tile) => tile.siteId === 'capital' || tile.terrain === 'capital');

    assert.equal(globalTile.siteId, undefined);
    assert.notEqual(globalTile.terrain, 'capital');
    assert.ok(neighborTile);
    assert.notEqual(neighborTile.siteId, 'capital');
    assert.notEqual(neighborTile.terrain, 'capital');
    assert.deepEqual(secondCapitalTiles.map((tile) => `${tile.q},${tile.r}`), ['24,16']);
    assert.equal(secondClient.territoryState.worldMap.tiles.length, 25);
  } finally {
    db.close();
  }
});

test('GameStateRepository hydrates legacy global capital pollution as local natural terrain', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-06-18T00:00:00.000Z');
    const player = GameStateNormalizer.createInitialGameState('legacy-global-capital-reader', {
      now,
      spawn: { q: 24, r: 16, spawnKey: '24,16' },
    });
    repository.save(player);
    const canonicalId = WorldMapService.getCanonicalTileId(23, 18);
    db.prepare('UPDATE global_world_tiles SET tile = ? WHERE canonicalId = ?')
      .run(JSON.stringify({
        id: 'tile_23_18',
        q: 23,
        r: 18,
        x: 23,
        y: 18,
        canonicalId,
        terrain: 'capital',
        siteId: 'capital',
      }), canonicalId);

    const reloaded = repository.findByPlayerId(player.playerId);
    const client = GameStateService.getClientGameStateFromNormalized(
      GameStateService.normalizeState(reloaded),
    );
    const repairedTile = client.territoryState.worldMap.tiles.find((tile) => tile.q === 23 && tile.r === 18);

    assert.ok(repairedTile);
    assert.notEqual(repairedTile.terrain, 'capital');
    assert.notEqual(repairedTile.siteId, 'capital');
    assert.equal(client.territoryState.worldMap.tiles.length, 25);
  } finally {
    db.close();
  }
});

test('GameStateRepository repairs local-only field pollution from existing global tiles', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const state = GameStateNormalizer.createInitialGameState('global-local-field-repair');
    repository.save(state);
    const canonicalId = WorldMapService.getCanonicalTileId(0, 1);
    db.prepare('UPDATE global_world_tiles SET tile = ? WHERE canonicalId = ?')
      .run(JSON.stringify({
        id: 'tile_0_1',
        q: 0,
        r: 1,
        x: 0,
        y: 1,
        canonicalId,
        terrain: 'plains',
        siteId: null,
        controlled: false,
      }), canonicalId);

    repository.save(state);

    const storedTile = JSON.parse(db.prepare('SELECT tile FROM global_world_tiles WHERE canonicalId = ?')
      .get(canonicalId).tile);

    assert.equal(Object.prototype.hasOwnProperty.call(storedTile, 'siteId'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(storedTile, 'controlled'), false);
    assert.equal(storedTile.terrain, 'plains');
  } finally {
    db.close();
  }
});

test('GameStateRepository reserves player spawns with unique coordinates', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const first = repository.reserveSpawnForPlayer('spawn-owner-a', {
      q: 24,
      r: -8,
      score: 120,
      tutorialTarget: { q: 25, r: -8 },
    }, { nowIso: '2026-06-16T00:00:00.000Z' });

    assert.equal(first.playerId, 'spawn-owner-a');
    assert.equal(first.q, 24);
    assert.equal(first.r, -8);
    assert.equal(first.spawnKey, '24,-8');
    assert.equal(first.status, 'reserved');

    const samePlayer = repository.reserveSpawnForPlayer('spawn-owner-a', {
      q: 99,
      r: 99,
    }, { nowIso: '2026-06-16T00:01:00.000Z' });
    assert.equal(samePlayer.q, 24);
    assert.equal(samePlayer.r, -8);

    assert.throws(
      () => repository.reserveSpawnForPlayer('spawn-owner-b', { q: 24, r: -8 }),
      (error) => error.code === 'SPAWN_ALREADY_RESERVED' && error.spawnKey === '24,-8',
    );
  } finally {
    db.close();
  }
});

test('GameStateRepository releases spawn reservations so coordinates can be reused', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    repository.reserveSpawnForPlayer('spawn-release-a', { q: 32, r: 7 });
    assert.equal(repository.releaseSpawnForPlayer('spawn-release-a'), 1);
    assert.equal(repository.getSpawnForPlayer('spawn-release-a'), null);

    const next = repository.reserveSpawnForPlayer('spawn-release-b', { q: 32, r: 7 });
    assert.equal(next.playerId, 'spawn-release-b');
    assert.equal(next.spawnKey, '32,7');
  } finally {
    db.close();
  }
});

test('GameStateRepository exposes occupied spawn coordinates from saves, shared world, and reservations', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const ownerState = GameStateNormalizer.createInitialGameState('spawn-occupied-owner');
    ownerState.territories = ownerState.territories.map((territory) => (
      territory.id === 'capital'
        ? { ...territory, x: 12, y: 4 }
        : territory
    ));
    ownerState.territories.push({
      id: 'site_spawn_shared',
      x: 19,
      y: 6,
      type: 'town',
      owner: 'player',
      ownerPlayerId: ownerState.playerId,
      status: 'occupied',
    });
    repository.save(ownerState);
    repository.reserveSpawnForPlayer('spawn-reserved-owner', { q: -14, r: 21 });

    const neutralCity = repository.worldCityRepo.getAllCities()[0];
    const occupied = repository.getOccupiedSpawnCoordinates();
    const keys = new Set(occupied.map((coord) => `${coord.source}:${coord.q},${coord.r}`));
    const worldCityOccupied = occupied.find((coord) => (
      coord.source === 'world-city'
      && coord.q === neutralCity.x
      && coord.r === neutralCity.y
    ));

    assert.ok(keys.has('game-state-capital:12,4'));
    assert.ok(keys.has('shared-world-territory:19,6'));
    assert.ok(keys.has('spawn-allocation:-14,21'));
    assert.ok(keys.has(`world-city:${neutralCity.x},${neutralCity.y}`));
    assert.equal(worldCityOccupied.blocksTile, true);
    assert.equal(worldCityOccupied.blocksDistance, false);
  } finally {
    db.close();
  }
});
