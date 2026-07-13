const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasLayerRegistry = require('../CanvasLayerRegistry');
const H5CanvasRuntime = require('../H5CanvasRuntime');
const ModalStore = require('../../state/ModalStore');
const TutorialGuideController = require('../../tutorial/TutorialGuideController');
const { makeModalOwnerHost } = require('../../../test-support/CanvasOwnerTestHarness');
const TutorialCanvasRenderer = require('./TutorialCanvasRenderer');
const TutorialHighlightLayer = require('./TutorialHighlightLayer');

test.afterEach(() => {
  ModalStore.closeAll();
});

function parseColor(value) {
  const text = String(value || '').trim().toLowerCase();
  const rgba = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgba) {
    return [
      Math.max(0, Math.min(255, Math.round(Number(rgba[1]) || 0))),
      Math.max(0, Math.min(255, Math.round(Number(rgba[2]) || 0))),
      Math.max(0, Math.min(255, Math.round(Number(rgba[3]) || 0))),
      Math.max(0, Math.min(255, Math.round((rgba[4] === undefined ? 1 : Number(rgba[4])) * 255))),
    ];
  }
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const valueText = hex[1].length === 3
      ? hex[1].split('').map((part) => `${part}${part}`).join('')
      : hex[1];
    return [
      Number.parseInt(valueText.slice(0, 2), 16),
      Number.parseInt(valueText.slice(2, 4), 16),
      Number.parseInt(valueText.slice(4, 6), 16),
      255,
    ];
  }
  return [0, 0, 0, 0];
}

class PixelContext2d {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.transform = [1, 0, 0, 1, 0, 0];
    this.pathRect = null;
  }

  setTransform(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.transform = [a, b, c, d, e, f];
  }

  scale(x = 1, y = x) {
    this.transform[0] *= x;
    this.transform[3] *= y;
  }

  toBackingRect(x, y, width, height) {
    const [scaleX, , , scaleY, offsetX, offsetY] = this.transform;
    const left = Math.floor(x * scaleX + offsetX);
    const top = Math.floor(y * scaleY + offsetY);
    const right = Math.ceil((x + width) * scaleX + offsetX);
    const bottom = Math.ceil((y + height) * scaleY + offsetY);
    return { left, top, right, bottom };
  }

  blendPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    const index = (y * this.canvas.width + x) * 4;
    const sourceAlpha = (color[3] / 255) * Math.max(0, Math.min(1, Number(this.globalAlpha) || 0));
    const destinationAlpha = this.canvas.pixels[index + 3] / 255;
    const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
    if (outputAlpha <= 0) {
      this.canvas.pixels.fill(0, index, index + 4);
      return;
    }
    for (let channel = 0; channel < 3; channel += 1) {
      const source = color[channel] / 255;
      const destination = this.canvas.pixels[index + channel] / 255;
      this.canvas.pixels[index + channel] = Math.round(
        ((source * sourceAlpha) + (destination * destinationAlpha * (1 - sourceAlpha)))
        / outputAlpha
        * 255,
      );
    }
    this.canvas.pixels[index + 3] = Math.round(outputAlpha * 255);
  }

  paintRect(x, y, width, height, color) {
    const rect = this.toBackingRect(x, y, width, height);
    for (let py = Math.max(0, rect.top); py < Math.min(this.canvas.height, rect.bottom); py += 1) {
      for (let px = Math.max(0, rect.left); px < Math.min(this.canvas.width, rect.right); px += 1) {
        this.blendPixel(px, py, color);
      }
    }
  }

  clearRect(x, y, width, height) {
    const rect = this.toBackingRect(x, y, width, height);
    for (let py = Math.max(0, rect.top); py < Math.min(this.canvas.height, rect.bottom); py += 1) {
      for (let px = Math.max(0, rect.left); px < Math.min(this.canvas.width, rect.right); px += 1) {
        const index = (py * this.canvas.width + px) * 4;
        this.canvas.pixels.fill(0, index, index + 4);
      }
    }
  }

  fillRect(x, y, width, height) {
    this.paintRect(x, y, width, height, parseColor(this.fillStyle));
  }

  beginPath() {
    this.pathRect = null;
  }

  rect(x, y, width, height) {
    this.pathRect = { x, y, width, height };
  }

  roundRect(x, y, width, height) {
    this.rect(x, y, width, height);
  }

  stroke() {
    if (!this.pathRect) return;
    const { x, y, width, height } = this.pathRect;
    const thickness = Math.max(1, Number(this.lineWidth) || 1);
    const color = parseColor(this.strokeStyle);
    this.paintRect(x, y, width, thickness, color);
    this.paintRect(x, y + height - thickness, width, thickness, color);
    this.paintRect(x, y, thickness, height, color);
    this.paintRect(x + width - thickness, y, thickness, height, color);
  }

  drawImage(source, ...args) {
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = source.width;
    let sourceHeight = source.height;
    let targetX = 0;
    let targetY = 0;
    let targetWidth = source.width;
    let targetHeight = source.height;
    if (args.length === 2) {
      [targetX, targetY] = args;
    } else if (args.length === 4) {
      [targetX, targetY, targetWidth, targetHeight] = args;
    } else if (args.length === 8) {
      [sourceX, sourceY, sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight] = args;
    }
    const targetRect = this.toBackingRect(targetX, targetY, targetWidth, targetHeight);
    const width = Math.max(1, targetRect.right - targetRect.left);
    const height = Math.max(1, targetRect.bottom - targetRect.top);
    for (let targetOffsetY = 0; targetOffsetY < height; targetOffsetY += 1) {
      const sourcePixelY = Math.max(0, Math.min(
        source.height - 1,
        Math.floor(sourceY + (targetOffsetY / height) * sourceHeight),
      ));
      for (let targetOffsetX = 0; targetOffsetX < width; targetOffsetX += 1) {
        const sourcePixelX = Math.max(0, Math.min(
          source.width - 1,
          Math.floor(sourceX + (targetOffsetX / width) * sourceWidth),
        ));
        const sourceIndex = (sourcePixelY * source.width + sourcePixelX) * 4;
        this.blendPixel(
          targetRect.left + targetOffsetX,
          targetRect.top + targetOffsetY,
          source.pixels.slice(sourceIndex, sourceIndex + 4),
        );
      }
    }
  }

  save() {}
  restore() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  arc() {}
  ellipse() {}
  fill() {}
  clip() {}
  translate() {}
  rotate() {}
}

