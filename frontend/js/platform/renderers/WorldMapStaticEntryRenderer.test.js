const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapStaticEntryRenderer = require('./WorldMapStaticEntryRenderer');

function withRendererDependencyRegistry(dependencies = {}, callback = null) {
  const hadRegistry = Object.prototype.hasOwnProperty.call(globalThis, 'WorldMapRendererDependencyRegistry');
  const previousRegistry = globalThis.WorldMapRendererDependencyRegistry;
  globalThis.WorldMapRendererDependencyRegistry = {
    getRendererDependency(key) {
      return Object.prototype.hasOwnProperty.call(dependencies, key) ? dependencies[key] : null;
    },
  };
  try {
    return callback();
  } finally {
    if (hadRegistry) {
      globalThis.WorldMapRendererDependencyRegistry = previousRegistry;
    } else {
      delete globalThis.WorldMapRendererDependencyRegistry;
    }
  }
}

function createCtx(calls = []) {
  return {
    beginPath() { calls.push(['beginPath']); },
    ellipse(...args) { calls.push(['ellipse', ...args]); },
    arc(...args) { calls.push(['arc', ...args]); },
    fill() { calls.push(['fill']); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    clip() { calls.push(['clip']); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    globalAlpha: 1,
    fillStyle: '',
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const host = {
    calls,
    ctx: createCtx(calls),
    constructor: {
      getTileMapAssetManifest() {
        return {
          terrain: {
            hills: { path: 'terrain-hills.png', overlayKey: 'terrain:hills' },
          },
        };
      },
    },
    addHitTarget(rect, action) {
      calls.push(['addHitTarget', rect, action]);
    },
    analyzeAssetAlphaBounds(assetPath) {
      calls.push(['analyzeAssetAlphaBounds', assetPath]);
      return { x: 0, y: 0, width: 100, height: 80 };
    },
    drawIsoDiamond(...args) {
      calls.push(['drawIsoDiamond', ...args]);
    },
    drawText(...args) {
      calls.push(['drawText', ...args]);
    },
    drawWorldTileBase(...args) {
      calls.push(['drawWorldTileBase', ...args]);
      return false;
    },
    drawWorldTileDryTemplate(...args) {
      calls.push(['drawWorldTileDryTemplate', ...args]);
    },
    getAsset(assetPath) {
      calls.push(['getAsset', assetPath]);
      return { width: 200, height: 160, naturalWidth: 200, naturalHeight: 160 };
    },
    getFallbackTerrainFill(terrain) {
      calls.push(['getFallbackTerrainFill', terrain]);
      return `fill:${terrain}`;
    },
    getWorldOverlayAnchor(tile) {
      calls.push(['getWorldOverlayAnchor', tile.id]);
      return { x: 100, y: 120 };
    },
    getWorldTileSiteLayout(tile) {
      calls.push(['getWorldTileSiteLayout', tile.id]);
      if (!tile.site) return null;
      return {
        site: tile.site,
        metrics: { x: 0, y: 0, width: 100, height: 80 },
        baseX: 110,
        baseY: 130,
        drawX: 80,
        drawY: 70,
        drawW: 60,
        drawH: 48,
        hitRect: { x: 72, y: 62, width: 76, height: 74 },
      };
    },
    random01(_seed, _q, _r, salt) {
      calls.push(['random01', salt]);
      if (salt.includes('visible')) return 0;
      return 0.5;
    },
    truncateText(text) {
      calls.push(['truncateText', text]);
      return String(text || '');
    },
    ...overrides,
  };
  return host;
}

function createEntry(overrides = {}) {
  const { tile: tileOverrides = {}, ...entryOverrides } = overrides;
  return {
    tile: {
      id: 'tile-1',
      q: 0,
      r: 0,
      terrain: 'plains',
      ...tileOverrides,
    },
    center: { x: 100, y: 120 },
    drawRect: { x: 64, y: 72, width: 72, height: 48 },
    ...entryOverrides,
  };
}

test('WorldMapStaticEntryRenderer prefers registry dependencies over host constructor fallbacks', () => {
  const registryManifest = { id: 'registry-manifest' };
  const registryGeometry = { id: 'registry-geometry' };
  const fallbackManifest = { id: 'fallback-manifest' };
  const fallbackGeometry = { id: 'fallback-geometry' };
  const renderer = new WorldMapStaticEntryRenderer({
    host: {
      constructor: {
        getTileMapAssetManifest() {
          return fallbackManifest;
        },
        getTileMapGeometry() {
          return fallbackGeometry;
        },
      },
    },
  });

  withRendererDependencyRegistry({
    tileMapAssetManifest: registryManifest,
    tileMapGeometry: registryGeometry,
  }, () => {
    assert.equal(renderer.getTileMapAssetManifest(), registryManifest);
    assert.equal(renderer.getTileMapGeometry(), registryGeometry);
  });
  assert.equal(renderer.getTileMapAssetManifest(), fallbackManifest);
  assert.equal(renderer.getTileMapGeometry(), fallbackGeometry);
});

test('WorldMapStaticEntryRenderer draws base, selection, feature, and site entries in stable phases', () => {
  const host = createHost();
  const renderer = new WorldMapStaticEntryRenderer({ host });
  const tileMapView = {
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
  };
  const entry = createEntry({
    tile: {
      site: {
        id: 'capital',
        name: 'Capital',
        art: 'site.png',
        owner: 'player',
      },
      feature: {
        key: 'treeCluster',
        asset: 'tree.png',
      },
    },
  });

  renderer.renderWorldTileStaticEntries(tileMapView, { scale: 0.5, seed: 'seed' }, {}, [entry], { selectedSiteId: 'capital' });

  const callNames = host.calls.map((call) => call[0]);
  assert.equal(callNames.includes('drawWorldTileBase'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawIsoDiamond' && call[5]?.stroke === 'rgba(116, 211, 160, 0.78)'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawIsoDiamond' && call[5]?.stroke === 'rgba(116, 211, 160, 0.86)'), true);
  assert.equal(host.calls.some((call) => call[0] === 'getAsset' && call[1] === 'tree.png'), true);
  assert.equal(host.calls.some((call) => call[0] === 'getWorldTileSiteLayout' && call[1] === 'tile-1'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addHitTarget'), true);
});

test('WorldMapStaticEntryRenderer derives site hit-target identity from stable coordinates', () => {
  const host = createHost();
  const renderer = new WorldMapStaticEntryRenderer({ host });
  const entry = createEntry({
    tile: {
      id: 'legacy-site-id',
      tileId: 'legacy-site-tile-id',
      x: 5,
      y: -2,
      q: 99,
      r: 99,
      site: {
        id: 'site_5_-2',
        name: 'Stable Site',
        art: 'site.png',
        owner: 'neutral',
      },
    },
  });

  assert.equal(renderer.drawWorldTileSite(entry.tile, { scale: 1 }, {}, 192, 96, {}, { center: entry.center }), true);

  const addHitTarget = host.calls.find((call) => call[0] === 'addHitTarget');
  assert.equal(addHitTarget[2].type, 'openWorldSite');
  assert.equal(addHitTarget[2].siteId, 'site_5_-2');
  assert.equal(addHitTarget[2].tileId, 'tile_5_-2');
});

test('WorldMapStaticEntryRenderer uses dry template for water tiles and can suppress site hit targets', () => {
  const host = createHost();
  const renderer = new WorldMapStaticEntryRenderer({ host });
  const entry = createEntry({
    tile: {
      water: { kind: 'river', asset: 'water.png' },
      site: {
        id: 'port',
        name: 'Port',
        art: 'site.png',
      },
    },
  });

  renderer.renderWorldTileStaticEntries({ geometry: {} }, { scale: 1 }, {}, [entry], {}, { addHitTargets: false });

  assert.equal(host.calls.some((call) => call[0] === 'drawWorldTileDryTemplate'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawWorldTileBase'), false);
  assert.equal(host.calls.some((call) => call[0] === 'addHitTarget'), false);
});

test('WorldMapStaticEntryRenderer draws terrain features from manifest without tile feature assets', () => {
  const host = createHost();
  const renderer = new WorldMapStaticEntryRenderer({ host });
  const entry = createEntry({
    tile: {
      terrain: 'hills',
    },
  });

  assert.equal(renderer.drawWorldTerrainFeature(entry.tile, { scale: 1, seed: 'seed' }, { stepX: 96, stepY: 48 }, 96, 48), true);
  assert.equal(host.calls.some((call) => call[0] === 'getAsset' && call[1] === 'terrain-hills.png'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawImage'), true);
});

test('WorldMapStaticEntryRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapStaticEntryRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapStaticEntryRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapStaticEntryRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
