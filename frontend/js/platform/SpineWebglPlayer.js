(function (global) {
  class SpineWebglPlayer {
    constructor(options = {}) {
      this.spine = options.spine || global.spine || null;
      this.runtime = options.runtime || global;
      this.canvas = options.canvas || null;
      this.context = null;
      this.gl = null;
      this.assetManager = null;
      this.shader = null;
      this.batcher = null;
      this.mvp = null;
      this.skeletonRenderer = null;
      this.skeleton = null;
      this.animationState = null;
      this.bounds = null;
      this.status = 'idle';
      this.error = null;
      this.animationFrame = null;
      this.animationFrameType = '';
      this.lastFrameTime = 0;
      this.targetFps = Number(options.targetFps) || 0;
      this.frameIntervalMs = Number(options.frameIntervalMs)
        || (this.targetFps > 0 ? 1000 / this.targetFps : 16);
      this.logicalWidth = Number(options.logicalWidth) || 0;
      this.logicalHeight = Number(options.logicalHeight) || 0;
      this.maxDevicePixelRatio = Number(options.maxDevicePixelRatio) || Infinity;
      this.viewportRect = options.viewportRect || null;
      this.assetBase = '';
      this.jsonFile = '';
      this.atlasFile = '';
      this.animationName = '';
      this.loop = options.loop !== false;
      this.premultipliedAlpha = Boolean(options.premultipliedAlpha);
      this.background = options.background || null;
      this.fitPadding = Number(options.fitPadding ?? 1.08);
      this.viewFocus = options.viewFocus || null;
      this.preserveDrawingBuffer = Boolean(options.preserveDrawingBuffer);
      this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
      this.onError = typeof options.onError === 'function' ? options.onError : null;
    }

    static isAvailable(spine = global.spine) {
      return Boolean(spine?.webgl && spine.SkeletonJson && spine.AtlasAttachmentLoader);
    }

    emitStatus(status, detail = '') {
      this.status = status;
      if (this.onStatus) this.onStatus({ status, detail, player: this });
    }

    initCanvas(canvas = this.canvas, options = {}) {
      this.canvas = canvas;
      if (!this.canvas) throw new Error('Spine canvas is required');
      if (typeof this.canvas.addEventListener !== 'function') this.canvas.addEventListener = () => {};
      if (typeof this.canvas.removeEventListener !== 'function') this.canvas.removeEventListener = () => {};
      if (!SpineWebglPlayer.isAvailable(this.spine)) {
        throw new Error('Spine 3.8 WebGL runtime is unavailable');
      }
      if (!this.logicalWidth) {
        this.logicalWidth = Math.max(1, Number(options.logicalWidth)
          || Number(this.canvas.clientWidth)
          || Number(this.canvas.width)
          || 1);
      }
      if (!this.logicalHeight) {
        this.logicalHeight = Math.max(1, Number(options.logicalHeight)
          || Number(this.canvas.clientHeight)
          || Number(this.canvas.height)
          || 1);
      }
      if (this.context && this.gl) return this.gl;
      const contextConfig = {
        alpha: options.alpha !== false,
        premultipliedAlpha: Boolean(options.premultipliedAlpha),
        antialias: options.antialias !== false,
        preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer ?? this.preserveDrawingBuffer),
      };
      this.context = new this.spine.webgl.ManagedWebGLRenderingContext(this.canvas, contextConfig);
      this.gl = this.context.gl;
      if (!this.gl) throw new Error('WebGL is unavailable');
      this.shader = this.spine.webgl.Shader.newTwoColoredTextured(this.gl);
      this.batcher = new this.spine.webgl.PolygonBatcher(this.gl);
      this.mvp = new this.spine.webgl.Matrix4();
      this.skeletonRenderer = new this.spine.webgl.SkeletonRenderer(this.gl);
      return this.gl;
    }

    load(options = {}) {
      try {
        const canvas = options.canvas || this.canvas;
        this.initCanvas(canvas, options);
        this.stop();
        const base = String(options.assetBase || this.assetBase || '');
        this.assetBase = base ? base.replace(/\/?$/, '/') : '';
        this.jsonFile = options.jsonFile || this.jsonFile || 'tutorial_advisor.json';
        this.atlasFile = options.atlasFile || this.atlasFile || 'tutorial_advisor.atlas';
        this.animationName = options.animationName || this.animationName || 'animation';
        this.loop = options.loop !== false;
        this.premultipliedAlpha = Boolean(options.premultipliedAlpha ?? this.premultipliedAlpha);
        this.fitPadding = Number(options.fitPadding ?? this.fitPadding) || 1.08;
        this.viewFocus = options.viewFocus || this.viewFocus;
        this.preserveDrawingBuffer = Boolean(options.preserveDrawingBuffer ?? this.preserveDrawingBuffer);
        this.targetFps = Number(options.targetFps ?? this.targetFps) || 0;
        this.frameIntervalMs = Number(options.frameIntervalMs)
          || (this.targetFps > 0 ? 1000 / this.targetFps : this.frameIntervalMs)
          || 16;
        this.logicalWidth = Number(options.logicalWidth) || this.logicalWidth;
        this.logicalHeight = Number(options.logicalHeight) || this.logicalHeight;
        this.maxDevicePixelRatio = Number(options.maxDevicePixelRatio) || this.maxDevicePixelRatio || Infinity;
        this.viewportRect = options.viewportRect || this.viewportRect || null;
        this.background = options.background ?? this.background;
        this.assetManager = new this.spine.webgl.AssetManager(this.context, this.assetBase);
        this.assetManager.loadText(this.jsonFile);
        this.assetManager.loadTextureAtlas(this.atlasFile);
        this.emitStatus('loading', `${this.assetBase}${this.jsonFile}`);
        this.animationFrame = this.requestAnimationFrame(() => this.loadFrame());
        return true;
      } catch (error) {
        this.handleError(error);
        return false;
      }
    }

    loadFrame() {
      if (!this.assetManager) return;
      try {
        if (!this.assetManager.isLoadingComplete()) {
          this.animationFrame = this.requestAnimationFrame(() => this.loadFrame());
          return;
        }
        const atlas = this.assetManager.get(this.atlasFile);
        const atlasLoader = new this.spine.AtlasAttachmentLoader(atlas);
        const skeletonJson = new this.spine.SkeletonJson(atlasLoader);
        skeletonJson.scale = 1;
        const skeletonData = skeletonJson.readSkeletonData(this.assetManager.get(this.jsonFile));
        this.skeleton = new this.spine.Skeleton(skeletonData);
        this.bounds = this.calculateSetupPoseBounds(this.skeleton);
        const animationStateData = new this.spine.AnimationStateData(skeletonData);
        animationStateData.defaultMix = 0;
        this.animationState = new this.spine.AnimationState(animationStateData);
        if (this.animationName) this.animationState.setAnimation(0, this.animationName, this.loop);
        this.lastFrameTime = this.nowSeconds();
        this.emitStatus('ready', this.animationName);
        this.animationFrame = this.scheduleRenderFrame();
      } catch (error) {
        this.handleError(error);
      }
    }

    calculateSetupPoseBounds(skeleton) {
      skeleton.setToSetupPose();
      skeleton.updateWorldTransform();
      const offset = new this.spine.Vector2();
      const size = new this.spine.Vector2();
      skeleton.getBounds(offset, size, []);
      return { offset, size };
    }

    resize() {
      if (!this.canvas || !this.gl || !this.mvp || !this.bounds) return false;
      const rect = this.canvas.getBoundingClientRect?.() || {};
      const baseWidth = this.logicalWidth || this.canvas.clientWidth || this.canvas.width || 1;
      const baseHeight = this.logicalHeight || this.canvas.clientHeight || this.canvas.height || 1;
      const cssWidth = Math.max(1, Math.floor(rect.width || baseWidth));
      const cssHeight = Math.max(1, Math.floor(rect.height || baseHeight));
      const maxRatio = Math.max(1, Number(this.maxDevicePixelRatio) || 1);
      const ratio = Math.max(1, Math.min(maxRatio, Number(this.runtime.devicePixelRatio) || 1));
      const width = Math.floor(cssWidth * ratio);
      const height = Math.floor(cssHeight * ratio);
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      const viewport = this.getViewport(cssWidth, cssHeight, ratio, width, height);

      const bounds = this.bounds;
      const centerX = bounds.offset.x + bounds.size.x / 2;
      const centerY = bounds.offset.y + bounds.size.y / 2;
      if (this.viewFocus) {
        const focusCenterX = Number(this.viewFocus.centerX ?? centerX);
        const focusCenterY = Number(this.viewFocus.centerY ?? centerY);
        const requestedHeight = Number(this.viewFocus.height ?? this.viewFocus.worldHeight);
        const viewHeight = Math.max(1, Number.isFinite(requestedHeight) ? requestedHeight : bounds.size.y * this.fitPadding);
        const viewWidth = viewHeight * (viewport.width / Math.max(1, viewport.height));
        this.mvp.ortho2d(focusCenterX - viewWidth / 2, focusCenterY - viewHeight / 2, viewWidth, viewHeight);
        this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        return true;
      }
      const safeBoundsWidth = Math.max(1, bounds.size.x);
      const safeBoundsHeight = Math.max(1, bounds.size.y);
      const scale = Math.max(safeBoundsWidth / viewport.width, safeBoundsHeight / viewport.height) * this.fitPadding;
      const viewWidth = viewport.width * Math.max(scale, 0.0001);
      const viewHeight = viewport.height * Math.max(scale, 0.0001);
      this.mvp.ortho2d(centerX - viewWidth / 2, centerY - viewHeight / 2, viewWidth, viewHeight);
      this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      return true;
    }

    getViewport(cssWidth, cssHeight, ratio, bufferWidth, bufferHeight) {
      const rect = this.viewportRect || null;
      if (!rect) return { x: 0, y: 0, width: bufferWidth, height: bufferHeight };
      const rectWidth = Math.max(1, Number(rect.width) || 1);
      const rectHeight = Math.max(1, Number(rect.height) || 1);
      const x = Math.floor((Number(rect.x) || 0) * ratio);
      const yTop = Number(rect.y) || 0;
      const y = Math.floor((cssHeight - yTop - rectHeight) * ratio);
      return {
        x,
        y,
        width: Math.max(1, Math.floor(rectWidth * ratio)),
        height: Math.max(1, Math.floor(rectHeight * ratio)),
      };
    }

    setViewportRect(rect = null) {
      this.viewportRect = rect || null;
      return true;
    }

    renderFrame() {
      if (!this.skeleton || !this.animationState || !this.gl) return;
      const now = this.nowSeconds();
      const delta = Math.min(0.08, Math.max(0, now - this.lastFrameTime));
      this.lastFrameTime = now;
      try {
        this.resize();
        if (this.background) {
          const rgba = this.parseColor(this.background);
          this.gl.clearColor(rgba.r, rgba.g, rgba.b, rgba.a);
        } else {
          this.gl.clearColor(0, 0, 0, 0);
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.animationState.update(delta);
        this.animationState.apply(this.skeleton);
        this.skeleton.updateWorldTransform();
        this.shader.bind();
        this.shader.setUniformi(this.spine.webgl.Shader.SAMPLER, 0);
        this.shader.setUniform4x4f(this.spine.webgl.Shader.MVP_MATRIX, this.mvp.values);
        this.batcher.begin(this.shader);
        this.skeletonRenderer.premultipliedAlpha = this.premultipliedAlpha;
        this.skeletonRenderer.draw(this.batcher, this.skeleton);
        this.batcher.end();
        this.shader.unbind();
        this.animationFrame = this.scheduleRenderFrame();
      } catch (error) {
        this.handleError(error);
      }
    }

    parseColor(color) {
      if (typeof color === 'object' && color) {
        return {
          r: Number(color.r) || 0,
          g: Number(color.g) || 0,
          b: Number(color.b) || 0,
          a: Number(color.a ?? 1) || 0,
        };
      }
      const value = String(color || '').trim();
      const match = value.match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
      if (!match) return { r: 0, g: 0, b: 0, a: 0 };
      const hex = match[1];
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: match[2] ? parseInt(match[2], 16) / 255 : 1,
      };
    }

    requestAnimationFrame(callback) {
      const raf = this.runtime.requestAnimationFrame || global.requestAnimationFrame;
      if (typeof raf === 'function') {
        this.animationFrameType = 'raf';
        return raf.call(this.runtime, callback);
      }
      this.animationFrameType = 'timeout';
      return this.runtime.setTimeout?.(callback, 16);
    }

    scheduleRenderFrame() {
      const interval = Math.max(16, Number(this.frameIntervalMs) || 16);
      const setDelay = this.runtime.setTimeout || global.setTimeout;
      if (interval > 20 && typeof setDelay === 'function') {
        this.animationFrameType = 'timeout';
        return setDelay.call(this.runtime, () => this.renderFrame(), interval);
      }
      return this.requestAnimationFrame(() => this.renderFrame());
    }

    cancelAnimationFrame(id) {
      if (!id) return;
      if (this.animationFrameType === 'timeout') {
        const clearDelay = this.runtime.clearTimeout || global.clearTimeout;
        if (typeof clearDelay === 'function') clearDelay.call(this.runtime, id);
        return;
      }
      const cancel = this.runtime.cancelAnimationFrame || global.cancelAnimationFrame;
      if (typeof cancel === 'function') cancel.call(this.runtime, id);
      else this.runtime.clearTimeout?.(id);
    }

    nowSeconds() {
      const perf = this.runtime.performance || global.performance;
      if (perf && typeof perf.now === 'function') return perf.now() / 1000;
      return Date.now() / 1000;
    }

    stop() {
      if (this.animationFrame) this.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
      this.animationFrameType = '';
    }

    dispose() {
      this.stop();
      this.skeleton = null;
      this.animationState = null;
      this.assetManager = null;
      this.bounds = null;
    }

    handleError(error) {
      this.error = error;
      this.stop();
      this.emitStatus('error', error?.message || String(error));
      if (this.onError) this.onError(error, this);
    }
  }

  global.SpineWebglPlayer = SpineWebglPlayer;
  if (typeof module !== 'undefined' && module.exports) module.exports = SpineWebglPlayer;
})(typeof window !== 'undefined' ? window : globalThis);
