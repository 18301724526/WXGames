(function (global) {
  const CLOSEABLE_PANELS = [
    'showSettings',
    'showLogs',
    'showResourceDetails',
    'showCitySwitcher',
    'showSubcityList',
    'showAdvisor',
    'showTaskCenter',
    'showTalentPolicy',
    'showGuidebook',
    'showFamousPersons',
    'techDetailOpen',
    'activeCommandPanel',
  ];

  class CanvasActionController {
    constructor(options = {}) {
      this.host = options.host || null;
      this.awaitAsync = Boolean(options.awaitAsync);
      this.log = typeof options.log === 'function' ? options.log : null;
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
      if (action.type === 'openTaskCenter') this.host?.refreshTaskCenterGuideHighlight?.(action);
      if (action.type === 'openEvent' || action.type === 'closeEvent') {
        this.getGameHost()?.tutorialController?.render?.();
      }
      return true;
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
          this.afterHandled(action);
        }
        return value !== false;
      };
      if (!result || typeof result.then !== 'function') return closeAfterSuccess(result);
      if (this.awaitAsync) return result.then(closeAfterSuccess);
      result.then(closeAfterSuccess).catch((error) => this.log?.(error));
      return true;
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
          const nextTab = resolvedTab && resolvedTab !== previousTab ? resolvedTab : (action.tab || resolvedTab || 'resources');
          if (hostCanAnimate) this.host?.startPageTransition?.(previousTab, nextTab, { fromBuildingOffset: previousBuildingOffset });
          this.afterHandled(action);
          const guide = (this.host?.getGuideState?.() || this.getState())?.softGuide;
          if (guide?.mode === 'strong' && guide.target) this.host?.refreshCurrentGuideHighlight?.();
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
      return this.afterHandled(action);
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
      if (closed) this.afterHandled(action);
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
      return this.afterHandled(action);
    }

    handle_goToAdvisorTarget(action, meta = {}) {
      this.host.showAdvisor = false;
      this.host.activeEventId = null;
      const game = this.getGameHost();
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
      this.closePanels(['activeEventId']);
      this.getEventController()?.open?.(action.eventId);
      return this.afterHandled(action);
    }

    handle_closeEvent(action) {
      this.host.activeEventId = null;
      this.getEventController()?.close?.();
      return this.afterHandled(action);
    }

    handle_goToGuideTaskTarget(action) {
      const moved = this.host?.goToGuideTaskTarget?.(action);
      if (moved !== false) this.afterHandled(action);
      return moved !== false;
    }

    handle_openTaskCenter(action) {
      this.host.showTaskCenter = true;
      this.host.activeTaskCenterTab = action.tab
        || (this.host?.hasClaimableMainTask?.() ? 'main' : this.host.activeTaskCenterTab)
        || 'main';
      this.closePanels(['showTaskCenter']);
      return this.afterHandled(action);
    }

    handle_closeTaskCenter(action) {
      this.host.showTaskCenter = false;
      return this.afterHandled(action);
    }

    handle_switchTaskCenterTab(action) {
      this.host.activeTaskCenterTab = action.tab || 'main';
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
      return this.afterHandled(action);
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
      return this.afterHandled(action);
    }

    handle_openFamousPersonDetail(action) {
      this.host.selectedFamousPersonId = action.personId || '';
      const game = this.getGameHost();
      if (game && game !== this.host && 'selectedFamousPersonId' in game) game.selectedFamousPersonId = action.personId || '';
      this.host.renderer?.clearFamousSkillTooltip?.();
      return this.afterHandled(action);
    }

    handle_closeFamousPersonDetail(action) {
      this.host.selectedFamousPersonId = '';
      const game = this.getGameHost();
      if (game && game !== this.host && 'selectedFamousPersonId' in game) game.selectedFamousPersonId = '';
      this.host.renderer?.clearFamousSkillTooltip?.();
      return this.afterHandled(action);
    }

    handle_seekFamousPerson(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.seekFamousPerson === 'function') {
        return this.finalize(game.seekFamousPerson(action.source || 'seek'));
      }
      return this.finalize(this.runAction(() => this.host.api.seekFamousPerson(action.source || 'seek')));
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
      this.host.showTalentPolicy = true;
      this.closePanels(['showTalentPolicy']);
      return this.afterHandled(action);
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
        this.render({ ...action, tab: 'resources' });
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
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      const result = typeof game?.submitNaming === 'function'
        ? game.submitNaming(name)
        : this.host?.submitNaming?.();
      return this.finalize(result);
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
        game.switchCity(action.cityId);
        return true;
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
      const x = -((q - r) * stepX * scale);
      const y = -((q + r) * stepY * scale);
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
        return this.finalize(game.assignJob(action.job, action.delta));
      }
      return this.finalize(this.runAction(() => this.host.api.assignJob(action.job, action.delta)));
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
      if (typeof game?.[method] === 'function') {
        return game[method](action.buildingId);
      }
      const controller = this.getBuildingController();
      if (controller?.handleAction) {
        await controller.handleAction({ buildingId: action.buildingId, action: buildingAction });
        return true;
      }
      await this.runAction(() => (
        buildingAction === 'upgrade'
          ? this.host.api.upgrade(action.buildingId)
          : this.host.api.build(action.buildingId)
      ));
      return true;
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
        if (forwarded !== false) this.afterHandled(action);
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
      if (result?.tutorial) game?.tutorialController?.notifySpecialEventClaimed?.(result.tutorial);
      if (result?.rewardReveal) this.host.rewardReveal = result.rewardReveal;
      if (!this.host.refreshCurrentGuideHighlight?.()) {
        const softGuide = (this.host?.getGuideState?.() || this.getState())?.softGuide || null;
        if (softGuide?.mode === 'strong' && softGuide.target) this.host.renderSoftGuide?.();
        else if (typeof this.host.hideGuideHighlight === 'function') this.host.hideGuideHighlight();
        else this.host.hideTutorialHighlight?.();
      }
      return true;
    }

    handle_claimGuideTaskReward(action) {
      this.host.showTaskCenter = false;
      const forwarded = this.forward(action);
      if (forwarded !== undefined) {
        if (forwarded !== false) this.afterHandled(action);
        return forwarded !== false;
      }
      const game = this.getGameHost();
      if (typeof game?.claimGuideTaskReward === 'function') {
        return this.finalize(game.claimGuideTaskReward(action.taskId));
      }
      return this.finalize(this.claimTaskRewardDirect(action, true));
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
        if (legacyGuideTask && this.host.api.claimGuideTaskReward) return this.host.api.claimGuideTaskReward(action.taskId);
        const claim = this.host.api.claimTaskReward || ((taskId) => this.host.api.claimGuideTaskReward(taskId));
        return claim.call(this.host.api, action.taskId, action.category || 'main');
      });
      this.host.rewardReveal = result?.rewardReveal || null;
      this.host.refreshCurrentGuideHighlight?.();
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

    handle_switchMilitaryView(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const game = this.getGameHost();
      if (typeof game?.switchMilitaryView === 'function') {
        return game.switchMilitaryView(action.view) !== false;
      }
      const view = action.view || 'army';
      this.host.militaryView = view;
      if (this.host.state) this.host.state = { ...this.host.state, militaryView: view };
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
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.openSiteDialog) {
        territory.openSiteDialog(action.siteId);
        return true;
      }
      this.host.territoryUiState = this.host.territoryUiState || {};
      this.host.territoryUiState.selectedSiteId = action.siteId || '';
      return this.afterHandled(action);
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
        if (action.phase === 'start') territory.startWorldDrag?.(pointer);
        if (action.phase === 'move') territory.moveWorldDrag?.(pointer);
        if (action.phase === 'end') territory.endWorldDrag?.(pointer);
      } else {
        this.host.territoryUiState = this.host.territoryUiState || {};
        const x = Number(pointer.x) || 0;
        const y = Number(pointer.y) || 0;
        if (action.phase === 'start') {
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
      const pointer = action.pointer || {};
      const x = Number(pointer.x) || 0;
      const y = Number(pointer.y) || 0;
      const clampPan = (xValue, yValue) => {
        const requestedX = Number(xValue) || 0;
        const requestedY = Number(yValue) || 0;
        const renderer = this.host?.renderer;
        const presenter = renderer?.presenter || this.host?.presenter;
        if (
          !renderer
          || !presenter
          || typeof renderer.getTechTreeLayout !== 'function'
          || typeof presenter.buildTechViewState !== 'function'
        ) return { x: requestedX, y: requestedY };
        const state = this.getState();
        const view = presenter.buildTechViewState(state);
        const renderLayout = typeof renderer.getLayout === 'function'
          ? renderer.getLayout()
          : { contentX: 12, contentWidth: Math.max(300, Number(renderer.width) || 390) - 24 };
        const cachedPanel = renderer.lastTechTreeScroll?.panel;
        const treePanel = cachedPanel || {
          x: renderLayout.contentX + 24,
          y: 352,
          width: renderLayout.contentWidth - 48,
          height: Math.max(128, (Number(renderer.height) || 844) - 438),
        };
        const layoutInfo = renderer.getTechTreeLayout(view, treePanel, {
          techTreePanX: requestedX,
          techTreePanY: requestedY,
          techTreeZoom: this.host?.getTechTreeZoom?.() || Number(this.host?.techTreeZoom) || 1,
        });
        return {
          x: Math.max(
            Number(layoutInfo.minPanX) || 0,
            Math.min(requestedX, Number(layoutInfo.maxPanX) || 0),
          ),
          y: Math.max(
            Number(layoutInfo.minPanY) || 0,
            Math.min(requestedY, Number(layoutInfo.maxPanY) || 0),
          ),
        };
      };
      if (action.phase === 'start') {
        const currentPan = this.host?.getTechTreePan?.() || {
          x: Number(this.host?.techTreePanX) || 0,
          y: Number(this.host?.techTreePanY) || 0,
        };
        const pan = clampPan(currentPan.x, currentPan.y);
        this.techTreeDragStart = {
          x,
          y,
          panX: pan.x,
          panY: pan.y,
        };
        if (this.host?.setTechTreePan) this.host.setTechTreePan(pan);
        else if (this.host) {
          this.host.techTreePanX = pan.x;
          this.host.techTreePanY = pan.y;
        }
      } else if (action.phase === 'move') {
        if (!this.host) return false;
        const currentPan = this.host.getTechTreePan?.() || {
          x: Number(this.host.techTreePanX) || 0,
          y: Number(this.host.techTreePanY) || 0,
        };
        const nextPanX = this.techTreeDragStart
          ? this.techTreeDragStart.panX + x - this.techTreeDragStart.x
          : currentPan.x;
        const nextPanY = this.techTreeDragStart
          ? this.techTreeDragStart.panY + y - this.techTreeDragStart.y
          : currentPan.y;
        const pan = clampPan(nextPanX, nextPanY);
        if (this.host.setTechTreePan) this.host.setTechTreePan(pan);
        else {
          this.host.techTreePanX = pan.x;
          this.host.techTreePanY = pan.y;
        }
      } else if (action.phase === 'end' || action.phase === 'cancel') {
        this.techTreeDragStart = null;
        if (this.host) this.host.techTreeDragStart = null;
      }
      this.render(action);
      return true;
    }

    getTechTreePanel(renderer) {
      const renderLayout = typeof renderer?.getLayout === 'function'
        ? renderer.getLayout()
        : { contentX: 12, contentWidth: Math.max(300, Number(renderer?.width) || 390) - 24 };
      return renderer?.lastTechTreeScroll?.panel || {
        x: renderLayout.contentX + 24,
        y: 352,
        width: renderLayout.contentWidth - 48,
        height: Math.max(128, (Number(renderer?.height) || 844) - 438),
      };
    }

    getTechTreeView(renderer) {
      const presenter = renderer?.presenter || this.host?.presenter;
      if (!presenter || typeof presenter.buildTechViewState !== 'function') return null;
      return presenter.buildTechViewState(this.getState());
    }

    handle_techTreeZoom(action) {
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const renderer = this.host?.renderer;
      if (!renderer || typeof renderer.getTechTreeLayout !== 'function') return false;
      const view = this.getTechTreeView(renderer);
      if (!view) return false;
      const gesture = action.gesture || {};
      const rawDelta = Number(gesture.scaleDelta);
      if (!Number.isFinite(rawDelta) || rawDelta <= 0) return false;
      const panel = this.getTechTreePanel(renderer);
      const centerX = Number.isFinite(Number(gesture.centerX ?? gesture.x))
        ? Number(gesture.centerX ?? gesture.x)
        : panel.x + panel.width / 2;
      const centerY = Number.isFinite(Number(gesture.centerY ?? gesture.y))
        ? Number(gesture.centerY ?? gesture.y)
        : panel.y + panel.height / 2;
      const currentPan = this.host?.getTechTreePan?.() || {
        x: Number(this.host?.techTreePanX) || 0,
        y: Number(this.host?.techTreePanY) || 0,
      };
      const currentZoom = this.host?.getTechTreeZoom?.() || Number(this.host?.techTreeZoom) || 1;
      const oldZoom = Math.max(0.65, Math.min(1.6, currentZoom));
      const scaleDelta = Math.max(0.82, Math.min(1.22, rawDelta));
      const nextZoom = Math.max(0.65, Math.min(1.6, oldZoom * scaleDelta));
      if (Math.abs(nextZoom - oldZoom) < 0.001) return false;
      const contentX = (centerX - panel.x - currentPan.x) / oldZoom;
      const contentY = (centerY - panel.y - currentPan.y) / oldZoom;
      const requestedPan = {
        x: centerX - panel.x - contentX * nextZoom,
        y: centerY - panel.y - contentY * nextZoom,
      };
      const layoutInfo = renderer.getTechTreeLayout(view, panel, {
        techTreePanX: requestedPan.x,
        techTreePanY: requestedPan.y,
        techTreeZoom: nextZoom,
      });
      const pan = {
        x: Math.max(
          Number(layoutInfo.minPanX) || 0,
          Math.min(requestedPan.x, Number(layoutInfo.maxPanX) || 0),
        ),
        y: Math.max(
          Number(layoutInfo.minPanY) || 0,
          Math.min(requestedPan.y, Number(layoutInfo.maxPanY) || 0),
        ),
      };
      if (this.host?.setTechTreeZoom) this.host.setTechTreeZoom(nextZoom);
      else if (this.host) this.host.techTreeZoom = nextZoom;
      if (this.host?.setTechTreePan) this.host.setTechTreePan(pan);
      else if (this.host) {
        this.host.techTreePanX = pan.x;
        this.host.techTreePanY = pan.y;
      }
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
      const forwarded = this.forward(action);
      if (forwarded !== undefined) return forwarded !== false;
      const territory = this.getTerritoryController();
      if (territory?.handleAction) {
        territory.handleAction({ territoryId: action.territoryId, action: 'manage-city' });
        return true;
      }
      return this.handle_selectCity({ ...action, cityId: action.territoryId });
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
