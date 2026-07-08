const test = require('node:test');
const assert = require('node:assert/strict');

require('../foundation/WorldTime');
require('../system/WorldMarchProgressSnapshot');
const WorldMapVisibilityModel = require('./WorldMapVisibilityModel');
const WorldMapRenderSnapshot = require('./WorldMapRenderSnapshot');
const WorldFogVisualSnapshot = require('./WorldFogVisualSnapshot');

function createTileMapView() {
  return {
    version: 12,
    seed: 'fog-seed',
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    pan: { x: 0, y: 0 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, visibility: 'unknown', discovered: false, visible: false },
      { id: 'tile_1_0', q: 1, r: 0, visibility: 'unknown', discovered: false, visible: false },
      { id: 'tile_2_0', q: 2, r: 0, visibility: 'unknown', discovered: false, visible: false },
      { id: 'tile_3_0', q: 3, r: 0, visibility: 'controlled', discovered: true, visible: true },
    ],
  };
}

test('WorldFogVisualSnapshot maps visibility levels into renderer-safe fog entries', () => {
  const tileMapView = createTileMapView();
  const visibilitySnapshot = WorldMapVisibilityModel.createSnapshot({
    worldMap: {
      version: 12,
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, visibility: 'controlled' },
        { id: 'tile_1_0', q: 1, r: 0, visibility: 'visible' },
        { id: 'tile_2_0', q: 2, r: 0, visibility: 'explored', visible: false },
        { id: 'tile_3_0', q: 3, r: 0, visibility: 'unknown', discovered: false, visible: false },
      ],
    },
  });
  const renderSnapshot = WorldMapRenderSnapshot.createSnapshot(
    {
      tileMapView,
      x: 10,
      y: 90,
      width: 360,
      height: 300,
    },
    {
      nowMs: new Date('2026-06-08T00:00:00.000Z').getTime(),
    },
  );

  const snapshot = WorldFogVisualSnapshot.createSnapshot({ visibilitySnapshot, renderSnapshot });
  const entries = WorldFogVisualSnapshot.toRendererEntries(snapshot);

  assert.equal(snapshot.schema, 'world-fog-visual-snapshot-v1');
  assert.equal(snapshot.counts.total, 4);
  assert.equal(snapshot.counts.maskVisible, 2);
  assert.equal(snapshot.counts.maskExplored, 3);
  assert.deepEqual(snapshot.maskLevels, [
    WorldFogVisualSnapshot.MASK_VISIBLE,
    WorldFogVisualSnapshot.MASK_VISIBLE,
    WorldFogVisualSnapshot.MASK_EXPLORED,
    WorldFogVisualSnapshot.MASK_UNKNOWN,
  ]);
  assert.equal(entries[0].tile.discovered, true);
  assert.equal(entries[0].tile.visible, true);
  assert.equal(entries[2].tile.discovered, true);
  assert.equal(entries[2].tile.visible, false);
  assert.equal(entries[3].tile.discovered, false);
  assert.equal(entries[3].tile.visible, false);
  assert.equal(entries[1].center.x > entries[0].center.x, true);
});

test('WorldFogVisualSnapshot produces a renderer context that does not trust raw tile visibility', () => {
  const tileMapView = {
    ...createTileMapView(),
    tiles: [
      { id: 'tile_5_0', q: 5, r: 0, visibility: 'controlled', discovered: true, visible: true },
    ],
  };
  const visibilitySnapshot = WorldMapVisibilityModel.createSnapshot({
    worldMap: {
      version: 12,
      tiles: [
        { id: 'tile_5_0', q: 5, r: 0, visibility: 'unknown', discovered: false, visible: false },
      ],
    },
  });
  const renderSnapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView,
    x: 0,
    y: 0,
    width: 360,
    height: 300,
  });

  const snapshot = WorldFogVisualSnapshot.createSnapshot({ visibilitySnapshot, renderSnapshot });
  const context = WorldFogVisualSnapshot.toRendererContext(snapshot);

  assert.equal(context.tileMapView.tiles.length, 1);
  assert.equal(context.tileMapView.tiles[0].visibility, 'unknown');
  assert.equal(context.tileMapView.tiles[0].discovered, false);
  assert.equal(context.entries[0].tile.visible, false);
  assert.equal(context.fogVisualSnapshot, snapshot);
});

test('WorldFogVisualSnapshot canonicalizes fog identity and signatures through stable axes', () => {
  const xShape = {
    version: 13,
    seed: 'fog-canonical',
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [{ x: 3, y: -2, q: 90, r: 90, tileId: 'legacy-x', visibility: 'visible' }],
  };
  const legacyShape = {
    ...xShape,
    tiles: [{ q: 3, r: -2, tileId: 'legacy-q', visibility: 'visible' }],
  };
  const xSnapshot = WorldFogVisualSnapshot.createSnapshot({
    renderSnapshot: WorldMapRenderSnapshot.createSnapshot({
      tileMapView: xShape,
      width: 520,
      height: 420,
    }),
  });
  const legacySnapshot = WorldFogVisualSnapshot.createSnapshot({
    renderSnapshot: WorldMapRenderSnapshot.createSnapshot({
      tileMapView: legacyShape,
      width: 520,
      height: 420,
    }),
  });

  assert.deepEqual(xSnapshot.tileIds, ['tile_3_-2']);
  assert.deepEqual(xSnapshot.q, [3]);
  assert.deepEqual(xSnapshot.r, [-2]);
  assert.equal(xSnapshot.signature, legacySnapshot.signature);
  assert.equal(Object.prototype.hasOwnProperty.call(xSnapshot.indexById, 'legacy-x'), false);
});

test('WorldFogVisualSnapshot keeps large-map data compact and signatures stable', () => {
  const tiles = [];
  for (let i = 0; i < 5000; i += 1) {
    tiles.push({
      id: `tile_${i}_0`,
      q: i,
      r: 0,
      visibility: i % 8 === 0 ? 'visible' : i % 3 === 0 ? 'unknown' : 'explored',
      discovered: i % 3 !== 0,
      visible: i % 8 === 0,
    });
  }
  const tileMapView = {
    version: 2,
    seed: 'large-fog',
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles,
  };
  const renderSnapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView,
    x: 0,
    y: 0,
    width: 520,
    height: 420,
  });

  const first = WorldFogVisualSnapshot.createSnapshot({ renderSnapshot });
  const second = WorldFogVisualSnapshot.createSnapshot({ renderSnapshot });

  assert.equal(first.tileIds.length, 5000);
  assert.equal(first.drawX.length, 5000);
  assert.equal(first.signature, second.signature);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'entries'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'tileMapView'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'renderSnapshot'), false);
});
