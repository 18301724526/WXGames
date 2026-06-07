(function (global) {
  var TutorialGuideControllerBase = global.TutorialGuideController;
  if (typeof module !== 'undefined' && module.exports && !TutorialGuideControllerBase) {
    try {
      TutorialGuideControllerBase = require('../tutorial/TutorialGuideController');
    } catch (error) {
      TutorialGuideControllerBase = null;
    }
  }
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      applyState(payload = {}) {
            global.WorldMarchTrace?.log?.('app:applyState:input', {
              payload: global.WorldMarchTrace?.summarizeApiPayload?.(payload) || null,
              before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
            });
            const nextState = payload.gameState || payload.state || this.state;
            const nextTutorial = payload.tutorial ?? nextState.tutorial ?? this.tutorial ?? {};
            const localTab = this.getActiveTab();
            const localMilitaryView = this.state?.militaryView || this.militaryView || nextState.militaryView || 'army';
            const homeView = this.resolveMapHomeViewState(nextState, {
              requestedTab: localTab,
              militaryView: localMilitaryView,
              forceMapHome: this.mapHomeActive && (localTab === 'resources' || localTab === 'military'),
            });
            this.state = {
              ...nextState,
              currentTab: homeView.activeTab,
              militaryView: homeView.militaryView,
              softGuide: payload.softGuide ?? nextState.softGuide ?? null,
              guideTasks: payload.guideTasks ?? nextState.guideTasks ?? { visible: false, tasks: [] },
              taskCenter: payload.taskCenter ?? nextState.taskCenter ?? null,
              eraProgress: payload.eraProgress ?? nextState.eraProgress,
            };
            this.tutorial = nextTutorial;
            this.activeTab = this.state.currentTab || homeView.activeTab;
            this.militaryView = this.state.militaryView || homeView.militaryView;
            this.mapHomeActive = homeView.isMapHome;
            const api = this.getGameApi();
            if (payload.token && api) {
              api.setToken?.(payload.token);
              this.runtime?.setStorage?.('token', payload.token);
            }
            this.hasServerState = true;
            if (this.loading.visible || this.canvasShell?.loading?.visible) {
              this.loading = { visible: false, percentage: 100, message: '' };
              if (this.canvasShell?.loading) this.canvasShell.loading = { visible: false, percentage: 100, message: '' };
            }
            this.tutorialController?.sync?.(nextTutorial);
            this.setPendingBuildingAction(null, { render: false });
            global.WorldMarchTrace?.log?.('app:applyState:after', {
              after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
            });
            this.render();
          },

      getGameApi() {
            return this.gameAPI || this.api;
          },

      applyApiState(data = {}) {
            global.WorldMarchTrace?.log?.('app:applyApiState:input', {
              payload: global.WorldMarchTrace?.summarizeApiPayload?.(data) || null,
              before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
            });
            if (this.stateNormalizer?.normalizeGameState) {
              const nextState = this.stateNormalizer.normalizeGameState(data);
              this.tutorial = this.stateNormalizer.normalizeTutorialState?.(data) || this.tutorial || {};
              this.syncFromServer(nextState, data.tutorial, data.eraProgress);
              global.WorldMarchTrace?.log?.('app:applyApiState:afterNormalizer', {
                after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
              });
              return;
            }
            this.applyState(data);
          },

      syncFromServer(serverState, tutorial, eraProgress) {
            global.WorldMarchTrace?.log?.('app:syncFromServer:input', {
              server: global.WorldMarchTrace?.summarizeWorldExplorerState?.(serverState?.worldExplorerState),
              before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
            });
            const localTab = this.getActiveTab();
            const localMilitaryView = this.state?.militaryView || this.militaryView || 'army';
            const homeView = this.resolveMapHomeViewState(serverState, {
              requestedTab: localTab,
              militaryView: localMilitaryView,
              forceMapHome: this.mapHomeActive && (localTab === 'resources' || localTab === 'military'),
            });
            if (this.stateManager && typeof this.stateManager === 'object') {
              this.stateManager.state = {
                ...(this.stateManager.state || {}),
                ...(this.state || {}),
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
              };
            }
            this.state = this.stateManager?.sync
              ? this.stateManager.sync(serverState, eraProgress)
              : {
                ...serverState,
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
                eraProgress: eraProgress ?? serverState?.eraProgress,
              };
            const syncedHomeView = this.resolveMapHomeViewState(this.state, {
              requestedTab: homeView.activeTab,
              militaryView: homeView.militaryView,
              forceMapHome: homeView.isMapHome,
            });
            this.state = {
              ...this.state,
              currentTab: syncedHomeView.activeTab,
              militaryView: syncedHomeView.militaryView,
            };
            this.activeTab = this.state.currentTab || syncedHomeView.activeTab;
            this.militaryView = this.state.militaryView || syncedHomeView.militaryView;
            this.mapHomeActive = syncedHomeView.isMapHome;
            const nextTutorial = this.getEffectiveTutorialState(tutorial || this.tutorial || {});
            this.tutorial = nextTutorial;
            this.state = {
              ...this.state,
              tutorial: nextTutorial,
            };
            this.tutorialController?.sync?.(nextTutorial);
            this.updateSyncInterval();
            this.hasServerState = true;
            if (this.loading.visible || this.canvasShell?.loading?.visible) {
              this.loading = { visible: false, percentage: 100, message: '' };
              if (this.canvasShell?.loading) this.canvasShell.loading = { visible: false, percentage: 100, message: '' };
            }
            this.setPendingBuildingAction(null, { render: false });
            global.WorldMarchTrace?.log?.('app:syncFromServer:after', {
              after: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
            });
            this.render();
          },

      getSyncInterval() {
            return this.config?.SYNC_INTERVAL_MS || this.syncIntervalMs;
          },

      updateSyncInterval() {
            this.syncService?.setIntervalMs?.(this.getSyncInterval());
          },

      applyHeartbeat(data = {}) {
            if (!data || data.gameState) return data;
            const wasReconnecting = this.networkState?.status === 'reconnecting';
            this.networkState = {
              ...(this.networkState || {}),
              status: 'online',
              failureCount: 0,
              serverTime: data.serverTime || this.networkState?.serverTime || null,
              heartbeatSeq: Number(data.heartbeatSeq) || this.networkState?.heartbeatSeq || 0,
            };
            if (this.canvasShell?.setNetworkState) this.canvasShell.setNetworkState(this.networkState);
            else if (wasReconnecting) this.renderCanvasSurface(this.state?.currentTab);
            return data;
          },

      applyConnectionState(status = {}) {
            const nextStatus = status.status || 'online';
            const wasReconnecting = this.networkState?.status === 'reconnecting';
            this.networkState = {
              ...(this.networkState || {}),
              status: nextStatus,
              failureCount: Number(status.failureCount) || 0,
              lastError: status.error?.message || status.error?.payload?.message || null,
            };
            if (this.canvasShell?.setNetworkState) this.canvasShell.setNetworkState(this.networkState);
            else if (nextStatus === 'reconnecting' || wasReconnecting) this.renderCanvasSurface(this.state?.currentTab);
            return this.networkState;
          },

      getBuildingLevel(buildingId) {
            const entry = this.state?.buildings?.[buildingId];
            if (!entry) return 0;
            return typeof entry === 'object' ? entry.level || 0 : Number(entry) || 0;
          },

      isEra2AdvanceReady(progress = this.state?.eraProgress) {
            return this.state?.currentEra === 1
              && Boolean(progress?.canAdvance)
              && this.getBuildingLevel('house') > 0;
          },

      getEffectiveTutorialState(tutorial) {
            const nextTutorial = tutorial || { completed: false, currentStep: 0, phaseCompleted: { newbie: false, era2: false } };
            const tutorialSteps = this.tutorialController?.constructor?.TUTORIAL_STEPS || TutorialGuideControllerBase?.TUTORIAL_STEPS || {};
            if (!nextTutorial.completed && nextTutorial.currentStep === tutorialSteps.farmBuilt && this.isEra2AdvanceReady()) {
              return {
                ...nextTutorial,
                currentStep: tutorialSteps.era2AdvanceReady,
                phaseCompleted: {
                  ...nextTutorial.phaseCompleted,
                  newbie: true,
                },
              };
            }
            return nextTutorial;
          },

      canAdvanceEraByTutorial() {
            return true;
          },

      canAdvanceEraNow(progress = this.state?.eraProgress) {
            const tutorial = this.getEffectiveTutorialState(this.tutorial || this.state?.tutorial || {});
            const view = this.presenter?.buildCivilizationViewState?.(
              { ...this.state, eraProgress: progress },
              tutorial,
              { canOpenCivilizationTab: true },
            );
            return Boolean(view?.advanceButton?.canAdvance);
          },

      hasActiveTutorialGuideHighlight() {
            return false;
          },

      async syncOnce() {
            const data = await this.api.getState();
            this.applyState(data);
            return data;
          },

      async startHeartbeat() {
            const api = this.getGameApi();
            api?.setToken?.(this.token);
            try {
              if (this.syncService?.stop) this.syncService.stop();
              await this.syncOnce();
              this.syncService?.start?.();
            } catch (error) {
              if (error.payload && error.payload.error && this.handleAuthError) {
                this.handleAuthError(error.payload);
              } else {
                this.applyConnectionState({ status: 'reconnecting', failureCount: 1, error });
              }
            }
          },

      stopHeartbeat() {
            this.syncService?.stop?.();
            this.updateChecker?.stop?.();
            if (this.scoutCountdownTimer) {
              this.scheduler?.clearInterval?.(this.scoutCountdownTimer);
              this.scoutCountdownTimer = null;
            }
          },

      showUpdatePrompt(version) {
            this.stopHeartbeat();
            return this.updateRuntime?.promptAndReload?.(version);
          },

      start() {
            this.render();
            this.syncOnce().catch(() => {});
            if (this.timer) return;
            if (!this.tapDisposer && this.runtime && typeof this.runtime.onTap === 'function') {
              this.tapDisposer = this.runtime.onTap((point) => this.handleTap(point));
            }
            if (!this.dragDisposer && this.runtime && typeof this.runtime.onDrag === 'function') {
              this.dragDisposer = this.runtime.onDrag((phase, point) => this.handleDrag(phase, point));
            }
            if (!this.gestureDisposer && this.runtime && typeof this.runtime.onGesture === 'function') {
              this.gestureDisposer = this.runtime.onGesture((gesture) => this.handleGesture(gesture));
            }
            if (this.syncService?.start) this.syncService.start();
            else if (this.api?.heartbeat && this.runtime?.setInterval) {
              this.timer = this.runtime.setInterval(() => {
                this.api.heartbeat().then((data) => this.applyHeartbeat(data)).catch((error) => this.applyConnectionState({
                  status: 'reconnecting',
                  failureCount: (this.networkState?.failureCount || 0) + 1,
                  error,
                }));
              }, this.config?.HEARTBEAT_INTERVAL_MS || this.syncIntervalMs);
            }
          },

      stop() {
            this.syncService?.stop?.();
            if (this.timer) {
              this.runtime.clearInterval(this.timer);
              this.timer = null;
            }
            if (this.highlightTimer) {
              this.runtime.clearInterval(this.highlightTimer);
              this.highlightTimer = null;
            }
            this.stopTransitionTimer();
            if (this.tapDisposer) {
              this.tapDisposer();
              this.tapDisposer = null;
            }
            if (this.dragDisposer) {
              this.dragDisposer();
              this.dragDisposer = null;
            }
            if (this.gestureDisposer) {
              this.gestureDisposer();
              this.gestureDisposer = null;
            }
          },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppStateSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
