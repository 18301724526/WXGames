const test = require('node:test');
const assert = require('node:assert/strict');

const H5GameApiTransportAdapter = require('./H5GameApiTransportAdapter');

test('H5GameApiTransportAdapter forwards GameAPI request payloads through runtime fetch', async () => {
  const calls = [];
  class AbortControllerStub {
    constructor() {
      this.signal = { aborted: false };
    }
  }
  const runtime = {
    AbortController: AbortControllerStub,
    fetch(url, options) {
      calls.push([
        url,
        options.method,
        options.headers.Authorization,
        options.body,
        options.signal,
      ]);
      return Promise.resolve({ ok: true, status: 200 });
    },
  };
  const adapter = H5GameApiTransportAdapter.fromRuntime(runtime);
  const abortController = adapter.createAbortController();

  const response = await adapter.request({
    url: '/api/game/state',
    method: 'POST',
    headers: { Authorization: 'Bearer token-a' },
    body: '{"ok":true}',
    signal: abortController.signal,
  });

  assert.equal(response.status, 200);
  assert.equal(abortController instanceof AbortControllerStub, true);
  assert.deepEqual(calls, [
    ['/api/game/state', 'POST', 'Bearer token-a', '{"ok":true}', abortController.signal],
  ]);
});

test('H5GameApiTransportAdapter reports missing fetch as transport unavailable', async () => {
  const adapter = H5GameApiTransportAdapter.fromRuntime({});

  await assert.rejects(
    () => adapter.request({ path: '/game/state', requestId: 'api-1' }),
    (error) => {
      assert.equal(error.code, 'H5_GAME_API_TRANSPORT_UNAVAILABLE');
      assert.equal(error.path, '/game/state');
      assert.equal(error.requestId, 'api-1');
      return true;
    },
  );
});
