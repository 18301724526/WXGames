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

  function getSoftBoundaryNoise(x = 0, y = 0, radius = 4) {
    const scale = Math.max(8, toNumber(radius, 4) * 3.5);
    const waveA = Math.sin((toNumber(x) * 1.37 + toNumber(y) * 0.73) / scale);
    const waveB = Math.sin((toNumber(x) * -0.61 + toNumber(y) * 1.19) / (scale * 1.7) + 1.9);
    return clamp01(0.5 + waveA * 0.28 + waveB * 0.22);
  }

  const TILE_MASK_UNKNOWN = 0;
  const TILE_MASK_EXPLORED = 1;
  const TILE_MASK_VISIBLE = 2;

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

    rasterizeTileMask(channel, cache = this.cache, frame = {}, entry = {}, strength = 1) {
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
      const value = Math.round(clamp01(strength) * 255);
      if (value <= 0) return false;
      let wrote = false;
      for (let y = minY; y <= maxY; y += 1) {
        const v = ((y + 0.5) - centerY) / halfH;
        const row = y * cache.width;
        for (let x = minX; x <= maxX; x += 1) {
          const u = ((x + 0.5) - centerX) / halfW;
          if (Math.abs(u) + Math.abs(v) > 1) continue;
          const channelIndex = row + x;
          if (value > channel[channelIndex]) {
            channel[channelIndex] = value;
            wrote = true;
          }
        }
      }
      return wrote;
    }

    getChannelFeatherRadius(cache = this.cache, frame = {}, sourceSet = {}) {
      const geometry = sourceSet.geometry || {};
      const viewport = sourceSet.viewport || {};
      const scale = Math.max(0.05, toNumber(viewport.scale, 1));
      const maskScaleX = cache.width / Math.max(1, toNumber(frame.width, 1));
      const maskScaleY = cache.height / Math.max(1, toNumber(frame.height, 1));
      const tileWidthPx = Math.max(1, toNumber(geometry.tileWidth, 192)) * scale * maskScaleX;
      const tileHeightPx = Math.max(1, toNumber(geometry.tileHeight, 96)) * scale * maskScaleY;
      const tileMin = Math.max(1, Math.min(tileWidthPx, tileHeightPx));
      return Math.max(3, Math.min(10, Math.round(tileMin * 0.24)));
    }

    softenChannelInward(channel, cache = this.cache, radius = 4) {
      const blurRadius = Math.max(0, Math.min(12, Math.floor(toNumber(radius, 0))));
      if (!channel || !cache?.scratch || blurRadius <= 0) return channel;
      const { width, height, scratch } = cache;
      scratch.set(channel);
      const radiusSquared = blurRadius * blurRadius;
      for (let y = 0; y < height; y += 1) {
        const row = y * width;
        for (let x = 0; x < width; x += 1) {
          const index = row + x;
          if (scratch[index] <= 0) {
            channel[index] = 0;
            continue;
          }
          let nearestOutsideSquared = Infinity;
          for (let dy = -blurRadius; dy <= blurRadius; dy += 1) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) {
              nearestOutsideSquared = Math.min(nearestOutsideSquared, dy * dy);
              continue;
            }
            for (let dx = -blurRadius; dx <= blurRadius; dx += 1) {
              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared > radiusSquared || distanceSquared >= nearestOutsideSquared) continue;
              const nx = x + dx;
              if (nx < 0 || nx >= width || scratch[ny * width + nx] <= 0) {
                nearestOutsideSquared = distanceSquared;
              }
            }
          }
          if (nearestOutsideSquared === Infinity) {
            channel[index] = scratch[index];
            continue;
          }
          const distance = Math.sqrt(nearestOutsideSquared);
          const inset = Math.max(0.75, blurRadius * (0.10 + getSoftBoundaryNoise(x, y, blurRadius) * 0.24));
          const fade = smoothstep(inset, blurRadius, distance);
          channel[index] = Math.round(clamp01(fade * (scratch[index] / 255)) * 255);
        }
      }
      return channel;
    }

    fillMasks(cache = this.cache, frame = {}, sourceSet = {}) {
      const tileMaskEntries = Array.isArray(sourceSet.tileMaskEntries)
        ? sourceSet.tileMaskEntries
        : this.getTileMaskEntries(sourceSet);
      for (let i = 0; i < tileMaskEntries.length; i += 1) {
        const entry = tileMaskEntries[i];
        this.rasterizeTileMask(cache.explored, cache, frame, entry, entry.exploredStrength);
      }
      for (let i = 0; i < tileMaskEntries.length; i += 1) {
        const entry = tileMaskEntries[i];
        this.rasterizeTileMask(cache.visible, cache, frame, entry, entry.visibleStrength);
      }
      const featherRadius = this.getChannelFeatherRadius(cache, frame, sourceSet);
      this.softenChannelInward(cache.explored, cache, featherRadius);
      this.softenChannelInward(cache.visible, cache, Math.max(2, Math.round(featherRadius * 0.75)));
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
