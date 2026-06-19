const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TechCanvasRenderer = require('./TechCanvasRenderer');
const TechTreeLayoutModel = require('./TechTreeLayoutModel');
const TechTreeCanvasRenderer = require('./TechTreeCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

const TECH_DRAWING_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawButton',
  'drawCircle',
  'drawCurvePath',
  'drawLine',
  'drawPanel',
  'drawPrimaryActionButton',
  'drawText',
  'drawTextLines',
  'getLayout',
  'renderSectionHeader',
  'truncateText',
  'withTransformedClip',
  'withTranslatedClip',
  'wrapTextLimit',
];

function createTechView() {
  return {
    text: {
      title: 'Tech',
      subtitle: 'Choose a discovery',
      points: '12 pts',
      researched: '1 done',
      available: '2 open',
      placeholder: 'No tech',
    },
    tree: { nodes: [] },
  };
}

function createTechDetail() {
  return {
    id: 'fire',
    title: 'Fire',
    eraName: 'Stone',
    routeId: 'knowledge',
    routeLabel: 'Knowledge',
    statusLabel: 'Available',
    summary: 'Unlocks cooking and warmth.',
    canResearch: true,
    effectRows: [{ label: 'Unlock', text: 'Campfire' }],
    prerequisiteText: 'None',
    pointsText: '10 pts',
    buttonLabel: 'Research',
    routes: ['knowledge'],
  };
}

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    ctx: {
      globalAlpha: 1,
      fillRect() {},
      measureText(text) {
        return { width: String(text || '').length * 6 };
      },
    },
    presenter: {
      buildTechViewState() {
        return createTechView();
      },
    },
    addHitTarget(_rect, action) {
      calls.push([label, 'addHitTarget', action?.type]);
    },
    createGradient() {
      calls.push([label, 'createGradient']);
      return label;
    },
    drawAsset(assetPath) {
      calls.push([label, 'drawAsset', assetPath]);
      return false;
    },
    drawButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawButton', buttonLabel]);
    },
    drawCircle() {
      calls.push([label, 'drawCircle']);
    },
    drawCurvePath(curve) {
      calls.push([label, 'drawCurvePath', curve]);
    },
    drawLine(...args) {
      calls.push([label, 'drawLine', args]);
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawPrimaryActionButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawPrimaryActionButton', buttonLabel]);
    },
    drawText(text) {
      calls.push([label, 'drawText', text]);
    },
    drawTextLines(lines) {
      calls.push([label, 'drawTextLines', lines]);
    },
    getLayout() {
      calls.push([label, 'getLayout']);
      return { contentX: 10, contentWidth: 360, contentRight: 370 };
    },
    renderSectionHeader(title) {
      calls.push([label, 'renderSectionHeader', title]);
    },
    truncateText(text) {
      calls.push([label, 'truncateText', text]);
      return String(text || '');
    },
    wrapTextLimit(text) {
      calls.push([label, 'wrapTextLimit', text]);
      return [String(text || '')];
    },
    withTransformedClip(_x, _y, _width, _height, panX, panY, zoom, callback) {
      calls.push([label, 'withTransformedClip', panX, panY, zoom]);
      callback?.();
    },
    withTranslatedClip(_x, _y, _width, _height, dx, dy, callback) {
      calls.push([label, 'withTranslatedClip', dx, dy]);
      callback?.();
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

function renderTechSentinelPaths(renderer, fallbackHost) {
  fallbackHost.presenter = createDrawingSurfaceSentinel('presenter').presenter;
  renderer.renderTechInternal({}, 100, 320, {});
  renderer.renderTechNode(
    { id: 'fire', title: 'Fire', route: 'knowledge', routes: ['knowledge', 'culture'] },
    { x: 20, y: 120, width: 96, height: 96, centerX: 68, centerY: 168 },
    { selected: true },
  );
  const detail = createTechDetail();
  renderer.renderTechDetailPanel(detail, 20, 240, 330, 132);
  renderer.renderTechDetailModal(detail);
  renderer.drawCurvePath([{ x: 20, y: 80 }, { x: 80, y: 120 }], { color: '#fff' });
  TechTreeCanvasRenderer.renderTechTreePanel(
    renderer,
    {
      selectedTechId: 'fire',
      tree: {
        eras: [{ era: 1, column: 1, name: 'Era 1' }],
        nodes: [{ id: 'fire', era: 1, route: 'knowledge', tree: { column: 1, row: 1, parents: [] } }],
      },
    },
    { x: 20, y: 80, width: 320, height: 260 },
    {},
  );
}

test('TechCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new TechCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderTechSentinelPaths(renderer, fallbackHost);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), TECH_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('TechCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new TechCanvasRenderer({ host: fallbackHost });

  renderTechSentinelPaths(renderer, fallbackHost);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), TECH_DRAWING_METHODS);
});

