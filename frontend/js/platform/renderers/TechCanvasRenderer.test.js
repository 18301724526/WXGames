const test = require('node:test');
const assert = require('node:assert/strict');

const TechCanvasRenderer = require('./TechCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

test('TechCanvasRenderer owns tech tree layout calculations', () => {
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