class PixelCanvas {
  constructor(width = 1, height = 1) {
    this._width = 0;
    this._height = 0;
    this.pixels = new Uint8ClampedArray(0);
    this.style = {};
    this.attributes = {};
    this.listeners = [];
    this.children = [];
    this.parentNode = null;
    this.ctx2d = new PixelContext2d(this);
    this.width = width;
    this.height = height;
  }

  get width() { return this._width; }
  set width(value) {
    this._width = Math.max(0, Math.floor(Number(value) || 0));
    this.resetPixels();
  }

  get height() { return this._height; }
  set height(value) {
    this._height = Math.max(0, Math.floor(Number(value) || 0));
    this.resetPixels();
  }

  resetPixels() {
    this.pixels = new Uint8ClampedArray(this._width * this._height * 4);
  }

  getContext(type) {
    return type === '2d' ? this.ctx2d : null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, handler) {
    this.listeners.push([type, handler]);
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
  }

  getBoundingClientRect() {
    return {
      left: Number.parseFloat(this.style.left) || 0,
      top: Number.parseFloat(this.style.top) || 0,
      width: Number.parseFloat(this.style.width) || this.width,
      height: Number.parseFloat(this.style.height) || this.height,
    };
  }
}

function createPixelDocument() {
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
  };
  return {
    body,
    documentElement: {},
    createElement(tag) {
      const element = new PixelCanvas(1, 1);
      element.tagName = tag;
      return element;
    },
    addEventListener() {},
  };
}

function createRuntime({ width = 180, height = 180, pixelRatio = 1 } = {}) {
  const document = createPixelDocument();
  const browserRuntime = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: pixelRatio,
    OffscreenCanvas: PixelCanvas,
    addEventListener() {},
  };
  const runtime = new H5CanvasRuntime({
    document,
    runtime: browserRuntime,
    lockAspectRatio: false,
  });
  return { document, browserRuntime, runtime };
}

