(function (global) {
  const TileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileMapGeometry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SOURCE_RULES = Object.freeze({
    memory: Object.freeze({
      kind: 'memory',
      radiusTiles: 0.92,
      clearRadiusTiles: 0.54,
      strength: 1,
    }),
    visibleTile: Object.freeze({
      kind: 'visibleTile',
      radiusTiles: 1.05,
      clearRadiusTiles: 0.58,
      strength: 0.92,
    }),
    unit: Object.freeze({
      kind: 'unit',
      radiusTiles: 1.45,
      clearRadiusTiles: 0.46,
      strength: 1,
    }),
    city: Object.freeze({
      kind: 'city',
      radiusTiles: 2.45,
      clearRadiusTiles: 1.25,
      strength: 1,
    }),
  });

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function normalizeCoord(source = {}, fallback = {}) {
    const normalized = TileCoord?.normalizeCoord
      ? TileCoord.normalizeCoord(source, fallback)
      : null;
    const coord = normalized || (source && typeof source === 'object' ? source : {});
    const base = fallback && typeof fallback === 'object' ? fallback : {};
    const q = normalized ? normalized.x : toInteger(coord.x ?? coord.q, base.x ?? base.q ?? 0);
    const r = normalized ? normalized.y : toInteger(coord.y ?? coord.r, base.y ?? base.r ?? 0);
    return {
      x: q,
      y: r,
      q,
      r,
      tileId: normalized?.tileId || TileCoord?.tileId?.(q, r) || `tile_${q}_${r}`,
    };
  }

  function normalizeFloatCoord(source = {}, fallback = {}) {
    const base = fallback && typeof fallback === 'object' ? fallback : {};
    const q = toNumber(source.x ?? source.q, toNumber(base.x ?? base.q, 0));
    const r = toNumber(source.y ?? source.r, toNumber(base.y ?? base.r, 0));
    return {
      x: q,
      y: r,
      q,
      r,
      tileId: Number.isInteger(q) && Number.isInteger(r)
        ? (TileCoord?.tileId?.(q, r) || `tile_${q}_${r}`)
        : `tile_${Math.floor(q)}_${Math.floor(r)}`,
    };
  }

  function normalizeGeometry(input = {}) {
    if (TileMapGeometry?.normalizeGeometry) return TileMapGeometry.normalizeGeometry(input);
    const tileWidth = Math.max(1, toNumber(input.tileWidth, 192));
    const tileHeight = Math.max(1, toNumber(input.tileHeight, 96));
    return {
      tileWidth,
      tileHeight,
      stepX: Math.max(1, toNumber(input.stepX, tileWidth * 0.5)),
      stepY: Math.max(1, toNumber(input.stepY, tileHeight * 0.5)),
      anchorY: Math.max(0, Math.min(1, toNumber(input.anchorY, 0.5))),
    };
  }

  function getViewportOrigin(viewport = {}) {
    return normalizeCoord(viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || {});
  }

  function getCoordScreenCenter(coord = {}, viewport = {}, geometryInput = {}) {
    const geometry = normalizeGeometry(geometryInput);
    const origin = getViewportOrigin(viewport);
    const source = normalizeFloatCoord(coord);
    const scale = Math.max(0.05, toNumber(viewport.scale, 1));
    return {
      x: toNumber(viewport.originX) + toNumber(viewport.panX) + ((source.q - origin.q) - (source.r - origin.r)) * geometry.stepX * scale,
      y: toNumber(viewport.originY) + toNumber(viewport.panY) + ((source.q - origin.q) + (source.r - origin.r)) * geometry.stepY * scale,
    };
  }

  function getTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
    if (TileMapGeometry?.getTileScreenCenter) return TileMapGeometry.getTileScreenCenter(tile, viewport, geometry);
    return getCoordScreenCenter(normalizeCoord(tile), viewport, geometry);
  }

  function getTileDrawRect(center = {}, viewport = {}, geometryInput = {}) {
    const geometry = normalizeGeometry(geometryInput);
    const scale = Math.max(0.05, toNumber(viewport.scale, 1));
    if (TileMapGeometry?.getTileDrawRect) return TileMapGeometry.getTileDrawRect(center, scale, geometry);
    const width = geometry.tileWidth * scale;
    const height = geometry.tileHeight * scale;
    return {
      x: toNumber(center.x) - width * 0.5,
      y: toNumber(center.y) - height * geometry.anchorY,
      width,
      height,
    };
  }

  function getTileKey(tile = {}) {
    const coord = normalizeCoord(tile);
    return coord.tileId || `tile_${coord.q}_${coord.r}`;
  }

  function isUnknownTile(tile = {}) {
    if (!tile || typeof tile !== 'object') return true;
    if (tile.discovered === false) return true;
    return ['unknown', 'hidden', 'undiscovered'].includes(String(tile.visibility || '').toLowerCase());
  }

  function isExploredTile(tile = {}) {
    return !isUnknownTile(tile);
  }

  function isVisibleTile(tile = {}) {
    if (!isExploredTile(tile)) return false;
    const visibility = String(tile.visibility || '').toLowerCase();
    return tile.visible === true || visibility === 'visible' || visibility === 'controlled';
  }

  function isControlledTile(tile = {}) {
    const visibility = String(tile.visibility || '').toLowerCase();
    return Boolean(tile.controlled || visibility === 'controlled' || tile.siteId === 'capital' || tile.terrain === 'capital');
  }

  function normalizeEntry(tile = {}, viewport = {}, geometry = {}) {
    const coord = normalizeCoord(tile);
    const center = getTileScreenCenter(coord, viewport, geometry);
    const drawRect = getTileDrawRect(center, viewport, geometry);
    return {
      tile: { ...tile, q: coord.q, r: coord.r, tileId: coord.tileId, id: tile.id || coord.tileId },
      center,
      drawRect,
      inView: true,
    };
  }

  function getFogEntries(tileMapView = {}, entries = [], viewport = {}, geometry = {}) {
    const entryByKey = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      if (!entry?.tile) return;
      const coord = normalizeCoord(entry.tile);
      entryByKey.set(coord.tileId, {
        ...entry,
        tile: {
          ...entry.tile,
          q: coord.q,
          r: coord.r,
          tileId: coord.tileId,
          id: entry.tile.id || coord.tileId,
        },
      });
    });
    (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).forEach((tile) => {
      if (!tile) return;
      const key = getTileKey(tile);
      if (!entryByKey.has(key)) entryByKey.set(key, normalizeEntry(tile, viewport, geometry));
    });
    return [...entryByKey.values()];
  }

  function createSource(kind = '', coord = {}, viewport = {}, geometry = {}, overrides = {}) {
    const rule = SOURCE_RULES[kind] || SOURCE_RULES.memory;
    const normalizedCoord = normalizeFloatCoord(coord);
    const center = overrides.center || getCoordScreenCenter(normalizedCoord, viewport, geometry);
    return {
      ...rule,
      ...overrides,
      kind: overrides.kind || rule.kind || kind,
      q: normalizedCoord.q,
      r: normalizedCoord.r,
      tileId: normalizedCoord.tileId,
      center,
    };
  }

  function createTileSource(entry = {}, kind = 'memory', viewport = {}, geometry = {}, overrides = {}) {
    const tile = entry.tile || {};
    const coord = normalizeCoord(tile);
    const center = entry.center || getTileScreenCenter(coord, viewport, geometry);
    return createSource(kind, coord, viewport, geometry, {
      center,
      tileId: coord.tileId,
      ...overrides,
    });
  }

  function getTileById(tileMapView = {}, entries = [], viewport = {}, geometry = {}) {
    const tileById = new Map();
    getFogEntries(tileMapView, entries, viewport, geometry).forEach((entry) => {
      const coord = normalizeCoord(entry.tile);
      tileById.set(coord.tileId, entry);
      if (entry.tile?.id) tileById.set(String(entry.tile.id), entry);
    });
    return tileById;
  }

  function isCitySite(site = {}) {
    const type = String(site.type || site.kind || '').toLowerCase();
    const id = String(site.id || site.siteId || '').toLowerCase();
    const owner = String(site.owner || '').toLowerCase();
    const status = String(site.status || '').toLowerCase();
    const hostileOwner = ['ai', 'enemy', 'neutral', 'npc', 'other'].includes(owner);
    const ownedStatus = ['occupied', 'controlled', 'owned'].includes(status);
    return Boolean(site.isPlayerOwned || site.playerOwned || site.controlled)
      || id === 'capital'
      || type === 'capital'
      || owner === 'player'
      || owner === 'self'
      || (ownedStatus && !hostileOwner);
  }

  function collectCitySources(tileMapView = {}, entries = [], viewport = {}, geometry = {}) {
    const tileById = getTileById(tileMapView, entries, viewport, geometry);
    const sources = [];
    const seen = new Set();
    const append = (site = {}, fallbackTile = null) => {
      if (!site || typeof site !== 'object' || !isCitySite(site)) return;
      const directCoord = site.q !== undefined || site.r !== undefined || site.x !== undefined || site.y !== undefined
        ? normalizeCoord(site)
        : null;
      const tileEntry = tileById.get(site.tileId || '')
        || tileById.get(site.id || '')
        || (directCoord ? tileById.get(directCoord.tileId) : null)
        || fallbackTile
        || null;
      const coord = directCoord || normalizeCoord(tileEntry?.tile || site);
      if (seen.has(coord.tileId)) return;
      seen.add(coord.tileId);
      sources.push(createSource('city', coord, viewport, geometry, {
        center: tileEntry?.center || getCoordScreenCenter(coord, viewport, geometry),
        siteId: site.id || site.siteId || '',
      }));
    };
    (Array.isArray(tileMapView.sites) ? tileMapView.sites : []).forEach((site) => append(site));
    getFogEntries(tileMapView, entries, viewport, geometry).forEach((entry) => {
      const tile = entry.tile || {};
      if (!isControlledTile(tile) && !tile.site) return;
      append(tile.site || {
        id: tile.siteId || tile.id,
        q: tile.q,
        r: tile.r,
        type: tile.terrain === 'capital' ? 'capital' : 'city',
        owner: isControlledTile(tile) ? 'player' : '',
      }, entry);
    });
    return sources;
  }

  function collectUnitSources(context = {}, viewport = {}, geometry = {}) {
    const actors = Array.isArray(context.actors)
      ? context.actors
      : (Array.isArray(context.renderSnapshot?.actors) ? context.renderSnapshot.actors : []);
    return actors
      .map((actor) => {
        const current = actor?.current || actor?.position || actor?.target || null;
        if (!current || (current.q === undefined && current.r === undefined && current.x === undefined && current.y === undefined)) return null;
        return createSource('unit', current, viewport, geometry, {
          actorId: actor.id || actor.missionId || '',
          status: actor.status || '',
        });
      })
      .filter(Boolean);
  }

  function collectSources(context = {}, options = {}) {
    const tileMapView = context.tileMapView || {};
    const viewport = context.viewport || {};
    const geometry = normalizeGeometry(context.geometry || tileMapView.geometry || viewport.geometry || {});
    const entries = getFogEntries(tileMapView, context.entries, viewport, geometry);
    const memorySources = [];
    const visibleTileSources = [];
    entries.forEach((entry) => {
      if (isExploredTile(entry.tile)) memorySources.push(createTileSource(entry, 'memory', viewport, geometry));
      if (isVisibleTile(entry.tile)) visibleTileSources.push(createTileSource(entry, 'visibleTile', viewport, geometry));
    });
    const citySources = collectCitySources(tileMapView, entries, viewport, geometry);
    const unitSources = collectUnitSources(context, viewport, geometry);
    const visionSources = [...citySources, ...unitSources];
    const fallbackVisibleSources = options.useVisibleTileFallback === false || visionSources.length
      ? []
      : visibleTileSources;
    return {
      entries,
      memorySources,
      visibleTileSources,
      visionSources: [...visionSources, ...fallbackVisibleSources],
      unitSources,
      citySources,
      geometry,
      viewport,
    };
  }

  function hashSource(hash, source = {}) {
    const text = [
      source.kind,
      source.tileId,
      Math.round(toNumber(source.q) * 1000),
      Math.round(toNumber(source.r) * 1000),
      Math.round(toNumber(source.center?.x) * 10),
      Math.round(toNumber(source.center?.y) * 10),
      Math.round(toNumber(source.radiusTiles) * 1000),
      Math.round(toNumber(source.clearRadiusTiles) * 1000),
    ].join(':');
    let next = hash >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      next ^= text.charCodeAt(i);
      next = Math.imul(next, 16777619);
    }
    return next >>> 0;
  }

  function getSourceSignature(sources = []) {
    let hash = 2166136261;
    (Array.isArray(sources) ? sources : []).forEach((source) => {
      hash = hashSource(hash, source);
    });
    return `${sources.length}:${(hash >>> 0).toString(36)}`;
  }

  const api = {
    SOURCE_RULES,
    collectSources,
    createSource,
    createTileSource,
    getCoordScreenCenter,
    getFogEntries,
    getSourceSignature,
    getTileDrawRect,
    getTileKey,
    getTileScreenCenter,
    isCitySite,
    isControlledTile,
    isExploredTile,
    isVisibleTile,
    normalizeCoord,
    normalizeFloatCoord,
    normalizeGeometry,
  };

  global.WorldFogVisionModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
