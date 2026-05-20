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
      text: { totalPop: '3', maxPop: '3', unassignedPop: '0' },
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

test('H5 entry does not replace existing DOM UI after renderer extraction', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  assert.match(html, /<div id="app">/);
  assert.match(html, /id="resourcePanel"/);
  assert.match(html, /id="buildingGrid"/);
  assert.match(html, /id="eventModal"/);
  assert.match(html, /id="tabResources"/);
  assert.match(html, /id="tabBuildings"/);
  assert.match(html, /id="tabCivilization"/);
  assert.match(html, /id="tabMilitary"/);
  assert.match(html, /id="tabEvents"/);
  assert.doesNotMatch(appJs, /innerHTML\s*=\s*['"][^'"]*page[^'"]*<\/section>['"]/);
  assert.match(appJs, /H5ShellAdapter\?\.fromDocument/);
  assert.match(appJs, /this\.canvasShell/);
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
