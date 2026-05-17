(function (global) {
  class TerritoryController {
    constructor(options = {}) {
      this.container = options.container;
      this.scoutContainer = options.scoutContainer;
      this.api = options.api;
      this.getState = options.getState || (() => ({}));
      this.onStateApplied = options.onStateApplied || (() => {});
      this.onFloatingText = options.onFloatingText || (() => {});
      this.onLog = options.onLog || (() => {});
      this.dragState = null;
      if (this.container && !this.container.dataset.radarStartedAt) {
        this.container.dataset.radarStartedAt = String(Date.now());
      }
    }

    updateRadarPhase() {
      if (!this.container) return;
      const startedAt = Number(this.container.dataset.radarStartedAt || Date.now());
      const phase = -Math.max(0, (Date.now() - startedAt) % 8000);
      this.container.dataset.radarPhase = String(phase);
      const radar = this.container.querySelector?.('[data-world-radar]');
      if (radar) radar.style.setProperty('--radar-phase', `${phase}ms`);
    }

    bind() {
      this.updateRadarPhase();
      if (this.container && this.container.dataset.bound !== 'true') {
        this.container.dataset.bound = 'true';
        this.container.addEventListener('click', (event) => {
          const siteButton = event.target.closest('[data-site-id]');
          if (siteButton) {
            this.openSiteDialog(siteButton.dataset.siteId);
            return;
          }
          if (event.target.closest('[data-world-site-close]') || event.target.matches('[data-world-site-modal]')) {
            this.closeSiteDialog();
            return;
          }
          if (event.target.closest('[data-world-reset]')) {
            this.resetWorldPan();
            return;
          }
          const button = event.target.closest('[data-territory-action]');
          if (!button || button.disabled) return;
          this.handleAction(button).catch((error) => {
            this.onLog(`❌ ${error.payload?.message || error.message}`);
          });
        });
        this.container.addEventListener('pointerdown', (event) => this.startWorldDrag(event));
        this.container.addEventListener('pointermove', (event) => this.moveWorldDrag(event));
        this.container.addEventListener('pointerup', (event) => this.endWorldDrag(event));
        this.container.addEventListener('pointercancel', (event) => this.endWorldDrag(event));
      }
      if (this.scoutContainer && this.scoutContainer.dataset.bound !== 'true') {
        this.scoutContainer.dataset.bound = 'true';
        this.scoutContainer.addEventListener('click', (event) => {
          const button = event.target.closest('[data-scout-direction], [data-scout-claim]');
          if (!button || button.disabled) return;
          this.handleScoutAction(button).catch((error) => {
            this.onLog(`❌ ${error.payload?.message || error.message}`);
          });
        });
      }
    }

    getWorldPan() {
      return {
        x: Number(this.container?.dataset.worldPanX || 0),
        y: Number(this.container?.dataset.worldPanY || 0),
      };
    }

    setWorldPan(x, y) {
      if (!this.container) return;
      const clamp = (value) => Math.max(-160, Math.min(160, value));
      const nextX = clamp(Number(x) || 0);
      const nextY = clamp(Number(y) || 0);
      this.container.dataset.worldPanX = String(nextX);
      this.container.dataset.worldPanY = String(nextY);
      const pan = this.container.querySelector('[data-world-pan]');
      if (pan) {
        pan.style.setProperty('--world-pan-x', `${nextX}px`);
        pan.style.setProperty('--world-pan-y', `${nextY}px`);
      }
    }

    resetWorldPan() {
      this.setWorldPan(0, 0);
    }

    startWorldDrag(event) {
      const radar = event.target.closest('[data-world-radar]');
      if (!radar || event.target.closest('button')) return;
      const current = this.getWorldPan();
      this.dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: current.x,
        panY: current.y,
      };
      radar.setPointerCapture?.(event.pointerId);
      radar.classList.add('is-dragging');
    }

    moveWorldDrag(event) {
      if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
      this.setWorldPan(
        this.dragState.panX + event.clientX - this.dragState.startX,
        this.dragState.panY + event.clientY - this.dragState.startY,
      );
    }

    endWorldDrag(event) {
      if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
      const radar = event.target.closest('[data-world-radar]') || this.container.querySelector('[data-world-radar]');
      radar?.releasePointerCapture?.(event.pointerId);
      radar?.classList.remove('is-dragging');
      this.dragState = null;
    }

    openSiteDialog(siteId) {
      const modal = this.container?.querySelector('[data-world-site-modal]');
      if (!modal) return;
      this.container.dataset.selectedSiteId = siteId;
      modal.querySelectorAll('[data-site-detail]').forEach((detail) => {
        detail.hidden = detail.dataset.siteDetail !== siteId;
      });
      modal.classList.add('show');
    }

    closeSiteDialog() {
      const modal = this.container?.querySelector('[data-world-site-modal]');
      if (!modal) return;
      if (this.container?.dataset) delete this.container.dataset.selectedSiteId;
      modal.classList.remove('show');
    }

    async runButton(button, callback) {
      button.disabled = true;
      button.classList.add('is-loading');
      try {
        const result = await callback();
        if (result) {
          this.onStateApplied(result);
          this.onFloatingText(result.message || '疆域已更新');
          this.onLog(`✅ ${result.message || '疆域已更新'}`);
        }
      } finally {
        button.classList.remove('is-loading');
      }
    }

    async handleScoutAction(button) {
      if (button.dataset.scoutDirection) {
        await this.runButton(button, () => this.api.scoutTerritory(button.dataset.scoutDirection));
        return;
      }
      if (button.dataset.scoutClaim) {
        await this.runButton(button, () => this.api.claimScout(button.dataset.scoutClaim));
      }
    }

    async handleAction(button) {
      const territoryId = button.dataset.territoryId;
      const action = button.dataset.territoryAction;
      await this.runButton(button, async () => {
        if (action === 'conquer') return this.api.startConquest(territoryId, Number(button.dataset.soldiers) || 1);
        if (action === 'claim') return this.api.claimConquest(territoryId);
        if (action === 'rename-city') {
          const territory = (this.getState().territoryState?.territories || []).find((item) => item.id === territoryId);
          const name = global.prompt('为这座城市命名', territory?.cityName || territory?.naturalName || '');
          if (!name) return null;
          return this.api.renameCity(territoryId, name);
        }
        return null;
      });
    }
  }

  global.TerritoryController = TerritoryController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerritoryController;
})(typeof window !== 'undefined' ? window : globalThis);
