const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findRewardRevealMirrorRetirementViolationsInText,
  parseFormat,
  scanRewardRevealMirrorRetirement,
} = require('./check-frontend-ecs-rewardreveal-mirror-retirement');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-rewardreveal-retirement-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('rewardReveal mirror retirement guard blocks App/Shell mirror reads and writes', () => {
  const findings = findRewardRevealMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasGameShellSystemUi.js',
    [
      'this.rewardReveal = { rewardText: "+1" };',
      'if (host.rewardReveal) return;',
      'const reveal = game.rewardReveal;',
      "const snapshot = snapshot.modal['modal:rewardReveal'];",
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => [finding.kind, finding.symbol]),
    [
      ['mirror', 'rewardReveal'],
      ['mirror', 'rewardReveal'],
      ['mirror', 'rewardReveal'],
    ],
  );
});

test('rewardReveal mirror retirement guard allows renderer option and snapshot payloads', () => {
  const findings = findRewardRevealMirrorRetirementViolationsInText(
    'frontend/js/platform/renderers/CanvasFrameRenderer.js',
    [
      'this.renderRewardReveal(options.rewardReveal || null);',
      'if (!this.host.showRewardReveal?.(result.rewardReveal)) return;',
      'const payload = getRewardRevealSnapshot();',
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('rewardReveal mirror retirement guard blocks retired bridge wrappers', () => {
  const findings = findRewardRevealMirrorRetirementViolationsInText(
    'frontend/js/platform/CanvasModeOwnershipRuntime.js',
    [
      'openRewardRevealModal(state) { return this.openModal(state); }',
      'this.closeRewardRevealOwner?.();',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['openRewardRevealModal', 'closeRewardRevealOwner'],
  );
});

test('rewardReveal mirror retirement guard scans production frontend files', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'frontend/js/platform/Legacy.js',
      'this.rewardReveal = { rewardText: "+1" };\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/Allowed.js',
      "const x = snapshot.modal['modal:rewardReveal'];\n",
    );
    writeFile(repoRoot, 'frontend/js/platform/Legacy.test.js', 'this.rewardReveal = {};\n');

    const report = scanRewardRevealMirrorRetirement({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/Legacy.js');
  }));

test('rewardReveal mirror retirement guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
