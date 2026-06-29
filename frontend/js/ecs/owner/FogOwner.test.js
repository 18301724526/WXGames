const test = require('node:test');
const assert = require('node:assert/strict');

require('../foundation/WorldTime');
require('../system/WorldMarchProgressSnapshot');
require('../projection/WorldMapVisibilityModel');
require('../projection/WorldFogVisualSnapshot');
require('../system/WorldMarchSystem');
const FogOwner = require('./FogOwner');
const WorldMapRenderSnapshot = require('../projection/WorldMapRenderSnapshot');

function createTileMapView() {
  return {
    version: 7,
    seed: 'fog-owner',
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, visibility: 'controlled', discovered: true, visible: true },
      { id: 'tile_1_0', q: 1, r: 0, visibility: 'unknown', discovered: false, visible: false },
    ],
  };
}

test('FogOwner owns fog snapshot output without sharing world-map components', () => {
  const tileMapView = createTileMapView();
  const renderSnapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView,
    x: 0,
    y: 0,
    width: 360,
    height: 300,
  });
  const entries = [{ tile: tileMapView.tiles[0] }];
  const owner = FogOwner.createFogOwner({
    renderSnapshot,
    entries,
  });

  assert.equal(owner.schema, 'fog-owner-v1');
  assert.equal(Object.isFrozen(owner), true);
  assert.equal(owner.fogVisualSnapshot.schema, 'world-fog-visual-snapshot-v1');
  assert.equal(owner.rendererContext.fogVisualSnapshot, owner.fogVisualSnapshot);
  assert.deepEqual(owner.rendererContext.entries, entries);
  assert.equal(Object.prototype.hasOwnProperty.call(owner, 'worldMapSnapshot'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(owner, 'tileMapContext'), false);
});

test('FogOwner refreshes live fog actors from current epoch', () => {
  const startedAt = Date.parse('2026-06-06T00:00:00.000Z');
  const mission = {
    id: 'fog-owner-live-1',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [{ q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: false }],
    target: { q: 1, r: 0, tileId: 'tile_1_0' },
    startedAt: new Date(startedAt).toISOString(),
    stepDurationMs: 10000,
    revealedTileIds: [],
  };
  const early = FogOwner.createFogOwner(
    {
      tileMapView: { ...createTileMapView(), activeScouts: [mission] },
      viewport: { originX: 0, originY: 0, scale: 1 },
      frame: { x: 0, y: 0, width: 100, height: 100 },
    },
    { epochNowMs: startedAt + 1000 },
  );
  const later = FogOwner.createFogOwner(
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
