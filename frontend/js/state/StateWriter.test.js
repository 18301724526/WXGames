const test = require('node:test');
const assert = require('node:assert/strict');

const StateWriter = require('./StateWriter');
const ChangeEventBus = require('./ChangeEventBus');

test('getStateHost returns the host itself when there is no lastGame', () => {
  const host = { state: { a: 1 } };
  assert.equal(StateWriter.getStateHost(host), host);
});

test('getStateHost prefers a distinct object lastGame (triple-host precedence)', () => {
  const owner = { state: { a: 1 } };
  const host = { state: { sentinel: 'stale' }, lastGame: owner };
  assert.equal(StateWriter.getStateHost(host), owner);
});

test('getStateHost ignores a self-referential lastGame', () => {
  const host = { state: { a: 1 } };
  host.lastGame = host;
  assert.equal(StateWriter.getStateHost(host), host);
});

test('getStateHost ignores a non-object lastGame', () => {
  const host = { state: { a: 1 }, lastGame: true };
  assert.equal(StateWriter.getStateHost(host), host);
});

test('commit with an object patcher wholesale-replaces the owner state', () => {
  const host = { state: { a: 1 } };
  const next = { b: 2 };
  const result = StateWriter.commit(host, next);
  assert.equal(host.state, next);
  assert.equal(result, next);
});

test('commit with a function patcher derives from the previous owner state', () => {
  const host = { state: { a: 1 } };
  const result = StateWriter.commit(host, (prev) => ({ ...prev, b: 2 }));
  assert.deepEqual(host.state, { a: 1, b: 2 });
  assert.equal(result, host.state);
  // derive-from-prev must not mutate the previous object in place
  assert.deepEqual(result, { a: 1, b: 2 });
});

test('commit routes the write to lastGame, leaving the vestigial host.state stale', () => {
  const owner = { state: { a: 1 } };
  const host = { state: { sentinel: 'stale' }, lastGame: owner };
  StateWriter.commit(host, (prev) => ({ ...prev, b: 2 }));
  assert.deepEqual(owner.state, { a: 1, b: 2 });
  assert.deepEqual(host.state, { sentinel: 'stale' });
});

test('commit tolerates an owner with no prior state via the function patcher', () => {
  const host = {};
  const result = StateWriter.commit(host, (prev) => ({ ...prev, fresh: true }));
  assert.deepEqual(host.state, { fresh: true });
  assert.equal(result, host.state);
});

test('commit returns undefined when there is no owner object to write', () => {
  assert.equal(StateWriter.commit(null, { a: 1 }), undefined);
});

test('wholesaleReplace is a thin alias of commit with an object patcher', () => {
  const host = { state: { a: 1 } };
  const next = { replaced: true };
  const result = StateWriter.wholesaleReplace(host, next);
  assert.equal(host.state, next);
  assert.equal(result, next);
});

test('commit publishes a state change description with caller metadata', () => {
  const host = { state: { revision: 1 } };
  const changes = [];
  const unsubscribe = ChangeEventBus.subscribe('state.changed', (change) => changes.push(change));
  const next = StateWriter.commit(
    host,
    (previous) => ({ ...previous, revision: 2 }),
    { source: 'test', action: 'advance' },
  );
  unsubscribe();

  assert.equal(changes.length, 1);
  assert.equal(changes[0].source, 'StateWriter');
  assert.equal(changes[0].operation, 'commit');
  assert.equal(changes[0].owner, host);
  assert.deepEqual(changes[0].previous, { revision: 1 });
  assert.equal(changes[0].next, next);
  assert.deepEqual(changes[0].meta, { source: 'test', action: 'advance' });
});
