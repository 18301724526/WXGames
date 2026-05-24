(function (global) {
  class H5CanvasRuntime {
    constructor(options = {}) {
      this.document = options.document || global.document || null;
      this.runtime = options.runtime || global;
      this.kind = 'h5';
      this.storagePrefix = options.storagePrefix || 'cf_';
      this.storage = options.storage || this.runtime.localStorage || null;
      this.canvas = options.canvas || null;
      this.container = options.container || null;
      this.id = options.id || 'h5CanvasLayer';
      this.pixelRatio = options.pixelRatio || this.runtime.devicePixelRatio || 1;
      this.width = 0;
      this.height = 0;
      this.tapHandlers = [];
      this.dragHandlers = [];
      this.gestureHandlers = [];
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
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100dvh';
      canvas.style.display = 'block';
      canvas.style.pointerEvents = 'auto';
      canvas.style.touchAction = 'none';
      canvas.style.zIndex = '999';
      canvas.style.background = 'transparent';
      const host = this.container || this.document.body;
      host?.appendChild?.(canvas);
      this.canvas = canvas;
      this.resize();
      this.bindEvents();
      return this.canvas;
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

    log(message) {
      const logger = this.runtime.console || global.console;
      if (logger && typeof logger.log === 'function') logger.log(message);
    }

    getViewportSize() {
      const vv = this.runtime.visualViewport;
      const docElement = this.document?.documentElement || {};
      return {
        width: Math.max(1, Math.floor(vv?.width || this.runtime.innerWidth || docElement.clientWidth || 390)),
        height: Math.max(1, Math.floor(vv?.height || this.runtime.innerHeight || docElement.clientHeight || 844)),
      };
    }

    resize() {
      const canvas = this.canvas || this.ensureCanvas();
      if (!canvas) return null;
      const viewport = this.getViewportSize();
      this.pixelRatio = this.runtime.devicePixelRatio || this.pixelRatio || 1;
      this.width = viewport.width;
      this.height = viewport.height;
      canvas.width = Math.floor(this.width * this.pixelRatio);
      canvas.height = Math.floor(this.height * this.pixelRatio);
      const ctx = canvas.getContext?.('2d');
      if (ctx) {
        if (typeof ctx.setTransform === 'function') ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        else if (typeof ctx.scale === 'function') ctx.scale(this.pixelRatio, this.pixelRatio);
      }
      this.resizeHandlers.forEach((handler) => handler({ width: this.width, height: this.height, pixelRatio: this.pixelRatio }));
      return { width: this.width, height: this.height, pixelRatio: this.pixelRatio };
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
      if (this.activePinch) return false;
      if (!this.pointerDown || !this.dragActive) return false;
      const point = this.toCanvasPoint(event);
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
      this.activePinch = { distance, center };
      const scaleDelta = Math.max(0.82, Math.min(1.22, distance / previousDistance));
      return this.dispatchGesture({
        type: 'pinchZoom',
        scaleDelta,
        centerX: center.x,
        centerY: center.y,
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
      this.activePinch = null;
      this.dragMoved = true;
      this.suppressTapUntil = this.getEventTime(event) + 260;
      if (event?.cancelable !== false) event.preventDefault?.();
      event.stopPropagation?.();
      return true;
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
