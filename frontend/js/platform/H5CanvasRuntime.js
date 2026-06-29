(function (global) {

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }
  const H5CanvasViewport = global.H5CanvasViewport || (typeof require === 'function' ? require('./H5CanvasViewport') : null);
  const H5CanvasInputController = global.H5CanvasInputController || (typeof require === 'function' ? require('./H5CanvasInputController') : null);
  const CanvasRuntimeContract = global.CanvasRuntimeContract || (typeof require === 'function' ? require('./CanvasRuntimeContract') : null);

  class H5CanvasRuntime {
    constructor(options = {}) {
      if (!H5CanvasViewport || !H5CanvasInputController) throw new Error('H5 canvas runtime dependencies are unavailable');
      this.document = options.document || global.document || null;
      this.runtime = options.runtime || global;
      this.kind = 'h5';
      this.storagePrefix = options.storagePrefix || 'cf_';
      this.storage = options.storage || this.runtime.localStorage || null;
      this.canvas = options.canvas || null;
      this.layerCanvases = new Map();
      this.layerHosts = new Map();
      this.container = options.container || null;
      this.id = options.id || 'h5CanvasLayer';
      this.worldMapLayerId = options.worldMapLayerId || 'h5WorldMapLayer';
      this.pixelRatio = options.pixelRatio || this.runtime.devicePixelRatio || 1;
      this.width = 0;
      this.height = 0;
      this.viewportWidth = 0;
      this.viewportHeight = 0;
      this.lockAspectRatio = options.lockAspectRatio !== false;
      this.frameAspectRatio = Math.max(0.1, Number(options.frameAspectRatio) || H5CanvasViewport.DEFAULT_FRAME_ASPECT_RATIO);
      this.frameRect = { x: 0, y: 0, width: 0, height: 0, viewportWidth: 0, viewportHeight: 0 };
      this.tapHandlers = [];
      this.dragHandlers = [];
      this.gestureHandlers = [];
      this.pointerMoveHandlers = [];
      this.resizeHandlers = [];
      this.inputController = new H5CanvasInputController(this);
      this.handleResize = this.handleResize.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handleWheel = this.handleWheel.bind(this);
      this.handleTouchStart = this.handleTouchStart.bind(this);
      this.handleTouchMove = this.handleTouchMove.bind(this);
      this.handleTouchEnd = this.handleTouchEnd.bind(this);
      this.canvasRuntimeContract = CanvasRuntimeContract?.assertRuntime?.(this, {
        runtimeName: 'H5CanvasRuntime',
      }) || null;
    }

    ensureCanvas() {
      if (this.canvas) {
        this.resize();
        this.bindEvents();
        return this.canvas;
      }
      if (!this.document || typeof this.document.createElement !== 'function') return null;
      const canvas = this.document.createElement('canvas');
      canvas.id = this.id;
      canvas.setAttribute?.('aria-hidden', 'true');
      canvas.setAttribute?.('data-canvas-hud-input', 'document-capture');
      this.applyCanvasLayerStyle(canvas, {
        pointerEvents: 'auto',
        zIndex: 1000,
      });
      const host = this.container || this.document.body;
      host?.appendChild?.(canvas);
      this.canvas = canvas;
      this.resize();
      this.bindEvents();
      return this.canvas;
    }

    applyCanvasLayerStyle(canvas, options = {}) {
      return H5CanvasViewport.applyCanvasLayerStyle(canvas, options);
    }

    ensureLayerCanvas(name = 'worldMap', options = {}) {
      const key = String(name || 'worldMap');
      const existing = this.layerCanvases.get(key);
      if (existing) {
        if (options.contextType) existing._contextType = options.contextType;
        if (options.pixelRatio) existing._pixelRatioOverride = Number(options.pixelRatio) || 0;
        existing._fixedRect = options.rect || null;
        existing._clipToFrame = this.shouldClipLayerToFrame(options, existing);
        this.applyCanvasLayerStyle(existing, {
          pointerEvents: 'none',
          zIndex: options.zIndex ?? existing.style?.zIndex ?? 998,
          padding: options.padding ?? existing._viewportPadding,
        });
        this.ensureLayerHost(key, existing, options);
        this.resizeCanvas(existing);
        return existing;
      }
      if (!this.document || typeof this.document.createElement !== 'function') return null;
      const canvas = this.document.createElement('canvas');
      canvas.id = options.id || (key === 'worldMap' ? this.worldMapLayerId : `${this.id}-${key}`);
      canvas.setAttribute?.('aria-hidden', 'true');
      canvas.setAttribute?.('data-canvas-layer', key);
      canvas._contextType = options.contextType || '2d';
      canvas._pixelRatioOverride = Number(options.pixelRatio) || 0;
      canvas._fixedRect = options.rect || null;
      canvas._clipToFrame = this.shouldClipLayerToFrame(options, canvas);
      canvas._backingStoreEpoch = Number(canvas._backingStoreEpoch) || 1;
      canvas._backingStoreReason = 'layerCreated';
      this.applyCanvasLayerStyle(canvas, {
        pointerEvents: 'none',
        zIndex: options.zIndex ?? 998,
        padding: options.padding,
      });
      const host = this.container || this.document.body;
      const layerHost = this.ensureLayerHost(key, canvas, options);
      if (layerHost) {
        host?.appendChild?.(layerHost);
        layerHost.appendChild?.(canvas);
      } else {
        host?.appendChild?.(canvas);
      }
      this.layerCanvases.set(key, canvas);
      if (!this.width || !this.height) {
        this.applyViewportFrame(this.getViewportSize());
        this.pixelRatio = this.runtime.devicePixelRatio || this.pixelRatio || 1;
      }
      this.resizeCanvas(canvas);
      return canvas;
    }

    shouldClipLayerToFrame(options = {}, canvas = null) {
      return H5CanvasViewport.shouldClipLayerToFrame(options, canvas);
    }

    ensureLayerHost(key = 'worldMap', canvas = null, options = {}) {
      if (!canvas?._clipToFrame) {
        const existingHost = this.layerHosts.get(key) || canvas?._layerHost || null;
        if (existingHost?.parentNode && existingHost.removeChild && canvas) {
          existingHost.removeChild(canvas);
          (this.container || this.document?.body)?.appendChild?.(canvas);
        }
        if (existingHost) this.layerHosts.delete(key);
        if (canvas) canvas._layerHost = null;
        return null;
      }
      let host = this.layerHosts.get(key) || canvas._layerHost || null;
      if (!host) {
        if (!this.document || typeof this.document.createElement !== 'function') return null;
        host = this.document.createElement('div');
        host.id = `${canvas.id || key}Clip`;
        host.setAttribute?.('aria-hidden', 'true');
        host.setAttribute?.('data-canvas-layer-clip', key);
        this.layerHosts.set(key, host);
        canvas._layerHost = host;
      }
      this.applyLayerHostStyle(host, {
        zIndex: options.zIndex ?? canvas.style?.zIndex ?? 998,
      });
      return host;
    }

    applyLayerHostStyle(host, options = {}) {
      return H5CanvasViewport.applyLayerHostStyle(host, this, options);
    }

    getLayerCanvas(name = 'worldMap') {
      return this.layerCanvases.get(String(name || 'worldMap')) || null;
    }

    getLayerMetrics(name = 'worldMap') {
      return H5CanvasViewport.getLayerMetrics(this.getLayerCanvas(name), this);
    }

    getLayerBackingStoreState(name = 'worldMap') {
      return H5CanvasViewport.getCanvasBackingStoreState(this.getLayerCanvas(name));
    }

    getCanvasBackingStoreState(canvas = this.canvas) {
      return H5CanvasViewport.getCanvasBackingStoreState(canvas);
    }

    setLayerTransform(name = 'worldMap', transform = '') {
      const canvas = this.getLayerCanvas(name);
      if (!canvas?.style) return false;
      const value = String(transform || '');
      canvas.style.transform = value;
      canvas.style.willChange = value ? 'transform' : '';
      return true;
    }

    setLayerTranslate(name = 'worldMap', x = 0, y = 0) {
      const tx = Number(x);
      const ty = Number(y);
      const safeX = Number.isFinite(tx) ? tx : 0;
      const safeY = Number.isFinite(ty) ? ty : 0;
      return this.setLayerTransform(name, `translate3d(${safeX}px, ${safeY}px, 0)`);
    }

    clearLayerTransform(name = 'worldMap') {
      return this.setLayerTransform(name, '');
    }

    setLayerVisible(name = 'worldMap', visible = true) {
      const canvas = this.getLayerCanvas(name);
      if (!canvas?.style) return false;
      const host = canvas._layerHost || this.layerHosts.get(String(name || 'worldMap')) || null;
      if (host?.style) host.style.display = visible === false ? 'none' : 'block';
      canvas.style.display = visible === false ? 'none' : 'block';
      return true;
    }

    createCanvas() {
      return this.ensureCanvas();
    }

    getSystemInfo() {
      const viewport = this.getViewportSize();
      return {
        windowWidth: viewport.width,
        windowHeight: viewport.height,
        pixelRatio: this.runtime.devicePixelRatio || this.pixelRatio || 1,
      };
    }

    getStorage(key) {
      const namespacedKey = `${this.storagePrefix}${key}`;
      if (this.storage && typeof this.storage.getItem === 'function') return this.storage.getItem(namespacedKey);
      return null;
    }

    setStorage(key, value) {
      const namespacedKey = `${this.storagePrefix}${key}`;
      if (this.storage && typeof this.storage.setItem === 'function') this.storage.setItem(namespacedKey, value);
    }

    removeStorage(key) {
      const namespacedKey = `${this.storagePrefix}${key}`;
      if (this.storage && typeof this.storage.removeItem === 'function') this.storage.removeItem(namespacedKey);
    }

    request(options = {}) {
      const requestFn = this.runtime.fetch || global.fetch;
      if (typeof requestFn !== 'function') return Promise.reject(new Error('H5 fetch API is unavailable'));
      return requestFn.call(this.runtime, options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
      });
    }

    now() {
      const performanceNow = this.runtime?.performance?.now?.();
      return Number.isFinite(performanceNow) ? performanceNow : Date.now();
    }

    setTimeout(callback, delayMs) {
      return this.runtime.setTimeout?.(callback, delayMs);
    }

    clearTimeout(timer) {
      if (timer) this.runtime.clearTimeout?.(timer);
    }

    requestAnimationFrame(callback) {
      if (typeof this.runtime.requestAnimationFrame === 'function') {
        return this.runtime.requestAnimationFrame(callback);
      }
      return this.setTimeout(callback, 16);
    }

    log(message) {
      const logger = this.runtime.console || global.console;
      if (logger && typeof logger.log === 'function') logger.log(message);
    }

    getBrowserViewportSize() {
      return H5CanvasViewport.getBrowserViewportSize(this.runtime, this.document);
    }

    getViewportFrame(viewport = this.getBrowserViewportSize()) {
      return H5CanvasViewport.getViewportFrame(viewport, {
        lockAspectRatio: this.lockAspectRatio,
        frameAspectRatio: this.frameAspectRatio,
      });
    }

    getViewportSize() {
      return this.getViewportFrame();
    }

    applyViewportFrame(frame = {}) {
      return H5CanvasViewport.applyViewportFrame(this, frame);
    }

    resize() {
      const canvas = this.canvas || this.ensureCanvas();
      if (!canvas) return null;
      this.pixelRatio = this.runtime.devicePixelRatio || this.pixelRatio || 1;
      this.applyViewportFrame(this.getViewportSize());
      this.resizeCanvas(canvas);
      this.layerCanvases.forEach((layerCanvas) => this.resizeCanvas(layerCanvas));
      this.resizeHandlers.forEach((handler) => handler({ width: this.width, height: this.height, pixelRatio: this.pixelRatio }));
      return { width: this.width, height: this.height, pixelRatio: this.pixelRatio };
    }

    resizeCanvas(canvas) {
      return H5CanvasViewport.resizeCanvas(canvas, this);
    }

    bindEvents() {
      return this.inputController.bindEvents();
    }

    handleResize() {
      this.resize();
    }

    toCanvasPoint(event = {}) {
      return H5CanvasViewport.toCanvasPoint(this.canvas, this, event);
    }

    getEventTime(event = {}) {
      return this.inputController.getEventTime(event);
    }

    getTouchPoints(event = {}) {
      return this.inputController.getTouchPoints(event);
    }

    getGestureCenter(points = []) {
      return this.inputController.getGestureCenter(points);
    }

    getGestureDistance(points = []) {
      return this.inputController.getGestureDistance(points);
    }

    dispatchGesture(gesture, event = {}) {
      return this.inputController.dispatchGesture(gesture, event);
    }

    shouldIgnoreDuplicateTap(point, event = {}) {
      return this.inputController.shouldIgnoreDuplicateTap(point, event);
    }

    handlePointerDown(event) {
      return this.inputController.handlePointerDown(event);
    }

    handlePointerMove(event) {
      return this.inputController.handlePointerMove(event);
    }

    handlePointerUp(event) {
      return this.inputController.handlePointerUp(event);
    }

    handleWheel(event = {}) {
      return this.inputController.handleWheel(event);
    }

    handleTouchStart(event = {}) {
      return this.inputController.handleTouchStart(event);
    }

    handleTouchMove(event = {}) {
      return this.inputController.handleTouchMove(event);
    }

    handleTouchEnd(event = {}) {
      return this.inputController.handleTouchEnd(event);
    }

    onTap(handler) {
      if (typeof handler !== 'function') return () => {};
      this.tapHandlers.push(handler);
      return () => {
        this.tapHandlers = this.tapHandlers.filter((item) => item !== handler);
      };
    }

    onDrag(handler) {
      if (typeof handler !== 'function') return () => {};
      this.dragHandlers.push(handler);
      return () => {
        this.dragHandlers = this.dragHandlers.filter((item) => item !== handler);
      };
    }

    onGesture(handler) {
      if (typeof handler !== 'function') return () => {};
      this.gestureHandlers.push(handler);
      return () => {
        this.gestureHandlers = this.gestureHandlers.filter((item) => item !== handler);
      };
    }

    onPointerMove(handler) {
      if (typeof handler !== 'function') return () => {};
      this.pointerMoveHandlers.push(handler);
      return () => {
        this.pointerMoveHandlers = this.pointerMoveHandlers.filter((item) => item !== handler);
      };
    }

    onResize(handler) {
      if (typeof handler !== 'function') return () => {};
      this.resizeHandlers.push(handler);
      return () => {
        this.resizeHandlers = this.resizeHandlers.filter((item) => item !== handler);
      };
    }

    getContext(type = '2d') {
      return this.ensureCanvas()?.getContext?.(type) || null;
    }

    setInterval(callback, intervalMs) {
      if (typeof this.runtime.setInterval !== 'function') return null;
      return this.runtime.setInterval(callback, intervalMs);
    }

    clearInterval(timer) {
      if (timer && typeof this.runtime.clearInterval === 'function') this.runtime.clearInterval(timer);
    }

    requestTextInput(options = {}) {
      if (typeof this.runtime.prompt !== 'function') return Promise.resolve(null);
      const title = options.title || t('common.inputTitle');
      const message = options.message ? `${options.message}\n` : '';
      const placeholder = options.placeholder ? `\n${options.placeholder}` : '';
      const value = this.runtime.prompt(`${message}${title}${placeholder}`, options.value || '');
      return Promise.resolve(value);
    }
  }

  global.H5CanvasRuntime = H5CanvasRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5CanvasRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