function createTutorialHost(runtime, mainCtx, overrides = {}) {
  const hitTargets = [];
  const host = {
    width: Number(runtime?.width) || 180,
    height: Number(runtime?.height) || 180,
    ctx: mainCtx,
    hitTargets,
    presenter: {
      buildTutorialHighlightViewState() {
        return {
          overlay: { left: '40px', top: '45px', width: '70px', height: '50px' },
          bubble: { left: '24px', top: '108px' },
          pointer: { left: '82px', top: '96px' },
        };
      },
    },
    addHitTarget(rect, action) {
      hitTargets.push({ rect, action });
    },
    drawPanel(x, y, width, height, options = {}) {
      if (options.fill) {
        this.ctx.fillStyle = options.fill;
        this.ctx.fillRect(x, y, width, height);
      }
      if (options.stroke) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, width, height);
        this.ctx.strokeStyle = options.stroke;
        this.ctx.stroke();
      }
    },
    drawText(text, x, y, options = {}) {
      this.ctx.fillStyle = String(text) === '\u{1f447}' ? '#ff3344' : (options.color || '#000000');
      this.ctx.fillRect(x - 3, y - 3, 7, 7);
    },
    drawTextLines(lines, x, y, options = {}) {
      lines.forEach((line, index) => this.drawText(
        line,
        x,
        y + index * (options.lineHeight || 18),
        options,
      ));
    },
    getNow() { return 1000; },
    interpolateRect(fromRect, toRect) { return toRect || fromRect; },
    parsePixelValue(value) {
      const parsed = Number(String(value ?? '').replace('px', ''));
      return Number.isFinite(parsed) ? parsed : 0;
    },
    roundRectPath(x, y, width, height) {
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
    },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  if (runtime) {
    host.h5Runtime = runtime;
    host.ensureCanvasLayer = (name, layerOverrides = {}) => runtime.ensureLayerCanvas(
      name,
      CanvasLayerRegistry.getLayerOptions(name, layerOverrides),
    );
  }
  return host;
}

function getPixel(canvas, x, y) {
  const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)));
  const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)));
  const index = (py * canvas.width + px) * 4;
  return Array.from(canvas.pixels.slice(index, index + 4));
}

function countGoldPerimeterPixels(canvas, rect, band = 4) {
  let count = 0;
  const left = Math.floor(rect.x - band);
  const top = Math.floor(rect.y - band);
  const right = Math.ceil(rect.x + rect.width + band);
  const bottom = Math.ceil(rect.y + rect.height + band);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const onPerimeter = x <= rect.x + band
        || x >= rect.x + rect.width - band
        || y <= rect.y + band
        || y >= rect.y + rect.height - band;
      if (!onPerimeter) continue;
      const [red, green, blue, alpha] = getPixel(canvas, x, y);
      if (red >= 200 && green >= 150 && blue <= 96 && alpha >= 180) count += 1;
    }
  }
  return count;
}

function countMatchingPixels(canvas, predicate, rect = null) {
  const left = Math.max(0, Math.floor(rect?.x || 0));
  const top = Math.max(0, Math.floor(rect?.y || 0));
  const right = Math.min(canvas.width, Math.ceil(rect ? rect.x + rect.width : canvas.width));
  const bottom = Math.min(canvas.height, Math.ceil(rect ? rect.y + rect.height : canvas.height));
  let count = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (predicate(getPixel(canvas, x, y), x, y)) count += 1;
    }
  }
  return count;
}

function getHitActionAt(hitTargets, x, y) {
  for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
    const target = hitTargets[index] || {};
    const rect = target.rect || target;
    if (
      x >= Number(rect.x ?? rect.left)
      && y >= Number(rect.y ?? rect.top)
      && x <= Number(rect.x ?? rect.left) + Number(rect.width)
      && y <= Number(rect.y ?? rect.top) + Number(rect.height)
    ) {
      return target.action || null;
    }
  }
  return null;
}

