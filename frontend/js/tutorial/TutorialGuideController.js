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
    completed: 16,
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
      if (panelId !== 'civilization') return true;
      const allowed = await this.onTabClicked('civilization');
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
      if (!this.isHouseGuideActive()) return true;
      return action === 'build' && buildingId === 'house';
    }

    isFirstEraGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.houseBuilt && step < TUTORIAL_STEPS.farmPrepReserved;
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

    refreshCurrentHighlight() {
      if (this.isAdvisorOpen()) {
        this.game?.canvasShell?.hideTutorialHighlight?.();
        return false;
      }
      if (this.isFirstEraGuideActive()) {
        const step = this.getCurrentStep();
        if (step === TUTORIAL_STEPS.houseBuilt && !this.isOnTab('civilization')) {
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
