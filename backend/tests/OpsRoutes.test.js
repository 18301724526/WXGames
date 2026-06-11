const test = require('node:test');
const assert = require('node:assert/strict');

const registerOpsRoutes = require('../routes/opsRoutes');
const createMaintenanceMiddleware = require('../middleware/maintenanceMiddleware');

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
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function invokeRoute(route, req, res) {
  function run(index) {
    const handler = route.handlers[index];
    if (!handler) return undefined;
    return handler(req, res, () => run(index + 1));
  }
  return run(0);
}

test('ops routes expose dashboard and maintenance behind admin handlers', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  const authMiddleware = (req, res, next) => {
    calls.push('auth');
    req.username = 'codexqa';
    next();
  };
  const adminMiddleware = (req, res, next) => {
    calls.push('admin');
    req.adminUser = req.username;
    next();
  };
  const opsControlService = {
    getDashboard(options) {
      calls.push(['dashboard', options.includeLogs, options.logLines]);
      return { success: true, schema: 'ops-dashboard-v1' };
    },
    getMaintenanceState() {
      calls.push(['maintenance:get']);
      return { enabled: false };
    },
    setMaintenanceState(payload, options) {
      calls.push(['maintenance:set', payload.enabled, payload.reason, options.operator]);
      return { success: true, maintenance: { enabled: payload.enabled } };
    },
    appendAudit(entry) {
      calls.push(['audit', entry.action, entry.operator]);
    },
  };

  registerOpsRoutes(app, { authMiddleware, adminMiddleware, opsControlService });

  const dashboardRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'GET' && item.path === '/api/admin/ops/dashboard'),
    { query: { includeLogs: 'true', logLines: '12' } },
    dashboardRes,
  );
  assert.equal(dashboardRes.payload.schema, 'ops-dashboard-v1');

  const maintenanceRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'POST' && item.path === '/api/admin/ops/maintenance'),
    { body: { enabled: true, reason: 'deploy' } },
    maintenanceRes,
  );
  assert.equal(maintenanceRes.payload.maintenance.enabled, true);

  assert.deepEqual(calls.slice(0, 6), [
    'auth',
    'admin',
    ['dashboard', true, '12'],
    'auth',
    'admin',
    ['maintenance:set', true, 'deploy', 'codexqa'],
  ]);
});

test('ops restart route accepts restart before delayed PM2 command', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  const authMiddleware = (req, res, next) => {
    req.username = 'codexqa';
    next();
  };
  const adminMiddleware = (req, res, next) => {
    req.adminUser = req.username;
    next();
  };
  const opsControlService = {
    appendAudit(entry) {
      calls.push(['audit', entry.action, entry.operator]);
    },
    restartService() {
      calls.push(['restart']);
    },
  };

  registerOpsRoutes(app, { authMiddleware, adminMiddleware, opsControlService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/admin/ops/restart');
  const res = createResponse();
  invokeRoute(route, { body: { delayMs: 5000 } }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.payload.accepted, true);
  assert.equal(res.payload.action, 'pm2:restart');
  assert.deepEqual(calls, [['audit', 'pm2:restart:accepted', 'codexqa']]);
});

test('maintenance middleware blocks gameplay APIs but leaves admin APIs reachable', () => {
  const middleware = createMaintenanceMiddleware({
    opsControlService: {
      getMaintenanceState() {
        return {
          enabled: true,
          reason: 'deploy',
          message: '维护中',
          startedAt: '2026-06-11T16:00:00.000Z',
          updatedAt: '2026-06-11T16:00:00.000Z',
        };
      },
    },
  });

  const gameplayRes = createResponse();
  let gameplayNext = false;
  middleware({ path: '/api/game/state' }, gameplayRes, () => { gameplayNext = true; });
  assert.equal(gameplayRes.statusCode, 503);
  assert.equal(gameplayRes.payload.error, 'MAINTENANCE_MODE');
  assert.equal(gameplayRes.headers['Retry-After'], '120');
  assert.equal(gameplayNext, false);

  const adminRes = createResponse();
  let adminNext = false;
  middleware({ path: '/api/admin/ops/dashboard' }, adminRes, () => { adminNext = true; });
  assert.equal(adminRes.statusCode, 200);
  assert.equal(adminNext, true);
});
