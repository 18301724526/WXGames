const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const CanvasGameRenderer = require('../js/platform/CanvasGameRenderer');
const H5CanvasGameRenderer = require('../js/platform/H5CanvasGameRenderer');

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
      stroke(...a) { calls.push(['stroke', ...a]); },
      fill() {},
      save() {},
      restore() {},
      clip() {},
      translate(...a) { calls.push(['translate', ...a]); },
      arc() {},
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

test('CanvasGameRenderer renders guide task bar and reward reveal on shared canvas', () => {
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

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '主线'));
  assert.ok(renderer.hitTargets.some((target) => (
    target.action?.type === 'openTaskCenter'
    && target.action.tab === 'main'
    && target.action.source === 'guideTaskBar'
  )));
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'claimGuideTaskReward'), false);
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '获得奖励'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '收下'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeRewardReveal'));
});

test('CanvasGameRenderer renders guide task go button for active tasks', () => {
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
  const taskTarget = renderer.hitTargets.find((target) => target.action?.type === 'openTaskCenter');
  const guidebookTarget = renderer.hitTargets.find((target) => target.action?.type === 'openGuidebook');
  assert.ok(categoryTargets.length > 0);
  assert.ok(taskTarget);
  assert.ok(guidebookTarget);
  categoryTargets.forEach((target) => {
    assert.equal(rectsOverlap(target, taskTarget), false);
    assert.equal(rectsOverlap(target, guidebookTarget), false);
  });
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
          nextEffectText: '建成后效果：士兵容量 5',
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
        currentEffectText: '当前效果：士兵容量 5，训练速度 30秒/人',
        nextEffectText: '下一级效果：士兵容量 10（提升 5），训练速度 20秒/人（加快 10秒）',
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
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '资源'));
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
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '资源'));
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
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '解锁建筑：'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农田'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '研究后：'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农田提供稳定粮食生产。'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '前置科技：无'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('科技树')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '田块轮作'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农耕分支'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '伐木权责'));
  const lineCalls = calls.filter((call) => call[0] === 'lineTo');
  assert.ok(lineCalls.length >= 4);
  assert.ok(lineCalls.some((call) => Math.abs(call[1] - 195) < 1));
  assert.equal(lineCalls.some((call) => call[1] === 195 && Math.abs(call[2] - 603.55) < 1), false);
  const techTarget = renderer.hitTargets.find((target) => target.action.type === 'selectTechNode' && target.action.techId === 'farming_field_rotation');
  assert.ok(techTarget);
  assert.deepEqual(
    renderer.getHitTarget({ x: techTarget.x + 2, y: techTarget.y + 2 }),
    { type: 'selectTechNode', techId: 'farming_field_rotation', dragType: 'techTreeDrag' },
  );
  const researchTarget = renderer.hitTargets.find((target) => target.action.type === 'research');
  assert.ok(researchTarget);
  assert.deepEqual(
    renderer.getHitTarget({ x: researchTarget.x + 2, y: researchTarget.y + 2 }),
    { type: 'research', techId: 'farming_field_rotation', disabled: false },
  );
  assert.ok(renderer.hitTargets.some((target) => target.action.type === 'techTreeDrag'));
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

test('CanvasGameRenderer places shared tech nodes between route lanes', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const view = {
    tree: {
      eras: [{ era: 2, name: 'Shared Era', choiceText: '0/1', closed: false, column: 2 }],
      nodes: [
        { id: 'left', title: 'Left', tree: { column: 2, row: 1, lane: -4, routes: ['agriculture'], parents: [] } },
        { id: 'pivot', title: 'Pivot', tree: { column: 2, row: 2, lane: 0.5, routes: ['agriculture', 'military'], parents: ['left', 'right'] } },
        { id: 'right', title: 'Right', tree: { column: 2, row: 1, lane: 5, routes: ['military'], parents: [] } },
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
  assert.ok(layout.routeGuides.some((route) => route.id === 'agriculture'));
  assert.ok(layout.routeGuides.some((route) => route.id === 'military'));
  assert.equal(layout.linkPaths.length, 2);
  assert.ok(leftRect.x + leftRect.width < pivotRect.x);
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
          soldiers: '建议 1 士兵',
          march: '行军耗时 1:30',
          note: '',
        },
        action: {
          buttons: [{ label: '占领', action: 'conquer', territoryId: 'site-east', disabled: false }],
          hint: '该地区无主，派 1 人即可建立据点。',
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
  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '侦察报告'), false);
  const radarDragTarget = renderer.hitTargets.find((target) => target.action?.type === 'worldRadarDrag');
  assert.ok(radarDragTarget);
  assert.ok(radarDragTarget.width > 286);
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'openWorldSite' && target.action.siteId === 'site-east'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'conquer'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'closeWorldSite'));
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
  const canvasIdx = html.indexOf('js/platform/CanvasGameRenderer.js');
  const minigameIdx = html.indexOf('js/platform/MiniGameCanvasRenderer.js');
  const h5gameIdx = html.indexOf('js/platform/H5CanvasGameRenderer.js');
  const actionControllerIdx = html.indexOf('js/platform/CanvasActionController.js');
  const guideIdx = html.indexOf('js/platform/CanvasGuideController.js');
  const runtimeIdx = html.indexOf('js/platform/H5CanvasRuntime.js');
  const appCoreIdx = html.indexOf('js/platform/CanvasGameApp.js');
  const shellIdx = html.indexOf('js/platform/CanvasGameShell.js');
  const appIdx = html.indexOf('app.js');

  assert.ok(canvasIdx >= 0);
  assert.ok(minigameIdx >= 0);
  assert.ok(h5gameIdx >= 0);
  assert.ok(actionControllerIdx >= 0);
  assert.ok(guideIdx >= 0);
  assert.ok(appCoreIdx >= 0);
  assert.ok(runtimeIdx >= 0);
  assert.ok(shellIdx >= 0);
  assert.ok(appIdx >= 0);

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
