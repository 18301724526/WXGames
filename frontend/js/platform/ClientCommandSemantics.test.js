const test = require('node:test');
const assert = require('node:assert/strict');

const ClientCommandSemantics = require('./ClientCommandSemantics');

test('ClientCommandSemantics splits visual disabled from command disabled', () => {
  const action = ClientCommandSemantics.normalizeAction({ type: 'research', techId: 'tech-1', disabled: true });

  assert.deepEqual(action, { type: 'research', techId: 'tech-1', visualDisabled: true });
  assert.equal(ClientCommandSemantics.isVisualDisabled(action), true);
  assert.equal(ClientCommandSemantics.isCommandDisabled(action), false);
});

test('ClientCommandSemantics leaves non-command disabled behavior unchanged', () => {
  const action = { type: 'openFamousPersons', disabled: true };

  assert.equal(ClientCommandSemantics.normalizeAction(action), action);
  assert.equal(ClientCommandSemantics.isVisualDisabled(action), false);
});
