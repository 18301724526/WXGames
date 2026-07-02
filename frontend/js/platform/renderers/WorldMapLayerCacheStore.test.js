const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapLayerCacheStore = require('./WorldMapLayerCacheStore');

function createCanvasFactory(calls = []) {
  return function createCanvas(width, height) {
    calls.push(['createCanvas', width, height]);
    return {
      width,
      height,
      getContext(type) {
        calls.push(['getContext', type]);
        return { type };
      },
    };
  };
}

test('WorldMapLayerCacheStore normalizes work size and creates layer work', () => {
  const calls = [];
  const work = WorldMapLayerCacheStore.createLayerWork(10.2, 11.1, 2, {
    createCanvas: createCanvasFactory(calls),
  });

  assert.equal(work.width, 11);
  assert.equal(work.height, 12);
  assert.equal(work.pixelWidth, 22);
  assert.equal(work.pixelHeight, 24);
  assert.equal(work.scale, 2);
  assert.deepEqual(calls[0], ['createCanvas', 22, 24]);
});

test('WorldMapLayerCacheStore reuses and resizes named cache work', () => {
  const calls = [];
  const store = {};
  const first = WorldMapLayerCacheStore.getLayerCacheContext(store, 'cacheA', 20, 10, 1, {
    createCanvas: createCanvasFactory(calls),
  });
  const second = WorldMapLayerCacheStore.getLayerCacheContext(store, 'cacheA', 30, 12, 2, {
    createCanvas: createCanvasFactory(calls),
  });

  assert.equal(first, second);
  assert.equal(second.canvas.width, 60);
  assert.equal(second.canvas.height, 24);
  assert.equal(second.width, 30);
  assert.equal(calls.filter((call) => call[0] === 'createCanvas').length, 1);
});

test('WorldMapLayerCacheStore computes visible blit and draws clipped cache region', () => {
  const drawCalls = [];
  const work = {
    canvas: { width: 200, height: 100 },
    scale: 2,
  };
  const layout = {
    frame: { x: 0, y: 0, width: 100, height: 50 },
    drawX: 20,
    drawY: 30,
  };
  const targetCtx = {
    drawImage(...args) {
      drawCalls.push(args);
    },
  };

  const drawn = WorldMapLayerCacheStore.drawLayerCache(targetCtx, work, layout, { x: 50, y: 40, width: 80, height: 60 });

  assert.equal(drawn, true);
  assert.deepEqual(drawCalls[0], [
    work.canvas,
    60,
    20,
    140,
    80,
    50,
    40,
    70,
    40,
  ]);
});

test('WorldMapLayerCacheStore treats fully clipped cache as a draw miss', () => {
  const drawCalls = [];
  const drawn = WorldMapLayerCacheStore.drawLayerCache({
    drawImage(...args) { drawCalls.push(args); },
  }, {
    canvas: { width: 100, height: 100 },
    scale: 1,
  }, {
    frame: { width: 50, height: 50 },
    drawX: 100,
    drawY: 100,
  }, {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });

  assert.equal(drawn, false);
  assert.equal(drawCalls.length, 0);
});

test('WorldMapLayerCacheStore loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapLayerCacheStore.js') > -1);
  assert.ok(html.indexOf('WorldMapLayerCacheStore.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapLayerCacheStore') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
