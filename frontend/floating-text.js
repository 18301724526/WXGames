(function (global) {
  class FloatingTextAdapter {
    constructor(options = {}) {
      this.layer = options.layer || null;
      this.resolveTarget = options.resolveTarget || (() => null);
      this.durationMs = options.durationMs || 1200;
    }

    show(text, options = {}) {
      const target = this.resolveTarget(options.selector || '.food-card');
      if (!this.layer || !target || typeof target.getBoundingClientRect !== 'function') return false;
      const rect = target.getBoundingClientRect();
      const element = this.layer.ownerDocument
        ? this.layer.ownerDocument.createElement('div')
        : document.createElement('div');
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
  global.mountFloatingText = function mountFloatingText(game) {
    game.floatingText = new FloatingTextAdapter({
      layer: document.getElementById('fxLayer'),
      resolveTarget: (selector) => document.querySelector(selector),
    });
    console.log('[floating-text.js] 飘字动画模块已挂载');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FloatingTextAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
