const test = require('node:test');
const assert = require('node:assert/strict');

const H5CanvasViewport = require('./H5CanvasViewport');

function assertNearlyEqual(actual, expected, epsilon = 0.000001) {
  assert.equal(Math.abs(actual - expected) <= epsilon, true);
}

function createCanvas() {
  return {
    width: 0,
    height: 0,
    style: {},
    _viewportPadding: 0,
    getContext() {
      return {
        transforms: [],
        setTransform(...args) {
          this.transforms.push(args);
        },
      };
    },
    getBoundingClientRect() {
      return {
        left: Number.parseFloat(this.style.left) || 0,
        top: Number.parseFloat(this.style.top) || 0,
        width: Number.parseFloat(this.style.width) || 0,
        height: Number.parseFloat(this.style.height) || 0,
      };
    },
  };
}

test('H5CanvasViewport computes centered 9:16 frames for wide and tall browsers', () => {
  assert.deepEqual(H5CanvasViewport.getViewportFrame({ width: 1600, height: 900 }), {
    x: 547,
    y: 0,
    width: 506,
    height: 900,
    viewportWidth: 1600,
    viewportHeight: 900,
  });
  assert.deepEqual(H5CanvasViewport.getViewportFrame({ width: 360, height: 1000 }), {
    x: 0,
    y: 180,
    width: 360,
    height: 640,
    viewportWidth: 360,
    viewportHeight: 1000,
  });
});

test('H5CanvasViewport can opt out of portrait frame locking', () => {
  assert.deepEqual(H5CanvasViewport.getViewportFrame({ width: 1600, height: 900 }, { lockAspectRatio: false }), {
    x: 0,
    y: 0,
    width: 1600,
    height: 900,
    viewportWidth: 1600,
    viewportHeight: 900,
  });
});

test('H5CanvasViewport resizes padded canvases and converts browser points into game points', () => {
  const canvas = createCanvas();
  H5CanvasViewport.applyCanvasLayerStyle(canvas, { padding: 120, zIndex: 777 });
  const state = {
    width: 506,
    height: 900,
    viewportWidth: 1600,
    viewportHeight: 900,
    pixelRatio: 2,
    frameRect: { x: 547, y: 0, width: 506, height: 900, viewportWidth: 1600, viewportHeight: 900 },
  };

  H5CanvasViewport.resizeCanvas(canvas, state);

  assert.equal(canvas.style.zIndex, '777');
  assert.equal(canvas.style.left, '427px');
  assert.equal(canvas.style.top, '-120px');
  assert.equal(canvas.style.width, '746px');
  assert.equal(canvas.style.height, '1140px');
  assert.equal(canvas.width, 1492);
  assert.equal(canvas.height, 2280);
  const point = H5CanvasViewport.toCanvasPoint(canvas, state, { clientX: 647, clientY: 250 });
  assertNearlyEqual(point.x, (647 - 427) * (506 / 746));
  assertNearlyEqual(point.y, (250 + 120) * (900 / 1140));
});
