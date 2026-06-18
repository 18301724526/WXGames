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

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function hasCoord(source = {}) {
    return source && typeof source === 'object'
      && (source.q !== undefined || source.r !== undefined || source.x !== undefined || source.y !== undefined);
  }

  function coordSignature(source = {}) {
    if (!hasCoord(source)) return '';
    const q = toInteger(source.q ?? source.x, 0);
    const r = toInteger(source.r ?? source.y, 0);
    return `${q},${r}:${source.tileId || source.id || `tile_${q}_${r}`}`;
  }

  function revealedIdSignature(mission = {}) {
    return (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [])
      .map((id) => String(id || ''))
      .filter(Boolean)
      .sort()
      .join(',');
  }

  function coordListSignature(list = [], options = {}) {
    return (Array.isArray(list) ? list : [])
      .map((item) => [
        coordSignature(item),
        item?.revealed === true ? 1 : 0,
        options.includeTerrain ? (item?.terrain || '') : '',
      ].join(':'))
      .join(';');
  }

  function missionVisibilitySignature(mission = {}) {
    if (!mission || typeof mission !== 'object') return '';
    return [
      mission.id || '',
      mission.status || '',
      coordSignature(mission.position),
      coordListSignature(mission.route),
      coordListSignature(mission.plannedTiles, { includeTerrain: true }),
      revealedIdSignature(mission),
    ].join('|');
  }

  function getWorldExplorerVisibilitySignature(context = {}) {
    const explorer = context.worldExplorerState || {};
    const missions = [];
    const append = (mission) => {
      if (mission && typeof mission === 'object') missions.push(missionVisibilitySignature(mission));
    };
    (Array.isArray(context.missions) ? context.missions : []).forEach(append);
    (Array.isArray(explorer.missions) ? explorer.missions : []).forEach(append);
    append(explorer.activeMission);
    (Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []).forEach(append);
    return missions.join('||');
  }

  function getFogSnapshotCacheKey(context = {}) {
    const renderSnapshot = context.renderSnapshot || {};
    const tileMapView = context.tileMapView || renderSnapshot.tileMapView || {};
    const visibilitySnapshot = context.visibilitySnapshot || null;
    const viewport = context.viewport || renderSnapshot.viewport || {};
    const frame = context.frame || renderSnapshot.frame || {};
    const geometry = context.geometry || renderSnapshot.geometry || tileMapView.geometry || viewport.geometry || {};
    const parts = [
      tileMapView.signature || '',
      tileMapView.version || 0,
      tileMapView.seed || '',
      Array.isArray(tileMapView.tiles) ? tileMapView.tiles.length : 0,
      visibilitySnapshot?.signature || '',
      visibilitySnapshot?.signature ? '' : getWorldExplorerVisibilitySignature(context),
      Math.round(toNumber(viewport.originX, 0)),
      Math.round(toNumber(viewport.originY, 0)),
      Math.round(toNumber(viewport.panX, 0)),
      Math.round(toNumber(viewport.panY, 0)),
      Math.round(toNumber(viewport.scale, 1) * 1000),
      viewport.worldOrigin?.tileId || `${viewport.worldOrigin?.q ?? viewport.worldOrigin?.x ?? 0}:${viewport.worldOrigin?.r ?? viewport.worldOrigin?.y ?? 0}`,
      Math.round(toNumber(frame.x, 0)),
      Math.round(toNumber(frame.y, 0)),
      Math.round(toNumber(frame.width, 1)),
      Math.round(toNumber(frame.height, 1)),
      Math.round(toNumber(geometry.stepX, 96) * 10),
      Math.round(toNumber(geometry.stepY, 48) * 10),
    ];
    let hash = 2166136261;
    parts.forEach((part) => {
      hash = hashStep(hash, part);
    });
    return `worldFog:${parts.length}:${(hash >>> 0).toString(16)}`;
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
    const cacheHost = options.cacheHost || context.cacheHost || context.host || null;
    const snapshotCacheKey = plugin?.key === 'worldFog' ? getFogSnapshotCacheKey(context) : '';
    if (cacheHost && snapshotCacheKey) {
      if (!cacheHost.__worldMapVisualSnapshotCache) cacheHost.__worldMapVisualSnapshotCache = Object.create(null);
      const cached = cacheHost.__worldMapVisualSnapshotCache[plugin.key];
      if (cached?.key === snapshotCacheKey && cached.snapshot) return cached.snapshot;
    }
    let snapshot = null;
    if (typeof plugin.createSnapshot === 'function') return plugin.createSnapshot(context, options);
    if (plugin.key === 'worldFog' && FogVisualSnapshot?.createSnapshot) {
      snapshot = FogVisualSnapshot.createSnapshot(context, options);
      if (cacheHost && snapshotCacheKey && snapshot) {
        cacheHost.__worldMapVisualSnapshotCache[plugin.key] = {
          key: snapshotCacheKey,
          snapshot,
        };
      }
      return snapshot;
    }
    return null;
  }

  function createRendererContext(key = '', context = {}, options = {}) {
    const plugin = getPlugin(key, options);
    const snapshot = context.snapshot || createPluginSnapshot(key, context, options);
    if (!plugin || !snapshot) return null;
    const cacheHost = options.cacheHost || context.cacheHost || context.host || null;
    const cacheKey = `${plugin.key}:${snapshot.signature || ''}`;
    if (cacheHost) {
      if (!cacheHost.__worldMapVisualRendererContextCache) cacheHost.__worldMapVisualRendererContextCache = Object.create(null);
      const cached = cacheHost.__worldMapVisualRendererContextCache[plugin.key];
      if (cached?.key === cacheKey && cached.context) return cached.context;
    }
    let rendererContext = null;
    if (typeof plugin.toRendererContext === 'function') return plugin.toRendererContext(snapshot, context, options);
    if (plugin.key === 'worldFog' && FogVisualSnapshot?.toRendererContext) {
      rendererContext = FogVisualSnapshot.toRendererContext(snapshot, options);
    }
    if (cacheHost && rendererContext) {
      cacheHost.__worldMapVisualRendererContextCache[plugin.key] = {
        key: cacheKey,
        context: rendererContext,
      };
    }
    return rendererContext;
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
