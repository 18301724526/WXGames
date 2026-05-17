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

test('scoutTerritory posts a direction and claimScout posts a mission id', async () => {
  const originalFetch = global.fetch;
  try {
    const requests = [];
    global.fetch = async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return {
        ok: true,
        async json() {
          return { success: true };
        },
      };
    };

    const api = new GameAPI('/api', 'token-x');
    await api.scoutTerritory('ne');
    await api.claimScout('scout-ne-1');

    assert.deepEqual(requests.map((item) => item.body), [
      { action: 'scoutTerritory', direction: 'ne' },
      { action: 'claimScout', missionId: 'scout-ne-1' },
    ]);
    assert.equal(requests[0].options.headers.Authorization, 'Bearer token-x');
  } finally {
    global.fetch = originalFetch;
  }
});
