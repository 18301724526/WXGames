const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasLayoutService = require('./CanvasLayoutService');

// Isolated tests for the CanvasLayoutService SHAPE-A module (god-file re-decomposition
// slice 14). One combined file: the planned CanvasAnimationEasing split was merged into
// CanvasLayoutService per the fewer-than-3-functions rule. Behavioral equivalence with
// the pre-extraction renderer bodies is pinned by CanvasGameRendererLayoutMath.test.js;
// this file covers each exported function directly, including the param-lifted `now`
// argument of getTransitionFrame.

test('module is a frozen function bag with the four extracted helpers', () => {
  assert.equal(Object.isFrozen(CanvasLayoutService), true);
  assert.deepEqual(Object.keys(CanvasLayoutService).sort(), [
    'easeOutCubic',
    'getTransitionFrame',
    'interpolateRect',
    'parsePixelValue',
  ]);
});

test('parsePixelValue parses numbers, px strings, and falls back to 0', () => {
  assert.equal(CanvasLayoutService.parsePixelValue(42), 42);
  assert.equal(CanvasLayoutService.parsePixelValue(-3.25), -3.25);
  assert.equal(Number.isNaN(CanvasLayoutService.parsePixelValue(NaN)), true);
  assert.equal(CanvasLayoutService.parsePixelValue('18px'), 18);
  assert.equal(CanvasLayoutService.parsePixelValue('3.5px'), 3.5);
  assert.equal(CanvasLayoutService.parsePixelValue('-6px'), -6);
  assert.equal(CanvasLayoutService.parsePixelValue('24'), 24);
  assert.equal(CanvasLayoutService.parsePixelValue('abc'), 0);
  assert.equal(CanvasLayoutService.parsePixelValue(''), 0);
  assert.equal(CanvasLayoutService.parsePixelValue(null), 0);
  assert.equal(CanvasLayoutService.parsePixelValue(undefined), 0);
});

test('easeOutCubic clamps to the unit interval and eases cubically', () => {
  assert.equal(CanvasLayoutService.easeOutCubic(0), 0);
  assert.equal(CanvasLayoutService.easeOutCubic(1), 1);
  assert.equal(CanvasLayoutService.easeOutCubic(0.5), 0.875);
  assert.equal(CanvasLayoutService.easeOutCubic(0.25), 0.578125);
  assert.equal(CanvasLayoutService.easeOutCubic(-5), 0);
  assert.equal(CanvasLayoutService.easeOutCubic(2), 1);
  assert.equal(CanvasLayoutService.easeOutCubic('0.5'), 0.875);
  assert.equal(CanvasLayoutService.easeOutCubic('abc'), 0);
  assert.equal(CanvasLayoutService.easeOutCubic(NaN), 0);
});

test('getTransitionFrame returns null for missing transitions or startedAt', () => {
  assert.equal(CanvasLayoutService.getTransitionFrame(), null);
  assert.equal(CanvasLayoutService.getTransitionFrame(null, 1000), null);
  assert.equal(CanvasLayoutService.getTransitionFrame({}, 1000), null);
  assert.equal(CanvasLayoutService.getTransitionFrame({ startedAt: 'soon' }, 1000), null);
});

test('getTransitionFrame computes eased progress against the passed now', () => {
  assert.deepEqual(
    CanvasLayoutService.getTransitionFrame({ startedAt: 890, durationMs: 220 }, 1000),
    {
      progress: 0.5,
      eased: 0.875,
      direction: 1,
    },
  );
  const negative = CanvasLayoutService.getTransitionFrame(
    { startedAt: 890, durationMs: 220, direction: -3 },
    1000,
  );
  assert.equal(negative.direction, -1);
});

test('getTransitionFrame returns null at completion and clamps future starts', () => {
  assert.equal(
    CanvasLayoutService.getTransitionFrame({ startedAt: 780, durationMs: 220 }, 1000),
    null,
  );
  assert.deepEqual(
    CanvasLayoutService.getTransitionFrame({ startedAt: 1200, durationMs: 100 }, 1000),
    {
      progress: 0,
      eased: 0,
      direction: 1,
    },
  );
  assert.equal(
    CanvasLayoutService.getTransitionFrame({ startedAt: 890, durationMs: 0 }, 1000).progress,
    0.5,
  );
});

test('interpolateRect eases between rects and derives right/bottom', () => {
  const from = { left: 0, top: 0, width: 100, height: 50 };
  const to = { left: 80, top: 40, width: 20, height: 10 };
  assert.deepEqual(CanvasLayoutService.interpolateRect(from, to, 0.5), {
    left: 70,
    top: 35,
    width: 30,
    height: 15,
    right: 100,
    bottom: 50,
  });
  assert.deepEqual(CanvasLayoutService.interpolateRect(from, to), {
    left: 80,
    top: 40,
    width: 20,
    height: 10,
    right: 100,
    bottom: 50,
  });
});

test('interpolateRect coerces missing, null, or non-numeric fields to 0', () => {
  assert.deepEqual(CanvasLayoutService.interpolateRect({}, { left: 'x', width: 8 }, 1), {
    left: 0,
    top: 0,
    width: 8,
    height: 0,
    right: 8,
    bottom: 0,
  });
  const zeroRect = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  assert.deepEqual(CanvasLayoutService.interpolateRect(), zeroRect);
  assert.deepEqual(CanvasLayoutService.interpolateRect(null, null, 0.5), zeroRect);
});
