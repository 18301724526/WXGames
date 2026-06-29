const test = require('node:test');
const assert = require('node:assert/strict');

require('../foundation/WorldTime');
require('../system/WorldMarchProgressSnapshot');
require('./WorldMapVisibilityModel');
require('./WorldFogVisualSnapshot');
require('../system/WorldMarchSystem');
const FogProjection = require('./FogProjection');
const WorldMapRenderSnapshot = require('./WorldMapRenderSnapshot');

function createTileMapView() {
  return {
    version: 7,
    seed: 'fog-projection',
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, visibility: 'controlled', discovered: true, visible: true },
      { id: 'tile_1_0', q: 1, r: 0, visibility: 'unknown', discovered: false, visible: false },
    ],
  };
}

test('FogProjection returns fog renderer context without sharing world-map components', () => {
  const tileMapView = createTileMapView();
  const renderSnapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView,
    x: 0,
    y: 0,
    width: 360,
    height: 300,
  });
  const entries = [{ tile: tileMapView.tiles[0] }];
  const projection = FogProjection.createFogProjection({
    renderSnapshot,
    entries,
  });

  assert.equal(projection.schema, 'fog-projection-v1');
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(projection.fogVisualSnapshot.schema, 'world-fog-visual-snapshot-v1');
  assert.equal(projection.rendererContext.fogVisualSnapshot, projection.fogVisualSnapshot);
  assert.deepEqual(projection.rendererContext.entries, entries);
  assert.equal(Object.prototype.hasOwnProperty.call(projection, 'worldMapSnapshot'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projection, 'tileMapContext'), false);
});

test('FogProjection refreshes live fog actors from current epoch', () => {
  const startedAt = Date.parse('2026-06-06T00:00:00.000Z');
  const mission = {
    id: 'fog-projection-live-1',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [{ q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: false }],
    target: { q: 1, r: 0, tileId: 'tile_1_0' },
    startedAt: new Date(startedAt).toISOString(),
    stepDurationMs: 10000,
    revealedTileIds: [],
  };
  const early = FogProjection.createFogProjection(
    {
      tileMapView: { ...createTileMapView(), activeScouts: [mission] },
      viewport: { originX: 0, originY: 0, scale: 1 },
      frame: { x: 0, y: 0, width: 100, height: 100 },
    },
    { epochNowMs: startedAt + 1000 },
  );
  const later = FogProjection.createFogProjection(
    {
      tileMapView: { ...createTileMapView(), activeScouts: [mission] },
      viewport: { originX: 0, originY: 0, scale: 1 },
      frame: { x: 0, y: 0, width: 100, height: 100 },
    },
    { epochNowMs: startedAt + 5000 },
  );

  assert.equal(early.rendererContext.visibilityActors.length, 1);
  assert.equal(later.rendererContext.visibilityActors.length, 1);
  assert.equal(
    early.rendererContext.visibilityActors[0].current.q <
      later.rendererContext.visibilityActors[0].current.q,
    true,
  );
  assert.notEqual(
    early.rendererContext.visibilityActors[0].renderRevealSignature,
    later.rendererContext.visibilityActors[0].renderRevealSignature,
  );
});
