const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  collectInspectableFiles,
  isForbidden,
} = require('./check-repository-hygiene');

test('repository hygiene blocks runtime artifacts and local secret text files', () => {
  [
    'backend/server.js.bak',
    'backend/data/civilization.db',
    'backend/.env.production',
    'deploy-key.pem',
    'password.txt',
    'server-credentials.txt',
    'ops_secret.txt',
    'docs/服务器连接密码.txt',
  ].forEach((file) => assert.equal(isForbidden(file), true, file));
});

test('repository hygiene allows normal source and docs', () => {
  [
    'backend/server.js',
    'scripts/check-repository-hygiene.js',
    'docs/production_engineering_roadmap_2026-06-09.md',
  ].forEach((file) => assert.equal(isForbidden(file), false, file));
});

test('repository hygiene falls back to filesystem inventory outside a git worktree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-hygiene-'));
  try {
    fs.mkdirSync(path.join(root, 'backend', 'data'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules', 'fixture'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend', 'server.js'), '');
    fs.writeFileSync(path.join(root, 'backend', 'data', 'civilization.db'), '');
    fs.writeFileSync(path.join(root, 'node_modules', 'fixture', 'test.pem'), '');

    const inventory = collectInspectableFiles(root, { hasGitWorkTree: () => false });

    assert.equal(inventory.mode, 'filesystem');
    assert.deepEqual(inventory.files, [
      'backend/data/civilization.db',
      'backend/server.js',
    ]);
    assert.deepEqual(inventory.files.filter(isForbidden), [
      'backend/data/civilization.db',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
