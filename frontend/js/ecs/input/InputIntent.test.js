const test = require('node:test');
const assert = require('node:assert/strict');

const InputIntent = require('./InputIntent');

test('InputIntent exposes frozen covered-mode route vocabulary', () => {
  assert.deepEqual(InputIntent.ROUTE_VALUES, ['entity-battle', 'tech-tree', 'world-map', 'city']);
  assert.deepEqual(InputIntent.KIND_VALUES, ['drag', 'gesture', 'tap']);
  assert.equal(Object.isFrozen(InputIntent.INPUT_ROUTES), true);
  assert.equal(InputIntent.isCoveredRoute('tech-tree'), true);
  assert.equal(InputIntent.isCoveredRoute('unknown'), false);
});

test('createPhysicalIntent returns a frozen, normalized, serializable shape', () => {
  const intent = InputIntent.createPhysicalIntent({
    kind: 'drag',
    phase: 'start',
    pointer: { x: '12', y: 4 },
    gesture: { type: 'pinchZoom', phase: 'move' },
  });
  assert.equal(Object.isFrozen(intent), true);
  assert.deepEqual(intent, {
    kind: 'drag',
    phase: 'start',
    pointer: { x: 12, y: 4 },
    gesture: { type: 'pinchZoom', phase: 'move' },
  });
});

test('createPhysicalIntent tolerates missing pointer/gesture', () => {
  const intent = InputIntent.createPhysicalIntent({ kind: 'tap' });
  assert.deepEqual(intent, { kind: 'tap', phase: '', pointer: null, gesture: null });
});

test('createRoutedIntent freezes the route, kind, and optional action', () => {
  const routed = InputIntent.createRoutedIntent({
    route: 'entity-battle',
    kind: 'gesture',
    action: { type: 'entityBattleZoom' },
  });
  assert.equal(Object.isFrozen(routed), true);
  assert.deepEqual(routed, {
    route: 'entity-battle',
    kind: 'gesture',
    action: { type: 'entityBattleZoom' },
  });
  assert.equal(InputIntent.createRoutedIntent({ route: 'city' }).action, null);
});
