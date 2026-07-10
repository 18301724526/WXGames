const test = require('node:test');
const assert = require('node:assert/strict');

const ClientCommandSender = require('./ClientCommandSender');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('ClientCommandSender creates stable envelope identifiers and canonical command keys', async () => {
  const calls = [];
  const sender = new ClientCommandSender({
    createIdSeed: () => 'seed-1',
    transport: async (envelope, options) => {
      calls.push([envelope, options.commandKey]);
      return { success: true };
    },
  });

  await sender.submit('research', { nested: { b: 2, a: 1 }, techId: 'writing' });

  assert.equal(calls[0][0].schema, 'game-command-v1');
  assert.equal(calls[0][0].type, 'research');
  assert.equal(calls[0][0].commandId, 'cmd-seed-1');
  assert.equal(calls[0][0].idempotencyKey, 'idem-seed-1');
  assert.equal(calls[0][0].trace.schema, 'client-action-trace-v1');
  assert.equal(calls[0][0].trace.actionType, 'research');
  assert.equal(calls[0][0].client.clientSequence, 1);
  assert.equal(
    sender.buildCommandKey('research', { nested: { a: 1, b: 2 }, techId: 'writing' }),
    calls[0][1],
  );
  assert.equal(
    sender.buildCommandKey('research', { techId: 'writing', clientInputIntent: { inputId: 'tap-1' } }),
    sender.buildCommandKey('research', { techId: 'writing', clientInputIntent: { inputId: 'tap-2' } }),
  );
});

test('ClientCommandSender keeps trace metadata out of canonical command keys', async () => {
  const calls = [];
  const sender = new ClientCommandSender({
    createIdSeed: ({ sequence }) => `trace-seed-${sequence}`,
    transport: async (envelope, options) => {
      calls.push({ envelope, commandKey: options.commandKey });
      return { success: true };
    },
  });

  await sender.submit('build', { buildingId: 'farm' }, {
    trace: {
      clientActionTraceId: 'cat-build-a',
      sourceSurface: 'canvas',
      hitTargetId: 'farm',
      actionType: 'buildBuilding',
      actionDescriptorId: 'building.build',
      visualDisabled: true,
    },
  });
  await sender.submit('build', { buildingId: 'farm' }, {
    trace: {
      clientActionTraceId: 'cat-build-b',
      sourceSurface: 'sidebar',
      hitTargetId: 'farm',
      actionType: 'buildBuilding',
      actionDescriptorId: 'building.build',
      visualDisabled: false,
    },
  });

  assert.equal(calls[0].commandKey, calls[1].commandKey);
  assert.notEqual(calls[0].envelope.trace.clientActionTraceId, calls[1].envelope.trace.clientActionTraceId);
  assert.deepEqual(calls.map(({ envelope }) => envelope.payload), [
    { buildingId: 'farm' },
    { buildingId: 'farm' },
  ]);
});

test('ClientCommandSender blocks duplicate transport only while a command key is in flight', async () => {
  const gate = deferred();
  const records = [];
  let transportCalls = 0;
  const sender = new ClientCommandSender({
    createIdSeed: ({ sequence }) => `seed-${sequence}`,
    operationLog: {
      record(type, detail) { records.push([type, detail]); },
    },
    transport: async () => {
      transportCalls += 1;
      return gate.promise;
    },
  });

  const first = sender.submit('advanceEra', {}, { commandKey: 'advanceEra:player-1' });
  await assert.rejects(
    () => sender.submit('advanceEra', {}, { commandKey: 'advanceEra:player-1' }),
    (error) => error.localBlockReason === 'IN_FLIGHT' && error.commandKey === 'advanceEra:player-1',
  );
  assert.equal(transportCalls, 1);
  assert.deepEqual(records, [[
    'command:localBlock',
    { commandType: 'advanceEra', commandKey: 'advanceEra:player-1', reason: 'IN_FLIGHT' },
  ]]);

  gate.resolve({ success: true });
  await first;
  const second = await sender.submit('advanceEra', {}, { commandKey: 'advanceEra:player-1' });
  assert.deepEqual(second, { success: true });
  assert.equal(transportCalls, 2);
});

