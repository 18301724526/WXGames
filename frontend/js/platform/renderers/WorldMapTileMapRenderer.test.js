const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapTileMapRenderer = require('./WorldMapTileMapRenderer');

function createCtx(calls) {
  return {
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    save() { calls.push(['ctxSave']); },
    beginPath() { calls.push(['ctxBeginPath']); },
    rect(...args) { calls.push(['ctxRect', ...args]); },
    clip() { calls.push(['ctxClip']); },
    restore() { calls.push(['ctxRestore']); },
  };
}

function createTileMapView() {
  return {
    seed: 'tile-map-renderer-test',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
    tiles: [
      { id: 'tile-1', q: 0, r: 0, terrain: 'plains', discovered: true, visible: true },
    ],
    activeScouts: [
      {
        id: 'scout-1',
        status: 'active',
        origin: { q: 0, r: 0 },
        route: [{ q: 1, r: 0 }],
        startedAt: '2026-06-06T00:00:00.000Z',
        stepDurationSeconds: 10,
      },
    ],
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const hitTargets = [];
  return {
    calls,
    hitTargets,
    ctx: createCtx(calls),
    constructor: {
      getWorldMapHitTargetModel() {
        return {
          getWorldMapDragHitTarget(rect) {
            calls.push(['getWorldMapDragHitTarget', rect]);
            return { rect, action: { type: 'worldMapDrag', background: true } };
          },
        };
      },
    },
    addHitTarget(rect, action) {
      hitTargets.push({ rect, action });
      calls.push(['addHitTarget', rect, action]);
    },
    createGradient(...args) {
      calls.push(['createGradient', ...args]);
      return '#123';
    },
    drawPanel(...args) {
      calls.push(['drawPanel', ...args]);
    },
    getEpochNowMs() {
      return new Date('2026-06-06T00:00:05.000Z').getTime();
    },
    getWorldTileRenderEntries(tileMapView) {
      calls.push(['getWorldTileRenderEntries']);
      return [{ tile: tileMapView.tiles[0], center: { x: 1, y: 2 }, drawRect: { x: 0, y: 0, width: 10, height: 5 } }];
    },
    renderWorldScoutRouteLayer(...args) {
      calls.push(['renderWorldScoutRouteLayer', ...args]);
      return true;
    },
    renderWorldScoutRoutes(...args) {
      calls.push(['renderWorldScoutRoutes', ...args]);
      return true;
    },
    renderWorldTileWaterLayer(...args) {
      calls.push(['renderWorldTileWaterLayer', ...args]);
      return true;
    },
    renderWorldTileWaterEntries(...args) {
      calls.push(['renderWorldTileWaterEntries', ...args]);
      return true;
    },
    renderWorldTileStaticLayer(...args) {
      calls.push(['renderWorldTileStaticLayer', ...args]);
      return true;
    },
    renderWorldTileStaticEntries(...args) {
      calls.push(['renderWorldTileStaticEntries', ...args]);
      return true;
    },
    renderWorldTileFogMask(...args) {
      calls.push(['renderWorldTileFogMask', ...args]);
      return false;
    },
    renderWorldActors(...args) {
      calls.push(['renderWorldActors', ...args]);
      return true;
    },
    renderWorldMarchHud(...args) {
      calls.push(['renderWorldMarchHud', ...args]);
      return true;
    },
    addWorldMarchTileHitTargets(...args) {
      calls.push(['addWorldMarchTileHitTargets', ...args]);
      return true;
    },
    addWorldTileSiteHitTargets(...args) {
      calls.push(['addWorldTileSiteHitTargets', ...args]);
      return true;
    },
    addWorldActorHitTargets(...args) {
      calls.push(['addWorldActorHitTargets', ...args]);
      return true;
    },
    renderWorldTileSnapshotCache(...args) {
      calls.push(['renderWorldTileSnapshotCache', ...args]);
      return true;
    },
    ...overrides,
  };
}

test('WorldMapTileMapRenderer publishes context and renders layers in stable order', () => {
  const host = createHost();
  const renderer = new WorldMapTileMapRenderer({ host });
  const tileMapView = createTileMapView();

  renderer.renderWorldTileMap(tileMapView, 10, 90, 360, 300, { selectedSiteId: 'tile-1' }, { state: { id: 'state-1' } });

  assert.equal(host.lastWorldTileMapContext.tileMapView, tileMapView);
  assert.equal(host.lastWorldTileMapContext.renderSnapshot.schema, 'world-map-render-snapshot-v1');
  assert.deepEqual(host.lastWorldTileMapContext.frame, { x: 11, y: 91, width: 358, height: 298 });
  assert.equal(host.hitTargets.some((target) => target.action.type === 'worldMapDrag'), true);
  assert.deepEqual(host.calls.filter((call) => call[0].startsWith('renderWorld') || call[0].startsWith('addWorld')).map((call) => call[0]), [
    'renderWorldScoutRouteLayer',
    'renderWorldTileWaterLayer',
    'renderWorldTileStaticLayer',
    'renderWorldTileFogMask',
    'renderWorldActors',
    'renderWorldMarchHud',
    'addWorldMarchTileHitTargets',
    'addWorldTileSiteHitTargets',
    'addWorldActorHitTargets',
  ]);
  assert.equal(host.calls.some((call) => call[0] === 'ctxClip'), true);
});

test('WorldMapTileMapRenderer passes continuous march actors into render layer', () => {
  const host = createHost();
  const renderer = new WorldMapTileMapRenderer({ host });

  renderer.renderWorldTileMap(createTileMapView(), 10, 90, 360, 300, {}, {
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
  });
  const actorCall = host.calls.find((call) => call[0] === 'renderWorldActors');
  const actor = actorCall?.[1]?.[0];

  assert.equal(Boolean(actor), true);
  assert.equal(actor.current.q > 0, true);
  assert.equal(actor.current.q < 1, true);
});

test('WorldMapTileMapRenderer keeps later epoch movement continuous', () => {
  const host = createHost();
  const renderer = new WorldMapTileMapRenderer({ host });

  renderer.renderWorldTileMap(createTileMapView(), 10, 90, 360, 300, {}, {
    epochNowMs: new Date('2026-06-06T00:00:09.000Z').getTime(),
  });
  const actorCall = host.calls.find((call) => call[0] === 'renderWorldActors');
  const actor = actorCall?.[1]?.[0];

  assert.equal(Boolean(actor), true);
  assert.equal(actor.current.q > 0.8, true);
  assert.equal(actor.current.q < 1, true);
});

test('WorldMapTileMapRenderer hit-target-only skips paint and registers actors/HUD targets', () => {
  const host = createHost();
  const renderer = new WorldMapTileMapRenderer({ host });

  renderer.renderWorldTileMap(createTileMapView(), 10, 90, 360, 300, {}, { hitTargetsOnly: true, state: { id: 'state-1' } });

  assert.equal(host.calls.some((call) => call[0] === 'drawPanel'), false);
  assert.equal(host.calls.some((call) => call[0] === 'ctxClip'), false);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldMarchTileHitTargets'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addWorldActorHitTargets'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldMarchHud'), true);
});

test('WorldMapTileMapRenderer snapshot-only clips and redraws snapshot cache only', () => {
  const host = createHost();
  const renderer = new WorldMapTileMapRenderer({ host });

  renderer.renderWorldTileMap(createTileMapView(), 10, 90, 360, 300, {}, { snapshotOnly: true });

  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileSnapshotCache'), true);
  assert.equal(host.calls.some((call) => call[0] === 'getWorldTileRenderEntries'), false);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldTileStaticLayer'), false);
  assert.equal(host.calls.some((call) => call[0] === 'ctxClip'), true);
});

test('WorldMapTileMapRenderer restores fast-drag state after render', () => {
  const host = createHost({ worldTileFastDragActive: false });
  const renderer = new WorldMapTileMapRenderer({ host });

  renderer.renderWorldTileMap(createTileMapView(), 10, 90, 360, 300, {}, { fastDrag: true });

  assert.equal(host.worldTileFastDragActive, false);
});

test('WorldMapTileMapRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapTileMapRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapTileMapRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapTileMapRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
