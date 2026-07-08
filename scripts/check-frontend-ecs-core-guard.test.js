const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findEcsCoreViolationsInText,
  isAllowedEcsImport,
  isProductionSource,
  parseFormat,
  scanEcsCoreGuard,
} = require('./check-frontend-ecs-core-guard');

const RETIRED = ['do', 'main'].join('');

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-core-guard-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', RETIRED), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'vendor'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'minigame'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'shared'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ name: 'tmp', dependencies: {} }, null, 2),
    );
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('ECS core guard scans production source roots and excludes tests/vendor', () => {
  assert.equal(isProductionSource('frontend/js/ecs/system/Foo.js'), true);
  assert.equal(isProductionSource('frontend/minigame/game.js'), true);
  assert.equal(isProductionSource('shared/worldMarchCore.js'), true);
  assert.equal(isProductionSource('frontend/js/vendor/ECSCore.js'), false);
  assert.equal(isProductionSource('frontend/js/ecs/system/Foo.test.js'), false);
  assert.equal(isProductionSource('docs/development_logs/example.js'), false);
});

test('ECS core guard allows approved bitecs imports', () => {
  assert.equal(isAllowedEcsImport('bitecs'), true);
  assert.equal(isAllowedEcsImport('bitecs/legacy'), true);
  assert.equal(isAllowedEcsImport('bitecs/serialization'), true);

  const violations = findEcsCoreViolationsInText(
    'frontend/js/ecs/system/EcsBoundary.js',
    [
      "import { createWorld, defineComponent } from 'bitecs';",
      "const legacy = require('bitecs/legacy');",
      "const serialization = require('bitecs/serialization');",
      'const createWorldTiles = () => [];',
      'const system = game.system;',
    ].join('\n'),
  );
  assert.equal(violations.length, 0);
});

test('ECS core guard blocks local core primitives and core-like files', () => {
  const violations = findEcsCoreViolationsInText(
    'frontend/js/ecs/system/ECSCore.js',
    [
      'export function createWorld() { return {}; }',
      'const defineComponent = (schema) => schema;',
      'this.entityStore = new Map();',
      'const systemScheduler = [];',
      'class QueryEngine {}',
    ].join('\n'),
  );

  assert.equal(violations.length, 6);
  assert.deepEqual(violations.map((violation) => violation.kind).sort(), [
    'local-core-class',
    'local-core-file',
    'local-core-primitive',
    'local-core-primitive',
    'local-core-storage',
    'local-core-storage',
  ]);
});

test('ECS core guard blocks non-bitecs ECS packages and unsupported bitecs subpaths', () => {
  const violations = findEcsCoreViolationsInText(
    'frontend/js/ecs/system/Foo.js',
    [
      "import { World } from 'ecsy';",
      "const custom = require('./EcsCore');",
      "import { something } from 'bitecs/internal';",
    ].join('\n'),
  );

  assert.equal(violations.length, 3);
  assert.deepEqual(violations.map((violation) => violation.kind).sort(), [
    'local-core-import',
    'non-bitecs-ecs-import',
    'unsupported-bitecs-import',
  ]);
});

test('ECS core guard scans a temporary repo and blocks dependency drift', () =>
  withTempRepo((repoRoot) => {
    fs.writeFileSync(
      path.join(repoRoot, 'package.json'),
      JSON.stringify({ name: 'tmp', dependencies: { bitecs: '^0.3.40', ecsy: '^0.4.3' } }),
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', RETIRED, 'WorldModes.js'),
      'export const createWorldTiles = () => [];\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', RETIRED, 'EcsCore.js'),
      'export function defineQuery() { return []; }\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'vendor', 'EcsCore.js'),
      'export function defineComponent() { return {}; }\n',
    );

    const report = scanEcsCoreGuard({ repoRoot });
    assert.equal(report.filesScanned, 2);
    assert.equal(report.summary.totalViolations, 3);
    assert.deepEqual(report.violations.map((violation) => violation.kind).sort(), [
      'local-core-file',
      'local-core-primitive',
      'non-bitecs-ecs-dependency',
    ]);
  }));

test('ECS core guard rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
