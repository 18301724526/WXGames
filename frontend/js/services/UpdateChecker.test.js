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
