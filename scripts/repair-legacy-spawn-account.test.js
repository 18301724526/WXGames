const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('../backend/node_modules/better-sqlite3');

const GameStateRepository = require('../backend/repositories/GameStateRepository');
const GameStateNormalizer = require('../backend/services/GameStateNormalizer');
const WorldMapService = require('../backend/services/WorldMapService');

const {
  expectedConfirmation,
  parseArgs,
  repairLegacySpawnAccount,
} = require('./repair-legacy-spawn-account');

function createRepository() {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  return { db, repository };
}

function createLegacyState(playerId) {
  const state = GameStateNormalizer.createInitialGameState(playerId, {
    now: new Date('2026-06-16T00:00:00.000Z'),
  });
  state.territories = [
    ...state.territories,
    {
      id: 'site_legacy_owned',
      type: 'town',
      x: 3,
      y: 0,
      owner: 'player',
      ownerPlayerId: playerId,
      status: 'occupied',
    },
  ];
  return state;
}

test('repairLegacySpawnAccount dry-run reports eligible legacy account without writes', () => {
  const { db, repository } = createRepository();
  try {
    const state = createLegacyState('legacy-dry-run');
    repository.save(state);

    const report = repairLegacySpawnAccount(db, { playerId: state.playerId });
    const reloaded = repository.findByPlayerId(state.playerId);

    assert.equal(report.dryRun, true);
    assert.equal(report.writesPerformed, false);
    assert.equal(report.repairMode, 'eligible-reset-style-repair');
    assert.equal(report.beforeSharedOwnedCount, 1);
    assert.equal(report.nextAction, `rerun with --write --confirm ${expectedConfirmation(state.playerId)}`);
    assert.deepEqual(reloaded.worldMap.origin, { q: 0, r: 0 });
    assert.equal(repository.getSpawnForPlayer(state.playerId), null);
  } finally {
    db.close();
  }
});

test('repairLegacySpawnAccount write mode requires exact confirmation', () => {
  const { db, repository } = createRepository();
  try {
    const state = createLegacyState('legacy-needs-confirm');
    repository.save(state);

    assert.throws(
      () => repairLegacySpawnAccount(db, {
        playerId: state.playerId,
        write: true,
        confirm: 'wrong',
      }),
      /Write requires --confirm repair-legacy-spawn:legacy-needs-confirm/,
    );
    assert.deepEqual(repository.findByPlayerId(state.playerId).worldMap.origin, { q: 0, r: 0 });
  } finally {
    db.close();
  }
});

test('repairLegacySpawnAccount performs reset-style repair for one confirmed legacy account', () => {
  const { db, repository } = createRepository();
  try {
    const playerId = 'legacy-write';
    const state = createLegacyState(playerId);
    repository.save(state);

    const report = repairLegacySpawnAccount(db, {
      playerId,
      write: true,
      confirm: expectedConfirmation(playerId),
    });
    const reloaded = repository.findByPlayerId(playerId);
    const spawn = repository.getSpawnForPlayer(playerId);

    assert.equal(report.writesPerformed, true);
    assert.equal(report.repairMode, 'eligible-reset-style-repair');
    assert.notDeepEqual(report.after.origin, { q: 0, r: 0 });
    assert.equal(report.after.visibleTileCount, 25);
    assert.equal(report.afterSharedOwnedCount, 0);
    assert.equal(report.releasedSharedOwnedCount, 1);
    assert.ok(spawn);
    assert.deepEqual(reloaded.worldMap.origin, { q: spawn.q, r: spawn.r });
    assert.equal(reloaded.worldMap.tiles.length, 25);
    assert.equal(reloaded.territories.some((territory) => territory.id === 'site_legacy_owned'), false);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM player_world_visibility WHERE playerId = ?').get(playerId).count,
      25,
    );
  } finally {
    db.close();
  }
});

test('repairLegacySpawnAccount skips already spawned accounts', () => {
  const { db, repository } = createRepository();
  try {
    const playerId = 'already-spawned';
    const state = GameStateNormalizer.createInitialGameState(playerId, {
      spawn: { q: 12, r: -5, spawnKey: '12,-5' },
    });
    repository.reserveSpawnForPlayer(playerId, { q: 12, r: -5, spawnKey: '12,-5' });
    repository.save(state);

    const report = repairLegacySpawnAccount(db, {
      playerId,
      write: true,
      confirm: expectedConfirmation(playerId),
    });

    assert.equal(report.skipped, true);
    assert.equal(report.writesPerformed, false);
    assert.equal(report.repairMode, 'skip-already-spawned');
    assert.deepEqual(repository.findByPlayerId(playerId).worldMap.origin, { q: 12, r: -5 });
  } finally {
    db.close();
  }
});

test('parseArgs reads player, write, json, and confirmation options', () => {
  const options = parseArgs([
    '--db',
    '/tmp/example.db',
    '--player',
    'test2',
    '--write',
    '--confirm',
    'repair-legacy-spawn:test2',
    '--json',
  ]);

  assert.equal(options.dbPath, '/tmp/example.db');
  assert.equal(options.playerId, 'test2');
  assert.equal(options.write, true);
  assert.equal(options.confirm, 'repair-legacy-spawn:test2');
  assert.equal(options.json, true);
});

test('repair uses spawn allocator instead of patching legacy 0,0 visibility', () => {
  const { db, repository } = createRepository();
  try {
    const playerId = 'legacy-visible-check';
    repository.save(createLegacyState(playerId));

    repairLegacySpawnAccount(db, {
      playerId,
      write: true,
      confirm: expectedConfirmation(playerId),
    });
    const reloaded = repository.findByPlayerId(playerId);
    const expectedIds = new Set(WorldMapService.getRevealArea(
      reloaded.worldMap.origin.q,
      reloaded.worldMap.origin.r,
      WorldMapService.START_REVEAL_RADIUS,
    ).map((coord) => WorldMapService.getCanonicalTileId(coord.q, coord.r)));
    const actualIds = new Set(reloaded.worldMap.tiles.map((tile) => tile.canonicalId));

    assert.deepEqual(actualIds, expectedIds);
    assert.equal(actualIds.has('tile_0_0'), false);
  } finally {
    db.close();
  }
});
