const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileMapGeometry');
require('./WorldTime');
require('./WorldMarchProgressSnapshot');
require('./WorldMarchSystem');
const WorldMapInputActionMap = require('./WorldMapInputActionMap');

function createContext() {
  return {
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainLabel: '平原', visibility: 'scouted' },
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', terrainLabel: '森林', visibility: 'unknown' },
      ],
    },
    viewport: {
      originX: 100,
      originY: 100,
      panX: 0,
      panY: 0,
      scale: 0.5,
    },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
  };
}

test('WorldMapInputActionMap resolves topmost foreground target before background action', () => {
  const action = WorldMapInputActionMap.getHitTarget({ x: 60, y: 60 }, [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'capital' } },
  ]);

  assert.deepEqual(action, { type: 'openWorldSite', siteId: 'capital' });
});

test('WorldMapInputActionMap keeps a city click as openWorldSite when an actor stands on the city', () => {
  const action = WorldMapInputActionMap.getHitTarget({ x: 60, y: 60 }, [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'capital' } },
    { x: 50, y: 50, width: 42, height: 42, action: { type: 'selectWorldActor', missionId: 'march-1' } },
  ]);

  assert.deepEqual(action, { type: 'openWorldSite', siteId: 'capital' });
});

test('WorldMapInputActionMap preserves topmost background target over older background', () => {
  const action = WorldMapInputActionMap.getHitTarget({ x: 60, y: 60 }, [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0, background: true } },
  ]);

  assert.deepEqual(action, { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0, background: true });
});

test('WorldMapInputActionMap infers known and unknown march target actions from map context', () => {
  const knownAction = WorldMapInputActionMap.getBackgroundMarchTargetAction({ x: 148, y: 124 }, createContext());
  const unknownAction = WorldMapInputActionMap.getBackgroundMarchTargetAction({ x: 100, y: 148 }, createContext());

  assert.equal(knownAction.type, 'selectWorldMarchTarget');
  assert.equal(knownAction.tileId, 'tile_1_0');
  assert.equal(knownAction.known, false);
  assert.equal(knownAction.terrainLabel, '未知');
  assert.equal(unknownAction.tileId, 'tile_1_1');
  assert.equal(unknownAction.known, false);
});

test('WorldMapInputActionMap normalizes allowed hit targets with offsets', () => {
  const targets = WorldMapInputActionMap.normalizeHitTargets([
    { x: 10, y: 20, width: 30, height: 40, action: { type: 'worldMapDrag', background: true } },
    { x: 20, y: 30, width: 40, height: 50, action: { type: 'unsupportedAction' } },
  ], { offsetX: -2, offsetY: 3 });

  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0], {
    x: 8,
    y: 23,
    width: 30,
    height: 40,
    action: { type: 'worldMapDrag', background: true },
  });
});

test('WorldMapInputActionMap resolves tap action through action map contract', () => {
  const action = WorldMapInputActionMap.resolveTapAction({ x: 148, y: 124 }, {
    hitTargets: [
      { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    ],
    context: createContext(),
  });

  assert.equal(action.type, 'selectWorldMarchTarget');
  assert.equal(action.targetQ, 1);
  assert.equal(action.targetR, 0);
});
