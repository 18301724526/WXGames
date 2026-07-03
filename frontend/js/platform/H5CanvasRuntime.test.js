const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5CanvasRuntime = require('./H5CanvasRuntime');

function createCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    attributes: {},
    listeners: [],
    children: [],
    parentNode: null,
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
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
      this.children = this.children.filter((item) => item !== child);
      this.children.push(child);
      child.parentNode = this;
    },
    insertBefore(child, reference) {
      this.children = this.children.filter((item) => item !== child);
      const index = this.children.indexOf(reference);
      if (index < 0) this.children.push(child);
      else this.children.splice(index, 0, child);
      child.parentNode = this;
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
      child.parentNode = null;
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

test('H5CanvasRuntime uses browser performance time for animation clocks', () => {
  const runtime = new H5CanvasRuntime({
    runtime: {
      performance: {
        now: () => 1234.5,
      },
    },
  });

  assert.equal(runtime.now(), 1234.5);
  assert.equal(runtime.getEventTime({ timeStamp: 876.25 }), 876.25);
  assert.equal(runtime.getEventTime({}), 1234.5);
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
  assert.deepEqual(runtime.getLayerBackingStoreState('worldMap'), {
    epoch: 2,
    reason: 'init',
    width: 746,
    height: 1140,
    pixelRatio: 1,
  });
});

test('H5CanvasRuntime increments backing-store epoch only when physical canvas identity changes', () => {
  const document = createDocument();
  const viewport = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 1,
    addEventListener() {},
  };
  const runtime = new H5CanvasRuntime({
    document,
    runtime: viewport,
  });
  const layerCanvas = runtime.ensureLayerCanvas('worldMap', { padding: 120 });
  const first = runtime.getLayerBackingStoreState('worldMap');

  runtime.resizeCanvas(layerCanvas);
  const stable = runtime.getLayerBackingStoreState('worldMap');
  viewport.devicePixelRatio = 2;
  runtime.resize();
  const changed = runtime.getLayerBackingStoreState('worldMap');

  assert.equal(stable.epoch, first.epoch);
  assert.equal(changed.epoch, first.epoch + 1);
  assert.equal(changed.pixelRatio, 2);
  assert.equal(changed.width, first.width * 2);
  assert.equal(changed.reason, 'resize');
});

test('H5CanvasRuntime preserves the mature engine physical canvas stack styles', () => {
  const document = createDocument();
  const runtime = new H5CanvasRuntime({
    document,
    runtime: {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 1,
      addEventListener() {},
    },
  });

  const mainCanvas = runtime.ensureCanvas();
  const worldCanvas = runtime.ensureLayerCanvas('worldMap', { zIndex: 997 });

  assert.equal(mainCanvas.style.zIndex, '1000');
  assert.equal(mainCanvas.style.pointerEvents, 'auto');
  assert.equal(mainCanvas.attributes['data-canvas-hud-input'], 'document-capture');
  assert.equal(worldCanvas.style.zIndex, '997');
  assert.equal(worldCanvas.style.pointerEvents, 'none');
});

test('H5CanvasRuntime clips fixed screen overlay layers to their declared rect', () => {
  const document = createDocument();
  const runtime = new H5CanvasRuntime({
    document,
    runtime: {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 1,
      addEventListener() {},
    },
  });

  runtime.ensureCanvas();
  const spineCanvas = runtime.ensureLayerCanvas('tutorialSpine', {
    zIndex: 1001,
    contextType: 'webgl',
    rect: { x: 18, y: 44, width: 108, height: 240 },
  });

  assert.equal(spineCanvas.style.left, '18px');
  assert.equal(spineCanvas.style.top, '119px');
  assert.equal(spineCanvas.style.width, '108px');
  assert.equal(spineCanvas.style.height, '240px');
  assert.deepEqual(runtime.getLayerMetrics('tutorialSpine'), {
    width: 108,
    height: 240,
    viewportWidth: 390,
    viewportHeight: 693,
    browserWidth: 390,
    browserHeight: 844,
    frameX: 0,
    frameY: 75,
    padding: 0,
    rect: { x: 18, y: 44, width: 108, height: 240 },
  });
});

