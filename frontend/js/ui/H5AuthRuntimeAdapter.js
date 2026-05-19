(function (global) {
  class H5AuthRuntimeAdapter {
    constructor(runtime = global, options = {}) {
      this.runtime = runtime || {};
      this.confirm = options.confirm || this.runtime.confirm || (() => true);
      this.alert = options.alert || this.runtime.alert || (() => {});
      this.location = options.location || this.runtime.location || null;
    }

    static fromRuntime(runtime = global, options = {}) {
      return new H5AuthRuntimeAdapter(runtime, options);
    }

    confirmReset() {
      return this.confirm('⚠️ 确定重置游戏进度？\n当前账号的所有发展将回到初始状态。');
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
