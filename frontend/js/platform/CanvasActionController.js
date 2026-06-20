(function (global) {
  var TechTreeInteractionModelBase = global.TechTreeInteractionModel;
  if (typeof module !== 'undefined' && module.exports && !TechTreeInteractionModelBase) {
    TechTreeInteractionModelBase = require('./interactions/TechTreeInteractionModel');
  }
  var CanvasTerritoryActionHandlers = global.CanvasTerritoryActionHandlers;
  if (typeof module !== 'undefined' && module.exports && !CanvasTerritoryActionHandlers) {
    CanvasTerritoryActionHandlers = require('./CanvasTerritoryActionHandlers');
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

  const CLOSEABLE_PANELS = [
    'showSettings',
    'showLogs',
    'showResourceDetails',
    'showCitySwitcher',
    'showSubcityList',
    'showCityManagement',
    'showAdvisor',
    'showTaskCenter',
    'showGuidebook',
    'showFamousPersons',
    'armyFormationEditor',
    'techDetailOpen',
    'activeCommandPanel',
  ];

  function isActorPickingDiagEnabled() {
    if (global.__actorPickingDiag === true) return true;
    try {
      const params = new URL(global.location?.href || '').searchParams;
      const value = params.get('actorPickingDiag') || params.get('worldActorPickingDiag');
      if (value !== null) return value !== '0' && value !== 'false' && value !== 'off';
    } catch (_) {
      // Ignore diagnostic preference lookup failures.
    }
    try {
      const value = global.localStorage?.getItem?.('actorPickingDiag');
      return value === '1' || value === 'true' || value === 'on';
    } catch (_) {
      // Ignore diagnostic preference lookup failures.
    }
    return false;
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
    if (!isActorPickingDiagEnabled()) return null;
    const payload = {
      at: new Date().toISOString(),
      stage,
      ...detail,
    };
    try {
      const events = global.__actorPickingDiagEvents || [];
      const signature = options.signature || '';
      global.__actorPickingDiagLastSignatureByStage = global.__actorPickingDiagLastSignatureByStage || {};
      if (signature && events.length && global.__actorPickingDiagLastSignatureByStage[stage] === signature) return null;
      if (signature) global.__actorPickingDiagLastSignatureByStage[stage] = signature;
      events.push(payload);
      while (events.length > 120) events.shift();
      global.__actorPickingDiagEvents = events;
      global.__actorPickingDiagLastByStage = global.__actorPickingDiagLastByStage || {};
      global.__actorPickingDiagLastByStage[stage] = payload;
    } catch (_) {
      // Ignore diagnostic preference lookup failures.
    }
    try {
      if (global.__actorPickingDiagVerbose === true
        || global.localStorage?.getItem?.('actorPickingDiagVerbose') === '1') {
        global.console?.log?.('[ActorPickingDiagVerbose]', JSON.stringify(payload));
      }
    } catch (_) {
      // Ignore diagnostic preference lookup failures.
    }
    return payload;
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
      const game = this.getGameHost();
      const territoryController = this.host?.territoryController || game?.territoryController || null;
      const uiState = territoryController?.uiState
        || this.host.territoryUiState
        || game?.territoryUiState
        || territoryController?.getUiState?.()
        || {};
      this.host.territoryUiState = uiState;
      if (game && game !== this.host && typeof game === 'object') game.territoryUiState = uiState;
      if (territoryController && typeof territoryController === 'object' && !territoryController.uiState) {
        territoryController.uiState = uiState;
      }
      return uiState;
    }

    setField(key, value, target = this.host) {
      if (target && typeof target === 'object') target[key] = value;
    }

    closePanels(except = []) {
      const keep = new Set(except);
      CLOSEABLE_PANELS.forEach((key) => {
        if (!keep.has(key) && key in this.host) this.host[key] = key === 'activeCommandPanel' ? '' : false;
      });
      if (!keep.has('activeEventId') && 'activeEventId' in this.host) this.host.activeEventId = null;
    }

    closePanelsOn(target, except = []) {
      if (!target || target === this.host || typeof target !== 'object') return;
      const keep = new Set(except);
      CLOSEABLE_PANELS.forEach((key) => {
        if (!keep.has(key) && key in target) target[key] = key === 'activeCommandPanel' ? '' : false;
      });
      if (!keep.has('activeEventId') && 'activeEventId' in target) target.activeEventId = null;
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
          action: summarizeActorPickingAction(action),
          uiState: summarizeActorPickingUiState(this.getSharedTerritoryUiState?.() || {}),
        });
      }
      const handled = this.afterHandled(action);
      const refreshResult = this.refreshWorldMapLayer();
      if (isActorPickingDiagEnabled()) {
        logActorPickingDiag('actionController:refreshWorldMarchLayer:after', {
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

    handle(action, meta = {}) {
      if (!action || action.disabled) {
        global.ClientOperationLog?.record?.('action:skipped', {
          action: global.ClientOperationLog?.summarizeAction?.(action),
          reason: action?.disabled ? 'disabled' : 'missing',
        }, { flush: true });
        return Boolean(action?.disabled);
      }
      const handler = this[`handle_${action.type}`] || this.handleUnknown;
      if (action.type === 'selectWorldActor' && isActorPickingDiagEnabled()) {
        logActorPickingDiag('actionController:handle:selectWorldActor:before', {
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
          if (action.type === 'selectWorldActor' && isActorPickingDiagEnabled()) {
            logActorPickingDiag('actionController:handle:selectWorldActor:after', {
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
  CanvasCityActionHandlers?.install?.(CanvasActionController);
  CanvasFamousActionHandlers?.install?.(CanvasActionController);
  CanvasShellActionHandlers?.install?.(CanvasActionController);

  global.CanvasActionController = CanvasActionController;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionController;
})(typeof globalThis !== 'undefined' ? globalThis : window);
