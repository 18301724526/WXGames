(function (global) {
  class WorldMapRendererHostBridge {
    constructor(options = {}) {
      this.renderer = options.renderer || null;
    }

    createProxy() {
      const renderer = this.renderer;
      return new Proxy(renderer, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host) {
            if (typeof prop === 'string' && prop.startsWith('worldTile')) return host[prop];
            if (prop in host) {
              const hostValue = host[prop];
              return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
            }
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          if (target.host) {
            if (typeof prop === 'string' && prop.startsWith('worldTile')) {
              target.host[prop] = value;
              return true;
            }
            if (prop in target.host) {
              target.host[prop] = value;
              return true;
            }
          }
          target[prop] = value;
          return true;
        },
      });
    }

    static createProxy(renderer) {
      return new WorldMapRendererHostBridge({ renderer }).createProxy();
    }
  }

  global.WorldMapRendererHostBridge = WorldMapRendererHostBridge;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRendererHostBridge;
})(typeof window !== 'undefined' ? window : globalThis);
