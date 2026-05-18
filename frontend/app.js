const Game = {
  apiBase: window.GameConfig.API_BASE,
  token: localStorage.getItem('cf_token'),
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

  init() {
    this.gameAPI = new window.GameAPI(this.apiBase, this.token);
    this.buildingAPI = { setToken: (token) => this.gameAPI.setToken(token) };
    this.syncService = new window.GameStateSync(this.gameAPI, window.GameConfig.SYNC_INTERVAL_MS);
    this.updateChecker = new window.UpdateChecker({
      api: this.gameAPI,
      intervalMs: window.GameConfig.UPDATE_CHECK_INTERVAL_MS,
      onUpdate: (version) => this.showUpdatePrompt(version),
    });
    this.stateManager = new window.GameStateManager(this.state);
    this.resourceRenderer = new window.ResourceRenderer((id, value) => this.setText(id, value));
    this.buildingRenderer = new window.BuildingUIRenderer(document.getElementById('buildingGrid'), {});
    this.eventRenderer = new window.EventUIRenderer((id, value) => this.setText(id, value));
    this.territoryRenderer = new window.TerritoryUIRenderer(document.getElementById('territoryGrid'));
    this.tutorialRenderer = new window.TutorialUIRenderer();
    this.tutorialRenderer.onSoftGuide = (message) => this.updateAdvisor({ message });
    this.tutorialController = new window.TutorialController({
      api: this.gameAPI,
      renderer: this.tutorialRenderer,
      getTarget: (key) => this.getTutorialTarget(key),
      getCurrentTab: () => this.state.currentTab,
      isEventModalOpen: () => document.getElementById('eventModal')?.classList.contains('show') || false,
      getState: () => this.state,
      onTabLockChange: () => this.updateTabLocks(),
    });
    this.eventController = new window.EventController({
      api: this.gameAPI,
      renderer: this.eventRenderer,
      getState: () => this.state,
      onStateApplied: (result) => this.applyApiState(result),
      onTutorialUpdated: (tutorial) => this.tutorialController.notifySpecialEventClaimed(tutorial),
      onFloatingText: (message) => this.showFloatingText(message),
      onLog: (message) => this.log(message),
    });
    this.buildingController = new window.BuildingController({
      container: document.getElementById('buildingGrid'),
      api: this.gameAPI,
      onSuccess: (result, action, buildingId) => this.handleBuildingSuccess(result, action, buildingId),
      onError: (error) => this.log(`❌ ${error.payload?.message || error.message}`),
    });
    this.territoryController = new window.TerritoryController({
      container: document.getElementById('territoryGrid'),
      scoutContainer: document.getElementById('scoutDirectionGrid'),
      api: this.gameAPI,
      getState: () => this.state,
      onRenderRequested: () => this.renderTerritory(),
      onStateApplied: (result) => this.applyApiState(result),
      onFloatingText: (message) => this.showFloatingText(message),
      onLog: (message) => this.log(message),
    });

    if (window.mountAuthMethods) window.mountAuthMethods(this);
    if (window.mountPopulationMethods) window.mountPopulationMethods(this);
    if (window.mountLogMethods) window.mountLogMethods(this);

    this.syncService.onState = (data) => this.applyApiState(data);
    this.syncService.onError = (error) => {
      if (error.payload && error.payload.error && this.handleAuthError) this.handleAuthError(error.payload);
    };

    this.bindBaseEvents();
    if (this.bindPopulationEvents) this.bindPopulationEvents();
    this.buildingController.bind();
    this.territoryController.bind();
    this.startScoutCountdownTimer();
    this.updateChecker.start();
    this.render();
  },

  bindBaseEvents() {
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.addEventListener('click', async (event) => {
        if (event.currentTarget.disabled) return;
        const tabId = event.currentTarget.dataset.tab;
        const allowed = await this.tutorialController.onTabClicked(tabId).catch(() => false);
        if (!allowed) {
          this.log('👉 请先完成当前引导步骤');
          return;
        }
        this.switchTab(tabId);
      });
    });

    document.querySelectorAll('[data-military-view]').forEach((button) => {
      button.addEventListener('click', (event) => {
        this.switchMilitaryView(event.currentTarget.dataset.militaryView);
      });
    });

    const advanceButton = document.getElementById('btnAdvanceEra');
    if (advanceButton) {
      advanceButton.addEventListener('click', () => this.advanceEra());
    }

    const pendingEvents = document.getElementById('pendingEventsContainer');
    if (pendingEvents) {
      pendingEvents.addEventListener('click', (event) => {
        const card = event.target.closest('[data-event-id]');
        if (!card) return;
        this.eventController.open(card.dataset.eventId);
      });
    }

    const claimButton = document.getElementById('btnClaimEvent');
    if (claimButton) {
      claimButton.addEventListener('click', (event) => this.eventController.claimActive(event.currentTarget.dataset.optionId));
    }

    const eventModalOptions = document.getElementById('eventModalOptions');
    if (eventModalOptions) {
      eventModalOptions.addEventListener('click', (event) => {
        const button = event.target.closest('[data-option-id]');
        if (!button) return;
        this.eventController.claimActive(button.dataset.optionId);
      });
    }

    const closeButton = document.getElementById('btnCloseEventModal');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.eventController.close());
    }

    const resourcePanel = document.getElementById('resourcePanel');
    if (resourcePanel) {
      resourcePanel.addEventListener('click', () => this.openResourceDetails());
    }

    const resourceModal = document.getElementById('resourceDetailModal');
    if (resourceModal) {
      resourceModal.addEventListener('click', (event) => {
        if (event.target === resourceModal) this.closeResourceDetails();
      });
    }

    const closeResourceButton = document.getElementById('btnCloseResourceDetail');
    if (closeResourceButton) {
      closeResourceButton.addEventListener('click', () => this.closeResourceDetails());
    }

    const namingModal = document.getElementById('namingModal');
    if (namingModal) {
      namingModal.addEventListener('click', (event) => {
        if (event.target === namingModal) this.closeNamingModal();
      });
    }
    const closeNamingButton = document.getElementById('btnCloseNamingModal');
    if (closeNamingButton) closeNamingButton.addEventListener('click', () => this.closeNamingModal());
    const submitNamingButton = document.getElementById('btnSubmitNaming');
    if (submitNamingButton) submitNamingButton.addEventListener('click', () => this.submitNaming());

    const advisorButton = document.getElementById('advisorBtn');
    if (advisorButton) advisorButton.addEventListener('click', () => this.openAdvisor());
    const logButton = document.getElementById('logButton');
    if (logButton) logButton.addEventListener('click', () => this.showRecentLogs());
    const settingsButton = document.getElementById('settingsBtn');
    if (settingsButton) settingsButton.addEventListener('click', () => this.toggleSettings());
    const advisorModal = document.getElementById('advisorModal');
    if (advisorModal) {
      advisorModal.addEventListener('click', (event) => {
        if (event.target === advisorModal) this.closeAdvisor();
      });
    }
    const closeAdvisorButton = document.getElementById('btnCloseAdvisor');
    if (closeAdvisorButton) closeAdvisorButton.addEventListener('click', () => this.closeAdvisor());
    const dismissAdvisorButton = document.getElementById('btnAdvisorDismiss');
    if (dismissAdvisorButton) dismissAdvisorButton.addEventListener('click', () => this.closeAdvisor());
    const advisorGoButton = document.getElementById('btnAdvisorGo');
    if (advisorGoButton) advisorGoButton.addEventListener('click', () => this.goToAdvisorTarget());
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
      clearInterval(this.scoutCountdownTimer);
      this.scoutCountdownTimer = null;
    }
  },

  showUpdatePrompt(version) {
    const message = `游戏有更新，需要重启后继续。${version?.version ? `\n版本：${version.version}` : ''}`;
    const confirmed = window.confirm(message);
    if (confirmed) {
      this.forceReloadForUpdate();
      return;
    }
    this.forceReloadForUpdate();
  },

  async clearRuntimeCaches() {
    if (window.caches?.keys) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
    if (navigator.serviceWorker?.getRegistrations) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  },

  forceReloadForUpdate() {
    this.stopHeartbeat();
    this.clearRuntimeCaches()
      .catch(() => {})
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('reload', Date.now().toString());
        window.location.replace(url.toString());
      });
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
    const nextState = window.FrontendGameState.normalizeGameState(data);
    this.tutorial = window.FrontendGameState.normalizeTutorialState(data);
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
    if (step === 8) return window.GameConfig.TUTORIAL_WAIT_SYNC_INTERVAL_MS || 500;
    return window.GameConfig.SYNC_INTERVAL_MS;
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
    const tutorial = this.tutorialController?.state || this.tutorial || {};
    if (tutorial.completed) return true;
    const step = Number(tutorial.currentStep) || 0;
    if (this.state.currentEra === 0) return step >= 2;
    if (this.state.currentEra === 1) return step >= 9;
    return true;
  },

  canAdvanceEraNow(progress = this.state.eraProgress) {
    return Boolean(progress?.canAdvance)
      && this.canAdvanceEraByTutorial()
      && (!this.tutorialController || this.tutorialController.canOpenTab('civilization'));
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
    const button = document.getElementById('btnAdvanceEra');
    if (button) button.disabled = true;
    if (!this.canAdvanceEraNow()) {
      this.log(this.canAdvanceEraByTutorial() ? '条件不足，无法进阶' : '引导未解锁，先完成当前引导');
      this.renderCivilization();
      this.renderMilitary();
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
      this.renderCivilization();
      this.renderMilitary();
    }
  },

  switchTab(tabId) {
    const nextTabId = tabId === 'territory' ? 'military' : tabId;
    const preferredMilitaryView = this.getPreferredMilitaryView(tabId);
    if (preferredMilitaryView) this.state.militaryView = preferredMilitaryView;
    this.state.currentTab = nextTabId;
    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', page.dataset.page === nextTabId);
    });
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === nextTabId);
    });
    this.renderMilitaryView();
    this.tutorialController.render();
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
  },

  renderMilitaryView() {
    this.updateMilitaryViewLocks();
    const activeView = this.state.militaryView || 'army';
    document.querySelectorAll('[data-military-page]').forEach((page) => {
      page.classList.toggle('active', page.dataset.militaryPage === activeView);
    });
    document.querySelectorAll('[data-military-view]').forEach((button) => {
      const isActive = button.dataset.militaryView === activeView;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });
  },

  updateMilitaryViewLocks() {
    const locked = (this.state.currentEra || 0) < 5;
    if (locked && this.state.militaryView !== 'army') this.state.militaryView = 'army';
    if (typeof document.querySelectorAll !== 'function') return;
    document.querySelectorAll('[data-military-view]').forEach((button) => {
      const view = button.dataset.militaryView;
      const disabled = locked && view !== 'army';
      button.disabled = disabled;
      button.classList.toggle('is-locked', disabled);
      button.title = disabled ? '进入古典时代后解锁' : '';
    });
  },

  updateTabLocks() {
    document.querySelectorAll('.tab-btn').forEach((button) => {
      const tabId = button.dataset.tab;
      const allowed = this.tutorialController.canOpenTab(tabId);
      button.classList.toggle('is-locked', !allowed);
      button.disabled = !allowed;
    });
  },

  getTutorialTarget(key) {
    if (key === 'tab-resources') return document.getElementById('tabResources');
    if (key === 'tab-civilization') return document.getElementById('tabCivilization');
    if (key === 'tab-buildings') return document.getElementById('tabBuildings');
    if (key === 'tab-events') return document.getElementById('tabEvents');
    if (key === 'tab-military') return document.getElementById('tabMilitary');
    if (key === 'tab-territory') return document.getElementById('tabMilitary');
    if (key === 'btn-advance-era') return document.getElementById('btnAdvanceEra');
    if (key === 'btn-claim-event') return document.getElementById('btnClaimEvent');
    if (key === 'food-value') return document.getElementById('foodValue');
    if (key === 'card-farm') return document.getElementById('card-farm');
    if (key === 'card-house') return document.getElementById('card-house');
    if (key === 'event-card-special') return document.getElementById('event-card-special');
    if (key === 'card-lumbermill') return document.getElementById('card-lumbermill');
    if (key === 'card-barracks') return document.getElementById('card-barracks');
    if (key === 'card-craftsman') return document.getElementById('craftsmanCard');
    return null;
  },

  render() {
    this.renderResources();
    if (this.renderPopulation) {
      this.renderPopulation();
      this.updatePopulationButtons();
    }
    this.renderBuildings();
    this.renderCivilization();
    this.renderMilitary();
    this.renderTerritory();
    this.renderEvents();
    this.tutorialController.render();
    this.renderSoftGuide();
    this.maybeShowNamingPrompt();
  },

  renderResources() {
    this.resourceRenderer.render(this.state);
  },

  openResourceDetails() {
    const modal = document.getElementById('resourceDetailModal');
    if (!modal) return;
    this.renderResources();
    modal.classList.add('show');
  },

  closeResourceDetails() {
    const modal = document.getElementById('resourceDetailModal');
    if (!modal) return;
    modal.classList.remove('show');
  },

  renderBuildings() {
    this.buildingRenderer.render(this.state, this.tutorialController.state);
  },

  renderCivilization() {
    const eraName = this.state.currentEraName || '原始时代';
    this.setText('eraName', eraName);
    this.setText('civOverviewEraName', eraName);
    this.setText('civOverviewDay', `第 ${this.state.gameDay || 1} 天`);
    this.setText('civOverviewPop', this.state.population.total || 0);
    this.setText('civOverviewBuildings', this.state.totalBuildings || 0);
    this.setText('civOverviewTechs', `${Object.keys(this.state.techs || {}).length}/0`);
    this.setText('civOverviewHappiness', `${this.state.happiness || 100}%`);

    const progress = this.state.eraProgress || { percentage: 0, canAdvance: false, conditions: [] };
    const bar = document.getElementById('eraProgress');
    if (bar) bar.style.width = `${progress.percentage || 0}%`;
    this.setText('eraProgressText', `总进度: ${progress.percentage || 0}%`);
    const targetEraName = progress.targetEraName || '时代未开放';
    this.setText('eraTargetName', targetEraName);
    this.renderEraConditions(progress.conditions || []);

    const button = document.getElementById('btnAdvanceEra');
    const label = document.getElementById('btnEraLabel');
    const canAdvanceByTutorial = this.canAdvanceEraByTutorial();
    const canAdvance = this.canAdvanceEraNow(progress);
    if (button) {
      button.disabled = !canAdvance;
    }
    if (label) {
      if (progress.canAdvance && !canAdvanceByTutorial) label.textContent = '引导未解锁';
      else if (progress.canAdvance) label.textContent = '满足条件，可进阶';
      else label.textContent = '条件不足，无法进阶';
    }
    const features = typeof document.querySelector === 'function'
      ? document.querySelector('.civ-features-list')
      : null;
    if (features) {
      const description = this.state.currentEraDescription || `${eraName}：继续建设你的文明。`;
      features.innerHTML = `<div class="civ-feature-item">${description}</div>`;
    }
  },

  renderMilitary() {
    const military = this.state.military || {};
    const panel = document.getElementById('militaryPanel');
    if (!panel) return;
    const soldiers = Math.floor(military.soldiers || 0);
    const cap = Math.floor(military.soldierCap || 0);
    const defense = Math.floor((military.defense || 0) + (this.state.buildingEffects?.threatDefense || 0));
    const interval = Math.floor(military.trainingIntervalSeconds || 0);
    const progress = Math.floor(military.trainingProgress || 0);
    this.setText('soldierCount', `${soldiers}/${cap}`);
    this.setText('militaryDefense', defense);
    this.setText('availableSoldierCount', Math.floor(this.state.territoryState?.availableSoldiers ?? military.availableSoldiers ?? soldiers));
    this.setText('soldiersOnMission', Math.floor(this.state.territoryState?.soldiersOnMission ?? military.soldiersOnMission ?? 0));
    this.renderScoutControls();
    this.updateMilitaryViewLocks();

    const progressBar = document.getElementById('soldierTrainingProgress');
    if (soldiers >= cap && cap > 0) {
      this.setText('soldierTrainingText', '训练已满');
      if (progressBar) progressBar.style.width = '100%';
      return;
    }
    if (cap <= 0 || interval <= 0) {
      this.setText('soldierTrainingText', '等待兵营');
      if (progressBar) progressBar.style.width = '0%';
      return;
    }

    const percentage = Math.max(0, Math.min(100, Math.floor((progress / interval) * 100)));
    this.setText('soldierTrainingText', `下一名 ${progress}/${interval} 秒`);
    if (progressBar) progressBar.style.width = `${percentage}%`;
  },

  startScoutCountdownTimer() {
    if (this.scoutCountdownTimer) return;
    this.scoutCountdownTimer = setInterval(() => {
      if ((this.state.currentEra || 0) < 5) return;
      if (this.state.currentTab === 'military') {
        this.renderScoutControls();
      }
      if (this.state.currentTab === 'territory') {
        const territories = this.state.territoryState?.territories || [];
        const hasConquestMission = territories.some((site) => site.mission?.status === 'active');
        if (hasConquestMission) this.renderTerritory();
      }
    }, 1000);
  },

  getMissionRemainingSeconds(mission) {
    if (!mission) return 0;
    if (mission.status === 'ready') return 0;
    const completesAtMs = new Date(mission.completesAt).getTime();
    if (Number.isFinite(completesAtMs)) {
      return Math.max(0, Math.ceil((completesAtMs - Date.now()) / 1000));
    }
    return Math.max(0, Math.ceil(Number(mission.remainingSeconds) || 0));
  },

  formatScoutCountdown(seconds) {
    const value = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  },

  renderTerritory() {
    const territoryState = this.state.territoryState || {};
    const polityName = territoryState.polity?.name || territoryState.polity?.capitalCityName || '未命名势力';
    this.setText('territoryPolityName', polityName);
    this.setText('territoryCount', `${territoryState.occupiedCount || 0}/${territoryState.discoveredCount || 0} 已控制`);
    if (this.territoryRenderer) this.territoryRenderer.render(this.state);
  },

  renderScoutControls() {
    const container = document.getElementById('scoutDirectionGrid');
    if (!container) return;
    const territoryState = this.state.territoryState || {};
    if ((this.state.currentEra || 0) < 5) {
      this.setText('scoutStatus', '进入古典时代后可派出侦察队。');
      container.innerHTML = '';
      return;
    }
    const directions = territoryState.directions || [];
    const scoutMissions = territoryState.scoutMissions || [];
    const activeByDirection = new Map(scoutMissions.map((mission) => [mission.direction, mission]));
    const activeScouts = scoutMissions.filter((mission) => mission.status === 'active');
    const activeScout = activeScouts[0];
    const readyCount = scoutMissions.filter((mission) => mission.status === 'ready').length;
    const maxActiveScouts = Math.max(1, Math.floor(territoryState.maxActiveScouts || 1));
    if (readyCount > 0 && activeScouts.length > 0) {
      this.setText('scoutStatus', `${readyCount} 份报告待查看，另有 ${activeScouts.length} 支侦察队仍在外。`);
    } else if (readyCount > 0) {
      this.setText('scoutStatus', `${readyCount} 份侦察报告待查看，你仍可继续派出侦察队。`);
    } else if (activeScouts.length > 1) {
      this.setText('scoutStatus', `${activeScouts.length} 支侦察队在外行动，最早一支约 ${this.formatScoutCountdown(this.getMissionRemainingSeconds(activeScout))} 后返回。`);
    } else if (activeScout) {
      const label = directions.find((direction) => direction.id === activeScout.direction)?.label || '外部';
      this.setText('scoutStatus', `${label}侦察中，预计 ${this.formatScoutCountdown(this.getMissionRemainingSeconds(activeScout))} 后返回。`);
    } else {
      this.setText('scoutStatus', `选择方向派出侦察队；同一时间最多可有 ${maxActiveScouts} 支侦察队在外。`);
    }
    const labels = new Map(directions.map((direction) => [direction.id, direction.label]));
    const order = [
      ['nw', '西北'], ['n', '北'], ['ne', '东北'],
      ['w', '西'], ['center', '本城'], ['e', '东'],
      ['sw', '西南'], ['s', '南'], ['se', '东南'],
    ];
    container.innerHTML = order.map(([id, fallbackLabel]) => {
      if (id === 'center') {
        return '<div class="scout-center" aria-hidden="true"><span>城</span><small>本城</small></div>';
      }
      if (!labels.has(id)) return '';
      const label = labels.get(id) || fallbackLabel;
      const mission = activeByDirection.get(id);
      if (mission?.status === 'ready') {
        return `<button class="btn-scout direction-${id} status-ready" data-scout-claim="${mission.id}" aria-label="${label}侦察报告"><span class="scout-direction-label">${label}</span><span class="scout-action">报告</span></button>`;
      }
      if (mission) {
        return `<button class="btn-scout direction-${id} status-active" disabled aria-label="${label}侦察中"><span class="scout-direction-label">${label}</span><span class="scout-action">${this.formatScoutCountdown(this.getMissionRemainingSeconds(mission))}</span></button>`;
      }
      if (activeByDirection.has(id)) {
        return '';
      }
      if (activeScouts.length >= maxActiveScouts) {
        return `<button class="btn-scout direction-${id} status-locked" disabled aria-label="${label}侦察暂不可用"><span class="scout-direction-label">${label}</span><span class="scout-action">等待</span></button>`;
      }
      return `<button class="btn-scout direction-${id} status-available" data-scout-direction="${id}" aria-label="向${label}派出侦察"><span class="scout-direction-label">${label}</span><span class="scout-action">派出</span></button>`;
    }).join('');
  },

  maybeShowNamingPrompt() {
    const prompt = this.state.territoryState?.namingPrompt;
    if (!prompt || this.activeNamingPromptKey === `${prompt.type}:${prompt.territoryId || 'polity'}`) return;
    this.openNamingModal(prompt);
  },

  openNamingModal(prompt) {
    const modal = document.getElementById('namingModal');
    const title = document.getElementById('namingTitle');
    const message = document.getElementById('namingMessage');
    const input = document.getElementById('namingInput');
    if (!modal || !input) return;
    this.activeNamingPrompt = prompt;
    this.activeNamingPromptKey = `${prompt.type}:${prompt.territoryId || 'polity'}`;
    if (title) title.textContent = prompt.title || '命名';
    if (message) message.textContent = prompt.message || '';
    input.value = '';
    input.placeholder = prompt.type === 'polity' ? '例如：赤火联盟' : '例如：河湾城';
    modal.classList.add('show');
    input.focus();
  },

  closeNamingModal() {
    const modal = document.getElementById('namingModal');
    if (modal) modal.classList.remove('show');
  },

  async submitNaming() {
    const prompt = this.activeNamingPrompt;
    const input = document.getElementById('namingInput');
    const button = document.getElementById('btnSubmitNaming');
    const name = input?.value?.trim();
    if (!prompt || !name) return;
    if (button) button.disabled = true;
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
      if (button) button.disabled = false;
    }
  },

  renderSoftGuide() {
    const guide = this.state.softGuide;
    this.updateAdvisor(guide);
  },

  updateAdvisor(guide) {
    const message = guide?.message || '';
    const button = document.getElementById('advisorBtn');
    const modal = document.getElementById('advisorModal');
    const messageElement = document.getElementById('advisorMessage');
    const goButton = document.getElementById('btnAdvisorGo');
    if (button) button.hidden = !message;
    if (messageElement) messageElement.textContent = message || '暂无建议。';
    this.activeAdvisor = message ? { message, target: guide?.target || null } : null;
    if (goButton) goButton.disabled = !this.activeAdvisor?.target;
    if (!message && modal) modal.classList.remove('show');
  },

  openAdvisor() {
    if (!this.activeAdvisor?.message) return;
    const modal = document.getElementById('advisorModal');
    if (modal) modal.classList.add('show');
  },

  closeAdvisor() {
    const modal = document.getElementById('advisorModal');
    if (modal) modal.classList.remove('show');
  },

  goToAdvisorTarget() {
    const target = this.activeAdvisor?.target;
    if (target === 'tab-territory') {
      this.switchTab('territory');
    } else if (target?.startsWith('tab-')) {
      this.switchTab(target.slice(4));
    }
    this.closeAdvisor();
  },

  showRecentLogs() {
    const modal = document.getElementById('logModal');
    const content = document.getElementById('logModalContent');
    if (!modal || !content) return;
    const entries = Array.from(document.querySelectorAll('#logContent .log-item')).slice(0, 20);
    if (!entries.length) {
      content.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">暂无日志</div>';
    } else {
      content.innerHTML = `<div style="display:grid;gap:8px;max-height:60vh;overflow:auto;">${entries.map((entry) => (
        `<div style="padding:8px 10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#ddd;background:rgba(255,255,255,0.04);font-size:12px;line-height:1.4;">${entry.textContent}</div>`
      )).join('')}</div>`;
    }
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  },

  renderEraConditions(conditions) {
    const container = document.getElementById('eraConditions');
    if (!container) return;
    container.innerHTML = conditions.map((condition) => `
      <div class="era-condition-item ${condition.met ? 'met' : 'unmet'}">
        <div class="era-condition-name">${condition.name}</div>
        <div class="era-condition-progress">${condition.current}/${condition.required}</div>
      </div>
    `).join('');
  },

  renderEvents() {
    this.eventRenderer.render(this.state);
  },

  showFloatingText(message) {
    if (window.showFloatingText) {
      window.showFloatingText(message);
      return;
    }
    this.log(message);
  },

  showOfflineModal() {},

  setText(id, value) {
    window.DOMHelper.setText(id, value);
  },

  log(message) {
    const content = document.getElementById('logContent');
    if (!content) return;
    const item = document.createElement('div');
    item.className = 'log-item';
    item.textContent = message;
    content.prepend(item);
    while (content.children.length > 30) {
      content.removeChild(content.lastChild);
    }
  },
};

window.Game = Game;
document.addEventListener('DOMContentLoaded', () => Game.init());
