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
    this.territoryRenderer = new window.TerritoryUIRenderer(document.getElementById('territoryGrid'), {
      getUiState: () => this.territoryController?.getUiState?.() || {},
    });
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

    const citySwitcherTrigger = document.getElementById('citySwitcherTrigger');
    if (citySwitcherTrigger) {
      citySwitcherTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        this.toggleCitySwitcher();
      });
    }
    const citySwitcherMenu = document.getElementById('citySwitcherMenu');
    if (citySwitcherMenu) {
      citySwitcherMenu.addEventListener('click', (event) => {
        const option = event.target.closest('[data-city-id]');
        if (!option || option.disabled) return;
        event.stopPropagation();
        this.switchCity(option.dataset.cityId);
      });
    }
    document.addEventListener('click', (event) => {
      const wrapper = document.getElementById('citySwitcher');
      if (wrapper && !wrapper.contains(event.target)) this.closeCitySwitcher();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeCitySwitcher();
    });

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
    return window.UIStatePresenter.canAdvanceEraByTutorial(this.state, this.tutorialController?.state || this.tutorial || {});
  },

  canAdvanceEraNow(progress = this.state.eraProgress) {
    const view = window.UIStatePresenter.buildCivilizationViewState(
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
    const button = document.getElementById('btnAdvanceEra');
    if (button) button.disabled = true;
    if (!this.canAdvanceEraNow()) {
      this.log(this.state.isCapitalCity === false ? '只有主城可以推动文明进阶' : this.canAdvanceEraByTutorial() ? '条件不足，无法进阶' : '引导未解锁，先完成当前引导');
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
    const navigation = window.UIStatePresenter.buildTabNavigationViewState(this.state, { requestedTab: tabId });
    const nextTabId = navigation.activeTab;
    const preferredMilitaryView = this.getPreferredMilitaryView(tabId);
    if (preferredMilitaryView) this.state.militaryView = preferredMilitaryView;
    this.state.currentTab = nextTabId;
    const pageById = new Map(navigation.pages.map((page) => [page.id, page]));
    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', Boolean(pageById.get(page.dataset.page)?.isActive));
    });
    const tabById = new Map(navigation.tabs.map((tab) => [tab.id, tab]));
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.classList.toggle('active', Boolean(tabById.get(button.dataset.tab)?.isActive));
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
    const view = window.UIStatePresenter.buildMilitaryNavigationViewState(this.state);
    this.state.militaryView = view.activeView;
    if (typeof document.querySelectorAll !== 'function') return;
    document.querySelectorAll('[data-military-page]').forEach((page) => {
      page.classList.toggle('active', page.dataset.militaryPage === view.activeView);
    });
    const viewById = new Map(view.views.map((item) => [item.id, item]));
    document.querySelectorAll('[data-military-view]').forEach((button) => {
      const buttonView = viewById.get(button.dataset.militaryView) || { isActive: false, disabled: false, isLocked: false, title: '', ariaSelected: 'false' };
      button.disabled = buttonView.disabled;
      button.classList.toggle('is-locked', buttonView.isLocked);
      button.title = buttonView.title;
      button.classList.toggle('active', buttonView.isActive);
      button.setAttribute('aria-selected', buttonView.ariaSelected);
    });
  },

  updateMilitaryViewLocks() {
    this.renderMilitaryView();
  },

  updateTabLocks() {
    const buttons = Array.from(document.querySelectorAll('.tab-btn'));
    const view = window.UIStatePresenter.buildTabLockViewState(
      buttons.map((button) => ({ id: button.dataset.tab })),
      (tabId) => this.tutorialController.canOpenTab(tabId),
    );
    const lockById = new Map(view.map((item) => [item.id, item]));
    buttons.forEach((button) => {
      const tabView = lockById.get(button.dataset.tab) || { disabled: false, isLocked: false };
      button.classList.toggle('is-locked', tabView.isLocked);
      button.disabled = tabView.disabled;
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
    this.renderCitySwitcher();
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

  renderCitySwitcher() {
    const wrapper = document.getElementById('citySwitcher');
    const trigger = document.getElementById('citySwitcherTrigger');
    const name = document.getElementById('citySwitcherName');
    const menu = document.getElementById('citySwitcherMenu');
    if (!wrapper || !trigger || !name || !menu) return;
    const view = window.UIStatePresenter.buildCitySwitcherViewState(this.state);
    wrapper.hidden = view.hidden;
    if (wrapper.hidden) {
      this.closeCitySwitcher();
      return;
    }
    name.textContent = view.activeCityName;

    const options = view.options.map((city) => {
      return `
        <button class="city-switcher-option ${city.isActive ? 'active' : ''}" type="button" role="option" aria-selected="${city.isActive ? 'true' : 'false'}" data-city-id="${this.escapeHtml(city.id)}">
          <span class="city-option-main">
            <span class="city-option-name">${this.escapeHtml(city.name || '未命名城市')}</span>
            <span class="city-option-tag">${this.escapeHtml(city.tag)}</span>
          </span>
          <span class="city-option-meta">${this.escapeHtml(city.metaText)}</span>
        </button>
      `;
    }).join('');
    if (menu.dataset.optionsSignature !== view.signature) {
      menu.innerHTML = options;
      menu.dataset.optionsSignature = view.signature;
    }
    trigger.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
  },

  toggleCitySwitcher() {
    const wrapper = document.getElementById('citySwitcher');
    const trigger = document.getElementById('citySwitcherTrigger');
    const menu = document.getElementById('citySwitcherMenu');
    if (!wrapper || !trigger || !menu || wrapper.hidden) return;
    const nextOpen = menu.hidden;
    menu.hidden = !nextOpen;
    wrapper.classList.toggle('is-open', nextOpen);
    trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  },

  closeCitySwitcher() {
    const wrapper = document.getElementById('citySwitcher');
    const trigger = document.getElementById('citySwitcherTrigger');
    const menu = document.getElementById('citySwitcherMenu');
    if (menu) menu.hidden = true;
    if (wrapper) wrapper.classList.remove('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
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
      this.renderCitySwitcher();
    }
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
    const view = window.UIStatePresenter.buildCivilizationViewState(
      this.state,
      this.tutorialController?.state || this.tutorial || {},
      { canOpenCivilizationTab: !this.tutorialController || this.tutorialController.canOpenTab('civilization') },
    );
    this.setText('eraName', view.text.eraName);
    this.setText('civOverviewEraName', view.text.civOverviewEraName);
    this.setText('civOverviewDay', view.text.civOverviewDay);
    this.setText('civOverviewPop', view.text.civOverviewPop);
    this.setText('civOverviewBuildings', view.text.civOverviewBuildings);
    this.setText('civOverviewTechs', view.text.civOverviewTechs);
    this.setText('civOverviewHappiness', view.text.civOverviewHappiness);

    const bar = document.getElementById('eraProgress');
    if (bar) bar.style.width = view.progress.width;
    this.setText('eraProgressText', view.text.eraProgressText);
    this.setText('eraTargetName', view.text.eraTargetName);
    this.renderEraConditions(view.conditions);

    const button = document.getElementById('btnAdvanceEra');
    const label = document.getElementById('btnEraLabel');
    if (button) {
      button.disabled = view.advanceButton.disabled;
    }
    if (label) {
      label.textContent = view.text.advanceLabel;
    }
    const features = typeof document.querySelector === 'function'
      ? document.querySelector('.civ-features-list')
      : null;
    if (features) {
      features.innerHTML = `<div class="civ-feature-item">${this.escapeHtml(view.text.featureDescription)}</div>`;
    }
  },

  renderMilitary() {
    const panel = document.getElementById('militaryPanel');
    if (!panel) return;
    const view = window.UIStatePresenter.buildMilitaryViewState(this.state);
    this.setText('soldierCount', view.text.soldierCount);
    this.setText('militaryDefense', view.text.militaryDefense);
    this.setText('availableSoldierCount', view.text.availableSoldierCount);
    this.setText('soldiersOnMission', view.text.soldiersOnMission);
    this.setText('soldierTrainingText', view.text.soldierTrainingText);
    const progressBar = document.getElementById('soldierTrainingProgress');
    if (progressBar) progressBar.style.width = view.training.progressWidth;
    this.renderScoutControls();
    this.updateMilitaryViewLocks();
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
    return window.UIStatePresenter.getScoutMissionRemainingSeconds(mission);
  },

  formatScoutCountdown(seconds) {
    return window.UIStatePresenter.formatScoutCountdown(seconds);
  },

  renderTerritory() {
    const view = window.UIStatePresenter.buildTerritorySummaryViewState(this.state.territoryState || {});
    this.setText('territoryPolityName', view.text.polityName);
    this.setText('territoryCount', view.text.territoryCount);
    if (this.territoryRenderer) this.territoryRenderer.render(this.state);
  },

  renderScoutControls() {
    const container = document.getElementById('scoutDirectionGrid');
    if (!container) return;
    const view = window.UIStatePresenter.buildScoutControlViewState(this.state);
    this.setText('scoutStatus', view.statusText);
    container.innerHTML = view.cells.map((cell) => {
      if (cell.type === 'center') {
        return `<div class="scout-center" aria-hidden="true"><span>${this.escapeHtml(cell.label)}</span><small>${this.escapeHtml(cell.subLabel)}</small></div>`;
      }
      const actionAttr = cell.action === 'claim'
        ? ` data-scout-claim="${this.escapeHtml(cell.actionValue)}"`
        : cell.action === 'scout'
          ? ` data-scout-direction="${this.escapeHtml(cell.actionValue)}"`
          : '';
      return `<button class="btn-scout ${this.escapeHtml(cell.className)}" ${actionAttr} ${cell.disabled ? 'disabled' : ''} aria-label="${this.escapeHtml(cell.ariaLabel)}"><span class="scout-direction-label">${this.escapeHtml(cell.label)}</span><span class="scout-action">${this.escapeHtml(cell.actionText)}</span></button>`;
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
    const view = window.UIStatePresenter.buildNamingPromptViewState(prompt);
    this.activeNamingPrompt = prompt;
    this.activeNamingPromptKey = view.key;
    if (title) title.textContent = view.title;
    if (message) message.textContent = view.message;
    input.value = '';
    input.placeholder = view.placeholder;
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
    const view = window.UIStatePresenter.buildAdvisorViewState(guide);
    const button = document.getElementById('advisorBtn');
    const modal = document.getElementById('advisorModal');
    const messageElement = document.getElementById('advisorMessage');
    const goButton = document.getElementById('btnAdvisorGo');
    if (button) button.hidden = view.hidden;
    if (messageElement) messageElement.textContent = view.text.message;
    this.activeAdvisor = view.activeAdvisor;
    if (goButton) goButton.disabled = view.goButton.disabled;
    if (view.closeModal && modal) modal.classList.remove('show');
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
    const tabId = window.UIStatePresenter.getAdvisorTargetTab(this.activeAdvisor?.target);
    if (tabId) this.switchTab(tabId);
    this.closeAdvisor();
  },

  renderRecentLogView(view) {
    if (view.isEmpty) {
      return `<div class="recent-log-empty">${this.escapeHtml(view.emptyText)}</div>`;
    }
    return `<div class="recent-log-list">${view.items.map((entry) => (
      `<div class="recent-log-item">${this.escapeHtml(entry.text)}</div>`
    )).join('')}</div>`;
  },

  showRecentLogs() {
    const modal = document.getElementById('logModal');
    const content = document.getElementById('logModalContent');
    if (!modal || !content) return;
    const entries = Array.from(document.querySelectorAll('#logContent .log-item'));
    const view = window.UIStatePresenter.buildRecentLogViewState(entries);
    content.innerHTML = this.renderRecentLogView(view);
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  },

  renderEraConditions(conditions) {
    const container = document.getElementById('eraConditions');
    if (!container) return;
    container.innerHTML = conditions.map((condition) => `
      <div class="era-condition-item ${this.escapeHtml(condition.className)}">
        <div class="era-condition-name">${this.escapeHtml(condition.name)}</div>
        <div class="era-condition-progress">${this.escapeHtml(condition.progressText)}</div>
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