test('ClientCommandSender releases in-flight state for every terminal transport outcome', async (t) => {
  const outcomes = [
    ['success', { value: { success: true } }],
    ['domain rejection', { error: Object.assign(new Error('domain'), { status: 400 }) }],
    ['busy', { error: Object.assign(new Error('busy'), { status: 409 }) }],
    ['rate limit', { error: Object.assign(new Error('rate limit'), { status: 429 }) }],
    ['queued', { value: { status: 202, queued: true } }],
    ['idempotent replay', { value: { status: 200, idempotentReplay: true } }],
    ['final timeout', { error: Object.assign(new Error('timeout'), { code: 'GAME_API_TIMEOUT' }) }],
  ];

  for (const [name, outcome] of outcomes) {
    await t.test(name, async () => {
      let calls = 0;
      const sender = new ClientCommandSender({
        createIdSeed: ({ sequence }) => `${name.replace(/\s+/g, '-')}-${sequence}`,
        transport: async () => {
          calls += 1;
          if (outcome.error) throw outcome.error;
          return outcome.value;
        },
      });
      const options = { commandKey: `build:${name}` };
      if (outcome.error) await assert.rejects(() => sender.submit('build', { buildingId: 'farm' }, options));
      else await sender.submit('build', { buildingId: 'farm' }, options);
      assert.equal(sender.isInFlight(options.commandKey), false);

      if (outcome.error) await assert.rejects(() => sender.submit('build', { buildingId: 'farm' }, options));
      else await sender.submit('build', { buildingId: 'farm' }, options);
      assert.equal(calls, 2);
    });
  }
});

test('ClientCommandSender rejects one command id used by two simultaneous command keys', async () => {
  const gate = deferred();
  const sender = new ClientCommandSender({ transport: () => gate.promise });
  const first = sender.submit('build', { buildingId: 'farm' }, {
    commandKey: 'build:farm',
    commandId: 'cmd-fixed',
    idempotencyKey: 'idem-fixed',
  });

  await assert.rejects(
    () => sender.submit('upgrade', { buildingId: 'farm' }, {
      commandKey: 'upgrade:farm',
      commandId: 'cmd-fixed',
      idempotencyKey: 'idem-fixed',
    }),
    (error) => error.localBlockReason === 'DUPLICATE_COMMAND_ID',
  );
  gate.resolve({ success: true });
  await first;
});

test('ClientCommandSender permits a final-timeout retry with the same stable identifiers', async () => {
  const envelopes = [];
  const sender = new ClientCommandSender({
    transport: async (envelope) => {
      envelopes.push(envelope);
      if (envelopes.length === 1) {
        throw Object.assign(new Error('timeout'), { code: 'GAME_API_TIMEOUT' });
      }
      return { success: true };
    },
  });
  const options = {
    commandKey: 'build:farm',
    commandId: 'cmd-stable-retry',
    idempotencyKey: 'idem-stable-retry',
  };

  await assert.rejects(() => sender.submit('build', { buildingId: 'farm' }, options));
  await sender.submit('build', { buildingId: 'farm' }, options);

  assert.deepEqual(envelopes.map(({ commandId, idempotencyKey }) => ({ commandId, idempotencyKey })), [
    { commandId: 'cmd-stable-retry', idempotencyKey: 'idem-stable-retry' },
    { commandId: 'cmd-stable-retry', idempotencyKey: 'idem-stable-retry' },
  ]);
});

test('ClientCommandSender reports malformed payloads and missing transport with allowed reasons', async () => {
  const records = [];
  const sender = new ClientCommandSender({
    operationLog: { record(type, detail) { records.push([type, detail]); } },
  });

  await assert.rejects(
    () => sender.submit('build', null),
    (error) => error.localBlockReason === 'PAYLOAD_SHAPE',
  );
  await assert.rejects(
    () => sender.submit('build', { buildingId: 'farm' }),
    (error) => error.localBlockReason === 'UI_NOT_READY',
  );
  assert.deepEqual(records.map(([, detail]) => detail.reason), ['PAYLOAD_SHAPE', 'UI_NOT_READY']);
});
