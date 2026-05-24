const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');

test('app version is consistent in package metadata', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend', 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend', 'package-lock.json'), 'utf8'));

  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.version, '0.1.115');
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[''].version, packageJson.version);
});

test('version service reads package version when env version is absent', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend', 'package.json'), 'utf8'));
  const VersionService = require('../../backend/services/VersionService');
  const service = new VersionService({ repoRoot: projectRoot });
  const info = service.getVersionInfo();

  assert.equal(info.version, packageJson.version);
  assert.ok(info.deploymentId);
});
