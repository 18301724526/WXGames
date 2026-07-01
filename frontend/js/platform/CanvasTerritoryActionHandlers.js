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
    try {
      if (typeof require === 'function') return require('./CanvasModalSnapshotAdapter');
    } catch (_error) {
      // Optional adapter in standalone handler tests.
    }
    return null;
  })();

  const { closeBlockingPanelSnapshot } = global.CanvasBlockingPanelSnapshotCalls || (typeof require !== 'undefined' ? require('./CanvasBlockingPanelSnapshotCalls') : {});

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function closeTargetPickerSnapshot(host) {
    if (typeof host?.closeTargetPickerSnapshot === 'function') return host.closeTargetPickerSnapshot();
    return CanvasModalSnapshotAdapter?.closeTargetPickerSnapshot?.(host) || null;
  }

  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }

  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      getWorldTileForSite(siteId) {
        const worldMap = this.getState()?.territoryState?.worldMap || {};
        const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
        return tiles.find((tile) => tile?.siteId === siteId) || null;
      },

      getTerritorySite(siteId) {
        const territories = this.getState()?.territoryState?.territories || [];
        return territories.find((site) => site?.id === siteId) || null;
      },

      centerWorldMapOnSite(siteId, options = {}) {
        const worldMap = this.getState()?.territoryState?.worldMap || {};
        const tile = this.getWorldTileForSite(siteId);
        const site = this.getTerritorySite(siteId) || {};
        const q = Number(tile?.q ?? site.q ?? site.x ?? site.relativeX);
        const r = Number(tile?.r ?? site.r ?? site.y ?? site.relativeY);
        if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
        const origin = worldMap.origin || worldMap.worldOrigin || {};
        const originQ = Number(origin.q ?? origin.x);
        const originR = Number(origin.r ?? origin.y);
        const relativeQ = q - (Number.isFinite(originQ) ? originQ : 0);
        const relativeR = r - (Number.isFinite(originR) ? originR : 0);
        const renderer = this.host?.renderer || this.getGameHost()?.renderer;
        const geometry = renderer?.constructor?.getTileMapGeometry?.()?.DEFAULT_GEOMETRY
          || renderer?.presenter?.getTileMapGeometry?.()?.DEFAULT_GEOMETRY
          || { stepX: 96, stepY: 48 };
        const stepX = Number(geometry.stepX) || 96;
        const stepY = Number(geometry.stepY) || 48;
        const scale = 0.62;
        const frameWidth = Number(this.host?.runtime?.width || this.host?.renderer?.viewportWidth || this.host?.renderer?.width || 420);
        const frameHeight = Number(this.host?.runtime?.height || this.host?.renderer?.viewportHeight || this.host?.renderer?.height || 747);
        const topBarBottom = typeof this.host?.renderer?.getTopBarBottom === 'function'
          ? this.host.renderer.getTopBarBottom(this.getState(), { isMapHome: true })
          : 84;
        const visibleMapY = Math.max(0, Number(topBarBottom) || 84);
        const visibleMapH = Math.max(160, frameHeight - 64 - visibleMapY);
        const originX = frameWidth * 0.5;
        const originY = visibleMapY + visibleMapH * 0.42;
        const targetX = frameWidth * 0.5;
        const targetY = visibleMapY + visibleMapH * 0.46;
        const x = targetX - originX - ((relativeQ - relativeR) * stepX * scale);
        const y = targetY - originY - ((relativeQ + relativeR) * stepY * scale);
        const runtime = this.host?.ensureWorldMapRuntimeCoordinator?.()?.getMapRuntime?.()
          || this.getGameHost()?.ensureWorldMapRuntimeCoordinator?.()?.getMapRuntime?.()
          || this.host?.worldMapRuntime
          || this.getGameHost()?.worldMapRuntime;
        if (runtime?.setCamera) {
          runtime.setCamera(x, y, {
            source: options.source || 'subcityJump',
            render: options.render !== false,
          });
          return true;
        }
        const territory = this.getTerritoryController();
        if (territory?.setWorldPan) {
          territory.setWorldPan(x, y);
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        uiState.worldPanX = x;
        uiState.worldPanY = y;
        return true;
      },

      centerWorldMapOnCapital(options = {}) {
        const state = this.getState();
        const activeCityId = state?.cityState?.capitalCityId || 'capital';
        const siteId = options.siteId || activeCityId || 'capital';
        return this.centerWorldMapOnSite(siteId, options);
      },

      resetWorldMapCamera(options = {}) {
        const game = this.getGameHost();
        const render = options.render !== false;
        const runtime = this.host?.ensureWorldMapRuntimeCoordinator?.()?.ensureRuntime?.()
          || game?.ensureWorldMapRuntimeCoordinator?.()?.ensureRuntime?.()
          || this.host?.worldMapRuntime
          || game?.worldMapRuntime;
        const resetRendererObject = (renderer = null, seen = new Set()) => {
          if (!renderer || typeof renderer !== 'object' || seen.has(renderer)) return false;
          seen.add(renderer);
          renderer.lastWorldTileMapContext = null;
          renderer.lastMapHomeWorldHudContext = null;
          renderer.lastWorldMapLayerRenderResult = null;
          renderer.invalidateWorldTileCaches?.();
          renderer.invalidateWorldTileViewCache?.();
          renderer.setHitTargets?.([]);
          if (Array.isArray(renderer.hitTargets)) renderer.hitTargets = [];
          [
            renderer.worldMapRenderer,
            renderer.worldMapLayerRenderer,
            renderer.worldActorLayerRenderer,
          ].forEach((linkedRenderer) => {
            if (linkedRenderer && linkedRenderer !== renderer) resetRendererObject(linkedRenderer, seen);
          });
          return true;
        };
        const resetWorldRendererState = (target = null, seen = new Set()) => {
          if (!target || typeof target !== 'object') return false;
          const candidates = [
            target.worldMapRenderer,
            target.renderer,
            target.worldMapLayerRenderer,
            target.worldActorLayerRenderer,
          ].filter((renderer) => renderer && typeof renderer === 'object');
          const renderers = candidates.length ? candidates : [target];
          return renderers.reduce((handled, renderer) => resetRendererObject(renderer, seen) || handled, false);
        };
        const resetLayerHost = (target = null, shouldRender = render, shouldClearTransform = true) => {
          if (!target || typeof target !== 'object') return false;
          target.worldMapDragWaterTimeMs = null;
          target.worldMapDragFrameActive = false;
          target.worldMapPinchDragging = false;
          target.deferRenderUntilWorldMapDragEnd = false;
          if (target.worldMapRuntime) target.worldMapRuntime.waterTimeMs = null;
          target.lastWorldTileMapContext = null;
          target.lastMapHomeWorldHudContext = null;
          resetWorldRendererState(target);
          if (shouldClearTransform) target.clearWorldMapLayerTransform?.();
          if (!shouldRender) return true;
          if (typeof target.renderWorldMapLayerFrame === 'function') {
            return target.renderWorldMapLayerFrame({
              force: true,
              reuseCachedWorldTileView: false,
              snapshotOnly: false,
              waterTimeMs: null,
            }) !== false;
          }
          if (typeof target.requestWorldMapRenderAnimationFrame === 'function') {
            return target.requestWorldMapRenderAnimationFrame({
              force: true,
              reuseCachedWorldTileView: false,
              snapshotOnly: false,
              waterTimeMs: null,
            }) !== false;
          }
          return true;
        };
        const resetLayerHosts = (targets = [], shouldRender = render, shouldClearTransform = true) => {
          const seen = new Set();
          let handled = false;
          targets.forEach((target) => {
            if (!target || typeof target !== 'object' || seen.has(target)) return;
            seen.add(target);
            handled = resetLayerHost(target, shouldRender, shouldClearTransform) || handled;
          });
          return handled;
        };
        if (options.resetRuntimeState) {
          runtime?.resetWorldState?.({ source: options.source || 'resetWorldPan' });
          resetLayerHosts([game?.canvasShell, this.host, game], false, false);
        }
        if (runtime?.setCamera && this.centerWorldMapOnCapital({
          siteId: options.siteId,
          source: options.source || 'resetWorldPan',
          render: false,
        })) {
          resetLayerHosts([game?.canvasShell, this.host, game]);
          if (render && typeof runtime.requestRender === 'function') {
            runtime.requestRender({ force: true });
          }
          return true;
        }
        if (runtime?.resetCamera) {
          runtime.resetCamera({ source: options.source || 'resetWorldPan', render: false });
          const uiState = this.getSharedTerritoryUiState();
          uiState.worldPanX = 0;
          uiState.worldPanY = 0;
          resetLayerHosts([game?.canvasShell, this.host, game]);
          if (render && typeof runtime.requestRender === 'function') {
            runtime.requestRender({ force: true });
          }
          return true;
        }
        const territory = this.getTerritoryController();
        if (territory?.resetWorldPan) {
          territory.resetWorldPan();
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        uiState.worldPanX = 0;
        uiState.worldPanY = 0;
        return false;
      },

      handle_switchMilitaryView(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (typeof game?.switchMilitaryView === 'function') {
          const switched = game.switchMilitaryView(action.view) !== false;
          if (switched) {
            closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
            const result = game?.tutorialController?.onMilitaryViewSwitched?.(action.view || 'army');
            this.afterHandled(action);
            game?.tutorialController?.refreshCurrentHighlight?.();
            const scheduler = this.host?.runtime || game?.runtime || global;
            scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
            if (result?.catch) result.catch((error) => this.log?.(error));
          }
          return switched;
        }
        const view = action.view || 'army';
        closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
        this.host.militaryView = view;
        if (this.host.state) StateWriter.commit(this.host, (prev) => ({ ...prev, militaryView: view }), { source: 'territoryHandlers:switchMilitaryView' });
        game?.tutorialController?.onMilitaryViewSwitched?.(view);
        return this.afterHandled(action);
      },

      handle_openWorldSite(action) {
        const forwarded = this.forward(action);
        const siteId = action.siteId || action.territoryId || action.cityId || '';
        if (forwarded !== undefined) {
          return this.finalizeForwarded(forwarded, () => {
            this.openWorldSiteLocally(siteId);
            this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
          });
        }
        closeTargetPickerSnapshot(this.host);
        const territory = this.getTerritoryController();
        if (territory?.openSiteDialog) {
          territory.openSiteDialog(siteId);
          this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        uiState.selectedSiteId = siteId;
        const handled = this.afterHandled(action);
        this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
        return handled;
      },

      handle_closeWorldSite(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.closeSiteDialog) {
          territory.closeSiteDialog();
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        uiState.selectedSiteId = '';
        uiState.expeditionConfigSiteId = '';
        uiState.expeditionSoldiers = '';
        return this.afterHandled(action);
      },

      handle_resetWorldPan(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) {
          return this.finalizeForwarded(forwarded, () => {
            this.resetWorldMapCamera({ source: 'resetWorldPan' });
            this.afterHandled(action);
          });
        }
        this.resetWorldMapCamera({ source: 'resetWorldPan' });
        return this.afterHandled(action);
      },

      handle_worldMapDrag(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        const pointer = action.pointer || {};
        if (territory) {
          if (action.phase === 'start') {
            closeTargetPickerSnapshot(this.host);
            territory.closeSiteDialog?.({ render: false });
            territory.startWorldDrag?.(pointer);
          }
          if (action.phase === 'move') territory.moveWorldDrag?.(pointer);
          if (action.phase === 'end') territory.endWorldDrag?.(pointer);
        } else {
          const uiState = this.getSharedTerritoryUiState();
          const x = Number(pointer.x) || 0;
          const y = Number(pointer.y) || 0;
          if (action.phase === 'start') {
            closeTargetPickerSnapshot(this.host);
            uiState.selectedSiteId = '';
            uiState.expeditionConfigSiteId = '';
            uiState.expeditionSoldiers = '';
            uiState.expeditionTroopType = '';
            uiState.expeditionLeader = '';
            this.worldDragStart = {
              x,
              y,
              panX: Number(uiState.worldPanX) || 0,
              panY: Number(uiState.worldPanY) || 0,
            };
          }
          if (action.phase === 'move') {
            const dx = Number(pointer.dx ?? pointer.deltaX);
            const dy = Number(pointer.dy ?? pointer.deltaY);
            if (Number.isFinite(dx) && Number.isFinite(dy)) {
              uiState.worldPanX = (Number(uiState.worldPanX) || 0) + dx;
              uiState.worldPanY = (Number(uiState.worldPanY) || 0) + dy;
            } else if (this.worldDragStart) {
              uiState.worldPanX = this.worldDragStart.panX + x - this.worldDragStart.x;
              uiState.worldPanY = this.worldDragStart.panY + y - this.worldDragStart.y;
            }
          }
          if (action.phase === 'end' || action.phase === 'cancel') this.worldDragStart = null;
        }
        this.renderDragFrame(action);
        return true;
      },

      handle_territoryAction(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (!territory?.handleAction) return false;
        territory.handleAction({ territoryId: action.territoryId, action: action.action });
        return true;
      },

      handle_manageCity(action) {
        return this.handle_enterCity({
          ...action,
          type: 'enterCity',
          cityId: action.cityId || action.territoryId,
          tab: action.tab || 'buildings',
        });
      },

      handle_renameCity(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'rename-city' });
          return true;
        }
        const site = (this.host.state?.territoryState?.territories || []).find((item) => item.id === action.territoryId) || {};
        this.host.openNaming?.({
          type: 'city',
          territoryId: action.territoryId,
          title: t('world.site.rename.cityTitle'),
          message: t('world.site.rename.currentName', {
            name: site.cityName || site.naturalName || t('world.site.rename.unnamedCity'),
          }),
        });
        return true;
      },
    });
    return true;
  }

  const CanvasTerritoryActionHandlers = { install };
  global.CanvasTerritoryActionHandlers = CanvasTerritoryActionHandlers;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasTerritoryActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
