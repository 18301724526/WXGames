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
      // Composite groups: members draw on offscreen surfaces and are engine-composited onto
      // one shared presentation canvas per group (registry COMPOSITE_GROUPS).
      this.layerSurfaces = new Map();
      this.layerCompositeState = new Map();
      this.groupCanvases = new Map();
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

    getCanvasLayerRegistry() {
      // CanvasLayerRegistry.js loads after this file in the classic-script bundle, so the
      // reference must resolve lazily at call time.
      if (global.CanvasLayerRegistry) return global.CanvasLayerRegistry;
      if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
        try {
          return require('./CanvasLayerRegistry');
        } catch (_error) {
          return null;
        }
      }
      return null;
    }

    getCompositeGroupForLayer(name = '') {
      return this.getCanvasLayerRegistry()?.getCompositeGroupForLayer?.(name) || null;
    }

    ensureLayerCanvas(name = 'worldMap', options = {}) {
      const key = String(name || 'worldMap');
      const group = this.getCompositeGroupForLayer(key);
      if (group) {
        const surface = this.ensureCompositeLayerSurface(group, key, options);
        // Without OffscreenCanvas support the group path degrades to the per-layer DOM
        // canvas stack below.
        if (surface) return surface;
      }
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
        return existing._drawSurface || existing;
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
        this.insertLayerElementInStackOrder(host, layerHost, canvas.style?.zIndex);
        layerHost.appendChild?.(canvas);
      } else {
        this.insertLayerElementInStackOrder(host, canvas, canvas.style?.zIndex);
      }
      this.layerCanvases.set(key, canvas);
      if (!this.width || !this.height) {
        this.applyViewportFrame(this.getViewportSize());
        this.pixelRatio = this.runtime.devicePixelRatio || this.pixelRatio || 1;
      }
      this.resizeCanvas(canvas);
      return canvas._drawSurface || canvas;
    }

    // WebGL layers draw on a non-DOM OffscreenCanvas surface; the DOM layer canvas stays a 2d
    // presentation target that presentLayer() blits onto. A canvas can hold only one context
    // type forever, so this keeps the visible DOM stack free of webgl canvases (which WebView
    // compositors stack unreliably against 2d siblings) and is the same surface model the
    // wx mini-program runtime uses (wx.createOffscreenCanvas + drawImage).
    createOffscreenSurface(width = 1, height = 1) {
      const OffscreenCanvasCtor = this.runtime.OffscreenCanvas || global.OffscreenCanvas || null;
      if (typeof OffscreenCanvasCtor !== 'function') return null;
      return new OffscreenCanvasCtor(
        Math.max(1, Number(width) || 1),
        Math.max(1, Number(height) || 1),
      );
    }

    syncLayerDrawSurface(canvas) {
      if (!canvas || !canvas._contextType || canvas._contextType === '2d') return null;
      const width = Math.max(1, Number(canvas.width) || 1);
      const height = Math.max(1, Number(canvas.height) || 1);
      let surface = canvas._drawSurface || null;
      if (!surface) {
        surface = this.createOffscreenSurface(width, height);
        // Without OffscreenCanvas support consumers keep drawing on the DOM canvas directly.
        if (!surface) return null;
        canvas._drawSurface = surface;
      }
      if (Number(surface.width) !== width) surface.width = width;
      if (Number(surface.height) !== height) surface.height = height;
      return surface;
    }

    getLayerDrawSurface(name = 'worldMap') {
      const key = String(name || 'worldMap');
      const memberSurface = this.layerSurfaces.get(key);
      if (memberSurface) return memberSurface;
      const canvas = this.getLayerCanvas(name);
      return canvas?._drawSurface || canvas || null;
    }

    // Blit a webgl layer's offscreen draw surface onto its 2d presentation canvas. Must run in
    // the same synchronous task as the webgl render: with preserveDrawingBuffer:false the
    // drawing buffer is only guaranteed readable before the task yields to the event loop.
    ensureCompositeLayerSurface(group, key, options = {}) {
      const surface = this.ensureCompositeMemberSurface(key, options);
      if (!surface) return null;
      this.ensureCompositeGroupCanvas(group);
      return surface;
    }

    ensureCompositeMemberSurface(key, options = {}) {
      let surface = this.layerSurfaces.get(key);
      if (!surface) {
        surface = this.createOffscreenSurface(1, 1);
        if (!surface) return null;
        surface._layerName = key;
        this.layerSurfaces.set(key, surface);
      }
      if (options.contextType) surface._contextType = options.contextType;
      if (options.pixelRatio) surface._pixelRatioOverride = Number(options.pixelRatio) || 0;
      surface._fixedRect = options.rect || null;
      surface._viewportPadding = Math.max(0, Number(options.padding ?? surface._viewportPadding) || 0);
      if (!this.width || !this.height) {
        this.applyViewportFrame(this.getViewportSize());
        this.pixelRatio = this.runtime.devicePixelRatio || this.pixelRatio || 1;
      }
      // Reuses the viewport sizing/backing-epoch logic; surfaces have no style so the DOM
      // half of resizeCanvas is skipped automatically.
      H5CanvasViewport.resizeCanvas(surface, this);
      return surface;
    }

    ensureCompositeGroupCanvas(group) {
      let canvas = this.groupCanvases.get(group.key);
      if (canvas) {
        this.resizeCanvas(canvas);
        return canvas;
      }
      if (!this.document || typeof this.document.createElement !== 'function') return null;
      canvas = this.document.createElement('canvas');
      canvas.id = `${this.id}-${group.key}`;
      canvas.setAttribute?.('aria-hidden', 'true');
      canvas.setAttribute?.('data-canvas-layer', group.key);
      canvas._contextType = '2d';
      this.applyCanvasLayerStyle(canvas, {
        pointerEvents: 'none',
        zIndex: group.zIndex,
      });
      const host = this.container || this.document.body;
      this.insertLayerElementInStackOrder(host, canvas, canvas.style?.zIndex);
      this.groupCanvases.set(group.key, canvas);
      if (!this.width || !this.height) {
        this.applyViewportFrame(this.getViewportSize());
        this.pixelRatio = this.runtime.devicePixelRatio || this.pixelRatio || 1;
      }
      this.resizeCanvas(canvas);
      return canvas;
    }

    getLayerCompositeState(key) {
      let state = this.layerCompositeState.get(key);
      if (!state) {
        state = { translateX: 0, translateY: 0, visible: true };
        this.layerCompositeState.set(key, state);
      }
      return state;
    }

    // WebGL surfaces (preserveDrawingBuffer:false) are only reliably readable in the same
    // task as their render, so presentLayer snapshots them into a persistent 2d cache that
    // group composites can safely read on any later frame.
    refreshWebglPresentCache(surface) {
      if (!surface || surface._contextType === '2d' || !surface._contextType) return surface;
      let cache = surface._presentCache;
      if (!cache) {
        cache = this.createOffscreenSurface(surface.width, surface.height);
        if (!cache) return surface;
        surface._presentCache = cache;
      }
      if (Number(cache.width) !== Number(surface.width)) cache.width = surface.width;
      if (Number(cache.height) !== Number(surface.height)) cache.height = surface.height;
      const cacheCtx = cache.getContext?.('2d') || null;
      if (!cacheCtx) return surface;
      if (typeof cacheCtx.setTransform === 'function') cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
      cacheCtx.clearRect?.(0, 0, Math.max(1, Number(cache.width) || 1), Math.max(1, Number(cache.height) || 1));
      if (typeof cacheCtx.drawImage === 'function' && Number(surface.width) > 0 && Number(surface.height) > 0) {
        cacheCtx.drawImage(surface, 0, 0);
      }
      return cache;
    }

    // Engine-side replacement for the retired per-layer DOM canvas stack: draws every visible
    // member surface (in registry members order == z-order) onto the group's presentation
    // canvas. Pan is a source-rect offset over the padded surface — the drawImage equivalent
    // of the old CSS translate3d.
    compositeLayerGroup(group) {
      if (!group) return false;
      const canvas = this.groupCanvases.get(group.key);
      const ctx = canvas?.getContext?.('2d') || null;
      if (!canvas || !ctx) return false;
      const targetWidth = Math.max(1, Number(canvas.width) || 1);
      const targetHeight = Math.max(1, Number(canvas.height) || 1);
      const targetRatio = Math.max(1, Number(canvas._backingStorePixelRatio) || this.pixelRatio || 1);
      if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect?.(0, 0, targetWidth, targetHeight);
      for (const member of group.members) {
        const surface = this.layerSurfaces.get(member);
        if (!surface) continue;
        const state = this.layerCompositeState.get(member) || null;
        if (state && state.visible === false) continue;
        const source = surface._presentCache || surface;
        if (!(Number(source.width) > 0 && Number(source.height) > 0)) continue;
        const surfaceRatio = Math.max(1, Number(surface._backingStorePixelRatio) || 1);
        const padding = Math.max(0, Number(surface._viewportPadding) || 0);
        const translateX = Number(state?.translateX) || 0;
        const translateY = Number(state?.translateY) || 0;
        const sourceX = (padding - translateX) * surfaceRatio;
        const sourceY = (padding - translateY) * surfaceRatio;
        const sourceWidth = targetWidth * (surfaceRatio / targetRatio);
        const sourceHeight = targetHeight * (surfaceRatio / targetRatio);
        if (typeof ctx.drawImage !== 'function') continue;
        ctx.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
      }
      return true;
    }

    compositeAllLayerGroups() {
      const registry = this.getCanvasLayerRegistry();
      const groups = registry?.COMPOSITE_GROUPS || null;
      if (!groups) return false;
      let composited = false;
      for (const groupKey of Object.keys(groups)) {
        if (!this.groupCanvases.has(groupKey)) continue;
        if (this.compositeLayerGroup(groups[groupKey])) composited = true;
      }
      return composited;
    }

    presentLayer(name = 'worldMap') {
      const key = String(name || 'worldMap');
      const group = this.getCompositeGroupForLayer(key);
      if (group && this.layerSurfaces.has(key)) {
        const surface = this.layerSurfaces.get(key);
        if (surface && surface._contextType && surface._contextType !== '2d') {
          this.refreshWebglPresentCache(surface);
        }
        return this.compositeLayerGroup(group);
      }
      const canvas = this.getLayerCanvas(name);
      const surface = canvas?._drawSurface || null;
      if (!canvas || !surface) return false;
      const ctx = canvas.getContext?.('2d') || null;
      if (!ctx) return false;
      const width = Math.max(1, Number(canvas.width) || 1);
      const height = Math.max(1, Number(canvas.height) || 1);
      if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect?.(0, 0, width, height);
      if (typeof ctx.drawImage === 'function' && Number(surface.width) > 0 && Number(surface.height) > 0) {
        ctx.drawImage(surface, 0, 0);
      }
      return true;
    }

    // Keep DOM sibling order aligned with the physical z-index so layers stack correctly even
    // on WebView compositors that break equal-stacking-context ties by document order (and can
    // otherwise float a webgl-backed canvas above a later 2d canvas that carries a higher
    // z-index). Layer canvases are ensured lazily on first paint, so append-order alone does
    // not match the canonical PHYSICAL_LAYER_ORDER; this insertion restores that invariant.
    insertLayerElementInStackOrder(host, element, zIndex) {
      if (!host || !element) return element;
      const stackZ = this.readStackZIndex(zIndex);
      // host.children is a live HTMLCollection in the browser (not an Array), so normalise
      // through Array.from before scanning; falling back to appendChild here silently
      // reintroduces the append-order bug this method exists to fix.
      const siblings = host.children ? Array.from(host.children) : null;
      if (!siblings || typeof host.insertBefore !== 'function') {
        host.appendChild?.(element);
        return element;
      }
      const managed = this.collectManagedStackElements();
      let reference = null;
      for (const sibling of siblings) {
        if (sibling === element || !managed.has(sibling)) continue;
        if (this.readStackZIndex(sibling.style?.zIndex) > stackZ) {
          reference = sibling;
          break;
        }
      }
      if (reference) host.insertBefore(element, reference);
      else host.appendChild?.(element);
      return element;
    }

    collectManagedStackElements() {
      const managed = new Set();
      if (this.canvas) managed.add(this.canvas);
      this.layerCanvases?.forEach((canvas) => {
        if (!canvas) return;
        managed.add(canvas._layerHost || canvas);
      });
      return managed;
    }

    readStackZIndex(value) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    shouldClipLayerToFrame(options = {}, canvas = null) {
      return H5CanvasViewport.shouldClipLayerToFrame(options, canvas);
    }

    ensureLayerHost(key = 'worldMap', canvas = null, options = {}) {
      if (!canvas?._clipToFrame) {
        const existingHost = this.layerHosts.get(key) || canvas?._layerHost || null;
        if (existingHost?.parentNode && existingHost.removeChild && canvas) {
          existingHost.removeChild(canvas);
          const reflowHost = this.container || this.document?.body;
          this.insertLayerElementInStackOrder(reflowHost, canvas, canvas.style?.zIndex);
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
      const key = String(name || 'worldMap');
      if (this.layerSurfaces.has(key)) {
        const group = this.getCompositeGroupForLayer(key);
        const groupCanvas = group ? this.groupCanvases.get(group.key) : null;
        if (groupCanvas) return groupCanvas;
      }
      return this.layerCanvases.get(key) || null;
    }

    getLayerMetrics(name = 'worldMap') {
      // Composite members carry their own padding/rect/backing state on the offscreen
      // surface; the shared group presentation canvas has none of that.
      const surface = this.layerSurfaces.get(String(name || 'worldMap'));
      if (surface) return H5CanvasViewport.getLayerMetrics(surface, this);
      return H5CanvasViewport.getLayerMetrics(this.getLayerCanvas(name), this);
    }

    getLayerBackingStoreState(name = 'worldMap') {
      const surface = this.layerSurfaces.get(String(name || 'worldMap'));
      if (surface) return H5CanvasViewport.getCanvasBackingStoreState(surface);
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
      const key = String(name || 'worldMap');
      if (this.layerSurfaces.has(key)) {
        // Composite members pan via the group blit's source-rect offset instead of a CSS
        // transform; re-composite immediately so the drag frame lands this task.
        const state = this.getLayerCompositeState(key);
        state.translateX = safeX;
        state.translateY = safeY;
        return this.compositeLayerGroup(this.getCompositeGroupForLayer(key));
      }
      return this.setLayerTransform(name, `translate3d(${safeX}px, ${safeY}px, 0)`);
    }

    clearLayerTransform(name = 'worldMap') {
      const key = String(name || 'worldMap');
      if (this.layerSurfaces.has(key)) {
        const state = this.getLayerCompositeState(key);
        if (state.translateX === 0 && state.translateY === 0) return true;
        return this.setLayerTranslate(name, 0, 0);
      }
      return this.setLayerTransform(name, '');
    }

    setLayerVisible(name = 'worldMap', visible = true) {
      const key = String(name || 'worldMap');
      if (this.layerSurfaces.has(key)) {
        const state = this.getLayerCompositeState(key);
        state.visible = visible !== false;
        return this.compositeLayerGroup(this.getCompositeGroupForLayer(key));
      }
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
      this.groupCanvases.forEach((groupCanvas) => this.resizeCanvas(groupCanvas));
      this.layerSurfaces.forEach((surface) => H5CanvasViewport.resizeCanvas(surface, this));
      // Surfaces were cleared by their backing resize; composite once so the presentation
      // canvases reflect that until the next content render repaints them.
      this.compositeAllLayerGroups();
      this.resizeHandlers.forEach((handler) => handler({ width: this.width, height: this.height, pixelRatio: this.pixelRatio }));
      return { width: this.width, height: this.height, pixelRatio: this.pixelRatio };
    }

    resizeCanvas(canvas) {
      const result = H5CanvasViewport.resizeCanvas(canvas, this);
      this.syncLayerDrawSurface(canvas);
      return result;
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
