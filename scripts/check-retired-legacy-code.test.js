const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findRetiredFileOffenders,
  findRetiredLayerImportOffendersInText,
  findRetiredLayerPathOffenders,
  findRetiredLayerTokenOffendersInText,
  findRetiredSymbolsInText,
  findRetiredSymbolOffenders,
  hasRetiredSymbol,
  isActiveProductionSource,
} = require('./check-retired-legacy-code');

const RETIRED = ['do', 'main'].join('');
const RETIRED_UPPER = RETIRED.toUpperCase();
const RETIRED_MODEL_TOKEN = `${'Do'}${'main'}`;

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
    'frontend/js/platform/CanvasBlockingPanelSnapshotCalls.js',
    'frontend/js/platform/renderers/HomeCanvasRenderer.js',
    'frontend/js/state/presenters/WorldRadarPresenter.js',
    'frontend/js/platform/renderers/WorldMapCanvasRenderer.js',
  ], { exists: () => true }), [
    'frontend/js/platform/CanvasBlockingPanelSnapshotCalls.js',
    'frontend/js/platform/renderers/HomeCanvasRenderer.js',
    'frontend/js/state/presenters/WorldRadarPresenter.js',
  ]);
});

test('retired legacy guard blocks retired layer paths', () => {
  assert.deepEqual(findRetiredLayerPathOffenders([
    `backend/${RETIRED}/BuildingState.js`,
    `frontend/js/${RETIRED}/TileCoord.js`,
    `frontend/js/ecs/${RETIRED}/Battle${RETIRED_MODEL_TOKEN}Owner.js`,
    'backend/modules/BuildingState.js',
  ], { exists: () => true }), [
    `backend/${RETIRED}/BuildingState.js`,
    `frontend/js/${RETIRED}/TileCoord.js`,
    `frontend/js/ecs/${RETIRED}/Battle${RETIRED_MODEL_TOKEN}Owner.js`,
  ]);
});

test('retired legacy guard blocks retired layer imports in active code', () => {
  const offenders = findRetiredLayerImportOffendersInText(
    'backend/services/CityService.js',
    `const BuildingState = require('../${RETIRED}/BuildingState');\n`,
  );
  assert.deepEqual(offenders, [
    {
      file: 'backend/services/CityService.js',
      line: 1,
      evidence: `const BuildingState = require('../${RETIRED}/BuildingState');`,
    },
  ]);
});

test('retired legacy guard blocks retired layer tokens in active code', () => {
  const offenders = findRetiredLayerTokenOffendersInText(
    'backend/services/random/Bad.js',
    [
      '// current battle domain adapter',
      `const DEFAULT_${RETIRED_UPPER} = 'gameplay';`,
      `const scope = input.${RETIRED};`,
      'const ok = input.scope;',
    ].join('\n'),
  );
  assert.deepEqual(offenders, [
    {
      file: 'backend/services/random/Bad.js',
      line: 2,
      evidence: `const DEFAULT_${RETIRED_UPPER} = 'gameplay';`,
    },
    {
      file: 'backend/services/random/Bad.js',
      line: 3,
      evidence: `const scope = input.${RETIRED};`,
    },
  ]);
});

test('retired legacy guard does not block ordinary words containing retired token text', () => {
  const offenders = findRetiredLayerTokenOffendersInText(
    'backend/services/battle/BattleSimService.js',
    [
      '// entity-based simulation; callers adapt their domain state into this request',
      'const domainSnapshot = createBattleRequest(input);',
      'const ok = "kingdom";',
    ].join('\n'),
  );
  assert.deepEqual(offenders, []);
});

test('retired legacy guard reports retired symbols from text', () => {
  const symbols = findRetiredSymbolsInText('renderer.renderWorldScoutUnitsLegacy(); controller.openTalentPolicy();');
  assert.equal(symbols.includes('renderWorldScoutUnitsLegacy'), true);
  assert.equal(symbols.includes('openTalentPolicy'), true);
  assert.equal(findRetiredSymbolsInText('global.CanvasBlockingPanelSnapshotCalls = api;').includes('CanvasBlockingPanelSnapshotCalls'), true);
});

test('retired legacy guard matches exact symbols without blocking current plural preload helpers', () => {
  assert.equal(hasRetiredSymbol('renderer.renderWorldScoutUnitsLegacy();', 'renderWorldScoutUnitsLegacy'), true);
  assert.equal(hasRetiredSymbol('CanvasPreloadAssetManifest.getWorldScoutUnitFramePaths();', 'getWorldScoutUnitFramePath'), false);
  assert.deepEqual(findRetiredSymbolsInText('getWorldScoutUnitFramePaths();'), []);
});
