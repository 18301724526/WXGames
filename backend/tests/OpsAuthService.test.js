const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const OpsAuthService = require('../services/OpsAuthService');

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('OpsAuthService issues and verifies independent ops admin sessions', () => {
  const service = new OpsAuthService({
    env: {
      NODE_ENV: 'test',
      OPS_ADMIN_USERNAME: 'opsroot',
      OPS_ADMIN_PASSWORD: 'secret-1',
      OPS_JWT_SECRET: 'ops-secret',
    },
    now: () => new Date('2026-06-12T00:00:00.000Z'),
  });

  const login = service.login({ username: 'OPSROOT', password: 'secret-1' });
  assert.equal(login.success, true);
  assert.equal(login.operator.username, 'opsroot');
  assert.equal(login.tokenType, 'Bearer');

  const req = { headers: { authorization: `Bearer ${login.token}` } };
  const res = createResponse();
  let reached = false;
  service.authMiddleware(req, res, () => { reached = true; });

  assert.equal(reached, true);
  assert.equal(req.opsAdminUser, 'opsroot');
  assert.equal(req.adminUser, 'opsroot');
});

test('OpsAuthService rejects player-shaped JWTs on the ops boundary', () => {
  const service = new OpsAuthService({
    env: {
      NODE_ENV: 'test',
      OPS_ADMIN_USERNAME: 'opsroot',
      OPS_ADMIN_PASSWORD: 'secret-1',
      OPS_JWT_SECRET: 'shared-secret',
    },
  });
  const playerToken = jwt.sign({ playerId: 'codexqa', username: 'codexqa' }, 'shared-secret');
  const req = { headers: { authorization: `Bearer ${playerToken}` } };
  const res = createResponse();
  let reached = false;

  service.authMiddleware(req, res, () => { reached = true; });

  assert.equal(reached, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.error, 'InvalidOpsToken');
});

test('OpsAuthService supports bcrypt password hashes and reports missing production config', () => {
  const hash = bcrypt.hashSync('hashed-secret', 10);
  const service = new OpsAuthService({
    env: {
      NODE_ENV: 'production',
      OPS_ADMIN_USERNAME: 'opsroot',
      OPS_ADMIN_PASSWORD_HASH: hash,
      OPS_JWT_SECRET: 'ops-secret',
    },
  });
  assert.equal(service.login({ username: 'opsroot', password: 'wrong' }).success, false);
  assert.equal(service.login({ username: 'opsroot', password: 'hashed-secret' }).success, true);

  const missing = new OpsAuthService({ env: { NODE_ENV: 'production' } });
  const result = missing.login({ username: 'opsroot', password: 'secret' });
  assert.equal(result.success, false);
  assert.equal(result.statusCode, 503);
  assert.equal(result.error, 'OpsAuthNotConfigured');
  assert.equal(result.config.configured, false);
});
