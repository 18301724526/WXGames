(function (global) {
  class LogModalAdapter {
    constructor(options = {}) {
      this.trigger = options.trigger || null;
      this.modal = options.modal || null;
      this.content = options.content || null;
      this.closeButton = options.closeButton || null;
      this.activateDelayMs = options.activateDelayMs ?? 10;
    }

    static fromDocument(doc = document, options = {}) {
      return new LogModalAdapter({
        trigger: doc.getElementById('logButton'),
        modal: doc.getElementById('logModal'),
        content: doc.getElementById('logModalContent'),
        closeButton: doc.getElementById('btnCloseLogModal'),
        ...options,
      });
    }

    setContent(markup) {
      if (this.content) this.content.innerHTML = markup || '';
    }

    open(markup) {
      if (!this.modal || !this.content) return;
      this.setContent(markup);
      this.modal.style.display = 'flex';
      setTimeout(() => this.modal.classList.add('active'), this.activateDelayMs);
    }

    close() {
      if (!this.modal) return;
      this.modal.classList.remove('active');
      this.modal.style.display = 'none';
    }

    bindClose(onClose) {
      this.modal?.addEventListener?.('click', (event) => {
        if (event.target === this.modal) onClose?.();
      });
      this.closeButton?.addEventListener?.('click', () => onClose?.());
    }

    bindOpen(onOpen) {
      this.trigger?.addEventListener?.('click', () => onOpen?.());
    }
  }

  global.LogModalAdapter = LogModalAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = LogModalAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
