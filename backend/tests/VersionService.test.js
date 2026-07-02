const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const VersionService = require('../services/VersionService');

test('version service ignores transient sqlite journal files', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'version-service-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'backend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'shared'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'backend', 'package.json'), JSON.stringify({ version: '9.9.9' }));
    fs.writeFileSync(path.join(repoRoot, 'backend', 'server.js'), 'module.exports = {};\n');
    fs.writeFileSync(path.join(repoRoot, 'backend', 'civilization.db-journal'), 'transient');

    const info = new VersionService({ repoRoot, cacheMs: 0 }).getVersionInfo();

    assert.equal(info.version, '9.9.9');
    assert.equal(typeof info.deploymentId, 'string');
    assert.equal(info.deploymentId.length, 16);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('version service ignores local sqlite runtime files when computing deployment id', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'version-service-sqlite-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'backend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'shared'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'backend', 'package.json'), JSON.stringify({ version: '9.9.9' }));
    fs.writeFileSync(path.join(repoRoot, 'backend', 'server.js'), 'module.exports = {};\n');

    const service = new VersionService({ repoRoot, cacheMs: 0 });
    const before = service.getVersionInfo();
    fs.writeFileSync(path.join(repoRoot, 'backend', '.local-playtest.sqlite'), 'runtime-db-v1');
    fs.writeFileSync(path.join(repoRoot, 'backend', '.local-playtest.sqlite-wal'), 'runtime-wal-v1');
    fs.writeFileSync(path.join(repoRoot, 'backend', '.local-playtest.sqlite-shm'), 'runtime-shm-v1');
    const after = service.getVersionInfo();

    assert.equal(after.deploymentId, before.deploymentId);
    assert.equal(after.sourceHash, before.sourceHash);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('version service includes deploy manifest metadata and stable etag', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'version-service-deploy-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'backend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'shared'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'backend', 'package.json'), JSON.stringify({ version: '9.9.9' }));
    fs.writeFileSync(path.join(repoRoot, 'backend', 'server.js'), 'module.exports = {};\n');
    const manifestPath = path.join(repoRoot, '.wxgame-deploy-version.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      branch: 'main',
      commit: 'abc123',
      deployedAt: '2026-06-11T00:00:00Z',
      workTree: '/www/wwwroot/h5',
      frontendPublicDir: '/www/wwwroot/h5',
    }));

    const service = new VersionService({ repoRoot, deployManifestPath: manifestPath, cacheMs: 0 });
    const info = service.getVersionInfo();

    assert.equal(info.deployedCommit, 'abc123');
    assert.equal(info.deployedAt, '2026-06-11T00:00:00Z');
    assert.equal(info.branch, 'main');
    assert.match(info.etag, /^"wxgame-[0-9a-f]{24}"$/);
    assert.equal(service.matchesEtag(info.etag, info), true);
    assert.equal(service.matchesEtag('"other", ' + info.etag, info), true);
    assert.equal(service.matchesEtag('"other"', info), false);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('version service keeps deployment id pinned to the completed deploy manifest', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'version-service-release-marker-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'backend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'shared'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'backend', 'package.json'), JSON.stringify({ version: '9.9.9' }));
    fs.writeFileSync(path.join(repoRoot, 'backend', 'server.js'), 'module.exports = { release: 1 };\n');
    const manifestPath = path.join(repoRoot, '.wxgame-deploy-version.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      branch: 'main',
      commit: 'completed-release',
      deployedAt: '2026-07-01T00:00:00Z',
      workTree: '/www/wwwroot/h5',
      frontendPublicDir: '/www/wwwroot/h5',
    }));

    const service = new VersionService({ repoRoot, deployManifestPath: manifestPath, cacheMs: 0 });
    const before = service.getVersionInfo();
    fs.writeFileSync(path.join(repoRoot, 'backend', 'server.js'), 'module.exports = { release: 2 };\n');
    fs.writeFileSync(path.join(repoRoot, 'frontend', 'app.js'), 'window.__nextRelease = true;\n');
    const after = service.getVersionInfo();

    assert.equal(after.deploymentId, before.deploymentId);
    assert.notEqual(after.sourceHash, before.sourceHash);
    assert.equal(after.deployedCommit, 'completed-release');
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('version service exposes deploy failure status without changing completed deployment id', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'version-service-deploy-status-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'backend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'shared'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'backend', 'package.json'), JSON.stringify({ version: '9.9.9' }));
    fs.writeFileSync(path.join(repoRoot, 'backend', 'server.js'), 'module.exports = {};\n');
    const manifestPath = path.join(repoRoot, '.wxgame-deploy-version.json');
    const statusPath = path.join(repoRoot, '.wxgame-deploy-status.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      branch: 'main',
      commit: 'completed-release',
      deployedAt: '2026-07-01T00:00:00Z',
    }));
    fs.writeFileSync(statusPath, JSON.stringify({
      schema: 'wxgame-deploy-status-v1',
      status: 'failed',
      branch: 'main',
      targetCommit: 'failed-release',
      previousDeployedCommit: 'completed-release',
      stage: 'deploy-gate',
      updatedAt: '2026-07-02T00:00:00Z',
      exitCode: 1,
      logPath: '/opt/wxgame/.wxgame/push-deploy.log',
      error: { stage: 'deploy-gate', message: 'npm test failed' },
    }));

    const service = new VersionService({
      repoRoot,
      deployManifestPath: manifestPath,
      deployStatusPath: statusPath,
      cacheMs: 0,
    });
    const info = service.getVersionInfo();
    const firstEtag = info.etag;
    fs.writeFileSync(statusPath, JSON.stringify({
      schema: 'wxgame-deploy-status-v1',
      status: 'failed',
      targetCommit: 'failed-release',
      stage: 'deploy-gate',
      updatedAt: '2026-07-02T00:01:00Z',
      exitCode: 1,
      error: { stage: 'deploy-gate', message: 'architecture gate failed' },
    }));
    const after = service.getVersionInfo();

    assert.equal(info.deployedCommit, 'completed-release');
    assert.equal(info.deployStatus.status, 'failed');
    assert.equal(info.deployStatus.targetCommit, 'failed-release');
    assert.equal(info.deployStatus.error.message, 'npm test failed');
    assert.equal(after.deploymentId, info.deploymentId);
    assert.notEqual(after.etag, firstEtag);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});
