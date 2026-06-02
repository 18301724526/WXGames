const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const CanvasGameRenderer = require('../js/platform/CanvasGameRenderer');
const H5CanvasGameRenderer = require('../js/platform/H5CanvasGameRenderer');
const MiniGameCanvasRenderer = require('../js/platform/MiniGameCanvasRenderer');

function makeCtx() {
  const calls = [];
  const gradient = {
    addColorStop: () => {},
  };
  return {
    calls,
    ctx: {
      transforms: [],
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      filter: 'none',
      textBaseline: '',
      textAlign: '',
      globalAlpha: 1,
      scale(...args) { this.transforms.push(args); },
      clearRect(...a) { calls.push(['clearRect', ...a]); },
      fillRect(...a) { calls.push(['fillRect', ...a]); },
      beginPath() { calls.push(['beginPath']); },
      rect(...a) { calls.push(['rect', ...a]); },
      roundRect(...a) { calls.push(['roundRect', ...a]); },
      moveTo(...a) { calls.push(['moveTo', ...a]); },
      lineTo(...a) { calls.push(['lineTo', ...a]); },
      bezierCurveTo(...a) { calls.push(['bezierCurveTo', ...a]); },
      stroke(...a) { calls.push(['stroke', ...a]); },
      fill() {},
      save() {},
      restore() {},
      clip() {},
      translate(...a) { calls.push(['translate', ...a]); },
      arc() {},
      ellipse(...a) { calls.push(['ellipse', ...a]); },
      createLinearGradient() { calls.push(['gradient']); return gradient; },
      fillText(...a) { calls.push(['fillText', ...a]); },
      drawImage(...a) { calls.push(['drawImage', ...a]); },
    },
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

test('CanvasGameRenderer provides shared drawing primitives without platform dependency', () => {
  var CanvasGameRenderer = require('../js/platform/CanvasGameRenderer');
  var calls = [];
  var ctx = {
    transforms: [],
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: '',
    textAlign: '',
    globalAlpha: 1,
    scale(...a) { this.transforms.push(a); },
    beginPath() { calls.push('beginPath'); },
    rect() { calls.push('rect'); },
    roundRect(...a) { calls.push('roundRect', a); },
    fill() { calls.push('fill'); },
    stroke() {},
    save() {},
    restore() {},
    clip() {},
    translate(...a) { calls.push('translate', a); },
    arc() {},
    bezierCurveTo() { calls.push('bezierCurveTo'); },
    fillText(...a) { calls.push('fillText', a); },
    clearRect(...a) { calls.push('clearRect', a); },
    fillRect(...a) { calls.push('fillRect', a); },
    drawImage() { calls.push('drawImage'); },
    createLinearGradient() { calls.push('gradient'); return { addColorStop() {} }; },
  };
  var renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.presenter, null);
  assert.equal(typeof renderer.drawText, 'function');
  assert.equal(typeof renderer.drawButton, 'function');
  assert.equal(typeof renderer.addHitTarget, 'function');
  assert.equal(typeof renderer.getHitTarget, 'function');
  assert.equal(typeof renderer.render, 'function');

  renderer.drawText('测试', 10, 20, { color: '#f6e8c8', size: 14, bold: true });
  renderer.drawPanel(10, 10, 100, 50, { fill: 'rgba(37,29,21,0.88)', stroke: 'rgba(255,226,177,0.14)', radius: 8 });
  renderer.drawButton(20, 60, 80, 30, '建造', { disabled: false, size: 12 });
  renderer.drawProgressBar(10, 100, 200, 12, 50);

  assert.ok(calls.includes('fillText'), `fillText should be called, got: ${JSON.stringify(calls)}`);
  assert.ok(calls.includes('beginPath'), `beginPath should be called, got: ${JSON.stringify(calls)}`);
  assert.ok(calls.includes('roundRect'), `roundRect should be called, got: ${JSON.stringify(calls)}`);
  assert.ok(calls.includes('fill'), `fill should be called, got: ${JSON.stringify(calls)}`);
  assert.ok(calls.includes('gradient'), `gradient should be called, got: ${JSON.stringify(calls)}`);
});

test('CanvasGameRenderer hit target management works independently of platform', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });

  renderer.addHitTarget({ x: 10, y: 10, width: 50, height: 30 }, { type: 'switchTab', tab: 'resources' });
  renderer.addHitTarget({ x: 70, y: 10, width: 50, height: 30 }, { type: 'switchTab', tab: 'buildings' });

  const hit = renderer.getHitTarget({ x: 30, y: 20 });
  assert.deepEqual(hit, { type: 'switchTab', tab: 'resources' });

  const miss = renderer.getHitTarget({ x: 200, y: 200 });
  assert.equal(miss, null);

  renderer.setHitTargets([]);
  assert.equal(renderer.getHitTarget({ x: 30, y: 20 }), null);
});

test('CanvasGameRenderer preloads shared assets and reports progress', async () => {
  const { ctx } = makeCtx();
  const loadedImages = [];
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.createImage = () => {
    const image = { width: 96, height: 96 };
    loadedImages.push(image);
    return image;
  };

  const progress = [];
  const pending = renderer.preloadAssets(['assets/art/icon-fire-cutout.webp', 'assets/art/icon-wood-cutout.webp'], (entry) => {
    progress.push(entry);
  });
  loadedImages.forEach((image) => image.onload());
  const result = await pending;

  assert.equal(result.total, 2);
  assert.equal(result.loaded, 2);
  assert.equal(result.failed, 0);
  assert.equal(progress.at(-1).percentage, 100);
  assert.equal(renderer.getAsset('assets/art/icon-fire-cutout.webp'), loadedImages[0]);
});

test('CanvasGameRenderer preloads famous person portrait layers', () => {
  const paths = CanvasGameRenderer.getPreloadAssetPaths();

  assert.ok(paths.includes('assets/art/battle/battlefield-forest-camp.png'));
  assert.ok(paths.includes('assets/art/tile-map/tile-terrain-plains.png'));
  assert.ok(paths.includes('assets/art/tile-map/tile-terrain-forest.png'));
  assert.ok(paths.includes('assets/art/tile-map/tile-feature-tree-cluster.png'));
  assert.ok(paths.includes('assets/art/battle/units/player/idle/01.png'));
  assert.ok(paths.includes('assets/art/battle/units/player/attack/04.png'));
  assert.ok(paths.includes('assets/art/battle/units/enemy/die/04.png'));
  assert.equal(paths.includes('assets/art/battle/soldier-player-sheet.png'), false);
  assert.equal(paths.includes('assets/art/battle/soldier-enemy-sheet.png'), false);
  assert.ok(paths.includes('assets/art/famous-person/layers/fp-layer-v3-outfit-01.png'));
  assert.ok(paths.includes('assets/art/famous-person/layers/fp-layer-v3-face-01.png'));
  assert.ok(paths.includes('assets/art/famous-person/layers/fp-layer-v3-hair-10.png'));
  assert.ok(!paths.includes('assets/art/famous-person/layers/fp-layer-v2-art01-bangs-bound-topknot-swept-01.png'));
  assert.ok(!paths.includes('assets/art/famous-person/layers/fp-layer-body-skin-01.png'));
});

test('CanvasGameRenderer cache-busts famous person portrait layer image requests', async () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const createdImages = [];
  renderer.createImage = () => {
    const image = { src: '', onload: null, onerror: null };
    createdImages.push(image);
    return image;
  };

  const pending = renderer.preloadAssets([
    'assets/art/famous-person/layers/fp-layer-v3-hair-01.png',
    'assets/art/icon-food-cutout.webp',
  ]);

  assert.match(createdImages[0].src, /fp-layer-v3-hair-01\.png\?v=famous-portrait-v3-upperbody-20260529$/);
  assert.equal(createdImages[1].src, 'assets/art/icon-food-cutout.webp');
  createdImages.forEach((image) => image.onload?.());
  await pending;
});

test('CanvasGameRenderer cache-busts split battle unit frames on H5', async () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const createdImages = [];
  renderer.createImage = () => {
    const image = { src: '', onload: null, onerror: null };
    createdImages.push(image);
    return image;
  };

  const pending = renderer.preloadAssets(['assets/art/battle/units/player/attack/04.png']);

  assert.match(createdImages[0].src, /assets\/art\/battle\/units\/player\/attack\/04\.png\?v=battle-units-split-v1-20260529$/);
  createdImages[0].onload?.();
  await pending;
});

test('MiniGameCanvasRenderer keeps bundled asset paths unchanged', () => {
  assert.equal(
    MiniGameCanvasRenderer.getAssetRequestPath('assets/art/famous-person/layers/fp-layer-v3-hair-01.png'),
    'assets/art/famous-person/layers/fp-layer-v3-hair-01.png',
  );
  assert.equal(
    MiniGameCanvasRenderer.getAssetRequestPath('assets/art/battle/units/player/idle/01.png'),
    'assets/art/battle/units/player/idle/01.png',
  );
});

test('CanvasGameRenderer applies the same famous portrait layer layout as the lab', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const layout = CanvasGameRenderer.getFamousPortraitLayerLayout();
  assert.equal(layout.version, 3);
  assert.equal(layout.mode, 'stacked');
  assert.equal(layout.assetVersion, 'famous-portrait-v3-upperbody-20260529');
  assert.deepEqual(layout.order, ['face', 'outfit', 'hair']);
  assert.deepEqual(layout.layers.outfit.base, { x: 0, y: 0, width: 512, height: 512 });
  assert.deepEqual(layout.layers.face.base, { x: 0, y: 0, width: 512, height: 512 });
  assert.deepEqual(layout.layers.hair.base, { x: 0, y: 0, width: 512, height: 512 });
  const layers = {
    outfit: 'assets/art/famous-person/layers/fp-layer-v3-outfit-01.png',
    face: 'assets/art/famous-person/layers/fp-layer-v3-face-01.png',
    hair: 'assets/art/famous-person/layers/fp-layer-v3-hair-01.png',
  };
  Object.values(layers).forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 256, height: 256, naturalWidth: 256, naturalHeight: 256 },
    });
  });

  const drawn = renderer.drawFamousPortrait({ appearance: { layers } }, 10, 20, 74, {
    frameWidth: 74,
    frameHeight: 98,
    scale: 1.74,
    offsetY: 0.14,
  });

  assert.equal(drawn, true);
  const drawCalls = calls.filter((call) => call[0] === 'drawImage');
  assert.equal(drawCalls.length, 3);
  const outfitCall = drawCalls.find((call) => call[1]?.src === layers.outfit);
  const faceCall = drawCalls.find((call) => call[1]?.src === layers.face);
  const hairCall = drawCalls.find((call) => call[1]?.src === layers.hair);
  assert.ok(outfitCall);
  assert.ok(faceCall);
  assert.ok(hairCall);
  assert.ok(Math.abs(faceCall[2] - -9.65) < 0.01);
  assert.ok(Math.abs(faceCall[3] - 23.46) < 0.01);
  assert.ok(Math.abs(faceCall[4] - 113.31) < 0.01);
  assert.ok(Math.abs(faceCall[5] - 113.31) < 0.01);
  assert.ok(Math.abs(outfitCall[2] - -81.76) < 0.01);
  assert.ok(Math.abs(outfitCall[3] - -28.53) < 0.01);
  assert.ok(Math.abs(outfitCall[4] - 257.52) < 0.01);
  assert.ok(Math.abs(outfitCall[5] - 257.52) < 0.01);
  assert.ok(Math.abs(hairCall[2] - -7.64) < 0.01);
  assert.ok(Math.abs(hairCall[3] - 0.07) < 0.01);
  assert.ok(Math.abs(hairCall[4] - 113.31) < 0.01);
  assert.ok(Math.abs(hairCall[5] - 113.31) < 0.01);
  assert.ok(drawCalls.indexOf(faceCall) < drawCalls.indexOf(outfitCall));
  assert.ok(drawCalls.indexOf(outfitCall) < drawCalls.indexOf(hairCall));
});

test('CanvasGameRenderer scales famous portrait layers around the layer center', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const assetPath = 'assets/art/famous-person/layers/fp-layer-v3-hair-01.png';
  renderer.assetCache.set(assetPath, {
    status: 'loaded',
    image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
  });
  const layout = {
    version: 3,
    mode: 'stacked',
    coordinateSize: 512,
    global: { scale: 1, x: 0, y: 0 },
    layers: {
      hair: {
        base: { x: 0, y: 0, width: 512, height: 512 },
        x: 0,
        y: 0,
        scale: 0.5,
      },
    },
  };

  const drawn = renderer.drawFamousPortraitLayer(assetPath, 'hair', { x: 10, y: 20, size: 100 }, layout);

  assert.equal(drawn, true);
  const drawCall = calls.find((call) => call[0] === 'drawImage');
  assert.ok(drawCall);
  assert.ok(Math.abs(drawCall[2] - 35) < 0.01);
  assert.ok(Math.abs(drawCall[3] - 45) < 0.01);
  assert.ok(Math.abs(drawCall[4] - 50) < 0.01);
  assert.ok(Math.abs(drawCall[5] - 50) < 0.01);
});

test('CanvasGameRenderer draws loading page over gameplay until resources are ready', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.assetCache.set('assets/art/civilization-bg.webp', {
    status: 'loaded',
    image: { width: 1600, height: 900, naturalWidth: 1600, naturalHeight: 900 },
  });
  renderer.assetCache.set('assets/art/icon-fire-cutout.webp', {
    status: 'loaded',
    image: { width: 128, height: 128, naturalWidth: 128, naturalHeight: 128 },
  });

  renderer.render({ currentTab: 'resources' }, {
    mode: 'hud',
    activeTab: 'resources',
    loading: { visible: true, percentage: 42, message: 'Loading resources' },
  });

  assert.ok(calls.some((call) => call[0] === 'drawImage' && call.length >= 10), `background should be cropped as cover image: ${JSON.stringify(calls)}`);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === 'Loading resources'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '42%'));
  assert.deepEqual(renderer.getHitTarget({ x: 20, y: 20 }), { type: 'blockCanvasModal' });
});

test('CanvasGameRenderer draws realtime FPS overlay without adding hit targets', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 7 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });

  renderer.render({ currentTab: 'resources' }, {
    mode: 'hud',
    activeTab: 'resources',
    loading: { visible: true, percentage: 10, message: 'Loading resources' },
    now: 1000,
  });
  renderer.render({ currentTab: 'resources' }, {
    mode: 'hud',
    activeTab: 'resources',
    loading: { visible: true, percentage: 20, message: 'Loading resources' },
    now: 1016,
  });

  assert.equal(renderer.currentFps, 60);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === 'FPS 60'));
  assert.deepEqual(renderer.getHitTarget({ x: 12, y: 12 }), { type: 'blockCanvasModal' });
});

test('CanvasGameRenderer top HUD uses compact icon/value resource strip', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'platform', 'CanvasGameRenderer.js'), 'utf8');

  assert.match(source, /const resourceHeight = 62/);
  assert.match(source, /const barHeight = cityView\.hidden \? 128 : 166/);
  assert.match(source, /const iconSize = compactResources \? 30 : 30/);
  assert.doesNotMatch(source, /const resourceHeight = 79/);
  assert.doesNotMatch(source, /drawPanel\(cardX, cardY, cardWidth, resourceHeight/);
});

test('CanvasGameRenderer top HUD draws all initial resource values', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    toDisplayPopulation: (officials) => Number(officials || 0) * 100,
    buildResourceViewState: () => ({
      hasWood: true,
      hasIron: true,
      hasStone: true,
      text: {
        woodValue: '0',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
        foodValue: '100',
        foodRate: '+2.4/s',
        knowledgeValue: '0',
        knowledgeRate: '+0.1/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
  });

  renderer.render({ currentEraName: '原始时代', currentTab: 'resources', population: { total: 3 } }, { activeTab: 'resources', mode: 'hud' });

  for (const text of ['人口：300', '木材', '铁矿', '石料', '粮食', '知识', '100', '+2.4/s', '+0.1/s']) {
    assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === text), `expected resource strip to draw ${text}`);
  }
});

test('CanvasGameRenderer top HUD shows era population cap prompt when growth is blocked by era', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      hasIron: true,
      hasStone: true,
      text: {
        populationValue: 900,
        populationStatus: '人口已无法增长，请推进时代',
        woodValue: '0',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
        foodValue: '100',
        foodRate: '+2.4/s',
        knowledgeValue: '0',
        knowledgeRate: '+0.1/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
  });

  renderer.render({ currentEraName: '聚落时代', currentTab: 'resources', population: { total: 9 } }, { activeTab: 'resources', mode: 'hud' });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '人口已无法增长，请推进时代'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '人口：900'), false);
});

test('CanvasGameRenderer world radar applies pan offset to site positions', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({ hasWood: true, hasIron: true, hasStone: true, text: { foodValue: '100', foodRate: '+1/s', knowledgeValue: '20', knowledgeRate: '+0.2/s', woodValue: '8', woodRate: '+0.1/s', ironValue: '0', ironRate: '+0/s', stoneValue: '0', stoneRate: '+0/s' } }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildMilitaryNavigationViewState: () => ({ activeView: 'world', views: [{ id: 'world', isActive: true, disabled: false }] }),
    buildMilitaryViewState: () => ({ text: { soldierCount: '0/5', militaryDefense: 0, availableSoldierCount: 0, soldiersOnMission: 0, soldierTrainingText: '' }, training: { progressWidth: '0%' } }),
    buildScoutControlViewState: () => ({ statusText: '', reports: [], cells: [] }),
    buildTerritorySummaryViewState: () => ({ text: { polityName: '测试', territoryCount: '0/0' } }),
    buildWorldRadarViewState: (territories, opts) => ({
      pan: { x: opts?.panX || 0, y: opts?.panY || 0 },
      sites: [{ id: 'site-1', status: 'discovered', owner: 'neutral', type: 'town', name: '东岸', title: '东岸', art: '', position: { left: '50', top: '50' } }],
    }),
    buildWorldSiteDialogViewState: () => ({ showModal: false, details: [] }),
  });

  renderer.render({
    currentTab: 'military',
    militaryView: 'world',
    currentEra: 5,
    territoryState: { territories: [{ id: 'site-1', status: 'discovered', owner: 'neutral', type: 'town', naturalName: '东岸', art: '' }] },
  }, { activeTab: 'military', mode: 'hud', territoryUiState: { worldPanX: 0, worldPanY: 0 } });

  const noPanTarget = renderer.hitTargets.find((target) => target.action?.type === 'openWorldSite' && target.action?.siteId === 'site-1');
  assert.ok(noPanTarget);

  renderer.hitTargets.length = 0;
  renderer.render({
    currentTab: 'military',
    militaryView: 'world',
    currentEra: 5,
    territoryState: { territories: [{ id: 'site-1', status: 'discovered', owner: 'neutral', type: 'town', naturalName: '东岸', art: '' }] },
  }, { activeTab: 'military', mode: 'hud', territoryUiState: { worldPanX: 40, worldPanY: -30 } });

  const withPanTarget = renderer.hitTargets.find((target) => target.action?.type === 'openWorldSite' && target.action?.siteId === 'site-1');
  assert.ok(withPanTarget);
  assert.ok(Math.abs(withPanTarget.x - noPanTarget.x - 40) < 2, `panX diff should be 40, got ${withPanTarget.x - noPanTarget.x}`);
  assert.ok(Math.abs(withPanTarget.y - noPanTarget.y + 30) < 2, `panY diff should be -30, got ${withPanTarget.y - noPanTarget.y}`);
});

