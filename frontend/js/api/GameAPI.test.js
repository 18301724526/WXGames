const test = require('node:test');
const assert = require('node:assert/strict');

const GameAPI = require('./GameAPI');

function createResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get() {
        return '';
      },
    },
    async json() {
      return payload;
    },
  };
}

function createResponseWithHeaders(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[String(name || '').toLowerCase()] || '';
      },
    },
    async json() {
      return payload;
    },
  };
}

function withLoadTrace(trace, callback) {
  const previous = globalThis.H5LoadTrace;
  globalThis.H5LoadTrace = trace;
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      globalThis.H5LoadTrace = previous;
    });
}

test('GameAPI sends H5 load trace spans for successful requests', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    transport: {
      async request(request) {
        calls.push(['transport', request.url, request.headers.Authorization]);
        return createResponse(200, {
          gameState: {
            playerId: 'player-1',
            territoryState: { worldMap: { tiles: [{ q: 0, r: 0 }] } },
          },
        });
      },
    },
  });

  const trace = {
    apiStart(method, path, url, detail) {
      calls.push(['start', method, path, url, detail.hasToken]);
      return { id: 1, startedAt: 10, method, path, url };
    },
    apiEnd(span, detail) {
      calls.push(['end', span.id, detail.status, detail.ok, detail.payload.worldMapTiles]);
    },
    apiFail() {
      calls.push(['fail']);
    },
    summarizePayload(payload) {
      return { worldMapTiles: payload.gameState?.territoryState?.worldMap?.tiles?.length || 0 };
    },
  };

  const result = await withLoadTrace(trace, () => api.getState());

  assert.equal(result.gameState.playerId, 'player-1');
  assert.deepEqual(calls, [
    ['start', 'GET', '/game/state', '/api/game/state', true],
    ['transport', '/api/game/state', 'Bearer token-a'],
    ['end', 1, 200, true, 1],
  ]);
});

test('GameAPI reports H5 load trace failures for 504 version checks', async () => {
  const calls = [];
  const api = new GameAPI('/api', null, {
    maxRetries: 0,
    transport: {
      async request(request) {
        calls.push(['transport', request.url]);
        return createResponse(504, { message: 'Gateway Timeout' });
      },
    },
  });

  const trace = {
    apiStart(method, path, url) {
      calls.push(['start', method, path, url]);
      return { id: 7, startedAt: 10, method, path, url };
    },
    apiEnd() {
      calls.push(['end']);
    },
    apiFail(span, error, detail) {
      calls.push(['fail', span.id, error.message, detail.status, detail.ok]);
    },
    summarizePayload() {
      return { keys: ['message'] };
    },
  };

  await assert.rejects(
    withLoadTrace(trace, () => api.getVersion()),
    /Gateway Timeout/,
  );

  assert.equal(calls[0][0], 'start');
  assert.deepEqual(calls.at(-1), ['fail', 7, 'Gateway Timeout', 504, false]);
  assert.equal(calls.some((call) => call[0] === 'end'), false);
});

test('GameAPI reuses cached version info on 304 ETag responses', async () => {
  const calls = [];
  const api = new GameAPI('/api', null, {
    timeoutMs: 0,
    maxRetries: 0,
    transport: {
      async request(request) {
        calls.push([
          'transport',
          request.url,
          request.headers['If-None-Match'] || '',
        ]);
        if (!request.headers['If-None-Match']) {
          return createResponseWithHeaders(200, {
            deploymentId: 'dep-1',
            version: 'v1',
          }, { etag: '"wxgame-etag-1"' });
        }
        return createResponseWithHeaders(304, {}, { etag: '"wxgame-etag-1"' });
      },
    },
  });

  const first = await api.getVersion();
  const second = await api.getVersion();

  assert.equal(first.deploymentId, 'dep-1');
  assert.equal(second.deploymentId, 'dep-1');
  assert.equal(second.notModified, true);
  assert.deepEqual(calls, [
    ['transport', '/api/version', ''],
    ['transport', '/api/version', '"wxgame-etag-1"'],
  ]);
});

