const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  CANONICAL_BY_HELPER,
  findDuplicateSharedHelperDefsInText,
  parseFormat,
  scanDuplicateSharedHelpers,
} = require('./check-duplicate-shared-helpers');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicate-shared-helpers-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'backend'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('shared-helper guard flags local re-definitions of number AND object helpers', () => {
  const findings = findDuplicateSharedHelperDefsInText(
    'backend/services/Foo.js',
    [
      'function toNumber(value, fallback = 0) {',
      'function toInteger(value, fallback = 0) {',
      'function toNonNegativeInteger(value, fallback = 0) {',
      'function clamp(value, min, max) {',
      'function clone(value) {',
      'function cloneIfObject(value) {',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['toNumber', 'toInteger', 'toNonNegativeInteger', 'clamp', 'clone', 'cloneIfObject'],
  );
});

test('shared-helper guard allows requiring the canonical utils and unrelated helpers', () => {
  const findings = findDuplicateSharedHelperDefsInText(
    'backend/services/Foo.js',
    [
      "const { toNumber, clamp } = require('../../shared/numberUtils');",
      "const { clone } = require('../../shared/objectUtils');",
      'const copy = clone(raw);',
      'function clonePlain(value) { return value || {}; }',
      'function cloneConfig(value) { return value; }',
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('shared-helper guard maps each helper to its canonical module in the note', () => {
  assert.equal(CANONICAL_BY_HELPER.toInteger, 'shared/numberUtils.js');
  assert.equal(CANONICAL_BY_HELPER.clone, 'shared/objectUtils.js');
  assert.equal(CANONICAL_BY_HELPER.cloneIfObject, 'shared/objectUtils.js');
});

test('shared-helper guard scans backend production files only', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'backend/services/Bad.js', 'function clone(value) {}\n');
    writeFile(
      repoRoot,
      'backend/services/Good.js',
      "const { clone } = require('../../shared/objectUtils');\n",
    );
    writeFile(
      repoRoot,
      'backend/services/Bad.test.js',
      'function toInteger(value, fallback = 0) {}\n',
    );

    const report = scanDuplicateSharedHelpers({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'backend/services/Bad.js');
    assert.equal(report.violations[0].symbol, 'clone');
  }));

test('shared-helper guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
