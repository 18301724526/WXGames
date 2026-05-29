(function (global) {
  class CanvasGameApp {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      const runtimeRequired = options.runtimeRequired !== false;
      if (!this.runtime && runtimeRequired) throw new Error('Canvas game runtime is required');
      this.presenter = options.presenter || null;
      this.config = options.config || {};
      const ApiClass = options.apiClass || null;
      const RendererClass = options.rendererClass || null;
      const apiRequired = options.apiRequired !== false;
      this.api = options.api || (ApiClass ? new ApiClass(
        options.apiBase || this.config.API_BASE || '/api',
        this.runtime?.getStorage?.('token'),
        { transport: this.runtime },
      ) : null);
      if (!this.api && apiRequired) throw new Error('Canvas game API is required');
      const rendererRequired = options.rendererRequired !== false;
      this.renderer = options.renderer || (RendererClass ? new RendererClass({
        runtime: this.runtime,
        presenter: this.presenter,
      }) : null);
      if (!this.renderer && rendererRequired) throw new Error('Canvas game renderer is required');
      if (typeof this.renderer?.setAssetsChangedHandler === 'function') {
        this.renderer.setAssetsChangedHandler(() => this.render());
      }
      this.loading = {
        visible: false,
        percentage: 0,
        message: '',
      };
      this.syncIntervalMs = options.syncIntervalMs || this.config.SYNC_INTERVAL_MS || 2000;
      this.state = options.initialState || {
        resources: {},
        population: {},
        currentEra: 0,
        softGuide: null,
      };
      this.activeTab = options.activeTab || 'resources';
      this.militaryView = options.militaryView || this.state.militaryView || 'army';
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showTaskCenter = false;
      this.activeTaskCenterTab = 'main';
      this.showGuidebook = false;
      this.activeGuidebookTab = 'planning';
      this.showFamousPersons = false;
      this.showTalentPolicy = false;
      this.talentPolicyUiState = {};
      this.rewardReveal = null;
      this.battleScene = null;
      this.battleSceneTimer = null;
      this.battleAnimationTimer = null;
      this.tutorialHighlight = null;
      this.highlightTimer = null;
      this.skipNextSoftGuideRender = false;
      this.suppressSoftGuideRenderOnce = false;
      this.activeGuideNavigation = null;
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.techDetailOpen = false;
      if (this.canvasShell) this.canvasShell.selectedTechId = '';
      if (this.canvasShell) this.canvasShell.techDetailOpen = false;
      this.state = {
        ...this.state,
        techUiState: {
          ...(this.state.techUiState || {}),
          selectedTechId: '',
          detailOpen: false,
        },
      };
      this.techTreeDragStart = null;
      this.pageTransition = null;
      this.buildingTransition = null;
      this.transitionTimer = null;
      this.lastAnimationRenderAt = 0;
      this.activeEventId = null;
      this.naming = {
        visible: false,
        view: null,
        prompt: null,
        inputValue: '',
        submitting: false,
      };
      this.territoryUiState = {
        selectedSiteId: '',
        worldPanX: 0,
        worldPanY: 0,
        expeditionConfigSiteId: '',
        expeditionTroopType: '',
        expeditionLeader: '',
        expeditionSoldiers: '',
      };
      this.externalLog = typeof options.log === 'function' ? options.log : null;
      this.stateNormalizer = options.stateNormalizer || null;
      this.stateManager = options.stateManager || null;
      this.tutorialController = options.tutorialController || null;
      this.tutorialRenderer = options.tutorialRenderer || null;
      this.eventController = options.eventController || null;
      this.buildingController = options.buildingController || null;
      this.territoryController = options.territoryController || null;
      this.canvasShell = options.canvasShell || null;
      this.syncService = options.syncService || null;
      this.updateChecker = options.updateChecker || null;
      this.scheduler = options.scheduler || this.runtime || null;
      this.requestLogs = [];
      this.recentLogs = [];
      this.activeAdvisor = null;
      this.activeNamingPrompt = null;
      this.activeNamingPromptKey = null;
      this.scoutCountdownTimer = null;
      const DispatcherCtor = global.CanvasActionDispatcher;
      this.actionDispatcher = options.actionDispatcher || (DispatcherCtor ? new DispatcherCtor() : null);
      const ActionControllerCtor = global.CanvasActionController || (typeof require === 'function' ? require('./CanvasActionController') : null);
      this.actionController = options.actionController || (ActionControllerCtor ? new ActionControllerCtor({
        host: this,
        awaitAsync: true,
        log: (message) => this.log(message),
      }) : null);
      const GuideControllerCtor = global.CanvasGuideController || (typeof require === 'function' ? require('./CanvasGuideController') : null);
      this.guideController = options.guideController || (GuideControllerCtor ? new GuideControllerCtor({
        host: this,
        actionDispatcher: this.actionDispatcher,
      }) : null);
      this.timer = null;
      this.tapDisposer = null;
      this.dragDisposer = null;
      this.gestureDisposer = null;
    }

    applyState(payload = {}) {
      const nextState = payload.gameState || payload.state || this.state;
      const nextTutorial = payload.tutorial ?? nextState.tutorial ?? this.tutorial ?? {};
      const localTab = this.getActiveTab();
      const localMilitaryView = this.state?.militaryView || this.militaryView || nextState.militaryView || 'army';
      this.state = {
        ...nextState,
        currentTab: localTab,
        militaryView: localMilitaryView,
        softGuide: payload.softGuide ?? nextState.softGuide ?? null,
        guideTasks: payload.guideTasks ?? nextState.guideTasks ?? { visible: false, tasks: [] },
        taskCenter: payload.taskCenter ?? nextState.taskCenter ?? null,
        eraProgress: payload.eraProgress ?? nextState.eraProgress,
      };
      this.tutorial = nextTutorial;
      this.activeTab = this.state.currentTab || localTab;
      this.militaryView = this.state.militaryView || localMilitaryView;
      const api = this.getGameApi();
      if (payload.token && api) {
        api.setToken?.(payload.token);
        this.runtime?.setStorage?.('token', payload.token);
      }
      this.render();
    }

    getGameApi() {
      return this.gameAPI || this.api;
    }

    applyApiState(data = {}) {
      if (this.stateNormalizer?.normalizeGameState) {
        const nextState = this.stateNormalizer.normalizeGameState(data);
        this.tutorial = this.stateNormalizer.normalizeTutorialState?.(data) || this.tutorial || {};
        this.syncFromServer(nextState, data.tutorial, data.eraProgress);
        return;
      }
      this.applyState(data);
    }

    syncFromServer(serverState, tutorial, eraProgress) {
      const localTab = this.getActiveTab();
      const localMilitaryView = this.state?.militaryView || this.militaryView || 'army';
      if (this.stateManager && typeof this.stateManager === 'object') {
        this.stateManager.state = {
          ...(this.stateManager.state || {}),
          ...(this.state || {}),
          currentTab: localTab,
          militaryView: localMilitaryView,
        };
      }
      this.state = this.stateManager?.sync
        ? this.stateManager.sync(serverState, eraProgress)
        : {
          ...serverState,
          currentTab: localTab,
          militaryView: localMilitaryView,
          eraProgress: eraProgress ?? serverState?.eraProgress,
        };
      this.activeTab = this.state.currentTab || localTab;
      this.militaryView = this.state.militaryView || localMilitaryView;
      const nextTutorial = this.getEffectiveTutorialState(tutorial || this.tutorial || {});
      this.tutorial = nextTutorial;
      this.tutorialController?.setState?.(nextTutorial);
      this.updateSyncInterval();
      this.render();
    }

    getSyncInterval() {
      const step = this.tutorialController?.state?.currentStep ?? this.tutorial?.currentStep;
      if (step === 8) return this.config?.TUTORIAL_WAIT_SYNC_INTERVAL_MS || 500;
      return this.config?.SYNC_INTERVAL_MS || this.syncIntervalMs;
    }

    updateSyncInterval() {
      this.syncService?.setIntervalMs?.(this.getSyncInterval());
    }

    getBuildingLevel(buildingId) {
      const entry = this.state?.buildings?.[buildingId];
      if (!entry) return 0;
      return typeof entry === 'object' ? entry.level || 0 : Number(entry) || 0;
    }

    isEra2AdvanceReady(progress = this.state?.eraProgress) {
      return this.state?.currentEra === 1
        && Boolean(progress?.canAdvance)
        && this.getBuildingLevel('house') > 0;
    }

    getEffectiveTutorialState(tutorial) {
      const nextTutorial = tutorial || { completed: false, currentStep: 0, phaseCompleted: { newbie: false, era2: false } };
      if (!nextTutorial.completed && nextTutorial.currentStep === 8 && this.isEra2AdvanceReady()) {
        return {
          ...nextTutorial,
          currentStep: 9,
          phaseCompleted: {
            ...nextTutorial.phaseCompleted,
            newbie: true,
          },
        };
      }
      return nextTutorial;
    }

    canAdvanceEraByTutorial() {
      return this.presenter?.canAdvanceEraByTutorial?.(this.state, this.tutorialController?.state || this.tutorial || {}) !== false;
    }

    canAdvanceEraNow(progress = this.state?.eraProgress) {
      const view = this.presenter?.buildCivilizationViewState?.(
        { ...this.state, eraProgress: progress },
        this.tutorialController?.state || this.tutorial || {},
        { canOpenCivilizationTab: !this.tutorialController || this.tutorialController.canOpenTab?.('civilization') !== false },
      );
      return Boolean(view?.advanceButton?.canAdvance);
    }

    hasActiveTutorialGuideHighlight() {
      const tutorial = this.tutorialController?.state || this.tutorial || {};
      const currentStep = Number(tutorial.currentStep) || 0;
      if (tutorial.completed || currentStep <= 0) return false;
      const isSoftStep = typeof this.tutorialController?.isSoftGuideStep === 'function'
        ? this.tutorialController.isSoftGuideStep()
        : currentStep === 8;
      if (isSoftStep) return false;
      const hasVisibleGuideTask = typeof this.tutorialController?.hasVisibleGuideTask === 'function'
        ? this.tutorialController.hasVisibleGuideTask()
        : false;
      return !hasVisibleGuideTask;
    }

    render() {
      this.renderMilitaryView();
      this.tutorialController?.render?.();
      this.renderSoftGuide({ skipSurface: true });
      this.maybeShowNamingPrompt();
      this.renderCanvasSurface();
    }

    renderCanvasSurface(activeTab = this.getActiveTab()) {
      const resolvedActiveTab = activeTab || this.getActiveTab();
      if (this.canvasShell?.previewEnabled || typeof this.canvasShell?.renderReadOnly === 'function') {
        if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = this.pageTransition;
        if (this.canvasShell && typeof this.canvasShell.buildingTransition !== 'undefined') this.canvasShell.buildingTransition = this.buildingTransition;
        if (this.canvasShell && typeof this.canvasShell.techTreeZoom !== 'undefined') this.canvasShell.techTreeZoom = this.techTreeZoom;
        if (this.canvasShell && typeof this.canvasShell.buildingOffset !== 'undefined') this.canvasShell.buildingOffset = this.buildingOffset;
        if (this.canvasShell && typeof this.canvasShell.activeBuildingCategory !== 'undefined') this.canvasShell.activeBuildingCategory = this.activeBuildingCategory;
        this.canvasShell.renderReadOnly(this.state, resolvedActiveTab);
        return true;
      }
      if (!this.renderer?.render) return false;
      this.renderer.render(this.state, {
        activeTab: resolvedActiveTab,
        showResourceDetails: this.showResourceDetails,
        showCitySwitcher: this.showCitySwitcher,
        showTaskCenter: this.showTaskCenter,
        activeTaskCenterTab: this.activeTaskCenterTab,
        showGuidebook: this.showGuidebook,
        activeGuidebookTab: this.activeGuidebookTab,
        showFamousPersons: this.showFamousPersons,
        showTalentPolicy: this.showTalentPolicy,
        talentPolicyUiState: this.talentPolicyUiState,
        rewardReveal: this.rewardReveal,
        buildingOffset: this.buildingOffset,
        techTreePanX: this.techTreePanX,
        techTreePanY: this.techTreePanY,
        techTreeZoom: this.getTechTreeZoom(),
        selectedTechId: this.state?.techUiState?.selectedTechId || this.canvasShell?.selectedTechId || '',
        techDetailOpen: this.techDetailOpen || Boolean(this.state?.techUiState?.detailOpen || this.canvasShell?.techDetailOpen),
        activeBuildingCategory: this.activeBuildingCategory,
        ...(this.pageTransition ? { pageTransition: this.pageTransition } : {}),
        ...(this.buildingTransition ? { buildingTransition: this.buildingTransition } : {}),
        activeEventId: this.activeEventId,
        territoryUiState: this.territoryUiState,
        ...(this.battleScene ? { battleScene: this.battleScene } : {}),
        naming: this.naming,
        tutorialHighlight: this.tutorialHighlight,
        loading: this.loading,
      });
      return true;
    }

    showLoading(message = '') {
      this.loading = {
        visible: true,
        percentage: 0,
        message: message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90',
      };
      this.canvasShell?.showLoading?.(this.loading.message);
      this.renderCanvasSurface();
      return true;
    }

    updateLoading(progress = {}) {
      if (!this.loading.visible && !this.canvasShell?.loading?.visible) return false;
      this.loading = {
        ...this.loading,
        visible: true,
        percentage: Math.max(0, Math.min(100, Number(progress.percentage) || 0)),
        message: progress.message || this.loading.message,
      };
      this.canvasShell?.updateLoading?.(this.loading);
      this.renderCanvasSurface();
      return true;
    }

    hideLoading() {
      const hadLoading = Boolean(this.loading.visible || this.canvasShell?.loading?.visible);
      this.loading = {
        visible: false,
        percentage: 100,
        message: '',
      };
      this.canvasShell?.hideLoading?.();
      if (hadLoading) this.renderCanvasSurface();
      return hadLoading;
    }

    preloadAssets(onProgress = null, assetPaths = null) {
      if (this.canvasShell && typeof this.canvasShell.preloadAssets === 'function') {
        return this.canvasShell.preloadAssets(onProgress, assetPaths);
      }
      if (!this.renderer || typeof this.renderer.preloadAssets !== 'function') {
        onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
        return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
      }
      return this.renderer.preloadAssets(assetPaths || undefined, onProgress);
    }

    now() {
      return this.runtime?.now?.() || Date.now();
    }

    wait(ms = 0) {
      const delay = Math.max(0, Number(ms) || 0);
      if (delay <= 0) return Promise.resolve();
      if (this.scheduler && typeof this.scheduler.setTimeout === 'function') {
        return new Promise((resolve) => this.scheduler.setTimeout(resolve, delay));
      }
      if (typeof setTimeout === 'function') {
        return new Promise((resolve) => setTimeout(resolve, delay));
      }
      return Promise.resolve();
    }

    async loadGameAssets(options = {}) {
      const message = options.message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90';
      const minimumDurationMs = Number.isFinite(options.minimumDurationMs)
        ? Math.max(0, options.minimumDurationMs)
        : 3000;
      const startedAt = this.now();
      this.showLoading(message);
      try {
        const result = await this.preloadAssets((progress) => {
          this.updateLoading({ ...progress, message });
        }, options.assetPaths || null);
        const elapsed = Math.max(0, this.now() - startedAt);
        await this.wait(Math.max(0, minimumDurationMs - elapsed));
        return result;
      } finally {
        this.updateLoading({ percentage: 100, message });
        this.hideLoading();
      }
    }

    getActiveTab() {
      return this.activeTab || this.state?.currentTab || 'resources';
    }

    getTabOrder() {
      return ['resources', 'buildings', 'tech', 'events', 'civilization', 'military'];
    }

    getTransitionDurationMs() {
      return 220;
    }

    getAnimationFrameMs() {
      return this.canvasShell?.getAnimationFrameMs?.() || 16;
    }

    renderAnimationFrame(activeTab = this.state?.currentTab || this.getActiveTab()) {
      if (this.canvasShell && typeof this.canvasShell.renderAnimationFrame === 'function') {
        return this.canvasShell.renderAnimationFrame();
      }
      const now = this.now();
      const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
      if (this.lastAnimationRenderAt && now - this.lastAnimationRenderAt < frameMs) return false;
      this.lastAnimationRenderAt = now;
      return this.renderCanvasSurface(activeTab);
    }

    getBattleBaseTurnDurationMs() {
      return 900;
    }

    getBattleSkillCutInDurationMs() {
      return 2200;
    }

    getBattleTurnDurationMs(turn = null) {
      const isSkill = turn && (turn.action === 'skill' || turn.actionType === 'skill' || turn.presentation?.cutIn);
      return this.getBattleBaseTurnDurationMs() + (isSkill ? this.getBattleSkillCutInDurationMs() : 0);
    }

    getCurrentBattleTurnDurationMs(scene = this.battleScene) {
      const turns = scene?.report?.turns || [];
      const index = Math.max(0, Math.min(turns.length, Number(scene?.turnIndex) || 0));
      return this.getBattleTurnDurationMs(index < turns.length ? turns[index] : null);
    }

    syncBattleSceneToShell() {
      if (this.canvasShell) this.canvasShell.battleScene = this.battleScene;
    }

    startBattleScene(report = null) {
      if (!report) return false;
      this.battleScene = {
        visible: true,
        report,
        turnIndex: 0,
        startedAt: this.now(),
        turnStartedAt: this.now(),
        turnDurationMs: this.getBattleTurnDurationMs(report.turns?.[0] || null),
      };
      this.canvasShell?.startBattleScene?.(report);
      this.syncBattleSceneToShell();
      this.startBattleSceneTimer();
      this.startBattleAnimationTimer();
      this.renderCanvasSurface(this.state?.currentTab || 'military');
      return true;
    }

    stopBattleSceneTimer() {
      if (!this.battleSceneTimer) return;
      if (typeof this.scheduler?.clearTimeout === 'function') this.scheduler.clearTimeout(this.battleSceneTimer);
      else if (typeof this.runtime?.clearTimeout === 'function') this.runtime.clearTimeout(this.battleSceneTimer);
      else if (typeof clearTimeout === 'function') clearTimeout(this.battleSceneTimer);
      else if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.battleSceneTimer);
      else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.battleSceneTimer);
      else if (typeof clearInterval === 'function') clearInterval(this.battleSceneTimer);
      this.battleSceneTimer = null;
    }

    stopBattleAnimationTimer() {
      if (!this.battleAnimationTimer) return;
      if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.battleAnimationTimer);
      else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.battleAnimationTimer);
      else if (typeof clearInterval === 'function') clearInterval(this.battleAnimationTimer);
      this.battleAnimationTimer = null;
    }

    startBattleAnimationTimer() {
      this.stopBattleAnimationTimer();
      const timerHost = typeof this.scheduler?.setInterval === 'function'
        ? this.scheduler
        : (typeof this.runtime?.setInterval === 'function' ? this.runtime : null);
      const setIntervalFn = timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
      if (!setIntervalFn) return false;
      this.battleAnimationTimer = timerHost
        ? setIntervalFn.call(timerHost, () => {
          if (!this.battleScene?.visible) {
            this.stopBattleAnimationTimer();
            return;
          }
          this.renderAnimationFrame(this.state?.currentTab || 'military');
        }, this.getAnimationFrameMs())
        : setIntervalFn(() => {
          if (!this.battleScene?.visible) {
            this.stopBattleAnimationTimer();
            return;
          }
          this.renderAnimationFrame(this.state?.currentTab || 'military');
        }, this.getAnimationFrameMs());
      return true;
    }

    advanceBattleSceneTurn() {
      if (!this.battleScene?.visible) {
        this.stopBattleSceneTimer();
        return false;
      }
      const turns = this.battleScene.report?.turns || [];
      if (this.battleScene.turnIndex < turns.length) {
        const nextTurnIndex = this.battleScene.turnIndex + 1;
        this.battleScene = {
          ...this.battleScene,
          turnIndex: nextTurnIndex,
          turnStartedAt: this.now(),
          turnDurationMs: this.getBattleTurnDurationMs(nextTurnIndex < turns.length ? turns[nextTurnIndex] : null),
        };
        this.syncBattleSceneToShell();
        this.renderAnimationFrame(this.state?.currentTab || 'military');
        this.startBattleSceneTimer();
        return true;
      }
      this.stopBattleSceneTimer();
      this.stopBattleAnimationTimer();
      return false;
    }

    startBattleSceneTimer() {
      this.stopBattleSceneTimer();
      const timerHost = typeof this.scheduler?.setTimeout === 'function'
        ? this.scheduler
        : (typeof this.runtime?.setTimeout === 'function' ? this.runtime : null);
      const setTimeoutFn = timerHost?.setTimeout || (typeof setTimeout === 'function' ? setTimeout : null);
      if (!setTimeoutFn) return false;
      this.battleSceneTimer = timerHost
        ? setTimeoutFn.call(timerHost, () => this.advanceBattleSceneTurn(), this.getCurrentBattleTurnDurationMs())
        : setTimeoutFn(() => this.advanceBattleSceneTurn(), this.getCurrentBattleTurnDurationMs());
      return true;
    }

    closeBattleScene() {
      this.stopBattleSceneTimer();
      this.stopBattleAnimationTimer();
      this.battleScene = null;
      this.canvasShell?.closeBattleScene?.();
      this.renderCanvasSurface(this.state?.currentTab || 'military');
      return true;
    }

    skipBattleScene() {
      if (!this.battleScene?.visible) return false;
      const turns = this.battleScene.report?.turns || [];
      this.battleScene = {
        ...this.battleScene,
        turnIndex: turns.length,
        turnStartedAt: this.now(),
      };
      this.syncBattleSceneToShell();
      this.stopBattleSceneTimer();
      this.stopBattleAnimationTimer();
      this.renderCanvasSurface(this.state?.currentTab || 'military');
      return true;
    }

    startTransitionTimer() {
      if (this.canvasShell && typeof this.canvasShell.startTransitionTimer === 'function') {
        if (typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = this.pageTransition;
        if (typeof this.canvasShell.buildingTransition !== 'undefined') this.canvasShell.buildingTransition = this.buildingTransition;
        return this.canvasShell.startTransitionTimer();
      }
      if (this.transitionTimer || !this.runtime?.setInterval) return false;
      this.transitionTimer = this.runtime.setInterval(() => {
        const now = this.now();
        const duration = this.getTransitionDurationMs();
        const pageDone = !this.pageTransition || now - this.pageTransition.startedAt >= (this.pageTransition.durationMs || duration);
        const buildingDone = !this.buildingTransition || now - this.buildingTransition.startedAt >= (this.buildingTransition.durationMs || duration);
        if (pageDone) this.pageTransition = null;
        if (buildingDone) this.buildingTransition = null;
        if (!this.pageTransition && !this.buildingTransition) this.stopTransitionTimer();
        this.renderAnimationFrame(this.state?.currentTab || this.getActiveTab());
      }, this.getAnimationFrameMs());
      return true;
    }

    stopTransitionTimer() {
      if (!this.transitionTimer) return;
      this.runtime?.clearInterval?.(this.transitionTimer);
      this.transitionTimer = null;
    }

    startPageTransition(fromTab, toTab, options = {}) {
      const buildingOffset = this.canvasShell && Number.isFinite(Number(this.canvasShell.buildingOffset))
        ? Number(this.canvasShell.buildingOffset)
        : this.buildingOffset;
      if (!fromTab || !toTab || fromTab === toTab) {
        this.pageTransition = null;
        if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = null;
        return false;
      }
      const tabs = this.getTabOrder();
      const fromIndex = tabs.indexOf(fromTab);
      const toIndex = tabs.indexOf(toTab);
      this.pageTransition = {
        fromTab,
        toTab,
        direction: toIndex >= 0 && fromIndex >= 0 && toIndex < fromIndex ? -1 : 1,
        startedAt: this.now(),
        durationMs: this.getTransitionDurationMs(),
        fromBuildingOffset: options.fromBuildingOffset ?? buildingOffset,
      };
      if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') {
        this.canvasShell.pageTransition = this.pageTransition;
      }
      this.startTransitionTimer();
      return true;
    }

    scrollBuildings(action = {}) {
      if (this.canvasShell && typeof this.canvasShell.scrollBuildings === 'function') {
        const scrolled = this.canvasShell.scrollBuildings(action);
        this.buildingOffset = this.canvasShell.buildingOffset;
        this.buildingTransition = this.canvasShell.buildingTransition;
        return scrolled;
      }
      const fromOffset = Math.max(0, Number(this.buildingOffset) || 0);
      const delta = Number(action.delta) || 0;
      const toOffset = Math.max(0, fromOffset + delta);
      this.buildingOffset = toOffset;
      if (toOffset !== fromOffset) {
        this.buildingTransition = {
          fromOffset,
          toOffset,
          direction: toOffset < fromOffset ? -1 : 1,
          startedAt: this.now(),
          durationMs: this.getTransitionDurationMs(),
        };
        this.startTransitionTimer();
      }
      return true;
    }

    selectBuildingCategory(action = {}) {
      const category = action.category || 'all';
      const previous = this.activeBuildingCategory || 'all';
      if (this.canvasShell && typeof this.canvasShell.selectBuildingCategory === 'function') {
        const changed = this.canvasShell.selectBuildingCategory(action);
        this.activeBuildingCategory = this.canvasShell.activeBuildingCategory;
        this.buildingOffset = this.canvasShell.buildingOffset;
        this.buildingTransition = this.canvasShell.buildingTransition;
        return changed !== false && category !== previous;
      }
      this.activeBuildingCategory = category;
      this.buildingOffset = 0;
      this.buildingTransition = null;
      if (this.canvasShell && typeof this.canvasShell.activeBuildingCategory !== 'undefined') {
        this.canvasShell.activeBuildingCategory = category;
        this.canvasShell.buildingOffset = 0;
        this.canvasShell.techTreePanX = 0;
        this.canvasShell.techTreePanY = 0;
        this.canvasShell.techTreeZoom = 1;
        this.canvasShell.buildingTransition = null;
      }
      return category !== previous;
    }

    getCanvasActionState() {
      return this.state;
    }

    getTechTreePan() {
      return {
        x: Number(this.techTreePanX) || 0,
        y: Number(this.techTreePanY) || 0,
      };
    }

    setTechTreePan(pan = {}) {
      const x = Number(pan.x) || 0;
      const y = Number(pan.y) || 0;
      this.techTreePanX = x;
      this.techTreePanY = y;
      if (this.canvasShell && typeof this.canvasShell === 'object') {
        this.canvasShell.techTreePanX = x;
        this.canvasShell.techTreePanY = y;
      }
      return true;
    }

    getTechTreeZoom() {
      return Math.max(0.65, Math.min(1.6, Number(this.techTreeZoom) || 1));
    }

    setTechTreeZoom(zoom = 1) {
      const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
      this.techTreeZoom = nextZoom;
      if (this.canvasShell && typeof this.canvasShell === 'object') this.canvasShell.techTreeZoom = nextZoom;
      return true;
    }

    renderCanvasAction() {
      return this.renderCanvasSurface();
    }

    resetForCanvasTabSwitch() {
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.activeEventId = null;
      this.showTaskCenter = false;
      this.showGuidebook = false;
      this.showFamousPersons = false;
      this.showTalentPolicy = false;
      this.renderer?.clearFamousSkillTooltip?.();
      this.activeBuildingCategory = 'all';
      this.buildingOffset = 0;
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.techDetailOpen = false;
      if (this.canvasShell) this.canvasShell.selectedTechId = '';
      if (this.canvasShell) this.canvasShell.techDetailOpen = false;
      this.state = {
        ...this.state,
        techUiState: {
          ...(this.state.techUiState || {}),
          selectedTechId: '',
          detailOpen: false,
        },
      };
      this.techTreeDragStart = null;
      this.buildingTransition = null;
    }

    resetLocalViewToResources(options = {}) {
      this.activeTab = 'resources';
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.techDetailOpen = false;
      this.techTreeDragStart = null;
      this.activeEventId = null;
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showTaskCenter = false;
      this.showGuidebook = false;
      this.showFamousPersons = false;
      this.showTalentPolicy = false;
      this.renderer?.clearFamousSkillTooltip?.();
      this.activeTaskCenterTab = 'main';
      this.activeGuidebookTab = 'planning';
      this.activeGuideNavigation = null;
      this.pageTransition = null;
      this.buildingTransition = null;
      if (this.canvasShell) this.canvasShell.selectedTechId = '';
      if (this.canvasShell) this.canvasShell.techDetailOpen = false;
      if (this.state && typeof this.state === 'object') {
        this.state = {
          ...this.state,
          currentTab: 'resources',
          techUiState: {
            ...(this.state.techUiState || {}),
            selectedTechId: '',
            detailOpen: false,
          },
        };
      }
      if (!options.skipShell && this.canvasShell?.resetLocalViewToResources) {
        this.canvasShell.resetLocalViewToResources({ skipGame: true, skipRender: true });
      }
      if (!options.skipRender) this.renderCanvasSurface('resources');
      return true;
    }

    openNaming(prompt = {}) {
      const view = this.presenter.buildNamingPromptViewState(prompt);
      this.activeNamingPrompt = prompt;
      this.activeNamingPromptKey = view.key;
      this.naming = {
        visible: true,
        view,
        prompt,
        inputValue: '',
        submitting: false,
      };
        this.showResourceDetails = false;
        this.showCitySwitcher = false;
        this.activeEventId = null;
        this.showFamousPersons = false;
        this.render();
    }

    closeNaming() {
      this.activeNamingPrompt = null;
      this.activeNamingPromptKey = null;
      this.naming = {
        visible: false,
        view: null,
        prompt: null,
        inputValue: '',
        submitting: false,
      };
      this.render();
    }

    async requestNamingInput() {
      if (!this.naming.visible || typeof this.runtime.requestTextInput !== 'function') return;
      const view = this.naming.view || {};
      const value = await this.runtime.requestTextInput({
        title: view.title || '命名',
        message: view.message || '',
        placeholder: view.placeholder || '',
        value: this.naming.inputValue || '',
        maxLength: view.maxLength || 12,
      });
      if (value === null || value === undefined || !this.naming.visible) return;
      this.naming.inputValue = String(value).trim().slice(0, Number(view.maxLength) || 12);
      this.render();
    }

    submitNaming(inputName = null) {
      return this.submitNamingValue(inputName);
    }

    async submitNamingValue(inputName = null) {
      const prompt = this.activeNamingPrompt || this.naming.prompt || {};
      const name = String(inputName ?? this.naming.inputValue ?? '').trim();
      if (!prompt.type || !name) return;
      this.naming.submitting = true;
      this.render();
      try {
        const api = this.getGameApi();
        const result = prompt.type === 'polity'
          ? await api.renamePolity(name)
          : await api.renameCity(prompt.territoryId, name);
        this.closeNaming();
        this.applyApiState(result);
        this.showFloatingText(result.message);
        this.log(`成功：${result.message || ''}`);
      } catch (error) {
        this.log(`失败：${error.payload?.message || error.message}`);
      } finally {
        this.naming.submitting = false;
        this.renderCanvasSurface(this.state?.currentTab);
      }
    }

    async syncOnce() {
      const data = await this.api.getState();
      this.applyState(data);
      return data;
    }

    async startHeartbeat() {
      const api = this.getGameApi();
      api?.setToken?.(this.token);
      try {
        if (this.syncService?.fetchNow) await this.syncService.fetchNow();
        this.syncService?.start?.();
      } catch (error) {
        if (error.payload && error.payload.error && this.handleAuthError) {
          this.handleAuthError(error.payload);
        }
      }
    }

    stopHeartbeat() {
      this.syncService?.stop?.();
      this.updateChecker?.stop?.();
      if (this.scoutCountdownTimer) {
        this.scheduler?.clearInterval?.(this.scoutCountdownTimer);
        this.scoutCountdownTimer = null;
      }
    }

    showUpdatePrompt(version) {
      this.stopHeartbeat();
      return this.updateRuntime?.promptAndReload?.(version);
    }

    async runAction(callback) {
      try {
        const data = await callback();
        if (data) this.applyState(data);
        return data;
      } catch (error) {
        this.log(error.payload?.message || error.message || '操作失败');
        return null;
      }
    }

    async seekFamousPerson(source = 'seek') {
      try {
        const result = await this.getGameApi().seekFamousPerson(source);
        this.applyApiState(result);
        this.showFamousPersons = true;
        if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
        this.showFloatingText(result.message || '寻访完成');
        this.log(result.message || '寻访完成');
        return true;
      } catch (error) {
        this.log(`寻访失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async acceptFamousPerson(candidateId) {
      try {
        const result = await this.getGameApi().acceptFamousPerson(candidateId);
        this.applyApiState(result);
        this.showFamousPersons = true;
        if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
        this.showFloatingText(result.message || '名人已加入');
        this.log(result.message || '名人已加入');
        return true;
      } catch (error) {
        this.log(`接纳失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async dismissFamousPersonCandidate(candidateId) {
      try {
        const result = await this.getGameApi().dismissFamousPersonCandidate(candidateId);
        this.applyApiState(result);
        this.showFamousPersons = true;
        if (this.canvasShell && 'showFamousPersons' in this.canvasShell) this.canvasShell.showFamousPersons = true;
        this.showFloatingText(result.message || '已放弃候选');
        this.log(result.message || '已放弃候选');
        return true;
      } catch (error) {
        this.log(`放弃失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async apiGet(path) {
      const api = this.getGameApi();
      const startedAt = Date.now();
      try {
        const data = await api.request('GET', path);
        this.cacheRequestLog?.(path, 'GET', null, 200, data, Date.now() - startedAt);
        return data;
      } catch (error) {
        this.cacheRequestLog?.(path, 'GET', null, error.payload?.statusCode || 500, error.payload || { message: error.message }, Date.now() - startedAt);
        throw error;
      }
    }

    async apiPost(path, body) {
      const api = this.getGameApi();
      const startedAt = Date.now();
      try {
        const data = await api.request('POST', path, body);
        this.cacheRequestLog?.(path, 'POST', body, 200, data, Date.now() - startedAt);
        return data;
      } catch (error) {
        this.cacheRequestLog?.(path, 'POST', body, error.payload?.statusCode || 500, error.payload || { message: error.message }, Date.now() - startedAt);
        throw error;
      }
    }

    async handleBuildingSuccess(result, action, buildingId) {
      this.applyApiState(result);
      if (buildingId === 'farm' && action === 'build') {
        this.tutorialController?.notifyFarmBuilt?.(result.tutorial);
        this.showFloatingText('农田建成！');
      } else if (buildingId === 'house' && action === 'build') {
        this.tutorialController?.notifyHouseBuilt?.(result.tutorial);
        if (!this.canvasShell?.refreshCurrentGuideHighlight?.()) this.renderSoftGuide();
        this.showFloatingText('民居建成！');
      } else if (buildingId === 'lumbermill' && action === 'build') {
        this.tutorialController?.notifyLumbermillBuilt?.(result.tutorial);
        this.showFloatingText('伐木场建成！');
      } else {
        this.showFloatingText(action === 'upgrade' ? '升级成功！' : '建造成功！');
      }
      this.continueCurrentMainTaskTarget();
      this.log(`成功：${result.message || ''}`);
    }

    async buildBuilding(buildingId) {
      return this.handleBuildingAction(buildingId, 'build');
    }

    async upgradeBuilding(buildingId) {
      return this.handleBuildingAction(buildingId, 'upgrade');
    }

    async handleBuildingAction(buildingId, action) {
      if (!buildingId) return false;
      const controller = this.buildingController;
      if (controller?.handleAction) {
        await controller.handleAction({ buildingId, action });
        return true;
      }
      try {
        const api = this.getGameApi();
        const result = action === 'upgrade'
          ? await api.upgrade(buildingId)
          : await api.build(buildingId);
        await this.handleBuildingSuccess(result, action, buildingId);
        return true;
      } catch (error) {
        this.log(`澶辫触锛?{error.payload?.message || error.message}`);
        return false;
      }
    }

    async assignJob(job, delta) {
      if (!this.token && this.authStorage) {
        this.log('请先登录');
        return false;
      }
      try {
        const result = await this.getGameApi().assignJob(job, delta);
        if (result?.success === false) {
          this.log(result.message || '人口分配失败');
          const data = await this.getGameApi().getState?.();
          if (data?.gameState) this.applyApiState(data);
          return false;
        }
        this.applyApiState(result);
        if (job === 'craftsman' && delta > 0) this.tutorialController?.notifyCraftsmanAssigned?.(result.tutorial);
        this.continueCurrentMainTaskTarget();
        this.log(`人口分配 ${delta > 0 ? '+' : ''}${delta} ${job}`);
        return true;
      } catch (error) {
        this.log(`人口分配失败：${error.payload?.message || error.message}`);
        try {
          const data = await this.getGameApi().getState?.();
          if (data?.gameState) this.applyApiState(data);
        } catch (_) {}
        return false;
      }
    }

    getTalentPolicyDraft() {
      const policies = this.state?.talentPolicies || {};
      const systemPolicies = Array.isArray(policies.systemPolicies) ? policies.systemPolicies : [];
      const activeIsSystem = systemPolicies.some((policy) => policy.id === policies.activePolicyId);
      const basePolicyId = this.talentPolicyUiState.basePolicyId
        || this.canvasShell?.talentPolicyUiState?.basePolicyId
        || (activeIsSystem ? policies.activePolicyId : null)
        || 'balanced';
      const defaults = policies.defaultTiers || { agriculture: 2, knowledge: 2, industry: 2 };
      const tiers = this.talentPolicyUiState.tiers || this.canvasShell?.talentPolicyUiState?.tiers || {};
      return {
        basePolicyId,
        tiers: {
          agriculture: Number(tiers.agriculture ?? defaults.agriculture ?? 2),
          knowledge: Number(tiers.knowledge ?? defaults.knowledge ?? 2),
          industry: Number(tiers.industry ?? defaults.industry ?? 2),
        },
      };
    }

    async applyTalentPolicy(policyId) {
      if (!policyId) return false;
      try {
        const result = await this.getGameApi().applyTalentPolicy(policyId);
        this.applyApiState(result);
        this.showTalentPolicy = false;
        if (this.canvasShell && 'showTalentPolicy' in this.canvasShell) {
          this.canvasShell.showTalentPolicy = false;
        }
        this.showFloatingText(result.message || '方针已应用');
        this.log(result.message || '方针已应用');
        return true;
      } catch (error) {
        this.log(`方针失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async applyTalentPolicyDraft() {
      try {
        const result = await this.getGameApi().applyTalentPolicy(null, this.getTalentPolicyDraft());
        this.applyApiState(result);
        this.showTalentPolicy = false;
        if (this.canvasShell && 'showTalentPolicy' in this.canvasShell) {
          this.canvasShell.showTalentPolicy = false;
        }
        this.showFloatingText(result.message || '方针已应用');
        this.log(result.message || '方针已应用');
        return true;
      } catch (error) {
        this.log(`方针失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async saveTalentPolicyDraft() {
      try {
        const result = await this.getGameApi().saveTalentPolicy(this.getTalentPolicyDraft());
        this.applyApiState(result);
        this.showFloatingText(result.message || '方针已保存');
        this.log(result.message || '方针已保存');
        return true;
      } catch (error) {
        this.log(`保存失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async deleteTalentPolicy(policyId) {
      if (!policyId) return false;
      try {
        const result = await this.getGameApi().deleteTalentPolicy(policyId);
        this.applyApiState(result);
        this.showFloatingText(result.message || '方针已删除');
        this.log(result.message || '方针已删除');
        return true;
      } catch (error) {
        this.log(`删除失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    async advanceEra() {
      if (!this.canAdvanceEraNow()) {
        this.log(this.state?.isCapitalCity === false ? '只有主城可以推动文明进阶' : this.canAdvanceEraByTutorial() ? '条件不足，无法进阶' : '引导未解锁，先完成当前引导');
        this.renderMilitary();
        return false;
      }
      try {
        const result = await this.getGameApi().advanceEra();
        this.applyApiState(result);
        this.tutorialController?.notifyEraAdvanced?.(result.tutorial);
        this.continueCurrentMainTaskTarget();
        this.log(`进入新阶段：${result.message || this.state.currentEraName || ''}`);
        this.showFloatingText(`进入${this.state.currentEraName || '新阶段'}`);
        return true;
      } catch (error) {
        this.log(`失败：${error.payload?.message || error.message}`);
        return false;
      } finally {
        this.renderMilitary();
      }
    }

    async research(techId) {
      if (!techId) return false;
      try {
        const result = await this.getGameApi().research(techId);
        this.applyApiState(result);
        if (this.state && typeof this.state === 'object') {
          this.state = {
            ...this.state,
            techUiState: {
              ...(this.state.techUiState || {}),
              selectedTechId: techId,
              detailOpen: false,
            },
          };
        }
        if (this.canvasShell) this.canvasShell.selectedTechId = techId;
        if (this.canvasShell) this.canvasShell.techDetailOpen = false;
        this.showFloatingText(result.message || '科技已研究');
        this.log(result.message || '科技已研究');
        return true;
      } catch (error) {
        this.log(`研究失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    switchTab(tab) {
      const previousTab = this.getActiveTab();
      const previousBuildingOffset = this.buildingOffset;
      const navigation = this.presenter?.buildTabNavigationViewState?.(this.state, { requestedTab: tab });
      this.activeTab = navigation?.activeTab || tab || 'resources';
      const preferredMilitaryView = this.getPreferredMilitaryView(tab);
      this.state = {
        ...this.state,
        currentTab: this.activeTab,
        techUiState: {
          ...(this.state.techUiState || {}),
          detailOpen: false,
        },
      };
      if (preferredMilitaryView) this.state.militaryView = preferredMilitaryView;
      this.buildingOffset = 0;
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.techDetailOpen = false;
      this.techTreeDragStart = null;
      this.buildingTransition = null;
      if (this.canvasShell) this.canvasShell.techDetailOpen = false;
      if (this.canvasShell) this.canvasShell.techTreeZoom = 1;
      this.startPageTransition(previousTab, this.activeTab, { fromBuildingOffset: previousBuildingOffset });
      this.activeEventId = null;
      this.showTalentPolicy = false;
      this.renderMilitaryView();
      this.renderCanvasSurface(this.state.currentTab);
      this.tutorialController?.render?.();
      if (this.skipNextSoftGuideRender) {
        this.skipNextSoftGuideRender = false;
        if (this.activeGuideNavigation?.target === 'scout-action-first') {
          this.activeGuideNavigation = null;
          this.renderSoftGuide();
        }
      } else {
        this.renderSoftGuide();
      }
    }

    async handleCanvasTabSelection(tabId) {
      if (!tabId) return false;
      const onTabClicked = this.tutorialController?.onTabClicked;
      const allowed = typeof onTabClicked === 'function'
        ? await onTabClicked.call(this.tutorialController, tabId).catch(() => false)
        : true;
      if (!allowed) {
        this.log('请先完成当前引导步骤');
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
      this.switchTab(tabId);
      return true;
    }

    async claimGuideTaskReward(taskId) {
      return this.claimTaskReward(taskId, 'main', { legacyGuideTask: true });
    }

    async claimTaskReward(taskId, category = 'main', options = {}) {
      if (!taskId) return false;
      try {
        const api = this.getGameApi();
        const result = options.legacyGuideTask && api.claimGuideTaskReward
          ? await api.claimGuideTaskReward(taskId)
          : await api.claimTaskReward(taskId, category || 'main');
        this.applyApiState(result);
        if (!this.moveToCurrentMainTaskTarget()) {
          if (!this.canvasShell?.refreshCurrentGuideHighlight?.()) this.renderSoftGuide();
        }
        if (!this.canvasShell?.showRewardReveal?.(result.rewardReveal) && result.rewardReveal) {
          this.rewardReveal = {
            ...result.rewardReveal,
            createdAt: this.runtime?.now?.() || Date.now(),
          };
          this.renderCanvasSurface(this.state?.currentTab);
        }
        this.showFloatingText(result.rewardText || result.message || '奖励已领取');
        this.log(`奖励：${result.message || ''}`);
        return true;
      } catch (error) {
        this.log(`失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    moveToCurrentMainTaskTarget() {
      const guideTasks = Array.isArray(this.state?.guideTasks?.tasks) ? this.state.guideTasks.tasks : [];
      const taskCenterTasks = Array.isArray(this.state?.taskCenter?.categories?.main?.tasks)
        ? this.state.taskCenter.categories.main.tasks
        : [];
      const tasks = guideTasks.length ? guideTasks : taskCenterTasks;
      const task = tasks.find((item) => item && item.status !== 'completed' && (item.target || item.action?.target));
      const target = task?.target || task?.action?.target;
      if (!target) return false;
      return this.goToGuideTaskTarget({
        ...(task.action || {}),
        taskId: task.id,
        target,
      });
    }

    continueCurrentMainTaskTarget() {
      if (this.moveToCurrentMainTaskTarget()) return true;
      const guide = this.state?.softGuide || null;
      if (!guide || guide.mode !== 'strong') return false;
      if (!['guide-task-claim', 'task-center-main-claim'].includes(guide.target)) return false;
      if (this.canvasShell?.refreshCurrentGuideHighlight?.()) return true;
      this.renderSoftGuide();
      return true;
    }

    getPreferredMilitaryView(tabId) {
      if (tabId === 'territory') return 'world';
      if (tabId !== 'military') return null;
      const guide = this.state?.softGuide || {};
      const target = guide.target || '';
      const message = String(guide.message || '');
      if (target === 'scout-action-first') return 'scout';
      if (target === 'tab-territory') return 'world';
      if (target !== 'tab-military') return null;
      if (/侦察|探索/.test(message)) return 'scout';
      if (/领土|疆域|世界|占领/.test(message)) return 'world';
      return null;
    }

    switchMilitaryView(view) {
      const allowed = ['army', 'scout', 'world'];
      this.militaryView = allowed.includes(view) ? view : 'army';
      this.state = { ...this.state, militaryView: this.militaryView };
      this.renderMilitaryView();
      this.tutorialController?.render?.();
      this.renderCanvasSurface(this.state?.currentTab);
      return true;
    }

    renderMilitaryView() {
      const view = this.presenter?.buildMilitaryNavigationViewState?.(this.state);
      if (view?.activeView) {
        this.militaryView = view.activeView;
        if (this.state) this.state.militaryView = view.activeView;
      }
    }

    updateMilitaryViewLocks() {
      this.renderMilitaryView();
    }

    getTargetTab(key) {
      return this.guideController?.getTargetTab?.(key) || null;
    }

    getTutorialTarget(key) {
      return this.canvasShell?.getTutorialTarget?.(key)
        || this.guideController?.getTargetRect?.(key)
        || null;
    }

    getGuideState() {
      return this.state;
    }

    getGuideActiveTab() {
      return this.getActiveTab();
    }

    getGuideTutorialState() {
      return this.state?.tutorial || {};
    }

    getGuideCanvasTarget(type, predicate = null) {
      return this.canvasShell?.getCanvasTarget?.(type, predicate)
        || this.getCanvasTarget(type, predicate);
    }

    renderGuideFrame() {
      this.renderCanvasSurface(this.state?.currentTab || this.getActiveTab());
      return true;
    }

    switchGuideTab(tabId) {
      this.switchTab(tabId);
      return true;
    }

    setGuideMilitaryView(view) {
      this.militaryView = view || 'army';
      this.state = { ...this.state, militaryView: this.militaryView };
      this.render();
      return true;
    }

    getCanvasTarget(type, predicate = null) {
      const targets = this.canvasShell?.renderer?.hitTargets || this.renderer?.hitTargets || [];
      const target = targets.find((item) => (
        item.action?.type === type
        && (typeof predicate !== 'function' || predicate(item.action))
      ));
      if (!target) return null;
      return {
        left: target.x,
        top: target.y,
        width: target.width,
        height: target.height,
        right: target.x + target.width,
        bottom: target.y + target.height,
      };
    }

    getGuideTargetRect(key) {
      return this.guideController?.getTargetRect?.(key) || null;
    }

    refreshTaskCenterGuideHighlight(action = {}) {
      return this.guideController?.refreshTaskCenterGuideHighlight?.(action) || false;
    }

    hasClaimableMainTask() {
      return this.guideController?.hasClaimableMainTask?.() || false;
    }

    refreshCurrentGuideHighlight() {
      return this.guideController?.refreshCurrentGuideHighlight?.() || false;
    }

    ensureGuideTargetVisible(key) {
      return this.guideController?.ensureTargetVisible?.(key) || false;
    }

    normalizeGuideHighlightRect(target) {
      if (!target) return null;
      const rawRect = typeof target.getRect === 'function'
        ? target.getRect()
        : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
      const left = Number(rawRect.left ?? rawRect.x);
      const top = Number(rawRect.top ?? rawRect.y);
      const width = Number(rawRect.width);
      const height = Number(rawRect.height);
      if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        left,
        top,
        width,
        height,
        right: Number(rawRect.right) || left + width,
        bottom: Number(rawRect.bottom) || top + height,
      };
    }

    showGuideHighlight(target, message, options = {}) {
      if (this.canvasShell && typeof this.canvasShell.showTutorialHighlight === 'function') {
        const shown = this.canvasShell.showTutorialHighlight(target, message, { source: options.source || 'guide' });
        this.tutorialHighlight = this.canvasShell.tutorialHighlight || null;
        return shown;
      }
      const rect = this.normalizeGuideHighlightRect(target);
      if (!rect) return false;
      const now = this.runtime?.now?.() || Date.now();
      const previousRect = this.tutorialHighlight?.rect || rect;
      this.tutorialHighlight = {
        rect,
        message: String(message || '按这里继续主线任务'),
        transition: {
          fromRect: previousRect,
          toRect: rect,
          startedAt: now,
          durationMs: 260,
        },
        pulseStartedAt: this.tutorialHighlight?.pulseStartedAt || now,
        source: options.source || 'guide',
      };
      if (this.highlightTimer) this.runtime?.clearInterval?.(this.highlightTimer);
      if (this.runtime?.setInterval) {
        this.highlightTimer = this.runtime.setInterval(() => {
          this.renderAnimationFrame(this.state?.currentTab || this.getActiveTab());
        }, this.getAnimationFrameMs());
      }
      if (!options.skipRender) {
        this.suppressSoftGuideRenderOnce = true;
        this.render();
      }
      return true;
    }

    hideGuideHighlight() {
      if (this.canvasShell && typeof this.canvasShell.hideTutorialHighlight === 'function') {
        const hidden = this.canvasShell.hideTutorialHighlight();
        this.tutorialHighlight = this.canvasShell.tutorialHighlight || null;
        return hidden;
      }
      const hadHighlight = Boolean(this.tutorialHighlight);
      this.tutorialHighlight = null;
      if (hadHighlight) this.renderCanvasSurface(this.state?.currentTab);
      return hadHighlight;
    }

    showGuideControllerHighlight(target, message) {
      return this.showGuideHighlight(target, message);
    }

    hideGuideControllerHighlight() {
      return this.hideGuideHighlight();
    }

    hasGuideControllerHighlight() {
      return Boolean(this.canvasShell?.tutorialHighlight || this.tutorialHighlight);
    }

    goToGuideTaskTarget(action = {}) {
      this.skipNextSoftGuideRender = true;
      const target = action.target || action.nextTarget || '';
      this.activeGuideNavigation = target
        ? { target, message: String(action.message || '按这里继续主线任务') }
        : null;
      return this.guideController?.goToGuideTaskTarget?.(action) || false;
    }

    toggleCitySwitcher() {
      const target = this.canvasShell || this;
      target.showCitySwitcher = !target.showCitySwitcher;
      this.renderCanvasSurface(this.state?.currentTab);
    }

    closeCitySwitcher() {
      const target = this.canvasShell || this;
      target.showCitySwitcher = false;
      this.renderCanvasSurface(this.state?.currentTab);
    }

    async switchCity(cityId) {
      if (!cityId || cityId === this.state?.activeCityId) return false;
      try {
        this.closeCitySwitcher();
        const result = await this.getGameApi().switchCity(cityId);
        this.applyApiState(result);
        this.showFloatingText(result.message || '城市已切换');
        this.log(`城市：${result.message || '城市已切换'}`);
        return true;
      } catch (error) {
        this.log(`失败：${error.payload?.message || error.message}`);
        this.renderCanvasSurface(this.state?.currentTab);
        return false;
      }
    }

    renderMilitary() {
      this.updateMilitaryViewLocks();
      this.renderCanvasSurface(this.state?.currentTab);
    }

    startScoutCountdownTimer() {
      if (this.scoutCountdownTimer) return;
      this.scoutCountdownTimer = this.scheduler?.setInterval?.(() => {
        if ((this.state?.currentEra || 0) < 5) return;
        if (this.state?.currentTab === 'military') this.renderCanvasSurface(this.state.currentTab);
        if (this.state?.currentTab === 'territory') {
          const territories = this.state.territoryState?.territories || [];
          const hasConquestMission = territories.some((site) => site.mission?.status === 'active');
          if (hasConquestMission) this.renderTerritory();
        }
      }, 1000);
    }

    renderTerritory() {
      this.renderCanvasSurface(this.state?.currentTab);
    }

    getMissionRemainingSeconds(mission) {
      return this.presenter?.getScoutMissionRemainingSeconds?.(mission);
    }

    formatScoutCountdown(seconds) {
      return this.presenter?.formatScoutCountdown?.(seconds);
    }

    maybeShowNamingPrompt() {
      const prompt = this.state?.territoryState?.namingPrompt;
      const key = prompt ? `${prompt.type}:${prompt.territoryId || 'polity'}` : null;
      if (!prompt || this.activeNamingPromptKey === key) return;
      this.openNaming(prompt);
    }

    requestCityRename(prompt = {}) {
      if (!prompt.territoryId) return null;
      this.openNaming({
        type: 'city',
        territoryId: prompt.territoryId,
        title: '为这座城市命名',
        message: `当前名称：${prompt.currentName || '未命名城市'}`,
      });
      return null;
    }

    closeNamingModal() {
      this.closeNaming();
    }

    renderSoftGuide(options = {}) {
      if (this.suppressSoftGuideRenderOnce) {
        this.suppressSoftGuideRenderOnce = false;
        return;
      }
      const guide = this.state?.softGuide;
      this.updateAdvisor(guide, { skipSurface: true });
      const navigation = this.getActiveGuideNavigation();
      const targetKey = navigation?.target || guide?.target || '';
      if ((!guide || guide.mode !== 'strong' || !guide.target) && !navigation) {
        if (!this.hasActiveTutorialGuideHighlight()) this.tutorialRenderer?.hide?.();
        if (!options.skipSurface) this.renderCanvasSurface(this.state?.currentTab);
        return;
      }
      const target = this.getTutorialTarget(targetKey)
        || this.getTutorialTarget(this.getFallbackGuideTarget(targetKey));
      const message = navigation?.message || guide?.message;
      if (target) {
        if (this.tutorialRenderer?.show) this.tutorialRenderer.show(target, message);
        else this.showGuideHighlight(target, message, { skipRender: true });
      }
      else if (!this.tutorialHighlight && !this.canvasShell?.tutorialHighlight) this.tutorialRenderer?.hide?.();
      if (!options.skipSurface) this.renderCanvasSurface(this.state?.currentTab);
    }

    getActiveGuideNavigation() {
      const navigation = this.activeGuideNavigation;
      if (!navigation?.target) return null;
      if (this.hasActiveGuideTaskTarget(navigation.target)) return navigation;
      this.activeGuideNavigation = null;
      return null;
    }

    hasActiveGuideTaskTarget(target) {
      const guideTasks = this.state?.guideTasks?.tasks || [];
      const taskCenterTasks = this.state?.taskCenter?.categories?.main?.tasks || [];
      return [...guideTasks, ...taskCenterTasks].some((task) => {
        const taskTarget = task?.target || task?.action?.target || task?.action?.nextTarget;
        return taskTarget === target && task?.status !== 'completed' && !task?.claimed;
      });
    }

    getFallbackGuideTarget(target) {
      if (target === 'btn-advance-era') return 'tab-civilization';
      if (target === 'card-craftsman') return 'tab-resources';
      if (target === 'event-card-special' || target === 'btn-claim-event') return 'tab-events';
      if (target === 'scout-action-first') return 'tab-military';
      if (target === 'task-center-main-claim') return 'task-center-button';
      if (typeof target === 'string' && target.startsWith('card-')) return 'tab-buildings';
      return null;
    }

    updateAdvisor(guide, options = {}) {
      const view = this.presenter?.buildAdvisorViewState?.(guide) || {};
      this.activeAdvisor = view.activeAdvisor;
      if (!options.skipSurface) this.renderCanvasSurface(this.state?.currentTab);
    }

    goToAdvisorTarget() {
      const target = this.activeAdvisor?.target;
      if (target === 'scout-action-first') {
        return this.canvasShell?.goToGuideTaskTarget?.({
          target,
          nextAction: { type: 'switchMilitaryView', view: 'scout' },
        });
      }
      const tabId = this.presenter?.getAdvisorTargetTab?.(target);
      if (tabId) this.switchTab(tabId);
      return Boolean(tabId);
    }

    showFloatingText(message) {
      const shown = this.canvasShell?.showFloatingText?.(message);
      if (!shown && message) this.log(message);
      return shown;
    }

    cacheRequestLog(path, method, body, statusCode, response, duration) {
      this.requestLogs.unshift({
        path,
        method,
        body: body ? JSON.stringify(body).slice(0, 200) : '',
        statusCode,
        response: JSON.stringify(response).slice(0, 200),
        duration,
        timestamp: new Date().toLocaleTimeString(),
      });
      if (this.requestLogs.length > 100) this.requestLogs = this.requestLogs.slice(0, 100);
    }

    log(message) {
      if (this.externalLog) this.externalLog(message);
      const entry = { text: String(message ?? ''), timestamp: Date.now() };
      this.recentLogs.unshift(entry);
      if (this.recentLogs.length > 30) this.recentLogs = this.recentLogs.slice(0, 30);
    }

    getSelectedSite() {
      return (this.state.territoryState?.territories || []).find((site) => site.id === this.territoryUiState.selectedSiteId) || null;
    }

    getExpeditionSoldiers(site = this.getSelectedSite()) {
      const recommended = Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1);
      return Math.max(1, Number(this.territoryUiState.expeditionSoldiers) || recommended);
    }

    handleDrag(phase, point = {}) {
      if (this.activeTab === 'tech') {
        return this.actionController?.handle?.({ type: 'techTreeDrag', phase, pointer: point }) || false;
      }
      if (this.activeTab !== 'military' || this.militaryView !== 'world') return false;
      return this.actionController?.handle?.({ type: 'worldRadarDrag', phase, pointer: point }) || false;
    }

    hasBlockingOverlayOpen() {
      return Boolean(this.showResourceDetails
        || this.showCitySwitcher
        || this.showTaskCenter
        || this.showGuidebook
        || this.showFamousPersons
        || this.showTalentPolicy
        || this.techDetailOpen
        || this.activeEventId
        || this.naming?.visible
        || this.battleScene?.visible
        || this.rewardReveal);
    }

    handleGesture(gesture) {
      if (this.activeTab !== 'tech' || this.hasBlockingOverlayOpen()) return false;
      return this.actionController?.handle?.({ type: 'techTreeZoom', gesture }) || false;
    }

    async handleTap(point) {
      const action = this.renderer.getHitTarget(point);
      if (!action || action.disabled) return;
      if (action.type === 'showFamousSkillTooltip') {
        this.renderer.setPinnedFamousSkillTooltip?.(action);
        this.render();
        return;
      }
      if (action.type === 'clearFamousSkillTooltip') {
        this.renderer.clearFamousSkillTooltip?.();
        this.render();
        return;
      }
      await this.actionController?.handle?.(action);
    }
    start() {
      this.render();
      this.syncOnce().catch(() => {});
      if (this.timer) return;
      if (!this.tapDisposer && this.runtime && typeof this.runtime.onTap === 'function') {
        this.tapDisposer = this.runtime.onTap((point) => this.handleTap(point));
      }
      if (!this.dragDisposer && this.runtime && typeof this.runtime.onDrag === 'function') {
        this.dragDisposer = this.runtime.onDrag((phase, point) => this.handleDrag(phase, point));
      }
      if (!this.gestureDisposer && this.runtime && typeof this.runtime.onGesture === 'function') {
        this.gestureDisposer = this.runtime.onGesture((gesture) => this.handleGesture(gesture));
      }
      this.timer = this.runtime.setInterval(() => {
        this.syncOnce().catch(() => {});
      }, this.syncIntervalMs);
    }

    stop() {
      if (this.timer) {
        this.runtime.clearInterval(this.timer);
        this.timer = null;
      }
      if (this.highlightTimer) {
        this.runtime.clearInterval(this.highlightTimer);
        this.highlightTimer = null;
      }
      this.stopTransitionTimer();
      if (this.tapDisposer) {
        this.tapDisposer();
        this.tapDisposer = null;
      }
      if (this.dragDisposer) {
        this.dragDisposer();
        this.dragDisposer = null;
      }
      if (this.gestureDisposer) {
        this.gestureDisposer();
        this.gestureDisposer = null;
      }
    }
  }

  global.CanvasGameApp = CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameApp;
})(typeof window !== 'undefined' ? window : globalThis);
