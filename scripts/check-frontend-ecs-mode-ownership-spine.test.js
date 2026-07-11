const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isApprovedGrowthPath,
  parseBaselineFindings,
  parseFormat,
  scanModeOwnershipSpine,
} = require('./check-frontend-ecs-mode-ownership-spine');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-mode-spine-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('mode ownership spine guard parses 0A markdown findings', () => {
  const findings = parseBaselineFindings(
    [
      '# Report',
      '',
      '## Findings',
      '',
      '| Symbol | File | Line | Role | Access | Evidence | Note |',
      '| --- | --- | ---: | --- | --- | --- | --- |',
      '| `activeTab` | frontend/js/platform/CanvasGameApp.js | 12 | adapter | read | `this.activeTab` | old |',
    ].join('\n'),
  );

  assert.deepEqual(findings, [
    {
      symbol: 'activeTab',
      file: 'frontend/js/platform/CanvasGameApp.js',
      line: 12,
    },
  ]);
});

test('mode ownership spine guard allows approved owner and runtime paths', () => {
  assert.equal(isApprovedGrowthPath('frontend/js/ecs/mode/ModeWorld.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/ecs/runtime/EcsModeRuntimeBundle.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/ecs/snapshot/RendererSnapshotBoundary.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/state/BattleStore.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/state/UiRuntimeStateStore.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/platform/CanvasModeOwnershipRuntime.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/platform/CanvasModalSnapshotAdapter.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/tutorial/TutorialHostContext.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/platform/CanvasGameApp.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/platform/CanvasGameShell.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/platform/CanvasGameAppBattleScene.js'), false);
  assert.equal(isApprovedGrowthPath('frontend/js/ecs/registry/EcsBoundaryManifest.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/platform/CanvasGameShellInputRouter.js'), false);
});

test('mode ownership spine guard blocks legacy mode finding growth by file and symbol', () =>
  withTempRepo((repoRoot) => {
    const baselinePath = 'baseline.md';
    writeFile(
      repoRoot,
      baselinePath,
      [
        '## Findings',
        '',
        '| Symbol | File | Line | Role | Access | Evidence | Note |',
        '| --- | --- | ---: | --- | --- | --- | --- |',
        '| `activeTab` | frontend/js/platform/LegacyRouter.js | 1 | adapter | read | `this.activeTab` | old |',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/LegacyRouter.js',
      ['if (host?.activeTab === "city") {}', 'if (host?.activeTab === "tech") {}'].join('\n'),
    );
    writeFile(repoRoot, 'frontend/js/ecs/mode/ModeResolver.js', 'const key = facts.activeTab;\n');
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasModeOwnershipRuntime.js',
      'const key = host.activeTab;\n',
    );

    const report = scanModeOwnershipSpine({ repoRoot, baselinePath });

    assert.equal(report.approvedOwnerFindings, 1);
    assert.equal(report.approvedRuntimeFindings, 1);
    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/LegacyRouter.js');
    assert.equal(report.violations[0].symbol, 'activeTab');
    assert.equal(report.violations[0].currentCount, 2);
    assert.equal(report.violations[0].baselineCount, 1);
  }));

test('mode ownership spine guard does not credit retired handler baseline to a new owner', () =>
  withTempRepo((repoRoot) => {
    const baselinePath = 'baseline.md';
    writeFile(
      repoRoot,
      baselinePath,
      [
        '## Findings',
        '',
        '| Symbol | File | Line | Role | Access | Evidence | Note |',
        '| --- | --- | ---: | --- | --- | --- | --- |',
        '| `activeTab` | frontend/js/platform/RetiredRouter.js | 1 | adapter | read | `old` | old |',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/NewRouter.js',
      'if (this.activeTab === "military") {}\n',
    );

    const report = scanModeOwnershipSpine({ repoRoot, baselinePath });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/NewRouter.js');
    assert.equal(report.violations[0].symbol, 'activeTab');
    assert.equal(report.violations[0].baselineCount, 0);
    assert.equal(report.violations[0].currentCount, 1);
  }));

test('mode ownership spine guard accepts unchanged legacy baseline', () =>
  withTempRepo((repoRoot) => {
    const baselinePath = 'baseline.md';
    writeFile(
      repoRoot,
      baselinePath,
      [
        '## Findings',
        '',
        '| Symbol | File | Line | Role | Access | Evidence | Note |',
        '| --- | --- | ---: | --- | --- | --- | --- |',
        '| `activeTab` | frontend/js/platform/LegacyRouter.js | 1 | adapter | read | `this.activeTab` | old |',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/LegacyRouter.js',
      'if (this.activeTab === "city") {}\n',
    );

    const report = scanModeOwnershipSpine({ repoRoot, baselinePath });

    assert.equal(report.summary.totalViolations, 0);
  }));

test('mode ownership spine guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
