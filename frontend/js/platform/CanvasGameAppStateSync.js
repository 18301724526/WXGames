(function (global) {
  var SharedWorldClock = global.WorldClock;
  if (typeof module !== 'undefined' && module.exports && !SharedWorldClock) {
    try {
      SharedWorldClock = require('../domain/WorldClock');
    } catch (_error) {
      SharedWorldClock = null;
    }
  }
  var TutorialGuideControllerBase = global.TutorialGuideController;
  if (typeof module !== 'undefined' && module.exports && !TutorialGuideControllerBase) {
    try {
      TutorialGuideControllerBase = require('../tutorial/TutorialGuideController');
    } catch (_error) {
      TutorialGuideControllerBase = null;
    }
  }
  var WorldMarchOptimisticState = global.WorldMarchOptimisticState;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchOptimisticState) {
    try {
      WorldMarchOptimisticState = require('../domain/WorldMarchOptimisticState');
    } catch (_error) {
      WorldMarchOptimisticState = null;
    }
  }
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      getWorldMarchClientReport() {
            return WorldMarchOptimisticState?.buildClientReport?.(this) || null;
          },

      playUnseenWorldCombatReports(state = this.state) {
            const reports = state?.worldExplorerState?.combat?.recentReports;
            if (!Array.isArray(reports) || !reports.length) return false;
            this.playedWorldCombatReportIds = this.playedWorldCombatReportIds || new Set();
            // First sync of this session: the reports already present are history from
            // before the page loaded, not battles that just happened. Mark them all seen
            // without playing — otherwise every reload (e.g. the post-deploy update
            // refresh) re-plays the newest historical report as an orderless replay.
            if (!this.worldCombatReportsSeeded) {
              for (const entry of reports) {
                const seededId = entry?.id || entry?.report?.id || '';
                if (seededId) this.playedWorldCombatReportIds.add(seededId);
              }
              this.worldCombatReportsSeeded = true;
              return false;
            }
            // recentReports is newest-first. Play only the newest unseen report
            // and mark the rest seen, so a backlog (several battles between syncs)
            // doesn't stack multiple battle scenes at once.
            let toPlay = null;
            for (const entry of reports) {
              const report = entry?.report || null;
              const reportId = entry?.id || report?.id || '';
              if (!report || !reportId || this.playedWorldCombatReportIds.has(reportId)) continue;
              if (!toPlay) toPlay = report;
              this.playedWorldCombatReportIds.add(reportId);
            }
            if (toPlay && typeof this.startBattleScene === 'function') {
              this.startBattleScene(toPlay);
              return true;
            }
            return false;
          },

      applyState(payload = {}) {
            this.syncWorldClock?.(payload);
            const loadTrace = this.loadTrace || null;
            loadTrace?.mark?.('state:apply:start', {
              payload: loadTrace.summarizePayload?.(payload) || null,
            });
            global.WorldMarchTrace?.log?.('app:applyState:input', {
              payload: global.WorldMarchTrace?.summarizeApiPayload?.(payload) || null,
              before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
            });
            const rawNextState = payload.gameState || payload.state || this.state;
            const nextState = WorldMarchOptimisticState?.reconcileState?.(this, rawNextState, { source: 'applyState' })
              || rawNextState;
            const payloadWorldMap = global.CodexWorldMapDiag?.summarizeWorldMap?.(payload) || null;
            const nextStateSummary = global.CodexWorldMapDiag?.summarizeState?.(nextState) || null;
            global.CodexWorldMapDiag?.logChanged?.('state:applyState:input', {
              source: payload.gameState ? 'payload.gameState' : (payload.state ? 'payload.state' : 'currentState'),
              payloadHasWorldMap: Boolean(payloadWorldMap?.hasWorldMap),
              payloadTileCount: payloadWorldMap?.tileCount || 0,
              payloadVersion: payloadWorldMap?.version || 0,
              nextTileCount: nextStateSummary?.worldMap?.tileCount || 0,
              nextVersion: nextStateSummary?.worldMap?.version || 0,
              nextCurrentTab: nextStateSummary?.currentTab || '',
              nextMilitaryView: nextStateSummary?.militaryView || '',
            }, {
              source: payload.gameState ? 'payload.gameState' : (payload.state ? 'payload.state' : 'currentState'),
              payloadWorldMap,
              nextState: nextStateSummary,
            });
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
            const assignedStateSummary = global.CodexWorldMapDiag?.summarizeState?.(this.state) || null;
            global.CodexWorldMapDiag?.logChanged?.('state:applyState:afterAssign', {
              tileCount: assignedStateSummary?.worldMap?.tileCount || 0,
              version: assignedStateSummary?.worldMap?.version || 0,
              currentTab: assignedStateSummary?.currentTab || '',
              militaryView: assignedStateSummary?.militaryView || '',
              mapHomeActive: Boolean(this.mapHomeActive),
            }, {
              state: assignedStateSummary,
              mapHomeActive: Boolean(this.mapHomeActive),
            });
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
            this.playUnseenWorldCombatReports?.(this.state);
            this.render();
            loadTrace?.ready?.({
              source: 'applyState',
              activeTab: this.state?.currentTab || '',
              militaryView: this.state?.militaryView || '',
            });
          },

      getGameApi() {
            return this.gameAPI || this.api;
          },

      applyApiState(data = {}) {
            this.syncWorldClock?.(data);
            const apiPayloadWorldMap = global.CodexWorldMapDiag?.summarizeWorldMap?.(data) || null;
            global.CodexWorldMapDiag?.logChanged?.('state:applyApiState:input', {
              payloadHasWorldMap: Boolean(apiPayloadWorldMap?.hasWorldMap),
              payloadTileCount: apiPayloadWorldMap?.tileCount || 0,
              payloadVersion: apiPayloadWorldMap?.version || 0,
              hasNormalizer: Boolean(this.stateNormalizer?.normalizeGameState),
            }, {
              payloadWorldMap: apiPayloadWorldMap,
              hasNormalizer: Boolean(this.stateNormalizer?.normalizeGameState),
            });
            global.WorldMarchTrace?.log?.('app:applyApiState:input', {
              payload: global.WorldMarchTrace?.summarizeApiPayload?.(data) || null,
              before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
            });
            if (this.stateNormalizer?.normalizeGameState) {
              const nextState = this.stateNormalizer.normalizeGameState(data);
              const normalizedStateSummary = global.CodexWorldMapDiag?.summarizeState?.(nextState) || null;
              global.CodexWorldMapDiag?.logChanged?.('state:applyApiState:afterNormalizer', {
                tileCount: normalizedStateSummary?.worldMap?.tileCount || 0,
                version: normalizedStateSummary?.worldMap?.version || 0,
                currentTab: normalizedStateSummary?.currentTab || '',
                militaryView: normalizedStateSummary?.militaryView || '',
                tutorialStep: normalizedStateSummary?.tutorial?.currentStep ?? null,
              }, {
                nextState: normalizedStateSummary,
              });
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
            this.syncWorldClock?.({
              gameState: serverState,
              tutorial,
              eraProgress,
            });
            const reconciledServerState = WorldMarchOptimisticState?.reconcileState?.(this, serverState, { source: 'syncFromServer' })
              || serverState;
            const loadTrace = this.loadTrace || null;
            loadTrace?.mark?.('state:syncFromServer:start', {
              payload: loadTrace.summarizePayload?.({ gameState: serverState }) || null,
            });
            global.WorldMarchTrace?.log?.('app:syncFromServer:input', {
              server: global.WorldMarchTrace?.summarizeWorldExplorerState?.(reconciledServerState?.worldExplorerState),
              before: global.WorldMarchTrace?.summarizeWorldExplorerState?.(this.state?.worldExplorerState),
            });
            const serverStateSummary = global.CodexWorldMapDiag?.summarizeState?.(reconciledServerState) || null;
            const beforeStateSummary = global.CodexWorldMapDiag?.summarizeState?.(this.state) || null;
            global.CodexWorldMapDiag?.logChanged?.('state:syncFromServer:input', {
              serverTileCount: serverStateSummary?.worldMap?.tileCount || 0,
              serverVersion: serverStateSummary?.worldMap?.version || 0,
              beforeTileCount: beforeStateSummary?.worldMap?.tileCount || 0,
              beforeVersion: beforeStateSummary?.worldMap?.version || 0,
              serverCurrentTab: serverStateSummary?.currentTab || '',
              beforeCurrentTab: beforeStateSummary?.currentTab || '',
            }, {
              serverState: serverStateSummary,
              beforeState: beforeStateSummary,
            });
            const localTab = this.getActiveTab();
            const localMilitaryView = this.state?.militaryView || this.militaryView || 'army';
            const homeView = this.resolveMapHomeViewState(reconciledServerState, {
              requestedTab: localTab,
              militaryView: localMilitaryView,
              forceMapHome: this.mapHomeActive && (localTab === 'resources' || localTab === 'military'),
            });
            this.state = this.stateManager?.sync
              ? this.stateManager.sync(
                {
                  ...(this.state || {}),
                  currentTab: homeView.activeTab,
                  militaryView: homeView.militaryView,
                },
                reconciledServerState,
                eraProgress,
              )
              : {
                ...reconciledServerState,
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
                eraProgress: eraProgress ?? reconciledServerState?.eraProgress,
              };
            const syncedStateSummary = global.CodexWorldMapDiag?.summarizeState?.(this.state) || null;
            global.CodexWorldMapDiag?.logChanged?.('state:syncFromServer:afterSync', {
              tileCount: syncedStateSummary?.worldMap?.tileCount || 0,
              version: syncedStateSummary?.worldMap?.version || 0,
              currentTab: syncedStateSummary?.currentTab || '',
              militaryView: syncedStateSummary?.militaryView || '',
              usedStateManager: Boolean(this.stateManager?.sync),
            }, {
              state: syncedStateSummary,
              usedStateManager: Boolean(this.stateManager?.sync),
            });
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
            const beforeRenderStateSummary = global.CodexWorldMapDiag?.summarizeState?.(this.state) || null;
            global.CodexWorldMapDiag?.logChanged?.('state:syncFromServer:beforeRender', {
              tileCount: beforeRenderStateSummary?.worldMap?.tileCount || 0,
              version: beforeRenderStateSummary?.worldMap?.version || 0,
              currentTab: beforeRenderStateSummary?.currentTab || '',
              militaryView: beforeRenderStateSummary?.militaryView || '',
              tutorialStep: beforeRenderStateSummary?.tutorial?.currentStep ?? null,
              mapHomeActive: Boolean(this.mapHomeActive),
            }, {
              state: beforeRenderStateSummary,
              mapHomeActive: Boolean(this.mapHomeActive),
            });
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
            this.playUnseenWorldCombatReports?.(this.state);
            this.render();
            loadTrace?.ready?.({
              source: 'syncFromServer',
              activeTab: this.state?.currentTab || '',
              militaryView: this.state?.militaryView || '',
            });
          },

      getSyncInterval() {
            return this.config?.SYNC_INTERVAL_MS || this.syncIntervalMs;
          },

      updateSyncInterval() {
            this.syncService?.setIntervalMs?.(this.getSyncInterval());
          },

      applyHeartbeat(data = {}) {
            this.syncWorldClock?.(data);
            if (!data || data.gameState) return data;
            const wasReconnecting = this.networkState?.status === 'reconnecting';
            const marchVerification = data.worldMarchVerification || data.marchVerification || null;
            const largeDrift = marchVerification?.status === 'pullback'
              || (Array.isArray(marchVerification?.results)
                && marchVerification.results.some((result) => result?.severity === 'large'));
            this.networkState = {
              ...(this.networkState || {}),
              status: largeDrift ? 'reconnecting' : 'online',
              failureCount: largeDrift ? Math.max(1, Number(this.networkState?.failureCount) || 0) : 0,
              serverTime: data.serverTime || this.networkState?.serverTime || null,
              heartbeatSeq: Number(data.heartbeatSeq) || this.networkState?.heartbeatSeq || 0,
              message: largeDrift
                ? (WorldMarchOptimisticState?.SLOW_SYNC_MESSAGE || this.networkState?.message || null)
                : null,
              worldMarchReconciliation: marchVerification || null,
            };
            if (this.canvasShell?.setNetworkState) this.canvasShell.setNetworkState(this.networkState);
            else if (wasReconnecting || largeDrift) this.renderCanvasSurface(this.state?.currentTab);
            return data;
          },

      ensureWorldClock() {
            if (this.worldClock) return this.worldClock;
            this.worldClock = SharedWorldClock?.getShared?.({ runtime: this.runtime }) || null;
            if (this.runtime && typeof this.runtime === 'object' && this.worldClock) this.runtime.worldClock = this.worldClock;
            // P3 Axis A: dropped the canvasShell.worldClock mirror (zero readers). The
            // shell resolves the clock from its own constructor (shared singleton) and a
            // this.runtime/lastGame fallback chain (CanvasGameShellRenderingRuntime:110),
            // so this push was redundant.
            return this.worldClock;
          },

      syncWorldClock(payload = {}) {
            const clock = this.ensureWorldClock?.();
            if (!clock || !payload || typeof payload !== 'object') return false;
            const synced = clock.updateFromPayload?.(payload) || false;
            // P3 Axis A: dropped the canvasShell.worldClock mirror (see ensureWorldClock).
            return synced;
          },

      getWorldEpochNowMs() {
            const clock = this.ensureWorldClock?.();
            return clock?.getEpochNowMs?.(Date.now()) ?? Date.now();
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
            const trace = this.loadTrace || null;
            trace?.phaseStart?.('state:syncOnce', {
              hasToken: Boolean(this.token),
              forceLog: true,
            });
            const data = await this.api.getState();
            this.applyState(data);
            trace?.phaseEnd?.('state:syncOnce', {
              forceLog: true,
              payload: trace.summarizePayload?.(data) || null,
            });
            return data;
          },

      async startHeartbeat() {
            const api = this.getGameApi();
            api?.setToken?.(this.token);
            const trace = this.loadTrace || null;
            trace?.phaseStart?.('state:first-sync', {
              hasToken: Boolean(this.token),
              hasSyncService: Boolean(this.syncService),
              forceLog: true,
            });
            try {
              if (this.syncService?.stop) this.syncService.stop();
              await this.syncOnce();
              trace?.phaseEnd?.('state:first-sync', {
                forceLog: true,
                next: 'heartbeat:start',
              });
              this.syncService?.start?.();
            } catch (error) {
              trace?.phaseFail?.('state:first-sync', error);
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
                const report = this.getWorldMarchClientReport?.();
                this.api.heartbeat(report ? { worldMarchClientReport: report } : undefined).then((data) => this.applyHeartbeat(data)).catch((error) => this.applyConnectionState({
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
