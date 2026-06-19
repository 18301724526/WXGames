const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapFogMaskContextRenderer = require('./WorldMapFogMaskContextRenderer');

function createHost(overrides = {}) {
  return {
    lastWorldTileMapContext: {
      actors: [],
      visibilityActors: [{ id: 'actor-1' }],
      renderSnapshot: { schema: 'world-map-render-snapshot-v1', signature: 'snapshot-1' },
    },
    ...overrides,
  };
}

test('WorldMapFogMaskContextRenderer reads dynamic host tile map context through explicit getter', () => {
  const firstContext = createHost().lastWorldTileMapContext;
  const secondContext = {
    actors: [{ id: 'actor-2' }],
    visibilityActors: [{ id: 'visibility-2' }],
    renderSnapshot: { schema: 'world-map-render-snapshot-v1', signature: 'snapshot-2' },
  };
  const host = createHost({ lastWorldTileMapContext: firstContext });
  const renderer = new WorldMapFogMaskContextRenderer({ host });

  assert.equal(renderer.lastWorldTileMapContext, firstContext);
  host.lastWorldTileMapContext = secondContext;
  assert.equal(renderer.lastWorldTileMapContext, secondContext);
});

test('WorldMapFogMaskContextRenderer forwards fog context writes to host', () => {
  const host = createHost();
  const renderer = new WorldMapFogMaskContextRenderer({ host });
  const firstContext = { id: 'fog-context-1' };
  const secondContext = { id: 'fog-context-2' };

  renderer.lastWorldFogContext = firstContext;
  assert.equal(host.lastWorldFogContext, firstContext);
  host.lastWorldFogContext = secondContext;
  assert.equal(renderer.lastWorldFogContext, secondContext);
});

test('WorldMapFogMaskContextRenderer does not proxy unknown host properties', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new WorldMapFogMaskContextRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

test('WorldMapFogMaskContextRenderer captures renderer-safe fog context', () => {
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
  assert.equal(renderer.lastWorldFogContext.actors.length, 0);
  assert.equal(renderer.lastWorldFogContext.visibilityActors, host.lastWorldTileMapContext.visibilityActors);
  assert.equal(host.lastWorldFogContext, renderer.lastWorldFogContext);
});

test('WorldMapFogMaskContextRenderer accepts explicit snapshot and actor context', () => {
  const renderer = new WorldMapFogMaskContextRenderer({ host: createHost() });
  const actors = [{ id: 'explicit-actor' }];
  const visibilityActors = [{ id: 'explicit-visibility-actor' }];
  const context = renderer.createWorldTileFogMaskContext(
    { tiles: [] },
    { geometry: { tileWidth: 128 } },
    {},
    [],
    { renderSnapshot: { id: 'explicit-snapshot' }, actors, visibilityActors },
  );

  assert.deepEqual(context.geometry, { tileWidth: 128 });
  assert.deepEqual(context.renderSnapshot, { id: 'explicit-snapshot' });
  assert.equal(context.actors, actors);
  assert.equal(context.visibilityActors, visibilityActors);
  assert.equal(typeof renderer.getWorldTileFogRevealEntries, 'undefined');
});

test('WorldMapFogMaskContextRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapFogMaskContextRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapFogMaskContextRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(html.indexOf('WorldFogVisionModel.js') < html.indexOf('WorldFogMaskGenerator.js'));
  assert.ok(html.indexOf('WorldFogMaskGenerator.js') < html.indexOf('WorldFogCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldFogVisionModel') < miniGameEntry.indexOf('WorldFogMaskGenerator'));
  assert.ok(miniGameEntry.indexOf('WorldFogMaskGenerator') < miniGameEntry.indexOf('WorldFogCanvasRenderer'));
});
