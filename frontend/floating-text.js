(function (global) {
  class FloatingTextAdapter {
    constructor(options = {}) {
      this.layer = options.layer || null;
      this.resolveTarget = options.resolveTarget || (() => null);
      this.createElement = options.createElement
        || ((tag) => this.layer?.ownerDocument?.createElement?.(tag) || null);
      this.durationMs = options.durationMs || 1200;
    }

    static fromDocument(doc, options = {}) {
      return new FloatingTextAdapter({
        layer: doc?.getElementById?.('fxLayer') || null,
        resolveTarget: (selector) => doc?.querySelector?.(selector) || null,
        createElement: (tag) => doc?.createElement?.(tag) || null,
        ...options,
      });
    }

    show(text, options = {}) {
      const target = this.resolveTarget(options.selector || '.food-card');
      if (!this.layer || !target || typeof target.getBoundingClientRect !== 'function') return false;
      const rect = target.getBoundingClientRect();
      const element = this.createElement('div');
      if (!element) return false;
      element.className = 'floating-text';
      element.textContent = text;
      element.style.color = options.color || '#4ecca3';
      element.style.left = `${rect.left + rect.width / 2}px`;
      element.style.top = `${rect.top}px`;
      this.layer.appendChild(element);
      setTimeout(() => element.remove(), this.durationMs);
      return true;
    }
  }

  global.FloatingTextAdapter = FloatingTextAdapter;

  if (typeof module !== 'undefined' && module.exports) module.exports = FloatingTextAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
