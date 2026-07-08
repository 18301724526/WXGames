const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveInputIntent, routeForSnapshot } = require('./InputIntentResolver');

// Snapshots only need the boolean fields ModeResolver's route predicates read.
function snapshot(overrides = {}) {
  return {
    entityBattleActive: false,
    canRouteTechTree: false,
    canRouteWorldMap: false,
    ...overrides,
  };
}

test('entity-battle wins over every other route regardless of kind', () => {
  const snap = snapshot({
    entityBattleActive: true,
    canRouteTechTree: true,
    canRouteWorldMap: true,
  });
  assert.equal(routeForSnapshot(snap, 'drag'), 'entity-battle');
  assert.equal(routeForSnapshot(snap, 'gesture'), 'entity-battle');
});

test('drag prefers tech-tree over world-map (handleDrag order)', () => {
  const snap = snapshot({ canRouteTechTree: true, canRouteWorldMap: true });
  assert.equal(routeForSnapshot(snap, 'drag'), 'tech-tree');
  assert.equal(routeForSnapshot(snap, 'tap'), 'tech-tree');
});

test('gesture prefers world-map over tech-tree (handleGesture order)', () => {
  const snap = snapshot({ canRouteTechTree: true, canRouteWorldMap: true });
  assert.equal(routeForSnapshot(snap, 'gesture'), 'world-map');
});

test('single routable mode resolves to that route for any kind', () => {
  assert.equal(routeForSnapshot(snapshot({ canRouteWorldMap: true }), 'drag'), 'world-map');
  assert.equal(routeForSnapshot(snapshot({ canRouteTechTree: true }), 'gesture'), 'tech-tree');
});

test('no covered mode falls back to the city route', () => {
  assert.equal(routeForSnapshot(snapshot(), 'drag'), 'city');
  assert.equal(routeForSnapshot(snapshot(), 'gesture'), 'city');
});

test('resolveInputIntent returns null without a snapshot so callers fall back to legacy', () => {
  assert.equal(resolveInputIntent({ kind: 'drag' }, null), null);
  assert.equal(resolveInputIntent({ kind: 'drag' }), null);
});

test('resolveInputIntent returns a frozen routed intent carrying route and kind', () => {
  const routed = resolveInputIntent({ kind: 'drag' }, snapshot({ canRouteTechTree: true }));
  assert.equal(Object.isFrozen(routed), true);
  assert.equal(routed.route, 'tech-tree');
  assert.equal(routed.kind, 'drag');
});
