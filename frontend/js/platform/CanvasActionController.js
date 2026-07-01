(function (global) {
  var TechTreeInteractionModelBase = global.TechTreeInteractionModel;
  if (typeof module !== 'undefined' && module.exports && !TechTreeInteractionModelBase) {
    TechTreeInteractionModelBase = require('./interactions/TechTreeInteractionModel');
  }
  var CanvasTerritoryActionHandlers = global.CanvasTerritoryActionHandlers;
  if (typeof module !== 'undefined' && module.exports && !CanvasTerritoryActionHandlers) {
    CanvasTerritoryActionHandlers = require('./CanvasTerritoryActionHandlers');
  }
  var CanvasBattleActionHandlers = global.CanvasBattleActionHandlers;
  if (typeof module !== 'undefined' && module.exports && !CanvasBattleActionHandlers) {
    CanvasBattleActionHandlers = require('./CanvasBattleActionHandlers');
  }
  var CanvasExpeditionActionHandlers = global.CanvasExpeditionActionHandlers;
  if (typeof module !== 'undefined' && module.exports && !CanvasExpeditionActionHandlers) {
    CanvasExpeditionActionHandlers = require('./CanvasExpeditionActionHandlers');
  }
  var CanvasWorldMarchActionHandlers = global.CanvasWorldMarchActionHandlers;
  if (typeof module !== 'undefined' && module.exports && !CanvasWorldMarchActionHandlers) {
    CanvasWorldMarchActionHandlers = require('./CanvasWorldMarchActionHandlers');
  }
  var CanvasCityActionHandlers = global.CanvasCityActionHandlers;
  if (typeof module !== 'undefined' && module.exports && !CanvasCityActionHandlers) {
    CanvasCityActionHandlers = require('./CanvasCityActionHandlers');
  }
  var CanvasFamousActionHandlers = global.CanvasFamousActionHandlers;
  if (typeof module !== 'undefined' && module.exports && !CanvasFamousActionHandlers) {
    CanvasFamousActionHandlers = require('./CanvasFamousActionHandlers');
  }
  var CanvasShellActionHandlers = global.CanvasShellActionHandlers;
  if (typeof module !== 'undefined' && module.exports && !CanvasShellActionHandlers) {
    CanvasShellActionHandlers = require('./CanvasShellActionHandlers');
  }
  var ActorPickingDiagnostics = global.ActorPickingDiagnostics;
  if (typeof module !== 'undefined' && module.exports && !ActorPickingDiagnostics) {
    ActorPickingDiagnostics = require('../debug/ActorPickingDiagnostics');
  }
  var TerritoryUiStateStore = global.TerritoryUiStateStore;
  if (typeof module !== 'undefined' && module.exports && !TerritoryUiStateStore) {
    TerritoryUiStateStore = require('../state/TerritoryUiStateStore');
  }

  // armyFormationEditor is the formation-editor object, NOT a blocking panel; the
  // panel-close sweep historically also nulled it, so it stays here as an
  // out-of-scope residual that closeBlockingPanelsSnapshot does not own.
  const NON_PANEL_CLOSEABLE = ['armyFormationEditor'];

  function closeNonPanelCloseables(target, keep) {
    if (!target || typeof target !== 'object') return;
    NON_PANEL_CLOSEABLE.forEach((key) => {
      if (!keep.has(key) && key in target) target[key] = false;
    });
  }

  function isActorPickingDiagEnabled() {
    return ActorPickingDiagnostics?.isEnabled?.() === true || global.__actorPickingDiag === true;
  }

  function summarizeActorPickingAction(action = {}) {
    return {
      type: action?.type || '',
      actorId: action?.actorId || '',
      missionId: action?.missionId || '',
      tileId: action?.tileId || '',
      inputSurface: action?.inputSurface || '',
      background: Boolean(action?.background),
    };
  }

  function summarizeActorPickingUiState(uiState = {}) {
    return {
      selectedWorldActorId: uiState?.selectedWorldActorId || '',
      selectedWorldMissionId: uiState?.selectedWorldMissionId || '',
      selectedSiteId: uiState?.selectedSiteId || '',
      hasWorldMarchTarget: Boolean(uiState?.worldMarchTarget),
      worldMarchTargetTileId: uiState?.worldMarchTarget?.tileId || '',
      worldMarchTargetPickerOpen: Boolean(uiState?.worldMarchTarget?.pickerOpen),
      hasWorldTargetPicker: Boolean(uiState?.worldTargetPicker),
      worldTargetPickerCandidates: Array.isArray(uiState?.worldTargetPicker?.candidates)
        ? uiState.worldTargetPicker.candidates.length
        : 0,
    };
  }

  function logActorPickingDiag(stage = '', detail = {}, options = {}) {
    return ActorPickingDiagnostics?.log?.(stage, detail, options) || null;
  }

  const ACTION_TAP_TRACE_IDS = typeof WeakMap === 'function' ? new WeakMap() : null;

  function rememberActionTapTraceId(action, tapTraceId = '') {
    if (!ACTION_TAP_TRACE_IDS || !tapTraceId || !action || typeof action !== 'object') return false;
    ACTION_TAP_TRACE_IDS.set(action, tapTraceId);
    return true;
  }

  function getActionTapTraceId(action = {}, meta = {}) {
    return meta?.tapTraceId
      || (action && typeof action === 'object' ? ACTION_TAP_TRACE_IDS?.get(action) : '')
      || action?.__tapTraceId
      || global.__actorPickingDiagActiveTapTraceId
      || '';
  }

  class CanvasActionController {
    constructor(options = {}) {
      this.host = options.host || null;
      this.awaitAsync = Boolean(options.awaitAsync);
      this.log = typeof options.log === 'function' ? options.log : null;
      const TechTreeInteractionModelCtor = options.techTreeInteractionModelClass || TechTreeInteractionModelBase || null;
      this.techTreeInteraction = options.techTreeInteraction || (TechTreeInteractionModelCtor ? new TechTreeInteractionModelCtor({
        host: this.host,
        getState: () => this.getState(),
      }) : null);
      if (this.techTreeInteraction && !this.techTreeInteraction.host) this.techTreeInteraction.host = this.host;
    }

    getGameHost() {
      return this.host?.getCanvasGameHost?.() || this.host?.lastGame || this.host;
    }

    getState() {
      return this.host?.getCanvasActionState?.()
        || this.getGameHost()?.state
        || this.host?.state
        || {};
    }

    getPresenter() {
      return this.host?.presenter || this.getGameHost()?.presenter || null;
    }

    getTerritoryController() {
      return this.host?.territoryController || this.getGameHost()?.territoryController || null;
    }

    getEventController() {
      return this.host?.eventController || this.getGameHost()?.eventController || null;
    }

    getBuildingController() {
      return this.host?.buildingController || this.getGameHost()?.buildingController || null;
    }

    getSharedTerritoryUiState() {
      return TerritoryUiStateStore?.ensure?.(this.host) || {};
    }

    setField(key, value, target = this.host) {
      if (target && typeof target === 'object') target[key] = value;
    }

    // Batch 8F: the 12 blocking panels are closed through the snapshot owner
    // (closeBlockingPanelsSnapshot honours the `except` keep-set for Axis-1 mutual
    // exclusion). armyFormationEditor and the event modal are NOT blocking panels --
    // they keep their own out-of-scope close paths (preserving the prior behavior
    // where this sweep also nulled armyFormationEditor and closed the event).
    closePanels(except = []) {
      const keep = new Set(except);
      this.host?.closeBlockingPanelsSnapshot?.(except);
      closeNonPanelCloseables(this.host, keep);
      if (!keep.has('activeEventId')) this.host?.closeEventSnapshot?.();
    }

    closePanelsOn(target, except = []) {
      if (!target || target === this.host || typeof target !== 'object') return;
      const keep = new Set(except);
      target.closeBlockingPanelsSnapshot?.(except);
      closeNonPanelCloseables(target, keep);
      if (!keep.has('activeEventId')) target.closeEventSnapshot?.();
    }

    closePanelsEverywhere(except = []) {
      this.closePanels(except);
      const game = this.getGameHost();
      this.closePanelsOn(game, except);
      this.closePanelsOn(game?.canvasShell, except);
      return game;
    }

    render(action = {}) {
      if (typeof this.host?.renderCanvasAction === 'function') return this.host.renderCanvasAction(action);
      if (typeof this.host?.renderGuideFrame === 'function') return this.host.renderGuideFrame();
      if (typeof this.host?.render === 'function') return this.host.render();
      return false;
    }

    renderDragFrame(action = {}) {
      if (action.phase === 'move') {
        const game = this.getGameHost();
        if (typeof this.host?.requestRenderAnimationFrame === 'function') return this.host.requestRenderAnimationFrame(action);
        if (game !== this.host && typeof game?.requestRenderAnimationFrame === 'function') return game.requestRenderAnimationFrame(action);
        if (typeof this.host?.renderAnimationFrame === 'function') return this.host.renderAnimationFrame();
        if (game !== this.host && typeof game?.renderAnimationFrame === 'function') return game.renderAnimationFrame();
      }
      return this.render(action);
    }

    afterHandled(action = {}) {
      if (action.type !== 'switchTab' && action.type !== 'goToGuideTaskTarget') this.render(action);
      return true;
    }

    getWorldMapLayerHost() {
      const game = this.getGameHost();
      if (game?.canvasShell) return game.canvasShell;
      if (this.host?.canvasShell) return this.host.canvasShell;
      if (typeof this.host?.requestWorldMapRenderAnimationFrame === 'function'
        || typeof this.host?.renderWorldMapLayerFrame === 'function') return this.host;
      if (typeof game?.requestWorldMapRenderAnimationFrame === 'function'
        || typeof game?.renderWorldMapLayerFrame === 'function') return game;
      return null;
    }

    refreshWorldMapLayer(options = {}) {
      const refreshOptions = {
        force: true,
        invalidateWorldTileView: false,
        ...options,
      };
      const game = this.getGameHost();
      const candidates = [
        this.getWorldMapLayerHost(),
        game?.canvasShell,
        this.host?.canvasShell,
        this.host,
        game,
      ].filter(Boolean);
      for (const target of candidates) {
        if (typeof target?.requestWorldMapRenderAnimationFrame === 'function') {
          return target.requestWorldMapRenderAnimationFrame(refreshOptions) !== false;
        }
        if (typeof target?.renderWorldMapLayerFrame === 'function') {
          return target.renderWorldMapLayerFrame(refreshOptions) !== false;
        }
      }
      if (typeof game?.renderRuntimeWorldMap === 'function') return game.renderRuntimeWorldMap(refreshOptions) !== false;
      return false;
    }

    refreshWorldMarchLayer(action = {}) {
      if (isActorPickingDiagEnabled()) {
        logActorPickingDiag('actionController:refreshWorldMarchLayer:before', {
          tapTraceId: this.getActionTapTraceId(action),
          action: summarizeActorPickingAction(action),
          uiState: summarizeActorPickingUiState(this.getSharedTerritoryUiState?.() || {}),
        });
      }
      const handled = this.afterHandled(action);
      const refreshResult = this.refreshWorldMapLayer();
      if (isActorPickingDiagEnabled()) {
        logActorPickingDiag('actionController:refreshWorldMarchLayer:after', {
          tapTraceId: this.getActionTapTraceId(action),
          action: summarizeActorPickingAction(action),
          handled: handled !== false,
          refreshResult: refreshResult !== false,
          uiState: summarizeActorPickingUiState(this.getSharedTerritoryUiState?.() || {}),
        });
      }
      return handled;
    }

    finalize(result) {
      if (!result || typeof result.then !== 'function') return result !== false;
      if (this.awaitAsync) return result.then((value) => value !== false);
      result.catch((error) => this.log?.(error));
      return true;
    }

    finalizeForwarded(result, afterAllowed = null) {
      if (result === undefined) return undefined;
      const normalize = (value) => {
        const allowed = value !== false;
        if (allowed && typeof afterAllowed === 'function') afterAllowed(value);
        return allowed;
      };
      if (!result || typeof result.then !== 'function') return normalize(result);
      return this.finalize(result.then(normalize));
    }

    forward(action, meta = {}) {
      if (typeof this.host?.forwardCanvasAction !== 'function') return undefined;
      return this.host.forwardCanvasAction(action, meta);
    }

    async runAction(callback) {
      if (typeof callback !== 'function') return null;
      const game = this.getGameHost();
      if (game && game !== this.host && typeof game.runAction === 'function') return game.runAction(callback);
      if (typeof this.host?.runAction === 'function') return this.host.runAction(callback);
      return callback();
    }

    getOperationLogUiState() {
      try {
        if (!this.host) return {};
        return this.getSharedTerritoryUiState?.() || {};
      } catch (_) {
        return {};
      }
    }

    rememberActionTapTraceId(action, tapTraceId = '') {
      return rememberActionTapTraceId(action, tapTraceId);
    }

    getActionTapTraceId(action = {}, meta = {}) {
      return getActionTapTraceId(action, meta);
    }

    resolveActionHandler(action = {}) {
      switch (action.type) {
        case 'switchTab': return this.handle_switchTab;
        case 'openResourceDetails': return this.handle_openResourceDetails;
        case 'closeResourceDetails': return this.handle_closeResourceDetails;
        case 'openCommandPanel': return this.handle_openCommandPanel;
        case 'closeCommandPanel': return this.handle_closeCommandPanel;
        case 'closeRewardReveal': return this.handle_closeRewardReveal;
        case 'openCitySwitcher': return this.handle_openCitySwitcher;
        case 'closeCitySwitcher': return this.handle_closeCitySwitcher;
        case 'openSubcityList': return this.handle_openSubcityList;
        case 'closeSubcityList': return this.handle_closeSubcityList;
        case 'openArmyFormation': return this.handle_openArmyFormation;
        case 'closeArmyFormationEditor': return this.handle_closeArmyFormationEditor;
        case 'toggleArmyFormationMember': return this.handle_toggleArmyFormationMember;
        case 'changeArmyFormationPage': return this.handle_changeArmyFormationPage;
        case 'changeArmyFormationSoldiers': return this.handle_changeArmyFormationSoldiers;
        case 'requestArmyFormationSoldierInput': return this.handle_requestArmyFormationSoldierInput;
        case 'autoReplenishArmyFormation': return this.handle_autoReplenishArmyFormation;
        case 'saveArmyFormation': return this.handle_saveArmyFormation;
        case 'openSettings': return this.handle_openSettings;
        case 'closeSettings': return this.handle_closeSettings;
        case 'requestResetGame': return this.handle_requestResetGame;
        case 'downloadClientOperationLog': return this.handle_downloadClientOperationLog;
        case 'closeConfirmDialog': return this.handle_closeConfirmDialog;
        case 'confirmResetGame': return this.handle_confirmResetGame;
        case 'confirmWorldMarchDeployment': return this.handle_confirmWorldMarchDeployment;
        case 'openLogs': return this.handle_openLogs;
        case 'closeLogs': return this.handle_closeLogs;
        case 'clearLogs': return this.handle_clearLogs;
        case 'openAdvisor': return this.handle_openAdvisor;
        case 'closeAdvisor': return this.handle_closeAdvisor;
        case 'goToAdvisorTarget': return this.handle_goToAdvisorTarget;
        case 'goToGuideTaskTarget': return this.handle_goToGuideTaskTarget;
        case 'openGuidebook': return this.handle_openGuidebook;
        case 'closeGuidebook': return this.handle_closeGuidebook;
        case 'switchGuidebookTab': return this.handle_switchGuidebookTab;
        case 'requestLoginUsername': return this.handle_requestLoginUsername;
        case 'requestLoginPassword': return this.handle_requestLoginPassword;
        case 'toggleRememberPassword': return this.handle_toggleRememberPassword;
        case 'submitLogin': return this.handle_submitLogin;
        case 'resetGame': return this.handle_resetGame;
        case 'logout': return this.handle_logout;
        case 'requestNamingInput': return this.handle_requestNamingInput;
        case 'closeNaming': return this.handle_closeNaming;
        case 'submitNaming': return this.handle_submitNaming;
        case 'blockCanvasModal': return this.handle_blockCanvasModal;
        case 'openCityManagement': return this.handle_openCityManagement;
        case 'closeCityManagement': return this.handle_closeCityManagement;
        case 'switchCityManagementTab': return this.handle_switchCityManagementTab;
        case 'openEvent': return this.handle_openEvent;
        case 'closeEvent': return this.handle_closeEvent;
        case 'openTaskCenter': return this.handle_openTaskCenter;
        case 'closeTaskCenter': return this.handle_closeTaskCenter;
        case 'switchTaskCenterTab': return this.handle_switchTaskCenterTab;
        case 'selectCity': return this.handle_selectCity;
        case 'jumpToSubcity': return this.handle_jumpToSubcity;
        case 'enterCity': return this.handle_enterCity;
        case 'assignJob': return this.handle_assignJob;
        case 'buildBuilding': return this.handle_buildBuilding;
        case 'upgradeBuilding': return this.handle_upgradeBuilding;
        case 'advanceEra': return this.handle_advanceEra;
        case 'research': return this.handle_research;
        case 'selectTechNode': return this.handle_selectTechNode;
        case 'closeTechDetail': return this.handle_closeTechDetail;
        case 'claimEvent': return this.handle_claimEvent;
        case 'claimGuideTaskReward': return this.handle_claimGuideTaskReward;
        case 'claimTaskReward': return this.handle_claimTaskReward;
        case 'scrollBuildings': return this.handle_scrollBuildings;
        case 'selectBuildingCategory': return this.handle_selectBuildingCategory;
        case 'openFamousPersons': return this.handle_openFamousPersons;
        case 'closeFamousPersons': return this.handle_closeFamousPersons;
        case 'openFamousPersonDetail': return this.handle_openFamousPersonDetail;
        case 'closeFamousPersonDetail': return this.handle_closeFamousPersonDetail;
        case 'seekFamousPerson': return this.handle_seekFamousPerson;
        case 'acceptFamousPerson': return this.handle_acceptFamousPerson;
        case 'dismissFamousPersonCandidate': return this.handle_dismissFamousPersonCandidate;
        case 'assignFamousAttributePoint': return this.handle_assignFamousAttributePoint;
        case 'changeFamousPersonsPage': return this.handle_changeFamousPersonsPage;
        case 'scoutTerritory': return this.handle_scoutTerritory;
        case 'claimScout': return this.handle_claimScout;
        case 'selectWorldMarchTarget': return this.handle_selectWorldMarchTarget;
        case 'openWorldMarchFormationPicker': return this.handle_openWorldMarchFormationPicker;
        case 'closeWorldMarchHud': return this.handle_closeWorldMarchHud;
        case 'selectWorldActor': return this.handle_selectWorldActor;
        case 'openWorldTargetPicker': return this.handle_openWorldTargetPicker;
        case 'chooseWorldTarget': return this.handle_chooseWorldTarget;
        case 'closeWorldTargetPicker': return this.handle_closeWorldTargetPicker;
        case 'startWorldMarch': return this.handle_startWorldMarch;
        case 'returnWorldMarch': return this.handle_returnWorldMarch;
        case 'stopWorldMarch': return this.handle_stopWorldMarch;
        case 'switchMilitaryView': return this.handle_switchMilitaryView;
        case 'openWorldSite': return this.handle_openWorldSite;
        case 'closeWorldSite': return this.handle_closeWorldSite;
        case 'resetWorldPan': return this.handle_resetWorldPan;
        case 'worldMapDrag': return this.handle_worldMapDrag;
        case 'changeExpeditionSoldiers': return this.handle_changeExpeditionSoldiers;
        case 'changeExpeditionLeader': return this.handle_changeExpeditionLeader;
        case 'territoryAction': return this.handle_territoryAction;
        case 'openExpedition': return this.handle_openExpedition;
        case 'closeExpedition': return this.handle_closeExpedition;
        case 'conquer': return this.handle_conquer;
        case 'launchExpedition': return this.handle_launchExpedition;
        case 'claimConquest': return this.handle_claimConquest;
        case 'enterBattleScene': return this.handle_enterBattleScene;
        case 'closeBattleScene': return this.handle_closeBattleScene;
        case 'skipBattleScene': return this.handle_skipBattleScene;
        case 'entityBattleSelectGeneral': return this.handle_entityBattleSelectGeneral;
        case 'entityBattleOrder': return this.handle_entityBattleOrder;
        case 'entityBattleMaster': return this.handle_entityBattleMaster;
        case 'entityBattleSkill': return this.handle_entityBattleSkill;
        case 'entityBattleAuto': return this.handle_entityBattleAuto;
        case 'entityBattleDone': return this.handle_entityBattleDone;
        case 'entityBattleClose': return this.handle_entityBattleClose;
        case 'entityBattleZoom': return this.handle_entityBattleZoom;
        case 'entityBattleDrag': return this.handle_entityBattleDrag;
        case 'manageCity': return this.handle_manageCity;
        case 'renameCity': return this.handle_renameCity;
        case 'techTreeDrag': return this.handle_techTreeDrag;
        case 'techTreeZoom': return this.handle_techTreeZoom;
        default: return this.handleUnknown;
      }
    }

    handle(action, meta = {}) {
      if (!action || action.disabled) {
        global.ClientOperationLog?.record?.('action:skipped', {
          action: global.ClientOperationLog?.summarizeAction?.(action),
          reason: action?.disabled ? 'disabled' : 'missing',
        }, { flush: true });
        return Boolean(action?.disabled);
      }
      const handler = this.resolveActionHandler(action);
      const tapTraceId = this.getActionTapTraceId(action, meta);
      this.rememberActionTapTraceId(action, tapTraceId);
      if (isActorPickingDiagEnabled()) {
        logActorPickingDiag('actionController:handle:before', {
          tapTraceId,
          action: summarizeActorPickingAction(action),
          uiState: summarizeActorPickingUiState(this.getOperationLogUiState()),
        });
      }
      global.ClientOperationLog?.record?.('action:begin', {
        action: global.ClientOperationLog?.summarizeAction?.(action),
        inputIntent: global.ClientOperationLog?.summarizeInputIntent?.(meta.inputIntent),
        uiState: global.ClientOperationLog?.summarizeUiState?.(this.getOperationLogUiState()),
      });
      try {
        const result = handler.call(this, action, meta);
        if (result && typeof result.then === 'function') {
          result.then((value) => {
            global.ClientOperationLog?.record?.('action:end', {
              action: global.ClientOperationLog?.summarizeAction?.(action),
              inputIntent: global.ClientOperationLog?.summarizeInputIntent?.(meta.inputIntent),
              result: value !== false,
              async: true,
              uiState: global.ClientOperationLog?.summarizeUiState?.(this.getOperationLogUiState()),
            }, { flush: true });
          }).catch((error) => {
            global.ClientOperationLog?.record?.('action:error', {
              action: global.ClientOperationLog?.summarizeAction?.(action),
              inputIntent: global.ClientOperationLog?.summarizeInputIntent?.(meta.inputIntent),
              message: error?.message || String(error || ''),
            }, { flush: true });
          });
        } else {
          if (isActorPickingDiagEnabled()) {
            logActorPickingDiag('actionController:handle:after', {
              tapTraceId,
              action: summarizeActorPickingAction(action),
              result: result !== false,
              async: false,
              uiState: summarizeActorPickingUiState(this.getOperationLogUiState()),
            });
          }
          global.ClientOperationLog?.record?.('action:end', {
            action: global.ClientOperationLog?.summarizeAction?.(action),
            inputIntent: global.ClientOperationLog?.summarizeInputIntent?.(meta.inputIntent),
            result: result !== false,
            async: false,
            uiState: global.ClientOperationLog?.summarizeUiState?.(this.getOperationLogUiState()),
          }, { flush: true });
        }
        return result;
      } catch (error) {
        global.ClientOperationLog?.record?.('action:error', {
          action: global.ClientOperationLog?.summarizeAction?.(action),
          inputIntent: global.ClientOperationLog?.summarizeInputIntent?.(meta.inputIntent),
          message: error?.message || String(error || ''),
        }, { flush: true });
        throw error;
      }
    }

    handleUnknown(action, meta = {}) {
      const forwarded = this.forward(action, meta);
      return this.finalizeForwarded(forwarded) ?? false;
    }

    canUseLocalRuntime() {
      return Boolean(this.host?.api);
    }

    handle_techTreeDrag(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
      if (!this.techTreeInteraction?.handleDrag?.(action)) return false;
      this.render(action);
      return true;
    }

    handle_techTreeZoom(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
      if (!this.techTreeInteraction?.handleZoom?.(action)) return false;
      this.render(action);
      return true;
    }

  }

  CanvasTerritoryActionHandlers?.install?.(CanvasActionController);
  CanvasBattleActionHandlers?.install?.(CanvasActionController);
  CanvasExpeditionActionHandlers?.install?.(CanvasActionController);
  CanvasWorldMarchActionHandlers?.install?.(CanvasActionController);
  CanvasCityActionHandlers?.install?.(CanvasActionController);
  CanvasFamousActionHandlers?.install?.(CanvasActionController);
  CanvasShellActionHandlers?.install?.(CanvasActionController);

  global.CanvasActionController = CanvasActionController;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionController;
})(typeof globalThis !== 'undefined' ? globalThis : window);
