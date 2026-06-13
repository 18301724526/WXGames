const test = require('node:test');
const assert = require('node:assert/strict');

const registerClientEventsRoutes = require('../routes/clientEventsRoutes');

function createAppHarness() {
  const routes = [];
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
    },
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers });
    },
  };
  return { app, routes };
}

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

test('client events route accepts allowlisted frontend load failures', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  const observabilityService = {
    recordClientEvent(event) {
      calls.push(event);
      return { at: '2026-06-11T00:00:00.000Z', type: event.type };
    },
  };
  registerClientEventsRoutes(app, { observabilityService });

  const route = routes.find((item) => item.path === '/api/client-events');
  const req = {
    body: {
      type: 'frontend_asset_failure',
      phase: 'assets:preload',
      assetPath: 'assets/missing.png',
      failed: 1,
    },
    headers: { 'user-agent': 'node-test-agent' },
    get(name) {
      return this.headers[String(name || '').toLowerCase()] || '';
    },
  };
  const res = createResponse();
  route.handlers[0](req, res);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.payload, {
    success: true,
    accepted: true,
    event: {
      at: '2026-06-11T00:00:00.000Z',
      type: 'frontend_asset_failure',
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userAgent, 'node-test-agent');
  assert.equal(calls[0].assetPath, 'assets/missing.png');
});

test('client events route rejects unsupported event types', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  registerClientEventsRoutes(app, {
    observabilityService: {
      recordClientEvent(event) {
        calls.push(event);
      },
    },
  });

  const route = routes.find((item) => item.path === '/api/client-events');
  const res = createResponse();
  route.handlers[0]({ body: { type: 'debug_note' }, headers: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error, 'CLIENT_EVENT_TYPE_UNSUPPORTED');
  assert.equal(calls.length, 0);
});

function invokeRoute(route, req, res) {
  function run(index) {
    const handler = route.handlers[index];
    if (!handler) return undefined;
    return handler(req, res, () => run(index + 1));
  }
  return run(0);
}

test('client operation log routes persist and return authenticated player snapshots', async () => {
  const { app, routes } = createAppHarness();
  const stored = [];
  const authMiddleware = (req, res, next) => {
    req.playerId = 'player-1';
    req.deviceId = 'device-1';
    next();
  };
  const logService = {
    logClientOperationSnapshot(playerId, deviceId, snapshot) {
      stored.push({ playerId, deviceId, snapshot });
      return {
        id: 3,
        entryCount: snapshot.entries.length,
        timestamp: '2026-06-14T00:00:00.000Z',
      };
    },
    getPlayerClientOperationLogs(playerId, limit) {
      assert.equal(playerId, 'player-1');
      assert.equal(limit, 2);
      return [
        {
          id: 3,
          reason: 'city-click-repro',
          entryCount: 1,
          timestamp: '2026-06-14T00:00:00.000Z',
          payload: JSON.stringify({
            schema: 'client-operation-log-v1',
            entries: [{ seq: 1, type: 'input:tapMiss' }],
          }),
        },
      ];
    },
  };
  registerClientEventsRoutes(app, {
    authMiddleware,
    logService,
    observabilityService: { recordClientEvent() {} },
  });

  const uploadRoute = routes.find((item) => item.method === 'POST' && item.path === '/api/client-operation-logs');
  const uploadRes = createResponse();
  await invokeRoute(uploadRoute, {
    body: {
      reason: 'city-click-repro',
      entries: [{ seq: 1, type: 'input:tapMiss' }],
    },
  }, uploadRes);

  assert.equal(uploadRes.statusCode, 202);
  assert.equal(uploadRes.payload.success, true);
  assert.equal(uploadRes.payload.logId, 3);
  assert.equal(stored[0].playerId, 'player-1');
  assert.equal(stored[0].deviceId, 'device-1');
  assert.equal(stored[0].snapshot.reason, 'city-click-repro');

  const listRoute = routes.find((item) => item.method === 'GET' && item.path === '/api/client-operation-logs');
  const listRes = createResponse();
  await invokeRoute(listRoute, { query: { limit: '2' } }, listRes);

  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.payload.success, true);
  assert.equal(listRes.payload.logs.length, 1);
  assert.equal(listRes.payload.logs[0].payload.entries[0].type, 'input:tapMiss');
});
