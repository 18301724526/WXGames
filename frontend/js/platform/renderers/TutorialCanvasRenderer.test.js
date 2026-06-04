const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialAdvisorCanvasRenderer = require('./TutorialAdvisorCanvasRenderer');
const TutorialCanvasRenderer = require('./TutorialCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createCtx(calls = []) {
  return {
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    rect() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    clip() {},
    translate() {},
    rotate() {},
    scale() {},
    lineWidth: 1,
    globalAlpha: 1,
  };
}

function createHost(overrides = {}) {
  const hitTargets = [];
  const drawCalls = [];
  const host = {
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    ctx: createCtx(drawCalls),
    presenter: {
      buildTutorialHighlightViewState() {
        return {
          overlay: { left: '40px', top: '50px', width: '90px', height: '70px' },
          bubble: { left: '56px', top: '132px' },
          pointer: { left: '72px', top: '118px' },
        };
      },
    },
    hitTargets,
    drawCalls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    drawPanel() { drawCalls.push(['drawPanel']); },
    drawText() { drawCalls.push(['drawText']); },
    drawTextLines() { drawCalls.push(['drawTextLines']); },
    getAsset() { return null; },
    getLayout() { return { contentX: 10, contentWidth: 370 }; },
    getNow() { return 1000; },
    getWorldSiteCanvasAnchor(siteId) {
      return {
        siteId,
        hitRect: { x: 80, y: 120, width: 64, height: 48, action: { type: 'openWorldSite', siteId } },
      };
    },
    handleAssetsChanged() {},
    measureTextWidth(text) { return String(text || '').length * 8; },
    parsePixelValue(value) {
      if (typeof value === 'number') return value;
      const parsed = Number(String(value ?? '').replace('px', ''));
      return Number.isFinite(parsed) ? parsed : 0;
    },
    roundRectPath() {},
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
}

test('TutorialCanvasRenderer resolves intro targets and keeps tutorial shield hit targets', () => {
  const host = createHost();
  host.hitTargets.push({
    x: 100,
    y: 160,
    width: 80,
    height: 60,
    action: { type: 'openWorldSite', siteId: 'capital' },
  });
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  const rendered = renderer.renderTutorialIntro({}, {
    tutorialIntro: {
      active: true,
      step: 'focus',
      capitalCityId: 'capital',
      advisorName: 'Advisor',
      messages: { focus: 'Tap the city.' },
    },
  });

  assert.equal(rendered, true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.hitTargets.some((target) => target.action.allowedAction?.type === 'openWorldSite'), true);
});

test('CanvasGameRenderer exposes tutorial helpers through the tutorial renderer facade', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    tutorialRendererClass: TutorialCanvasRenderer,
  });

  renderer.hitTargets = [
    { x: 20, y: 30, width: 50, height: 40, action: { type: 'enterCity', cityId: 'capital' } },
  ];

  assert.deepEqual(
    renderer.resolveTutorialIntroTarget({ step: 'enter', capitalCityId: 'capital' }, {}, {}),
    { x: 10, y: 20, width: 70, height: 60, action: { type: 'enterCity', cityId: 'capital' } },
  );
  assert.deepEqual(renderer.normalizeRect({ x: -10, y: 4, width: 50, height: 20 }), { x: 0, y: 4, width: 50, height: 20 });
});

test('TutorialCanvasRenderer moves intro march unit from fog edge to city tile edge', () => {
  const host = createHost({ width: 390, height: 693 });
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });
  const target = { x: 170, y: 300, width: 72, height: 56 };
  const start = renderer.getTutorialIntroMarchRoute(target, 0);
  const middle = renderer.getTutorialIntroMarchRoute(target, 0.5);
  const end = renderer.getTutorialIntroMarchRoute(target, 1);
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  assert.ok(start.x < 0);
  assert.ok(start.y > targetCenter.y);
  assert.ok(middle.x > start.x + 80);
  assert.ok(middle.x < end.x - 28);
  assert.ok(Math.hypot(end.x - targetCenter.x, end.y - targetCenter.y) > 32);
  assert.ok(Math.hypot(end.x - targetCenter.x, end.y - targetCenter.y) < 56);
});

