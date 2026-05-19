(function (global) {
  class EventUIRenderer {
    constructor(setText, options = {}) {
      this.setText = setText;
      this.document = options.document || global.document || (typeof document !== 'undefined' ? document : null);
    }

    getElement(id) {
      return this.document?.getElementById?.(id) || null;
    }

    bind(handlers = {}) {
      const pending = this.getElement('pendingEventsContainer');
      pending?.addEventListener?.('click', (event) => {
        const card = event.target?.closest?.('[data-event-id]');
        if (!card) return;
        handlers.onOpen?.(card.dataset?.eventId);
      });

      const claimButton = this.getElement('btnClaimEvent');
      claimButton?.addEventListener?.('click', (event) => {
        handlers.onClaim?.(event.currentTarget?.dataset?.optionId);
      });

      const optionsContainer = this.getElement('eventModalOptions');
      optionsContainer?.addEventListener?.('click', (event) => {
        const button = event.target?.closest?.('[data-option-id]');
        if (!button) return;
        handlers.onClaim?.(button.dataset?.optionId);
      });

      const closeButton = this.getElement('btnCloseEventModal');
      closeButton?.addEventListener?.('click', () => handlers.onClose?.());
    }

    formatReward(reward) {
      return global.UIStatePresenter.formatEventReward(reward);
    }

    escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    getOptionPreview(option) {
      return global.UIStatePresenter.getEventOptionPreview(option);
    }

    getRemainingSeconds(expiresAt) {
      return global.UIStatePresenter.getRemainingSeconds(expiresAt);
    }

    formatRemainingTime(expiresAt) {
      return global.UIStatePresenter.formatRemainingTime(expiresAt);
    }

    getEventHint(event) {
      return global.UIStatePresenter.getEventHint(event);
    }

    getClassNames(classState = {}) {
      return Object.entries(classState)
        .filter(([, active]) => active)
        .map(([name]) => name)
        .join(' ');
    }

    renderPendingCard(card) {
      const idAttr = card.domId ? ` id="${this.escapeHtml(card.domId)}"` : '';
      const classNames = this.getClassNames(card.classState);
      return `
            <div class="pending-event-card ${classNames}" data-event-id="${this.escapeHtml(card.id)}"${idAttr}>
              <div class="pending-event-header">${this.escapeHtml(card.icon)} ${this.escapeHtml(card.title)}</div>
              <div class="pending-event-desc">${this.escapeHtml(card.description)}</div>
              <div class="pending-event-hint">${this.escapeHtml(card.hint)}</div>
            </div>
          `;
    }

    renderHistoryItem(item) {
      return `
            <div class="event-history-item ${this.escapeHtml(item.className)}">
              <div class="event-history-emoji">${this.escapeHtml(item.icon)}</div>
              <div class="event-history-info">
                <div class="event-history-title">${this.escapeHtml(item.title)}</div>
                <div class="event-history-result">${this.escapeHtml(item.result)}</div>
              </div>
            </div>
          `;
    }

    renderOption(option) {
      return `
          <button class="event-option-btn" type="button" data-option-id="${this.escapeHtml(option.id)}">
            <span class="event-option-label">${this.escapeHtml(option.label)}</span>
            <span class="event-option-preview">${this.escapeHtml(option.preview)}</span>
          </button>
        `;
    }

    render(state) {
      const view = global.UIStatePresenter.buildEventViewState(state);
      this.setText('techKnowledgeRate', view.text.techKnowledgeRate);
      const pending = this.getElement('pendingEventsContainer');
      const badge = this.getElement('eventsBadge');
      if (badge) {
        badge.hidden = view.badge.hidden;
        badge.textContent = view.badge.text;
      }

      if (pending) {
        if (view.pending.isEmpty) {
          pending.innerHTML = `<div class="pending-events-empty">${view.pending.emptyText}</div>`;
        } else {
          pending.innerHTML = view.pending.cards.map((card) => this.renderPendingCard(card)).join('');
        }
      }

      const history = this.getElement('eventHistoryList');
      if (history) {
        if (view.history.isEmpty) {
          history.innerHTML = `<div class="event-history-empty">${view.history.emptyText}</div>`;
        } else {
          history.innerHTML = view.history.items.map((item) => this.renderHistoryItem(item)).join('');
        }
      }
    }

    open(eventData) {
      const view = global.UIStatePresenter.buildEventModalViewState(eventData);
      this.setText('eventModalTitle', view.text.title);
      this.setText('eventModalDescription', view.text.description);
      const optionsContainer = this.getElement('eventModalOptions');
      const claimButton = this.getElement('btnClaimEvent');

      if (optionsContainer) {
        optionsContainer.innerHTML = view.options.length > 1
          ? view.options.map((option) => this.renderOption(option)).join('')
          : '';
      }

      if (claimButton) {
        if (claimButton.dataset) claimButton.dataset.optionId = view.claimButton.optionId;
        else if (claimButton.setAttribute) claimButton.setAttribute('data-option-id', view.claimButton.optionId);
        claimButton.textContent = view.claimButton.label;
        claimButton.hidden = view.claimButton.hidden;
      }

      this.setText('eventModalReward', view.text.reward);
      const modal = this.getElement('eventModal');
      if (modal && view.showModal) modal.classList.add('show');
    }

    close() {
      const modal = this.getElement('eventModal');
      if (modal) modal.classList.remove('show');
    }

    isOpen() {
      return this.getElement('eventModal')?.classList?.contains?.('show') || false;
    }
  }

  global.EventUIRenderer = EventUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = EventUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
