const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapFogMaskContextRenderer = require('./WorldMapFogMaskContextRenderer');

function createHost(overrides = {}) {
  return {
    lastWorldTileMapContext: {
      renderSnapshot: { schema: 'world-map-render-snapshot-v1', signature: 'snapshot-1' },
    },
    ...overrides,
  };
}

test('WorldMapFogMaskContextRenderer captures renderer-safe fog mask context', () => {
  const host = createHost();
  const renderer = new WorldMapFogMaskContextRenderer({ host });
  const tileMapView = { geometry: { tileWidth: 192 }, tiles: [{ id: 'tile-1', q: 0, r: 0 }] };
  const viewport = { originX: 10, geometry: { tileWidth: 96 } };
  const frame = { x: 1, y: 2, width: 3, height: 4 };
  const entries = [{ tile: tileMapView.tiles[0] }];

  assert.equal(renderer.renderWorldTileFogMask(tileMapView, viewport, frame, entries), false);
  assert.equal(renderer.lastWorldFogContext.tileMapView, tileMapView);
  assert.equal(renderer.lastWorldFogContext.viewport, viewport);
  assert.equal(renderer.lastWorldFogContext.frame, frame);
  assert.equal(renderer.lastWorldFogContext.entries, entries);
  assert.equal(renderer.lastWorldFogContext.geometry, tileMapView.geometry);
  assert.equal(renderer.lastWorldFogContext.renderSnapshot, host.lastWorldTileMapContext.renderSnapshot);
  assert.equal(host.lastWorldFogContext, renderer.lastWorldFogContext);
});

test('WorldMapFogMaskContextRenderer uses viewport geometry fallback', () => {
  const renderer = new WorldMapFogMaskContextRenderer({ host: createHost() });
  const context = renderer.createWorldTileFogMaskContext(
    { tiles: [] },
    { geometry: { tileWidth: 128 } },
    {},
    [],
    { renderSnapshot: { id: 'explicit-snapshot' } },
  );

  assert.deepEqual(context.geometry, { tileWidth: 128 });
  assert.deepEqual(context.renderSnapshot, { id: 'explicit-snapshot' });
});

test('WorldMapFogMaskContextRenderer filters reveal entries to inner fully surrounded tiles', () => {
  const renderer = new WorldMapFogMaskContextRenderer({ host: createHost() });
  const entries = [];
  for (let q = -1; q <= 1; q += 1) {
    for (let r = -1; r <= 1; r += 1) {
      entries.push({ tile: { id: `${q},${r}`, q, r } });
    }
  }

  const revealEntries = renderer.getWorldTileFogRevealEntries(entries);

  assert.equal(revealEntries.length, 1);
  assert.equal(revealEntries[0].tile.id, '0,0');
});

test('WorldMapFogMaskContextRenderer keeps sparse reveal entries unchanged', () => {
  const renderer = new WorldMapFogMaskContextRenderer({ host: createHost() });
  const entries = [
    { tile: { id: '0,0', q: 0, r: 0 } },
    { tile: { id: '1,0', q: 1, r: 0 } },
  ];

  assert.equal(renderer.getWorldTileFogRevealEntries(entries), entries);
  assert.deepEqual(renderer.getWorldTileFogRevealEntries(null), []);
});

test('WorldMapFogMaskContextRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapFogMaskContextRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapFogMaskContextRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapFogMaskContextRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
