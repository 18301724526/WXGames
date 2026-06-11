const test = require('node:test');
const assert = require('node:assert/strict');

const registerMetricsRoutes = require('../routes/metricsRoutes');

function createAppHarness() {
  const routes = [];
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers });
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

test('metrics route exposes observability snapshot behind auth and admin middleware', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  const authMiddleware = (req, res, next) => {
    calls.push('auth');
    next();
  };
  const adminMiddleware = (req, res, next) => {
    calls.push('admin');
    next();
  };
  const observabilityService = {
    getSnapshot(options) {
      calls.push(['snapshot', options.pathLimit, options.eventLimit]);
      return { status: 'ok', totals: { requestCount: 1 } };
    },
  };
  registerMetricsRoutes(app, { authMiddleware, adminMiddleware, observabilityService });

  const route = routes.find((item) => item.path === '/api/metrics');
  const req = { query: { pathLimit: '2', eventLimit: '3' } };
  const res = createResponse();
  route.handlers[0](req, res, () => route.handlers[1](req, res, () => route.handlers[2](req, res)));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.metrics.status, 'ok');
  assert.deepEqual(calls, ['auth', 'admin', ['snapshot', 2, 3]]);
});
