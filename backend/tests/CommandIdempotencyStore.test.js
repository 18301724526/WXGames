'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Database = require('better-sqlite3');

const {
  createInternalCommandEnvelope,
  normalizeCommandEnvelope,
} = require('../application/commands/CommandEnvelope');
const {
  CommandIdempotencyStore,
  STATUS_COMMITTED,
  STATUS_REJECTED,
} = require('../application/commands/CommandIdempotencyStore');
const GameStateRepository = require('../repositories/GameStateRepository');

function envelope(options = {}) {
  const type = options.type || 'research';
  const payload = options.payload || { techId: 'writing' };
  return normalizeCommandEnvelope({
    playerId: options.playerId || 'player-1',
    method: 'POST',
    path: '/api/game/action',
    headers: { 'x-client-request-id': 'api-1' },
    get(name) { return this.headers[String(name).toLowerCase()] || ''; },
    body: {
      action: type,
      ...payload,
      commandId: options.commandId || 'cmd-1',
      idempotencyKey: options.idempotencyKey || 'idem-1',
      clientCommand: {
        schema: 'game-command-v1',
        type,
        commandId: options.commandId || 'cmd-1',
        idempotencyKey: options.idempotencyKey || 'idem-1',
        payload,
      },
    },
  });
}

function createStore() {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  return { db, store: new CommandIdempotencyStore(db) };
}

test('CommandIdempotencyStore replays the exact stored response for the same payload', () => {
  const { db, store } = createStore();
  try {
    const command = envelope();
    const started = store.begin(command);
    assert.equal(started.status, 'started');
    const bound = store.bindOwner(started.record, 'player:player-1');
    assert.equal(bound.ownerKey, 'player:player-1');

    const response = {
      statusCode: 200,
      payload: { success: true, nested: { value: 7 } },
    };
    const saved = store.recordResult(bound, response);
    assert.equal(saved.status, STATUS_COMMITTED);

    const replay = store.begin(command);
    assert.equal(replay.status, 'replay');
    assert.deepEqual(replay.response, response);
  } finally {
    db.close();
  }
});

test('CommandIdempotencyStore accepts stable internal worker command keys', () => {
  const { db, store } = createStore();
  try {
    const command = createInternalCommandEnvelope({
      type: 'worldWorkerPersonUpdate',
      playerId: 'system:world-worker',
      commandId: 'cmd-world-worker-person-1',
      idempotencyKey: 'idem-world-worker-person-1',
      payload: { personId: 'person-1' },
    });
    const started = store.begin(command);
    const bound = store.bindOwner(started.record, 'person:person-1');
    store.recordResult(bound, { statusCode: 200, payload: { success: true } });

    const replay = store.begin(command);
    assert.equal(replay.status, 'replay');
    assert.deepEqual(replay.response, { statusCode: 200, payload: { success: true } });
  } finally {
    db.close();
  }
});

test('CommandIdempotencyStore rejects the same key with a different payload digest', () => {
  const { db, store } = createStore();
  try {
    store.begin(envelope());
    assert.throws(
      () => store.begin(envelope({ payload: { techId: 'mining' } })),
      (error) => error.code === 'IDEMPOTENCY_KEY_CONFLICT'
        && error.idempotencyKey === 'idem-1',
    );
  } finally {
    db.close();
  }
});

test('CommandIdempotencyStore reports in-progress duplicates without a second mutation slot', () => {
  const { db, store } = createStore();
  try {
    const command = envelope();
    store.begin(command);
    const duplicate = store.begin(command);
    assert.equal(duplicate.status, 'in-progress');
    assert.equal(duplicate.response.statusCode, 409);
    assert.equal(duplicate.response.payload.error, 'COMMAND_IN_FLIGHT');
  } finally {
    db.close();
  }
});

test('CommandIdempotencyStore stores domain rejections and supports explicit abandon', () => {
  const { db, store } = createStore();
  try {
    const rejectedCommand = envelope({ idempotencyKey: 'idem-rejected' });
    const rejected = store.begin(rejectedCommand);
    const response = {
      statusCode: 400,
      payload: { success: false, error: 'DOMAIN_REJECTED' },
    };
    const saved = store.recordResult(rejected.record, response);
    assert.equal(saved.status, STATUS_REJECTED);
    assert.deepEqual(store.begin(rejectedCommand).response, response);

    const retryable = store.begin(envelope({ idempotencyKey: 'idem-abandon' }));
    assert.equal(store.abandon(retryable.record), 1);
    assert.equal(store.begin(envelope({ idempotencyKey: 'idem-abandon' })).status, 'started');
  } finally {
    db.close();
  }
});

test('CommandIdempotencyStore never counts server fallback ids as compliance', () => {
  const { db, store } = createStore();
  try {
    const fallback = normalizeCommandEnvelope({
      playerId: 'player-1',
      method: 'POST',
      body: { action: 'advanceEra' },
      headers: { 'x-client-request-id': 'api-fallback' },
      get(name) { return this.headers[String(name).toLowerCase()] || ''; },
    });
    assert.throws(
      () => store.begin(fallback),
      (error) => error.code === 'IDEMPOTENCY_CLIENT_KEY_REQUIRED' && error.status === 400,
    );
  } finally {
    db.close();
  }
});

test('CommandIdempotencyStore refuses a different terminal response overwrite', () => {
  const { db, store } = createStore();
  try {
    const started = store.begin(envelope());
    store.recordResult(started.record, { statusCode: 200, payload: { success: true } });
    assert.throws(
      () => store.recordResult(started.record, {
        statusCode: 400,
        payload: { success: false, error: 'DIFFERENT' },
      }),
      (error) => error.code === 'IDEMPOTENCY_RESULT_WRITE_CONFLICT',
    );
  } finally {
    db.close();
  }
});