test('TechCanvasRenderer reads dynamic host state through explicit getters', () => {
  const firstCtx = {
    globalAlpha: 1,
    fillRect() {},
    measureText(text) {
      return { width: String(text || '').length * 6 };
    },
  };
  const secondCtx = {
    globalAlpha: 1,
    fillRect() {},
    measureText(text) {
      return { width: String(text || '').length * 6 };
    },
  };
  const firstPresenter = createDrawingSurfaceSentinel('first').presenter;
  const secondPresenter = createDrawingSurfaceSentinel('second').presenter;
  const host = {
    width: 390,
    height: 844,
    ctx: firstCtx,
    presenter: firstPresenter,
  };
  const renderer = new TechCanvasRenderer({ host });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.ctx, firstCtx);
  assert.equal(renderer.presenter, firstPresenter);

  host.width = 512;
  host.height = 900;
  host.ctx = secondCtx;
  host.presenter = secondPresenter;

  assert.equal(renderer.width, 512);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.ctx, secondCtx);
  assert.equal(renderer.presenter, secondPresenter);
});

test('TechCanvasRenderer does not proxy unknown host properties', () => {
  const host = {
    width: 390,
    height: 844,
    someRandomProp: 'host-only',
  };
  const renderer = new TechCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('TechCanvasRenderer forwards tech tree scroll state through explicit accessors', () => {
  const host = {
    lastTechTreeScroll: null,
  };
  const renderer = new TechCanvasRenderer({ host });
  const writtenScroll = { panel: { width: 320 } };

  renderer.lastTechTreeScroll = writtenScroll;

  assert.equal(host.lastTechTreeScroll, writtenScroll);

  const hostScroll = { panel: { width: 640 } };
  host.lastTechTreeScroll = hostScroll;

  assert.equal(renderer.lastTechTreeScroll, hostScroll);
});

test('TechTreeLayoutModel owns tech tree layout calculations', () => {
  assert.equal(typeof TechTreeLayoutModel.getTechRouteCatalog, 'function');
  assert.equal(typeof TechTreeLayoutModel.getTechNodeRoutes, 'function');
  assert.equal(typeof TechTreeLayoutModel.getTechTreeLayout, 'function');

  const renderer = new TechCanvasRenderer({ host: {} });
  const layout = renderer.getTechTreeLayout({
    tree: {
      eras: [{ era: 1, column: 1, name: 'Era 1' }],
      nodes: [
        { id: 'fire', era: 1, route: 'knowledge', tree: { column: 1, row: 1, parents: [] } },
        { id: 'writing', era: 1, route: 'culture', tree: { column: 1, row: 2, parents: ['fire'] } },
      ],
    },
  }, { x: 20, y: 80, width: 320, height: 260 }, { techTreeZoom: 1.1, techTreePanX: 999, techTreePanY: 999 });

  assert.equal(layout.nodes.length, 2);
  assert.equal(layout.eraPositions.length, 1);
  assert.ok(layout.nodeRects.fire);
  assert.ok(layout.nodeRects.writing);
  assert.equal(layout.linkPaths.length, 1);
  assert.equal(layout.zoom, 1.1);
  assert.ok(layout.panX <= layout.maxPanX);
  assert.ok(layout.panY <= layout.maxPanY);
});

test('TechTreeCanvasRenderer renders tree hit targets and scroll contract', () => {
  const calls = [];
  const renderer = new TechCanvasRenderer({
    host: {
      lastTechTreeScroll: null,
      ctx: { globalAlpha: 1, fillRect() {} },
      drawPanel(...args) { calls.push(['drawPanel', ...args]); },
      drawLine(...args) { calls.push(['drawLine', ...args]); },
      drawText(...args) { calls.push(['drawText', ...args]); },
      drawCurvePath(...args) { calls.push(['drawCurvePath', ...args]); },
      drawCircle(...args) { calls.push(['drawCircle', ...args]); },
      drawAsset() { return true; },
      truncateText(text) { return text; },
      withTransformedClip(x, y, width, height, panX, panY, zoom, callback) {
        calls.push(['withTransformedClip', panX, panY, zoom]);
        callback();
      },
      withTranslatedClip(x, y, width, height, dx, dy, callback) {
        calls.push(['withTranslatedClip', dx, dy]);
        callback();
      },
      addHitTarget(rect, meta) { calls.push(['hit', rect, meta]); },
    },
  });
  const view = {
    selectedTechId: 'fire',
    tree: {
      eras: [{ era: 1, column: 1, name: 'Era 1' }],
      nodes: [{ id: 'fire', era: 1, route: 'knowledge', tree: { column: 1, row: 1, parents: [] } }],
    },
  };

  const result = TechTreeCanvasRenderer.renderTechTreePanel(renderer, view, { x: 20, y: 80, width: 320, height: 260 }, {});

  assert.equal(result.renderedCards, 1);
  assert.equal(renderer.host.lastTechTreeScroll.panel.width, 320);
  assert.ok(calls.some((call) => call[0] === 'withTransformedClip'));
  assert.ok(calls.some((call) => call[0] === 'hit' && call[2].type === 'selectTechNode'));
  assert.ok(calls.some((call) => call[0] === 'hit' && call[2].type === 'techTreeDrag'));
});

test('CanvasGameRenderer owns a tech renderer and routes renderTech through it', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    techRendererClass: class {
      constructor(options) {
        this.host = options.host;
      }

      render(state, startY, panelHeight, options) {
        return { host: this.host, state, startY, panelHeight, options };
      }
    },
  });
  const state = { techs: {} };
  const options = { selectedTechId: 'fire' };
  const result = renderer.renderTech(state, 120, 240, options);

  assert.equal(result.host, renderer);
  assert.equal(result.state, state);
  assert.equal(result.startY, 120);
  assert.equal(result.panelHeight, 240);
  assert.equal(result.options, options);
  assert.equal(typeof renderer.renderTechInternal, 'function');
});