test('CanvasGameRenderer uses tile lab draw size overdraw for world tile maps', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const rect = renderer.getWorldTileDrawRect({ x: 100, y: 80 }, 0.5, {
    tileWidth: 192,
    tileHeight: 96,
    anchorY: 0.5,
  });

  assert.equal(rect.width, 97.5);
  assert.equal(rect.height, 48.75);
  assert.equal(rect.x, 51.25);
  assert.equal(rect.y, 55.625);
});

test('CanvasGameRenderer caches world tile local entries across camera pan', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const tileMapView = {
    signature: 'local-entry-cache-test',
    version: 1,
    seed: 'seed',
    geometry,
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0 },
      { id: 'tile_1_0', q: 1, r: 0 },
      { id: 'tile_0_1', q: 0, r: 1 },
    ],
  };
  const viewport = { originX: 120, originY: 180, panX: 0, panY: 0, scale: 0.62, geometry };
  let centerCalls = 0;
  const originalGetWorldTileScreenCenter = renderer.getWorldTileScreenCenter.bind(renderer);
  renderer.getWorldTileScreenCenter = (...args) => {
    centerCalls += 1;
    return originalGetWorldTileScreenCenter(...args);
  };

  const firstEntries = renderer.getWorldTileLocalEntries(tileMapView, viewport, geometry);
  const pannedEntries = renderer.getWorldTileLocalEntries(tileMapView, {
    ...viewport,
    originX: 180,
    originY: 220,
    panX: 42,
    panY: -18,
  }, geometry);
  const changedEntries = renderer.getWorldTileLocalEntries({
    ...tileMapView,
    signature: 'local-entry-cache-test-updated',
  }, viewport, geometry);

  assert.equal(firstEntries.length, tileMapView.tiles.length);
  assert.equal(pannedEntries, firstEntries);
  assert.notEqual(changedEntries, firstEntries);
  assert.equal(centerCalls, tileMapView.tiles.length * 2);
});

test('CanvasGameRenderer draws world overlays from lab alpha metrics instead of square icons', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const assetPath = 'assets/art/tile-map/tile-feature-tree-cluster.png';
  renderer.assetCache.set(assetPath, {
    status: 'loaded',
    image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
  });
  renderer.assetMetricsCache.set(assetPath, {
    x: 80,
    y: 60,
    width: 260,
    height: 360,
    sourceWidth: 512,
    sourceHeight: 512,
  });

  renderer.drawWorldTileFeature({
    id: 'tile_0_2',
    q: 0,
    r: 2,
    feature: {
      key: 'treeCluster',
      asset: assetPath,
      overlayKey: 'feature:treeCluster',
      offset: { x: 0, y: 4 },
    },
  }, {
    originX: 200,
    originY: 160,
    panX: 0,
    panY: 0,
    scale: 0.5,
    seed: 'visible-tree',
  }, {
    tileWidth: 192,
    tileHeight: 96,
    stepX: 96,
    stepY: 48,
    anchorY: 0.5,
  }, 96, 48);

  const clippedTreeCall = calls.find((call) => call[0] === 'drawImage' && call[1]?.src === assetPath);
  assert.ok(clippedTreeCall);
  assert.equal(clippedTreeCall[2], 80);
  assert.equal(clippedTreeCall[3], 60);
  assert.equal(clippedTreeCall[4], 260);
  assert.equal(clippedTreeCall[5], 360);
  assert.ok(calls.some((call) => call[0] === 'ellipse'));
});

test('H5CanvasGameRenderer extends CanvasGameRenderer with browser Image constructor', () => {
  const originalImage = global.Image;
  let imageCreated = false;
  global.Image = function () {
    imageCreated = true;
    return { src: '', onload: null, onerror: null };
  };

  try {
    const { ctx } = makeCtx();
    const renderer = new H5CanvasGameRenderer({ ctx, width: 390, height: 844 });

    assert.equal(renderer.width, 390);
    assert.equal(renderer.height, 844);
    assert.ok(renderer instanceof CanvasGameRenderer);

    const img = renderer.createImage('assets/art/icon-food-cutout.webp');
    assert.ok(imageCreated);
    assert.ok(img);
  } finally {
    global.Image = originalImage;
  }
});

test('CanvasGameRenderer HUD overlay matches measured mobile DOM baseline responsively', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '2.1M',
        foodRate: '+11.4/s',
        knowledgeValue: '249k',
        knowledgeRate: '+1.4/s',
        woodValue: '3.3M',
        woodRate: '+18/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: false, activeCityName: '首都' }),
    buildAdvisorViewState: () => ({ hidden: false }),
  });

  renderer.render({ currentEraName: '古典时代', currentTab: 'resources' }, { activeTab: 'resources', mode: 'hud' });

  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 12 && c[2] === 12 && c[3] === 366 && c[4] === 166), 'top bar should use readable 366x166 HUD rect');
  assert.equal(calls.some((c) => c[0] === 'roundRect' && c[2] === 68 && c[4] === 48), false, 'resource strip should not draw individual card backgrounds');
  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 92 && c[2] === 138 && c[3] === 190 && c[4] === 32), 'city switcher should sit under the readable resource strip');
  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 12 && c[2] === 786 && c[3] === 366 && c[4] === 58), 'bottom tab bar should keep DOM app inset while matching measured 58px height');
});

test('CanvasGameRenderer HUD overlay keeps responsive desktop max width for tab bar and top content', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 1024, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: false,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
  });

  renderer.render({ currentEraName: '原始时代', currentTab: 'resources' }, { activeTab: 'resources', mode: 'hud' });

  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 272 && c[3] === 480), 'top content should keep max 480px centered on desktop');
  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 272 && c[2] === 786 && c[3] === 480 && c[4] === 58), 'tab bar should keep max 480px centered on desktop');
});

test('CanvasGameRenderer layout keeps stage 5 overlay inset from viewport like DOM app padding', () => {
  const { ctx } = makeCtx();
  const mobileRenderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  assert.deepEqual(mobileRenderer.getLayout(), { contentX: 12, contentWidth: 366, contentRight: 378 });

  const desktopRenderer = new CanvasGameRenderer({ ctx, width: 1024, height: 844, pixelRatio: 1 });
  assert.deepEqual(desktopRenderer.getLayout(), { contentX: 272, contentWidth: 480, contentRight: 752 });
});

test('CanvasGameRenderer HUD overlay draws city dropdown arrow when city switcher is visible', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '2',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: false, activeCityName: '首都' }),
    buildAdvisorViewState: () => ({ hidden: true }),
  });

  renderer.render({ currentEraName: '古典时代', currentTab: 'resources' }, { activeTab: 'resources', mode: 'hud' });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '首都'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '▾'));
});

test('CanvasGameRenderer renders city switcher menu and city hit targets on canvas', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '2',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({
      hidden: false,
      activeCityName: '首都',
      options: [
        { id: 'capital', name: '首都', tag: '主城', metaText: '人口 800 · 建筑 4', isActive: true },
        { id: 'site_river', name: '河湾城', tag: '分城', metaText: '人口 300 · 建筑 1', isActive: false },
      ],
    }),
    buildAdvisorViewState: () => ({ hidden: true }),
  });

  renderer.render({ currentEraName: '古典时代', currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    showCitySwitcher: true,
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '河湾城'));
  assert.deepEqual(renderer.getHitTarget({ x: 40, y: 100 }), { type: 'closeCitySwitcher' });
  const cityTarget = renderer.hitTargets.find((target) => target.action?.type === 'selectCity' && target.action.cityId === 'site_river');
  assert.ok(cityTarget);
  assert.deepEqual(renderer.getHitTarget({
    x: cityTarget.x + cityTarget.width / 2,
    y: cityTarget.y + cityTarget.height / 2,
  }), { type: 'selectCity', cityId: 'site_river' });
});

test('CanvasGameRenderer HUD overlay registers resource cards and six DOM-order tab hit targets', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '2',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: false, activeCityName: '首都' }),
    buildAdvisorViewState: () => ({ hidden: false }),
  });

  renderer.render({ currentEraName: '古典时代', currentTab: 'resources' }, { activeTab: 'resources', mode: 'hud' });

  assert.deepEqual(renderer.getHitTarget({ x: 40, y: 100 }), { type: 'openResourceDetails' });
  assert.deepEqual(renderer.getHitTarget({ x: 75, y: 804 }), { type: 'switchTab', tab: 'buildings', disabled: false });
  assert.deepEqual(renderer.getHitTarget({ x: 135, y: 804 }), { type: 'switchTab', tab: 'tech', disabled: false });
  assert.deepEqual(renderer.getHitTarget({ x: 320, y: 804 }), { type: 'switchTab', tab: 'military', disabled: false });
});

test('CanvasGameRenderer map home uses command dock instead of page tabs', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      text: {
        foodValue: '12.3K',
        woodValue: '2',
        stoneValue: '0',
        ironValue: '0',
        knowledgeValue: '1',
        populationValue: '300',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true, options: [] }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildMilitaryNavigationViewState: () => ({ activeView: 'world', views: [{ id: 'world', isActive: true }] }),
    buildTerritorySummaryViewState: () => ({ text: { polityName: '测试', territoryCount: '1/1' } }),
    buildWorldTileMapViewState: () => ({ tiles: [] }),
    buildWorldRadarViewState: () => ({ pan: { x: 0, y: 0 }, sites: [] }),
    buildWorldSiteDialogViewState: () => ({ showModal: false, details: [] }),
  });

  renderer.render({
    currentEra: 5,
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { territories: [] },
  }, {
    activeTab: 'military',
    mode: 'hud',
    isMapHome: true,
  });

  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openCommandPanel' && target.action.panel === 'capital'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openSubcityList'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openSettings'));
  assert.deepEqual(renderer.getHitTarget({ x: 350, y: 690 }), { type: 'openSubcityList' });
  assert.notEqual(renderer.getHitTarget({ x: 195, y: 804 })?.type, 'openSubcityList');
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'switchTab'), false);
  assert.ok(calls.some((call) => call[0] === 'fillRect' && call[1] === 0 && call[2] === 0 && call[3] === 390 && call[4] === 72));
  assert.ok(calls.some((call) => call[0] === 'fillRect' && call[1] === 0 && call[2] === 780 && call[3] === 390 && call[4] === 64));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '粮食'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '人口'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '12.3K'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '谋'), false);
});

test('CanvasGameRenderer map home renders subcity jump list', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({ text: { foodValue: '10', woodValue: '2', stoneValue: '0', ironValue: '0', knowledgeValue: '1', populationValue: '300' } }),
    buildCitySwitcherViewState: () => ({
      hidden: false,
      options: [
        { id: 'capital', name: '首都', tag: '主城', metaText: '人口 300', isActive: false },
        { id: 'site_river', name: '河湾城', tag: '分城', metaText: '人口 200 · 平原', isActive: false },
      ],
    }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildMilitaryNavigationViewState: () => ({ activeView: 'world', views: [{ id: 'world', isActive: true }] }),
    buildTerritorySummaryViewState: () => ({ text: { polityName: '测试', territoryCount: '1/1' } }),
    buildWorldTileMapViewState: () => ({ tiles: [] }),
    buildWorldRadarViewState: () => ({ pan: { x: 0, y: 0 }, sites: [] }),
    buildWorldSiteDialogViewState: () => ({ showModal: false, details: [] }),
  });

  renderer.render({
    currentEra: 5,
    currentTab: 'military',
    militaryView: 'world',
    territoryState: { territories: [] },
  }, {
    activeTab: 'military',
    mode: 'hud',
    isMapHome: true,
    showSubcityList: true,
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '分城管理'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'jumpToSubcity' && target.action.cityId === 'site_river'));
});

test('CanvasGameRenderer disables tutorial-locked canvas tabs', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '2',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
  });

  renderer.render({ currentEraName: '古典时代', currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    tabLocks: [
      { id: 'resources', disabled: false, isLocked: false },
      { id: 'buildings', disabled: true, isLocked: true },
    ],
  });

  assert.deepEqual(renderer.getHitTarget({ x: 75, y: 804 }), { type: 'switchTab', tab: 'buildings', disabled: true });
});

test('CanvasGameRenderer draws tutorial highlight overlay and bubble', () => {
  const { ctx, calls } = makeCtx();
  const CanvasGameRenderer = require('../js/platform/CanvasGameRenderer');
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildTutorialHighlightViewState: UIStatePresenter.buildTutorialHighlightViewState.bind(UIStatePresenter),
    buildResourceViewState: () => ({
      hasWood: false,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
  });

  renderer.render({ currentEraName: '鍘熷鏃朵唬', currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    tutorialHighlight: {
      rect: { left: 20, top: 220, width: 300, height: 32, right: 320, bottom: 252 },
      message: 'Advance now',
    },
  });

  assert.ok(calls.some((call) => call[0] === 'fillRect' && call[1] === 0 && call[2] === 0 && call[3] === 390));
  assert.ok(calls.some((call) => call[0] === 'roundRect' && call[1] === 12 && call[2] === 212 && call[3] === 316 && call[4] === 48));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === 'Advance now'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1]));
  assert.deepEqual(renderer.getHitTarget({ x: 30, y: 120 }), { type: 'blockCanvasModal' });
});

test('CanvasGameRenderer tutorial highlight blocks non-target clicks but keeps target actionable', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: false,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTutorialHighlightViewState: UIStatePresenter.buildTutorialHighlightViewState.bind(UIStatePresenter),
  });

  renderer.render({ currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    tutorialHighlight: {
      rect: { left: 24, top: 786, width: 57, height: 58, right: 81, bottom: 844 },
      message: 'Only this tab works',
    },
  });

  assert.deepEqual(renderer.getHitTarget({ x: 110, y: 804 }), { type: 'blockCanvasModal' });
  assert.deepEqual(renderer.getHitTarget({ x: 40, y: 804 }), { type: 'switchTab', tab: 'resources', disabled: false });
});

test('CanvasGameRenderer tutorial highlight keeps final target actionable during transition', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: false,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTutorialHighlightViewState: UIStatePresenter.buildTutorialHighlightViewState.bind(UIStatePresenter),
  });

  renderer.render({ currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    now: 1000,
    tutorialHighlight: {
      rect: { left: 73, top: 786, width: 61, height: 58, right: 134, bottom: 844 },
      transition: {
        fromRect: { left: 24, top: 786, width: 57, height: 58, right: 81, bottom: 844 },
        toRect: { left: 73, top: 786, width: 61, height: 58, right: 134, bottom: 844 },
        startedAt: 980,
        durationMs: 260,
      },
      message: '点击建筑',
    },
  });

  assert.deepEqual(renderer.getHitTarget({ x: 95, y: 804 }), { type: 'switchTab', tab: 'buildings', disabled: false });
  assert.deepEqual(renderer.getHitTarget({ x: 170, y: 804 }), { type: 'blockCanvasModal' });
});

test('CanvasGameRenderer keeps main tasks out of the home HUD and renders reward reveal', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '260',
        foodRate: '+0/s',
        knowledgeValue: '80',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
  });

  renderer.render({
    currentEraName: '城邦时代',
    currentTab: 'resources',
    guideTasks: {
      visible: true,
      tasks: [{
        id: 'barracks_supplies',
        title: '城邦守备',
        description: '先建造兵营',
        status: 'claimable',
        rewardText: '食物 +260 / 知识 +80',
      }],
    },
  }, {
    activeTab: 'resources',
    mode: 'hud',
    rewardReveal: {
      title: '获得奖励',
      subtitle: '城邦守备',
      rewardText: '食物 +260 / 知识 +80',
      createdAt: Date.now(),
    },
  });

  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '主线'), false);
  assert.equal(renderer.hitTargets.some((target) => (
    target.action?.type === 'openTaskCenter'
    && target.action.tab === 'main'
    && target.action.source === 'guideTaskBar'
  )), false);
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'claimGuideTaskReward'), false);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '获得奖励'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '收下'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeRewardReveal'));
});

test('CanvasGameRenderer renders main task go button inside task center panel', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '260',
        foodRate: '+0/s',
        knowledgeValue: '80',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTaskCenterViewState: UIStatePresenter.buildTaskCenterViewState.bind(UIStatePresenter),
  });

  renderer.render({
    currentEraName: '城邦时代',
    currentTab: 'resources',
    guideTasks: {
      visible: true,
      tasks: [{
        id: 'barracks_supplies',
        title: '城邦守备',
        description: '先建造兵营',
        status: 'active',
        target: 'card-barracks',
        actionLabel: '前往',
        action: {
          type: 'goToGuideTaskTarget',
          taskId: 'barracks_supplies',
          target: 'card-barracks',
          nextAction: { type: 'buildBuilding', buildingId: 'barracks' },
        },
      }],
    },
  }, {
    activeTab: 'resources',
    mode: 'hud',
    showTaskCenter: true,
    activeTaskCenterTab: 'main',
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '前往'));
  assert.ok(renderer.hitTargets.some((target) => (
    target.action?.type === 'goToGuideTaskTarget'
    && target.action.taskId === 'barracks_supplies'
    && !target.action.disabled
  )));
});

test('CanvasGameRenderer renders task center entry and panel with category tabs', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '260',
        foodRate: '+0/s',
        knowledgeValue: '80',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTaskCenterViewState: UIStatePresenter.buildTaskCenterViewState.bind(UIStatePresenter),
    buildHomeFeatureViewState: UIStatePresenter.buildHomeFeatureViewState.bind(UIStatePresenter),
  });

  renderer.render({
    currentEraName: '城邦时代',
    currentTab: 'resources',
    taskCenter: {
      visible: true,
      activeTab: 'main',
      tabs: [
        { id: 'daily', label: '每日任务', badge: 0 },
        { id: 'main', label: '主线任务', badge: 1 },
        { id: 'season', label: '赛季任务', badge: 0 },
        { id: 'challenge', label: '挑战任务', badge: 0 },
      ],
      categories: {
        daily: { tasks: [], emptyText: '暂无每日任务' },
        main: {
          tasks: [{
            id: 'barracks_supplies',
            title: '城邦守备',
            description: '建造兵营',
            status: 'claimable',
            rewardText: '食物 +260 / 知识 +80',
          }, {
            id: 'lumbermill_supplies',
            title: '备齐伐木物资',
            description: '建造伐木场',
            status: 'completed',
            actionLabel: '已完成',
            rewardText: '木材 +15 / 食物 +50',
          }],
        },
        season: { tasks: [], emptyText: '暂无赛季任务' },
        challenge: { tasks: [], emptyText: '暂无挑战任务' },
      },
      summary: { claimableCount: 1, activeCount: 1 },
    },
  }, {
    activeTab: 'resources',
    mode: 'hud',
    showTaskCenter: true,
    activeTaskCenterTab: 'main',
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '任务'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '任'), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '务'), false);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '主线任务'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '城邦守备'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '已完成'));
  assert.ok(renderer.hitTargets.some((target) => (
    target.action?.type === 'openTaskCenter'
    && target.action.source === 'taskIcon'
  )));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'switchTaskCenterTab' && target.action.tab === 'daily'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'claimTaskReward' && target.action.taskId === 'barracks_supplies'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.disabled === true && target.action?.taskId === 'lumbermill_supplies'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeTaskCenter'));
});

