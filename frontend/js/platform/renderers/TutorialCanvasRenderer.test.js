const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TutorialAdvisorCanvasRenderer = require('./TutorialAdvisorCanvasRenderer');
const TutorialAdvisorDialogueRenderer = require('./TutorialAdvisorDialogueRenderer');
const TutorialDialogueLayer = require('./TutorialDialogueLayer');
const TutorialIntroDialogueLayout = require('./TutorialIntroDialogueLayout');
const TutorialIntroMarchModel = require('./TutorialIntroMarchModel');
const TutorialIntroUnitRenderer = require('./TutorialIntroUnitRenderer');
const TutorialCanvasRenderer = require('./TutorialCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

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
    interpolateRect(fromRect = {}, toRect = {}) { return toRect || fromRect; },
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

test('TutorialCanvasRenderer makes anchor-resolved intro capital clickable', () => {
  const host = createHost({
    getWorldSiteCanvasAnchor(siteId) {
      return {
        siteId,
        tile: { id: 'tile_28_-7' },
        site: { id: siteId },
        hitRect: { x: 80, y: 120, width: 64, height: 48 },
      };
    },
  });
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  const rendered = renderer.renderTutorialIntro({}, {
    tutorialIntro: {
      active: true,
      step: 'city',
      capitalCityId: 'capital',
      advisorName: 'Advisor',
      messages: { city: 'Tap the city.' },
    },
  });

  const capitalTarget = host.hitTargets.find((target) => target.action.type === 'openWorldSite');
  assert.equal(rendered, true);
  assert.equal(capitalTarget.action.siteId, 'capital');
  assert.equal(capitalTarget.action.tileId, 'tile_28_-7');
  assert.equal(host.hitTargets.some((target) => target.action.allowedAction?.type === 'openWorldSite'), true);
});

test('TutorialCanvasRenderer does not use stale world-site hit targets as intro anchor', () => {
  const host = createHost({
    getWorldSiteCanvasAnchor(siteId) {
      return {
        siteId,
        tile: { id: 'tile_fresh' },
        site: { id: siteId },
        hitRect: { x: 80, y: 120, width: 64, height: 48 },
      };
    },
  });
  host.hitTargets.push({
    x: 240,
    y: 320,
    width: 72,
    height: 56,
    action: { type: 'openWorldSite', siteId: 'capital', tileId: 'tile_stale' },
  });
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  const target = renderer.resolveTutorialIntroTarget({
    step: 'city',
    capitalCityId: 'capital',
  }, {}, {});
  const unitTarget = renderer.resolveTutorialIntroUnitTarget({
    step: 'city',
    capitalCityId: 'capital',
  }, {}, {});

  assert.deepEqual(target, {
    x: 68,
    y: 108,
    width: 88,
    height: 72,
    action: {
      type: 'openWorldSite',
      siteId: 'capital',
      tileId: 'tile_fresh',
      inputSurface: 'worldMap',
    },
  });
  assert.deepEqual(unitTarget, {
    x: 80,
    y: 120,
    width: 64,
    height: 48,
    action: null,
  });
});

test('TutorialCanvasRenderer uses world-map layer anchor over HUD fallback for intro targets', () => {
  const calls = [];
  const host = createHost({
    getWorldSiteCanvasAnchor(siteId, state, options) {
      calls.push(['hudFallback', siteId, Boolean(options.worldMapRuntimeContext)]);
      return {
        siteId,
        tile: { id: 'tile_hud_fallback' },
        site: { id: siteId },
        hitRect: { x: 360, y: 440, width: 72, height: 96 },
      };
    },
  });
  const worldMapAnchorSource = {
    getWorldSiteCanvasAnchor(siteId, state, options) {
      calls.push(['worldMapAnchor', siteId, Boolean(options.worldMapRuntimeContext)]);
      return {
        siteId,
        tile: { id: 'tile_live' },
        site: { id: siteId },
        hitRect: { x: 172, y: 253, width: 85, height: 89 },
      };
    },
  };
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  const target = renderer.resolveTutorialIntroTarget({
    step: 'city',
    capitalCityId: 'capital',
  }, {}, {
    worldMapAnchorSource,
    worldMapRuntimeContext: { tileMapView: { tiles: [] }, viewport: {} },
  });
  const unitTarget = renderer.resolveTutorialIntroUnitTarget({
    step: 'city',
    capitalCityId: 'capital',
  }, {}, {
    worldMapAnchorSource,
    worldMapRuntimeContext: { tileMapView: { tiles: [] }, viewport: {} },
  });

  assert.deepEqual(target, {
    x: 160,
    y: 241,
    width: 109,
    height: 113,
    action: {
      type: 'openWorldSite',
      siteId: 'capital',
      tileId: 'tile_live',
      inputSurface: 'worldMap',
    },
  });
  assert.deepEqual(unitTarget, {
    x: 172,
    y: 253,
    width: 85,
    height: 89,
    action: null,
  });
  assert.deepEqual(calls, [
    ['worldMapAnchor', 'capital', true],
    ['worldMapAnchor', 'capital', true],
  ]);
});

test('TutorialCanvasRenderer prefers explicit intro anchor source over host.host world-map renderer', () => {
  const explicitSource = {
    getWorldSiteCanvasAnchor(siteId) {
      return {
        siteId,
        __sentinelSource: 'explicit',
        hitRect: { x: 11, y: 22, width: 33, height: 44 },
      };
    },
  };
  const hostHostSource = {
    getWorldSiteCanvasAnchor(siteId) {
      return {
        siteId,
        __sentinelSource: 'hosthost',
        hitRect: { x: 99, y: 88, width: 77, height: 66 },
      };
    },
  };
  const host = createHost({
    host: {
      worldMapRenderer: hostHostSource,
    },
  });
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  const hostHostAnchor = host.host.worldMapRenderer.getWorldSiteCanvasAnchor('capital');
  const source = renderer.getWorldSiteIntroAnchorSource({ worldMapAnchorSource: explicitSource });
  const anchor = source.getWorldSiteCanvasAnchor('capital');

  assert.equal(hostHostAnchor.__sentinelSource, 'hosthost');
  assert.equal(source, explicitSource);
  assert.equal(anchor.__sentinelSource, 'explicit');
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

test('TutorialIntroMarchModel owns route, enter fade, frame, and line-count contracts', () => {
  const viewport = { width: 390, height: 693, bottomSafeArea: 12 };
  const target = { x: 170, y: 300, width: 72, height: 56 };
  const route = TutorialIntroMarchModel.getMarchRoute(target, 0.5, viewport);
  const end = TutorialIntroMarchModel.getMarchRoute(target, 1, viewport);
  const entering = TutorialIntroMarchModel.getEnterRoute(target, { enterStartedAt: 1000, enterDurationMs: 800 }, 1700, viewport);
  const manifest = {
    getFramePaths() {
      return ['001.png', '002.png', '003.png'];
    },
    getFrameDurationMs() {
      return 100;
    },
  };

  assert.ok(route.start.x < 0);
  assert.ok(route.x > route.start.x);
  assert.ok(route.x < end.x);
  assert.ok(entering.x > end.x);
  assert.ok(entering.alpha < 0.4);
  assert.equal(TutorialIntroMarchModel.getFramePath({ manifest, now: 1250, intro: { startedAt: 1000 } }), '003.png');
  assert.equal(TutorialIntroMarchModel.getFramePath({ manifest, now: 1250, intro: { freezeFrame: true } }), '001.png');
  assert.ok(lineCount(path.join(__dirname, 'TutorialCanvasRenderer.js')) < 500);
  assert.ok(lineCount(path.join(__dirname, 'TutorialIntroMarchModel.js')) < 500);
});

test('TutorialCanvasRenderer draws intro march unit from sprite frames when loaded', () => {
  const host = createHost({
    getAsset(assetPath) {
      if (!assetPath.includes('assets/art/units/spearman/move')) return null;
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

test('TutorialIntroUnitRenderer owns sprite and fallback drawing contracts', () => {
  const calls = [];
  const host = {
    ctx: createCtx(calls),
    getNow() { return 1000; },
    getAsset(assetPath) {
      if (assetPath === 'frame.png') return { naturalWidth: 215, naturalHeight: 510 };
      return null;
    },
    roundRectPath() { calls.push(['roundRectPath']); },
  };

  assert.equal(TutorialIntroUnitRenderer.drawSprite(host, 120, 240, 1, 'frame.png'), true);
  assert.equal(calls.some((call) => call[0] === 'drawImage'), true);
  calls.length = 0;
  assert.equal(TutorialIntroUnitRenderer.renderUnit(host, 120, 240, 1, ''), false);
  assert.equal(calls.some((call) => call[0] === 'roundRectPath'), true);
  assert.ok(lineCount(path.join(__dirname, 'TutorialIntroUnitRenderer.js')) < 500);
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
      if (!assetPath.includes('assets/art/units/spearman/move')) return null;
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
    allowedAction: { type: 'openWorldSite', siteId: 'site_1_2' },
    pulseStartedAt: 900,
  });

  assert.equal(host.hitTargets.filter((target) => target.action.type === 'blockCanvasModal').length, 4);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldSite' && target.action.siteId === 'site_1_2'), true);
  assert.equal(host.drawCalls.some((call) => call[0] === 'fillRect'), true);
  assert.equal(host.drawCalls.some((call) => call[0] === 'drawTextLines'), true);
});

test('TutorialCanvasRenderer preserves focused tile action payload for tutorial taps', () => {
  const host = createHost();
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  renderer.renderTutorialHighlight({
    rect: { left: 40, top: 50, width: 90, height: 70 },
    message: 'Pick a tile.',
    allowedAction: { type: 'selectWorldMarchTarget' },
    targetAction: {
      type: 'selectWorldMarchTarget',
      tileId: 'tile_2_2',
      targetQ: 2,
      targetR: 2,
      background: true,
    },
    pulseStartedAt: 900,
  });

  assert.equal(host.hitTargets.filter((target) => target.action.type === 'blockCanvasModal').length, 4);
  const target = host.hitTargets.find((item) => item.action.type === 'selectWorldMarchTarget');
  assert.deepEqual(target.action, {
    type: 'selectWorldMarchTarget',
    tileId: 'tile_2_2',
    targetQ: 2,
    targetR: 2,
  });
});

test('TutorialCanvasRenderer keeps transitioned highlight focus rect clickable', () => {
  const host = createHost();
  const renderer = new TutorialCanvasRenderer({ host, advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } } });

  renderer.renderTutorialHighlight({
    rect: { left: 320, top: 260, width: 80, height: 90 },
    message: 'Focus here.',
    allowedAction: { type: 'openWorldSite', siteId: 'site_5_-6' },
    transition: {
      fromRect: { left: 40, top: 50, width: 90, height: 70 },
      toRect: { left: 320, top: 260, width: 80, height: 90 },
      startedAt: 900,
      durationMs: 260,
    },
    pulseStartedAt: 900,
  });

  const target = host.hitTargets.find((item) => (
    item.action.type === 'openWorldSite'
    && item.action.siteId === 'site_5_-6'
  ));
  assert.deepEqual(
    target.rect,
    { x: 320, y: 260, width: 80, height: 90 },
  );
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

test('TutorialAdvisorCanvasRenderer renders advisor spine through registered clipped layer', () => {
  const calls = [];
  const previousSpinePlayer = global.SpineWebglPlayer;
  const previousDevicePixelRatio = global.devicePixelRatio;
  class FakeSpinePlayer {
    constructor(options) {
      this.status = 'loading';
      this.options = options;
      this.logicalWidth = options.logicalWidth;
      this.logicalHeight = options.logicalHeight;
      calls.push(['construct', options]);
    }

    load(options) {
      calls.push(['load', options]);
      return true;
    }

    getBoundsSummary() {
      return { x: -361, y: -71, width: 772, height: 1718, centerX: 25, centerY: 788, aspectRatio: 772 / 1718 };
    }

    resize() {
      calls.push(['resize', this.logicalWidth, this.logicalHeight]);
    }

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
        const ensureCall = calls.filter((call) => call[0] === 'ensureCanvasLayer').at(-1)
          || calls.filter((call) => call[0] === 'ensureLayerCanvas').at(-1);
        return ensureCall?.[2]?.rect || { width: 390, height: 693 };
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
        ensureCanvasLayer(name, options) {
          calls.push(['ensureCanvasLayer', name, options]);
          return runtime.ensureLayerCanvas(name, options);
        },
        setCanvasLayerVisible(name, visible) {
          calls.push(['setCanvasLayerVisible', name, visible]);
        },
        handleAssetsChanged() {},
      },
    });

    assert.equal(renderer.renderTutorialAdvisorSpineLayer(12, 44, 120, 240), true);

    const ensureCall = calls.find((call) => call[0] === 'ensureCanvasLayer');
    assert.equal(ensureCall[1], 'tutorialSpine');
    assert.deepEqual(ensureCall[2].rect, { x: 12, y: 44, width: 120, height: 240 });
    assert.equal(ensureCall[2].pixelRatio, 2);
    assert.equal(canvas.style.opacity, '1');
    const constructCall = calls.find((call) => call[0] === 'construct');
    const loadCall = calls.find((call) => call[0] === 'load');
    assert.equal('viewFocus' in constructCall[1], false);
    assert.equal('viewFocus' in loadCall[1], false);
    constructCall[1].onBounds({
      bounds: { width: 772, height: 1718, aspectRatio: 772 / 1718 },
    });
    const clippedCall = calls.filter((call) => call[0] === 'ensureCanvasLayer').at(-1);
    assert.deepEqual(clippedCall[2].rect, { x: 18, y: 44, width: 108, height: 240 });
  } finally {
    global.SpineWebglPlayer = previousSpinePlayer;
    global.devicePixelRatio = previousDevicePixelRatio;
  }
});

test('TutorialAdvisorCanvasRenderer refreshes ready spine without invalidating world map caches', () => {
  const calls = [];
  const previousSpinePlayer = global.SpineWebglPlayer;
  class FakeSpinePlayer {
    constructor(options) {
      this.status = 'loading';
      calls.push(['construct', options]);
    }

    load() {
      return true;
    }

    dispose() {}
  }
  FakeSpinePlayer.isAvailable = () => true;
  try {
    global.SpineWebglPlayer = FakeSpinePlayer;
    const canvas = { style: {} };
    const renderer = new TutorialAdvisorCanvasRenderer({
      host: {
        h5Runtime: {
          width: 390,
          height: 693,
          ensureLayerCanvas() {
            return canvas;
          },
          getLayerMetrics() {
            return { width: 120, height: 240 };
          },
          setLayerVisible() {},
        },
        width: 390,
        height: 693,
        handleAssetsChanged() {
          calls.push(['handleAssetsChanged']);
        },
        requestOverlayRenderFrame() {
          calls.push(['requestOverlayRenderFrame']);
        },
      },
    });

    assert.equal(renderer.renderTutorialAdvisorSpineLayer(12, 44, 120, 240), true);
    calls.find((call) => call[0] === 'construct')[1].onStatus({ status: 'ready' });

    assert.equal(calls.some((call) => call[0] === 'requestOverlayRenderFrame'), true);
    assert.equal(calls.some((call) => call[0] === 'handleAssetsChanged'), false);
  } finally {
    global.SpineWebglPlayer = previousSpinePlayer;
  }
});

test('TutorialAdvisorCanvasRenderer never falls back to asset invalidation for ready spine', () => {
  const calls = [];
  const previousSpinePlayer = global.SpineWebglPlayer;
  class FakeSpinePlayer {
    constructor(options) {
      calls.push(['construct', options]);
    }

    load() {
      return true;
    }

    dispose() {}
  }
  FakeSpinePlayer.isAvailable = () => true;
  try {
    global.SpineWebglPlayer = FakeSpinePlayer;
    const renderer = new TutorialAdvisorCanvasRenderer({
      host: {
        h5Runtime: {
          width: 390,
          height: 693,
          ensureLayerCanvas() {
            return { style: {} };
          },
          getLayerMetrics() {
            return { width: 120, height: 240 };
          },
          setLayerVisible() {},
        },
        width: 390,
        height: 693,
        handleAssetsChanged() {
          calls.push(['handleAssetsChanged']);
        },
      },
    });

    assert.equal(renderer.renderTutorialAdvisorSpineLayer(12, 44, 120, 240), true);
    calls.find((call) => call[0] === 'construct')[1].onStatus({ status: 'ready' });

    assert.equal(calls.some((call) => call[0] === 'handleAssetsChanged'), false);
  } finally {
    global.SpineWebglPlayer = previousSpinePlayer;
  }
});

test('TutorialAdvisorCanvasRenderer keeps runtime fallback inside registered spine layer contract', () => {
  const calls = [];
  const previousSpinePlayer = global.SpineWebglPlayer;
  class FakeSpinePlayer {
    constructor(options) {
      this.status = 'loading';
      calls.push(['construct', options]);
    }

    load(options) {
      calls.push(['load', options]);
      return true;
    }

    dispose() {}
  }
  FakeSpinePlayer.isAvailable = () => true;
  try {
    global.SpineWebglPlayer = FakeSpinePlayer;
    const canvas = { style: {} };
    const runtime = {
      width: 390,
      height: 693,
      ensureLayerCanvas(name, options) {
        calls.push(['ensureLayerCanvas', name, options, this === runtime]);
        return canvas;
      },
      getLayerMetrics() {
        return { width: 120, height: 240 };
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
    assert.equal(ensureCall[1], 'tutorialSpine');
    assert.equal(ensureCall[2].zIndex, 1001);
    assert.equal(ensureCall[2].contextType, 'webgl');
    assert.equal(ensureCall[2].pointerEvents, 'none');
    assert.deepEqual(ensureCall[2].rect, { x: 12, y: 44, width: 120, height: 240 });
    assert.equal(ensureCall[3], true);
  } finally {
    global.SpineWebglPlayer = previousSpinePlayer;
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
  assert.equal(calls.some((call) => call[0] === 'drawText' && call[1] === '点击继续'), true);
  assert.ok(calls.findIndex((call) => call[0] === 'portrait') < calls.findIndex((call) => call[0] === 'drawPanel'));
});

test('TutorialAdvisorDialogueRenderer reuses intro spine portrait and closes from dialogue panel', () => {
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

  assert.equal(renderer.renderTutorialAdvisorDialogue(
    '民居已经建立起来了。',
    '谋士',
    { action: { type: 'closeAdvisor', source: 'houseBuilt' } },
  ), false);

  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.hitTargets.some((target) => (
    target.action.type === 'closeAdvisor'
    && target.action.source === 'houseBuilt'
  )), true);
  assert.equal(calls.some((call) => call[0] === 'drawText' && call[1] === '点击继续'), true);
  assert.ok(calls.findIndex((call) => call[0] === 'portrait') < calls.findIndex((call) => call[0] === 'drawPanel'));
  assert.ok(lineCount(path.join(__dirname, 'TutorialAdvisorDialogueRenderer.js')) < 500);
  assert.equal(typeof TutorialAdvisorDialogueRenderer.render, 'function');
});

test('TutorialCanvasRenderer keeps advisor dialogue layer when no intro is active', () => {
  const host = createHost();
  const calls = [];
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: {
      renderTutorialIntroAdvisorPortrait() {
        calls.push(['portrait']);
        return true;
      },
      disposeTutorialAdvisorSpine() {
        calls.push(['disposeSpine']);
        return true;
      },
    },
  });

  renderer.renderTutorialAdvisorDialogue(
    '民居已经建立起来了，族人终于有了稳定的居所。',
    '谋士',
    { action: { type: 'closeAdvisor', source: 'houseBuilt' } },
  );
  const targetsAfterDialogue = host.hitTargets.length;

  assert.equal(renderer.renderTutorialIntro({}, { tutorialIntro: null, tutorialAdvisorDialogue: { source: 'houseBuilt' } }), false);

  assert.equal(calls.some((call) => call[0] === 'disposeSpine'), false);
  assert.equal(host.hitTargets.length, targetsAfterDialogue);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeAdvisor'), true);
});

test('TutorialIntroDialogueLayout owns tuned dialogue and portrait placement', () => {
  const layout = TutorialIntroDialogueLayout.buildDialogueLayout({
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    layout: { contentX: 10, contentWidth: 370, contentRight: 380 },
    dialogueLeft: 96,
  });

  assert.equal(layout.panel.x, 96);
  assert.equal(layout.panel.width, 276);
  assert.ok(layout.portrait.x < layout.panel.x);
  assert.ok(lineCount(path.join(__dirname, 'TutorialIntroDialogueLayout.js')) < 500);
});

test('TutorialDialogueLayer renders above the spine layer and restores host context', () => {
  const calls = [];
  const dialogueCtx = {
    clearRect(...args) { calls.push(['clearRect', ...args]); },
  };
  const canvas = {
    width: 390,
    height: 693,
    getContext(type) {
      calls.push(['getContext', type]);
      return dialogueCtx;
    },
  };
  const runtime = {
    width: 390,
    height: 693,
    ensureLayerCanvas(name, options) {
      calls.push(['ensureLayerCanvas', name, options]);
      return canvas;
    },
    setLayerVisible(name, visible) {
      calls.push(['setLayerVisible', name, visible]);
    },
    getLayerCanvas() {
      return canvas;
    },
    getLayerMetrics() {
      return { width: 390, height: 693 };
    },
  };
  const mainCtx = { main: true };
  const host = { ctx: mainCtx };
  const renderer = { host, h5Runtime: runtime, width: 390, height: 693 };

  assert.equal(TutorialDialogueLayer.begin(renderer), dialogueCtx);
  const ensureCall = calls.find((call) => call[0] === 'ensureLayerCanvas');
  assert.equal(ensureCall[1], 'tutorialDialogue');
  assert.equal(ensureCall[2].zIndex, 1002);
  assert.equal(ensureCall[2].pointerEvents, 'none');
  assert.deepEqual(ensureCall[2].rect, { x: 0, y: 0, width: 390, height: 693 });
  assert.equal(calls.some((call) => call[0] === 'clearRect'), true);
  TutorialDialogueLayer.withHostContext(renderer, dialogueCtx, () => {
    assert.equal(host.ctx, dialogueCtx);
  });
  assert.equal(host.ctx, mainCtx);
  assert.equal(TutorialDialogueLayer.clear(renderer, true), true);
  assert.equal(calls.some((call) => call[0] === 'setLayerVisible' && call[2] === false), true);
  assert.ok(lineCount(path.join(__dirname, 'TutorialDialogueLayer.js')) < 500);
});
