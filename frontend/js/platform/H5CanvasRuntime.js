(function (global) {
  class H5CanvasRuntime {
    constructor(options = {}) {
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
      this.frameAspectRatio = Math.max(0.1, Number(options.frameAspectRatio) || (9 / 16));
      this.frameRect = { x: 0, y: 0, width: 0, height: 0, viewportWidth: 0, viewportHeight: 0 };
      this.tapHandlers = [];
      this.dragHandlers = [];
      this.gestureHandlers = [];
      this.pointerMoveHandlers = [];
      this.pointerDown = null;
      this.dragActive = false;
      this.dragMoved = false;
      this.activePinch = null;
      this.suppressTapUntil = 0;
      this.resizeHandlers = [];
      this.handleResize = this.handleResize.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handleWheel = this.handleWheel.bind(this);
      this.handleTouchStart = this.handleTouchStart.bind(this);
      this.handleTouchMove = this.handleTouchMove.bind(this);
      this.handleTouchEnd = this.handleTouchEnd.bind(this);
      this.lastTapAt = 0;
      this.lastTapKey = '';
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
        zIndex: 999,
      });
      const host = this.container || this.document.body;
      host?.appendChild?.(canvas);
      this.canvas = canvas;
      this.resize();
      this.bindEvents();
      return this.canvas;
    }

    applyCanvasLayerStyle(canvas, options = {}) {
      if (!canvas?.style) return;
      const padding = Math.max(0, Number(options.padding ?? canvas._viewportPadding) || 0);
      canvas._viewportPadding = padding;
      canvas.style.position = 'fixed';
      canvas.style.inset = 'auto';
      canvas.style.display = 'block';
      canvas.style.pointerEvents = options.pointerEvents || 'none';
      canvas.style.touchAction = 'none';
      canvas.style.zIndex = String(options.zIndex ?? 998);
      canvas.style.background = 'transparent';
      canvas.style.transformOrigin = '0 0';
      canvas.style.backfaceVisibility = 'hidden';
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
        const viewport = this.getViewportSize();
        this.applyViewportFrame(viewport);
        this.pixelRatio = this.runtime.devicePixelRatio || this.pixelRatio || 1;
      }
      this.resizeCanvas(canvas);
      return canvas;
    }

    shouldClipLayerToFrame(options = {}, canvas = null) {
      if (options.clipToFrame !== undefined) return Boolean(options.clipToFrame);
      const padding = Math.max(0, Number(options.padding ?? canvas?._viewportPadding) || 0);
      return !options.rect && padding > 0;
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
      if (!host?.style) return;
      const frame = this.frameRect || { x: 0, y: 0, width: this.width, height: this.height };
      host.style.position = 'fixed';
      host.style.inset = 'auto';
      host.style.left = `${Number(frame.x) || 0}px`;
      host.style.top = `${Number(frame.y) || 0}px`;
      host.style.width = `${Math.max(1, Number(frame.width) || this.width || 1)}px`;
      host.style.height = `${Math.max(1, Number(frame.height) || this.height || 1)}px`;
      host.style.overflow = 'hidden';
      host.style.pointerEvents = 'none';
      host.style.zIndex = String(options.zIndex ?? 998);
      host.style.background = 'transparent';
      host.style.transformOrigin = '0 0';
    }

    getLayerCanvas(name = 'worldMap') {
      return this.layerCanvases.get(String(name || 'worldMap')) || null;
    }

    getLayerMetrics(name = 'worldMap') {
      const canvas = this.getLayerCanvas(name);
      const padding = Math.max(0, Number(canvas?._viewportPadding) || 0);
      const fixedRect = canvas?._fixedRect || null;
      return {
        width: fixedRect ? Math.max(1, Number(fixedRect.width) || 1) : this.width + padding * 2,
        height: fixedRect ? Math.max(1, Number(fixedRect.height) || 1) : this.height + padding * 2,
        viewportWidth: this.width,
        viewportHeight: this.height,
        browserWidth: this.viewportWidth || this.width,
        browserHeight: this.viewportHeight || this.height,
        frameX: Number(this.frameRect?.x) || 0,
        frameY: Number(this.frameRect?.y) || 0,
        padding,
        rect: fixedRect,
      };
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
      return Date.now();
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
      const vv = this.runtime.visualViewport;
      const docElement = this.document?.documentElement || {};
      return {
        width: Math.max(1, Math.floor(vv?.width || this.runtime.innerWidth || docElement.clientWidth || 390)),
        height: Math.max(1, Math.floor(vv?.height || this.runtime.innerHeight || docElement.clientHeight || 844)),
      };
    }

    getViewportFrame(viewport = this.getBrowserViewportSize()) {
      const browserWidth = Math.max(1, Number(viewport.width) || 390);
      const browserHeight = Math.max(1, Number(viewport.height) || 844);
      if (!this.lockAspectRatio) {
        return {
          x: 0,
          y: 0,
          width: Math.floor(browserWidth),
          height: Math.floor(browserHeight),
          viewportWidth: Math.floor(browserWidth),
          viewportHeight: Math.floor(browserHeight),
        };
      }
      const targetRatio = Math.max(0.1, Number(this.frameAspectRatio) || (9 / 16));
      let width = browserWidth;
      let height = width / targetRatio;
      if (height > browserHeight) {
        height = browserHeight;
        width = height * targetRatio;
      }
      const gameWidth = Math.max(1, Math.round(width));
      const gameHeight = Math.max(1, Math.round(height));
      return {
        x: Math.max(0, Math.floor((browserWidth - gameWidth) / 2)),
        y: Math.max(0, Math.floor((browserHeight - gameHeight) / 2)),
        width: gameWidth,
        height: gameHeight,
        viewportWidth: Math.floor(browserWidth),
        viewportHeight: Math.floor(browserHeight),
      };
    }

    getViewportSize() {
      return this.getViewportFrame();
    }

    applyViewportFrame(frame = {}) {
      this.frameRect = {
        x: Number(frame.x) || 0,
        y: Number(frame.y) || 0,
        width: Math.max(1, Number(frame.width) || 1),
        height: Math.max(1, Number(frame.height) || 1),
        viewportWidth: Math.max(1, Number(frame.viewportWidth) || Number(frame.width) || 1),
        viewportHeight: Math.max(1, Number(frame.viewportHeight) || Number(frame.height) || 1),
      };
      this.viewportWidth = this.frameRect.viewportWidth;
      this.viewportHeight = this.frameRect.viewportHeight;
      this.width = this.frameRect.width;
      this.height = this.frameRect.height;
      return this.frameRect;
    }

    resize() {
      const canvas = this.canvas || this.ensureCanvas();
      if (!canvas) return null;
      const viewport = this.getViewportSize();
      this.pixelRatio = this.runtime.devicePixelRatio || this.pixelRatio || 1;
      this.applyViewportFrame(viewport);
      this.resizeCanvas(canvas);
      this.layerCanvases.forEach((layerCanvas) => this.resizeCanvas(layerCanvas));
      this.resizeHandlers.forEach((handler) => handler({ width: this.width, height: this.height, pixelRatio: this.pixelRatio }));
      return { width: this.width, height: this.height, pixelRatio: this.pixelRatio };
    }

    resizeCanvas(canvas) {
      if (!canvas) return null;
      const padding = Math.max(0, Number(canvas._viewportPadding) || 0);
      const fixedRect = canvas._fixedRect || null;
      const logicalWidth = fixedRect ? Math.max(1, Number(fixedRect.width) || 1) : this.width + padding * 2;
      const logicalHeight = fixedRect ? Math.max(1, Number(fixedRect.height) || 1) : this.height + padding * 2;
      const pixelRatio = Math.max(1, Number(canvas._pixelRatioOverride) || this.pixelRatio || 1);
      const nextWidth = Math.floor(logicalWidth * pixelRatio);
      const nextHeight = Math.floor(logicalHeight * pixelRatio);
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      if (canvas.style) {
        const frame = this.frameRect || { x: 0, y: 0 };
        const left = fixedRect ? Number(fixedRect.x) || 0 : -padding;
        const top = fixedRect ? Number(fixedRect.y) || 0 : -padding;
        const layerHost = canvas._layerHost || null;
        if (layerHost) {
          this.applyLayerHostStyle(layerHost, { zIndex: canvas.style.zIndex });
        }
        canvas.style.position = layerHost ? 'absolute' : 'fixed';
        canvas.style.inset = 'auto';
        canvas.style.left = `${layerHost ? left : (Number(frame.x) || 0) + left}px`;
        canvas.style.top = `${layerHost ? top : (Number(frame.y) || 0) + top}px`;
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;
      }
      if (canvas._contextType && canvas._contextType !== '2d') return canvas;
      const ctx = canvas.getContext?.('2d');
      if (ctx) {
        if (typeof ctx.setTransform === 'function') ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        else if (typeof ctx.scale === 'function') ctx.scale(pixelRatio, pixelRatio);
      }
      return canvas;
    }

    bindEvents() {
      if (!this.canvas || this.eventsBound) return;
      this.eventsBound = true;
      this.runtime.addEventListener?.('resize', this.handleResize);
      const eventTarget = this.canvas;
      eventTarget.addEventListener?.('pointerdown', this.handlePointerDown, { capture: true });
      eventTarget.addEventListener?.('pointermove', this.handlePointerMove, { capture: true });
      eventTarget.addEventListener?.('pointerup', this.handlePointerUp, { capture: true });
      this.document?.addEventListener?.('pointerup', this.handlePointerUp, { capture: true });
      eventTarget.addEventListener?.('wheel', this.handleWheel, { capture: true, passive: false });
      eventTarget.addEventListener?.('touchstart', this.handleTouchStart, { capture: true, passive: false });
      eventTarget.addEventListener?.('touchmove', this.handleTouchMove, { capture: true, passive: false });
      eventTarget.addEventListener?.('touchend', this.handleTouchEnd, { capture: true, passive: false });
      eventTarget.addEventListener?.('touchcancel', this.handleTouchEnd, { capture: true, passive: false });
      if (!global.PointerEvent) {
        eventTarget.addEventListener?.('click', this.handlePointerUp, { capture: true });
      }
    }

    handleResize() {
      this.resize();
    }

    toCanvasPoint(event = {}) {
      const canvas = this.canvas;
      const rect = canvas?.getBoundingClientRect?.() || { left: 0, top: 0, width: this.width, height: this.height };
      const touch = event.changedTouches?.[0] || event.touches?.[0] || event;
      const scaleX = rect.width ? this.width / rect.width : 1;
      const scaleY = rect.height ? this.height / rect.height : 1;
      return {
        x: (Number(touch.clientX ?? touch.pageX ?? touch.x ?? 0) - rect.left) * scaleX,
        y: (Number(touch.clientY ?? touch.pageY ?? touch.y ?? 0) - rect.top) * scaleY,
      };
    }

    getEventTime(event = {}) {
      return Number(event.timeStamp) || Date.now();
    }

    getTouchPoints(event = {}) {
      const touches = Array.from(event.touches || []);
      if (touches.length) return touches.map((touch) => this.toCanvasPoint(touch));
      return Array.from(event.changedTouches || []).map((touch) => this.toCanvasPoint(touch));
    }

    getGestureCenter(points = []) {
      const usable = points.slice(0, 2);
      const total = usable.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
      const count = Math.max(1, usable.length);
      return { x: total.x / count, y: total.y / count };
    }

    getGestureDistance(points = []) {
      if (points.length < 2) return 0;
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      return Math.hypot(dx, dy);
    }

    dispatchGesture(gesture, event = {}) {
      if (!gesture || !this.gestureHandlers.length) return false;
      let handled = false;
      this.gestureHandlers.forEach((handler) => {
        if (handler(gesture, event)) handled = true;
      });
      if (handled) {
        this.dragMoved = true;
        this.suppressTapUntil = this.getEventTime(event) + 260;
        if (event?.cancelable !== false) event.preventDefault?.();
        event.stopPropagation?.();
      }
      return handled;
    }

    shouldIgnoreDuplicateTap(point, event = {}) {
      const now = this.getEventTime(event);
      const key = `${event.type || 'tap'}:${Math.round(point.x)}:${Math.round(point.y)}`;
      if (key === this.lastTapKey && now - this.lastTapAt < 180) return true;
      this.lastTapKey = key;
      this.lastTapAt = now;
      return false;
    }

    handlePointerDown(event) {
      if (event?.touches?.length >= 2 || this.activePinch) return false;
      if (event?.pointerType === 'touch' && this.pointerDown) return false;
      const point = this.toCanvasPoint(event);
      const pointerId = event.pointerId ?? event.changedTouches?.[0]?.identifier ?? event.touches?.[0]?.identifier ?? 1;
      try {
        event.currentTarget?.setPointerCapture?.(pointerId);
      } catch (error) {}
      this.pointerDown = { ...point, pointerId };
      this.dragActive = false;
      this.dragMoved = false;
      let handled = false;
      this.dragHandlers.forEach((handler) => {
        if (handler('start', { ...point, pointerId }, event)) handled = true;
      });
      if (handled) {
        this.dragActive = true;
        if (event?.cancelable !== false) event.preventDefault?.();
        event.stopPropagation?.();
      }
      return handled;
    }

    handlePointerMove(event) {
      const point = this.toCanvasPoint(event);
      this.pointerMoveHandlers.forEach((handler) => handler(point, event));
      if (this.activePinch) return false;
      if (!this.pointerDown || !this.dragActive) return false;
      const pointerId = event.pointerId ?? event.changedTouches?.[0]?.identifier ?? event.touches?.[0]?.identifier ?? this.pointerDown.pointerId;
      if (pointerId !== this.pointerDown.pointerId) return false;
      if (Math.abs(point.x - this.pointerDown.x) > 3 || Math.abs(point.y - this.pointerDown.y) > 3) this.dragMoved = true;
      let handled = false;
      this.dragHandlers.forEach((handler) => {
        if (handler('move', { ...point, pointerId }, event)) handled = true;
      });
      if (handled) {
        if (event?.cancelable !== false) event.preventDefault?.();
        event.stopPropagation?.();
      }
      return handled;
    }

    handlePointerUp(event) {
      const point = this.toCanvasPoint(event);
      const pointerId = event.pointerId ?? event.changedTouches?.[0]?.identifier ?? event.touches?.[0]?.identifier ?? this.pointerDown?.pointerId ?? 1;
      try {
        event.currentTarget?.releasePointerCapture?.(pointerId);
      } catch (error) {}
      if (this.dragActive) {
        this.dragHandlers.forEach((handler) => handler('end', { ...point, pointerId }, event));
      }
      const skipTap = this.dragMoved || this.getEventTime(event) < this.suppressTapUntil;
      this.pointerDown = null;
      this.dragActive = false;
      this.dragMoved = false;
      if (skipTap) {
        if (event?.cancelable !== false) event.preventDefault?.();
        event.stopPropagation?.();
        return true;
      }
      if (this.shouldIgnoreDuplicateTap(point, event)) return false;
      let handled = false;
      this.tapHandlers.forEach((handler) => {
        if (handler(point, event)) handled = true;
      });
      if (handled && event?.cancelable !== false) event.preventDefault?.();
      if (handled) event.stopPropagation?.();
      return handled;
    }

    handleWheel(event = {}) {
      const deltaY = Number(event.deltaY) || 0;
      if (!deltaY) return false;
      const point = this.toCanvasPoint(event);
      const scaleDelta = Math.max(0.82, Math.min(1.22, Math.exp(-deltaY * 0.0015)));
      return this.dispatchGesture({
        type: 'wheelZoom',
        scaleDelta,
        centerX: point.x,
        centerY: point.y,
        x: point.x,
        y: point.y,
      }, event);
    }

    handleTouchStart(event = {}) {
      const points = this.getTouchPoints(event);
      if (points.length < 2) {
        if (!global.PointerEvent) return this.handlePointerDown(event);
        return false;
      }
      if (this.dragActive) {
        const center = this.getGestureCenter(points);
        this.dragHandlers.forEach((handler) => handler('cancel', center, event));
        this.dragActive = false;
      }
      this.pointerDown = null;
      this.dragMoved = true;
      this.activePinch = {
        distance: Math.max(1, this.getGestureDistance(points)),
        center: this.getGestureCenter(points),
      };
      this.suppressTapUntil = this.getEventTime(event) + 260;
      if (event?.cancelable !== false) event.preventDefault?.();
      return true;
    }

    handleTouchMove(event = {}) {
      if (!this.activePinch) {
        if (!global.PointerEvent) return this.handlePointerMove(event);
        return false;
      }
      const points = this.getTouchPoints(event);
      if (points.length < 2) return false;
      const distance = Math.max(1, this.getGestureDistance(points));
      const center = this.getGestureCenter(points);
      const previousDistance = Math.max(1, Number(this.activePinch.distance) || distance);
      const previousCenter = this.activePinch.center || center;
      this.activePinch = { distance, center };
      const scaleDelta = Math.max(0.82, Math.min(1.22, distance / previousDistance));
      return this.dispatchGesture({
        type: 'pinchZoom',
        phase: 'move',
        scaleDelta,
        centerX: center.x,
        centerY: center.y,
        deltaX: center.x - previousCenter.x,
        deltaY: center.y - previousCenter.y,
        x: center.x,
        y: center.y,
      }, event);
    }

    handleTouchEnd(event = {}) {
      if ((event.touches?.length || 0) >= 2) return this.handleTouchMove(event);
      if (!this.activePinch) {
        if (!global.PointerEvent) return this.handlePointerUp(event);
        return false;
      }
      const previousCenter = this.activePinch.center || this.getGestureCenter(this.getTouchPoints(event));
      const handled = this.dispatchGesture({
        type: 'pinchZoom',
        phase: 'end',
        scaleDelta: 1,
        centerX: previousCenter.x,
        centerY: previousCenter.y,
        deltaX: 0,
        deltaY: 0,
        x: previousCenter.x,
        y: previousCenter.y,
      }, event);
      this.activePinch = null;
      this.dragMoved = true;
      this.suppressTapUntil = this.getEventTime(event) + 260;
      if (event?.cancelable !== false) event.preventDefault?.();
      event.stopPropagation?.();
      return handled || true;
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
      const title = options.title || '输入';
      const message = options.message ? `${options.message}\n` : '';
      const placeholder = options.placeholder ? `\n${options.placeholder}` : '';
      const value = this.runtime.prompt(`${message}${title}${placeholder}`, options.value || '');
      return Promise.resolve(value);
    }
  }

  global.H5CanvasRuntime = H5CanvasRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5CanvasRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
