(function (global) {
  class TerritoryController {
    constructor(options = {}) {
      this.container = options.container;
      this.scoutContainer = options.scoutContainer;
      this.api = options.api;
      this.getState = options.getState || (() => ({}));
      this.onRenderRequested = options.onRenderRequested || (() => {});
      this.onStateApplied = options.onStateApplied || (() => {});
      this.onFloatingText = options.onFloatingText || (() => {});
      this.onLog = options.onLog || (() => {});
      this.dragState = null;
      this.uiState = {
        selectedSiteId: '',
        worldPanX: 0,
        worldPanY: 0,
        expeditionConfigSiteId: '',
        expeditionTroopType: '',
        expeditionLeader: '',
        expeditionSoldiers: '',
        ...(options.uiState || {}),
      };
    }

    bind() {
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
        this.container.addEventListener('change', (event) => this.handleDraftInput(event));
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
        x: Number(this.uiState.worldPanX || 0),
        y: Number(this.uiState.worldPanY || 0),
      };
    }

    getUiState() {
      return { ...this.uiState };
    }

    setWorldPan(x, y) {
      if (!this.container) return;
      const clamp = (value) => Math.max(-160, Math.min(160, value));
      const nextX = clamp(Number(x) || 0);
      const nextY = clamp(Number(y) || 0);
      this.uiState.worldPanX = nextX;
      this.uiState.worldPanY = nextY;
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
      if (!siteId) return;
      this.uiState.selectedSiteId = siteId;
      this.onRenderRequested();
    }

    closeSiteDialog() {
      this.uiState.selectedSiteId = '';
      this.clearExpeditionDraft({ render: false });
      this.onRenderRequested();
    }

    getSelectedSite() {
      const selectedSiteId = this.uiState.selectedSiteId;
      return (this.getState().territoryState?.territories || []).find((item) => item.id === selectedSiteId) || null;
    }

    getExpeditionDraft(site = this.getSelectedSite()) {
      const recommended = Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1);
      return {
        territoryId: this.uiState.expeditionConfigSiteId || '',
        troopType: this.uiState.expeditionTroopType || 'unavailable',
        leader: this.uiState.expeditionLeader || 'unavailable',
        soldiers: Math.max(1, Number(this.uiState.expeditionSoldiers) || recommended),
      };
    }

    setExpeditionDraft(draft = {}) {
      if (draft.territoryId) this.uiState.expeditionConfigSiteId = draft.territoryId;
      if (draft.troopType) this.uiState.expeditionTroopType = draft.troopType;
      if (draft.leader) this.uiState.expeditionLeader = draft.leader;
      if (draft.soldiers) this.uiState.expeditionSoldiers = String(Math.max(1, Math.floor(Number(draft.soldiers) || 1)));
      this.onRenderRequested();
    }

    clearExpeditionDraft(options = {}) {
      this.uiState.expeditionConfigSiteId = '';
      this.uiState.expeditionTroopType = '';
      this.uiState.expeditionLeader = '';
      this.uiState.expeditionSoldiers = '';
      if (options.render !== false) this.onRenderRequested();
    }

    openExpeditionDraft(territoryId) {
      const territory = (this.getState().territoryState?.territories || []).find((item) => item.id === territoryId);
      if (!territory) return;
      this.setExpeditionDraft({
        territoryId,
        troopType: 'unavailable',
        leader: 'unavailable',
        soldiers: territory.recommendedSoldiers || territory.defense || 1,
      });
    }

    handleDraftInput(event) {
      const field = event.target.closest('[data-expedition-field]');
      if (!field) return;
      const selectedSite = this.getSelectedSite();
      const draft = this.getExpeditionDraft(selectedSite);
      if (!draft.territoryId) return;
      if (field.dataset.expeditionField === 'soldiers') {
        draft.soldiers = Math.max(1, Math.floor(Number(field.value) || 1));
      }
      if (field.dataset.expeditionField === 'troopType') {
        draft.troopType = field.value || 'unavailable';
      }
      if (field.dataset.expeditionField === 'leader') {
        draft.leader = field.value || 'unavailable';
      }
      this.setExpeditionDraft(draft);
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
        if (action === 'conquer') {
          this.clearExpeditionDraft();
          return this.api.startConquest(territoryId, { soldiers: 1 });
        }
        if (action === 'open-expedition') {
          this.openExpeditionDraft(territoryId);
          return null;
        }
        if (action === 'close-expedition') {
          this.clearExpeditionDraft();
          return null;
        }
        if (action === 'launch-expedition') {
          const territory = (this.getState().territoryState?.territories || []).find((item) => item.id === territoryId);
          const draft = this.getExpeditionDraft(territory);
          const result = await this.api.startConquest(territoryId, {
            troopType: draft.troopType,
            leader: draft.leader,
            soldiers: draft.soldiers,
          });
          this.clearExpeditionDraft();
          return result;
        }
        if (action === 'claim') {
          this.clearExpeditionDraft();
          return this.api.claimConquest(territoryId);
        }
        if (action === 'manage-city') {
          const result = await this.api.switchCity(territoryId);
          this.closeSiteDialog();
          return result;
        }
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
