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
