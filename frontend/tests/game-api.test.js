const test = require('node:test');
const assert = require('node:assert/strict');

const GameAPI = require('../js/api/GameAPI');

test('getVersion requests the public version endpoint', async () => {
  const originalFetch = global.fetch;
  try {
    let requestedUrl = null;
    global.fetch = async (url, options) => {
      requestedUrl = url;
      assert.equal(options.method, 'GET');
      return {
        ok: true,
        async json() {
          return { deploymentId: 'version-id' };
        },
      };
    };

    const api = new GameAPI('/api', null);
    const result = await api.getVersion();

    assert.equal(requestedUrl, '/api/version');
    assert.deepEqual(result, { deploymentId: 'version-id' });
  } finally {
    global.fetch = originalFetch;
  }
});
