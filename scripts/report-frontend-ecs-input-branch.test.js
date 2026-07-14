const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  classifyBranchKind,
  extractActionTypes,
  extractSymbols,
  findInputBranchesInText,
  isInputBranchSurface,
  isProductionFrontendSource,
  parseFormat,
  scanInputBranches,
} = require('./report-frontend-ecs-input-branch');

test('input branch report scans intended production surfaces only', () => {
  assert.equal(
    isProductionFrontendSource('frontend/js/platform/CanvasGameAppInputRouter.js'),
    true,
  );
  assert.equal(isInputBranchSurface('frontend/js/platform/CanvasGameAppInputRouter.js'), true);
  assert.equal(isInputBranchSurface('frontend/js/platform/WorldMapInputIntent.js'), true);
  assert.equal(isInputBranchSurface('frontend/js/platform/renderers/HudRenderer.js'), false);
  assert.equal(isInputBranchSurface('frontend/js/vendor/ignored.js'), false);
  assert.equal(isInputBranchSurface('frontend/js/platform/CanvasActionController.test.js'), false);
});

test('input branch report extracts symbols and action types', () => {
  assert.deepEqual(
    extractSymbols('if (this.activeTab === "military" && this.showTaskCenter) return;'),
    ['activeTab', 'showTaskCenter'],
  );
  assert.deepEqual(extractActionTypes('case "saveFormation": return dispatch(action);'), [
    'saveFormation',
  ]);
  assert.deepEqual(extractActionTypes('return { type: "openPanel" };'), ['openPanel']);
});

test('input branch report classifies branch kinds', () => {
  assert.equal(classifyBranchKind(['shouldRouteTapThroughWorldMapRuntime'], []), 'runtime-route');
  assert.equal(classifyBranchKind(['showTaskCenter'], []), 'panel');
  assert.equal(classifyBranchKind(['activeTab'], []), 'mode');
  assert.equal(classifyBranchKind(['action.type'], ['saveFormation']), 'action');
});

test('input branch report detects mode and dispatch rows', () => {
  const findings = findInputBranchesInText(
    'frontend/js/platform/CanvasGameAppInputRouter.js',
    [
      'if (this.activeTab === "military") return false;',
      'switch (action.type) {',
      'case "saveFormation": return true;',
      '}',
    ].join('\n'),
  );

  assert.equal(findings.length, 3);
  assert.equal(
    findings.some((finding) => finding.branchKind === 'mode'),
    true,
  );
  assert.equal(
    findings.some((finding) => finding.branchKind === 'action'),
    true,
  );
});

test('input branch report can scan a temporary repo baseline', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-input-branch-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'platform'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'vendor'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasGameAppInputRouter.js'),
      'if (this.activeTab === "military") return false;\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasGameAppInputRouter.test.js'),
      'if (this.activeTab === "military") return false;\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'vendor', 'ignored.js'),
      'if (this.activeTab === "military") return false;\n',
    );

    const report = scanInputBranches({ repoRoot });
    assert.equal(report.filesScanned, 1);
    assert.equal(report.summary.totalFindings, 1);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('input branch report rejects unknown CLI flags', () => {
  assert.throws(() => parseFormat(['--wat']), /unknown arguments/);
  assert.equal(parseFormat(['--json', '--summary']), 'json');
  assert.equal(parseFormat(['--markdown']), 'markdown');
});
