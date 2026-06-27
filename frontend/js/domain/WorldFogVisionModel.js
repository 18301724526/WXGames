(function (global) {
  const SignatureHash = (() => {
    if (global.SignatureHash) return global.SignatureHash;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../shared/SignatureHash');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileMapGeometry');
      } catch (_error) {
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
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMarchSystem');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const SOURCE_RULES = Object.freeze({
    visibleTile: Object.freeze({
      kind: 'visibleTile',
      radiusTiles: 1.55,
      clearRadiusTiles: 0.78,
      strength: 0.92,
    }),
    unit: Object.freeze({
      kind: 'unit',
      radiusTiles: 1.68,
      clearRadiusTiles: 0.72,
      strength: 1,
    }),
    city: Object.freeze({
      kind: 'city',
      radiusTiles: 3.05,
      clearRadiusTiles: 1.28,
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
    return TileCoord.normalizeCoord(source, fallback);
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
      tileId: TileCoord.tileId(q, r),
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
    return normalizeCoord(tile).tileId;
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
    const rendererEntries = Array.isArray(entries) ? entries : [];
    rendererEntries.forEach((entry) => {
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
    if (!rendererEntries.length) {
      (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).forEach((tile) => {
        if (!tile) return;
        const key = getTileKey(tile);
        if (!entryByKey.has(key)) entryByKey.set(key, normalizeEntry(tile, viewport, geometry));
      });
    }
    return [...entryByKey.values()];
  }

  function createSource(kind = '', coord = {}, viewport = {}, geometry = {}, overrides = {}) {
    const rule = SOURCE_RULES[kind] || SOURCE_RULES.unit;
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

  function createTileSource(entry = {}, kind = 'visibleTile', viewport = {}, geometry = {}, overrides = {}) {
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
    const actors = Array.isArray(context.visibilityActors)
      ? context.visibilityActors
      : (Array.isArray(context.actors)
      ? context.actors
      : (Array.isArray(context.renderSnapshot?.actors) ? context.renderSnapshot.actors : []));
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

  function sourceIdentity(source = {}) {
    return [
      source.kind || '',
      Math.round(toNumber(source.q) * 100),
      Math.round(toNumber(source.r) * 100),
    ].join(':');
  }

  function getVisionHistorySourceRecords(context = {}) {
    const tileMapView = context.tileMapView || {};
    const sources = tileMapView.visionHistory?.sources
      || tileMapView.visionHistorySources
      || context.renderSnapshot?.tileMapView?.visionHistory?.sources
      || [];
    return Array.isArray(sources) ? sources : [];
  }

  function getMissionList(context = {}) {
    const tileMapView = context.tileMapView || {};
    const fromMarch = Array.isArray(context.renderSnapshot?.march?.missions)
      ? context.renderSnapshot.march.missions
      : [];
    const fromTileMap = Array.isArray(tileMapView.activeScouts) ? tileMapView.activeScouts : [];
    const byId = new Map();
    [...fromTileMap, ...fromMarch].forEach((mission) => {
      if (!mission || typeof mission !== 'object') return;
      const id = mission.id || mission.missionId || `mission-${byId.size}`;
      byId.set(id, { ...(byId.get(id) || {}), ...mission });
    });
    return [...byId.values()];
  }

  function isRouteStepRevealed(step = {}, mission = {}) {
    if (step.revealed) return true;
    const id = normalizeCoord(step).tileId;
    return (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : []).map(String).includes(id);
  }

  function getMissionRevealSources(mission = {}, actor = null) {
    const fromActor = Array.isArray(actor?.renderRevealSources) ? actor.renderRevealSources : [];
    if (fromActor.length) return fromActor;
    if (Array.isArray(mission.renderRevealSources) && mission.renderRevealSources.length) return mission.renderRevealSources;
    if (WorldMarchSystem?.getRouteRenderRevealSources) {
      const nowMs = toNumber(mission.nowMs ?? mission.epochNowMs, Number.NaN);
      if (!Number.isFinite(nowMs)) return [];
      const computed = WorldMarchSystem.getRouteRenderRevealSources(mission, nowMs);
      if (Array.isArray(computed) && computed.length) return computed;
    }
    return [];
  }

  function samplePathSources(from = {}, to = {}, viewport = {}, geometry = {}, options = {}) {
    const start = normalizeFloatCoord(from, to);
    const end = normalizeFloatCoord(to, start);
    const sampleStepTiles = Math.max(0.1, toNumber(options.historySampleStepTiles, 0.45));
    const distance = Math.hypot(end.q - start.q, end.r - start.r);
    const steps = Math.max(1, Math.ceil(distance / sampleStepTiles));
    const sources = [];
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      sources.push(createSource('unit', {
        q: start.q + (end.q - start.q) * t,
        r: start.r + (end.r - start.r) * t,
      }, viewport, geometry, {
        source: 'routeHistory',
        strength: Math.max(0, Math.min(1, toNumber(options.strength ?? 1, 1))),
      }));
    }
    return sources;
  }

  function collectRouteHistorySources(context = {}, viewport = {}, geometry = {}, options = {}) {
    const contextActors = Array.isArray(context.visibilityActors)
      ? context.visibilityActors
      : (Array.isArray(context.actors) ? context.actors : []);
    const actorByMissionId = new Map(contextActors
      .map((actor) => [actor?.missionId || actor?.id || '', actor])
      .filter(([id]) => id));
    const sources = [];
    getMissionList(context).forEach((mission) => {
      const route = (Array.isArray(mission.route) ? mission.route : [])
        .map((step, index) => ({ ...normalizeCoord(step), step: toInteger(step.step, index + 1), revealed: isRouteStepRevealed(step, mission) }))
        .sort((a, b) => a.step - b.step);
      let cursor = normalizeFloatCoord(mission.origin || mission.position || route[0] || {});
      const actor = actorByMissionId.get(mission.id || mission.missionId || '');
      const revealSources = getMissionRevealSources(mission, actor);
      if (revealSources.length) {
        revealSources.forEach((source) => {
          const coord = normalizeFloatCoord(source, cursor);
          sources.push(...samplePathSources(cursor, coord, viewport, geometry, {
            ...options,
            strength: source.strength ?? 1,
          }));
          if (toNumber(source.strength, 1) >= 1) cursor = coord;
        });
        return;
      }
      route.forEach((step) => {
        if (!step.revealed) return;
        sources.push(...samplePathSources(cursor, step, viewport, geometry, options));
        cursor = step;
      });
      const current = actor?.current || null;
      if (actor?.status === 'active' && current) {
        sources.push(...samplePathSources(cursor, current, viewport, geometry, options));
      }
    });
    return sources;
  }

  function collectVisionHistorySources(context = {}, viewport = {}, geometry = {}, options = {}) {
    const byKey = new Map();
    const append = (source) => {
      if (!source) return;
      byKey.set(sourceIdentity(source), source);
    };
    getVisionHistorySourceRecords(context).forEach((record) => {
      const kind = record.kind === 'city' ? 'city' : 'unit';
      append(createSource(kind, record, viewport, geometry, {
        source: 'visionHistory',
      }));
    });
    collectRouteHistorySources(context, viewport, geometry, options).forEach(append);
    return [...byKey.values()];
  }

  function collectSources(context = {}, options = {}) {
    const tileMapView = context.tileMapView || {};
    const viewport = context.viewport || {};
    const geometry = normalizeGeometry(context.geometry || tileMapView.geometry || viewport.geometry || {});
    const entries = getFogEntries(tileMapView, context.entries, viewport, geometry);
    const visibleTileSources = [];
    entries.forEach((entry) => {
      if (isVisibleTile(entry.tile)) visibleTileSources.push(createTileSource(entry, 'visibleTile', viewport, geometry));
    });
    const citySources = collectCitySources(tileMapView, entries, viewport, geometry);
    const unitSources = collectUnitSources(context, viewport, geometry);
    const visionSources = [...citySources, ...unitSources];
    const visionHistorySources = collectVisionHistorySources(context, viewport, geometry, options);
    const fallbackVisibleSources = options.useVisibleTileFallback === true && !visionSources.length
      ? visibleTileSources
      : [];
    return {
      entries,
      exploredSources: visionHistorySources,
      memorySources: visionHistorySources,
      visionHistorySources,
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
      Math.round(toNumber(source.strength, 1) * 1000),
    ].join(':');
    return SignatureHash.hashStep(hash, text);
  }

  function getSourceSignature(sources = []) {
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    (Array.isArray(sources) ? sources : []).forEach((source) => {
      hash = hashSource(hash, source);
    });
    return `${sources.length}:${(hash >>> 0).toString(36)}`;
  }

  const api = {
    SOURCE_RULES,
    collectSources,
    collectVisionHistorySources,
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
