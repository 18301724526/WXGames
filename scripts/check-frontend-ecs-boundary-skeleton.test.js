const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findBoundaryViolationsInText,
  getEcsTopLevelSegment,
  isApprovedRuntimeEcsLoad,
  isBlockedRuntimeEcsLoad,
  isBlockedEcsDependency,
  isEcsProductionFile,
  isProductionSourceFile,
  isRuntimeEntryLoadingEcs,
  parseFormat,
  scanEcsBoundarySkeleton,
} = require('./check-frontend-ecs-boundary-skeleton');

const RETIRED = ['do', 'main'].join('');

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-boundary-skeleton-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'ecs', 'core'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'ecs', 'registry'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', RETIRED), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'minigame'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'shared'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ name: 'tmp', dependencies: { bitecs: '0.4.0' } }, null, 2),
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'index.html'),
      '<script src="js/app.js"></script>\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'minigame', 'game.js'),
      "require('./boot');\n",
    );
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('ECS boundary skeleton guard scans production ECS files only', () => {
  assert.equal(isEcsProductionFile('frontend/js/ecs/core/EcsCoreBoundary.js'), true);
  assert.equal(isEcsProductionFile('frontend/js/ecs/core/EcsCoreBoundary.test.js'), false);
  assert.equal(isEcsProductionFile('frontend/js/platform/CanvasGameApp.js'), false);
  assert.equal(isEcsProductionFile('frontend/js/ecs/vendor/ignored.js'), false);
  assert.equal(isProductionSourceFile('frontend/js/ecs/system/Foo.js'), true);
  assert.equal(isProductionSourceFile('frontend/minigame/game.js'), true);
  assert.equal(isProductionSourceFile('shared/Foo.js'), true);
  assert.equal(isProductionSourceFile('frontend/js/ecs/system/Foo.test.js'), false);
});

test('ECS boundary skeleton guard allows bitecs only in the core boundary', () => {
  assert.deepEqual(
    findBoundaryViolationsInText(
      'frontend/js/ecs/core/EcsCoreBoundary.js',
      ["const core = require('bitecs');", "const legacy = require('bitecs/legacy');"].join('\n'),
    ),
    [],
  );

  const violations = findBoundaryViolationsInText(
    'frontend/js/ecs/registry/EcsBoundaryManifest.js',
    "const core = require('bitecs');",
  );

  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'direct-bitecs-import');

  const systemViolations = findBoundaryViolationsInText(
    'frontend/js/ecs/system/Foo.js',
    "const core = require('bitecs/legacy');",
  );

  assert.equal(systemViolations.length, 1);
  assert.equal(systemViolations[0].kind, 'direct-bitecs-import');
});

test('ECS boundary skeleton guard blocks unsupported bitecs subpaths in boundary', () => {
  const violations = findBoundaryViolationsInText(
    'frontend/js/ecs/core/EcsCoreBoundary.js',
    "const internal = require('bitecs/internal');",
  );

  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'unsupported-bitecs-boundary-import');
});

test('ECS boundary skeleton guard blocks reverse dependencies from ECS skeleton', () => {
  assert.equal(isBlockedEcsDependency('frontend/js/ecs/core/Foo.js', '../../platform/Foo'), true);
  assert.equal(isBlockedEcsDependency('frontend/js/ecs/core/Foo.js', '../registry/Bar'), false);

  const violations = findBoundaryViolationsInText(
    'frontend/js/ecs/core/Foo.js',
    [
      "const api = require('../../api/GameAPI');",
      "const renderer = require('../../platform/renderers/HudRenderer');",
      "const local = require('../registry/EcsBoundaryManifest');",
    ].join('\n'),
  );

  assert.deepEqual(
    violations.map((violation) => violation.kind),
    ['ecs-reverse-dependency', 'ecs-reverse-dependency'],
  );
});

test('ECS boundary skeleton guard blocks runtime object references in internal ECS surfaces', () => {
  const violations = findBoundaryViolationsInText(
    'frontend/js/ecs/registry/EcsBoundaryManifest.js',
    [
      'const node = document.body;',
      'const ctx = canvas.getContext("2d");',
      'const pending = Promise.resolve();',
      'class LocalComponent {}',
    ].join('\n'),
  );

  assert.deepEqual(
    violations.map((violation) => violation.kind),
    ['dom-reference', 'canvas-reference', 'promise-reference', 'class-instance-reference'],
  );
});

