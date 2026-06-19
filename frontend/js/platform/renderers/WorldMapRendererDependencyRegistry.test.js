const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapRendererDependencyRegistry = require('./WorldMapRendererDependencyRegistry');

test('WorldMapRendererDependencyRegistry owns dependency keys for the world map renderer facade', () => {
  const definitions = WorldMapRendererDependencyRegistry.DEFINITIONS;

  assert.equal(definitions.worldMapCacheConfigFacade.globalName, 'WorldMapCacheConfigFacade');
  assert.equal(definitions.worldMapCacheConfigFacade.modulePath, './WorldMapCacheConfigFacade');
  assert.equal(definitions.worldMapRendererHostBridge.globalName, 'WorldMapRendererHostBridge');
  assert.equal(definitions.worldMapRendererCompositionFactory.globalName, 'WorldMapRendererCompositionFactory');
  assert.equal(definitions.worldMapTileMapRenderer.globalName, 'WorldMapTileMapRenderer');
  assert.equal(definitions.worldActorCanvasRenderer.globalName, 'WorldActorCanvasRenderer');
  assert.equal(definitions.tileMapAssetManifest.modulePath, '../../config/TileMapAssetManifest');
});

test('WorldMapRendererDependencyRegistry resolves globals before module fallback', () => {
  const marker = { id: 'global-cache-config' };
  const registry = WorldMapRendererDependencyRegistry.createRegistry({
    global: { WorldMapCacheConfigFacade: marker },
    requireModule() {
      throw new Error('global dependency should win');
    },
  });

  assert.equal(registry.get('worldMapCacheConfigFacade'), marker);
});

test('WorldMapRendererDependencyRegistry uses injected module fallback and caches successful lookups', () => {
  const marker = { id: 'module-cache-config' };
  const calls = [];
  const registry = WorldMapRendererDependencyRegistry.createRegistry({
    global: {},
    requireModule(modulePath) {
      calls.push(modulePath);
      if (modulePath === './WorldMapCacheConfigFacade') return marker;
      return null;
    },
  });

  assert.equal(registry.get('worldMapCacheConfigFacade'), marker);
  assert.equal(registry.get('worldMapCacheConfigFacade'), marker);
  assert.deepEqual(calls, ['./WorldMapCacheConfigFacade']);
});

test('WorldMapRendererDependencyRegistry handles unknown keys and explicit fallbacks', () => {
  const fallback = { id: 'fallback' };
  const registry = WorldMapRendererDependencyRegistry.createRegistry({ global: {}, requireModule: () => null });

  assert.equal(registry.get('missingDependency'), null);
  assert.equal(registry.getOrFallback('missingDependency', fallback), fallback);
});

test('WorldMapRendererDependencyRegistry exposes shared renderer dependency helper', () => {
  assert.equal(WorldMapRendererDependencyRegistry.getRendererDependency('missingDependency'), null);
});

test('WorldMapRendererDependencyRegistry loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapRendererDependencyRegistry.js') > -1);
  assert.ok(html.indexOf('WorldMapRendererDependencyRegistry.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapRendererDependencyRegistry') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
