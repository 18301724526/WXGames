const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const GameStateRepository = require('../repositories/GameStateRepository');

function insertPlayer(db, playerId, deviceId) {
  db.prepare(`
    INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(playerId, deviceId, `${playerId}-token`, new Date().toISOString(), new Date().toISOString());
}

function insertGameState(db, playerId) {
  db.prepare(`
    INSERT INTO game_states (
      playerId, resources, buildings, population, techs, techEffects, currentEra,
      eraHistory, happiness, gameDay, eventQueue, eventHistory, offlineSnapshot,
      offlineEventLog, negativeStreak, lastEventAt, tutorial, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    playerId,
    '{}',
    '{}',
    '{}',
    '{}',
    '{}',
    0,
    '[]',
    100,
    1,
    '[]',
    '[]',
    '{}',
    '[]',
    0,
    0,
    '{"completed":false,"currentStep":0}',
    new Date().toISOString(),
  );
}

test('findAll 只返回仍存在于 players 表中的玩家状态', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  insertPlayer(db, 'player-live', 'device-live');
  insertGameState(db, 'player-live');
  insertGameState(db, 'player-orphan');

  const result = repository.findAll();

  assert.equal(result.length, 1);
  assert.equal(result[0].playerId, 'player-live');

  db.close();
});
