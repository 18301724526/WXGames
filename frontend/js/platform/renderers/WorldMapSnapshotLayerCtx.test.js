const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameRenderer = require('../CanvasGameRenderer');
const WorldMapFastDragCompositeRenderer = require('./WorldMapFastDragCompositeRenderer');

const BASE_COAT_FILL = 'rgba(20, 26, 23, 0.92)';
const TILE_BLIT_FILL = 'tile-blit-marker';

function createCtx(name = 'ctx') {
  const calls = [];
  return {
    name,
    calls,
    canvas: null,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillRect(...args) {
      calls.push(['fillRect', this.fillStyle, ...args]);
    },
    clearRect(...args) {
      calls.push(['clearRect', ...args]);
    },
    drawImage(...args) {
      calls.push(['drawImage', ...args]);
    },
    beginPath() {
      calls.push(['beginPath']);
    },
    closePath() {
      calls.push(['closePath']);
    },
    moveTo(...args) {
      calls.push(['moveTo', ...args]);
    },
    lineTo(...args) {
      calls.push(['lineTo', ...args]);
    },
    rect(...args) {
      calls.push(['rect', ...args]);
    },
    arc(...args) {
      calls.push(['arc', ...args]);
    },
    ellipse(...args) {
      calls.push(['ellipse', ...args]);
    },
    fill() {
      calls.push(['fill']);
    },
    stroke() {
      calls.push(['stroke']);
    },
    save() {
      calls.push(['save']);
    },
    restore() {
      calls.push(['restore']);
    },
    clip() {
      calls.push(['clip']);
    },
    translate(...args) {
      calls.push(['translate', ...args]);
    },
    scale(...args) {
      calls.push(['scale', ...args]);
    },
    setTransform(...args) {
      calls.push(['setTransform', ...args]);
    },
    fillText(...args) {
      calls.push(['fillText', ...args]);
    },
    measureText(text) {
      return { width: String(text || '').length * 8 };
    },
  };
}

function createTileMapView() {
  return {
    seed: 'test-seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      {
        id: 'tile-capital',
        q: 0,
        r: 0,
        terrain: 'plains',
        discovered: true,
        visible: true,
        site: { id: 'capital', type: 'city', name: 'Capital' },
      },
    ],
  };
}

function createRendererHost(liveCtx) {
  return new CanvasGameRenderer({
    ctx: liveCtx,
    presenter: {
      buildMilitaryNavigationViewState() {
        return { activeView: 'world' };
      },
      buildWorldTileMapViewState() {
        return createTileMapView();
      },
    },
    width: 390,
    height: 844,
    viewportWidth: 390,
    viewportHeight: 844,
    showFpsOverlay: false,
  });
}

function createBackbufferWork(name = 'backbuffer') {
  return {
    canvas: { id: `${name}-canvas`, width: 390, height: 844 },
    ctx: createCtx(name),
    pixelWidth: 390,
    pixelHeight: 844,
    width: 390,
    height: 844,
  };
}

function runSnapshotBackbufferFlow() {
  const liveCtx = createCtx('live');
  const renderer = createRendererHost(liveCtx);
  const work = createBackbufferWork();
  const recordedCtxs = [];
  renderer.getWorldTileLayerCacheContext = () => work;
  renderer.renderWorldTileSnapshotCache = () => {
    // Record the ctx exactly the way sub-renderers resolve it: through host.ctx at call time.
    const ctx = renderer.ctx;
    recordedCtxs.push(ctx);
    ctx.fillStyle = TILE_BLIT_FILL;
    ctx.fillRect(5, 5, 10, 10);
    return true;
  };
  const rendered = renderer.worldMapLayerRenderer.renderWorldMapSnapshotLayer(
    { territoryState: { worldMap: createTileMapView() } },
    { preserveOnMiss: true, topBarBottom: 96, frameless: true },
  );
  return { liveCtx, renderer, work, recordedCtxs, rendered };
}

