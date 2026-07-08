const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasSurfaceState = require('./renderers/CanvasSurfaceState');
const HitTargetManager = require('./HitTargetManager');

// Isolated contract tests for HitTargetManager (god-file re-decomposition slice 12).
// The manager is exercised against a stub host: a plain surfaceState POJO built by the
// REAL CanvasSurfaceState module, plus optional stub sub-renderers to prove the
// forward-probe vs local-fallback split (surfaceRenderer for set/add/get/suppress,
// tutorialRenderer for find).

function createHost(overrides = {}) {
  return {
    surfaceState: CanvasSurfaceState.createCanvasSurfaceState(),
    surfaceRenderer: null,
    tutorialRenderer: null,
    ...overrides,
  };
}

function createManager(overrides = {}) {
  const host = createHost(overrides);
  const manager = new HitTargetManager({ host });
  host.addHitTarget = (...args) => manager.addHitTarget(...args);
  return { host, manager };
}

test('readHitTargets/writeHitTargets back the hitTargets accessor over surfaceState', () => {
  const { host, manager } = createManager();
  assert.deepEqual(manager.readHitTargets(), []);

  const targets = [{ x: 1, y: 2, width: 3, height: 4, action: { type: 'a' } }];
  manager.writeHitTargets(targets);
  assert.equal(manager.readHitTargets(), targets);
  assert.equal(host.surfaceState.hitTargets, targets);

  manager.writeHitTargets('nope');
  assert.deepEqual(manager.readHitTargets(), []);
});

test('readFamousSkillHitTargets lazily initializes; write coerces non-arrays', () => {
  const { host, manager } = createManager();
  host.surfaceState.famousSkillHitTargets = null;
  assert.deepEqual(manager.readFamousSkillHitTargets(), []);
  assert.equal(Array.isArray(host.surfaceState.famousSkillHitTargets), true);

  const list = [{ id: 'skill' }];
  manager.writeFamousSkillHitTargets(list);
  assert.equal(manager.readFamousSkillHitTargets(), list);
  manager.writeFamousSkillHitTargets(0);
  assert.deepEqual(manager.readFamousSkillHitTargets(), []);
});

test('readSuppressHitTargets/writeSuppressHitTargets coerce to boolean', () => {
  const { host, manager } = createManager();
  assert.equal(manager.readSuppressHitTargets(), false);
  manager.writeSuppressHitTargets(1);
  assert.equal(manager.readSuppressHitTargets(), true);
  assert.equal(host.surfaceState.suppressHitTargets, true);
  manager.writeSuppressHitTargets('');
  assert.equal(manager.readSuppressHitTargets(), false);
});

test('setHitTargets prefers the surfaceRenderer forward, else writes surfaceState', () => {
  const calls = [];
  const forwarded = createManager({
    surfaceRenderer: {
      setHitTargets(...args) {
        calls.push(args);
        return 'forwarded';
      },
    },
  });
  assert.equal(forwarded.manager.setHitTargets([{ x: 0 }], 'extra'), 'forwarded');
  assert.deepEqual(calls, [[[{ x: 0 }], 'extra']]);
  assert.deepEqual(forwarded.host.surfaceState.hitTargets, []);

  const local = createManager();
  const targets = [{ x: 0, y: 0, width: 1, height: 1, action: { type: 'a' } }];
  assert.equal(local.manager.setHitTargets(targets), targets);
  assert.equal(local.host.surfaceState.hitTargets, targets);
  assert.deepEqual(local.manager.setHitTargets(), []);
});

