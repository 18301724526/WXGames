const Game = {
  apiBase: null,
  config: null,
  stateNormalizer: null,
  runtimeConstructors: null,
  token: null,
  playerId: null,
  state: {
    resources: {},
    buildings: {},
    buildingCosts: {},
    buildingDefinitions: {},
    buildingEffects: {},
    unlockedBuildings: [],
    currentEra: 0,
    currentEraName: '原始时代',
    currentEraDescription: '',
    population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
    happiness: 100,
    gameDay: 1,
    totalBuildings: 0,
    eraProgress: { percentage: 0, canAdvance: false, conditions: [] },
    currentTab: 'resources',
    militaryView: 'army',
    techs: {},
    eventQueue: [],
    eventHistory: [],
    regularEventState: null,
    threatEventState: null,
    activeBuffs: [],
    military: {},
    territoryState: {},
    softGuide: null,
  },
  tutorial: { completed: false, currentStep: 0, phaseCompleted: { newbie: false, era2: false } },
  activeEventId: null,
  scoutCountdownTimer: null,
  requestLogs: [],
  recentLogs: [],

  init() {
    const shell = window.H5ShellAdapter?.fromDocument(document, window, {
      registry: window,
      getTerritoryUiState: () => this.territoryController?.getUiState?.() || {},
    });
    Object.assign(this, shell);
    this.apiBase = this.config?.API_BASE || this.apiBase;
    this.token = this.authStorage?.getToken?.() || null;
    const constructors = this.runtimeConstructors || {};
    this.gameAPI = new constructors.GameAPI(this.apiBase, this.token);
    this.buildingAPI = { setToken: (token) => this.gameAPI.setToken(token) };
    this.syncService = new constructors.GameStateSync(this.gameAPI, this.config?.SYNC_INTERVAL_MS, this.scheduler);
    this.updateChecker = new constructors.UpdateChecker({
      api: { getVersion: () => this.apiGet('/version') },
      intervalMs: this.config?.UPDATE_CHECK_INTERVAL_MS,
      scheduler: this.scheduler,
      onUpdate: (version, previousDeploymentId) => {
        this.log(`🔄 检测到新版本：${previousDeploymentId} -> ${version.deploymentId}`);
        return this.showUpdatePrompt(version);
      },
      onError: (error) => {
        const message = error?.payload?.message || error?.message || '未知错误';
        this.log(`⚠️ 版本检测失败：${message}`);
      },
      onLog: (entry) => {
        if (entry?.type === 'initialized') {
          this.log(`🛰️ 版本检测已启动：${entry.deploymentId}`);
        }
      },
    });
    this.stateManager = new constructors.GameStateManager(this.state, { buildingState: this.buildingState });
    this.tutorialRenderer.onSoftGuide = (message) => this.updateAdvisor({ message });
    this.tutorialController = new constructors.TutorialController({
      api: this.gameAPI,
      renderer: this.tutorialRenderer,
      getTarget: (key) => this.getTutorialTarget(key),
      getCurrentTab: () => this.state.currentTab,
      isEventModalOpen: () => this.eventController?.isOpen?.() || this.canvasShell?.activeEventId || false,
      getState: () => this.state,
      storage: this.tutorialStorage,
      startDelayMs: this.config?.TUTORIAL_START_DELAY_MS,
      scheduler: this.scheduler,
    });
    this.eventController = new constructors.EventController({
      api: this.gameAPI,
      getState: () => this.state,
      onStateApplied: (result) => this.applyApiState(result),
      onTutorialUpdated: (tutorial) => this.tutorialController.notifySpecialEventClaimed(tutorial),
      onFloatingText: (message) => this.showFloatingText(message),
      onLog: (message) => this.log(message),
      formatReward: (reward) => this.presenter.formatEventReward(reward),
    });
    this.buildingController = new constructors.BuildingController({
      api: this.gameAPI,
      onSuccess: (result, action, buildingId) => this.handleBuildingSuccess(result, action, buildingId),
      onError: (error) => this.log(`❌ ${error.payload?.message || error.message}`),
    });
    this.territoryController = new constructors.TerritoryController({
      api: this.gameAPI,
      getState: () => this.state,
      onRenderRequested: () => this.renderTerritory(),
      onStateApplied: (result) => this.applyApiState(result),
      onFloatingText: (message) => this.showFloatingText(message),
      onLog: (message) => this.log(message),
      onCityRenameRequested: (prompt) => this.requestCityRename(prompt),
    });

    this.gameModules?.mount?.(this);

    this.syncService.onState = (data) => this.applyApiState(data);
    this.syncService.onError = (error) => {
      if (error.payload && error.payload.error && this.handleAuthError) this.handleAuthError(error.payload);
    };

    this.territoryController.bind();
    this.startScoutCountdownTimer();
    this.updateChecker.start();
    this.canvasShell = window.H5CanvasAppShell?.mount(this, {
      document,
      runtime: window,
      presenter: this.presenter,
      previewEnabled: true,
      inputEnabled: true,
      onAction: (action) => {
        if (action?.type === 'switchTab') {
          this.handleCanvasTabSelection(action.tab);
          return true;
        }
        if (action?.type === 'goToAdvisorTarget') {
          this.goToAdvisorTarget();
          return true;
        }
        if (action?.type === 'openLogs') return true;
        if (action?.type === 'closeLogs') {
          this.closeRequestLogs?.();
          return true;
        }
        if (action?.type === 'clearLogs') {
          this.clearRequestLogs?.();
          return true;
        }
        if (action?.type === 'resetGame') {
          this.resetGame?.();
          return true;
        }
        if (action?.type === 'logout') {
          this.logout?.();
          return true;
        }
        if (action?.type === 'submitNaming') {
          this.submitNaming(action.name);
          return true;
        }
        if (action?.type === 'submitLogin') {
          this.handleLogin?.();
          return true;
        }
        if (action?.type === 'selectCity') {
          this.switchCity(action.cityId);
          return true;
        }
        if (action?.type === 'assignJob') {
          this.assignJob(action.job, action.delta);
          return true;
        }
        if (action?.type === 'advanceEra') {
          this.advanceEra();
          return true;
        }
        if (action?.type === 'switchMilitaryView') {
          this.switchMilitaryView(action.view);
          return true;
        }
        if (action?.type === 'scoutTerritory' || action?.type === 'claimScout') {
          this.territoryController.handleScoutAction({
            direction: action.direction || action.value,
            missionId: action.missionId || action.value,
          });
          return true;
        }
        if (action?.type === 'openWorldSite') {
          this.territoryController.openSiteDialog(action.siteId);
          return true;
        }
        if (action?.type === 'closeWorldSite') {
          this.territoryController.closeSiteDialog();
          return true;
        }
        if (action?.type === 'resetWorldPan') {
          this.territoryController.resetWorldPan();
          this.canvasShell?.renderReadOnly(this.state, this.state.currentTab);
          return true;
        }
        if (action?.type === 'territoryAction') {
          this.territoryController.handleAction({
            territoryId: action.territoryId,
            action: action.action,
          });
          return true;
        }
        if (action?.type === 'changeExpeditionSoldiers') {
          this.territoryController.handleDraftInput({
            field: 'soldiers',
            value: action.value,
          });
          return true;
        }
        if (action?.type === 'buildBuilding' || action?.type === 'upgradeBuilding') {
          this.buildingController.handleAction({
            buildingId: action.buildingId,
            action: action.type === 'upgradeBuilding' ? 'upgrade' : 'build',
          });
          return true;
        }
        if (action?.type === 'claimEvent') {
          this.eventController.open(action.eventId);
          this.eventController.claimActive(action.optionId);
          return true;
        }
        return false;
      },
    });
    this.tutorialRenderer?.setCanvasShell?.(this.canvasShell);
    this.render();
  },

  async handleCanvasTabSelection(tabId) {
    if (!tabId) return false;
    const onTabClicked = this.tutorialController?.onTabClicked;
    const allowed = typeof onTabClicked === 'function'
      ? await onTabClicked.call(this.tutorialController, tabId).catch(() => false)
      : true;
    if (!allowed) {
      this.log('👉 请先完成当前引导步骤');
      this.canvasShell?.renderReadOnly(this.state, this.state.currentTab);
      return false;
    }
    this.switchTab(tabId);
    return true;
  },

  async startHeartbeat() {
    this.gameAPI.setToken(this.token);
    try {
      await this.syncService.fetchNow();
      this.syncService.start();
    } catch (error) {
      if (error.payload && error.payload.error && this.handleAuthError) {
        this.handleAuthError(error.payload);
      }
    }
  },

  stopHeartbeat() {
    if (this.syncService) this.syncService.stop();
    if (this.updateChecker) this.updateChecker.stop();
    if (this.scoutCountdownTimer) {
      this.scheduler?.clearInterval?.(this.scoutCountdownTimer);
      this.scoutCountdownTimer = null;
    }
  },

  showUpdatePrompt(version) {
    this.stopHeartbeat();
    return this.updateRuntime?.promptAndReload(version);
  },

  async apiGet(path) {
    const startedAt = Date.now();
    try {
      const data = await this.gameAPI.request('GET', path);
      this.cacheRequestLog && this.cacheRequestLog(path, 'GET', null, 200, data, Date.now() - startedAt);
      return data;
    } catch (error) {
      this.cacheRequestLog && this.cacheRequestLog(path, 'GET', null, error.payload?.statusCode || 500, error.payload || { message: error.message }, Date.now() - startedAt);
      throw error;
    }
  },

  async apiPost(path, body) {
    const startedAt = Date.now();
    try {
      const data = await this.gameAPI.request('POST', path, body);
      this.cacheRequestLog && this.cacheRequestLog(path, 'POST', body, 200, data, Date.now() - startedAt);
      return data;
    } catch (error) {
      this.cacheRequestLog && this.cacheRequestLog(path, 'POST', body, error.payload?.statusCode || 500, error.payload || { message: error.message }, Date.now() - startedAt);
      throw error;
    }
  },

  applyApiState(data) {
    const nextState = this.stateNormalizer.normalizeGameState(data);
    this.tutorial = this.stateNormalizer.normalizeTutorialState(data);
    this.syncFromServer(nextState, data.tutorial, data.eraProgress);
  },

  syncFromServer(serverState, tutorial, eraProgress) {
    this.state = this.stateManager.sync(serverState, eraProgress);
    const nextTutorial = this.getEffectiveTutorialState(tutorial || this.tutorial);
    this.tutorial = nextTutorial;
    this.tutorialController.setState(nextTutorial);
    this.updateSyncInterval();
    this.render();
  },

  getSyncInterval() {
    const step = this.tutorialController?.state?.currentStep ?? this.tutorial?.currentStep;
    if (step === 8) return this.config?.TUTORIAL_WAIT_SYNC_INTERVAL_MS || 500;
    return this.config?.SYNC_INTERVAL_MS;
  },

  updateSyncInterval() {
    if (this.syncService && typeof this.syncService.setIntervalMs === 'function') {
      this.syncService.setIntervalMs(this.getSyncInterval());
    }
  },

  getBuildingLevel(buildingId) {
    const entry = this.state.buildings?.[buildingId];
    if (!entry) return 0;
    return typeof entry === 'object' ? entry.level || 0 : Number(entry) || 0;
  },

  isEra2AdvanceReady(progress = this.state.eraProgress) {
    return this.state.currentEra === 1
      && Boolean(progress?.canAdvance)
      && this.getBuildingLevel('house') > 0;
  },

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
  },

  canAdvanceEraByTutorial() {
    return this.presenter.canAdvanceEraByTutorial(this.state, this.tutorialController?.state || this.tutorial || {});
  },

  canAdvanceEraNow(progress = this.state.eraProgress) {
    const view = this.presenter.buildCivilizationViewState(
      { ...this.state, eraProgress: progress },
      this.tutorialController?.state || this.tutorial || {},
      { canOpenCivilizationTab: !this.tutorialController || this.tutorialController.canOpenTab('civilization') },
    );
    return view.advanceButton.canAdvance;
  },

  async handleBuildingSuccess(result, action, buildingId) {
    this.applyApiState(result);
    if (buildingId === 'farm' && action === 'build') {
      this.tutorialController.notifyFarmBuilt(result.tutorial);
      this.showFloatingText('农田建成！');
    } else if (buildingId === 'house' && action === 'build') {
      this.tutorialController.notifyHouseBuilt(result.tutorial);
      this.showFloatingText('民居建成！');
    } else if (buildingId === 'lumbermill' && action === 'build') {
      this.tutorialController.notifyLumbermillBuilt(result.tutorial);
      this.showFloatingText('伐木场建成！');
    } else {
      this.showFloatingText(action === 'upgrade' ? '升级成功！' : '建造成功！');
    }
    this.log(`✅ ${result.message}`);
  },

  async advanceEra() {
    if (!this.canAdvanceEraNow()) {
      this.log(this.state.isCapitalCity === false ? '只有主城可以推动文明进阶' : this.canAdvanceEraByTutorial() ? '条件不足，无法进阶' : '引导未解锁，先完成当前引导');
      this.renderMilitary();
      this.canvasShell?.renderReadOnly(this.state, this.state.currentTab);
      return;
    }
    try {
      const result = await this.gameAPI.advanceEra();
      this.applyApiState(result);
      this.tutorialController.notifyEraAdvanced(result.tutorial);
      this.log(`🏛️ ${result.message}`);
      this.showFloatingText(`进入${this.state.currentEraName}`);
    } catch (error) {
      this.log(`❌ ${error.payload?.message || error.message}`);
    } finally {
      this.renderMilitary();
      this.canvasShell?.renderReadOnly(this.state, this.state.currentTab);
    }
  },

  switchTab(tabId) {
    const navigation = this.presenter.buildTabNavigationViewState(this.state, { requestedTab: tabId });
    const nextTabId = navigation.activeTab;
    const preferredMilitaryView = this.getPreferredMilitaryView(tabId);
    if (preferredMilitaryView) this.state.militaryView = preferredMilitaryView;
    this.state.currentTab = nextTabId;
    this.renderMilitaryView();
    this.tutorialController.render();
    if (this.canvasShell?.previewEnabled) {
      this.canvasShell.renderReadOnly(this.state, this.state.currentTab);
    }
  },

  getPreferredMilitaryView(tabId) {
    if (tabId === 'territory') return 'world';
    if (tabId !== 'military') return null;
    const guide = this.state.softGuide || {};
    const target = guide.target || '';
    const message = String(guide.message || '');
    if (target === 'tab-territory') return 'world';
    if (target !== 'tab-military') return null;
    if (/侦察|探索/.test(message)) return 'scout';
    if (/领土|疆域|世界|占领/.test(message)) return 'world';
    return null;
  },

  switchMilitaryView(view) {
    const allowed = ['army', 'scout', 'world'];
    this.state.militaryView = allowed.includes(view) ? view : 'army';
    this.renderMilitaryView();
    this.tutorialController.render();
    if (this.canvasShell?.previewEnabled) {
      this.canvasShell.renderReadOnly(this.state, this.state.currentTab);
    }
  },

  renderMilitaryView() {
    const view = this.presenter.buildMilitaryNavigationViewState(this.state);
    this.state.militaryView = view.activeView;
  },

  updateMilitaryViewLocks() {
    this.renderMilitaryView();
  },

  getTutorialTarget(key) {
    return this.canvasShell?.getTutorialTarget?.(key) || null;
  },

  render() {
    this.renderTerritory();
    this.tutorialController.render();
    this.renderSoftGuide();
    this.maybeShowNamingPrompt();
    if (this.canvasShell?.previewEnabled) {
      this.canvasShell.renderReadOnly(this.state, this.state.currentTab);
    }
  },

  toggleCitySwitcher() {
    if (!this.canvasShell) return;
    this.canvasShell.showCitySwitcher = !this.canvasShell.showCitySwitcher;
    this.canvasShell.renderReadOnly(this.state, this.state.currentTab);
  },

  closeCitySwitcher() {
    if (!this.canvasShell) return;
    this.canvasShell.showCitySwitcher = false;
    this.canvasShell.renderReadOnly(this.state, this.state.currentTab);
  },

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  },

  async switchCity(cityId) {
    if (!cityId || cityId === this.state.activeCityId) return;
    try {
      this.closeCitySwitcher();
      const result = await this.gameAPI.switchCity(cityId);
      this.applyApiState(result);
      this.showFloatingText(result.message || '城市已切换');
      this.log(`🏛️ ${result.message || '城市已切换'}`);
    } catch (error) {
      this.log(`❌ ${error.payload?.message || error.message}`);
      this.canvasShell?.renderReadOnly(this.state, this.state.currentTab);
    }
  },

  renderMilitary() {
    this.updateMilitaryViewLocks();
    this.canvasShell?.renderReadOnly(this.state, this.state.currentTab);
  },

  startScoutCountdownTimer() {
    if (this.scoutCountdownTimer) return;
    this.scoutCountdownTimer = this.scheduler?.setInterval?.(() => {
      if ((this.state.currentEra || 0) < 5) return;
      if (this.state.currentTab === 'military') {
        this.canvasShell?.renderReadOnly(this.state, this.state.currentTab);
      }
      if (this.state.currentTab === 'territory') {
        const territories = this.state.territoryState?.territories || [];
        const hasConquestMission = territories.some((site) => site.mission?.status === 'active');
        if (hasConquestMission) this.renderTerritory();
      }
    }, 1000);
  },

  getMissionRemainingSeconds(mission) {
    return this.presenter.getScoutMissionRemainingSeconds(mission);
  },

  formatScoutCountdown(seconds) {
    return this.presenter.formatScoutCountdown(seconds);
  },

  renderTerritory() {
    this.canvasShell?.renderReadOnly(this.state, this.state.currentTab);
  },

  maybeShowNamingPrompt() {
    const prompt = this.state.territoryState?.namingPrompt;
    if (!prompt || this.activeNamingPromptKey === `${prompt.type}:${prompt.territoryId || 'polity'}`) return;
    this.openNamingModal(prompt);
  },

  requestCityRename(prompt = {}) {
    if (!prompt.territoryId) return null;
    this.openNamingModal({
      type: 'city',
      territoryId: prompt.territoryId,
      title: '为这座城市命名',
      message: `当前名称：${prompt.currentName || '未命名城市'}`,
    });
    return null;
  },

  openNamingModal(prompt) {
    const view = this.presenter.buildNamingPromptViewState(prompt);
    this.activeNamingPrompt = prompt;
    this.activeNamingPromptKey = view.key;
    this.canvasShell?.openNaming(view);
  },

  closeNamingModal() {
    this.canvasShell?.closeNaming();
  },

  async submitNaming(inputName) {
    const prompt = this.activeNamingPrompt;
    const name = String(inputName ?? this.canvasShell?.getNamingName?.() ?? '').trim();
    if (!prompt || !name) return;
    this.canvasShell?.setNamingSubmitting(true);
    try {
      const result = prompt.type === 'polity'
        ? await this.gameAPI.renamePolity(name)
        : await this.gameAPI.renameCity(prompt.territoryId, name);
      this.closeNamingModal();
      this.activeNamingPrompt = null;
      this.activeNamingPromptKey = null;
      this.applyApiState(result);
      this.showFloatingText(result.message);
      this.log(`✅ ${result.message}`);
    } catch (error) {
      this.log(`❌ ${error.payload?.message || error.message}`);
    } finally {
      this.canvasShell?.setNamingSubmitting(false);
    }
  },

  renderSoftGuide() {
    const guide = this.state.softGuide;
    this.updateAdvisor(guide);
  },

  updateAdvisor(guide) {
    const view = this.presenter.buildAdvisorViewState(guide);
    this.activeAdvisor = view.activeAdvisor;
    if (this.canvasShell?.previewEnabled) {
      this.canvasShell.renderReadOnly(this.state, this.state.currentTab);
    }
  },

  goToAdvisorTarget() {
    const tabId = this.presenter.getAdvisorTargetTab(this.activeAdvisor?.target);
    if (tabId) this.switchTab(tabId);
  },

  showFloatingText(message) {
    const shown = this.canvasShell?.showFloatingText?.(message);
    if (!shown) this.log(message);
  },

  log(message) {
    const entry = { text: String(message ?? ''), timestamp: Date.now() };
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > 30) this.recentLogs = this.recentLogs.slice(0, 30);
  },
};

window.H5GameBootstrap?.mount(Game, { document, runtime: window });
