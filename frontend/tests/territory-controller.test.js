const assert = require('node:assert/strict');
const test = require('node:test');

const TerritoryController = require('../js/controllers/TerritoryController');

function createClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
  };
}

test('world site click opens the matching detail dialog', () => {
  const handlers = {};
  let renderCount = 0;
  const container = {
    dataset: {},
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    querySelector() { return null; },
  };

  const controller = new TerritoryController({
    container,
    onRenderRequested: () => { renderCount += 1; },
  });
  controller.bind();

  handlers.click({
    target: {
      closest(selector) {
        if (selector === '[data-site-id]') return { dataset: { siteId: 'site-east' } };
        return null;
      },
      matches() {
        return false;
      },
    },
  });

  assert.equal(controller.getUiState().selectedSiteId, 'site-east');
  assert.equal(container.dataset.selectedSiteId, undefined);
  assert.equal(renderCount, 1);
});

test('world reset recenters the radar pan', () => {
  const panStyle = new Map();
  const pan = {
    style: {
      setProperty(name, value) {
        panStyle.set(name, value);
      },
    },
  };
  const container = {
    dataset: {},
    querySelector(selector) {
      if (selector === '[data-world-pan]') return pan;
      return null;
    },
  };

  const controller = new TerritoryController({ container, uiState: { worldPanX: 80, worldPanY: -30 } });
  controller.resetWorldPan();

  assert.equal(controller.getUiState().worldPanX, 0);
  assert.equal(controller.getUiState().worldPanY, 0);
  assert.equal(container.dataset.worldPanX, undefined);
  assert.equal(container.dataset.worldPanY, undefined);
  assert.equal(panStyle.get('--world-pan-x'), '0px');
  assert.equal(panStyle.get('--world-pan-y'), '0px');
});

test('world site dialog close clears the persisted selected site', () => {
  let renderCount = 0;
  const container = {
    dataset: {},
    querySelector() { return null; },
  };

  const controller = new TerritoryController({
    container,
    uiState: { selectedSiteId: 'site-east', expeditionConfigSiteId: 'site-east', expeditionSoldiers: '4' },
    onRenderRequested: () => { renderCount += 1; },
  });
  controller.closeSiteDialog();

  assert.equal(controller.getUiState().selectedSiteId, '');
  assert.equal(controller.getUiState().expeditionConfigSiteId, '');
  assert.equal(container.dataset.selectedSiteId, undefined);
  assert.equal(renderCount, 1);
});
