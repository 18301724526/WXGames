const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const AuthService = require('../services/authService');
const GameStateRepository = require('../repositories/GameStateRepository');
const gameStateService = require('../services/GameStateService');

function createServices() {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  const authService = new AuthService(db, 'test-secret');
  return { db, repository, authService };
}

test('白名单账号可登录并自动创建存档', () => {
  const { db, repository, authService } = createServices();

  const result = authService.loginPlayer(
    'test1',
    '123456',
    (playerId) => repository.findByPlayerId(playerId),
    (gameState, offlineSeconds) => gameStateService.calculateOfflineIncome(gameState, offlineSeconds),
    (gameState) => repository.save(gameState),
    (playerId) => gameStateService.createInitialGameState(playerId),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.playerId, 'test1');
  assert.equal(result.username, 'test1');
  assert.ok(result.token);
  assert.ok(repository.findByPlayerId('test1'));

  db.close();
});

test('非白名单账号和错误密码会被拒绝', () => {
  const { db, repository, authService } = createServices();

  const notAllowed = authService.loginPlayer(
    'guest',
    '123456',
    (playerId) => repository.findByPlayerId(playerId),
    (gameState, offlineSeconds) => gameStateService.calculateOfflineIncome(gameState, offlineSeconds),
    (gameState) => repository.save(gameState),
    (playerId) => gameStateService.createInitialGameState(playerId),
  );
  const wrongPassword = authService.loginPlayer(
    'test2',
    'bad-password',
    (playerId) => repository.findByPlayerId(playerId),
    (gameState, offlineSeconds) => gameStateService.calculateOfflineIncome(gameState, offlineSeconds),
    (gameState) => repository.save(gameState),
    (playerId) => gameStateService.createInitialGameState(playerId),
  );

  assert.equal(notAllowed.error, 'ACCOUNT_NOT_ALLOWED');
  assert.equal(wrongPassword.error, 'INVALID_CREDENTIALS');

  db.close();
});

test('重置游戏只重置进度，不删除白名单账号', () => {
  const { db, repository, authService } = createServices();

  authService.loginPlayer(
    'test3',
    '123456',
    (playerId) => repository.findByPlayerId(playerId),
    (gameState, offlineSeconds) => gameStateService.calculateOfflineIncome(gameState, offlineSeconds),
    (gameState) => repository.save(gameState),
    (playerId) => gameStateService.createInitialGameState(playerId),
  );

  const state = repository.findByPlayerId('test3');
  state.currentEra = 5;
  state.resources.food = 999;
  repository.save(state);

  const resetResult = authService.resetPlayer(
    'test3',
    (playerId) => gameStateService.createInitialGameState(playerId),
    (gameState) => repository.save(gameState),
  );

  const player = db.prepare('SELECT playerId FROM players WHERE playerId = ?').get('test3');
  const resetState = repository.findByPlayerId('test3');

  assert.equal(resetResult.success, true);
  assert.ok(player);
  assert.equal(resetState.currentEra, 0);
  assert.equal(resetState.resources.food, 100);

  db.close();
});