function projectStep23Highlight() {
  ModalStore.closeAll();
  const target = {
    x: 40,
    y: 45,
    width: 70,
    height: 50,
    action: { type: 'openFamousPersonDetail', personId: 'fp-scout' },
  };
  let projection = null;
  const shell = makeModalOwnerHost({
    getCanvasTarget(type, predicate) {
      if (type !== 'openFamousPersonDetail') return null;
      return !predicate || predicate(target.action) ? target : null;
    },
    showTutorialHighlight(projectedTarget, message, options) {
      projection = { target: projectedTarget, message, options };
      return true;
    },
    hideTutorialHighlight() {
      projection = null;
      return true;
    },
  });
  const game = makeModalOwnerHost({
    tutorial: {
      completed: false,
      currentStep: TutorialGuideController.TUTORIAL_STEPS.famousPanelOpened,
      grants: { scoutFamousPerson: { personId: 'fp-scout' } },
    },
    state: {
      currentTab: 'civilization',
      famousPersons: {
        people: [{
          id: 'fp-scout',
          archetype: 'scout',
          abilityArchetype: 'scout',
          quality: 'great',
        }],
      },
    },
    renderCanvasSurface() {},
  });
  game.canvasShell = shell;
  shell.lastGame = game;
  game.openBlockingPanelSnapshot('showFamousPersons', true);
  const controller = new TutorialGuideController({ game });
  controller.sync(game.tutorial);
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.ok(projection);
  const rect = {
    left: projection.target.x,
    top: projection.target.y,
    width: projection.target.width,
    height: projection.target.height,
  };
  return {
    controller,
    projection,
    highlight: {
      rect,
      message: projection.message,
      allowedAction: projection.options.allowedAction,
      targetAction: projection.target.action,
      pulseStartedAt: 900,
    },
  };
}

test('final stage composite keeps tutorial gold perimeter above an opaque panel overlay', () => {
  const { runtime } = createRuntime();
  const mainHud = runtime.ensureLayerCanvas(
    'mainHud',
    CanvasLayerRegistry.getLayerOptions('mainHud'),
  );
  const panelOverlay = runtime.ensureLayerCanvas(
    'panelOverlay',
    CanvasLayerRegistry.getLayerOptions('panelOverlay'),
  );
  const host = createTutorialHost(runtime, mainHud.getContext('2d'));
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } },
  });

  renderer.renderTutorialHighlight({
    rect: { left: 40, top: 45, width: 70, height: 50 },
    message: 'Open the scout card.',
    allowedAction: { type: 'openFamousPersonDetail', personId: 'fp-scout' },
    pulseStartedAt: 900,
  });
  const panelCtx = panelOverlay.getContext('2d');
  panelCtx.fillStyle = '#263547';
  panelCtx.fillRect(0, 0, runtime.width, runtime.height);

  assert.equal(runtime.compositeStage(), true);
  const goldCount = countGoldPerimeterPixels(runtime.canvas, {
    x: 40,
    y: 45,
    width: 70,
    height: 50,
  });
  assert.ok(goldCount >= 24, `expected final composite gold perimeter >= 24, got ${goldCount}`);
});

test('TutorialHighlightLayer owns an independent context and restores the main HUD owner', () => {
  const { runtime } = createRuntime();
  const mainHud = runtime.ensureLayerCanvas(
    'mainHud',
    CanvasLayerRegistry.getLayerOptions('mainHud'),
  );
  const mainCtx = mainHud.getContext('2d');
  const host = createTutorialHost(runtime, mainCtx);
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } },
  });

  const highlightCtx = TutorialHighlightLayer.begin(renderer);
  const highlightCanvas = runtime.getLayerCanvas('tutorialHighlight');

  assert.equal(highlightCtx, highlightCanvas.getContext('2d'));
  assert.deepEqual(highlightCanvas._fixedRect, { x: 0, y: 0, width: 180, height: 180 });
  assert.equal(CanvasLayerRegistry.getLayer('tutorialHighlight').contextType, '2d');
  assert.equal(host.ctx, mainCtx);
  TutorialHighlightLayer.withHighlightContext(renderer, highlightCtx, () => {
    assert.equal(renderer.ctx, highlightCtx);
    assert.equal(host.ctx, highlightCtx);
  });
  assert.equal(renderer.highlightCtx, undefined);
  assert.equal(host.ctx, mainCtx);

  highlightCtx.fillStyle = '#ffd700';
  highlightCtx.fillRect(4, 4, 12, 12);
  assert.equal(TutorialHighlightLayer.clear(renderer, true), true);
  assert.equal(runtime.getLayerCompositeState('tutorialHighlight').visible, false);
  assert.equal(countMatchingPixels(highlightCanvas, ([, , , alpha]) => alpha > 0), 0);
});

