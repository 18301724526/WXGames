const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapRenderUtilityFacade = require('./WorldMapRenderUtilityFacade');

function createHost() {
  const calls = [];
  const host = {
    calls,
    ctx: {
      beginPath() { calls.push(['beginPath']); },
      moveTo(...args) { calls.push(['moveTo', ...args]); },
      lineTo(...args) { calls.push(['lineTo', ...args]); },
      closePath() { calls.push(['closePath']); },
      fill() { calls.push(['fill']); },
      stroke() { calls.push(['stroke']); },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
    },
  };
  return host;
}

test('WorldMapRenderUtilityFacade reads dynamic host ctx through explicit getter', () => {
  const firstHost = createHost();
  const secondHost = createHost();
  const host = createHost();
  host.ctx = firstHost.ctx;
  const renderer = new WorldMapRenderUtilityFacade({ host });

  assert.equal(renderer.ctx, firstHost.ctx);
  host.ctx = secondHost.ctx;
  assert.equal(renderer.ctx, secondHost.ctx);
});

test('WorldMapRenderUtilityFacade does not proxy unknown host properties', () => {
  const host = createHost();
  host.someRandomProp = 'host-only';
  const renderer = new WorldMapRenderUtilityFacade({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('WorldMapRenderUtilityFacade draws fallback iso diamonds through host canvas context', () => {
  const host = createHost();
  const renderer = new WorldMapRenderUtilityFacade({ host });

  assert.equal(renderer.drawIsoDiamond(100, 80, 40, 20, { fill: '#111', stroke: '#eee', width: 2 }), true);
  assert.deepEqual(host.calls.map((call) => call[0]), [
    'beginPath',
    'moveTo',
    'lineTo',
    'lineTo',
    'lineTo',
    'closePath',
    'fill',
    'stroke',
  ]);
  assert.equal(host.ctx.fillStyle, '#111');
  assert.equal(host.ctx.strokeStyle, '#eee');
  assert.equal(host.ctx.lineWidth, 2);
});

test('WorldMapRenderUtilityFacade owns fallback terrain colors and deterministic random', () => {
  const renderer = new WorldMapRenderUtilityFacade({ host: createHost() });
  const first = renderer.random01('seed-a', 1, 2, 'feature');
  const second = renderer.random01('seed-a', 1, 2, 'feature');
  const changed = renderer.random01('seed-a', 1, 2, 'other-feature');

  assert.equal(renderer.getFallbackTerrainFill('forest'), 'rgba(45, 91, 63, 0.94)');
  assert.equal(renderer.getFallbackTerrainFill('unknown-terrain'), 'rgba(90, 122, 70, 0.9)');
  assert.equal(renderer.hashString('abc'), 440920331);
  assert.equal(first, second);
  assert.equal(first !== changed, true);
  assert.equal(first >= 0 && first <= 1, true);
});

test('WorldMapRenderUtilityFacade reports false when no canvas context is available', () => {
  const renderer = new WorldMapRenderUtilityFacade({ host: {} });
  assert.equal(renderer.drawIsoDiamond(0, 0, 10, 10), false);
});

test('WorldMapRenderUtilityFacade loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapRenderUtilityFacade.js') > -1);
  assert.ok(html.indexOf('WorldMapLayoutModel.js') < html.indexOf('WorldMapRenderUtilityFacade.js'));
  assert.ok(html.indexOf('WorldMapRenderUtilityFacade.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapLayoutModel') < miniGameEntry.indexOf('WorldMapRenderUtilityFacade'));
  assert.ok(miniGameEntry.indexOf('WorldMapRenderUtilityFacade') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
