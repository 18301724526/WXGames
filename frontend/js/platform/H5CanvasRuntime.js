(function (global) {
  class H5CanvasRuntime {
    constructor(options = {}) {
      this.document = options.document || global.document || null;
      this.runtime = options.runtime || global;
      this.canvas = options.canvas || null;
      this.container = options.container || null;
      this.id = options.id || 'h5CanvasLayer';
      this.pixelRatio = options.pixelRatio || this.runtime.devicePixelRatio || 1;
      this.width = 0;
      this.height = 0;
      this.tapHandlers = [];
      this.resizeHandlers = [];
      this.handleResize = this.handleResize.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.lastTapAt = 0;
      this.lastTapKey = '';
    }

    ensureCanvas() {
      if (this.canvas) return this.canvas;
      if (!this.document || typeof this.document.createElement !== 'function') return null;
      const canvas = this.document.createElement('canvas');
      canvas.id = this.id;
      canvas.setAttribute?.('aria-hidden', 'true');
      canvas.setAttribute?.('data-canvas-hud-input', 'document-capture');
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.display = 'block';
      canvas.style.pointerEvents = 'none';
      canvas.style.touchAction = 'auto';
      canvas.style.zIndex = '999';
      canvas.style.background = 'transparent';
      const host = this.container || this.document.body;
      host?.appendChild?.(canvas);
      this.canvas = canvas;
      this.resize();
      this.bindEvents();
      return this.canvas;
    }

    getViewportSize() {
      const docElement = this.document?.documentElement || {};
      return {
        width: Math.max(1, Math.floor(this.runtime.innerWidth || docElement.clientWidth || 390)),
        height: Math.max(1, Math.floor(this.runtime.innerHeight || docElement.clientHeight || 844)),
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
      const eventTarget = this.document || this.canvas;
      eventTarget.addEventListener?.('pointerup', this.handlePointerUp, { capture: true });
      if (!global.PointerEvent) {
        eventTarget.addEventListener?.('touchend', this.handlePointerUp, { capture: true, passive: false });
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

    shouldIgnoreDuplicateTap(point, event = {}) {
      const now = Number(event.timeStamp) || Date.now();
      const key = `${event.type || 'tap'}:${Math.round(point.x)}:${Math.round(point.y)}`;
      if (key === this.lastTapKey && now - this.lastTapAt < 180) return true;
      this.lastTapKey = key;
      this.lastTapAt = now;
      return false;
    }

    handlePointerUp(event) {
      const point = this.toCanvasPoint(event);
      if (this.shouldIgnoreDuplicateTap(point, event)) return false;
      let handled = false;
      this.tapHandlers.forEach((handler) => {
        if (handler(point, event)) handled = true;
      });
      if (handled && event?.cancelable !== false) event.preventDefault?.();
      if (handled) event.stopPropagation?.();
      return handled;
    }

    onTap(handler) {
      if (typeof handler !== 'function') return () => {};
      this.tapHandlers.push(handler);
      return () => {
        this.tapHandlers = this.tapHandlers.filter((item) => item !== handler);
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
