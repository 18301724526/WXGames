const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const PRODUCTION_FILES = [
  'frontend/js/platform/CanvasGameRenderer.js',
  'frontend/js/platform/renderers/CanvasAssetRenderer.js',
  'frontend/js/platform/renderers/CanvasWorldMapFacade.js',
  'frontend/js/platform/renderers/WorldMapCacheFacade.js',
  'frontend/js/platform/renderers/WorldMapCachePolicy.js',
  'frontend/js/platform/renderers/WorldMapCanvasRenderer.js',
  'frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.js',
  'frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.js',
  'frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.js',
  'frontend/js/platform/renderers/WorldMapStaticLayerRenderer.js',
  'frontend/js/platform/renderers/WorldMapTileMapRenderer.js',
];

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('worldMap layer owns only terrain/static/site work and never actor/HUD ownership', () => {
  const source = readProjectFile('frontend/js/platform/renderers/WorldMapTileMapRenderer.js');

  assert.equal(source.includes('renderWorldActors('), false);
  assert.equal(source.includes('addWorldActorHitTargets('), false);
  assert.equal(source.includes('renderWorldMarchHud('), false);
  assert.equal(source.includes('publishWorldTileMapContext'), true);
  assert.equal(source.includes('visibilityActors'), true);
  assert.equal(source.includes('context.actors = []'), true);
});

test('worldActor layer owns actor drawing and actor hit targets without command HUD', () => {
  const source = readProjectFile('frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.js');
  const actorLayerStart = source.indexOf('renderWorldMapActorLayer');
  const actorLayerSource = source.slice(actorLayerStart, source.indexOf('getEpochNowMs', actorLayerStart));

  assert.equal(actorLayerSource.includes('renderWorldActors'), true);
  assert.equal(actorLayerSource.includes('addWorldActorHitTargets'), true);
  assert.equal(actorLayerSource.includes('renderWorldMarchHud'), false);
});

test('mainHud renderers own map-home march command HUD invocation', () => {
  const frameSource = readProjectFile('frontend/js/platform/renderers/CanvasFrameRenderer.js');
  const hudSource = readProjectFile('frontend/js/platform/renderers/HudOverlayCanvasRenderer.js');

  assert.equal(frameSource.includes('renderMapHomeWorldMarchHud(state, options)'), true);
  assert.equal(hudSource.includes('renderMapHomeWorldMarchHud(state, options)'), true);
});

test('mainHud map-home world viewport stays transparent instead of clear-cutting the HUD canvas', () => {
  const source = readProjectFile('frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.js');

  assert.equal(source.includes('clearRect'), false);
  assert.equal(source.includes('this.drawPanel(x, y, width, height'), false);
  assert.equal(source.includes('hitTargetsOnly: skipWorldMapLayer'), true);
});

test('retired scout route cache API stays out of production renderers', () => {
  const retiredSymbols = [
    'worldTileScoutRouteCache',
    'getWorldTileScoutRouteCache',
    'renderWorldScoutRouteLayer',
    'renderScoutRoutesIntoCache',
  ];

  PRODUCTION_FILES.forEach((file) => {
    const source = readProjectFile(file);
    retiredSymbols.forEach((symbol) => {
      assert.equal(source.includes(symbol), false, `${symbol} should stay retired in ${file}`);
    });
  });
});

test('architecture smoke registers the world-map layer ownership contract', () => {
  const smoke = readProjectFile('scripts/run-architecture-smoke.js');

  assert.equal(smoke.includes('frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js'), true);
});
