const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  collectFieldNames,
  collectMethodNames,
  countBranchTokens,
  findBridgeCandidatesInText,
  isProductionFrontendSource,
  parseFormat,
  renderSummary,
  scanBridgeShrink,
} = require('./report-frontend-ecs-bridge-shrink');

test('bridge shrink report scans production frontend sources only', () => {
  assert.equal(isProductionFrontendSource('frontend/js/platform/CanvasGameAppCommands.js'), true);
  assert.equal(isProductionFrontendSource('frontend/js/vendor/spine-3.8/spine-webgl.js'), false);
  assert.equal(
    isProductionFrontendSource('frontend/js/platform/CanvasGameAppCommands.test.js'),
    false,
  );
  assert.equal(isProductionFrontendSource('backend/services/GameStateService.js'), false);
});

test('bridge shrink report counts branches and extracts fields and methods', () => {
  const lines = [
    'openPanel() {',
    '  if (this.activeTab) this.showTaskCenter = true;',
    '  host.activeEventId = null;',
    '}',
  ];
  assert.equal(countBranchTokens(lines), 1);
  assert.deepEqual(collectFieldNames(lines), ['activeEventId', 'showTaskCenter']);
  assert.deepEqual(collectMethodNames(['    openPanel() {', 'function installFoo() {}']), [
    'installFoo',
    'openPanel',
  ]);
});

test('bridge shrink report detects prototype and file-level surfaces', () => {
  const source = [
    'function install(CanvasGameApp) {',
    '  Object.assign(CanvasGameApp.prototype, {',
    '    openPanel() {',
    '      if (this.activeTab) this.showTaskCenter = true;',
    '    },',
    '  });',
    '}',
    'Renderer.prototype.delegate = function delegate() { if (this.host) return true; };',
  ].join('\n');

  const candidates = findBridgeCandidatesInText(
    'frontend/js/platform/CanvasGameAppCommands.js',
    source,
  );
  assert.equal(
    candidates.some((candidate) => candidate.surface === 'Object.assign prototype installer'),
    true,
  );
  assert.equal(
    candidates.some((candidate) => candidate.surface === 'direct prototype assignment'),
    true,
  );
  assert.equal(
    candidates.some((candidate) => candidate.surface === 'facade/bridge file surface'),
    true,
  );
});

test('bridge shrink report can scan a temporary repo baseline', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-bridge-report-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'platform'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'vendor'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasGameAppCommands.js'),
      [
        'Object.assign(CanvasGameApp.prototype, {',
        '  saveFormation() { if (this.armyFormationEditor) return true; },',
        '});',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasGameAppCommands.test.js'),
      'Object.assign(Test.prototype, {});\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'vendor', 'ignored.js'),
      'Object.assign(Vendor.prototype, {});\n',
    );

    const report = scanBridgeShrink({ repoRoot });
    assert.equal(report.filesScanned, 1);
    assert.equal(report.summary.totalCandidates, 2);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('bridge shrink report is a blocking gate', () => {
  const report = {
    sourceRoot: 'frontend/js',
    filesScanned: 1,
    summary: {
      totalCandidates: 1,
      totalBranches: 0,
      bySurface: { 'direct prototype assignment': 1 },
    },
  };
  assert.match(renderSummary(report), /blocking gate/);
  assert.match(renderSummary(report), /FAILED/);
});

test('bridge shrink report rejects unknown CLI flags', () => {
  assert.throws(() => parseFormat(['--wat']), /unknown arguments/);
  assert.equal(parseFormat(['--markdown', '--summary']), 'markdown');
});
