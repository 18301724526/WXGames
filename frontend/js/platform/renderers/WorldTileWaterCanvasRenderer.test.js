const test = require('node:test');
const assert = require('node:assert/strict');

const WorldTileWaterCanvasRenderer = require('./WorldTileWaterCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createCtx(calls = [], sourceData = null, outputRef = null) {
  return {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    beginPath() { calls.push(['beginPath']); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    clip() { calls.push(['clip']); },
    closePath() { calls.push(['closePath']); },
    createImageData(width, height) {
      calls.push(['createImageData', width, height]);
      const imageData = { data: new Uint8ClampedArray(width * height * 4) };
      if (outputRef) outputRef.imageData = imageData;
      return imageData;
    },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    getImageData(x, y, width, height) {
      calls.push(['getImageData', x, y, width, height]);
      return { data: sourceData || new Uint8ClampedArray(width * height * 4) };
    },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    putImageData(...args) { calls.push(['putImageData', ...args]); },
    restore() { calls.push(['restore']); },
    save() { calls.push(['save']); },
    setTransform(...args) { calls.push(['setTransform', ...args]); },
  };
}

function createCanvasFactory(calls = [], sourceData = null, outputRef = null) {
  return (width = 1, height = 1) => ({
    width,
    height,
    getContext() {
      return createCtx(calls, sourceData, outputRef);
    },
  });
}

function isOpaquePixel(data, index) {
  return data[index + 3] > 8;
}

function isWorldTileTemplateWaterPixel(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];
  if (alpha <= 56 || blue <= 70) return false;
  return blue > red + 12 && blue > green - 3 && (green > red + 18 || blue > 112);
}

function measurePixelBounds(data, width, height, predicate) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const index = (py * width + px) * 4;
      if (!predicate(data, index)) continue;
      count += 1;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  if (!count) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, count, sourceWidth: width, sourceHeight: height };
}

function createHost(overrides = {}) {
  const calls = [];
  const outputRef = {};
  const sourceData = new Uint8ClampedArray([
    0, 100, 180, 120,
    40, 40, 40, 255,
    0, 0, 0, 0,
    0, 120, 220, 200,
  ]);
  const images = new Map([
    ['assets/art/tile-map/transition-template/water.png', { naturalWidth: 2, naturalHeight: 2, width: 2, height: 2 }],
    ['water-river.png', { naturalWidth: 10, naturalHeight: 5, width: 10, height: 5 }],
    ['water-ocean.png', { naturalWidth: 12, naturalHeight: 6, width: 12, height: 6 }],
  ]);
  return {
    calls,
    outputRef,
    ctx: createCtx(calls),
    worldTileMaskCache: new Map(),
    worldTileMaskMetricsCache: new Map(),
    worldTileDryCompositeCache: new Map(),
    worldTileCompositeCanvas: null,
    worldTileCompositeCtx: null,
    worldTileWaterCanvas: null,
    worldTileWaterCtx: null,
    getAsset(assetPath) { return images.get(assetPath) || null; },
    createTileWorkCanvas: createCanvasFactory(calls, sourceData, outputRef),
    getFallbackAssetMetrics(image) {
      const width = Number(image?.naturalWidth || image?.width || 1) || 1;
      const height = Number(image?.naturalHeight || image?.height || 1) || 1;
      return { x: 0, y: 0, width, height, sourceWidth: width, sourceHeight: height };
    },
    getIsoTileSourceRect() { return { x: 0, y: 0, width: 2, height: 2, sourceWidth: 2, sourceHeight: 2 }; },
    getNow() { return 0; },
    getWorldTileTemplateMetrics() { return { x: 0, y: 0, width: 2, height: 2, sourceWidth: 2, sourceHeight: 2 }; },
    drawTileAsset(...args) { calls.push(['drawTileAsset', ...args]); return true; },
    isOpaquePixel,
    isWorldTileTemplateWaterPixel,
    measurePixelBounds,
    constructor: {
      getTileMapAssetManifest() {
        return {
          getRiverMouthRiverTemplateAsset(key) { return { path: `${key}-river.png` }; },
          getRiverMouthShoreEdgeAsset(key) { return { path: `${key}-shore.png` }; },
          getWaterAsset(kind) {
            return kind === 'ocean'
              ? { path: 'water-ocean.png', alpha: 0.6, uvScale: 1, speedX: 0, speedY: 0 }
              : { path: 'water-river.png', alpha: 0.8, uvScale: 1, speedX: 0, speedY: 0 };
          },
        };
      },
    },
    images,
    ...overrides,
  };
}

