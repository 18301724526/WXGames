const test = require('node:test');
const assert = require('node:assert/strict');

const SpineWebglPlayer = require('./SpineWebglPlayer');

function createResizablePlayer(options = {}) {
  const player = new SpineWebglPlayer({
    runtime: { devicePixelRatio: 2 },
    maxDevicePixelRatio: 2,
    logicalWidth: 90,
    logicalHeight: 200,
    ...options,
  });
  player.canvas = { width: 1, height: 1 };
  player.gl = {
    viewportCalls: [],
    viewport(...args) {
      this.viewportCalls.push(args);
    },
  };
  player.mvp = {
    ortho2d() {},
    values: [],
  };
  player.bounds = {
    offset: { x: 0, y: 0 },
    size: { x: 50, y: 100 },
  };
  return player;
}

test('SpineWebglPlayer resize sizes surfaces without getBoundingClientRect from cssWidth/cssHeight', () => {
  // OffscreenCanvas draw surfaces have no getBoundingClientRect; the explicit CSS size must
  // win over logicalWidth (the portrait target rect), which differs from the clip rect.
  const player = createResizablePlayer({ cssWidth: 108, cssHeight: 240 });

  assert.equal(player.resize(), true);
  assert.equal(player.canvas.width, 216);
  assert.equal(player.canvas.height, 480);
});

test('SpineWebglPlayer resize falls back to logical size when no cssWidth is provided', () => {
  const player = createResizablePlayer();

  assert.equal(player.resize(), true);
  assert.equal(player.canvas.width, 180);
  assert.equal(player.canvas.height, 400);
});

test('SpineWebglPlayer fires onFrame after drawing and before scheduling the next frame', () => {
  const events = [];
  const player = new SpineWebglPlayer({
    runtime: {
      devicePixelRatio: 1,
      performance: { now: () => 1000 },
      requestAnimationFrame(_callback) {
        events.push('schedule');
        return 42;
      },
    },
    spine: {
      webgl: {
        Shader: { SAMPLER: 0, MVP_MATRIX: 1 },
      },
    },
    onFrame: () => {
      events.push('onFrame');
    },
  });
  player.canvas = { width: 10, height: 10 };
  player.gl = {
    COLOR_BUFFER_BIT: 16384,
    clearColor() {},
    clear() {},
    viewport() {},
  };
  player.mvp = { ortho2d() {}, values: [] };
  player.bounds = { offset: { x: 0, y: 0 }, size: { x: 5, y: 5 } };
  player.skeleton = { updateWorldTransform() {} };
  player.animationState = {
    update() {},
    apply() {},
  };
  player.shader = {
    bind() {},
    setUniformi() {},
    setUniform4x4f() {},
    unbind() {
      events.push('unbind');
    },
  };
  player.batcher = {
    begin() {},
    end() {
      events.push('batcherEnd');
    },
  };
  player.skeletonRenderer = { draw() {} };

  player.renderFrame();

  assert.deepEqual(
    events,
    ['batcherEnd', 'unbind', 'onFrame', 'schedule'],
    'present hook must run synchronously after the draw, before the task yields',
  );
});
