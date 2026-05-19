const test = require('node:test');
const assert = require('node:assert/strict');

const LogModalAdapter = require('../js/ui/LogModalAdapter');

function createClassList() {
  const classes = new Set();
  return {
    add(name) { classes.add(name); },
    remove(name) { classes.delete(name); },
    contains(name) { return classes.has(name); },
  };
}

test('log modal adapter owns H5 modal content and visibility writes', async () => {
  const modal = { style: {}, classList: createClassList(), listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } };
  const content = { innerHTML: '' };
  const closeButton = { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } };
  const trigger = { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } };
  const adapter = new LogModalAdapter({ trigger, modal, content, closeButton, activateDelayMs: 0 });

  adapter.open('<div>日志</div>');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(content.innerHTML, '<div>日志</div>');
  assert.equal(modal.style.display, 'flex');
  assert.equal(modal.classList.contains('active'), true);

  adapter.close();

  assert.equal(modal.style.display, 'none');
  assert.equal(modal.classList.contains('active'), false);

  const calls = [];
  adapter.bindClose(() => calls.push('close'));
  modal.listeners.click({ target: modal });
  closeButton.listeners.click();
  assert.deepEqual(calls, ['close', 'close']);

  adapter.bindOpen(() => calls.push('open'));
  trigger.listeners.click();
  assert.deepEqual(calls, ['close', 'close', 'open']);
});

test('log modal adapter can collect its H5 nodes from document', () => {
  const nodes = {
    logButton: {},
    logModal: { style: {}, classList: createClassList() },
    logModalContent: { innerHTML: '' },
    btnCloseLogModal: {},
  };
  const adapter = LogModalAdapter.fromDocument({
    getElementById(id) {
      return nodes[id];
    },
  }, { activateDelayMs: 0 });

  assert.equal(adapter.trigger, nodes.logButton);
  assert.equal(adapter.modal, nodes.logModal);
  assert.equal(adapter.content, nodes.logModalContent);
  assert.equal(adapter.closeButton, nodes.btnCloseLogModal);
  assert.equal(adapter.activateDelayMs, 0);
});