test('GameAPI aborts timed out requests with structured request metadata', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    timeoutMs: 5,
    maxRetries: 0,
    scheduler: {
      setTimeout(callback, ms) {
        calls.push(['setTimeout', ms]);
        callback();
        return 1;
      },
      clearTimeout(id) {
        calls.push(['clearTimeout', id]);
      },
      now() {
        return calls.length * 10;
      },
    },
    transport: {
      request(request) {
        calls.push([
          'transport',
          request.requestId,
          request.timeoutMs,
          Boolean(request.signal),
          request.headers['X-Client-Request-ID'],
        ]);
        request.signal?.addEventListener?.('abort', () => calls.push(['abort']));
        return new Promise(() => {});
      },
    },
  });

  await assert.rejects(
    () => api.getState(),
    (error) => {
      assert.equal(error.code, 'GAME_API_TIMEOUT');
      assert.equal(error.status, 0);
      assert.equal(error.method, 'GET');
      assert.equal(error.path, '/game/state');
      assert.equal(error.requestId, 'api-1');
      assert.equal(error.timeoutMs, 5);
      assert.equal(error.attempts, 1);
      assert.equal(error.retryable, true);
      return true;
    },
  );

  assert.deepEqual(calls.slice(0, 4), [
    ['transport', 'api-1', 5, true, 'api-1'],
    ['setTimeout', 5],
    ['abort'],
    ['clearTimeout', 1],
  ]);
});

test('GameAPI retries transient GET failures without retrying unsafe methods', async () => {
  const calls = [];
  const api = new GameAPI('/api', null, {
    timeoutMs: 0,
    maxRetries: 1,
    retryBaseDelayMs: 25,
    scheduler: {
      setTimeout(callback, ms) {
        calls.push(['delay', ms]);
        callback();
        return 1;
      },
      clearTimeout() {},
    },
    transport: {
      async request(request) {
        calls.push(['transport', request.method, request.path, request.attempt]);
        if (request.method === 'GET' && request.attempt === 1) {
          return createResponse(504, { message: 'Gateway Timeout' });
        }
        if (request.method === 'POST') {
          return createResponse(504, { message: 'Gateway Timeout' });
        }
        return createResponse(200, { deploymentId: 'dep-1', version: 'v1' });
      },
    },
  });

  const version = await api.getVersion();
  assert.equal(version.deploymentId, 'dep-1');

  await assert.rejects(
    () => api.build('farm'),
    (error) => {
      assert.equal(error.status, 504);
      assert.equal(error.attempts, 1);
      assert.equal(error.retryable, false);
      return true;
    },
  );

  assert.deepEqual(calls, [
    ['transport', 'GET', '/version', 1],
    ['delay', 25],
    ['transport', 'GET', '/version', 2],
    ['transport', 'POST', '/game/action', 1],
  ]);
});

test('GameAPI reports client events without throwing on backend rejection', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    timeoutMs: 0,
    transport: {
      async request(request) {
        calls.push([
          request.method,
          request.path,
          request.url,
          request.headers.Authorization,
          request.headers['X-Client-Request-ID'],
          JSON.parse(request.body),
        ]);
        return createResponse(202, { success: true, accepted: true });
      },
    },
  });

  const result = await api.reportClientEvent({
    type: 'frontend_asset_failure',
    phase: 'assets:preload',
    assetPath: 'assets/missing.png',
  });

  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'POST');
  assert.equal(calls[0][1], '/client-events');
  assert.equal(calls[0][2], '/api/client-events');
  assert.equal(calls[0][3], 'Bearer token-a');
  assert.match(calls[0][4], /^client-event-/);
  assert.equal(calls[0][5].type, 'frontend_asset_failure');
  assert.equal(calls[0][5].requestId, calls[0][4]);
});

test('GameAPI reportClientEvent returns failure payload instead of throwing', async () => {
  const api = new GameAPI('/api', null, {
    timeoutMs: 0,
    transport: {
      async request() {
        return createResponse(400, { error: 'CLIENT_EVENT_TYPE_UNSUPPORTED' });
      },
    },
  });

  const result = await api.reportClientEvent({ type: 'debug_note' });

  assert.equal(result.success, false);
  assert.equal(result.status, 400);
  assert.equal(result.payload.error, 'CLIENT_EVENT_TYPE_UNSUPPORTED');
});
