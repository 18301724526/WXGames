const test = require('node:test');
const assert = require('node:assert/strict');

const TerritoryActionAdapter = require('../js/ui/TerritoryActionAdapter');

function createClassList() {
  const values = new Set();
  return {
    add(name) { values.add(name); },
    remove(name) { values.delete(name); },
    contains(name) { return values.has(name); },
  };
}

function createContainer() {
  const handlers = {};
  return {
    handlers,
    dataset: {},
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    querySelector() {
      return null;
    },
  };
}

test('territory action adapter owns H5 world clicks and loading state', () => {
  const container = createContainer();
  const scoutContainer = createContainer();
  const adapter = new TerritoryActionAdapter({ container, scoutContainer });
  const calls = [];
  const actionButton = {
    disabled: false,
    dataset: { territoryId: 'site-east', territoryAction: 'claim' },
    classList: createClassList(),
  };

  adapter.bind({
    onOpenSite: (siteId) => calls.push(['open', siteId]),
    onCloseSite: () => calls.push(['close']),
    onResetWorldPan: () => calls.push(['reset']),
    onTerritoryAction: (action) => calls.push(['action', action]),
  });

  container.handlers.click({
    target: {
      closest(selector) {
        if (selector === '[data-site-id]') return { dataset: { siteId: 'site-east' } };
        return null;
      },
      matches() { return false; },
    },
  });
  container.handlers.click({
    target: {
      closest(selector) {
        if (selector === '[data-world-reset]') return {};
        return null;
      },
      matches() { return false; },
    },
  });
  container.handlers.click({
    target: {
      closest(selector) {
        if (selector === '[data-territory-action]') return actionButton;
        return null;
      },
      matches() { return false; },
    },
  });

  assert.equal(container.dataset.bound, 'true');
  assert.deepEqual(calls[0], ['open', 'site-east']);
  assert.deepEqual(calls[1], ['reset']);
  assert.equal(calls[2][0], 'action');
  assert.equal(calls[2][1].territoryId, 'site-east');
  assert.equal(calls[2][1].action, 'claim');
  assert.equal(calls[2][1].button, actionButton);

  adapter.setLoading(actionButton, true);
  assert.equal(actionButton.disabled, true);
  assert.equal(actionButton.classList.contains('is-loading'), true);
  adapter.setLoading(actionButton, false);
  assert.equal(actionButton.disabled, false);
  assert.equal(actionButton.classList.contains('is-loading'), false);
});

test('territory action adapter owns scout actions and radar drag shell', () => {
  const container = createContainer();
  const scoutContainer = createContainer();
  const adapter = new TerritoryActionAdapter({ container, scoutContainer });
  const calls = [];
  const scoutButton = {
    disabled: false,
    dataset: { scoutDirection: 'n' },
  };
  const radar = {
    classList: createClassList(),
    setPointerCapture(id) { calls.push(['capture', id]); },
    releasePointerCapture(id) { calls.push(['release', id]); },
  };

  container.querySelector = (selector) => (selector === '[data-world-radar]' ? radar : null);

  adapter.bind({
    onScoutAction: (action) => calls.push(['scout', action]),
    onWorldDragStart: (pointer) => calls.push(['start', pointer.pointerId, pointer.clientX, pointer.clientY]),
    onWorldDragMove: (pointer) => calls.push(['move', pointer.pointerId, pointer.clientX, pointer.clientY]),
    onWorldDragEnd: (pointer) => calls.push(['end', pointer.pointerId]),
  });

  scoutContainer.handlers.click({
    target: {
      closest() { return scoutButton; },
    },
  });
  container.handlers.pointerdown({
    pointerId: 7,
    clientX: 10,
    clientY: 20,
    target: {
      closest(selector) {
        if (selector === '[data-world-radar]') return radar;
        return null;
      },
    },
  });
  container.handlers.pointermove({ pointerId: 7, clientX: 12, clientY: 24 });
  container.handlers.pointerup({
    pointerId: 7,
    clientX: 12,
    clientY: 24,
    target: {
      closest() { return null; },
    },
  });

  assert.equal(calls[0][0], 'scout');
  assert.equal(calls[0][1].direction, 'n');
  assert.deepEqual(calls[1], ['capture', 7]);
  assert.deepEqual(calls[2], ['start', 7, 10, 20]);
  assert.deepEqual(calls[3], ['move', 7, 12, 24]);
  assert.deepEqual(calls[4], ['release', 7]);
  assert.deepEqual(calls[5], ['end', 7]);
  assert.equal(radar.classList.contains('is-dragging'), false);
});
