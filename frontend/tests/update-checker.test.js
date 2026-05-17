const test = require('node:test');
const assert = require('node:assert/strict');

const UpdateChecker = require('../js/services/UpdateChecker');

test('update checker stores the initial deployment id without prompting', async () => {
  const prompts = [];
  const checker = new UpdateChecker({
    api: { async getVersion() { return { deploymentId: 'a' }; } },
    onUpdate(version) { prompts.push(version); },
  });

  await checker.check({ initialize: true });
  await checker.check();

  assert.equal(checker.currentDeploymentId, 'a');
  assert.equal(prompts.length, 0);
});

test('update checker prompts once when deployment id changes and stops polling', async () => {
  const originalClearInterval = global.clearInterval;
  try {
    const cleared = [];
    global.clearInterval = (timer) => cleared.push(timer);
    const versions = [{ deploymentId: 'a' }, { deploymentId: 'b' }, { deploymentId: 'c' }];
    const prompts = [];
    const checker = new UpdateChecker({
      api: { async getVersion() { return versions.shift(); } },
      onUpdate(version, previousDeploymentId) { prompts.push({ version, previousDeploymentId }); },
    });
    checker.timer = { id: 1 };

    await checker.check({ initialize: true });
    await checker.check();
    await checker.check();

    assert.deepEqual(prompts, [{ version: { deploymentId: 'b' }, previousDeploymentId: 'a' }]);
    assert.equal(checker.timer, null);
    assert.equal(cleared.length, 1);
  } finally {
    global.clearInterval = originalClearInterval;
  }
});
