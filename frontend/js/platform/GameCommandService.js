(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const CanvasModalSnapshotAdapter = (() => {
    if (global.CanvasModalSnapshotAdapter) return global.CanvasModalSnapshotAdapter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasModalSnapshotAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

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

    getErrorMessage(error, fallback = t('command.action.failed', {})) {
      return error?.payload?.message || error?.message || fallback;
    }

    async handleBuildingSuccess(result, action, buildingId) {
      const host = this.host || {};
      host.applyApiState?.(result);
      if (buildingId === 'farm' && action === 'build') {
        host.showFloatingText?.(t('command.building.farmBuilt', {}));
      } else if (buildingId === 'house' && action === 'build') {
        host.showFloatingText?.(t('command.building.houseBuilt', {}));
      } else if (buildingId === 'lumbermill' && action === 'build') {
        host.showFloatingText?.(t('command.building.lumbermillBuilt', {}));
      } else {
        host.showFloatingText?.(
          action === 'upgrade'
            ? t('command.building.upgradeSuccess', {})
            : t('command.building.buildSuccess', {}),
        );
      }
      host.log?.(t('command.success.detail', { message: result?.message || '' }));
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
      if (host.tutorialController?.onBuildingAction?.(buildingId, action) === false) {
        host.showFloatingText?.(t('guide.buildFirstHouseFirst'));
        host.tutorialController?.refreshCurrentHighlight?.();
        return false;
      }
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
        host.log?.(t('command.building.failed', { message: this.getErrorMessage(error) }));
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
          StateWriter.commit(host, (prev) => ({
            ...prev,
            techUiState: {
              ...(prev.techUiState || {}),
              selectedTechId: techId,
              detailOpen: false,
            },
          }), { source: 'GameCommandService:research' });
        }
        CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(host.canvasShell || host, 'techDetailOpen');
        host.showFloatingText?.(result?.message || t('command.research.completed', {}));
        host.log?.(result?.message || t('command.research.completed', {}));
        return true;
      } catch (error) {
        host.log?.(t('command.research.failed', { message: this.getErrorMessage(error) }));
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
        const message = result?.message || t('command.city.switched', {});
        host.showFloatingText?.(message);
        host.log?.(message);
        return true;
      } catch (error) {
        host.log?.(t('command.city.switchFailed', { message: this.getErrorMessage(error) }));
        host.renderCanvasSurface?.(this.getState()?.currentTab);
        return false;
      }
    }
  }

  global.GameCommandService = GameCommandService;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameCommandService;
})(typeof window !== 'undefined' ? window : globalThis);
