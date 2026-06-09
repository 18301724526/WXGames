(function (global) {
  class H5AuthRuntimeAdapter {
    constructor(runtime = global, options = {}) {
      this.runtime = runtime || {};
      this.alert = options.alert
        || (typeof this.runtime.alert === 'function' ? this.runtime.alert.bind(this.runtime) : null)
        || (() => {});
      this.location = options.location || this.runtime.location || null;
    }

    static fromRuntime(runtime = global, options = {}) {
      return new H5AuthRuntimeAdapter(runtime, options);
    }

    alertMessage(message) {
      this.alert(message);
    }

    reload() {
      this.location?.reload?.();
    }
  }

  global.H5AuthRuntimeAdapter = H5AuthRuntimeAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5AuthRuntimeAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
