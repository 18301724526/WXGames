(function (global) {
  class AdvisorPanelAdapter {
    constructor(elements = {}) {
      this.button = elements.button || null;
      this.modal = elements.modal || null;
      this.message = elements.message || null;
      this.goButton = elements.goButton || null;
      this.closeButton = elements.closeButton || null;
      this.dismissButton = elements.dismissButton || null;
    }

    static fromDocument(doc = document) {
      return new AdvisorPanelAdapter({
        button: doc.getElementById('advisorBtn'),
        modal: doc.getElementById('advisorModal'),
        message: doc.getElementById('advisorMessage'),
        goButton: doc.getElementById('btnAdvisorGo'),
        closeButton: doc.getElementById('btnCloseAdvisor'),
        dismissButton: doc.getElementById('btnAdvisorDismiss'),
      });
    }

    bind(handlers = {}) {
      this.button?.addEventListener?.('click', () => handlers.onOpen?.());
      this.modal?.addEventListener?.('click', (event) => {
        if (event.target === this.modal) handlers.onClose?.();
      });
      this.closeButton?.addEventListener?.('click', () => handlers.onClose?.());
      this.dismissButton?.addEventListener?.('click', () => handlers.onClose?.());
      this.goButton?.addEventListener?.('click', () => handlers.onGo?.());
    }

    render(view = {}) {
      if (this.button) this.button.hidden = Boolean(view.hidden);
      if (this.message) this.message.textContent = view.text?.message || '';
      if (this.goButton) this.goButton.disabled = Boolean(view.goButton?.disabled);
      if (view.closeModal) this.close();
    }

    open() {
      this.modal?.classList?.add('show');
    }

    close() {
      this.modal?.classList?.remove('show');
    }
  }

  global.AdvisorPanelAdapter = AdvisorPanelAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = AdvisorPanelAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
