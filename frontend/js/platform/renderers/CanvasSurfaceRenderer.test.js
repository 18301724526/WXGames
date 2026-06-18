const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasSurfaceHitTargets = require('./CanvasSurfaceHitTargets');
const CanvasSurfaceTextLayout = require('./CanvasSurfaceTextLayout');
const CanvasSurfaceRenderer = require('./CanvasSurfaceRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

function createCtx(calls = []) {
  return {
    font: '10px sans-serif',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textBaseline: '',
    textAlign: '',
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    beginPath() { calls.push(['beginPath']); },
    rect(...args) { calls.push(['rect', ...args]); },
    roundRect(...args) { calls.push(['roundRect', ...args]); },
    clip() { calls.push(['clip']); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    translate(...args) { calls.push(['translate', ...args]); },
    scale(...args) { calls.push(['scale', ...args]); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    fill() { calls.push(['fill']); },
    stroke() { calls.push(['stroke']); },
    fillText(...args) { calls.push(['fillText', ...args]); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    bezierCurveTo(...args) { calls.push(['bezierCurveTo', ...args]); },
    arc(...args) { calls.push(['arc', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    measureText(text) { return { width: String(text).length * 8 }; },
    createLinearGradient(...args) {
      calls.push(['createLinearGradient', ...args]);
      return { addColorStop(offset, color) { calls.push(['linearStop', offset, color]); } };
    },
    createRadialGradient(...args) {
      calls.push(['createRadialGradient', ...args]);
      return { addColorStop(offset, color) { calls.push(['radialStop', offset, color]); } };
    },
  };
}

function createHost(overrides = {}) {
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    maxContentWidth: 360,
    edgePadding: 12,
    ctx: createCtx(calls),
    hitTargets: [],
    hoverPoint: null,
    famousSkillHitTargets: [{ id: 'old' }],
    activeFamousSkillTooltip: { id: 'old' },
    suppressHitTargets: false,
    frameNow: 0,
    fpsLastFrameAt: 0,
    fpsSamples: [],
    currentFps: 0,
    fpsLastPaintAt: 0,
    fpsLastPaintedValue: 0,
    showFpsOverlay: true,
    calls,
    drawAsset(...args) { calls.push(['drawAsset', ...args]); },
    presenter: {
      buildCitySwitcherViewState() {
        return { hidden: true };
      },
    },
    ...overrides,
  };
  return host;
}

test('CanvasSurfaceRenderer preserves layout and gradient helpers', () => {
  const host = createHost({ width: 500, maxContentWidth: 420, edgePadding: 20 });
  const renderer = new CanvasSurfaceRenderer({ host });

  assert.deepEqual(renderer.getLayout(), { contentX: 40, contentWidth: 420, contentRight: 460 });

  const gradient = renderer.createGradient(0, 1, 2, 3, [[0, '#000'], [1, '#fff']], '#fallback');
  const radial = renderer.createRadialGradient(0, 1, 2, 3, 4, 5, [[0.5, '#123']], '#fallback');

  assert.equal(typeof gradient.addColorStop, 'function');
  assert.equal(typeof radial.addColorStop, 'function');
  assert.deepEqual(host.calls.filter((call) => call[0].endsWith('Stop')), [
    ['linearStop', 0, '#000'],
    ['linearStop', 1, '#fff'],
    ['radialStop', 0.5, '#123'],
  ]);
});

test('CanvasSurfaceRenderer preserves hit target priority and tutorial shield rules', () => {
  const host = createHost();
  const renderer = new CanvasSurfaceRenderer({ host });

  renderer.setHitTargets([]);
  renderer.addHitTarget({ x: 0, y: 0, width: 100, height: 100 }, { type: 'background', background: true });
  renderer.addHitTarget({ x: 10, y: 10, width: 80, height: 80 }, { type: 'blockedAction' });
  renderer.addHitTarget({ x: 0, y: 0, width: 100, height: 100 }, {
    type: 'blockCanvasModal',
    allowedAction: { type: 'openWorldSite', cityId: 'capital' },
  });

  assert.deepEqual(renderer.getHitTarget({ x: 20, y: 20 }), {
    type: 'blockCanvasModal',
    allowedAction: { type: 'openWorldSite', cityId: 'capital' },
  });

  renderer.addHitTarget({ x: 10, y: 10, width: 80, height: 80 }, { type: 'openWorldSite', cityId: 'capital' });
  assert.deepEqual(renderer.getHitTarget({ x: 20, y: 20 }), { type: 'openWorldSite', cityId: 'capital' });

  renderer.setHitTargets([]);
  renderer.addHitTarget({ x: 10, y: 10, width: 42, height: 42 }, { type: 'selectWorldActor', missionId: 'march-1' });
  renderer.addHitTarget({ x: 0, y: 0, width: 80, height: 80 }, { type: 'openWorldSite', siteId: 'capital' });
  const picker = renderer.getHitTarget({ x: 24, y: 24 });
  assert.equal(picker.type, 'openWorldTargetPicker');
  assert.equal(picker.candidates.length, 2);

  renderer.setHitTargets([]);
  renderer.addHitTarget({ x: 10, y: 10, width: 42, height: 42 }, { type: 'selectWorldActor', missionId: 'march-1' });
  renderer.addHitTarget({ x: 0, y: 0, width: 80, height: 80 }, { type: 'openWorldSite', siteId: 'capital' });
  renderer.addHitTarget({ x: 10, y: 10, width: 80, height: 32 }, { type: 'chooseWorldTarget', targetId: 'march-1' });
  assert.deepEqual(renderer.getHitTarget({ x: 24, y: 24 }), { type: 'chooseWorldTarget', targetId: 'march-1' });

  renderer.setHitTargets([]);
  renderer.addHitTarget({ x: 174, y: 236, width: 42, height: 42 }, { type: 'selectWorldActor', missionId: 'march-1' });
  renderer.addHitTarget({ x: 166, y: 231, width: 58, height: 24 }, { type: 'returnWorldMarch', missionId: 'march-1' });
  assert.deepEqual(renderer.getHitTarget({ x: 195, y: 243 }), { type: 'returnWorldMarch', missionId: 'march-1' });

  renderer.setHitTargets([]);
  renderer.addHitTarget({ x: 10, y: 10, width: 80, height: 80 }, { type: 'openTaskCenter', tab: 'main' });
  renderer.addHitTarget({ x: 0, y: 0, width: 100, height: 100 }, {
    type: 'blockCanvasModal',
    allowedAction: { type: 'openTaskCenter' },
  });
  assert.deepEqual(renderer.getHitTarget({ x: 20, y: 20 }), { type: 'openTaskCenter', tab: 'main' });

  renderer.setHitTargets([]);
  renderer.addHitTarget({ x: 10, y: 10, width: 80, height: 80 }, { type: 'openTaskCenter', disabled: true });
  renderer.addHitTarget({ x: 0, y: 0, width: 100, height: 100 }, {
    type: 'blockCanvasModal',
    allowedAction: { type: 'openTaskCenter' },
  });
  assert.deepEqual(renderer.getHitTarget({ x: 20, y: 20 }), {
    type: 'blockCanvasModal',
    allowedAction: { type: 'openTaskCenter' },
  });

  renderer.setHitTargets([]);
  renderer.addHitTarget({ x: 10, y: 10, width: 80, height: 80 }, { type: 'closeRewardReveal' });
  renderer.addHitTarget({ x: 0, y: 0, width: 100, height: 100 }, {
    type: 'blockCanvasModal',
    allowedAction: { type: 'buildBuilding', buildingId: 'farm' },
  });
  assert.deepEqual(renderer.getHitTarget({ x: 20, y: 20 }), { type: 'closeRewardReveal' });

  renderer.withSuppressedHitTargets(() => {
    renderer.addHitTarget({ x: 0, y: 0, width: 10, height: 10 }, { type: 'suppressed' });
  });
  assert.equal(host.hitTargets.some((target) => target.action.type === 'suppressed'), false);
});

test('CanvasSurfaceRenderer preserves hover point and geometry helpers', () => {
  const host = createHost();
  const renderer = new CanvasSurfaceRenderer({ host });

  assert.equal(renderer.containsPoint({ x: 10, y: 20, width: 30, height: 40 }, { x: 25, y: 50 }), true);
  assert.equal(renderer.containsPoint({ x: 10, y: 20, width: 30, height: 40 }, { x: 50, y: 50 }), false);
  assert.equal(renderer.setHoverPoint({ x: '11', y: 22 }), true);
  assert.deepEqual(host.hoverPoint, { x: 11, y: 22 });
  assert.equal(renderer.setHoverPoint({ x: 'bad', y: 22 }), false);
  assert.equal(host.hoverPoint, null);
});

test('CanvasSurfaceRenderer preserves clip callback flow', () => {
  const host = createHost();
  const renderer = new CanvasSurfaceRenderer({ host });
  const result = renderer.withTranslatedClip(1, 2, 3, 4, 5, 6, () => 'done');

  assert.equal(result, 'done');
  assert.deepEqual(host.calls.slice(0, 6), [
    ['save'],
    ['beginPath'],
    ['rect', 1, 2, 3, 4],
    ['clip'],
    ['translate', 5, 6],
    ['restore'],
  ]);
});

test('CanvasGameRenderer clip facades do not replay undefined callbacks', () => {
  const renderer = new CanvasGameRenderer({ ctx: createCtx(), presenter: {} });
  let transformedCalls = 0;
  let translatedCalls = 0;
  let suppressedCalls = 0;

  const transformed = renderer.withTransformedClip(1, 2, 3, 4, 5, 6, 1.2, () => {
    transformedCalls += 1;
  });
  const translated = renderer.withTranslatedClip(1, 2, 3, 4, 5, 6, () => {
    translatedCalls += 1;
  });
  const suppressed = renderer.withSuppressedHitTargets(() => {
    suppressedCalls += 1;
  });

  assert.equal(transformed, undefined);
  assert.equal(translated, undefined);
  assert.equal(suppressed, undefined);
  assert.equal(transformedCalls, 1);
  assert.equal(translatedCalls, 1);
  assert.equal(suppressedCalls, 1);
});

test('CanvasSurfaceRenderer preserves text measuring and truncation font restore', () => {
  const host = createHost();
  const renderer = new CanvasSurfaceRenderer({ host });
  host.ctx.font = '12px serif';

  assert.deepEqual(renderer.wrapText('abcdef', 24, { size: 16 }), ['abc', 'def']);
  assert.equal(renderer.measureTextWidth('abcd', { bold: true, size: 18 }), 32);
  assert.equal(renderer.truncateText('abcdef', 32, { size: 14 }), 'a...');
  assert.deepEqual(renderer.wrapTextLimit('abcdefghi', 24, 2, { size: 14 }), ['abc', '...']);
  assert.equal(host.ctx.font, '12px serif');
});

test('CanvasSurfaceHitTargets owns hit target and tutorial shield contracts', () => {
  const hitTargets = [
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 100, height: 100 }, { type: 'background', background: true }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 10, y: 10, width: 80, height: 80 }, { type: 'blockedAction' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 100, height: 100 }, {
      type: 'blockCanvasModal',
      allowedAction: { type: 'openWorldSite', cityId: 'capital' },
    }),
  ];

  assert.equal(CanvasSurfaceHitTargets.containsPoint(hitTargets[0], { x: 20, y: 20 }), true);
  assert.equal(CanvasSurfaceHitTargets.isAllowedUnderTutorialShield({ type: 'openTaskCenter' }), true);
  assert.equal(CanvasSurfaceHitTargets.isAllowedUnderTutorialShield({ type: 'openTaskCenter', disabled: true }), false);
  assert.equal(CanvasSurfaceHitTargets.isAllowedUnderTutorialShield({ type: 'closeRewardReveal' }), true);
  assert.equal(CanvasSurfaceHitTargets.isAllowedUnderTutorialShield({ type: 'closeAdvisor', source: 'houseBuilt' }), true);
  assert.equal(CanvasSurfaceHitTargets.isAllowedUnderTutorialShield({ type: 'closeAdvisor' }), false);
  assert.equal(CanvasSurfaceHitTargets.matchesTutorialShieldAllowedAction(
    { type: 'openWorldSite', cityId: 'capital' },
    { type: 'openWorldSite', cityId: 'capital' },
  ), true);
  assert.equal(CanvasSurfaceHitTargets.matchesCurrentTutorialIntroAction(
    { type: 'enterCity', cityId: 'capital' },
    { active: true, step: 'enter', capitalCityId: 'capital' },
  ), true);
  assert.deepEqual(CanvasSurfaceHitTargets.resolveHitTarget(hitTargets, { x: 20, y: 20 }), {
    type: 'blockCanvasModal',
    allowedAction: { type: 'openWorldSite', cityId: 'capital' },
  });
  assert.deepEqual(CanvasSurfaceHitTargets.resolveHitTarget([
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 100, height: 100 }, { type: 'closeAdvisor', source: 'houseBuilt' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 100, height: 100 }, { type: 'blockCanvasModal' }),
  ], { x: 20, y: 20 }), { type: 'closeAdvisor', source: 'houseBuilt' });
  const picker = CanvasSurfaceHitTargets.resolveHitTarget([
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 10, y: 10, width: 42, height: 42 }, { type: 'selectWorldActor', missionId: 'march-1' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 80, height: 80 }, { type: 'openWorldSite', siteId: 'capital' }),
  ], { x: 24, y: 24 });
  assert.equal(picker.type, 'openWorldTargetPicker');
  assert.equal(picker.candidates.length, 2);
  assert.deepEqual(CanvasSurfaceHitTargets.resolveHitTarget([
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 80, height: 80 }, { type: 'openWorldSite', siteId: 'capital', tileId: 'tile_23_18' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 10, y: 10, width: 50, height: 50 }, { type: 'enterCity', cityId: 'capital' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 8, y: 8, width: 60, height: 60 }, { type: 'enterCity', cityId: 'capital', territoryId: 'capital' }),
  ], { x: 24, y: 24 }), { type: 'enterCity', cityId: 'capital', territoryId: 'capital' });
  assert.deepEqual(CanvasSurfaceHitTargets.resolveHitTarget([
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 10, y: 10, width: 42, height: 42 }, { type: 'selectWorldActor', missionId: 'march-1' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 80, height: 80 }, { type: 'openWorldSite', siteId: 'capital' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 100, height: 100 }, { type: 'blockCanvasModal' }),
  ], { x: 24, y: 24 }), { type: 'blockCanvasModal' });
  assert.deepEqual(CanvasSurfaceHitTargets.resolveHitTarget([
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 10, y: 10, width: 42, height: 42 }, { type: 'selectWorldActor', missionId: 'march-1' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 80, height: 80 }, { type: 'openWorldSite', siteId: 'capital' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 100, height: 100 }, {
      type: 'blockCanvasModal',
      allowedAction: { type: 'openWorldSite', siteId: 'capital' },
    }),
  ], { x: 24, y: 24 }), { type: 'openWorldSite', siteId: 'capital' });
  assert.deepEqual(CanvasSurfaceHitTargets.resolveHitTarget([
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 10, y: 10, width: 42, height: 42 }, { type: 'selectWorldActor', missionId: 'march-1' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 0, y: 0, width: 80, height: 80 }, { type: 'openWorldSite', siteId: 'capital' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 10, y: 10, width: 80, height: 32 }, { type: 'chooseWorldTarget', targetId: 'march-1' }),
  ], { x: 24, y: 24 }), { type: 'chooseWorldTarget', targetId: 'march-1' });
  assert.deepEqual(CanvasSurfaceHitTargets.resolveHitTarget([
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 174, y: 236, width: 42, height: 42 }, { type: 'selectWorldActor', missionId: 'march-1' }),
    CanvasSurfaceHitTargets.normalizeHitTarget({ x: 166, y: 231, width: 58, height: 24 }, { type: 'returnWorldMarch', missionId: 'march-1' }),
  ], { x: 195, y: 243 }), { type: 'returnWorldMarch', missionId: 'march-1' });
});

