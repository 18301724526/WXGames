const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapInputIntent = require('./WorldMapInputIntent');
const WorldMapPerformanceBudget = require('../projection/WorldMapPerformanceBudget');

test('WorldMapInputIntent creates compact serializable tap intents', () => {
  const intent = WorldMapInputIntent.createTapIntent({
    source: 'worldMapRuntime',
    physicalPoint: { x: 12.3456, y: 98.7654, pointerId: 7 },
    layerPoint: { x: 132.3456, y: 218.7654 },
    inputId: 'wmi-run-a-42',
    clientSequence: 42,
    action: {
      type: 'selectWorldMarchTarget',
      tileId: 'tile_1_2',
      targetQ: 1,
      targetR: 2,
      known: false,
      background: true,
      terrainLabel: 'Forest',
      rendererPayload: 'x'.repeat(1200),
    },
    pickingSnapshot: {
      schema: 'world-map-picking-snapshot-v1',
      inputEpoch: 5,
      signature: 'pick-sig-abc',
      counts: { sites: 2, actors: 1, targets: 3 },
      targets: [{ action: { type: 'openWorldSite', siteId: 'capital' }, debugPayload: 'ignored' }],
    },
    context: {
      frame: { x: 0, y: 84, width: 390, height: 640 },
      viewport: { originX: 180, originY: 220, panX: 4, panY: -6, scale: 1.25 },
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
      tileMapView: {
        tiles: Array.from({ length: 64 }, (_, index) => ({
          id: `tile_${index}_${index}`,
          q: index,
          r: index,
          payload: 'large-map-data',
        })),
      },
      renderer: { secret: 'must-not-leak' },
    },
    camera: { x: 4, y: -6 },
    diagnostics: {
      hitTargetCount: 3,
      dragLayerOffset: { x: 0, y: 0 },
      renderer: { secret: 'must-not-leak' },
    },
  });

  const serializable = WorldMapInputIntent.toSerializable(intent);
  const json = JSON.stringify(serializable);

  assert.equal(serializable.schema, 'world-map-input-intent-v1');
  assert.equal(serializable.kind, 'tap');
  assert.equal(serializable.source, 'worldMapRuntime');
  assert.equal(serializable.inputId, 'wmi-run-a-42');
  assert.equal(serializable.clientSequence, 42);
  assert.deepEqual(serializable.points.physical, { x: 12.346, y: 98.765, pointerId: 7 });
  assert.deepEqual(serializable.points.layer, { x: 132.346, y: 218.765 });
  assert.deepEqual(serializable.action, {
    type: 'selectWorldMarchTarget',
    tileId: 'tile_1_2',
    targetQ: 1,
    targetR: 2,
    background: true,
    known: false,
  });
  assert.deepEqual(serializable.target, {
    kind: 'tile',
    tileId: 'tile_1_2',
    targetQ: 1,
    targetR: 2,
  });
  assert.deepEqual(serializable.picking, {
    schema: 'world-map-picking-snapshot-v1',
    inputEpoch: 5,
    signature: 'pick-sig-abc',
    counts: { sites: 2, actors: 1, targets: 3 },
  });
  assert.equal(serializable.view.frame.width, 390);
  assert.equal(serializable.view.viewport.scale, 1.25);
  assert.deepEqual(serializable.view.camera, { x: 4, y: -6 });
  assert.equal(json.includes('"tiles"'), false);
  assert.equal(json.includes('large-map-data'), false);
  assert.equal(json.includes('must-not-leak'), false);
  assert.ok(WorldMapInputIntent.getSerializableSizeBytes(serializable) < 2048);
  assert.equal(WorldMapPerformanceBudget.checkInputIntent(serializable).ok, true);
});