test('CanvasGameRenderer renders homepage feature grid and famous person panel', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      hasIron: true,
      hasStone: true,
      text: {
        foodValue: '260',
        foodRate: '+0/s',
        knowledgeValue: '80',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTaskCenterViewState: UIStatePresenter.buildTaskCenterViewState.bind(UIStatePresenter),
    buildPopulationViewState: UIStatePresenter.buildPopulationViewState.bind(UIStatePresenter),
    buildHomeFeatureViewState: UIStatePresenter.buildHomeFeatureViewState.bind(UIStatePresenter),
    buildFamousPersonViewState: UIStatePresenter.buildFamousPersonViewState.bind(UIStatePresenter),
  });
  [
    'assets/art/famous-person/layers/fp-layer-v3-outfit-01.png',
    'assets/art/famous-person/layers/fp-layer-v3-face-01.png',
    'assets/art/famous-person/layers/fp-layer-v3-hair-01.png',
  ].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
    });
  });

  renderer.render({
    currentEraName: '城邦时代',
    currentTab: 'resources',
    currentEra: 3,
    population: { total: 3, unassigned: 1, farmers: 1, scholars: 1, craftsmen: 1 },
    famousPersons: {
      count: 1,
      candidateCount: 1,
      maxCandidates: 3,
      seek: { available: true, count: 1 },
      people: [{
        id: 'fp_a',
        name: '陆骁',
        title: '破阵先登',
        source: { type: 'seek', label: '寻访' },
        level: 2,
        experience: 35,
        nextLevelExperience: 190,
        freeAttributePoints: 4,
        autoAttributeGrowth: { command: 1, force: 4, charisma: 1, speed: 2 },
        quality: 'legendary',
        roles: ['military'],
        attributes: { command: 70, force: 82, intelligence: 40, politics: 28, charisma: 55, speed: 66 },
        abilityKit: {
          abilities: [
            { name: '血刃破阵', slot: 'activeSkill', kind: 'active', cooldown: 3, castConditions: [{ type: 'cooldownReady' }, { type: 'targetAlive' }], effects: [{ key: 'directDamage' }, { key: 'lifesteal' }] },
            { name: '锐锋', slot: 'passiveTrait', kind: 'passive', trigger: 'preBattle', effects: [{ key: 'attributeBonus' }] },
          ],
        },
        skills: [{ name: '血刃破阵', effects: [{ key: 'directDamage' }, { key: 'lifesteal' }] }],
        appearance: {
          version: 'famous-portrait-v3.0',
          layers: {
            outfit: 'assets/art/famous-person/layers/fp-layer-v3-outfit-01.png',
            face: 'assets/art/famous-person/layers/fp-layer-v3-face-01.png',
            hair: 'assets/art/famous-person/layers/fp-layer-v3-hair-01.png',
          },
        },
        status: { assigned: 'idle' },
      }],
      candidates: [{
        id: 'fpc_b',
        name: '姜衡',
        title: '垒门守将',
        source: { type: 'event', label: '事件投奔' },
        roles: ['governance'],
        attributes: { command: 50, force: 30, intelligence: 60, politics: 80, charisma: 66, speed: 42 },
        abilityKit: {
          abilities: [
            { name: '督田理赋', slot: 'civilPrimary', kind: 'civil', trigger: 'passiveStored', implementationStatus: 'storedOnly', effects: [{ key: 'resourceOutputPct' }] },
            { name: '仓廪整备', slot: 'civilSecondary', kind: 'civil', trigger: 'passiveStored', implementationStatus: 'storedOnly', effects: [{ key: 'populationCapPct' }] },
          ],
        },
        skills: [],
      }],
    },
  }, {
    activeTab: 'resources',
    mode: 'hud',
    showFamousPersons: true,
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '主页'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '功能'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '名人'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '寻访'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '接纳'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '传奇'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === 'Lv.2'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && /等级 2 · 经验 35\/190/.test(call[1])), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && /可分配属性点 4/.test(call[1])), false);
  assert.equal(renderer.hitTargets.some((target) => (
    target.action?.type === 'assignFamousAttributePoint'
    && target.action.personId === 'fp_a'
    && target.action.attribute === 'command'
  )), false);
  assert.ok(renderer.hitTargets.some((target) => (
    target.action?.type === 'openFamousPersonDetail'
    && target.action.personId === 'fp_a'
  )));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /内政主技：督田理赋/.test(call[1])));
  assert.equal(calls.some((call) => call[0] === 'fillText' && /冷却3次自身行动/.test(call[1])), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && /当前仅展示/.test(call[1])), false);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '速'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '66'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '工巧'), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '工'), false);
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'showFamousSkillTooltip'));
  assert.ok(calls.some((call) => (
    call[0] === 'drawImage'
    && call[1]?.src === 'assets/art/famous-person/layers/fp-layer-v3-face-01.png'
  )));
  assert.ok(calls.some((call) => (
    call[0] === 'roundRect'
    && call[3] === 74
    && call[4] === 98
  )));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '陆'), false);
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openFamousPersons'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'seekFamousPerson'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'acceptFamousPerson' && target.action.candidateId === 'fpc_b'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'dismissFamousPersonCandidate' && target.action.candidateId === 'fpc_b'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeFamousPersons'));

  calls.length = 0;
  renderer.render({
    currentEraName: '城邦时代',
    currentTab: 'resources',
    currentEra: 3,
    population: { total: 3, unassigned: 1, farmers: 1, scholars: 1, craftsmen: 1 },
    famousPersons: {
      count: 1,
      candidateCount: 0,
      maxCandidates: 3,
      seek: { available: true, count: 1 },
      people: [{
        id: 'fp_a',
        name: '陆骁',
        title: '破阵先登',
        source: { type: 'seek', label: '寻访' },
        level: 2,
        experience: 35,
        nextLevelExperience: 190,
        freeAttributePoints: 4,
        autoAttributeGrowth: { command: 1, force: 4, charisma: 1, speed: 2 },
        quality: 'legendary',
        roles: ['military'],
        attributes: { command: 70, force: 82, intelligence: 40, politics: 28, charisma: 55, speed: 66 },
        abilityKit: {
          abilities: [
            { name: '血刃破阵', slot: 'activeSkill', kind: 'active', cooldown: 3, castConditions: [{ type: 'cooldownReady' }, { type: 'targetAlive' }], effects: [{ key: 'directDamage' }, { key: 'lifesteal' }] },
            { name: '锐锋', slot: 'passiveTrait', kind: 'passive', trigger: 'preBattle', effects: [{ key: 'attributeBonus' }] },
          ],
        },
        appearance: {
          version: 'famous-portrait-v3.0',
          layers: {
            outfit: 'assets/art/famous-person/layers/fp-layer-v3-outfit-01.png',
            face: 'assets/art/famous-person/layers/fp-layer-v3-face-01.png',
            hair: 'assets/art/famous-person/layers/fp-layer-v3-hair-01.png',
          },
        },
        status: { assigned: 'idle' },
      }],
      candidates: [],
    },
  }, {
    activeTab: 'resources',
    mode: 'hud',
    showFamousPersons: true,
    selectedFamousPersonId: 'fp_a',
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && /等级 2 · 经验 35\/190/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /可分配属性点 4/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /可分配 4 点/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /自动成长 8 点/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /主动战法：血刃破阵/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /战斗被动：锐锋/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '+'));
  assert.ok(renderer.hitTargets.some((target) => (
    target.action?.type === 'assignFamousAttributePoint'
    && target.action.personId === 'fp_a'
    && target.action.attribute === 'command'
  )));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeFamousPersonDetail'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'showFamousSkillTooltip'));
});

test('CanvasGameRenderer shows famous skill detail only from hover or tap tooltip', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({ text: { foodValue: '0', foodRate: '+0/s', knowledgeValue: '0', knowledgeRate: '+0/s' } }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTaskCenterViewState: UIStatePresenter.buildTaskCenterViewState.bind(UIStatePresenter),
    buildPopulationViewState: UIStatePresenter.buildPopulationViewState.bind(UIStatePresenter),
    buildHomeFeatureViewState: UIStatePresenter.buildHomeFeatureViewState.bind(UIStatePresenter),
    buildFamousPersonViewState: UIStatePresenter.buildFamousPersonViewState.bind(UIStatePresenter),
  });

  const state = {
    currentEraName: '城邦时代',
    currentTab: 'resources',
    currentEra: 3,
    population: { total: 3, unassigned: 1, farmers: 1, scholars: 1, craftsmen: 1 },
    famousPersons: {
      count: 1,
      candidateCount: 0,
      maxCandidates: 3,
      seek: { available: true, count: 1 },
      people: [{
        id: 'fp_a',
        name: '陆骁',
        title: '破阵先登',
        source: { type: 'seek', label: '寻访' },
        roles: ['military'],
        attributes: { command: 70, force: 82, intelligence: 40, politics: 28, charisma: 55, speed: 66 },
        abilityKit: {
          abilities: [
            { id: 'skill_a', name: '血刃破阵', slot: 'activeSkill', kind: 'active', cooldown: 3, castConditions: [{ type: 'cooldownReady' }], effects: [{ key: 'directDamage' }, { key: 'lifesteal' }] },
            { id: 'trait_a', name: '锐锋', slot: 'passiveTrait', kind: 'passive', trigger: 'preBattle', effects: [{ key: 'attributeBonus' }] },
          ],
        },
        appearance: { version: 'famous-portrait-v3.0', layers: {} },
      }],
      candidates: [],
    },
  };

  renderer.render(state, { activeTab: 'resources', mode: 'hud', showFamousPersons: true, selectedFamousPersonId: 'fp_a' });
  assert.equal(calls.some((call) => call[0] === 'fillText' && /冷却3次自身行动/.test(call[1])), false);
  const skillTarget = renderer.hitTargets.find((target) => target.action?.type === 'showFamousSkillTooltip');
  assert.ok(skillTarget);

  calls.length = 0;
  renderer.setHoverPoint({ x: skillTarget.x + 4, y: skillTarget.y + 4 });
  renderer.render(state, { activeTab: 'resources', mode: 'hud', showFamousPersons: true, selectedFamousPersonId: 'fp_a' });
  assert.ok(calls.some((call) => call[0] === 'fillText' && /效果：发动战法攻击目标/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /倒戈/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /冷却：3 回合/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === 'fillText' && /发动率：100%/.test(call[1])));
  assert.equal(calls.some((call) => call[0] === 'fillText' && /规则：|说明：|直接伤害|属性修正|自身行动|出手机会|冷却就绪|目标存活|cooldownReady|targetAlive|条件：/.test(call[1])), false);

  calls.length = 0;
  renderer.setHoverPoint(null);
  renderer.setPinnedFamousSkillTooltip(skillTarget.action);
  renderer.render(state, { activeTab: 'resources', mode: 'hud', showFamousPersons: true, selectedFamousPersonId: 'fp_a' });
  assert.ok(calls.some((call) => call[0] === 'fillText' && /倒戈/.test(call[1])));
});

test('CanvasGameRenderer paginates joined famous people in famous person panel', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({ text: { foodValue: '0', foodRate: '+0/s', knowledgeValue: '0', knowledgeRate: '+0/s' } }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTaskCenterViewState: UIStatePresenter.buildTaskCenterViewState.bind(UIStatePresenter),
    buildPopulationViewState: UIStatePresenter.buildPopulationViewState.bind(UIStatePresenter),
    buildHomeFeatureViewState: UIStatePresenter.buildHomeFeatureViewState.bind(UIStatePresenter),
    buildFamousPersonViewState: UIStatePresenter.buildFamousPersonViewState.bind(UIStatePresenter),
  });
  const makePerson = (index) => ({
    id: `fp_${index}`,
    name: `名人${String(index).padStart(2, '0')}`,
    title: `称号${index}`,
    source: { type: 'seek', label: '寻访' },
    roles: ['military'],
    attributes: { command: 50 + index, force: 50, intelligence: 50, politics: 50, charisma: 50, speed: 50 },
    abilityKit: {
      abilities: [
        { id: `skill_${index}`, name: `战法${index}`, slot: 'activeSkill', kind: 'active', cooldown: 2, effects: [{ key: 'directDamage' }] },
        { id: `trait_${index}`, name: `特质${index}`, slot: 'passiveTrait', kind: 'passive', trigger: 'preBattle', effects: [{ key: 'attributeBonus' }] },
      ],
    },
    appearance: { version: 'famous-portrait-v3.0', layers: {} },
  });
  const state = {
    currentEraName: '城邦时代',
    currentTab: 'resources',
    currentEra: 3,
    population: { total: 3, unassigned: 1, farmers: 1, scholars: 1, craftsmen: 1 },
    famousPersons: {
      count: 10,
      candidateCount: 0,
      maxCandidates: 3,
      seek: { available: true, count: 1 },
      people: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(makePerson),
      candidates: [],
    },
  };

  renderer.render(state, { activeTab: 'resources', mode: 'hud', showFamousPersons: true, famousPersonsPage: 0 });
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '名人01'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '名人10'), false);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '1/2'));
  assert.ok(renderer.hitTargets.some((target) => (
    target.action?.type === 'changeFamousPersonsPage'
    && target.action.delta === 1
    && target.action.disabled === false
  )));

  calls.length = 0;
  renderer.render(state, { activeTab: 'resources', mode: 'hud', showFamousPersons: true, famousPersonsPage: 5 });
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '名人10'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '名人01'), false);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '2/2'));
});

test('CanvasGameRenderer closes pinned famous skill detail from badge toggle or panel blank tap', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({ text: { foodValue: '0', foodRate: '+0/s', knowledgeValue: '0', knowledgeRate: '+0/s' } }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTaskCenterViewState: UIStatePresenter.buildTaskCenterViewState.bind(UIStatePresenter),
    buildPopulationViewState: UIStatePresenter.buildPopulationViewState.bind(UIStatePresenter),
    buildHomeFeatureViewState: UIStatePresenter.buildHomeFeatureViewState.bind(UIStatePresenter),
    buildFamousPersonViewState: UIStatePresenter.buildFamousPersonViewState.bind(UIStatePresenter),
  });
  const state = {
    currentTab: 'resources',
    currentEra: 3,
    population: { total: 3, unassigned: 1, farmers: 1, scholars: 1, craftsmen: 1 },
    famousPersons: {
      count: 1,
      candidateCount: 0,
      maxCandidates: 3,
      seek: { available: true, count: 1 },
      people: [{
        id: 'fp_a',
        name: 'Leader A',
        title: 'Vanguard',
        source: { type: 'seek', label: 'Seek' },
        roles: ['military'],
        attributes: { command: 70, force: 82, intelligence: 40, politics: 28, charisma: 55, speed: 66 },
        abilityKit: {
          abilities: [
            { id: 'skill_a', name: 'Blade Rush', slot: 'activeSkill', kind: 'active', cooldown: 3, effects: [{ key: 'directDamage' }] },
            { id: 'trait_a', name: 'Sharp Edge', slot: 'passiveTrait', kind: 'passive', trigger: 'preBattle', effects: [{ key: 'attributeBonus' }] },
          ],
        },
      }],
      candidates: [],
    },
  };

  renderer.render(state, { activeTab: 'resources', mode: 'hud', showFamousPersons: true, selectedFamousPersonId: 'fp_a' });
  const skillTarget = renderer.hitTargets.find((target) => target.action?.type === 'showFamousSkillTooltip');
  assert.ok(skillTarget);

  assert.equal(renderer.setPinnedFamousSkillTooltip(skillTarget.action), true);
  renderer.render(state, { activeTab: 'resources', mode: 'hud', showFamousPersons: true, selectedFamousPersonId: 'fp_a' });
  assert.ok(renderer.pinnedFamousSkillTooltip);
  const clearTarget = renderer.hitTargets.find((target) => target.action?.type === 'clearFamousSkillTooltip');
  assert.ok(clearTarget);
  assert.deepEqual(
    renderer.getHitTarget({ x: clearTarget.x + 4, y: clearTarget.y + 4 }),
    { type: 'clearFamousSkillTooltip' },
  );

  assert.equal(renderer.setPinnedFamousSkillTooltip(skillTarget.action), true);
  assert.equal(renderer.pinnedFamousSkillTooltip, null);
  renderer.setPinnedFamousSkillTooltip(skillTarget.action);
  assert.equal(renderer.clearFamousSkillTooltip(), true);
  assert.equal(renderer.pinnedFamousSkillTooltip, null);
});

test('CanvasGameRenderer renders famous person leader choices in world expedition config', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({
      text: {
        woodValue: '0',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
        foodValue: '0',
        foodRate: '+0/s',
        knowledgeValue: '0',
        knowledgeRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildMilitaryNavigationViewState: () => ({ activeView: 'world', tabs: [] }),
    buildMilitaryViewState: () => ({}),
    buildScoutControlViewState: () => ({ cells: [] }),
    buildTerritorySummaryViewState: () => ({
      text: { polityName: '火种部族', territoryCount: '1/1 已控制' },
    }),
    buildWorldRadarViewState: UIStatePresenter.buildWorldRadarViewState.bind(UIStatePresenter),
    buildWorldSiteDialogViewState: UIStatePresenter.buildWorldSiteDialogViewState.bind(UIStatePresenter),
  });

  renderer.render({
    currentTab: 'military',
    territoryState: {
      availableSoldiers: 800,
      missionDurationSeconds: 120,
      famousPersons: {
        people: [
          { id: 'fp_luxiao', name: '陆骁', title: '破阵先登', roles: ['military'] },
          { id: 'fp_jiangheng', name: '姜衡', title: '垒门守将', roles: ['military'] },
        ],
      },
      territories: [{
        id: 'tribe_site',
        x: 1,
        y: 0,
        status: 'discovered',
        owner: 'tribe',
        occupationMode: 'conquest',
        naturalName: '林地部落',
        scale: 2,
        threat: 4,
        defense: 500,
        recommendedSoldiers: 500,
        visualOffset: { x: 0, y: 0 },
        effects: {},
      }],
    },
  }, {
    activeTab: 'military',
    mode: 'hud',
    activeMilitaryView: 'world',
    territoryUiState: {
      selectedSiteId: 'tribe_site',
      expeditionConfigSiteId: 'tribe_site',
      expeditionLeader: 'fp_jiangheng',
      expeditionSoldiers: '500',
    },
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('领队')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('陆骁')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('姜衡')));
  assert.ok(renderer.hitTargets.some((target) => (
    target.action?.type === 'changeExpeditionLeader'
    && target.action.value === 'fp_luxiao'
  )));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'launchExpedition'));
});

test('CanvasGameRenderer renders animated battle scene with visual soldier groups', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.assetCache.set('assets/art/battle/battlefield-forest-camp.png', {
    status: 'loaded',
    image: { width: 1448, height: 1086, naturalWidth: 1448, naturalHeight: 1086 },
  });
  CanvasGameRenderer.getBattleUnitFramePaths().forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 500, height: 400, naturalWidth: 500, naturalHeight: 400 },
    });
  });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildBattleSceneViewState: UIStatePresenter.buildBattleSceneViewState.bind(UIStatePresenter),
  });

  renderer.render({}, {
    mode: 'hud',
    now: 4000,
    battleScene: {
      visible: true,
      turnIndex: 0,
      turnStartedAt: 1200,
      turnDurationMs: 3100,
      report: {
        id: 'battle_1',
        result: 'victory',
        groupSize: 100,
        attacker: {
          leaderName: '陆骁',
          leaderTitle: '破阵先登',
          speed: 76,
          soldiersStart: 501,
          appearance: {
            layers: {
              outfit: 'assets/art/famous-person/layers/fp-layer-v3-outfit-01.png',
              face: 'assets/art/famous-person/layers/fp-layer-v3-face-01.png',
              hair: 'assets/art/famous-person/layers/fp-layer-v3-hair-10.png',
            },
          },
        },
        defender: {
          name: '林地部落',
          speed: 53,
          soldiersStart: 500,
        },
        turns: [{
          index: 1,
          round: 1,
          actor: 'attacker',
          target: 'defender',
          action: 'skill',
          actionType: 'skill',
          skillName: '血刃破阵',
          damage: 43,
          cooldownBefore: 0,
          cooldownAfter: 3,
          actorName: '陆骁',
          actorPortrait: {
            layers: {
              outfit: 'assets/art/famous-person/layers/fp-layer-v3-outfit-01.png',
              face: 'assets/art/famous-person/layers/fp-layer-v3-face-01.png',
              hair: 'assets/art/famous-person/layers/fp-layer-v3-hair-10.png',
            },
          },
          presentation: { cutIn: true, showSkillName: true, emphasis: 'skill' },
          text: '陆骁队发动血刃破阵，林地部落损失 43 士兵',
          lines: ['[陆骁] 开始行动', '[陆骁] 发动战法 [血刃破阵]', '[林地部落] 受到兵刃伤害 43（457）'],
          attackerSoldiersBefore: 501,
          defenderSoldiersBefore: 500,
          attackerSoldiersAfter: 501,
          defenderSoldiersAfter: 457,
          statusesBefore: { attacker: [], defender: [] },
          statusesAfter: {
            attacker: [{ key: 'shield', label: '守御', shieldRemaining: 42, turnsRemaining: 2 }],
            defender: [{ key: 'armorBreak', label: '破甲', turnsRemaining: 2, stacks: 1 }],
          },
        }],
        visual: {
          map: {
            id: 'forest-camp',
            background: 'assets/art/battle/battlefield-forest-camp.png',
            soldierSprites: {
              attacker: 'assets/art/battle/units/player',
              defender: 'assets/art/battle/units/enemy',
            },
            palette: ['#283f2e', '#526a3b', '#8b6f3a'],
          },
        },
      },
    },
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('陆骁队 vs 林地部落队')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('501/501')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('457/500')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('[陆骁] 开始行动')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('血刃破阵')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('冷却 3 回合')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('守御 42')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('破甲 2回合')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('受到兵刃伤害')));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'skipBattleScene' || target.action?.type === 'closeBattleScene'));
  assert.ok(calls.some((call) => (
    call[0] === 'drawImage'
    && call[1]?.src?.startsWith('assets/art/battle/units/')
    && call.length === 6
  )));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('-43')));
});