test('CanvasSurfaceTextLayout owns text layout helpers and line-count boundary', () => {
  const calls = [];
  const ctx = createCtx(calls);
  ctx.font = '11px serif';

  assert.equal(CanvasSurfaceTextLayout.buildFont({ bold: true, size: 16 }), '700 16px sans-serif');
  assert.deepEqual(CanvasSurfaceTextLayout.wrapText(ctx, 'abcd', 16, { size: 12 }), ['ab', 'cd']);
  assert.equal(CanvasSurfaceTextLayout.measureTextWidth(ctx, 'abc', { size: 12 }), 24);
  assert.equal(CanvasSurfaceTextLayout.truncateText(ctx, 'abcdef', 32, { size: 12 }), 'a...');
  assert.deepEqual(CanvasSurfaceTextLayout.wrapTextLimit(ctx, 'abcdef', 16, 2, { size: 12 }), ['ab', '...']);
  assert.equal(ctx.font, '11px serif');

  assert.ok(lineCount(path.join(__dirname, 'CanvasSurfaceRenderer.js')) < 500);
  assert.ok(lineCount(path.join(__dirname, 'CanvasSurfaceHitTargets.js')) < 500);
  assert.ok(lineCount(path.join(__dirname, 'CanvasSurfaceTextLayout.js')) < 500);
});

