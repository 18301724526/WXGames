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
    firstCityConquestStarted: 26,
    firstCityOccupied: 27,
    firstCityNamed: 28,
    polityNamed: 29,
    talentPolicyOpened: 30,
    talentPolicyApplied: 31,
    manualTalentAssigned: 32,
    famousSeekOpened: 33,
    famousSeekCompleted: 34,
    finalTechOpened: 35,
    completed: 36,
  });

  class TutorialGuideController {
    constructor(options = {}) {
      this.game = options.game || null;
      this.api = options.api || null;
      this.state = options.state || null;
      this.focusedFirstCitySiteId = '';
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
        return ['civilization', 'resources', 'military'].includes(tabId);
      }
      if (step >= TUTORIAL_STEPS.scoutExploreClaimed && step < TUTORIAL_STEPS.polityNamed) {
        return ['resources', 'military'].includes(tabId);
      }
      if (step >= TUTORIAL_STEPS.polityNamed && step <= TUTORIAL_STEPS.talentPolicyApplied) {
        return tabId === 'resources';
      }
      if (step >= TUTORIAL_STEPS.manualTalentAssigned && step < TUTORIAL_STEPS.famousSeekCompleted) {
        return ['resources', 'famousPersons'].includes(tabId);
      }
      if (step >= TUTORIAL_STEPS.famousSeekCompleted && step < TUTORIAL_STEPS.completed) {
        return tabId === 'tech';
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
      if (tabId === 'tech' && this.getCurrentStep() === TUTORIAL_STEPS.famousSeekCompleted) {
        await this.advanceTo(TUTORIAL_STEPS.finalTechOpened);
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

    isFirstCityGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.scoutExploreClaimed && step < TUTORIAL_STEPS.polityNamed;
    }

    isFinalTechGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.famousSeekCompleted && step < TUTORIAL_STEPS.completed;
    }

    isPostNamingSystemGuideActive() {
      const step = this.getCurrentStep();
      return !this.isCompleted() && step >= TUTORIAL_STEPS.polityNamed && step < TUTORIAL_STEPS.famousSeekCompleted;
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

    clearBlockingCommandPanels() {
      const game = this.game || {};
      let changed = false;
      if (game.activeCommandPanel) {
        game.activeCommandPanel = '';
        changed = true;
      }
      if (game.canvasShell?.activeCommandPanel) {
        game.canvasShell.activeCommandPanel = '';
        changed = true;
      }
      return changed;
    }

    showSoftGuide(target, message) {
      const game = this.game || {};
      game.canvasShell?.hideTutorialHighlight?.();
      const dialogue = { message, advisorName: '谋士', source: `softGuide:${target || 'tutorial'}` };
      game.state = {
        ...(game.state || {}),
        softGuide: {
          mode: 'strong',
          target,
          message,
        },
      };
      game.showAdvisor = false;
      game.tutorialAdvisorDialogue = dialogue;
      if (game.canvasShell) {
        game.canvasShell.showAdvisor = false;
        game.canvasShell.tutorialAdvisorDialogue = dialogue;
      }
      if (target !== 'tech-tree') this.clearBlockingCommandPanels();
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

    getClosedArmyFormationEditor() {
      return { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
    }

    closeArmyFormationEditorEverywhere() {
      const game = this.game || {};
      const closed = this.getClosedArmyFormationEditor();
      game.armyFormationEditor = { ...closed };
      if (game.canvasShell && typeof game.canvasShell === 'object') {
        game.canvasShell.armyFormationEditor = { ...closed };
      }
      return closed;
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
      if (this.getCurrentStep() === TUTORIAL_STEPS.polityNamed) {
        return this.advanceTo(TUTORIAL_STEPS.talentPolicyOpened);
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
      return this.game?.canvasShell?.getCanvasTarget?.(type, predicate) || null;
    }

    showHighlight(type, predicate, message, allowedAction, options = {}) {
      let target = this.getCanvasTarget(type, predicate);
      if (!target && !this.retryingHighlightAfterRender) {
        this.retryingHighlightAfterRender = true;
        this.game?.renderCanvasSurface?.(this.game?.state?.currentTab || this.game?.activeTab || 'resources');
        target = this.getCanvasTarget(type, predicate);
        this.retryingHighlightAfterRender = false;
      }
      if (!target) {
        this.game?.canvasShell?.hideTutorialHighlight?.();
        return false;
      }
      return this.game?.canvasShell?.showTutorialHighlight?.(
        target,
        message,
        { ...options, allowedAction, source: options.source || 'strongTutorial' },
      ) || false;
    }

    getCanvasTargetRect(target = {}) {
      const rect = typeof target.getRect === 'function'
        ? target.getRect()
        : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
      const left = Number(rect?.left ?? rect?.x);
      const top = Number(rect?.top ?? rect?.y);
      const width = Number(rect?.width);
      const height = Number(rect?.height);
      if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        left,
        top,
        width,
        height,
        right: Number(rect?.right) || left + width,
        bottom: Number(rect?.bottom) || top + height,
      };
    }

    isCanvasTargetVisible(target = {}, padding = 8) {
      const rect = this.getCanvasTargetRect(target);
      if (!rect) return false;
      const shell = this.game?.canvasShell || {};
      const width = Number(shell.runtime?.width || shell.renderer?.width || shell.width || 0);
      const height = Number(shell.runtime?.height || shell.renderer?.height || shell.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return true;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return centerX >= padding
        && centerX <= width - padding
        && centerY >= padding
        && centerY <= height - padding;
    }

    showFirstCitySiteOpenHighlight(siteId = '') {
      const target = this.getCanvasTarget(
        'openWorldSite',
        (action) => !action.disabled && (!siteId || action.siteId === siteId || action.territoryId === siteId),
      );
      if (!target) return false;
      if (!this.isCanvasTargetVisible(target)) return false;
      return this.game?.canvasShell?.showTutorialHighlight?.(
        target,
        '\u70b9\u5f00\u4fa6\u5bdf\u961f\u53d1\u73b0\u7684\u7a7a\u57ce\uff0c\u51c6\u5907\u5efa\u7acb\u7b2c\u4e8c\u5904\u636e\u70b9\u3002',
        { allowedAction: { type: 'openWorldSite', siteId }, source: 'strongTutorial' },
      ) || false;
    }

    showCapitalSiteOpenHighlight(siteId = this.getCapitalCityId()) {
      const target = this.getCanvasTarget(
        'openWorldSite',
        (action) => !action.disabled && (!siteId || action.siteId === siteId || action.territoryId === siteId),
      );
      if (!target) return false;
      if (!this.isCanvasTargetVisible(target)) return false;
      return this.game?.canvasShell?.showTutorialHighlight?.(
        target,
        '\u70b9\u5f00\u4e3b\u57ce\uff0c\u53bb\u57ce\u5185\u519b\u4e8b\u9875\u914d\u7f6e\u7b2c\u4e00\u652f\u4fa6\u5bdf\u7f16\u961f\u3002',
        { allowedAction: { type: 'openWorldSite', siteId }, source: 'strongTutorial' },
      ) || false;
    }

    showCapitalEnterHighlight(siteId = this.getCapitalCityId()) {
      return this.showHighlight(
        'enterCity',
        (action) => !action.disabled && (!siteId || action.cityId === siteId || action.territoryId === siteId || action.siteId === siteId),
        '\u8fdb\u5165\u4e3b\u57ce\uff0c\u5728\u57ce\u5185\u519b\u4e8b\u9875\u914d\u7f6e\u4fa6\u5bdf\u7f16\u961f\u3002',
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
      this.game?.renderCanvasSurface?.(this.game?.state?.currentTab || this.game?.activeTab);
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
      closeIfOpen(game, 'showFamousPersons');
      closeIfOpen(shell, 'showFamousPersons');
      closeIfOpen(game, 'showTalentPolicy');
      closeIfOpen(shell, 'showTalentPolicy');
      if (game.selectedFamousPersonId) {
        game.selectedFamousPersonId = '';
        changed = true;
      }
      if (shell?.selectedFamousPersonId) {
        shell.selectedFamousPersonId = '';
        changed = true;
      }
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

    ensureResourcesGuideVisible() {
      const game = this.game || {};
      const shell = game.canvasShell || null;
      let changed = false;
      const setIfChanged = (host, key, value) => {
        if (!host || host[key] === value) return;
        host[key] = value;
        changed = true;
      };
      const updateState = (host, patch = {}) => {
        if (!host || typeof host !== 'object') return;
        Object.entries(patch).forEach(([key, value]) => setIfChanged(host, key, value));
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
        setIfChanged(game.state, 'currentTab', 'resources');
        setIfChanged(game.state, 'militaryView', 'army');
      }
      updateState(game, {
        activeTab: 'resources',
        militaryView: 'army',
        mapHomeActive: false,
        showCityManagement: false,
        showTaskCenter: false,
        showFamousPersons: false,
        activeCommandPanel: '',
        activeEventId: null,
        showTalentPolicy: false,
      });
      mergeUiState(game, 'territoryUiState', {
        selectedSiteId: '',
        expeditionConfigSiteId: '',
        expeditionSoldiers: '',
        expeditionTroopType: '',
        expeditionLeader: '',
      });
      game.territoryController?.closeSiteDialog?.({ render: false });
      if (shell) {
        updateState(shell, {
          mapHomeActive: false,
          showCityManagement: false,
          showTaskCenter: false,
          showFamousPersons: false,
          showTalentPolicy: false,
          activeCommandPanel: '',
          activeEventId: null,
        });
        mergeUiState(shell, 'territoryUiState', {
          selectedSiteId: '',
          expeditionConfigSiteId: '',
          expeditionSoldiers: '',
          expeditionTroopType: '',
          expeditionLeader: '',
        });
        shell.closeWorldSiteHud?.({ render: false });
      }
      if (!this.renderingResourcesGuide) {
        this.renderingResourcesGuide = true;
        try {
          if (typeof game.resolveMapHomeViewState === 'function' && game.state) {
            const homeView = game.resolveMapHomeViewState(game.state, {
              requestedTab: 'resources',
              militaryView: 'army',
              allowDefaultMapHome: false,
              forceMapHome: false,
            });
            setIfChanged(game, 'mapHomeActive', false);
            setIfChanged(game, 'activeTab', homeView.activeTab);
            setIfChanged(game, 'militaryView', homeView.militaryView);
            setIfChanged(game.state, 'currentTab', homeView.activeTab);
            setIfChanged(game.state, 'militaryView', homeView.militaryView);
          }
          if (shell && typeof shell.renderReadOnly === 'function') {
            shell.mapHomeActive = false;
            shell.renderReadOnly(game.state, 'resources', {
              forceMapHome: false,
              allowDefaultMapHome: false,
            });
          } else {
            game.renderCanvasSurface?.('resources');
          }
          if (!game.renderCanvasSurface && shell?.renderReadOnly) {
            shell.renderReadOnly(game.state, 'resources', {
              forceMapHome: false,
              allowDefaultMapHome: false,
            });
          }
        } finally {
          this.renderingResourcesGuide = false;
        }
      }
      return true;
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
      setIfChanged(game, 'showTalentPolicy', false);
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
        setIfChanged(shell, 'showTalentPolicy', false);
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

    getResourcesGuideHighlightOptions() {
      return {
        renderActiveTab: 'resources',
        renderOptions: {
          forceMapHome: false,
          allowDefaultMapHome: false,
        },
      };
    }

    isTalentPolicyOpen() {
      return Boolean(this.game?.showTalentPolicy || this.game?.canvasShell?.showTalentPolicy);
    }

    pickManualAssignAction() {
      const target = this.getCanvasTarget('assignJob', (action) => !action.disabled && Number(action.delta) > 0);
      if (target) return { target, action: target.action || { type: 'assignJob' } };
      const fallback = this.getCanvasTarget('assignJob', (action) => !action.disabled && Number(action.delta) !== 0);
      return fallback ? { target: fallback, action: fallback.action || { type: 'assignJob' } } : null;
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
      if (this.isRewardRevealOpen()) {
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
            '\u5173\u95ed\u540d\u4eba\u9762\u677f\uff0c\u63a5\u4e0b\u6765\u56de\u4e3b\u57ce\u914d\u7f6e\u7b2c\u4e00\u652f\u4fa6\u5bdf\u7f16\u961f\u3002',
            { type: 'closeFamousPersons' },
          );
        }
        const capitalCityId = this.getCapitalCityId();
        if (step === TUTORIAL_STEPS.famousCardViewed && this.isWorldSiteSelected(capitalCityId) && !this.isFamousPersonsOpen() && !this.isCityManagementOpen()) {
          return this.showCapitalEnterHighlight(capitalCityId);
        }
        if (step === TUTORIAL_STEPS.famousCardViewed && !this.isFamousPersonsOpen() && !this.isCityManagementOpen()) {
          return this.focusCapitalSite(capitalCityId);
        }
        if (step === TUTORIAL_STEPS.famousCardViewed && this.isCityManagementOpen() && !this.isCityManagementTabOpen('military')) {
          return this.showHighlight(
            'switchCityManagementTab',
            (action) => !action.disabled && action.tab === 'military',
            '\u5207\u5230\u57ce\u5185\u519b\u4e8b\uff0c\u6211\u4eec\u8981\u628a\u8fd9\u4f4d\u540d\u4eba\u653e\u8fdb\u4fa6\u5bdf\u7f16\u961f\u3002',
            { type: 'switchCityManagementTab', tab: 'military' },
          );
        }
        if (step === TUTORIAL_STEPS.famousCardViewed && this.isCityManagementOpen() && this.isCityManagementTabOpen('military') && !this.getArmyFormationEditor().open) {
          return this.showHighlight(
            'openArmyFormation',
            (action) => !action.disabled && Number(action.slot || 1) === 1,
            '\u70b9\u51fb\u7b2c\u4e00\u5f20\u7f16\u961f\u5361\u7247\uff0c\u628a\u4fa6\u5bdf\u540d\u4eba\u653e\u8fdb\u961f\u4f0d\u3002',
            { type: 'openArmyFormation', cityId: capitalCityId, slot: 1 },
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
        if (step === TUTORIAL_STEPS.scoutFormationSaved) {
          this.ensureMapHomeGuideVisible({ clearWorldMarchTarget: true });
          return this.showHighlight(
            'selectWorldMarchTarget',
            (action) => !action.disabled,
            '\u70b9\u9009\u5927\u5730\u56fe\u4e0a\u7684\u4e00\u5757\u76ee\u6807\u5730\uff0c\u6211\u4eec\u4f1a\u628a\u4fa6\u5bdf\u961f\u6d3e\u5f80\u90a3\u91cc\u3002',
            { type: 'selectWorldMarchTarget' },
          );
        }
        if (step === TUTORIAL_STEPS.scoutWorldPanelOpened && !this.isWorldMarchFormationPickerOpen()) {
          this.ensureMapHomeGuideVisible();
          return this.showHighlight(
            'openWorldMarchFormationPicker',
            (action) => !action.disabled,
            '\u76ee\u6807\u5df2\u7ecf\u6807\u51fa\uff0c\u70b9\u51fb\u884c\u519b\uff0c\u9009\u62e9\u672c\u6b21\u51fa\u57ce\u7684\u961f\u4f0d\u3002',
            { type: 'openWorldMarchFormationPicker' },
          );
        }
        if (step === TUTORIAL_STEPS.scoutWorldPanelOpened && this.isWorldMarchFormationPickerOpen()) {
          return this.showHighlight(
            'startWorldMarch',
            (action) => !action.disabled && Number(action.formationSlot || action.slot || 1) === 1,
            '\u9009\u62e9\u7b2c\u4e00\u652f\u4fa6\u5bdf\u961f\u51fa\u57ce\uff0c\u8def\u7ebf\u4f1a\u7559\u5728\u5927\u5730\u56fe\u4e0a\u3002',
            { type: 'startWorldMarch', formationSlot: 1 },
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
      if (this.isFirstCityGuideActive()) {
        const step = this.getCurrentStep();
        const siteId = this.getFirstExploreCityId();
        const site = this.getFirstExploreCity() || {};
        if (step === TUTORIAL_STEPS.scoutExploreClaimed) {
          if (!this.isWorldSiteSelected(siteId)) {
            const highlighted = this.showFirstCitySiteOpenHighlight(siteId);
            if (highlighted) return true;
            return this.focusFirstCitySite(siteId);
          }
          return this.showHighlight(
            'conquer',
            (action) => !action.disabled && (!siteId || action.territoryId === siteId || action.cityId === siteId),
            '\u8fd9\u662f\u4e00\u5ea7\u65e0\u4e3b\u7a7a\u57ce\uff0c\u70b9\u51fb\u5360\u9886\uff0c\u6d3e\u4eba\u5efa\u7acb\u65b0\u636e\u70b9\u3002',
            { type: 'conquer', territoryId: siteId },
          );
        }
        if (step === TUTORIAL_STEPS.firstCityConquestStarted) {
          return this.showHighlight(
            'claimConquest',
            (action) => !action.disabled && (!siteId || action.territoryId === siteId || action.cityId === siteId),
            '\u961f\u4f0d\u5df2\u7ecf\u5230\u8fbe\uff0c\u70b9\u51fb\u5b8c\u6210\u5360\u9886\uff0c\u628a\u8fd9\u91cc\u7eb3\u5165\u6211\u4eec\u7684\u7248\u56fe\u3002',
            { type: 'claimConquest', territoryId: siteId },
          );
        }
        if (step === TUTORIAL_STEPS.firstCityOccupied) {
          if (!this.isNamingOpen('city', siteId)) {
            return this.showHighlight(
              'renameCity',
              (action) => !action.disabled && (!siteId || action.territoryId === siteId || action.cityId === siteId),
              `\u7ed9${site.naturalName || '\u8fd9\u5ea7\u65b0\u57ce'}\u53d6\u4e00\u4e2a\u540d\u5b57\uff0c\u8ba9\u5b83\u6210\u4e3a\u771f\u6b63\u7684\u57ce\u5e02\u3002`,
              { type: 'renameCity', territoryId: siteId },
            );
          }
          if (!this.getNamingInputValue()) {
            return this.showHighlight(
              'requestNamingInput',
              (action) => !action.disabled,
              '\u5148\u70b9\u51fb\u8f93\u5165\u6846\uff0c\u4e3a\u65b0\u57ce\u586b\u5165\u4e00\u4e2a\u540d\u5b57\u3002',
              { type: 'requestNamingInput' },
            );
          }
          return this.showHighlight(
            'submitNaming',
            (action) => !action.disabled,
            '\u786e\u8ba4\u57ce\u5e02\u540d\u79f0\uff0c\u63a5\u4e0b\u6765\u4e3a\u6211\u4eec\u7684\u6587\u660e\u547d\u540d\u3002',
            { type: 'submitNaming' },
          );
        }
        if (step === TUTORIAL_STEPS.firstCityNamed) {
          if (!this.isNamingOpen('polity')) {
            this.game?.openNaming?.({
              type: 'polity',
              title: '\u4e3a\u6587\u660e\u547d\u540d',
              message: '\u65b0\u57ce\u5df2\u7ecf\u5e76\u5165\u6211\u4eec\u7684\u7248\u56fe\uff0c\u73b0\u5728\u7ed9\u8fd9\u4e2a\u65b0\u751f\u6587\u660e\u4e00\u4e2a\u540d\u5b57\u3002',
            });
          }
          if (!this.getNamingInputValue()) {
            return this.showHighlight(
              'requestNamingInput',
              (action) => !action.disabled,
              '\u8f93\u5165\u6587\u660e\u540d\u79f0\uff0c\u8fd9\u4e2a\u540d\u5b57\u4f1a\u8bb0\u5f55\u5728\u52bf\u529b\u6863\u6848\u91cc\u3002',
              { type: 'requestNamingInput' },
            );
          }
          return this.showHighlight(
            'submitNaming',
            (action) => !action.disabled,
            '\u786e\u8ba4\u6587\u660e\u540d\u79f0\uff0c\u8fd9\u6761\u5f3a\u5f15\u5bfc\u5c31\u53ea\u5269\u6700\u540e\u7684\u79d1\u6280\u8bf4\u660e\u4e86\u3002',
            { type: 'submitNaming' },
          );
        }
      }
      if (this.isPostNamingSystemGuideActive()) {
        const step = this.getCurrentStep();
        if (step === TUTORIAL_STEPS.polityNamed) {
          this.ensureResourcesGuideVisible();
          return this.showHighlight(
            'openTalentPolicy',
            (action) => !action.disabled,
            '先打开方针，看看文明会怎样自动安排人才。',
            { type: 'openTalentPolicy' },
            this.getResourcesGuideHighlightOptions(),
          );
        }
        if (step === TUTORIAL_STEPS.talentPolicyOpened) {
          if (!this.isTalentPolicyOpen()) {
            this.ensureResourcesGuideVisible();
            return this.showHighlight(
              'openTalentPolicy',
              (action) => !action.disabled,
              '打开方针面板，确认一套适合当前阶段的人才安排。',
              { type: 'openTalentPolicy' },
              this.getResourcesGuideHighlightOptions(),
            );
          }
          return this.showHighlight(
            'confirmTalentPolicy',
            (action) => !action.disabled,
            '确认这套方针，系统会先帮我们把人才分配到更合适的位置。',
            { type: 'confirmTalentPolicy' },
          );
        }
        if (step === TUTORIAL_STEPS.talentPolicyApplied) {
          this.ensureResourcesGuideVisible();
          const picked = this.pickManualAssignAction();
          if (picked?.target) {
            return this.game?.canvasShell?.showTutorialHighlight?.(
              picked.target,
              '现在手动调整一次人才分配，之后你就能按城市需要微调岗位。',
              { ...this.getResourcesGuideHighlightOptions(), allowedAction: picked.action, source: 'strongTutorial' },
            ) || false;
          }
          return false;
        }
        if (step === TUTORIAL_STEPS.manualTalentAssigned) {
          return this.showHighlight(
            'openFamousPersons',
            (action) => !action.disabled,
            '打开名人，试一次寻访，看看新的候选人如何出现。',
            { type: 'openFamousPersons' },
          );
        }
        if (step === TUTORIAL_STEPS.famousSeekOpened) {
          if (!this.isFamousPersonsOpen()) {
            return this.showHighlight(
              'openFamousPersons',
              (action) => !action.disabled,
              '打开名人面板，进行一次寻访。',
              { type: 'openFamousPersons' },
            );
          }
          return this.showHighlight(
            'seekFamousPerson',
            (action) => !action.disabled,
            '点击寻访名人，新的候选人会进入名人馆等待你后续处理。',
            { type: 'seekFamousPerson' },
          );
        }
      }
      if (this.isFinalTechGuideActive()) {
        if (!this.isCommandPanelOpen('tech')) {
          this.prepareCommandPanelGuide('tech');
          return this.showHighlight(
            'openCommandPanel',
            (action) => !action.disabled && action.panel === 'tech',
            '\u6253\u5f00\u79d1\u6280\uff0c\u770b\u770b\u6587\u660e\u672a\u6765\u7684\u53d1\u5c55\u8def\u7ebf\u3002',
            { type: 'openCommandPanel', panel: 'tech' },
          );
        }
        return this.showSoftGuide(
          'tech-tree',
          '\u79d1\u6280\u70b9\u4f1a\u5f71\u54cd\u6587\u660e\u7684\u53d1\u5c55\u8fdb\u7a0b\uff0c\u4e0d\u540c\u8def\u7ebf\u4f1a\u628a\u805a\u843d\u5e26\u5411\u519c\u4e1a\u3001\u519b\u4e8b\u6216\u5de5\u4e1a\u7b49\u4e0d\u540c\u4fa7\u91cd\u3002\u63a5\u4e0b\u6765\u7531\u4f60\u6765\u51b3\u5b9a\u7b2c\u4e00\u9879\u7814\u7a76\u3002',
        );
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
