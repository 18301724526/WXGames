const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const registerAdminRoutes = require('../routes/adminRoutes');
const createAdminMiddleware = require('../middleware/adminMiddleware');
const {
  publishCurrentConfigRuntime,
  resetConfigRuntime,
} = require('./helpers/configRuntimeTestHarness');

before(() => {
  publishCurrentConfigRuntime();
});

after(() => {
  resetConfigRuntime();
});

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
    send(payload) {
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

test('admin task definition routes expose current definitions and template download', () => {
  const { app, routes } = createAppHarness();
  const authMiddleware = (req, res, next) => {
    req.username = 'codexqa';
    next();
  };
  const adminMiddleware = createAdminMiddleware({ adminUsers: 'codexqa', allowDevDefault: false });
  registerAdminRoutes(app, { authMiddleware, adminMiddleware });

  const listRoute = routes.find((item) => item.method === 'GET' && item.path === '/api/admin/task-definitions');
  const listRes = createResponse();
  const listReq = {};
  invokeRoute(listRoute, listReq, listRes);

  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.payload.success, true);
  assert.equal(Array.isArray(listRes.payload.definitions.tasks), true);

  const templateRoute = routes.find((item) => item.method === 'GET' && item.path === '/api/admin/task-definitions/template.xlsx');
  const templateRes = createResponse();
  const templateReq = {};
  invokeRoute(templateRoute, templateReq, templateRes);

  assert.equal(templateRes.headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(Buffer.isBuffer(templateRes.payload));
  assert.equal(templateRes.payload.length > 0, true);
});

test('admin task definition routes do not expose direct import history or rollback handlers', () => {
  const { app, routes } = createAppHarness();
  const authMiddleware = (req, res, next) => {
    req.username = 'codexqa';
    next();
  };
  const adminMiddleware = createAdminMiddleware({ adminUsers: 'codexqa', allowDevDefault: false });
  registerAdminRoutes(app, { authMiddleware, adminMiddleware });

  const historyRoute = routes.find((item) => item.method === 'GET' && item.path === '/api/admin/task-definitions/history');
  const importRoute = routes.find((item) => item.method === 'POST' && item.path === '/api/admin/task-definitions/import');
  const rollbackRoute = routes.find((item) => item.method === 'POST' && item.path === '/api/admin/task-definitions/rollback');

  assert.equal(historyRoute, undefined);
  assert.equal(importRoute, undefined);
  assert.equal(rollbackRoute, undefined);
});

test('admin task definition routes reject authenticated non-admin players', () => {
  const { app, routes } = createAppHarness();
  const authMiddleware = (req, res, next) => {
    req.username = 'test1';
    req.playerId = 'test1';
    next();
  };
  const adminMiddleware = createAdminMiddleware({ adminUsers: 'codexqa', allowDevDefault: false });
  registerAdminRoutes(app, { authMiddleware, adminMiddleware });

  const listRoute = routes.find((item) => item.method === 'GET' && item.path === '/api/admin/task-definitions');
  const res = createResponse();
  const req = {};
  let handlerReached = false;
  listRoute.handlers[0](req, res, () => {
    listRoute.handlers[1](req, res, () => {
      handlerReached = true;
      listRoute.handlers[2](req, res);
    });
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, 'AdminForbidden');
  assert.equal(handlerReached, false);
});

test('admin config release routes expose history, active, preview, publish, and rollback', () => {
  const { app, routes } = createAppHarness();
  const calls = [];
  const authMiddleware = (req, res, next) => {
    req.username = 'codexqa';
    next();
  };
  const adminMiddleware = createAdminMiddleware({ adminUsers: 'codexqa', allowDevDefault: false });
  const configReleaseService = {
    loadReleaseHistory(options) {
      calls.push(['history', options.limit, options.includeSnapshot, options.includeReport]);
      return { releases: [{ id: 'release-a' }] };
    },
    getActiveRelease(options) {
      calls.push(['active', options.includeSnapshot, options.includeReport]);
      return { release: { id: 'release-a' } };
    },
    getRuntimeStatus() {
      calls.push(['runtime']);
      return { status: 'matched', success: true, matchesCurrent: true };
    },
    previewRelease(payload, options) {
      calls.push(['preview', payload.source, options.operator]);
      return { success: true, candidate: { action: 'preview' } };
    },
    publishRelease(payload, options) {
      calls.push(['publish', payload.source, options.operator]);
      return { success: true, release: { id: 'release-b' } };
    },
    rollbackRelease(releaseId, options) {
      calls.push(['rollback', releaseId, options.operator]);
      return { success: true, release: { id: 'release-c', action: 'rollback' } };
    },
  };
  const configRuntimeLoader = {
    getRuntimeLoaderStatus() {
      calls.push(['loader']);
      return { status: 'ready', success: true, ready: true, payloadIncluded: true };
    },
  };
  registerAdminRoutes(app, { authMiddleware, adminMiddleware, configReleaseService, configRuntimeLoader });

  const historyRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'GET' && item.path === '/api/admin/config-releases'),
    { query: { limit: '2', includeSnapshot: 'true', includeReport: 'true' } },
    historyRes,
  );
  assert.equal(historyRes.statusCode, 200);
  assert.equal(historyRes.payload.success, true);
  assert.equal(historyRes.payload.history.releases[0].id, 'release-a');

  const activeRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'GET' && item.path === '/api/admin/config-releases/active'),
    { query: { includeSnapshot: 'true' } },
    activeRes,
  );
  assert.equal(activeRes.payload.activeRelease.release.id, 'release-a');

  const runtimeRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'GET' && item.path === '/api/admin/config-releases/runtime-status'),
    {},
    runtimeRes,
  );
  assert.equal(runtimeRes.payload.runtimeStatus.status, 'matched');
  assert.equal(runtimeRes.payload.loaderStatus.status, 'ready');

  const previewRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'POST' && item.path === '/api/admin/config-releases/preview'),
    { body: { source: 'unit:preview' } },
    previewRes,
  );
  assert.equal(previewRes.statusCode, 200);
  assert.equal(previewRes.payload.candidate.action, 'preview');

  const publishRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'POST' && item.path === '/api/admin/config-releases/publish'),
    { body: { source: 'unit:publish' } },
    publishRes,
  );
  assert.equal(publishRes.payload.release.id, 'release-b');

  const rollbackRes = createResponse();
  invokeRoute(
    routes.find((item) => item.method === 'POST' && item.path === '/api/admin/config-releases/rollback'),
    { body: { releaseId: 'release-a' } },
    rollbackRes,
  );
  assert.equal(rollbackRes.payload.release.action, 'rollback');
  assert.deepEqual(calls, [
    ['history', '2', true, true],
    ['active', true, false],
    ['runtime'],
    ['loader'],
    ['preview', 'unit:preview', 'codexqa'],
    ['publish', 'unit:publish', 'codexqa'],
    ['rollback', 'release-a', 'codexqa'],
  ]);
});

