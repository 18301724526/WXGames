const test = require('node:test');
const assert = require('node:assert/strict');

const AuthService = require('../services/authService');

test('AuthService only enables load-test bot accounts behind an explicit switch', () => {
  const disabled = new AuthService(null, 'unit-secret', {
    env: {},
  });
  assert.equal(disabled.isWhitelisted('bot00001'), false);
  assert.equal(disabled.isPasswordValid('bot00001', '123456'), false);

  const enabled = new AuthService(null, 'unit-secret', {
    env: {
      ENABLE_BOT_ACCOUNTS: '1',
      BOT_ACCOUNT_COUNT: '5000',
      BOT_ACCOUNT_PASSWORD: 'load-secret',
    },
  });

  assert.equal(enabled.isWhitelisted('bot00001'), true);
  assert.equal(enabled.isWhitelisted('bot05000'), true);
  assert.equal(enabled.isWhitelisted('bot05001'), false);
  assert.equal(enabled.isPasswordValid('bot00001', 'load-secret'), true);
  assert.equal(enabled.isPasswordValid('bot00001', '123456'), false);
});

test('AuthService caches explicit player existence checks for heartbeat-scale probes', () => {
  let selectCalls = 0;
  let nowMs = Date.parse('2026-06-12T00:00:00.000Z');
  const service = new AuthService({
    prepare(sql) {
      assert.equal(sql, 'SELECT playerId FROM players WHERE playerId = ?');
      return {
        get(playerId) {
          selectCalls += 1;
          return { playerId };
        },
      };
    },
  }, 'unit-secret', {
    now: () => new Date(nowMs),
    authPlayerCacheTtlMs: 60000,
  });
  assert.equal(service.playerExists('test1'), true);
  assert.equal(service.playerExists('test1'), true);
  assert.equal(selectCalls, 1);

  nowMs += 61000;
  assert.equal(service.playerExists('test1'), true);
  assert.equal(selectCalls, 2);
});

test('AuthService stores hashed login tokens and rejects replaced sessions', () => {
  const rows = new Map();
  const states = new Map();
  const db = {
    prepare(sql) {
      return {
        get(playerId) {
          if (sql.startsWith('SELECT playerId, deviceId, token FROM players')) {
            return rows.get(playerId) || null;
          }
          if (sql.startsWith('SELECT playerId, token FROM players')) {
            const row = rows.get(playerId);
            return row ? { playerId: row.playerId, token: row.token } : null;
          }
          if (sql.startsWith('SELECT playerId FROM game_states')) {
            return states.has(playerId) ? { playerId } : null;
          }
          throw new Error(`Unexpected get SQL: ${sql}`);
        },
        run(...args) {
          if (sql.startsWith('INSERT INTO players')) {
            const [playerId, deviceId, token, createdAt, lastActiveAt] = args;
            rows.set(playerId, { playerId, deviceId, token, createdAt, lastActiveAt });
            return { changes: 1 };
          }
          if (sql.startsWith('UPDATE players SET deviceId = ?, token = ?, lastActiveAt = ?')) {
            const [deviceId, token, lastActiveAt, playerId] = args;
            rows.set(playerId, { ...rows.get(playerId), playerId, deviceId, token, lastActiveAt });
            return { changes: 1 };
          }
          if (sql.startsWith('UPDATE players SET lastActiveAt = ?')) {
            const [lastActiveAt, playerId] = args;
            rows.set(playerId, { ...rows.get(playerId), lastActiveAt });
            return { changes: 1 };
          }
          throw new Error(`Unexpected run SQL: ${sql}`);
        },
      };
    },
  };
  const service = new AuthService(db, 'unit-secret', {
    now: () => new Date('2026-06-24T00:00:00.000Z'),
  });
  const getDefaultGameState = (playerId) => ({ playerId, updatedAt: '2026-06-24T00:00:00.000Z' });
  const saveGameState = (state) => states.set(state.playerId, state);
  const getGameState = (playerId) => states.get(playerId);
  const calculateOfflineIncome = () => null;

  const first = service.loginPlayer(
    'test1',
    '123456',
    getGameState,
    calculateOfflineIncome,
    saveGameState,
    getDefaultGameState,
  );
  const storedAfterFirst = rows.get('test1').token;
  assert.notEqual(storedAfterFirst, first.token);
  assert.equal(storedAfterFirst.startsWith('sha256:'), true);

  const second = service.loginPlayer(
    'test1',
    '123456',
    getGameState,
    calculateOfflineIncome,
    saveGameState,
    getDefaultGameState,
  );
  assert.notEqual(second.token, first.token);

  let payload = null;
  const oldReq = { headers: { authorization: `Bearer ${first.token}` } };
  const oldRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };
  service.authMiddleware(oldReq, oldRes, () => {
    throw new Error('old session should not reach next middleware');
  });
  assert.equal(oldRes.statusCode, 401);
  assert.equal(payload.error, 'SESSION_REPLACED');

  const newReq = { headers: { authorization: `Bearer ${second.token}` } };
  let reached = false;
  service.authMiddleware(newReq, oldRes, () => { reached = true; });
  assert.equal(reached, true);
  assert.equal(newReq.playerId, 'test1');
});
