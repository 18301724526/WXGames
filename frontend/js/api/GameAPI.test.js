const test = require('node:test');
const assert = require('node:assert/strict');

const GameAPI = require('./GameAPI');

function createResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
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
    transport: {
      async request(request) {
        calls.push(['transport', request.url]);
        return createResponse(504, { message: 'Gateway Timeout' });
      },
    },
  });

  const trace = {
    apiStart(method, path, url) {
      calls.push(['start', method, path, url.includes('/api/version?_=')]);
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
