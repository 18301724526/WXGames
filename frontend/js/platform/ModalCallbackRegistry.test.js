const test = require('node:test');
const assert = require('node:assert/strict');

const { createModalCallbackRegistry } = require('./ModalCallbackRegistry');

test('register/resolve invokes the matching continuation by token + action', () => {
  const registry = createModalCallbackRegistry();
  let confirmed = 0;
  registry.register('modal:confirmDialog#1', { onConfirm: (n) => (confirmed += n) });
  assert.equal(registry.has('modal:confirmDialog#1'), true);
  registry.resolve('modal:confirmDialog#1', 'onConfirm', 5);
  assert.equal(confirmed, 5);
});

test('resolve is inert for unknown token or missing action', () => {
  const registry = createModalCallbackRegistry();
  registry.register('t1', { onConfirm: () => 'x' });
  assert.equal(registry.resolve('missing', 'onConfirm'), undefined);
  assert.equal(registry.resolve('t1', 'onCancel'), undefined);
});

test('clear removes a registered token', () => {
  const registry = createModalCallbackRegistry();
  registry.register('t1', { onConfirm: () => {} });
  assert.equal(registry.size(), 1);
  assert.equal(registry.clear('t1'), true);
  assert.equal(registry.has('t1'), false);
  assert.equal(registry.size(), 0);
});

test('register ignores an empty token', () => {
  const registry = createModalCallbackRegistry();
  assert.equal(registry.register('', { onConfirm: () => {} }), false);
  assert.equal(registry.size(), 0);
});
