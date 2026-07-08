const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ALLOWLIST,
  findInlineTileIdFormatsInText,
  isScannableSource,
  parseFormat,
  scanDuplicateCoordHelpers,
} = require('./check-duplicate-coord-helpers');

function writeFile(root, filePath, text) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicate-coord-helpers-'));
  try {
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('coord-helper guard flags an inline tile_<x>_<y> format construction', () => {
  const findings = findInlineTileIdFormatsInText(
    'frontend/js/ecs/foundation/Foo.js',
    ['function tileId(q, r) {', '  return `tile_${q}_${r}`;', '}'].join('\n'),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

test('coord-helper guard allows referencing TileCoord without re-building the format', () => {
  const findings = findInlineTileIdFormatsInText(
    'frontend/js/ecs/foundation/Foo.js',
    [
      'function tileId(q, r) { return TileCoord.tileId(q, r); }',
      'const coord = TileCoord.normalizeCoord(tile);',
      'const key = coord.tileId;',
    ].join('\n'),
  );
  assert.deepEqual(findings, []);
});

test('coord-helper guard exempts the canonical + honest variant sources, tests and vendor', () => {
  assert.ok(ALLOWLIST.includes('frontend/js/ecs/foundation/TileCoord.js'));
  assert.ok(ALLOWLIST.includes('frontend/js/shared/WorldMarchCoreAdapter.js'));
  assert.ok(ALLOWLIST.includes('frontend/js/debug/WorldMarchTrace.js'));
  assert.equal(isScannableSource('frontend/js/ecs/foundation/TileCoord.js'), false);
  assert.equal(isScannableSource('frontend/js/ecs/input/WorldMapPickingModel.js'), true);
  assert.equal(isScannableSource('frontend/js/ecs/foundation/Foo.test.js'), false);
  assert.equal(isScannableSource('frontend/js/vendor/spine/x.js'), false);

  // backend + shared scope (single-source extended beyond the frontend)
  assert.ok(ALLOWLIST.includes('backend/services/worldMap/WorldMapTopology.js'));
  assert.ok(ALLOWLIST.includes('shared/worldMarchCore.js'));
  assert.equal(isScannableSource('backend/services/worldMap/WorldMapTopology.js'), false); // allowlisted canonical
  assert.equal(isScannableSource('shared/worldMarchCore.js'), false); // allowlisted canonical
  assert.equal(isScannableSource('backend/services/territory/TerritoryShared.js'), true); // in scope, scannable
  assert.equal(isScannableSource('shared/numberUtils.js'), true); // in scope, scannable
  assert.equal(isScannableSource('backend/routes/gameRoutes.js'), false); // out of scope: trace variant
  assert.equal(isScannableSource('backend/scripts/cleanup-world-explorer-ready-state.js'), false); // out of scope: script
});

test('coord-helper guard scans frontend production files, skipping allowlist + tests', () =>
  withTempRepo((repoRoot) => {
    writeFile(repoRoot, 'frontend/js/ecs/foundation/Bad.js', 'const id = `tile_${q}_${r}`;\n');
    writeFile(
      repoRoot,
      'frontend/js/ecs/foundation/Good.js',
      'const id = TileCoord.tileId(q, r);\n',
    );
    writeFile(
      repoRoot,
      'frontend/js/ecs/foundation/TileCoord.js',
      'const id = `tile_${x}_${y}`;\n',
    );
    writeFile(repoRoot, 'frontend/js/ecs/foundation/Bad.test.js', 'const id = `tile_${q}_${r}`;\n');

    const report = scanDuplicateCoordHelpers({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'frontend/js/ecs/foundation/Bad.js');
  }));

test('coord-helper guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