test('step23 famous-card highlight preserves target identity and renders all cues in the final frame', () => {
  const { projection, highlight } = projectStep23Highlight();
  assert.deepEqual(projection.options.allowedAction, {
    type: 'openFamousPersonDetail',
    personId: 'fp-scout',
  });
  assert.deepEqual(projection.target.action, projection.options.allowedAction);
  assert.deepEqual(highlight.rect, { left: 40, top: 45, width: 70, height: 50 });

  const { runtime } = createRuntime();
  const mainHud = runtime.ensureLayerCanvas(
    'mainHud',
    CanvasLayerRegistry.getLayerOptions('mainHud'),
  );
  const panelOverlay = runtime.ensureLayerCanvas(
    'panelOverlay',
    CanvasLayerRegistry.getLayerOptions('panelOverlay'),
  );
  const host = createTutorialHost(runtime, mainHud.getContext('2d'));
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } },
  });
  const panelCtx = panelOverlay.getContext('2d');
  panelCtx.fillStyle = '#263547';
  panelCtx.fillRect(0, 0, runtime.width, runtime.height);

  assert.equal(renderer.renderTutorialHighlight(highlight), true);
  assert.equal(runtime.compositeStage(), true);

  const finalCanvas = runtime.canvas;
  const goldCount = countGoldPerimeterPixels(finalCanvas, { x: 40, y: 45, width: 70, height: 50 });
  const bubbleCount = countMatchingPixels(
    finalCanvas,
    ([red, green, blue, alpha]) => red >= 235 && green >= 220 && blue >= 145 && alpha >= 200,
    { x: 24, y: 108, width: 150, height: 60 },
  );
  const textCount = countMatchingPixels(
    finalCanvas,
    ([red, green, blue, alpha]) => red >= 40 && red <= 100 && green <= 80 && blue <= 24 && alpha >= 200,
    { x: 34, y: 116, width: 12, height: 12 },
  );
  const fingerCount = countMatchingPixels(
    finalCanvas,
    ([red, green, blue, alpha]) => red >= 200 && green <= 100 && blue <= 120 && alpha >= 200,
    { x: 88, y: 103, width: 14, height: 14 },
  );

  assert.ok(goldCount >= 24, `expected step23 gold perimeter >= 24, got ${goldCount}`);
  assert.ok(bubbleCount >= 24, `expected visible tutorial bubble pixels, got ${bubbleCount}`);
  assert.ok(textCount >= 8, `expected visible tutorial text pixels, got ${textCount}`);
  assert.ok(fingerCount >= 12, `expected visible tutorial finger pixels, got ${fingerCount}`);
});

test('step23 guide input stays on the main hit-target path and blocks every non-target surface', () => {
  const { highlight } = projectStep23Highlight();
  const { runtime } = createRuntime();
  const mainHud = runtime.ensureLayerCanvas(
    'mainHud',
    CanvasLayerRegistry.getLayerOptions('mainHud'),
  );
  const host = createTutorialHost(runtime, mainHud.getContext('2d'));
  host.hitTargets.push(
    { rect: { x: 118, y: 48, width: 42, height: 52 }, action: { type: 'openFamousPersonDetail', personId: 'fp-other' } },
    { rect: { x: 8, y: 128, width: 40, height: 28 }, action: { type: 'closeFamousPersons' } },
    { rect: { x: 4, y: 4, width: 32, height: 24 }, action: { type: 'switchTab', tab: 'resources' } },
  );
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } },
  });

  renderer.renderTutorialHighlight(highlight);

  assert.deepEqual(getHitActionAt(host.hitTargets, 72, 70), {
    type: 'openFamousPersonDetail',
    personId: 'fp-scout',
  });
  assert.equal(getHitActionAt(host.hitTargets, 132, 70).type, 'blockCanvasModal');
  assert.equal(getHitActionAt(host.hitTargets, 24, 140).type, 'blockCanvasModal');
  assert.equal(getHitActionAt(host.hitTargets, 16, 12).type, 'blockCanvasModal');
  assert.equal(CanvasLayerRegistry.getLayer('tutorialHighlight').inputSurface, false);
  assert.equal(CanvasLayerRegistry.getLayer('tutorialHighlight').pointerEvents, 'none');
});

