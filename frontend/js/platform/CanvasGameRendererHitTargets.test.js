const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameRenderer = require('./CanvasGameRenderer');

// Characterization tests for the CanvasGameRenderer hit-target cluster (god-file
// re-decomposition slice 12). Written against the renderer BEFORE HitTargetManager was
// extracted and kept unchanged afterwards. They lock the externally observable behavior
// of the hitTargets/famousSkillHitTargets/suppressHitTargets accessors and the
// setHitTargets/addHitTarget/appendWorldMapRuntimeHitTargets/getHitTarget/
// withSuppressedHitTargets/findHitTarget methods on BOTH dispatch paths:
// - live composed path: real CanvasSurfaceRenderer/TutorialCanvasRenderer from the
//   composition factory, all sharing the renderer's surfaceState container;
// - local fallback path: child renderer absent, the renderer's own surfaceState-backed
//   implementation handles the call.

function createRenderer() {
  return new CanvasGameRenderer({ ctx: { scale() {} }, presenter: {} });
}

function createBareRenderer() {
  const renderer = createRenderer();
  renderer.surfaceRenderer = null;
  renderer.tutorialRenderer = null;
  return renderer;
}

test('hitTargets accessor reads/writes the shared surfaceState array', () => {
  const renderer = createRenderer();
  assert.deepEqual(renderer.hitTargets, []);

  const targets = [{ x: 1, y: 2, width: 3, height: 4, action: { type: 'alpha' } }];
  renderer.hitTargets = targets;
  assert.equal(renderer.hitTargets, targets);
  assert.equal(renderer.surfaceState.hitTargets, targets);

  renderer.hitTargets = 'not-an-array';
  assert.deepEqual(renderer.hitTargets, []);
});

test('famousSkillHitTargets accessor lazily initializes and coerces non-arrays', () => {
  const renderer = createRenderer();
  renderer.surfaceState.famousSkillHitTargets = null;
  assert.deepEqual(renderer.famousSkillHitTargets, []);
  assert.equal(Array.isArray(renderer.surfaceState.famousSkillHitTargets), true);

  const list = [{ id: 'skill' }];
  renderer.famousSkillHitTargets = list;
  assert.equal(renderer.famousSkillHitTargets, list);

  renderer.famousSkillHitTargets = 'nope';
  assert.deepEqual(renderer.famousSkillHitTargets, []);
});

test('suppressHitTargets accessor coerces to boolean over surfaceState', () => {
  const renderer = createRenderer();
  assert.equal(renderer.suppressHitTargets, false);
  renderer.suppressHitTargets = 1;
  assert.equal(renderer.suppressHitTargets, true);
  assert.equal(renderer.surfaceState.suppressHitTargets, true);
  renderer.suppressHitTargets = '';
  assert.equal(renderer.suppressHitTargets, false);
});

test('setHitTargets/getHitTarget roundtrip resolves the topmost foreground hit (live path)', () => {
  const renderer = createRenderer();
  const below = { type: 'below' };
  const above = { type: 'above' };
  renderer.setHitTargets([
    { x: 0, y: 0, width: 100, height: 100, action: below },
    { x: 0, y: 0, width: 100, height: 100, action: above },
  ]);

  assert.equal(renderer.getHitTarget({ x: 50, y: 50 }), above);
  assert.equal(renderer.getHitTarget({ x: 500, y: 500 }), null);
});

test('getHitTarget falls back to a covering background action (live path)', () => {
  const renderer = createRenderer();
  const background = { type: 'bg', background: true };
  const small = { type: 'small' };
  renderer.setHitTargets([
    { x: 0, y: 0, width: 100, height: 100, action: background },
    { x: 0, y: 0, width: 10, height: 10, action: small },
  ]);

  assert.equal(renderer.getHitTarget({ x: 50, y: 50 }), background);
  assert.equal(renderer.getHitTarget({ x: 5, y: 5 }), small);
});

test('addHitTarget appends normalized targets and honors suppressHitTargets (live path)', () => {
  const renderer = createRenderer();
  const action = { type: 'tap' };
  renderer.addHitTarget({ x: '5', y: 6.5, width: 10, height: 20 }, action);
  assert.deepEqual(renderer.hitTargets, [{ x: 5, y: 6.5, width: 10, height: 20, action }]);

  renderer.addHitTarget(null, action);
  renderer.addHitTarget({ x: 0, y: 0, width: 1, height: 1 }, null);
  assert.equal(renderer.hitTargets.length, 1);

  renderer.suppressHitTargets = true;
  renderer.addHitTarget({ x: 0, y: 0, width: 1, height: 1 }, action);
  assert.equal(renderer.hitTargets.length, 1);
});

test('withSuppressedHitTargets suppresses adds and restores the previous flag (live path)', () => {
  const renderer = createRenderer();
  renderer.addHitTarget({ x: 0, y: 0, width: 1, height: 1 }, { type: 'before' });

  const result = renderer.withSuppressedHitTargets(() => {
    assert.equal(renderer.suppressHitTargets, true);
    renderer.addHitTarget({ x: 0, y: 0, width: 1, height: 1 }, { type: 'inside' });
    return 'value';
  });

  assert.equal(result, 'value');
  assert.equal(renderer.suppressHitTargets, false);
  assert.deepEqual(
    renderer.hitTargets.map((target) => target.action.type),
    ['before'],
  );

  assert.throws(
    () =>
      renderer.withSuppressedHitTargets(() => {
        throw new Error('boom');
      }),
    /boom/,
  );
  assert.equal(renderer.suppressHitTargets, false);

  renderer.suppressHitTargets = true;
  renderer.withSuppressedHitTargets(() => {});
  assert.equal(renderer.suppressHitTargets, true);
});

