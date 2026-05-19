(function (global) {
  class ResourceRenderer {
    constructor(setText, elements = {}) {
      this.setText = setText;
      this.panel = elements.panel || null;
      this.woodCard = elements.woodCard || null;
      this.woodDetailCard = elements.woodDetailCard || null;
      this.foodNetRate = elements.foodNetRate || null;
    }

    static fromDocument(doc = document, setText = () => {}) {
      return new ResourceRenderer(setText, {
        panel: doc.getElementById('resourcePanel'),
        woodCard: doc.getElementById('woodCard'),
        woodDetailCard: doc.getElementById('woodDetailCard'),
        foodNetRate: doc.getElementById('foodNetRate'),
      });
    }

    render(state) {
      const view = global.UIStatePresenter.buildResourceViewState(state);

      if (this.panel) this.panel.classList.toggle('has-era-two', view.classState.resourcePanel['has-era-two']);
      this.applyVisibility(this.woodCard, view.visibility.woodCard);
      this.applyVisibility(this.woodDetailCard, view.visibility.woodDetailCard);
      Object.entries(view.text).forEach(([id, value]) => this.setText(id, value));

      if (this.foodNetRate) {
        this.foodNetRate.classList.toggle('is-positive', view.classState.foodNetRate['is-positive']);
        this.foodNetRate.classList.toggle('is-negative', view.classState.foodNetRate['is-negative']);
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
