const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findNamingMirrorRetirementViolationsInText,
  parseFormat,
  scanNamingMirrorRetirement,
} = require('./check-frontend-ecs-naming-mirror-retirement');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-naming-retirement-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('naming mirror retirement guard blocks App/Shell mirror reads and writes', () => {
  const findings = findNamingMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasGameAppGuideUi.js',
    [
      'this.naming = { visible: true };',
      'if (canvasShell.naming?.visible) return;',
      'const value = host.naming.inputValue;',
      "const title = t('shell.naming.title');",
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'naming'],
      ['mirror', 'naming'],
      ['mirror', 'naming'],
    ],
  );
});

test('naming mirror retirement guard allows renderer option naming payloads', () => {
  const findings = findNamingMirrorRetirementViolationsInText(
    'frontend/js/platform/renderers/CanvasFrameRenderer.js',
    [
      'if (options.naming) this.renderNamingModal(options.naming);',
      "const title = this.t('shell.naming.title');",
      "const snapshot = snapshot.modal['modal:naming'];",
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('naming mirror retirement guard blocks retired naming bridge wrappers', () => {
  const findings = findNamingMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasModeOwnershipBridge.js',
    [
      'openNamingModal(state) { return this.openModal(state); }',
      'this.closeNamingOwner?.();',
      'return updateNamingPayload({ inputValue });',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['openNamingModal', 'closeNamingOwner', 'updateNamingPayload'],
  );
});

test('naming mirror retirement guard scans production frontend files', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/platform/Legacy.js', 'this.naming = { visible: true };\n');
    writeFile(
      repoRoot,
      'frontend/js/platform/Allowed.js',
      "const x = snapshot.modal['modal:naming'];\n",
    );
    writeFile(repoRoot, 'frontend/js/platform/Legacy.test.js', 'this.naming = {};\n');

    const report = scanNamingMirrorRetirement({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/Legacy.js');
  }));

test('naming mirror retirement guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
