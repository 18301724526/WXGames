const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  discoverContractTests,
  isContractTestFile,
  uniqueFiles,
} = require('./run-architecture-smoke');

test('architecture smoke discovers contract tests automatically', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-smoke-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'backend', 'tests'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'frontend', 'js', 'World.contract.test.js'), '');
    fs.writeFileSync(path.join(repoRoot, 'backend', 'tests', 'AdminBoundaryContract.test.js'), '');
    fs.writeFileSync(path.join(repoRoot, 'scripts', 'deploy.contract.test.js'), '');
    fs.writeFileSync(path.join(repoRoot, 'frontend', 'js', 'ordinary.test.js'), '');

    assert.deepEqual(discoverContractTests(repoRoot), [
      'backend/tests/AdminBoundaryContract.test.js',
      'frontend/js/World.contract.test.js',
      'scripts/deploy.contract.test.js',
    ]);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('architecture smoke identifies supported contract test names', () => {
  assert.equal(isContractTestFile('backend/tests/AdminBoundaryContract.test.js'), true);
  assert.equal(isContractTestFile('frontend/js/World.contract.test.js'), true);
  assert.equal(isContractTestFile('frontend/js/World.test.js'), false);
});

test('architecture smoke removes duplicate test entries while preserving order', () => {
  assert.deepEqual(uniqueFiles(['a.test.js', 'b.test.js', 'a.test.js']), [
    'a.test.js',
    'b.test.js',
  ]);
});
