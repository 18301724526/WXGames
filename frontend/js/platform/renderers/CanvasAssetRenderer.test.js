const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasAssetRenderer = require('./CanvasAssetRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createCtx(calls = [], imageData = null) {
  return {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    getImageData(x, y, width, height) {
      calls.push(['getImageData', x, y, width, height]);
      return imageData || {
        data: new Uint8ClampedArray([
          0, 0, 0, 0,
          10, 20, 30, 255,
          40, 50, 60, 255,
          0, 0, 0, 0,
        ]),
      };
    },
    createImageData(width, height) {
      calls.push(['createImageData', width, height]);
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData(...args) { calls.push(['putImageData', ...args]); },
    setTransform(...args) { calls.push(['setTransform', ...args]); },
  };
}

function createCanvasFactory(calls = [], imageData = null) {
  return (width = 1, height = 1) => {
    const canvas = {
      width,
      height,
      getContext() {
        return createCtx(calls, imageData);
      },
    };
    calls.push(['createCanvas', width, height]);
    return canvas;
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const images = new Map();
  const worldMapCacheState = {
    worldTileMaskCache: new Map(),
    worldTileMaskMetricsCache: new Map(),
    worldTileDryCompositeCache: new Map(),
    worldTileStaticChunkCaches: new Map([['chunk', {}]]),
    worldTileWaterFrameCaches: new Map([['frame', {}]]),
    worldTileWaterChunkCaches: new Map([['water', {}]]),
    worldTileStaticCache: { canvas: {} },
    worldTileStaticCacheLayout: { frame: {} },
    worldTileStaticCacheLayoutKind: '',
    worldTileStaticChunkCacheTick: 7,
    worldTileWaterLayerCache: { canvas: {} },
    worldTileWaterChunkCacheTick: 9,
    worldTileViewCache: { view: {} },
    worldTileVisibleEntriesCache: { entries: [] },
    worldTileLocalEntriesCache: { entries: [] },
    assetsChangedHandler: null,
  };
  const host = {
    calls,
    canvas: {
      ownerDocument: {
        createElement() {
          return createCanvasFactory(calls)();
        },
      },
    },
    ctx: createCtx(calls),
    worldMapCacheState,
    assetCache: new Map(),
    assetMetricsCache: new Map(),
    createImage(assetPath) {
      const image = {
        naturalWidth: 2,
        naturalHeight: 2,
        width: 2,
        height: 2,
        src: '',
      };
      images.set(assetPath, image);
      calls.push(['createImage', assetPath]);
      return image;
    },
    getPreloadAssetPaths() { return ['asset-a.png']; },
    getAsset(assetPath) {
      const cached = host.assetCache.get(assetPath);
      return cached?.status === 'loaded' ? cached.image : null;
    },
    handleAssetsChanged() { calls.push(['handleAssetsChanged']); },
    invalidateWorldTileViewCache() {
      calls.push(['invalidateWorldTileViewCache']);
      host.worldMapCacheState.worldTileViewCache = null;
    },
    getWorldTileTemplateMask(assetPath) {
      if (!this.worldMapCacheState.worldTileMaskCache.has(assetPath)) {
        this.worldMapCacheState.worldTileMaskCache.set(assetPath, { assetPath });
      }
      return this.worldMapCacheState.worldTileMaskCache.get(assetPath);
    },
    getWorldTileDryTemplateCanvas(assetPath) {
      if (!this.worldMapCacheState.worldTileDryCompositeCache.has(assetPath)) {
        this.worldMapCacheState.worldTileDryCompositeCache.set(assetPath, { assetPath });
      }
      return this.worldMapCacheState.worldTileDryCompositeCache.get(assetPath);
    },
    constructor: {
      getAssetRequestPath(assetPath) {
        return `${assetPath}?v=test`;
      },
      getTileMapAssetManifest() {
        return {
          terrain: { plains: { path: 'assets/art/tile-map/tile-terrain-plains.png' } },
          getTerrainAsset(terrain) {
            return this.terrain[terrain];
          },
        };
      },
    },
    images,
    ...overrides,
  };
  return host;
}

test('CanvasAssetRenderer preserves preload progress, cached states, and request path versioning', async () => {
  const timers = [];
  const host = createHost();
  host.h5Runtime = {
    runtime: {
      setTimeout(callback, delayMs) {
        timers.push({ callback, delayMs });
        return { callback, delayMs };
      },
      clearTimeout() {},
    },
  };
  host.assetCache.set('cached-loaded.png', { status: 'loaded', image: { width: 1, height: 1 } });
  host.assetCache.set('cached-error.png', { status: 'error', image: null });
  const renderer = new CanvasAssetRenderer({ host });
  const progress = [];

  const promise = renderer.preloadAssets(['asset-a.png', 'cached-loaded.png', 'cached-error.png'], (event) => {
    progress.push(event);
  });

  const image = host.images.get('asset-a.png');
  assert.equal(image.src, 'asset-a.png?v=test');
  image.onload({ type: 'load' });

  const result = await promise;

  assert.deepEqual(result, { total: 3, completed: 3, loaded: 2, failed: 1, percentage: 100 });
  assert.equal(progress[0].status, 'start');
  assert.equal(progress.at(-1).percentage, 100);
  assert.equal(host.worldMapCacheState.worldTileStaticCache, null);
  assert.equal(host.worldMapCacheState.worldTileViewCache, null);
  assert.equal(timers.length, 0);
});

test('CanvasAssetRenderer schedules requested world tile prewarm and keeps sync option', async () => {
  const timers = [];
  const host = createHost();
  host.h5Runtime = {
    runtime: {
      setTimeout(callback, delayMs) {
        timers.push({ callback, delayMs });
        return { callback, delayMs };
      },
      clearTimeout() {},
      performance: { now: () => 1 },
    },
  };
  const renderer = new CanvasAssetRenderer({ host });
  const tilePath = 'assets/art/tile-map/tile-terrain-plains.png';
  const promise = renderer.preloadAssets([tilePath], null, { prewarm: { initialDelayMs: 12 } });
  const image = host.images.get(tilePath);
  image.onload({ type: 'load' });

  const result = await promise;

  assert.deepEqual(result, { total: 1, completed: 1, loaded: 1, failed: 0, percentage: 100 });
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delayMs, 12);
  assert.equal(host.assetMetricsCache.has(tilePath), false);

  timers[0].callback();
  assert.equal(host.assetMetricsCache.has(tilePath), true);

  const syncHost = createHost();
  const syncRenderer = new CanvasAssetRenderer({ host: syncHost });
  const syncPromise = syncRenderer.preloadAssets([tilePath], null, { deferPrewarm: false });
  syncHost.images.get(tilePath).onload({ type: 'load' });
  await syncPromise;
  assert.equal(syncHost.assetMetricsCache.has(tilePath), true);
});

test('CanvasAssetRenderer leaves world tile prewarm to shell unless requested', async () => {
  const timers = [];
  const host = createHost();
  host.h5Runtime = {
    runtime: {
      setTimeout(callback, delayMs) {
        timers.push({ callback, delayMs });
        return { callback, delayMs };
      },
      clearTimeout() {},
    },
  };
  const renderer = new CanvasAssetRenderer({ host });
  const tilePath = 'assets/art/tile-map/tile-terrain-plains.png';
  const promise = renderer.preloadAssets([tilePath]);
  host.images.get(tilePath).onload({ type: 'load' });
  await promise;

  assert.equal(timers.length, 0);
  assert.equal(host.assetMetricsCache.has(tilePath), false);
});

test('CanvasAssetRenderer prewarms world tile caches during loading with stage progress', async () => {
  const host = createHost({
    h5Runtime: {
      runtime: {
        setTimeout(callback, delayMs) {
          host.calls.push(['setTimeout', delayMs]);
          callback();
          return { callback, delayMs };
        },
        clearTimeout() {},
        performance: { now: () => 1 },
      },
    },
  });
  const renderer = new CanvasAssetRenderer({ host });
  const tilePath = 'assets/art/tile-map/tile-terrain-plains.png';
  const waterPath = 'assets/art/tile-map/river-template/tile-river-n.png';
  host.assetCache.set(tilePath, {
    status: 'loaded',
    image: { naturalWidth: 2, naturalHeight: 2, width: 2, height: 2 },
  });
  host.assetCache.set(waterPath, {
    status: 'loaded',
    image: { naturalWidth: 2, naturalHeight: 2, width: 2, height: 2 },
  });
  const progress = [];

  const result = await renderer.prewarmWorldTileCachesForLoading([tilePath, waterPath], (event) => {
    progress.push(event);
  }, { chunkSize: 1, betweenChunksMs: 3 });

  assert.equal(result.percentage, 100);
  assert.equal(result.candidateTotal, 2);
  assert.equal(host.assetMetricsCache.has(tilePath), true);
  assert.equal(host.worldMapCacheState.worldTileMaskCache.has(waterPath), true);
  assert.equal(host.worldMapCacheState.worldTileDryCompositeCache.has(waterPath), true);
  assert.deepEqual(progress.map((event) => event.status), ['start', 'prewarm', 'prewarm', 'complete']);
  assert.equal(progress.some((event) => event.message === '\u6b63\u5728\u51c6\u5907\u6c34\u9762\u6a21\u677f'), true);
  assert.equal(host.calls.some((call) => call[0] === 'setTimeout' && call[1] === 3), true);
});

test('CanvasAssetRenderer preserves getAsset lazy loading and failure fallback', () => {
  const host = createHost();
  const renderer = new CanvasAssetRenderer({ host });

  assert.equal(renderer.getAsset('asset-a.png'), null);
  const image = host.images.get('asset-a.png');
  assert.equal(image.src, 'asset-a.png?v=test');
  image.onload();
  assert.equal(renderer.getAsset('asset-a.png'), image);

  const noImageRenderer = new CanvasAssetRenderer({ host: createHost({ createImage: () => null }) });
  assert.equal(noImageRenderer.getAsset('missing.png'), null);
});

test('CanvasAssetRenderer preserves cache invalidation and snapshot readiness', () => {
  const host = createHost();
  const renderer = new CanvasAssetRenderer({ host });

  assert.equal(renderer.hasPreparedWorldTileSnapshotCache(), true);
  renderer.invalidateWorldTileCaches();

  assert.equal(host.worldMapCacheState.worldTileStaticCache, null);
  assert.equal(host.worldMapCacheState.worldTileStaticChunkCaches.size, 0);
  assert.equal(host.worldMapCacheState.worldTileWaterFrameCaches.size, 0);
  assert.equal(host.worldMapCacheState.worldTileViewCache, null);
});

test('CanvasAssetRenderer preserves image drawing alpha and cover crop contracts', () => {
  const host = createHost();
  const image = { naturalWidth: 200, naturalHeight: 100, width: 200, height: 100 };
  host.assetCache.set('wide.png', { status: 'loaded', image });
  const renderer = new CanvasAssetRenderer({ host });

  assert.equal(renderer.drawAsset('wide.png', 1, 2, 30, 40, 0.5), true);
  assert.equal(renderer.drawAssetClipped('wide.png', { x: 10, y: 5, width: 20, height: 15 }, 3, 4, 50, 60, 0.4), true);
  assert.equal(renderer.drawCoverAsset('wide.png', 0, 0, 50, 50, 0.3), true);

  assert.equal(host.ctx.globalAlpha, 1);
  assert.deepEqual(host.calls.filter((call) => call[0] === 'drawImage').map((call) => call.length), [6, 10, 10]);
});

test('CanvasAssetRenderer preserves alpha bounds and tile source rect fallbacks', () => {
  const host = createHost();
  host.assetCache.set('assets/art/tile-map/tile-terrain-plains.png', {
    status: 'loaded',
    image: { naturalWidth: 2, naturalHeight: 2, width: 2, height: 2 },
  });
  const renderer = new CanvasAssetRenderer({ host });

  const metrics = renderer.analyzeAssetAlphaBounds('assets/art/tile-map/tile-terrain-plains.png');

  assert.deepEqual(metrics, { x: 0, y: 0, width: 2, height: 2, count: 2, sourceWidth: 2, sourceHeight: 2 });
  assert.equal(renderer.getWorldTileTemplateMetrics('assets/art/tile-map/ocean-template/tile-ocean.png').width, 2);
  assert.equal(renderer.drawTileAsset('assets/art/tile-map/tile-terrain-plains.png', 1, 2, 30, 40), true);
});

test('CanvasAssetRenderer preserves work canvas creation and clipped canvas drawing', () => {
  const host = createHost({
    canvas: {
      ownerDocument: {
        createElement() {
          return createCanvasFactory([])();
        },
      },
    },
  });
  const renderer = new CanvasAssetRenderer({ host });

  const work = renderer.createTileWorkCanvas(12, 13);

  assert.equal(work.width, 12);
  assert.equal(work.height, 13);
  assert.equal(renderer.drawCanvasClipped({ width: 100, height: 80 }, { x: 1, y: 2, width: 3, height: 4 }, 5, 6, 7, 8), true);
});

test('CanvasGameRenderer exposes asset rendering through facade', () => {
  class StubAssetRenderer {
    constructor(options) {
      this.host = options.host;
    }

    preloadAssets(...args) {
      return { method: 'preloadAssets', host: this.host, args };
    }

    drawAsset(...args) {
      return { method: 'drawAsset', host: this.host, args };
    }

    invalidateWorldTileCaches() {
      this.host.invalidated = true;
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    assetRendererClass: StubAssetRenderer,
  });

  const preload = renderer.preloadAssets(['a.png']);
  const draw = renderer.drawAsset('a.png', 1, 2, 3, 4);
  renderer.invalidateWorldTileCaches();

  assert.equal(preload.host, renderer);
  assert.equal(preload.method, 'preloadAssets');
  assert.equal(draw.method, 'drawAsset');
  assert.equal(renderer.invalidated, true);
});
