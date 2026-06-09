(function (global) {
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

  const SharedTutorialGuidePhaseHighlights = (() => {
    if (global.TutorialGuidePhaseHighlights) return global.TutorialGuidePhaseHighlights;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./TutorialGuidePhaseHighlights');
    }
    return null;
  })();

  const SharedTutorialGuideUiStateCoordinator = (() => {
    if (global.TutorialGuideUiStateCoordinator) return global.TutorialGuideUiStateCoordinator;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./TutorialGuideUiStateCoordinator');
    }
    return null;
  })();

  const TUTORIAL_STEPS = TutorialGuideStepPolicy.TUTORIAL_STEPS;

  class TutorialGuideController {
    constructor(options = {}) {
      this.game = options.game || null;
      this.api = options.api || null;
      this.state = options.state || null;
      this.focusedFirstCitySiteId = '';
      this.pendingAdvanceByStep = new Map();
      this.targetResolver = options.targetResolver
        || (SharedTutorialGuideTargetResolver ? new SharedTutorialGuideTargetResolver({ host: this }) : null);
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

    getStepPolicyContext() {
      return {
        step: this.getCurrentStep(),
        completed: this.isCompleted(),
      };
    }

    canOpenTab(tabId) {
      return TutorialGuideStepPolicy.canOpenTab(tabId, this.getStepPolicyContext());
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
      if (tabId === 'tech' && this.getCurrentStep() === TUTORIAL_STEPS.famousSeekCompleted) {
        await this.advanceTo(TUTORIAL_STEPS.finalTechOpened);
      }
      if (allowed !== false) this.refreshCurrentHighlight();
      return allowed;
    }

    async advanceTo(step) {
      const nextStep = Number(step);
      if (!Number.isFinite(nextStep) || nextStep <= this.getCurrentStep()) return this.state;
      if (this.pendingAdvanceByStep.has(nextStep)) return this.pendingAdvanceByStep.get(nextStep);
      const api = this.getApi();
      if (!api?.advanceTutorial) return this.sync({ ...(this.state || {}), currentStep: nextStep });
      const pending = (async () => {
        const result = await api.advanceTutorial(nextStep);
        this.game?.applyApiState?.(result);
        return this.sync(result?.tutorial || this.game?.tutorial || this.state);
      })()
        .finally(() => {
          this.pendingAdvanceByStep.delete(nextStep);
        });
      this.pendingAdvanceByStep.set(nextStep, pending);
      return pending;
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
      const { step, completed } = this.getStepPolicyContext();
      return TutorialGuideStepPolicy.isHouseGuideActive(step, completed);
    }

    onBuildingAction(buildingId, action = 'build') {
      if (this.isFarmGuideActive()) return action === 'build' && buildingId === 'farm';
      if (this.isLumbermillGuideActive()) return action === 'build' && buildingId === 'lumbermill';
      if (!this.isHouseGuideActive()) return true;
      return action === 'build' && buildingId === 'house';
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

    isCityManagementOpen() {
      return Boolean(this.game?.showCityManagement || this.game?.canvasShell?.showCityManagement);
    }

    isCityManagementTabOpen(tab = '') {
      const activeTab = this.game?.canvasShell?.activeCityManagementTab
        || this.game?.activeCityManagementTab
        || '';
      return activeTab === tab;
    }

    isAdvisorOpen() {
      return Boolean(
        this.game?.canvasShell?.showAdvisor
        || this.game?.showAdvisor
        || this.game?.canvasShell?.tutorialAdvisorDialogue
        || this.game?.tutorialAdvisorDialogue,
      );
    }

    isRewardRevealOpen() {
      return Boolean(this.game?.canvasShell?.rewardReveal || this.game?.rewardReveal);
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





    getWorldMarchTarget() {
      return this.game?.territoryController?.uiState?.worldMarchTarget
        || this.game?.canvasShell?.territoryUiState?.worldMarchTarget
        || this.game?.territoryUiState?.worldMarchTarget
        || null;
    }

    isWorldMarchTargetSelected() {
      const target = this.getWorldMarchTarget();
      return Boolean(target && Number.isFinite(Number(target.q)) && Number.isFinite(Number(target.r)));
    }

    isWorldMarchFormationPickerOpen() {
      return Boolean(this.getWorldMarchTarget()?.pickerOpen);
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

    getFirstExploreCityId() {
      return this.state?.grants?.firstExploreEmptyCity?.siteId
        || this.game?.tutorial?.grants?.firstExploreEmptyCity?.siteId
        || this.game?.state?.tutorial?.grants?.firstExploreEmptyCity?.siteId
        || '';
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
      const selected = this.game?.territoryController?.uiState?.selectedSiteId
        || this.game?.canvasShell?.territoryUiState?.selectedSiteId
        || this.game?.territoryUiState?.selectedSiteId
        || '';
      return Boolean(siteId && selected === siteId);
    }

    isNamingOpen(type = '', territoryId = '') {
      const prompt = this.game?.activeNamingPrompt
        || this.game?.naming?.prompt
        || this.game?.canvasShell?.naming?.prompt
        || this.game?.state?.territoryState?.namingPrompt
        || null;
      if (!prompt) return false;
      if (type && prompt.type !== type) return false;
      if (territoryId && prompt.territoryId !== territoryId) return false;
      return true;
    }

    getNamingInputValue() {
      return String(
        this.game?.naming?.inputValue
          || this.game?.canvasShell?.naming?.inputValue
          || '',
      ).trim();
    }

    async onFamousPersonsOpened() {
      if (this.getCurrentStep() === TUTORIAL_STEPS.scoutFamousGranted) {
        return this.advanceTo(TUTORIAL_STEPS.famousPanelOpened);
      }
      if (this.getCurrentStep() === TUTORIAL_STEPS.manualTalentAssigned) {
        return this.advanceTo(TUTORIAL_STEPS.famousSeekOpened);
      }
      return this.state;
    }

    async onTalentPolicyOpened() {
      const step = this.getCurrentStep();
      if (step === TUTORIAL_STEPS.polityNamed) {
        await this.advanceTo(TUTORIAL_STEPS.talentPolicyOpened);
      }
      if (this.getCurrentStep() === TUTORIAL_STEPS.talentPolicyOpened) {
        return this.advanceTo(TUTORIAL_STEPS.talentPolicyApplied);
      }
      return this.state;
    }

    onTalentPolicyApplied(result = {}) {
      this.sync(result.tutorial || this.game?.tutorial || this.state);
      this.refreshCurrentHighlight();
      return this.state;
    }

    onManualTalentAssigned(result = {}) {
      this.sync(result.tutorial || this.game?.tutorial || this.state);
      this.refreshCurrentHighlight();
      return this.state;
    }

    onFamousPersonSought(result = {}) {
      this.sync(result.tutorial || this.game?.tutorial || this.state);
      this.refreshCurrentHighlight();
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

    onArmyFormationSaved(result = {}) {
      this.sync(result.tutorial || this.game?.tutorial || this.state);
      const step = this.getCurrentStep();
      if (step === TUTORIAL_STEPS.scoutFormationSaved || step === TUTORIAL_STEPS.scoutWorldPanelOpened) {
        this.closeArmyFormationEditorEverywhere();
        this.ensureMapHomeGuideVisible({ clearWorldMarchTarget: true });
        this.refreshCurrentHighlight();
        return true;
      }
      this.closeArmyFormationEditorEverywhere();
      this.refreshCurrentHighlight();
      return false;
    }

    async onMilitaryViewSwitched(view = '') {
      if (view === 'world' && this.getCurrentStep() === TUTORIAL_STEPS.scoutFormationSaved) {
        return this.advanceTo(TUTORIAL_STEPS.scoutWorldPanelOpened);
      }
      return this.state;
    }

    onFamousPersonsClosed() {
      const game = this.game || {};
      const shell = game.canvasShell || null;
      game.showFamousPersons = false;
      game.famousPersonsPage = 0;
      game.selectedFamousPersonId = '';
      if (shell) {
        shell.showFamousPersons = false;
        shell.famousPersonsPage = 0;
        shell.selectedFamousPersonId = '';
      }
      this.refreshCurrentHighlight();
      return this.state;
    }

    onCityManagementOpened(tab = '') {
      if (tab === 'people') {
        return this.onTalentPolicyOpened();
      }
      if (this.getCurrentStep() === TUTORIAL_STEPS.famousCardViewed && tab === 'military') {
        this.refreshCurrentHighlight();
        return this.state;
      }
      this.refreshCurrentHighlight();
      return this.state;
    }

    async onWorldMarchTargetSelected() {
      if (this.getCurrentStep() === TUTORIAL_STEPS.scoutFormationSaved) {
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

    async onAdvisorClosed() {
      const game = this.game || {};
      game.showAdvisor = false;
      game.tutorialAdvisorDialogue = null;
      if (game.canvasShell) {
        game.canvasShell.showAdvisor = false;
        game.canvasShell.tutorialAdvisorDialogue = null;
      }
      if (this.getCurrentStep() !== TUTORIAL_STEPS.finalTechOpened) {
        this.refreshCurrentHighlight();
        return this.state;
      }
      game.canvasShell?.hideTutorialHighlight?.();
      game.state = {
        ...(game.state || {}),
        softGuide: null,
      };
      const result = await this.advanceTo(TUTORIAL_STEPS.completed);
      this.refreshCurrentHighlight();
      return result;
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
        message: '\u70b9\u5f00\u4fa6\u5bdf\u961f\u53d1\u73b0\u7684\u7a7a\u57ce\uff0c\u51c6\u5907\u5efa\u7acb\u7b2c\u4e8c\u5904\u636e\u70b9\u3002',
      }) || false;
    }

    showCapitalSiteOpenHighlight(siteId = this.getCapitalCityId()) {
      return this.targetResolver?.showOpenWorldSiteHighlight({
        siteId,
        message: '\u70b9\u5f00\u4e3b\u57ce\uff0c\u53bb\u57ce\u5185\u519b\u4e8b\u9875\u914d\u7f6e\u7b2c\u4e00\u652f\u4fa6\u5bdf\u7f16\u961f\u3002',
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
      const mergeUiState = (host, key, patch = {}) => {
        if (!host || typeof host !== 'object') return;
        const current = host[key] || {};
        const next = { ...current, ...patch };
        const changedEntry = Object.entries(patch).some(([field, value]) => current[field] !== value);
        if (!changedEntry) return;
        host[key] = next;
        changed = true;
      };
      if (game.state) {
        setIfChanged(game.state, 'currentTab', 'military');
        setIfChanged(game.state, 'militaryView', 'world');
      }
      setIfChanged(game, 'activeTab', 'military');
      setIfChanged(game, 'militaryView', 'world');
      setIfChanged(game, 'mapHomeActive', true);
      setIfChanged(game, 'activeCommandPanel', '');
      setIfChanged(game, 'showCityManagement', false);
      setIfChanged(game, 'showSubcityList', false);
      setIfChanged(game, 'showTaskCenter', false);
      setIfChanged(game, 'showFamousPersons', false);
      setIfChanged(game, 'activeEventId', null);
      this.closeArmyFormationEditorEverywhere();
      mergeUiState(game, 'territoryUiState', {
        selectedSiteId: '',
        ...(clearWorldMarchTarget ? {
          worldMarchTarget: null,
          selectedWorldActorId: '',
        } : {}),
        expeditionConfigSiteId: '',
        expeditionSoldiers: '',
        expeditionTroopType: '',
        expeditionLeader: '',
      });
      if (game.territoryController?.uiState) {
        mergeUiState(game.territoryController, 'uiState', {
          selectedSiteId: '',
          ...(clearWorldMarchTarget ? {
            worldMarchTarget: null,
            selectedWorldActorId: '',
          } : {}),
          expeditionConfigSiteId: '',
          expeditionSoldiers: '',
          expeditionTroopType: '',
          expeditionLeader: '',
        });
      }
      if (clearWorldMarchTarget) game.territoryController?.closeSiteDialog?.({ render: false });
      if (shell) {
        setIfChanged(shell, 'mapHomeActive', true);
        setIfChanged(shell, 'activeCommandPanel', '');
        setIfChanged(shell, 'showCityManagement', false);
        setIfChanged(shell, 'showSubcityList', false);
        setIfChanged(shell, 'showTaskCenter', false);
        setIfChanged(shell, 'showFamousPersons', false);
        setIfChanged(shell, 'activeEventId', null);
        mergeUiState(shell, 'territoryUiState', {
          selectedSiteId: '',
          ...(clearWorldMarchTarget ? {
            worldMarchTarget: null,
            selectedWorldActorId: '',
          } : {}),
          expeditionConfigSiteId: '',
          expeditionSoldiers: '',
          expeditionTroopType: '',
          expeditionLeader: '',
        });
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
      const target = this.getCanvasTarget('assignJob', (action) => !action.disabled && Number(action.delta) > 0);
      if (target) return { target, action: target.action || { type: 'assignJob' } };
      const fallback = this.getCanvasTarget('assignJob', (action) => !action.disabled && Number(action.delta) !== 0);
      return fallback ? { target: fallback, action: fallback.action || { type: 'assignJob' } } : null;
    }




  }

  TutorialGuideController.TUTORIAL_STEPS = TUTORIAL_STEPS;
  TutorialGuideController.TutorialGuideStepPolicy = TutorialGuideStepPolicy;
  TutorialGuideController.TutorialGuideTargetResolver = SharedTutorialGuideTargetResolver;
  TutorialGuideController.TutorialGuidePhaseHighlights = SharedTutorialGuidePhaseHighlights;
  TutorialGuideController.TutorialGuideUiStateCoordinator = SharedTutorialGuideUiStateCoordinator;
  SharedTutorialGuideUiStateCoordinator?.install?.(TutorialGuideController);
  SharedTutorialGuidePhaseHighlights?.install?.(TutorialGuideController);
  global.TutorialGuideController = TutorialGuideController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideController;
})(typeof window !== 'undefined' ? window : globalThis);
