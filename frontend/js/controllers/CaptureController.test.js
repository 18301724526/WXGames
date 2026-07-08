const test = require('node:test');
const assert = require('node:assert/strict');

const CaptureController = require('./CaptureController');

function makeController(overrides = {}) {
  const state = {
    captureDecisions: [{ id: 'cap_1', status: 'pending', captive: { id: 'df_1', name: '林烈' } }],
  };
  const calls = { applied: [], floating: [] };
  const api = {
    resolveCapture: async (decisionId, choice) => ({ success: true, outcome: { kind: choice === 'recruit' ? 'recruited' : 'executed' }, decisionId }),
  };
  const controller = new CaptureController({
    api,
    getState: () => state,
    onStateApplied: (r) => calls.applied.push(r),
    onFloatingText: (t) => calls.floating.push(t),
    ...overrides,
  });
  return { controller, state, calls };
}

test('open auto-selects the first pending decision; close clears it', () => {
  const { controller } = makeController();
  const d = controller.open();
  assert.equal(d.id, 'cap_1');
  assert.equal(controller.isOpen(), true);
  controller.close();
  assert.equal(controller.isOpen(), false);
});

test('open(id) returns null for an unknown or non-pending decision', () => {
  const { controller } = makeController();
  assert.equal(controller.open('nope'), null);
  assert.equal(controller.isOpen(), false);
});

test('resolve calls the API, applies state, floats the outcome, and closes', async () => {
  const { controller, calls } = makeController();
  controller.open();
  const result = await controller.resolve('cap_1', 'recruit');
  assert.equal(result.outcome.kind, 'recruited');
  assert.equal(calls.applied.length, 1);
  assert.equal(calls.floating.length, 1); // localized outcome text
  assert.equal(controller.isOpen(), false);
});

test('resolve is a no-op without an id or choice', async () => {
  const { controller } = makeController();
  assert.equal(await controller.resolve(null, 'recruit'), false);
  assert.equal(await controller.resolve('cap_1', null), false);
});

test('resolve logs and returns false on an API error', async () => {
  const logs = [];
  const { controller } = makeController({
    api: { resolveCapture: async () => { throw new Error('boom'); } },
    onLog: (m) => logs.push(m),
  });
  const r = await controller.resolve('cap_1', 'execute');
  assert.equal(r, false);
  assert.equal(logs.length, 1);
});
