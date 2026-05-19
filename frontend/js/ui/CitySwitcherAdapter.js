(function (global) {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  class CitySwitcherAdapter {
    constructor(elements = {}) {
      this.wrapper = elements.wrapper || null;
      this.trigger = elements.trigger || null;
      this.name = elements.name || null;
      this.menu = elements.menu || null;
      this.document = elements.document || null;
    }

    static fromDocument(doc) {
      return new CitySwitcherAdapter({
        wrapper: doc.getElementById('citySwitcher'),
        trigger: doc.getElementById('citySwitcherTrigger'),
        name: doc.getElementById('citySwitcherName'),
        menu: doc.getElementById('citySwitcherMenu'),
        document: doc,
      });
    }

    bind(handlers = {}) {
      this.trigger?.addEventListener?.('click', (event) => {
        event.stopPropagation?.();
        this.toggle();
      });

      this.menu?.addEventListener?.('click', (event) => {
        const option = event.target?.closest?.('[data-city-id]');
        if (!option || option.disabled) return;
        event.stopPropagation?.();
        handlers.onSelect?.(option.dataset?.cityId);
      });

      this.document?.addEventListener?.('click', (event) => {
        if (this.wrapper && !this.wrapper.contains?.(event.target)) this.close();
      });

      this.document?.addEventListener?.('keydown', (event) => {
        if (event.key === 'Escape') this.close();
      });
    }

    render(view = {}) {
      if (!this.wrapper || !this.trigger || !this.name || !this.menu) return;
      this.wrapper.hidden = Boolean(view.hidden);
      if (this.wrapper.hidden) {
        this.close();
        return;
      }

      this.name.textContent = view.activeCityName || '';
      const options = (view.options || []).map((city) => `
        <button class="city-switcher-option ${city.isActive ? 'active' : ''}" type="button" role="option" aria-selected="${city.isActive ? 'true' : 'false'}" data-city-id="${escapeHtml(city.id)}">
          <span class="city-option-main">
            <span class="city-option-name">${escapeHtml(city.name || '未命名城市')}</span>
            <span class="city-option-tag">${escapeHtml(city.tag)}</span>
          </span>
          <span class="city-option-meta">${escapeHtml(city.metaText)}</span>
        </button>
      `).join('');

      if (this.menu.dataset?.optionsSignature !== view.signature) {
        this.menu.innerHTML = options;
        if (this.menu.dataset) this.menu.dataset.optionsSignature = view.signature || '';
      }
      this.trigger.setAttribute?.('aria-expanded', this.menu.hidden ? 'false' : 'true');
    }

    toggle() {
      if (!this.wrapper || !this.trigger || !this.menu || this.wrapper.hidden) return;
      const nextOpen = this.menu.hidden;
      this.menu.hidden = !nextOpen;
      this.wrapper.classList?.toggle('is-open', nextOpen);
      this.trigger.setAttribute?.('aria-expanded', nextOpen ? 'true' : 'false');
    }

    close() {
      if (this.menu) this.menu.hidden = true;
      this.wrapper?.classList?.remove('is-open');
      this.trigger?.setAttribute?.('aria-expanded', 'false');
    }
  }

  global.CitySwitcherAdapter = CitySwitcherAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = CitySwitcherAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
