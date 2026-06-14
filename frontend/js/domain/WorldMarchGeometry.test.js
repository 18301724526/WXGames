const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileMapGeometry');
const WorldMarchGeometry = require('./WorldMarchGeometry');

test('WorldMarchGeometry projects axial coordinates into screen centers', () => {
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const viewport = { originX: 100, originY: 100, panX: 10, panY: -5, scale: 0.5 };

  assert.deepEqual(WorldMarchGeometry.getTileScreenCenter({ q: 3, r: -2 }, viewport, geometry), {
    x: 350,
    y: 119,
  });
});

test('WorldMarchGeometry preserves fractional march coordinates for smooth actor movement', () => {
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const viewport = { originX: 100, originY: 100, panX: 0, panY: 0, scale: 0.5 };

  assert.deepEqual(WorldMarchGeometry.getTileScreenCenter({ q: 0.5, r: 0 }, viewport, geometry), {
    x: 124,
    y: 112,
  });
});

test('WorldMarchGeometry maps screen points to nearest rendered tiles', () => {
  const tileMapView = {
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0 },
      { id: 'tile_1_0', q: 1, r: 0 },
    ],
  };
  const viewport = { originX: 100, originY: 100, panX: 0, panY: 0, scale: 0.5 };
  const target = WorldMarchGeometry.screenPointToNearestTile({ x: 148, y: 124 }, tileMapView, viewport);

  assert.equal(target.tileId, 'tile_1_0');
  assert.equal(target.q, 1);
  assert.equal(target.r, 0);
});

test('WorldMarchGeometry maps stable x/y tiles to nearest rendered targets', () => {
  const tileMapView = {
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { x: 0, y: 0 },
      { x: '2', y: '-1' },
    ],
  };
  const viewport = { originX: 100, originY: 100, panX: 0, panY: 0, scale: 0.5 };
  const point = WorldMarchGeometry.getTileScreenCenter({ x: 2, y: -1 }, viewport, tileMapView.geometry);
  const target = WorldMarchGeometry.screenPointToNearestTile(point, tileMapView, viewport);

  assert.equal(target.tileId, 'tile_2_-1');
  assert.equal(target.q, 2);
  assert.equal(target.r, -1);
});

test('WorldMarchGeometry infers axial tiles and target UI state', () => {
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const viewport = { originX: 100, originY: 100, panX: 0, panY: 0, scale: 0.5 };
  const point = WorldMarchGeometry.getTileScreenCenter({ q: 3, r: -2 }, viewport, geometry);
  const target = WorldMarchGeometry.screenPointToAxialTile(point, viewport, geometry);

  assert.equal(target.tileId, 'tile_3_-2');
  assert.equal(target.inferred, true);
  assert.deepEqual(WorldMarchGeometry.getMarchTargetUiState({
    worldMarchTarget: {
      q: '3',
      r: '-2',
      pickerOpen: true,
      known: false,
      terrain: 'plains',
      terrainLabel: 'Plains',
    },
  }), {
    q: 3,
    r: -2,
    tileId: 'tile_3_-2',
    pickerOpen: true,
    known: false,
    terrain: 'plains',
    terrainLabel: 'Plains',
  });
  assert.equal(WorldMarchGeometry.getMarchTargetUiState({ worldMarchTarget: { q: 'bad', r: 0 } }), null);
});

test('WorldMarchGeometry normalizes march target UI state from stable x/y coordinates', () => {
  assert.deepEqual(WorldMarchGeometry.getMarchTargetUiState({
    worldMarchTarget: {
      x: '4',
      y: '-3',
      pickerOpen: true,
      known: true,
      terrain: 'forest',
      terrainLabel: 'Forest',
    },
  }), {
    q: 4,
    r: -3,
    tileId: 'tile_4_-3',
    pickerOpen: true,
    known: true,
    terrain: 'forest',
    terrainLabel: 'Forest',
  });
});
