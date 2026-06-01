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
  const versions = [
    { version: '0.1.188', deploymentId: 'a' },
    { version: '0.1.189', deploymentId: 'b' },
    { version: '0.1.190', deploymentId: 'c' },
  ];
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

  assert.deepEqual(prompts, [{
    version: {
      version: '0.1.189',
      deploymentId: 'b',
      serverVersion: '0.1.189',
      localVersion: '0.1.188',
      previousVersion: '0.1.188',
      serverDeploymentId: 'b',
      localDeploymentId: 'a',
    },
    previousDeploymentId: 'a',
  }]);
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

test('update checker reports errors through onError and keeps polling alive', async () => {
  const scheduled = [];
  const errors = [];
  const checker = new UpdateChecker({
    api: {
      async getVersion() {
        throw new Error('network down');
      },
    },
    scheduler: {
      setInterval(callback, intervalMs) {
        const timer = { callback, intervalMs };
        scheduled.push(timer);
        return timer;
      },
      clearInterval() {},
    },
    onError(error) { errors.push(error.message); },
  });

  await checker.start();
  await checker.safeCheck();

  assert.deepEqual(errors, ['network down', 'network down']);
  assert.equal(scheduled.length, 1);
  assert.ok(checker.timer);
});

test('update checker emits initialization and update logs', async () => {
  const entries = [];
  const versions = [
    { version: '0.1.188', deploymentId: 'a' },
    { version: '0.1.189', deploymentId: 'b' },
  ];
  const checker = new UpdateChecker({
    api: { async getVersion() { return versions.shift(); } },
    onLog(entry) { entries.push(entry); },
    onUpdate() {},
  });
  checker.timer = { id: 1 };

  await checker.check({ initialize: true });
  await checker.check();

  assert.deepEqual(entries, [
    { type: 'initialized', version: { version: '0.1.188', deploymentId: 'a' }, deploymentId: 'a' },
    {
      type: 'updated',
      version: {
        version: '0.1.189',
        deploymentId: 'b',
        serverVersion: '0.1.189',
        localVersion: '0.1.188',
        previousVersion: '0.1.188',
        serverDeploymentId: 'b',
        localDeploymentId: 'a',
      },
      deploymentId: 'b',
      previousDeploymentId: 'a',
    },
  ]);
});

test('app injects scheduler into update checker', () => {
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const serviceJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'services', 'UpdateChecker.js'), 'utf8');

  assert.match(appJs, /new constructors\.UpdateChecker\(\{[\s\S]*scheduler: this\.scheduler/);
  assert.match(appJs, /api:\s*\{\s*getVersion:\s*\(\)\s*=>\s*this\.apiGet\('\/version'\)\s*\}/);
  assert.match(appJs, /onError:\s*\(error\)\s*=>/);
  assert.doesNotMatch(appJs, /new window\./);
  assert.doesNotMatch(serviceJs, /global\.setInterval|global\.clearInterval/);
});
