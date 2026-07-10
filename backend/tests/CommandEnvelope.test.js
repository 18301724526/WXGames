const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCommandPayload,
  createBuildBuildingCommand,
  createInternalCommandEnvelope,
  normalizeCommandEnvelope,
  summarizeCommand,
} = require('../application/commands/CommandEnvelope');
const { prepareCommandEntry } = require('../application/commands/CommandEntryContext');
const CommandTrace = require('../application/commands/CommandTrace');

function createRequest(body = {}, options = {}) {
  return {
    body,
    method: options.method || 'POST',
    path: options.path || '/api/game/action',
    playerId: options.playerId || 'player-1',
    headers: { 'x-client-request-id': options.requestId || 'api-1' },
    get(name) {
      return this.headers[String(name).toLowerCase()] || '';
    },
  };
}

test('CommandEnvelope normalizes an explicit client command envelope', () => {
  const req = createRequest({
    action: 'research',
    techId: 'writing',
    commandId: 'cmd-1',
    idempotencyKey: 'idem-1',
    clientCommand: {
      schema: 'game-command-v1',
      type: 'research',
      commandId: 'cmd-1',
      idempotencyKey: 'idem-1',
      payload: { techId: 'writing' },
      client: { requestId: 'api-1', clientSequence: 7 },
    },
  });

  const envelope = normalizeCommandEnvelope(req, { inventoryId: 'server:game-action-registry' });

  assert.equal(envelope.schema, 'game-command-v1');
  assert.equal(envelope.type, 'research');
  assert.equal(envelope.commandId, 'cmd-1');
  assert.equal(envelope.idempotencyKey, 'idem-1');
  assert.equal(envelope.playerId, 'player-1');
  assert.deepEqual(envelope.payload, { techId: 'writing' });
  assert.equal(envelope.client.clientSequence, 7);
  assert.equal(envelope.compatibility.idempotencyClassification, 'client-idempotent');
  assert.equal(envelope.compatibility.serverFallbackId, false);
  assert.equal(envelope.compatibility.clientPayloadMatches, true);
});

test('CommandEnvelope records client action trace without changing payload digest', () => {
  const baseBody = {
    action: 'build',
    target: 'farm',
    commandId: 'cmd-trace-1',
    idempotencyKey: 'idem-trace-1',
    clientCommand: {
      schema: 'game-command-v1',
      type: 'build',
      commandId: 'cmd-trace-1',
      idempotencyKey: 'idem-trace-1',
      payload: { buildingId: 'farm' },
    },
  };
  const first = normalizeCommandEnvelope(createRequest({
    ...baseBody,
    clientCommand: {
      ...baseBody.clientCommand,
      trace: {
        schema: 'client-action-trace-v1',
        clientActionTraceId: 'cat-build-a',
        sourceSurface: 'canvas',
        hitTargetId: 'farm',
        actionType: 'buildBuilding',
        actionDescriptorId: 'building.build',
        visualDisabled: true,
      },
    },
  }));
  const second = normalizeCommandEnvelope(createRequest({
    ...baseBody,
    clientCommand: {
      ...baseBody.clientCommand,
      trace: {
        schema: 'client-action-trace-v1',
        clientActionTraceId: 'cat-build-b',
        sourceSurface: 'sidebar',
        hitTargetId: 'farm',
        actionType: 'buildBuilding',
        actionDescriptorId: 'building.build',
        visualDisabled: false,
      },
    },
  }));

  assert.deepEqual(first.payload, { buildingId: 'farm' });
  assert.equal(first.payload.trace, undefined);
  assert.equal(first.payloadDigest, second.payloadDigest);
  assert.equal(first.trace.clientActionTraceId, 'cat-build-a');
  assert.equal(second.trace.clientActionTraceId, 'cat-build-b');
  assert.deepEqual(summarizeCommand(first).clientActionTrace, first.trace);
  assert.deepEqual(new CommandTrace(first).toPayload().clientActionTrace, first.trace);
});

test('CommandEnvelope creates explicit internal-idempotent worker envelopes', () => {
  const envelope = createInternalCommandEnvelope({
    type: 'worldWorkerPersonUpdate',
    playerId: 'system:world-worker',
    commandId: 'cmd-world-worker-person-1',
    idempotencyKey: 'idem-world-worker-person-1',
    requestId: 'worker-tick-1',
    payload: { personId: 'person-1', person: { id: 'person-1' } },
  });

  assert.equal(envelope.type, 'worldWorkerPersonUpdate');
  assert.equal(envelope.playerId, 'system:world-worker');
  assert.equal(envelope.compatibility.idempotencyClassification, 'internal-idempotent');
  assert.equal(envelope.compatibility.internalCommand, true);
  assert.equal(envelope.compatibility.clientEnvelopePresent, false);
  assert.deepEqual(envelope.payload, { person: { id: 'person-1' }, personId: 'person-1' });
});

test('CommandEnvelope preserves missing client ids only as server fallback compatibility metadata', () => {
  const envelope = normalizeCommandEnvelope(createRequest({ action: 'advanceEra' }));

  assert.equal(envelope.commandId, 'cmd-api-1');
  assert.equal(envelope.idempotencyKey, 'cmd-api-1');
  assert.equal(envelope.compatibility.idempotencyClassification, 'server-fallback-id');
  assert.equal(envelope.compatibility.serverFallbackId, true);
  assert.deepEqual(envelope.compatibility.missingClientFields, ['commandId', 'idempotencyKey']);
});

