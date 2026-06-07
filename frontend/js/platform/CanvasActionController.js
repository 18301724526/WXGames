(function (global) {
  var TechTreeInteractionModelBase = global.TechTreeInteractionModel;
  if (typeof module !== 'undefined' && module.exports && !TechTreeInteractionModelBase) {
    TechTreeInteractionModelBase = require('./interactions/TechTreeInteractionModel');
  }

  const CLOSEABLE_PANELS = [
    'showSettings',
    'showLogs',
    'showResourceDetails',
    'showCitySwitcher',
    'showSubcityList',
    'showCityManagement',
    'showAdvisor',
    'showTaskCenter',
    'showTalentPolicy',
    'showGuidebook',
    'showFamousPersons',
    'armyFormationEditor',
    'techDetailOpen',
    'activeCommandPanel',
  ];

  class CanvasActionController {
    constructor(options = {}) {
      this.host = options.host || null;
      this.awaitAsync = Boolean(options.awaitAsync);
      this.log = typeof options.log === 'function' ? options.log : null;
      const TechTreeInteractionModelCtor = options.techTreeInteractionModelClass || TechTreeInteractionModelBase || null;
      this.techTreeInteraction = options.techTreeInteraction || (TechTreeInteractionModelCtor ? new TechTreeInteractionModelCtor({
        host: this.host,
        getState: () => this.getState(),
      }) : null);
      if (this.techTreeInteraction && !this.techTreeInteraction.host) this.techTreeInteraction.host = this.host;
    }

    getGameHost() {
      return this.host?.getCanvasGameHost?.() || this.host?.lastGame || this.host;
    }

    getState() {
      return this.host?.getCanvasActionState?.()
        || this.getGameHost()?.state
        || this.host?.state
        || {};
    }

    getPresenter() {
      return this.host?.presenter || this.getGameHost()?.presenter || null;
    }

    getTerritoryController() {
      return this.host?.territoryController || this.getGameHost()?.territoryController || null;
    }

    getEventController() {
      return this.host?.eventController || this.getGameHost()?.eventController || null;
    }

    getBuildingController() {
      return this.host?.buildingController || this.getGameHost()?.buildingController || null;
    }

    getSharedTerritoryUiState() {
      const game = this.getGameHost();
      const territoryController = this.host?.territoryController || game?.territoryController || null;
      const uiState = territoryController?.uiState
        || this.host.territoryUiState
        || game?.territoryUiState
        || territoryController?.getUiState?.()
        || {};
      this.host.territoryUiState = uiState;
      if (game && game !== this.host && typeof game === 'object') game.territoryUiState = uiState;
      if (territoryController && typeof territoryController === 'object' && !territoryController.uiState) {
        territoryController.uiState = uiState;
      }
      return uiState;
    }

    setField(key, value, target = this.host) {
      if (target && typeof target === 'object') target[key] = value;
    }

    closePanels(except = []) {
      const keep = new Set(except);
      CLOSEABLE_PANELS.forEach((key) => {
        if (!keep.has(key) && key in this.host) this.host[key] = key === 'activeCommandPanel' ? '' : false;
      });
      if (!keep.has('activeEventId') && 'activeEventId' in this.host) this.host.activeEventId = null;
    }

    closePanelsOn(target, except = []) {
      if (!target || target === this.host || typeof target !== 'object') return;
      const keep = new Set(except);
      CLOSEABLE_PANELS.forEach((key) => {
        if (!keep.has(key) && key in target) target[key] = key === 'activeCommandPanel' ? '' : false;
      });
      if (!keep.has('activeEventId') && 'activeEventId' in target) target.activeEventId = null;
    }

    closePanelsEverywhere(except = []) {
      this.closePanels(except);
      const game = this.getGameHost();
      this.closePanelsOn(game, except);
      this.closePanelsOn(game?.canvasShell, except);
      return game;
    }

    render(action = {}) {
      if (typeof this.host?.renderCanvasAction === 'function') return this.host.renderCanvasAction(action);
      if (typeof this.host?.renderGuideFrame === 'function') return this.host.renderGuideFrame();
      if (typeof this.host?.render === 'function') return this.host.render();
      return false;
    }

    renderDragFrame(action = {}) {
      if (action.phase === 'move') {
        const game = this.getGameHost();
        if (typeof this.host?.requestRenderAnimationFrame === 'function') return this.host.requestRenderAnimationFrame(action);
        if (game !== this.host && typeof game?.requestRenderAnimationFrame === 'function') return game.requestRenderAnimationFrame(action);
        if (typeof this.host?.renderAnimationFrame === 'function') return this.host.renderAnimationFrame();
        if (game !== this.host && typeof game?.renderAnimationFrame === 'function') return game.renderAnimationFrame();
      }
      return this.render(action);
    }

    afterHandled(action = {}) {
      if (action.type !== 'switchTab' && action.type !== 'goToGuideTaskTarget') this.render(action);
      return true;
    }

    getWorldMapLayerHost() {
      const game = this.getGameHost();
      if (game?.canvasShell) return game.canvasShell;
      if (this.host?.canvasShell) return this.host.canvasShell;
      if (typeof this.host?.requestWorldMapRenderAnimationFrame === 'function'
        || typeof this.host?.renderWorldMapLayerFrame === 'function') return this.host;
      if (typeof game?.requestWorldMapRenderAnimationFrame === 'function'
        || typeof game?.renderWorldMapLayerFrame === 'function') return game;
      return null;
    }

    refreshWorldMapLayer(options = {}) {
      const refreshOptions = {
        force: true,
        invalidateWorldTileView: false,
        ...options,
      };
      const game = this.getGameHost();
      const candidates = [
        this.getWorldMapLayerHost(),
        game?.canvasShell,
        this.host?.canvasShell,
        this.host,
        game,
      ].filter(Boolean);
      for (const target of candidates) {
        if (typeof target?.requestWorldMapRenderAnimationFrame === 'function') {
          return target.requestWorldMapRenderAnimationFrame(refreshOptions) !== false;
        }
        if (typeof target?.renderWorldMapLayerFrame === 'function') {
          return target.renderWorldMapLayerFrame(refreshOptions) !== false;
        }
      }
      if (typeof game?.renderRuntimeWorldMap === 'function') return game.renderRuntimeWorldMap(refreshOptions) !== false;
      return false;
    }

    refreshWorldMarchLayer(action = {}) {
      const handled = this.afterHandled(action);
      this.refreshWorldMapLayer();
      return handled;
    }

    finalize(result) {
      if (!result || typeof result.then !== 'function') return result !== false;
      if (this.awaitAsync) return result.then((value) => value !== false);
      result.catch((error) => this.log?.(error));
      return true;
    }

    finalizeTalentPolicyApply(result, action = {}) {
      const closeAfterSuccess = (value) => {
        if (value !== false) {
          this.host.showTalentPolicy = false;
          const game = this.getGameHost();
          if (game && game !== this.host && 'showTalentPolicy' in game) game.showTalentPolicy = false;
          game?.tutorialController?.onTalentPolicyApplied?.(value || {});
          this.afterHandled(action);
          game?.tutorialController?.refreshCurrentHighlight?.();
        }
        return value !== false;
      };
      if (!result || typeof result.then !== 'function') return closeAfterSuccess(result);
      if (this.awaitAsync) return result.then(closeAfterSuccess);
      result.then(closeAfterSuccess).catch((error) => this.log?.(error));
      return true;
    }

    finalizeNamingSubmit(result, action = {}) {
      const closeAfterSuccess = (value) => {
        if (value !== false) {
          this.host?.closeNaming?.();
          const game = this.getGameHost();
          if (game && game !== this.host && typeof game.closeNamingModal === 'function') game.closeNamingModal();
          game?.tutorialController?.refreshCurrentHighlight?.();
        }
        return value !== false;
      };
      if (!result || typeof result.then !== 'function') return closeAfterSuccess(result);
      if (this.awaitAsync) return result.then(closeAfterSuccess);
      result.then(closeAfterSuccess).catch((error) => this.log?.(error));
      return true;
    }

    syncTalentPolicyPanelOpen(open = true) {
      const game = this.getGameHost();
      this.host.showTalentPolicy = Boolean(open);
      if (game && game !== this.host && 'showTalentPolicy' in game) {
        game.showTalentPolicy = Boolean(open);
      }
      if (game?.canvasShell && game.canvasShell !== this.host && 'showTalentPolicy' in game.canvasShell) {
        game.canvasShell.showTalentPolicy = Boolean(open);
      }
      return game;
    }

    getTalentPolicyDraft() {
      const game = this.getGameHost();
      if (typeof game?.getTalentPolicyDraft === 'function') return game.getTalentPolicyDraft();
      const state = this.getState();
      const policies = state?.talentPolicies || {};
      const uiState = this.host?.talentPolicyUiState || {};
      const systemPolicies = Array.isArray(policies.systemPolicies) ? policies.systemPolicies : [];
      const activeIsSystem = systemPolicies.some((policy) => policy.id === policies.activePolicyId);
      const basePolicyId = uiState.basePolicyId
        || uiState.selectedBasePolicyId
        || (activeIsSystem ? policies.activePolicyId : null)
        || policies.activeDraft?.basePolicyId
        || 'balanced';
      const defaults = policies.defaultTiers || { agriculture: 2, knowledge: 2, industry: 2 };
      return {
        basePolicyId,
        tiers: {
          agriculture: Number(uiState.tiers?.agriculture ?? defaults.agriculture ?? 2),
          knowledge: Number(uiState.tiers?.knowledge ?? defaults.knowledge ?? 2),
          industry: Number(uiState.tiers?.industry ?? defaults.industry ?? 2),
        },
      };
    }

    isDefaultTalentPolicyDraft(draft = {}) {
      const tiers = draft.tiers || {};
      return ['agriculture', 'knowledge', 'industry'].every((key) => Number(tiers[key] ?? 2) === 2);
    }

    forward(action, meta = {}) {
      if (typeof this.host?.forwardCanvasAction !== 'function') return undefined;
      return this.host.forwardCanvasAction(action, meta);
    }

    async runAction(callback) {
      if (typeof callback !== 'function') return null;
      const game = this.getGameHost();
      if (game && game !== this.host && typeof game.runAction === 'function') return game.runAction(callback);
      if (typeof this.host?.runAction === 'function') return this.host.runAction(callback);
      return callback();
    }

    handle(action, meta = {}) {
      if (!action || action.disabled) return Boolean(action?.disabled);
      const handler = this[`handle_${action.type}`] || this.handleUnknown;
      return handler.call(this, action, meta);
    }

    handleUnknown(action, meta = {}) {
      const forwarded = this.forward(action, meta);
      return forwarded === undefined ? false : forwarded !== false;
    }

    canUseLocalRuntime() {
      return Boolean(this.host?.api);
    }

    handle_switchTab(action, meta = {}) {
      const previousTab = this.host?.getActiveTab?.() || this.getGameHost()?.getActiveTab?.() || this.getState()?.currentTab || 'resources';
      const previousBuildingOffset = Math.max(0, Number(this.host?.buildingOffset) || 0);
      this.host?.resetForCanvasTabSwitch?.(action);
      const game = this.getGameHost();
      const gameHandlesSelection = typeof game?.handleCanvasTabSelection === 'function';
      const hostCanAnimate = !gameHandlesSelection;
      let result;
      if (gameHandlesSelection) {
        result = game.handleCanvasTabSelection(action.tab);
      } else {
        const forwarded = this.forward(action, meta);
        if (forwarded !== undefined) result = forwarded;
        else if (game && game !== this.host && typeof game.switchTab === 'function') result = game.switchTab(action.tab);
        else if (typeof this.host?.switchTab === 'function') result = this.host.switchTab(action.tab);
        else result = false;
      }
      return this.finalize(Promise.resolve(result).then((allowed) => {
        if (allowed !== false) {
          const resolvedTab = this.host?.getActiveTab?.() || game?.getActiveTab?.() || '';
          const requestedNextTab = action.tab || resolvedTab || 'resources';
          const nextView = this.host?.resolveMapHomeViewState?.(this.getState(), {
            requestedTab: requestedNextTab,
            forceMapHome: requestedNextTab === 'resources' || requestedNextTab === 'territory',
          });
          const nextTab = resolvedTab && resolvedTab !== previousTab
            ? resolvedTab
            : (nextView?.activeTab || requestedNextTab);
          if (hostCanAnimate) this.host?.startPageTransition?.(previousTab, nextTab, { fromBuildingOffset: previousBuildingOffset });
          this.afterHandled(action);
        }
        return allowed !== false;
      }));
    }

    handle_openResourceDetails(action) {
      this.host.showResourceDetails = true;
      this.closePanels(['showResourceDetails']);
      return this.afterHandled(action);
    }

    handle_openCommandPanel(action) {
      const panel = String(action.panel || '');
      if (!panel) return false;
      this.host.activeCommandPanel = this.host.activeCommandPanel === panel ? '' : panel;
      this.closePanels(this.host.activeCommandPanel ? ['activeCommandPanel'] : []);
      const game = this.getGameHost();
      const openedPanel = this.host.activeCommandPanel;
      const tutorialResult = openedPanel && typeof game?.tutorialController?.onCommandPanelOpened === 'function'
        ? game.tutorialController.onCommandPanelOpened(openedPanel)
        : true;
      return this.finalize(Promise.resolve(tutorialResult).then((allowed) => {
        if (allowed !== false) {
          this.afterHandled(action);
          game?.tutorialController?.refreshCurrentHighlight?.();
          const scheduler = this.host?.runtime || game?.runtime || global;
          scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
        }
        return allowed !== false;
      }));
    }

    handle_closeCommandPanel(action) {
      this.host.activeCommandPanel = '';
      return this.afterHandled(action);
    }

    handle_closeResourceDetails(action) {
      this.host.showResourceDetails = false;
      return this.afterHandled(action);
    }

    handle_closeRewardReveal(action) {
      const closed = typeof this.host?.closeRewardReveal === 'function'
        ? this.host.closeRewardReveal()
        : (this.host.rewardReveal = null, true);
      if (closed) {
        this.afterHandled(action);
        this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
      }
      return closed !== false;
    }

    handle_openCitySwitcher(action) {
      this.host.showCitySwitcher = !this.host.showCitySwitcher;
      this.closePanels(['showCitySwitcher']);
      return this.afterHandled(action);
    }

    handle_closeCitySwitcher(action) {
      this.host.showCitySwitcher = false;
      return this.afterHandled(action);
    }

    handle_openSubcityList(action) {
      this.host.showSubcityList = !this.host.showSubcityList;
      this.closePanels(this.host.showSubcityList ? ['showSubcityList'] : []);
      return this.afterHandled(action);
    }

    handle_closeSubcityList(action) {
      this.host.showSubcityList = false;
      return this.afterHandled(action);
    }

    handle_openCityManagement(action) {
      const tab = action.tab || 'buildings';
      this.host.showCityManagement = true;
      this.host.activeCityManagementTab = tab;
      this.closePanels(['showCityManagement']);
      const game = this.getGameHost();
      if (game && game !== this.host) {
        game.showCityManagement = true;
        game.activeCityManagementTab = tab;
      }
      return this.afterHandled(action);
    }

    handle_closeCityManagement(action) {
      this.host.showCityManagement = false;
      const game = this.getGameHost();
      if (game && game !== this.host && 'showCityManagement' in game) game.showCityManagement = false;
      return this.afterHandled(action);
    }

    handle_switchCityManagementTab(action) {
      const allowed = ['buildings', 'people', 'military'];
      const tab = allowed.includes(action.tab) ? action.tab : 'buildings';
      this.host.activeCityManagementTab = tab;
      const game = this.getGameHost();
      if (game && game !== this.host) game.activeCityManagementTab = tab;
      return this.afterHandled(action);
    }

    handle_openArmyFormation(action) {
      const slot = Math.max(1, Math.min(3, Number(action.slot) || 1));
      const game = this.getGameHost();
      const target = game && game !== this.host ? game : this.host;
      if (typeof target?.openArmyFormation === 'function') {
        const opened = target.openArmyFormation({ ...action, slot }) !== false;
        if (opened) {
          const result = game?.tutorialController?.onArmyFormationOpened?.();
          game?.tutorialController?.refreshCurrentHighlight?.();
          const scheduler = this.host?.runtime || game?.runtime || global;
          scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
          if (result?.catch) result.catch((error) => this.log?.(error));
        }
        return opened;
      }
      const message = `编队 ${slot} 功能待开放`;
      if (typeof this.host?.showFloatingText === 'function') this.host.showFloatingText(message);
      else if (typeof game?.showFloatingText === 'function') game.showFloatingText(message);
      else this.log?.(message);
      return this.afterHandled(action);
    }

    handle_closeArmyFormationEditor(action) {
      const game = this.getGameHost();
      const target = game && game !== this.host ? game : this.host;
      if (typeof target?.closeArmyFormationEditor === 'function') {
        return target.closeArmyFormationEditor(action) !== false;
      }
      if (this.host && typeof this.host === 'object') this.host.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
      return this.afterHandled(action);
    }

    handle_toggleArmyFormationMember(action) {
      const game = this.getGameHost();
      const target = game && game !== this.host ? game : this.host;
      if (typeof target?.toggleArmyFormationMember === 'function') {
        return target.toggleArmyFormationMember(action) !== false;
      }
      return false;
    }

    handle_changeArmyFormationPage(action) {
      const game = this.getGameHost();
      const target = game && game !== this.host ? game : this.host;
      if (typeof target?.changeArmyFormationPage === 'function') {
        return target.changeArmyFormationPage(action) !== false;
      }
      return false;
    }

    handle_saveArmyFormation(action) {
      const game = this.getGameHost();
      const target = game && game !== this.host ? game : this.host;
      if (typeof target?.saveArmyFormation === 'function') {
        return this.finalize(target.saveArmyFormation(action));
      }
      return false;
    }

    handle_openSettings(action) {
      this.host.showSettings = true;
      this.closePanels(['showSettings']);
      return this.afterHandled(action);
    }

    handle_closeSettings(action) {
      this.host.showSettings = false;
      return this.afterHandled(action);
    }

    handle_openLogs(action) {
      this.host.showLogs = true;
      this.closePanels(['showLogs']);
      return this.afterHandled(action);
    }

    handle_closeLogs(action) {
      this.host.showLogs = false;
      this.getGameHost()?.closeRequestLogs?.();
      return this.afterHandled(action);
    }

    handle_clearLogs(action) {
      const game = this.getGameHost();
      if (Array.isArray(game?.requestLogs)) game.requestLogs = [];
      if (typeof game?.clearRequestLogs === 'function') game.clearRequestLogs();
      this.host.showLogs = true;
      return this.afterHandled(action);
    }

    handle_openAdvisor(action) {
      this.host.showAdvisor = true;
      this.closePanels(['showAdvisor']);
      return this.afterHandled(action);
    }

    handle_closeAdvisor(action) {
      this.host.showAdvisor = false;
      this.host.tutorialAdvisorDialogue = null;
      this.host.renderer?.clearTutorialAdvisorDialogue?.();
      const game = this.getGameHost();
      if (game && game !== this.host) game.showAdvisor = false;
      if (game && typeof game === 'object') {
        game.tutorialAdvisorDialogue = null;
        if (game.canvasShell) game.canvasShell.tutorialAdvisorDialogue = null;
      }
      const closeResult = typeof game?.tutorialController?.onAdvisorClosed === 'function'
        ? game.tutorialController.onAdvisorClosed(action)
        : true;
      return this.finalize(Promise.resolve(closeResult).then((result) => {
        if (result !== false) {
          this.afterHandled(action);
          game?.tutorialController?.refreshCurrentHighlight?.();
        }
        return result !== false;
      }));
    }

    handle_goToAdvisorTarget(action, meta = {}) {
      this.host.showAdvisor = false;
      this.host.activeEventId = null;
      const game = this.getGameHost();
      if (game && game !== this.host) game.showAdvisor = false;
      const result = typeof game?.goToAdvisorTarget === 'function'
        ? game.goToAdvisorTarget()
        : this.forward(action, meta);
      if (result !== false) this.afterHandled(action);
      return result !== false;
    }

    handle_openEvent(action) {
      const game = this.getGameHost();
      const eventData = (game?.state?.eventQueue || this.getState().eventQueue || [])
        .find((item) => item.id === action.eventId);
      if (!eventData) return false;
      this.host.activeEventId = action.eventId;
      if (game && game !== this.host && 'activeEventId' in game) game.activeEventId = action.eventId;
      if (game?.canvasShell && game.canvasShell !== this.host) game.canvasShell.activeEventId = action.eventId;
      this.closePanels(['activeEventId']);
      const controller = this.getEventController();
      controller?.open?.(action.eventId);
      this.host.activeEventId = action.eventId;
      if (game && game !== this.host && 'activeEventId' in game) game.activeEventId = action.eventId;
      if (game?.canvasShell && game.canvasShell !== this.host) game.canvasShell.activeEventId = action.eventId;
      if (controller && 'activeEventId' in controller) controller.activeEventId = action.eventId;
      const handled = this.afterHandled(action);
      game?.tutorialController?.refreshCurrentHighlight?.();
      return handled;
    }

    handle_closeEvent(action) {
      this.host.activeEventId = null;
      const game = this.getGameHost();
      if (game && game !== this.host && 'activeEventId' in game) game.activeEventId = null;
      if (game?.canvasShell && game.canvasShell !== this.host) game.canvasShell.activeEventId = null;
      const controller = this.getEventController();
      controller?.close?.();
      if (controller && 'activeEventId' in controller) controller.activeEventId = null;
      return this.afterHandled(action);
    }

    handle_goToGuideTaskTarget(action) {
      return false;
    }

    handle_openTaskCenter(action) {
      const tab = action.tab
        || (this.host?.hasClaimableMainTask?.() ? 'main' : this.host.activeTaskCenterTab)
        || 'main';
      const game = this.closePanelsEverywhere(['showTaskCenter']);
      this.host.showTaskCenter = true;
      this.host.activeTaskCenterTab = tab;
      if (game && game !== this.host) {
        game.showTaskCenter = true;
        game.activeTaskCenterTab = tab;
      }
      if (game?.canvasShell && game.canvasShell !== this.host) {
        game.canvasShell.showTaskCenter = true;
        game.canvasShell.activeTaskCenterTab = tab;
      }
      this.host.showTaskCenter = true;
      this.host.activeTaskCenterTab = tab;
      if (game && game !== this.host) {
        game.showTaskCenter = true;
        game.activeTaskCenterTab = tab;
      }
      if (game?.canvasShell && game.canvasShell !== this.host) {
        game.canvasShell.showTaskCenter = true;
        game.canvasShell.activeTaskCenterTab = tab;
      }
      const handled = this.afterHandled(action);
      game?.tutorialController?.refreshCurrentHighlight?.();
      return handled;
    }

    handle_closeTaskCenter(action) {
      this.host.showTaskCenter = false;
      const game = this.getGameHost();
      if (game && game !== this.host && 'showTaskCenter' in game) game.showTaskCenter = false;
      return this.afterHandled(action);
    }

    handle_switchTaskCenterTab(action) {
      const tab = action.tab || 'main';
      this.host.activeTaskCenterTab = tab;
      const game = this.getGameHost();
      if (game && game !== this.host) game.activeTaskCenterTab = tab;
      return this.afterHandled(action);
    }

    handle_openGuidebook(action) {
      this.host.showGuidebook = true;
      this.host.activeGuidebookTab = action.tab || this.host.activeGuidebookTab || 'planning';
      this.closePanels(['showGuidebook']);
      return this.afterHandled(action);
    }

    handle_closeGuidebook(action) {
      this.host.showGuidebook = false;
      return this.afterHandled(action);
    }

    handle_switchGuidebookTab(action) {
      this.host.activeGuidebookTab = action.tab || 'planning';
      return this.afterHandled(action);
    }

    handle_openFamousPersons(action) {
      this.host.showFamousPersons = true;
      this.host.famousPersonsPage = 0;
      this.host.selectedFamousPersonId = '';
      const game = this.getGameHost();
      if (game && game !== this.host && 'showFamousPersons' in game) game.showFamousPersons = true;
      if (game && game !== this.host && 'famousPersonsPage' in game) game.famousPersonsPage = 0;
      if (game && game !== this.host && 'selectedFamousPersonId' in game) game.selectedFamousPersonId = '';
      this.host.renderer?.clearFamousSkillTooltip?.();
      this.closePanels(['showFamousPersons']);
      const handled = this.afterHandled(action);
      const result = game?.tutorialController?.onFamousPersonsOpened?.();
      game?.tutorialController?.refreshCurrentHighlight?.();
      const scheduler = this.host?.runtime || game?.runtime || global;
      scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
      if (result?.catch) result.catch((error) => this.log?.(error));
      return handled;
    }

    handle_closeFamousPersons(action) {
      this.host.showFamousPersons = false;
      this.host.famousPersonsPage = 0;
      this.host.selectedFamousPersonId = '';
      const game = this.getGameHost();
      if (game && game !== this.host && 'showFamousPersons' in game) game.showFamousPersons = false;
      if (game && game !== this.host && 'famousPersonsPage' in game) game.famousPersonsPage = 0;
      if (game && game !== this.host && 'selectedFamousPersonId' in game) game.selectedFamousPersonId = '';
      this.host.renderer?.clearFamousSkillTooltip?.();
      const handled = this.afterHandled(action);
      const tutorial = game?.tutorialController || null;
      const result = tutorial?.onFamousPersonsClosed
        ? tutorial.onFamousPersonsClosed()
        : tutorial?.refreshCurrentHighlight?.();
      const scheduler = this.host?.runtime || game?.runtime || global;
      scheduler?.setTimeout?.(() => tutorial?.refreshCurrentHighlight?.(), 0);
      if (result?.catch) result.catch((error) => this.log?.(error));
      return handled;
    }

    handle_openFamousPersonDetail(action) {
      this.host.selectedFamousPersonId = action.personId || '';
      const game = this.getGameHost();
      if (game && game !== this.host && 'selectedFamousPersonId' in game) game.selectedFamousPersonId = action.personId || '';
      this.host.renderer?.clearFamousSkillTooltip?.();
      const handled = this.afterHandled(action);
      const result = game?.tutorialController?.onFamousPersonDetailOpened?.(action.personId || '');
      game?.tutorialController?.refreshCurrentHighlight?.();
      const scheduler = this.host?.runtime || game?.runtime || global;
      scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
      if (result?.catch) result.catch((error) => this.log?.(error));
      return handled;
    }

    handle_closeFamousPersonDetail(action) {
      this.host.selectedFamousPersonId = '';
      const game = this.getGameHost();
      if (game && game !== this.host && 'selectedFamousPersonId' in game) game.selectedFamousPersonId = '';
      this.host.renderer?.clearFamousSkillTooltip?.();
      const handled = this.afterHandled(action);
      game?.tutorialController?.refreshCurrentHighlight?.();
      const scheduler = this.host?.runtime || game?.runtime || global;
      scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
      return handled;
    }

    handle_seekFamousPerson(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.seekFamousPerson === 'function') {
        return this.finalize(Promise.resolve(game.seekFamousPerson(action.source || 'seek')).then((result) => {
          game?.tutorialController?.onFamousPersonSought?.(result || {});
          return result;
        }));
      }
      return this.finalize(this.runAction(() => this.host.api.seekFamousPerson(action.source || 'seek')).then((result) => {
        game?.tutorialController?.onFamousPersonSought?.(result || {});
        return result;
      }));
    }

    handle_acceptFamousPerson(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.acceptFamousPerson === 'function') {
        return this.finalize(game.acceptFamousPerson(action.candidateId));
      }
      return this.finalize(this.runAction(() => this.host.api.acceptFamousPerson(action.candidateId)));
    }

    handle_dismissFamousPersonCandidate(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.dismissFamousPersonCandidate === 'function') {
        return this.finalize(game.dismissFamousPersonCandidate(action.candidateId));
      }
      return this.finalize(this.runAction(() => this.host.api.dismissFamousPersonCandidate(action.candidateId)));
    }

    handle_assignFamousAttributePoint(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.assignFamousAttributePoint === 'function') {
        return this.finalize(game.assignFamousAttributePoint(action.personId, action.attribute));
      }
      return this.finalize(this.runAction(() => this.host.api.assignFamousAttributePoint(action.personId, action.attribute)));
    }

    handle_openTalentPolicy(action) {
      const game = this.syncTalentPolicyPanelOpen(true);
      this.closePanels(['showTalentPolicy']);
      const handled = this.afterHandled(action);
      const result = game?.tutorialController?.onTalentPolicyOpened?.();
      const refreshAfterTutorialAdvance = () => {
        this.syncTalentPolicyPanelOpen(true);
        this.render(action);
        game?.tutorialController?.refreshCurrentHighlight?.();
      };
      if (result && typeof result.then === 'function') {
        result.then(refreshAfterTutorialAdvance).catch((error) => this.log?.(error));
      } else {
        refreshAfterTutorialAdvance();
      }
      return handled;
    }

    handle_closeTalentPolicy(action) {
      this.host.showTalentPolicy = false;
      return this.afterHandled(action);
    }

    handle_setTalentPolicyTier(action) {
      const game = this.getGameHost();
      const target = game && game !== this.host ? game : this.host;
      if (!target.talentPolicyUiState || typeof target.talentPolicyUiState !== 'object') target.talentPolicyUiState = {};
      target.talentPolicyUiState.tiers = {
        ...(target.talentPolicyUiState.tiers || {}),
        [action.tendency]: action.tier,
      };
      if (game && game !== this.host) this.host.talentPolicyUiState = target.talentPolicyUiState;
      return this.afterHandled(action);
    }

    handle_selectTalentPolicyBase(action) {
      const game = this.getGameHost();
      const target = game && game !== this.host ? game : this.host;
      if (!target.talentPolicyUiState || typeof target.talentPolicyUiState !== 'object') target.talentPolicyUiState = {};
      target.talentPolicyUiState = {
        ...target.talentPolicyUiState,
        basePolicyId: action.policyId || 'balanced',
        ...(action.resetTiers ? { tiers: { agriculture: 2, knowledge: 2, industry: 2 } } : {}),
      };
      if (game && game !== this.host) this.host.talentPolicyUiState = target.talentPolicyUiState;
      return this.afterHandled(action);
    }

    handle_resetTalentPolicyDraft(action) {
      const game = this.getGameHost();
      const target = game && game !== this.host ? game : this.host;
      target.talentPolicyUiState = {};
      if (game && game !== this.host) this.host.talentPolicyUiState = {};
      return this.afterHandled(action);
    }

    handle_applyTalentPolicy(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) {
        return this.finalizeTalentPolicyApply(forwarded, action);
      }
      const game = this.getGameHost();
      if (typeof game?.applyTalentPolicy === 'function') {
        return this.finalizeTalentPolicyApply(game.applyTalentPolicy(action.policyId), action);
      }
      return this.finalizeTalentPolicyApply(
        this.runAction(() => this.host.api.applyTalentPolicy(action.policyId)),
        action,
      );
    }

    handle_applyTalentPolicyDraft(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) {
        return this.finalizeTalentPolicyApply(forwarded, action);
      }
      const game = this.getGameHost();
      if (typeof game?.applyTalentPolicyDraft === 'function') {
        return this.finalizeTalentPolicyApply(game.applyTalentPolicyDraft(), action);
      }
      const draft = this.host?.talentPolicyUiState || {};
      return this.finalizeTalentPolicyApply(
        this.runAction(() => this.host.api.applyTalentPolicy(null, draft)),
        action,
      );
    }

    handle_confirmTalentPolicy(action) {
      const draft = this.getTalentPolicyDraft();
      if (this.host?.talentPolicyUiState && typeof this.host.talentPolicyUiState === 'object') {
        this.host.talentPolicyUiState = {
          ...this.host.talentPolicyUiState,
          basePolicyId: draft.basePolicyId,
          tiers: { ...(draft.tiers || {}) },
        };
      }
      const game = this.getGameHost();
      if (game && game !== this.host && 'talentPolicyUiState' in game) {
        game.talentPolicyUiState = this.host.talentPolicyUiState;
      }
      if (this.isDefaultTalentPolicyDraft(draft) && draft.basePolicyId) {
        return this.handle_applyTalentPolicy({ ...action, type: 'applyTalentPolicy', policyId: draft.basePolicyId });
      }
      return this.handle_applyTalentPolicyDraft({ ...action, type: 'applyTalentPolicyDraft' });
    }

    handle_saveTalentPolicyDraft(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.saveTalentPolicyDraft === 'function') return this.finalize(game.saveTalentPolicyDraft());
      const draft = this.host?.talentPolicyUiState || {};
      return this.finalize(this.runAction(() => this.host.api.saveTalentPolicy(draft)));
    }

    handle_deleteTalentPolicy(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.deleteTalentPolicy === 'function') return this.finalize(game.deleteTalentPolicy(action.policyId));
      return this.finalize(this.runAction(() => this.host.api.deleteTalentPolicy(action.policyId)));
    }

    handle_requestLoginUsername() {
      return this.host?.requestAuthInput?.('username') !== false;
    }

    handle_requestLoginPassword() {
      return this.host?.requestAuthInput?.('password') !== false;
    }

    handle_toggleRememberPassword(action) {
      const toggled = this.host?.toggleRememberPassword?.();
      if (toggled !== false) this.afterHandled(action);
      return toggled !== false;
    }

    handle_submitLogin(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const result = this.getGameHost()?.handleLogin?.();
      return result === undefined ? true : result !== false;
    }

    handle_resetGame(action) {
      this.closePanels();
      const result = this.getGameHost()?.resetGame?.();
      const applyResetView = (success) => {
        if (success === false) return false;
        this.host?.resetLocalViewToResources?.({ skipRender: true });
        const game = this.getGameHost();
        if (game && game !== this.host) game.resetLocalViewToResources?.({ skipShell: true, skipRender: true });
        this.render({ ...action, tab: 'military', militaryView: 'world', isMapHome: true });
        return true;
      };
      if (!result || typeof result.then !== 'function') return applyResetView(result);
      return this.finalize(result.then(applyResetView));
    }

    handle_logout(action) {
      this.closePanels();
      const result = this.getGameHost()?.logout?.();
      return result === undefined ? true : result !== false;
    }

    handle_requestNamingInput(action) {
      const result = this.host?.requestNamingInput?.();
      return result !== false;
    }

    handle_closeNaming(action) {
      const result = this.host?.closeNaming?.() || this.getGameHost()?.closeNamingModal?.();
      return result !== false;
    }

    handle_submitNaming(action) {
      const name = action.name || this.host?.getNamingName?.();
      const forwarded = this.forward({ ...action, name });
      if (forwarded !== undefined) return this.finalizeNamingSubmit(forwarded, action);
      const game = this.getGameHost();
      const result = typeof game?.submitNaming === 'function'
        ? game.submitNaming(name)
        : this.host?.submitNaming?.();
      return this.finalizeNamingSubmit(result, action);
    }

    handle_blockCanvasModal() {
      return true;
    }

    handle_selectCity(action) {
      this.host.showCitySwitcher = false;
      this.host.showSubcityList = false;
      this.host.activeEventId = null;
      const forwarded = this.forward(action);
      if (forwarded !== undefined) {
        if (forwarded !== false) this.afterHandled(action);
        return forwarded !== false;
      }
      return this.finalize(this.selectCity(action));
    }

    async selectCity(action) {
      const game = this.getGameHost();
      if (typeof game?.switchCity === 'function') {
        return await game.switchCity(action.cityId);
      }
      this.host.showCitySwitcher = false;
      this.host.activeEventId = null;
      await this.runAction(() => this.host.api.switchCity(action.cityId));
      return true;
    }

    handle_jumpToSubcity(action) {
      const cityId = action.cityId || action.siteId || '';
      if (!cityId) return false;
      this.host.showSubcityList = false;
      this.host.activeCommandPanel = '';
      this.host.activeEventId = null;
      this.openWorldSiteLocally(cityId);
      this.centerWorldMapOnSite(cityId);
      const selectAction = { ...action, type: 'selectCity', cityId };
      const forwarded = this.forward(selectAction);
      if (forwarded !== undefined) {
        if (forwarded !== false) this.afterHandled(action);
        return forwarded !== false;
      }
      return this.finalize(Promise.resolve(this.selectCity(selectAction)).then((allowed) => {
        if (allowed !== false) this.afterHandled(action);
        return allowed !== false;
      }));
    }

    handle_enterCity(action) {
      if (this.beginTutorialEnterCityTransition(action)) return true;
      return this.performEnterCity(action);
    }

    beginTutorialEnterCityTransition(action = {}) {
      const controller = this.getTutorialIntroController();
      if (!controller || typeof controller.beginEnterCityTransition !== 'function') return false;
      const intro = this.getTutorialIntroView(controller);
      if (intro?.step !== 'enter') return false;
      const capitalCityId = intro.capitalCityId || controller.getCapitalCityId?.() || 'capital';
      const actionCityId = action.cityId || action.territoryId || action.siteId || '';
      if (action?.type !== 'enterCity' || (actionCityId && actionCityId !== capitalCityId)) return false;
      return controller.beginEnterCityTransition(action, () => this.performEnterCity(action)) === true;
    }

    getTutorialIntroController() {
      const game = this.getGameHost();
      return this.host?.tutorialIntroOverlay
        || this.host?.lastGame?.tutorialIntroOverlay
        || game?.tutorialIntroOverlay
        || null;
    }

    getTutorialIntroView(controller = this.getTutorialIntroController()) {
      const game = this.getGameHost();
      return controller?.getViewState?.()
        || this.host?.tutorialIntro
        || this.host?.lastGame?.tutorialIntro
        || game?.tutorialIntro
        || null;
    }

    performEnterCity(action) {
      const cityId = action.cityId || action.territoryId || action.siteId || '';
      if (!cityId) return false;
      this.host.showSubcityList = false;
      this.host.activeCommandPanel = '';
      this.host.activeEventId = null;
      const game = this.getGameHost();
      const result = typeof game?.enterCity === 'function'
        ? game.enterCity(cityId, { tab: action.tab || 'buildings' })
        : Promise.resolve(this.selectCity({ ...action, cityId })).then((allowed) => {
          if (allowed === false) return false;
          this.host.showCityManagement = true;
          this.host.activeCityManagementTab = action.tab || 'buildings';
          return true;
        });
      return this.finalize(Promise.resolve(result).then((allowed) => {
        if (allowed !== false) {
          this.host.showCityManagement = true;
          this.host.activeCityManagementTab = action.tab || 'buildings';
          this.afterHandled(action);
        }
        return allowed !== false;
      }));
    }

    openWorldSiteLocally(siteId) {
      const territory = this.getTerritoryController();
      if (territory?.openSiteDialog) {
        territory.openSiteDialog(siteId);
        return true;
      }
      this.host.territoryUiState = this.host.territoryUiState || {};
      this.host.territoryUiState.selectedSiteId = siteId;
      const game = this.getGameHost();
      if (game && game !== this.host) {
        game.territoryUiState = game.territoryUiState || {};
        game.territoryUiState.selectedSiteId = siteId;
      }
      return true;
    }

    getWorldTileForSite(siteId) {
      const worldMap = this.getState()?.territoryState?.worldMap || {};
      const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      return tiles.find((tile) => tile?.siteId === siteId) || null;
    }

    getTerritorySite(siteId) {
      const territories = this.getState()?.territoryState?.territories || [];
      return territories.find((site) => site?.id === siteId) || null;
    }

    centerWorldMapOnSite(siteId) {
      const tile = this.getWorldTileForSite(siteId);
      const site = this.getTerritorySite(siteId) || {};
      const q = Number(tile?.q ?? site.q ?? site.x ?? site.relativeX);
      const r = Number(tile?.r ?? site.r ?? site.y ?? site.relativeY);
      if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
      const renderer = this.host?.renderer || this.getGameHost()?.renderer;
      const geometry = renderer?.constructor?.getTileMapGeometry?.()?.DEFAULT_GEOMETRY
        || renderer?.presenter?.getTileMapGeometry?.()?.DEFAULT_GEOMETRY
        || { stepX: 96, stepY: 48 };
      const stepX = Number(geometry.stepX) || 96;
      const stepY = Number(geometry.stepY) || 48;
      const scale = 0.62;
      const frameWidth = Number(this.host?.runtime?.width || this.host?.renderer?.viewportWidth || this.host?.renderer?.width || 420);
      const frameHeight = Number(this.host?.runtime?.height || this.host?.renderer?.viewportHeight || this.host?.renderer?.height || 747);
      const topBarBottom = typeof this.host?.renderer?.getTopBarBottom === 'function'
        ? this.host.renderer.getTopBarBottom(this.getState(), { isMapHome: true })
        : 84;
      const visibleMapY = Math.max(0, Number(topBarBottom) || 84);
      const visibleMapH = Math.max(160, frameHeight - 64 - visibleMapY);
      const originX = frameWidth * 0.5;
      const originY = visibleMapY + visibleMapH * 0.42;
      const targetX = frameWidth * 0.5;
      const targetY = visibleMapY + visibleMapH * 0.46;
      const x = targetX - originX - ((q - r) * stepX * scale);
      const y = targetY - originY - ((q + r) * stepY * scale);
      const runtime = this.host?.ensureWorldMapRuntimeCoordinator?.()?.getMapRuntime?.()
        || this.getGameHost()?.ensureWorldMapRuntimeCoordinator?.()?.getMapRuntime?.()
        || this.host?.worldMapRuntime
        || this.getGameHost()?.worldMapRuntime;
      if (runtime?.setCamera) {
        runtime.setCamera(x, y, { source: 'subcityJump', render: true });
        return true;
      }
      const territory = this.getTerritoryController();
      if (territory?.setWorldPan) {
        territory.setWorldPan(x, y);
        return true;
      }
      this.host.territoryUiState = this.host.territoryUiState || {};
      this.host.territoryUiState.worldPanX = x;
      this.host.territoryUiState.worldPanY = y;
      return true;
    }

    handle_assignJob(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.assignJob === 'function') {
        return this.finalize(Promise.resolve(game.assignJob(action.job, action.delta)).then((result) => {
          game?.tutorialController?.onManualTalentAssigned?.(result || {});
          return result;
        }));
      }
      return this.finalize(this.runAction(() => this.host.api.assignJob(action.job, action.delta)).then((result) => {
        game?.tutorialController?.onManualTalentAssigned?.(result || {});
        return result;
      }));
    }

    handleCanvasShellAction(action, meta = {}) {
      return this.handle(action, meta);
    }

    handle_buildBuilding(action) {
      return this.finalize(this.handleBuilding(action, 'build'));
    }

    handle_upgradeBuilding(action) {
      return this.finalize(this.handleBuilding(action, 'upgrade'));
    }

    async handleBuilding(action, buildingAction) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      const method = buildingAction === 'upgrade' ? 'upgradeBuilding' : 'buildBuilding';
      if (game?.tutorialController?.onBuildingAction?.(action.buildingId, buildingAction) === false) {
        game.showFloatingText?.('请先按照引导建造第一处民居');
        game.tutorialController?.refreshCurrentHighlight?.();
        return false;
      }
      if (typeof game?.[method] === 'function') {
        return game[method](action.buildingId);
      }
      const setPending = (pending, options = {}) => {
        if (typeof this.host?.setPendingBuildingAction === 'function') {
          this.host.setPendingBuildingAction(pending, options);
        }
        if (game && game !== this.host && typeof game?.setPendingBuildingAction === 'function') {
          game.setPendingBuildingAction(pending, { ...options, render: false });
        }
      };
      if (this.host?.pendingBuildingAction?.buildingId || game?.pendingBuildingAction?.buildingId) return false;
      const controller = this.getBuildingController();
      setPending({ buildingId: action.buildingId, action: buildingAction });
      if (controller?.handleAction) {
        try {
          await controller.handleAction({ buildingId: action.buildingId, action: buildingAction });
          return true;
        } finally {
          setPending(null);
        }
      }
      try {
        await this.runAction(() => (
          buildingAction === 'upgrade'
            ? this.host.api.upgrade(action.buildingId)
            : this.host.api.build(action.buildingId)
        ));
        return true;
      } finally {
        setPending(null);
      }
    }

    handle_advanceEra(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.advanceEra === 'function') {
        return this.finalize(game.advanceEra());
      }
      return this.finalize(this.runAction(() => this.host.api.advanceEra()));
    }

    handle_research(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.research === 'function') {
        return this.finalize(game.research(action.techId));
      }
      return this.finalize(this.runAction(() => this.host.api.research(action.techId)));
    }

    handle_selectTechNode(action) {
      if (typeof this.host?.selectTechNode === 'function') {
        this.host.selectTechNode(action);
      } else if (this.host) {
        this.host.selectedTechId = action.techId || '';
        this.host.techDetailOpen = Boolean(action.techId);
        const game = this.getGameHost();
        if (game?.state && typeof game.state === 'object') {
          game.state = {
            ...game.state,
            techUiState: {
              ...(game.state.techUiState || {}),
              selectedTechId: action.techId || '',
              detailOpen: Boolean(action.techId),
            },
          };
        }
      }
      return this.afterHandled(action);
    }

    handle_closeTechDetail(action) {
      if (typeof this.host?.closeTechDetail === 'function') {
        this.host.closeTechDetail(action);
      } else if (this.host) {
        this.host.techDetailOpen = false;
        const game = this.getGameHost();
        if (game?.state && typeof game.state === 'object') {
          game.state = {
            ...game.state,
            techUiState: {
              ...(game.state.techUiState || {}),
              detailOpen: false,
            },
          };
        }
      }
      return this.afterHandled(action);
    }

    handle_claimEvent(action) {
      return this.finalize(this.claimEvent(action));
    }

    async claimEvent(action) {
      const controller = this.getEventController();
      this.host.activeEventId = null;
      controller?.close?.();
      const forwarded = this.forward(action);
      if (forwarded !== undefined) {
        if (forwarded !== false) {
          const game = this.getGameHost();
          game?.tutorialController?.sync?.(game?.tutorial || game?.state?.tutorial || {});
          game?.tutorialController?.refreshCurrentHighlight?.();
          this.afterHandled(action);
        }
        return forwarded !== false;
      }
      if (controller?.claim || controller?.claimActive) {
        controller.open?.(action.eventId);
        const claimResult = controller.claimActive
          ? controller.claimActive(action.optionId)
          : controller.claim(action.eventId, action.optionId);
        const result = await claimResult;
        return this.afterEventClaimed(result);
      }
      const api = this.host.api || this.getGameHost()?.getGameApi?.() || this.getGameHost()?.api;
      if (!api?.claimEvent) return false;
      const result = await this.runAction(() => api.claimEvent(action.eventId, action.optionId));
      return this.afterEventClaimed(result);
    }

    afterEventClaimed(result) {
      if (result?.success === false) return false;
      const game = this.getGameHost();
      const nextState = result?.gameState || result?.state || null;
      if (nextState && game?.state && typeof game.state === 'object' && !game.applyState && !game.applyApiState) {
        game.state = {
          ...nextState,
          currentTab: game.state.currentTab || nextState.currentTab,
        };
      }
      const nextTutorial = result?.tutorial || game?.tutorial || game?.state?.tutorial || null;
      if (nextTutorial) game?.tutorialController?.sync?.(nextTutorial);
      this.host.activeEventId = null;
      if (game && game !== this.host && 'activeEventId' in game) game.activeEventId = null;
      if (game?.canvasShell && game.canvasShell !== this.host) game.canvasShell.activeEventId = null;
      this.getEventController()?.close?.();
      if (result?.rewardReveal) {
        if (!this.host.showRewardReveal?.(result.rewardReveal)) this.host.rewardReveal = result.rewardReveal;
      }
      if (typeof this.host.hideGuideHighlight === 'function') this.host.hideGuideHighlight();
      else this.host.hideTutorialHighlight?.();
      game?.tutorialController?.refreshCurrentHighlight?.();
      return true;
    }

    handle_claimGuideTaskReward(action) {
      return false;
    }

    handle_claimTaskReward(action) {
      this.host.showTaskCenter = false;
      const forwarded = this.forward(action);
      if (forwarded !== undefined) {
        if (forwarded !== false) this.afterHandled(action);
        return forwarded !== false;
      }
      const game = this.getGameHost();
      if (typeof game?.claimTaskReward === 'function') {
        return this.finalize(game.claimTaskReward(action.taskId, action.category));
      }
      return this.finalize(this.claimTaskRewardDirect(action, false));
    }

    async claimTaskRewardDirect(action, legacyGuideTask) {
      this.host.showTaskCenter = false;
      const result = await this.runAction(() => {
        const claim = this.host.api.claimTaskReward;
        if (typeof claim !== 'function') return { success: false };
        return claim.call(this.host.api, action.taskId, action.category || 'main');
      });
      this.host.rewardReveal = result?.rewardReveal || null;
      return true;
    }

    handle_scoutTerritory(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleScoutAction) {
        territory.handleScoutAction({ direction: action.direction || action.value });
        return true;
      }
      return this.finalize(this.runAction(() => this.host.api.scoutTerritory(action.value || action.direction)));
    }

    handle_claimScout(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleScoutAction) {
        territory.handleScoutAction({ missionId: action.missionId || action.value });
        return true;
      }
      return this.finalize(this.runAction(() => this.host.api.claimScout(action.value || action.missionId)));
    }

    handle_startExplore(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.startExplore === 'function') {
        return this.finalize(game.startExplore({
          mode: action.mode || 'random',
          routeLength: action.routeLength,
          targetQ: action.targetQ,
          targetR: action.targetR,
          formationSlot: action.formationSlot || action.slot || 1,
          cityId: action.cityId || game?.state?.activeCityId || 'capital',
        }));
      }
      return this.finalize(this.runAction(() => this.host.api.startExplore({
        mode: action.mode || 'random',
        routeLength: action.routeLength,
        targetQ: action.targetQ,
        targetR: action.targetR,
        formationSlot: action.formationSlot || action.slot || 1,
        cityId: action.cityId || game?.state?.activeCityId || 'capital',
      })));
    }

    handle_selectWorldMarchTarget(action) {
      const q = Math.floor(Number(action.targetQ ?? action.q));
      const r = Math.floor(Number(action.targetR ?? action.r));
      if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
      const game = this.getGameHost();
      game?.territoryController?.closeSiteDialog?.({ render: false });
      const uiState = this.getSharedTerritoryUiState();
      const nextTarget = {
        q,
        r,
        tileId: action.tileId || `tile_${q}_${r}`,
        pickerOpen: false,
      };
      if (action.known !== undefined) nextTarget.known = Boolean(action.known);
      if (action.terrain) nextTarget.terrain = action.terrain;
      if (action.terrainLabel) nextTarget.terrainLabel = action.terrainLabel;
      uiState.worldMarchTarget = nextTarget;
      uiState.selectedWorldActorId = '';
      uiState.selectedSiteId = '';
      uiState.expeditionConfigSiteId = '';
      const tutorialResult = game?.tutorialController?.onWorldMarchTargetSelected?.(action) || true;
      return this.finalize(Promise.resolve(tutorialResult).then((allowed) => {
        if (allowed !== false) {
          this.refreshWorldMarchLayer(action);
          game?.tutorialController?.refreshCurrentHighlight?.();
          const scheduler = this.host?.runtime || game?.runtime || global;
          scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
        }
        return allowed !== false;
      }));
    }

    handle_openWorldMarchFormationPicker(action) {
      const q = Math.floor(Number(action.targetQ ?? action.q));
      const r = Math.floor(Number(action.targetR ?? action.r));
      if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
      const uiState = this.getSharedTerritoryUiState();
      const previousTarget = uiState.worldMarchTarget || {};
      const nextTarget = {
        q,
        r,
        tileId: action.tileId || `tile_${q}_${r}`,
        pickerOpen: true,
      };
      if (action.known !== undefined) nextTarget.known = Boolean(action.known);
      else if (previousTarget.known !== undefined) nextTarget.known = Boolean(previousTarget.known);
      if (action.terrain || previousTarget.terrain) nextTarget.terrain = action.terrain || previousTarget.terrain;
      if (action.terrainLabel || previousTarget.terrainLabel) nextTarget.terrainLabel = action.terrainLabel || previousTarget.terrainLabel;
      uiState.worldMarchTarget = nextTarget;
      uiState.selectedWorldActorId = '';
      return this.refreshWorldMarchLayer(action);
    }

    handle_closeWorldMarchHud(action) {
      const uiState = this.getSharedTerritoryUiState();
      uiState.worldMarchTarget = null;
      uiState.selectedWorldActorId = '';
      return this.refreshWorldMarchLayer(action);
    }

    handle_selectWorldActor(action) {
      const actorId = action.actorId || action.missionId || '';
      if (!actorId) return false;
      const uiState = this.getSharedTerritoryUiState();
      uiState.selectedWorldActorId = actorId;
      uiState.worldMarchTarget = null;
      uiState.selectedSiteId = '';
      return this.refreshWorldMarchLayer(action);
    }

    handle_startWorldMarch(action) {
      const q = Math.floor(Number(action.targetQ ?? action.q));
      const r = Math.floor(Number(action.targetR ?? action.r));
      if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
      const run = () => {
        const game = this.getGameHost();
        const options = {
          mode: 'manual',
          targetQ: q,
          targetR: r,
          formationSlot: action.formationSlot || action.slot || 1,
          cityId: action.cityId || game?.state?.activeCityId || 'capital',
        };
        if (typeof game?.startWorldMarch === 'function') return game.startWorldMarch(options);
        if (typeof game?.startExplore === 'function') return game.startExplore(options);
        return this.runAction(() => this.host.api.startExplore(options));
      };
      return this.finalize(Promise.resolve(run()).then((result) => {
        if (result !== false) {
          const uiState = this.getSharedTerritoryUiState();
          uiState.worldMarchTarget = null;
          uiState.selectedWorldActorId = '';
          this.refreshWorldMarchLayer(action);
        }
        return result !== false;
      }));
    }

    handle_returnWorldMarch(action) {
      const missionId = action.missionId || action.actorId || '';
      if (!missionId) return false;
      const game = this.getGameHost();
      const run = () => {
        if (typeof game?.returnWorldMarch === 'function') return game.returnWorldMarch(missionId);
        return this.runAction(() => this.host.api.returnWorldMarch(missionId));
      };
      return this.finalize(Promise.resolve(run()).then((result) => {
        if (result !== false) {
          this.getSharedTerritoryUiState().selectedWorldActorId = '';
          this.refreshWorldMarchLayer(action);
        }
        return result !== false;
      }));
    }

    handle_stopWorldMarch(action) {
      const missionId = action.missionId || action.actorId || '';
      if (!missionId) return false;
      const targetQ = Number(action.targetQ ?? action.q);
      const targetR = Number(action.targetR ?? action.r);
      const game = this.getGameHost();
      const run = () => {
        if (typeof game?.stopWorldMarch === 'function') return game.stopWorldMarch(missionId, { targetQ, targetR });
        return this.runAction(() => this.host.api.stopWorldMarch(missionId, { targetQ, targetR }));
      };
      return this.finalize(Promise.resolve(run()).then((result) => {
        if (result !== false) {
          this.getSharedTerritoryUiState().selectedWorldActorId = '';
          this.refreshWorldMarchLayer(action);
        }
        return result !== false;
      }));
    }

    handle_claimExplore(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.claimExplore === 'function') return this.finalize(game.claimExplore(action.missionId || action.value));
      return this.finalize(this.runAction(() => this.host.api.claimExplore(action.missionId || action.value)));
    }

    handle_switchMilitaryView(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.switchMilitaryView === 'function') {
        const switched = game.switchMilitaryView(action.view) !== false;
        if (switched) {
          this.host.activeCommandPanel = '';
          if (game && game !== this.host && 'activeCommandPanel' in game) game.activeCommandPanel = '';
          if (game?.canvasShell && game.canvasShell !== this.host) game.canvasShell.activeCommandPanel = '';
          const result = game?.tutorialController?.onMilitaryViewSwitched?.(action.view || 'army');
          this.afterHandled(action);
          game?.tutorialController?.refreshCurrentHighlight?.();
          const scheduler = this.host?.runtime || game?.runtime || global;
          scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
          if (result?.catch) result.catch((error) => this.log?.(error));
        }
        return switched;
      }
      const view = action.view || 'army';
      this.host.activeCommandPanel = '';
      this.host.militaryView = view;
      if (this.host.state) this.host.state = { ...this.host.state, militaryView: view };
      game?.tutorialController?.onMilitaryViewSwitched?.(view);
      return this.afterHandled(action);
    }

    handle_scrollBuildings(action) {
      if (typeof this.host?.scrollBuildings === 'function') {
        this.host.scrollBuildings(action);
      } else {
        this.host.buildingOffset = Math.max(0, (Number(this.host.buildingOffset) || 0) + (Number(action.delta) || 0));
      }
      return this.afterHandled(action);
    }

    handle_changeFamousPersonsPage(action) {
      if (typeof this.host?.changeFamousPersonsPage === 'function') {
        return this.host.changeFamousPersonsPage(action) !== false;
      } else {
        this.host.famousPersonsPage = Math.max(0, (Number(this.host.famousPersonsPage) || 0) + (Number(action.delta) || 0));
        this.host.selectedFamousPersonId = '';
        this.host.renderer?.clearFamousSkillTooltip?.();
        this.afterHandled(action);
      }
      return true;
    }

    handle_selectBuildingCategory(action) {
      if (typeof this.host?.selectBuildingCategory === 'function') {
        this.host.selectBuildingCategory(action);
      } else {
        this.host.activeBuildingCategory = action.category || 'all';
        this.host.buildingOffset = 0;
        this.host.buildingTransition = null;
      }
      return this.afterHandled(action);
    }

    handle_openWorldSite(action) {
      const forwarded = this.forward(action);
      const siteId = action.siteId || action.territoryId || action.cityId || '';
      if (forwarded !== undefined) {
        if (forwarded !== false) {
          this.openWorldSiteLocally(siteId);
          this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
        }
        return forwarded !== false;
      }
      const territory = this.getTerritoryController();
      if (territory?.openSiteDialog) {
        territory.openSiteDialog(siteId);
        this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
        return true;
      }
      this.host.territoryUiState = this.host.territoryUiState || {};
      this.host.territoryUiState.selectedSiteId = siteId;
      const handled = this.afterHandled(action);
      this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
      return handled;
    }

    handle_closeWorldSite(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.closeSiteDialog) {
        territory.closeSiteDialog();
        return true;
      }
      this.host.territoryUiState = this.host.territoryUiState || {};
      this.host.territoryUiState.selectedSiteId = '';
      this.host.territoryUiState.expeditionConfigSiteId = '';
      this.host.territoryUiState.expeditionSoldiers = '';
      return this.afterHandled(action);
    }

    handle_resetWorldPan(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.resetWorldPan) {
        territory.resetWorldPan();
        return true;
      }
      this.host.territoryUiState = this.host.territoryUiState || {};
      this.host.territoryUiState.worldPanX = 0;
      this.host.territoryUiState.worldPanY = 0;
      return this.afterHandled(action);
    }

    handle_worldRadarDrag(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      return this.handle_worldMapDrag({ ...action, type: 'worldMapDrag' });
    }

    handle_worldMapDrag(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      const pointer = action.pointer || {};
      if (territory) {
        if (action.phase === 'start') {
          territory.closeSiteDialog?.({ render: false });
          territory.startWorldDrag?.(pointer);
        }
        if (action.phase === 'move') territory.moveWorldDrag?.(pointer);
        if (action.phase === 'end') territory.endWorldDrag?.(pointer);
      } else {
        this.host.territoryUiState = this.host.territoryUiState || {};
        const x = Number(pointer.x) || 0;
        const y = Number(pointer.y) || 0;
        if (action.phase === 'start') {
          this.host.territoryUiState.selectedSiteId = '';
          this.host.territoryUiState.expeditionConfigSiteId = '';
          this.host.territoryUiState.expeditionSoldiers = '';
          this.host.territoryUiState.expeditionTroopType = '';
          this.host.territoryUiState.expeditionLeader = '';
          this.worldDragStart = {
            x,
            y,
            panX: Number(this.host.territoryUiState.worldPanX) || 0,
            panY: Number(this.host.territoryUiState.worldPanY) || 0,
          };
        }
        if (action.phase === 'move') {
          const dx = Number(pointer.dx ?? pointer.deltaX);
          const dy = Number(pointer.dy ?? pointer.deltaY);
          if (Number.isFinite(dx) && Number.isFinite(dy)) {
            this.host.territoryUiState.worldPanX = (Number(this.host.territoryUiState.worldPanX) || 0) + dx;
            this.host.territoryUiState.worldPanY = (Number(this.host.territoryUiState.worldPanY) || 0) + dy;
          } else if (this.worldDragStart) {
            this.host.territoryUiState.worldPanX = this.worldDragStart.panX + x - this.worldDragStart.x;
            this.host.territoryUiState.worldPanY = this.worldDragStart.panY + y - this.worldDragStart.y;
          }
        }
        if (action.phase === 'end' || action.phase === 'cancel') this.worldDragStart = null;
      }
      this.renderDragFrame(action);
      return true;
    }

    handle_techTreeDrag(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      if (!this.techTreeInteraction?.handleDrag?.(action)) return false;
      this.render(action);
      return true;
    }

    handle_techTreeZoom(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      if (!this.techTreeInteraction?.handleZoom?.(action)) return false;
      this.render(action);
      return true;
    }

    handle_changeExpeditionSoldiers(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleDraftInput) {
        territory.handleDraftInput({ field: 'soldiers', value: action.value });
        return true;
      }
      this.host.territoryUiState = this.host.territoryUiState || {};
      this.host.territoryUiState.expeditionConfigSiteId = action.siteId || this.host.territoryUiState.expeditionConfigSiteId;
      this.host.territoryUiState.expeditionSoldiers = String(Math.max(1, Math.floor(Number(action.value) || 1)));
      return this.afterHandled(action);
    }

    handle_changeExpeditionLeader(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleDraftInput) {
        territory.handleDraftInput({ field: 'leader', value: action.value || action.leaderId });
        return true;
      }
      this.host.territoryUiState = this.host.territoryUiState || {};
      this.host.territoryUiState.expeditionConfigSiteId = action.siteId || this.host.territoryUiState.expeditionConfigSiteId;
      this.host.territoryUiState.expeditionLeader = action.value || action.leaderId || 'unavailable';
      return this.afterHandled(action);
    }

    handle_territoryAction(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (!territory?.handleAction) return false;
      territory.handleAction({ territoryId: action.territoryId, action: action.action });
      return true;
    }

    handle_openExpedition(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleAction) {
        territory.handleAction({ territoryId: action.territoryId, action: 'open-expedition' });
        return true;
      }
      const site = (this.host.state?.territoryState?.territories || []).find((item) => item.id === action.territoryId);
      this.host.territoryUiState.expeditionConfigSiteId = action.territoryId || '';
      this.host.territoryUiState.expeditionSoldiers = String(Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1));
      return this.afterHandled(action);
    }

    handle_closeExpedition(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleAction) {
        territory.handleAction({ territoryId: action.territoryId, action: 'close-expedition' });
        return true;
      }
      this.host.territoryUiState.expeditionConfigSiteId = '';
      this.host.territoryUiState.expeditionSoldiers = '';
      return this.afterHandled(action);
    }

    handle_conquer(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleAction) {
        territory.handleAction({ territoryId: action.territoryId, action: 'conquer' });
        return true;
      }
      return this.finalize(this.runAction(() => this.host.api.startConquest(action.territoryId, { soldiers: 100 })));
    }

    handle_launchExpedition(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleAction) {
        territory.handleAction({ territoryId: action.territoryId, action: 'launch-expedition' });
        return true;
      }
      return this.finalize(this.runAction(() => this.host.api.startConquest(action.territoryId, {
        troopType: this.host.territoryUiState.expeditionTroopType || 'unavailable',
        leader: this.host.territoryUiState.expeditionLeader || 'unavailable',
        soldiers: this.host.getExpeditionSoldiers?.(),
      })));
    }

    handle_claimConquest(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleAction) {
        territory.handleAction({ territoryId: action.territoryId, action: 'claim' });
        return true;
      }
      return this.finalize(this.runAction(() => this.host.api.claimConquest(action.territoryId)));
    }

    handle_enterBattleScene(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleAction) {
        territory.handleAction({ territoryId: action.territoryId, action: 'enter-battle' });
        return true;
      }
      const game = this.getGameHost();
      const api = game?.getGameApi?.() || game?.api || this.host?.api;
      if (!api?.claimConquest) return false;
      const run = async () => {
        const result = await this.runAction(() => api.claimConquest(action.territoryId));
        if (result?.battleReport && typeof game?.startBattleScene === 'function') {
          game.startBattleScene(result.battleReport);
        } else if (result?.battleReport && typeof this.host?.startBattleScene === 'function') {
          this.host.startBattleScene(result.battleReport);
        }
        return true;
      };
      return this.finalize(run());
    }

    handle_closeBattleScene(action) {
      const game = this.getGameHost();
      const closed = typeof game?.closeBattleScene === 'function'
        ? game.closeBattleScene()
        : this.host?.closeBattleScene?.();
      return closed !== false;
    }

    handle_skipBattleScene(action) {
      const game = this.getGameHost();
      const skipped = typeof game?.skipBattleScene === 'function'
        ? game.skipBattleScene()
        : this.host?.skipBattleScene?.();
      return skipped !== false;
    }

    handle_manageCity(action) {
      return this.handle_enterCity({
        ...action,
        type: 'enterCity',
        cityId: action.cityId || action.territoryId,
        tab: action.tab || 'buildings',
      });
    }

    handle_renameCity(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleAction) {
        territory.handleAction({ territoryId: action.territoryId, action: 'rename-city' });
        return true;
      }
      const site = (this.host.state?.territoryState?.territories || []).find((item) => item.id === action.territoryId) || {};
      this.host.openNaming?.({
        type: 'city',
        territoryId: action.territoryId,
        title: 'Rename city',
        message: site.cityName || site.naturalName || '',
      });
      return true;
    }
  }

  global.CanvasActionController = CanvasActionController;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionController;
})(typeof globalThis !== 'undefined' ? globalThis : window);
