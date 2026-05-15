const Game = {
  apiBase: window.GameConfig.API_BASE,
  token: localStorage.getItem('cf_token'),
  playerId: null,
  state: {
    resources: {},
    buildings: {},
    buildingCosts: {},
    buildingEffects: {},
    unlockedBuildings: [],
    currentEra: 0,
    currentEraName: '原始时代',
    population: { total: 3, max: 3, maxPop: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
    happiness: 100,
    gameDay: 1,
    totalBuildings: 0,
    eraProgress: { percentage: 0, canAdvance: false, conditions: [] },
    currentTab: 'resources',
    techs: {},
    eventQueue: [],
    eventHistory: [],
  },
  tutorial: { completed: false, currentStep: 0 },
  requestLogs: [],

  init() {
    this.gameAPI = new window.GameAPI(this.apiBase, this.token);
    this.buildingAPI = { setToken: (token) => this.gameAPI.setToken(token) };
    this.syncService = new window.GameStateSync(this.gameAPI, window.GameConfig.SYNC_INTERVAL_MS);
    this.buildingRenderer = new window.BuildingUIRenderer(document.getElementById('buildingGrid'), window.GameConfig.BUILDINGS);
    this.tutorialRenderer = new window.TutorialUIRenderer();
    this.tutorialController = new window.TutorialController({
      api: this.gameAPI,
      renderer: this.tutorialRenderer,
      getTarget: (key) => this.getTutorialTarget(key),
      onTabLockChange: () => this.updateTabLocks(),
    });
    this.buildingController = new window.BuildingController({
      container: document.getElementById('buildingGrid'),
      api: this.gameAPI,
      onSuccess: (result, action, buildingId) => this.handleBuildingSuccess(result, action, buildingId),
      onError: (error) => this.log(`❌ ${error.payload?.message || error.message}`),
    });

    if (window.mountAuthMethods) window.mountAuthMethods(this);
    if (window.mountPopulationMethods) window.mountPopulationMethods(this);
    if (window.mountLogMethods) window.mountLogMethods(this);

    this.syncService.onState = (data) => this.applyApiState(data);
    this.syncService.onError = (error) => {
      if (error.payload && error.payload.error && this.handleAuthError) this.handleAuthError(error.payload);
    };

    this.bindBaseEvents();
    this.buildingController.bind();
    this.render();
  },

  bindBaseEvents() {
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.addEventListener('click', async (event) => {
        const tabId = event.currentTarget.dataset.tab;
        const allowed = await this.tutorialController.onTabClicked(tabId).catch(() => false);
        if (!allowed) {
          this.log('👉 请先完成当前引导步骤');
          return;
        }
        this.switchTab(tabId);
      });
    });

    const advanceButton = document.getElementById('btnAdvanceEra');
    if (advanceButton) {
      advanceButton.addEventListener('click', () => this.advanceEra());
    }
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
    this.state = {
      ...this.state,
      ...serverState,
      currentEra: serverState.currentEra,
      currentEraName: serverState.currentEraName,
      eraProgress: eraProgress || serverState.eraProgress || { percentage: 0, canAdvance: false, conditions: [] },
      currentTab: this.state.currentTab,
    };
    this.state.era = this.state.currentEra;
    this.state.food = this.state.resources.food || 0;
    this.state.knowledge = this.state.resources.knowledge || 0;
    this.state.workshopCount = window.FrontendBuildingState.getLevel(this.state.buildings, 'workshop');
    this.state.population = {
      ...this.state.population,
      maxPop: this.state.population.max || this.state.population.maxPop || 3,
    };
    if (tutorial) this.tutorialController.setState(tutorial);
    else this.tutorialController.setState(this.tutorial);
    this.render();
  },

  async handleBuildingSuccess(result, action, buildingId) {
    this.applyApiState(result);
    if (buildingId === 'farm' && action === 'build') {
      this.tutorialController.notifyFarmBuilt(result.tutorial);
      this.showFloatingText('农田建成！');
    } else {
      this.showFloatingText(action === 'upgrade' ? '升级成功！' : '建造成功！');
    }
    this.log(`✅ ${result.message}`);
  },

  async advanceEra() {
    const button = document.getElementById('btnAdvanceEra');
    if (button) button.disabled = true;
    try {
      const result = await this.gameAPI.advanceEra();
      this.applyApiState(result);
      this.tutorialController.notifyEraAdvanced(result.tutorial);
      this.log(`🏛️ ${result.message}`);
      this.showFloatingText('进入农耕时代');
    } catch (error) {
      this.log(`❌ ${error.payload?.message || error.message}`);
    } finally {
      this.renderCivilization();
    }
  },

  switchTab(tabId) {
    this.state.currentTab = tabId;
    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', page.dataset.page === tabId);
    });
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tabId);
    });
    this.tutorialController.render();
  },

  updateTabLocks() {
    document.querySelectorAll('.tab-btn').forEach((button) => {
      const tabId = button.dataset.tab;
      const allowed = this.tutorialController.canOpenTab(tabId);
      button.classList.toggle('is-locked', !allowed);
    });
  },

  getTutorialTarget(key) {
    if (key === 'tab-civilization') return document.getElementById('tabCivilization');
    if (key === 'tab-buildings') return document.getElementById('tabBuildings');
    if (key === 'btn-advance-era') return document.getElementById('btnAdvanceEra');
    if (key === 'card-farm') return document.getElementById('card-farm');
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
    this.renderTechAndEventPlaceholders();
  },

  renderResources() {
    const resources = this.state.resources || {};
    const foodOutput = Number(resources.foodOutputPerSecond || 0);
    const foodConsumption = Number(resources.foodConsumptionPerSecond || 0);
    const foodNet = Number(
      Object.prototype.hasOwnProperty.call(resources, 'foodNetPerSecond')
        ? resources.foodNetPerSecond
        : resources.foodPerSecond || 0,
    );

    this.setText('foodValue', Math.floor(resources.food || 0));
    this.setText('knowledgeValue', Math.floor(resources.knowledge || 0));
    this.setText('foodRate', `${foodNet >= 0 ? '+' : ''}${foodNet}/s`);
    this.setText('foodOutputRate', `+${foodOutput}/s`);
    this.setText('foodConsumptionRate', `-${foodConsumption}/s`);
    this.setText('foodNetRate', `${foodNet >= 0 ? '+' : ''}${foodNet}/s`);
    this.setText('knowledgeRate', `${resources.knowledgePerSecond >= 0 ? '+' : ''}${resources.knowledgePerSecond || 0}/s`);
    this.setText('happinessValue', this.state.happiness || 100);
    this.setText('gameTime', `第 ${this.state.gameDay || 1} 天`);

    const netEl = document.getElementById('foodNetRate');
    if (netEl) {
      netEl.classList.toggle('is-positive', foodNet >= 0);
      netEl.classList.toggle('is-negative', foodNet < 0);
    }
  },

  renderBuildings() {
    this.buildingRenderer.render(this.state, this.tutorialController.state);
    this.tutorialController.render();
  },

  renderCivilization() {
    const eraName = this.state.currentEraName || window.GameConfig.ERAS[this.state.currentEra] || '原始时代';
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
    const targetEraName = progress.targetEraName || '青铜时代';
    this.setText('eraTargetName', targetEraName);
    this.renderEraConditions(progress.conditions || []);

    const button = document.getElementById('btnAdvanceEra');
    const label = document.getElementById('btnEraLabel');
    if (button) {
      const canAdvance = Boolean(progress.canAdvance) && this.tutorialController.canOpenTab('civilization');
      button.disabled = !canAdvance;
    }
    if (label) {
      if (this.state.currentEra === 0) label.textContent = '进阶（消耗 80 🌾）';
      else label.textContent = progress.canAdvance ? '满足条件，可进阶' : '条件不足，无法进阶';
    }
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

  renderTechAndEventPlaceholders() {
    this.setText('techKnowledgeRate', `${this.state.resources.knowledgePerSecond || 0}/s`);
    const pending = document.getElementById('pendingEventsContainer');
    if (pending && !this.state.eventQueue.length) pending.innerHTML = '<div class="pending-events-empty">首期暂未开放事件重构</div>';
    document.querySelectorAll('#eventHistoryList').forEach((element) => {
      if (!this.state.eventHistory.length) element.innerHTML = '<div class="event-history-empty">暂无事件记录</div>';
    });
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