test('ECS boundary skeleton guard allows gameplay ECS loads and blocks internal entrypoint loads', () => {
  assert.equal(
    isRuntimeEntryLoadingEcs('frontend/index.html', 'js/ecs/core/EcsCoreBoundary.js'),
    true,
  );
  assert.equal(
    isRuntimeEntryLoadingEcs('frontend/minigame/game.js', '../js/ecs/core/EcsCoreBoundary'),
    true,
  );
  assert.equal(
    isApprovedRuntimeEcsLoad(
      'frontend/index.html',
      'js/ecs/runtime/EcsModeRuntimeBundle.js?v=frontend-ecs-mode-runtime-v1',
    ),
    true,
  );
  assert.equal(
    isApprovedRuntimeEcsLoad('frontend/index.html', 'js/ecs/system/WorldFogVisionModel.js'),
    true,
  );
  assert.equal(
    isApprovedRuntimeEcsLoad('frontend/minigame/game.js', '../js/ecs/foundation/TileCoord'),
    true,
  );
  assert.equal(
    isApprovedRuntimeEcsLoad('frontend/index.html', 'js/ecs/owner/FogOwner.js'),
    false,
  );
  assert.equal(
    isBlockedRuntimeEcsLoad('frontend/index.html', 'js/ecs/owner/FogOwner.js'),
    true,
  );
  assert.equal(
    isBlockedRuntimeEcsLoad('frontend/index.html', 'js/ecs/core/EcsCoreBoundary.js'),
    true,
  );
  assert.equal(
    isApprovedRuntimeEcsLoad('frontend/minigame/game.js', '../js/ecs/runtime/EcsModeRuntimeBundle'),
    true,
  );
  assert.equal(
    isRuntimeEntryLoadingEcs('frontend/index.html', 'js/platform/CanvasGameApp.js'),
    false,
  );

  assert.deepEqual(
    findBoundaryViolationsInText(
      'frontend/index.html',
      '<script src="js/ecs/runtime/EcsModeRuntimeBundle.js?v=frontend-ecs-mode-runtime-v1"></script>',
    ),
    [],
  );
  assert.deepEqual(
    findBoundaryViolationsInText(
      'frontend/index.html',
      '<script src="js/ecs/projection/WorldMapRenderSnapshot.js?v=world-render"></script>',
    ),
    [],
  );
  assert.deepEqual(
    findBoundaryViolationsInText(
      'frontend/minigame/game.js',
      "require('../js/ecs/system/WorldMarchSystem');",
    ),
    [],
  );

  const h5Violations = findBoundaryViolationsInText(
    'frontend/index.html',
    '<script src="js/ecs/core/EcsCoreBoundary.js"></script>',
  );
  const minigameViolations = findBoundaryViolationsInText(
    'frontend/minigame/game.js',
    "require('../js/ecs/core/EcsCoreBoundary');",
  );

  assert.equal(h5Violations[0].kind, 'runtime-entry-loads-ecs');
  assert.equal(minigameViolations[0].kind, 'runtime-entry-loads-ecs');
});

test('ECS boundary skeleton guard allows class instances inside gameplay ECS modules', () => {
  assert.equal(getEcsTopLevelSegment('frontend/js/ecs/system/WorldMarchSystem.js'), 'system');
  assert.deepEqual(
    findBoundaryViolationsInText(
      'frontend/js/ecs/system/WorldFogVisionModel.js',
      [
        'const byId = new Map();',
        'const seen = new Set();',
        'const values = new Array(4);',
      ].join('\n'),
    ),
    [],
  );

  const violations = findBoundaryViolationsInText(
    'frontend/js/ecs/system/WorldFogVisionModel.js',
    [
      'const node = document.body;',
      'const ctx = canvas.getContext("2d");',
      'const pending = Promise.resolve();',
    ].join('\n'),
  );
  assert.deepEqual(
    violations.map((violation) => violation.kind),
    ['dom-reference', 'canvas-reference', 'promise-reference'],
  );
});

test('ECS boundary skeleton guard skips runtime object checks in generated bundles', () => {
  assert.deepEqual(
    findBoundaryViolationsInText(
      'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js',
      'const world = new Map();\nconst bytes = new Uint8Array(4);',
    ),
    [],
  );

  assert.deepEqual(
    findBoundaryViolationsInText(
      'frontend/js/ecs/mode/ModeComponents.js',
      "throw new Error('missing primitive');",
    ),
    [],
  );
});

test('ECS boundary skeleton guard scans a temporary repo and enforces package pin', () =>
  withTempRepo((repoRoot) => {
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'ecs', 'core', 'EcsCoreBoundary.js'),
      "const core = require('bitecs');\nconst legacy = require('bitecs/legacy');\n",
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'ecs', 'registry', 'EcsBoundaryManifest.js'),
      "module.exports = Object.freeze({ modeKeys: ['city'] });\n",
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', RETIRED, 'PureModel.js'),
      'module.exports = Object.freeze({ ok: true });\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'shared', 'SharedModel.js'),
      'module.exports = Object.freeze({ ok: true });\n',
    );

    const passing = scanEcsBoundarySkeleton({ repoRoot });
    assert.equal(passing.filesScanned, 6);
    assert.equal(passing.summary.totalViolations, 0);

    fs.writeFileSync(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ name: 'tmp', dependencies: { bitecs: '^0.4.0' } }, null, 2),
    );

    const failing = scanEcsBoundarySkeleton({ repoRoot });
    assert.equal(failing.summary.totalViolations, 1);
    assert.equal(failing.violations[0].kind, 'bitecs-version-drift');

    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', RETIRED, 'PureModel.js'),
      "const ecs = require('bitecs');\n",
    );

    const directImport = scanEcsBoundarySkeleton({ repoRoot });
    assert.equal(directImport.summary.totalViolations, 2);
    assert.equal(
      directImport.violations.some((violation) => violation.kind === 'direct-bitecs-import'),
      true,
    );
  }));

test('ECS boundary skeleton guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
