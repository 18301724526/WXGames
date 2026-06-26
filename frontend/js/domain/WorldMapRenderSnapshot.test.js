const test = require('node:test');
const assert = require('node:assert/strict');

require('./WorldTime');
require('./WorldMarchProgressSnapshot');
const WorldMapRenderSnapshot = require('./WorldMapRenderSnapshot');

function createTileMapView() {
  return {
    signature: 'map-signature',
    version: 3,
    seed: 'seed-1',
    pan: { x: 12, y: -8 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains' },
      { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest' },
    ],
    sites: [{ id: 'capital', tileId: 'tile_0_0' }],
    activeScouts: [{
      id: 'explore-1',
      kind: 'worldExplore',
      mode: 'manual',
      status: 'active',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 2, r: 0, tileId: 'tile_2_0' },
      route: [
        { q: 1, r: 0, tileId: 'tile_1_0', step: 1 },
        { q: 2, r: 0, tileId: 'tile_2_0', step: 2 },
      ],
      startedAt: '2026-06-06T00:00:00.000Z',
      nextStepAt: '2026-06-06T00:00:10.000Z',
      completesAt: '2026-06-06T00:00:20.000Z',
    }],
  };
}

test('WorldMapRenderSnapshot normalizes frame, viewport, ui, and march actors', () => {
  const tileMapView = createTileMapView();
  const snapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView,
    x: 10,
    y: 90,
    width: 360,
    height: 300,
    uiState: {
      selectedSiteId: 'capital',
      worldMarchTarget: { q: 1, r: 0 },
    },
  }, {
    nowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
  });

  assert.equal(snapshot.schema, 'world-map-render-snapshot-v1');
  assert.equal(snapshot.tileMapView, tileMapView);
  assert.deepEqual(snapshot.frame, { x: 11, y: 91, width: 358, height: 298 });
  assert.equal(snapshot.viewport.originX, 190);
  assert.equal(snapshot.viewport.originY, 216);
  assert.equal(snapshot.viewport.panX, 12);
  assert.equal(snapshot.viewport.panY, -8);
  assert.equal(snapshot.ui.selectedSiteId, 'capital');
  assert.equal(snapshot.ui.worldMarchTarget.tileId, 'tile_1_0');
  assert.equal(snapshot.counts.tiles, 2);
  assert.equal(snapshot.counts.actors, 1);
  assert.equal(WorldMapRenderSnapshot.getActors(snapshot)[0].missionId, 'explore-1');
});

test('WorldMapRenderSnapshot carries world origin into render viewport', () => {
  const tileMapView = {
    ...createTileMapView(),
    origin: { q: 28, r: 9 },
    tiles: [{ id: 'tile_28_9', q: 28, r: 9, terrain: 'capital' }],
  };
  const snapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView,
    x: 0,
    y: 72,
    width: 432,
    height: 632,
  });

  assert.deepEqual(snapshot.viewport.worldOrigin, {
    x: 28,
    y: 9,
    q: 28,
    r: 9,
    tileId: 'tile_28_9',
  });
});

test('WorldMapRenderSnapshot uses epochNowMs for continuous march actors', () => {
  const snapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView: createTileMapView(),
    x: 10,
    y: 90,
    width: 360,
    height: 300,
  }, {
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
  });
  const actor = WorldMapRenderSnapshot.getActors(snapshot)[0];

  assert.equal(actor.current.q > 0, true);
  assert.equal(actor.current.q < 1, true);
});

test('WorldMapRenderSnapshot canonicalizes march target identity through stable axes', () => {
  const target = WorldMapRenderSnapshot.normalizeMarchTarget({
    x: 3,
    y: -2,
    q: 90,
    r: 90,
    tileId: 'legacy-target',
  });

  assert.deepEqual(target, {
    q: 3,
    r: -2,
    tileId: 'tile_3_-2',
    known: undefined,
    terrain: '',
    terrainLabel: '',
  });
});

test('WorldMapRenderSnapshot prefers epochNowMs when nowMs is absent', () => {
  const snapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView: createTileMapView(),
    x: 10,
    y: 90,
    width: 360,
    height: 300,
  }, {
    epochNowMs: new Date('2026-06-06T00:00:15.000Z').getTime(),
  });
  const actor = WorldMapRenderSnapshot.getActors(snapshot)[0];

  assert.equal(actor.current.q > 1, true);
  assert.equal(actor.current.q < 2, true);
});

test('WorldMapRenderSnapshot keeps stable compact signatures', () => {
  const tileMapView = createTileMapView();
  const nowMs = new Date('2026-06-06T00:00:05.000Z').getTime();
  const first = WorldMapRenderSnapshot.createSnapshot({ tileMapView, x: 0, y: 0, width: 520, height: 420 }, { nowMs });
  const second = WorldMapRenderSnapshot.createSnapshot({ tileMapView, x: 0, y: 0, width: 520, height: 420 }, { nowMs });
  const changedPan = WorldMapRenderSnapshot.createSnapshot({
    tileMapView: { ...tileMapView, pan: { x: 24, y: -8 } },
    x: 0,
    y: 0,
    width: 520,
    height: 420,
  }, { nowMs });

  assert.equal(first.signature, second.signature);
  assert.notEqual(first.signature, changedPan.signature);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'tilesById'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'entitiesById'), false);
});

test('WorldMapRenderSnapshot serializes without copying renderer payloads', () => {
  const snapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView: createTileMapView(),
    x: 0,
    y: 0,
    width: 520,
    height: 420,
  }, {
    nowMs: new Date('2026-06-06T00:00:25.000Z').getTime(),
  });
  const serializable = WorldMapRenderSnapshot.toSerializable(snapshot);

  assert.equal(serializable.schema, 'world-map-render-snapshot-v1');
  assert.equal(serializable.counts.arrivals, 1);
  assert.equal(serializable.march.arrivals.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(serializable, 'tileMapView'), false);
});
