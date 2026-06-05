const test = require('node:test');
const assert = require('node:assert/strict');

const registerAdminRoutes = require('../routes/adminRoutes');

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

test('admin task definition routes expose current definitions and template download', () => {
  const { app, routes } = createAppHarness();
  const authMiddleware = (req, res, next) => {
    req.username = 'codexqa';
    next();
  };
  registerAdminRoutes(app, { authMiddleware });

  const listRoute = routes.find((item) => item.method === 'GET' && item.path === '/api/admin/task-definitions');
  const listRes = createResponse();
  listRoute.handlers[0]({}, listRes, () => listRoute.handlers[1]({}, listRes));

  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.payload.success, true);
  assert.equal(Array.isArray(listRes.payload.definitions.tasks), true);

  const templateRoute = routes.find((item) => item.method === 'GET' && item.path === '/api/admin/task-definitions/template.xlsx');
  const templateRes = createResponse();
  templateRoute.handlers[0]({}, templateRes, () => templateRoute.handlers[1]({}, templateRes));

  assert.equal(templateRes.headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(Buffer.isBuffer(templateRes.payload));
  assert.equal(templateRes.payload.length > 0, true);
});