test('TutorialCanvasRenderer draws intro march unit from sprite frames when loaded', () => {
  const host = createHost({
    getAsset(assetPath) {
      if (!assetPath.includes('%E5%A3%AB%E5%85%B5')) return null;
      return { naturalWidth: 215, naturalHeight: 510, width: 215, height: 510 };
    },
  });
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  renderer.renderTutorialIntroUnit(120, 240, 1, { startedAt: 1000 });

  const drawImage = host.drawCalls.find((call) => call[0] === 'drawImage');
  assert.ok(drawImage);
  assert.equal(drawImage[1].naturalWidth, 215);
  assert.equal(host.drawCalls.some((call) => call[0] === 'drawPanel'), false);
});

test('TutorialCanvasRenderer keeps the march unit parked on the first frame during click guidance', () => {
  const loaded = [];
  const host = createHost({
    getNow() { return 2400; },
    getAsset(assetPath) {
      loaded.push(assetPath);
      return { naturalWidth: 215, naturalHeight: 510, width: 215, height: 510 };
    },
  });
  host.hitTargets.push(
    { x: 170, y: 300, width: 72, height: 56, action: { type: 'openWorldSite', siteId: 'capital' } },
    { x: 270, y: 560, width: 72, height: 44, action: { type: 'enterCity', cityId: 'capital' } },
  );
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  renderer.renderTutorialIntro({}, {
    tutorialIntro: {
      active: true,
      step: 'enter',
      capitalCityId: 'capital',
      startedAt: 0,
      marchDurationMs: 2400,
      messages: { enter: 'Enter.' },
    },
  });

  assert.equal(loaded.at(-1).endsWith('/001.png'), true);
  assert.equal(host.hitTargets.some((target) => target.action.allowedAction?.type === 'enterCity'), true);
  assert.equal(host.hitTargets.filter((target) => target.action.type === 'blockCanvasModal').length, 4);
});

test('TutorialCanvasRenderer keeps advisor spine alive while rendering intro dialogue', () => {
  const calls = [];
  const host = createHost({
    getAsset(assetPath) {
      if (!assetPath.includes('%E5%A3%AB%E5%85%B5')) return null;
      return { naturalWidth: 215, naturalHeight: 510, width: 215, height: 510 };
    },
  });
  host.hitTargets.push({
    x: 170,
    y: 300,
    width: 72,
    height: 56,
    action: { type: 'openWorldSite', siteId: 'capital' },
  });
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: {
      disposeTutorialAdvisorSpine() {
        calls.push(['dispose']);
        return true;
      },
      renderTutorialIntroAdvisorPortrait(x, y, width, height) {
        calls.push(['portrait', x, y, width, height]);
        return true;
      },
    },
  });

  renderer.renderTutorialIntro({}, {
    tutorialIntro: {
      active: true,
      step: 'city',
      capitalCityId: 'capital',
      startedAt: 0,
      marchDurationMs: 4800,
      advisorName: 'Advisor',
      messages: { city: 'Tap the city.' },
    },
  });

  assert.equal(calls.some((call) => call[0] === 'dispose'), false);
  assert.equal(calls.some((call) => call[0] === 'portrait'), true);
});

test('TutorialCanvasRenderer moves the march unit into the city and fades it out', () => {
  const host = createHost({ width: 390, height: 693 });
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });
  const target = { x: 170, y: 300, width: 72, height: 56 };
  const parked = renderer.getTutorialIntroMarchRoute(target, 1);
  const entering = renderer.getTutorialIntroEnterRoute(target, { enterStartedAt: 1000, enterDurationMs: 800 }, 1700);
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  assert.ok(entering.x > parked.x);
  assert.ok(Math.hypot(entering.x - targetCenter.x, entering.y - targetCenter.y) < Math.hypot(parked.x - targetCenter.x, parked.y - targetCenter.y));
  assert.ok(entering.alpha < 0.4);
});

