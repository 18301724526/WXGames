const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findBlockingPanelOpensInText,
  isApprovedPath,
  isGrandfatheredPath,
  parseFormat,
  scanBlockingPanelOwnership,
} = require('./check-frontend-ecs-blocking-panel-ownership');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-blocking-panel-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'docs', 'development_logs'), { recursive: true });
    writeFile(
      repoRoot,
      'docs/development_logs/2026-06-25-frontend-ecs-0a-mode-ownership-baseline.md',
      ['## Findings', '| `showTaskCenter` | frontend/js/platform/Legacy.js | 1 |'].join('\n'),
    );
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('blockingPanel ownership guard allows the approved bridge path', () => {
  assert.equal(isApprovedPath('frontend/js/platform/CanvasModeOwnershipBridge.js'), true);
  assert.equal(isApprovedPath('frontend/js/platform/CanvasShellActionHandlers.js'), false);
  assert.equal(
    isGrandfatheredPath('frontend/js/tutorial/TutorialGuideUiStateCoordinator.js'),
    true,
  );
});

test('blockingPanel ownership guard allows legacy mirror clears', () => {
  const findings = findBlockingPanelOpensInText(
    'frontend/js/platform/Legacy.js',
    [
      'this.showSettings = false;',
      "this.activeCommandPanel = '';",
      'this.techDetailOpen = false;',
    ].join('\n'),
  );
  assert.deepEqual(findings, []);
});

test('blockingPanel ownership guard blocks dynamic command panel opens', () => {
  const findings = findBlockingPanelOpensInText(
    'frontend/js/platform/CanvasShellActionHandlers.js',
    'this.host.activeCommandPanel = panel;',
  );
  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['activeCommandPanel'],
  );
});

test('blockingPanel ownership guard ignores command panel comparisons', () => {
  const findings = findBlockingPanelOpensInText(
    'frontend/js/platform/CanvasShellActionHandlers.js',
    "return this.host.activeCommandPanel === 'tech';",
  );
  assert.deepEqual(findings, []);
});

test('blockingPanel ownership guard grandfathers tutorial coordinator scattered opens', () => {
  const findings = findBlockingPanelOpensInText(
    'frontend/js/tutorial/TutorialGuideUiStateCoordinator.js',
    "game.activeCommandPanel = 'buildings';\n",
  );
  assert.deepEqual(findings, []);
});

test('blockingPanel ownership guard blocks non-owner canonical opens', () => {
  const findings = findBlockingPanelOpensInText(
    'frontend/js/platform/CanvasShellActionHandlers.js',
    [
      'this.host.showSettings = true;',
      "this.host.activeCommandPanel = 'tech';",
      'this.host.techDetailOpen = Boolean(action.techId);',
    ].join('\n'),
  );
  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['showSettings', 'activeCommandPanel', 'techDetailOpen'],
  );
});

test('blockingPanel ownership guard grandfathers baseline opens but blocks growth', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'frontend/js/platform/Legacy.js',
      ['this.showTaskCenter = true;', 'this.showSettings = true;'].join('\n'),
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasModeOwnershipBridge.js',
      'target.showSettings = true;\n',
    );
    writeFile(repoRoot, 'frontend/js/platform/Legacy.test.js', 'this.showSettings = true;\n');

    const report = scanBlockingPanelOwnership({ repoRoot });
    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].symbol, 'showSettings');
  }));

test('blockingPanel ownership guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
