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
    assetCache: new Map(),
    assetMetricsCache: new Map(),
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
    worldTileScoutRouteCache: { canvas: {} },
    worldTileWaterLayerCache: { canvas: {} },
    worldTileWaterChunkCacheTick: 9,
    worldTileViewCache: { view: {} },
    worldTileVisibleEntriesCache: { entries: [] },
    worldTileLocalEntriesCache: { entries: [] },
    assetsChangedHandler: null,
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
      host.worldTileViewCache = null;
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
  const host = createHost();
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
  assert.equal(host.worldTileStaticCache, null);
  assert.equal(host.worldTileViewCache, null);
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

  assert.equal(host.worldTileStaticCache, null);
  assert.equal(host.worldTileStaticChunkCaches.size, 0);
  assert.equal(host.worldTileWaterFrameCaches.size, 0);
  assert.equal(host.worldTileViewCache, null);
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
  const spine = renderer.createTutorialSpineCanvas(20, 21);

  assert.equal(work.width, 12);
  assert.equal(work.height, 13);
  assert.equal(spine.width, 20);
  assert.equal(typeof spine.addEventListener, 'function');
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
