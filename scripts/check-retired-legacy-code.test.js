const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findRetiredFileOffenders,
  findRetiredSymbolsInText,
  findRetiredSymbolOffenders,
  hasRetiredSymbol,
  isActiveProductionSource,
} = require('./check-retired-legacy-code');

test('retired legacy guard scans active production sources only', () => {
  assert.equal(isActiveProductionSource('frontend/js/platform/renderers/WorldMapCanvasRenderer.js'), true);
  assert.equal(isActiveProductionSource('frontend/minigame/game.js'), true);
  assert.equal(isActiveProductionSource('backend/services/TerritoryService.js'), true);
  assert.equal(isActiveProductionSource('frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js'), false);
  assert.equal(isActiveProductionSource('backend/tests/GameActionRegistry.test.js'), false);
  assert.equal(isActiveProductionSource('docs/current_technical_architecture_2026-06-09.md'), false);
});

test('retired legacy guard blocks retired tracked files', () => {
  assert.deepEqual(findRetiredFileOffenders([
    'frontend/js/platform/renderers/HomeCanvasRenderer.js',
    'frontend/js/state/presenters/WorldRadarPresenter.js',
    'frontend/js/platform/renderers/WorldMapCanvasRenderer.js',
  ], { exists: () => true }), [
    'frontend/js/platform/renderers/HomeCanvasRenderer.js',
    'frontend/js/state/presenters/WorldRadarPresenter.js',
  ]);
});

test('retired legacy guard reports retired symbols from text', () => {
  const symbols = findRetiredSymbolsInText('renderer.renderWorldScoutUnitsLegacy(); controller.openTalentPolicy();');
  assert.equal(symbols.includes('renderWorldScoutUnitsLegacy'), true);
  assert.equal(symbols.includes('openTalentPolicy'), true);
});

test('retired legacy guard matches exact symbols without blocking current plural preload helpers', () => {
  assert.equal(hasRetiredSymbol('renderer.renderWorldScoutUnitsLegacy();', 'renderWorldScoutUnitsLegacy'), true);
  assert.equal(hasRetiredSymbol('CanvasPreloadAssetManifest.getWorldScoutUnitFramePaths();', 'getWorldScoutUnitFramePath'), false);
  assert.deepEqual(findRetiredSymbolsInText('getWorldScoutUnitFramePaths();'), []);
});
