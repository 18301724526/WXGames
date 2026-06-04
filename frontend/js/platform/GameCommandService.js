(function (global) {
  class GameCommandService {
    constructor(options = {}) {
      this.host = options.host || null;
      this.api = options.api || null;
    }

    getApi() {
      if (this.api) return this.api;
      const host = this.host || {};
      if (typeof host.getGameApi === 'function') return host.getGameApi();
      return host.gameAPI || host.api || null;
    }

    getState() {
      return this.host?.state || {};
    }

    getErrorMessage(error, fallback = 'Action failed') {
      return error?.payload?.message || error?.message || fallback;
    }

    async handleBuildingSuccess(result, action, buildingId) {
      const host = this.host || {};
      host.applyApiState?.(result);
      if (buildingId === 'farm' && action === 'build') {
        host.showFloatingText?.('农田建造成功');
      } else if (buildingId === 'house' && action === 'build') {
        host.showFloatingText?.('民居建造成功');
      } else if (buildingId === 'lumbermill' && action === 'build') {
        host.showFloatingText?.('伐木场建造成功');
      } else {
        host.showFloatingText?.(action === 'upgrade' ? '升级成功' : '建造成功');
      }
      host.log?.(`Success: ${result?.message || ''}`);
      return true;
    }

    async buildBuilding(buildingId) {
      return this.handleBuildingAction(buildingId, 'build');
    }

    async upgradeBuilding(buildingId) {
      return this.handleBuildingAction(buildingId, 'upgrade');
    }

    async handleBuildingAction(buildingId, action) {
      const host = this.host || {};
      if (!buildingId) return false;
      if (host.pendingBuildingAction?.buildingId) return false;
      const normalizedAction = action === 'upgrade' ? 'upgrade' : 'build';
      host.setPendingBuildingAction?.({ buildingId, action: normalizedAction });
      if (host.buildingController?.handleAction) {
        try {
          await host.buildingController.handleAction({ buildingId, action: normalizedAction });
          return true;
        } finally {
          host.setPendingBuildingAction?.(null);
        }
      }
      try {
        const api = this.getApi();
        const result = normalizedAction === 'upgrade'
          ? await api.upgrade(buildingId)
          : await api.build(buildingId);
        await this.handleBuildingSuccess(result, normalizedAction, buildingId);
        return true;
      } catch (error) {
        host.log?.(`Building action failed: ${this.getErrorMessage(error)}`);
        return false;
      } finally {
        host.setPendingBuildingAction?.(null);
      }
    }

    async research(techId) {
      const host = this.host || {};
      if (!techId) return false;
      try {
        const result = await this.getApi().research(techId);
        host.applyApiState?.(result);
        const state = this.getState();
        if (state && typeof state === 'object') {
          host.state = {
            ...state,
            techUiState: {
              ...(state.techUiState || {}),
              selectedTechId: techId,
              detailOpen: false,
            },
          };
        }
        if (host.canvasShell) host.canvasShell.selectedTechId = techId;
        if (host.canvasShell) host.canvasShell.techDetailOpen = false;
        host.showFloatingText?.(result?.message || 'Research completed');
        host.log?.(result?.message || 'Research completed');
        return true;
      } catch (error) {
        host.log?.(`研究失败：${this.getErrorMessage(error)}`);
        host.renderCanvasSurface?.(this.getState()?.currentTab);
        return false;
      }
    }

    async switchCity(cityId) {
      const host = this.host || {};
      const state = this.getState();
      if (!cityId || cityId === state?.activeCityId) return false;
      try {
        host.closeCitySwitcher?.({ skipRender: true });
        const result = await this.getApi().switchCity(cityId);
        host.applyApiState?.(result);
        host.showFloatingText?.(result?.message || 'City switched');
        host.log?.(`City: ${result?.message || 'City switched'}`);
        return true;
      } catch (error) {
        host.log?.(`失败：${this.getErrorMessage(error)}`);
        host.renderCanvasSurface?.(this.getState()?.currentTab);
        return false;
      }
    }
  }

  global.GameCommandService = GameCommandService;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameCommandService;
})(typeof window !== 'undefined' ? window : globalThis);