test('CanvasGameRenderer maps split battle frame poses without hit frames or death offsets', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  CanvasGameRenderer.getBattleUnitFramePaths().forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 500, height: 400, naturalWidth: 500, naturalHeight: 400 },
    });
  });

  assert.equal(
    renderer.getBattleFrameSpritePath('attacker', 'hit', 0, 'assets/art/battle/units/player', 0.5),
    'assets/art/battle/units/player/idle/01.png',
  );
  assert.equal(
    renderer.getBattleFrameSpritePath('defender', 'skill', 0, 'assets/art/battle/units/enemy', 1),
    'assets/art/battle/units/enemy/attack/04.png',
  );
  assert.equal(
    renderer.getBattleFrameSpritePath('attacker', 'defeated', 0, 'assets/art/battle/units/player', 0.75),
    'assets/art/battle/units/player/die/04.png',
  );

  renderer.drawBattleSoldierSprite(160, 280, 'attacker', 'die', 0, 1, 0.21, 'assets/art/battle/units/player', 0.5);
  renderer.drawBattleSoldierSprite(240, 280, 'defender', 'hit', 2, 1, 0.21, 'assets/art/battle/units/enemy', 0.5);
  renderer.drawBattleArmy({ side: 'defender', soldiers: 0, soldiersStart: 12, groups: [] }, {
    x: 200,
    y: 260,
    width: 120,
    height: 120,
  }, { pose: 'die', frame: 0, progress: 0.5 });

  const dieCall = calls.find((call) => call[0] === 'drawImage' && call[1]?.src === 'assets/art/battle/units/player/die/03.png');
  const emptyGroupDieCall = calls.find((call) => call[0] === 'drawImage' && call[1]?.src === 'assets/art/battle/units/enemy/die/03.png');
  const hitCalls = calls.filter((call) => call[0] === 'drawImage' && call[1]?.src === 'assets/art/battle/units/enemy/idle/03.png');
  assert.ok(dieCall);
  assert.ok(emptyGroupDieCall);
  assert.equal(dieCall[2], 160 - (500 * 0.21) / 2);
  assert.equal(dieCall[3], 280 - 400 * 0.21);
  assert.ok(hitCalls.length >= 2);
  assert.equal(calls.some((call) => call[0] === 'drawImage' && String(call[1]?.src || '').includes('/hit/')), false);
});

test('CanvasGameRenderer derives and draws battle damage floats during impact', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const skillTurn = {
    actor: 'attacker',
    target: 'defender',
    action: 'skill',
    damageLabel: '谋略伤害',
    soldiersBefore: { attacker: 501, defender: 500 },
    soldiersAfter: { attacker: 501, defender: 457 },
  };
  const basicTurn = {
    actor: 'defender',
    target: 'attacker',
    action: 'basicAttack',
    damage: 12,
    attackerSoldiersBefore: 501,
    attackerSoldiersAfter: 489,
  };

  assert.equal(renderer.getBattleTurnDamage(skillTurn), 43);
  assert.equal(renderer.getBattleDamageFloatText(skillTurn), '谋略伤害 -43');
  assert.equal(renderer.getBattleDamageFloatText(basicTurn), '-12');

  renderer.drawBattleDamageFloat(skillTurn, 'prepare', 0.5, { x: 200, y: 260, width: 150, height: 180 });
  assert.equal(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('-43')), false);

  renderer.drawBattleDamageFloat(skillTurn, 'impact', 0.25, { x: 200, y: 260, width: 150, height: 180 });
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('谋略伤害 -43')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[2] > renderer.width / 2));
});

test('CanvasGameRenderer draws battle status floating texts from report events', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const turn = {
    actor: 'attacker',
    target: 'defender',
    floatingTexts: [
      { target: 'attacker', kind: 'shield', text: '守御 +84' },
      { target: 'defender', kind: 'damageOverTime', text: '灼烧 -18' },
      { target: 'defender', kind: 'status', text: '破甲' },
    ],
  };

  renderer.drawBattleStatusFloatingTexts(turn, 'move', 0.5, {
    attacker: { x: 18, y: 260, width: 150, height: 180 },
    defender: { x: 222, y: 260, width: 150, height: 180 },
  });
  assert.equal(calls.some((call) => call[0] === 'fillText' && /守御/.test(call[1])), false);

  renderer.drawBattleStatusFloatingTexts(turn, 'impact', 0.2, {
    attacker: { x: 18, y: 260, width: 150, height: 180 },
    defender: { x: 222, y: 260, width: 150, height: 180 },
  });
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '守御 +84'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '灼烧 -18'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '破甲'));
});

test('CanvasGameRenderer moves soldiers into engagement without attack dash offsets', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  CanvasGameRenderer.getBattleUnitFramePaths().forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 500, height: 400, naturalWidth: 500, naturalHeight: 400 },
    });
  });
  const area = { x: 18, y: 260, width: 150, height: 180 };
  const groups = Array.from({ length: 4 }, () => ({ ratio: 1, soldiers: 100, capacity: 100 }));
  const start = renderer.getBattleUnitBattlefieldPosition('attacker', area, 0, 4, 0.21, 0);
  const midFirst = renderer.getBattleUnitBattlefieldPosition('attacker', area, 0, 4, 0.21, 0.5);
  const engaged = renderer.getBattleUnitBattlefieldPosition('attacker', area, 0, 4, 0.21, 1);

  assert.ok(midFirst.x > start.x);
  assert.ok(engaged.x > midFirst.x);
  assert.ok(
    renderer.getBattleUnitEngagementRatio(0, 0.5) > renderer.getBattleUnitEngagementRatio(1, 0.5),
    'later units should lag behind early units during engagement',
  );

  renderer.drawBattleArmy({ side: 'attacker', soldiers: 400, soldiersStart: 400, groups }, area, {
    pose: 'idle',
    frame: 0,
    engagementProgress: 1,
  });
  renderer.drawBattleArmy({ side: 'attacker', soldiers: 400, soldiersStart: 400, groups }, area, {
    pose: 'attack',
    frame: 0,
    progress: 0.8,
    engagementProgress: 1,
  });

  const idleCall = calls.find((call) => call[0] === 'drawImage' && call[1]?.src === 'assets/art/battle/units/player/idle/01.png');
  const attackCall = calls.find((call) => call[0] === 'drawImage' && call[1]?.src === 'assets/art/battle/units/player/attack/04.png');
  assert.ok(idleCall);
  assert.ok(attackCall);
  assert.equal(attackCall[2], idleCall[2], 'attack should use the same engaged x position as idle');
});

test('CanvasGameRenderer battle unit poses include idle move attack and hit phases', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const turn = { actor: 'attacker', target: 'defender' };

  assert.equal(renderer.getBattleUnitPose('attacker', null), 'idle');
  assert.equal(renderer.getBattleUnitPose('attacker', turn, 'cutin'), 'idle');
  assert.equal(renderer.getBattleUnitPose('attacker', turn, 'prepare'), 'idle');
  assert.equal(renderer.getBattleUnitPose('attacker', turn, 'move'), 'move');
  assert.equal(renderer.getBattleUnitPose('attacker', turn, 'impact'), 'attack');
  assert.equal(renderer.getBattleUnitPose('attacker', turn, 'settle'), 'idle');
  assert.equal(renderer.getBattleUnitPose('defender', turn, 'move'), 'idle');
  assert.equal(renderer.getBattleUnitPose('defender', turn, 'impact'), 'hit');
  assert.equal(renderer.getBattleUnitPose('defender', {
    actor: 'attacker',
    target: 'defender',
    defenderSoldiersBefore: 12,
    defenderSoldiersAfter: 0,
  }, 'impact'), 'die');
});

test('CanvasGameRenderer battle playback phases normalize each action stage', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const turn = { actor: 'attacker', target: 'defender' };

  assert.deepEqual(renderer.getBattlePlaybackPhase(0.06, turn), { phase: 'prepare', phaseProgress: 0.5 });
  assert.equal(renderer.getBattlePlaybackPhase(0.20, turn).phase, 'move');
  assert.ok(renderer.getBattlePlaybackPhase(0.20, turn).phaseProgress > 0.23);
  assert.ok(renderer.getBattlePlaybackPhase(0.20, turn).phaseProgress < 0.24);
  assert.equal(renderer.getBattlePlaybackPhase(0.60, turn).phase, 'impact');
  assert.equal(renderer.getBattlePlaybackPhase(0.90, turn).phase, 'settle');
  assert.deepEqual(renderer.getBattlePlaybackPhase(0.30, null), { phase: 'ended', phaseProgress: 1 });
  assert.equal(renderer.getBattleEngagementProgress(0, 'prepare', 0.9, turn), 0);
  assert.equal(renderer.getBattleEngagementProgress(0, 'move', 0.5, turn), 0.5);
  assert.equal(renderer.getBattleEngagementProgress(0, 'impact', 0.1, turn), 1);
  assert.equal(renderer.getBattleEngagementProgress(1, 'prepare', 0, turn), 1);
});

test('CanvasGameRenderer keeps skill cut-in visible while normal attacks stay fast', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const turn = { actor: 'attacker', target: 'defender', action: 'skill', presentation: { cutIn: true } };
  const turnDurationMs = 3100;
  const cutInEnd = 0.70;

  assert.equal(renderer.getBattlePlaybackPhase(0.35, turn).phase, 'cutin');
  assert.equal(renderer.getBattlePlaybackPhase(0.72, turn).phase, 'prepare');
  assert.equal(renderer.getBattlePlaybackPhase(0.80, turn).phase, 'move');
  assert.equal(renderer.getBattlePlaybackPhase(0.90, turn).phase, 'impact');
  assert.ok(cutInEnd * turnDurationMs >= 2000);
});

test('CanvasGameRenderer skill cut-in flies portrait from left and skill text from right', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const turn = {
    actor: 'attacker',
    actorName: '陆骁',
    skillName: '血刃破阵',
    presentation: { cutIn: true },
  };

  renderer.drawBattleSkillCutIn(turn, 0.05);
  const earlySkillText = calls.find((call) => call[0] === 'fillText' && call[1] === '血刃破阵');
  const earlyPortraitPanel = calls.find((call) => call[0] === 'roundRect' && call[3] >= 104 && call[4] >= 104);
  calls.length = 0;
  renderer.drawBattleSkillCutIn(turn, 0.50);
  const holdSkillText = calls.find((call) => call[0] === 'fillText' && call[1] === '血刃破阵');
  const holdPortraitPanel = calls.find((call) => call[0] === 'roundRect' && call[3] >= 104 && call[4] >= 104);
  calls.length = 0;
  renderer.drawBattleSkillCutIn(turn, 0.95);
  const exitSkillText = calls.find((call) => call[0] === 'fillText' && call[1] === '血刃破阵');
  const exitPortraitPanel = calls.find((call) => call[0] === 'roundRect' && call[3] >= 104 && call[4] >= 104);

  assert.ok(earlyPortraitPanel[1] < holdPortraitPanel[1], 'portrait should enter from the left');
  assert.ok(earlySkillText[2] > holdSkillText[2], 'skill text should enter from the right');
  assert.ok(exitPortraitPanel[1] > holdPortraitPanel[1], 'portrait should fly out to the right after the hold');
  assert.ok(exitSkillText[2] < holdSkillText[2], 'skill text should fly out to the left after the hold');
});

test('CanvasGameRenderer renders guidebook entry and planning panel', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '260',
        foodRate: '+0/s',
        knowledgeValue: '80',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildTaskCenterViewState: UIStatePresenter.buildTaskCenterViewState.bind(UIStatePresenter),
    buildGuidebookViewState: UIStatePresenter.buildGuidebookViewState.bind(UIStatePresenter),
    buildPopulationViewState: UIStatePresenter.buildPopulationViewState.bind(UIStatePresenter),
    buildHomeFeatureViewState: UIStatePresenter.buildHomeFeatureViewState.bind(UIStatePresenter),
  });

  renderer.render({
    currentEraName: '城邦时代',
    currentTab: 'resources',
    population: {
      total: 3,
      max: 3,
      farmers: 3,
      scholars: 0,
      craftsmen: 0,
      unassigned: 0,
      capacity: { active: true, eraCap: 12, housingCap: 6 },
    },
    cityState: {
      activeCityId: 'capital',
      cities: [{
        id: 'capital',
        name: '首都',
        population: { total: 3 },
        totalBuildings: 2,
        populationGrowthMultiplier: 1.12,
        planning: {
          terrainLabel: '河谷',
          habitability: 12,
          habitabilityLabel: '良好',
          habitabilityNotes: ['居住与粮食配套较协调。'],
        },
      }],
    },
    guidebook: {
      categories: [
        { id: 'planning', label: '规划', title: '城市规划', lines: ['宜居度来自建筑搭配。'] },
        { id: 'policy', label: '方针', title: '人才方针', lines: ['方针会调整人才。'] },
      ],
    },
  }, {
    activeTab: 'resources',
    mode: 'hud',
    showGuidebook: true,
    activeGuidebookTab: 'planning',
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '攻略'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '城市规划'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('地理：河谷')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('宜居度良好 · 人口成长良好')));
  assert.equal(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('承载生效')), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('时代 1200 / 民居')), false);
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openGuidebook'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'switchGuidebookTab' && target.action.tab === 'policy'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeGuidebook'));
});

test('CanvasGameRenderer renders login panel and login hit targets on canvas', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });

  renderer.render({}, {
    mode: 'hud',
    auth: {
      view: { loginPanelVisible: true, appVisible: false, message: '请登录' },
      credentials: {
        usernameValue: 'test1',
        passwordValue: 'secret',
        rememberPasswordChecked: true,
      },
    },
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '文明火种'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === 'test1'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '登录'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'requestLoginUsername'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'requestLoginPassword'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'toggleRememberPassword'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'submitLogin'));
});

test('CanvasGameRenderer renders resource details panel from presenter view state', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '10',
        foodRate: '+1/s',
        foodDetailValue: '10',
        foodOutputRate: '+1.2/s',
        foodConsumptionRate: '-0.2/s',
        foodNetRate: '+1/s',
        knowledgeValue: '5',
        knowledgeRate: '+0.1/s',
        knowledgeDetailValue: '5',
        knowledgeDetailRate: '+0.1/s',
        woodValue: '2',
        woodRate: '+0.3/s',
        woodDetailValue: '2',
        woodDetailRate: '+0.3/s',
        ironValue: '0',
        ironRate: '+0/s',
        ironDetailValue: '0',
        ironDetailRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
        stoneDetailValue: '0',
        stoneDetailRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
  });

  renderer.render({ currentEraName: '聚落时代', currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    showResourceDetails: true,
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '资源详情'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '铁矿'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '石料'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '净增长 +1/s'));
  const closeTarget = renderer.hitTargets.find((target) => target.action?.type === 'closeResourceDetails' && target.width === 28);
  assert.ok(closeTarget);
  assert.deepEqual(renderer.getHitTarget({
    x: closeTarget.x + closeTarget.width / 2,
    y: closeTarget.y + closeTarget.height / 2,
  }), { type: 'closeResourceDetails' });
  assert.deepEqual(renderer.getHitTarget({ x: 40, y: 100 }), { type: 'closeResourceDetails' });
});

test('CanvasGameRenderer resource details panel keeps expanded resources visible before settlement era', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: false,
      text: {
        foodValue: '10',
        foodRate: '+1/s',
        foodDetailValue: '10',
        foodOutputRate: '+1/s',
        foodConsumptionRate: '-0/s',
        foodNetRate: '+1/s',
        knowledgeValue: '5',
        knowledgeRate: '+0.1/s',
        knowledgeDetailValue: '5',
        knowledgeDetailRate: '+0.1/s',
        woodValue: '0',
        woodRate: '+0/s',
        woodDetailValue: '0',
        woodDetailRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        ironDetailValue: '0',
        ironDetailRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
        stoneDetailValue: '0',
        stoneDetailRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
  });

  renderer.render({ currentEraName: '农耕时代', currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    showResourceDetails: true,
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '木材'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '铁矿'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '石料'));
});

test('CanvasGameRenderer renders advisor panel and actions on canvas', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 12 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: false,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({
      hidden: false,
      activeAdvisor: { message: 'Scout north now', target: 'tab-military' },
      text: { message: 'Scout north now' },
      goButton: { disabled: false },
    }),
  });

  renderer.render({ currentTab: 'resources', softGuide: { message: 'Scout north now', target: 'tab-military' } }, {
    activeTab: 'resources',
    mode: 'hud',
    showAdvisor: true,
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '顾问建议'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '前往处理'));
  const goTarget = renderer.hitTargets.find((target) => target.action?.type === 'goToAdvisorTarget');
  const closeTarget = renderer.hitTargets.find((target) => target.action?.type === 'closeAdvisor' && !target.action.background);
  assert.ok(goTarget);
  assert.ok(closeTarget);
  assert.deepEqual(renderer.getHitTarget({
    x: goTarget.x + goTarget.width / 2,
    y: goTarget.y + goTarget.height / 2,
  }), { type: 'goToAdvisorTarget', disabled: false });
});

