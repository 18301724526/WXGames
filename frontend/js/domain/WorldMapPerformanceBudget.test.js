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

test('WorldMapPerformanceBudget checks renderer frame work and chunk/window budgets', () => {
  const report = WorldMapPerformanceBudget.checkRendererFrameWork({
    signature: 'frame-work-v1',
    frame: { width: 390, height: 520 },
    pixelRatio: 2,
    visibleEntries: Array.from({ length: 48 }, (_, index) => ({ id: `tile_${index}` })),
    actors: [{ id: 'actor-1' }],
    hitTargets: Array.from({ length: 12 }, (_, index) => ({ id: `target_${index}` })),
    chunks: [
      { entries: Array.from({ length: 16 }, (_, index) => ({ id: `chunk_a_${index}` })) },
      { tiles: Array.from({ length: 24 }, (_, index) => ({ id: `chunk_b_${index}` })) },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.failedKeys.length, 0);
  assert.equal(
    WorldMapPerformanceBudget.getFramePixelCount({ width: 390, height: 520 }, 2),
    811200,
  );
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

test('WorldMapPerformanceBudget checks world-map input intent evidence budgets', () => {
  const compactReport = WorldMapPerformanceBudget.checkInputIntent({
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    source: 'worldMapRuntime',
    points: { physical: { x: 1, y: 2 }, layer: { x: 101, y: 202 } },
    action: { type: 'selectWorldMarchTarget', targetQ: 3, targetR: -2 },
    target: { kind: 'tile', tileId: 'tile_3_-2', targetQ: 3, targetR: -2 },
    picking: { inputEpoch: 5, signature: 'sig-5', counts: { targets: 8 } },
    view: { frame: { width: 390, height: 520 }, viewport: { scale: 1 }, camera: { x: 0, y: 0 } },
    diagnostics: { hitTargetCount: 8 },
  });

  assert.equal(compactReport.ok, true);
  assert.equal(compactReport.failedKeys.length, 0);

  const oversizedReport = WorldMapPerformanceBudget.checkInputIntent({
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    action: { type: 'selectWorldMarchTarget', rendererPayload: 'must-not-pass' },
    target: { kind: 'tile', tileId: 'tile_3_-2' },
    picking: {
      counts: { targets: 64 },
      targets: Array.from({ length: 64 }, (_, index) => ({ index })),
    },
    debugPayload: 'x'.repeat(4096),
  });

  assert.equal(oversizedReport.ok, false);
  assert.equal(oversizedReport.failedKeys.includes('input-intent.serializable-size'), true);
  assert.equal(oversizedReport.failedKeys.includes('input-intent.no-renderer-payload'), true);
  assert.equal(oversizedReport.failedKeys.includes('input-intent.no-tile-copy'), true);
});

test('WorldMapPerformanceBudget fails renderer frame work that exceeds capacity budgets', () => {
  const report = WorldMapPerformanceBudget.checkRendererFrameWork({
    frame: { width: 200, height: 200 },
    visibleEntries: Array.from({ length: 4 }, (_, index) => ({ id: `tile_${index}` })),
    actors: [{ id: 'a' }, { id: 'b' }],
    hitTargets: [{ id: 'target-1' }],
    chunks: [
      { entries: Array.from({ length: 3 }, (_, index) => ({ id: `chunk_a_${index}` })) },
      { entries: Array.from({ length: 5 }, (_, index) => ({ id: `chunk_b_${index}` })) },
    ],
  }, {
    ...WorldMapPerformanceBudget.DEFAULT_BUDGETS,
    frameEntries: 3,
    frameActors: 1,
    frameHitTargets: 0,
    framePixels: 10000,
    activeChunks: 1,
    chunkEntries: 4,
  });

  assert.equal(report.ok, false);
  assert.equal(report.failedKeys.includes('frame.entry-count'), true);
  assert.equal(report.failedKeys.includes('frame.actor-count'), true);
  assert.equal(report.failedKeys.includes('frame.hit-target-count'), true);
  assert.equal(report.failedKeys.includes('frame.pixel-count'), true);
  assert.equal(report.failedKeys.includes('frame.active-chunks'), true);
  assert.equal(report.failedKeys.includes('frame.chunk-entry-count'), true);
});
