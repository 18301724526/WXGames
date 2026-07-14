const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  classifyAccess,
  extractModeSymbols,
  findModeOwnershipInText,
  isProductionFrontendSource,
  parseFormat,
  scanModeOwnership,
} = require('./report-frontend-ecs-mode-ownership');

test('mode ownership report scans production frontend sources only', () => {
  assert.equal(isProductionFrontendSource('frontend/js/platform/CanvasGameApp.js'), true);
  assert.equal(isProductionFrontendSource('frontend/js/vendor/spine-3.8/spine-webgl.js'), false);
  assert.equal(isProductionFrontendSource('frontend/js/platform/CanvasGameApp.test.js'), false);
  assert.equal(isProductionFrontendSource('backend/services/GameStateService.js'), false);
});

test('mode ownership report detects explicit mode symbols and boolean-like show flags', () => {
  assert.deepEqual(
    extractModeSymbols('this.activeTab = "military"; this.showTaskCenter = true;').sort(),
    ['activeTab', 'showTaskCenter'],
  );
  assert.deepEqual(extractModeSymbols("'shell.naming.title': 'Name',"), []);
  assert.deepEqual(extractModeSymbols('this.showFloatingText("saved");'), []);
});

test('mode ownership report classifies reads and writes', () => {
  assert.equal(classifyAccess('this.activeTab = nextTab;', 'activeTab'), 'write');
  assert.equal(
    classifyAccess('this.activeTab = state.currentTab || this.activeTab;', 'activeTab'),
    'read-write',
  );
  assert.equal(
    classifyAccess('const activeTab = requestedTab || state.currentTab;', 'activeTab'),
    'read',
  );
  assert.equal(
    classifyAccess('if (options.activeTab === "military") return;', 'activeTab'),
    'read',
  );
});

test('mode ownership report emits finding rows with role and note', () => {
  const findings = findModeOwnershipInText(
    'frontend/js/platform/CanvasGameApp.js',
    [
      'this.activeTab = "resources";',
      'if (this.activeTab === "military") this.showTaskCenter = false;',
    ].join('\n'),
  );

  assert.equal(findings.length, 3);
  assert.equal(findings[0].symbol, 'activeTab');
  assert.equal(findings[0].role, 'source-of-truth');
  assert.equal(findings[0].access, 'write');
  assert.equal(findings[2].symbol, 'showTaskCenter');
});

test('mode ownership report can scan a temporary repo baseline', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-mode-report-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'platform'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'vendor'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.js'),
      'this.activeTab = "resources";\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.test.js'),
      'this.activeTab = "test";\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'vendor', 'ignored.js'),
      'this.activeTab = "vendor";\n',
    );

    const report = scanModeOwnership({ repoRoot });
    assert.equal(report.filesScanned, 1);
    assert.equal(report.summary.totalFindings, 1);
    assert.equal(report.findings[0].file, 'frontend/js/platform/CanvasGameApp.js');
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('mode ownership report rejects unknown CLI flags', () => {
  assert.throws(() => parseFormat(['--wat']), /unknown arguments/);
  assert.equal(parseFormat(['--json', '--summary']), 'json');
});
