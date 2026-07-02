const test = require('node:test');
const assert = require('node:assert/strict');

const UpdateChecker = require('./UpdateChecker');

test('UpdateChecker backs off failed version checks and resets after success', async () => {
  const calls = [];
  let now = 1000;
  let shouldFail = true;
  const checker = new UpdateChecker({
    intervalMs: 5000,
    backoffBaseMs: 5000,
    backoffMaxMs: 20000,
    scheduler: {
      now: () => now,
    },
    api: {
      async getVersion() {
        calls.push(['getVersion', now]);
        if (shouldFail) throw new Error('Gateway Timeout');
        return {
          deploymentId: 'dep-1',
          version: 'v1',
        };
      },
    },
    onError(error) {
      calls.push(['error', error.message]);
    },
    onLog(event) {
      calls.push(['log', event.type, event.deploymentId]);
    },
  });

  assert.equal(await checker.safeCheck(), null);
  assert.equal(checker.failureCount, 1);
  assert.equal(checker.nextAllowedAt, 6000);

  assert.equal(await checker.safeCheck(), null);
  assert.deepEqual(calls, [
    ['getVersion', 1000],
    ['error', 'Gateway Timeout'],
  ]);

  now = 6000;
  assert.equal(await checker.safeCheck(), null);
  assert.equal(checker.failureCount, 2);
  assert.equal(checker.nextAllowedAt, 16000);

  now = 16000;
  shouldFail = false;
  const version = await checker.safeCheck({ initialize: true });

  assert.equal(version.deploymentId, 'dep-1');
  assert.equal(checker.failureCount, 0);
  assert.equal(checker.nextAllowedAt, 0);
  assert.deepEqual(calls, [
    ['getVersion', 1000],
    ['error', 'Gateway Timeout'],
    ['getVersion', 6000],
    ['error', 'Gateway Timeout'],
    ['getVersion', 16000],
    ['log', 'initialized', 'dep-1'],
  ]);
});

test('UpdateChecker reports version checks through an injected trace', async () => {
  const traceCalls = [];
  const checker = new UpdateChecker({
    intervalMs: 5000,
    trace: {
      mark(name, payload) {
        traceCalls.push(['mark', name, payload.intervalMs]);
      },
      phaseStart(name, payload) {
        traceCalls.push(['start', name, payload.initialize]);
      },
      phaseEnd(name, payload) {
        traceCalls.push(['end', name, payload.deploymentId]);
      },
      phaseFail(name, error) {
        traceCalls.push(['fail', name, error.message]);
      },
    },
    scheduler: {
      setInterval() {
        return 'timer';
      },
    },
    api: {
      async getVersion() {
        return {
          deploymentId: 'dep-trace',
          version: 'v1',
        };
      },
    },
  });

  await checker.start();

  assert.deepEqual(traceCalls, [
    ['mark', 'version:watch:start', 5000],
    ['start', 'version:check', true],
    ['end', 'version:check', 'dep-trace'],
  ]);
});

test('UpdateChecker reports deploy failure status once per failure signature', async () => {
  const calls = [];
  const version = {
    deploymentId: 'dep-stable',
    version: 'v1',
    deployStatus: {
      status: 'failed',
      targetCommit: 'abcdef1234567890',
      stage: 'deploy-gate',
      updatedAt: '2026-07-02T00:00:00Z',
      exitCode: 1,
      error: { message: 'npm test failed' },
    },
  };
  const checker = new UpdateChecker({
    api: {
      async getVersion() {
        return version;
      },
    },
    onDeployFailure(payload, status) {
      calls.push(['failed', payload.deploymentId, status.targetCommit, status.error.message]);
    },
    onLog(event) {
      calls.push(['log', event.type, event.deploymentId]);
    },
  });

  await checker.safeCheck({ initialize: true });
  await checker.safeCheck();
  version.deployStatus.updatedAt = '2026-07-02T00:01:00Z';
  version.deployStatus.error = { message: 'architecture gate failed' };
  await checker.safeCheck();

  assert.deepEqual(calls, [
    ['log', 'deployFailed', 'dep-stable'],
    ['failed', 'dep-stable', 'abcdef1234567890', 'npm test failed'],
    ['log', 'initialized', 'dep-stable'],
    ['log', 'unchanged', 'dep-stable'],
    ['log', 'deployFailed', 'dep-stable'],
    ['failed', 'dep-stable', 'abcdef1234567890', 'architecture gate failed'],
    ['log', 'unchanged', 'dep-stable'],
  ]);
});
