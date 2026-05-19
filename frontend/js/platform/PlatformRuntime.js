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
    }

    static detectStorage(scope) {
      return scope.localStorage || null;
    }

    static detectScheduler(scope) {
      return {
        setInterval: typeof scope.setInterval === 'function' ? scope.setInterval.bind(scope) : null,
        clearInterval: typeof scope.clearInterval === 'function' ? scope.clearInterval.bind(scope) : null,
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

    setInterval(callback, intervalMs) {
      if (typeof this.scheduler.setInterval === 'function') return this.scheduler.setInterval(callback, intervalMs);
      return null;
    }

    clearInterval(timer) {
      if (timer && typeof this.scheduler.clearInterval === 'function') this.scheduler.clearInterval(timer);
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
  }

  global.PlatformRuntime = PlatformRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = PlatformRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
