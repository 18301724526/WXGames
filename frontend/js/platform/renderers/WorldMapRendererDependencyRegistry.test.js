const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapRendererDependencyRegistry = require('./WorldMapRendererDependencyRegistry');

test('WorldMapRendererDependencyRegistry owns concrete world map renderer dependencies', () => {
  const definitions = WorldMapRendererDependencyRegistry.DEFINITIONS;

  assert.equal(definitions.worldMapCacheConfigFacade, undefined);
  assert.equal(definitions.worldMapLayoutFacade, undefined);
  assert.equal(definitions.worldMapRenderUtilityFacade, undefined);
  assert.equal(definitions.worldMapHitTargetFacade, undefined);
  assert.equal(definitions.worldMapCacheFacade, undefined);
  assert.equal(definitions.worldMapRendererCompositionFactory.globalName, 'WorldMapRendererCompositionFactory');
  assert.equal(definitions.worldMapTileMapRenderer.globalName, 'WorldMapTileMapRenderer');
  assert.equal(definitions.worldActorCanvasRenderer.globalName, 'WorldActorCanvasRenderer');
  assert.equal(definitions.worldMarchRoutePolicy.modulePath, '../../ecs/system/WorldMarchRoutePolicy');
  assert.equal(definitions.tileMapAssetManifest.modulePath, '../../config/TileMapAssetManifest');
});

test('WorldMapRendererDependencyRegistry resolves globals before module fallback', () => {
  const marker = { id: 'global-tile-map-renderer' };
  const registry = WorldMapRendererDependencyRegistry.createRegistry({
    global: { WorldMapTileMapRenderer: marker },
    requireModule() {
      throw new Error('global dependency should win');
    },
  });

  assert.equal(registry.get('worldMapTileMapRenderer'), marker);
});

test('WorldMapRendererDependencyRegistry uses injected module fallback and caches successful lookups', () => {
  const marker = { id: 'module-tile-map-renderer' };
  const calls = [];
  const registry = WorldMapRendererDependencyRegistry.createRegistry({
    global: {},
    requireModule(modulePath) {
      calls.push(modulePath);
      if (modulePath === './WorldMapTileMapRenderer') return marker;
      return null;
    },
  });

  assert.equal(registry.get('worldMapTileMapRenderer'), marker);
  assert.equal(registry.get('worldMapTileMapRenderer'), marker);
  assert.deepEqual(calls, ['./WorldMapTileMapRenderer']);
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
  assert.ok(html.indexOf('WorldMarchRoutePolicy.js') > -1);
  assert.equal(html.includes('WorldMapHitTargetFacade.js'), false);
  assert.ok(html.indexOf('WorldMapRendererDependencyRegistry.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.equal(miniGameEntry.includes('WorldMapHitTargetFacade'), false);
  assert.ok(miniGameEntry.indexOf('WorldMapRendererDependencyRegistry') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
