(function (global) {
  const ClientCommandSemantics = (() => {
    if (global.ClientCommandSemantics) return global.ClientCommandSemantics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./ClientCommandSemantics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  var TechTreeInteractionModelBase = global.TechTreeInteractionModel;
  if (typeof module !== 'undefined' && module.exports && !TechTreeInteractionModelBase) {
    TechTreeInteractionModelBase = require('./interactions/TechTreeInteractionModel');
  }
  var WorldMarchActionHandlerCtor = global.WorldMarchActionHandler;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchActionHandlerCtor) {
    WorldMarchActionHandlerCtor = require('./WorldMarchActionHandler');
  }
  var TargetPickerActionHandlerCtor = global.TargetPickerActionHandler;
  if (typeof module !== 'undefined' && module.exports && !TargetPickerActionHandlerCtor) {
    TargetPickerActionHandlerCtor = require('./TargetPickerActionHandler');
  }
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
      // Optional adapter in standalone action tests.
    }
    return null;
  })();
  const CanvasModeOwnershipRuntime = (() => {
    if (global.CanvasModeOwnershipRuntime) return global.CanvasModeOwnershipRuntime;
    try {
      if (typeof require === 'function') return require('./CanvasModeOwnershipRuntime');
    } catch (_error) {
      // Optional runtime in standalone action tests.
    }
    return null;
  })();
  var ActorPickingDiagnostics = global.ActorPickingDiagnostics;
  if (typeof module !== 'undefined' && module.exports && !ActorPickingDiagnostics) {
    ActorPickingDiagnostics = require('../debug/ActorPickingDiagnostics');
  }
  var TerritoryUiStateStore = global.TerritoryUiStateStore;
  if (typeof module !== 'undefined' && module.exports && !TerritoryUiStateStore) {
    TerritoryUiStateStore = require('../state/TerritoryUiStateStore');
  }
  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }
  var ChangeEventBus = global.ChangeEventBus;
  if (typeof module !== 'undefined' && module.exports && !ChangeEventBus) {
    ChangeEventBus = require('../state/ChangeEventBus');
  }

  function getCanvasPanelSurfaceManagerCtor() {
    if (global.CanvasPanelSurfaceManager) return global.CanvasPanelSurfaceManager;
    try {
      if (typeof require === 'function') return require('./CanvasPanelSurfaceManager');
    } catch (_error) {
      // Optional in standalone action tests.
    }
    return null;
  }

  function getCanvasPanelActionRunnerCtor() {
    if (global.CanvasPanelActionRunner) return global.CanvasPanelActionRunner;
    try {
      if (typeof require === 'function') return require('./CanvasPanelActionRunner');
    } catch (_error) {
      // Optional until the panel-action runner slice is loaded.
    }
    return null;
  }

  function getPanelActionContextAdapter() {
    if (global.CanvasPanelActionContextAdapter) return global.CanvasPanelActionContextAdapter;
    try {
      if (typeof require === 'function') return require('./CanvasPanelActionContextAdapter');
    } catch (_error) {
      // Optional until the panel-action context slice is loaded.
    }
    return null;
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

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
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

  function closeTargetPickerSnapshot(host) {
    if (typeof host?.closeTargetPickerSnapshot === 'function') return host.closeTargetPickerSnapshot();
    return CanvasModalSnapshotAdapter?.closeTargetPickerSnapshot?.(host) || null;
  }

  function getCommandPanelValue(host) {
    if (typeof host?.getCommandPanelValue === 'function') return host.getCommandPanelValue();
    return CanvasModalSnapshotAdapter?.getCommandPanelValue?.(host) || '';
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
      this.changeEventBus = options.changeEventBus || ChangeEventBus || null;
      const PanelActionRunnerCtor = options.panelActionRunnerClass || getCanvasPanelActionRunnerCtor();
      this.panelActionRunner = options.panelActionRunner || (PanelActionRunnerCtor ? new PanelActionRunnerCtor() : null);
      const TechTreeInteractionModelCtor = options.techTreeInteractionModelClass || TechTreeInteractionModelBase || null;
      this.techTreeInteraction = options.techTreeInteraction || (TechTreeInteractionModelCtor ? new TechTreeInteractionModelCtor({
        host: this.host,
        getState: () => this.getState(),
      }) : null);
      if (this.techTreeInteraction && !this.techTreeInteraction.host) this.techTreeInteraction.host = this.host;
      // Slice 11: world-march + target-picker handlers live in composed plain
      // classes; the controller-module helpers below are shared with code that
      // stays here (refreshWorldMarchLayer, handle, worldMapDrag, openWorldSite).
      this.worldMarchActions = new WorldMarchActionHandlerCtor({
        core: this,
        helpers: {
          logActorPickingDiag,
          summarizeActorPickingAction,
          summarizeActorPickingUiState,
          closeTargetPickerSnapshot,
        },
      });
      this.targetPickerActions = new TargetPickerActionHandlerCtor({
        core: this,
        helpers: { closeTargetPickerSnapshot },
      });
    }

    getGameHost() {
      return this.host?.getCanvasGameHost?.() || this.host?.lastGame || this.host;
    }

    emitGameEvent(eventName, payload = {}) {
      return this.changeEventBus?.emit?.(eventName, payload) || null;
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

    getPanelSurfaceManager() {
      const game = this.getGameHost();
      const manager = this.host?.getPanelSurfaceManager?.()
        || this.host?.panelSurfaceManager
        || game?.getPanelSurfaceManager?.()
        || game?.panelSurfaceManager
        || null;
      if (manager) return manager;
      const ManagerCtor = getCanvasPanelSurfaceManagerCtor();
      if (!ManagerCtor || !this.host || typeof this.host !== 'object') return null;
      this.host.panelSurfaceManager = new ManagerCtor({ host: this.host });
      return this.host.panelSurfaceManager;
    }

    getPanelActionContext() {
      const buildPanelActionContext = getPanelActionContextAdapter();
      return buildPanelActionContext ? buildPanelActionContext(this.host) : null;
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
      if (action.type !== 'switchTab') this.render(action);
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
        case 'advanceEra': return this.handle_advanceEra;
        case 'research': return this.handle_research;
        case 'selectTechNode': return this.handle_selectTechNode;
        case 'closeTechDetail': return this.handle_closeTechDetail;
        case 'claimEvent': return this.handle_claimEvent;
        case 'resolveCapture': return this.handle_resolveCapture;
        case 'claimTaskReward': return this.handle_claimTaskReward;
        case 'scrollBuildings': return this.handle_scrollBuildings;
        case 'selectBuildingCategory': return this.handle_selectBuildingCategory;
        case 'seekFamousPerson': return this.handle_seekFamousPerson;
        case 'acceptFamousPerson': return this.handle_acceptFamousPerson;
        case 'dismissFamousPersonCandidate': return this.handle_dismissFamousPersonCandidate;
        case 'assignFamousAttributePoint': return this.handle_assignFamousAttributePoint;
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
        case 'veteranCampWithdraw': return this.handle_veteranCampWithdraw;
        case 'veteranCampUpgrade': return this.handle_veteranCampUpgrade;
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
      const normalizedAction = ClientCommandSemantics?.normalizeAction?.(action) || action;
      if (!normalizedAction || normalizedAction.disabled) {
        global.ClientOperationLog?.record?.('action:skipped', {
          action: global.ClientOperationLog?.summarizeAction?.(normalizedAction),
          reason: normalizedAction?.disabled ? 'disabled' : 'missing',
        }, { flush: true });
        return Boolean(normalizedAction?.disabled);
      }
      action = normalizedAction;
      const commandBlockReason = ClientCommandSemantics?.getCommandBlockReason?.(action) || '';
      if (commandBlockReason) {
        global.ClientOperationLog?.record?.('command:localBlock', {
          commandType: action.type || '',
          commandKey: ClientCommandSemantics?.getCommandKey?.(action) || action.type || '',
          reason: commandBlockReason,
        }, { flush: true });
        return true;
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

    // World map and territory actions.
    getWorldTileForSite(siteId) {
            const worldMap = this.getState()?.territoryState?.worldMap || {};
            const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
            return tiles.find((tile) => tile?.siteId === siteId) || null;
          }

    getTerritorySite(siteId) {
            const territories = this.getState()?.territoryState?.territories || [];
            return territories.find((site) => site?.id === siteId) || null;
          }

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
          }

    centerWorldMapOnCapital(options = {}) {
            const state = this.getState();
            const activeCityId = state?.cityState?.capitalCityId || 'capital';
            const siteId = options.siteId || activeCityId || 'capital';
            return this.centerWorldMapOnSite(siteId, options);
          }

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
          }

    handle_switchMilitaryView(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            if (typeof game?.switchMilitaryView === 'function') {
              const switched = game.switchMilitaryView(action.view) !== false;
              if (switched) {
                CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
                this.emitGameEvent('militaryViewSwitched', {
                  view: action.view || 'army',
                });
                this.afterHandled(action);
              }
              return switched;
            }
            const view = action.view || 'army';
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
            CanvasModeOwnershipRuntime?.setMilitaryView?.(this.host, view);
            this.emitGameEvent('militaryViewSwitched', { view });
            return this.afterHandled(action);
          }

    handle_veteranCampWithdraw(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            const api = game?.getGameApi?.() || game?.api || this.host?.api;
            if (typeof api?.veteranCampWithdraw !== 'function') return false;
            // soldiers omitted -> the backend withdraws all parked soldiers (the button's intent).
            return this.finalize(this.runAction(() => api.veteranCampWithdraw(action.cityId, action.soldiers)));
          }

    handle_veteranCampUpgrade(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            const api = game?.getGameApi?.() || game?.api || this.host?.api;
            if (typeof api?.veteranCampUpgrade !== 'function') return false;
            return this.finalize(this.runAction(() => api.veteranCampUpgrade(action.cityId)));
          }

    handle_openWorldSite(action) {
            const forwarded = this.forward(action);
            const siteId = action.siteId || action.territoryId || action.cityId || '';
            if (forwarded !== undefined) {
              return this.finalizeForwarded(forwarded, () => {
                this.openWorldSiteLocally(siteId);
              });
            }
            closeTargetPickerSnapshot(this.host);
            const territory = this.getTerritoryController();
            if (territory?.openSiteDialog) {
              territory.openSiteDialog(siteId);
              return true;
            }
            const uiState = this.getSharedTerritoryUiState();
            uiState.selectedSiteId = siteId;
            return this.afterHandled(action);
          }

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
          }

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
          }

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
          }

    handle_territoryAction(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const territory = this.getTerritoryController();
            if (!territory?.handleAction) return false;
            territory.handleAction({ territoryId: action.territoryId, action: action.action });
            return true;
          }

    handle_manageCity(action) {
            return this.handle_enterCity({
              ...action,
              type: 'enterCity',
              cityId: action.cityId || action.territoryId,
              tab: action.tab || 'buildings',
            });
          }

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
          }

    // World march and scout actions.
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
          }

    getWorldMarchFormationForAction(action = {}) {
            const game = this.getGameHost();
            const state = this.getState();
            const cityId =
              action.cityId || game?.state?.activeCityId || state?.activeCityId || 'capital';
            const slot = Math.max(1, Math.floor(Number(action.formationSlot || action.slot || 1)));
            // Owned shape: formations is a plain 3-slot array on the (city-scoped)
            // military; the keyed arms only read legacy double-keyed payloads.
            const pickFormationsArray = (formations) => {
              if (Array.isArray(formations)) return formations;
              if (formations && Array.isArray(formations[cityId])) return formations[cityId];
              return null;
            };
            const rawFormations =
              pickFormationsArray(state?.military?.formations) ||
              pickFormationsArray(state?.cities?.[cityId]?.military?.formations);
            if (rawFormations) {
              return (
                rawFormations.find(
                  (item) => Math.max(1, Math.floor(Number(item?.slot) || 1)) === slot,
                ) ||
                rawFormations[slot - 1] ||
                null
              );
            }
            const presenter = this.getPresenter?.() || this.host?.presenter || game?.presenter || null;
            if (presenter && typeof presenter.buildMilitaryViewState === 'function') {
              const view = presenter.buildMilitaryViewState({
                ...state,
                activeCityId: cityId,
              });
              const formation = (Array.isArray(view?.formations) ? view.formations : []).find(
                (item) => Math.max(1, Math.floor(Number(item?.slot) || 1)) === slot,
              );
              if (formation) return formation;
            }
            return null;
          }

    handle_confirmWorldMarchDeployment(action, meta = {}) {
            return this.worldMarchActions.confirmDeployment(action, meta);
          }

    handle_selectWorldMarchTarget(action) {
            return this.worldMarchActions.selectTarget(action);
          }

    handle_openWorldMarchFormationPicker(action) {
            return this.worldMarchActions.openFormationPicker(action);
          }

    handle_closeWorldMarchHud(action) {
            return this.worldMarchActions.closeHud(action);
          }

    handle_selectWorldActor(action) {
            return this.worldMarchActions.selectActor(action);
          }

    handle_openWorldTargetPicker(action) {
            return this.targetPickerActions.openWorldTargetPicker(action);
          }

    handle_chooseWorldTarget(action, meta = {}) {
            return this.targetPickerActions.chooseWorldTarget(action, meta);
          }

    handle_closeWorldTargetPicker(action) {
            return this.targetPickerActions.closeWorldTargetPicker(action);
          }

    handle_startWorldMarch(action, meta = {}) {
            return this.worldMarchActions.startMarch(action, meta);
          }

    handle_returnWorldMarch(action, meta = {}) {
            return this.worldMarchActions.returnMarch(action, meta);
          }

    handle_stopWorldMarch(action, meta = {}) {
            return this.worldMarchActions.stopMarch(action, meta);
          }

    // City, building, event, task, and technology actions.
    handle_openCityManagement(action) {
            const tab = action.tab || 'buildings';
            const game = this.getGameHost();
            const owner = game || this.host;
            owner.activeCityManagementTab = tab;
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showCityManagement', true);
            this.closePanels(['showCityManagement']);
            const handled = this.afterHandled(action);
            this.emitGameEvent('cityManagementOpened', { tab });
            return handled;
          }

    handle_closeCityManagement(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showCityManagement');
            return this.afterHandled(action);
          }

    handle_switchCityManagementTab(action) {
            const allowed = ['buildings', 'people', 'military'];
            const tab = allowed.includes(action.tab) ? action.tab : 'buildings';
            const game = this.getGameHost();
            const owner = game || this.host;
            owner.activeCityManagementTab = tab;
            const handled = this.afterHandled(action);
            this.emitGameEvent('cityManagementOpened', { tab });
            return handled;
          }

    handle_openEvent(action) {
            const game = this.getGameHost();
            const eventData = (game?.state?.eventQueue || this.getState().eventQueue || [])
              .find((item) => item.id === action.eventId);
            if (!eventData) return false;
            this.closePanels(['activeEventId']);
            const eventId = this.host.openEventSnapshot?.(action.eventId) || action.eventId;
            const controller = this.getEventController();
            controller?.open?.(eventId);
            this.emitGameEvent('eventOpened', { eventId });
            return this.afterHandled(action);
          }

    handle_closeEvent(action) {
            this.host.closeEventSnapshot?.();
            const controller = this.getEventController();
            controller?.close?.();
            this.emitGameEvent('eventClosed', { eventId: action.eventId || '' });
            return this.afterHandled(action);
          }

    handle_openTaskCenter(action) {
            const tab = action.tab
              || (this.host?.hasClaimableMainTask?.() ? 'main' : this.host.activeTaskCenterTab)
              || 'main';
            const game = this.closePanelsEverywhere(['showTaskCenter']);
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showTaskCenter', true);
            this.host.activeTaskCenterTab = tab;
            if (game && game !== this.host) {
              game.activeTaskCenterTab = tab;
            }
            if (game?.canvasShell && game.canvasShell !== this.host) {
              game.canvasShell.activeTaskCenterTab = tab;
            }
            return this.afterHandled(action);
          }

    handle_closeTaskCenter(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showTaskCenter');
            return this.afterHandled(action);
          }

    handle_switchTaskCenterTab(action) {
            const tab = action.tab || 'main';
            this.host.activeTaskCenterTab = tab;
            const game = this.getGameHost();
            if (game && game !== this.host) game.activeTaskCenterTab = tab;
            return this.afterHandled(action);
          }

    handle_selectCity(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showCitySwitcher');
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showSubcityList');
            this.host.closeEventSnapshot?.();
            const forwarded = this.forward(action);
            if (forwarded !== undefined) {
              return this.finalizeForwarded(forwarded, () => this.afterHandled(action));
            }
            return this.finalize(this.selectCity(action));
          }

    async selectCity(action) {
            const game = this.getGameHost();
            if (typeof game?.switchCity === 'function') {
              return await game.switchCity(action.cityId);
            }
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showCitySwitcher');
            this.host.closeEventSnapshot?.();
            await this.runAction(() => this.host.api.switchCity(action.cityId));
            return true;
          }

    handle_jumpToSubcity(action) {
            const cityId = action.cityId || action.siteId || '';
            if (!cityId) return false;
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showSubcityList');
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
            this.host.closeEventSnapshot?.();
            this.openWorldSiteLocally(cityId);
            this.centerWorldMapOnSite(cityId);
            const selectAction = { ...action, type: 'selectCity', cityId };
            const forwarded = this.forward(selectAction);
            if (forwarded !== undefined) {
              return this.finalizeForwarded(forwarded, () => this.afterHandled(action));
            }
            return this.finalize(Promise.resolve(this.selectCity(selectAction)).then((allowed) => {
              if (allowed !== false) this.afterHandled(action);
              return allowed !== false;
            }));
          }

    handle_enterCity(action) {
            return this.performEnterCity(action);
          }

    performEnterCity(action) {
            const cityId = action.cityId || action.territoryId || action.siteId || '';
            if (!cityId) return false;
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showSubcityList');
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
            this.host.closeEventSnapshot?.();
            const game = this.getGameHost();
            const result = typeof game?.enterCity === 'function'
              ? game.enterCity(cityId, { tab: action.tab || 'buildings' })
              : Promise.resolve(this.selectCity({ ...action, cityId })).then((allowed) => {
                if (allowed === false) return false;
                (game || this.host).activeCityManagementTab = action.tab || 'buildings';
                CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showCityManagement', true);
                return true;
              });
            return this.finalize(Promise.resolve(result).then((allowed) => {
              if (allowed !== false) {
                (game || this.host).activeCityManagementTab = action.tab || 'buildings';
                CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showCityManagement', true);
                this.afterHandled(action);
                const tab = action.tab || 'buildings';
                this.emitGameEvent('cityManagementOpened', { tab });
              }
              return allowed !== false;
            }));
          }

    handle_assignJob(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            if (typeof game?.assignJob === 'function') {
              return this.finalize(Promise.resolve(game.assignJob(action.job, action.delta)).then((result) => {
                if (result !== false && result?.success !== false) {
                  this.emitGameEvent('populationAssigned', { job: action.job, delta: action.delta, result: result || {} });
                }
                return result;
              }));
            }
            return this.finalize(this.runAction(() => this.host.api.assignJob(action.job, action.delta)).then((result) => {
              if (result !== false && result?.success !== false) {
                this.emitGameEvent('populationAssigned', { job: action.job, delta: action.delta, result: result || {} });
              }
              return result;
            }));
          }

    handle_advanceEra(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            if (typeof game?.advanceEra === 'function') {
              return this.finalize(game.advanceEra());
            }
            return this.finalize(this.runAction(() => this.host.api.advanceEra()));
          }

    handle_research(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            if (typeof game?.research === 'function') {
              return this.finalize(game.research(action.techId));
            }
            return this.finalize(this.runAction(() => this.host.api.research(action.techId)));
          }

    handle_selectTechNode(action) {
            const techId = action.techId || '';
            if (typeof this.host?.selectTechNode === 'function') {
              this.host.selectTechNode(action);
            } else if (this.host) {
              const game = this.getGameHost();
              if (game?.state && typeof game.state === 'object') {
                StateWriter.commit(game, (prev) => ({
                  ...prev,
                  techUiState: {
                    ...(prev.techUiState || {}),
                    selectedTechId: techId,
                    detailOpen: Boolean(techId),
                  },
                }), { source: 'cityHandlers:selectTechNode' });
              }
            }
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'techDetailOpen', Boolean(techId));
            return this.afterHandled(action);
          }

    handle_closeTechDetail(action) {
            if (typeof this.host?.closeTechDetail === 'function') {
              this.host.closeTechDetail(action);
            } else if (this.host) {
              const game = this.getGameHost();
              if (game?.state && typeof game.state === 'object') {
                StateWriter.commit(game, (prev) => ({
                  ...prev,
                  techUiState: {
                    ...(prev.techUiState || {}),
                    detailOpen: false,
                  },
                }), { source: 'cityHandlers:closeTechDetail' });
              }
            }
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'techDetailOpen');
            return this.afterHandled(action);
          }

    handle_claimEvent(action) {
            return this.finalize(this.claimEvent(action).then((handled) => {
              if (handled === false) return false;
              this.emitGameEvent('eventClaimed', {
                eventId: action.eventId || '',
                optionId: action.optionId || '',
              });
              return this.afterHandled(action);
            }));
          }

    getCaptureController() {
            return this.host?.captureController || this.getGameHost()?.captureController || null;
          }

    handle_resolveCapture(action) {
            return this.finalize(this.resolveCapture(action));
          }

    async resolveCapture(action) {
            // ②b: player picked 斩杀/招降/放生 for a captured general. Prefer the CaptureController
            // (owns the localized outcome floating text); fall back to a direct API call. State is
            // applied through the shared afterEventClaimed commit path (generic gameState merge).
            const controller = this.getCaptureController();
            if (controller?.resolve) {
              const result = await controller.resolve(action.decisionId, action.choice);
              return this.afterEventClaimed(result);
            }
            const api = this.host.api || this.getGameHost()?.getGameApi?.() || this.getGameHost()?.api;
            if (!api?.resolveCapture) return false;
            const result = await this.runAction(() => api.resolveCapture(action.decisionId, action.choice));
            return this.afterEventClaimed(result);
          }

    async claimEvent(action) {
            const controller = this.getEventController();
            this.host.closeEventSnapshot?.();
            controller?.close?.();
            const forwarded = this.forward(action);
            if (forwarded !== undefined) {
              const allowed = await forwarded;
              if (allowed === false) return false;
              return true;
            }
            if (controller?.claim || controller?.claimActive) {
              controller.open?.(action.eventId);
              const claimResult = controller.claimActive
                ? controller.claimActive(action.optionId)
                : controller.claim(action.eventId, action.optionId);
              const result = await claimResult;
              return this.afterEventClaimed(result);
            }
            const api = this.host.api || this.getGameHost()?.getGameApi?.() || this.getGameHost()?.api;
            if (!api?.claimEvent) return false;
            const result = await this.runAction(() => api.claimEvent(action.eventId, action.optionId));
            return this.afterEventClaimed(result);
          }

    afterEventClaimed(result) {
            if (result?.success === false) return false;
            const game = this.getGameHost();
            const nextState = result?.gameState || result?.state || null;
            if (nextState && game?.state && typeof game.state === 'object' && !game.applyState && !game.applyApiState) {
              StateWriter.commit(game, (prev) => ({
                ...nextState,
                currentTab: prev.currentTab || nextState.currentTab,
              }), { source: 'cityHandlers:afterEventClaimed' });
            }
            this.host.closeEventSnapshot?.();
            this.getEventController()?.close?.();
            if (result?.rewardReveal) {
              if (!this.host.showRewardReveal?.(result.rewardReveal)) this.host.openRewardRevealSnapshot?.(result.rewardReveal);
            }
            return true;
          }

    handle_claimTaskReward(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showTaskCenter');
            const forwarded = this.forward(action);
            if (forwarded !== undefined) {
              return this.finalizeForwarded(forwarded, () => {
                this.afterHandled(action);
              });
            }
            const game = this.getGameHost();
            if (typeof game?.claimTaskReward === 'function') {
              return this.finalizeForwarded(game.claimTaskReward(action.taskId, action.category));
            }
            return this.finalize(this.claimTaskRewardDirect(action, false));
          }

    async claimTaskRewardDirect(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showTaskCenter');
            const result = await this.runAction(() => {
              const claim = this.host.api.claimTaskReward;
              if (typeof claim !== 'function') return { success: false };
              return claim.call(this.host.api, action.taskId, action.category || 'main');
            });
            if (result?.rewardReveal) this.host.openRewardRevealSnapshot?.(result.rewardReveal);
            else this.host.closeRewardRevealSnapshot?.();
            if (result && result.success !== false) {
              this.emitGameEvent('taskRewardClaimed', {
                taskId: action.taskId || '',
                category: action.category || 'main',
                result,
              });
            }
            return true;
          }

    handle_scrollBuildings(action) {
            if (typeof this.host?.scrollBuildings === 'function') {
              this.host.scrollBuildings(action);
            } else {
              this.host.buildingOffset = Math.max(0, (Number(this.host.buildingOffset) || 0) + (Number(action.delta) || 0));
            }
            return this.afterHandled(action);
          }

    handle_selectBuildingCategory(action) {
            if (typeof this.host?.selectBuildingCategory === 'function') {
              this.host.selectBuildingCategory(action);
            } else {
              this.host.activeBuildingCategory = action.category || 'all';
              this.host.buildingOffset = 0;
              this.host.buildingTransition = null;
            }
            return this.afterHandled(action);
          }

    // Famous person API commands.
    handle_seekFamousPerson(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            if (typeof game?.seekFamousPerson === 'function') {
              return this.finalize(Promise.resolve(game.seekFamousPerson(action.source || 'seek')).then((result) => {
                if (result !== false && result?.success !== false) {
                  this.emitGameEvent('famousSeekCompleted', { source: action.source || 'seek', result: result || {} });
                }
                return result;
              }));
            }
            return this.finalize(this.runAction(() => this.host.api.seekFamousPerson(action.source || 'seek')).then((result) => {
              if (result !== false && result?.success !== false) {
                this.emitGameEvent('famousSeekCompleted', { source: action.source || 'seek', result: result || {} });
              }
              return result;
            }));
          }

    handle_acceptFamousPerson(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            if (typeof game?.acceptFamousPerson === 'function') {
              return this.finalize(game.acceptFamousPerson(action.candidateId));
            }
            return this.finalize(this.runAction(() => this.host.api.acceptFamousPerson(action.candidateId)));
          }

    handle_dismissFamousPersonCandidate(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            if (typeof game?.dismissFamousPersonCandidate === 'function') {
              return this.finalize(game.dismissFamousPersonCandidate(action.candidateId));
            }
            return this.finalize(this.runAction(() => this.host.api.dismissFamousPersonCandidate(action.candidateId)));
          }

    handle_assignFamousAttributePoint(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const game = this.getGameHost();
            if (typeof game?.assignFamousAttributePoint === 'function') {
              return this.finalize(game.assignFamousAttributePoint(action.personId, action.attribute));
            }
            return this.finalize(this.runAction(() => this.host.api.assignFamousAttributePoint(action.personId, action.attribute)));
          }

    // Shell, modal, login, settings, and system actions.
    finalizeNamingSubmit(result) {
            const closeAfterSuccess = (value) => {
              if (value !== false) {
                this.host?.closeNaming?.();
                const game = this.getGameHost();
                if (game && game !== this.host && typeof game.closeNamingModal === 'function') game.closeNamingModal();
              }
              return value !== false;
            };
            if (!result || typeof result.then !== 'function') return closeAfterSuccess(result);
            if (this.awaitAsync) return result.then(closeAfterSuccess);
            result.then(closeAfterSuccess).catch((error) => this.log?.(error));
            return true;
          }

    handle_switchTab(action, meta = {}) {
            const previousTab = this.host?.getActiveTab?.() || this.getGameHost()?.getActiveTab?.() || this.getState()?.currentTab || 'resources';
            const previousBuildingOffset = Math.max(0, Number(this.host?.buildingOffset) || 0);
            this.host?.resetForCanvasTabSwitch?.(action);
            const game = this.getGameHost();
            const gameHandlesSelection = typeof game?.handleCanvasTabSelection === 'function';
            const hostCanAnimate = !gameHandlesSelection;
            let result;
            if (gameHandlesSelection) {
              result = game.handleCanvasTabSelection(action.tab);
            } else {
              const forwarded = this.forward(action, meta);
              if (forwarded !== undefined) result = forwarded;
              else if (game && game !== this.host && typeof game.switchTab === 'function') result = game.switchTab(action.tab);
              else if (typeof this.host?.switchTab === 'function') result = this.host.switchTab(action.tab);
              else result = false;
            }
            return this.finalize(Promise.resolve(result).then((allowed) => {
              if (allowed !== false) {
                const resolvedTab = this.host?.getActiveTab?.() || game?.getActiveTab?.() || '';
                const requestedNextTab = action.tab || resolvedTab || 'resources';
                const nextView = this.host?.resolveMapHomeViewState?.(this.getState(), {
                  requestedTab: requestedNextTab,
                  forceMapHome: requestedNextTab === 'resources' || requestedNextTab === 'territory',
                });
                const nextTab = resolvedTab && resolvedTab !== previousTab
                  ? resolvedTab
                  : (nextView?.activeTab || requestedNextTab);
                if (hostCanAnimate) this.host?.startPageTransition?.(previousTab, nextTab, { fromBuildingOffset: previousBuildingOffset });
                this.afterHandled(action);
              }
              return allowed !== false;
            }));
          }

    handle_openResourceDetails(action) {
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showResourceDetails', true);
            this.closePanels(['showResourceDetails']);
            return this.afterHandled(action);
          }

    handle_closeResourceDetails(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showResourceDetails');
            return this.afterHandled(action);
          }

    handle_openCommandPanel(action) {
            const panel = String(action.panel || '');
            if (!panel) return false;
            const nextPanel = getCommandPanelValue(this.host) === panel ? '' : panel;
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'activeCommandPanel', nextPanel);
            this.closePanels(nextPanel ? ['activeCommandPanel'] : []);
            if (nextPanel) this.emitGameEvent('commandPanelOpened', { panelId: nextPanel });
            this.afterHandled(action);
            return true;
          }

    handle_closeCommandPanel(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
            return this.afterHandled(action);
          }

    handle_closeRewardReveal(action) {
            let closed;
            if (typeof this.host?.closeRewardReveal === 'function') {
              closed = this.host.closeRewardReveal();
            } else {
              const hadReveal = this.host?.isRewardRevealSnapshotOpen?.() === true;
              this.host?.closeRewardRevealSnapshot?.();
              closed = hadReveal && this.host?.isRewardRevealSnapshotOpen?.() !== true;
            }
            if (closed) {
              this.emitGameEvent('rewardRevealClosed', {});
              this.afterHandled(action);
            }
            return closed !== false;
          }

    handle_openCitySwitcher(action) {
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showCitySwitcher', !CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this.host, 'showCitySwitcher'));
            this.closePanels(['showCitySwitcher']);
            return this.afterHandled(action);
          }

    handle_closeCitySwitcher(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showCitySwitcher');
            return this.afterHandled(action);
          }

    handle_openSubcityList(action) {
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showSubcityList', !CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this.host, 'showSubcityList'));
            this.closePanels(CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this.host, 'showSubcityList') ? ['showSubcityList'] : []);
            return this.afterHandled(action);
          }

    handle_closeSubcityList(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showSubcityList');
            return this.afterHandled(action);
          }

    handle_openArmyFormation(action) {
            const slot = Math.max(1, Math.min(3, Number(action.slot) || 1));
            const game = this.getGameHost();
            const target = game && game !== this.host ? game : this.host;
            if (typeof target?.openArmyFormation === 'function') {
              return target.openArmyFormation({ ...action, slot }) !== false;
            }
            const message = t('formation.slotPending', { slot });
            if (typeof this.host?.showFloatingText === 'function') this.host.showFloatingText(message);
            else if (typeof game?.showFloatingText === 'function') game.showFloatingText(message);
            else this.log?.(message);
            return this.afterHandled(action);
          }

    handle_closeArmyFormationEditor(action) {
            const game = this.getGameHost();
            const target = game && game !== this.host ? game : this.host;
            if (typeof target?.closeArmyFormationEditor === 'function') {
              return target.closeArmyFormationEditor(action) !== false;
            }
            if (this.host && typeof this.host === 'object') this.host.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
            return this.afterHandled(action);
          }

    handle_toggleArmyFormationMember(action) {
            const game = this.getGameHost();
            const target = game && game !== this.host ? game : this.host;
            if (typeof target?.toggleArmyFormationMember === 'function') {
              return target.toggleArmyFormationMember(action) !== false;
            }
            return false;
          }

    handle_changeArmyFormationPage(action) {
            const game = this.getGameHost();
            const target = game && game !== this.host ? game : this.host;
            if (typeof target?.changeArmyFormationPage === 'function') {
              return target.changeArmyFormationPage(action) !== false;
            }
            return false;
          }

    handle_changeArmyFormationSoldiers(action) {
            const game = this.getGameHost();
            const target = game && game !== this.host ? game : this.host;
            if (typeof target?.changeArmyFormationSoldiers === 'function') {
              return target.changeArmyFormationSoldiers(action) !== false;
            }
            return false;
          }

    handle_requestArmyFormationSoldierInput(action) {
            const game = this.getGameHost();
            const target = game && game !== this.host ? game : this.host;
            if (typeof target?.requestArmyFormationSoldierInput === 'function') {
              return this.finalize(target.requestArmyFormationSoldierInput(action));
            }
            return false;
          }

    handle_autoReplenishArmyFormation(action) {
            const game = this.getGameHost();
            const target = game && game !== this.host ? game : this.host;
            if (typeof target?.autoReplenishArmyFormation === 'function') {
              return target.autoReplenishArmyFormation(action) !== false;
            }
            return false;
          }

    handle_saveArmyFormation(action) {
            const game = this.getGameHost();
            const target = game && game !== this.host ? game : this.host;
            if (typeof target?.saveArmyFormation === 'function') {
              return this.finalize(target.saveArmyFormation(action));
            }
            return false;
          }

    handle_openSettings(action) {
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showSettings', true);
            this.closePanels(['showSettings']);
            return this.afterHandled(action);
          }

    handle_closeSettings(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showSettings');
            return this.afterHandled(action);
          }

    getSystemUiHost() {
            const game = this.getGameHost();
            return game?.canvasShell || this.host?.canvasShell || this.host;
          }

    resolveClientOperationLog() {
            const game = this.getGameHost();
            return this.host?.runtime?.ClientOperationLog
              || game?.runtime?.ClientOperationLog
              || global?.ClientOperationLog
              || globalThis?.ClientOperationLog
              || null;
          }

    handle_requestResetGame(action) {
            const uiHost = this.getSystemUiHost();
            if (typeof uiHost?.openResetConfirm !== 'function') return false;
            const opened = uiHost.openResetConfirm({ source: action.source }) !== false;
            return opened ? true : this.afterHandled(action);
          }

    handle_downloadClientOperationLog(action) {
            const game = this.getGameHost();
            const logger = this.resolveClientOperationLog();
            const result = logger?.download?.({
              reason: action.reason || 'settings-download',
              playerId: game?.playerId || '',
              username: game?.authStorage?.getUsername?.() || '',
            });
            if (result?.success) {
              this.host?.showFloatingText?.(t('opsLog.saved', { fileName: result.fileName }));
            } else {
              this.host?.showFloatingText?.(result?.message || result?.error || t('opsLog.exportFailed'), { color: '#ffb86b' });
            }
            return this.afterHandled(action);
          }

    handle_closeConfirmDialog(action) {
            const uiHost = this.getSystemUiHost();
            uiHost?.resolveConfirmDialogSnapshotCallback?.('onCancel', action);
            const closed = uiHost?.closeConfirmDialog?.();
            return closed !== false;
          }

    handle_confirmResetGame(action) {
            const uiHost = this.getSystemUiHost();
            const dialog = uiHost?.getConfirmDialogSnapshot?.() || {};
            if (dialog.visible && dialog.kind && dialog.kind !== 'resetGame') return false;
            uiHost?.resolveConfirmDialogSnapshotCallback?.('onConfirm', action);
            uiHost?.setConfirmDialogSubmitting?.(true);
            const result = this.getGameHost()?.resetGame?.({ confirmed: true, source: action.source || dialog.source || '' });
            const applyResetView = (success) => {
              uiHost?.setConfirmDialogSubmitting?.(false);
              if (success === false) return false;
              uiHost?.closeConfirmDialog?.();
              uiHost?.resetLocalViewToResources?.({ skipRender: true });
              const game = this.getGameHost();
              if (game && game !== uiHost) game.resetLocalViewToResources?.({ skipShell: true, skipRender: true });
              this.render({ ...action, tab: 'military', militaryView: 'world', isMapHome: true });
              return true;
            };
            if (!result || typeof result.then !== 'function') return applyResetView(result);
            return this.finalize(result.then(applyResetView).catch((error) => {
              uiHost?.setConfirmDialogSubmitting?.(false);
              throw error;
            }));
          }

    handle_openLogs(action) {
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showLogs', true);
            this.closePanels(['showLogs']);
            return this.afterHandled(action);
          }

    handle_closeLogs(action) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.host, 'showLogs');
            this.getGameHost()?.closeRequestLogs?.();
            return this.afterHandled(action);
          }

    handle_clearLogs(action) {
            const game = this.getGameHost();
            if (Array.isArray(game?.requestLogs)) game.requestLogs = [];
            if (typeof game?.clearRequestLogs === 'function') game.clearRequestLogs();
            CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this.host, 'showLogs', true);
            return this.afterHandled(action);
          }

    handle_requestLoginUsername() {
            return this.host?.requestAuthInput?.('username') !== false;
          }

    handle_requestLoginPassword() {
            return this.host?.requestAuthInput?.('password') !== false;
          }

    handle_toggleRememberPassword(action) {
            const toggled = this.host?.toggleRememberPassword?.();
            if (toggled !== false) this.afterHandled(action);
            return toggled !== false;
          }

    handle_submitLogin(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const result = this.getGameHost()?.handleLogin?.();
            return result === undefined ? true : result !== false;
          }

    handle_resetGame(action) {
            return this.handle_requestResetGame({ ...action, type: 'requestResetGame' });
          }

    handle_logout() {
            this.closePanels();
            const result = this.getGameHost()?.logout?.();
            return result === undefined ? true : result !== false;
          }

    handle_requestNamingInput() {
            const result = this.host?.requestNamingInput?.();
            return result !== false;
          }

    handle_closeNaming() {
            const result = this.host?.closeNaming?.() || this.getGameHost()?.closeNamingModal?.();
            return result !== false;
          }

    handle_submitNaming(action) {
            const name = action.name || this.host?.getNamingName?.();
            const game = this.getGameHost();
            const result = typeof game?.submitNaming === 'function'
              ? game.submitNaming(name)
              : this.host?.submitNaming?.();
            if (result !== undefined) return this.finalizeNamingSubmit(result, action);
            const forwarded = this.forward({ ...action, name });
            return forwarded === undefined ? false : this.finalizeNamingSubmit(forwarded, action);
          }

    handle_blockCanvasModal() {
            return true;
          }

    handleCanvasShellAction(action, meta = {}) {
            return this.handle(action, meta);
          }

    // Battle scene and entity battle actions.
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
          }

    handle_closeBattleScene(_action) {
            const game = this.getGameHost();
            const closed =
              typeof game?.closeBattleScene === 'function'
                ? game.closeBattleScene()
                : this.host?.closeBattleScene?.();
            return closed !== false;
          }

    handle_skipBattleScene(_action) {
            const game = this.getGameHost();
            const skipped =
              typeof game?.skipBattleScene === 'function'
                ? game.skipBattleScene()
                : this.host?.skipBattleScene?.();
            return skipped !== false;
          }

    handle_entityBattleSelectGeneral(action) {
            const game = this.getGameHost();
            return game?.entityBattleSelectGeneral?.(action.gid) !== false;
          }

    handle_entityBattleOrder(action) {
            const game = this.getGameHost();
            return game?.entityBattleOrder?.(action.gid, action.order) !== false;
          }

    handle_entityBattleMaster(action) {
            const game = this.getGameHost();
            return game?.entityBattleMaster?.(action.order) !== false;
          }

    handle_entityBattleSkill(action) {
            const game = this.getGameHost();
            return game?.entityBattleSkill?.(action.gid, action.skillId) !== false;
          }

    handle_entityBattleAuto() {
            const game = this.getGameHost();
            return game?.toggleEntityBattleAuto?.() !== false;
          }

    handle_entityBattleDone() {
            const game = this.getGameHost();
            return game?.closeEntityBattle?.() !== false;
          }

    handle_entityBattleClose() {
            const game = this.getGameHost();
            return game?.closeEntityBattle?.() !== false;
          }

    handle_entityBattleZoom(action) {
            const game = this.getGameHost();
            return game?.entityBattleZoom?.(action.gesture || {}) !== false;
          }

    handle_entityBattleDrag(action) {
            const game = this.getGameHost();
            return game?.entityBattleDrag?.(action.phase, action.pointer || {}) !== false;
          }

    // Expedition and conquest actions.
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
          }

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
          }

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
          }

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
          }

    handle_conquer(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const territory = this.getTerritoryController();
            if (territory?.handleAction) {
              territory.handleAction({ territoryId: action.territoryId, action: 'conquer' });
              return true;
            }
            return this.finalize(
              this.runAction(() => this.host.api.startConquest(action.territoryId, { soldiers: 0 })),
            );
          }

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
          }

    handle_claimConquest(action) {
            const forwarded = this.forward(action);
            if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
            const territory = this.getTerritoryController();
            if (territory?.handleAction) {
              territory.handleAction({ territoryId: action.territoryId, action: 'claim' });
              return true;
            }
            return this.finalize(this.runAction(() => this.host.api.claimConquest(action.territoryId)));
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

  global.CanvasActionController = CanvasActionController;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionController;
})(typeof globalThis !== 'undefined' ? globalThis : window);