test('snapshot backbuffer scopes host ctx so sub-renderers draw on the backbuffer', () => {
  const flow = runSnapshotBackbufferFlow();

  assert.equal(flow.rendered, true);
  assert.equal(flow.recordedCtxs.length, 1);
  assert.equal(flow.recordedCtxs[0], flow.work.ctx);
  assert.equal(flow.renderer.ctx, flow.liveCtx);
});

test('snapshot base coat and tile draw share the backbuffer while the composite lands live', () => {
  const flow = runSnapshotBackbufferFlow();
  const backCalls = flow.work.ctx.calls;
  const liveCalls = flow.liveCtx.calls;

  assert.equal(flow.rendered, true);
  assert.ok(
    backCalls.some((call) => call[0] === 'fillRect' && call[1] === BASE_COAT_FILL),
    'dark base coat must land on the backbuffer',
  );
  assert.ok(
    backCalls.some((call) => call[0] === 'fillRect' && call[1] === TILE_BLIT_FILL),
    'tile draw must land on the same backbuffer surface as the base coat',
  );
  assert.equal(
    liveCalls.some((call) => call[0] === 'fillRect' && call[1] === BASE_COAT_FILL),
    false,
    'dark base coat must not land on the live ctx',
  );
  const composite = liveCalls.find((call) => call[0] === 'drawImage');
  assert.ok(composite, 'backbuffer composite must land on the live ctx');
  assert.equal(composite[1], flow.work.canvas);
});

test('clearAll during snapshot backbuffer recursion never clears the live ctx', () => {
  const flow = runSnapshotBackbufferFlow();

  assert.equal(flow.rendered, true);
  assert.equal(
    flow.liveCtx.calls.some((call) => call[0] === 'clearRect'),
    false,
  );
  assert.equal(
    flow.work.ctx.calls.some((call) => call[0] === 'clearRect'),
    true,
  );
});

test('withRenderCtx restores the previous ctx when the callback throws', () => {
  const liveCtx = createCtx('live');
  const renderer = createRendererHost(liveCtx);
  const overrideCtx = createCtx('override');

  assert.throws(
    () =>
      renderer.withRenderCtx(overrideCtx, () => {
        assert.equal(renderer.ctx, overrideCtx);
        throw new Error('draw failed');
      }),
    /draw failed/,
  );
  assert.equal(renderer.ctx, liveCtx);
  assert.equal(
    renderer.withRenderCtx(null, () => 'ran without override'),
    'ran without override',
  );
  assert.equal(renderer.ctx, liveCtx);
  assert.equal(renderer.withRenderCtx(overrideCtx, null), false);
  assert.equal(renderer.ctx, liveCtx);
});

test('fast-drag composite bake scopes the host ctx and restores it afterwards', () => {
  const liveCtx = createCtx('live');
  const host = createRendererHost(liveCtx);
  const fastDragRenderer = new WorldMapFastDragCompositeRenderer({ host });
  host.worldMapCacheState.worldTileStaticCacheKey = 'static-key';
  host.worldMapCacheState.worldTileWaterLayerCacheKey = 'water-key';
  host.worldMapCacheState.worldTileStaticCache = { canvas: { id: 'static-cache' } };
  host.worldMapCacheState.worldTileWaterLayerCache = { canvas: { id: 'water-cache' } };
  const work = createBackbufferWork('composite');
  const drawCtxs = [];
  host.getWorldTileStaticCacheScale = () => 1;
  host.getWorldTileLayerCacheContext = () => work;
  host.drawWorldTileLayerCache = () => {
    drawCtxs.push(host.ctx);
    return true;
  };

  const updated = fastDragRenderer.updateWorldTileFastDragComposite(
    { kind: 'world', frame: { x: 0, y: 0, width: 100, height: 60 }, drawX: 0, drawY: 0 },
    {},
  );

  assert.equal(updated, true);
  assert.equal(drawCtxs.length, 2);
  assert.equal(drawCtxs[0], work.ctx);
  assert.equal(drawCtxs[1], work.ctx);
  assert.equal(host.ctx, liveCtx);
  assert.equal(host.worldMapCacheState.worldTileFastDragComposite.work, work);
});
