(function (global) {
  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      openWorldSiteLocally(siteId) {
        const territory = this.getTerritoryController();
        if (territory?.openSiteDialog) {
          territory.openSiteDialog(siteId);
          return true;
        }
        this.host.territoryUiState = this.host.territoryUiState || {};
        this.host.territoryUiState.selectedSiteId = siteId;
        const game = this.getGameHost();
        if (game && game !== this.host) {
          game.territoryUiState = game.territoryUiState || {};
          game.territoryUiState.selectedSiteId = siteId;
        }
        return true;
      },

      refreshWorldMarchTutorialHighlight() {
        const game = this.getGameHost();
        const tutorialController = game?.tutorialController || this.host?.tutorialController || null;
        if (!tutorialController || typeof tutorialController.refreshCurrentHighlight !== 'function') return false;
        tutorialController.refreshCurrentHighlight();
        const scheduler = this.host?.runtime || game?.runtime || global;
        if (typeof scheduler?.setTimeout === 'function') {
          scheduler.setTimeout(() => tutorialController.refreshCurrentHighlight(), 0);
        }
        return true;
      },

      getWorldTileForSite(siteId) {
        const worldMap = this.getState()?.territoryState?.worldMap || {};
        const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
        return tiles.find((tile) => tile?.siteId === siteId) || null;
      },

      getTerritorySite(siteId) {
        const territories = this.getState()?.territoryState?.territories || [];
        return territories.find((site) => site?.id === siteId) || null;
      },

      centerWorldMapOnSite(siteId) {
        const tile = this.getWorldTileForSite(siteId);
        const site = this.getTerritorySite(siteId) || {};
        const q = Number(tile?.q ?? site.q ?? site.x ?? site.relativeX);
        const r = Number(tile?.r ?? site.r ?? site.y ?? site.relativeY);
        if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
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
        const x = targetX - originX - ((q - r) * stepX * scale);
        const y = targetY - originY - ((q + r) * stepY * scale);
        const runtime = this.host?.ensureWorldMapRuntimeCoordinator?.()?.getMapRuntime?.()
          || this.getGameHost()?.ensureWorldMapRuntimeCoordinator?.()?.getMapRuntime?.()
          || this.host?.worldMapRuntime
          || this.getGameHost()?.worldMapRuntime;
        if (runtime?.setCamera) {
          runtime.setCamera(x, y, { source: 'subcityJump', render: true });
          return true;
        }
        const territory = this.getTerritoryController();
        if (territory?.setWorldPan) {
          territory.setWorldPan(x, y);
          return true;
        }
        this.host.territoryUiState = this.host.territoryUiState || {};
        this.host.territoryUiState.worldPanX = x;
        this.host.territoryUiState.worldPanY = y;
        return true;
      },

      resetWorldMapCamera(options = {}) {
        const game = this.getGameHost();
        const render = options.render !== false;
        const runtime = this.host?.ensureWorldMapRuntimeCoordinator?.()?.ensureRuntime?.()
          || game?.ensureWorldMapRuntimeCoordinator?.()?.ensureRuntime?.()
          || this.host?.worldMapRuntime
          || game?.worldMapRuntime;
        const resetLayerHost = (target = null) => {
          if (!target || typeof target !== 'object') return false;
          target.worldMapDragWaterTimeMs = null;
          target.worldMapDragFrameActive = false;
          target.worldMapPinchDragging = false;
          target.deferRenderUntilWorldMapDragEnd = false;
          if (target.worldMapRuntime) target.worldMapRuntime.waterTimeMs = null;
          target.clearWorldMapLayerTransform?.();
          if (!render) return true;
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
        const resetLayerHosts = (...targets) => {
          const seen = new Set();
          let handled = false;
          targets.forEach((target) => {
            if (!target || typeof target !== 'object' || seen.has(target)) return;
            seen.add(target);
            handled = resetLayerHost(target) || handled;
          });
          return handled;
        };
        if (runtime?.resetCamera) {
          runtime.resetCamera({ source: options.source || 'resetWorldPan', render: false });
          const uiState = this.getSharedTerritoryUiState();
          uiState.worldPanX = 0;
          uiState.worldPanY = 0;
          resetLayerHosts(game?.canvasShell, this.host, game);
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

      handle_scoutTerritory(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleScoutAction) {
          territory.handleScoutAction({ direction: action.direction || action.value });
          return true;
        }
        return this.finalize(this.runAction(() => this.host.api.scoutTerritory(action.value || action.direction)));
      },

      handle_claimScout(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleScoutAction) {
          territory.handleScoutAction({ missionId: action.missionId || action.value });
          return true;
        }
        return this.finalize(this.runAction(() => this.host.api.claimScout(action.value || action.missionId)));
      },

      handle_selectWorldMarchTarget(action) {
        const q = Math.floor(Number(action.targetQ ?? action.q));
        const r = Math.floor(Number(action.targetR ?? action.r));
        if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
        const game = this.getGameHost();
        game?.territoryController?.closeSiteDialog?.({ render: false });
        const uiState = this.getSharedTerritoryUiState();
        const nextTarget = {
          q,
          r,
          tileId: action.tileId || `tile_${q}_${r}`,
          pickerOpen: false,
        };
        if (action.known !== undefined) nextTarget.known = Boolean(action.known);
        if (action.terrain) nextTarget.terrain = action.terrain;
        if (action.terrainLabel) nextTarget.terrainLabel = action.terrainLabel;
        uiState.worldMarchTarget = nextTarget;
        uiState.selectedWorldActorId = '';
        uiState.selectedSiteId = '';
        uiState.expeditionConfigSiteId = '';
        const tutorialResult = game?.tutorialController?.onWorldMarchTargetSelected?.(action) || true;
        return this.finalize(Promise.resolve(tutorialResult).then((allowed) => {
          if (allowed !== false) {
            this.refreshWorldMarchLayer(action);
            this.refreshWorldMarchTutorialHighlight();
          }
          return allowed !== false;
        }));
      },

      handle_openWorldMarchFormationPicker(action) {
        const q = Math.floor(Number(action.targetQ ?? action.q));
        const r = Math.floor(Number(action.targetR ?? action.r));
        if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
        const uiState = this.getSharedTerritoryUiState();
        const previousTarget = uiState.worldMarchTarget || {};
        const nextTarget = {
          q,
          r,
          tileId: action.tileId || `tile_${q}_${r}`,
          pickerOpen: true,
        };
        if (action.known !== undefined) nextTarget.known = Boolean(action.known);
        else if (previousTarget.known !== undefined) nextTarget.known = Boolean(previousTarget.known);
        if (action.terrain || previousTarget.terrain) nextTarget.terrain = action.terrain || previousTarget.terrain;
        if (action.terrainLabel || previousTarget.terrainLabel) nextTarget.terrainLabel = action.terrainLabel || previousTarget.terrainLabel;
        uiState.worldMarchTarget = nextTarget;
        uiState.selectedWorldActorId = '';
        const handled = this.refreshWorldMarchLayer(action);
        this.refreshWorldMarchTutorialHighlight();
        return handled;
      },

      handle_closeWorldMarchHud(action) {
        const uiState = this.getSharedTerritoryUiState();
        uiState.worldMarchTarget = null;
        uiState.selectedWorldActorId = '';
        const handled = this.refreshWorldMarchLayer(action);
        this.refreshWorldMarchTutorialHighlight();
        return handled;
      },

      handle_selectWorldActor(action) {
        const actorId = action.actorId || action.missionId || '';
        if (!actorId) return false;
        const uiState = this.getSharedTerritoryUiState();
        uiState.selectedWorldActorId = actorId;
        uiState.worldMarchTarget = null;
        uiState.selectedSiteId = '';
        const handled = this.refreshWorldMarchLayer(action);
        this.refreshWorldMarchTutorialHighlight();
        return handled;
      },

      handle_startWorldMarch(action, meta = {}) {
        const q = Math.floor(Number(action.targetQ ?? action.q));
        const r = Math.floor(Number(action.targetR ?? action.r));
        if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
        const run = () => {
          const game = this.getGameHost();
          const options = {
            mode: 'manual',
            targetQ: q,
            targetR: r,
            formationSlot: action.formationSlot || action.slot || 1,
            cityId: action.cityId || game?.state?.activeCityId || 'capital',
          };
          if (meta.inputIntent) options.clientInputIntent = meta.inputIntent;
          if (typeof game?.startWorldMarch === 'function') return game.startWorldMarch(options);
          return this.runAction(() => this.host.api.startWorldMarch(options));
        };
        return this.finalize(Promise.resolve(run()).then((result) => {
          if (result !== false) {
            const uiState = this.getSharedTerritoryUiState();
            uiState.worldMarchTarget = null;
            uiState.selectedWorldActorId = '';
            this.refreshWorldMarchLayer(action);
            this.refreshWorldMarchTutorialHighlight();
          }
          return result !== false;
        }));
      },

      handle_returnWorldMarch(action, meta = {}) {
        const missionId = action.missionId || action.actorId || '';
        if (!missionId) return false;
        const game = this.getGameHost();
        const options = meta.inputIntent ? { clientInputIntent: meta.inputIntent } : {};
        const run = () => {
          if (typeof game?.returnWorldMarch === 'function') return game.returnWorldMarch(missionId, options);
          return this.runAction(() => this.host.api.returnWorldMarch(missionId, options));
        };
        return this.finalize(Promise.resolve(run()).then((result) => {
          if (result !== false) {
            this.getSharedTerritoryUiState().selectedWorldActorId = '';
            this.refreshWorldMarchLayer(action);
            this.refreshWorldMarchTutorialHighlight();
          }
          return result !== false;
        }));
      },

      handle_stopWorldMarch(action, meta = {}) {
        const missionId = action.missionId || action.actorId || '';
        if (!missionId) return false;
        const game = this.getGameHost();
        const options = meta.inputIntent ? { clientInputIntent: meta.inputIntent } : {};
        const run = () => {
          if (typeof game?.stopWorldMarch === 'function') return game.stopWorldMarch(missionId, options);
          return this.runAction(() => this.host.api.stopWorldMarch(missionId, options));
        };
        return this.finalize(Promise.resolve(run()).then((result) => {
          if (result !== false) {
            this.getSharedTerritoryUiState().selectedWorldActorId = '';
            this.refreshWorldMarchLayer(action);
            this.refreshWorldMarchTutorialHighlight();
          }
          return result !== false;
        }));
      },

      handle_switchMilitaryView(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (typeof game?.switchMilitaryView === 'function') {
          const switched = game.switchMilitaryView(action.view) !== false;
          if (switched) {
            this.host.activeCommandPanel = '';
            if (game && game !== this.host && 'activeCommandPanel' in game) game.activeCommandPanel = '';
            if (game?.canvasShell && game.canvasShell !== this.host) game.canvasShell.activeCommandPanel = '';
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
        this.host.activeCommandPanel = '';
        this.host.militaryView = view;
        if (this.host.state) this.host.state = { ...this.host.state, militaryView: view };
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
        const territory = this.getTerritoryController();
        if (territory?.openSiteDialog) {
          territory.openSiteDialog(siteId);
          this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
          return true;
        }
        this.host.territoryUiState = this.host.territoryUiState || {};
        this.host.territoryUiState.selectedSiteId = siteId;
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
        this.host.territoryUiState = this.host.territoryUiState || {};
        this.host.territoryUiState.selectedSiteId = '';
        this.host.territoryUiState.expeditionConfigSiteId = '';
        this.host.territoryUiState.expeditionSoldiers = '';
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
            territory.closeSiteDialog?.({ render: false });
            territory.startWorldDrag?.(pointer);
          }
          if (action.phase === 'move') territory.moveWorldDrag?.(pointer);
          if (action.phase === 'end') territory.endWorldDrag?.(pointer);
        } else {
          this.host.territoryUiState = this.host.territoryUiState || {};
          const x = Number(pointer.x) || 0;
          const y = Number(pointer.y) || 0;
          if (action.phase === 'start') {
            this.host.territoryUiState.selectedSiteId = '';
            this.host.territoryUiState.expeditionConfigSiteId = '';
            this.host.territoryUiState.expeditionSoldiers = '';
            this.host.territoryUiState.expeditionTroopType = '';
            this.host.territoryUiState.expeditionLeader = '';
            this.worldDragStart = {
              x,
              y,
              panX: Number(this.host.territoryUiState.worldPanX) || 0,
              panY: Number(this.host.territoryUiState.worldPanY) || 0,
            };
          }
          if (action.phase === 'move') {
            const dx = Number(pointer.dx ?? pointer.deltaX);
            const dy = Number(pointer.dy ?? pointer.deltaY);
            if (Number.isFinite(dx) && Number.isFinite(dy)) {
              this.host.territoryUiState.worldPanX = (Number(this.host.territoryUiState.worldPanX) || 0) + dx;
              this.host.territoryUiState.worldPanY = (Number(this.host.territoryUiState.worldPanY) || 0) + dy;
            } else if (this.worldDragStart) {
              this.host.territoryUiState.worldPanX = this.worldDragStart.panX + x - this.worldDragStart.x;
              this.host.territoryUiState.worldPanY = this.worldDragStart.panY + y - this.worldDragStart.y;
            }
          }
          if (action.phase === 'end' || action.phase === 'cancel') this.worldDragStart = null;
        }
        this.renderDragFrame(action);
        return true;
      },

      handle_changeExpeditionSoldiers(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleDraftInput) {
          territory.handleDraftInput({ field: 'soldiers', value: action.value });
          return true;
        }
        this.host.territoryUiState = this.host.territoryUiState || {};
        this.host.territoryUiState.expeditionConfigSiteId = action.siteId || this.host.territoryUiState.expeditionConfigSiteId;
        this.host.territoryUiState.expeditionSoldiers = String(Math.max(1, Math.floor(Number(action.value) || 1)));
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
        this.host.territoryUiState = this.host.territoryUiState || {};
        this.host.territoryUiState.expeditionConfigSiteId = action.siteId || this.host.territoryUiState.expeditionConfigSiteId;
        this.host.territoryUiState.expeditionLeader = action.value || action.leaderId || 'unavailable';
        return this.afterHandled(action);
      },

      handle_territoryAction(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (!territory?.handleAction) return false;
        territory.handleAction({ territoryId: action.territoryId, action: action.action });
        return true;
      },

      handle_openExpedition(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'open-expedition' });
          return true;
        }
        const site = (this.host.state?.territoryState?.territories || []).find((item) => item.id === action.territoryId);
        this.host.territoryUiState.expeditionConfigSiteId = action.territoryId || '';
        this.host.territoryUiState.expeditionSoldiers = String(Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1));
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
        this.host.territoryUiState.expeditionConfigSiteId = '';
        this.host.territoryUiState.expeditionSoldiers = '';
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
        return this.finalize(this.runAction(() => this.host.api.startConquest(action.territoryId, { soldiers: 100 })));
      },

      handle_launchExpedition(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'launch-expedition' });
          return true;
        }
        return this.finalize(this.runAction(() => this.host.api.startConquest(action.territoryId, {
          troopType: this.host.territoryUiState.expeditionTroopType || 'unavailable',
          leader: this.host.territoryUiState.expeditionLeader || 'unavailable',
          soldiers: this.host.getExpeditionSoldiers?.(),
        })));
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

      handle_enterBattleScene(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const territory = this.getTerritoryController();
        if (territory?.handleAction) {
          territory.handleAction({ territoryId: action.territoryId, action: 'enter-battle' });
          return true;
        }
        const game = this.getGameHost();
        const api = game?.getGameApi?.() || game?.api || this.host?.api;
        if (!api?.claimConquest) return false;
        const run = async () => {
          const result = await this.runAction(() => api.claimConquest(action.territoryId));
          if (result?.battleReport && typeof game?.startBattleScene === 'function') {
            game.startBattleScene(result.battleReport);
          } else if (result?.battleReport && typeof this.host?.startBattleScene === 'function') {
            this.host.startBattleScene(result.battleReport);
          }
          return true;
        };
        return this.finalize(run());
      },

      handle_closeBattleScene(action) {
        const game = this.getGameHost();
        const closed = typeof game?.closeBattleScene === 'function'
          ? game.closeBattleScene()
          : this.host?.closeBattleScene?.();
        return closed !== false;
      },

      handle_skipBattleScene(action) {
        const game = this.getGameHost();
        const skipped = typeof game?.skipBattleScene === 'function'
          ? game.skipBattleScene()
          : this.host?.skipBattleScene?.();
        return skipped !== false;
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
          title: 'Rename city',
          message: site.cityName || site.naturalName || '',
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
