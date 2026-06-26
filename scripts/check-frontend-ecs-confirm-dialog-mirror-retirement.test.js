const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findConfirmDialogMirrorRetirementViolationsInText,
  parseFormat,
  scanConfirmDialogMirrorRetirement,
} = require('./check-frontend-ecs-confirm-dialog-mirror-retirement');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-confirm-retirement-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('confirmDialog mirror retirement guard blocks App/Shell mirror reads and writes', () => {
  const findings = findConfirmDialogMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasGameShellSystemUi.js',
    [
      'this.confirmDialog = { visible: true };',
      'if (uiHost.confirmDialog?.visible) return;',
      'const value = host.confirmDialog.kind;',
      "const snapshot = snapshot.modal['modal:confirmDialog'];",
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'confirmDialog'],
      ['mirror', 'confirmDialog'],
      ['mirror', 'confirmDialog'],
    ],
  );
});

test('confirmDialog mirror retirement guard allows renderer option and snapshot payloads', () => {
  const findings = findConfirmDialogMirrorRetirementViolationsInText(
    'frontend/js/platform/renderers/CanvasFrameRenderer.js',
    [
      'this.renderConfirmDialog(options.confirmDialog || null);',
      "const dialog = snapshot.modal['modal:confirmDialog'];",
      'const payload = getConfirmDialogSnapshot();',
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('confirmDialog mirror retirement guard blocks retired bridge wrappers', () => {
  const findings = findConfirmDialogMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasModeOwnershipBridge.js',
    [
      'openConfirmDialogModal(state) { return this.openModal(state); }',
      'this.closeConfirmDialogOwner?.();',
      'return updateConfirmDialogPayload({ submitting: true });',
      "host.resolveConfirmDialogCallback('onConfirm');",
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    [
      'openConfirmDialogModal',
      'closeConfirmDialogOwner',
      'updateConfirmDialogPayload',
      'resolveConfirmDialogCallback',
    ],
  );
});

test('confirmDialog mirror retirement guard scans production frontend files', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'frontend/js/platform/Legacy.js',
      'this.confirmDialog = { visible: true };\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/Allowed.js',
      "const x = snapshot.modal['modal:confirmDialog'];\n",
    );
    writeFile(repoRoot, 'frontend/js/platform/Legacy.test.js', 'this.confirmDialog = {};\n');

    const report = scanConfirmDialogMirrorRetirement({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/Legacy.js');
  }));

test('confirmDialog mirror retirement guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
