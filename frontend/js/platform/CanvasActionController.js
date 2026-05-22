(function (global) {
  const CLOSEABLE_PANELS = [
    'showSettings',
    'showLogs',
    'showResourceDetails',
    'showCitySwitcher',
    'showAdvisor',
    'showTaskCenter',
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
        if (!keep.has(key) && key in this.host) this.host[key] = false;
      });
      if (!keep.has('activeEventId') && 'activeEventId' in this.host) this.host.activeEventId = null;
    }

    render(action = {}) {
      if (typeof this.host?.renderCanvasAction === 'function') return this.host.renderCanvasAction(action);
      if (typeof this.host?.renderGuideFrame === 'function') return this.host.renderGuideFrame();
      if (typeof this.host?.render === 'function') return this.host.render();
      return false;
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

    forward(action, meta = {}) {
      if (typeof this.host?.forwardCanvasAction !== 'function') return undefined;
      return this.host.forwardCanvasAction(action, meta);
    }

    async runAction(callback) {
      if (typeof callback !== 'function') return null;
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
      this.host?.resetForCanvasTabSwitch?.(action);
      const game = this.getGameHost();
      let result;
      if (typeof game?.handleCanvasTabSelection === 'function') {
        result = game.handleCanvasTabSelection(action.tab);
      } else {
        const forwarded = this.forward(action, meta);
        if (forwarded !== undefined) result = forwarded;
        else if (game && game !== this.host && typeof game.switchTab === 'function') result = game.switchTab(action.tab);
        else if (typeof this.host?.switchTab === 'function') result = this.host.switchTab(action.tab);
        else result = false;
      }
      return this.finalize(Promise.resolve(result).then((allowed) => {
        if (allowed !== false) this.afterHandled(action);
        return allowed !== false;
      }));
    }

    handle_openResourceDetails(action) {
      this.host.showResourceDetails = true;
      this.closePanels(['showResourceDetails']);
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
      const view = this.getPresenter()?.buildAdvisorViewState?.(this.getState()?.softGuide);
      if (view?.hidden || !view?.activeAdvisor) return false;
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
        controller.claimActive?.(action.optionId);
        return true;
      }
      await this.runAction(() => this.host.api.claimEvent(action.eventId, action.optionId));
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
      this.host.buildingOffset = Math.max(0, (Number(this.host.buildingOffset) || 0) + (Number(action.delta) || 0));
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
      return this.finalize(this.runAction(() => this.host.api.startConquest(action.territoryId, { soldiers: 1 })));
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
