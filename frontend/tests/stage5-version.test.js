const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..', '..');

test('stage 7 canvas settings app version is 0.1.12 in package metadata', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend', 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend', 'package-lock.json'), 'utf8'));

  assert.equal(packageJson.version, '0.1.12');
  assert.equal(packageLock.version, '0.1.12');
  assert.equal(packageLock.packages[''].version, '0.1.12');
});

test('version service reads updated 0.1.12 package version', () => {
  const VersionService = require('../../backend/services/VersionService');
  const service = new VersionService({ repoRoot: projectRoot });
  const info = service.getVersionInfo();

  assert.equal(info.version, '0.1.12');
  assert.ok(info.deploymentId);
});
