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

  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 12 && c[2] === 12 && c[3] === 366 && c[4] === 180), 'top bar should match measured 366x180 DOM rect');
  assert.ok(calls.some((c) => c[0] === 'roundRect' && Math.abs(c[1] - 26) < 0.2 && c[2] === 69 && Math.abs(c[3] - 107.33) < 0.2 && c[4] === 79), 'resource card should match DOM y=69 height=79 responsively');
  assert.ok(calls.some((c) => c[0] === 'roundRect' && c[1] === 92 && c[2] === 153 && c[3] === 190 && c[4] === 34), 'city switcher should match measured 190x34 DOM rect');
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
  assert.deepEqual(renderer.getHitTarget({ x: 75, y: 804 }), { type: 'switchTab', tab: 'buildings' });
  assert.deepEqual(renderer.getHitTarget({ x: 135, y: 804 }), { type: 'switchTab', tab: 'tech' });
  assert.deepEqual(renderer.getHitTarget({ x: 320, y: 804 }), { type: 'switchTab', tab: 'military' });
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

test('H5 entry keeps only unmigrated DOM UI after canvas renderer extraction', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  assert.match(html, /<div id="app">/);
  assert.match(html, /id="eventModal"/);
  assert.match(html, /id="tabResources"/);
  assert.match(html, /id="tabBuildings"/);
  assert.match(html, /id="tabCivilization"/);
  assert.match(html, /id="tabMilitary"/);
  assert.match(html, /id="tabEvents"/);
  assert.doesNotMatch(html, /id="resourcePanel"/);
  assert.doesNotMatch(html, /id="resourceDetailModal"/);
  assert.doesNotMatch(html, /id="buildingGrid"|BuildingUIRenderer|BuildingActionAdapter|building-panel|building-card/);
  assert.doesNotMatch(appJs, /innerHTML\s*=\s*['"][^'"]*page[^'"]*<\/section>['"]/);
  assert.match(appJs, /H5ShellAdapter\?\.fromDocument/);
  assert.match(appJs, /this\.canvasShell/);
  assert.match(appJs, /action\?\.type === 'buildBuilding' \|\| action\?\.type === 'upgradeBuilding'/);
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
