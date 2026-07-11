const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ENGINE_ROOT,
  checkDirectory,
  inspectSource,
} = require('./check-tutorial-engine-purity');

test('tutorial engine purity gate accepts the current engine directory', () => {
  const result = checkDirectory();

  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2));
  assert.equal(result.files.length >= 3, true);
});

test('tutorial engine purity FIRE catches a game import', () => {
  const result = inspectSource(
    "const CanvasGameApp = require('../platform/CanvasGameApp');",
    path.join(ENGINE_ROOT, 'SyntheticGameImport.js'),
  );

  assert.equal(result.ok, false);
  assert.match(result.violations[0].reason, /import escapes tutorial-engine/);
});

test('tutorial engine purity FIRE catches an ESM game import', () => {
  const result = inspectSource(
    "import CanvasGameApp from '../platform/CanvasGameApp.js';",
    path.join(ENGINE_ROOT, 'SyntheticGameImport.js'),
  );

  assert.equal(result.ok, false);
  assert.match(result.violations[0].reason, /import escapes tutorial-engine/);
});

test('tutorial engine purity gate allows local engine modules and test builtins', () => {
  const production = inspectSource(
    "const Registry = require('./StepScriptTypeRegistry');",
    path.join(ENGINE_ROOT, 'SyntheticLocalImport.js'),
  );
  const testFile = inspectSource(
    "const test = require('node:test'); const Runner = require('./StepScriptRunner');",
    path.join(ENGINE_ROOT, 'Synthetic.test.js'),
  );

  assert.equal(production.ok, true);
  assert.equal(testFile.ok, true);
});
