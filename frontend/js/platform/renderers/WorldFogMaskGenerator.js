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

    getMaskKey(context = {}, frame = {}, dimensions = {}, sourceSet = {}) {
      const viewport = sourceSet.viewport || context.viewport || {};
      const geometry = sourceSet.geometry || context.geometry || {};
      const entries = sourceSet.entries || [];
      const signatureText = [
        context.fogVisualSnapshot?.signature || context.tileMapView?.signature || '',
        entries.length,
        VisionModel?.getSourceSignature?.(sourceSet.memorySources || []) || '',
        VisionModel?.getSourceSignature?.(sourceSet.visionSources || []) || '',
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

    getContextKey(context = {}, frame = {}, dimensions = {}) {
      const viewport = context.viewport || {};
      const geometry = context.geometry || context.tileMapView?.geometry || viewport.geometry || {};
      const historySources = context.tileMapView?.visionHistory?.sources
        || context.tileMapView?.visionHistorySources
        || context.renderSnapshot?.tileMapView?.visionHistory?.sources
        || [];
      const historySignature = VisionModel?.getSourceSignature
        ? VisionModel.getSourceSignature((Array.isArray(historySources) ? historySources : []).map((source) => {
          const kind = source?.kind === 'city' ? 'city' : 'unit';
          return VisionModel.createSource(kind, source, viewport, geometry);
        }))
        : '';
      const actors = Array.isArray(context.visibilityActors)
        ? context.visibilityActors
        : (Array.isArray(context.actors)
        ? context.actors
        : (Array.isArray(context.renderSnapshot?.actors) ? context.renderSnapshot.actors : []));
      const actorSignature = actors
        .map((actor) => {
          const current = actor?.current || actor?.position || actor?.target || {};
          return [
            actor?.id || actor?.missionId || '',
            Math.round(toNumber(current.q ?? current.x, 0) * 1000),
            Math.round(toNumber(current.r ?? current.y, 0) * 1000),
            actor?.status || '',
          ].join(':');
        })
        .join(',');
      return [
        context.fogVisualSnapshot?.signature || context.tileMapView?.signature || '',
        context.tileMapView?.version || '',
        Array.isArray(context.entries) ? context.entries.length : '',
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
        historySignature,
        actorSignature,
      ].join('|');
    }

    getSourceEllipse(source = {}, viewport = {}, geometry = {}, frame = {}, cache = this.cache) {
      const scale = Math.max(0.05, toNumber(viewport.scale, 1));
      const radiusTiles = Math.max(0.05, toNumber(source.radiusTiles, 1));
      const clearRadiusTiles = Math.max(0, Math.min(radiusTiles, toNumber(source.clearRadiusTiles, radiusTiles * 0.42)));
      const radiusScale = 1.36;
      const radiusScreenX = Math.max(1, Math.max(1, toNumber(geometry.stepX, 96)) * scale * radiusTiles * radiusScale);
      const radiusScreenY = Math.max(1, Math.max(1, toNumber(geometry.stepY, 48)) * scale * radiusTiles * radiusScale);
      const maskScaleX = cache.width / Math.max(1, toNumber(frame.width, 1));
      const maskScaleY = cache.height / Math.max(1, toNumber(frame.height, 1));
      const clearRatio = radiusTiles > 0 ? clamp01(clearRadiusTiles / radiusTiles) : 0;
      return {
        centerX: (toNumber(source.center?.x) - toNumber(frame.x)) * maskScaleX,
        centerY: (toNumber(source.center?.y) - toNumber(frame.y)) * maskScaleY,
        radiusX: Math.max(1, radiusScreenX * maskScaleX),
        radiusY: Math.max(1, radiusScreenY * maskScaleY),
        clearRatio,
      };
    }

    stampSource(channel, cache = this.cache, frame = {}, source = {}, viewport = {}, geometry = {}) {
      if (!channel || !source?.center) return false;
      const ellipse = this.getSourceEllipse(source, viewport, geometry, frame, cache);
      const minX = Math.max(0, Math.floor(ellipse.centerX - ellipse.radiusX - 1));
      const maxX = Math.min(cache.width - 1, Math.ceil(ellipse.centerX + ellipse.radiusX + 1));
      const minY = Math.max(0, Math.floor(ellipse.centerY - ellipse.radiusY - 1));
      const maxY = Math.min(cache.height - 1, Math.ceil(ellipse.centerY + ellipse.radiusY + 1));
      if (minX > maxX || minY > maxY) return false;
      const strength = clamp01(source.strength ?? 1);
      const clearRatio = Math.max(0, Math.min(0.98, ellipse.clearRatio));
      const invRadiusX = 1 / Math.max(1, ellipse.radiusX);
      const invRadiusY = 1 / Math.max(1, ellipse.radiusY);
      let wrote = false;
      for (let y = minY; y <= maxY; y += 1) {
        const normalizedY = ((y + 0.5) - ellipse.centerY) * invRadiusY;
        const row = y * cache.width;
        const y2 = normalizedY * normalizedY;
        if (y2 >= 1.05) continue;
        for (let x = minX; x <= maxX; x += 1) {
          const normalizedX = ((x + 0.5) - ellipse.centerX) * invRadiusX;
          const distance = Math.sqrt(normalizedX * normalizedX + y2);
          if (distance >= 1) continue;
          const fade = distance <= clearRatio
            ? 1
            : 1 - smoothstep(clearRatio, 1, distance);
          const value = Math.round(clamp01(fade * strength) * 255);
          const index = row + x;
          if (value > channel[index]) {
            channel[index] = value;
            wrote = true;
          }
        }
      }
      return wrote;
    }

    fillMasks(cache = this.cache, frame = {}, sourceSet = {}) {
      const viewport = sourceSet.viewport || {};
      const geometry = sourceSet.geometry || {};
      const memorySources = sourceSet.memorySources || [];
      const visionSources = sourceSet.visionSources || [];
      for (let i = 0; i < memorySources.length; i += 1) {
        this.stampSource(cache.explored, cache, frame, memorySources[i], viewport, geometry);
      }
      for (let i = 0; i < visionSources.length; i += 1) {
        this.stampSource(cache.explored, cache, frame, visionSources[i], viewport, geometry);
        this.stampSource(cache.visible, cache, frame, visionSources[i], viewport, geometry);
      }
      this.softBlurChannel(cache.explored, cache, 2);
      this.softBlurChannel(cache.visible, cache, 1);
      return cache;
    }

    softBlurChannel(channel, cache = this.cache, radius = 1) {
      const blurRadius = Math.max(0, Math.min(4, Math.floor(Number(radius) || 0)));
      if (!channel || !cache?.scratch || blurRadius <= 0) return channel;
      const { width, height, scratch } = cache;
      const diameter = blurRadius * 2 + 1;
      for (let y = 0; y < height; y += 1) {
        const row = y * width;
        for (let x = 0; x < width; x += 1) {
          let total = 0;
          for (let dx = -blurRadius; dx <= blurRadius; dx += 1) {
            total += channel[row + Math.max(0, Math.min(width - 1, x + dx))];
          }
          scratch[row + x] = Math.round(total / diameter);
        }
      }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let total = 0;
          for (let dy = -blurRadius; dy <= blurRadius; dy += 1) {
            total += scratch[Math.max(0, Math.min(height - 1, y + dy)) * width + x];
          }
          channel[y * width + x] = Math.round(total / diameter);
        }
      }
      return channel;
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
      const contextKey = this.getContextKey(context, maskFrame, dimensions);
      if (this.cache.contextKey === contextKey && this.cache.key && this.cache.maskFrame) {
        return {
          mask: this.cache,
          changed: false,
          sourceSet: this.cache.sourceSet || null,
        };
      }
      const sourceSet = VisionModel.collectSources(context);
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