test('H5CanvasRuntime appends layer canvases in physical z-order regardless of ensure order', () => {
  const document = createDocument();
  const runtime = new H5CanvasRuntime({
    document,
    runtime: {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 1,
      addEventListener() {},
    },
  });

  const mainCanvas = runtime.ensureCanvas();
  // The tutorial dialogue layer is ensured FIRST (begin()) but must sit ABOVE the spine
  // layer that is ensured LATER (portrait). DOM order must follow z-index so that
  // WebView compositors which break ties by document order still stack correctly.
  const dialogue = runtime.ensureLayerCanvas('tutorialDialogue', {
    zIndex: 1002,
    contextType: '2d',
    rect: { x: 126, y: 560, width: 288, height: 136 },
  });
  const spine = runtime.ensureLayerCanvas('tutorialSpine', {
    zIndex: 1001,
    contextType: 'webgl',
    rect: { x: 18, y: 44, width: 108, height: 240 },
  });

  const order = document.body.children;
  const mainIndex = order.indexOf(mainCanvas);
  const spineIndex = order.indexOf(spine);
  const dialogueIndex = order.indexOf(dialogue);

  assert.ok(mainIndex >= 0 && spineIndex >= 0 && dialogueIndex >= 0);
  assert.ok(mainIndex < spineIndex, 'mainHud (1000) must precede tutorialSpine (1001) in DOM order');
  assert.ok(spineIndex < dialogueIndex, 'tutorialSpine (1001) must precede tutorialDialogue (1002) in DOM order');
});

test('H5CanvasRuntime orders layer inserts even when host.children is a live HTMLCollection', () => {
  // In the browser host.children is an HTMLCollection (array-like, not an Array). The ordering
  // helper must not depend on Array.isArray, or it silently degrades to appendChild and the
  // spine/dialogue stacking regresses. This host mimics that live-collection shape.
  const document = createDocument();
  const runtime = new H5CanvasRuntime({
    document,
    runtime: { innerWidth: 390, innerHeight: 844, devicePixelRatio: 1, addEventListener() {} },
  });

  const stored = [];
  const higher = { style: { zIndex: '1002' } };
  const host = {
    get children() {
      // array-like collection object, deliberately NOT an Array instance
      const collection = { length: stored.length };
      stored.forEach((item, index) => {
        collection[index] = item;
      });
      collection[Symbol.iterator] = Array.prototype[Symbol.iterator];
      return collection;
    },
    appendChild(child) {
      stored.push(child);
    },
    insertBefore(child, reference) {
      const index = stored.indexOf(reference);
      if (index < 0) stored.push(child);
      else stored.splice(index, 0, child);
    },
  };
  stored.push(higher);
  runtime.canvas = null;
  runtime.layerCanvases = new Map([['tutorialDialogue', higher]]);

  const lower = { style: { zIndex: '1001' } };
  runtime.insertLayerElementInStackOrder(host, lower, '1001');

  assert.equal(stored.indexOf(lower), 0, 'lower z-index element must be inserted before the higher one');
  assert.equal(stored.indexOf(higher), 1);
});

function createRecordingContext2d() {
  const ctx = {
    calls: [],
    setTransform(...args) {
      this.calls.push(['setTransform', ...args]);
    },
    clearRect(...args) {
      this.calls.push(['clearRect', ...args]);
    },
    drawImage(...args) {
      this.calls.push(['drawImage', ...args]);
    },
  };
  return ctx;
}

class FakeOffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.isFakeOffscreen = true;
  }

  getContext(type) {
    if (type === 'webgl') return { isFakeGl: true };
    return null;
  }
}

function createOffscreenRuntime() {
  const document = createDocument();
  const recordingCtxByCanvas = new Map();
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = originalCreateElement(tag);
    const recordingCtx = createRecordingContext2d();
    element.getContext = (type) => {
      if (type === '2d') return recordingCtx;
      return null;
    };
    recordingCtxByCanvas.set(element, recordingCtx);
    return element;
  };
  const runtime = new H5CanvasRuntime({
    document,
    runtime: {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 1,
      OffscreenCanvas: FakeOffscreenCanvas,
      addEventListener() {},
    },
  });
  return { runtime, document, recordingCtxByCanvas };
}

