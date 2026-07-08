const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findRendererSnapshotReadsInText,
  isApprovedPath,
  isRendererSnapshotSurface,
  parseFormat,
  scanRendererSnapshotBoundary,
} = require('./check-frontend-ecs-renderer-snapshot-boundary');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-renderer-snapshot-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'docs', 'development_logs'), { recursive: true });
    writeFile(
      repoRoot,
      'docs/development_logs/2026-06-25-frontend-ecs-batch-6a-snapshot-boundary.md',
      [
        '## Guard Baseline',
        '',
        '| Symbol | File | Count |',
        '| --- | --- | ---: |',
        '| `showTaskCenter` | `frontend/js/platform/renderers/LegacyRenderer.js` | 1 |',
      ].join('\n'),
    );
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('renderer snapshot boundary guard identifies renderer surfaces and approved paths', () => {
  assert.equal(
    isRendererSnapshotSurface('frontend/js/platform/renderers/CityPanelRenderer.js'),
    true,
  );
  assert.equal(isRendererSnapshotSurface('frontend/js/platform/WorldMapRuntime.js'), true);
  assert.equal(
    isRendererSnapshotSurface('frontend/js/platform/CanvasCityActionHandlers.js'),
    false,
  );
  assert.equal(isApprovedPath('frontend/js/ecs/snapshot/RendererSnapshotBoundary.js'), true);
});

test('renderer snapshot boundary guard allows approved snapshot adapter reads', () => {
  const findings = findRendererSnapshotReadsInText(
    'frontend/js/ecs/snapshot/RendererSnapshotBoundary.js',
    'const open = host.showTaskCenter || host.activeCommandPanel;',
  );
  assert.deepEqual(findings, []);
});

test('renderer snapshot boundary guard detects direct covered reads', () => {
  const findings = findRendererSnapshotReadsInText(
    'frontend/js/platform/renderers/PanelRenderer.js',
    [
      'if (host.showTaskCenter) drawTaskCenter();',
      "const panel = game.activeCommandPanel || '';",
      'return shell?.territoryUiState?.worldTargetPicker;',
    ].join('\n'),
  );

  assert.deepEqual(
    findings.map((finding) => finding.symbol),
    ['showTaskCenter', 'activeCommandPanel', 'territoryUiState'],
  );
});

test('renderer snapshot boundary guard ignores direct writes and non-renderer files', () => {
  assert.deepEqual(
    findRendererSnapshotReadsInText(
      'frontend/js/platform/renderers/PanelRenderer.js',
      [
        'host.showTaskCenter = false;',
        "game.activeCommandPanel = '';",
        'shell.techDetailOpen = false;',
      ].join('\n'),
    ),
    [],
  );
  assert.deepEqual(
    findRendererSnapshotReadsInText(
      'frontend/js/platform/CanvasShellActionHandlers.js',
      'if (host.showTaskCenter) return;',
    ),
    [],
  );
});

test('renderer snapshot boundary guard grandfathers baseline reads but blocks growth', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'frontend/js/platform/renderers/LegacyRenderer.js',
      ['if (host.showTaskCenter) drawTaskCenter();', 'if (host.showSettings) drawSettings();'].join(
        '\n',
      ),
    );
    writeFile(
      repoRoot,
      'frontend/js/ecs/snapshot/RendererSnapshotBoundary.js',
      'if (host.showSettings) return true;\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/renderers/LegacyRenderer.test.js',
      'if (host.showSettings) return true;\n',
    );

    const report = scanRendererSnapshotBoundary({ repoRoot });
    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].symbol, 'showSettings');
  }));

test('renderer snapshot boundary guard does not credit retired renderer baseline to a new owner', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'docs/development_logs/2026-06-25-frontend-ecs-batch-6a-snapshot-boundary.md',
      [
        '## Guard Baseline',
        '',
        '| Symbol | File | Count |',
        '| --- | --- | ---: |',
        '| `territoryUiState` | `frontend/js/platform/renderers/RetiredRenderer.js` | 1 |',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'frontend/js/platform/renderers/NewRenderer.js',
      'const uiState = options.territoryUiState || {};\n',
    );

    const report = scanRendererSnapshotBoundary({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/platform/renderers/NewRenderer.js');
    assert.equal(report.violations[0].symbol, 'territoryUiState');
    assert.equal(report.violations[0].baselineCount, 0);
    assert.equal(report.violations[0].currentCount, 1);
  }));

test('renderer snapshot boundary guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
