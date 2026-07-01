(function (global) {
  // Expedition / conquest action handlers, extracted from CanvasTerritoryActionHandlers
  // into their own single-responsibility module (mixin onto CanvasActionController.prototype).
  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      handle_changeExpeditionSoldiers(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleDraftInput) {
          territory.handleDraftInput({ field: 'soldiers', value: action.value });
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        uiState.expeditionConfigSiteId = action.siteId || uiState.expeditionConfigSiteId;
        uiState.expeditionSoldiers = String(Math.max(1, Math.floor(Number(action.value) || 1)));
        return this.afterHandled(action);
      },

      handle_changeExpeditionLeader(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleDraftInput) {
          territory.handleDraftInput({ field: 'leader', value: action.value || action.leaderId });
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        uiState.expeditionConfigSiteId = action.siteId || uiState.expeditionConfigSiteId;
        uiState.expeditionLeader = action.value || action.leaderId || 'unavailable';
        return this.afterHandled(action);
      },

      handle_openExpedition(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'open-expedition' });
          return true;
        }
        const site = (this.host.state?.territoryState?.territories || []).find(
          (item) => item.id === action.territoryId,
        );
        const uiState = this.getSharedTerritoryUiState();
        uiState.expeditionConfigSiteId = action.territoryId || '';
        uiState.expeditionSoldiers = String(
          Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1),
        );
        return this.afterHandled(action);
      },

      handle_closeExpedition(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'close-expedition' });
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        uiState.expeditionConfigSiteId = '';
        uiState.expeditionSoldiers = '';
        return this.afterHandled(action);
      },

      handle_conquer(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'conquer' });
          return true;
        }
        return this.finalize(
          this.runAction(() => this.host.api.startConquest(action.territoryId, { soldiers: 100 })),
        );
      },

      handle_launchExpedition(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'launch-expedition' });
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        return this.finalize(
          this.runAction(() =>
            this.host.api.startConquest(action.territoryId, {
              troopType: uiState.expeditionTroopType || 'unavailable',
              leader: uiState.expeditionLeader || 'unavailable',
              soldiers: this.host.getExpeditionSoldiers?.(),
            }),
          ),
        );
      },

      handle_claimConquest(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'claim' });
          return true;
        }
        return this.finalize(this.runAction(() => this.host.api.claimConquest(action.territoryId)));
      },
    });
    return true;
  }

  const CanvasExpeditionActionHandlers = { install };
  global.CanvasExpeditionActionHandlers = CanvasExpeditionActionHandlers;
  if (typeof module !== 'undefined' && module.exports)
    module.exports = CanvasExpeditionActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
