(function (global) {
  const FeatureFlags = (() => {
    if (global.FeatureFlags) return global.FeatureFlags;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../config/FeatureFlags');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const FogVisualSnapshot = (() => {
    if (global.WorldFogVisualSnapshot) return global.WorldFogVisualSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/WorldFogVisualSnapshot');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const DEFAULT_PLUGINS = Object.freeze({
    worldFog: Object.freeze({
      key: 'worldFog',
      stage: 'worldMapVisual',
      layer: 'worldFog',
      feature: 'FOG_OF_WAR_ENABLED',
      snapshotSchema: 'world-fog-visual-snapshot-v1',
    }),
  });

  function hashStep(hash, value) {
    const text = String(value ?? '');
    let next = hash >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      next ^= text.charCodeAt(i);
      next = Math.imul(next, 16777619);
    }
    return next >>> 0;
  }

  function getPluginDefinitions(options = {}) {
    const plugins = options.plugins || DEFAULT_PLUGINS;
    if (Array.isArray(plugins)) return plugins.filter(Boolean);
    return Object.values(plugins || {}).filter(Boolean);
  }

  function getPlugin(key = '', options = {}) {
    return getPluginDefinitions(options).find((plugin) => plugin.key === key) || null;
  }

  function isPluginEnabled(pluginOrKey = '', config = null, options = {}) {
    const plugin = typeof pluginOrKey === 'string' ? getPlugin(pluginOrKey, options) : pluginOrKey;
    if (!plugin || plugin.enabled === false) return false;
    if (!plugin.feature) return true;
    const flags = options.FeatureFlags || FeatureFlags || global.FeatureFlags;
    const resolvedConfig = config || options.config || null;
    if (flags?.isEnabled) return flags.isEnabled(resolvedConfig, plugin.feature);
    return resolvedConfig?.FEATURES?.[plugin.feature] === true;
  }

  function getEnabledPlugins(config = null, options = {}) {
    return getPluginDefinitions(options).filter((plugin) => isPluginEnabled(plugin, config, options));
  }

  function createPluginSnapshot(key = '', context = {}, options = {}) {
    const plugin = getPlugin(key, options);
    const config = options.config || context.config || null;
    if (!isPluginEnabled(plugin, config, options)) return null;
    if (typeof plugin.createSnapshot === 'function') return plugin.createSnapshot(context, options);
    if (plugin.key === 'worldFog' && FogVisualSnapshot?.createSnapshot) {
      return FogVisualSnapshot.createSnapshot(context, options);
    }
    return null;
  }

  function createRendererContext(key = '', context = {}, options = {}) {
    const plugin = getPlugin(key, options);
    const snapshot = context.snapshot || createPluginSnapshot(key, context, options);
    if (!plugin || !snapshot) return null;
    if (typeof plugin.toRendererContext === 'function') return plugin.toRendererContext(snapshot, context, options);
    if (plugin.key === 'worldFog' && FogVisualSnapshot?.toRendererContext) {
      return FogVisualSnapshot.toRendererContext(snapshot, options);
    }
    return null;
  }

  function runPlugins(context = {}, options = {}) {
    const config = options.config || context.config || null;
    const plugins = getEnabledPlugins(config, options);
    const snapshots = Object.create(null);
    let hash = 2166136261;
    plugins.forEach((plugin) => {
      const snapshot = createPluginSnapshot(plugin.key, context, options);
      if (!snapshot) return;
      snapshots[plugin.key] = snapshot;
      hash = hashStep(hash, plugin.key);
      hash = hashStep(hash, snapshot.signature || '');
    });
    return {
      schema: 'world-map-visual-plugin-result-v1',
      plugins: Object.keys(snapshots),
      snapshots,
      counts: {
        enabled: plugins.length,
        produced: Object.keys(snapshots).length,
      },
      signature: `${plugins.length}:${Object.keys(snapshots).length}:${(hash >>> 0).toString(16)}`,
    };
  }

  const api = {
    DEFAULT_PLUGINS,
    createPluginSnapshot,
    createRendererContext,
    getEnabledPlugins,
    getPlugin,
    getPluginDefinitions,
    isPluginEnabled,
    runPlugins,
  };

  global.WorldMapVisualPluginRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
