'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Database = require('better-sqlite3');

const { normalizeCommandEnvelope } = require('../application/commands/CommandEnvelope');
const { CommandExecutionPipeline } = require('../application/commands/CommandExecutionPipeline');
const { CommandIdempotencyStore } = require('../application/commands/CommandIdempotencyStore');
const { requireOwnerContext } = require('../application/commands/CommandOwnerContext');
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
      },
    },
  });
}

function createPipeline() {
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
  const pipeline = new CommandExecutionPipeline({ repository, idempotencyStore });
  return { db, state, calls, pipeline, idempotencyStore };
}

function successfulDefinition(calls) {
  return {
    validate(context) {
      calls.push('validate');
      requireOwnerContext({ ownerKey: context.ownerResolution.ownerKey });
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
