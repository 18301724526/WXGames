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

test('AuthService caches player existence checks for heartbeat-scale auth bursts', () => {
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
  const token = service.generateToken('test1', 'test1');

  const runAuth = () => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    let finished = false;
    const res = {
      status() { return this; },
      json() { finished = true; return this; },
    };
    service.authMiddleware(req, res, () => {
      finished = true;
    });
    assert.equal(finished, true);
    assert.equal(req.playerId, 'test1');
  };

  runAuth();
  runAuth();
  assert.equal(selectCalls, 1);

  nowMs += 61000;
  runAuth();
  assert.equal(selectCalls, 2);
});
