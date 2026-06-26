const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findTargetPickerWritesInText,
  isApprovedPath,
  parseFormat,
  scanTargetPickerOwnership,
} = require('./check-frontend-ecs-target-picker-ownership');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-target-picker-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('targetPicker ownership guard allows the approved bridge path', () => {
  assert.equal(isApprovedPath('frontend/js/platform/CanvasModeOwnershipBridge.js'), true);
  assert.equal(isApprovedPath('frontend/js/platform/CanvasTerritoryActionHandlers.js'), false);
});

test('targetPicker ownership guard allows legacy null mirror clears', () => {
  const findings = findTargetPickerWritesInText(
    'frontend/js/platform/Legacy.js',
    ['uiState.worldTargetPicker = null;', 'uiState.worldMarchTarget = null;'].join('\n'),
  );
  assert.deepEqual(findings, []);
});

test('targetPicker ownership guard blocks non-owner picker opens', () => {
  const findings = findTargetPickerWritesInText(
    'frontend/js/platform/CanvasTerritoryActionHandlers.js',
    [
      'uiState.worldTargetPicker = picker;',
      'uiState.worldMarchTarget = { q: 1, r: 0, pickerOpen: true };',
    ].join('\n'),
  );
  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['worldTargetPicker', 'worldMarchTarget.pickerOpen'],
  );
});

test('targetPicker ownership guard scans production frontend files', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasTerritoryActionHandlers.js',
      'uiState.worldTargetPicker = picker;\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasModeOwnershipBridge.js',
      'uiState.worldTargetPicker = picker;\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasTerritoryActionHandlers.test.js',
      'uiState.worldTargetPicker = picker;\n',
    );

    const report = scanTargetPickerOwnership({ repoRoot });
    assert.equal(report.summary.totalViolations, 1);
    assert.equal(
      report.violations[0].file,
      'frontend/js/platform/CanvasTerritoryActionHandlers.js',
    );
  }));

test('targetPicker ownership guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