test('CanvasGameRenderer HUD overlay draws buildings page and build actions on canvas', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0/s',
        woodValue: '18',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildTaskCenterViewState: () => ({ summary: { claimableCount: 0 } }),
    buildGuidebookViewState: () => ({ categories: [], activeCategory: null }),
    buildBuildingViewState: () => ({
      isEmpty: false,
      categoryTabs: [
        { id: 'all', label: '全部', count: 2, active: true },
        { id: 'agriculture', label: '农业', count: 1, active: false },
        { id: 'livelihood', label: '民生', count: 1, active: false },
        { id: 'military', label: '军事', count: 1, active: false },
      ],
      cards: [
        {
          id: 'farm',
          name: '农田',
          art: 'assets/art/building-farm-cutout.png',
          metaText: '等级：0　规模：未建造',
          currentEffectText: '当前效果：无',
          nextEffectText: '建成后效果：粮食产出效率 150%',
          maintenanceText: '维护所需：无',
          cityImpactText: '城市影响：宜居压力平稳',
          button: { action: 'build', label: '建造', disabled: false },
          cost: { text: '免费建造', parts: [], isMax: false },
        },
        {
          id: 'house',
          name: '民居',
          art: 'assets/art/building-house-cutout.png',
          metaText: '等级：1　规模：小',
          currentEffectText: '当前效果：可居住人口 300',
          nextEffectText: '下一级效果：可居住人口 600（提升 300）',
          maintenanceText: '维护所需：粮食 0.01/s，木材 0.002/s',
          cityImpactText: '城市影响：宜居压力平稳',
          button: { action: 'upgrade', label: '升级', disabled: false },
          cost: { text: '', parts: [{ resource: 'food', text: '80' }], isMax: false },
        },
      ],
    }),
  });

  renderer.render({ currentEraName: '农耕时代', currentTab: 'buildings' }, {
    activeTab: 'buildings',
    mode: 'hud',
    tutorial: { completed: true },
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '建筑'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '全部'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农业'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '民生'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '军事'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农田'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '民居'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '当前效果：可居住人口 300'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '下一级效果：可居住人口 600（提升 300）'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '维护所需：粮食 0.01/s，木材 0.002/s'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'selectBuildingCategory' && target.action.category === 'agriculture'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'farm'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'upgradeBuilding' && target.action.buildingId === 'house'));
  const categoryTargets = renderer.hitTargets.filter((target) => target.action?.type === 'selectBuildingCategory');
  assert.ok(categoryTargets.length > 0);
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'openTaskCenter'), false);
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'openGuidebook'), false);
  const militaryTarget = categoryTargets.find((target) => target.action?.category === 'military');
  assert.ok(militaryTarget);
  assert.ok(militaryTarget.width < 72);
});

test('CanvasGameRenderer passes active building category into building view state', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  let receivedCategory = '';
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0/s',
        woodValue: '18',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildTaskCenterViewState: () => ({ summary: { claimableCount: 0 } }),
    buildGuidebookViewState: () => ({ categories: [], activeCategory: null }),
    buildBuildingViewState: (state, tutorial, defs, options) => {
      receivedCategory = options.activeCategory;
      return {
        isEmpty: false,
        categoryTabs: [
          { id: 'all', label: '全部', count: 2, active: false },
          { id: 'military', label: '军事', count: 1, active: true },
        ],
        cards: [{
          id: 'barracks',
          name: '兵营',
          metaText: '等级：0　规模：未建造',
          currentEffectText: '当前效果：无',
          nextEffectText: '建成后效果：士兵容量 300',
          maintenanceText: '维护所需：无',
          cityImpactText: '城市影响：宜居压力较高',
          button: { action: 'build', label: '建造', disabled: false },
          cost: { text: '免费建造', parts: [], isMax: false },
        }],
      };
    },
  });

  renderer.render({ currentTab: 'buildings' }, {
    activeTab: 'buildings',
    mode: 'hud',
    activeBuildingCategory: 'military',
  });

  assert.equal(receivedCategory, 'military');
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'barracks'));
});

test('CanvasGameRenderer renders building costs as fixed base slots with knowledge on the action button', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 360, height: 640, pixelRatio: 1 });
  const assets = [];
  renderer.drawAsset = (...args) => {
    assets.push(args);
    return true;
  };
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0/s',
        woodValue: '18',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildTaskCenterViewState: () => ({ summary: { claimableCount: 0 } }),
    buildGuidebookViewState: () => ({ categories: [], activeCategory: null }),
    buildBuildingViewState: () => ({
      isEmpty: false,
      cards: [{
        id: 'barracks',
        name: '兵营',
        art: 'assets/art/building-barracks-cutout.png',
        metaText: '等级：1　规模：小',
        currentEffectText: '当前效果：士兵容量 300，训练速度 30秒/10兵',
        nextEffectText: '下一级效果：士兵容量 600（提升 300），训练速度 25秒/20兵（加快 5秒）',
        maintenanceText: '维护所需：粮食 0.01/s，木材 0.002/s',
        cityImpactText: '城市影响：宜居压力较高',
        button: { action: 'upgrade', label: '升级', disabled: true },
        cost: {
          text: '',
          parts: [
            { resource: 'food', value: 500, text: '500' },
            { resource: 'wood', value: 200, text: '200' },
            { resource: 'knowledge', value: 100, text: '100' },
          ],
          isMax: false,
        },
      }],
    }),
  });

  renderer.render({
    currentEraName: '城邦时代',
    currentTab: 'buildings',
    resources: { food: 260, wood: 40, iron: 0, stone: 0, knowledge: 100 },
  }, {
    activeTab: 'buildings',
    mode: 'hud',
    tutorial: { completed: true },
  });

  assert.equal(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('食物 500')), false);
  const chipPanels = calls.filter((call) => call[0] === 'roundRect' && call[4] === 18);
  assert.equal(chipPanels.length, 4);
  assert.ok(chipPanels.every((call) => call[1] >= 220 && call[1] + call[3] <= 348));
  const costSlotAssets = assets
    .filter((call) => call[3] === 12 && call[4] === 12)
    .map((call) => call[0]);
  assert.deepEqual(costSlotAssets, [
    'assets/art/icon-wood-cutout.webp',
    'assets/art/icon-iron-cutout.webp',
    'assets/art/icon-stone-cutout.webp',
    'assets/art/icon-food-cutout.webp',
  ]);
  assert.equal(costSlotAssets.includes('assets/art/icon-knowledge-cutout.webp'), false);
  assert.ok(assets.some((call) => call[0] === 'assets/art/icon-knowledge-cutout.webp' && call[3] === 13 && call[4] === 13));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '100'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '维护所需：粮食 0.01/s，木材 0.002/s'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '城市影响：宜居压力较高'));
  const upgradeTarget = renderer.hitTargets.find((target) => target.action?.type === 'upgradeBuilding' && target.action.buildingId === 'barracks');
  assert.ok(upgradeTarget);
  assert.ok(upgradeTarget.x >= 220);
  assert.ok(upgradeTarget.x + upgradeTarget.width <= 348);
});

test('CanvasGameRenderer paginates overflow building cards without DOM scrolling', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const cards = ['farm', 'house', 'lumbermill', 'barracks', 'watchtower', 'temple'].map((id, index) => ({
    id,
    name: id,
    art: '',
    icon: `${index}`,
    metaText: '等级：0　规模：未建造',
    currentEffectText: '当前效果：无',
    nextEffectText: '建成后效果：无',
    maintenanceText: '维护所需：无',
    cityImpactText: '城市影响：宜居压力平稳',
    button: { action: 'build', label: '建造', disabled: false },
    cost: { text: '免费建造', parts: [], isMax: false },
  }));
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0/s',
        woodValue: '18',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildBuildingViewState: () => ({ isEmpty: false, cards }),
  });

  renderer.render({ currentTab: 'buildings' }, {
    activeTab: 'buildings',
    mode: 'hud',
    buildingOffset: 2,
  });

  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'scrollBuildings' && target.action.delta === -1));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'scrollBuildings' && target.action.delta === 1));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '3/3'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '3-5/6'), false);
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'watchtower'));
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'farm'), false);
});

test('CanvasGameRenderer slides building pager cards and suppresses old page hit targets', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const cards = ['farm', 'house', 'lumbermill', 'barracks', 'watchtower', 'temple'].map((id, index) => ({
    id,
    name: id,
    art: '',
    icon: `${index}`,
    metaText: '等级：0　规模：未建造',
    currentEffectText: '当前效果：无',
    nextEffectText: '建成后效果：无',
    maintenanceText: '维护所需：无',
    cityImpactText: '城市影响：宜居压力平稳',
    button: { action: 'build', label: '建造', disabled: false },
    cost: { text: '免费建造', parts: [], isMax: false },
  }));
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0/s',
        woodValue: '18',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildBuildingViewState: () => ({ isEmpty: false, cards }),
  });

  renderer.render({ currentTab: 'buildings' }, {
    activeTab: 'buildings',
    mode: 'hud',
    buildingOffset: 2,
    buildingTransition: {
      fromOffset: 1,
      toOffset: 2,
      direction: 1,
      startedAt: Date.now() - 80,
      durationMs: 220,
    },
  });

  assert.ok(calls.some((call) => call[0] === 'translate' && Math.abs(Number(call[1]) || 0) > 0));
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'house'), false);
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'watchtower'));
});

test('CanvasGameRenderer slides HUD tab content while keeping old page non-interactive', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0/s',
        woodValue: '18',
        woodRate: '+0/s',
        ironValue: '0',
        ironRate: '+0/s',
        stoneValue: '0',
        stoneRate: '+0/s',
      },
    }),
    buildPopulationViewState: () => ({
      text: { total: 3, max: 5, unassigned: 1 },
      jobs: [
        { id: 'farmer', visible: true, count: 1, canIncrease: true, canDecrease: true },
        { id: 'scholar', visible: true, count: 1, canIncrease: true, canDecrease: true },
        { id: 'craftsman', visible: true, count: 1, canIncrease: true, canDecrease: true },
      ],
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildBuildingViewState: () => ({
      isEmpty: false,
      cards: [{
        id: 'farm',
        name: '农田',
        art: '',
        icon: 'F',
        levelText: '等级 0',
        descText: '产出粮食',
        button: { action: 'build', label: '建造', disabled: false },
        cost: { text: '免费建造', parts: [], isMax: false },
      }],
    }),
    buildTaskCenterViewState: () => ({ summary: { claimableCount: 0 } }),
  });
  const startedAt = Date.now() - 80;

  renderer.render({ currentTab: 'buildings' }, {
    activeTab: 'buildings',
    mode: 'hud',
    pageTransition: {
      fromTab: 'resources',
      toTab: 'buildings',
      direction: 1,
      startedAt,
      durationMs: 220,
    },
  });

  assert.ok(calls.some((call) => call[0] === 'translate' && Math.abs(Number(call[1]) || 0) > 0));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'farm'));
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'assignJob'), false);
});

test('CanvasGameRenderer draws events page and event modal without DOM renderer', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const assets = [];
  renderer.drawAsset = (...args) => {
    assets.push(args);
    return true;
  };
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0/s',
        woodValue: '18',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({
      badge: { hidden: false, text: '1' },
      pending: {
        isEmpty: false,
        cards: [{
          id: 'evt_forest',
          icon: '🌲',
          title: '森林低语',
          description: '林间传来回声。',
          hint: '点击查看详情',
          classState: { 'is-special': true },
        }],
      },
      history: {
        isEmpty: false,
        items: [{ iconAsset: 'assets/art/icon-event-cutout.webp', title: '丰收', result: '食物 +40', className: 'positive' }],
      },
    }),
    buildEventModalViewState: () => ({
      showModal: true,
      iconAsset: 'assets/art/icon-event-cutout.webp',
      text: {
        title: '森林低语以及一段足够长的标题',
        description: '林间传来很长很长的回声，需要在有限的弹窗区域里换行显示，不能盖住下面的选项。',
        reward: '选择一种处理方式',
      },
      metaRows: [
        { label: '时限', text: '剩余 4:00，超时将自动失效', tone: 'time' },
        { label: '选项', text: '选择一种处理方式', tone: 'neutral' },
      ],
      options: [
        {
          id: 'collect_wood',
          label: '收集木材',
          preview: '木材 +20',
          rows: [
            { label: '需求', text: '无', tone: 'requirement', parts: [], empty: true },
            { label: '奖励', text: '木材 +20', tone: 'reward', parts: [{ type: 'resource', resource: 'wood', text: '+20' }] },
            { label: '消耗', text: '无', tone: 'cost', parts: [], empty: true },
            { label: '惩罚', text: '无', tone: 'penalty', parts: [], empty: true },
          ],
        },
        {
          id: 'study_trail',
          label: '研究路径',
          preview: '知识 +10',
          rows: [
            { label: '需求', text: '知识 8', tone: 'requirement', parts: [{ type: 'resource', resource: 'knowledge', text: '8' }] },
            { label: '奖励', text: '知识 +10', tone: 'reward', parts: [{ type: 'resource', resource: 'knowledge', text: '+10' }] },
            { label: '消耗', text: '无', tone: 'cost', parts: [], empty: true },
            { label: '惩罚', text: '食物 -20', tone: 'penalty', parts: [{ type: 'resource', resource: 'food', text: '-20' }] },
          ],
        },
      ],
      claimButton: { optionId: '', label: '处理事件', hidden: true },
    }),
  });

  renderer.render({ currentTab: 'events', eventQueue: [{ id: 'evt_forest' }] }, {
    activeTab: 'events',
    mode: 'hud',
    activeEventId: 'evt_forest',
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('待处理事件')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('最近事件')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('森林低语')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '收集木材'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('需求:')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('奖励:')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('消耗:')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('惩罚:')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('时限:')));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '处理'), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '查看'), false);
  assert.ok(assets.some((asset) => asset[0] === 'assets/art/icon-wood-cutout.webp'));
  assert.ok(assets.some((asset) => asset[0] === 'assets/art/icon-knowledge-cutout.webp'));
  assert.ok(assets.some((asset) => asset[0] === 'assets/art/icon-food-cutout.webp'));
  assert.ok(assets.some((asset) => asset[0] === 'assets/art/icon-event-cutout.webp'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openEvent' && target.action.eventId === 'evt_forest'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'claimEvent' && target.action.optionId === 'collect_wood'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'claimEvent' && target.action.optionId === 'study_trail'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeEvent'));
});

test('CanvasGameRenderer constructor does not double-scale DPR because runtime owns setTransform', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 3 });

  assert.equal(renderer.pixelRatio, 3);
  assert.deepEqual(ctx.transforms.at(-1), [1, 1]);
});

test('CanvasGameRenderer HUD overlay mode draws resource population controls on Canvas', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: false,
      text: {
        foodValue: '10',
        foodRate: '+0/s',
        knowledgeValue: '1',
        knowledgeRate: '+0/s',
        woodValue: '0',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildPopulationViewState: () => ({
      text: { total: '4', max: '6', unassigned: '1' },
      jobs: [
        { id: 'farmer', visible: true, count: 2, canIncrease: true, canDecrease: true },
        { id: 'scholar', visible: true, count: 1, canIncrease: true, canDecrease: true },
        { id: 'craftsman', visible: true, count: 1, canIncrease: true, canDecrease: true },
      ],
    }),
  });

  renderer.render({ currentEraName: '原始时代', currentTab: 'resources' }, { activeTab: 'resources', mode: 'hud' });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '粮食'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '主页'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'assignJob' && target.action.job === 'farmer'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'assignJob' && target.action.job === 'craftsman'));
});

test('CanvasGameRenderer clear() does not draw full background for HUD overlay mode', () => {
  const { ctx, calls } = makeCtx();
  var renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.clear();

  assert.ok(calls.some((c) => Array.isArray(c) && c[0] === 'clearRect'), `clearRect should be called, got: ${JSON.stringify(calls)}`);
  var fullHeightFills = calls.filter((c) => Array.isArray(c) && c[0] === 'fillRect' && c[4] === 844);
  assert.equal(fullHeightFills.length, 0, 'should not fill full viewport height');
});

test('CanvasGameRenderer can draw read-only HUD and tabs from presenter view state', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0.2/s',
        woodValue: '8',
        woodRate: '+0.1/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildPopulationViewState: () => ({
      text: { total: '3', max: '3', unassigned: '0' },
      jobs: [
        { id: 'farmer', visible: true, count: 3, canIncrease: false, canDecrease: false },
        { id: 'scholar', visible: true, count: 0, canIncrease: false, canDecrease: false },
      ],
    }),
    buildTechViewState: () => ({
      text: {
        knowledgeRate: '0.2/s',
        title: '科技树',
        placeholder: '首期暂不重构科技系统',
        subtitle: '当前阶段先保留科技入口与知识产出展示',
      },
    }),
  });

  renderer.render({ currentEraName: '原始时代', currentTab: 'resources', happiness: 100 }, { activeTab: 'resources' });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '原始时代'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '粮食'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '知识'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '木材'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '铁矿'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '石料'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '主页'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '建造'));
  assert.ok(renderer.getHitTarget({ x: 30, y: 800 })?.type === 'switchTab');
});

test('CanvasGameRenderer draws tech placeholder page without DOM text writes', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0.2/s',
        woodValue: '8',
        woodRate: '+0.1/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildTechViewState: () => ({
      points: 1,
      researchedCount: 0,
      availableCount: 1,
      tree: {
        eras: [
          { era: 1, name: '农耕分支', choiceText: '0/1', closed: false, column: 1 },
          { era: 2, name: '聚落分支', choiceText: '0/1', closed: false, column: 2 },
        ],
        nodes: [
          {
            id: 'farming_field_rotation',
            title: '田块轮作',
            routeLabel: '农业',
            core: '核心入口：粮食稳定',
            summary: '稳定粮食',
            unlockSummary: '解锁建筑：农田 / 研究后：农田提供稳定粮食生产。',
            effectRows: [
              { label: '解锁建筑', text: '农田' },
              { label: '研究后', text: '农田提供稳定粮食生产。' },
            ],
            buttonLabel: '研究',
            status: 'available',
            available: true,
            disabled: false,
            tree: { column: 1, lane: -1, parents: [] },
          },
          {
            id: 'settlement_logging_rights',
            title: '伐木权责',
            routeLabel: '生产',
            core: '核心入口：木材生产',
            summary: '稳定木材',
            unlockSummary: '解锁建筑：伐木场 / 研究后：伐木场提供稳定木材生产。',
            buttonLabel: '未解锁',
            status: 'locked',
            available: false,
            disabled: true,
            tree: { column: 2, lane: 1, parents: ['farming_field_rotation'] },
          },
        ],
        links: [{ from: 'farming_field_rotation', to: 'settlement_logging_rights', researched: false, active: false, locked: true }],
        laneMin: -1,
        laneMax: 1,
      },
      selectedTechId: 'farming_field_rotation',
      detail: {
        id: 'farming_field_rotation',
        title: '田块轮作',
        eraName: '农耕分支',
        routeLabel: '农业',
        statusLabel: '可研究',
        summary: '稳定粮食',
        unlockSummary: '解锁建筑：农田 / 研究后：农田提供稳定粮食生产。',
        effectRows: [
          { label: '解锁建筑', text: '农田' },
          { label: '研究后', text: '农田提供稳定粮食生产。' },
        ],
        prerequisiteText: '无',
        pointsText: '科技点 1',
        buttonLabel: '研究',
        canResearch: true,
      },
      eras: [{
        era: 1,
        name: '农耕分支',
        summary: '选择早期路线',
        choiceText: '0/1',
        closed: false,
        techs: [{
          id: 'farming_field_rotation',
          title: '田块轮作',
          routeLabel: '农业',
          core: '核心入口：粮食稳定',
          summary: '稳定粮食',
          unlockSummary: '解锁建筑：农田 / 研究后：农田提供稳定粮食生产。',
          buttonLabel: '研究',
          disabled: false,
        }],
      }],
      text: {
        knowledgeRate: '0.2/s',
        title: '科技树',
        points: '科技点 1',
        researched: '已研究 0',
        available: '可研究 1',
        placeholder: '进入新时代后获得科技点',
        subtitle: '前期科技用于选择文明路线，古典时代开始解锁关键建筑。',
      },
    }),
  });

  renderer.render({ currentEraName: '聚落时代', resources: { knowledgePerSecond: 0.2 } }, {
    activeTab: 'tech',
    mode: 'hud',
  });

  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '当前知识产出'), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '0.2/s'), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '解锁建筑：'), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '研究后：'), false);
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '前置科技：无'), false);
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('科技树')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '田块轮作'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农耕分支'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '伐木权责'));
  const lineCalls = calls.filter((call) => call[0] === 'lineTo');
  assert.ok(lineCalls.length >= 4);
  assert.ok(lineCalls.some((call) => Math.abs(call[1] - 195) < 1));
  assert.equal(lineCalls.some((call) => call[1] === 195 && Math.abs(call[2] - 603.55) < 1), false);
  const curveCalls = calls.filter((call) => call[0] === 'bezierCurveTo');
  assert.ok(curveCalls.length >= 1);
  const techTarget = renderer.hitTargets.find((target) => target.action.type === 'selectTechNode' && target.action.techId === 'farming_field_rotation');
  assert.ok(techTarget);
  assert.deepEqual(
    renderer.getHitTarget({ x: techTarget.x + 2, y: techTarget.y + 2 }),
    { type: 'selectTechNode', techId: 'farming_field_rotation', dragType: 'techTreeDrag' },
  );
  assert.equal(renderer.hitTargets.some((target) => target.action.type === 'research'), false);
  assert.ok(renderer.hitTargets.some((target) => target.action.type === 'techTreeDrag'));

  calls.length = 0;
  renderer.render({ currentEraName: '聚落时代', resources: { knowledgePerSecond: 0.2 } }, {
    activeTab: 'tech',
    mode: 'hud',
    selectedTechId: 'farming_field_rotation',
    techDetailOpen: true,
  });
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '解锁建筑：'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农田'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '研究后：'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农田提供稳定粮食生产。'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '前置科技：无'));
  const researchTarget = renderer.hitTargets.find((target) => target.action.type === 'research');
  assert.ok(researchTarget);
  assert.deepEqual(
    renderer.getHitTarget({ x: researchTarget.x + 2, y: researchTarget.y + 2 }),
    { type: 'research', techId: 'farming_field_rotation', disabled: false },
  );
  assert.ok(renderer.hitTargets.some((target) => target.action.type === 'closeTechDetail'));
});

