(function (global) {
  class H5TextAdapter {
    constructor(options = {}) {
      this.getElementById = options.getElementById || (() => null);
    }

    static fromDocument(doc = global.document) {
      return new H5TextAdapter({
        getElementById: (id) => doc?.getElementById?.(id) || null,
      });
    }

    setText(id, value) {
      const element = this.getElementById(id);
      if (element) element.textContent = value;
    }
  }

  global.H5TextAdapter = H5TextAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5TextAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