test('WorldTileWaterCanvasRenderer creates and caches template water masks', () => {
  const host = createHost();
  const renderer = new WorldTileWaterCanvasRenderer({ host });

  const first = renderer.getWorldTileTemplateMask('assets/art/tile-map/transition-template/water.png');
  const second = renderer.getWorldTileTemplateMask('assets/art/tile-map/transition-template/water.png');

  assert.equal(first, second);
  assert.equal(host.worldTileMaskCache.get('assets/art/tile-map/transition-template/water.png'), first);
  assert.deepEqual(host.worldTileMaskMetricsCache.get('assets/art/tile-map/transition-template/water.png'), {
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    count: 2,
    sourceWidth: 2,
    sourceHeight: 2,
  });
  assert.equal(host.outputRef.imageData.data[3], 142);
  assert.equal(host.outputRef.imageData.data[15], 236);
});

test('WorldTileWaterCanvasRenderer expands ocean river-mouth templates into shore and river masks', () => {
  const renderer = new WorldTileWaterCanvasRenderer({ host: createHost() });

  const templates = renderer.getWorldTileWaterTemplateAssets({
    water: { kind: 'ocean' },
    templateAssets: [
      { key: 'river-mouth-ne', asset: 'mouth.png' },
      { key: 'coast', asset: 'coast.png' },
    ],
  });

  assert.deepEqual(templates, [
    { key: 'river-mouth-ne', asset: 'river-mouth-ne-shore.png', waterKind: 'ocean' },
    { key: 'river-mouth-ne', asset: 'river-mouth-ne-river.png', waterKind: 'river' },
    { key: 'coast', asset: 'coast.png' },
  ]);
});

test('WorldTileWaterCanvasRenderer fills animated water texture from stable world coordinates', () => {
  const calls = [];
  const renderer = new WorldTileWaterCanvasRenderer({ host: createHost() });
  const targetCtx = createCtx(calls);

  const drawn = renderer.fillWorldTileWaterTexture(
    targetCtx,
    { naturalWidth: 10, naturalHeight: 5, width: 10, height: 5 },
    { uvScale: 1, speedX: 0, speedY: 0 },
    { q: 0, r: 0 },
    { width: 25, height: 12 },
    { scale: 1, geometry: { tileWidth: 24, tileHeight: 12, stepX: 12, stepY: 6, anchorY: 0.5 } },
    25,
    12,
    0,
  );

  assert.equal(drawn, true);
  assert.deepEqual(calls[0], ['drawImage', { naturalWidth: 10, naturalHeight: 5, width: 10, height: 5 }, -8, -4, 10.5, 5.5]);
  assert.equal(renderer.positiveModulo(-12, 10), 8);
});

test('WorldTileWaterCanvasRenderer draws water layers and dry template once a texture is available', () => {
  const host = createHost();
  const renderer = new WorldTileWaterCanvasRenderer({ host });
  const calls = [];
  renderer.drawWorldTileWaterLayer = function drawWorldTileWaterLayer(...args) {
    calls.push(['drawWorldTileWaterLayer', ...args]);
    return true;
  };
  renderer.drawWorldTileDryTemplate = function drawWorldTileDryTemplate(...args) {
    calls.push(['drawWorldTileDryTemplate', ...args]);
    return true;
  };

  const drawn = renderer.drawWorldTileWater(
    {
      water: { kind: 'river', asset: 'water-river.png' },
      templateAssets: [{ key: 'river', asset: 'river-template.png' }],
    },
    { x: 10, y: 20 },
    { x: 1, y: 2, width: 30, height: 40 },
    { scale: 1, geometry: {} },
    { waterTimeMs: 1200 },
  );

  assert.equal(drawn, true);
  assert.equal(calls[0][0], 'drawWorldTileWaterLayer');
  assert.equal(calls[0][3].naturalWidth, 10);
  assert.equal(calls.at(-1)[0], 'drawWorldTileDryTemplate');
});

test('CanvasGameRenderer exposes world tile water rendering through facade', () => {
  class StubWorldTileWaterRenderer {
    constructor(options) {
      this.host = options.host;
    }

    drawWorldTileWater(...args) {
      return { method: 'drawWorldTileWater', host: this.host, args };
    }

    drawWorldTileBase(...args) {
      return { method: 'drawWorldTileBase', host: this.host, args };
    }

    getWorldTileTemplateMask(assetPath) {
      return { assetPath, host: this.host };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    worldTileWaterRendererClass: StubWorldTileWaterRenderer,
  });

  assert.equal(renderer.drawWorldTileWater({}).method, 'drawWorldTileWater');
  assert.equal(renderer.drawWorldTileBase({}).method, 'drawWorldTileBase');
  assert.equal(renderer.getWorldTileTemplateMask('mask.png').host, renderer);
});
