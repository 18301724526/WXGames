const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractFunction(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const end = source.indexOf(`function ${nextFunctionName}`, start);
  assert.notEqual(end, -1, `${nextFunctionName} should follow ${functionName}`);
  return source.slice(start, end);
}

test('world-map tap routing policy is owned only by WorldMapInputActionMap', () => {
  const shellInputRouter = read('frontend/js/platform/CanvasGameShellInputRouter.js');
  const appInputRouter = read('frontend/js/platform/CanvasGameAppInputRouter.js');

  [shellInputRouter, appInputRouter].forEach((source) => {
    const helperSource = extractFunction(
      source,
      'shouldRouteTapThroughWorldMapRuntime',
      'summarizeHandledForOperationLog',
    );
    assert.equal(
      helperSource.includes("action.type === 'worldMapDrag'"),
      false,
      'input routers must not copy world-map tap routing rules',
    );
    assert.equal(
      helperSource.includes("action.type === 'selectWorldMarchTarget' && action.background"),
      false,
      'input routers must not copy background march routing rules',
    );
  });
});

test('WorldMapRuntime fails closed when the action-map authority is unavailable', () => {
  const source = read('frontend/js/platform/WorldMapRuntime.js');
  const start = source.indexOf('resolveTapAction(point = {}, options = {})');
  assert.notEqual(start, -1, 'WorldMapRuntime.resolveTapAction should exist');
  const end = source.indexOf('\n    createTapIntent', start);
  assert.notEqual(end, -1, 'WorldMapRuntime.createTapIntent should follow resolveTapAction');
  const methodSource = source.slice(start, end);

  assert.equal(
    methodSource.includes('return this.getHitTarget(point)'),
    false,
    'runtime must not dispatch renderer hit targets when WorldMapInputActionMap is unavailable',
  );
});