test('admin config release rollback returns not found for missing releases', () => {
  const { app, routes } = createAppHarness();
  const authMiddleware = (req, res, next) => {
    req.username = 'codexqa';
    next();
  };
  const adminMiddleware = createAdminMiddleware({ adminUsers: 'codexqa', allowDevDefault: false });
  const configReleaseService = {
    loadReleaseHistory() {
      return { releases: [] };
    },
    getActiveRelease() {
      return { release: null };
    },
    getRuntimeStatus() {
      return { success: true, status: 'unpublished' };
    },
    previewRelease() {
      return { success: true };
    },
    publishRelease() {
      return { success: true };
    },
    rollbackRelease() {
      return { success: false, error: 'CONFIG_RELEASE_NOT_FOUND' };
    },
  };
  const configRuntimeLoader = {
    getRuntimeLoaderStatus() {
      return { success: true, status: 'gate-open-observe-only' };
    },
  };
  registerAdminRoutes(app, { authMiddleware, adminMiddleware, configReleaseService, configRuntimeLoader });

  const rollbackRoute = routes.find((item) => item.method === 'POST' && item.path === '/api/admin/config-releases/rollback');
  const res = createResponse();
  invokeRoute(rollbackRoute, { body: { releaseId: 'missing-release' } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.payload.error, 'CONFIG_RELEASE_NOT_FOUND');
});
