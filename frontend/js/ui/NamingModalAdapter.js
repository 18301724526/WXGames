(function (global) {
  class NamingModalAdapter {
    constructor(elements = {}) {
      this.modal = elements.modal || null;
      this.title = elements.title || null;
      this.message = elements.message || null;
      this.input = elements.input || null;
      this.submitButton = elements.submitButton || null;
      this.closeButton = elements.closeButton || null;
    }

    static fromDocument(doc = document) {
      return new NamingModalAdapter({
        modal: doc.getElementById('namingModal'),
        title: doc.getElementById('namingTitle'),
        message: doc.getElementById('namingMessage'),
        input: doc.getElementById('namingInput'),
        submitButton: doc.getElementById('btnSubmitNaming'),
        closeButton: doc.getElementById('btnCloseNamingModal'),
      });
    }

    bind(handlers = {}) {
      this.modal?.addEventListener?.('click', (event) => {
        if (event.target === this.modal) handlers.onClose?.();
      });
      this.closeButton?.addEventListener?.('click', () => handlers.onClose?.());
      this.submitButton?.addEventListener?.('click', () => handlers.onSubmit?.());
    }

    open(view = {}) {
      if (!this.modal || !this.input) return;
      if (this.title) this.title.textContent = view.title || '';
      if (this.message) this.message.textContent = view.message || '';
      this.input.value = '';
      this.input.placeholder = view.placeholder || '';
      this.modal.classList?.add('show');
      this.input.focus?.();
    }

    close() {
      this.modal?.classList?.remove('show');
    }

    getName() {
      return this.input?.value?.trim() || '';
    }

    setSubmitting(isSubmitting) {
      if (this.submitButton) this.submitButton.disabled = Boolean(isSubmitting);
    }
  }

  global.NamingModalAdapter = NamingModalAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = NamingModalAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
