(function (global) {
  class TerritoryActionAdapter {
    constructor(elements = {}) {
      this.container = elements.container || null;
      this.scoutContainer = elements.scoutContainer || null;
    }

    static fromDocument(doc) {
      return new TerritoryActionAdapter({
        container: doc.getElementById('territoryGrid'),
        scoutContainer: doc.getElementById('scoutDirectionGrid'),
      });
    }

    getContainer() {
      return this.container;
    }

    getScoutContainer() {
      return this.scoutContainer;
    }

    bind(handlers = {}) {
      if (this.container && this.container.dataset.bound !== 'true') {
        this.container.dataset.bound = 'true';
        this.container.addEventListener?.('click', (event) => this.handleWorldClick(event, handlers));
        this.container.addEventListener?.('change', (event) => {
          const field = event.target?.closest?.('[data-expedition-field]');
          if (!field) return;
          handlers.onDraftInput?.({
            field: field.dataset?.expeditionField,
            value: field.value,
          });
        });
        this.container.addEventListener?.('pointerdown', (event) => this.handlePointerDown(event, handlers));
        this.container.addEventListener?.('pointermove', (event) => handlers.onWorldDragMove?.(this.toPointerPayload(event)));
        this.container.addEventListener?.('pointerup', (event) => this.handlePointerEnd(event, handlers));
        this.container.addEventListener?.('pointercancel', (event) => this.handlePointerEnd(event, handlers));
      }

      if (this.scoutContainer && this.scoutContainer.dataset.bound !== 'true') {
        this.scoutContainer.dataset.bound = 'true';
        this.scoutContainer.addEventListener?.('click', (event) => this.handleScoutClick(event, handlers));
      }
    }

    handleWorldClick(event, handlers = {}) {
      const siteButton = event.target?.closest?.('[data-site-id]');
      if (siteButton) {
        handlers.onOpenSite?.(siteButton.dataset?.siteId);
        return;
      }

      if (event.target?.closest?.('[data-world-site-close]') || event.target?.matches?.('[data-world-site-modal]')) {
        handlers.onCloseSite?.();
        return;
      }

      if (event.target?.closest?.('[data-world-reset]')) {
        handlers.onResetWorldPan?.();
        return;
      }

      const button = event.target?.closest?.('[data-territory-action]');
      if (!button || button.disabled) return;
      handlers.onTerritoryAction?.({
        territoryId: button.dataset?.territoryId,
        action: button.dataset?.territoryAction,
        button,
      });
    }

    handleScoutClick(event, handlers = {}) {
      const button = event.target?.closest?.('[data-scout-direction], [data-scout-claim]');
      if (!button || button.disabled) return;
      handlers.onScoutAction?.({
        direction: button.dataset?.scoutDirection,
        missionId: button.dataset?.scoutClaim,
        button,
      });
    }

    handlePointerDown(event, handlers = {}) {
      const radar = event.target?.closest?.('[data-world-radar]');
      if (!radar || event.target?.closest?.('button')) return;
      radar.setPointerCapture?.(event.pointerId);
      radar.classList?.add?.('is-dragging');
      handlers.onWorldDragStart?.({
        ...this.toPointerPayload(event),
        radar,
      });
    }

    handlePointerEnd(event, handlers = {}) {
      const radar = event.target?.closest?.('[data-world-radar]')
        || this.container?.querySelector?.('[data-world-radar]');
      radar?.releasePointerCapture?.(event.pointerId);
      radar?.classList?.remove?.('is-dragging');
      handlers.onWorldDragEnd?.(this.toPointerPayload(event));
    }

    toPointerPayload(event) {
      return {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }

    setWorldPan(x, y) {
      const pan = this.container?.querySelector?.('[data-world-pan]');
      if (!pan) return;
      pan.style?.setProperty?.('--world-pan-x', `${x}px`);
      pan.style?.setProperty?.('--world-pan-y', `${y}px`);
    }

    setLoading(button, isLoading) {
      if (!button) return;
      button.disabled = Boolean(isLoading);
      if (isLoading) button.classList?.add?.('is-loading');
      else button.classList?.remove?.('is-loading');
    }
  }

  global.TerritoryActionAdapter = TerritoryActionAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerritoryActionAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
