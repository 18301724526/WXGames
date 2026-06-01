(function (global) {
  class PlatformRuntime {
    constructor(options = {}) {
      this.kind = options.kind || PlatformRuntime.detectKind(global);
      this.host = options.host || PlatformRuntime.detectHost(global);
      this.canvas = options.canvas || null;
      this.storagePrefix = options.storagePrefix || 'cf_';
      this.systemInfo = options.systemInfo || null;
      this.storage = options.storage || PlatformRuntime.detectStorage(global);
      this.scheduler = options.scheduler || PlatformRuntime.detectScheduler(global);
      this.logger = options.logger || global.console || null;
      this.textInput = typeof options.textInput === 'function' ? options.textInput : null;
    }

    static detectStorage(scope) {
      return scope.localStorage || null;
    }

    static detectScheduler(scope) {
      return {
        setInterval: typeof scope.setInterval === 'function' ? scope.setInterval.bind(scope) : null,
        clearInterval: typeof scope.clearInterval === 'function' ? scope.clearInterval.bind(scope) : null,
        setTimeout: typeof scope.setTimeout === 'function' ? scope.setTimeout.bind(scope) : null,
        clearTimeout: typeof scope.clearTimeout === 'function' ? scope.clearTimeout.bind(scope) : null,
        requestAnimationFrame: typeof scope.requestAnimationFrame === 'function' ? scope.requestAnimationFrame.bind(scope) : null,
      };
    }

    static detectHost(scope) {
      if (scope.wx && typeof scope.wx.createCanvas === 'function') return scope.wx;
      if (scope.tt && typeof scope.tt.createCanvas === 'function') return scope.tt;
      return null;
    }

    static detectKind(scope) {
      if (scope.tt && typeof scope.tt.createCanvas === 'function') return 'douyin';
      if (scope.wx && typeof scope.wx.createCanvas === 'function') return 'wechat';
      return 'h5';
    }

    isMiniGame() {
      return this.kind === 'wechat' || this.kind === 'douyin';
    }

    createCanvas() {
      if (this.canvas) return this.canvas;
      if (!this.host || typeof this.host.createCanvas !== 'function') {
        throw new Error('MiniGame canvas API is unavailable');
      }
      this.canvas = this.host.createCanvas();
      return this.canvas;
    }

    getSystemInfo() {
      if (this.host && typeof this.host.getSystemInfoSync === 'function') {
        return this.host.getSystemInfoSync();
      }
      return this.systemInfo || { windowWidth: 390, windowHeight: 844, pixelRatio: 1 };
    }

    getStorage(key) {
      const namespacedKey = `${this.storagePrefix}${key}`;
      if (this.host && typeof this.host.getStorageSync === 'function') {
        return this.host.getStorageSync(namespacedKey) || null;
      }
      if (this.storage && typeof this.storage.getItem === 'function') return this.storage.getItem(namespacedKey);
      return null;
    }

    setStorage(key, value) {
      const namespacedKey = `${this.storagePrefix}${key}`;
      if (this.host && typeof this.host.setStorageSync === 'function') {
        this.host.setStorageSync(namespacedKey, value);
        return;
      }
      if (this.storage && typeof this.storage.setItem === 'function') this.storage.setItem(namespacedKey, value);
    }

    removeStorage(key) {
      const namespacedKey = `${this.storagePrefix}${key}`;
      if (this.host && typeof this.host.removeStorageSync === 'function') {
        this.host.removeStorageSync(namespacedKey);
        return;
      }
      if (this.storage && typeof this.storage.removeItem === 'function') this.storage.removeItem(namespacedKey);
    }

    request(options = {}) {
      if (!this.host || typeof this.host.request !== 'function') {
        return fetch(options.url, {
          method: options.method,
          headers: options.headers,
          body: options.body,
        });
      }
      return new Promise((resolve, reject) => {
        this.host.request({
          url: options.url,
          method: options.method || 'GET',
          header: options.headers || {},
          data: options.body ? JSON.parse(options.body) : undefined,
          success: (res) => resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            async json() {
              return typeof res.data === 'string' ? JSON.parse(res.data || '{}') : (res.data || {});
            },
          }),
          fail: reject,
        });
      });
    }

    static getTouchPoint(event = {}) {
      const touch = event.changedTouches?.[0] || event.touches?.[0] || event;
      return {
        x: Number(touch.clientX ?? touch.x ?? touch.pageX ?? 0),
        y: Number(touch.clientY ?? touch.y ?? touch.pageY ?? 0),
      };
    }

    static getTouchPoints(event = {}) {
      const touches = Array.from(event.touches || []);
      if (touches.length) return touches.map((touch) => PlatformRuntime.getTouchPoint(touch));
      return Array.from(event.changedTouches || []).map((touch) => PlatformRuntime.getTouchPoint(touch));
    }

    static getGestureCenter(points = []) {
      const usable = points.slice(0, 2);
      const total = usable.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
      const count = Math.max(1, usable.length);
      return { x: total.x / count, y: total.y / count };
    }

    static getGestureDistance(points = []) {
      if (points.length < 2) return 0;
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      return Math.hypot(dx, dy);
    }

    setInterval(callback, intervalMs) {
      if (typeof this.scheduler.setInterval === 'function') return this.scheduler.setInterval(callback, intervalMs);
      return null;
    }

    clearInterval(timer) {
      if (timer && typeof this.scheduler.clearInterval === 'function') this.scheduler.clearInterval(timer);
    }

    setTimeout(callback, delayMs) {
      if (typeof this.scheduler.setTimeout === 'function') return this.scheduler.setTimeout(callback, delayMs);
      return null;
    }

    clearTimeout(timer) {
      if (timer && typeof this.scheduler.clearTimeout === 'function') this.scheduler.clearTimeout(timer);
    }

    requestAnimationFrame(callback) {
      if (typeof this.scheduler.requestAnimationFrame === 'function') return this.scheduler.requestAnimationFrame(callback);
      return this.setTimeout(callback, 16);
    }

    now() {
      return Date.now();
    }

    log(message) {
      if (this.logger && typeof this.logger.log === 'function') this.logger.log(message);
    }

    onTouchStart(handler) {
      if (this.host && typeof this.host.onTouchStart === 'function') this.host.onTouchStart(handler);
    }

    onTouchEnd(handler) {
      if (this.host && typeof this.host.onTouchEnd === 'function') {
        this.host.onTouchEnd(handler);
        return () => {
          if (typeof this.host.offTouchEnd === 'function') this.host.offTouchEnd(handler);
        };
      }
      if (this.canvas && typeof this.canvas.addEventListener === 'function') {
        this.canvas.addEventListener('touchend', handler);
        return () => this.canvas.removeEventListener?.('touchend', handler);
      }
      return () => {};
    }

    onTap(handler) {
      return this.onTouchEnd((event) => handler(PlatformRuntime.getTouchPoint(event), event));
    }

    onDrag(handler) {
      if (typeof handler !== 'function') return () => {};
      const disposers = [];
      if (this.host && typeof this.host.onTouchStart === 'function') {
        const start = (event) => {
          if ((event?.touches?.length || 0) >= 2) return false;
          return handler('start', PlatformRuntime.getTouchPoint(event), event);
        };
        this.host.onTouchStart(start);
        disposers.push(() => this.host.offTouchStart?.(start));
      }
      if (this.host && typeof this.host.onTouchMove === 'function') {
        const move = (event) => {
          if ((event?.touches?.length || 0) >= 2) return false;
          return handler('move', PlatformRuntime.getTouchPoint(event), event);
        };
        this.host.onTouchMove(move);
        disposers.push(() => this.host.offTouchMove?.(move));
      }
      if (this.host && typeof this.host.onTouchEnd === 'function') {
        const end = (event) => handler('end', PlatformRuntime.getTouchPoint(event), event);
        this.host.onTouchEnd(end);
        disposers.push(() => this.host.offTouchEnd?.(end));
      }
      return () => disposers.forEach((dispose) => dispose());
    }

    onGesture(handler) {
      if (typeof handler !== 'function') return () => {};
      const disposers = [];
      let activePinch = null;
      const dispatch = (gesture, event) => handler(gesture, event) === true;
      const start = (event = {}) => {
        const points = PlatformRuntime.getTouchPoints(event);
        if (points.length < 2) return false;
        activePinch = {
          distance: Math.max(1, PlatformRuntime.getGestureDistance(points)),
          center: PlatformRuntime.getGestureCenter(points),
        };
        return true;
      };
      const move = (event = {}) => {
        if (!activePinch) return false;
        const points = PlatformRuntime.getTouchPoints(event);
        if (points.length < 2) return false;
        const distance = Math.max(1, PlatformRuntime.getGestureDistance(points));
        const center = PlatformRuntime.getGestureCenter(points);
        const previousDistance = Math.max(1, Number(activePinch.distance) || distance);
        const previousCenter = activePinch.center || center;
        activePinch = { distance, center };
        const scaleDelta = Math.max(0.82, Math.min(1.22, distance / previousDistance));
        return dispatch({
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
      };
      const end = (event = {}) => {
        if ((event.touches?.length || 0) >= 2) return move(event);
        const previousCenter = activePinch?.center || PlatformRuntime.getGestureCenter(PlatformRuntime.getTouchPoints(event));
        activePinch = null;
        return dispatch({
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
      };
      if (this.host && typeof this.host.onTouchStart === 'function') {
        this.host.onTouchStart(start);
        disposers.push(() => this.host.offTouchStart?.(start));
      }
      if (this.host && typeof this.host.onTouchMove === 'function') {
        this.host.onTouchMove(move);
        disposers.push(() => this.host.offTouchMove?.(move));
      }
      if (this.host && typeof this.host.onTouchEnd === 'function') {
        this.host.onTouchEnd(end);
        disposers.push(() => this.host.offTouchEnd?.(end));
      }
      if (this.host && typeof this.host.onTouchCancel === 'function') {
        this.host.onTouchCancel(end);
        disposers.push(() => this.host.offTouchCancel?.(end));
      }
      return () => disposers.forEach((dispose) => dispose());
    }

    requestTextInput(options = {}) {
      if (this.textInput) return Promise.resolve(this.textInput(options));
      if (!this.host || typeof this.host.showKeyboard !== 'function') return Promise.resolve(null);
      return new Promise((resolve) => {
        let settled = false;
        const done = (value) => {
          if (settled) return;
          settled = true;
          if (typeof this.host.offKeyboardConfirm === 'function' && confirmHandler) this.host.offKeyboardConfirm(confirmHandler);
          if (typeof this.host.offKeyboardInput === 'function' && inputHandler) this.host.offKeyboardInput(inputHandler);
          resolve(value);
        };
        let currentValue = String(options.value || '');
        const confirmHandler = (event = {}) => done(event.value ?? currentValue);
        const inputHandler = (event = {}) => {
          currentValue = String(event.value ?? currentValue);
        };
        if (typeof this.host.onKeyboardInput === 'function') this.host.onKeyboardInput(inputHandler);
        if (typeof this.host.onKeyboardConfirm === 'function') this.host.onKeyboardConfirm(confirmHandler);
        this.host.showKeyboard({
          defaultValue: currentValue,
          maxLength: Number(options.maxLength) || 12,
          multiple: false,
          confirmHold: false,
          confirmType: 'done',
          success: () => {},
          fail: () => done(null),
        });
      });
    }
  }

  global.PlatformRuntime = PlatformRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = PlatformRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
