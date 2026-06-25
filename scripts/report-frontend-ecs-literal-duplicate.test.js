const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  extractActionStrings,
  extractHelperName,
  extractNormalizedCondition,
  findLiteralCandidatesInText,
  isProductionFrontendSource,
  isRegistryOwnedPath,
  parseFormat,
  scanLiteralDuplicates,
} = require('./report-frontend-ecs-literal-duplicate');

test('literal duplicate report scans production frontend sources only', () => {
  assert.equal(isProductionFrontendSource('frontend/js/platform/GameAPI.js'), true);
  assert.equal(isProductionFrontendSource('frontend/js/vendor/spine.js'), false);
  assert.equal(isProductionFrontendSource('frontend/js/platform/GameAPI.test.js'), false);
  assert.equal(isProductionFrontendSource('backend/services/GameStateService.js'), false);
});

test('literal duplicate report extracts action strings, helpers, and conditions', () => {
  assert.deepEqual(extractActionStrings('return { type: "startWorldMarch" };'), [
    'startWorldMarch',
  ]);
  assert.deepEqual(extractActionStrings('case "saveFormation": return true;'), ['saveFormation']);
  assert.equal(extractHelperName('function normalizePoint(point) {'), 'normalizePoint');
  assert.equal(extractHelperName('const clampValue = (value) => value;'), 'clampValue');
  assert.equal(
    extractNormalizedCondition('if (this.activeTab === "military" && count > 3) {'),
    'this.activeTab === "?" && count > #',
  );
});

test('literal duplicate report classifies literal candidate rows', () => {
  const result = findLiteralCandidatesInText(
    'frontend/js/platform/GameAPI.js',
    [
      'const timeout = 10000;',
      'const color = "#ff00aa";',
      'return { type: "startWorldMarch", url: "/api/world/march" };',
      'const asset = "assets/ui/icon.png";',
    ].join('\n'),
  );

  assert.equal(
    result.findings.some((finding) => finding.kind === 'numeric'),
    true,
  );
  assert.equal(
    result.findings.some((finding) => finding.kind === 'color'),
    true,
  );
  assert.equal(
    result.findings.some((finding) => finding.kind === 'action-string'),
    true,
  );
  assert.equal(
    result.findings.some((finding) => finding.kind === 'api-path'),
    true,
  );
  assert.equal(
    result.findings.some((finding) => finding.kind === 'asset-path'),
    true,
  );
});

test('literal duplicate report marks registry-owned paths separately', () => {
  assert.equal(isRegistryOwnedPath('frontend/js/config/uiConstants.js'), true);
  const result = findLiteralCandidatesInText(
    'frontend/js/config/uiConstants.js',
    'export const PANEL_WIDTH = 360;\n',
  );
  assert.equal(result.findings[0].role, 'registry-owned');
});

test('literal duplicate report can scan a temporary repo baseline', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-literal-duplicate-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'platform'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'vendor'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'GameAPI.js'),
      [
        'function normalizePoint(point) { return point; }',
        'function normalizePointCopy(point) { return point; }',
        'if (state.activeTab === "military" && count > 3) return;',
        'if (state.activeTab === "city" && count > 4) return;',
        'return { type: "saveFormation", url: "/api/formation/save" };',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'GameAPI.test.js'),
      'const timeout = 10000;\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'vendor', 'ignored.js'),
      'const n = 5;\n',
    );

    const report = scanLiteralDuplicates({ repoRoot });
    assert.equal(report.filesScanned, 1);
    assert.equal(report.summary.totalFindings > 0, true);
    assert.equal(
      report.findings.some((finding) => finding.kind === 'condition'),
      true,
    );
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('literal duplicate report rejects unknown CLI flags', () => {
  assert.throws(() => parseFormat(['--wat']), /unknown arguments/);
  assert.equal(parseFormat(['--json', '--summary']), 'json');
  assert.equal(parseFormat(['--markdown']), 'markdown');
});
