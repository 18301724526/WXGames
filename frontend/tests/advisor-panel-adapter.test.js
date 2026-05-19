const test = require('node:test');
const assert = require('node:assert/strict');

const AdvisorPanelAdapter = require('../js/ui/AdvisorPanelAdapter');

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
    hidden: false,
    disabled: false,
    textContent: '',
    listeners: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

test('advisor panel adapter renders advice and owns H5 modal interactions', () => {
  const button = createElement();
  const modal = createElement();
  const message = createElement();
  const goButton = createElement();
  const closeButton = createElement();
  const dismissButton = createElement();
  const adapter = new AdvisorPanelAdapter({
    button,
    modal,
    message,
    goButton,
    closeButton,
    dismissButton,
  });
  const calls = [];

  adapter.render({
    hidden: false,
    text: { message: 'Scout north' },
    goButton: { disabled: false },
  });
  assert.equal(button.hidden, false);
  assert.equal(message.textContent, 'Scout north');
  assert.equal(goButton.disabled, false);

  adapter.bind({
    onOpen: () => calls.push('open'),
    onClose: () => calls.push('close'),
    onGo: () => calls.push('go'),
  });
  button.listeners.click();
  modal.listeners.click({ target: modal });
  closeButton.listeners.click();
  dismissButton.listeners.click();
  goButton.listeners.click();
  assert.deepEqual(calls, ['open', 'close', 'close', 'close', 'go']);

  adapter.open();
  assert.equal(modal.classList.contains('show'), true);
  adapter.render({ hidden: true, text: { message: '' }, goButton: { disabled: true }, closeModal: true });
  assert.equal(button.hidden, true);
  assert.equal(goButton.disabled, true);
  assert.equal(modal.classList.contains('show'), false);
});