test('CanvasGameRenderer exposes tech tree layout through the tech renderer facade', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    techRendererClass: TechCanvasRenderer,
  });

  const layout = renderer.getTechTreeLayout({
    tree: {
      eras: [{ era: 1, column: 1, name: 'Era 1' }],
      nodes: [{ id: 'fire', era: 1, route: 'knowledge', tree: { column: 1, row: 1, parents: [] } }],
    },
  }, { x: 20, y: 80, width: 320, height: 260 }, {});

  assert.equal(layout.nodes.length, 1);
  assert.ok(layout.nodeRects.fire);
});

test('CanvasGameRenderer gives split renderers the unbound presenter object', () => {
  class StaticPresenter {
    static buildTechViewState() {
      return { tree: { nodes: [] } };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: StaticPresenter,
    techRendererClass: TechCanvasRenderer,
  });

  assert.equal(renderer.techRenderer.presenter, StaticPresenter);
  assert.equal(typeof renderer.techRenderer.presenter.buildTechViewState, 'function');

  const replacementPresenter = {
    buildTechViewState() {
      return { tree: { nodes: [] } };
    },
  };
  renderer.setPresenter(replacementPresenter);

  assert.equal(renderer.techRenderer.presenter, replacementPresenter);
  assert.equal(typeof renderer.techRenderer.presenter.buildTechViewState, 'function');
});

test('frontend loads tech tree helpers before the tech canvas renderer', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'index.html'), 'utf8');
  const layoutIndex = html.indexOf('TechTreeLayoutModel.js');
  const treeRendererIndex = html.indexOf('TechTreeCanvasRenderer.js');
  const rendererIndex = html.indexOf('TechCanvasRenderer.js');

  assert.ok(layoutIndex > 0);
  assert.ok(treeRendererIndex > layoutIndex);
  assert.ok(rendererIndex > treeRendererIndex);
});
