const test = require('node:test');
const assert = require('node:assert/strict');

const WorldFogCanvasRenderer = require('./WorldFogCanvasRenderer');

function createCtx(calls = []) {
  return {
    setTransform(...args) { calls.push(['setTransform', ...args]); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    beginPath() { calls.push(['beginPath']); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    closePath() { calls.push(['closePath']); },
    rect(...args) { calls.push(['rect', ...args]); },
    clip() { calls.push(['clip']); },
    fill() { calls.push(['fill']); },
    stroke() { calls.push(['stroke']); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    createRadialGradient() { calls.push(['createRadialGradient']); return { addColorStop() {} }; },
    arc(...args) { calls.push(['arc', ...args]); },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  };
}

function createCanvas(ctx) {
  return {
    width: 0,
    height: 0,
    ownerDocument: {
      createElement() {
        const calls = [];
        return {
          width: 0,
          height: 0,
          calls,
          getContext() {
            return createCtx(calls);
          },
        };
      },
    },
    getContext() {
      return ctx;
    },
  };
}

test('WorldFogCanvasRenderer cuts known fog by tile diamonds, not radial spotlight', () => {
  const calls = [];
  const ctx = createCtx(calls);
  const renderer = new WorldFogCanvasRenderer({
    ctx,
    canvas: createCanvas(ctx),
    pixelRatio: 1,
    width: 390,
    height: 844,
  });

  const rendered = renderer.renderWorldFog({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96 },
    },
    viewport: { scale: 0.5 },
    frame: { x: 10, y: 20, width: 300, height: 240 },
    entries: [
      {
        tile: { id: 'known', discovered: true, visible: true, visibility: 'scouted' },
        center: { x: 110, y: 120 },
        drawRect: { x: 62, y: 96, width: 96, height: 48 },
      },
      {
        tile: { id: 'unknown', discovered: false, visible: false, visibility: 'unknown' },
        center: { x: 210, y: 170 },
        drawRect: { x: 162, y: 146, width: 96, height: 48 },
      },
    ],
  });

  const cacheCalls = renderer.cache.canvas.calls;
  assert.equal(rendered, true);
  assert.equal(cacheCalls.some((call) => call[0] === 'createRadialGradient'), false);
  assert.equal(cacheCalls.some((call) => call[0] === 'arc'), false);
  assert.equal(cacheCalls.filter((call) => call[0] === 'moveTo').length, 2);
  assert.equal(cacheCalls.filter((call) => call[0] === 'lineTo').length, 6);
  assert.equal(calls.some((call) => call[0] === 'drawImage'), true);
});
