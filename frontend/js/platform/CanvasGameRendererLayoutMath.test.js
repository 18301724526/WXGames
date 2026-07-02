const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameRenderer = require('./CanvasGameRenderer');

// Characterization tests for the CanvasGameRenderer pure layout/animation math cluster
// (god-file re-decomposition slice 14). Written against the renderer BEFORE
// CanvasLayoutService was extracted and kept byte-identical afterwards. They pin
// parsePixelValue/easeOutCubic/getTransitionFrame/interpolateRect through the renderer's
// public method names (the delegators child renderers and subclasses call on the host).
// getTransitionFrame reads this.getNow(); tests pin it deterministically by setting
// frameNow on the shared surfaceState clock.

function createRenderer() {
  return new CanvasGameRenderer({ ctx: { scale() {} }, presenter: {} });
}

test('parsePixelValue returns numbers unchanged (including NaN)', () => {
  const renderer = createRenderer();
  assert.equal(renderer.parsePixelValue(42), 42);
  assert.equal(renderer.parsePixelValue(-3.25), -3.25);
  assert.equal(renderer.parsePixelValue(0), 0);
  assert.equal(Number.isNaN(renderer.parsePixelValue(NaN)), true);
});

test('parsePixelValue strips px suffixes and parses numeric strings', () => {
  const renderer = createRenderer();
  assert.equal(renderer.parsePixelValue('18px'), 18);
  assert.equal(renderer.parsePixelValue('3.5px'), 3.5);
  assert.equal(renderer.parsePixelValue('-6px'), -6);
  assert.equal(renderer.parsePixelValue('24'), 24);
});

test('parsePixelValue falls back to 0 for non-parseable input', () => {
  const renderer = createRenderer();
  assert.equal(renderer.parsePixelValue('abc'), 0);
  assert.equal(renderer.parsePixelValue('nullpx'), 0);
  assert.equal(renderer.parsePixelValue(''), 0);
  assert.equal(renderer.parsePixelValue(null), 0);
  assert.equal(renderer.parsePixelValue(undefined), 0);
  assert.equal(renderer.parsePixelValue(true), 0);
});

test('easeOutCubic maps the unit interval with cubic ease-out', () => {
  const renderer = createRenderer();
  assert.equal(renderer.easeOutCubic(0), 0);
  assert.equal(renderer.easeOutCubic(1), 1);
  assert.equal(renderer.easeOutCubic(0.5), 0.875);
  assert.equal(renderer.easeOutCubic(0.25), 0.578125);
});

test('easeOutCubic clamps out-of-range and coerces non-numeric input to 0', () => {
  const renderer = createRenderer();
  assert.equal(renderer.easeOutCubic(-5), 0);
  assert.equal(renderer.easeOutCubic(2), 1);
  assert.equal(renderer.easeOutCubic('0.5'), 0.875);
  assert.equal(renderer.easeOutCubic('abc'), 0);
  assert.equal(renderer.easeOutCubic(null), 0);
  assert.equal(renderer.easeOutCubic(undefined), 0);
  assert.equal(renderer.easeOutCubic(NaN), 0);
});

test('getTransitionFrame returns null without a transition or finite startedAt', () => {
  const renderer = createRenderer();
  renderer.frameNow = 1000;
  assert.equal(renderer.getTransitionFrame(), null);
  assert.equal(renderer.getTransitionFrame(null), null);
  assert.equal(renderer.getTransitionFrame({}), null);
  assert.equal(renderer.getTransitionFrame({ startedAt: 'soon' }), null);
});

test('getTransitionFrame reports eased progress mid-flight', () => {
  const renderer = createRenderer();
  renderer.frameNow = 1000;
  assert.deepEqual(renderer.getTransitionFrame({ startedAt: 890, durationMs: 220 }), {
    progress: 0.5,
    eased: 0.875,
    direction: 1,
  });
});

test('getTransitionFrame normalizes direction to -1/1', () => {
  const renderer = createRenderer();
  renderer.frameNow = 1000;
  assert.equal(
    renderer.getTransitionFrame({ startedAt: 890, durationMs: 220, direction: -3 }).direction,
    -1,
  );
  assert.equal(
    renderer.getTransitionFrame({ startedAt: 890, durationMs: 220, direction: 0 }).direction,
    1,
  );
  assert.equal(
    renderer.getTransitionFrame({ startedAt: 890, durationMs: 220, direction: 'x' }).direction,
    1,
  );
});

test('getTransitionFrame returns null once the transition completes', () => {
  const renderer = createRenderer();
  renderer.frameNow = 1000;
  assert.equal(renderer.getTransitionFrame({ startedAt: 780, durationMs: 220 }), null);
  assert.equal(renderer.getTransitionFrame({ startedAt: 0, durationMs: 220 }), null);
});

test('getTransitionFrame clamps future startedAt to zero progress', () => {
  const renderer = createRenderer();
  renderer.frameNow = 1000;
  assert.deepEqual(renderer.getTransitionFrame({ startedAt: 1200, durationMs: 100 }), {
    progress: 0,
    eased: 0,
    direction: 1,
  });
});

test('getTransitionFrame defaults missing or zero durationMs to 220', () => {
  const renderer = createRenderer();
  renderer.frameNow = 1000;
  assert.equal(renderer.getTransitionFrame({ startedAt: 890 }).progress, 0.5);
  assert.equal(renderer.getTransitionFrame({ startedAt: 890, durationMs: 0 }).progress, 0.5);
});

test('interpolateRect returns the target rect at (default) full progress', () => {
  const renderer = createRenderer();
  const from = { left: 1, top: 2, width: 3, height: 4 };
  const to = { left: 10, top: 20, width: 30, height: 40 };
  const expected = { left: 10, top: 20, width: 30, height: 40, right: 40, bottom: 60 };
  assert.deepEqual(renderer.interpolateRect(from, to, 1), expected);
  assert.deepEqual(renderer.interpolateRect(from, to), expected);
});

test('interpolateRect returns the source rect at zero progress', () => {
  const renderer = createRenderer();
  const from = { left: 1, top: 2, width: 3, height: 4 };
  const to = { left: 10, top: 20, width: 30, height: 40 };
  assert.deepEqual(renderer.interpolateRect(from, to, 0), {
    left: 1,
    top: 2,
    width: 3,
    height: 4,
    right: 4,
    bottom: 6,
  });
});

test('interpolateRect eases between rects (cubic ease-out, not linear)', () => {
  const renderer = createRenderer();
  const from = { left: 0, top: 0, width: 100, height: 50 };
  const to = { left: 80, top: 40, width: 20, height: 10 };
  assert.deepEqual(renderer.interpolateRect(from, to, 0.5), {
    left: 70,
    top: 35,
    width: 30,
    height: 15,
    right: 100,
    bottom: 50,
  });
});

test('interpolateRect treats missing, null, or non-numeric rect fields as 0', () => {
  const renderer = createRenderer();
  assert.deepEqual(renderer.interpolateRect({}, { left: 'x', width: 8 }, 1), {
    left: 0,
    top: 0,
    width: 8,
    height: 0,
    right: 8,
    bottom: 0,
  });
  const zeroRect = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  assert.deepEqual(renderer.interpolateRect(), zeroRect);
  assert.deepEqual(renderer.interpolateRect(null, null, 0.5), zeroRect);
});
