const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('worldMap layer owns only terrain/static/site work and never actor/HUD ownership', () => {
  const source = readProjectFile('frontend/js/platform/renderers/WorldMapTileMapRenderer.js');

  assert.equal(source.includes('renderWorldActors('), false);
  assert.equal(source.includes('addWorldActorHitTargets('), false);
  assert.equal(source.includes('renderWorldMarchHud('), false);
  assert.equal(source.includes('publishWorldTileMapContext'), true);
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

test('architecture smoke registers the world-map layer ownership contract', () => {
  const smoke = readProjectFile('scripts/run-architecture-smoke.js');

  assert.equal(smoke.includes('frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js'), true);
});
