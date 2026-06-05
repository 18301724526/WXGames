(function (global) {
  const TUTORIAL_STEPS = Object.freeze({
    initial: 0,
    tutorialStarted: 1,
    cityEntered: 2,
    houseGuideReady: 3,
    houseBuilt: 4,
    civilizationTabOpened: 5,
    eraAdvancedTo1: 6,
    buildingsTabOpened: 7,
    farmPrepReserved: 8,
    farmBuilt: 9,
    era2AdvanceReady: 10,
    eraAdvancedTo2: 11,
    specialEventTabOpened: 12,
    specialEventClaimed: 13,
    buildingsTabOpenedForLumbermill: 14,
    lumbermillBuilt: 15,
    era3AdvanceReady: 16,
    era3Advanced: 17,
    scoutFamousGranted: 18,
    famousPanelOpened: 19,
    famousCardViewed: 20,
    formationPanelOpened: 21,
    scoutFormationSaved: 22,
    scoutWorldPanelOpened: 23,
    scoutExploreStarted: 24,
    scoutExploreClaimed: 25,
    completed: 30,
  });

  class TutorialGuideController {
    constructor(options = {}) {
      this.game = options.game || null;
      this.api = options.api || null;
      this.state = options.state || null;
    }

    getApi() {
      return this.api || this.game?.getGameApi?.() || this.game?.gameAPI || this.game?.api || null;
    }

    sync(tutorial = this.game?.tutorial || this.game?.state?.tutorial || {}) {
      this.state = tutorial || {};
      if (this.game && typeof this.game === 'object') this.game.tutorial = this.state;
      return this.state;
    }

    getCurrentStep() {
      return Number(this.state?.currentStep ?? this.game?.tutorial?.currentStep ?? this.game?.state?.tutorial?.currentStep) || 0;
    }

    isCompleted() {
      return Boolean(this.state?.completed || this.game?.tutorial?.completed || this.game?.state?.tutorial?.completed);
    }

    canOpenTab(tabId) {
      if (this.isCompleted()) return true;
      const step = this.getCurrentStep();
      if (step < TUTORIAL_STEPS.houseBuilt) return ['resources', 'military', 'buildings'].includes(tabId);
      if (step < TUTORIAL_STEPS.eraAdvancedTo1) return ['resources', 'military', 'buildings', 'civilization'].includes(tabId);
      if (step <= TUTORIAL_STEPS.farmBuilt) return ['buildings', 'civilization', 'tasks'].includes(tabId);
      if (step === TUTORIAL_STEPS.era2AdvanceReady) return tabId === 'civilization';
      if (step < TUTORIAL_STEPS.specialEventClaimed) return ['civilization', 'events'].includes(tabId);
      if (step < TUTORIAL_STEPS.lumbermillBuilt) return ['events', 'buildings'].includes(tabId);
      if (step === TUTORIAL_STEPS.lumbermillBuilt) return ['buildings', 'tasks'].includes(tabId);
      if (step === TUTORIAL_STEPS.era3AdvanceReady) return ['civilization', 'buildings', 'tasks'].includes(tabId);
      if (step >= TUTORIAL_STEPS.era3Advanced && step < TUTORIAL_STEPS.scoutExploreClaimed) {
        return ['civilization', 'military'].includes(tabId);
      }
      return true;
    }

    async onTabClicked(tabId) {
      if (!this.canOpenTab(tabId)) return false;
      if (tabId === 'buildings' && this.getCurrentStep() === TUTORIAL_STEPS.cityEntered) {
        await this.advanceTo(TUTORIAL_STEPS.houseGuideReady);
      }
      if (tabId === 'civilization' && this.getCurrentStep() === TUTORIAL_STEPS.houseBuilt) {
        await this.advanceTo(TUTORIAL_STEPS.civilizationTabOpened);
      }
      return true;
    }

    async onCommandPanelOpened(panelId) {
      const tabId = this.normalizePanelTab(panelId);
      const allowed = await this.onTabClicked(tabId);
      if (allowed === false) return false;
      if (tabId === 'events' && this.getCurrentStep() === TUTORIAL_STEPS.eraAdvancedTo2) {
        await this.advanceTo(TUTORIAL_STEPS.specialEventTabOpened);
      }
      if (tabId === 'buildings' && this.getCurrentStep() === TUTORIAL_STEPS.specialEventClaimed) {
        await this.advanceTo(TUTORIAL_STEPS.buildingsTabOpenedForLumbermill);
      }
      if (allowed !== false) this.refreshCurrentHighlight();
      return allowed;
    }

    async advanceTo(step) {
      const nextStep = Number(step);
      if (!Number.isFinite(nextStep) || nextStep <= this.getCurrentStep()) return this.state;
      const api = this.getApi();
      if (!api?.advanceTutorial) return this.sync({ ...(this.state || {}), currentStep: nextStep });
      const result = await api.advanceTutorial(nextStep);
      this.game?.applyApiState?.(result);
      return this.sync(result?.tutorial || this.game?.tutorial || this.state);
    }

    async markCityEntered() {
      if (this.isCompleted()) return this.state;
      if (this.getCurrentStep() < TUTORIAL_STEPS.cityEntered) {
        await this.advanceTo(TUTORIAL_STEPS.cityEntered);
      }
      if (this.getCurrentStep() < TUTORIAL_STEPS.houseGuideReady) {
        return this.advanceTo(TUTORIAL_STEPS.houseGuideReady);
      }
      return this.state;
    }

    isHouseGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.cityEntered && step < TUTORIAL_STEPS.houseBuilt;
    }

    onBuildingAction(buildingId, action = 'build') {
      if (this.isFarmGuideActive()) return action === 'build' && buildingId === 'farm';
      if (this.isLumbermillGuideActive()) return action === 'build' && buildingId === 'lumbermill';
      if (!this.isHouseGuideActive()) return true;
      return action === 'build' && buildingId === 'house';
    }

    isFirstEraGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.houseBuilt && step < TUTORIAL_STEPS.farmPrepReserved;
    }

    isFarmGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.farmPrepReserved && step < TUTORIAL_STEPS.farmBuilt;
    }

    isEra2GuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.era2AdvanceReady && step <= TUTORIAL_STEPS.lumbermillBuilt;
    }

    isScoutFormationGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.era3AdvanceReady && step < TUTORIAL_STEPS.scoutFormationSaved;
    }

    isScoutExploreGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.scoutFormationSaved && step < TUTORIAL_STEPS.scoutExploreClaimed;
    }

    isLumbermillGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.specialEventClaimed && step < TUTORIAL_STEPS.lumbermillBuilt;
    }

    normalizePanelTab(panelId) {
      if (panelId === 'capital') return 'buildings';
      return panelId || '';
    }

    getActiveCommandPanel() {
      return this.game?.canvasShell?.activeCommandPanel || this.game?.activeCommandPanel || '';
    }

    isCommandPanelOpen(panelId) {
      const active = this.getActiveCommandPanel();
      if (panelId === 'buildings') return active === 'buildings' || active === 'capital';
      return active === panelId;
    }

    isOnTab(tabId) {
      return this.game?.state?.currentTab === tabId || this.game?.activeTab === tabId;
    }

    isTaskCenterOpen() {
      return Boolean(this.game?.showTaskCenter || this.game?.canvasShell?.showTaskCenter);
    }

    isAdvisorOpen() {
      return Boolean(this.game?.canvasShell?.showAdvisor || this.game?.showAdvisor);
    }

    showSoftGuide(target, message) {
      const game = this.game || {};
      game.canvasShell?.hideTutorialHighlight?.();
      game.state = {
        ...(game.state || {}),
        softGuide: {
          mode: 'strong',
          target,
          message,
        },
      };
      game.showAdvisor = true;
      if (game.canvasShell) game.canvasShell.showAdvisor = true;
      game.renderCanvasSurface?.(game.state?.currentTab || game.activeTab);
      return true;
    }

    onEraAdvanced(result = {}) {
      this.sync(result.tutorial || this.game?.tutorial || this.state);
      const step = this.getCurrentStep();
      if (step >= TUTORIAL_STEPS.scoutFamousGranted && step < TUTORIAL_STEPS.scoutFormationSaved) {
        return this.showSoftGuide(
          'famous-persons-button',
          '\u57ce\u90a6\u7684\u9053\u8def\u5df2\u7ecf\u6253\u5f00\uff0c\u4e00\u4f4d\u5584\u4e8e\u4fa6\u5bdf\u7684\u540d\u4eba\u52a0\u5165\u4e86\u6211\u4eec\u3002\u5148\u53bb\u540d\u4eba\u91cc\u770b\u770b\u4ed6\u7684\u5361\u7247\u3002',
        );
      }
      if (step === TUTORIAL_STEPS.eraAdvancedTo2) {
        return this.showSoftGuide(
          'events-button',
          '\u68ee\u6797\u8fb9\u7f18\u4f20\u6765\u4e86\u52a8\u9759\u3002\u5148\u53bb\u4e8b\u4ef6\u91cc\u770b\u4e00\u770b\uff0c\u628a\u6728\u6750\u5e26\u56de\u6765\u3002',
        );
      }
      if (this.getCurrentStep() !== TUTORIAL_STEPS.eraAdvancedTo1) return false;
      return this.showSoftGuide(
        'task-center-button',
        '火种已经越过最初的夜色。去任务里领取这份物资，我们就能准备第一块农田。',
      );
    }

    onTaskRewardClaimed(result = {}) {
      this.sync(result.tutorial || this.game?.tutorial || this.state);
      return this.getCurrentStep() >= TUTORIAL_STEPS.farmPrepReserved;
    }

    getScoutFamousPersonId() {
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
      return this.game?.canvasShell?.armyFormationEditor || this.game?.armyFormationEditor || {};
    }

    isFamousPersonsOpen() {
      return Boolean(this.game?.showFamousPersons || this.game?.canvasShell?.showFamousPersons);
    }

    isFamousPersonDetailOpen() {
      return Boolean(this.game?.selectedFamousPersonId || this.game?.canvasShell?.selectedFamousPersonId);
    }

    getActiveEventId() {
      return this.game?.canvasShell?.activeEventId
        || this.game?.activeEventId
        || this.game?.eventController?.activeEventId
        || '';
    }

    async onFamousPersonsOpened() {
      if (this.getCurrentStep() === TUTORIAL_STEPS.scoutFamousGranted) {
        return this.advanceTo(TUTORIAL_STEPS.famousPanelOpened);
      }
      return this.state;
    }

    async onFamousPersonDetailOpened(personId = '') {
      const scoutPersonId = this.getScoutFamousPersonId();
      if (
        this.getCurrentStep() === TUTORIAL_STEPS.famousPanelOpened
        && (!scoutPersonId || String(personId || '') === scoutPersonId)
      ) {
        return this.advanceTo(TUTORIAL_STEPS.famousCardViewed);
      }
      return this.state;
    }

    async onArmyFormationOpened() {
      if (this.getCurrentStep() === TUTORIAL_STEPS.famousCardViewed) {
        return this.advanceTo(TUTORIAL_STEPS.formationPanelOpened);
      }
      return this.state;
    }

    async onMilitaryViewSwitched(view = '') {
      if (view === 'world' && this.getCurrentStep() === TUTORIAL_STEPS.scoutFormationSaved) {
        return this.advanceTo(TUTORIAL_STEPS.scoutWorldPanelOpened);
      }
      return this.state;
    }

    onExploreStarted(result = {}) {
      this.sync(result.tutorial || this.game?.tutorial || this.state);
      this.refreshCurrentHighlight();
      return this.state;
    }

    onExploreClaimed(result = {}) {
      this.sync(result.tutorial || this.game?.tutorial || this.state);
      this.refreshCurrentHighlight();
      return this.state;
    }

    getCanvasTarget(type, predicate = null) {
      return this.game?.canvasShell?.getCanvasTarget?.(type, predicate) || null;
    }

    showHighlight(type, predicate, message, allowedAction) {
      const target = this.getCanvasTarget(type, predicate);
      if (!target) return false;
      return this.game?.canvasShell?.showTutorialHighlight?.(
        target,
        message,
        { allowedAction, source: 'strongTutorial' },
      ) || false;
    }

    prepareCommandPanelGuide(panelId) {
      const game = this.game || {};
      const shell = game.canvasShell || null;
      let changed = false;
      const closeIfOpen = (host, key, value = false) => {
        if (host && host[key]) {
          host[key] = value;
          changed = true;
        }
      };
      if (game.activeCommandPanel && game.activeCommandPanel !== panelId) {
        game.activeCommandPanel = '';
        changed = true;
      }
      if (shell?.activeCommandPanel && shell.activeCommandPanel !== panelId) {
        shell.activeCommandPanel = '';
        changed = true;
      }
      closeIfOpen(game, 'showCityManagement');
      closeIfOpen(shell, 'showCityManagement');
      closeIfOpen(game, 'showSubcityList');
      closeIfOpen(shell, 'showSubcityList');
      closeIfOpen(game, 'showTaskCenter');
      closeIfOpen(shell, 'showTaskCenter');
      if (game.activeEventId) {
        game.activeEventId = null;
        changed = true;
      }
      if (shell?.activeEventId) {
        shell.activeEventId = null;
        changed = true;
      }
      if (changed) {
        shell?.hideTutorialHighlight?.();
        game.renderCanvasSurface?.(game.state?.currentTab || game.activeTab);
      }
      return changed;
    }

    ensureHouseGuideVisible() {
      if (!this.isHouseGuideActive()) return false;
      const game = this.game || {};
      game.showCityManagement = true;
      game.activeCityManagementTab = 'buildings';
      game.showSubcityList = false;
      game.activeCommandPanel = '';
      game.activeEventId = null;
      if (game.canvasShell) {
        game.canvasShell.showCityManagement = true;
        game.canvasShell.activeCityManagementTab = 'buildings';
        game.canvasShell.showSubcityList = false;
        game.canvasShell.activeCommandPanel = '';
        game.canvasShell.activeEventId = null;
      }
      return true;
    }

    ensureBuildingGuideVisible() {
      const game = this.game || {};
      game.showCityManagement = false;
      game.activeCommandPanel = 'buildings';
      game.activeEventId = null;
      game.showTaskCenter = false;
      if (game.canvasShell) {
        game.canvasShell.showCityManagement = false;
        game.canvasShell.activeCommandPanel = 'buildings';
        game.canvasShell.activeEventId = null;
        game.canvasShell.showTaskCenter = false;
      }
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
      if (game.canvasShell) {
        game.canvasShell.activeBuildingCategory = category;
        game.canvasShell.buildingOffset = 0;
        game.canvasShell.buildingTransition = null;
      }
      return true;
    }

    showBuildingGuide(buildingId, message) {
      this.ensureBuildingGuideVisible();
      this.focusBuildingCard(buildingId);
      return this.showHighlight(
        'buildBuilding',
        (action) => !action.disabled && action.buildingId === buildingId,
        message,
        { type: 'buildBuilding', buildingId },
      );
    }

    refreshCurrentHighlight() {
      if (this.isAdvisorOpen()) {
        this.game?.canvasShell?.hideTutorialHighlight?.();
        return false;
      }
      if (this.isFirstEraGuideActive()) {
        const step = this.getCurrentStep();
        if (step === TUTORIAL_STEPS.houseBuilt && !this.isOnTab('civilization')) {
          this.prepareCommandPanelGuide('civilization');
          return this.showHighlight(
            'openCommandPanel',
            (action) => !action.disabled && action.panel === 'civilization',
            '点击文明，查看族群迈向下一阶段所需的条件。',
            { type: 'openCommandPanel', panel: 'civilization' },
          );
        }
        if (step === TUTORIAL_STEPS.civilizationTabOpened) {
          return this.showHighlight(
            'advanceEra',
            (action) => !action.disabled,
            '条件已经满足，点击进阶，让文明迈入农耕时代。',
            { type: 'advanceEra' },
          );
        }
        if (step === TUTORIAL_STEPS.eraAdvancedTo1 && !this.isTaskCenterOpen()) {
          return this.showHighlight(
            'openTaskCenter',
            (action) => !action.disabled && (action.tab || 'main') === 'main',
            '打开任务，领取第一份主线物资。',
            { type: 'openTaskCenter' },
          );
        }
        if (step === TUTORIAL_STEPS.eraAdvancedTo1 && this.isTaskCenterOpen()) {
          return this.showHighlight(
            'claimTaskReward',
            (action) => !action.disabled && action.taskId === 'main_first_supplies',
            '领取“安居的火种”，准备建造第一块农田。',
            { type: 'claimTaskReward', taskId: 'main_first_supplies', category: 'main' },
          );
        }
      }
      if (this.isFarmGuideActive()) {
        return this.showBuildingGuide(
          'farm',
          '\u5efa\u9020\u7b2c\u4e00\u5757\u519c\u7530\uff0c\u8ba9\u98df\u7269\u4f9b\u5e94\u5148\u7a33\u5b9a\u4e0b\u6765\u3002',
        );
      }
      if (this.isEra2GuideActive()) {
        const step = this.getCurrentStep();
        if (step === TUTORIAL_STEPS.era2AdvanceReady && !this.isCommandPanelOpen('civilization')) {
          this.prepareCommandPanelGuide('civilization');
          return this.showHighlight(
            'openCommandPanel',
            (action) => !action.disabled && action.panel === 'civilization',
            '\u56de\u5230\u6587\u660e\uff0c\u628a\u805a\u843d\u63a8\u5411\u4e0b\u4e00\u4e2a\u65f6\u4ee3\u3002',
            { type: 'openCommandPanel', panel: 'civilization' },
          );
        }
        if (step === TUTORIAL_STEPS.era2AdvanceReady && this.isCommandPanelOpen('civilization')) {
          return this.showHighlight(
            'advanceEra',
            (action) => !action.disabled,
            '\u6761\u4ef6\u5df2\u7ecf\u51c6\u5907\u597d\uff0c\u70b9\u51fb\u8fdb\u9636\u8fdb\u5165\u805a\u843d\u65f6\u4ee3\u3002',
            { type: 'advanceEra' },
          );
        }
        if (step === TUTORIAL_STEPS.eraAdvancedTo2 && !this.isCommandPanelOpen('events')) {
          this.prepareCommandPanelGuide('events');
          return this.showHighlight(
            'openCommandPanel',
            (action) => !action.disabled && action.panel === 'events',
            '\u6253\u5f00\u4e8b\u4ef6\uff0c\u5904\u7406\u68ee\u6797\u91cc\u7684\u6728\u6750\u7ebf\u7d22\u3002',
            { type: 'openCommandPanel', panel: 'events' },
          );
        }
        if (
          (step === TUTORIAL_STEPS.specialEventTabOpened || (step === TUTORIAL_STEPS.eraAdvancedTo2 && this.isCommandPanelOpen('events')))
          && !this.getActiveEventId()
        ) {
          return this.showHighlight(
            'openEvent',
            (action) => !action.disabled && action.eventId === 'evt_settlement_forest_001',
            '\u70b9\u5f00\u68ee\u6797\u4f4e\u8bed\u4e8b\u4ef6\uff0c\u5148\u628a\u53ef\u7528\u7684\u6728\u6750\u6536\u4e0b\u3002',
            { type: 'openEvent', eventId: 'evt_settlement_forest_001' },
          );
        }
        if (
          (step === TUTORIAL_STEPS.specialEventTabOpened || (step === TUTORIAL_STEPS.eraAdvancedTo2 && this.isCommandPanelOpen('events')))
          && this.getActiveEventId() === 'evt_settlement_forest_001'
        ) {
          return this.showHighlight(
            'claimEvent',
            (action) => !action.disabled && action.eventId === 'evt_settlement_forest_001' && action.optionId === 'opt_collect_wood',
            '\u9886\u53d6\u8fd9\u6279\u6728\u6750\uff0c\u6211\u4eec\u9a6c\u4e0a\u5efa\u8d77\u4f10\u6728\u573a\u3002',
            { type: 'claimEvent', eventId: 'evt_settlement_forest_001', optionId: 'opt_collect_wood' },
          );
        }
        if (step === TUTORIAL_STEPS.specialEventClaimed || step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill) {
          return this.showBuildingGuide(
            'lumbermill',
            '\u5efa\u9020\u4f10\u6728\u573a\uff0c\u8ba9\u6728\u6750\u5f00\u59cb\u6301\u7eed\u6d41\u5165\u4ed3\u5e93\u3002',
          );
        }
        if (step === TUTORIAL_STEPS.lumbermillBuilt && !this.isTaskCenterOpen()) {
          return this.showHighlight(
            'openTaskCenter',
            (action) => !action.disabled && (action.tab || 'main') === 'main',
            '\u6253\u5f00\u4efb\u52a1\uff0c\u9886\u53d6\u4f10\u6728\u573a\u5b8c\u6210\u540e\u7684\u4e3b\u7ebf\u5956\u52b1\u3002',
            { type: 'openTaskCenter' },
          );
        }
        if (step === TUTORIAL_STEPS.lumbermillBuilt && this.isTaskCenterOpen()) {
          return this.showHighlight(
            'claimTaskReward',
            (action) => !action.disabled && action.taskId === 'main_lumbermill_supplies',
            '\u9886\u53d6\u201c\u8ba9\u6728\u6750\u6d41\u5165\u4ed3\u623f\u201d\uff0c\u4e0b\u4e00\u6b21\u8fdb\u9636\u7684\u7269\u8d44\u5c31\u5230\u4f4d\u4e86\u3002',
            { type: 'claimTaskReward', taskId: 'main_lumbermill_supplies', category: 'main' },
          );
        }
      }
      if (this.isScoutFormationGuideActive()) {
        const step = this.getCurrentStep();
        const scoutPersonId = this.getScoutFamousPersonId();
        if (step === TUTORIAL_STEPS.era3AdvanceReady && !this.isCommandPanelOpen('civilization')) {
          this.prepareCommandPanelGuide('civilization');
          return this.showHighlight(
            'openCommandPanel',
            (action) => !action.disabled && action.panel === 'civilization',
            '\u6253\u5f00\u6587\u660e\uff0c\u7528\u4f10\u6728\u573a\u7684\u7269\u8d44\u63a8\u8fdb\u5230\u57ce\u90a6\u65f6\u4ee3\u3002',
            { type: 'openCommandPanel', panel: 'civilization' },
          );
        }
        if (step === TUTORIAL_STEPS.era3AdvanceReady && this.isCommandPanelOpen('civilization')) {
          return this.showHighlight(
            'advanceEra',
            (action) => !action.disabled,
            '\u8fdb\u9636\u5230\u57ce\u90a6\u65f6\u4ee3\uff0c\u4fa6\u5bdf\u4e0e\u540d\u4eba\u7f16\u961f\u5c31\u4f1a\u6b63\u5f0f\u5f00\u653e\u3002',
            { type: 'advanceEra' },
          );
        }
        if (step === TUTORIAL_STEPS.scoutFamousGranted && !this.isFamousPersonsOpen()) {
          return this.showHighlight(
            'openFamousPersons',
            (action) => !action.disabled,
            '\u6253\u5f00\u540d\u4eba\uff0c\u67e5\u770b\u521a\u52a0\u5165\u7684\u4fa6\u5bdf\u578b\u82f1\u6770\u3002',
            { type: 'openFamousPersons' },
          );
        }
        if (step === TUTORIAL_STEPS.famousPanelOpened && this.isFamousPersonsOpen()) {
          return this.showHighlight(
            'openFamousPersonDetail',
            (action) => !action.disabled && (!scoutPersonId || action.personId === scoutPersonId),
            '\u70b9\u5f00\u8fd9\u5f20\u4fa6\u5bdf\u578b\u540d\u4eba\u5361\uff0c\u8bb0\u4f4f\u4ed6\u4f1a\u5e26\u961f\u51fa\u57ce\u63a2\u8def\u3002',
            { type: 'openFamousPersonDetail', personId: scoutPersonId },
          );
        }
        if (step === TUTORIAL_STEPS.famousCardViewed && this.isFamousPersonsOpen() && this.isFamousPersonDetailOpen()) {
          return this.showHighlight(
            'closeFamousPersonDetail',
            (action) => !action.disabled,
            '\u5361\u7247\u5df2\u7ecf\u770b\u8fc7\uff0c\u5148\u8fd4\u56de\u540d\u4eba\u5217\u8868\u3002',
            { type: 'closeFamousPersonDetail' },
          );
        }
        if (step === TUTORIAL_STEPS.famousCardViewed && this.isFamousPersonsOpen()) {
          return this.showHighlight(
            'closeFamousPersons',
            (action) => !action.disabled,
            '\u5173\u95ed\u540d\u4eba\u9762\u677f\uff0c\u63a5\u4e0b\u6765\u53bb\u519b\u4e8b\u91cc\u914d\u7f6e\u7f16\u961f\u3002',
            { type: 'closeFamousPersons' },
          );
        }
        if (step === TUTORIAL_STEPS.famousCardViewed && !this.isCommandPanelOpen('military')) {
          this.prepareCommandPanelGuide('military');
          return this.showHighlight(
            'openCommandPanel',
            (action) => !action.disabled && action.panel === 'military',
            '\u6253\u5f00\u519b\u4e8b\uff0c\u6211\u4eec\u8981\u628a\u8fd9\u4f4d\u540d\u4eba\u653e\u8fdb\u4fa6\u5bdf\u7f16\u961f\u3002',
            { type: 'openCommandPanel', panel: 'military' },
          );
        }
        if (step === TUTORIAL_STEPS.famousCardViewed && this.isCommandPanelOpen('military') && !this.getArmyFormationEditor().open) {
          return this.showHighlight(
            'openArmyFormation',
            (action) => !action.disabled && Number(action.slot || 1) === 1,
            '\u70b9\u51fb\u7b2c\u4e00\u5f20\u7f16\u961f\u5361\u7247\uff0c\u628a\u4fa6\u5bdf\u540d\u4eba\u653e\u8fdb\u961f\u4f0d\u3002',
            { type: 'openArmyFormation', cityId: this.game?.state?.activeCityId || 'capital', slot: 1 },
          );
        }
        const editor = this.getArmyFormationEditor();
        if (step === TUTORIAL_STEPS.formationPanelOpened && editor.open) {
          const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds.map(String) : [];
          if (scoutPersonId && !memberIds.includes(scoutPersonId)) {
            return this.showHighlight(
              'toggleArmyFormationMember',
              (action) => !action.disabled && action.personId === scoutPersonId,
              '\u9009\u4e2d\u8fd9\u4f4d\u4fa6\u5bdf\u540d\u4eba\uff0c\u4ed6\u5c06\u6210\u4e3a\u9996\u652f\u4fa6\u5bdf\u961f\u7684\u4e3b\u5c06\u3002',
              { type: 'toggleArmyFormationMember', personId: scoutPersonId },
            );
          }
          return this.showHighlight(
            'saveArmyFormation',
            (action) => !action.disabled,
            '\u4fdd\u5b58\u7f16\u961f\uff0c\u63a5\u4e0b\u6765\u5c31\u53ef\u4ee5\u51fa\u57ce\u4fa6\u5bdf\u571f\u5730\u4e86\u3002',
            { type: 'saveArmyFormation' },
          );
        }
      }
      if (this.isScoutExploreGuideActive()) {
        const step = this.getCurrentStep();
        const explorer = this.game?.state?.worldExplorerState || {};
        const activeMission = explorer.activeMission || null;
        const readyMission = Array.isArray(explorer.readyMissions) ? explorer.readyMissions[0] : null;
        if (step === TUTORIAL_STEPS.scoutFormationSaved && !this.isCommandPanelOpen('military')) {
          this.prepareCommandPanelGuide('military');
          return this.showHighlight(
            'openCommandPanel',
            (action) => !action.disabled && action.panel === 'military',
            '\u7f16\u961f\u5df2\u7ecf\u5c31\u7eea\uff0c\u6253\u5f00\u519b\u4e8b\uff0c\u51c6\u5907\u8ba9\u4fa6\u5bdf\u961f\u51fa\u57ce\u3002',
            { type: 'openCommandPanel', panel: 'military' },
          );
        }
        if (step === TUTORIAL_STEPS.scoutFormationSaved && this.isCommandPanelOpen('military')) {
          return this.showHighlight(
            'switchMilitaryView',
            (action) => !action.disabled && action.view === 'world',
            '\u5207\u5230\u4e16\u754c\u5730\u56fe\uff0c\u770b\u770b\u4fa6\u5bdf\u961f\u8981\u63a2\u7684\u8def\u3002',
            { type: 'switchMilitaryView', view: 'world' },
          );
        }
        if (step === TUTORIAL_STEPS.scoutWorldPanelOpened) {
          return this.showHighlight(
            'startExplore',
            (action) => !action.disabled,
            '\u70b9\u51fb\u63a2\u7d22\uff0c\u540e\u7aef\u4f1a\u5148\u786e\u5b9a\u8def\u7ebf\u548c\u5c06\u8981\u63ed\u5f00\u7684\u5730\u5757\u3002',
            { type: 'startExplore' },
          );
        }
        if (step === TUTORIAL_STEPS.scoutExploreStarted && readyMission) {
          return this.showHighlight(
            'claimExplore',
            (action) => !action.disabled && (!readyMission.id || action.missionId === readyMission.id),
            '\u4fa6\u5bdf\u961f\u5df2\u8fd4\u56de\uff0c\u70b9\u51fb\u5f52\u961f\uff0c\u67e5\u770b\u65b0\u53d1\u73b0\u7684\u7a7a\u57ce\u3002',
            { type: 'claimExplore', missionId: readyMission.id },
          );
        }
        if (step === TUTORIAL_STEPS.scoutExploreStarted && activeMission) {
          this.game?.canvasShell?.hideTutorialHighlight?.();
          return false;
        }
      }
      if (!this.isHouseGuideActive()) return false;
      this.ensureHouseGuideVisible();
      const shell = this.game?.canvasShell;
      const target = shell?.getCanvasTarget?.('buildBuilding', (action) => action.buildingId === 'house');
      if (!target) return false;
      return shell.showTutorialHighlight?.(
        target,
        '建造第一处民居，让族人有稳定的居所。',
        { allowedAction: { type: 'buildBuilding', buildingId: 'house' }, source: 'strongTutorial' },
      ) || false;
    }
  }

  TutorialGuideController.TUTORIAL_STEPS = TUTORIAL_STEPS;
  global.TutorialGuideController = TutorialGuideController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideController;
})(typeof window !== 'undefined' ? window : globalThis);