test('addHitTarget forwards when possible, else appends normalized + honors suppression', () => {
  const calls = [];
  const forwarded = createManager({
    surfaceRenderer: {
      addHitTarget(...args) {
        calls.push(args);
        return 'added';
      },
    },
  });
  const rect = { x: 1, y: 2, width: 3, height: 4 };
  const action = { type: 'tap' };
  assert.equal(forwarded.manager.addHitTarget(rect, action), 'added');
  assert.deepEqual(calls, [[rect, action]]);

  const local = createManager();
  assert.equal(
    local.manager.addHitTarget({ x: 'x', y: 2, width: '3', height: 4 }, action),
    undefined,
  );
  assert.deepEqual(local.host.surfaceState.hitTargets, [
    { x: 0, y: 2, width: 3, height: 4, action },
  ]);

  local.manager.addHitTarget(null, action);
  local.manager.addHitTarget(rect, null);
  assert.equal(local.host.surfaceState.hitTargets.length, 1);

  local.manager.writeSuppressHitTargets(true);
  assert.equal(local.manager.addHitTarget(rect, action), undefined);
  assert.equal(local.host.surfaceState.hitTargets.length, 1);
});

test('appendWorldMapRuntimeHitTargets dispatches through host.addHitTarget', () => {
  const { host, manager } = createManager();
  assert.equal(manager.appendWorldMapRuntimeHitTargets([]), false);
  assert.equal(manager.appendWorldMapRuntimeHitTargets('nope'), false);
  assert.equal(manager.appendWorldMapRuntimeHitTargets(), false);

  const action = { type: 'openWorldSite' };
  assert.equal(
    manager.appendWorldMapRuntimeHitTargets([{ x: '7', y: 8, width: 9, height: 10, action }]),
    true,
  );
  assert.deepEqual(host.surfaceState.hitTargets, [{ x: 7, y: 8, width: 9, height: 10, action }]);

  // Suppressed adds are dropped but the non-empty input still reports true.
  manager.writeSuppressHitTargets(true);
  assert.equal(
    manager.appendWorldMapRuntimeHitTargets([{ x: 0, y: 0, width: 1, height: 1, action }]),
    true,
  );
  assert.equal(host.surfaceState.hitTargets.length, 1);
});

test('getHitTarget forwards to the surfaceRenderer and null-defaults otherwise', () => {
  const hit = { type: 'hit' };
  const forwarded = createManager({
    surfaceRenderer: {
      getHitTarget(point) {
        return point.x === 5 ? hit : undefined;
      },
    },
  });
  assert.equal(forwarded.manager.getHitTarget({ x: 5 }), hit);
  assert.equal(forwarded.manager.getHitTarget({ x: 6 }), null);

  const local = createManager();
  local.manager.writeHitTargets([{ x: 0, y: 0, width: 10, height: 10, action: hit }]);
  assert.equal(local.manager.getHitTarget({ x: 5, y: 5 }), null);
});

test('withSuppressedHitTargets forwards, else invokes the callback without the flag', () => {
  const forwarded = createManager({
    surfaceRenderer: {
      withSuppressedHitTargets(callback) {
        return `wrapped:${callback()}`;
      },
    },
  });
  assert.equal(
    forwarded.manager.withSuppressedHitTargets(() => 'value'),
    'wrapped:value',
  );

  const local = createManager();
  const value = local.manager.withSuppressedHitTargets(() => {
    assert.equal(local.manager.readSuppressHitTargets(), false);
    return 42;
  });
  assert.equal(value, 42);
  assert.equal(local.manager.withSuppressedHitTargets(), undefined);
});

test('findHitTarget forwards to the tutorialRenderer and null-defaults otherwise', () => {
  const found = { x: 0, y: 0, width: 1, height: 1, action: { type: 'enterCity' } };
  const forwarded = createManager({
    tutorialRenderer: {
      findHitTarget(type, predicate) {
        if (type !== 'enterCity') return undefined;
        return !predicate || predicate(found.action) ? found : undefined;
      },
    },
  });
  assert.equal(forwarded.manager.findHitTarget('enterCity'), found);
  assert.equal(
    forwarded.manager.findHitTarget('enterCity', () => false),
    null,
  );
  assert.equal(forwarded.manager.findHitTarget('missing'), null);

  const local = createManager();
  assert.equal(local.manager.findHitTarget('enterCity'), null);
});
