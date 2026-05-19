(function (global) {
  class BuildingActionAdapter {
    constructor(elements = {}) {
      this.container = elements.container || null;
    }

    static fromDocument(doc) {
      return new BuildingActionAdapter({
        container: doc.getElementById('buildingGrid'),
      });
    }

    getContainer() {
      return this.container;
    }

    bindClick(handler) {
      if (!this.container || this.container.dataset.bound === 'true') return;
      this.container.dataset.bound = 'true';
      this.container.addEventListener?.('click', (event) => {
        const button = event.target?.closest?.('button[data-building-id]');
        if (!button || button.disabled) return;
        handler?.({
          buildingId: button.dataset?.buildingId,
          action: button.dataset?.action,
          button,
        });
      });
    }

    setLoading(button, isLoading) {
      if (!button) return;
      button.disabled = Boolean(isLoading);
      if (isLoading) button.classList?.add?.('is-loading');
      else button.classList?.remove?.('is-loading');
    }
  }

  global.BuildingActionAdapter = BuildingActionAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingActionAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
