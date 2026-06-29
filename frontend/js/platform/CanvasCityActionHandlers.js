(function (global) {

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  const { openBlockingPanelSnapshot, closeBlockingPanelSnapshot } = global.CanvasBlockingPanelSnapshotCalls || (typeof require !== 'undefined' ? require('./CanvasBlockingPanelSnapshotCalls') : {});

  function install(CanvasActionController) {
    if (!CanvasActionController?.prototype) return false;
    Object.assign(CanvasActionController.prototype, {
      handle_openCityManagement(action) {
        const tab = action.tab || 'buildings';
        const game = this.getGameHost();
        const owner = game || this.host;
        owner.activeCityManagementTab = tab;
        openBlockingPanelSnapshot(this.host, 'showCityManagement', true);
        this.closePanels(['showCityManagement']);
        const handled = this.afterHandled(action);
        const result = game?.tutorialController?.onCityManagementOpened?.(tab);
        const refreshAfterTutorialAdvance = () => {
          owner.activeCityManagementTab = tab;
          openBlockingPanelSnapshot(this.host, 'showCityManagement', true);
          game?.tutorialController?.refreshCurrentHighlight?.();
        };
        if (result && typeof result.then === 'function') {
          result.then(refreshAfterTutorialAdvance).catch((error) => this.log?.(error));
        } else {
          refreshAfterTutorialAdvance();
        }
        return handled;
      },

      handle_closeCityManagement(action) {
        closeBlockingPanelSnapshot(this.host, 'showCityManagement');
        return this.afterHandled(action);
      },

      handle_switchCityManagementTab(action) {
        const allowed = ['buildings', 'people', 'military'];
        const tab = allowed.includes(action.tab) ? action.tab : 'buildings';
        const game = this.getGameHost();
        const owner = game || this.host;
        owner.activeCityManagementTab = tab;
        const handled = this.afterHandled(action);
        game?.tutorialController?.onCityManagementOpened?.(tab);
        const scheduler = this.host?.runtime || game?.runtime || global;
        scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
        return handled;
      },

      handle_openEvent(action) {
        const game = this.getGameHost();
        const eventData = (game?.state?.eventQueue || this.getState().eventQueue || [])
          .find((item) => item.id === action.eventId);
        if (!eventData) return false;
        this.closePanels(['activeEventId']);
        const eventId = this.host.openEventSnapshot?.(action.eventId) || action.eventId;
        const controller = this.getEventController();
        controller?.open?.(eventId);
        const handled = this.afterHandled(action);
        game?.tutorialController?.refreshCurrentHighlight?.();
        return handled;
      },

      handle_closeEvent(action) {
        this.host.closeEventSnapshot?.();
        const controller = this.getEventController();
        controller?.close?.();
        return this.afterHandled(action);
      },

      handle_openTaskCenter(action) {
        const tab = action.tab
          || (this.host?.hasClaimableMainTask?.() ? 'main' : this.host.activeTaskCenterTab)
          || 'main';
        const game = this.closePanelsEverywhere(['showTaskCenter']);
        openBlockingPanelSnapshot(this.host, 'showTaskCenter', true);
        this.host.activeTaskCenterTab = tab;
        if (game && game !== this.host) {
          game.activeTaskCenterTab = tab;
        }
        if (game?.canvasShell && game.canvasShell !== this.host) {
          game.canvasShell.activeTaskCenterTab = tab;
        }
        const handled = this.afterHandled(action);
        game?.tutorialController?.refreshCurrentHighlight?.();
        return handled;
      },

      handle_closeTaskCenter(action) {
        closeBlockingPanelSnapshot(this.host, 'showTaskCenter');
        return this.afterHandled(action);
      },

      handle_switchTaskCenterTab(action) {
        const tab = action.tab || 'main';
        this.host.activeTaskCenterTab = tab;
        const game = this.getGameHost();
        if (game && game !== this.host) game.activeTaskCenterTab = tab;
        return this.afterHandled(action);
      },

      handle_selectCity(action) {
        closeBlockingPanelSnapshot(this.host, 'showCitySwitcher');
        closeBlockingPanelSnapshot(this.host, 'showSubcityList');
        this.host.closeEventSnapshot?.();
        const forwarded = this.forward(action);
        if (forwarded !== undefined) {
          return this.finalizeForwarded(forwarded, () => this.afterHandled(action));
        }
        return this.finalize(this.selectCity(action));
      },

      async selectCity(action) {
        const game = this.getGameHost();
        if (typeof game?.switchCity === 'function') {
          return await game.switchCity(action.cityId);
        }
        closeBlockingPanelSnapshot(this.host, 'showCitySwitcher');
        this.host.closeEventSnapshot?.();
        await this.runAction(() => this.host.api.switchCity(action.cityId));
        return true;
      },

      handle_jumpToSubcity(action) {
        const cityId = action.cityId || action.siteId || '';
        if (!cityId) return false;
        closeBlockingPanelSnapshot(this.host, 'showSubcityList');
        closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
        this.host.closeEventSnapshot?.();
        this.openWorldSiteLocally(cityId);
        this.centerWorldMapOnSite(cityId);
        const selectAction = { ...action, type: 'selectCity', cityId };
        const forwarded = this.forward(selectAction);
        if (forwarded !== undefined) {
          return this.finalizeForwarded(forwarded, () => this.afterHandled(action));
        }
        return this.finalize(Promise.resolve(this.selectCity(selectAction)).then((allowed) => {
          if (allowed !== false) this.afterHandled(action);
          return allowed !== false;
        }));
      },

      handle_enterCity(action) {
        if (this.beginTutorialEnterCityTransition(action)) return true;
        return this.performEnterCity(action);
      },

      beginTutorialEnterCityTransition(action = {}) {
        const controller = this.getTutorialIntroController();
        if (!controller || typeof controller.beginEnterCityTransition !== 'function') return false;
        const intro = this.getTutorialIntroView(controller);
        if (intro?.step !== 'enter') return false;
        const capitalCityId = intro.capitalCityId || controller.getCapitalCityId?.() || 'capital';
        const actionCityId = action.cityId || action.territoryId || action.siteId || '';
        if (action?.type !== 'enterCity' || (actionCityId && actionCityId !== capitalCityId)) return false;
        return controller.beginEnterCityTransition(action, () => this.performEnterCity(action)) === true;
      },

      getTutorialIntroController() {
        const game = this.getGameHost();
        return this.host?.tutorialIntroOverlay
          || this.host?.lastGame?.tutorialIntroOverlay
          || game?.tutorialIntroOverlay
          || null;
      },

      getTutorialIntroView(controller = this.getTutorialIntroController()) {
        const game = this.getGameHost();
        return controller?.getViewState?.()
          || this.host?.tutorialIntro
          || this.host?.lastGame?.tutorialIntro
          || game?.tutorialIntro
          || null;
      },

      performEnterCity(action) {
        const cityId = action.cityId || action.territoryId || action.siteId || '';
        if (!cityId) return false;
        closeBlockingPanelSnapshot(this.host, 'showSubcityList');
        closeBlockingPanelSnapshot(this.host, 'activeCommandPanel');
        this.host.closeEventSnapshot?.();
        const game = this.getGameHost();
        const result = typeof game?.enterCity === 'function'
          ? game.enterCity(cityId, { tab: action.tab || 'buildings' })
          : Promise.resolve(this.selectCity({ ...action, cityId })).then((allowed) => {
            if (allowed === false) return false;
            (game || this.host).activeCityManagementTab = action.tab || 'buildings';
            openBlockingPanelSnapshot(this.host, 'showCityManagement', true);
            return true;
          });
        return this.finalize(Promise.resolve(result).then((allowed) => {
          if (allowed !== false) {
            (game || this.host).activeCityManagementTab = action.tab || 'buildings';
            openBlockingPanelSnapshot(this.host, 'showCityManagement', true);
            this.afterHandled(action);
            const tab = action.tab || 'buildings';
            game?.tutorialController?.onCityManagementOpened?.(tab);
            const scheduler = this.host?.runtime || game?.runtime || global;
            scheduler?.setTimeout?.(() => game?.tutorialController?.refreshCurrentHighlight?.(), 0);
          }
          return allowed !== false;
        }));
      },

      handle_assignJob(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
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
      },

      handle_buildBuilding(action) {
        return this.finalize(this.handleBuilding(action, 'build'));
      },

      handle_upgradeBuilding(action) {
        return this.finalize(this.handleBuilding(action, 'upgrade'));
      },

      async handleBuilding(action, buildingAction) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (game?.tutorialController?.onBuildingAction?.(action.buildingId, buildingAction) === false) {
          game.showFloatingText?.(t('guide.buildFirstHouseFirst'));
          game.tutorialController?.refreshCurrentHighlight?.();
          return false;
        }
        if (buildingAction === 'upgrade' && typeof game?.upgradeBuilding === 'function') {
          return game.upgradeBuilding(action.buildingId);
        }
        if (buildingAction !== 'upgrade' && typeof game?.buildBuilding === 'function') {
          return game.buildBuilding(action.buildingId);
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
      },

      handle_advanceEra(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (typeof game?.advanceEra === 'function') {
          return this.finalize(game.advanceEra());
        }
        return this.finalize(this.runAction(() => this.host.api.advanceEra()));
      },

      handle_research(action) {
        const forwarded = this.forward(action);
        if (forwarded !== undefined) return this.finalizeForwarded(forwarded);
        const game = this.getGameHost();
        if (typeof game?.research === 'function') {
          return this.finalize(game.research(action.techId));
        }
        return this.finalize(this.runAction(() => this.host.api.research(action.techId)));
      },

      handle_selectTechNode(action) {
        const techId = action.techId || '';
        if (typeof this.host?.selectTechNode === 'function') {
          this.host.selectTechNode(action);
        } else if (this.host) {
          const game = this.getGameHost();
          if (game?.state && typeof game.state === 'object') {
            game.state = {
              ...game.state,
              techUiState: {
                ...(game.state.techUiState || {}),
                selectedTechId: techId,
                detailOpen: Boolean(techId),
              },
            };
          }
        }
        openBlockingPanelSnapshot(this.host, 'techDetailOpen', Boolean(techId));
        return this.afterHandled(action);
      },

      handle_closeTechDetail(action) {
        if (typeof this.host?.closeTechDetail === 'function') {
          this.host.closeTechDetail(action);
        } else if (this.host) {
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
        closeBlockingPanelSnapshot(this.host, 'techDetailOpen');
        return this.afterHandled(action);
      },

      handle_claimEvent(action) {
        return this.finalize(this.claimEvent(action));
      },

      async claimEvent(action) {
        const controller = this.getEventController();
        this.host.closeEventSnapshot?.();
        controller?.close?.();
        const forwarded = this.forward(action);
        if (forwarded !== undefined) {
          return this.finalizeForwarded(forwarded, () => {
            const game = this.getGameHost();
            game?.tutorialController?.sync?.(game?.tutorial || game?.state?.tutorial || {});
            game?.tutorialController?.refreshCurrentHighlight?.();
            this.afterHandled(action);
          });
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
      },

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
        this.host.closeEventSnapshot?.();
        this.getEventController()?.close?.();
        if (result?.rewardReveal) {
          if (!this.host.showRewardReveal?.(result.rewardReveal)) this.host.openRewardRevealSnapshot?.(result.rewardReveal);
        }
        if (typeof this.host.hideGuideHighlight === 'function') this.host.hideGuideHighlight();
        else this.host.hideTutorialHighlight?.();
        game?.tutorialController?.refreshCurrentHighlight?.();
        return true;
      },

      handle_claimGuideTaskReward(action) {
        return false;
      },

      handle_claimTaskReward(action) {
        closeBlockingPanelSnapshot(this.host, 'showTaskCenter');
        const forwarded = this.forward(action);
        if (forwarded !== undefined) {
          return this.finalizeForwarded(forwarded, () => this.afterHandled(action));
        }
        const game = this.getGameHost();
        if (typeof game?.claimTaskReward === 'function') {
          return this.finalize(game.claimTaskReward(action.taskId, action.category));
        }
        return this.finalize(this.claimTaskRewardDirect(action, false));
      },

      async claimTaskRewardDirect(action, legacyGuideTask) {
        closeBlockingPanelSnapshot(this.host, 'showTaskCenter');
        const result = await this.runAction(() => {
          const claim = this.host.api.claimTaskReward;
          if (typeof claim !== 'function') return { success: false };
          return claim.call(this.host.api, action.taskId, action.category || 'main');
        });
        if (result?.rewardReveal) this.host.openRewardRevealSnapshot?.(result.rewardReveal);
        else this.host.closeRewardRevealSnapshot?.();
        return true;
      },

      handle_scrollBuildings(action) {
        if (typeof this.host?.scrollBuildings === 'function') {
          this.host.scrollBuildings(action);
        } else {
          this.host.buildingOffset = Math.max(0, (Number(this.host.buildingOffset) || 0) + (Number(action.delta) || 0));
        }
        return this.afterHandled(action);
      },

      handle_selectBuildingCategory(action) {
        if (typeof this.host?.selectBuildingCategory === 'function') {
          this.host.selectBuildingCategory(action);
        } else {
          this.host.activeBuildingCategory = action.category || 'all';
          this.host.buildingOffset = 0;
          this.host.buildingTransition = null;
        }
        return this.afterHandled(action);
      },
    });
    return true;
  }

  const CanvasCityActionHandlers = { install };
  global.CanvasCityActionHandlers = CanvasCityActionHandlers;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasCityActionHandlers;
})(typeof globalThis !== 'undefined' ? globalThis : window);
