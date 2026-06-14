(function (global) {
  const VERTEX_SHADER_SOURCE = `
    attribute vec2 aPosition;
    varying vec2 vUv;

    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER_SOURCE = `
    precision mediump float;

    varying vec2 vUv;
    uniform sampler2D uExploredMask;
    uniform sampler2D uVisibleMask;
    uniform vec2 uResolution;
    uniform vec4 uFrame;
    uniform vec4 uMaskFrame;
    uniform vec2 uMaskOffset;
    uniform float uTime;
    uniform float uFeather;
    uniform float uNoiseStrength;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    void main() {
      vec2 pixel = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);
      if (
        pixel.x < uFrame.x
        || pixel.y < uFrame.y
        || pixel.x > uFrame.x + uFrame.z
        || pixel.y > uFrame.y + uFrame.w
      ) {
        gl_FragColor = vec4(0.0);
        return;
      }

      vec2 maskUv = (pixel - uMaskFrame.xy - uMaskOffset) / max(uMaskFrame.zw, vec2(1.0));
      float explored = texture2D(uExploredMask, maskUv).r;
      float visible = texture2D(uVisibleMask, maskUv).r;
      float visibleAlpha = 1.0 - smoothstep(0.10, 0.86, visible);
      float memory = smoothstep(0.08, 0.88, clamp(explored - visible * 0.82, 0.0, 1.0));

      float slowNoise = noise(vUv * vec2(9.0, 14.0) + vec2(uTime * 0.006, -uTime * 0.004));
      float fineNoise = noise(vUv * vec2(42.0, 55.0) + vec2(-uTime * 0.018, uTime * 0.012));
      float fogNoise = mix(slowNoise, fineNoise, 0.34) - 0.5;

      vec3 unknownColor = vec3(0.015, 0.022, 0.019);
      vec3 exploredColor = vec3(0.090, 0.102, 0.092);
      vec3 fogColor = mix(unknownColor, exploredColor, memory);
      float alpha = mix(0.96, 0.52, memory) * visibleAlpha;
      alpha = clamp(alpha + fogNoise * uNoiseStrength, 0.0, 0.98);

      gl_FragColor = vec4(fogColor + fogNoise * 0.055, alpha);
    }
  `;

  const SharedTileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function toInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.floor(number) : fallback;
  }

  function normalizeTileCoord(tile = {}) {
    if (SharedTileCoord?.normalizeCoord) return SharedTileCoord.normalizeCoord(tile);
    const q = toInteger(tile.x !== undefined ? tile.x : tile.q, 0);
    const r = toInteger(tile.y !== undefined ? tile.y : tile.r, 0);
    return {
      x: q,
      y: r,
      q,
      r,
      tileId: `tile_${q}_${r}`,
    };
  }

  class WorldFogCanvasRenderer {
    constructor(options = {}) {
      this.canvas = options.canvas || null;
      this.gl = options.gl || options.ctx || null;
      this.pixelRatio = Math.max(1, Number(options.pixelRatio) || 1);
      this.width = Math.max(1, Number(options.width) || 390);
      this.height = Math.max(1, Number(options.height) || 844);
      this.viewportOffsetX = Number(options.viewportOffsetX) || 0;
      this.viewportOffsetY = Number(options.viewportOffsetY) || 0;
      this.viewportWidth = Math.max(1, Number(options.viewportWidth) || this.width);
      this.viewportHeight = Math.max(1, Number(options.viewportHeight) || this.height);
      this.maskSize = Math.max(128, Math.min(1024, Number(options.maskSize) || 640));
      this.maskPanReuseLimit = Math.max(32, Number(options.maskPanReuseLimit) || 144);
      this.feather = Math.max(0, Number(options.feather) || 48);
      this.noiseStrength = Math.max(0, Math.min(0.22, Number(options.noiseStrength) || 0.055));
      this.startedAt = this.now();
      this.maskCache = {
        key: '',
        width: 0,
        height: 0,
        explored: null,
        visible: null,
        exploredBase: null,
        visibleBase: null,
        insideDistance: null,
        outsideDistance: null,
        referencePanX: 0,
        referencePanY: 0,
        maskFrame: null,
      };
      this.uploadedMaskKey = '';
      this.program = null;
      this.buffer = null;
      this.textures = {
        explored: null,
        visible: null,
      };
      this.locations = null;
      this.initError = null;
    }

    now() {
      const now = global.performance?.now?.();
      return Number.isFinite(now) ? now : Date.now();
    }

    setMetrics(metrics = {}) {
      this.width = Math.max(1, Number(metrics.width) || this.width || 1);
      this.height = Math.max(1, Number(metrics.height) || this.height || 1);
      this.pixelRatio = Math.max(1, Number(metrics.pixelRatio) || this.pixelRatio || 1);
      this.viewportOffsetX = Math.max(0, Number(metrics.viewportOffsetX) || 0);
      this.viewportOffsetY = Math.max(0, Number(metrics.viewportOffsetY) || 0);
      this.viewportWidth = Math.max(1, Number(metrics.viewportWidth) || this.viewportWidth || this.width);
      this.viewportHeight = Math.max(1, Number(metrics.viewportHeight) || this.viewportHeight || this.height);
      return this;
    }

    getContext() {
      if (
        this.gl
        && typeof this.gl.createShader === 'function'
        && typeof this.gl.createProgram === 'function'
        && typeof this.gl.drawArrays === 'function'
      ) {
        return this.gl;
      }
      const attributes = {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        premultipliedAlpha: true,
      };
      this.gl = this.canvas?.getContext?.('webgl', attributes)
        || this.canvas?.getContext?.('experimental-webgl', attributes)
        || null;
      return this.gl;
    }

    isWebGLContext(gl = this.getContext()) {
      return Boolean(gl
        && typeof gl.createShader === 'function'
        && typeof gl.createProgram === 'function'
        && typeof gl.drawArrays === 'function');
    }

    clear() {
      const gl = this.getContext();
      if (!this.isWebGLContext(gl)) return false;
      gl.viewport?.(0, 0, gl.drawingBufferWidth || this.canvas?.width || this.width, gl.drawingBufferHeight || this.canvas?.height || this.height);
      gl.clearColor?.(0, 0, 0, 0);
      gl.clear?.(gl.COLOR_BUFFER_BIT);
      return true;
    }

    createShader(gl, type, source) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (typeof gl.getShaderParameter === 'function' && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = typeof gl.getShaderInfoLog === 'function' ? gl.getShaderInfoLog(shader) : 'unknown shader compile error';
        gl.deleteShader?.(shader);
        throw new Error(message || 'WorldFog shader compile failed');
      }
      return shader;
    }

    createProgram(gl) {
      const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
      if (!vertexShader || !fragmentShader) return null;
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader?.(vertexShader);
      gl.deleteShader?.(fragmentShader);
      if (typeof gl.getProgramParameter === 'function' && !gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = typeof gl.getProgramInfoLog === 'function' ? gl.getProgramInfoLog(program) : 'unknown program link error';
        gl.deleteProgram?.(program);
        throw new Error(message || 'WorldFog shader link failed');
      }
      return program;
    }

    createTexture(gl) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texture;
    }

    initGl() {
      const gl = this.getContext();
      if (!this.isWebGLContext(gl)) return false;
      if (this.program && this.buffer && this.textures.explored && this.textures.visible) return true;
      try {
        this.program = this.createProgram(gl);
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          -1, -1,
          1, -1,
          -1, 1,
          -1, 1,
          1, -1,
          1, 1,
        ]), gl.STATIC_DRAW);
        this.textures.explored = this.createTexture(gl);
        this.textures.visible = this.createTexture(gl);
        this.locations = {
          aPosition: gl.getAttribLocation(this.program, 'aPosition'),
          uExploredMask: gl.getUniformLocation(this.program, 'uExploredMask'),
          uVisibleMask: gl.getUniformLocation(this.program, 'uVisibleMask'),
          uResolution: gl.getUniformLocation(this.program, 'uResolution'),
          uFrame: gl.getUniformLocation(this.program, 'uFrame'),
          uMaskFrame: gl.getUniformLocation(this.program, 'uMaskFrame'),
          uMaskOffset: gl.getUniformLocation(this.program, 'uMaskOffset'),
          uTime: gl.getUniformLocation(this.program, 'uTime'),
          uFeather: gl.getUniformLocation(this.program, 'uFeather'),
          uNoiseStrength: gl.getUniformLocation(this.program, 'uNoiseStrength'),
        };
        this.initError = null;
        return true;
      } catch (error) {
        this.initError = error;
        return false;
      }
    }

    isExploredTile(tile = {}) {
      if (!tile || typeof tile !== 'object') return false;
      if (tile.discovered === false) return false;
      return tile.visibility !== 'unknown';
    }

    isVisibleTile(tile = {}) {
      if (!this.isExploredTile(tile)) return false;
      return tile.visible !== false;
    }

    getTileKey(tile = {}) {
      const coord = normalizeTileCoord(tile);
      return `${coord.q},${coord.r}`;
    }

    getTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
      const scale = Math.max(0.05, Number(viewport.scale) || 1);
      const stepX = Number(geometry.stepX) || (Number(geometry.tileWidth) || 192) * 0.5;
      const stepY = Number(geometry.stepY) || (Number(geometry.tileHeight) || 96) * 0.5;
      const coord = normalizeTileCoord(tile);
      const q = Number(coord.q) || 0;
      const r = Number(coord.r) || 0;
      return {
        x: (Number(viewport.originX) || 0) + (Number(viewport.panX) || 0) + (q - r) * stepX * scale,
        y: (Number(viewport.originY) || 0) + (Number(viewport.panY) || 0) + (q + r) * stepY * scale,
      };
    }

    getTileDrawRect(center = {}, viewport = {}, geometry = {}) {
      const scale = Math.max(0.05, Number(viewport.scale) || 1);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const anchorY = Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5;
      return {
        x: (Number(center.x) || 0) - tileWidth * 0.5,
        y: (Number(center.y) || 0) - tileHeight * anchorY,
        width: tileWidth,
        height: tileHeight,
      };
    }

    getTilePoint(entry = {}, viewport = {}, geometry = {}) {
      const center = entry.center || {};
      const drawRect = entry.drawRect || {};
      const scale = Math.max(0.05, Number(viewport.scale) || 1);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const cx = Number(center.x);
      const cy = Number(center.y);
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        return {
          x: cx,
          y: cy,
          halfW: tileWidth * 0.5,
          halfH: tileHeight * 0.5,
        };
      }
      const x = Number(drawRect.x) || 0;
      const y = Number(drawRect.y) || 0;
      const width = Number(drawRect.width) || tileWidth;
      const height = Number(drawRect.height) || tileHeight;
      return {
        x: x + width * 0.5,
        y: y + height * 0.5,
        halfW: width * 0.5,
        halfH: height * 0.5,
      };
    }

    normalizeEntry(tile = {}, viewport = {}, geometry = {}) {
      const center = this.getTileScreenCenter(tile, viewport, geometry);
      const drawRect = this.getTileDrawRect(center, viewport, geometry);
      return { tile, center, drawRect, inView: true };
    }

    getFogEntries(tileMapView = {}, entries = [], viewport = {}, geometry = {}) {
      const entryByKey = new Map();
      (Array.isArray(entries) ? entries : []).forEach((entry) => {
        if (!entry?.tile) return;
        entryByKey.set(this.getTileKey(entry.tile), entry);
      });
      (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : []).forEach((tile) => {
        if (!tile) return;
        const key = this.getTileKey(tile);
        if (!entryByKey.has(key)) entryByKey.set(key, this.normalizeEntry(tile, viewport, geometry));
      });
      return [...entryByKey.values()];
    }

    getTileDiamond(entry = {}, viewport = {}, geometry = {}, frame = {}) {
      const point = this.getTilePoint(entry, viewport, geometry);
      const x = point.x - (Number(frame.x) || 0);
      const y = point.y - (Number(frame.y) || 0);
      return [
        { x, y: y - point.halfH },
        { x: x + point.halfW, y },
        { x, y: y + point.halfH },
        { x: x - point.halfW, y },
      ];
    }

    ensureMaskCache(width = this.maskSize, height = this.maskSize, key = '') {
      const maskWidth = Math.max(1, Math.floor(width));
      const maskHeight = Math.max(1, Math.floor(height));
      const size = maskWidth * maskHeight;
      if (
        this.maskCache.width !== maskWidth
        || this.maskCache.height !== maskHeight
        || this.maskCache.explored?.length !== size
        || this.maskCache.visible?.length !== size
        || this.maskCache.exploredBase?.length !== size
        || this.maskCache.visibleBase?.length !== size
        || this.maskCache.insideDistance?.length !== size
        || this.maskCache.outsideDistance?.length !== size
      ) {
        this.maskCache = {
          key: '',
          width: maskWidth,
          height: maskHeight,
          explored: new Uint8Array(size),
          visible: new Uint8Array(size),
          exploredBase: new Uint8Array(size),
          visibleBase: new Uint8Array(size),
          insideDistance: new Float32Array(size),
          outsideDistance: new Float32Array(size),
          referencePanX: 0,
          referencePanY: 0,
          maskFrame: null,
        };
      }
      if (this.maskCache.key === key) return this.maskCache;
      this.resetMaskCache(this.maskCache);
      return this.maskCache;
    }

    resetMaskCache(cache = this.maskCache) {
      if (!cache) return null;
      cache.explored?.fill?.(0);
      cache.visible?.fill?.(0);
      cache.exploredBase?.fill?.(0);
      cache.visibleBase?.fill?.(0);
      cache.key = '';
      cache.referencePanX = 0;
      cache.referencePanY = 0;
      cache.maskFrame = null;
      return cache;
    }

    getMaskDimensions(frame = {}) {
      const width = Math.max(1, Number(frame.width) || this.width || 1);
      const height = Math.max(1, Number(frame.height) || this.height || 1);
      const longest = Math.max(width, height);
      const scale = Math.max(0.25, Math.min(1, this.maskSize / longest));
      return {
        width: Math.max(64, Math.ceil(width * scale)),
        height: Math.max(64, Math.ceil(height * scale)),
        scaleX: scale,
        scaleY: scale,
      };
    }

    getExpandedMaskFrame(frame = {}) {
      const padding = Math.max(0, Number(this.maskPanReuseLimit) || 0);
      const x = Number(frame.x) || 0;
      const y = Number(frame.y) || 0;
      const width = Math.max(1, Number(frame.width) || this.width || 1);
      const height = Math.max(1, Number(frame.height) || this.height || 1);
      return {
        x: x - padding,
        y: y - padding,
        width: width + padding * 2,
        height: height + padding * 2,
      };
    }

    smoothstep(edge0 = 0, edge1 = 1, value = 0) {
      if (edge0 === edge1) return value < edge0 ? 0 : 1;
      const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    }

    getMaskCacheKey(tileMapView = {}, entries = [], viewport = {}, frame = {}, geometry = {}, dimensions = {}) {
      const round = (value, precision = 10) => Math.round((Number(value) || 0) * precision) / precision;
      const tileSignatureText = (Array.isArray(entries) ? entries : []).map((entry) => {
        const tile = entry?.tile || {};
        const coord = normalizeTileCoord(tile);
        return [
          coord.tileId,
          coord.q,
          coord.r,
          tile.visibility || '',
          tile.discovered === false ? 0 : 1,
          tile.visible === false ? 0 : 1,
          round((Number(entry?.center?.x) || 0) - (Number(viewport.panX) || 0)),
          round((Number(entry?.center?.y) || 0) - (Number(viewport.panY) || 0)),
          round((Number(entry?.drawRect?.x) || 0) - (Number(viewport.panX) || 0)),
          round((Number(entry?.drawRect?.y) || 0) - (Number(viewport.panY) || 0)),
          round(entry?.drawRect?.width),
          round(entry?.drawRect?.height),
        ].join(':');
      }).join('|');
      const tileSignature = this.hashText(tileSignatureText);
      return [
        tileSignature,
        (Array.isArray(entries) ? entries : []).length,
        dimensions.width || 0,
        dimensions.height || 0,
        round(frame.x),
        round(frame.y),
        round(frame.width),
        round(frame.height),
        round(viewport.originX),
        round(viewport.originY),
        round(viewport.scale, 1000),
        Number(geometry.tileWidth) || 192,
        Number(geometry.tileHeight) || 96,
        Number(geometry.stepX) || 96,
        Number(geometry.stepY) || 48,
        Number.isFinite(Number(geometry.anchorY)) ? Number(geometry.anchorY) : 0.5,
        tileSignature,
      ].join('::');
    }

    hashText(text = '') {
      let hash = 2166136261;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(36);
    }

    rasterizeHardDiamond(mask, maskWidth, maskHeight, points) {
      if (!mask || !Array.isArray(points) || points.length < 4) return false;
      const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x))));
      const maxX = Math.min(maskWidth - 1, Math.ceil(Math.max(...points.map((point) => point.x))));
      const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
      const maxY = Math.min(maskHeight - 1, Math.ceil(Math.max(...points.map((point) => point.y))));
      const centerX = (points[0].x + points[2].x) * 0.5;
      const centerY = (points[1].y + points[3].y) * 0.5;
      const halfW = Math.max(1, Math.abs(points[1].x - points[3].x) * 0.5);
      const halfH = Math.max(1, Math.abs(points[2].y - points[0].y) * 0.5);
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const diamondDistance = Math.abs((x + 0.5 - centerX) / halfW) + Math.abs((y + 0.5 - centerY) / halfH) - 1;
          if (diamondDistance <= 0) mask[y * maskWidth + x] = 1;
        }
      }
      return true;
    }

    computeDistanceToValue(source = null, targetValue = 1, output = null, width = 1, height = 1) {
      if (!source || !output) return null;
      const inf = Math.max(width, height) * 4;
      const diagonal = 1.41421356237;
      const size = width * height;
      for (let index = 0; index < size; index += 1) {
        output[index] = source[index] === targetValue ? 0 : inf;
      }
      for (let y = 0; y < height; y += 1) {
        const row = y * width;
        for (let x = 0; x < width; x += 1) {
          const index = row + x;
          let value = output[index];
          if (x > 0) value = Math.min(value, output[index - 1] + 1);
          if (y > 0) {
            value = Math.min(value, output[index - width] + 1);
            if (x > 0) value = Math.min(value, output[index - width - 1] + diagonal);
            if (x < width - 1) value = Math.min(value, output[index - width + 1] + diagonal);
          }
          output[index] = value;
        }
      }
      for (let y = height - 1; y >= 0; y -= 1) {
        const row = y * width;
        for (let x = width - 1; x >= 0; x -= 1) {
          const index = row + x;
          let value = output[index];
          if (x < width - 1) value = Math.min(value, output[index + 1] + 1);
          if (y < height - 1) {
            value = Math.min(value, output[index + width] + 1);
            if (x > 0) value = Math.min(value, output[index + width - 1] + diagonal);
            if (x < width - 1) value = Math.min(value, output[index + width + 1] + diagonal);
          }
          output[index] = value;
        }
      }
      return output;
    }

    writeSoftUnionMask(base = null, output = null, width = 1, height = 1, options = {}) {
      if (!base || !output) return false;
      const insideDistance = this.computeDistanceToValue(base, 1, this.maskCache.insideDistance, width, height);
      const outsideDistance = this.computeDistanceToValue(base, 0, this.maskCache.outsideDistance, width, height);
      const insideInset = Math.max(0, Number(options.insideInset) || 0);
      const outsideFeather = Math.max(1, Number(options.outsideFeather) || 1);
      const size = width * height;
      for (let index = 0; index < size; index += 1) {
        const signedDistance = base[index] ? -outsideDistance[index] : insideDistance[index];
        const fade = this.smoothstep(-insideInset, outsideFeather, signedDistance);
        output[index] = Math.max(0, Math.min(255, Math.round(255 * (1 - fade))));
      }
      return true;
    }

    prepareMaskFromEntries(tileMapView = {}, entries = [], viewport = {}, frame = {}, geometry = {}) {
      const maskFrame = this.getExpandedMaskFrame(frame);
      const dimensions = this.getMaskDimensions(maskFrame);
      const fogEntries = this.getFogEntries(tileMapView, entries, viewport, geometry);
      const key = this.getMaskCacheKey(tileMapView, fogEntries, viewport, maskFrame, geometry, dimensions);
      const cache = this.ensureMaskCache(dimensions.width, dimensions.height, key);
      const panX = Number(viewport.panX) || 0;
      const panY = Number(viewport.panY) || 0;
      const panDeltaX = panX - (Number(cache.referencePanX) || 0);
      const panDeltaY = panY - (Number(cache.referencePanY) || 0);
      const reuseLimit = Math.max(0, Number(this.maskPanReuseLimit) || 0);
      if (
        cache.key === key
        && cache.explored
        && cache.visible
        && cache.maskFrame
        && Math.abs(panDeltaX) <= reuseLimit
        && Math.abs(panDeltaY) <= reuseLimit
      ) {
        return {
          mask: cache,
          changed: false,
          sampleOffset: { x: panDeltaX, y: panDeltaY },
        };
      }
      this.resetMaskCache(cache);
      const scaleX = cache.width / Math.max(1, Number(maskFrame.width) || this.width || 1);
      const scaleY = cache.height / Math.max(1, Number(maskFrame.height) || this.height || 1);
      fogEntries.forEach((entry) => {
        const tile = entry.tile || {};
        const explored = this.isExploredTile(tile);
        const visible = this.isVisibleTile(tile);
        if (!explored && !visible) return;
        const points = this.getTileDiamond(entry, viewport, geometry, maskFrame).map((point) => ({
          x: point.x * scaleX,
          y: point.y * scaleY,
        }));
        if (explored) this.rasterizeHardDiamond(cache.exploredBase, cache.width, cache.height, points);
        if (visible) this.rasterizeHardDiamond(cache.visibleBase, cache.width, cache.height, points);
      });
      const feather = Math.max(10, Math.min(56, Math.max(scaleX, scaleY) * this.feather));
      this.writeSoftUnionMask(cache.exploredBase, cache.explored, cache.width, cache.height, {
        insideInset: Math.max(1, feather * 0.18),
        outsideFeather: feather,
      });
      this.writeSoftUnionMask(cache.visibleBase, cache.visible, cache.width, cache.height, {
        insideInset: Math.max(3, feather * 0.58),
        outsideFeather: feather,
      });
      cache.key = key;
      cache.referencePanX = panX;
      cache.referencePanY = panY;
      cache.maskFrame = { ...maskFrame };
      return { mask: cache, changed: true, sampleOffset: { x: 0, y: 0 } };
    }

    uploadTexture(gl, texture, unit, mask = null, width = 1, height = 1) {
      if (!texture || !mask) return false;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei?.(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        width,
        height,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        mask,
      );
      return true;
    }

    bindTexture(gl, texture, unit) {
      if (!texture) return false;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return true;
    }

    useProgram(gl, frame = {}, mask = null, options = {}) {
      const pixelRatio = Math.max(1, Number(this.pixelRatio) || 1);
      const drawingWidth = Math.max(1, gl.drawingBufferWidth || this.canvas?.width || Math.ceil(this.width * pixelRatio));
      const drawingHeight = Math.max(1, gl.drawingBufferHeight || this.canvas?.height || Math.ceil(this.height * pixelRatio));
      gl.viewport(0, 0, drawingWidth, drawingHeight);
      gl.disable?.(gl.DEPTH_TEST);
      gl.disable?.(gl.CULL_FACE);
      gl.enable?.(gl.BLEND);
      gl.blendFunc?.(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      if (this.locations.aPosition >= 0) {
        gl.enableVertexAttribArray(this.locations.aPosition);
        gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);
      }
      gl.uniform1i?.(this.locations.uExploredMask, 0);
      gl.uniform1i?.(this.locations.uVisibleMask, 1);
      gl.uniform2f?.(this.locations.uResolution, drawingWidth, drawingHeight);
      gl.uniform4f?.(
        this.locations.uFrame,
        (Number(frame.x) || 0) * pixelRatio,
        (Number(frame.y) || 0) * pixelRatio,
        Math.max(1, Number(frame.width) || this.width || 1) * pixelRatio,
        Math.max(1, Number(frame.height) || this.height || 1) * pixelRatio,
      );
      const maskFrame = mask?.maskFrame || frame || {};
      const sampleOffset = options.sampleOffset || {};
      gl.uniform4f?.(
        this.locations.uMaskFrame,
        (Number(maskFrame.x) || 0) * pixelRatio,
        (Number(maskFrame.y) || 0) * pixelRatio,
        Math.max(1, Number(maskFrame.width) || Number(frame.width) || this.width || 1) * pixelRatio,
        Math.max(1, Number(maskFrame.height) || Number(frame.height) || this.height || 1) * pixelRatio,
      );
      gl.uniform2f?.(
        this.locations.uMaskOffset,
        (Number(sampleOffset.x) || 0) * pixelRatio,
        (Number(sampleOffset.y) || 0) * pixelRatio,
      );
      gl.uniform1f?.(this.locations.uTime, (this.now() - this.startedAt) * 0.001);
      gl.uniform1f?.(this.locations.uFeather, Math.max(1, this.feather * pixelRatio));
      gl.uniform1f?.(this.locations.uNoiseStrength, this.noiseStrength);
      if (mask && options.uploadMask !== false) {
        this.uploadTexture(gl, this.textures.explored, 0, mask.explored, mask.width, mask.height);
        this.uploadTexture(gl, this.textures.visible, 1, mask.visible, mask.width, mask.height);
        this.uploadedMaskKey = mask.key || '';
      } else {
        this.bindTexture(gl, this.textures.explored, 0);
        this.bindTexture(gl, this.textures.visible, 1);
      }
      return true;
    }

    renderWorldFog(tileMapContext = {}) {
      if (!this.initGl()) return false;
      const { tileMapView = {}, viewport = {}, frame = {}, entries = [] } = tileMapContext || {};
      if (!tileMapView || !viewport || !frame) {
        this.clear();
        return false;
      }
      const geometry = tileMapView.geometry || viewport.geometry || {};
      const prepared = this.prepareMaskFromEntries(tileMapView, entries, viewport, frame, geometry);
      const mask = prepared.mask;
      const gl = this.getContext();
      const uploadMask = prepared.changed || this.uploadedMaskKey !== mask.key;
      this.useProgram(gl, frame, mask, { uploadMask, sampleOffset: prepared.sampleOffset });
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    }
  }

  WorldFogCanvasRenderer.VERTEX_SHADER_SOURCE = VERTEX_SHADER_SOURCE;
  WorldFogCanvasRenderer.FRAGMENT_SHADER_SOURCE = FRAGMENT_SHADER_SOURCE;

  global.WorldFogCanvasRenderer = WorldFogCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldFogCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