test('CanvasGameRenderer renders dense tech tree as a draggable vertical scroll', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const classicalNodes = Array.from({ length: 8 }, (_, index) => ({
    id: `classical_dense_${index}`,
    title: `古典科技${index + 1}`,
    routeLabel: index % 2 ? '文化' : '生产',
    core: '路线节点',
    buttonLabel: '研究',
    status: 'available',
    available: true,
    disabled: false,
    tree: { column: 5, row: 5 + index * 0.35, lane: index - 4, routes: [index % 2 ? 'culture' : 'industry'], parents: [] },
  }));
  renderer.setPresenter({
    buildResourceViewState: () => ({ hasWood: true, text: { foodValue: '0', foodRate: '+0/s', knowledgeValue: '0', knowledgeRate: '+0/s', woodValue: '0', woodRate: '+0/s' } }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildTechViewState: () => ({
      tree: {
        eras: [
          { era: 4, name: '边境分支', choiceText: '1/1', closed: true, column: 4 },
          { era: 5, name: '古典分支', choiceText: '0/3', closed: false, column: 5 },
        ],
        nodes: [
          { id: 'frontier_done', title: '土炉试炼', routeLabel: '生产', core: '已定路线', buttonLabel: '已研究', status: 'researched', researched: true, disabled: true, tree: { column: 4, row: 4, lane: 0, routes: ['industry'], parents: [] } },
          ...classicalNodes,
        ],
        links: [],
        laneMin: -4,
        laneMax: 3,
      },
      text: {
        knowledgeRate: '0/s',
        title: '科技树',
        points: '科技点 3',
        researched: '已研究 1',
        available: '可研究 8',
        placeholder: '进入新时代后获得科技点',
        subtitle: '前期科技用于选择文明路线，古典时代开始解锁关键建筑。',
      },
    }),
  });

  renderer.render({ currentEraName: '古典时代', resources: { knowledgePerSecond: 0 } }, {
    activeTab: 'tech',
    mode: 'hud',
    techTreePanY: -300,
  });

  const initialTarget = renderer.hitTargets.find((target) => target.action.techId === 'classical_dense_4');
  assert.ok(initialTarget);

  renderer.render({ currentEraName: '古典时代', resources: { knowledgePerSecond: 0 } }, {
    activeTab: 'tech',
    mode: 'hud',
    techTreePanY: -520,
  });

  const visibleClassicalTargets = renderer.hitTargets
    .filter((target) => target.action.techId?.startsWith('classical_dense_'));
  assert.ok(visibleClassicalTargets.length >= 1);
  const scrolledTarget = renderer.hitTargets.find((target) => target.action.techId === 'classical_dense_4');
  assert.ok(scrolledTarget);
  assert.ok(scrolledTarget.y < initialTarget.y);
  visibleClassicalTargets.forEach((target, index) => {
    visibleClassicalTargets.slice(index + 1).forEach((other) => {
      assert.equal(rectsOverlap(target, other), false);
    });
  });
  assert.ok(renderer.hitTargets.some((target) => target.action.type === 'techTreeDrag'));
});

test('CanvasGameRenderer pans tech tree horizontally and keeps card drag handles', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({ hasWood: true, text: { foodValue: '0', foodRate: '+0/s', knowledgeValue: '0', knowledgeRate: '+0/s', woodValue: '0', woodRate: '+0/s' } }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildTechViewState: () => ({
      tree: {
        eras: [{ era: 1, name: '农耕分支', choiceText: '0/1', closed: false, column: 1 }],
        nodes: [
          { id: 'left_branch', title: '左侧科技', routeLabel: '农业', core: '路线节点', buttonLabel: '研究', status: 'available', available: true, disabled: false, tree: { column: 1, lane: -1, parents: [] } },
          { id: 'right_branch', title: '右侧科技', routeLabel: '工业', core: '路线节点', buttonLabel: '研究', status: 'locked', available: false, disabled: true, tree: { column: 1, lane: 1, parents: [] } },
        ],
        links: [],
      },
      text: {
        knowledgeRate: '0/s',
        title: '科技树',
        points: '科技点 1',
        researched: '已研究 0',
        available: '可研究 1',
        placeholder: '进入新时代后获得科技点',
        subtitle: '拖动画布查看分叉科技。',
      },
    }),
  });

  renderer.render({ currentEraName: '农耕时代', resources: { knowledgePerSecond: 0 } }, {
    activeTab: 'tech',
    mode: 'hud',
    techTreePanX: 0,
  });
  const initialTarget = renderer.hitTargets.find((target) => target.action.techId === 'right_branch');
  assert.ok(initialTarget);
  assert.equal(initialTarget.action.dragType, 'techTreeDrag');

  renderer.render({ currentEraName: '农耕时代', resources: { knowledgePerSecond: 0 } }, {
    activeTab: 'tech',
    mode: 'hud',
    techTreePanX: -100,
  });
  const pannedTarget = renderer.hitTargets.find((target) => target.action.techId === 'right_branch');
  assert.ok(pannedTarget);
  assert.ok(pannedTarget.x < initialTarget.x);
});

test('CanvasGameRenderer scales tech tree content and hit targets with zoom', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({ hasWood: true, text: { foodValue: '0', foodRate: '+0/s', knowledgeValue: '0', knowledgeRate: '+0/s', woodValue: '0', woodRate: '+0/s' } }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildTechViewState: () => ({
      tree: {
        eras: [{ era: 1, name: 'Era', choiceText: '0/1', closed: false, column: 1 }],
        nodes: [
          { id: 'zoom_node', title: 'Zoom Node', routeLabel: '农业', status: 'available', available: true, disabled: false, tree: { column: 1, lane: -1, parents: [] } },
        ],
        links: [],
      },
      text: {
        title: '科技树',
        points: '科技点 1',
        researched: '已研究 0',
        available: '可研究 1',
        placeholder: '',
        subtitle: '',
      },
    }),
  });

  renderer.render({ currentTab: 'tech' }, {
    activeTab: 'tech',
    mode: 'hud',
    techTreeZoom: 1,
  });
  const normalTarget = renderer.hitTargets.find((target) => target.action.techId === 'zoom_node');
  assert.ok(normalTarget);

  renderer.render({ currentTab: 'tech' }, {
    activeTab: 'tech',
    mode: 'hud',
    techTreeZoom: 1.4,
  });
  const zoomedTarget = renderer.hitTargets.find((target) => target.action.techId === 'zoom_node');
  assert.ok(zoomedTarget);
  assert.ok(zoomedTarget.width > normalTarget.width);
  assert.ok(zoomedTarget.height > normalTarget.height);
  assert.equal(renderer.lastTechTreeScroll.zoom, 1.4);
  assert.equal(ctx.transforms.some((args) => Math.abs(args[0] - 1.4) < 0.001 && Math.abs(args[1] - 1.4) < 0.001), true);
});

test('CanvasGameRenderer keeps shared tech nodes in their primary route lane', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const view = {
    tree: {
      eras: [{ era: 2, name: 'Shared Era', choiceText: '0/1', closed: false, column: 2 }],
      nodes: [
        { id: 'left', title: 'Left', route: 'agriculture', tree: { column: 2, row: 1, lane: -4, routes: ['agriculture'], parents: [] } },
        { id: 'pivot', title: 'Pivot', route: 'agriculture', tree: { column: 2, row: 2, lane: 0.5, routes: ['agriculture', 'military'], parents: ['left', 'right'] } },
        { id: 'right', title: 'Right', route: 'military', tree: { column: 2, row: 1, lane: 5, routes: ['military'], parents: [] } },
      ],
      links: [],
    },
  };
  const layout = renderer.getTechTreeLayout(view, { x: 36, y: 316, width: 318, height: 418 });
  const pivotRect = layout.nodeRects.pivot;
  const leftRect = layout.nodeRects.left;
  const rightRect = layout.nodeRects.right;

  assert.ok(pivotRect);
  assert.deepEqual(pivotRect.routes, ['agriculture', 'military']);
  const agricultureGuide = layout.routeGuides.find((route) => route.id === 'agriculture');
  const militaryGuide = layout.routeGuides.find((route) => route.id === 'military');
  assert.ok(agricultureGuide);
  assert.ok(militaryGuide);
  assert.equal(Math.round(pivotRect.centerX), Math.round(agricultureGuide.x));
  assert.notEqual(Math.round(pivotRect.centerX), Math.round(militaryGuide.x));
  assert.equal(layout.linkPaths.length, 2);
  layout.linkPaths.forEach((link) => {
    assert.ok(link.curve);
    assert.notEqual(link.curve.c1.x, link.curve.start.x);
    assert.notEqual(link.curve.c2.x, link.curve.end.x);
  });
  assert.ok(rightRect.x > pivotRect.x + pivotRect.width);
});

test('CanvasGameRenderer keeps tech era rail visible and gives eras roomy height', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const view = {
    tree: {
      eras: [
        { era: 1, name: 'Era 1', choiceText: '0/1', closed: false, column: 1 },
        { era: 2, name: 'Era 2', choiceText: '0/1', closed: false, column: 2 },
      ],
      nodes: [
        { id: 'a', title: 'A', tree: { column: 1, row: 1, lane: -4, routes: ['agriculture'], parents: [] } },
        { id: 'b', title: 'B', tree: { column: 1, row: 1, lane: -4, routes: ['agriculture'], parents: [] } },
        { id: 'c', title: 'C', tree: { column: 1, row: 1, lane: -3.8, routes: ['agriculture'], parents: [] } },
        { id: 'd', title: 'D', tree: { column: 2, row: 2, lane: 5, routes: ['military'], parents: ['a'] } },
      ],
      links: [],
    },
  };
  const panel = { x: 36, y: 316, width: 318, height: 418 };
  const layout = renderer.getTechTreeLayout(view, panel, { techTreePanX: -900 });
  const firstEra = layout.eraPositions[0];
  const railScreenX = layout.eraRailX;
  const rects = ['a', 'b', 'c'].map((id) => layout.nodeRects[id]);

  assert.ok(firstEra.bottom - firstEra.top >= 280);
  rects.forEach((rect, index) => {
    rects.slice(index + 1).forEach((other) => {
      assert.equal(rectsOverlap(rect, other), false);
    });
  });
  assert.ok(railScreenX > panel.x + panel.width - 80);
  assert.equal(railScreenX + layout.panX < panel.x, true);
});

test('CanvasGameRenderer draws civilization page and advance action without DOM adapter', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0.2/s',
        woodValue: '8',
        woodRate: '+0.1/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildCivilizationViewState: () => ({
      text: {
        eraName: '农耕时代',
        civOverviewDay: '第 3 天',
        civOverviewPop: 400,
        civOverviewBuildings: 2,
        civOverviewTechs: '1/0',
        civOverviewHappiness: '100%',
        eraTargetName: '聚落时代',
        eraProgressText: '总进度: 100%',
        advanceLabel: '满足条件，可进阶',
        featureDescription: '农耕时代：继续建设你的文明。',
      },
      progress: { percentage: 100 },
      advanceButton: { disabled: false },
      conditions: [{ met: true, name: '食物', progressText: '120/120' }],
    }),
  });

  renderer.render({ currentTab: 'civilization' }, {
    activeTab: 'civilization',
    mode: 'hud',
    tutorial: { completed: true },
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农耕时代'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '人口'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '400'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '满足条件，可进阶'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'advanceEra'));
});

test('CanvasGameRenderer aligns civilization overview stat cards to their frame', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '100',
        foodRate: '+1/s',
        knowledgeValue: '20',
        knowledgeRate: '+0.2/s',
        woodValue: '8',
        woodRate: '+0.1/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildCivilizationViewState: () => ({
      text: {
        eraName: '农耕时代',
        civOverviewDay: '第 3 天',
        civOverviewPop: 400,
        civOverviewBuildings: 2,
        civOverviewTechs: '1/0',
        civOverviewHappiness: '100%',
        eraTargetName: '聚落时代',
        eraProgressText: '总进度: 100%',
        advanceLabel: '满足条件，可以进阶',
        featureDescription: '农耕时代：继续建设你的文明。',
      },
      progress: { percentage: 100 },
      advanceButton: { disabled: false },
      conditions: [],
    }),
  });

  renderer.render({ currentTab: 'civilization' }, {
    activeTab: 'civilization',
    mode: 'hud',
    tutorial: { completed: true },
  });

  const statPanels = calls.filter((call) => (
    call[0] === 'roundRect'
    && [36, 199].includes(call[1])
    && [226, 269].includes(call[2])
    && call[3] === 155
    && call[4] === 35
  ));
  assert.equal(statPanels.length, 4);

  const leftX = statPanels[0][1];
  const rightX = statPanels[1][1];
  const topY = statPanels[0][2];
  const bottomY = statPanels[2][2];
  const cardWidth = statPanels[0][3];
  const cardHeight = statPanels[0][4];
  assert.equal(statPanels[2][1], leftX);
  assert.equal(statPanels[3][1], rightX);
  assert.equal(statPanels[1][2], topY);
  assert.equal(statPanels[3][2], bottomY);
  assert.equal(rightX + cardWidth, 354);
  assert.equal(bottomY + cardHeight, 304);
});

test('CanvasGameRenderer keeps civilization advance layout within compact mobile viewport', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 360, height: 640, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '120',
        foodRate: '+1/s',
        knowledgeValue: '80',
        knowledgeRate: '+0.2/s',
        woodValue: '30',
        woodRate: '+0.1/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildCivilizationViewState: () => ({
      text: {
        eraName: '农耕时代',
        civOverviewDay: '第 3 天',
        civOverviewPop: 400,
        civOverviewBuildings: 2,
        civOverviewTechs: '1/0',
        civOverviewHappiness: '100%',
        eraTargetName: '聚落时代',
        eraProgressText: '总进度: 100%',
        advanceLabel: '满足条件，可以进阶',
        featureDescription: '农耕时代：继续建设你的文明。',
      },
      progress: { percentage: 100 },
      advanceButton: { disabled: false },
      conditions: [
        { met: true, name: '食物', progressText: '120/120' },
        { met: true, name: '知识', progressText: '80/80' },
        { met: true, name: '人口', progressText: '4/4' },
        { met: true, name: '建筑', progressText: '2/2' },
      ],
    }),
  });

  renderer.render({ currentTab: 'civilization' }, {
    activeTab: 'civilization',
    mode: 'hud',
    tutorial: { completed: true },
  });

  const advanceTarget = renderer.hitTargets.find((target) => target.action?.type === 'advanceEra');
  assert.ok(advanceTarget);
  assert.ok(advanceTarget.y + advanceTarget.height <= 568);

  const conditionPanels = calls.filter((call) => (
    call[0] === 'roundRect'
    && call[2] > 120
    && call[4] === 22
    && call[3] < advanceTarget.y
  ));
  assert.ok(conditionPanels.length <= 4);
  assert.ok(conditionPanels.every((call) => call[3] + call[4] < advanceTarget.y));
});

