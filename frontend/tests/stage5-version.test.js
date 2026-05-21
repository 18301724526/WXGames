const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..', '..');

test('world site dispatcher migration app version is 0.1.43 in package metadata', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend', 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend', 'package-lock.json'), 'utf8'));

  assert.equal(packageJson.version, '0.1.43');
  assert.equal(packageLock.version, '0.1.43');
  assert.equal(packageLock.packages[''].version, '0.1.43');
});

test('version service reads updated 0.1.43 package version', () => {
  const VersionService = require('../../backend/services/VersionService');
  const service = new VersionService({ repoRoot: projectRoot });
  const info = service.getVersionInfo();

  assert.equal(info.version, '0.1.43');
  assert.ok(info.deploymentId);
});
