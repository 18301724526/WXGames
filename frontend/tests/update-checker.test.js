const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UpdateChecker = require('../js/services/UpdateChecker');
const projectRoot = path.join(__dirname, '..', '..');

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
  const cleared = [];
  const versions = [{ deploymentId: 'a' }, { deploymentId: 'b' }, { deploymentId: 'c' }];
  const prompts = [];
  const checker = new UpdateChecker({
    api: { async getVersion() { return versions.shift(); } },
    scheduler: { clearInterval(timer) { cleared.push(timer); } },
    onUpdate(version, previousDeploymentId) { prompts.push({ version, previousDeploymentId }); },
  });
  checker.timer = { id: 1 };

  await checker.check({ initialize: true });
  await checker.check();
  await checker.check();

  assert.deepEqual(prompts, [{ version: { deploymentId: 'b' }, previousDeploymentId: 'a' }]);
  assert.equal(checker.timer, null);
  assert.equal(cleared.length, 1);
});

test('update checker polls through injected scheduler', async () => {
  const scheduled = [];
  const checker = new UpdateChecker({
    api: { async getVersion() { return { deploymentId: 'a' }; } },
    intervalMs: 1234,
    scheduler: {
      setInterval(callback, intervalMs) {
        const timer = { callback, intervalMs };
        scheduled.push(timer);
        return timer;
      },
      clearInterval() {},
    },
  });

  await checker.start();

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].intervalMs, 1234);
});

test('app injects scheduler into update checker', () => {
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const serviceJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'services', 'UpdateChecker.js'), 'utf8');

  assert.match(appJs, /new window\.UpdateChecker\(\{[\s\S]*scheduler: this\.scheduler/);
  assert.doesNotMatch(serviceJs, /global\.setInterval|global\.clearInterval/);
});
