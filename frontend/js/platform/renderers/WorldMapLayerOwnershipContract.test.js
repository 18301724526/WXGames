const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const PRODUCTION_FILES = [
  'frontend/js/platform/CanvasGameRenderer.js',
  'frontend/js/platform/renderers/CanvasAssetRenderer.js',
  'frontend/js/platform/renderers/WorldMapCachePolicy.js',
  'frontend/js/platform/renderers/WorldMapCanvasRenderer.js',
  'frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.js',
  'frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.js',
  'frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.js',
  'frontend/js/platform/renderers/WorldMapStaticLayerRenderer.js',
  'frontend/js/platform/renderers/WorldMapTileMapRenderer.js',
];
const RETIRED_FACADE_FILES = [
  'frontend/js/platform/CanvasGameRendererCoreFacades.js',
  'frontend/js/platform/CanvasGameRendererPageFacades.js',
  'frontend/js/platform/CanvasBattleActionHandlers.js',
  'frontend/js/platform/CanvasCityActionHandlers.js',
  'frontend/js/platform/CanvasExpeditionActionHandlers.js',
  'frontend/js/platform/CanvasFamousActionHandlers.js',
  'frontend/js/platform/CanvasShellActionHandlers.js',
  'frontend/js/platform/CanvasTerritoryActionHandlers.js',
  'frontend/js/platform/CanvasWorldMarchActionHandlers.js',
  'frontend/js/platform/renderers/CanvasBattleFacade.js',
  'frontend/js/platform/renderers/CanvasWorldMapFacade.js',
  'frontend/js/platform/renderers/BattleLayoutModel.js',
  'frontend/js/platform/renderers/BattleSpriteRenderer.js',
  'frontend/js/platform/renderers/WorldMapCacheConfigFacade.js',
  'frontend/js/platform/renderers/WorldMapCacheFacade.js',
  'frontend/js/platform/renderers/WorldMapHitTargetFacade.js',
  'frontend/js/platform/renderers/WorldMapLayoutFacade.js',
  'frontend/js/platform/renderers/WorldMapRenderUtilityFacade.js',
  'frontend/js/platform/renderers/WorldActorLayerManager.js',
  'frontend/js/platform/renderers/WorldMapCacheCoordinator.js',
  'frontend/js/platform/renderers/WorldMapHitTargetCollector.js',
];

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function projectFileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
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
  const actorLayerStart = source.indexOf('renderWorldMapActorLayer(state');
  const actorLayerSource = source.slice(actorLayerStart);

  assert.equal(actorLayerSource.includes('renderWorldActors'), true);
  assert.equal(actorLayerSource.includes('addWorldActorHitTargets'), true);
  assert.equal(actorLayerSource.includes('renderWorldMarchHud'), false);
});

test('worldActor overlay has a physical canvas and refuses shared terrain ctx rendering', () => {
  const shellSource = readProjectFile('frontend/js/platform/CanvasGameShell.js');
  const canvasRenderer = readProjectFile('frontend/js/platform/renderers/WorldMapCanvasRenderer.js');
  const layerRenderer = readProjectFile('frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.js');

  assert.equal(shellSource.includes("ensureCanvasLayer?.('worldActor'"), true);
  assert.equal(shellSource.includes('worldActorOverlaySeparate'), true);
  assert.equal(canvasRenderer.includes('terrainCtx && targetCtx && terrainCtx === targetCtx'), true);
  assert.equal(layerRenderer.includes('getWorldActorOverlayLayerRenderer'), true);
  assert.equal(layerRenderer.includes('__worldActorOverlayDelegated'), true);
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

test('retired facade, mixin, and action-handler files stay deleted', () => {
  RETIRED_FACADE_FILES.forEach((file) => {
    assert.equal(projectFileExists(file), false, `${file} must stay deleted`);
  });
});
