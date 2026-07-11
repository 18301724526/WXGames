const test = require('node:test');
const assert = require('node:assert/strict');

const { createEventBus } = require('./ChangeEventBus');

test('subscribe receives exact-name events and unsubscribe stops delivery', () => {
  const bus = createEventBus();
  const received = [];
  const unsubscribe = bus.subscribe('state.changed', (payload) => received.push(payload));
  bus.emit('state.changed', { revision: 1 });
  bus.emit('modal.changed', { subtype: 'modal:naming' });
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  bus.emit('state.changed', { revision: 2 });
  assert.deepEqual(received, [{ revision: 1 }]);
});

test('multiple subscribers receive the same publication', () => {
  const bus = createEventBus();
  const received = [];
  bus.subscribe('state.changed', () => received.push('first'));
  bus.subscribe('state.changed', () => received.push('second'));
  assert.deepEqual(bus.emit('state.changed', {}), {
    delivered: 2,
    failed: 0,
    errors: [],
    results: [1, 2],
  });
  assert.deepEqual(received, ['first', 'second']);
});

test('a throwing subscriber does not stop later subscribers or escape emit', () => {
  const reported = [];
  const bus = createEventBus({ onSubscriberError: (error) => reported.push(error.message) });
  const received = [];
  bus.subscribe('state.changed', () => {
    throw new Error('broken subscriber');
  });
  bus.subscribe('state.changed', (payload) => received.push(payload));

  const result = bus.emit('state.changed', { revision: 3 });

  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.errors[0].message, 'broken subscriber');
  assert.deepEqual(reported, ['broken subscriber']);
  assert.deepEqual(received, [{ revision: 3 }]);
});
