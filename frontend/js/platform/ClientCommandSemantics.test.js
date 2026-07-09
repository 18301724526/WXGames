const test = require('node:test');
const assert = require('node:assert/strict');

const ClientCommandSemantics = require('./ClientCommandSemantics');
const CanvasActionController = require('./CanvasActionController');

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

test('ClientCommandSemantics permits only the four local command block reasons', () => {
  ClientCommandSemantics.LOCAL_BLOCK_REASONS.forEach((reason) => {
    assert.equal(ClientCommandSemantics.getCommandBlockReason({ type: 'research', commandDisabled: reason }), reason);
  });
  ['RESOURCES', 'TUTORIAL', 'ERA', 'TECH', 'COOLDOWN', 'MARCH', 'CANDIDATE', 'TERRITORY', 'REWARD', 'ENCOUNTER', 'LOOT', 'BOSS'].forEach((reason) => {
    assert.equal(ClientCommandSemantics.getCommandBlockReason({ type: 'research', commandDisabled: reason }), '');
  });
});

test('ClientCommandSemantics builds stable command keys from command identity', () => {
  assert.equal(
    ClientCommandSemantics.getCommandKey({ type: 'research', techId: 'writing' }),
    'research:writing',
  );
  assert.equal(
    ClientCommandSemantics.getCommandKey({ type: 'research', commandId: 'cmd-7', techId: 'writing' }),
    'cmd-7',
  );
});

test('CanvasActionController records allowed local blocks before handler dispatch', () => {
  const previousLog = global.ClientOperationLog;
  const records = [];
  global.ClientOperationLog = {
    record(event, detail) { records.push([event, detail]); },
  };
  try {
    const controller = Object.create(CanvasActionController.prototype);
    controller.resolveActionHandler = () => {
      throw new Error('handler must not run');
    };

    assert.equal(controller.handle({
      type: 'research',
      techId: 'writing',
      commandDisabled: 'UI_NOT_READY',
    }), true);
    assert.deepEqual(records, [[
      'command:localBlock',
      { commandType: 'research', commandKey: 'research:writing', reason: 'UI_NOT_READY' },
    ]]);
  } finally {
    global.ClientOperationLog = previousLog;
  }
});
