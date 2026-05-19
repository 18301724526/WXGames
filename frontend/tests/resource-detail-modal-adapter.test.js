const test = require('node:test');
const assert = require('node:assert/strict');

const ResourceDetailModalAdapter = require('../js/ui/ResourceDetailModalAdapter');

function createClassList() {
  const classes = new Set();
  return {
    add(name) { classes.add(name); },
    remove(name) { classes.delete(name); },
    contains(name) { return classes.has(name); },
  };
}

function createElement() {
  return {
    listeners: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

test('resource detail modal adapter owns H5 open and close interactions', () => {
  const trigger = createElement();
  const modal = createElement();
  const closeButton = createElement();
  const adapter = new ResourceDetailModalAdapter({ trigger, modal, closeButton });
  const calls = [];

  adapter.bind({
    onOpen: () => calls.push('open'),
    onClose: () => calls.push('close'),
  });
  trigger.listeners.click();
  modal.listeners.click({ target: modal });
  closeButton.listeners.click();

  assert.deepEqual(calls, ['open', 'close', 'close']);

  adapter.open();
  assert.equal(modal.classList.contains('show'), true);
  adapter.close();
  assert.equal(modal.classList.contains('show'), false);
});
