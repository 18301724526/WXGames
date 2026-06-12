const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const Cleanup = require('../scripts/cleanup-world-explorer-ready-state');
const GameStateRepository = require('../repositories/GameStateRepository');

test('world explorer ready cleanup converts retired ready missions to idle in SQLite', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  try {
    db.prepare(`
      INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt)
      VALUES (?, ?, ?, ?, ?)
    `).run('legacy-ready-player', 'device-1', 'token-1', '2026-06-06T00:00:00.000Z', '2026-06-06T00:00:00.000Z');
    db.prepare(`
      INSERT INTO game_states (playerId, exploreMissions, updatedAt)
      VALUES (?, ?, ?)
    `).run('legacy-ready-player', JSON.stringify([{
      id: 'explore_random_old',
      mode: 'random',
      status: 'ready',
      route: [{ q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true }],
      target: { q: 1, r: 0, tileId: 'tile_1_0' },
      claimedAt: '2026-06-06T00:00:30.000Z',
    }]), '2026-06-06T00:00:00.000Z');

    const result = Cleanup.cleanupDatabase(db, { nowIso: '2026-06-06T00:01:00.000Z' });
    const row = db.prepare('SELECT exploreMissions FROM game_states WHERE playerId = ?').get('legacy-ready-player');
    const missions = JSON.parse(row.exploreMissions);

    assert.equal(result.changedPlayers, 1);
    assert.equal(result.changedMissions, 1);
    assert.equal(missions[0].status, 'idle');
    assert.equal(missions[0].position.tileId, 'tile_1_0');
    assert.equal(missions[0].nextStepAt, null);
    assert.equal(Object.prototype.hasOwnProperty.call(missions[0], 'claimedAt'), false);
  } finally {
    db.close();
  }
});

test('world explorer ready cleanup can inspect without mutating in dry run', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  try {
    db.prepare(`
      INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt)
      VALUES (?, ?, ?, ?, ?)
    `).run('dry-run-player', 'device-2', 'token-2', '2026-06-06T00:00:00.000Z', '2026-06-06T00:00:00.000Z');
    const original = JSON.stringify([{ id: 'explore_old', status: 'ready', route: [] }]);
    db.prepare('INSERT INTO game_states (playerId, exploreMissions) VALUES (?, ?)')
      .run('dry-run-player', original);

    const result = Cleanup.cleanupDatabase(db, { dryRun: true });
    const row = db.prepare('SELECT exploreMissions FROM game_states WHERE playerId = ?').get('dry-run-player');

    assert.equal(result.changedPlayers, 1);
    assert.equal(result.changedMissions, 1);
    assert.equal(row.exploreMissions, original);
  } finally {
    db.close();
  }
});
