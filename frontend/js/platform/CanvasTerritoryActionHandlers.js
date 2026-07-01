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

  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    try {
      if (typeof require === 'function') return require('../ecs/foundation/TileCoord');
    } catch (_error) {
      // Optional dependency in browser bundles.
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
  const FormationDeploymentEligibility = (() => {
    if (global.FormationDeploymentEligibility) return global.FormationDeploymentEligibility;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../shared/FormationDeploymentEligibilityAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const ActorPickingDiagnostics = (() => {
    if (global.ActorPickingDiagnostics) return global.ActorPickingDiagnostics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../debug/ActorPickingDiagnostics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const { closeBlockingPanelSnapshot } = global.CanvasBlockingPanelSnapshotCalls || (typeof require !== 'undefined' ? require('./CanvasBlockingPanelSnapshotCalls') : {});

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function joinNames(names = []) {
    return (Array.isArray(names) ? names : []).map((name) => String(name || '').trim()).filter(Boolean).join(', ');
  }

  function formatDeploymentBlocker(blocker = {}) {
    return t(blocker.messageKey || 'world.march.deploy.blocked', {
      name: blocker.name || blocker.participant?.name || '',
    });
  }

  function formatDeploymentWarning(warning = {}) {
    return t(warning.messageKey || 'world.march.deploy.warning', {
      name: warning.names?.[0] || warning.participants?.[0]?.name || '',
      names: joinNames(warning.names || warning.participants?.map((participant) => participant.name)),
    });
  }

  function normalizeWorldMarchTarget(action = {}) {
    const q = Math.floor(Number(action.targetQ ?? action.q));
    const r = Math.floor(Number(action.targetR ?? action.r));
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    const coord = TileCoord.normalizeCoord({ x: q, y: r });
    return {
      q: coord.q,
      r: coord.r,
      tileId: coord.tileId,
    };
  }

  function getCombatEncounterId(action = {}, previousTarget = {}) {
    return String(action.combatEncounterId
      || action.encounterId
      || action.combatTarget?.encounterId
      || previousTarget.combatEncounterId
      || previousTarget.encounterId
      || previousTarget.combatTarget?.encounterId
      || '').trim();
  }

  function getMarchMissionId(action = {}, previousTarget = {}, uiState = {}) {
    return String(action.missionId
      || previousTarget.missionId
      || uiState.selectedWorldMissionId
      || '').trim();
  }

  function getWorldActorId(action = {}, previousTarget = {}, uiState = {}) {
    return String(action.actorId
      || previousTarget.actorId
      || uiState.selectedWorldActorId
      || '').trim();
  }

  function assignMarchMissionTarget(target = {}, missionId = '', actorId = '') {
    if (!missionId) return target;
    target.missionId = missionId;
    if (actorId) target.actorId = actorId;
    return target;
  }

  function copyCombatTargetFields(nextTarget = {}, action = {}, previousTarget = {}) {
    const encounterId = getCombatEncounterId(action, previousTarget);
    if (encounterId) nextTarget.combatEncounterId = encounterId;
    const combatTarget = action.combatTarget || previousTarget.combatTarget || null;
    if (combatTarget && typeof combatTarget === 'object') nextTarget.combatTarget = clonePlain(combatTarget);
    return nextTarget;
  }

  function clonePlain(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clonePlain);
    const output = {};
    Object.entries(value).forEach(([key, next]) => {
      if (typeof next !== 'function') output[key] = clonePlain(next);
    });
    return output;
  }

  function sanitizeWorldTargetCandidate(candidate = {}, index = 0) {
    const action = clonePlain(candidate.action || {});
    if (!action?.type) return null;
    return {
      id: String(candidate.id || action.siteId || action.cityId || action.territoryId || action.actorId || action.missionId || `target-${index}`),
      index,
      kind: candidate.kind || (action.type === 'selectWorldActor' ? 'actor' : 'site'),
      label: String(candidate.label || action.actorName || action.siteName || action.cityName || action.siteId || action.actorId || this.t('common.target')),
      subtitle: String(candidate.subtitle || action.statusLabel || action.ownerLabel || ''),
      tileId: candidate.tileId || action.tileId || '',
      q: candidate.q,
      r: candidate.r,
      action,
    };
  }

  function sanitizeWorldTargetPicker(action = {}) {
    const candidates = (Array.isArray(action.candidates) ? action.candidates : [])
      .map((candidate, index) => sanitizeWorldTargetCandidate(candidate, index))
      .filter(Boolean);
    if (!candidates.length) return null;
    const q = Math.floor(Number(action.q ?? action.targetQ ?? candidates[0]?.q));
    const r = Math.floor(Number(action.r ?? action.targetR ?? candidates[0]?.r));
    const coord = Number.isFinite(q) && Number.isFinite(r)
      ? TileCoord.normalizeCoord({ q, r, tileId: action.tileId })
      : { q: undefined, r: undefined, tileId: action.tileId || candidates[0]?.tileId || '' };
    return {
      tileId: coord.tileId || action.tileId || candidates[0]?.tileId || '',
      q: coord.q,
      r: coord.r,
      anchorX: Number.isFinite(Number(action.anchorX)) ? Number(action.anchorX) : undefined,
      anchorY: Number.isFinite(Number(action.anchorY)) ? Number(action.anchorY) : undefined,
      candidates,
    };
  }

  function summarizeActorPickingAction(action = {}) {
    return {
      type: action?.type || '',
      actorId: action?.actorId || '',
      missionId: action?.missionId || '',
      tileId: action?.tileId || '',
      inputSurface: action?.inputSurface || '',
    };
  }

  function summarizeActorPickingUiState(uiState = {}) {
    return {
      selectedWorldActorId: uiState?.selectedWorldActorId || '',
      selectedWorldMissionId: uiState?.selectedWorldMissionId || '',
      selectedSiteId: uiState?.selectedSiteId || '',
      hasWorldMarchTarget: Boolean(uiState?.worldMarchTarget),
      hasWorldTargetPicker: Boolean(uiState?.worldTargetPicker),
      worldTargetPickerCandidates: Array.isArray(uiState?.worldTargetPicker?.candidates)
        ? uiState.worldTargetPicker.candidates.length
        : 0,
    };
  }

  function logActorPickingDiag(stage = '', detail = {}, options = {}) {
    return ActorPickingDiagnostics?.log?.(stage, detail, options) || null;
  }

  function openTargetPickerSnapshot(host, payload) {
    if (typeof host?.openTargetPickerSnapshot === 'function') {
      return host.openTargetPickerSnapshot(payload);
    }
    return CanvasModalSnapshotAdapter?.openTargetPickerSnapshot?.(host, payload) || null;
  }

  function closeTargetPickerSnapshot(host) {
    if (typeof host?.closeTargetPickerSnapshot === 'function') return host.closeTargetPickerSnapshot();
    return CanvasModalSnapshotAdapter?.closeTargetPickerSnapshot?.(host) || null;
  }

  function getTargetPickerSnapshot(host) {
    if (typeof host?.getTargetPickerSnapshot === 'function') return host.getTargetPickerSnapshot();
    return CanvasModalSnapshotAdapter?.getTargetPickerSnapshot?.(host) || null;
  }

  function openConfirmDialogSnapshot(host, payload = {}, callbacks = null) {
    if (typeof host?.openConfirmDialogSnapshot === 'function') {
      return host.openConfirmDialogSnapshot(payload, callbacks);
    }
    return CanvasModalSnapshotAdapter?.openConfirmDialogSnapshot?.(host, payload, callbacks) || null;
  }

  function closeConfirmDialogSnapshot(host) {
    if (typeof host?.closeConfirmDialogSnapshot === 'function') return host.closeConfirmDialogSnapshot();
    return CanvasModalSnapshotAdapter?.closeConfirmDialogSnapshot?.(host) || null;
  }

  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }

  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      openWorldSiteLocally(siteId) {
        closeTargetPickerSnapshot(this.host);
        const territory = this.getTerritoryController();
        if (territory?.openSiteDialog) {
          territory.openSiteDialog(siteId);
          return true;
        }
        const uiState = this.getSharedTerritoryUiState();
        uiState.selectedSiteId = siteId;
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

      getWorldMarchFormationForAction(action = {}) {
        const game = this.getGameHost();
        const state = this.getState();
        const cityId = action.cityId || game?.state?.activeCityId || state?.activeCityId || 'capital';
        const slot = Math.max(1, Math.floor(Number(action.formationSlot || action.slot || 1)));
        const rootFormations = state?.military?.formations || null;
        const rootCityFormations = Array.isArray(rootFormations?.[cityId]) ? rootFormations[cityId] : null;
        const cityFormations = state?.cities?.[cityId]?.military?.formations || null;
        const cityMilitaryFormations = Array.isArray(cityFormations?.[cityId]) ? cityFormations[cityId] : null;
        const rawFormations = rootCityFormations || cityMilitaryFormations;
        if (rawFormations) {
          return rawFormations.find((item) => Math.max(1, Math.floor(Number(item?.slot) || 1)) === slot)
            || rawFormations[slot - 1]
            || null;
        }
        const presenter = this.getPresenter?.() || this.host?.presenter || game?.presenter || null;
        if (presenter && typeof presenter.buildMilitaryViewState === 'function') {
          const view = presenter.buildMilitaryViewState({
            ...state,
            activeCityId: cityId,
          });
          const formation = (Array.isArray(view?.formations) ? view.formations : [])
            .find((item) => Math.max(1, Math.floor(Number(item?.slot) || 1)) === slot);
          if (formation) return formation;
        }
        return null;
      },

      getWorldMarchDeploymentEligibility(action = {}) {
        if (action.deploymentEligibility && typeof action.deploymentEligibility === 'object') {
          return action.deploymentEligibility;
        }
        const formation = this.getWorldMarchFormationForAction(action);
        if (!formation) {
          return {
            allowed: true,
            blocked: false,
            blockers: [],
            warnings: [],
          };
        }
        return FormationDeploymentEligibility?.evaluateFormationDeployment?.(formation) || {
          allowed: true,
          blocked: false,
          blockers: [],
          warnings: [],
        };
      },

      showWorldMarchDeploymentBlocked(eligibility = {}, action = {}) {
        const blocker = eligibility.blockers?.[0] || {};
        const message = formatDeploymentBlocker(blocker);
        const game = this.getGameHost();
        const uiHost = this.host?.openConfirmDialog ? this.host : game?.canvasShell || game;
        if (typeof uiHost?.openConfirmDialog === 'function') {
          uiHost.openConfirmDialog({
            kind: 'worldMarchDeploymentBlocked',
            source: 'worldMarch',
            title: t('world.march.deploy.blockedTitle'),
            message,
            confirmLabel: t('common.confirm'),
            cancelLabel: t('common.cancel'),
            confirmAction: { type: 'closeConfirmDialog' },
          });
          return true;
        }
        openConfirmDialogSnapshot(this.host, {
          visible: true,
          kind: 'worldMarchDeploymentBlocked',
          source: 'worldMarch',
          title: t('world.march.deploy.blockedTitle'),
          message,
          confirmLabel: t('common.confirm'),
          cancelLabel: t('common.cancel'),
          confirmAction: { type: 'closeConfirmDialog' },
        });
        this.refreshWorldMarchLayer(action);
        return true;
      },

      openWorldMarchDeploymentWarning(eligibility = {}, action = {}) {
        const warning = eligibility.warnings?.[0] || {};
        const message = formatDeploymentWarning(warning);
        const pendingAction = clonePlain({
          ...action,
          skipDeploymentWarnings: true,
          deploymentEligibility: undefined,
        });
        const game = this.getGameHost();
        const uiHost = this.host?.openConfirmDialog ? this.host : game?.canvasShell || game;
        if (typeof uiHost?.openConfirmDialog === 'function') {
          uiHost.openConfirmDialog({
            kind: 'worldMarchDeploymentWarning',
            source: 'worldMarch',
            title: t('world.march.deploy.confirmTitle'),
            message,
            confirmLabel: t('world.march.deploy.confirmDeploy'),
            cancelLabel: t('common.cancel'),
            confirmAction: {
              type: 'confirmWorldMarchDeployment',
              action: pendingAction,
            },
          });
          return true;
        }
        const opened = openConfirmDialogSnapshot(this.host, {
          visible: true,
          kind: 'worldMarchDeploymentWarning',
          source: 'worldMarch',
          title: t('world.march.deploy.confirmTitle'),
          message,
          confirmLabel: t('world.march.deploy.confirmDeploy'),
          cancelLabel: t('common.cancel'),
          confirmAction: {
            type: 'confirmWorldMarchDeployment',
            action: pendingAction,
          },
        });
        this.refreshWorldMarchLayer(action);
        return Boolean(opened);
      },

      handle_confirmWorldMarchDeployment(action, meta = {}) {
        const game = this.getGameHost();
        this.host?.closeConfirmDialog?.();
        closeConfirmDialogSnapshot(this.host);
        game?.canvasShell?.closeConfirmDialog?.();
        closeConfirmDialogSnapshot(game?.canvasShell);
        game?.closeConfirmDialog?.();
        closeConfirmDialogSnapshot(game);
        const pendingAction = action.action || action.pendingAction || null;
        if (!pendingAction?.type) return false;
        return this.handle_startWorldMarch({
          ...pendingAction,
          skipDeploymentWarnings: true,
        }, meta);
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
        const target = normalizeWorldMarchTarget(action);
        const tapTraceId = this.getActionTapTraceId?.(action) || global.__actorPickingDiagActiveTapTraceId || '';
        if (!target) {
          logActorPickingDiag('territory:selectWorldMarchTarget:invalidTarget', {
            tapTraceId,
            action: summarizeActorPickingAction(action),
          });
          return false;
        }
        const uiState = this.getSharedTerritoryUiState();
        const combatEncounterId = getCombatEncounterId(action);
        const missionId = combatEncounterId ? '' : getMarchMissionId(action, {}, uiState);
        const actorId = missionId ? getWorldActorId(action, {}, uiState) : '';
        const game = this.getGameHost();
        game?.territoryController?.closeSiteDialog?.({ render: false });
        logActorPickingDiag('territory:selectWorldMarchTarget:beforeWrite', {
          tapTraceId,
          action: summarizeActorPickingAction(action),
          target,
          uiState: summarizeActorPickingUiState(uiState),
        });
        const nextTarget = {
          q: target.q,
          r: target.r,
          tileId: target.tileId,
        };
        assignMarchMissionTarget(nextTarget, missionId, actorId);
        if (action.known !== undefined) nextTarget.known = Boolean(action.known);
        if (action.terrain) nextTarget.terrain = action.terrain;
        if (action.terrainLabel) nextTarget.terrainLabel = action.terrainLabel;
        if (action.marchDisabled !== undefined) nextTarget.marchDisabled = Boolean(action.marchDisabled);
        if (action.marchDisabledReason) nextTarget.marchDisabledReason = action.marchDisabledReason;
        copyCombatTargetFields(nextTarget, action);
        uiState.worldMarchTarget = nextTarget;
        uiState.selectedWorldActorId = '';
        uiState.selectedWorldMissionId = '';
        uiState.selectedSiteId = '';
        closeTargetPickerSnapshot(this.host);
        uiState.expeditionConfigSiteId = '';
        logActorPickingDiag('territory:selectWorldMarchTarget:afterWrite', {
          tapTraceId,
          action: summarizeActorPickingAction(action),
          target,
          uiState: summarizeActorPickingUiState(uiState),
        });
        const tutorialResult = game?.tutorialController?.onWorldMarchTargetSelected?.(action) || true;
        return this.finalize(Promise.resolve(tutorialResult).then((allowed) => {
          logActorPickingDiag('territory:selectWorldMarchTarget:tutorialResult', {
            tapTraceId,
            allowed: allowed !== false,
            uiState: summarizeActorPickingUiState(uiState),
          });
          if (allowed !== false) {
            this.refreshWorldMarchLayer(action);
            this.refreshWorldMarchTutorialHighlight();
          }
          return allowed !== false;
        }));
      },

      handle_openWorldMarchFormationPicker(action) {
        const target = normalizeWorldMarchTarget(action);
        if (!target) return false;
        const uiState = this.getSharedTerritoryUiState();
        const previousTarget = uiState.worldMarchTarget || {};
        const combatEncounterId = getCombatEncounterId(action, previousTarget);
        const missionId = combatEncounterId ? '' : getMarchMissionId(action, previousTarget, uiState);
        const actorId = missionId ? getWorldActorId(action, previousTarget, uiState) : '';
        const samePreviousTarget = Number(previousTarget.q) === Number(target.q)
          && Number(previousTarget.r) === Number(target.r);
        const nextTarget = {
          q: target.q,
          r: target.r,
          tileId: target.tileId,
        };
        assignMarchMissionTarget(nextTarget, missionId, actorId);
        if (action.known !== undefined) nextTarget.known = Boolean(action.known);
        else if (previousTarget.known !== undefined) nextTarget.known = Boolean(previousTarget.known);
        if (action.terrain || previousTarget.terrain) nextTarget.terrain = action.terrain || previousTarget.terrain;
        if (action.terrainLabel || previousTarget.terrainLabel) nextTarget.terrainLabel = action.terrainLabel || previousTarget.terrainLabel;
        if (action.marchDisabled !== undefined) nextTarget.marchDisabled = Boolean(action.marchDisabled);
        else if (samePreviousTarget && previousTarget.marchDisabled !== undefined) nextTarget.marchDisabled = Boolean(previousTarget.marchDisabled);
        if (action.marchDisabledReason || (samePreviousTarget && previousTarget.marchDisabledReason)) nextTarget.marchDisabledReason = action.marchDisabledReason || previousTarget.marchDisabledReason;
        copyCombatTargetFields(nextTarget, action, previousTarget);
        uiState.worldMarchTarget = nextTarget;
        openTargetPickerSnapshot(this.host, {
          pickerKind: 'worldMarchFormation',
          target: nextTarget,
        });
        uiState.selectedWorldActorId = '';
        uiState.selectedWorldMissionId = '';
        const handled = this.refreshWorldMarchLayer(action);
        this.refreshWorldMarchTutorialHighlight();
        return handled;
      },

      handle_closeWorldMarchHud(action) {
        const uiState = this.getSharedTerritoryUiState();
        closeTargetPickerSnapshot(this.host);
        uiState.worldMarchTarget = null;
        uiState.selectedWorldActorId = '';
        uiState.selectedWorldMissionId = '';
        const handled = this.refreshWorldMarchLayer(action);
        this.refreshWorldMarchTutorialHighlight();
        return handled;
      },

      handle_selectWorldActor(action) {
        const actorId = action.actorId || action.missionId || '';
        const missionId = action.missionId || '';
        const tapTraceId = this.getActionTapTraceId?.(action) || global.__actorPickingDiagActiveTapTraceId || '';
        if (!actorId) {
          logActorPickingDiag('territory:selectWorldActor:missingActorId', {
            tapTraceId,
            action: summarizeActorPickingAction(action),
          });
          return false;
        }
        const uiState = this.getSharedTerritoryUiState();
        logActorPickingDiag('territory:selectWorldActor:beforeWrite', {
          tapTraceId,
          action: summarizeActorPickingAction(action),
          actorId,
          uiState: summarizeActorPickingUiState(uiState),
        });
        uiState.selectedWorldActorId = actorId;
        uiState.selectedWorldMissionId = missionId;
        uiState.worldMarchTarget = null;
        uiState.selectedSiteId = '';
        closeTargetPickerSnapshot(this.host);
        logActorPickingDiag('territory:selectWorldActor:afterWrite', {
          tapTraceId,
          action: summarizeActorPickingAction(action),
          actorId,
          uiState: summarizeActorPickingUiState(uiState),
        });
        const handled = this.refreshWorldMarchLayer(action);
        logActorPickingDiag('territory:selectWorldActor:afterRefresh', {
          tapTraceId,
          action: summarizeActorPickingAction(action),
          actorId,
          handled: handled !== false,
          uiState: summarizeActorPickingUiState(uiState),
        });
        this.refreshWorldMarchTutorialHighlight();
        return handled;
      },

      handle_openWorldTargetPicker(action) {
        const picker = sanitizeWorldTargetPicker(action);
        if (!picker) return false;
        const game = this.getGameHost();
        game?.territoryController?.closeSiteDialog?.({ render: false });
        const uiState = this.getSharedTerritoryUiState();
        if (!openTargetPickerSnapshot(this.host, { pickerKind: 'worldTargetPicker', picker })) return false;
        // The candidate picker supersedes any pending march target (state clear
        // formerly performed by the retired bridge wrapper).
        uiState.worldMarchTarget = null;
        uiState.selectedWorldActorId = '';
        uiState.selectedWorldMissionId = '';
        uiState.selectedSiteId = '';
        uiState.expeditionConfigSiteId = '';
        return this.refreshWorldMarchLayer(action);
      },

      handle_chooseWorldTarget(action, meta = {}) {
        const picker = getTargetPickerSnapshot(this.host)?.picker || {};
        const candidates = Array.isArray(picker.candidates) ? picker.candidates : [];
        const candidate = candidates.find((item) => String(item.id) === String(action.targetId || action.id || ''))
          || candidates[Math.max(0, Math.floor(Number(action.index) || 0))]
          || null;
        const nextAction = candidate?.action || action.action || null;
        if (!nextAction?.type || nextAction.type === 'chooseWorldTarget') return false;
        closeTargetPickerSnapshot(this.host);
        if (typeof this.handle === 'function') return this.handle(nextAction, meta);
        const handler = this[`handle_${nextAction.type}`];
        return typeof handler === 'function' ? handler.call(this, nextAction, meta) : false;
      },

      handle_closeWorldTargetPicker(action) {
        closeTargetPickerSnapshot(this.host);
        return this.refreshWorldMarchLayer(action);
      },

      handle_startWorldMarch(action, meta = {}) {
        if (action?.disabled) return true;
        const target = normalizeWorldMarchTarget(action);
        if (!target) return false;
        const deploymentEligibility = this.getWorldMarchDeploymentEligibility(action);
        if (deploymentEligibility.blocked) {
          return this.showWorldMarchDeploymentBlocked(deploymentEligibility, action);
        }
        if (!action.skipDeploymentWarnings && Array.isArray(deploymentEligibility.warnings) && deploymentEligibility.warnings.length > 0) {
          return this.openWorldMarchDeploymentWarning(deploymentEligibility, action);
        }
        const uiState = this.getSharedTerritoryUiState();
        const previousTarget = uiState.worldMarchTarget || {};
        const combatEncounterId = getCombatEncounterId(action, previousTarget);
        const missionId = combatEncounterId ? '' : getMarchMissionId(action, previousTarget, uiState);
        const run = () => {
          const game = this.getGameHost();
          const options = {
            mode: 'manual',
            targetQ: target.q,
            targetR: target.r,
            formationSlot: action.formationSlot || action.slot || 1,
            cityId: action.cityId || game?.state?.activeCityId || 'capital',
          };
          if (missionId) options.missionId = missionId;
          if (combatEncounterId) options.combatEncounterId = combatEncounterId;
          if (meta.inputIntent) options.clientInputIntent = meta.inputIntent;
          // LIVE attack on an active encounter tile → open the INTERACTIVE battle
          // scene (decoupled session) instead of the passive explore-march combat.
          if (combatEncounterId && typeof game?.enterInteractiveBattle === 'function') {
            return game.enterInteractiveBattle(options);
          }
          if (typeof game?.startWorldMarch === 'function') return game.startWorldMarch(options);
          return this.runAction(() => this.host.api.startWorldMarch(options));
        };
        const result = run();
        if (result !== false) {
          closeTargetPickerSnapshot(this.host);
          uiState.worldMarchTarget = null;
          uiState.selectedWorldActorId = '';
          uiState.selectedWorldMissionId = '';
          this.refreshWorldMarchLayer(action);
          this.refreshWorldMarchTutorialHighlight();
        }
        return this.finalize(Promise.resolve(result).then((value) => value !== false));
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
        const result = run();
        if (result !== false) {
          this.getSharedTerritoryUiState().selectedWorldActorId = '';
          this.getSharedTerritoryUiState().selectedWorldMissionId = '';
          closeTargetPickerSnapshot(this.host);
          this.refreshWorldMarchLayer(action);
          this.refreshWorldMarchTutorialHighlight();
        }
        return this.finalize(Promise.resolve(result).then((value) => value !== false));
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
            this.getSharedTerritoryUiState().selectedWorldMissionId = '';
            closeTargetPickerSnapshot(this.host);
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
