(function (global) {
  const VisionModel = (() => {
    if (global.WorldFogVisionModel) return global.WorldFogVisionModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldFogVisionModel');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, toNumber(value, 0)));
  }

  function smoothstep(edge0 = 0, edge1 = 1, value = 0) {
    if (edge0 === edge1) return value < edge0 ? 0 : 1;
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function hashText(text = '') {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  const TILE_MASK_UNKNOWN = 0;
  const TILE_MASK_EXPLORED = 1;
  const TILE_MASK_VISIBLE = 2;

  const TILE_BOUNDARY_SIDES = Object.freeze([
    Object.freeze({
      dq: 0,
      dr: -1,
      margin: (u, v) => 1 - (u - v),
    }),
    Object.freeze({
      dq: 1,
      dr: 0,
      margin: (u, v) => 1 - (u + v),
    }),
    Object.freeze({
      dq: 0,
      dr: 1,
      margin: (u, v) => 1 - (-u + v),
    }),
    Object.freeze({
      dq: -1,
      dr: 0,
      margin: (u, v) => 1 - (-u - v),
    }),
  ]);

  function clampMaskLevel(value = TILE_MASK_UNKNOWN) {
    const level = Math.floor(toNumber(value, TILE_MASK_UNKNOWN));
    if (level >= TILE_MASK_VISIBLE) return TILE_MASK_VISIBLE;
    if (level >= TILE_MASK_EXPLORED) return TILE_MASK_EXPLORED;
    return TILE_MASK_UNKNOWN;
  }

  function getTileMaskLevel(tile = {}) {
    if (tile?.fogMaskLevel !== undefined) return clampMaskLevel(tile.fogMaskLevel);
    if (VisionModel?.isVisibleTile?.(tile)) return TILE_MASK_VISIBLE;
    if (VisionModel?.isExploredTile?.(tile)) return TILE_MASK_EXPLORED;
    return TILE_MASK_UNKNOWN;
  }

  function getTileId(coord = {}) {
    return VisionModel?.normalizeCoord?.(coord)?.tileId
      || `tile_${Math.floor(toNumber(coord.q ?? coord.x, 0))}_${Math.floor(toNumber(coord.r ?? coord.y, 0))}`;
  }

  function getTileMaskDrawRect(center = {}, viewport = {}, geometry = {}) {
    const scale = Math.max(0.05, toNumber(viewport.scale, 1));
    const width = Math.max(1, toNumber(geometry.tileWidth, 192)) * scale;
    const height = Math.max(1, toNumber(geometry.tileHeight, 96)) * scale;
    const anchorY = Math.max(0, Math.min(1, toNumber(geometry.anchorY, 0.5)));
    return {
      x: toNumber(center.x) - width * 0.5,
      y: toNumber(center.y) - height * anchorY,
      width,
      height,
    };
  }

  class WorldFogMaskGenerator {
    constructor(options = {}) {
      this.maskSize = Math.max(96, Math.min(512, Number(options.maskSize) || 256));
      this.framePaddingTiles = Math.max(0, Math.min(4, Number(options.framePaddingTiles) || 3));
      this.cache = {
        key: '',
        contextKey: '',
        width: 0,
        height: 0,
        explored: null,
        visible: null,
        scratch: null,
        maskFrame: null,
      };
    }

    reset() {
      this.cache.key = '';
      this.cache.contextKey = '';
      this.cache.explored?.fill?.(0);
      this.cache.visible?.fill?.(0);
      this.cache.tileMaskEntries = null;
      this.cache.maskFrame = null;
      return this.cache;
    }

    ensureCache(width = 1, height = 1) {
      const maskWidth = Math.max(1, Math.floor(width));
      const maskHeight = Math.max(1, Math.floor(height));
      const size = maskWidth * maskHeight;
      if (
        this.cache.width !== maskWidth
        || this.cache.height !== maskHeight
        || this.cache.explored?.length !== size
        || this.cache.visible?.length !== size
      ) {
        this.cache = {
          key: '',
          contextKey: '',
          width: maskWidth,
          height: maskHeight,
          explored: new Uint8Array(size),
          visible: new Uint8Array(size),
          scratch: new Uint8Array(size),
          maskFrame: null,
        };
      }
      return this.cache;
    }

    getMaskDimensions(frame = {}) {
      const width = Math.max(1, Number(frame.width) || 1);
      const height = Math.max(1, Number(frame.height) || 1);
      const longest = Math.max(width, height);
      const scale = Math.max(0.18, Math.min(1, this.maskSize / longest));
      return {
        width: Math.max(48, Math.ceil(width * scale)),
        height: Math.max(48, Math.ceil(height * scale)),
        scaleX: scale,
        scaleY: scale,
      };
    }

    getTileMaskSignature(sourceSet = {}) {
      const parts = [];
      const entries = Array.isArray(sourceSet.tileMaskEntries)
        ? sourceSet.tileMaskEntries
        : this.getTileMaskEntries(sourceSet);
      entries.forEach((entry) => {
        parts.push([
          entry.id,
          entry.maskLevel,
          Math.round(toNumber(entry.center?.x) * 10),
          Math.round(toNumber(entry.center?.y) * 10),
          Math.round(toNumber(entry.maskRect?.width) * 10),
          Math.round(toNumber(entry.maskRect?.height) * 10),
          Math.round(toNumber(entry.exploredStrength) * 1000),
          Math.round(toNumber(entry.visibleStrength) * 1000),
        ].join(':'));
      });
      return hashText(parts.join('|'));
    }

    getMaskKey(context = {}, frame = {}, dimensions = {}, sourceSet = {}) {
      const viewport = sourceSet.viewport || context.viewport || {};
      const geometry = sourceSet.geometry || context.geometry || {};
      const entries = sourceSet.entries || [];
      const signatureText = [
        context.fogVisualSnapshot?.signature || context.tileMapView?.signature || '',
        entries.length,
        this.getTileMaskSignature(sourceSet),
        dimensions.width,
        dimensions.height,
        Math.round(toNumber(frame.x)),
        Math.round(toNumber(frame.y)),
        Math.round(toNumber(frame.width)),
        Math.round(toNumber(frame.height)),
        Math.round(toNumber(viewport.originX)),
        Math.round(toNumber(viewport.originY)),
        Math.round(toNumber(viewport.panX)),
        Math.round(toNumber(viewport.panY)),
        Math.round(toNumber(viewport.scale, 1) * 1000),
        Math.round(toNumber(geometry.stepX, 96) * 10),
        Math.round(toNumber(geometry.stepY, 48) * 10),
      ].join('|');
      return hashText(signatureText);
    }

    getContextKey(context = {}, frame = {}, dimensions = {}, sourceSet = null) {
      const viewport = context.viewport || {};
      const geometry = context.geometry || context.tileMapView?.geometry || viewport.geometry || {};
      const signatureSource = sourceSet || {
        entries: context.entries || [],
        geometry,
        viewport,
      };
      return [
        context.fogVisualSnapshot?.signature || context.tileMapView?.signature || '',
        context.tileMapView?.version || '',
        Array.isArray(context.entries) ? context.entries.length : '',
        this.getTileMaskSignature(signatureSource),
        Math.round(toNumber(frame.x)),
        Math.round(toNumber(frame.y)),
        Math.round(toNumber(frame.width)),
        Math.round(toNumber(frame.height)),
        dimensions.width,
        dimensions.height,
        Math.round(toNumber(viewport.originX)),
        Math.round(toNumber(viewport.originY)),
        Math.round(toNumber(viewport.panX)),
        Math.round(toNumber(viewport.panY)),
        Math.round(toNumber(viewport.scale, 1) * 1000),
        Math.round(toNumber(geometry.stepX, 96) * 10),
        Math.round(toNumber(geometry.stepY, 48) * 10),
      ].join('|');
    }

    getTileMaskEntries(sourceSet = {}) {
      const viewport = sourceSet.viewport || {};
      const geometry = sourceSet.geometry || {};
      return (Array.isArray(sourceSet.entries) ? sourceSet.entries : [])
        .map((entry) => {
          if (!entry?.tile) return null;
          const coord = VisionModel?.normalizeCoord?.(entry.tile) || {
            q: Math.floor(toNumber(entry.tile.q ?? entry.tile.x, 0)),
            r: Math.floor(toNumber(entry.tile.r ?? entry.tile.y, 0)),
            tileId: getTileId(entry.tile),
          };
          const center = entry.center || VisionModel?.getTileScreenCenter?.(coord, viewport, geometry) || { x: 0, y: 0 };
          const maskRect = getTileMaskDrawRect(center, viewport, geometry);
          const maskLevel = getTileMaskLevel(entry.tile);
          return {
            id: coord.tileId,
            q: coord.q,
            r: coord.r,
            center,
            maskRect,
            maskLevel,
            exploredStrength: maskLevel >= TILE_MASK_EXPLORED ? 1 : 0,
            visibleStrength: maskLevel >= TILE_MASK_VISIBLE ? 1 : 0,
          };
        })
        .filter(Boolean);
    }

    getChannelTileSet(tileMaskEntries = [], channel = 'explored') {
      const result = new Set();
      tileMaskEntries.forEach((entry) => {
        const strength = channel === 'visible' ? entry.visibleStrength : entry.exploredStrength;
        if (strength > 0.01) result.add(entry.id);
      });
      return result;
    }

    getNeighborId(entry = {}, side = {}) {
      return getTileId({
        q: toNumber(entry.q) + toNumber(side.dq),
        r: toNumber(entry.r) + toNumber(side.dr),
      });
    }

    rasterizeTileMask(channel, cache = this.cache, frame = {}, entry = {}, channelTileSet = new Set(), strength = 1) {
      const maskRect = entry?.maskRect || entry?.drawRect || null;
      if (!channel || !entry?.center || !maskRect || strength <= 0) return false;
      const maskScaleX = cache.width / Math.max(1, toNumber(frame.width, 1));
      const maskScaleY = cache.height / Math.max(1, toNumber(frame.height, 1));
      const centerX = (toNumber(entry.center.x) - toNumber(frame.x)) * maskScaleX;
      const centerY = (toNumber(entry.center.y) - toNumber(frame.y)) * maskScaleY;
      const halfW = Math.max(1, toNumber(maskRect.width, 1) * maskScaleX * 0.5);
      const halfH = Math.max(1, toNumber(maskRect.height, 1) * maskScaleY * 0.5);
      const minX = Math.max(0, Math.floor(centerX - halfW - 1));
      const maxX = Math.min(cache.width - 1, Math.ceil(centerX + halfW + 1));
      const minY = Math.max(0, Math.floor(centerY - halfH - 1));
      const maxY = Math.min(cache.height - 1, Math.ceil(centerY + halfH + 1));
      if (minX > maxX || minY > maxY) return false;
      const feather = Math.max(0.08, Math.min(0.34, 8 / Math.max(1, Math.min(halfW, halfH))));
      let wrote = false;
      for (let y = minY; y <= maxY; y += 1) {
        const v = ((y + 0.5) - centerY) / halfH;
        const row = y * cache.width;
        for (let x = minX; x <= maxX; x += 1) {
          const u = ((x + 0.5) - centerX) / halfW;
          if (Math.abs(u) + Math.abs(v) > 1) continue;
          let edgeFade = 1;
          for (let index = 0; index < TILE_BOUNDARY_SIDES.length; index += 1) {
            const side = TILE_BOUNDARY_SIDES[index];
            if (channelTileSet.has(this.getNeighborId(entry, side))) continue;
            edgeFade = Math.min(edgeFade, smoothstep(0, feather, side.margin(u, v)));
          }
          const value = Math.round(clamp01(edgeFade * strength) * 255);
          if (value <= 0) continue;
          const channelIndex = row + x;
          if (value > channel[channelIndex]) {
            channel[channelIndex] = value;
            wrote = true;
          }
        }
      }
      return wrote;
    }

    fillMasks(cache = this.cache, frame = {}, sourceSet = {}) {
      const tileMaskEntries = Array.isArray(sourceSet.tileMaskEntries)
        ? sourceSet.tileMaskEntries
        : this.getTileMaskEntries(sourceSet);
      const exploredTileSet = this.getChannelTileSet(tileMaskEntries, 'explored');
      const visibleTileSet = this.getChannelTileSet(tileMaskEntries, 'visible');
      for (let i = 0; i < tileMaskEntries.length; i += 1) {
        const entry = tileMaskEntries[i];
        this.rasterizeTileMask(cache.explored, cache, frame, entry, exploredTileSet, entry.exploredStrength);
      }
      for (let i = 0; i < tileMaskEntries.length; i += 1) {
        const entry = tileMaskEntries[i];
        this.rasterizeTileMask(cache.visible, cache, frame, entry, visibleTileSet, entry.visibleStrength);
      }
      cache.tileMaskEntries = tileMaskEntries;
      return cache;
    }

    getFramePadding(context = {}) {
      const viewport = context.viewport || {};
      const geometry = context.geometry || context.tileMapView?.geometry || viewport.geometry || {};
      const scale = Math.max(0.05, toNumber(viewport.scale, 1));
      const stepX = Math.max(1, toNumber(geometry.stepX, 96)) * scale;
      const stepY = Math.max(1, toNumber(geometry.stepY, 48)) * scale;
      return Math.max(12, Math.ceil(Math.max(stepX, stepY) * this.framePaddingTiles));
    }

    getMaskFrame(context = {}) {
      const frame = context.frame || {};
      const coverFrame = context.coverFrame || context.viewportFrame || {};
      const padding = this.getFramePadding(context);
      const frameX = toNumber(frame.x, 0);
      const frameY = toNumber(frame.y, 0);
      const frameRight = frameX + Math.max(1, toNumber(frame.width, 1));
      const frameBottom = frameY + Math.max(1, toNumber(frame.height, 1));
      const coverX = toNumber(coverFrame.x, frameX);
      const coverY = toNumber(coverFrame.y, frameY);
      const coverRight = coverX + Math.max(1, toNumber(coverFrame.width, frameRight - coverX));
      const coverBottom = coverY + Math.max(1, toNumber(coverFrame.height, frameBottom - coverY));
      const x = Math.min(frameX, coverX) - padding;
      const y = Math.min(frameY, coverY) - padding;
      const right = Math.max(frameRight, coverRight) + padding;
      const bottom = Math.max(frameBottom, coverBottom) + padding;
      return {
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y),
      };
    }

    prepare(context = {}) {
      if (!VisionModel?.collectSources) return null;
      const maskFrame = this.getMaskFrame(context);
      const dimensions = this.getMaskDimensions(maskFrame);
      const sourceSet = VisionModel.collectSources(context);
      sourceSet.tileMaskEntries = this.getTileMaskEntries(sourceSet);
      const contextKey = this.getContextKey(context, maskFrame, dimensions, sourceSet);
      if (this.cache.contextKey === contextKey && this.cache.key && this.cache.maskFrame) {
        return {
          mask: this.cache,
          changed: false,
          sourceSet: this.cache.sourceSet || null,
        };
      }
      const key = this.getMaskKey(context, maskFrame, dimensions, sourceSet);
      const cache = this.ensureCache(dimensions.width, dimensions.height);
      if (cache.key === key && cache.maskFrame) {
        cache.contextKey = contextKey;
        cache.sourceSet = sourceSet;
        return {
          mask: cache,
          changed: false,
          sourceSet,
        };
      }
      cache.explored.fill(0);
      cache.visible.fill(0);
      cache.maskFrame = { ...maskFrame };
      this.fillMasks(cache, maskFrame, sourceSet);
      cache.key = key;
      cache.contextKey = contextKey;
      cache.sourceSet = sourceSet;
      return {
        mask: cache,
        changed: true,
        sourceSet,
      };
    }
  }

  WorldFogMaskGenerator.smoothstep = smoothstep;
  global.WorldFogMaskGenerator = WorldFogMaskGenerator;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldFogMaskGenerator;
})(typeof window !== 'undefined' ? window : globalThis);