test('CanvasSurfaceRenderer preserves frame timing and FPS overlay contract', () => {
  const host = createHost();
  const renderer = new CanvasSurfaceRenderer({ host });

  assert.equal(renderer.beginFrame({ now: 1000, tutorialIntro: { active: true, step: 'city' } }), 1000);
  assert.equal(host.frameNow, 1000);
  assert.deepEqual(host.famousSkillHitTargets, []);
  assert.equal(host.activeFamousSkillTooltip, null);
  assert.equal(renderer.matchesCurrentTutorialIntroAction({ type: 'openWorldSite', cityId: 'capital' }), true);

  assert.equal(renderer.updateFps(1016), 60);
  renderer.renderFpsOverlay({ fps: 60 });
  assert.equal(host.calls.some((call) => call[0] === 'fillText' && call[1] === 'FPS 60'), true);

  renderer.endFrame({ fps: 60 });
  assert.equal(host.frameNow, 0);
});

test('CanvasSurfaceRenderer preserves common drawing primitives', () => {
  const host = createHost();
  const renderer = new CanvasSurfaceRenderer({ host });

  renderer.drawPanel(1, 2, 30, 40, { inset: '#inset' });
  renderer.drawButton(3, 4, 50, 20, 'OK', { active: true });
  renderer.drawPrimaryActionButton(5, 6, 70, 24, 'Go');
  renderer.drawProgressBar(7, 8, 90, 12, 50);
  renderer.drawIconCard(9, 10, 44, 44, 'asset.png', { iconWidth: 20, iconHeight: 18 });
  renderer.drawPolyline([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
  renderer.drawCurvePath({ start: { x: 1, y: 2 }, c1: { x: 3, y: 4 }, c2: { x: 5, y: 6 }, end: { x: 7, y: 8 } });
  renderer.drawCircle(11, 12, 13, { fill: '#f', stroke: '#s' });

  assert.equal(host.calls.some((call) => call[0] === 'roundRect'), true);
  assert.equal(host.calls.some((call) => call[0] === 'fillText' && call[1] === 'OK'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawAsset' && call[1] === 'asset.png'), true);
  assert.equal(host.calls.some((call) => call[0] === 'bezierCurveTo'), true);
  assert.equal(host.calls.some((call) => call[0] === 'arc'), true);
});

test('CanvasGameRenderer exposes surface rendering through facade', () => {
  class StubSurfaceRenderer {
    constructor(options) {
      this.host = options.host;
    }

    getLayout(...args) {
      return { method: 'getLayout', host: this.host, args };
    }

    setHitTargets(targets) {
      this.host.stubTargets = targets;
    }

    addHitTarget(rect, action) {
      this.host.stubTarget = { rect, action };
    }

    beginFrame(...args) {
      return { method: 'beginFrame', host: this.host, args };
    }

    drawButton(...args) {
      return { method: 'drawButton', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    surfaceRendererClass: StubSurfaceRenderer,
  });

  assert.equal(renderer.getLayout('x').host, renderer);
  renderer.setHitTargets([{ id: 'target' }]);
  renderer.addHitTarget({ x: 1, y: 2, width: 3, height: 4 }, { type: 'click' });
  assert.deepEqual(renderer.hitTargets, [{ id: 'target' }]);
  assert.deepEqual(renderer.stubTargets, [{ id: 'target' }]);
  assert.deepEqual(renderer.stubTarget.action, { type: 'click' });
  assert.equal(renderer.beginFrame({ now: 123 }).method, 'beginFrame');
  assert.equal(renderer.drawButton(1, 2, 3, 4, 'OK').method, 'drawButton');
});