test('TutorialCanvasRenderer draws tutorial highlight and blocks outside the focus rect', () => {
  const host = createHost();
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  renderer.renderTutorialHighlight({
    rect: { left: 40, top: 50, width: 90, height: 70 },
    message: 'Focus here.',
    pulseStartedAt: 900,
  });

  assert.equal(host.hitTargets.filter((target) => target.action.type === 'blockCanvasModal').length, 4);
  assert.equal(host.drawCalls.some((call) => call[0] === 'fillRect'), true);
  assert.equal(host.drawCalls.some((call) => call[0] === 'drawTextLines'), true);
});

test('TutorialAdvisorCanvasRenderer crops advisor images to cover target bounds', () => {
  const drawCalls = [];
  const renderer = new TutorialAdvisorCanvasRenderer({
    host: {
      ctx: createCtx(drawCalls),
    },
  });

  assert.equal(renderer.drawTutorialAdvisorImageCover({ width: 400, height: 200 }, 0, 0, 400, 200, 10, 20, 100, 100), true);

  const drawImage = drawCalls.find((call) => call[0] === 'drawImage');
  assert.ok(drawImage);
  assert.deepEqual(drawImage.slice(2), [100, 0, 200, 200, 10, 20, 100, 100]);
});

test('TutorialAdvisorCanvasRenderer renders advisor spine on the full game frame', () => {
  const calls = [];
  const previousSpinePlayer = global.SpineWebglPlayer;
  const previousDevicePixelRatio = global.devicePixelRatio;
  class FakeSpinePlayer {
    constructor(options) {
      this.status = 'loading';
      this.options = options;
      calls.push(['construct', options]);
    }

    load(options) {
      calls.push(['load', options]);
      return true;
    }

    resize() {}

    dispose() {}
  }
  FakeSpinePlayer.isAvailable = () => true;
  try {
    global.devicePixelRatio = 2.5;
    global.SpineWebglPlayer = FakeSpinePlayer;
    const canvas = { style: {} };
    const runtime = {
      width: 390,
      height: 693,
      ensureLayerCanvas(name, options) {
        calls.push(['ensureLayerCanvas', name, options]);
        return canvas;
      },
      getLayerMetrics() {
        return { width: 390, height: 693 };
      },
      setLayerVisible(name, visible) {
        calls.push(['setLayerVisible', name, visible]);
      },
    };
    const renderer = new TutorialAdvisorCanvasRenderer({
      host: {
        h5Runtime: runtime,
        width: 390,
        height: 693,
        handleAssetsChanged() {},
      },
    });

    assert.equal(renderer.renderTutorialAdvisorSpineLayer(12, 44, 120, 240), true);

    const ensureCall = calls.find((call) => call[0] === 'ensureLayerCanvas');
    assert.deepEqual(ensureCall[2].rect, { x: 0, y: 0, width: 390, height: 693 });
    assert.equal(ensureCall[2].pixelRatio, 2);
    assert.equal(canvas.style.opacity, '1');
    const constructCall = calls.find((call) => call[0] === 'construct');
    assert.deepEqual(constructCall[1].viewFocus, { centerX: 420, centerY: 1800, height: 2000 });
    const loadCall = calls.find((call) => call[0] === 'load');
    assert.deepEqual(loadCall[1].viewFocus, { centerX: 420, centerY: 1800, height: 2000 });
  } finally {
    global.SpineWebglPlayer = previousSpinePlayer;
    global.devicePixelRatio = previousDevicePixelRatio;
  }
});

test('TutorialCanvasRenderer places intro dialogue at tuned left offset', () => {
  const host = createHost();
  const calls = [];
  host.drawPanel = (...args) => calls.push(['drawPanel', ...args]);
  host.drawText = (...args) => calls.push(['drawText', ...args]);
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: {
      renderTutorialIntroAdvisorPortrait() {
        calls.push(['portrait']);
        return true;
      },
    },
  });

  renderer.renderTutorialIntroDialogue('Message.', 'Advisor');

  const panel = calls.find((call) => call[0] === 'drawPanel');
  assert.equal(panel[1], 96);
  const name = calls.find((call) => call[0] === 'drawText');
  assert.equal(name[2], 120);
});
