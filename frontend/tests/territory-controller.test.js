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
  const details = [
    { dataset: { siteDetail: 'capital' }, hidden: true },
    { dataset: { siteDetail: 'site-east' }, hidden: true },
  ];
  const modal = {
    classList: createClassList(),
    querySelectorAll(selector) {
      return selector === '[data-site-detail]' ? details : [];
    },
  };
  const container = {
    dataset: {},
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    querySelector(selector) {
      if (selector === '[data-world-site-modal]') return modal;
      return null;
    },
  };

  const controller = new TerritoryController({ container });
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

  assert.equal(modal.classList.contains('show'), true);
  assert.equal(container.dataset.selectedSiteId, 'site-east');
  assert.equal(details[0].hidden, true);
  assert.equal(details[1].hidden, false);
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
    dataset: { worldPanX: '80', worldPanY: '-30' },
    querySelector(selector) {
      if (selector === '[data-world-pan]') return pan;
      return null;
    },
  };

  const controller = new TerritoryController({ container });
  controller.resetWorldPan();

  assert.equal(container.dataset.worldPanX, '0');
  assert.equal(container.dataset.worldPanY, '0');
  assert.equal(panStyle.get('--world-pan-x'), '0px');
  assert.equal(panStyle.get('--world-pan-y'), '0px');
});

test('world site dialog close clears the persisted selected site', () => {
  const modal = { classList: createClassList() };
  modal.classList.add('show');
  const container = {
    dataset: { selectedSiteId: 'site-east' },
    querySelector(selector) {
      if (selector === '[data-world-site-modal]') return modal;
      return null;
    },
  };

  const controller = new TerritoryController({ container });
  controller.closeSiteDialog();

  assert.equal(container.dataset.selectedSiteId, undefined);
  assert.equal(modal.classList.contains('show'), false);
});

test('radar animation phase is persisted across rerenders', () => {
  const originalNow = Date.now;
  let now = 100000;
  Date.now = () => now;
  const styleValues = new Map();
  const radar = {
    style: {
      setProperty(name, value) {
        styleValues.set(name, value);
      },
    },
  };
  const container = {
    dataset: {},
    querySelector(selector) {
      if (selector === '[data-world-radar]') return radar;
      return null;
    },
  };

  try {
    const controller = new TerritoryController({ container });
    now = 103250;
    controller.updateRadarPhase();

    assert.equal(container.dataset.radarStartedAt, '100000');
    assert.equal(container.dataset.radarPhase, '-3250');
    assert.equal(styleValues.get('--radar-phase'), '-3250ms');
  } finally {
    Date.now = originalNow;
  }
});
