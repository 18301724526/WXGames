(function (global) {
  const DOMHelper = {
    byId(id) {
      return document.getElementById(id);
    },
    setText(id, value) {
      const element = this.byId(id);
      if (element) element.textContent = value;
    },
    toggleDisabled(element, disabled) {
      if (!element) return;
      element.disabled = Boolean(disabled);
      element.classList.toggle('is-disabled', Boolean(disabled));
    },
  };

  global.DOMHelper = DOMHelper;
  if (typeof module !== 'undefined' && module.exports) module.exports = DOMHelper;
})(typeof window !== 'undefined' ? window : globalThis);
