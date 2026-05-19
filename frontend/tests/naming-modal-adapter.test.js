const test = require('node:test');
const assert = require('node:assert/strict');

const NamingModalAdapter = require('../js/ui/NamingModalAdapter');

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
    textContent: '',
    value: '',
    placeholder: '',
    disabled: false,
    focused: false,
    listeners: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    focus() {
      this.focused = true;
    },
  };
}

test('naming modal adapter owns H5 prompt writes and submit state', () => {
  const modal = createElement();
  const title = createElement();
  const message = createElement();
  const input = createElement();
  const submitButton = createElement();
  const closeButton = createElement();
  const adapter = new NamingModalAdapter({
    modal,
    title,
    message,
    input,
    submitButton,
    closeButton,
  });
  const calls = [];

  adapter.open({ title: 'Rename', message: 'Name it', placeholder: 'Capital' });
  assert.equal(title.textContent, 'Rename');
  assert.equal(message.textContent, 'Name it');
  assert.equal(input.placeholder, 'Capital');
  assert.equal(input.focused, true);
  assert.equal(modal.classList.contains('show'), true);

  input.value = '  River City  ';
  assert.equal(adapter.getName(), 'River City');
  adapter.setSubmitting(true);
  assert.equal(submitButton.disabled, true);

  adapter.bind({
    onClose: () => calls.push('close'),
    onSubmit: () => calls.push('submit'),
  });
  modal.listeners.click({ target: modal });
  closeButton.listeners.click();
  submitButton.listeners.click();
  assert.deepEqual(calls, ['close', 'close', 'submit']);

  adapter.close();
  assert.equal(modal.classList.contains('show'), false);
});
