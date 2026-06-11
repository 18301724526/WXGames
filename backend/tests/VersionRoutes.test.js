const test = require('node:test');
const assert = require('node:assert/strict');

const registerVersionRoutes = require('../routes/versionRoutes');

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
    payload: undefined,
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

test('version route returns version info with ETag headers', () => {
  const { app, routes } = createAppHarness();
  const versionInfo = {
    version: '0.2.0',
    deploymentId: 'dep-1',
    etag: '"wxgame-etag"',
  };
  const versionService = {
    getVersionInfo() {
      return versionInfo;
    },
    matchesEtag() {
      return false;
    },
  };
  registerVersionRoutes(app, { versionService });

  const route = routes.find((item) => item.path === '/api/version');
  const req = { headers: {} };
  const res = createResponse();
  route.handlers[0](req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.ETag, '"wxgame-etag"');
  assert.match(res.headers['Cache-Control'], /max-age=5/);
  assert.equal(res.payload, versionInfo);
});

test('version route returns 304 when If-None-Match matches current ETag', () => {
  const { app, routes } = createAppHarness();
  const versionInfo = {
    version: '0.2.0',
    deploymentId: 'dep-1',
    etag: '"wxgame-etag"',
  };
  const versionService = {
    getVersionInfo() {
      return versionInfo;
    },
    matchesEtag(candidate, info) {
      return candidate === info.etag;
    },
  };
  registerVersionRoutes(app, { versionService });

  const route = routes.find((item) => item.path === '/api/version');
  const req = { headers: { 'if-none-match': '"wxgame-etag"' } };
  const res = createResponse();
  route.handlers[0](req, res);

  assert.equal(res.statusCode, 304);
  assert.equal(res.headers.ETag, '"wxgame-etag"');
  assert.equal(res.payload, undefined);
});
