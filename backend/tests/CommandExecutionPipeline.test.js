'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Database = require('better-sqlite3');

const { normalizeCommandEnvelope } = require('../application/commands/CommandEnvelope');
const { CommandExecutionPipeline } = require('../application/commands/CommandExecutionPipeline');
const { CommandIdempotencyStore } = require('../application/commands/CommandIdempotencyStore');
const { requireOwnerContext } = require('../application/commands/CommandOwnerContext');
const { computePayloadHash } = require('../application/commands/CommandReceiptIdentity');
const { CommandReceiptShadowStore } = require('../application/commands/CommandReceiptShadowStore');
const GameStateRepository = require('../repositories/GameStateRepository');

function command(options = {}) {
  const payload = options.payload || { techId: 'writing' };
  const type = options.type || 'research';
  return normalizeCommandEnvelope({
    playerId: options.playerId || 'player-1',
    method: 'POST',
    path: '/api/game/action',
    headers: { 'x-client-request-id': options.requestId || 'api-pipeline-1' },
    get(name) { return this.headers[String(name).toLowerCase()] || ''; },
    body: {
      action: type,
      ...payload,
      commandId: options.commandId || 'cmd-pipeline-1',
      idempotencyKey: options.idempotencyKey || 'idem-pipeline-1',
      clientCommand: {
        schema: 'game-command-v1',
        type,
        commandId: options.commandId || 'cmd-pipeline-1',
        idempotencyKey: options.idempotencyKey || 'idem-pipeline-1',
        payload,
        trace: options.trace,
        client: {
          clientSequence: options.clientSequence ?? null,
        },
      },
    },
  });
}

function createPipeline(options = {}) {
  const db = new Database(':memory:');
  const backingRepository = new GameStateRepository(db);
  backingRepository.init();
  const state = { playerId: 'player-1', revision: 4, value: 0 };
  const calls = [];
  const repository = {
    db,
    withOwnerLocks: backingRepository.withOwnerLocks.bind(backingRepository),
    findByPlayerId(playerId) {
      calls.push('load');
      assert.equal(playerId, state.playerId);
      return state;
    },
    save(nextState) {
      calls.push('commit');
      requireOwnerContext({ ownerKey: 'player:player-1' });
      nextState.revision += 1;
      return nextState;
    },
  };
  const idempotencyStore = new CommandIdempotencyStore(db);
  const receiptStore = options.receiptStore === true
    ? new CommandReceiptShadowStore(db, { now: options.receiptNow })
    : options.receiptStore || null;
  const pipeline = new CommandExecutionPipeline({
    repository,
    idempotencyStore,
    receiptStore,
    logger: options.logger,
    monotonicNow: options.monotonicNow,
  });
  return {
    db,
    state,
    calls,
    pipeline,
    idempotencyStore,
    receiptStore,
  };
}

function successfulDefinition(calls) {
  return {
    validate(context) {
      calls.push('validate');
      const ownerContext = requireOwnerContext({ ownerKey: context.ownerResolution.ownerKey });
      assert.equal(ownerContext.commandType, context.envelope.type);
      return { success: true };
    },
    execute(context) {
      calls.push('execute');
      requireOwnerContext({ ownerKeys: context.ownerResolution.ownerKeys });
      context.state.value += 1;
      return { success: true, value: context.state.value };
    },
    project(context) {
      calls.push('project');
      return { value: context.state.value, revision: context.state.revision };
    },
    respond(context) {
      calls.push('respond');
      return {
        statusCode: 200,
        payload: { success: true, ...context.projection },
      };
    },
  };
}

const FIXED_TRACE_NOW = () => new Date('2026-07-16T00:00:00.000Z');
const FIXED_MONOTONIC_NOW = () => 1000;
const SESSION_CONTEXT = Object.freeze({
  sessionId: 'session-pipeline-1',
  credentialVersion: 3,
  sessionEpoch: 5,
  authzEpoch: 7,
});

function warningLogger(warnings) {
  return {
    warn(message, detail) {
      warnings.push({ message, detail });
    },
  };
}

