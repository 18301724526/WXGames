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

test('ops routes expose login plus dashboard and maintenance behind ops auth', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  const opsAuthService = {
    login(body) {
      calls.push(['login', body.username]);
      return {
        success: true,
        token: 'ops-token',
        operator: { username: 'opsroot' },
      };
    },
    authMiddleware(req, res, next) {
      calls.push('ops-auth');
      req.opsAdminUser = 'opsroot';
      next();
    },
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

  registerOpsRoutes(app, { opsAuthService, opsControlService });

  const loginRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'POST' && item.path === '/api/admin/ops/login'),
    { body: { username: 'opsroot', password: 'secret' } },
    loginRes,
  );
  assert.equal(loginRes.payload.token, 'ops-token');

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

  assert.deepEqual(calls.slice(0, 5), [
    ['login', 'opsroot'],
    ['audit', 'ops:login', 'opsroot'],
    'ops-auth',
    ['dashboard', true, '12'],
    'ops-auth',
  ]);
  assert.deepEqual(calls.at(-1), ['maintenance:set', true, 'deploy', 'opsroot']);
});

test('ops routes keep legacy admin handlers only when ops auth is not supplied', () => {
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
    getMaintenanceState() {
      calls.push(['maintenance:get']);
      return { enabled: false };
    },
  };

  registerOpsRoutes(app, { authMiddleware, adminMiddleware, opsControlService });
  const res = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'GET' && item.path === '/api/admin/ops/maintenance'),
    {},
    res,
  );

  assert.equal(res.payload.maintenance.enabled, false);
  assert.deepEqual(calls, ['auth', 'admin', ['maintenance:get']]);
});

test('ops login returns unavailable when independent ops auth is missing', () => {
  const { app, routes } = createAppHarness();
  const opsControlService = {
    getMaintenanceState() {
      return { enabled: false };
    },
  };

  registerOpsRoutes(app, { opsControlService });
  const res = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'POST' && item.path === '/api/admin/ops/login'),
    { body: {} },
    res,
  );

  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.error, 'OpsAuthUnavailable');
});

test('ops login forwards explicit auth configuration failures', () => {
  const { app, routes } = createAppHarness();
  const opsAuthService = {
    login() {
      return {
        success: false,
        statusCode: 503,
        error: 'OpsAuthNotConfigured',
      };
    },
  };
  const opsControlService = {
    getMaintenanceState() {
      return { enabled: false };
    },
  };

  registerOpsRoutes(app, { opsAuthService, opsControlService });
  const res = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'POST' && item.path === '/api/admin/ops/login'),
    { body: {} },
    res,
  );

  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.error, 'OpsAuthNotConfigured');
});

test('ops login does not write success audit for failed credentials', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  const opsAuthService = {
    login() {
      return {
        success: false,
        statusCode: 401,
        error: 'InvalidOpsCredentials',
      };
    },
  };
  const opsControlService = {
    appendAudit(entry) {
      calls.push(entry.action);
    },
    getMaintenanceState() {
      return { enabled: false };
    },
  };

  registerOpsRoutes(app, { opsAuthService, opsControlService });
  const res = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'POST' && item.path === '/api/admin/ops/login'),
    { body: { username: 'opsroot', password: 'wrong' } },
    res,
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.error, 'InvalidOpsCredentials');
  assert.deepEqual(calls, []);
});

test('ops restart route accepts restart before delayed PM2 command with ops auth', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  const opsAuthService = {
    authMiddleware(req, res, next) {
      req.opsAdminUser = 'opsroot';
      next();
    },
  };
  const opsControlService = {
    appendAudit(entry) {
      calls.push(['audit', entry.action, entry.operator]);
    },
    restartService() {
      calls.push(['restart']);
    },
  };

  registerOpsRoutes(app, { opsAuthService, opsControlService });
  const route = routes.find((item) => item.method === 'POST' && item.path === '/api/admin/ops/restart');
  const res = createResponse();
  invokeRoute(route, { body: { delayMs: 5000 } }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.payload.accepted, true);
  assert.equal(res.payload.action, 'pm2:restart');
  assert.deepEqual(calls, [['audit', 'pm2:restart:accepted', 'opsroot']]);
});

test('ops restart route accepts restart before delayed PM2 command with legacy admin handlers', () => {
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
          message: 'maintenance',
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
