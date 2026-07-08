(function (global) {
  class H5GameApiTransportAdapter {
    constructor(runtime = null, options = {}) {
      this.runtime = runtime || global;
      this.fetchImpl = options.fetch || this.runtime?.fetch || null;
      this.AbortController = options.AbortController || this.runtime?.AbortController || null;
    }

    request(payload = {}) {
      if (typeof this.fetchImpl !== 'function') {
        return Promise.reject(
          Object.assign(new Error('H5 fetch transport is not available'), {
            code: 'H5_GAME_API_TRANSPORT_UNAVAILABLE',
            status: 0,
            path: payload.path,
            requestId: payload.requestId,
          }),
        );
      }
      return this.fetchImpl.call(this.runtime, payload.url, {
        method: payload.method,
        headers: payload.headers,
        body: payload.body,
        signal: payload.signal,
      });
    }

    createAbortController() {
      return typeof this.AbortController === 'function' ? new this.AbortController() : null;
    }

    static fromRuntime(runtime = null, options = {}) {
      return new H5GameApiTransportAdapter(runtime, options);
    }
  }

  global.H5GameApiTransportAdapter = H5GameApiTransportAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5GameApiTransportAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
