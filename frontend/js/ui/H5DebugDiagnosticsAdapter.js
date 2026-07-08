(function (global) {
  function parseFlag(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    return !['0', 'false', 'off', 'no'].includes(String(value).toLowerCase());
  }

  class H5DebugDiagnosticsAdapter {
    constructor(runtime = null) {
      this.runtime = runtime || global;
    }

    getQueryParams() {
      try {
        const href = this.runtime?.location?.href || '';
        const search = this.runtime?.location?.search || '';
        return new URL(href || `https://local.invalid/${search}`).searchParams;
      } catch (_error) {
        try {
          return new URLSearchParams(this.runtime?.location?.search || '');
        } catch (_fallbackError) {
          return new URLSearchParams();
        }
      }
    }

    readQueryFlag(names = []) {
      const params = this.getQueryParams();
      for (const name of names) {
        if (!params.has(name)) continue;
        return parseFlag(params.get(name) || '1', true);
      }
      return null;
    }

    readStoredValue(key = '') {
      try {
        return this.runtime?.localStorage?.getItem?.(key) ?? null;
      } catch (_error) {
        return null;
      }
    }

    readStoredFlag(key = '', options = {}) {
      return parseFlag(this.readStoredValue(key), options.fallback ?? null);
    }

    writeStoredValue(key = '', value = '') {
      this.runtime?.localStorage?.setItem?.(key, value);
      return true;
    }

    removeStoredValue(key = '') {
      this.runtime?.localStorage?.removeItem?.(key);
      return true;
    }

    getEntryStore() {
      return this.runtime?.sessionStorage || null;
    }

    getPlayerLabel() {
      return this.readStoredValue('cf_username') || '';
    }

    getPageInfo() {
      const location = this.runtime?.location || {};
      return {
        pathname: location.pathname || '',
        search: location.search || '',
        hash: location.hash || '',
        userAgent: this.runtime?.navigator?.userAgent || '',
      };
    }

    install(registry = this.runtime) {
      registry.WorldMarchTrace?.setEnvironmentProvider?.(this);
      registry.CodexWorldMapDiag?.setEnvironmentProvider?.(this);
      registry.ClientOperationLogClass?.setEnvironmentProvider?.(this);
      registry.ClientOperationLog?.setEnvironment?.(this);
      registry.CanvasDebugEnvironment = this;
      return this;
    }

    static fromRuntime(runtime = null, options = {}) {
      const registry = options.registry || runtime || global;
      return new H5DebugDiagnosticsAdapter(runtime).install(registry);
    }
  }

  global.H5DebugDiagnosticsAdapter = H5DebugDiagnosticsAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5DebugDiagnosticsAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
