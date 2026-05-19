const test = require('node:test');
const assert = require('node:assert/strict');

const BuildingActionAdapter = require('../js/ui/BuildingActionAdapter');

function createClassList() {
  const values = new Set();
  return {
    add(name) { values.add(name); },
    remove(name) { values.delete(name); },
    contains(name) { return values.has(name); },
  };
}

test('building action adapter owns H5 click parsing and loading state', () => {
  const handlers = {};
  const container = {
    dataset: {},
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
  };
  const button = {
    disabled: false,
    dataset: { buildingId: 'farm', action: 'build' },
    classList: createClassList(),
  };
  const adapter = new BuildingActionAdapter({ container });
  const calls = [];

  adapter.bindClick((action) => calls.push(action));
  handlers.click({
    target: {
      closest: () => button,
    },
  });

  assert.equal(container.dataset.bound, 'true');
  assert.equal(calls[0].buildingId, 'farm');
  assert.equal(calls[0].action, 'build');
  assert.equal(calls[0].button, button);

  adapter.setLoading(button, true);
  assert.equal(button.disabled, true);
  assert.equal(button.classList.contains('is-loading'), true);
  adapter.setLoading(button, false);
  assert.equal(button.disabled, false);
  assert.equal(button.classList.contains('is-loading'), false);
});
