const test = require('node:test');
const assert = require('node:assert/strict');

require('./WorldTime');
require('./WorldMarchProgressSnapshot');
require('./WorldMapVisibilityModel');
require('./TileMapGeometry');
const WorldMapVisibilityModel = require('./WorldMapVisibilityModel');
const WorldMapEntitySnapshot = require('./WorldMapEntitySnapshot');
const WorldMapRenderSnapshot = require('./WorldMapRenderSnapshot');
const WorldMapPerformanceBudget = require('./WorldMapPerformanceBudget');

function createLargeTiles(count = 5000) {
  const tiles = [];
  for (let index = 0; index < count; index += 1) {
    tiles.push({
      id: `tile_${index}_${-index}`,
      q: index,
      r: -index,
      terrain: index % 3 === 0 ? 'forest' : 'plains',
      visibility: index % 11 === 0 ? 'controlled' : (index % 5 === 0 ? 'unknown' : 'scouted'),
      discovered: index % 5 !== 0,
      siteId: index === 0 ? 'capital' : '',
    });
  }
  return tiles;
}

test('WorldMapPerformanceBudget accepts compact large world map snapshots', () => {
  const tiles = createLargeTiles();
  const worldMap = { version: 11, seed: 'budget-seed', tiles };
  const visibility = WorldMapVisibilityModel.createSnapshot({ worldMap });
  const entity = WorldMapEntitySnapshot.createSnapshot({
    worldMap,
    worldExplorerState: {
      activeMission: {
        id: 'mission-1',
        status: 'active',
        origin: { q: 0, r: 0, tileId: 'tile_0_0' },
        route: [{ q: 1, r: -1, tileId: 'tile_1_-1', step: 1 }],
        position: { q: 1, r: -1, tileId: 'tile_1_-1' },
      },
    },
  });
  const render = WorldMapRenderSnapshot.createSnapshot({
    tileMapView: {
      version: 11,
      signature: 'large-map',
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles,
      activeScouts: [],
      pan: { x: 0, y: 0 },
    },
    x: 0,
    y: 0,
    width: 390,
    height: 520,
  });
  render.toSerializable = () => WorldMapRenderSnapshot.toSerializable(render);

  const report = WorldMapPerformanceBudget.combineReports([
    WorldMapPerformanceBudget.checkVisibilitySnapshot(visibility),
    WorldMapPerformanceBudget.checkEntitySnapshot(entity),
    WorldMapPerformanceBudget.checkRenderSnapshot(render),
  ], { scenario: 'large-world-map' });

  assert.equal(report.ok, true);
  assert.deepEqual(report.failedKeys, []);
  assert.equal(report.checks.some((check) => check.key === 'visibility.no-entry-objects'), true);
  assert.equal(report.checks.some((check) => check.key === 'entity.no-nested-entity-map'), true);
  assert.equal(report.checks.some((check) => check.key === 'render.no-tile-copy-in-serializable'), true);
  assert.equal(WorldMapPerformanceBudget.assertReport(report), report);
});

test('WorldMapPerformanceBudget fails loudly when structural budgets are exceeded', () => {
  const oversizedVisibility = {
    tileIds: Array.from({ length: 5001 }, (_, index) => `tile_${index}`),
    levels: Array.from({ length: 5000 }, () => 1),
    q: Array.from({ length: 5001 }, (_, index) => index),
    r: Array.from({ length: 5001 }, (_, index) => -index),
    indexById: {},
    entries: [],
  };

  const report = WorldMapPerformanceBudget.checkVisibilitySnapshot(oversizedVisibility);

  assert.equal(report.ok, false);
  assert.equal(report.failedKeys.includes('visibility.tile-count'), true);
  assert.equal(report.failedKeys.includes('visibility.parallel-levels'), true);
  assert.equal(report.failedKeys.includes('visibility.no-entry-objects'), true);
  assert.throws(
    () => WorldMapPerformanceBudget.assertReport(report),
    /World map performance budget exceeded/,
  );
});

test('WorldMapPerformanceBudget checks render serializable payload size', () => {
  const report = WorldMapPerformanceBudget.checkRenderSnapshot({
    counts: { tiles: 10, actors: 1 },
    toSerializable() {
      return {
        schema: 'world-map-render-snapshot-v1',
        huge: 'x'.repeat(WorldMapPerformanceBudget.DEFAULT_BUDGETS.serializableBytes + 1),
      };
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.failedKeys.includes('render.serializable-size'), true);
});
