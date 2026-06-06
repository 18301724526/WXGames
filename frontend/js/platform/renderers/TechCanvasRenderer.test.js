const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TechCanvasRenderer = require('./TechCanvasRenderer');
const TechTreeLayoutModel = require('./TechTreeLayoutModel');
const TechTreeCanvasRenderer = require('./TechTreeCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

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
