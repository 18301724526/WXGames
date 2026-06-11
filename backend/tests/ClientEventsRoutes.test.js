const test = require('node:test');
const assert = require('node:assert/strict');

const registerClientEventsRoutes = require('../routes/clientEventsRoutes');

function createAppHarness() {
  const routes = [];
  const app = {
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
