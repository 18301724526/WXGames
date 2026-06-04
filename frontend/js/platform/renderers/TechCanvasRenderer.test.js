const test = require('node:test');
const assert = require('node:assert/strict');

const TechCanvasRenderer = require('./TechCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

test('TechCanvasRenderer delegates rendering to the host tech implementation', () => {
  const calls = [];
  const host = {
    renderTechInternal(state, startY, panelHeight, options) {
      calls.push({ state, startY, panelHeight, options });
      return 'rendered';
    },
  };

  const renderer = new TechCanvasRenderer({ host });
  const state = { techs: {} };
  const options = { techTreeZoom: 1.2 };

  assert.equal(renderer.render(state, 100, 300, options), 'rendered');
  assert.deepEqual(calls, [{ state, startY: 100, panelHeight: 300, options }]);
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
