(function (global) {

  const TutorialFlowShared = (() => {
    if (global.TutorialFlowShared) return global.TutorialFlowShared;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../../../shared/tutorialFlowConfig');
    }
    return null;
  })();

  const TutorialGuideStepPolicy = (() => {
    if (global.TutorialGuideStepPolicy) return global.TutorialGuideStepPolicy;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./TutorialGuideStepPolicy');
    }
    return null;
  })();

  const SharedTutorialGuideTargetResolver = (() => {
    if (global.TutorialGuideTargetResolver) return global.TutorialGuideTargetResolver;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./TutorialGuideTargetResolver');
    }
    return null;
  })();


  const SharedTutorialGuideFlowRegistry = (() => {
    if (global.TutorialGuideFlowRegistry) return global.TutorialGuideFlowRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./TutorialGuideFlowRegistry');
    }
    return null;
  })();

  const SharedTutorialGuideEventRegistry = (() => {
    if (global.TutorialGuideEventRegistry) return global.TutorialGuideEventRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./TutorialGuideEventRegistry');
    }
    return null;
  })();

  const SharedTutorialEngineQueryTable = (() => {
    if (global.TutorialEngineQueryTable) return global.TutorialEngineQueryTable;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./TutorialEngineQueryTable');
    }
    return null;
  })();

  const SharedTutorialStepScriptRunner = (() => {
    if (global.TutorialStepScriptRunner) return global.TutorialStepScriptRunner;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../tutorial-engine/StepScriptRunner');
    }
    return null;
  })();

  const SharedTaskPanelStepScripts = (() => {
    if (global.TutorialTaskPanelStepScripts) return global.TutorialTaskPanelStepScripts;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../tutorial-config/TaskPanelStepScripts');
    }
    return null;
  })();

  const TerritoryUiStateStore = (() => {
    if (global.TerritoryUiStateStore) return global.TerritoryUiStateStore;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../state/TerritoryUiStateStore');
    }
    return null;
  })();

  const UiRuntimeStateStore = (() => {
    if (global.UiRuntimeStateStore) return global.UiRuntimeStateStore;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../state/UiRuntimeStateStore');
    }
    return null;
  })();

  const CanvasModalSnapshotAdapter = (() => {
    if (global.CanvasModalSnapshotAdapter) return global.CanvasModalSnapshotAdapter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../platform/CanvasModalSnapshotAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const CanvasModeOwnershipRuntime = (() => {
    if (global.CanvasModeOwnershipRuntime) return global.CanvasModeOwnershipRuntime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../platform/CanvasModeOwnershipRuntime');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const ClientCommandSemantics = (() => {
    if (global.ClientCommandSemantics) return global.ClientCommandSemantics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../platform/ClientCommandSemantics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const StateWriter = (() => {
    if (global.StateWriter) return global.StateWriter;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../state/StateWriter');
    }
    return null;
  })();

  const SharedChangeEventBus = (() => {
    if (global.ChangeEventBus) return global.ChangeEventBus;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../state/ChangeEventBus');
    }
    return null;
  })();

  function t(key = '', params = {}) {
    return global.LocaleText ? global.LocaleText.t(key, params) : key;
  }

  function getCurrentRenderTab(game = null) {
    return CanvasModeOwnershipRuntime?.getCurrentTab?.(game) || game?.state?.currentTab || 'resources';
  }

  function isVisuallyDisabled(action = {}) {
    return ClientCommandSemantics?.isVisuallyDisabled?.(action)
      ?? Boolean(action?.visualDisabled ?? action?.disabled);
  }

  function getCommandPanelValue(host) {
    if (typeof host?.getCommandPanelValue === 'function') return host.getCommandPanelValue();
    return CanvasModalSnapshotAdapter?.getCommandPanelValue?.(host) || '';
  }

  const TUTORIAL_STEPS = TutorialGuideStepPolicy.TUTORIAL_STEPS;
  const DEFAULT_API_TIMEOUT_MS = 10000;
  const ADVANCE_WATCHDOG_JITTER_MS = 250;

  function stableSerialize(value, seen = new WeakSet()) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    if (Array.isArray(value)) {
      return `[${value.map((entry) => stableSerialize(entry, seen)).join(',')}]`;
    }
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(value[key], seen)}`
    )).join(',')}}`;
  }

  function getGlobalWitness() {
    if (!global.__tutorialHostContextWitness) {
      global.__tutorialHostContextWitness = { count: 0, traces: [] };
    }
    return global.__tutorialHostContextWitness;
  }

  function copyStepScriptTrace(trace = {}) {
    return {
      stepKey: String(trace.stepKey || ''),
      scriptType: String(trace.scriptType || ''),
      ruleId: String(trace.ruleId || ''),
      outcome: String(trace.outcome || ''),
      instructionTypes: Array.isArray(trace.instructionTypes)
        ? trace.instructionTypes.map((type) => String(type || ''))
        : [],
    };
  }

  function recordStepScriptIdleTrace(stepKey = '', projection = null) {
    const snapshot = copyStepScriptTrace({
      ...(projection?.trace || {}),
      stepKey,
      outcome: 'scripted-step-idle',
    });
    const ledger = getGlobalStepScriptTrace();
    const entry = ledger.steps[snapshot.stepKey] || null;
    if (entry) entry.last = snapshot;
    global.TutorialHostContextTrace?.log?.('scripted-step-idle', snapshot);
    return snapshot;
  }

  function getGlobalStepScriptTrace() {
    if (!global.__tutorialStepScriptTrace) {
      global.__tutorialStepScriptTrace = {
        schema: 'tutorial-step-script-trace/v1',
        totalEvaluations: 0,
        steps: {},
      };
    }
    return global.__tutorialStepScriptTrace;
  }

  function recordStepScriptTrace(trace = {}) {
    const snapshot = copyStepScriptTrace(trace);
    if (!snapshot.stepKey) return false;
    const ledger = getGlobalStepScriptTrace();
    const previous = ledger.steps[snapshot.stepKey] || null;
    ledger.totalEvaluations += 1;
    ledger.steps[snapshot.stepKey] = {
      count: (previous?.count || 0) + 1,
      first: previous?.first || snapshot,
      last: snapshot,
    };
    return true;
  }

  function getStepScriptTraceSnapshot() {
    const ledger = getGlobalStepScriptTrace();
    const steps = Object.fromEntries(Object.keys(ledger.steps).sort().map((stepKey) => {
      const entry = ledger.steps[stepKey];
      return [stepKey, {
        count: entry.count,
        first: copyStepScriptTrace(entry.first),
        last: copyStepScriptTrace(entry.last),
      }];
    }));
    return {
      schema: ledger.schema,
      totalEvaluations: ledger.totalEvaluations,
      steps,
    };
  }

  function resetStepScriptTrace() {
    const ledger = getGlobalStepScriptTrace();
    ledger.totalEvaluations = 0;
    ledger.steps = {};
    return getStepScriptTraceSnapshot();
  }

  function getGlobalRefreshReentryTrace() {
    if (!global.__tutorialHighlightRefreshReentryTrace) {
      global.__tutorialHighlightRefreshReentryTrace = {
        schema: 'tutorial-highlight-refresh-reentry-trace/v1',
        count: 0,
        traces: [],
      };
    }
    return global.__tutorialHighlightRefreshReentryTrace;
  }

  function recordRefreshReentryTrace(trace = {}) {
    const ledger = getGlobalRefreshReentryTrace();
    const snapshot = {
      stepKey: String(trace.stepKey || ''),
      phase: trace.phase === 'trailing-self-drop'
        ? 'trailing-self-drop'
        : (trace.phase === 'trailing' ? 'trailing' : 'primary'),
      trailingScheduled: trace.trailingScheduled === true,
    };
    ledger.count += 1;
    ledger.traces.push(snapshot);
    global.TutorialHostContextTrace?.log?.('tutorial-highlight-refresh-reentry', snapshot);
    return snapshot;
  }

  function getRefreshReentryTraceSnapshot() {
    const ledger = getGlobalRefreshReentryTrace();
    return {
      schema: ledger.schema,
      count: ledger.count,
      traces: ledger.traces.map((trace) => ({ ...trace })),
    };
  }

  function resetRefreshReentryTrace() {
    const ledger = getGlobalRefreshReentryTrace();
    ledger.count = 0;
    ledger.traces.length = 0;
    return getRefreshReentryTraceSnapshot();
  }

  function getGlobalRenderRefreshDropTrace() {
    if (!global.__tutorialRenderRefreshDropTrace) {
      global.__tutorialRenderRefreshDropTrace = {
        schema: 'tutorial-render-refresh-drop-trace/v1',
        count: 0,
        traces: [],
      };
    }
    return global.__tutorialRenderRefreshDropTrace;
  }

  function getActiveRenderPhase(host) {
    const owner = host?.game?.lastGame || host?.game || host;
    return global.TutorialRenderPhaseGuard?.getActivePhase?.(owner) || '';
  }

  function recordRenderRefreshDrop(host, eventName = '') {
    const ledger = getGlobalRenderRefreshDropTrace();
    const snapshot = {
      stepKey: String(host?.getCurrentStep?.() || ''),
      eventName: String(eventName || ''),
      renderPhase: getActiveRenderPhase(host),
    };
    ledger.count += 1;
    ledger.traces.push(snapshot);
    global.TutorialHostContextTrace?.log?.('tutorial-render-refresh-dropped', snapshot);
    return snapshot;
  }

  function getRenderRefreshDropTraceSnapshot() {
    const ledger = getGlobalRenderRefreshDropTrace();
    return {
      schema: ledger.schema,
      count: ledger.count,
      traces: ledger.traces.map((trace) => ({ ...trace })),
    };
  }

  function resetRenderRefreshDropTrace() {
    const ledger = getGlobalRenderRefreshDropTrace();
    ledger.count = 0;
    ledger.traces.length = 0;
    return getRenderRefreshDropTraceSnapshot();
  }

  const highlightRefreshTransactions = new WeakMap();

  function getHighlightRefreshTransaction(host) {
    const owner = host?.game?.lastGame || host?.game || host;
    if (!owner || (typeof owner !== 'object' && typeof owner !== 'function')) {
      return { active: false };
    }
    let transaction = highlightRefreshTransactions.get(owner);
    if (!transaction) {
      transaction = { active: false };
      highlightRefreshTransactions.set(owner, transaction);
    }
    return transaction;
  }

  function getGlobalAdvanceWatchdogTrace() {
    if (!global.__tutorialAdvanceWatchdogTrace) {
      global.__tutorialAdvanceWatchdogTrace = {
        schema: 'tutorial-advance-watchdog-trace/v1',
        count: 0,
        traces: [],
      };
    }
    return global.__tutorialAdvanceWatchdogTrace;
  }

  function recordAdvanceWatchdogTrace(trace = {}) {
    const ledger = getGlobalAdvanceWatchdogTrace();
    const snapshot = {
      stepKey: String(trace.stepKey || ''),
      startedAtMs: Number(trace.startedAtMs) || 0,
      expiredAtMs: Number(trace.expiredAtMs) || 0,
      timeoutMs: Math.max(0, Number(trace.timeoutMs) || 0),
      reason: String(trace.reason || 'timer'),
    };
    ledger.count += 1;
    ledger.traces.push(snapshot);
    global.TutorialHostContextTrace?.log?.('tutorial-advance-watchdog-timeout', snapshot);
    return snapshot;
  }

  function getAdvanceWatchdogTraceSnapshot() {
    const ledger = getGlobalAdvanceWatchdogTrace();
    return {
      schema: ledger.schema,
      count: ledger.count,
      traces: ledger.traces.map((trace) => ({ ...trace })),
    };
  }

  function resetAdvanceWatchdogTrace() {
    const ledger = getGlobalAdvanceWatchdogTrace();
    ledger.count = 0;
    ledger.traces.length = 0;
    return getAdvanceWatchdogTraceSnapshot();
  }

  class TutorialHostContext {
    constructor(options = {}) {
      this.game = options.game || null;
      this.api = options.api || null;
      this.state = options.state || null;
      this.focusedFirstCitySiteId = '';
      this.pendingAdvanceByStep = new Map();
      this.advanceWatchdogJitterMs = Math.max(
        0,
        Number(options.advanceWatchdogJitterMs ?? ADVANCE_WATCHDOG_JITTER_MS) || 0,
      );
      this.highlightRefreshActive = false;
      this.highlightRefreshPending = false;
      this.highlightRefreshTrailing = false;
      this.highlightRefreshTrailingScheduled = false;
      this.targetResolver = options.targetResolver
        || (SharedTutorialGuideTargetResolver ? new SharedTutorialGuideTargetResolver({ host: this }) : null);
      this.flowRegistry = options.flowRegistry
        || (SharedTutorialGuideFlowRegistry?.create ? SharedTutorialGuideFlowRegistry.create({ steps: TUTORIAL_STEPS }) : null);
      this.eventRegistry = options.eventRegistry
        || (SharedTutorialGuideEventRegistry?.create ? SharedTutorialGuideEventRegistry.create({ steps: TUTORIAL_STEPS }) : null);
      this.queryTable = options.queryTable
        || (SharedTutorialEngineQueryTable?.create ? SharedTutorialEngineQueryTable.create({ context: this }) : null);
      this.stepScriptConfig = options.stepScriptConfig === undefined
        ? SharedTaskPanelStepScripts
        : options.stepScriptConfig;
      this.stepScriptRunner = options.stepScriptRunner === undefined
        ? SharedTutorialStepScriptRunner?.create?.()
        : options.stepScriptRunner;
      const changeEventBus = options.changeEventBus
        || (typeof window !== 'undefined'
          ? SharedChangeEventBus
          : SharedChangeEventBus?.createEventBus?.());
      this.changeEventBus = changeEventBus || null;
      // Historical compatibility only; auxiliary tutorial objects no longer create host contexts.
      this.changeEventBusUnsubscribe = (options.subscribeToBus === false)
        ? null
        : (this.eventRegistry?.subscribeToBus?.(this.changeEventBus, this) || null);
    }

    disconnectChangeEventBus() {
      const unsubscribe = this.changeEventBusUnsubscribe;
      this.changeEventBusUnsubscribe = null;
      return unsubscribe?.() || false;
    }

    isChangeEventRelevant(eventName, change = {}) {
      if (eventName !== 'state.changed') return true;
      const owner = change.owner;
      return !owner || !this.game || owner === this.game || owner === this.game.lastGame;
    }

    requestHighlightRefresh(eventName = '', _change = {}) {
      if (getActiveRenderPhase(this)) {
        recordRenderRefreshDrop(this, eventName);
        return false;
      }
      if (eventName === 'state.changed' && getHighlightRefreshTransaction(this).active) {
        recordRefreshReentryTrace({
          stepKey: this.getCurrentStep(),
          phase: 'primary',
          trailingScheduled: false,
        });
        return false;
      }
      return this.refreshCurrentHighlight();
    }

    getTutorialMirrorSources() {
      return {
        state: this.state,
        gameTutorial: this.game?.tutorial,
        gameStateTutorial: this.game?.state?.tutorial,
      };
    }

    observeTutorialDivergence(callSite = 'unknown') {
      const sources = this.getTutorialMirrorSources();
      const present = Object.entries(sources).filter(([, value]) => value !== null && value !== undefined);
      if (present.length < 2) return false;
      const serialized = present.map(([name, value]) => [name, stableSerialize(value)]);
      if (serialized.every(([, value]) => value === serialized[0][1])) return false;
      const witness = getGlobalWitness();
      const trace = {
        callSite,
        sources: Object.fromEntries(serialized),
      };
      witness.count += 1;
      witness.traces.push(trace);
      global.TutorialHostContextTrace?.log?.('tutorial-host-context-divergence', trace);
      return true;
    }

    getDivergenceWitness() {
      const witness = getGlobalWitness();
      return {
        count: witness.count,
        traces: witness.traces.map((trace) => ({ ...trace, sources: { ...trace.sources } })),
      };
    }

    resetDivergenceWitness() {
      const witness = getGlobalWitness();
      witness.count = 0;
      witness.traces.length = 0;
      return this.getDivergenceWitness();
    }

    invokeInterface(interfaceName, methodName, ...args) {
      const method = this[methodName];
      if (typeof method !== 'function') {
        throw new TypeError(`TutorialHostContext.${interfaceName} unknown method: ${methodName}`);
      }
      return method.apply(this, args);
    }

    effects(methodName, ...args) {
      return this.invokeInterface('effects', methodName, ...args);
    }

    waitFor(methodName, ...args) {
      return this.invokeInterface('waitFor', methodName, ...args);
    }

    requestAction(methodName, ...args) {
      return this.invokeInterface('requestAction', methodName, ...args);
    }

    resolveTarget(methodName, ...args) {
      return this.invokeInterface('resolveTarget', methodName, ...args);
    }

    queries(methodName, ...args) {
      if (!this.queryTable) {
        throw new TypeError('TutorialHostContext.queries table unavailable');
      }
      return this.queryTable.invoke(methodName, ...args);
    }

    next(step) {
      return this.advanceTo(step);
    }

    syncFromResultPayload(payload = {}) {
      if (
        payload
        && typeof payload === 'object'
        && ('tutorial' in payload || 'gameState' in payload)
      ) {
        const resultTutorial = payload.tutorial || payload.gameState?.tutorial || null;
        if (resultTutorial) return this.sync(resultTutorial);
        this.observeTutorialDivergence('TutorialGuideEventRegistry.syncFromResult:gameTutorial>state');
        this.sync(this.game?.tutorial || this.state);
      }
      return this.state;
    }

    closeFamousPersonsSurface() {
      this.game?.getPanelSurfaceManager?.()?.closePanel?.('famousPersons', { render: true });
      CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.game, 'showFamousPersons');
      this.game.famousPersonsPage = 0;
      this.game.selectedFamousPersonId = '';
      return true;
    }

    closeAdvisorSurface() {
      CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this.game, 'showAdvisor');
      this.game.tutorialAdvisorDialogue = null;
      if (this.game.canvasShell) this.game.canvasShell.tutorialAdvisorDialogue = null;
      return true;
    }

    clearTutorialSoftGuide() {
      this.game.canvasShell?.hideTutorialHighlight?.();
      StateWriter.commit(
        this.game,
        (prev) => ({ ...(prev || {}), softGuide: null }),
        { source: 'tutorialEvent:advisorClosed' },
      );
      return true;
    }

    hasActiveWorldExplorerMission() {
      return Boolean(this.game?.state?.worldExplorerState?.activeMission);
    }

    hideTutorialHighlight() {
      this.game?.canvasShell?.hideTutorialHighlight?.();
      return true;
    }

    getTargetActiveRenderTab() {
      return UiRuntimeStateStore?.getNavigation?.(this.game)?.activeTab
        || this.game?.state?.currentTab
        || 'resources';
    }

    queryCanvasTarget(type, predicate = null) {
      return this.game?.canvasShell?.getCanvasTarget?.(type, predicate) || null;
    }

    refreshTargetSurface(panelKey = '') {
      if (panelKey) {
        const shell = this.game?.canvasShell;
        const manager = shell?.getPanelSurfaceManager?.()
          || this.game?.getPanelSurfaceManager?.()
          || shell?.panelSurfaceManager
          || this.game?.panelSurfaceManager
          || null;
        return manager?.projectModalLayer?.({
          requestedPanelKey: panelKey,
          reason: 'tutorialHighlightTarget',
          source: 'tutorialTargetResolver',
        }) !== false;
      }
      this.game?.renderCanvasSurface?.(this.getTargetActiveRenderTab());
      return true;
    }

    getTargetState() {
      return this.game?.state || {};
    }

    resolveWorldSiteAnchorTarget(siteId = '') {
      const shell = this.game?.canvasShell || {};
      const runtimeContext = shell.worldMapRuntime?.getLastTileMapContext?.()
        || shell.worldMapRuntime?.lastTileMapContext
        || shell.worldMapRenderer?.lastWorldTileMapContext
        || shell.renderer?.lastWorldTileMapContext
        || null;
      const anchorSource = [
        shell.worldMapRenderer,
        shell.renderer,
        shell.worldActorLayerRenderer,
      ].find((source) => typeof source?.getWorldSiteCanvasAnchor === 'function') || null;
      if (!siteId || !anchorSource || !runtimeContext) {
        return { available: Boolean(anchorSource), target: null };
      }
      const anchor = anchorSource.getWorldSiteCanvasAnchor(siteId, this.getTargetState(), {
        worldMapRuntimeContext: runtimeContext,
        territoryUiState: shell.territoryUiState || this.game?.territoryUiState || {},
      });
      if (!anchor?.hitRect) return { available: true, target: null };
      const action = {
        type: 'openWorldSite',
        siteId: anchor.site?.id || anchor.siteId || siteId,
        tileId: anchor.tile?.id || anchor.tileId || '',
        inputSurface: 'worldMap',
      };
      const target = {
        ...anchor.hitRect,
        action,
        getRect: () => ({
          left: anchor.hitRect.x,
          top: anchor.hitRect.y,
          width: anchor.hitRect.width,
          height: anchor.hitRect.height,
          right: anchor.hitRect.x + anchor.hitRect.width,
          bottom: anchor.hitRect.y + anchor.hitRect.height,
        }),
        getBoundingClientRect: () => ({
          left: anchor.hitRect.x,
          top: anchor.hitRect.y,
          width: anchor.hitRect.width,
          height: anchor.hitRect.height,
          right: anchor.hitRect.x + anchor.hitRect.width,
          bottom: anchor.hitRect.y + anchor.hitRect.height,
        }),
      };
      return { available: true, target };
    }

    showTutorialHighlight(target, message, options = {}) {
      return this.game?.canvasShell?.showTutorialHighlight?.(target, message, options) || false;
    }

    openNaming(options = {}) {
      return this.game?.openNaming?.(options);
    }

    getTutorialCanvasSize() {
      const shell = this.game?.canvasShell || {};
      return {
        width: Number(shell.runtime?.width || shell.renderer?.width || shell.width || 0),
        height: Number(shell.runtime?.height || shell.renderer?.height || shell.height || 0),
      };
    }

    getGameState() {
      return this.game?.state || null;
    }

    isLoginPanelVisible() {
      return Boolean(
        this.game?.authView?.loginPanelVisible
        || this.game?.canvasShell?.auth?.view?.loginPanelVisible,
      );
    }

    hasServerState() {
      return Boolean(this.game?.hasServerState);
    }

    getTutorialStateFromGame() {
      return this.game?.tutorial || this.game?.state?.tutorial || null;
    }

    logTutorialError(error) {
      this.game?.log?.(error?.message || String(error));
    }

    setTutorialIntroState(viewState) {
      if (this.game && typeof this.game === 'object') this.game.tutorialIntro = viewState;
      if (this.game?.canvasShell && typeof this.game.canvasShell === 'object') {
        this.game.canvasShell.tutorialIntro = viewState;
      }
      return true;
    }

    renderTutorialIntro() {
      const shell = this.game?.canvasShell;
      if (shell?.renderActive) return shell.renderActive({ invalidateWorldTileView: false });
      if (this.game?.renderCanvasSurface) return this.game.renderCanvasSurface();
      if (this.game?.render) return this.game.render();
      return false;
    }

    getApi() {
      return this.api || this.game?.getGameApi?.() || this.game?.gameAPI || this.game?.api || null;
    }

    sync(tutorial) {
      let nextTutorial = tutorial;
      if (nextTutorial === undefined) {
        this.observeTutorialDivergence('TutorialHostContext.sync:gameTutorial>gameStateTutorial');
        nextTutorial = this.game?.tutorial || this.game?.state?.tutorial || {};
      }
      this.state = nextTutorial || {};
      if (this.game && typeof this.game === 'object') this.game.tutorial = this.state;
      return this.state;
    }

    getCurrentStep() {
      // Canonical step NAME (legacy numeric states normalize onto it).
      this.observeTutorialDivergence('TutorialHostContext.getCurrentStep:state>gameTutorial>gameStateTutorial');
      const rawStep = this.state?.currentStep ?? this.game?.tutorial?.currentStep ?? this.game?.state?.tutorial?.currentStep;
      return TutorialFlowShared.stepName(rawStep) || TUTORIAL_STEPS.initial;
    }

    isCompleted() {
      this.observeTutorialDivergence('TutorialHostContext.isCompleted:boolean-or');
      return Boolean(this.state?.completed || this.game?.tutorial?.completed || this.game?.state?.tutorial?.completed);
    }

    getStepPolicyContext() {
      return {
        step: this.getCurrentStep(),
        completed: this.isCompleted(),
      };
    }

    canOpenTab(tabId) {
      return TutorialGuideStepPolicy.canOpenTab(tabId, this.getStepPolicyContext());
    }

    handleEvent(eventName, payload = {}) {
      const report = this.changeEventBus?.emit?.(eventName, payload);
      const result = report?.results?.find((entry) => entry !== undefined);
      return result === undefined ? this.state : result;
    }

    async onTabClicked(tabId) {
      return this.handleEvent('tabClicked', { tabId });
    }

    async onCommandPanelOpened(panelId) {
      return this.handleEvent('commandPanelOpened', { panelId });
    }

    async advanceTo(step) {
      // Accepts step names and legacy numbers; the API is called with the NAME.
      const nextStep = TutorialFlowShared.stepName(step);
      if (!nextStep || TutorialFlowShared.compareSteps(nextStep, this.getCurrentStep()) <= 0) return this.state;
      const api = this.getApi();
      if (!api?.advanceTutorial) return this.sync({ ...(this.state || {}), currentStep: nextStep });
      const scheduler = api.scheduler || this.game?.runtime || global;
      const now = () => {
        const value = scheduler?.now?.();
        return Number.isFinite(Number(value)) ? Number(value) : Date.now();
      };
      const existing = this.pendingAdvanceByStep.get(nextStep);
      if (existing) {
        if (now() < existing.expiresAtMs) return existing.promise;
        this.expirePendingAdvance(nextStep, existing, now(), 'short-circuit');
      }
      const apiTimeoutMs = Number(api.timeoutMs);
      const timeoutMs = (Number.isFinite(apiTimeoutMs) && apiTimeoutMs > 0
        ? apiTimeoutMs
        : DEFAULT_API_TIMEOUT_MS) + this.advanceWatchdogJitterMs;
      let rejectWatchdog;
      const watchdog = new Promise((_resolve, reject) => {
        rejectWatchdog = reject;
      });
      const entry = {
        startedAtMs: now(),
        expiresAtMs: 0,
        timeoutMs,
        timeoutId: null,
        rejectWatchdog,
        expired: false,
        promise: null,
      };
      entry.expiresAtMs = entry.startedAtMs + timeoutMs;
      const request = (async () => {
        const result = await api.advanceTutorial(nextStep);
        if (entry.expired) return this.state;
        this.game?.applyApiState?.(result);
        return this.sync(result?.tutorial || this.game?.tutorial || this.state);
      })();
      entry.promise = Promise.race([request, watchdog])
        .finally(() => {
          if (this.pendingAdvanceByStep.get(nextStep) === entry) {
            this.pendingAdvanceByStep.delete(nextStep);
          }
          if (entry.timeoutId !== null && typeof scheduler?.clearTimeout === 'function') {
            scheduler.clearTimeout(entry.timeoutId);
          }
        });
      this.pendingAdvanceByStep.set(nextStep, entry);
      if (typeof scheduler?.setTimeout === 'function') {
        entry.timeoutId = scheduler.setTimeout(() => {
          this.expirePendingAdvance(nextStep, entry, now(), 'timer');
        }, timeoutMs);
      }
      return entry.promise;
    }

    expirePendingAdvance(nextStep, entry, expiredAtMs, reason = 'timer') {
      if (!entry || entry.expired || this.pendingAdvanceByStep.get(nextStep) !== entry) return false;
      entry.expired = true;
      this.pendingAdvanceByStep.delete(nextStep);
      const error = new Error(`Tutorial advance timed out after ${entry.timeoutMs}ms`);
      error.code = 'TUTORIAL_ADVANCE_WATCHDOG_TIMEOUT';
      error.step = nextStep;
      error.timeoutMs = entry.timeoutMs;
      recordAdvanceWatchdogTrace({
        stepKey: nextStep,
        startedAtMs: entry.startedAtMs,
        expiredAtMs,
        timeoutMs: entry.timeoutMs,
        reason,
      });
      entry.rejectWatchdog(error);
      return true;
    }

    async markCityEntered() {
      return this.handleEvent('cityEntered');
    }

    isHouseGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isHouseGuideActive(step, completed);
    }

    onBuildingAction(buildingId, action = 'build') {
      return this.handleEvent('buildingAction', { buildingId, action });
    }

    isFirstEraGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isFirstEraGuideActive(step, completed);
    }

    isFarmGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isFarmGuideActive(step, completed);
    }

    isEra2GuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isEra2GuideActive(step, completed);
    }

    isScoutFormationGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isScoutFormationGuideActive(step, completed);
    }

    isScoutExploreGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isScoutExploreGuideActive(step, completed);
    }

    isFirstCityGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isFirstCityGuideActive(step, completed);
    }

    isFinalTechGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isFinalTechGuideActive(step, completed);
    }

    isPostNamingSystemGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isPostNamingSystemGuideActive(step, completed);
    }

    isLumbermillGuideActive() {
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isLumbermillGuideActive(step, completed);
    }

    normalizePanelTab(panelId) {
      if (panelId === 'capital') return 'buildings';
      return panelId || '';
    }

    getActiveCommandPanel() {
      const g = this.game || {};
      const shell = g.canvasShell || null;
      return (shell && getCommandPanelValue(shell))
        || getCommandPanelValue(g.lastGame || g)
        || getCommandPanelValue(g)
        || '';
    }

    isCommandPanelOpen(panelId) {
      const active = this.getActiveCommandPanel();
      if (panelId === 'buildings') return active === 'buildings' || active === 'capital';
      return active === panelId;
    }

    isOnTab(tabId) {
      return CanvasModeOwnershipRuntime?.isCurrentTab?.(this.game, tabId) === true;
    }

    isTaskCenterOpen() {
      const g = this.game || {};
      const shell = g.canvasShell || {};
      // CanvasActionController 写 openBlockingPanelSnapshot(this.host) → host=canvasShell
      if (CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(shell, 'showTaskCenter')) return true;
      if (CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(g.lastGame || g, 'showTaskCenter')) return true;
      if (CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(g, 'showTaskCenter')) return true;
      // 兜底:openTaskCenter 同时会设 activeTaskCenterTab(host/game/canvasShell 多处)
      return Boolean(g.activeTaskCenterTab || shell.activeTaskCenterTab || (g.lastGame || {}).activeTaskCenterTab);
    }

    isCityManagementOpen() {
      return CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this.game, 'showCityManagement');
    }

    isCityManagementTabOpen(tab = '') {
      const activeTab = this.game?.activeCityManagementTab || '';
      return activeTab === tab;
    }

    isAdvisorOpen() {
      return Boolean(
        CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this.game, 'showAdvisor')
        || this.game?.canvasShell?.tutorialAdvisorDialogue
        || this.game?.tutorialAdvisorDialogue,
      );
    }

    isRewardRevealOpen() {
      return Boolean(this.game?.isRewardRevealSnapshotOpen?.());
    }

    onEraAdvanced(result = {}) {
      return this.handleEvent('eraAdvanced', { result });
    }

    onTaskRewardClaimed(result = {}) {
      return this.handleEvent('taskRewardClaimed', { result });
    }

    getScoutFamousPersonId() {
      this.observeTutorialDivergence(
        'TutorialHostContext.getScoutFamousPersonId:state>gameTutorial>gameStateTutorial',
      );
      const grantId = this.state?.grants?.scoutFamousPerson?.personId
        || this.game?.tutorial?.grants?.scoutFamousPerson?.personId
        || this.game?.state?.tutorial?.grants?.scoutFamousPerson?.personId
        || '';
      if (grantId) return String(grantId);
      const people = this.game?.state?.famousPersons?.people || [];
      const scout = Array.isArray(people)
        ? people.find((person) => person?.source?.type === 'tutorial' || person?.archetype === 'scout' || person?.abilityArchetype === 'scout')
        : null;
      return scout?.id ? String(scout.id) : '';
    }

    getArmyFormationEditor() {
      return CanvasModeOwnershipRuntime?.getFormationEditor?.(this.game) || {};
    }





    getWorldMarchTarget() {
      return TerritoryUiStateStore?.ensure?.(this.game)?.worldMarchTarget || null;
    }

    isWorldMarchTargetSelected() {
      const target = this.getWorldMarchTarget();
      return Boolean(target && Number.isFinite(Number(target.q)) && Number.isFinite(Number(target.r)));
    }

    isWorldMarchFormationPickerOpen() {
      return Boolean(
        this.game?.isTargetPickerSnapshotOpen?.()
          && this.game?.getTargetPickerSnapshot?.()?.pickerKind === 'worldMarchFormation',
      );
    }

    // When the scout actor still overlaps the discovered site tile, clicking it
    // resolves to the multi-candidate world target picker instead of a direct
    // openWorldSite. Return the site candidate so the first-city guide can
    // highlight choosing it (chooseWorldTarget) rather than stalling.
    getWorldTargetPickerSiteCandidate(siteId = '') {
      const snapshot = this.game?.getTargetPickerSnapshot?.();
      if (!snapshot || snapshot.pickerKind !== 'worldTargetPicker') return null;
      const candidates = Array.isArray(snapshot.picker?.candidates) ? snapshot.picker.candidates : [];
      const wanted = String(siteId || '');
      return (
        candidates.find((candidate) => {
          const action = candidate?.action || {};
          const candidateSiteId = String(action.siteId || action.cityId || action.territoryId || '');
          return (
            (action.type === 'openWorldSite' || candidate?.kind === 'site')
            && (!wanted || candidateSiteId === wanted)
          );
        }) || null
      );
    }

    isFamousPersonsOpen() {
      return CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this.game, 'showFamousPersons');
    }

    isFamousPersonDetailOpen() {
      return Boolean(this.game?.selectedFamousPersonId);
    }

    getActiveEventId() {
      return this.game?.getEventSnapshot?.()?.eventId
        || this.game?.eventController?.activeEventId
        || '';
    }

    getFirstExploreCityId() {
      this.observeTutorialDivergence(
        'TutorialHostContext.getFirstExploreCityId:state>gameTutorial>gameStateTutorial',
      );
      return this.state?.grants?.firstExploreEmptyCity?.siteId
        || this.game?.tutorial?.grants?.firstExploreEmptyCity?.siteId
        || this.game?.state?.tutorial?.grants?.firstExploreEmptyCity?.siteId
        || '';
    }

    // The grant points at the spawn companion city; the guide reads its coordinate to steer the
    // world-march target selection at that tile instead of picking an arbitrary map point.
    getFirstExploreCityGrant() {
      this.observeTutorialDivergence(
        'TutorialHostContext.getFirstExploreCityGrant:state>gameTutorial>gameStateTutorial',
      );
      return this.state?.grants?.firstExploreEmptyCity
        || this.game?.tutorial?.grants?.firstExploreEmptyCity
        || this.game?.state?.tutorial?.grants?.firstExploreEmptyCity
        || null;
    }

    getFirstExploreCityTarget() {
      const grant = this.getFirstExploreCityGrant();
      if (!grant) return null;
      const q = Number(grant.x ?? grant.q);
      const r = Number(grant.y ?? grant.r);
      if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
      // Only the q/r are needed to steer the world-march target selection; the guide matcher compares
      // the action's targetQ/targetR, so no tileId literal is constructed here (canonical-coord gate).
      return { q, r };
    }

    getCapitalCityId() {
      return this.game?.state?.cityState?.capitalCityId
        || this.game?.state?.activeCityId
        || this.game?.activeCityId
        || 'capital';
    }

    getTerritories() {
      return this.game?.state?.territoryState?.territories || [];
    }

    getFirstExploreCity() {
      const siteId = this.getFirstExploreCityId();
      return this.getTerritories().find((site) => site?.id === siteId) || null;
    }

    isWorldSiteSelected(siteId = '') {
      const selected = TerritoryUiStateStore?.ensure?.(this.game)?.selectedSiteId || '';
      return Boolean(siteId && selected === siteId);
    }

    isNamingOpen(type = '', territoryId = '') {
      const namingPrompt = this.game?.getNamingSnapshot?.()?.prompt || null;
      const prompt = this.game?.activeNamingPrompt
        || namingPrompt
        || this.game?.state?.territoryState?.namingPrompt
        || null;
      if (!prompt) return false;
      if (type && prompt.type !== type) return false;
      if (territoryId && prompt.territoryId !== territoryId) return false;
      return true;
    }

    getNamingInputValue() {
      return this.game?.getNamingInputValue?.() || '';
    }

    async onFamousPersonsOpened() {
      return this.handleEvent('famousPersonsOpened');
    }

    async onTalentPolicyOpened() {
      return this.handleEvent('talentPolicyOpened');
    }

    onTalentPolicyApplied(result = {}) {
      return this.handleEvent('tutorialStateChanged', { result });
    }

    onManualTalentAssigned(result = {}) {
      return this.handleEvent('tutorialStateChanged', { result });
    }

    onFamousPersonSought(result = {}) {
      return this.handleEvent('tutorialStateChanged', { result });
    }

    async onFamousPersonDetailOpened(personId = '') {
      return this.handleEvent('famousPersonDetailOpened', { personId });
    }

    async onArmyFormationOpened() {
      return this.handleEvent('armyFormationOpened');
    }

    onArmyFormationSaved(result = {}) {
      return this.handleEvent('armyFormationSaved', { result });
    }

    async onMilitaryViewSwitched(view = '') {
      return this.handleEvent('militaryViewSwitched', { view });
    }

    onFamousPersonsClosed() {
      return this.handleEvent('famousPersonsClosed');
    }

    onCityManagementOpened(tab = '') {
      return this.handleEvent('cityManagementOpened', { tab });
    }

    async onWorldMarchTargetSelected() {
      return this.handleEvent('worldMarchTargetSelected');
    }

    onExploreStarted(result = {}) {
      return this.handleEvent('exploreStarted', { result });
    }

    async onAdvisorClosed() {
      return this.handleEvent('advisorClosed');
    }

    getCanvasTarget(type, predicate = null) {
      return this.targetResolver?.getCanvasTarget(type, predicate) || null;
    }

    showHighlight(type, predicate, message, allowedAction, options = {}) {
      return this.targetResolver?.showHighlight(type, predicate, message, allowedAction, options) || false;
    }

    getCanvasTargetRect(target = {}) {
      return this.targetResolver?.getCanvasTargetRect(target) || null;
    }

    isCanvasTargetVisible(target = {}, padding = 8) {
      return this.targetResolver?.isCanvasTargetVisible(target, padding) || false;
    }

    showFirstCitySiteOpenHighlight(siteId = '') {
      return this.targetResolver?.showOpenWorldSiteHighlight({
        siteId,
        message: t('tutorial.guide.openDiscoveredEmptyCity'),
      }) || false;
    }

    showCapitalSiteOpenHighlight(siteId = this.getCapitalCityId()) {
      return this.targetResolver?.showOpenWorldSiteHighlight({
        siteId,
        message: t('tutorial.guide.openCapitalForScout'),
      }) || false;
    }



















    ensureMapHomeGuideVisible(options = {}) {
      const game = this.game || {};
      const shell = game.canvasShell || null;
      const clearWorldMarchTarget = options.clearWorldMarchTarget === true;
      let changed = false;
      const setIfChanged = (host, key, value) => {
        if (!host || host[key] === value) return;
        host[key] = value;
        changed = true;
      };
      if (game.state) {
        setIfChanged(game.state, 'currentTab', 'military');
        setIfChanged(game.state, 'militaryView', 'world');
      }
      setIfChanged(game, 'activeTab', 'military');
      setIfChanged(game, 'militaryView', 'world');
      setIfChanged(game, 'mapHomeActive', true);
      // Close the exact subset of blocking panels this reset cleared. Read the
      // canonical owner snapshot BEFORE closing so the 'changed' re-render gate stays
      // accurate.
      const closePanelIfChanged = (key) => {
        if (!CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(game, key)) return;
        CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, key);
        changed = true;
      };
      closePanelIfChanged('activeCommandPanel');
      closePanelIfChanged('showCityManagement');
      closePanelIfChanged('showSubcityList');
      closePanelIfChanged('showTaskCenter');
      closePanelIfChanged('showFamousPersons');
      game.closeEventSnapshot?.();
      this.closeArmyFormationEditorEverywhere();
      TerritoryUiStateStore?.clearWorldSelection?.(game, { clearWorldMarchTarget });
      if (clearWorldMarchTarget) game.territoryController?.closeSiteDialog?.({ render: false });
      if (shell) {
        setIfChanged(shell, 'mapHomeActive', true);
        // The 5 blocking-panel closes above fanned out to the shell via the adapter.
        shell.closeEventSnapshot?.();
        TerritoryUiStateStore?.ensure?.(shell);
      }
      shell?.hideTutorialHighlight?.();
      if (typeof shell?.renderReadOnly === 'function') {
        shell.renderReadOnly(game.state, 'military', { forceMapHome: true, isMapHome: true });
      } else if (changed || options.forceRender !== false) {
        game.renderCanvasSurface?.('military');
      }
      return true;
    }



    isTalentPolicyOpen() {
      return Boolean(this.isCityManagementOpen() && this.isCityManagementTabOpen('people'));
    }

    pickManualAssignAction() {
      const target = this.getCanvasTarget('assignJob', (action) => !isVisuallyDisabled(action) && Number(action.delta) > 0);
      if (target) return { target, action: target.action || { type: 'assignJob' } };
      const fallback = this.getCanvasTarget('assignJob', (action) => !isVisuallyDisabled(action) && Number(action.delta) !== 0);
      return fallback ? { target: fallback, action: fallback.action || { type: 'assignJob' } } : null;
    }






    clearBlockingCommandPanels() {
        const game = this.game || {};
        let changed = false;
        if (CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(game, 'activeCommandPanel')) {
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, 'activeCommandPanel');
          changed = true;
        }
        return changed;
      }

    showSoftGuide(target, message) {
        const game = this.game || {};
        game.canvasShell?.hideTutorialHighlight?.();
        const dialogue = { message, advisorName: t('tutorial.advisorName'), source: `softGuide:${target || 'tutorial'}` };
        StateWriter.commit(game, (prev) => ({
          ...(prev || {}),
          softGuide: {
            mode: 'strong',
            target,
            message,
          },
        }), { source: 'tutorialUiState:softGuide' });
        CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, 'showAdvisor');
        game.tutorialAdvisorDialogue = dialogue;
        if (game.canvasShell) {
          game.canvasShell.tutorialAdvisorDialogue = dialogue;
        }
        if (target !== 'tech-tree') this.clearBlockingCommandPanels();
        game.renderCanvasSurface?.(getCurrentRenderTab(game));
        return true;
      }

    getClosedArmyFormationEditor() {
        return { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
      }

    closeArmyFormationEditorEverywhere() {
        const game = this.game || {};
        return CanvasModeOwnershipRuntime?.closeFormationEditor?.(game)
          || this.getClosedArmyFormationEditor();
      }

    showCapitalEnterHighlight(siteId = this.getCapitalCityId()) {
        return this.showHighlight(
          'enterCity',
          (action) => !isVisuallyDisabled(action) && (!siteId || action.cityId === siteId || action.territoryId === siteId || action.siteId === siteId),
          t('tutorial.guide.enterCapitalForScout'),
          { type: 'enterCity', cityId: siteId },
        );
      }

    focusCapitalSite(siteId = this.getCapitalCityId()) {
        if (!siteId) return false;
        const shell = this.game?.canvasShell || null;
        const actionController = shell?.actionController || this.game?.actionController || null;
        if (typeof actionController?.centerWorldMapOnSite === 'function') {
          actionController.centerWorldMapOnSite(siteId);
        }
        this.ensureMapHomeGuideVisible();
        const highlighted = this.showCapitalSiteOpenHighlight(siteId);
        if (!highlighted) {
          setTimeout(() => this.showCapitalSiteOpenHighlight(siteId), 80);
        }
        return highlighted;
      }

    focusFirstCitySite(siteId = '') {
        if (!siteId || this.focusedFirstCitySiteId === siteId) return false;
        const shell = this.game?.canvasShell || null;
        const actionController = shell?.actionController || this.game?.actionController || null;
        let changed = false;
        if (typeof actionController?.centerWorldMapOnSite === 'function') {
          changed = actionController.centerWorldMapOnSite(siteId) !== false;
        }
        if (!changed) return false;
        this.game?.renderCanvasSurface?.(getCurrentRenderTab(this.game));
        shell?.renderActive?.();
        if (this.showFirstCitySiteOpenHighlight(siteId)) {
          this.focusedFirstCitySiteId = siteId;
        }
        setTimeout(() => {
          if (this.showFirstCitySiteOpenHighlight(siteId)) {
            this.focusedFirstCitySiteId = siteId;
          }
        }, 80);
        return true;
      }

    prepareCommandPanelGuide(panelId) {
        const game = this.game || {};
        const shell = game.canvasShell || null;
        let changed = false;
        // The adapter reads/writes the canonical modal owner; read the snapshot BEFORE
        // closing so the 'changed' re-render gate stays accurate.
        const closeIfOpen = (key) => {
          if (CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(game, key)) {
            CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, key);
            changed = true;
          }
        };
        const activeCommandPanel = getCommandPanelValue(game);
        if (activeCommandPanel && activeCommandPanel !== panelId) {
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, 'activeCommandPanel');
          changed = true;
        }
        closeIfOpen('showCityManagement');
        closeIfOpen('showSubcityList');
        closeIfOpen('showTaskCenter');
        closeIfOpen('showFamousPersons');
        if (game.selectedFamousPersonId) {
          game.selectedFamousPersonId = '';
          changed = true;
        }
        if (game.isEventSnapshotOpen?.()) {
          game.closeEventSnapshot?.();
          changed = true;
        } else if (shell?.isEventSnapshotOpen?.()) {
          shell.closeEventSnapshot?.();
          changed = true;
        }
        if (changed) {
          shell?.hideTutorialHighlight?.();
          game.renderCanvasSurface?.(getCurrentRenderTab(game));
        }
        return changed;
      }

    ensureBuildingGuideVisible() {
        const game = this.game || {};
        CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, 'showCityManagement');
        CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(game, 'activeCommandPanel', 'buildings');
        game.closeEventSnapshot?.();
        CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, 'showTaskCenter');
        return true;
      }

    getBuildingCategory(buildingId) {
        const config = this.game?.state?.buildingDefinitions?.[buildingId]
          || this.game?.state?.buildingConfig?.buildings?.[buildingId]
          || this.game?.buildingConfig?.buildings?.[buildingId]
          || null;
        return config?.category || 'all';
      }

    focusBuildingCard(buildingId) {
        const category = this.getBuildingCategory(buildingId);
        const game = this.game || {};
        game.activeBuildingCategory = category;
        game.buildingOffset = 0;
        game.buildingTransition = null;
        return true;
      }

    ensureCityPeopleGuideVisible(options = {}) {
        const game = this.game || {};
        const shell = game.canvasShell || null;
        let changed = false;
        const setIfChanged = (host, key, value) => {
          if (!host || host[key] === value) return;
          host[key] = value;
          changed = true;
        };
        // Read the snapshot BEFORE mutating so the 'changed' re-render gate stays accurate.
        const openPanelIfChanged = (key, value) => {
          const open = CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(game, key);
          if (open === Boolean(value)) return;
          CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(game, key, value);
          changed = true;
        };
        const closePanelIfChanged = (key) => {
          if (!CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(game, key)) return;
          CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, key);
          changed = true;
        };
        if (game.state) {
          setIfChanged(game.state, 'currentTab', 'military');
          setIfChanged(game.state, 'militaryView', 'world');
        }
        setIfChanged(game, 'activeTab', 'military');
        setIfChanged(game, 'militaryView', 'world');
        setIfChanged(game, 'mapHomeActive', true);
        setIfChanged(game, 'activeCityManagementTab', 'people');
        openPanelIfChanged('showCityManagement', true);
        closePanelIfChanged('showTaskCenter');
        closePanelIfChanged('showFamousPersons');
        closePanelIfChanged('showSubcityList');
        closePanelIfChanged('activeCommandPanel');
        if (game.isEventSnapshotOpen?.()) {
          game.closeEventSnapshot?.();
          changed = true;
        }
        TerritoryUiStateStore?.clearWorldSelection?.(game, { clearWorldMarchTarget: true });
        if (shell) TerritoryUiStateStore?.ensure?.(shell);
        game.territoryController?.closeSiteDialog?.({ render: false });
        shell?.closeWorldSiteHud?.({ render: false });
        shell?.hideTutorialHighlight?.();
        if (typeof shell?.renderReadOnly === 'function') {
          shell.renderReadOnly(game.state, 'military', {
            forceMapHome: true,
            isMapHome: true,
          });
        } else if (changed || options.forceRender !== false) {
          game.renderCanvasSurface?.('military');
        }
        return true;
      }

    getCityPeopleGuideHighlightOptions() {
        return {
          renderActiveTab: 'military',
          renderOptions: {
            forceMapHome: true,
            isMapHome: true,
          },
        };
      }

    showBuildingGuide(buildingId, message) {
        this.ensureBuildingGuideVisible();
        this.focusBuildingCard(buildingId);
        return this.showHighlight(
          'buildBuilding',
          (action) => !isVisuallyDisabled(action) && action.buildingId === buildingId,
          message,
          { type: 'buildBuilding', buildingId },
        );
      }

    hasStepScript(stepKey = this.getCurrentStep()) {
      return Boolean(
        this.stepScriptConfig
        && Object.prototype.hasOwnProperty.call(this.stepScriptConfig, stepKey),
      );
    }

    evaluateStepScript(stepKey = this.getCurrentStep()) {
      if (!this.stepScriptRunner?.evaluate || !this.hasStepScript(stepKey)) return null;
      const projection = this.stepScriptRunner.evaluate({
        stepKey,
        config: this.stepScriptConfig,
        ctx: this,
      });
      recordStepScriptTrace(projection?.trace || { stepKey });
      return projection;
    }

    renderStepScriptHighlight(instruction = {}) {
      const target = String(instruction.target || '');
      const message = t(instruction.messageKey || '');
      if (target === 'openCommandPanel') {
        const panel = String(instruction.panel || '');
        if (!panel) throw new TypeError('Tutorial StepScript openCommandPanel target is missing panel');
        this.requestAction('prepareCommandPanelGuide', panel);
        return this.requestAction(
          'showHighlight',
          'openCommandPanel',
          (action) => !isVisuallyDisabled(action) && action.panel === panel,
          message,
          { type: 'openCommandPanel', panel },
        );
      }
      if (target === 'advanceEra') {
        return this.requestAction(
          'showHighlight',
          'advanceEra',
          (action) => !isVisuallyDisabled(action),
          message,
          { type: 'advanceEra' },
        );
      }
      if (target === 'openTaskCenter') {
        return this.requestAction(
          'showHighlight',
          'openTaskCenter',
          (action) => !isVisuallyDisabled(action) && (action.tab || 'main') === 'main',
          message,
          { type: 'openTaskCenter' },
        );
      }
      if (target.startsWith('claimTaskReward:')) {
        const taskId = target.slice('claimTaskReward:'.length);
        if (!taskId) throw new TypeError('Tutorial StepScript claimTaskReward target is missing task id');
        return this.requestAction(
          'showHighlight',
          'claimTaskReward',
          (action) => !isVisuallyDisabled(action) && action.taskId === taskId,
          message,
          { type: 'claimTaskReward', taskId, category: 'main' },
        );
      }
      throw new TypeError(`Tutorial StepScript unknown highlight target: ${target}`);
    }

    renderStepScriptInstruction(instruction = {}) {
      if (instruction.type === 'highlightActionWait') {
        return this.renderStepScriptHighlight(instruction);
      }
      if (instruction.type === 'ensureSurfaceThenHighlight') {
        const panel = String(instruction.panel || '');
        if (instruction.target !== 'openCommandPanel' || !panel) {
          throw new TypeError('Tutorial StepScript ensureSurfaceThenHighlight target is invalid');
        }
        this.requestAction('prepareCommandPanelGuide', panel);
        return this.requestAction(
          'showHighlight',
          'openCommandPanel',
          (action) => !isVisuallyDisabled(action) && action.panel === panel,
          t(instruction.messageKey || ''),
          { type: 'openCommandPanel', panel },
        );
      }
      if (instruction.type === 'waitEventThenNext') {
        this.requestAction('hideTutorialHighlight');
        return false;
      }
      throw new TypeError(`Tutorial StepScript unknown instruction: ${instruction.type || ''}`);
    }

    isLegacyOverlayActive() {
      return Boolean(this.isAdvisorOpen?.() || this.isRewardRevealOpen?.());
    }

    refreshLegacyHighlight() {
      if (!this.flowRegistry && SharedTutorialGuideFlowRegistry?.create) {
        this.flowRegistry = SharedTutorialGuideFlowRegistry.create({
          steps: TutorialHostContext.TUTORIAL_STEPS || {},
        });
      }
      return this.flowRegistry?.refresh?.(this) || false;
    }

    scheduleTrailingHighlightRefresh() {
      if (this.highlightRefreshTrailingScheduled || this.highlightRefreshTrailing) return false;
      this.highlightRefreshTrailingScheduled = true;
      const runtime = this.game?.runtime || global;
      const run = () => {
        this.highlightRefreshTrailingScheduled = false;
        if (!this.highlightRefreshPending) return;
        this.highlightRefreshPending = false;
        this.highlightRefreshTrailing = true;
        try {
          this.refreshCurrentHighlight();
        } finally {
          this.highlightRefreshTrailing = false;
          if (this.highlightRefreshPending) {
            this.highlightRefreshPending = false;
            recordRefreshReentryTrace({
              stepKey: this.getCurrentStep(),
              phase: 'trailing-self-drop',
              trailingScheduled: false,
            });
          }
        }
      };
      if (typeof runtime?.queueMicrotask === 'function') runtime.queueMicrotask(run);
      else Promise.resolve().then(run);
      return true;
    }

    refreshCurrentHighlight() {
      if (getActiveRenderPhase(this)) {
        recordRenderRefreshDrop(this);
        return false;
      }
      const transaction = getHighlightRefreshTransaction(this);
      if (transaction.active) {
        this.highlightRefreshPending = true;
        const trailingScheduled = this.highlightRefreshTrailing
          ? false
          : this.scheduleTrailingHighlightRefresh();
        recordRefreshReentryTrace({
          stepKey: this.getCurrentStep(),
          phase: this.highlightRefreshTrailing ? 'trailing' : 'primary',
          trailingScheduled,
        });
        return false;
      }
      this.highlightRefreshActive = true;
      transaction.active = true;
      try {
        const stepKey = this.getCurrentStep();
        if (!this.hasStepScript(stepKey)) return this.refreshLegacyHighlight();
        const projection = this.evaluateStepScript(stepKey);
        if (this.isLegacyOverlayActive()) return this.refreshLegacyHighlight();
        const instruction = projection?.instructions?.[0] || null;
        if (!instruction) {
          recordStepScriptIdleTrace(stepKey, projection);
          return false;
        }
        return this.renderStepScriptInstruction(instruction) || false;
      } finally {
        this.highlightRefreshActive = false;
        transaction.active = false;
      }
    }
}

  TutorialHostContext.TUTORIAL_STEPS = TUTORIAL_STEPS;
  TutorialHostContext.TutorialGuideStepPolicy = TutorialGuideStepPolicy;
  TutorialHostContext.TutorialGuideTargetResolver = SharedTutorialGuideTargetResolver;
  TutorialHostContext.getDivergenceWitness = () => {
    const witness = getGlobalWitness();
    return { count: witness.count, traces: witness.traces.map((trace) => ({ ...trace })) };
  };
  TutorialHostContext.resetDivergenceWitness = () => {
    const witness = getGlobalWitness();
    witness.count = 0;
    witness.traces.length = 0;
    return TutorialHostContext.getDivergenceWitness();
  };
  TutorialHostContext.getStepScriptTrace = getStepScriptTraceSnapshot;
  TutorialHostContext.resetStepScriptTrace = resetStepScriptTrace;
  TutorialHostContext.getRefreshReentryTrace = getRefreshReentryTraceSnapshot;
  TutorialHostContext.resetRefreshReentryTrace = resetRefreshReentryTrace;
  TutorialHostContext.getRenderRefreshDropTrace = getRenderRefreshDropTraceSnapshot;
  TutorialHostContext.resetRenderRefreshDropTrace = resetRenderRefreshDropTrace;
  TutorialHostContext.getAdvanceWatchdogTrace = getAdvanceWatchdogTraceSnapshot;
  TutorialHostContext.resetAdvanceWatchdogTrace = resetAdvanceWatchdogTrace;
  const nodeProcess = global.process || null;
  if (
    nodeProcess?.env?.TUTORIAL_WITNESS_ASSERT_ZERO === '1'
    && !global.__tutorialHostContextExitGuardInstalled
  ) {
    global.__tutorialHostContextExitGuardInstalled = true;
    nodeProcess.on('exit', () => {
      const witness = TutorialHostContext.getDivergenceWitness();
      if (witness.count === 0) return;
      console.error(`[tutorial-host-context-witness] expected 0, received ${witness.count}`);
      console.error(JSON.stringify(witness.traces.slice(0, 10), null, 2));
      nodeProcess.exitCode = 1;
    });
  }
  global.TutorialHostContext = TutorialHostContext;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialHostContext;
})(typeof window !== 'undefined' ? window : globalThis);