test('WorldMapInputIntent derives stable compact input ids when none is provided', () => {
  const intent = WorldMapInputIntent.createTapIntent({
    source: 'worldMapRuntime',
    clientSequence: 7,
    physicalPoint: { x: 10.2, y: 20.8 },
    layerPoint: { x: 110.2, y: 220.8 },
    action: { type: 'selectWorldMarchTarget', targetQ: 3, targetR: -2, background: true },
    pickingSnapshot: { inputEpoch: 5, signature: 'pick-sig-abc', counts: { targets: 9 } },
    context: {
      frame: { x: 0, y: 84, width: 390, height: 640 },
      viewport: { originX: 180, originY: 220, panX: 0, panY: 0, scale: 1 },
    },
    camera: { x: 0, y: 0 },
  });

  assert.match(intent.inputId, /^wmi_7_[a-z0-9]+$/);
  assert.equal(intent.clientSequence, 7);
  assert.equal(intent.inputId.length < 48, true);
  assert.equal(JSON.stringify(intent).includes('pick-sig-abc'), true);
});

test('WorldMapInputIntent canonicalizes action tile evidence through target coordinates', () => {
  const intent = WorldMapInputIntent.createTapIntent({
    source: 'worldMapRuntime',
    clientSequence: 8,
    physicalPoint: { x: 10, y: 20 },
    layerPoint: { x: 110, y: 220 },
    action: {
      type: 'selectWorldMarchTarget',
      tileId: 'legacy-action-tile',
      targetQ: 3,
      targetR: -2,
      background: true,
    },
  });

  assert.deepEqual(intent.action, {
    type: 'selectWorldMarchTarget',
    tileId: 'tile_3_-2',
    targetQ: 3,
    targetR: -2,
    background: true,
  });
  assert.deepEqual(intent.target, {
    kind: 'tile',
    tileId: 'tile_3_-2',
    targetQ: 3,
    targetR: -2,
  });
});

test('WorldMapInputIntent represents tap misses without renderer objects', () => {
  const intent = WorldMapInputIntent.createTapIntent({
    physicalPoint: { x: 10, y: 20 },
    layerPoint: { x: 110, y: 220 },
    action: null,
    pickingSnapshot: null,
    context: {
      frame: { x: 0, y: 80, width: 300, height: 400 },
      viewport: { originX: 100, originY: 120, panX: 0, panY: 0, scale: 1 },
    },
    camera: { x: 0, y: 0 },
  });

  const serializable = WorldMapInputIntent.toSerializable(intent);

  assert.equal(serializable.schema, 'world-map-input-intent-v1');
  assert.equal(serializable.kind, 'tap');
  assert.equal(serializable.action, null);
  assert.deepEqual(serializable.target, { kind: 'none' });
  assert.equal(JSON.stringify(serializable).includes('[function]'), false);
});

test('WorldMapInputIntent toSerializable canonicalizes externally supplied tile evidence', () => {
  const serializable = WorldMapInputIntent.toSerializable({
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    source: 'worldMapRuntime',
    inputId: 'wmi-stale-tile',
    clientSequence: 9,
    action: {
      type: 'selectWorldMarchTarget',
      tileId: 'legacy-action',
      targetQ: 5,
      targetR: -3,
    },
    target: {
      kind: 'tile',
      tileId: 'legacy-target',
      targetQ: 5,
      targetR: -3,
    },
  });

  assert.deepEqual(serializable.action, {
    type: 'selectWorldMarchTarget',
    tileId: 'tile_5_-3',
    targetQ: 5,
    targetR: -3,
  });
  assert.deepEqual(serializable.target, {
    kind: 'tile',
    tileId: 'tile_5_-3',
    targetQ: 5,
    targetR: -3,
  });
});

test('WorldMapInputIntent preserves compact world-map input surface action evidence', () => {
  const intent = WorldMapInputIntent.createTapIntent({
    source: 'worldMapRuntime',
    clientSequence: 4,
    physicalPoint: { x: 10, y: 20 },
    layerPoint: { x: 10, y: 20 },
    action: {
      type: 'selectWorldActor',
      actorId: 'actor-1',
      inputSurface: 'worldMap',
      renderer: { heavy: true },
    },
  });

  assert.deepEqual(intent.action, {
    type: 'selectWorldActor',
    actorId: 'actor-1',
    inputSurface: 'worldMap',
  });
  assert.equal(JSON.stringify(intent).includes('heavy'), false);
});

