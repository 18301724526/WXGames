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

test('world explorer ready cleanup derives coordinate-bearing mission identity from coordinates', () => {
  const dirtyMission = {
    id: 'explore_dirty_ready',
    mode: 'random',
    status: 'ready',
    origin: { q: 0, r: 0, tileId: 'legacy-origin' },
    route: [
      { q: 1, r: 0, tileId: 'legacy-hidden-step', step: 1, revealed: true },
      { q: 2, r: -1, tileId: 'legacy-revealed-step', step: 2, revealed: true },
    ],
    target: { q: 2, r: -1, tileId: 'legacy-target' },
    position: { q: 2, r: -1, tileId: 'legacy-position' },
  };

  const result = Cleanup.cleanupLegacyReadyMission(dirtyMission, '2026-06-06T00:01:00.000Z');

  assert.equal(result.changed, true);
  assert.equal(result.mission.origin.tileId, 'tile_0_0');
  assert.deepEqual(result.mission.route.map((step) => step.tileId), ['tile_1_0', 'tile_2_-1']);
  assert.equal(result.mission.target.tileId, 'tile_2_-1');
  assert.equal(result.mission.position.q, 2);
  assert.equal(result.mission.position.r, -1);
  assert.equal(result.mission.position.tileId, 'tile_2_-1');
  assert.equal(JSON.stringify(result.mission).includes('legacy-'), false);
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
