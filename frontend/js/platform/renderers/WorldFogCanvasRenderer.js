(function (global) {
  const MaskGenerator = (() => {
    if (global.WorldFogMaskGenerator) return global.WorldFogMaskGenerator;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldFogMaskGenerator');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

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
    uniform float uTime;
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

      vec2 maskUv = (pixel - uMaskFrame.xy) / max(uMaskFrame.zw, vec2(1.0));
      float explored = texture2D(uExploredMask, maskUv).r;
      float visible = texture2D(uVisibleMask, maskUv).r;

      float clear = smoothstep(0.08, 0.92, visible);
      float memory = smoothstep(0.08, 0.86, clamp(explored - clear * 0.72, 0.0, 1.0));
      float slowNoise = noise(vUv * vec2(9.0, 14.0) + vec2(uTime * 0.006, -uTime * 0.004));
      float fineNoise = noise(vUv * vec2(42.0, 55.0) + vec2(-uTime * 0.018, uTime * 0.012));
      float fogNoise = mix(slowNoise, fineNoise, 0.34) - 0.5;

      vec3 unknownColor = vec3(0.0, 0.0, 0.0);
      vec3 exploredColor = vec3(0.080, 0.088, 0.082);
      vec3 fogColor = mix(unknownColor, exploredColor, memory);
      float alpha = mix(0.985, 0.54, memory) * (1.0 - clear);
      alpha = clamp(alpha + fogNoise * uNoiseStrength, 0.0, 0.99);

      gl_FragColor = vec4(fogColor + fogNoise * 0.035, alpha);
    }
  `;

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
      this.noiseStrength = Math.max(0, Math.min(0.22, Number(options.noiseStrength) || 0.045));
      this.maskGenerator = options.maskGenerator || (MaskGenerator ? new MaskGenerator({
        maskSize: options.maskSize,
      }) : null);
      this.startedAt = this.now();
      this.uploadedMaskKey = '';
      this.program = null;
      this.buffer = null;
      this.textures = {
        explored: null,
        visible: null,
      };
      this.locations = null;
      this.initError = null;
      this.lastPreparedMask = null;
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
          uTime: gl.getUniformLocation(this.program, 'uTime'),
          uNoiseStrength: gl.getUniformLocation(this.program, 'uNoiseStrength'),
        };
        this.initError = null;
        return true;
      } catch (error) {
        this.initError = error;
        return false;
      }
    }

    prepareMask(tileMapContext = {}) {
      if (!this.maskGenerator?.prepare) return null;
      const prepared = this.maskGenerator.prepare(tileMapContext);
      this.lastPreparedMask = prepared;
      return prepared;
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
      gl.uniform4f?.(
        this.locations.uMaskFrame,
        (Number(maskFrame.x) || 0) * pixelRatio,
        (Number(maskFrame.y) || 0) * pixelRatio,
        Math.max(1, Number(maskFrame.width) || Number(frame.width) || this.width || 1) * pixelRatio,
        Math.max(1, Number(maskFrame.height) || Number(frame.height) || this.height || 1) * pixelRatio,
      );
      gl.uniform1f?.(this.locations.uTime, (this.now() - this.startedAt) * 0.001);
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
      const { tileMapView = {}, viewport = {}, frame = {} } = tileMapContext || {};
      if (!tileMapView || !viewport || !frame) {
        this.clear();
        return false;
      }
      const prepared = this.prepareMask(tileMapContext);
      const mask = prepared?.mask || null;
      if (!mask) {
        this.clear();
        return false;
      }
      const gl = this.getContext();
      const uploadMask = prepared.changed || this.uploadedMaskKey !== mask.key;
      this.useProgram(gl, frame, mask, { uploadMask });
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    }
  }

  WorldFogCanvasRenderer.VERTEX_SHADER_SOURCE = VERTEX_SHADER_SOURCE;
  WorldFogCanvasRenderer.FRAGMENT_SHADER_SOURCE = FRAGMENT_SHADER_SOURCE;

  global.WorldFogCanvasRenderer = WorldFogCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldFogCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