test('highlight lifecycle clears old steps, hide, panel close, and resized DPR backing stores', () => {
  const { runtime, browserRuntime } = createRuntime();
  const mainHud = runtime.ensureLayerCanvas(
    'mainHud',
    CanvasLayerRegistry.getLayerOptions('mainHud'),
  );
  const panelOverlay = runtime.ensureLayerCanvas(
    'panelOverlay',
    CanvasLayerRegistry.getLayerOptions('panelOverlay'),
  );
  const host = createTutorialHost(runtime, mainHud.getContext('2d'));
  host.presenter.buildTutorialHighlightViewState = (rect) => ({
    overlay: {
      left: `${Number(rect.left ?? rect.x) || 0}px`,
      top: `${Number(rect.top ?? rect.y) || 0}px`,
      width: `${Number(rect.width) || 1}px`,
      height: `${Number(rect.height) || 1}px`,
    },
    bubble: { left: '24px', top: '132px' },
    pointer: { left: '82px', top: '118px' },
  });
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } },
  });
  const firstRect = { left: 20, top: 28, width: 42, height: 34 };
  const nextRect = { left: 112, top: 76, width: 46, height: 38 };
  const buildHighlight = (rect, personId) => ({
    rect,
    message: `Open ${personId}`,
    allowedAction: { type: 'openFamousPersonDetail', personId },
    pulseStartedAt: 900,
  });

  renderer.renderTutorialHighlight(buildHighlight(firstRect, 'fp-first'));
  const highlightCanvas = runtime.getLayerCanvas('tutorialHighlight');
  assert.ok(countGoldPerimeterPixels(highlightCanvas, { x: 20, y: 28, width: 42, height: 34 }) >= 24);

  renderer.renderTutorialHighlight(buildHighlight(nextRect, 'fp-next'));
  assert.equal(countGoldPerimeterPixels(highlightCanvas, { x: 20, y: 28, width: 42, height: 34 }), 0);
  assert.ok(countGoldPerimeterPixels(highlightCanvas, { x: 112, y: 76, width: 46, height: 38 }) >= 24);

  assert.equal(renderer.renderTutorialHighlight(null), false);
  assert.equal(runtime.getLayerCompositeState('tutorialHighlight').visible, false);
  assert.equal(countMatchingPixels(highlightCanvas, ([, , , alpha]) => alpha > 0), 0);

  const panelCtx = panelOverlay.getContext('2d');
  panelCtx.fillStyle = '#263547';
  panelCtx.fillRect(0, 0, runtime.width, runtime.height);
  renderer.renderTutorialHighlight(buildHighlight(nextRect, 'fp-next'));
  runtime.compositeStage();
  panelCtx.clearRect(0, 0, runtime.width, runtime.height);
  runtime.setLayerVisible('panelOverlay', false);
  renderer.renderTutorialHighlight(null);
  runtime.compositeStage();
  assert.equal(countMatchingPixels(runtime.canvas, ([, , , alpha]) => alpha > 0), 0);

  browserRuntime.innerWidth = 220;
  browserRuntime.innerHeight = 200;
  browserRuntime.devicePixelRatio = 2;
  runtime.resize();
  host.width = runtime.width;
  host.height = runtime.height;
  renderer.renderTutorialHighlight(buildHighlight(
    { left: 148, top: 98, width: 52, height: 40 },
    'fp-resized',
  ));
  const resizedCanvas = runtime.getLayerCanvas('tutorialHighlight');
  assert.equal(resizedCanvas, highlightCanvas);
  assert.deepEqual(resizedCanvas._fixedRect, { x: 0, y: 0, width: 220, height: 200 });
  assert.equal(resizedCanvas._backingStorePixelRatio, 2);
  assert.equal(resizedCanvas.width, 440);
  assert.equal(resizedCanvas.height, 400);
  renderer.renderTutorialHighlight(null);
  assert.equal(countMatchingPixels(resizedCanvas, ([, , , alpha]) => alpha > 0), 0);
});