test('CommandExecutionPipeline runs the complete ordered pipeline inside owner context', () => {
  const fixture = createPipeline();
  try {
    const result = fixture.pipeline.execute(command(), successfulDefinition(fixture.calls));

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.success, true);
    assert.equal(result.payload.value, 1);
    assert.equal(result.payload.revision, 5);
    assert.deepEqual(fixture.calls, ['load', 'validate', 'execute', 'commit', 'project', 'respond']);
    assert.equal(result.trace.ownerKey, 'player:player-1');
    assert.deepEqual(result.trace.ownerKeys, ['player:player-1']);
    assert.equal(result.trace.idempotencyStatus, 'committed');
    assert.equal(result.trace.validatorResult.success, true);
    assert.equal(result.trace.commitResult.status, 'committed');
    assert.equal(result.trace.revisionBefore, 4);
    assert.equal(result.trace.revisionAfter, 5);
    assert.equal(result.trace.responseStatus, 200);
    assert.deepEqual(result.trace.phases.map((phase) => phase.phase), [
      'received',
      'idempotency_checking',
      'owner_resolving',
      'owner_lock_waiting',
      'owner_locked',
      'state_loading',
      'validating',
      'domain_executing',
      'committing',
      'projecting',
      'response_building',
      'responding',
    ]);
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline includes client action trace in response trace', () => {
  const fixture = createPipeline();
  try {
    const result = fixture.pipeline.execute(command({
      trace: {
        clientActionTraceId: 'cat-pipeline-build',
        sourceSurface: 'canvas',
        hitTargetId: 'farm',
        actionType: 'buildBuilding',
        actionDescriptorId: 'building.build',
        visualDisabled: false,
      },
    }), successfulDefinition(fixture.calls));

    assert.equal(result.statusCode, 200);
    assert.equal(result.trace.clientActionTrace.clientActionTraceId, 'cat-pipeline-build');
    assert.equal(result.trace.clientActionTrace.actionDescriptorId, 'building.build');
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline replays a stored result without load or execution', () => {
  const fixture = createPipeline();
  try {
    const envelope = command();
    const first = fixture.pipeline.execute(envelope, successfulDefinition(fixture.calls));
    const callCount = fixture.calls.length;
    const replay = fixture.pipeline.execute(envelope, successfulDefinition(fixture.calls));

    assert.equal(replay.statusCode, 200);
    assert.deepEqual(replay.payload, first.payload);
    assert.equal(replay.idempotencyStatus, 'replay');
    assert.equal(fixture.calls.length, callCount);
    assert.equal(fixture.state.value, 1);
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline rejects idempotency conflicts before owner execution', () => {
  const fixture = createPipeline();
  try {
    fixture.pipeline.execute(command(), successfulDefinition(fixture.calls));
    const conflict = fixture.pipeline.execute(
      command({ payload: { techId: 'mining' } }),
      successfulDefinition(fixture.calls),
    );

    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.payload.error, 'IDEMPOTENCY_KEY_CONFLICT');
    assert.equal(conflict.idempotencyStatus, 'conflict');
    assert.equal(fixture.state.value, 1);
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline stores and replays validator rejection', () => {
  const fixture = createPipeline();
  try {
    const definition = {
      validate() {
        fixture.calls.push('validate');
        return {
          success: false,
          statusCode: 403,
          error: 'POLICY_REJECTED',
          message: 'blocked',
        };
      },
      execute() {
        throw new Error('must not execute');
      },
    };
    const envelope = command({ idempotencyKey: 'idem-rejected' });
    const rejected = fixture.pipeline.execute(envelope, definition);
    const replay = fixture.pipeline.execute(envelope, definition);

    assert.equal(rejected.statusCode, 403);
    assert.equal(rejected.payload.error, 'POLICY_REJECTED');
    assert.deepEqual(replay.payload, rejected.payload);
    assert.equal(replay.idempotencyStatus, 'replay');
    assert.deepEqual(fixture.calls, ['load', 'validate']);
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline refuses domain execution outside owner context', () => {
  assert.throws(
    () => requireOwnerContext({ ownerKey: 'player:player-1' }),
    (error) => error.code === 'OWNER_CONTEXT_REQUIRED',
  );
});

test('CommandExecutionPipeline stores projection failure after a successful commit', () => {
  const fixture = createPipeline();
  try {
    const definition = successfulDefinition(fixture.calls);
    definition.project = () => {
      fixture.calls.push('project');
      throw new Error('projection exploded');
    };
    const envelope = command({ idempotencyKey: 'idem-projection-failure' });
    const result = fixture.pipeline.execute(envelope, definition);
    const replay = fixture.pipeline.execute(envelope, definition);

    assert.equal(result.statusCode, 202);
    assert.equal(result.payload.error, 'PROJECTION_FAILED_AFTER_COMMIT');
    assert.equal(result.payload.committed, true);
    assert.deepEqual(replay.payload, result.payload);
    assert.equal(fixture.state.value, 1);
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline retries one revision conflict inside the pipeline', () => {
  const db = new Database(':memory:');
  const backingRepository = new GameStateRepository(db);
  backingRepository.init();
  let persisted = { playerId: 'player-1', revision: 1, value: 0 };
  let saveAttempts = 0;
  const repository = {
    withOwnerLocks: backingRepository.withOwnerLocks.bind(backingRepository),
    findByPlayerId() {
      return JSON.parse(JSON.stringify(persisted));
    },
    save(state) {
      saveAttempts += 1;
      requireOwnerContext({ ownerKey: 'player:player-1' });
      if (saveAttempts === 1) {
        persisted = { ...persisted, revision: 2 };
        const error = new Error('Game state revision conflict');
        error.code = 'GAME_STATE_REVISION_CONFLICT';
        error.expectedRevision = state.revision;
        error.actualRevision = 2;
        throw error;
      }
      persisted = { ...state, revision: 3 };
      return persisted;
    },
  };
  const pipeline = new CommandExecutionPipeline({
    repository,
    idempotencyStore: new CommandIdempotencyStore(db),
  });
  try {
    const result = pipeline.execute(command({
      commandId: 'cmd-revision-retry',
      idempotencyKey: 'idem-revision-retry',
    }), {
      validate: () => ({ success: true }),
      execute(context) {
        context.state.value += 1;
        return { success: true };
      },
      project: (context) => ({ value: context.state.value }),
      respond: (context) => ({ statusCode: 200, payload: context.projection }),
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.value, 1);
    assert.equal(result.trace.retryAttempt, 1);
    assert.equal(saveAttempts, 2);
    assert.deepEqual(persisted, { playerId: 'player-1', revision: 3, value: 1 });
  } finally {
    db.close();
  }
});

test('CommandExecutionPipeline keeps the response DTO byte-identical with receipt shadowing on or off', () => {
  const disabled = createPipeline({ monotonicNow: FIXED_MONOTONIC_NOW });
  const enabled = createPipeline({
    receiptStore: true,
    receiptNow: FIXED_TRACE_NOW,
    monotonicNow: FIXED_MONOTONIC_NOW,
  });
  try {
    const commandOptions = {
      commandId: 'cmd-receipt-feature',
      idempotencyKey: 'idem-receipt-feature',
      clientSequence: 41,
    };
    const disabledEnvelope = command(commandOptions);
    const enabledEnvelope = command(commandOptions);
    const disabledResponse = disabled.pipeline.execute(
      disabledEnvelope,
      successfulDefinition(disabled.calls),
      { now: FIXED_TRACE_NOW, sessionContext: SESSION_CONTEXT },
    );
    const enabledResponse = enabled.pipeline.execute(
      enabledEnvelope,
      successfulDefinition(enabled.calls),
      { now: FIXED_TRACE_NOW, sessionContext: SESSION_CONTEXT },
    );

    assert.equal(JSON.stringify(enabledResponse), JSON.stringify(disabledResponse));
    assert.deepEqual(enabled.calls, disabled.calls);
    assert.deepEqual(
      enabled.db.prepare(`
        SELECT command_id, payload_hash, session_id, client_seq, status,
          admission_credential_version, admission_session_epoch, admission_authz_epoch
        FROM command_receipts
      `).get(),
      {
        command_id: commandOptions.commandId,
        payload_hash: computePayloadHash(enabledEnvelope.payload),
        session_id: SESSION_CONTEXT.sessionId,
        client_seq: commandOptions.clientSequence,
        status: 'accepted',
        admission_credential_version: SESSION_CONTEXT.credentialVersion,
        admission_session_epoch: SESSION_CONTEXT.sessionEpoch,
        admission_authz_epoch: SESSION_CONTEXT.authzEpoch,
      },
    );
  } finally {
    disabled.db.close();
    enabled.db.close();
  }
});

test('CommandExecutionPipeline receipt shadow retries and session sequence conflicts stay single-row', () => {
  const fixture = createPipeline({
    receiptStore: true,
    receiptNow: FIXED_TRACE_NOW,
    monotonicNow: FIXED_MONOTONIC_NOW,
  });
  try {
    const envelope = command({
      commandId: 'cmd-receipt-retry',
      idempotencyKey: 'idem-receipt-retry',
      clientSequence: 42,
    });
    const executionOptions = { now: FIXED_TRACE_NOW, sessionContext: SESSION_CONTEXT };
    const first = fixture.pipeline.execute(
      envelope,
      successfulDefinition(fixture.calls),
      executionOptions,
    );
    const replay = fixture.pipeline.execute(
      envelope,
      successfulDefinition(fixture.calls),
      executionOptions,
    );
    const sequenceConflict = fixture.pipeline.execute(
      command({
        commandId: 'cmd-receipt-sequence-conflict',
        idempotencyKey: 'idem-receipt-sequence-conflict',
        clientSequence: 42,
      }),
      successfulDefinition(fixture.calls),
      executionOptions,
    );

    assert.equal(first.statusCode, 200);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.idempotencyStatus, 'replay');
    assert.equal(sequenceConflict.statusCode, 200);
    assert.equal(sequenceConflict.payload.success, true);
    assert.equal(
      fixture.db.prepare('SELECT COUNT(*) AS count FROM command_receipts').get().count,
      1,
    );
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline warns and preserves the domain result when receipt persistence fails', () => {
  const warnings = [];
  const fixture = createPipeline({
    receiptStore: {
      writeAccepted() {
        throw new Error('receipt database unavailable');
      },
    },
    logger: warningLogger(warnings),
    monotonicNow: FIXED_MONOTONIC_NOW,
  });
  try {
    const result = fixture.pipeline.execute(
      command({
        commandId: 'cmd-receipt-write-failure',
        idempotencyKey: 'idem-receipt-write-failure',
        clientSequence: 43,
      }),
      successfulDefinition(fixture.calls),
      { now: FIXED_TRACE_NOW, sessionContext: SESSION_CONTEXT },
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.success, true);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].detail.code, 'COMMAND_RECEIPT_SHADOW_WRITE_FAILED');
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline skips receipt shadowing when an admission epoch is unavailable', () => {
  const warnings = [];
  const fixture = createPipeline({
    receiptStore: true,
    receiptNow: FIXED_TRACE_NOW,
    logger: warningLogger(warnings),
    monotonicNow: FIXED_MONOTONIC_NOW,
  });
  try {
    const result = fixture.pipeline.execute(
      command({
        commandId: 'cmd-receipt-missing-epoch',
        idempotencyKey: 'idem-receipt-missing-epoch',
        clientSequence: 44,
      }),
      successfulDefinition(fixture.calls),
      {
        now: FIXED_TRACE_NOW,
        sessionContext: {
          sessionId: 'session-missing-epoch',
          credentialVersion: 1,
          sessionEpoch: 2,
        },
      },
    );

    assert.equal(result.statusCode, 200);
    assert.equal(
      fixture.db.prepare('SELECT COUNT(*) AS count FROM command_receipts').get().count,
      0,
    );
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].detail.code, 'COMMAND_RECEIPT_ADMISSION_CONTEXT_INCOMPLETE');
    assert.deepEqual(warnings[0].detail.missingFields, ['authzEpoch']);
  } finally {
    fixture.db.close();
  }
});

test('CommandExecutionPipeline routes PAYLOAD_NOT_HASHABLE by code and keeps a NaN command on the main path', () => {
  const warnings = [];
  const fixture = createPipeline({
    receiptStore: true,
    receiptNow: FIXED_TRACE_NOW,
    logger: warningLogger(warnings),
    monotonicNow: FIXED_MONOTONIC_NOW,
  });
  try {
    const envelope = command({
      commandId: 'cmd-receipt-nan',
      idempotencyKey: 'idem-receipt-nan',
      clientSequence: 45,
    });
    envelope.payload.ratio = Number.NaN;
    const result = fixture.pipeline.execute(
      envelope,
      successfulDefinition(fixture.calls),
      { now: FIXED_TRACE_NOW, sessionContext: SESSION_CONTEXT },
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.success, true);
    assert.equal(
      fixture.db.prepare('SELECT COUNT(*) AS count FROM command_receipts').get().count,
      0,
    );
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].detail.code, 'PAYLOAD_NOT_HASHABLE');
  } finally {
    fixture.db.close();
  }
});
