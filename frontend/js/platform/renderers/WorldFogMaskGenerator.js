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
      this.maskSize = Math.max(128, Math.min(1024, Number(options.maskSize) || 640));
      this.cache = {
        key: '',
        width: 0,
        height: 0,
        explored: null,
        visible: null,
        maskFrame: null,
      };
    }

    reset() {
      this.cache.key = '';
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
          width: maskWidth,
          height: maskHeight,
          explored: new Uint8Array(size),
          visible: new Uint8Array(size),
          maskFrame: null,
        };
      }
      return this.cache;
    }

    getMaskDimensions(frame = {}) {
      const width = Math.max(1, Number(frame.width) || 1);
      const height = Math.max(1, Number(frame.height) || 1);
      const longest = Math.max(width, height);
      const scale = Math.max(0.25, Math.min(1, this.maskSize / longest));
      return {
        width: Math.max(64, Math.ceil(width * scale)),
        height: Math.max(64, Math.ceil(height * scale)),
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
        Math.round(toNumber(frame.x) * 10),
        Math.round(toNumber(frame.y) * 10),
        Math.round(toNumber(frame.width) * 10),
        Math.round(toNumber(frame.height) * 10),
        Math.round(toNumber(viewport.originX) * 10),
        Math.round(toNumber(viewport.originY) * 10),
        Math.round(toNumber(viewport.panX) * 10),
        Math.round(toNumber(viewport.panY) * 10),
        Math.round(toNumber(viewport.scale, 1) * 1000),
        Math.round(toNumber(geometry.stepX, 96) * 10),
        Math.round(toNumber(geometry.stepY, 48) * 10),
      ].join('|');
      return hashText(signatureText);
    }

    screenPointToTileDelta(point = {}, source = {}, viewport = {}, geometry = {}) {
      const scale = Math.max(0.05, toNumber(viewport.scale, 1));
      const stepX = Math.max(1, toNumber(geometry.stepX, 96)) * scale;
      const stepY = Math.max(1, toNumber(geometry.stepY, 48)) * scale;
      const localX = (toNumber(point.x) - toNumber(source.center?.x)) / stepX;
      const localY = (toNumber(point.y) - toNumber(source.center?.y)) / stepY;
      return {
        q: (localX + localY) * 0.5,
        r: (localY - localX) * 0.5,
      };
    }

    getSoftTileDistance(point = {}, source = {}, viewport = {}, geometry = {}) {
      const delta = this.screenPointToTileDelta(point, source, viewport, geometry);
      const absQ = Math.abs(delta.q);
      const absR = Math.abs(delta.r);
      const chebyshev = Math.max(absQ, absR);
      const euclidean = Math.hypot(absQ, absR);
      return chebyshev * 0.72 + euclidean * 0.28;
    }

    evaluateSource(point = {}, source = {}, viewport = {}, geometry = {}) {
      const radius = Math.max(0.05, toNumber(source.radiusTiles, 1));
      const clearRadius = Math.max(0, Math.min(radius, toNumber(source.clearRadiusTiles, radius * 0.45)));
      const distance = this.getSoftTileDistance(point, source, viewport, geometry);
      if (distance <= clearRadius) return clamp01(source.strength ?? 1);
      if (distance >= radius) return 0;
      const fade = smoothstep(clearRadius, radius, distance);
      return clamp01((1 - fade) * toNumber(source.strength, 1));
    }

    evaluateSources(point = {}, sources = [], viewport = {}, geometry = {}) {
      let value = 0;
      for (let i = 0; i < sources.length; i += 1) {
        value = Math.max(value, this.evaluateSource(point, sources[i], viewport, geometry));
        if (value >= 1) return 1;
      }
      return value;
    }

    fillMasks(cache = this.cache, frame = {}, sourceSet = {}) {
      const viewport = sourceSet.viewport || {};
      const geometry = sourceSet.geometry || {};
      const memorySources = sourceSet.memorySources || [];
      const visionSources = sourceSet.visionSources || [];
      const exploredSources = [...memorySources, ...visionSources];
      const frameX = toNumber(frame.x);
      const frameY = toNumber(frame.y);
      const width = Math.max(1, toNumber(frame.width, 1));
      const height = Math.max(1, toNumber(frame.height, 1));
      const scaleX = width / Math.max(1, cache.width);
      const scaleY = height / Math.max(1, cache.height);

      for (let y = 0; y < cache.height; y += 1) {
        const screenY = frameY + (y + 0.5) * scaleY;
        const row = y * cache.width;
        for (let x = 0; x < cache.width; x += 1) {
          const point = {
            x: frameX + (x + 0.5) * scaleX,
            y: screenY,
          };
          const explored = this.evaluateSources(point, exploredSources, viewport, geometry);
          const visible = this.evaluateSources(point, visionSources, viewport, geometry);
          cache.explored[row + x] = Math.round(clamp01(explored) * 255);
          cache.visible[row + x] = Math.round(clamp01(visible) * 255);
        }
      }
      return cache;
    }

    prepare(context = {}) {
      if (!VisionModel?.collectSources) return null;
      const frame = context.frame || {};
      const maskFrame = {
        x: toNumber(frame.x, 0),
        y: toNumber(frame.y, 0),
        width: Math.max(1, toNumber(frame.width, 1)),
        height: Math.max(1, toNumber(frame.height, 1)),
      };
      const dimensions = this.getMaskDimensions(maskFrame);
      const sourceSet = VisionModel.collectSources(context);
      const key = this.getMaskKey(context, maskFrame, dimensions, sourceSet);
      const cache = this.ensureCache(dimensions.width, dimensions.height);
      if (cache.key === key && cache.maskFrame) {
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
