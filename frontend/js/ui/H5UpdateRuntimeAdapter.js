(function (global) {
  class H5UpdateRuntimeAdapter {
    constructor(runtime = global, options = {}) {
      this.runtime = runtime || {};
      this.confirm = options.confirm || this.runtime.confirm || (() => true);
      this.caches = options.caches || this.runtime.caches || null;
      this.navigator = options.navigator || this.runtime.navigator || global.navigator || null;
      this.location = options.location || this.runtime.location || null;
      this.URLCtor = options.URL || this.runtime.URL || global.URL;
      this.now = options.now || (() => Date.now());
    }

    static fromRuntime(runtime = global, options = {}) {
      return new H5UpdateRuntimeAdapter(runtime, options);
    }

    buildMessage(version) {
      return `游戏有更新，需要重启后继续。${version?.version ? `\n版本：${version.version}` : ''}`;
    }

    async clearCaches() {
      if (this.caches?.keys) {
        const keys = await this.caches.keys();
        await Promise.all(keys.map((key) => this.caches.delete(key)));
      }
      const serviceWorker = this.navigator?.serviceWorker;
      if (serviceWorker?.getRegistrations) {
        const registrations = await serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    }

    buildReloadUrl() {
      const href = this.location?.href || '';
      if (!href) return `?reload=${this.now()}`;
      if (this.URLCtor) {
        try {
          const url = new this.URLCtor(href);
          url.searchParams.set('reload', this.now().toString());
          return url.toString();
        } catch (error) {
          // Some embedded runtimes only expose a partial URL implementation.
        }
      }
      const separator = href.includes('?') ? '&' : '?';
      return `${href}${separator}reload=${this.now()}`;
    }

    async forceReload() {
      await this.clearCaches().catch(() => {});
      const nextUrl = this.buildReloadUrl();
      if (this.location?.replace) this.location.replace(nextUrl);
      return nextUrl;
    }

    async promptAndReload(version) {
      const message = this.buildMessage(version);
      try {
        this.confirm(message);
      } catch (error) {
        // Reload is mandatory once a deployment change is detected.
      }
      return this.forceReload();
    }
  }

  global.H5UpdateRuntimeAdapter = H5UpdateRuntimeAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5UpdateRuntimeAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
