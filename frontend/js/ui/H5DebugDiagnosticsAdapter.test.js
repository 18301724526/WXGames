const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMarchTrace = require('../debug/WorldMarchTrace');
const ClientOperationLog = require('../debug/ClientOperationLog');
const CodexWorldMapDiag = require('../debug/CodexWorldMapDiag');
const H5DebugDiagnosticsAdapter = require('./H5DebugDiagnosticsAdapter');

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values);
    },
  };
}

test('H5DebugDiagnosticsAdapter installs H5 query and storage preferences into debug cores', () => {
  const localStorage = createStorage({ cf_username: 'player-a' });
  const sessionStorage = createStorage();
  const adapter = H5DebugDiagnosticsAdapter.fromRuntime(
    {
      location: {
        href: 'https://game.test/wxgame/?worldMarchTrace=1&clientOperationLog=0',
        pathname: '/wxgame/',
        search: '?worldMarchTrace=1&clientOperationLog=0',
        hash: '#map',
      },
      navigator: { userAgent: 'test-agent' },
      localStorage,
      sessionStorage,
    },
    {
      registry: {
        WorldMarchTrace,
        ClientOperationLogClass: ClientOperationLog,
        CodexWorldMapDiag,
      },
    },
  );

  assert.equal(WorldMarchTrace.enabled(), true);
  assert.equal(localStorage.dump().worldMarchTrace, '1');

  const logger = new ClientOperationLog({
    runtime: {
      performance: { now: () => 1 },
      Date: { now: () => Date.parse('2026-06-14T00:00:00.000Z') },
    },
    environment: adapter,
    persistLimit: 0,
  });

  assert.equal(logger.enabled, false);
  assert.equal(localStorage.dump().clientOperationLog, '0');
  assert.equal(logger.buildSnapshot({ reason: 'adapter-test' }).page.pathname, '/wxgame/');
  assert.equal(logger.buildSnapshot({ reason: 'adapter-test' }).page.userAgent, 'test-agent');
  assert.equal(logger.buildFileName(), 'wxgame-oplog-player-a-20260614-000000Z.json');

  WorldMarchTrace.setEnvironmentProvider(null);
  ClientOperationLog.setEnvironmentProvider(null);
  CodexWorldMapDiag.setEnvironmentProvider(null);
});
