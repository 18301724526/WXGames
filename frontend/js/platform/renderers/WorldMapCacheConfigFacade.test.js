const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapCacheConfigFacade = require('./WorldMapCacheConfigFacade');

test('WorldMapCacheConfigFacade reads dynamic host pixelRatio through explicit getter', () => {
  const host = { pixelRatio: 2 };
  const renderer = new WorldMapCacheConfigFacade({ host });

  assert.equal(renderer.pixelRatio, 2);
  assert.equal(renderer.getWorldTileStaticCacheScale(), 2);
  host.pixelRatio = 3;
  assert.equal(renderer.pixelRatio, 3);
  assert.equal(renderer.getWorldTileStaticCacheScale(), 3);
});

test('WorldMapCacheConfigFacade does not proxy unknown host properties', () => {
  const host = { pixelRatio: 2, someRandomProp: 'host-only' };
  const renderer = new WorldMapCacheConfigFacade({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('WorldMapCacheConfigFacade owns default cache performance knobs', () => {
  const renderer = new WorldMapCacheConfigFacade({ host: { pixelRatio: 2 } });

  assert.equal(renderer.getWorldTileStaticChunkSize(), 1024);
  assert.equal(renderer.getWorldTileStaticChunkCacheLimit(), 32);
  assert.equal(renderer.getWorldTileStaticChunkCacheScale(), 1);
  assert.equal(renderer.getWorldTileDragCachePanRange(), 180);
  assert.equal(renderer.getWorldTileStaticCacheScale(), 2);
  assert.equal(renderer.getWorldTileStaticCachePixelBudget(), 16000000);
});

test('WorldMapCacheConfigFacade clamps invalid pixel ratios to one', () => {
  assert.equal(new WorldMapCacheConfigFacade({ host: { pixelRatio: 0 } }).getWorldTileStaticCacheScale(), 1);
  assert.equal(new WorldMapCacheConfigFacade({ host: { pixelRatio: Number.NaN } }).getWorldTileStaticCacheScale(), 1);
});

test('WorldMapCacheConfigFacade loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapCacheConfigFacade.js') > -1);
  assert.ok(html.indexOf('WorldMapCacheFacade.js') < html.indexOf('WorldMapCacheConfigFacade.js'));
  assert.ok(html.indexOf('WorldMapCacheConfigFacade.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapCacheFacade') < miniGameEntry.indexOf('WorldMapCacheConfigFacade'));
  assert.ok(miniGameEntry.indexOf('WorldMapCacheConfigFacade') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
