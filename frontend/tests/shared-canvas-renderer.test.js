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
      moveTo() {},
      lineTo() {},
      stroke() {},
      fill() {},
      save() {},
      restore() {},
      clip() {},
      arc() {},
      createLinearGradient() { calls.push(['gradient']); return gradient; },
      fillText(...a) { calls.push(['fillText', ...a]); },
      drawImage(...a) { calls.push(['drawImage', ...a]); },
    },
  };
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

test('CanvasGameRenderer top HUD uses compact icon/value resource strip', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'platform', 'CanvasGameRenderer.js'), 'utf8');

  assert.match(source, /const resourceHeight = 48/);
  assert.match(source, /const barHeight = cityView\.hidden \? 112 : 152/);
  assert.doesNotMatch(source, /const resourceHeight = 79/);
  assert.doesNotMatch(source, /drawPanel\(cardX, cardY, cardWidth, resourceHeight/);
});

test('CanvasGameRenderer world radar applies pan offset to site positions', () => {
  const { ctx, calls } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({ hasWood: true, text: { foodValue: '100', foodRate: '+1/s', knowledgeValue: '20', knowledgeRate: '+0.2/s', woodValue: '8', woodRate: '+0.1/s' } }),
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

  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 12 && c[2] === 12 && c[3] === 366 && c[4] === 152), 'top bar should use compact 366x152 HUD rect');
  assert.equal(calls.some((c) => c[0] === 'roundRect' && c[2] === 68 && c[4] === 48), false, 'resource strip should not draw individual card backgrounds');
  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 92 && c[2] === 124 && c[3] === 190 && c[4] === 32), 'city switcher should move upward under compact resource strip');
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
        { id: 'capital', name: '首都', tag: '主城', metaText: '人口 8 · 建筑 4', isActive: true },
        { id: 'site_river', name: '河湾城', tag: '分城', metaText: '人口 3 · 建筑 1', isActive: false },
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
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '净增长 +1/s'));
  const closeTarget = renderer.hitTargets.find((target) => target.action?.type === 'closeResourceDetails' && target.width === 28);
  assert.ok(closeTarget);
  assert.deepEqual(renderer.getHitTarget({
    x: closeTarget.x + closeTarget.width / 2,
    y: closeTarget.y + closeTarget.height / 2,
  }), { type: 'closeResourceDetails' });
  assert.deepEqual(renderer.getHitTarget({ x: 40, y: 100 }), { type: 'closeResourceDetails' });
});

test('CanvasGameRenderer resource details panel hides wood before settlement era', () => {
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

  assert.equal(calls.some((call) => call[0] === 'fillText' && call[1] === '木材'), false);
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
    buildBuildingViewState: () => ({
      isEmpty: false,
      cards: [
        {
          id: 'farm',
          name: '农田',
          art: 'assets/art/building-farm-cutout.png',
          levelText: '等级 0',
          effectText: '食物产出 +50%',
          button: { action: 'build', label: '建造', disabled: false },
          cost: { text: '免费建造', parts: [], isMax: false },
        },
        {
          id: 'house',
          name: '民居',
          art: 'assets/art/building-house-cutout.png',
          levelText: '等级 1',
          descText: '增加人口上限',
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
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '农田'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '民居'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'farm'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'upgradeBuilding' && target.action.buildingId === 'house'));
});

test('CanvasGameRenderer paginates overflow building cards without DOM scrolling', () => {
  const { ctx } = makeCtx();
  ctx.measureText = (text) => ({ width: String(text).length * 8 });
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const cards = ['farm', 'house', 'lumbermill', 'barracks', 'watchtower', 'temple'].map((id, index) => ({
    id,
    name: id,
    art: '',
    icon: `${index}`,
    levelText: '等级 0',
    descText: '建筑说明',
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
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'lumbermill'));
  assert.equal(renderer.hitTargets.some((target) => target.action?.type === 'buildBuilding' && target.action.buildingId === 'farm'), false);
});

test('CanvasGameRenderer draws events page and event modal without DOM renderer', () => {
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
        items: [{ icon: '🌾', title: '丰收', result: '🌾 +40', className: 'positive' }],
      },
    }),
    buildEventModalViewState: () => ({
      showModal: true,
      text: {
        title: '🌲 森林低语以及一段足够长的标题',
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
          preview: '🪵 +20',
          rows: [
            { label: '奖励', text: '🪵 +20', tone: 'reward' },
            { label: '时限', text: '立即完成', tone: 'time' },
          ],
        },
        {
          id: 'study_trail',
          label: '研究路径',
          preview: '📚 +10',
          rows: [
            { label: '需求', text: '知识 8', tone: 'requirement' },
            { label: '奖励', text: '📚 +10', tone: 'reward' },
            { label: '惩罚', text: '失败损失 20 食物', tone: 'penalty' },
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
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('🌲 森林低语')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '收集木材'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('需求:')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('奖励:')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('惩罚:')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('时限:')));
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

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '食物'));
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
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '食物'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '知识'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '木材'));
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
      text: {
        knowledgeRate: '0.2/s',
        title: '科技树',
        placeholder: '首期暂不重构科技系统',
        subtitle: '当前阶段先保留科技入口与知识产出展示',
      },
    }),
  });

  renderer.render({ currentEraName: '聚落时代', resources: { knowledgePerSecond: 0.2 } }, {
    activeTab: 'tech',
    mode: 'hud',
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '当前知识产出'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '0.2/s'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && String(call[1]).includes('科技树')));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '首期暂不重构科技系统'));
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
        civOverviewPop: 4,
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
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '总人口'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '满足条件，可进阶'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'advanceEra'));
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
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'territoryAction' && target.action.action === 'conquer'));
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
  assert.match(appJs, /handleCanvasTabSelection/);
  assert.match(appJs, /action\?\.type === 'buildBuilding' \|\| action\?\.type === 'upgradeBuilding'/);
  assert.match(appJs, /action\?\.type === 'claimEvent'/);
  assert.doesNotMatch(appJs, /renderTech\(\)|techKnowledgeRate/);
  assert.doesNotMatch(appJs, /renderCivilization\(\)|civilizationPanel/);
  assert.doesNotMatch(appJs, /militaryPanel|renderScoutControls\(\)|territoryRenderer|territoryActions/);
});

test('Canvas renderers are loaded in correct order in H5 index.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const canvasIdx = html.indexOf('js/platform/CanvasGameRenderer.js');
  const minigameIdx = html.indexOf('js/platform/MiniGameCanvasRenderer.js');
  const h5gameIdx = html.indexOf('js/platform/H5CanvasGameRenderer.js');
  const runtimeIdx = html.indexOf('js/platform/H5CanvasRuntime.js');
  const shellIdx = html.indexOf('js/platform/H5CanvasAppShell.js');
  const appIdx = html.indexOf('app.js');

  assert.ok(canvasIdx >= 0);
  assert.ok(minigameIdx >= 0);
  assert.ok(h5gameIdx >= 0);
  assert.ok(runtimeIdx >= 0);
  assert.ok(shellIdx >= 0);
  assert.ok(appIdx >= 0);

  assert.ok(canvasIdx < minigameIdx);
  assert.ok(canvasIdx < h5gameIdx);
  assert.ok(runtimeIdx < shellIdx);
  assert.ok(shellIdx < appIdx);
});
