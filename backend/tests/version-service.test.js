const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VersionService = require('../services/VersionService');

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-version-'));
  fs.mkdirSync(path.join(root, 'frontend'), { recursive: true });
  fs.mkdirSync(path.join(root, 'backend'), { recursive: true });
  fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(root, 'backend', 'package.json'), JSON.stringify({ version: '1.2.3' }));
  fs.writeFileSync(path.join(root, 'frontend', 'app.js'), 'console.log("v1");');
  fs.writeFileSync(path.join(root, 'shared', 'buildingConfig.json'), '{"version":"test"}');
  return root;
}

test('version service creates a stable deployment id from frontend backend and shared files', () => {
  const root = makeTempRepo();
  const service = new VersionService({ repoRoot: root, cacheMs: 0 });

  const first = service.getVersionInfo();
  const second = service.getVersionInfo();

  assert.equal(first.version, '1.2.3');
  assert.equal(first.deploymentId, second.deploymentId);
  assert.match(first.deploymentId, /^[a-f0-9]{16}$/);
});

test('version service deployment id changes when a frontend file changes', async () => {
  const root = makeTempRepo();
  const service = new VersionService({ repoRoot: root, cacheMs: 0 });

  const first = service.getVersionInfo();
  await new Promise((resolve) => setTimeout(resolve, 5));
  fs.writeFileSync(path.join(root, 'frontend', 'app.js'), 'console.log("v2");');
  const second = service.getVersionInfo();

  assert.notEqual(first.deploymentId, second.deploymentId);
});

test('version service reads git commit from packed refs when loose head ref is missing', () => {
  const root = makeTempRepo();
  const gitDir = path.join(root, '.git');
  fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');
  fs.writeFileSync(path.join(gitDir, 'packed-refs'), '# pack-refs with: peeled fully-peeled sorted\nabc1234567890abcdef refs/heads/main\n');

  const service = new VersionService({ repoRoot: root, cacheMs: 0 });
  const version = service.getVersionInfo();

  assert.equal(version.gitCommit, 'abc1234567890abcdef');
});
