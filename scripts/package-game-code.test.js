const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldIncludeFile, collectPackageFiles } = require('./package-game-code');

test('package code bundle includes core frontend and backend source', () => {
  [
    '.gitattributes',
    '.github/workflows/ci.yml',
    '.prettierignore',
    '.prettierrc',
    'backend/server.js',
    'backend/services/WorldExplorerService.js',
    'backend/tests/WorldExplorerService.test.js',
    'eslint-suppressions.json',
    'eslint.config.js',
    'frontend/index.html',
    'frontend/style.css',
    'frontend/js/platform/CanvasGameShell.js',
    'frontend/js/ecs/system/WorldMarchSystem.test.js',
    'frontend/minigame/game.js',
    'frontend/minigame/game.json',
    'shared/buildingConfig.json',
    'package.json',
    'package-lock.json',
    'scripts/check-eslint-suppressions-budget.js',
    'scripts/package-game-code.js',
    'scripts/package-game-code.test.js',
  ].forEach((file) => assert.equal(shouldIncludeFile(file), true, file));
});

test('package code bundle excludes art, runtime data, vendor code, tools, and generated archives', () => {
  [
    'backend/civilization.db',
    'backend/civilization.db-wal',
    'backend/node_modules/express/index.js',
    'backend/ops-agent/server.js',
    'backend/logs/server.log',
    '.github/workflows/other.yml',
    'frontend/assets/art/units/spearman/move/001.png',
    'frontend/js/vendor/spine-3.8/spine-webgl.js',
    'frontend/tools/tile-map-lab.js',
    'frontend/frontend.zip',
    'backend.zip',
    'tmp/code-bundles/wxgames-code.zip',
    'password.txt',
  ].forEach((file) => assert.equal(shouldIncludeFile(file), false, file));
});

test('package code bundle keeps docs optional', () => {
  assert.equal(shouldIncludeFile('docs/current_gameplay_design_2026-06-09.md'), false);
  assert.equal(shouldIncludeFile('docs/current_gameplay_design_2026-06-09.md', { includeDocs: true }), true);
});

test('package code bundle collection does not include obvious non-code files', () => {
  const files = collectPackageFiles();
  const offenders = files.filter((file) => !shouldIncludeFile(file));
  assert.deepEqual(offenders, []);
  assert.ok(files.includes('frontend/js/ecs/system/WorldMarchSystem.js'));
  assert.ok(!files.some((file) => file.startsWith('frontend/assets/')));
  assert.ok(!files.some((file) => file.includes('/vendor/')));
  assert.ok(!files.some((file) => /\.(png|webp|zip|db|sqlite)$/i.test(file)));
});
