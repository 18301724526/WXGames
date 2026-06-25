const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isApprovedGrowthPath,
  isInScopeFinding,
  parseBaselineFindings,
  parseFormat,
  scanInputIntentSpine,
} = require('./check-frontend-ecs-input-intent-spine');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-input-spine-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('input intent spine guard parses 0B File-first baseline rows', () => {
  const findings = parseBaselineFindings(
    [
      '# Report',
      '',
      '## Findings',
      '',
      '| File | Line | Surface | Branch Kind | Symbols | Action Type | Evidence | Note |',
      '| --- | ---: | --- | --- | --- | --- | --- | --- |',
      '| frontend/js/platform/CanvasGameAppInputRouter.js | 32 | input-router | mode | activeTab | | `x` | y |',
    ].join('\n'),
  );

  assert.deepEqual(findings, [
    {
      file: 'frontend/js/platform/CanvasGameAppInputRouter.js',
      line: 32,
      surface: 'input-router',
      branchKind: 'mode',
    },
  ]);
});

test('input intent spine guard scopes to input-router mode/runtime-route branches only', () => {
  assert.equal(isInScopeFinding({ surface: 'input-router', branchKind: 'mode' }), true);
  assert.equal(isInScopeFinding({ surface: 'input-router', branchKind: 'runtime-route' }), true);
  assert.equal(isInScopeFinding({ surface: 'input-router', branchKind: 'panel' }), false);
  assert.equal(isInScopeFinding({ surface: 'input-router', branchKind: 'tutorial' }), false);
  assert.equal(isInScopeFinding({ surface: 'input-router', branchKind: 'action' }), false);
  assert.equal(isInScopeFinding({ surface: 'command-handler', branchKind: 'mode' }), false);
});

test('input intent spine guard allows the approved owner/bundle/bridge paths only', () => {
  assert.equal(isApprovedGrowthPath('frontend/js/ecs/input/InputIntentResolver.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/ecs/runtime/EcsModeRuntimeBundle.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/platform/CanvasModeOwnershipBridge.js'), true);
  assert.equal(isApprovedGrowthPath('frontend/js/platform/CanvasGameAppInputRouter.js'), false);
});

test('input intent spine guard blocks net-new input-router mode branches', () =>
  withTempRepo((repoRoot) => {
    const baselinePath = 'baseline.md';
    writeFile(
      repoRoot,
      baselinePath,
      [
        '## Findings',
        '',
        '| File | Line | Surface | Branch Kind | Symbols | Action Type | Evidence | Note |',
        '| --- | ---: | --- | --- | --- | --- | --- | --- |',
        '| frontend/js/platform/CanvasGameAppInputRouter.js | 1 | input-router | mode | activeTab | | `x` | y |',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasGameAppInputRouter.js',
      ['if (this.activeTab === "city") {}', 'if (this.activeTab === "tech") {}'].join('\n'),
    );

    const report = scanInputIntentSpine({ repoRoot, baselinePath });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/CanvasGameAppInputRouter.js');
    assert.equal(report.violations[0].branchKind, 'mode');
    assert.equal(report.violations[0].currentCount, 2);
    assert.equal(report.violations[0].baselineCount, 1);
  }));

test('input intent spine guard accepts an unchanged baseline', () =>
  withTempRepo((repoRoot) => {
    const baselinePath = 'baseline.md';
    writeFile(
      repoRoot,
      baselinePath,
      [
        '## Findings',
        '',
        '| File | Line | Surface | Branch Kind | Symbols | Action Type | Evidence | Note |',
        '| --- | ---: | --- | --- | --- | --- | --- | --- |',
        '| frontend/js/platform/CanvasGameAppInputRouter.js | 1 | input-router | mode | activeTab | | `x` | y |',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasGameAppInputRouter.js',
      'if (this.activeTab === "city") {}\n',
    );

    const report = scanInputIntentSpine({ repoRoot, baselinePath });
    assert.equal(report.summary.totalViolations, 0);
  }));

test('input intent spine guard leaves panel branches report-only (out of scope)', () =>
  withTempRepo((repoRoot) => {
    const baselinePath = 'baseline.md';
    writeFile(repoRoot, baselinePath, ['## Findings', ''].join('\n'));
    writeFile(
      repoRoot,
      'frontend/js/platform/CanvasGameShellInputRouter.js',
      'if (this.showSettings) {}\n',
    );

    const report = scanInputIntentSpine({ repoRoot, baselinePath });
    assert.equal(report.summary.totalViolations, 0);
  }));

test('input intent spine guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