test('CanvasGameRenderer draws military subviews and world actions without DOM adapters', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  [
    'assets/art/tile-map/tile-terrain-plains.png',
    'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png',
    'assets/art/tile-map/ocean-template/tile-ocean-shore-edge-sw.png',
    'assets/art/tile-map/river-template/tile-river-bank-uv-ne-sw.png',
    'assets/art/tile-map/ocean-template/tile-ocean-water-full.png',
    'assets/art/tile-map/tile-water-ocean-loop.png',
    'assets/art/tile-map/tile-water-river-loop.png',
    'assets/art/world-site-town-cutout.png',
  ].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: {
        src: assetPath,
        width: 512,
        height: 512,
        naturalWidth: 512,
        naturalHeight: 512,
      },
    });
  });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: { foodValue: '100', foodRate: '+1/s', knowledgeValue: '20', knowledgeRate: '+0.2/s', woodValue: '8', woodRate: '+0.1/s' },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildMilitaryNavigationViewState: (state) => ({
      activeView: state.militaryView || 'army',
      views: [
        { id: 'army', isActive: state.militaryView === 'army', disabled: false },
        { id: 'scout', isActive: state.militaryView === 'scout', disabled: false },
        { id: 'world', isActive: state.militaryView === 'world', disabled: false },
      ],
    }),
    buildMilitaryViewState: () => ({
      text: {
        soldierCount: '2/5',
        militaryDefense: 4,
        availableSoldierCount: 2,
        soldiersOnMission: 1,
        soldierTrainingText: '下一名 15/30 秒',
      },
      training: { progressWidth: '50%' },
    }),
    buildScoutControlViewState: () => ({
      statusText: '北方侦察中，预计 0:30 后返回。',
      reports: [{ title: '侦察报告', text: '发现东岸。' }],
      cells: [
        { type: 'center', label: '城', subLabel: '本城' },
        { type: 'button', id: 'n', direction: 'n', status: 'active', disabled: true, action: '', actionValue: '', label: '北方', actionText: '0:30' },
        { type: 'button', id: 'e', direction: 'e', status: 'available', disabled: false, action: 'scout', actionValue: 'e', label: '东方', actionText: '派出' },
        { type: 'button', id: 'w', direction: 'w', status: 'ready', disabled: false, action: 'claim', actionValue: 'mission-west', label: '西方', actionText: '报告' },
      ],
    }),
    buildTerritorySummaryViewState: () => ({ text: { polityName: '赤火联盟', territoryCount: '1/2 已控制' } }),
    buildWorldTileMapViewState: () => ({
      pan: { x: 0, y: 0 },
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: null },
        { id: 'tile_0_1', q: 0, r: 1, terrain: 'forest', terrainAsset: 'assets/art/tile-map/tile-terrain-forest.png', feature: { key: 'treeCluster', asset: 'assets/art/tile-map/tile-feature-tree-cluster.png', overlayKey: 'feature:treeCluster', offset: { x: 0, y: 4 } }, site: null },
        {
          id: 'tile_1_0',
          q: 1,
          r: 0,
          terrain: 'ocean',
          terrainAsset: 'assets/art/tile-map/ocean-template/tile-ocean-water-full.png',
          templateAssets: [{ key: 'river-mouth-sw', type: 'ocean', asset: 'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png' }],
          water: { kind: 'ocean', asset: 'assets/art/tile-map/tile-water-ocean-loop.png', uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
          site: { id: 'site-east', status: 'discovered', owner: 'neutral', type: 'town', name: '涓滃哺', title: '涓滃哺', art: 'assets/art/world-site-town-cutout.png', offset: { x: 0, y: 26 } },
        },
      ],
      activeScouts: [{
        id: 'scout-e',
        status: 'active',
        route: [
          { q: 1, r: 0, step: 1, revealed: true },
          { q: 2, r: 0, step: 2, revealed: false },
        ],
      }],
    }),
    buildWorldRadarViewState: () => ({
      sites: [
        { id: 'capital', status: 'occupied', owner: 'player', type: 'capital', name: '首都', title: '首都', art: 'assets/art/world-site-city-cutout.png', position: { left: '50', top: '50' } },
        { id: 'site-east', status: 'discovered', owner: 'neutral', type: 'town', name: '东岸', title: '东岸', art: 'assets/art/world-site-town-cutout.png', position: { left: '72', top: '44' } },
      ],
    }),
    buildWorldSiteDialogViewState: () => ({
      selectedSiteId: 'site-east',
      showModal: true,
      details: [{
        id: 'site-east',
        text: {
          name: '东岸',
          status: '已发现',
          owner: '无主',
          distance: '距 2',
          scale: '规模 1',
          threat: '威胁 0',
          summary: '食物 +10%',
          defense: '防御 0',
          soldiers: '建议 100 士兵',
          defenderLeader: '守将 拓锋 · 营帐战首 · 良才',
          defenderSkill: '敌方战法 裂甲猛冲',
          march: '行军耗时 1:30',
          note: '',
        },
        action: {
          buttons: [{ label: '占领', action: 'conquer', territoryId: 'site-east', disabled: false }],
          hint: '该地区无主，派出 100 士兵即可建立据点。',
        },
      }],
    }),
  });

  renderer.render({
    currentTab: 'military',
    militaryView: 'scout',
    territoryState: { scoutReports: [{ title: '侦察报告', text: '发现东岸。' }] },
  }, {
    activeTab: 'military',
    mode: 'hud',
  });
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '侦察'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '侦察报告'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '发现东岸。'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'switchMilitaryView' && target.action.view === 'world'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'scoutTerritory' && target.action.value === 'e'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'claimScout' && target.action.value === 'mission-west'));

  calls.length = 0;
  renderer.render({
    currentTab: 'military',
    currentEra: 5,
    militaryView: 'world',
    territoryState: { territories: [{ id: 'site-east', art: 'assets/art/world-site-town-cutout.png' }], scoutReports: [{ title: '侦察报告', text: '发现东岸。' }] },
  }, {
    activeTab: 'military',
    mode: 'hud',
    territoryUiState: { selectedSiteId: 'site-east' },
  });
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '赤火联盟'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '东岸'));
  assert.ok(calls.some((call) => call[0] === 'drawImage' && call[1]?.src === 'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png'));
  assert.ok(calls.some((call) => call[0] === 'drawImage' && call[1]?.src === 'assets/art/world-site-town-cutout.png' && call.length >= 10));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '守将 拓锋 · 营帐战首 · 良才'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '敌方战法 裂甲猛冲'));
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '侦察报告'), false);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '3 tiles'));
  const worldMapDragTarget = renderer.hitTargets.find((target) => target.action?.type === 'worldMapDrag');
  assert.ok(worldMapDragTarget);
  assert.ok(worldMapDragTarget.width > 286);
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'worldRadarDrag'), false);
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openWorldSite' && target.action.siteId === 'site-east'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'conquer'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeWorldSite'));
});

test('CanvasGameRenderer renders occupied city command overlay on map home', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      text: {
        foodValue: '120',
        woodValue: '80',
        stoneValue: '40',
        ironValue: '20',
        knowledgeValue: '12',
        populationValue: '6',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildWorldTileMapViewState: () => ({
      signature: 'city-command-overlay-test',
      version: 1,
      seed: 'seed',
      pan: { x: 0, y: 0 },
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: null },
        {
          id: 'tile_1_0',
          q: 1,
          r: 0,
          terrain: 'plains',
          terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png',
          site: { id: 'site-east', status: 'occupied', owner: 'player', type: 'city', name: '东岸', art: 'assets/art/world-site-city-cutout.png', offset: { x: 0, y: 26 } },
        },
      ],
      activeScouts: [],
    }),
    buildWorldSiteDialogViewState: () => ({
      selectedSiteId: 'site-east',
      showModal: true,
      details: [{
        id: 'site-east',
        text: { name: '东岸', status: '已占领', owner: '我方', summary: '粮仓充足' },
        action: {
          kind: 'city-command',
          buttons: [
            { label: '入城', action: 'enter-city', territoryId: 'site-east', disabled: false },
            { label: '行军', action: 'march-city', territoryId: 'site-east', disabled: true, secondary: true },
            { label: '调动', action: 'transfer-city', territoryId: 'site-east', disabled: true, secondary: true },
            { label: '驻守', action: 'garrison-city', territoryId: 'site-east', disabled: true, secondary: true },
            { label: '佣工', action: 'labor-city', territoryId: 'site-east', disabled: false, secondary: true },
            { label: '改名', action: 'rename-city', territoryId: 'site-east', disabled: false, secondary: true },
          ],
          hint: '选择入城进入建设、人口与驻军管理。',
        },
      }],
    }),
  });

  renderer.render({
    currentTab: 'military',
    militaryView: 'world',
    territoryState: {
      territories: [{ id: 'site-east', cityName: '东岸', art: 'assets/art/world-site-city-cutout.png' }],
      worldMap: { tiles: [{ id: 'tile_0_0' }] },
    },
  }, {
    activeTab: 'military',
    isMapHome: true,
    territoryUiState: { selectedSiteId: 'site-east' },
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '东岸'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '入城'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'enterCity' && target.action.cityId === 'site-east' && !target.action.tab));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'enterCity' && target.action.cityId === 'site-east' && target.action.tab === 'people'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'renameCity' && target.action.cityId === 'site-east'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'territoryAction' && target.action.disabled === true));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeWorldSite'));
});

test('CanvasGameRenderer renders city management panel over map home', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const UIStatePresenter = require('../js/state/UIStatePresenter');
  renderer.setPresenter({
    buildResourceViewState: () => ({
      text: {
        foodValue: '120',
        woodValue: '80',
        stoneValue: '40',
        ironValue: '20',
        knowledgeValue: '12',
        populationValue: '6',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildEventViewState: () => ({ badge: { hidden: true } }),
    buildWorldTileMapViewState: () => ({
      signature: 'city-management-panel-test',
      version: 1,
      seed: 'seed',
      pan: { x: 0, y: 0 },
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [{ id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: null }],
      activeScouts: [],
    }),
    buildWorldSiteDialogViewState: () => ({ showModal: false, details: [] }),
    buildPopulationViewState: UIStatePresenter.buildPopulationViewState.bind(UIStatePresenter),
    buildBuildingViewState: UIStatePresenter.buildBuildingViewState.bind(UIStatePresenter),
  });

  renderer.render({
    currentTab: 'military',
    militaryView: 'world',
    activeCityId: 'site-east',
    cityState: { cities: [{ id: 'site-east', name: '东岸', level: 2 }] },
    population: { total: 6, unassigned: 2, farmers: 2, scholars: 1, craftsmen: 1 },
    territoryState: {
      territories: [{ id: 'site-east', cityName: '东岸', terrainLabel: '河畔' }],
      worldMap: { tiles: [{ id: 'tile_0_0' }] },
    },
  }, {
    activeTab: 'military',
    isMapHome: true,
    showCityManagement: true,
    activeCityManagementTab: 'people',
    territoryUiState: {},
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '东岸'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '人才分配'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeCityManagement'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'switchCityManagementTab' && target.action.tab === 'buildings'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'switchCityManagementTab' && target.action.tab === 'military'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'assignJob' && target.action.job === 'farmer'));
});

test('CanvasGameRenderer caches static world tile layer between water animation frames', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  let workCanvasId = 0;
  renderer.createTileWorkCanvas = (width, height) => ({
    id: `work-${workCanvasId += 1}`,
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage(...args) { calls.push(['offscreenDrawImage', ...args]); },
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  [
    'assets/art/tile-map/tile-terrain-plains.png',
    'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png',
    'assets/art/tile-map/ocean-template/tile-ocean-shore-edge-sw.png',
    'assets/art/tile-map/ocean-template/tile-ocean-water-full.png',
    'assets/art/tile-map/tile-water-ocean-loop.png',
    'assets/art/world-site-town-cutout.png',
  ].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
    });
    renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  });
  const tileMapView = {
    signature: 'static-cache-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: null },
      {
        id: 'tile_1_0',
        q: 1,
        r: 0,
        terrain: 'ocean',
        terrainAsset: 'assets/art/tile-map/ocean-template/tile-ocean-water-full.png',
        templateAssets: [{ key: 'river-mouth-sw', type: 'ocean', asset: 'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png' }],
        water: { kind: 'ocean', asset: 'assets/art/tile-map/tile-water-ocean-loop.png', uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
        site: { id: 'site-east', owner: 'neutral', type: 'town', name: '东岸', art: 'assets/art/world-site-town-cutout.png', offset: { x: 0, y: 26 } },
      },
    ],
    activeScouts: [],
  };

  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const firstFrameStaticTileDraws = calls.filter((call) => (
    call[0] === 'offscreenDrawImage'
    && call[1]?.src?.includes('tile-map/')
    && !call[1]?.src?.includes('tile-water-')
  )).length;
  calls.length = 0;
  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const secondFrameStaticTileDraws = calls.filter((call) => (
    call[0] === 'offscreenDrawImage'
    && call[1]?.src?.includes('tile-map/')
    && !call[1]?.src?.includes('tile-water-')
  )).length;
  calls.length = 0;
  renderer.renderWorldTileMap({ ...tileMapView, pan: { x: 18, y: -10 } }, 20, 80, 320, 240, {});
  const draggedFrameStaticTileDraws = calls.filter((call) => (
    call[0] === 'offscreenDrawImage'
    && call[1]?.src?.includes('tile-map/')
    && !call[1]?.src?.includes('tile-water-')
  )).length;

  assert.ok(firstFrameStaticTileDraws > 0);
  assert.equal(secondFrameStaticTileDraws, 0);
  assert.equal(draggedFrameStaticTileDraws, 0);
  assert.ok(renderer.worldTileStaticCacheKey.includes('static-cache-test'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openWorldSite' && target.action.siteId === 'site-east'));
});

test('CanvasGameRenderer does not accumulate hit targets on passive world map layer frames', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildMilitaryNavigationViewState: () => ({ activeView: 'world' }),
    buildWorldTileMapViewState: () => ({
      signature: 'passive-map-hit-target-test',
      version: 1,
      seed: 'seed',
      pan: { x: 0, y: 0 },
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: null },
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: { id: 'site-east', owner: 'neutral', type: 'town', name: 'East', art: 'assets/art/world-site-town-cutout.png', offset: { x: 0, y: 26 } } },
      ],
      activeScouts: [],
    }),
  });

  for (let index = 0; index < 20; index += 1) {
    renderer.renderWorldMapLayer({
      currentTab: 'military',
      currentEra: 5,
      militaryView: 'world',
      territoryState: {},
    }, {
      topBarBottom: 84,
      territoryUiState: { worldPanX: index, worldPanY: -index },
      showFpsOverlay: false,
    });
    assert.equal(renderer.hitTargets.length, 0);
  }
});

test('CanvasGameRenderer caches scout route layer while dragging discovered world sites', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage(...args) { calls.push(['offscreenDrawImage', ...args]); },
      beginPath() { calls.push(['offscreenBeginPath']); },
      rect() {},
      roundRect() {},
      moveTo(...args) { calls.push(['offscreenMoveTo', ...args]); },
      lineTo(...args) { calls.push(['offscreenLineTo', ...args]); },
      closePath() {},
      clip() {},
      fill() {},
      stroke() { calls.push(['offscreenStroke']); },
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  [
    'assets/art/tile-map/tile-terrain-plains.png',
    'assets/art/world-site-town-cutout.png',
    'assets/art/world-site-outpost-cutout.png',
  ].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
    });
    renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  });
  const tileMapView = {
    signature: 'scout-route-cache-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: null },
      { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: { id: 'site-east', owner: 'neutral', type: 'town', name: '东岸', art: 'assets/art/world-site-town-cutout.png', offset: { x: 0, y: 26 } } },
      { id: 'tile_2_0', q: 2, r: 0, terrain: 'plains', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: { id: 'site-far', owner: 'neutral', type: 'outpost', name: '远哨', art: 'assets/art/world-site-outpost-cutout.png', offset: { x: 0, y: 24 } } },
    ],
    activeScouts: [{
      id: 'scout-e',
      status: 'ready',
      route: [
        { q: 0, r: 0, tileId: 'tile_0_0', step: 0, revealed: true },
        { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true },
        { q: 2, r: 0, tileId: 'tile_2_0', step: 2, revealed: false },
      ],
    }],
  };

  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const firstRouteStrokes = calls.filter((call) => call[0] === 'offscreenStroke').length;
  calls.length = 0;
  renderer.renderWorldTileMap({ ...tileMapView, pan: { x: 30, y: -16 } }, 20, 80, 320, 240, {});
  const draggedRouteStrokes = calls.filter((call) => call[0] === 'offscreenStroke').length;

  assert.ok(firstRouteStrokes > 0);
  assert.equal(draggedRouteStrokes, 0);
  assert.ok(renderer.worldTileScoutRouteCacheKey.includes('scout-route-cache-test'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openWorldSite' && target.action.siteId === 'site-far'));
});

test('CanvasGameRenderer keeps cached world tile layers sharp on high DPR screens', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 3 });
  const transforms = [];
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform(...args) { transforms.push(args); },
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage() {},
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  const assetPath = 'assets/art/tile-map/tile-terrain-plains.png';
  renderer.assetCache.set(assetPath, {
    status: 'loaded',
    image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
  });
  renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });

  renderer.renderWorldTileMap({
    signature: 'dpr-cache-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [{ id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainAsset: assetPath, site: null }],
    activeScouts: [],
  }, 20, 80, 320, 240, {});

  assert.equal(renderer.worldTileStaticCache.scale, 3);
  assert.equal(renderer.worldTileStaticCache.canvas.width, Math.ceil(renderer.worldTileStaticCache.width * 3));
  assert.equal(renderer.worldTileStaticCache.canvas.height, Math.ceil(renderer.worldTileStaticCache.height * 3));
  assert.ok(transforms.some((args) => args[0] === 3 && args[3] === 3));
});

test('CanvasGameRenderer prewarms world tile template masks after assets load', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const imageData = {
    data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
  };
  let imageDataReads = 0;
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalCompositeOperation: 'source-over',
      globalAlpha: 1,
      drawImage() {},
      clearRect() {},
      createImageData(w, h) {
        return { data: new Uint8ClampedArray(w * h * 4) };
      },
      getImageData() {
        imageDataReads += 1;
        return imageData;
      },
      putImageData() {},
    }),
  });
  const paths = [
    'assets/art/tile-map/tile-terrain-plains.png',
    'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png',
  ];
  paths.forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 4, height: 4, naturalWidth: 4, naturalHeight: 4 },
    });
  });

  const result = renderer.prewarmWorldTileCaches(paths);
  const readsAfterPrewarm = imageDataReads;
  renderer.getWorldTileTemplateMask(paths[1]);
  renderer.getWorldTileDryTemplateCanvas(paths[1]);

  assert.equal(result.metrics, 2);
  assert.equal(result.masks, 1);
  assert.equal(result.dryTemplates, 1);
  assert.equal(imageDataReads, readsAfterPrewarm);
});

test('CanvasGameRenderer uses chunked static snapshots when the full world cache is too large', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.getWorldTileStaticCachePixelBudget = () => 200000;
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage(...args) { calls.push(['offscreenDrawImage', ...args]); },
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  const assetPath = 'assets/art/tile-map/tile-terrain-plains.png';
  renderer.assetCache.set(assetPath, {
    status: 'loaded',
    image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
  });
  renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  const tiles = [];
  for (let q = 0; q < 20; q += 1) {
    for (let r = 0; r < 20; r += 1) {
      tiles.push({ id: `tile_${q}_${r}`, q, r, terrain: 'plains', terrainAsset: assetPath, site: null });
    }
  }
  const tileMapView = {
    signature: 'chunk-cache-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles,
    activeScouts: [],
  };

  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const firstFrameStaticTileDraws = calls.filter((call) => (
    call[0] === 'offscreenDrawImage'
    && call[1]?.src === assetPath
  )).length;
  calls.length = 0;
  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const secondFrameStaticTileDraws = calls.filter((call) => (
    call[0] === 'offscreenDrawImage'
    && call[1]?.src === assetPath
  )).length;

  const firstChunkKeys = Array.from(renderer.worldTileStaticChunkCaches.keys());
  assert.equal(renderer.worldTileStaticCacheLayoutKind, 'chunks');
  assert.equal(renderer.worldTileStaticCacheKey, '');
  assert.ok(firstChunkKeys.length > 0);
  assert.ok(Array.from(renderer.worldTileStaticChunkCaches.values()).every((work) => (
    work.width <= renderer.getWorldTileStaticChunkSize()
    && work.height <= renderer.getWorldTileStaticChunkSize()
    && work.canvas.width === Math.ceil(work.width * work.scale)
    && work.canvas.height === Math.ceil(work.height * work.scale)
  )));
  assert.ok(firstFrameStaticTileDraws > 0);
  assert.equal(secondFrameStaticTileDraws, 0);
  assert.deepEqual(Array.from(renderer.worldTileStaticChunkCaches.keys()), firstChunkKeys);

  calls.length = 0;
  renderer.renderWorldTileMap({ ...tileMapView, pan: { x: 120, y: 0 } }, 20, 80, 320, 240, {}, {
    fastDrag: true,
    snapshotOnly: true,
  });
  const snapshotFrameStaticTileDraws = calls.filter((call) => (
    call[0] === 'offscreenDrawImage'
    && call[1]?.src === assetPath
  )).length;
  assert.equal(snapshotFrameStaticTileDraws, 0);
  assert.deepEqual(Array.from(renderer.worldTileStaticChunkCaches.keys()), firstChunkKeys);

  calls.length = 0;
  renderer.renderWorldTileMap({ ...tileMapView, pan: { x: 900, y: 0 } }, 20, 80, 320, 240, {});
  assert.ok(renderer.worldTileStaticChunkCaches.size >= firstChunkKeys.length);
  assert.ok(firstChunkKeys.some((key) => renderer.worldTileStaticChunkCaches.has(key)));
});

