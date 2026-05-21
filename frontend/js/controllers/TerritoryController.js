(function (global) {
  class TerritoryController {
    constructor(options = {}) {
      this.actionAdapter = options.actionAdapter || null;
      this.api = options.api;
      this.getState = options.getState || (() => ({}));
      this.onRenderRequested = options.onRenderRequested || (() => {});
      this.onStateApplied = options.onStateApplied || (() => {});
      this.onFloatingText = options.onFloatingText || (() => {});
      this.onLog = options.onLog || (() => {});
      this.onCityRenameRequested = options.onCityRenameRequested || (() => null);
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
      this.actionAdapter?.bind?.({
        onOpenSite: (siteId) => this.openSiteDialog(siteId),
        onCloseSite: () => this.closeSiteDialog(),
        onResetWorldPan: () => this.resetWorldPan(),
        onTerritoryAction: (action) => this.handleAction(action).catch((error) => {
          this.onLog(`✖ ${error.payload?.message || error.message}`);
        }),
        onDraftInput: (change) => this.handleDraftInput(change),
        onWorldDragStart: (pointer) => this.startWorldDrag(pointer),
        onWorldDragMove: (pointer) => this.moveWorldDrag(pointer),
        onWorldDragEnd: (pointer) => this.endWorldDrag(pointer),
        onScoutAction: (action) => this.handleScoutAction(action).catch((error) => {
          this.onLog(`✖ ${error.payload?.message || error.message}`);
        }),
      });
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
      const clamp = (value) => Math.max(-160, Math.min(160, value));
      const nextX = clamp(Number(x) || 0);
      const nextY = clamp(Number(y) || 0);
      this.uiState.worldPanX = nextX;
      this.uiState.worldPanY = nextY;
      this.actionAdapter?.setWorldPan?.(nextX, nextY);
    }

    resetWorldPan() {
      this.setWorldPan(0, 0);
    }

    getPointerPosition(pointer = {}) {
      return {
        x: Number(pointer.clientX ?? pointer.x ?? 0),
        y: Number(pointer.clientY ?? pointer.y ?? 0),
      };
    }

    startWorldDrag(pointer = {}) {
      const current = this.getWorldPan();
      const position = this.getPointerPosition(pointer);
      this.dragState = {
        pointerId: pointer.pointerId,
        startX: position.x,
        startY: position.y,
        panX: current.x,
        panY: current.y,
      };
    }

    moveWorldDrag(pointer = {}) {
      if (!this.dragState || this.dragState.pointerId !== pointer.pointerId) return;
      const position = this.getPointerPosition(pointer);
      this.setWorldPan(
        this.dragState.panX + position.x - this.dragState.startX,
        this.dragState.panY + position.y - this.dragState.startY,
      );
    }

    endWorldDrag(pointer) {
      if (!this.dragState || this.dragState.pointerId !== pointer.pointerId) return;
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

    handleDraftInput(change = {}) {
      const selectedSite = this.getSelectedSite();
      const draft = this.getExpeditionDraft(selectedSite);
      if (!draft.territoryId) return;
      if (change.field === 'soldiers') {
        draft.soldiers = Math.max(1, Math.floor(Number(change.value) || 1));
      }
      if (change.field === 'troopType') {
        draft.troopType = change.value || 'unavailable';
      }
      if (change.field === 'leader') {
        draft.leader = change.value || 'unavailable';
      }
      this.setExpeditionDraft(draft);
    }

    async runButton(button, callback) {
      this.actionAdapter?.setLoading?.(button, true);
      try {
        const result = await callback();
        if (result) {
          this.onStateApplied(result);
          this.onFloatingText(result.message || '疆域已更新');
          this.onLog(`✔ ${result.message || '疆域已更新'}`);
        }
      } finally {
        this.actionAdapter?.setLoading?.(button, false);
      }
    }

    async handleScoutAction(action = {}) {
      if (action.direction) {
        await this.runButton(action.button, () => this.api.scoutTerritory(action.direction));
        return;
      }
      if (action.missionId) {
        await this.runButton(action.button, () => this.api.claimScout(action.missionId));
      }
    }

    async handleAction(actionRequest = {}) {
      const territoryId = actionRequest.territoryId;
      const action = actionRequest.action;
      await this.runButton(actionRequest.button, async () => {
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
          return this.onCityRenameRequested({
            type: 'city',
            territoryId,
            territory,
            currentName: territory?.cityName || territory?.naturalName || '',
          });
        }
        return null;
      });
    }
  }

  global.TerritoryController = TerritoryController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TerritoryController;
})(typeof window !== 'undefined' ? window : globalThis);
