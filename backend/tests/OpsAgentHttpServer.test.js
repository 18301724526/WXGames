const test = require('node:test');
const assert = require('node:assert/strict');

const OpsAuthService = require('../services/OpsAuthService');
const { createOpsAgentHttpServer } = require('../ops-agent/OpsAgentHttpServer');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('ops-agent HTTP server uses independent ops auth for status and PM2 actions', async () => {
  const calls = [];
  const opsAgentService = {
    getHealth() {
      calls.push(['health']);
      return { success: true, schema: 'ops-agent-health-v1', status: 'ok' };
    },
    getStatus() {
      calls.push(['status']);
      return { success: true, schema: 'ops-agent-status-v1' };
    },
    startService(options) {
      calls.push(['start', options.operator]);
      return { success: true, action: 'pm2:start' };
    },
    appendAudit(entry) {
      calls.push(['audit', entry.action, entry.operator]);
    },
  };
  const opsAuthService = new OpsAuthService({
    env: {
      NODE_ENV: 'test',
      OPS_ADMIN_USERNAME: 'opsroot',
      OPS_ADMIN_PASSWORD: 'secret-1',
      OPS_JWT_SECRET: 'ops-agent-secret',
    },
  });
  const server = createOpsAgentHttpServer({ opsAgentService, opsAuthService });
  const baseUrl = await listen(server);

  try {
    const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
    assert.equal(health.schema, 'ops-agent-health-v1');
    assert.equal(health.auth.configured, true);

    const unauthorized = await fetch(`${baseUrl}/status`);
    assert.equal(unauthorized.status, 401);

    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'opsroot', password: 'secret-1' }),
    });
    const login = await loginResponse.json();
    assert.equal(login.success, true);
    assert.equal(login.operator.username, 'opsroot');

    const status = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: `Bearer ${login.token}` },
    }).then((res) => res.json());
    assert.equal(status.schema, 'ops-agent-status-v1');

    const start = await fetch(`${baseUrl}/pm2/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.token}` },
    }).then((res) => res.json());
    assert.equal(start.action, 'pm2:start');

    assert.deepEqual(calls, [
      ['health'],
      ['audit', 'ops-agent:login', 'opsroot'],
      ['status'],
      ['start', 'opsroot'],
    ]);
  } finally {
    await close(server);
  }
});

test('ops-agent HTTP server never exposes arbitrary PM2 command routes', async () => {
  const opsAgentService = {
    getHealth() {
      return { success: true, schema: 'ops-agent-health-v1', status: 'ok' };
    },
    appendAudit() {},
  };
  const opsAuthService = new OpsAuthService({
    env: {
      NODE_ENV: 'test',
      OPS_ADMIN_USERNAME: 'opsroot',
      OPS_ADMIN_PASSWORD: 'secret-1',
      OPS_JWT_SECRET: 'ops-agent-secret',
    },
  });
  const server = createOpsAgentHttpServer({ opsAgentService, opsAuthService });
  const baseUrl = await listen(server);

  try {
    const login = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'opsroot', password: 'secret-1' }),
    }).then((res) => res.json());
    const arbitrary = await fetch(`${baseUrl}/pm2/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.token}` },
    });
    const payload = await arbitrary.json();

    assert.equal(arbitrary.status, 404);
    assert.equal(payload.error, 'OpsAgentRouteNotFound');
  } finally {
    await close(server);
  }
});