test('CanvasGameRenderer prebuilds chunk snapshots across the full unlocked map', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.getWorldTileStaticCachePixelBudget = () => 200000;
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage() {},
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  const assetPath = 'assets/art/tile-map/tile-terrain-plains.png';
  renderer.assetCache.set(assetPath, {
    status: 'loaded',
    image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
  });
  renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  const tiles = [];
  for (let q = 0; q < 30; q += 1) {
    for (let r = 0; r < 30; r += 1) {
      tiles.push({ id: `tile_${q}_${r}`, q, r, terrain: 'plains', terrainAsset: assetPath, site: null });
    }
  }
  const tileMapView = {
    signature: 'full-atlas-chunk-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles,
    activeScouts: [],
  };
  const viewport = { originX: 195, originY: 315.2, panX: 0, panY: 0, scale: 0.75, geometry: tileMapView.geometry };
  const frame = { x: 1, y: 81, width: 388, height: 558 };
  const fullLayouts = renderer.getWorldTileStaticChunkLayouts(tileMapView, viewport, frame, tileMapView.geometry);
  const viewportOnlyKeys = new Set(fullLayouts
    .filter((layout) => (
      layout.drawX < frame.x + frame.width
      && layout.drawX + layout.frame.width > frame.x
      && layout.drawY < frame.y + frame.height
      && layout.drawY + layout.frame.height > frame.y
    ))
    .map((layout) => `${layout.chunkX},${layout.chunkY}`));

  renderer.renderWorldTileMap(tileMapView, 0, 80, 390, 560, {});
  const builtKeys = Array.from(renderer.worldTileStaticChunkCaches.keys());

  assert.equal(renderer.worldTileStaticCacheLayoutKind, 'chunks');
  assert.deepEqual(builtKeys.sort(), fullLayouts.map((layout) => `${layout.chunkX},${layout.chunkY}`).sort());
  assert.ok(builtKeys.length > viewportOnlyKeys.size);
});

test('CanvasGameRenderer prebakes reusable world water animation frames', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  let now = 1000;
  renderer.frameNow = now;
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage(...args) { calls.push(['offscreenDrawImage', ...args]); },
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  [
    'assets/art/tile-map/tile-terrain-plains.png',
    'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png',
    'assets/art/tile-map/ocean-template/tile-ocean-shore-edge-sw.png',
    'assets/art/tile-map/tile-water-ocean-loop.png',
  ].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
    });
    renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  });
  const tileMapView = {
    signature: 'water-layer-cache-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [{
      id: 'tile_1_0',
      q: 1,
      r: 0,
      terrain: 'ocean',
      terrainAsset: 'assets/art/tile-map/ocean-template/tile-ocean-water-full.png',
      templateAssets: [{ key: 'river-mouth-sw', type: 'ocean', asset: 'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png' }],
      water: { kind: 'ocean', asset: 'assets/art/tile-map/tile-water-ocean-loop.png', uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
      site: null,
    }],
    activeScouts: [],
  };

  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const firstFrameWaterDraws = calls.filter((call) => call[0] === 'offscreenDrawImage' && call[1]?.src?.includes('tile-water-')).length;
  const waterFrameKeys = Array.from(renderer.worldTileWaterFrameCaches.keys());
  calls.length = 0;
  now += 16;
  renderer.frameNow = now;
  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const sameWaterFrameDraws = calls.filter((call) => call[0] === 'offscreenDrawImage' && call[1]?.src?.includes('tile-water-')).length;
  calls.length = 0;
  renderer.renderWorldTileMap({ ...tileMapView, pan: { x: 42, y: -28 } }, 20, 80, 320, 240, {});
  const draggedWaterFrameDraws = calls.filter((call) => call[0] === 'offscreenDrawImage' && call[1]?.src?.includes('tile-water-')).length;
  calls.length = 0;
  now += 130;
  renderer.frameNow = now;
  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const nextWaterFrameDraws = calls.filter((call) => call[0] === 'offscreenDrawImage' && call[1]?.src?.includes('tile-water-')).length;

  assert.ok(firstFrameWaterDraws > 0);
  assert.equal(waterFrameKeys.length, renderer.getWorldTileWaterAnimationFrameCount());
  assert.equal(sameWaterFrameDraws, 0);
  assert.equal(draggedWaterFrameDraws, 0);
  assert.equal(nextWaterFrameDraws, 0);
  assert.ok(renderer.worldTileWaterLayerCacheKey.includes('water-layer-cache-test'));
});

test('CanvasGameRenderer prebakes water frames for offscreen unlocked water tiles', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage(...args) { calls.push(['offscreenDrawImage', ...args]); },
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  const waterAsset = 'assets/art/tile-map/tile-water-ocean-loop.png';
  const terrainAsset = 'assets/art/tile-map/ocean-template/tile-ocean-water-full.png';
  [terrainAsset, waterAsset, 'assets/art/tile-map/tile-terrain-plains.png'].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
    });
    renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  });
  const tileMapView = {
    signature: 'offscreen-water-cache-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainAsset: 'assets/art/tile-map/tile-terrain-plains.png', site: null },
      {
        id: 'tile_12_12',
        q: 12,
        r: 12,
        terrain: 'ocean',
        terrainAsset,
        templateAssets: [{ key: 'water-full', type: 'ocean', asset: terrainAsset }],
        water: { kind: 'ocean', asset: waterAsset, uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
        site: null,
      },
    ],
    activeScouts: [],
  };

  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});

  assert.equal(renderer.worldTileWaterFrameCaches.size, renderer.getWorldTileWaterAnimationFrameCount());
  assert.ok(calls.some((call) => call[0] === 'offscreenDrawImage' && call[1]?.src === waterAsset));
});

test('CanvasGameRenderer treats water tiles as animated even before template masks are available', () => {
  const { ctx } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });

  assert.equal(renderer.isWorldTileMapWaterAnimated({
    tiles: [{
      id: 'tile_river_legacy',
      terrain: 'river',
      water: { kind: 'river', asset: 'assets/art/tile-map/tile-water-river-loop.png' },
      templateAssets: [],
    }],
  }), true);
  assert.equal(renderer.isWorldTileMapWaterAnimated({
    tiles: [{
      id: 'tile_plain',
      terrain: 'plains',
      water: null,
      templateAssets: [],
    }],
  }), false);
});

test('CanvasGameRenderer preserves chunked water during snapshot drag frames', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 2 });
  renderer.getWorldTileStaticCachePixelBudget = () => 120000;
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage(...args) { calls.push(['offscreenDrawImage', ...args]); },
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  const waterAsset = 'assets/art/tile-map/tile-water-ocean-loop.png';
  const terrainAsset = 'assets/art/tile-map/ocean-template/tile-ocean-water-full.png';
  [terrainAsset, waterAsset].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
    });
    renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  });
  const tiles = [];
  for (let q = 0; q < 20; q += 1) {
    for (let r = 0; r < 20; r += 1) {
      tiles.push({
        id: `tile_${q}_${r}`,
        q,
        r,
        terrain: 'ocean',
        terrainAsset,
        water: { kind: 'ocean', asset: waterAsset, uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
        site: null,
      });
    }
  }
  const tileMapView = {
    signature: 'chunk-water-cache-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles,
    activeScouts: [],
  };

  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const waterChunkKeys = Array.from(renderer.worldTileWaterChunkCaches.keys());
  assert.equal(renderer.worldTileStaticCacheLayoutKind, 'chunks');
  assert.ok(waterChunkKeys.length > 0);
  calls.length = 0;

  renderer.renderWorldTileMap({ ...tileMapView, pan: { x: 120, y: 0 } }, 20, 80, 320, 240, {}, {
    fastDrag: true,
    snapshotOnly: true,
  });

  assert.deepEqual(Array.from(renderer.worldTileWaterChunkCaches.keys()), waterChunkKeys);
  assert.ok(calls.some((call) => (
    call[0] === 'drawImage'
    && Array.from(renderer.worldTileWaterChunkCaches.values()).some((work) => work.canvas === call[1])
  )));
  assert.equal(calls.some((call) => call[0] === 'offscreenDrawImage' && call[1]?.src === waterAsset), false);
});

test('CanvasGameRenderer freezes world water cache when a water time override is supplied', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.frameNow = 1000;
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage(...args) { calls.push(['offscreenDrawImage', ...args]); },
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  [
    'assets/art/tile-map/tile-terrain-plains.png',
    'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png',
    'assets/art/tile-map/tile-water-ocean-loop.png',
  ].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
    });
    renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  });
  const tileMapView = {
    signature: 'water-freeze-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [{
      id: 'tile_1_0',
      q: 1,
      r: 0,
      terrain: 'ocean',
      terrainAsset: 'assets/art/tile-map/ocean-template/tile-ocean-water-full.png',
      templateAssets: [{ key: 'river-mouth-sw', type: 'ocean', asset: 'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png' }],
      water: { kind: 'ocean', asset: 'assets/art/tile-map/tile-water-ocean-loop.png', uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
      site: null,
    }],
    activeScouts: [],
  };

  renderer.worldTileWaterTimeOverride = 1000;
  renderer.renderWorldTileMap(tileMapView, 20, 80, 320, 240, {});
  const firstFrameWaterDraws = calls.filter((call) => call[0] === 'offscreenDrawImage' && call[1]?.src?.includes('tile-water-')).length;
  calls.length = 0;
  renderer.frameNow = 1160;
  renderer.worldTileWaterTimeOverride = 1000;
  renderer.renderWorldTileMap({ ...tileMapView, pan: { x: 42, y: -20 } }, 20, 80, 320, 240, {});
  const frozenFrameWaterDraws = calls.filter((call) => call[0] === 'offscreenDrawImage' && call[1]?.src?.includes('tile-water-')).length;

  assert.ok(firstFrameWaterDraws > 0);
  assert.equal(frozenFrameWaterDraws, 0);
});

test('CanvasGameRenderer reuses tile layer caches during fast drag frames', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 2 });
  renderer.createTileWorkCanvas = (width, height) => ({
    width,
    height,
    getContext: () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      drawImage(...args) { calls.push(['offscreenDrawImage', ...args]); },
      beginPath() {},
      rect() {},
      roundRect() {},
      moveTo(...args) { calls.push(['offscreenMoveTo', ...args]); },
      lineTo(...args) { calls.push(['offscreenLineTo', ...args]); },
      closePath() {},
      clip() {},
      fill() {},
      stroke() { calls.push(['offscreenStroke']); },
      ellipse() {},
      arc() {},
      fillText() {},
      measureText(text) { return { width: String(text).length * 8 }; },
      createLinearGradient() { return { addColorStop() {} }; },
    }),
  });
  [
    'assets/art/tile-map/tile-terrain-plains.png',
    'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png',
    'assets/art/tile-map/tile-water-ocean-loop.png',
    'assets/art/world-site-town-cutout.png',
  ].forEach((assetPath) => {
    renderer.assetCache.set(assetPath, {
      status: 'loaded',
      image: { src: assetPath, width: 512, height: 512, naturalWidth: 512, naturalHeight: 512 },
    });
    renderer.assetMetricsCache.set(assetPath, { x: 0, y: 0, width: 512, height: 512, sourceWidth: 512, sourceHeight: 512 });
  });
  const tileMapView = {
    signature: 'fast-drag-cache-test',
    version: 1,
    seed: 'seed',
    pan: { x: 0, y: 0 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [{
      id: 'tile_0_0',
      q: 0,
      r: 0,
      terrain: 'ocean',
      terrainAsset: 'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png',
      templateAssets: [{ key: 'river-mouth-sw', type: 'ocean', asset: 'assets/art/tile-map/ocean-template/tile-ocean-river-mouth-sw.png' }],
      water: { kind: 'ocean', asset: 'assets/art/tile-map/tile-water-ocean-loop.png', uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
      site: { id: 'site-east', owner: 'neutral', type: 'town', name: 'East', art: 'assets/art/world-site-town-cutout.png', offset: { x: 0, y: 26 } },
    }],
    activeScouts: [{
      id: 'scout-east',
      status: 'active',
      route: [
        { q: 0, r: 0, tileId: 'tile_0_0', step: 0, revealed: true },
        { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: false },
      ],
    }],
  };

  renderer.renderWorldTileMap(tileMapView, 0, 80, 390, 560, {});
  assert.ok(renderer.worldTileStaticCacheKey);
  assert.ok(renderer.worldTileWaterLayerCacheKey);
  assert.ok(renderer.worldTileScoutRouteCacheKey);
  assert.ok(renderer.worldTileStaticCache?.canvas);
  assert.ok(renderer.worldTileWaterFrameCaches.size > 0);
  calls.length = 0;

  renderer.renderWorldTileMap({ ...tileMapView, pan: { x: 36, y: -18 } }, 0, 80, 390, 560, {}, {
    fastDrag: true,
    snapshotOnly: true,
  });

  assert.equal(calls.some((call) => call[0] === 'offscreenDrawImage'), false);
  assert.equal(calls.some((call) => call[0] === 'offscreenStroke'), false);
  assert.ok(calls.some((call) => call[0] === 'drawImage' && call[1] === renderer.worldTileStaticCache.canvas));
  assert.ok(calls.some((call) => (
    call[0] === 'drawImage'
    && Array.from(renderer.worldTileWaterFrameCaches.values()).some((work) => work.canvas === call[1])
  )));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openWorldSite' && target.action.siteId === 'site-east'));
});

test('CanvasGameRenderer renders naming prompt modal and actions on canvas', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: false,
      text: { foodValue: '10', foodRate: '+0/s', knowledgeValue: '1', knowledgeRate: '+0/s', woodValue: '0', woodRate: '+0/s' },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildPopulationViewState: () => ({ text: { total: 3, max: 3, unassigned: 0 }, jobs: [] }),
  });

  renderer.render({ currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    naming: {
      visible: true,
      view: { title: '为势力命名', message: '你已经扩张了领土。', placeholder: '例如：赤火联盟', maxLength: 12 },
      inputValue: '赤火联盟',
      submitting: false,
    },
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '为势力命名'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '赤火联盟'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'requestNamingInput'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'submitNaming'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeNaming'));
});

test('CanvasGameRenderer draws floating text effects on canvas', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: false,
      text: { foodValue: '10', foodRate: '+0/s', knowledgeValue: '1', knowledgeRate: '+0/s', woodValue: '0', woodRate: '+0/s' },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildPopulationViewState: () => ({ text: { total: 3, max: 3, unassigned: 0 }, jobs: [] }),
  });

  renderer.render({ currentTab: 'resources' }, {
    activeTab: 'resources',
    mode: 'hud',
    floatingTexts: [{ text: '建造成功！', progress: 0.25, color: '#74d3a0' }],
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '建造成功！'));
});

test('H5CanvasGameRenderer render calls drawing primitives with presenter guard', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new H5CanvasGameRenderer({ ctx, width: 390, height: 844 });
  renderer.setPresenter(null);

  renderer.render({}, { activeTab: 'resources' });

  assert.ok(calls.some((c) => c[0] === 'clearRect'));
  assert.ok(calls.some((c) => c[0] === 'fillRect'));
});

test('MiniGameCanvasRenderer extends CanvasGameRenderer after refactor', () => {
  const MiniGameCanvasRenderer = require('../js/platform/MiniGameCanvasRenderer');
  assert.ok(MiniGameCanvasRenderer !== undefined);
  const renderer = new MiniGameCanvasRenderer({
    runtime: {},
    width: 390,
    height: 844,
    pixelRatio: 1,
  });
  assert.ok(renderer instanceof CanvasGameRenderer);
  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.ok(typeof renderer.createImage === 'function');
});

test('H5 entry keeps Canvas as the only business UI after renderer extraction', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  assert.match(html, /<div id="app" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(html, /id="tabResources"|id="tabBuildings"|id="tabCivilization"|id="tabMilitary"|id="tabEvents"/);
  assert.doesNotMatch(html, /class="page|data-page=|class="tab-btn|data-tab=/);
  assert.doesNotMatch(html, /id="resourcePanel"/);
  assert.doesNotMatch(html, /id="resourceDetailModal"/);
  assert.doesNotMatch(html, /id="buildingGrid"|BuildingUIRenderer|BuildingActionAdapter|building-panel|building-card/);
  assert.doesNotMatch(html, /id="eventModal"|eventsBadge|pendingEventsContainer|eventHistoryList|EventUIRenderer/);
  assert.doesNotMatch(html, /id="techKnowledgeRate"|tech-header-panel|tech-panel/);
  assert.doesNotMatch(html, /btnAdvanceEra|civ-overview|civ-features|CivilizationPanelAdapter/);
  assert.doesNotMatch(html, /militaryPanel|scoutDirectionGrid|territoryGrid|MilitaryPanelAdapter|TerritoryActionAdapter|TerritoryUIRenderer/);
  assert.doesNotMatch(html, /NavigationShellAdapter\.js|H5TextAdapter\.js/);
  assert.doesNotMatch(appJs, /innerHTML\s*=\s*['"][^'"]*page[^'"]*<\/section>['"]/);
  assert.match(appJs, /H5ShellAdapter\?\.fromRuntime/);
  assert.doesNotMatch(appJs, /H5ShellAdapter\?\.fromDocument/);
  assert.match(appJs, /this\.canvasShell/);
  assert.match(appJs, /CanvasGameShell\?\.mount/);
  assert.match(appJs, /class H5GameHost extends CanvasGameAppBase/);
  assert.doesNotMatch(appJs, /handleCanvasTabSelection\(tabId\)/);
  assert.doesNotMatch(appJs, /action\?\.type === 'buildBuilding' \|\| action\?\.type === 'upgradeBuilding'/);
  assert.doesNotMatch(appJs, /action\?\.type === 'claimEvent'/);
  assert.doesNotMatch(appJs, /onAction: \(action\) =>/);
  assert.doesNotMatch(appJs, /renderTech\(\)|techKnowledgeRate/);
  assert.doesNotMatch(appJs, /renderCivilization\(\)|civilizationPanel/);
  assert.doesNotMatch(appJs, /militaryPanel|renderScoutControls\(\)|territoryRenderer|territoryActions/);
});

test('Canvas renderers are loaded in correct order in H5 index.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const famousLayoutIdx = html.indexOf('js/config/FamousPortraitLayout.js');
  const canvasIdx = html.indexOf('js/platform/CanvasGameRenderer.js');
  const worldMapRuntimeIdx = html.indexOf('js/platform/WorldMapRuntime.js');
  const worldMapCoordinatorIdx = html.indexOf('js/platform/WorldMapRuntimeCoordinator.js');
  const minigameIdx = html.indexOf('js/platform/MiniGameCanvasRenderer.js');
  const h5gameIdx = html.indexOf('js/platform/H5CanvasGameRenderer.js');
  const actionControllerIdx = html.indexOf('js/platform/CanvasActionController.js');
  const guideIdx = html.indexOf('js/platform/CanvasGuideController.js');
  const runtimeIdx = html.indexOf('js/platform/H5CanvasRuntime.js');
  const appCoreIdx = html.indexOf('js/platform/CanvasGameApp.js');
  const shellIdx = html.indexOf('js/platform/CanvasGameShell.js');
  const appIdx = html.indexOf('app.js');

  assert.ok(famousLayoutIdx >= 0);
  assert.ok(canvasIdx >= 0);
  assert.ok(worldMapRuntimeIdx >= 0);
  assert.ok(worldMapCoordinatorIdx >= 0);
  assert.ok(minigameIdx >= 0);
  assert.ok(h5gameIdx >= 0);
  assert.ok(actionControllerIdx >= 0);
  assert.ok(guideIdx >= 0);
  assert.ok(appCoreIdx >= 0);
  assert.ok(runtimeIdx >= 0);
  assert.ok(shellIdx >= 0);
  assert.ok(appIdx >= 0);

  assert.ok(famousLayoutIdx < canvasIdx);
  assert.ok(canvasIdx < worldMapRuntimeIdx);
  assert.ok(worldMapRuntimeIdx < worldMapCoordinatorIdx);
  assert.ok(worldMapCoordinatorIdx < appCoreIdx);
  assert.ok(canvasIdx < minigameIdx);
  assert.ok(canvasIdx < h5gameIdx);
  assert.ok(h5gameIdx < actionControllerIdx);
  assert.ok(actionControllerIdx < guideIdx);
  assert.ok(h5gameIdx < guideIdx);
  assert.ok(guideIdx < appCoreIdx);
  assert.ok(appCoreIdx < shellIdx);
  assert.ok(runtimeIdx < shellIdx);
  assert.ok(shellIdx < appIdx);
});
