(function (global) {
  class ResourceRenderer {
    constructor(setText) {
      this.setText = setText;
    }

    render(state) {
      const view = global.UIStatePresenter.buildResourceViewState(state);
      const panel = document.getElementById('resourcePanel');
      const woodCard = document.getElementById('woodCard');
      const woodDetailCard = document.getElementById('woodDetailCard');

      if (panel) panel.classList.toggle('has-era-two', view.classState.resourcePanel['has-era-two']);
      this.applyVisibility(woodCard, view.visibility.woodCard);
      this.applyVisibility(woodDetailCard, view.visibility.woodDetailCard);
      Object.entries(view.text).forEach(([id, value]) => this.setText(id, value));

      const netEl = document.getElementById('foodNetRate');
      if (netEl) {
        netEl.classList.toggle('is-positive', view.classState.foodNetRate['is-positive']);
        netEl.classList.toggle('is-negative', view.classState.foodNetRate['is-negative']);
      }
    }

    applyVisibility(element, visible) {
      if (!element) return;
      element.hidden = !visible;
      element.classList.toggle('is-hidden', !visible);
      element.style.display = visible ? '' : 'none';
    }
  }

  global.ResourceRenderer = ResourceRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = ResourceRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
