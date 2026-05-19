(function (global) {
  class ResourceDetailModalAdapter {
    constructor(elements = {}) {
      this.trigger = elements.trigger || null;
      this.modal = elements.modal || null;
      this.closeButton = elements.closeButton || null;
    }

    static fromDocument(doc = document) {
      return new ResourceDetailModalAdapter({
        trigger: doc.getElementById('resourcePanel'),
        modal: doc.getElementById('resourceDetailModal'),
        closeButton: doc.getElementById('btnCloseResourceDetail'),
      });
    }

    bind(handlers = {}) {
      this.trigger?.addEventListener?.('click', () => handlers.onOpen?.());
      this.modal?.addEventListener?.('click', (event) => {
        if (event.target === this.modal) handlers.onClose?.();
      });
      this.closeButton?.addEventListener?.('click', () => handlers.onClose?.());
    }

    open() {
      this.modal?.classList?.add('show');
    }

    close() {
      this.modal?.classList?.remove('show');
    }
  }

  global.ResourceDetailModalAdapter = ResourceDetailModalAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = ResourceDetailModalAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
