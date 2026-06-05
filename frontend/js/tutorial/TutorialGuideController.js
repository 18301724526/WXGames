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
      if (step <= TUTORIAL_STEPS.farmBuilt) return ['buildings', 'civilization'].includes(tabId);
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