test('WorldMapInputIntent toSerializable sanitizes externally supplied intent objects', () => {
  const thenable = {
    then() {},
    rendererPayload: 'must-not-leak',
  };
  const serializable = WorldMapInputIntent.toSerializable({
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    source: 'worldMapRuntime',
    inputId: 'wmi unsafe/id!',
    clientSequence: 12,
    points: {
      physical: { x: 1.2345, y: 9.8765, pointerId: 3, nativeEvent: { type: 'pointerup' } },
      layer: { x: 101.2345, y: 209.8765, rendererPayload: 'must-not-leak' },
      raw: { tileMapView: { tiles: [{ id: 'must-not-leak' }] } },
    },
    action: {
      type: 'selectWorldMarchTarget',
      targetQ: 3,
      targetR: -2,
      rendererPayload: 'must-not-leak',
      callback() {},
      promise: thenable,
    },
    target: {
      kind: 'tile',
      tileId: 'tile_3_-2',
      targetQ: 3,
      targetR: -2,
      route: [{ id: 'must-not-leak' }],
      nativeEvent: { type: 'pointerup' },
    },
    picking: {
      schema: 'world-map-picking-snapshot-v1',
      inputEpoch: 12,
      signature: 'sig-12',
      counts: { sites: 1, actors: 2, targets: 3 },
      targets: [{ action: { type: 'openWorldSite' } }],
    },
    view: {
      frame: { x: 0, y: 84, width: 390, height: 640, renderer: { secret: 'must-not-leak' } },
      viewport: { originX: 180, originY: 220, panX: 1, panY: -1, scale: 1.25, tileMapView: {} },
      camera: { x: 1, y: -1, nativeEvent: { type: 'wheel' } },
      renderer: { secret: 'must-not-leak' },
    },
    diagnostics: {
      hitTargetCount: 3,
      dragLayerOffset: { x: 1, y: -1 },
      rendererPayload: 'must-not-leak',
    },
    tileMapView: { tiles: [{ id: 'must-not-leak' }] },
    renderer: { secret: 'must-not-leak' },
  });
  const json = JSON.stringify(serializable);

  assert.equal(serializable.inputId, 'wmiunsafeid');
  assert.deepEqual(serializable.points.physical, { x: 1.235, y: 9.877, pointerId: 3 });
  assert.deepEqual(serializable.points.layer, { x: 101.235, y: 209.877 });
  assert.deepEqual(serializable.action, {
    type: 'selectWorldMarchTarget',
    tileId: 'tile_3_-2',
    targetQ: 3,
    targetR: -2,
  });
  assert.deepEqual(serializable.target, {
    kind: 'tile',
    tileId: 'tile_3_-2',
    targetQ: 3,
    targetR: -2,
  });
  assert.deepEqual(serializable.picking, {
    schema: 'world-map-picking-snapshot-v1',
    inputEpoch: 12,
    signature: 'sig-12',
    counts: { sites: 1, actors: 2, targets: 3 },
  });
  assert.deepEqual(serializable.view.camera, { x: 1, y: -1 });
  assert.deepEqual(serializable.diagnostics, {
    hitTargetCount: 3,
    dragLayerOffset: { x: 1, y: -1 },
  });
  assert.equal(json.includes('must-not-leak'), false);
  assert.equal(json.includes('nativeEvent'), false);
  assert.equal(json.includes('tileMapView'), false);
  assert.equal(json.includes('[function]'), false);
  assert.equal(json.includes('then'), false);
  assert.equal(WorldMapPerformanceBudget.checkInputIntent(serializable).ok, true);
});
