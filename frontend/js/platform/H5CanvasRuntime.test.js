const test = require('node:test');
const assert = require('node:assert/strict');

const H5CanvasRuntime = require('./H5CanvasRuntime');

function createCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    listeners: [],
    children: [],
    parentNode: null,
    setAttribute() {},
    addEventListener(type, handler) {
      this.listeners.push([type, handler]);
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
      child.parentNode = null;
    },
    getContext() {
      return {
        setTransform() {},
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
  return canvas;
}

function createDocument() {
  const body = {
    children: [],
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
    },
  };
  return {
    body,
    documentElement: {},
    createElement(tag) {
      const element = createCanvas();
      element.tagName = tag;
      return element;
    },
    addEventListener() {},
  };
}

test('H5CanvasRuntime fits a centered 9:16 game frame inside wide browser viewports', () => {
  const canvas = createCanvas();
  const runtime = new H5CanvasRuntime({
    canvas,
    runtime: {
      innerWidth: 1600,
      innerHeight: 900,
      devicePixelRatio: 2,
      addEventListener() {},
    },
  });

  const size = runtime.resize();

  assert.deepEqual(size, { width: 506, height: 900, pixelRatio: 2 });
  assert.deepEqual(runtime.frameRect, { x: 547, y: 0, width: 506, height: 900, viewportWidth: 1600, viewportHeight: 900 });
  assert.equal(canvas.style.left, '547px');
  assert.equal(canvas.style.top, '0px');
  assert.equal(canvas.style.width, '506px');
  assert.equal(canvas.style.height, '900px');
  assert.equal(canvas.width, 1012);
  assert.equal(canvas.height, 1800);
  assert.deepEqual(runtime.toCanvasPoint({ clientX: 647, clientY: 250 }), { x: 100, y: 250 });
});

test('H5CanvasRuntime centers the 9:16 game frame inside tall browser viewports', () => {
  const canvas = createCanvas();
  const runtime = new H5CanvasRuntime({
    canvas,
    runtime: {
      innerWidth: 360,
      innerHeight: 1000,
      devicePixelRatio: 1,
      addEventListener() {},
    },
  });

  runtime.resize();

  assert.deepEqual(runtime.frameRect, { x: 0, y: 180, width: 360, height: 640, viewportWidth: 360, viewportHeight: 1000 });
  assert.equal(canvas.style.left, '0px');
  assert.equal(canvas.style.top, '180px');
  assert.equal(canvas.style.width, '360px');
  assert.equal(canvas.style.height, '640px');
  assert.deepEqual(runtime.toCanvasPoint({ clientX: 90, clientY: 340 }), { x: 90, y: 160 });
});

test('H5CanvasRuntime aligns padded layer canvases to the same 9:16 frame', () => {
  const document = createDocument();
  const runtime = new H5CanvasRuntime({
    document,
    runtime: {
      innerWidth: 1600,
      innerHeight: 900,
      devicePixelRatio: 1,
      addEventListener() {},
    },
  });

  const mainCanvas = runtime.ensureCanvas();
  const layerCanvas = runtime.ensureLayerCanvas('worldMap', { padding: 120 });
  const layerHost = runtime.layerHosts.get('worldMap');

  assert.equal(mainCanvas.style.left, '547px');
  assert.equal(mainCanvas.style.width, '506px');
  assert.equal(layerHost.style.left, '547px');
  assert.equal(layerHost.style.top, '0px');
  assert.equal(layerHost.style.width, '506px');
  assert.equal(layerHost.style.height, '900px');
  assert.equal(layerHost.style.overflow, 'hidden');
  assert.equal(layerCanvas.parentNode, layerHost);
  assert.equal(layerCanvas.style.position, 'absolute');
  assert.equal(layerCanvas.style.left, '-120px');
  assert.equal(layerCanvas.style.top, '-120px');
  assert.equal(layerCanvas.style.width, '746px');
  assert.equal(layerCanvas.style.height, '1140px');
  assert.deepEqual(runtime.getLayerMetrics('worldMap'), {
    width: 746,
    height: 1140,
    viewportWidth: 506,
    viewportHeight: 900,
    browserWidth: 1600,
    browserHeight: 900,
    frameX: 547,
    frameY: 0,
    padding: 120,
    rect: null,
  });
});