test('minimum runtime without physical layers falls back to the main HUD context', () => {
  const mainHud = new PixelCanvas(180, 180);
  const mainCtx = mainHud.getContext('2d');
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  const host = createTutorialHost(null, mainCtx);
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } },
  });

  assert.equal(renderer.renderTutorialHighlight({
    rect: { left: 40, top: 45, width: 70, height: 50 },
    message: 'Fallback highlight.',
    allowedAction: { type: 'openFamousPersonDetail', personId: 'fp-scout' },
    pulseStartedAt: 900,
  }), true);

  assert.ok(countGoldPerimeterPixels(mainHud, { x: 40, y: 45, width: 70, height: 50 }) >= 24);
  assert.ok(countMatchingPixels(
    mainHud,
    ([red, green, blue, alpha]) => red >= 235 && green >= 220 && blue >= 145 && alpha >= 200,
    { x: 24, y: 108, width: 150, height: 60 },
  ) >= 24);
  assert.deepEqual(getHitActionAt(host.hitTargets, 72, 70), {
    type: 'openFamousPersonDetail',
    personId: 'fp-scout',
  });
});

test('clearing tutorialHighlight never clears tutorialSpine or tutorialDialogue', () => {
  const { runtime } = createRuntime();
  const mainHud = runtime.ensureLayerCanvas(
    'mainHud',
    CanvasLayerRegistry.getLayerOptions('mainHud'),
  );
  const spine = runtime.ensureLayerCanvas(
    'tutorialSpine',
    CanvasLayerRegistry.getLayerOptions('tutorialSpine'),
  );
  const dialogue = runtime.ensureLayerCanvas(
    'tutorialDialogue',
    CanvasLayerRegistry.getLayerOptions('tutorialDialogue'),
  );
  const spineCtx = spine.getContext('2d');
  spineCtx.fillStyle = '#22cc66';
  spineCtx.fillRect(4, 4, 10, 10);
  runtime.refreshLayerPresentCache('tutorialSpine');
  const dialogueCtx = dialogue.getContext('2d');
  dialogueCtx.fillStyle = '#3388ff';
  dialogueCtx.fillRect(24, 4, 10, 10);
  const host = createTutorialHost(runtime, mainHud.getContext('2d'));
  const renderer = new TutorialCanvasRenderer({
    host,
    advisorRenderer: { disposeTutorialAdvisorSpine() { return false; } },
  });

  renderer.renderTutorialHighlight({
    rect: { left: 40, top: 45, width: 70, height: 50 },
    message: 'Layer isolation.',
    allowedAction: { type: 'openFamousPersonDetail', personId: 'fp-scout' },
    pulseStartedAt: 900,
  });
  renderer.renderTutorialHighlight(null);
  runtime.compositeStage();

  assert.deepEqual(getPixel(spine, 6, 6), [34, 204, 102, 255]);
  assert.deepEqual(getPixel(dialogue, 26, 6), [51, 136, 255, 255]);
  assert.deepEqual(getPixel(runtime.canvas, 6, 6), [34, 204, 102, 255]);
  assert.deepEqual(getPixel(runtime.canvas, 26, 6), [51, 136, 255, 255]);
});

test('browser and minigame manifests load TutorialHighlightLayer before TutorialCanvasRenderer', () => {
  const frontendRoot = path.resolve(__dirname, '../../..');
  const html = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8');
  const minigame = fs.readFileSync(path.join(frontendRoot, 'minigame', 'game.js'), 'utf8');
  const browserLayerIndex = html.indexOf('TutorialHighlightLayer.js');
  const browserRendererIndex = html.indexOf('TutorialCanvasRenderer.js');
  const minigameLayerIndex = minigame.indexOf("require('../js/platform/renderers/TutorialHighlightLayer')");
  const minigameRendererIndex = minigame.indexOf("require('../js/platform/renderers/TutorialCanvasRenderer')");

  assert.ok(browserLayerIndex >= 0 && browserLayerIndex < browserRendererIndex);
  assert.ok(minigameLayerIndex >= 0 && minigameLayerIndex < minigameRendererIndex);
});
