const test = require('node:test');
const assert = require('node:assert/strict');

require('../domain/WorldTime');
require('../domain/WorldMarchProgressSnapshot');
const FeatureFlags = require('../config/FeatureFlags');
const WorldMapVisibilityModel = require('../domain/WorldMapVisibilityModel');
const WorldMapRenderSnapshot = require('../domain/WorldMapRenderSnapshot');
const WorldMapVisualPluginRegistry = require('./WorldMapVisualPluginRegistry');

function createContext() {
  const tileMapView = {
    version: 4,
    seed: 'plugin-fog',
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, visibility: 'unknown', discovered: false, visible: false },
      { id: 'tile_1_0', q: 1, r: 0, visibility: 'unknown', discovered: false, visible: false },
    ],
  };
  const visibilitySnapshot = WorldMapVisibilityModel.createSnapshot({
    worldMap: {
      version: 4,
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, visibility: 'visible' },
        { id: 'tile_1_0', q: 1, r: 0, visibility: 'unknown', discovered: false, visible: false },
      ],
    },
  });
  const renderSnapshot = WorldMapRenderSnapshot.createSnapshot({
    tileMapView,
    x: 0,
    y: 0,
    width: 360,
    height: 300,
  });
  return { visibilitySnapshot, renderSnapshot };
}

test('WorldMapVisualPluginRegistry keeps world fog disabled by default', () => {
  assert.equal(WorldMapVisualPluginRegistry.isPluginEnabled('worldFog', null, { FeatureFlags }), false);
  assert.deepEqual(WorldMapVisualPluginRegistry.getEnabledPlugins(null, { FeatureFlags }), []);
  assert.equal(WorldMapVisualPluginRegistry.createPluginSnapshot('worldFog', createContext(), { FeatureFlags }), null);
});

test('WorldMapVisualPluginRegistry creates fog snapshots only when explicitly enabled', () => {
  const config = { FEATURES: { FOG_OF_WAR_ENABLED: true } };
  const snapshot = WorldMapVisualPluginRegistry.createPluginSnapshot('worldFog', createContext(), {
    config,
    FeatureFlags,
  });
  const rendererContext = WorldMapVisualPluginRegistry.createRendererContext('worldFog', {
    snapshot,
  }, {
    config,
    FeatureFlags,
  });

  assert.equal(snapshot.schema, 'world-fog-visual-snapshot-v1');
  assert.equal(snapshot.counts.total, 2);
  assert.equal(rendererContext.tileMapView.tiles[0].visible, true);
  assert.equal(rendererContext.tileMapView.tiles[1].discovered, false);
  assert.equal(rendererContext.entries.length, 2);
});

test('WorldMapVisualPluginRegistry runs enabled visual plugins with stable signatures', () => {
  const config = { FEATURES: { FOG_OF_WAR_ENABLED: true } };
  const context = createContext();
  const first = WorldMapVisualPluginRegistry.runPlugins(context, { config, FeatureFlags });
  const second = WorldMapVisualPluginRegistry.runPlugins(context, { config, FeatureFlags });

  assert.deepEqual(first.plugins, ['worldFog']);
  assert.equal(first.counts.enabled, 1);
  assert.equal(first.counts.produced, 1);
  assert.equal(first.signature, second.signature);
  assert.equal(first.snapshots.worldFog.schema, 'world-fog-visual-snapshot-v1');
});

test('WorldMapVisualPluginRegistry reuses fog renderer context for unchanged visual inputs', () => {
  const config = { FEATURES: { FOG_OF_WAR_ENABLED: true } };
  const cacheHost = {};
  const context = createContext();
  const first = WorldMapVisualPluginRegistry.createRendererContext('worldFog', {
    ...context,
    cacheHost,
  }, {
    config,
    FeatureFlags,
    cacheHost,
  });
  const second = WorldMapVisualPluginRegistry.createRendererContext('worldFog', {
    ...context,
    cacheHost,
  }, {
    config,
    FeatureFlags,
    cacheHost,
  });

  assert.equal(first, second);
  assert.equal(first.entries.length, 2);
});

test('WorldMapVisualPluginRegistry invalidates cached fog snapshots when explorer visibility moves', () => {
  const config = { FEATURES: { FOG_OF_WAR_ENABLED: true } };
  const cacheHost = {};
  const { renderSnapshot } = createContext();
  const baseContext = { renderSnapshot };
  const first = WorldMapVisualPluginRegistry.createRendererContext('worldFog', {
    ...baseContext,
    cacheHost,
    worldExplorerState: {
      activeMission: {
        id: 'active-1',
        status: 'active',
        position: { q: 0, r: 0, tileId: 'tile_0_0' },
      },
    },
  }, {
    config,
    FeatureFlags,
    cacheHost,
  });
  const second = WorldMapVisualPluginRegistry.createRendererContext('worldFog', {
    ...baseContext,
    cacheHost,
    worldExplorerState: {
      activeMission: {
        id: 'active-1',
        status: 'active',
        position: { q: 1, r: 0, tileId: 'tile_1_0' },
      },
    },
  }, {
    config,
    FeatureFlags,
    cacheHost,
  });

  assert.notEqual(first, second);
  assert.equal(first.entries[1].tile.visible, false);
  assert.equal(second.entries[1].tile.visible, true);
});
