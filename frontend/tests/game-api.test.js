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

    assert.match(requestedUrl, /^\/api\/version\?_=/);
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

test('assignJob posts population reassignment through shared action API', async () => {
  const requests = [];
  const api = new GameAPI('/api', null, {
    transport: {
      async request(options) {
        requests.push(JSON.parse(options.body));
        return {
          ok: true,
          async json() {
            return { success: true };
          },
        };
      },
    },
  });

  await api.assignJob('craftsman', -1);

  assert.deepEqual(requests, [{ action: 'assign', target: 'craftsman', count: -1 }]);
});

test('claimGuideTaskReward posts task id through shared action API', async () => {
  const requests = [];
  const api = new GameAPI('/api', null, {
    transport: {
      async request(options) {
        requests.push(JSON.parse(options.body));
        return {
          ok: true,
          async json() {
            return { success: true };
          },
        };
      },
    },
  });

  await api.claimGuideTaskReward('barracks_supplies');

  assert.deepEqual(requests, [{ action: 'claimGuideTaskReward', target: 'barracks_supplies' }]);
});

test('task center API reads task list and claims category reward', async () => {
  const requests = [];
  const api = new GameAPI('/api', 'token-task', {
    transport: {
      async request(options) {
        requests.push({
          url: options.url,
          method: options.method,
          body: options.body ? JSON.parse(options.body) : null,
          auth: options.headers.Authorization,
        });
        return {
          ok: true,
          async json() {
            return { success: true };
          },
        };
      },
    },
  });

  await api.getTasks();
  await api.claimTaskReward('barracks_supplies', 'main');

  assert.deepEqual(requests, [
    { url: '/api/game/tasks', method: 'GET', body: null, auth: 'Bearer token-task' },
    { url: '/api/game/tasks/claim', method: 'POST', body: { taskId: 'barracks_supplies', category: 'main' }, auth: 'Bearer token-task' },
  ]);
});


test('GameAPI can use platform transport without browser fetch', async () => {
  const api = new GameAPI('https://server.example/api', 'token-y', {
    transport: {
      async request(options) {
        assert.equal(options.url, 'https://server.example/api/game/state');
        assert.equal(options.method, 'GET');
        assert.equal(options.headers.Authorization, 'Bearer token-y');
        return {
          ok: true,
          async json() {
            return { gameState: { currentEra: 2 } };
          },
        };
      },
    },
  });

  const result = await api.getState();
  assert.deepEqual(result, { gameState: { currentEra: 2 } });
});
