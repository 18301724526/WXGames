const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasPanelActionRegistry = require('./CanvasPanelActionRegistry');

test('CanvasPanelActionRegistry is descriptor-only for famous actions', () => {
  const descriptor = CanvasPanelActionRegistry.resolve({ type: 'openFamousPersons' });

  assert.equal(descriptor.panelKey, 'famousPersons');
  assert.equal(descriptor.operation, 'open');
  assert.deepEqual(descriptor.dirty, ['modal']);
  assert.equal(typeof descriptor.run, 'undefined');
  assert.equal(CanvasPanelActionRegistry.has({ type: 'openFamousPersons' }), true);
  assert.equal(CanvasPanelActionRegistry.has({ type: 'unknown' }), false);
});

test('CanvasPanelActionRegistry exposes stable supported actions and injection', () => {
  assert.equal(CanvasPanelActionRegistry.supportedActions().includes('closeFamousPersons'), true);
  assert.equal(CanvasPanelActionRegistry.supportedActions().includes('panelOutsideClick'), true);

  assert.equal(CanvasPanelActionRegistry.register('testPanel', {
    type: 'openTestPanel',
    operation: 'open',
    dirty: ['modal'],
  }), true);
  assert.equal(CanvasPanelActionRegistry.resolve({ type: 'openTestPanel' }).panelKey, 'testPanel');
});

