const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  CANONICAL,
  findBlockingPanelDefsInText,
  scanBlockingPanelCalls,
  parseFormat,
} = require('./check-frontend-blocking-panel-snapshot-calls');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blocking-panel-calls-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('flags a local re-definition of a blocking-panel wrapper', () => {
  const findings = findBlockingPanelDefsInText(
    'frontend/js/platform/Foo.js',
    [
      'function openBlockingPanelSnapshot(host, panelKey, value = true) {',
      'function closeBlockingPanelSnapshot(host, panelKey) {',
      'function isBlockingPanelSnapshotOpen(host, panelKey) {',
    ].join('\n'),
  );
  assert.deepEqual(findings.map((f) => f.symbol), [
    'openBlockingPanelSnapshot',
    'closeBlockingPanelSnapshot',
    'isBlockingPanelSnapshotOpen',
  ]);
});

test('allows referencing the single source via destructure (no def)', () => {
  const findings = findBlockingPanelDefsInText(
    'frontend/js/platform/Foo.js',
    "const { openBlockingPanelSnapshot, closeBlockingPanelSnapshot } = global.CanvasBlockingPanelSnapshotCalls || {};",
  );
  assert.deepEqual(findings, []);
});

test('scans frontend, allowlists the 2 canonical definers, skips tests', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/platform/CanvasBlockingPanelSnapshotCalls.js', 'function openBlockingPanelSnapshot(h, k, v) {}\n');
    writeFile(repoRoot, 'frontend/js/platform/CanvasModalSnapshotAdapter.js', 'function closeBlockingPanelSnapshot(h, k) {}\n');
    writeFile(repoRoot, 'frontend/js/platform/Bad.js', 'function openBlockingPanelSnapshot(h, k, v) {}\n');
    writeFile(repoRoot, 'frontend/js/platform/Bad.test.js', 'function isBlockingPanelSnapshotOpen(h, k) {}\n');

    const report = scanBlockingPanelCalls({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/Bad.js');
    assert.equal(report.violations[0].symbol, 'openBlockingPanelSnapshot');
  }));

test('canonical path constant points at the single source', () => {
  assert.equal(CANONICAL, 'frontend/js/platform/CanvasBlockingPanelSnapshotCalls.js');
});

test('rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--nope']), /unknown arguments/);
});
