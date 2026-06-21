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

  const VisibilityModel = (() => {
    if (global.WorldMapVisibilityModel) return global.WorldMapVisibilityModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapVisibilityModel');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const RenderSnapshot = (() => {
    if (global.WorldMapRenderSnapshot) return global.WorldMapRenderSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapRenderSnapshot');
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

  const MASK_UNKNOWN = 0;
  const MASK_EXPLORED = 1;
  const MASK_VISIBLE = 2;

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function hashStep(hash, value) {
    return SignatureHash.hashStep(hash, value);
  }

  function tileId(q, r) {
    return VisibilityModel?.tileId?.(q, r) || `tile_${toInteger(q)}_${toInteger(r)}`;
  }

  function normalizeCoord(source = {}, fallback = {}) {
    if (VisibilityModel?.normalizeCoord) return VisibilityModel.normalizeCoord(source, fallback);
    const normalized = TileCoord?.normalizeCoord
      ? TileCoord.normalizeCoord(source, fallback)
      : null;
    const coord = normalized || (source && typeof source === 'object' ? source : {});
    const base = fallback && typeof fallback === 'object' ? fallback : {};
    const q = normalized ? normalized.x : toInteger(coord.x ?? coord.q, base.x ?? base.q ?? 0);
    const r = normalized ? normalized.y : toInteger(coord.y ?? coord.r, base.y ?? base.r ?? 0);
    return {
      q,
      r,
      tileId: tileId(q, r),
    };
  }

  function normalizeGeometry(input = {}) {
    const tileWidth = Math.max(1, toNumber(input.tileWidth, 192));
    const tileHeight = Math.max(1, toNumber(input.tileHeight, 96));
    return {
      tileWidth,
      tileHeight,
      stepX: Math.max(1, toNumber(input.stepX, tileWidth * 0.5)),
      stepY: Math.max(1, toNumber(input.stepY, tileHeight * 0.5)),
      anchorY: toNumber(input.anchorY, 0.5),
    };
  }

  function normalizeViewport(input = {}, geometry = {}) {
    const worldOrigin = normalizeCoord(input.worldOrigin || input.originCoord || input.renderOrigin || {});
    return {
      originX: toNumber(input.originX, 0),
      originY: toNumber(input.originY, 0),
      panX: toNumber(input.panX, 0),
      panY: toNumber(input.panY, 0),
      scale: Math.max(0.05, toNumber(input.scale, 1)),
      seed: input.seed || 'scout-tile-v1',
      geometry,
      worldOrigin,
    };
  }

  function normalizeFrame(input = {}) {
    return {
      x: toNumber(input.x, 0),
      y: toNumber(input.y, 0),
      width: Math.max(1, toNumber(input.width, 1)),
      height: Math.max(1, toNumber(input.height, 1)),
    };
  }

  function expandFrame(frame = {}, padding = 0) {
    const size = Math.max(0, toNumber(padding, 0));
    return {
      x: toNumber(frame.x, 0) - size,
      y: toNumber(frame.y, 0) - size,
      width: Math.max(1, toNumber(frame.width, 1) + size * 2),
      height: Math.max(1, toNumber(frame.height, 1) + size * 2),
    };
  }

  function getFogCullPadding(options = {}, viewport = {}, geometry = {}) {
    const explicit = options.fogCullPaddingPx ?? options.cullPaddingPx;
    if (Number.isFinite(Number(explicit))) return Math.max(0, Number(explicit));
    const scale = Math.max(0.05, toNumber(viewport.scale, 1));
    const stepX = Math.max(1, toNumber(geometry.stepX, 96)) * scale;
    const stepY = Math.max(1, toNumber(geometry.stepY, 48)) * scale;
    return Math.max(96, Math.ceil(Math.max(stepX, stepY) * 4));
  }

  function getTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
    const origin = normalizeCoord(viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || {});
    const q = toNumber(tile.q ?? tile.x, 0);
    const r = toNumber(tile.r ?? tile.y, 0);
    const scale = Math.max(0.05, toNumber(viewport.scale, 1));
    return {
      x: toNumber(viewport.originX, 0) + toNumber(viewport.panX, 0) + ((q - origin.q) - (r - origin.r)) * toNumber(geometry.stepX, 96) * scale,
      y: toNumber(viewport.originY, 0) + toNumber(viewport.panY, 0) + ((q - origin.q) + (r - origin.r)) * toNumber(geometry.stepY, 48) * scale,
    };
  }

  function getTileDrawRect(center = {}, viewport = {}, geometry = {}) {
    const scale = Math.max(0.05, toNumber(viewport.scale, 1));
    const width = toNumber(geometry.tileWidth, 192) * scale;
    const height = toNumber(geometry.tileHeight, 96) * scale;
    const anchorY = toNumber(geometry.anchorY, 0.5);
    return {
      x: toNumber(center.x, 0) - width * 0.5,
      y: toNumber(center.y, 0) - height * anchorY,
      width,
      height,
    };
  }

  function intersectsFrame(rect = {}, frame = {}) {
    return Boolean(
      toNumber(rect.x, 0) < toNumber(frame.x, 0) + toNumber(frame.width, 1)
      && toNumber(rect.x, 0) + toNumber(rect.width, 0) > toNumber(frame.x, 0)
      && toNumber(rect.y, 0) < toNumber(frame.y, 0) + toNumber(frame.height, 1)
      && toNumber(rect.y, 0) + toNumber(rect.height, 0) > toNumber(frame.y, 0)
    );
  }

  function levelName(level) {
    return VisibilityModel?.levelName?.(level) || (level >= 3 ? 'controlled' : (level >= 2 ? 'visible' : (level >= 1 ? 'explored' : 'unknown')));
  }

  function normalizeLevel(value, tile = {}) {
    if (VisibilityModel?.normalizeLevel) {
      return VisibilityModel.normalizeLevel(value, {
        controlled: tile.controlled || tile.visibility === 'controlled' || tile.siteId === 'capital',
        discovered: tile.discovered,
        visible: tile.visible,
        defaultLevel: tile.discovered === false ? 0 : 1,
      });
    }
    const level = toInteger(value, tile.discovered === false ? 0 : 1);
    return Math.max(0, Math.min(3, level));
  }

  function maskLevelForVisibility(level) {
    if (level >= (VisibilityModel?.LEVEL_VISIBLE ?? 2)) return MASK_VISIBLE;
    if (level >= (VisibilityModel?.LEVEL_EXPLORED ?? 1)) return MASK_EXPLORED;
    return MASK_UNKNOWN;
  }

  function getLevel(visibilitySnapshot = null, id = '', tile = {}) {
    if (VisibilityModel?.getLevel && visibilitySnapshot) return VisibilityModel.getLevel(visibilitySnapshot, id);
    return normalizeLevel(tile.visibility, tile);
  }

  function buildRenderSnapshot(input = {}, options = {}) {
    if (input.renderSnapshot && typeof input.renderSnapshot === 'object') return input.renderSnapshot;
    if (!RenderSnapshot?.createSnapshot || !input.tileMapView) return null;
    return RenderSnapshot.createSnapshot({
      tileMapView: input.tileMapView,
      uiState: input.uiState || {},
      x: input.x ?? input.frame?.x ?? 0,
      y: input.y ?? input.frame?.y ?? 0,
      width: input.width ?? input.frame?.width ?? 1,
      height: input.height ?? input.frame?.height ?? 1,
    }, options);
  }

  function buildVisibilitySnapshot(input = {}, tileMapView = {}, options = {}) {
    if (input.visibilitySnapshot && typeof input.visibilitySnapshot === 'object') return input.visibilitySnapshot;
    if (!VisibilityModel?.createSnapshot) return null;
    return VisibilityModel.createSnapshot({
      worldMap: {
        version: tileMapView.version || input.version || 0,
        seed: tileMapView.seed || input.seed || '',
        tiles: Array.isArray(input.tiles) ? input.tiles : (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []),
      },
      worldExplorerState: input.worldExplorerState || {},
      missions: input.missions,
    }, options.visibilityOptions || options);
  }

  function createAccumulator(input = {}) {
    return {
      schema: 'world-fog-visual-snapshot-v1',
      version: input.version || 0,
      tileIds: [],
      q: [],
      r: [],
      levels: [],
      maskLevels: [],
      centerX: [],
      centerY: [],
      drawX: [],
      drawY: [],
      drawWidth: [],
      drawHeight: [],
      inView: [],
      indexById: Object.create(null),
      viewport: input.viewport || {},
      frame: input.frame || {},
      geometry: input.geometry || {},
      counts: {
        total: 0,
        unknown: 0,
        explored: 0,
        visible: 0,
        controlled: 0,
        maskExplored: 0,
        maskVisible: 0,
        inView: 0,
      },
      visibilitySignature: input.visibilitySignature || '',
      renderSignature: input.renderSignature || '',
      signature: '',
      _hash: SignatureHash.FNV_OFFSET_BASIS,
    };
  }

  function incrementLevelCount(counts, level) {
    const name = levelName(level);
    if (Object.prototype.hasOwnProperty.call(counts, name)) counts[name] += 1;
  }

  function appendTile(accumulator, tile = {}, level = 0, viewport = {}, geometry = {}, frame = {}) {
    const coord = normalizeCoord(tile);
    const id = String(coord.tileId || tileId(coord.q, coord.r));
    if (accumulator.indexById[id] !== undefined) return accumulator.indexById[id];
    const center = getTileScreenCenter(coord, viewport, geometry);
    const drawRect = getTileDrawRect(center, viewport, geometry);
    const maskLevel = maskLevelForVisibility(level);
    const inView = intersectsFrame(drawRect, frame) ? 1 : 0;
    const index = accumulator.tileIds.length;
    accumulator.indexById[id] = index;
    accumulator.tileIds.push(id);
    accumulator.q.push(coord.q);
    accumulator.r.push(coord.r);
    accumulator.levels.push(level);
    accumulator.maskLevels.push(maskLevel);
    accumulator.centerX.push(center.x);
    accumulator.centerY.push(center.y);
    accumulator.drawX.push(drawRect.x);
    accumulator.drawY.push(drawRect.y);
    accumulator.drawWidth.push(drawRect.width);
    accumulator.drawHeight.push(drawRect.height);
    accumulator.inView.push(inView);
    accumulator.counts.total += 1;
    accumulator.counts.maskExplored += maskLevel >= MASK_EXPLORED ? 1 : 0;
    accumulator.counts.maskVisible += maskLevel >= MASK_VISIBLE ? 1 : 0;
    accumulator.counts.inView += inView;
    incrementLevelCount(accumulator.counts, level);
    accumulator._hash = hashStep(accumulator._hash, id);
    accumulator._hash = hashStep(accumulator._hash, level);
    accumulator._hash = hashStep(accumulator._hash, maskLevel);
    accumulator._hash = hashStep(accumulator._hash, Math.round(center.x * 10));
    accumulator._hash = hashStep(accumulator._hash, Math.round(center.y * 10));
    accumulator._hash = hashStep(accumulator._hash, Math.round(drawRect.width * 10));
    accumulator._hash = hashStep(accumulator._hash, Math.round(drawRect.height * 10));
    return index;
  }

  function finalizeSnapshot(accumulator) {
    accumulator.signature = [
      accumulator.version,
      accumulator.visibilitySignature,
      accumulator.renderSignature,
      accumulator.tileIds.length,
      (accumulator._hash >>> 0).toString(16),
    ].join(':');
    delete accumulator._hash;
    return accumulator;
  }

  function getFogRenderSignature(viewport = {}, frame = {}, geometry = {}) {
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    [
      Math.round(toNumber(viewport.originX, 0)),
      Math.round(toNumber(viewport.originY, 0)),
      Math.round(toNumber(viewport.panX, 0)),
      Math.round(toNumber(viewport.panY, 0)),
      Math.round(toNumber(viewport.scale, 1) * 1000),
      normalizeCoord(viewport.worldOrigin || viewport.originCoord || viewport.renderOrigin || {}).tileId,
      Math.round(toNumber(frame.x, 0)),
      Math.round(toNumber(frame.y, 0)),
      Math.round(toNumber(frame.width, 1)),
      Math.round(toNumber(frame.height, 1)),
      Math.round(toNumber(geometry.tileWidth, 192) * 10),
      Math.round(toNumber(geometry.tileHeight, 96) * 10),
      Math.round(toNumber(geometry.stepX, 96) * 10),
      Math.round(toNumber(geometry.stepY, 48) * 10),
      Math.round(toNumber(geometry.anchorY, 0.5) * 1000),
    ].forEach((part) => {
      hash = hashStep(hash, part);
    });
    return (hash >>> 0).toString(16);
  }

  function createSnapshot(input = {}, options = {}) {
    const renderSnapshot = buildRenderSnapshot(input, options);
    const tileMapView = input.tileMapView || renderSnapshot?.tileMapView || {};
    const geometry = normalizeGeometry(input.geometry || renderSnapshot?.geometry || tileMapView.geometry || renderSnapshot?.viewport?.geometry || {});
    const viewport = normalizeViewport(input.viewport || renderSnapshot?.viewport || {}, geometry);
    const frame = normalizeFrame(input.frame || renderSnapshot?.frame || {});
    const cullFrame = expandFrame(frame, getFogCullPadding(options, viewport, geometry));
    const tiles = Array.isArray(input.tiles) ? input.tiles : (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []);
    const visibilitySnapshot = buildVisibilitySnapshot(input, tileMapView, options);
    const accumulator = createAccumulator({
      version: tileMapView.version || visibilitySnapshot?.version || input.version || 0,
      viewport,
      frame,
      geometry,
      visibilitySignature: visibilitySnapshot?.signature || '',
      renderSignature: getFogRenderSignature(viewport, frame, geometry),
    });
    for (let i = 0; i < tiles.length; i += 1) {
      const coord = normalizeCoord(tiles[i]);
      appendTile(accumulator, coord, getLevel(visibilitySnapshot, coord.tileId, tiles[i]), viewport, geometry, cullFrame);
    }
    return finalizeSnapshot(accumulator);
  }

  function getTile(snapshot = {}, index = 0) {
    const level = toInteger(snapshot.levels?.[index], 0);
    const maskLevel = toInteger(snapshot.maskLevels?.[index], 0);
    const q = toInteger(snapshot.q?.[index], 0);
    const r = toInteger(snapshot.r?.[index], 0);
    const id = snapshot.tileIds?.[index] || tileId(q, r);
    return {
      id,
      tileId: id,
      q,
      r,
      visibility: levelName(level),
      visibilityLevel: level,
      discovered: level >= (VisibilityModel?.LEVEL_EXPLORED ?? 1),
      visible: level >= (VisibilityModel?.LEVEL_VISIBLE ?? 2),
      fogMaskLevel: maskLevel,
    };
  }

  function getEntry(snapshot = {}, index = 0) {
    return {
      tile: getTile(snapshot, index),
      center: {
        x: toNumber(snapshot.centerX?.[index], 0),
        y: toNumber(snapshot.centerY?.[index], 0),
      },
      drawRect: {
        x: toNumber(snapshot.drawX?.[index], 0),
        y: toNumber(snapshot.drawY?.[index], 0),
        width: toNumber(snapshot.drawWidth?.[index], 0),
        height: toNumber(snapshot.drawHeight?.[index], 0),
      },
      inView: snapshot.inView?.[index] === 1,
    };
  }

  function toRendererEntries(snapshot = {}, options = {}) {
    const result = [];
    const inViewOnly = options.inViewOnly === true;
    const length = Array.isArray(snapshot.tileIds) ? snapshot.tileIds.length : 0;
    for (let i = 0; i < length; i += 1) {
      if (inViewOnly && snapshot.inView?.[i] !== 1) continue;
      result.push(getEntry(snapshot, i));
    }
    return result;
  }

  function toRendererContext(snapshot = {}, options = {}) {
    const entries = toRendererEntries(snapshot, {
      ...options,
      inViewOnly: options.inViewOnly !== false,
    });
    return {
      tileMapView: {
        seed: options.seed || snapshot.viewport?.seed || 'scout-tile-v1',
        version: snapshot.version || 0,
        signature: snapshot.signature || '',
        geometry: snapshot.geometry || {},
        tiles: entries.map((entry) => entry.tile),
      },
      viewport: snapshot.viewport || {},
      frame: snapshot.frame || {},
      entries,
      fogVisualSnapshot: snapshot,
    };
  }

  function toSerializable(snapshot = {}) {
    return {
      schema: snapshot.schema || 'world-fog-visual-snapshot-v1',
      version: snapshot.version || 0,
      tileIds: Array.isArray(snapshot.tileIds) ? [...snapshot.tileIds] : [],
      q: Array.isArray(snapshot.q) ? [...snapshot.q] : [],
      r: Array.isArray(snapshot.r) ? [...snapshot.r] : [],
      levels: Array.isArray(snapshot.levels) ? [...snapshot.levels] : [],
      maskLevels: Array.isArray(snapshot.maskLevels) ? [...snapshot.maskLevels] : [],
      centerX: Array.isArray(snapshot.centerX) ? [...snapshot.centerX] : [],
      centerY: Array.isArray(snapshot.centerY) ? [...snapshot.centerY] : [],
      drawX: Array.isArray(snapshot.drawX) ? [...snapshot.drawX] : [],
      drawY: Array.isArray(snapshot.drawY) ? [...snapshot.drawY] : [],
      drawWidth: Array.isArray(snapshot.drawWidth) ? [...snapshot.drawWidth] : [],
      drawHeight: Array.isArray(snapshot.drawHeight) ? [...snapshot.drawHeight] : [],
      inView: Array.isArray(snapshot.inView) ? [...snapshot.inView] : [],
      indexById: { ...(snapshot.indexById || {}) },
      viewport: { ...(snapshot.viewport || {}) },
      frame: { ...(snapshot.frame || {}) },
      geometry: { ...(snapshot.geometry || {}) },
      counts: { ...(snapshot.counts || {}) },
      visibilitySignature: snapshot.visibilitySignature || '',
      renderSignature: snapshot.renderSignature || '',
      signature: snapshot.signature || '',
    };
  }

  const api = {
    MASK_UNKNOWN,
    MASK_EXPLORED,
    MASK_VISIBLE,
    createSnapshot,
    getEntry,
    getTile,
    getTileDrawRect,
    getTileScreenCenter,
    maskLevelForVisibility,
    normalizeCoord,
    normalizeFrame,
    normalizeGeometry,
    normalizeViewport,
    toRendererContext,
    toRendererEntries,
    toSerializable,
  };

  global.WorldFogVisualSnapshot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
