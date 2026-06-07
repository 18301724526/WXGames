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
    quadraticCurveTo(...args) { calls.push(['quadraticCurveTo', ...args]); },
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
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
      tiles: [
        { id: 'known', q: 0, r: 0, discovered: true, visible: true, visibility: 'scouted' },
        { id: 'unknown', q: 1, r: 0, discovered: false, visible: false, visibility: 'unknown' },
      ],
    },
    viewport: { originX: 110, originY: 120, panX: 0, panY: 0, scale: 0.5 },
    frame: { x: 10, y: 20, width: 300, height: 240 },
    entries: [
      {
        tile: { id: 'known', q: 0, r: 0, discovered: true, visible: true, visibility: 'scouted' },
        center: { x: 110, y: 120 },
        drawRect: { x: 62, y: 96, width: 96, height: 48 },
      },
      {
        tile: { id: 'unknown', q: 1, r: 0, discovered: false, visible: false, visibility: 'unknown' },
        center: { x: 158, y: 144 },
        drawRect: { x: 110, y: 120, width: 96, height: 48 },
      },
    ],
  });

  const cacheCalls = renderer.cache.canvas.calls;
  assert.equal(rendered, true);
  assert.equal(cacheCalls.some((call) => call[0] === 'createRadialGradient'), false);
  assert.equal(cacheCalls.some((call) => call[0] === 'arc'), false);
  assert.ok(renderer.maskCache.canvas.calls.filter((call) => call[0] === 'moveTo').length >= 1);
  assert.ok(renderer.maskCache.canvas.calls.filter((call) => call[0] === 'lineTo').length >= 3);
  assert.equal(calls.some((call) => call[0] === 'drawImage'), true);
  assert.equal(renderer.maskCache.pixelWidth < renderer.cache.pixelWidth, true);
});

test('WorldFogCanvasRenderer draws veil only around known-to-unknown boundary edges', () => {
  const ctx = createCtx([]);
  const renderer = new WorldFogCanvasRenderer({
    ctx,
    canvas: createCanvas(ctx),
    pixelRatio: 1,
    width: 390,
    height: 844,
  });
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 };
  const viewport = { originX: 130, originY: 120, panX: 0, panY: 0, scale: 0.5 };
  const frame = { x: 0, y: 0, width: 300, height: 240 };
  const entries = [
    renderer.normalizeEntry({ id: 'tile_0_0', q: 0, r: 0, discovered: true, visible: true, visibility: 'scouted' }, viewport, geometry),
    renderer.normalizeEntry({ id: 'tile_1_0', q: 1, r: 0, discovered: true, visible: true, visibility: 'scouted' }, viewport, geometry),
  ];

  const edges = renderer.getKnownBoundaryEdges(entries, viewport, geometry, frame);
  const normalizedEdges = edges.map((edge) => [
    Math.round(edge.from.x),
    Math.round(edge.from.y),
    Math.round(edge.to.x),
    Math.round(edge.to.y),
  ].join(','));

  assert.equal(edges.length, 6);
  assert.equal(normalizedEdges.includes('178,144,130,168'), false);
  assert.equal(normalizedEdges.includes('130,120,178,144'), false);
});

test('WorldFogCanvasRenderer renders low-res textured fog when only known tiles are provided', () => {
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
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, discovered: true, visible: true, visibility: 'scouted' },
        { id: 'tile_1_0', q: 1, r: 0, discovered: true, visible: true, visibility: 'scouted' },
      ],
    },
    viewport: {
      originX: 130,
      originY: 120,
      panX: 0,
      panY: 0,
      scale: 0.5,
    },
    frame: { x: 0, y: 0, width: 300, height: 240 },
    entries: [
      {
        tile: { id: 'tile_0_0', q: 0, r: 0, discovered: true, visible: true, visibility: 'scouted' },
        center: { x: 130, y: 120 },
        drawRect: { x: 82, y: 96, width: 96, height: 48 },
      },
      {
        tile: { id: 'tile_1_0', q: 1, r: 0, discovered: true, visible: true, visibility: 'scouted' },
        center: { x: 178, y: 144 },
        drawRect: { x: 130, y: 120, width: 96, height: 48 },
      },
    ],
  });

  const cacheCalls = renderer.cache.canvas.calls;
  const maskCalls = renderer.maskCache.canvas.calls;
  const compositeModes = maskCalls
    .filter((call) => call[0] === 'fill' || call[0] === 'stroke')
    .length;
  assert.equal(rendered, true);
  assert.equal(maskCalls.some((call) => call[0] === 'createRadialGradient'), false);
  assert.equal(maskCalls.some((call) => call[0] === 'arc'), false);
  assert.ok(maskCalls.filter((call) => call[0] === 'fillRect').length > 8);
  assert.ok(compositeModes >= 1);
  assert.equal(cacheCalls.some((call) => call[0] === 'drawImage'), true);
  assert.equal(renderer.maskCache.pixelWidth < renderer.cache.pixelWidth, true);
});