test('H5CanvasRuntime gives webgl layers an offscreen draw surface and keeps the DOM canvas 2d', () => {
  const { runtime } = createOffscreenRuntime();

  runtime.ensureCanvas();
  const surface = runtime.ensureLayerCanvas('tutorialSpine', {
    zIndex: 1001,
    contextType: 'webgl',
    pixelRatio: 2,
    rect: { x: 18, y: 44, width: 108, height: 240 },
  });
  const domCanvas = runtime.getLayerCanvas('tutorialSpine');

  assert.equal(surface instanceof FakeOffscreenCanvas, true, 'ensureLayerCanvas must return the offscreen draw surface');
  assert.notEqual(surface, domCanvas, 'DOM presentation canvas and draw surface are distinct');
  assert.equal(domCanvas._drawSurface, surface);
  assert.equal(runtime.getLayerDrawSurface('tutorialSpine'), surface);
  // surface tracks the presentation canvas backing-store size (fixedRect * pixelRatio)
  assert.equal(surface.width, domCanvas.width);
  assert.equal(surface.height, domCanvas.height);
  assert.equal(domCanvas.width, 216);
  assert.equal(domCanvas.height, 480);
  // re-ensure returns the SAME surface (stable identity for player reuse checks)
  const again = runtime.ensureLayerCanvas('tutorialSpine', {
    zIndex: 1001,
    contextType: 'webgl',
    pixelRatio: 2,
    rect: { x: 18, y: 44, width: 108, height: 240 },
  });
  assert.equal(again, surface);
});

test('H5CanvasRuntime presentLayer blits the offscreen surface onto the 2d presentation canvas', () => {
  const { runtime, recordingCtxByCanvas } = createOffscreenRuntime();

  runtime.ensureCanvas();
  const surface = runtime.ensureLayerCanvas('worldFog', {
    zIndex: 998,
    contextType: 'webgl',
    padding: 120,
  });
  const domCanvas = runtime.getLayerCanvas('worldFog');
  const ctx = recordingCtxByCanvas.get(domCanvas);

  assert.equal(runtime.presentLayer('worldFog'), true);
  assert.deepEqual(ctx.calls[0], ['setTransform', 1, 0, 0, 1, 0, 0], 'present blits in raw pixel space');
  assert.deepEqual(ctx.calls[1], ['clearRect', 0, 0, domCanvas.width, domCanvas.height]);
  assert.deepEqual(ctx.calls[2], ['drawImage', surface, 0, 0]);
});

test('H5CanvasRuntime presentLayer no-ops for 2d layers and missing surfaces', () => {
  const { runtime } = createOffscreenRuntime();

  runtime.ensureCanvas();
  const mapCanvas = runtime.ensureLayerCanvas('worldMap', { zIndex: 997, padding: 120 });

  assert.equal(mapCanvas._drawSurface, undefined, '2d layers draw directly on the layer canvas');
  assert.equal(runtime.presentLayer('worldMap'), false);
  assert.equal(runtime.presentLayer('missingLayer'), false);
});

test('H5CanvasRuntime falls back to the DOM canvas when OffscreenCanvas is unavailable', () => {
  const document = createDocument();
  const runtime = new H5CanvasRuntime({
    document,
    runtime: {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 1,
      addEventListener() {},
    },
  });

  runtime.ensureCanvas();
  const canvas = runtime.ensureLayerCanvas('worldFog', {
    zIndex: 998,
    contextType: 'webgl',
    padding: 120,
  });

  assert.equal(canvas, runtime.getLayerCanvas('worldFog'), 'without OffscreenCanvas consumers keep the DOM canvas');
  assert.equal(runtime.presentLayer('worldFog'), false);
});

test('H5CanvasRuntime resize keeps offscreen surfaces in sync with the presentation canvas', () => {
  const viewport = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 1,
    OffscreenCanvas: FakeOffscreenCanvas,
    addEventListener() {},
  };
  const document = createDocument();
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = originalCreateElement(tag);
    element.getContext = (type) => (type === '2d' ? createRecordingContext2d() : null);
    return element;
  };
  const runtime = new H5CanvasRuntime({ document, runtime: viewport });

  runtime.ensureCanvas();
  const surface = runtime.ensureLayerCanvas('worldFog', {
    zIndex: 998,
    contextType: 'webgl',
    padding: 120,
  });
  const domCanvas = runtime.getLayerCanvas('worldFog');
  const initialWidth = surface.width;

  viewport.devicePixelRatio = 2;
  runtime.resize();

  assert.equal(surface.width, domCanvas.width, 'surface width follows the resized presentation canvas');
  assert.equal(surface.height, domCanvas.height);
  assert.equal(surface.width, initialWidth * 2);
});

test('H5CanvasRuntime browser dependencies load before the runtime script', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const viewportIndex = html.indexOf('js/platform/H5CanvasViewport.js');
  const inputIndex = html.indexOf('js/platform/H5CanvasInputController.js');
  const runtimeIndex = html.indexOf('js/platform/H5CanvasRuntime.js');

  assert.ok(viewportIndex >= 0);
  assert.ok(inputIndex >= 0);
  assert.ok(runtimeIndex >= 0);
  assert.ok(viewportIndex < runtimeIndex);
  assert.ok(inputIndex < runtimeIndex);
});