test('findHitTarget scans hit targets topmost-first with type + predicate (live path)', () => {
  const renderer = createRenderer();
  const first = { x: 0, y: 0, width: 10, height: 10, action: { type: 'enterCity', cityId: 'a' } };
  const other = { x: 0, y: 0, width: 5, height: 5, action: { type: 'other' } };
  const second = { x: 20, y: 0, width: 10, height: 10, action: { type: 'enterCity', cityId: 'b' } };
  renderer.setHitTargets([first, other, second]);

  assert.equal(renderer.findHitTarget('enterCity'), second);
  assert.equal(
    renderer.findHitTarget('enterCity', (action) => action.cityId === 'a'),
    first,
  );
  assert.equal(renderer.findHitTarget('missing'), null);
});

test('appendWorldMapRuntimeHitTargets appends through addHitTarget and reports input presence', () => {
  const renderer = createRenderer();
  assert.equal(renderer.appendWorldMapRuntimeHitTargets([]), false);
  assert.equal(renderer.appendWorldMapRuntimeHitTargets('nope'), false);
  assert.equal(renderer.appendWorldMapRuntimeHitTargets(), false);

  const action = { type: 'openWorldSite' };
  assert.equal(
    renderer.appendWorldMapRuntimeHitTargets([{ x: '1', y: 2, width: 3, height: 4, action }]),
    true,
  );
  assert.deepEqual(renderer.hitTargets, [{ x: 1, y: 2, width: 3, height: 4, action }]);

  // Suppression drops the appends but the method still reports the non-empty input.
  renderer.suppressHitTargets = true;
  assert.equal(
    renderer.appendWorldMapRuntimeHitTargets([{ x: 0, y: 0, width: 1, height: 1, action }]),
    true,
  );
  assert.equal(renderer.hitTargets.length, 1);
});

test('live child renderers share the same surfaceState as the accessor surface', () => {
  const renderer = createRenderer();
  const action = { type: 'fromChild' };
  renderer.surfaceRenderer.addHitTarget({ x: 1, y: 1, width: 2, height: 2 }, action);
  assert.deepEqual(renderer.hitTargets, [{ x: 1, y: 1, width: 2, height: 2, action }]);
});

test('setHitTargets falls back to the local surfaceState write without a surfaceRenderer', () => {
  const renderer = createBareRenderer();
  const targets = [{ x: 0, y: 0, width: 1, height: 1, action: { type: 'a' } }];
  assert.equal(renderer.setHitTargets(targets), targets);
  assert.equal(renderer.surfaceState.hitTargets, targets);
  assert.deepEqual(renderer.setHitTargets(), []);
});

test('addHitTarget local fallback normalizes, honors suppression, ignores bad input', () => {
  const renderer = createBareRenderer();
  const action = { type: 'tap' };
  assert.equal(renderer.addHitTarget({ x: 'x', y: 2, width: '3', height: 4 }, action), undefined);
  assert.deepEqual(renderer.hitTargets, [{ x: 0, y: 2, width: 3, height: 4, action }]);

  renderer.addHitTarget(null, action);
  renderer.addHitTarget({ x: 0, y: 0, width: 1, height: 1 }, null);
  assert.equal(renderer.hitTargets.length, 1);

  renderer.suppressHitTargets = true;
  assert.equal(renderer.addHitTarget({ x: 0, y: 0, width: 1, height: 1 }, action), undefined);
  assert.equal(renderer.hitTargets.length, 1);
});

test('getHitTarget/findHitTarget local fallbacks return null without child renderers', () => {
  const renderer = createBareRenderer();
  renderer.setHitTargets([{ x: 0, y: 0, width: 10, height: 10, action: { type: 'enterCity' } }]);
  assert.equal(renderer.getHitTarget({ x: 5, y: 5 }), null);
  assert.equal(renderer.findHitTarget('enterCity'), null);
});

test('withSuppressedHitTargets local fallback invokes the callback without toggling the flag', () => {
  const renderer = createBareRenderer();
  const value = renderer.withSuppressedHitTargets(() => {
    assert.equal(renderer.suppressHitTargets, false);
    renderer.addHitTarget({ x: 0, y: 0, width: 1, height: 1 }, { type: 'inside' });
    return 42;
  });
  assert.equal(value, 42);
  assert.equal(renderer.hitTargets.length, 1);
  assert.equal(renderer.withSuppressedHitTargets(), undefined);
});

test('appendWorldMapRuntimeHitTargets uses the local addHitTarget fallback when bare', () => {
  const renderer = createBareRenderer();
  const action = { type: 'openWorldSite' };
  assert.equal(
    renderer.appendWorldMapRuntimeHitTargets([{ x: 7, y: 8, width: 9, height: 10, action }]),
    true,
  );
  assert.deepEqual(renderer.hitTargets, [{ x: 7, y: 8, width: 9, height: 10, action }]);
});
