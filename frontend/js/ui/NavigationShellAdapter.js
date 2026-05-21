(function (global) {
  class NavigationShellAdapter {
    constructor(elements = {}) {
      this.document = elements.document || null;
      this.tabButtons = elements.tabButtons || [];
      this.pages = elements.pages || [];
      this.advanceButton = elements.advanceButton || null;
    }

    static fromDocument(doc) {
      return new NavigationShellAdapter({
        document: doc,
        tabButtons: typeof doc.querySelectorAll === 'function'
          ? Array.from(doc.querySelectorAll('.tab-btn'))
          : [],
        pages: typeof doc.querySelectorAll === 'function'
          ? Array.from(doc.querySelectorAll('.page'))
          : [],
      });
    }

    bind(handlers = {}) {
      this.tabButtons.forEach((button) => {
        button.addEventListener?.('click', async (event) => {
          if (event.currentTarget?.disabled) return;
          await handlers.onTabClick?.(event.currentTarget?.dataset?.tab);
        });
      });

      this.advanceButton?.addEventListener?.('click', () => handlers.onAdvanceEra?.());
    }

    getTabDescriptors() {
      return this.tabButtons.map((button) => ({ id: button.dataset?.tab }));
    }

    renderTabs(view = {}) {
      const pageById = new Map((view.pages || []).map((page) => [page.id, page]));
      this.pages.forEach((page) => {
        page.classList?.toggle('active', Boolean(pageById.get(page.dataset?.page)?.isActive));
      });

      const tabById = new Map((view.tabs || []).map((tab) => [tab.id, tab]));
      this.tabButtons.forEach((button) => {
        button.classList?.toggle('active', Boolean(tabById.get(button.dataset?.tab)?.isActive));
      });
    }

    renderTabLocks(view = []) {
      const lockById = new Map(view.map((item) => [item.id, item]));
      this.tabButtons.forEach((button) => {
        const tabView = lockById.get(button.dataset?.tab) || { disabled: false, isLocked: false };
        button.classList?.toggle('is-locked', tabView.isLocked);
        button.disabled = tabView.disabled;
      });
    }

    renderMilitaryView(view = {}) {
      return view;
    }
  }

  global.NavigationShellAdapter = NavigationShellAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = NavigationShellAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