test('CommandEnvelope rejects missing ids when a migrated route requires the client envelope', () => {
  assert.throws(
    () => normalizeCommandEnvelope(createRequest({ action: 'advanceEra' }), { requireClientIds: true }),
    (error) => error.code === 'COMMAND_ENVELOPE_REQUIRED'
      && error.missingFields.join(',') === 'commandId,idempotencyKey',
  );
});

test('CommandEnvelope rejects identifier, type, and payload mismatches', () => {
  assert.throws(
    () => normalizeCommandEnvelope(createRequest({
      action: 'research',
      clientCommand: { schema: 'game-command-v0', type: 'research' },
    })),
    (error) => error.code === 'COMMAND_SCHEMA_UNSUPPORTED'
      && error.field === 'clientCommand.schema',
  );
  assert.throws(
    () => normalizeCommandEnvelope(createRequest({
      action: 'research',
      commandId: 'cmd-a',
      clientCommand: { type: 'research', commandId: 'cmd-b' },
    })),
    (error) => error.code === 'COMMAND_ENVELOPE_IDENTIFIER_MISMATCH',
  );
  assert.throws(
    () => normalizeCommandEnvelope(createRequest({
      action: 'research',
      clientCommand: { type: 'advanceEra' },
    })),
    (error) => error.code === 'COMMAND_TYPE_MISMATCH',
  );
  assert.throws(
    () => normalizeCommandEnvelope(createRequest({
      action: 'research',
      techId: 'writing',
      clientCommand: { type: 'research', payload: { techId: 'mining' } },
    })),
    (error) => error.code === 'COMMAND_PAYLOAD_MISMATCH',
  );
});

test('CommandEnvelope canonical payload aliases match current GameAPI facades', () => {
  assert.deepEqual(buildCommandPayload('build', { action: 'build', target: 'farm' }), {
    buildingId: 'farm',
  });
  assert.deepEqual(buildCommandPayload('assign', { action: 'assign', target: 'farmer', count: 2 }), {
    count: 2,
    job: 'farmer',
  });
  assert.deepEqual(buildCommandPayload('playerLogin', { username: 'test1', password: 'secret' }), {
    username: 'test1',
  });
});

test('createBuildBuildingCommand delegates to the universal envelope while preserving handler shape', () => {
  const req = createRequest({
    action: 'build',
    target: 'barracks',
    commandId: 'cmd-build-1',
    idempotencyKey: 'idem-build-1',
    clientCommand: {
      type: 'build',
      commandId: 'cmd-build-1',
      idempotencyKey: 'idem-build-1',
      payload: { buildingId: 'barracks' },
    },
  });

  const command = createBuildBuildingCommand(req);

  assert.equal(command.type, 'BuildBuilding');
  assert.equal(command.action, 'build');
  assert.equal(command.commandId, 'cmd-build-1');
  assert.equal(command.payload.buildingId, 'barracks');
  assert.equal(command.payload.target, 'barracks');
  assert.equal(command.compatibility.idempotencyClassification, 'client-idempotent');
});

test('CommandEntryContext records envelope and owner resolution without claiming migration', () => {
  const reports = [];
  const req = createRequest({
    action: 'startConquest',
    territoryId: 'territory-1',
    commandId: 'cmd-territory-1',
    idempotencyKey: 'idem-territory-1',
    clientCommand: {
      type: 'startConquest',
      commandId: 'cmd-territory-1',
      idempotencyKey: 'idem-territory-1',
      payload: { territoryId: 'territory-1' },
    },
  });

  const entry = prepareCommandEntry(req, {
    inventoryId: 'server:game-action-registry',
    reporter: (report) => reports.push(report),
  });

  assert.equal(entry.ok, true);
  assert.equal(entry.report.mode, 'report-only');
  assert.equal(entry.ownerResolution.ownerKey, 'territory:territory-1');
  assert.deepEqual(entry.ownerResolution.ownerKeys, [
    'player:player-1',
    'territory-owner:player-1',
    'territory:territory-1',
  ]);
  assert.equal(req.commandReports.length, 1);
  assert.equal(reports.length, 1);
});

test('CommandEntryContext reports unresolved shared owners without player fallback', () => {
  const req = createRequest({
    action: 'startWorldCombat',
    missionId: 'march-1',
    targetQ: 1,
    targetR: 0,
  });

  const entry = prepareCommandEntry(req, { inventoryId: 'server:game-action-world-combat-bypass' });

  assert.equal(entry.ok, true);
  assert.equal(entry.ownerResolution.status, 'blocked');
  assert.equal(entry.ownerResolution.error, 'OWNER_TARGET_ENCOUNTER_ID_MISSING');
  assert.equal(entry.ownerResolution.ownerKey, '');
});

test('CommandEntryContext can enforce owner resolution only when migration is claimed', () => {
  const req = createRequest({ action: 'startWorldCombat', missionId: 'march-1' });

  const entry = prepareCommandEntry(req, {
    inventoryId: 'server:game-action-world-combat-bypass',
    requireOwner: true,
  });

  assert.equal(entry.ok, false);
  assert.equal(entry.statusCode, 400);
  assert.equal(entry.payload.error, 'OWNER_TARGET_ENCOUNTER_ID_MISSING');
});
