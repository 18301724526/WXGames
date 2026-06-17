(function (global) {
  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
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
      },

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
      },

      handle_openResourceDetails(action) {
        this.host.showResourceDetails = true;
        this.closePanels(['showResourceDetails']);
        return this.afterHandled(action);
      },

      handle_closeResourceDetails(action) {
        this.host.showResourceDetails = false;
        return this.afterHandled(action);
      },

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
      },

      handle_closeCommandPanel(action) {
        this.host.activeCommandPanel = '';
        return this.afterHandled(action);
      },

      handle_closeRewardReveal(action) {
        const closed = typeof this.host?.closeRewardReveal === 'function'
          ? this.host.closeRewardReveal()
          : (this.host.rewardReveal = null, true);
        if (closed) {
          this.afterHandled(action);
          this.getGameHost()?.tutorialController?.refreshCurrentHighlight?.();
        }
        return closed !== false;
      },

      handle_openCitySwitcher(action) {
        this.host.showCitySwitcher = !this.host.showCitySwitcher;
        this.closePanels(['showCitySwitcher']);
        return this.afterHandled(action);
      },

      handle_closeCitySwitcher(action) {
        this.host.showCitySwitcher = false;
        return this.afterHandled(action);
      },

      handle_openSubcityList(action) {
        this.host.showSubcityList = !this.host.showSubcityList;
        this.closePanels(this.host.showSubcityList ? ['showSubcityList'] : []);
        return this.afterHandled(action);
      },

      handle_closeSubcityList(action) {
        this.host.showSubcityList = false;
        return this.afterHandled(action);
      },

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
      },

      handle_closeArmyFormationEditor(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (typeof target?.closeArmyFormationEditor === 'function') {
          return target.closeArmyFormationEditor(action) !== false;
        }
        if (this.host && typeof this.host === 'object') this.host.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };
        return this.afterHandled(action);
      },

      handle_toggleArmyFormationMember(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (typeof target?.toggleArmyFormationMember === 'function') {
          return target.toggleArmyFormationMember(action) !== false;
        }
        return false;
      },

      handle_changeArmyFormationPage(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (typeof target?.changeArmyFormationPage === 'function') {
          return target.changeArmyFormationPage(action) !== false;
        }
        return false;
      },

      handle_changeArmyFormationSoldiers(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (typeof target?.changeArmyFormationSoldiers === 'function') {
          return target.changeArmyFormationSoldiers(action) !== false;
        }
        return false;
      },

      handle_requestArmyFormationSoldierInput(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (typeof target?.requestArmyFormationSoldierInput === 'function') {
          return this.finalize(target.requestArmyFormationSoldierInput(action));
        }
        return false;
      },

      handle_autoReplenishArmyFormation(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (typeof target?.autoReplenishArmyFormation === 'function') {
          return target.autoReplenishArmyFormation(action) !== false;
        }
        return false;
      },

      handle_confirmArmyFormationSoldiers(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (typeof target?.confirmArmyFormationSoldiers === 'function') {
          return target.confirmArmyFormationSoldiers(action) !== false;
        }
        return false;
      },

      handle_saveArmyFormation(action) {
        const game = this.getGameHost();
        const target = game && game !== this.host ? game : this.host;
        if (typeof target?.saveArmyFormation === 'function') {
          return this.finalize(target.saveArmyFormation(action));
        }
        return false;
      },

      handle_openSettings(action) {
        this.host.showSettings = true;
        this.closePanels(['showSettings']);
        return this.afterHandled(action);
      },

      handle_closeSettings(action) {
        this.host.showSettings = false;
        return this.afterHandled(action);
      },

      getSystemUiHost() {
        const game = this.getGameHost();
        return game?.canvasShell || this.host?.canvasShell || this.host;
      },

      resolveClientOperationLog() {
        const game = this.getGameHost();
        return this.host?.runtime?.ClientOperationLog
          || game?.runtime?.ClientOperationLog
          || global?.ClientOperationLog
          || globalThis?.ClientOperationLog
          || null;
      },

      handle_requestResetGame(action) {
        const uiHost = this.getSystemUiHost();
        if (typeof uiHost?.openResetConfirm !== 'function') return false;
        const opened = uiHost.openResetConfirm({ source: action.source }) !== false;
        return opened ? true : this.afterHandled(action);
      },

      handle_downloadClientOperationLog(action) {
        const game = this.getGameHost();
        const logger = this.resolveClientOperationLog();
        const result = logger?.download?.({
          reason: action.reason || 'settings-download',
          playerId: game?.playerId || '',
          username: game?.authStorage?.getUsername?.() || '',
        });
        if (result?.success) {
          this.host?.showFloatingText?.(`操作日志已保存：${result.fileName}`);
        } else {
          this.host?.showFloatingText?.(result?.message || result?.error || '操作日志导出失败', { color: '#ffb86b' });
        }
        return this.afterHandled(action);
      },

      handle_closeConfirmDialog(action) {
        const closed = this.getSystemUiHost()?.closeConfirmDialog?.();
        return closed !== false;
      },

      handle_confirmResetGame(action) {
        const uiHost = this.getSystemUiHost();
        const dialog = uiHost?.confirmDialog || {};
        if (dialog.visible && dialog.kind && dialog.kind !== 'resetGame') return false;
        uiHost?.setConfirmDialogSubmitting?.(true);
        const result = this.getGameHost()?.resetGame?.({ confirmed: true, source: action.source || dialog.source || '' });
        const applyResetView = (success) => {
          uiHost?.setConfirmDialogSubmitting?.(false);
          if (success === false) return false;
          uiHost?.closeConfirmDialog?.();
          uiHost?.resetLocalViewToResources?.({ skipRender: true });
          const game = this.getGameHost();
          if (game && game !== uiHost) game.resetLocalViewToResources?.({ skipShell: true, skipRender: true });
          this.render({ ...action, tab: 'military', militaryView: 'world', isMapHome: true });
          return true;
        };
        if (!result || typeof result.then !== 'function') return applyResetView(result);
        return this.finalize(result.then(applyResetView).catch((error) => {
          uiHost?.setConfirmDialogSubmitting?.(false);
          throw error;
        }));
      },

      handle_openLogs(action) {
        this.host.showLogs = true;
        this.closePanels(['showLogs']);
        return this.afterHandled(action);
      },

      handle_closeLogs(action) {
        this.host.showLogs = false;
        this.getGameHost()?.closeRequestLogs?.();
        return this.afterHandled(action);
      },

      handle_clearLogs(action) {
        const game = this.getGameHost();
        if (Array.isArray(game?.requestLogs)) game.requestLogs = [];
        if (typeof game?.clearRequestLogs === 'function') game.clearRequestLogs();
        this.host.showLogs = true;
        return this.afterHandled(action);
      },

      handle_openAdvisor(action) {
        this.host.showAdvisor = true;
        this.closePanels(['showAdvisor']);
        return this.afterHandled(action);
      },

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
      },

      handle_goToAdvisorTarget(action, meta = {}) {
        this.host.showAdvisor = false;
        this.host.activeEventId = null;
        const game = this.getGameHost();
        if (game && game !== this.host) game.showAdvisor = false;
        const result = typeof game?.goToAdvisorTarget === 'function'
          ? game.goToAdvisorTarget()
          : this.forward(action, meta);
        const afterAllowed = () => this.afterHandled(action);
        if (result && typeof result.then === 'function') {
          return this.finalize(result.then((allowed) => {
            if (allowed !== false) afterAllowed();
            return allowed !== false;
          }));
        }
        if (result !== false) afterAllowed();
        return result !== false;
      },

      handle_goToGuideTaskTarget(action) {
        return false;
      },

      handle_openGuidebook(action) {
        this.host.showGuidebook = true;
        this.host.activeGuidebookTab = action.tab || this.host.activeGuidebookTab || 'planning';
        this.closePanels(['showGuidebook']);
        return this.afterHandled(action);
      },

      handle_closeGuidebook(action) {
        this.host.showGuidebook = false;
        return this.afterHandled(action);
      },

      handle_switchGuidebookTab(action) {
        this.host.activeGuidebookTab = action.tab || 'planning';
        return this.afterHandled(action);
      },

      handle_requestLoginUsername() {
        return this.host?.requestAuthInput?.('username') !== false;
      },

      handle_requestLoginPassword() {
        return this.host?.requestAuthInput?.('password') !== false;
      },

      handle_toggleRememberPassword(action) {
        const toggled = this.host?.toggleRememberPassword?.();
        if (toggled !== false) this.afterHandled(action);
        return toggled !== false;
      },

      handle_submitLogin(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const result = this.getGameHost()?.handleLogin?.();
        return result === undefined ? true : result !== false;
      },

      handle_resetGame(action) {
        return this.handle_requestResetGame({ ...action, type: 'requestResetGame' });
      },

      handle_logout(action) {
        this.closePanels();
        const result = this.getGameHost()?.logout?.();
        return result === undefined ? true : result !== false;
      },

      handle_requestNamingInput(action) {
        const result = this.host?.requestNamingInput?.();
        return result !== false;
      },

      handle_closeNaming(action) {
        const result = this.host?.closeNaming?.() || this.getGameHost()?.closeNamingModal?.();
        return result !== false;
      },

      handle_submitNaming(action) {
        const name = action.name || this.host?.getNamingName?.();
        const game = this.getGameHost();
        const result = typeof game?.submitNaming === 'function'
          ? game.submitNaming(name)
          : this.host?.submitNaming?.();
        if (result !== undefined) return this.finalizeNamingSubmit(result, action);
        const forwarded = this.forward({ ...action, name });
        return forwarded === undefined ? false : this.finalizeNamingSubmit(forwarded, action);
      },

      handle_blockCanvasModal() {
        return true;
      },

      handleCanvasShellAction(action, meta = {}) {
        return this.handle(action, meta);
      },
    });
    return true;
  }

  const CanvasShellActionHandlers = { install };
  global.CanvasShellActionHandlers = CanvasShellActionHandlers;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasShellActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
