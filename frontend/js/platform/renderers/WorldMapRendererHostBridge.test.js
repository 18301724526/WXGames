const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapRendererHostBridge = require('./WorldMapRendererHostBridge');

test('WorldMapRendererHostBridge returns renderer values before host fallback', () => {
  const renderer = {
    host: {
      sharedValue: 'host-value',
      getHostValue() {
        return this.sharedValue;
      },
    },
    sharedValue: 'renderer-value',
  };
  const proxy = WorldMapRendererHostBridge.createProxy(renderer);

  assert.equal(proxy.sharedValue, 'renderer-value');
  assert.equal(proxy.getHostValue(), 'host-value');
});

test('WorldMapRendererHostBridge routes worldTile state through host when not owned by renderer', () => {
  const renderer = { host: { worldTileStaticCacheKey: 'host-key' } };
  const proxy = WorldMapRendererHostBridge.createProxy(renderer);

  assert.equal(proxy.worldTileStaticCacheKey, 'host-key');
  proxy.worldTileStaticCacheKey = 'next-key';
  assert.equal(renderer.host.worldTileStaticCacheKey, 'next-key');
  assert.equal(renderer.worldTileStaticCacheKey, undefined);
});

test('WorldMapRendererHostBridge writes known host fields and new renderer fields correctly', () => {
  const renderer = { host: { alpha: 1 } };
  const proxy = WorldMapRendererHostBridge.createProxy(renderer);

  proxy.alpha = 2;
  proxy.beta = 3;
  assert.equal(renderer.host.alpha, 2);
  assert.equal(renderer.beta, 3);
});

test('WorldMapRendererHostBridge loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapRendererHostBridge.js') > -1);
  assert.ok(html.indexOf('WorldMapRendererHostBridge.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapRendererHostBridge') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
