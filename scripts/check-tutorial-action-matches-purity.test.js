const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectSource, checkFile } = require('./check-tutorial-action-matches-purity');

test('TutorialActionMatches purity gate accepts the production module', () => {
  assert.deepEqual(checkFile(), { ok: true, matches: [] });
});

test('TutorialActionMatches purity gate rejects CommonJS and ESM imports', () => {
  assert.equal(inspectSource("const Shell = require('./CanvasGameShell');").ok, false);
  assert.equal(inspectSource("import Game from './CanvasGameApp.js';").ok, false);
  assert.equal(inspectSource("const module = await import('./host.js');").ok, false);
});
