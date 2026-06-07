(function (global) {
  var WorldMapRuntimeCoordinatorBase = global.WorldMapRuntimeCoordinator;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimeCoordinatorBase) {
    WorldMapRuntimeCoordinatorBase = require('./WorldMapRuntimeCoordinator');
  }
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      render() {
            this.renderMilitaryView();
            this.renderSoftGuide({ skipSurface: true });
            this.maybeShowNamingPrompt();
            this.renderCanvasSurface();
          },

      renderCanvasSurface(activeTab = this.getActiveTab()) {
            const homeView = this.resolveMapHomeViewState(this.state, {
              requestedTab: activeTab || this.getActiveTab(),
              militaryView: this.state?.militaryView || this.militaryView,
              forceMapHome: this.mapHomeActive && (activeTab === 'resources' || activeTab === 'military'),
            });
            const resolvedActiveTab = homeView.activeTab;
            this.mapHomeActive = homeView.isMapHome;
            this.activeTab = resolvedActiveTab;
            if (this.state && typeof this.state === 'object') {
              this.state = {
                ...this.state,
                currentTab: resolvedActiveTab,
                militaryView: homeView.militaryView,
              };
            }
            this.militaryView = homeView.militaryView;
            if (this.canvasShell?.previewEnabled || typeof this.canvasShell?.renderReadOnly === 'function') {
              if (
                this.canvasShell?.isWorldMapDragging?.()
                || this.canvasShell?.hasPendingWorldMapCompositeCommit?.()
              ) {
                this.canvasShell.deferRenderUntilWorldMapDragEnd = true;
                return true;
              }
              if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = this.pageTransition;
              if (this.canvasShell && typeof this.canvasShell.buildingTransition !== 'undefined') this.canvasShell.buildingTransition = this.buildingTransition;
              if (this.canvasShell && typeof this.canvasShell.techTreeZoom !== 'undefined') this.canvasShell.techTreeZoom = this.techTreeZoom;
              if (this.canvasShell && typeof this.canvasShell.buildingOffset !== 'undefined') this.canvasShell.buildingOffset = this.buildingOffset;
              if (this.canvasShell && typeof this.canvasShell.activeBuildingCategory !== 'undefined') this.canvasShell.activeBuildingCategory = this.activeBuildingCategory;
              if (this.canvasShell && typeof this.canvasShell.famousPersonsPage !== 'undefined') this.famousPersonsPage = this.canvasShell.famousPersonsPage;
              if (this.canvasShell && typeof this.canvasShell.selectedFamousPersonId !== 'undefined') this.selectedFamousPersonId = this.canvasShell.selectedFamousPersonId;
              if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
              this.canvasShell.renderReadOnly(this.state, resolvedActiveTab);
              if (
                !this.pendingTutorialAdvisorDialogue
                && !this.tutorialAdvisorDialogue
                && !this.canvasShell?.tutorialAdvisorDialogue
              ) {
                this.tutorialController?.refreshCurrentHighlight?.();
              }
              return true;
            }
            if (!this.renderer?.render) return false;
            const runtimeCanRenderWorldMap = Boolean(homeView.isMapHome
              && this.ensureWorldMapRuntimeCoordinator()?.canRender(this.state));
            const worldMapLayerRendered = runtimeCanRenderWorldMap
              ? (this.shouldRenderRuntimeWorldMap()
                ? this.renderRuntimeWorldMap() !== false
                : Boolean(this.worldMapRuntime?.hasBakedMapLayer))
              : false;
            this.renderer.render(this.state, {
              activeTab: resolvedActiveTab,
              isMapHome: homeView.isMapHome,
              skipWorldMapLayer: worldMapLayerRendered,
              preserveCanvas: worldMapLayerRendered,
              showResourceDetails: this.showResourceDetails,
              showCitySwitcher: this.showCitySwitcher,
              showSubcityList: this.showSubcityList,
              showCityManagement: this.showCityManagement,
              activeCityManagementTab: this.activeCityManagementTab,
              showTaskCenter: this.showTaskCenter,
              activeTaskCenterTab: this.activeTaskCenterTab,
              showGuidebook: this.showGuidebook,
              activeGuidebookTab: this.activeGuidebookTab,
              showFamousPersons: this.showFamousPersons,
              famousPersonsPage: this.canvasShell?.famousPersonsPage ?? this.famousPersonsPage,
              selectedFamousPersonId: this.canvasShell?.selectedFamousPersonId ?? this.selectedFamousPersonId,
              showTalentPolicy: this.showTalentPolicy,
              talentPolicyUiState: this.talentPolicyUiState,
              armyFormationEditor: this.canvasShell && 'armyFormationEditor' in this.canvasShell
                ? this.canvasShell.armyFormationEditor
                : this.armyFormationEditor,
              activeCommandPanel: this.activeCommandPanel || '',
              rewardReveal: this.rewardReveal,
              buildingOffset: this.buildingOffset,
              techTreePanX: this.techTreePanX,
              techTreePanY: this.techTreePanY,
              techTreeZoom: this.getTechTreeZoom(),
              selectedTechId: this.state?.techUiState?.selectedTechId || this.canvasShell?.selectedTechId || '',
              techDetailOpen: this.techDetailOpen || Boolean(this.state?.techUiState?.detailOpen || this.canvasShell?.techDetailOpen),
              activeBuildingCategory: this.activeBuildingCategory,
              pendingBuildingAction: this.pendingBuildingAction || this.canvasShell?.pendingBuildingAction || null,
              ...(this.pageTransition ? { pageTransition: this.pageTransition } : {}),
              ...(this.buildingTransition ? { buildingTransition: this.buildingTransition } : {}),
              activeEventId: this.activeEventId,
              territoryUiState: this.territoryUiState,
              ...(this.battleScene ? { battleScene: this.battleScene } : {}),
              naming: this.naming,
              tutorialIntro: this.tutorialIntro || null,
              tutorialAdvisorDialogue: this.tutorialAdvisorDialogue || null,
              tutorialHighlight: null,
              loading: this.loading,
              network: this.networkState,
            });
            const waterAnimated = Boolean(this.territoryUiState?.tileMapWaterAnimated
              || this.territoryController?.uiState?.tileMapWaterAnimated);
            const explorerAnimated = Boolean(this.state?.worldExplorerState?.activeMission);
            if (resolvedActiveTab === 'military' && (waterAnimated || explorerAnimated)) this.startTileMapWaterTimer();
            else this.stopTileMapWaterTimer();
            return true;
          },

      startTileMapWaterTimer() {
            if (this.tileMapWaterTimer) return false;
            const timerHost = typeof this.scheduler?.setInterval === 'function'
              ? this.scheduler
              : (typeof this.runtime?.setInterval === 'function' ? this.runtime : null);
            const setIntervalFn = timerHost?.setInterval || (typeof setInterval === 'function' ? setInterval : null);
            if (!setIntervalFn) return false;
            this.tileMapWaterTimer = timerHost
              ? setIntervalFn.call(timerHost, () => {
                if ((this.state?.currentTab || this.getActiveTab()) !== 'military') {
                  this.stopTileMapWaterTimer();
                  return;
                }
                if (this.isWorldMapDragging() || this.isWorldMapDragCoolingDown()) return;
                if (this.state?.worldExplorerState?.activeMission) {
                  this.renderRuntimeWorldMap({ force: true });
                  this.renderAnimationFrame('military');
                  return;
                }
                if (this.isWorldMapHomeActive() && !this.shouldRenderRuntimeWorldMap()) {
                  this.renderRuntimeWorldMap({
                    reuseCachedWorldTileView: true,
                    snapshotOnly: true,
                    waterTimeMs: this.now(),
                  });
                  return;
                }
                this.renderAnimationFrame('military');
              }, this.getWorldTileWaterAnimationFrameMs())
              : setIntervalFn(() => {
                if ((this.state?.currentTab || this.getActiveTab()) !== 'military') {
                  this.stopTileMapWaterTimer();
                  return;
                }
                if (this.isWorldMapDragging() || this.isWorldMapDragCoolingDown()) return;
                if (this.state?.worldExplorerState?.activeMission) {
                  this.renderRuntimeWorldMap({ force: true });
                  this.renderAnimationFrame('military');
                  return;
                }
                if (this.isWorldMapHomeActive() && !this.shouldRenderRuntimeWorldMap()) {
                  this.renderRuntimeWorldMap({
                    reuseCachedWorldTileView: true,
                    snapshotOnly: true,
                    waterTimeMs: this.now(),
                  });
                  return;
                }
                this.renderAnimationFrame('military');
              }, this.getWorldTileWaterAnimationFrameMs());
            return true;
          },

      stopTileMapWaterTimer() {
            if (!this.tileMapWaterTimer) return;
            if (typeof this.scheduler?.clearInterval === 'function') this.scheduler.clearInterval(this.tileMapWaterTimer);
            else if (typeof this.runtime?.clearInterval === 'function') this.runtime.clearInterval(this.tileMapWaterTimer);
            else if (typeof clearInterval === 'function') clearInterval(this.tileMapWaterTimer);
            this.tileMapWaterTimer = null;
          },

      showLoading(message = '') {
            this.loading = {
              visible: true,
              percentage: 0,
              message: message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90',
            };
            this.canvasShell?.showLoading?.(this.loading.message);
            this.renderCanvasSurface();
            return true;
          },

      updateLoading(progress = {}) {
            if (!this.loading.visible && !this.canvasShell?.loading?.visible) return false;
            this.loading = {
              ...this.loading,
              visible: true,
              percentage: Math.max(0, Math.min(100, Number(progress.percentage) || 0)),
              message: progress.message || this.loading.message,
            };
            this.canvasShell?.updateLoading?.(this.loading);
            this.renderCanvasSurface();
            return true;
          },

      hideLoading() {
            const hadLoading = Boolean(this.loading.visible || this.canvasShell?.loading?.visible);
            this.loading = {
              visible: false,
              percentage: 100,
              message: '',
            };
            this.canvasShell?.hideLoading?.();
            if (hadLoading) this.renderCanvasSurface();
            return hadLoading;
          },

      preloadAssets(onProgress = null, assetPaths = null) {
            if (this.canvasShell && typeof this.canvasShell.preloadAssets === 'function') {
              return this.canvasShell.preloadAssets(onProgress, assetPaths);
            }
            if (!this.renderer || typeof this.renderer.preloadAssets !== 'function') {
              onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
              return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
            }
            return this.renderer.preloadAssets(assetPaths || undefined, onProgress);
          },

      now() {
            return this.runtime?.now?.() || Date.now();
          },

      wait(ms = 0) {
            const delay = Math.max(0, Number(ms) || 0);
            if (delay <= 0) return Promise.resolve();
            if (this.scheduler && typeof this.scheduler.setTimeout === 'function') {
              return new Promise((resolve) => this.scheduler.setTimeout(resolve, delay));
            }
            if (typeof setTimeout === 'function') {
              return new Promise((resolve) => setTimeout(resolve, delay));
            }
            return Promise.resolve();
          },

      async loadGameAssets(options = {}) {
            const message = options.message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90';
            const hideWhenDone = options.hideWhenDone !== false;
            const minimumDurationMs = Number.isFinite(options.minimumDurationMs)
              ? Math.max(0, options.minimumDurationMs)
              : 3000;
            const startedAt = this.now();
            this.showLoading(message);
            try {
              const result = await this.preloadAssets((progress) => {
                this.updateLoading({ ...progress, message });
              }, options.assetPaths || null);
              const elapsed = Math.max(0, this.now() - startedAt);
              await this.wait(Math.max(0, minimumDurationMs - elapsed));
              return result;
            } finally {
              this.updateLoading({ percentage: 100, message });
              if (hideWhenDone) this.hideLoading();
            }
          },

      getActiveTab() {
            return this.activeTab || this.state?.currentTab || 'resources';
          },

      resolveMapHomeViewState(state = this.state, options = {}) {
            if (this.presenter?.resolveMapHomeViewState) {
              return this.presenter.resolveMapHomeViewState(state || {}, options);
            }
            const requestedTab = options.requestedTab || options.activeTab || state?.currentTab || 'resources';
            const hasTiles = Array.isArray(state?.territoryState?.worldMap?.tiles) && state.territoryState.worldMap.tiles.length > 0;
            const canUseMapHome = true;
            const requestedMilitaryView = options.militaryView || state?.militaryView || 'army';
            const militaryMapRequested = requestedTab === 'military'
              && (options.forceMapHome || options.isMapHome || requestedMilitaryView === 'world');
            const shouldUseMapHome = canUseMapHome
              && options.allowDefaultMapHome !== false
              && (options.forceMapHome || requestedTab === 'resources' || requestedTab === 'territory' || militaryMapRequested);
            return {
              activeTab: shouldUseMapHome ? 'military' : (requestedTab === 'territory' ? 'military' : requestedTab),
              requestedTab,
              militaryView: shouldUseMapHome ? 'world' : requestedMilitaryView,
              isMapHome: Boolean(shouldUseMapHome),
              canUseMapHome,
            };
          },

      getTabOrder() {
            return ['resources', 'buildings', 'tech', 'events', 'civilization', 'military'];
          },

      getTransitionDurationMs() {
            return 220;
          },

      getAnimationFrameMs() {
            return this.canvasShell?.getAnimationFrameMs?.() || 16;
          },

      getWorldTileWaterAnimationFrameMs() {
            if (this.canvasShell?.getWorldTileWaterAnimationFrameMs) return this.canvasShell.getWorldTileWaterAnimationFrameMs();
            const fps = Number(this.renderer?.getWorldTileWaterAnimationFps?.() || 8);
            return Math.max(this.getAnimationFrameMs(), Math.round(1000 / Math.max(1, fps)));
          },

      getFrozenWorldMapWaterTimeMs() {
            if (
              this.worldMapDragWaterTimeMs === null
              || this.worldMapDragWaterTimeMs === undefined
              || !Number.isFinite(Number(this.worldMapDragWaterTimeMs))
            ) {
              this.worldMapDragWaterTimeMs = this.now();
            }
            return this.worldMapDragWaterTimeMs;
          },

      isWorldMapDragging() {
            return this.worldMapDragWaterTimeMs !== null
              && this.worldMapDragWaterTimeMs !== undefined
              && Number.isFinite(Number(this.worldMapDragWaterTimeMs));
          },

      isWorldMapDragCoolingDown() {
            return Number(this.worldMapDragCooldownUntil) > this.now();
          },

      getWorldMapDragCooldownMs() {
            return 220;
          },

      startWorldMapSnapshotDrag() {
            this.worldMapDragWaterTimeMs = this.now();
            return this.worldMapDragWaterTimeMs;
          },

      finishWorldMapSnapshotDrag() {
            this.worldMapDragCooldownUntil = this.now() + this.getWorldMapDragCooldownMs();
            this.worldMapDragWaterTimeMs = null;
            this.worldMapPinchDragging = false;
            if (this.worldMapRuntime) this.worldMapRuntime.waterTimeMs = null;
          },

      renderWorldMapSnapshotDragFrame() {
            if (!this.renderer || typeof this.renderer.renderWorldMapSnapshotLayer !== 'function') return false;
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            const runtime = coordinator?.getMapRuntime?.();
            if (!runtime || !coordinator?.canRender?.(this.state)) return false;
            const territoryUiState = runtime.getCameraUiState?.() || this.territoryUiState;
            const topBarBottom = typeof this.renderer.getTopBarBottom === 'function'
              ? this.renderer.getTopBarBottom(this.state, { isMapHome: true })
              : 84;
            const rendered = this.renderer.renderWorldMapSnapshotLayer(this.state, {
              activeTab: 'military',
              isMapHome: true,
              territoryUiState,
              topBarBottom,
              frameless: true,
              preserveOnMiss: false,
              reuseCachedWorldTileView: true,
              snapshotOnly: true,
              waterTimeMs: this.now(),
              showFpsOverlay: false,
            });
            if (!rendered) return false;
            this.renderer.render(this.state, {
              activeTab: 'military',
              isMapHome: true,
              skipWorldMapLayer: true,
              preserveCanvas: true,
              territoryUiState,
              network: this.networkState,
            });
            return true;
          },

      getWorldMapSnapshotRenderOptions(waterTimeMs = this.getFrozenWorldMapWaterTimeMs()) {
            const hasWaterTimeMs = waterTimeMs !== null
              && waterTimeMs !== undefined
              && Number.isFinite(Number(waterTimeMs));
            const resolvedWaterTimeMs = hasWaterTimeMs
              ? Number(waterTimeMs)
              : this.getFrozenWorldMapWaterTimeMs();
            return {
              force: true,
              reuseCachedWorldTileView: true,
              snapshotOnly: true,
              waterTimeMs: resolvedWaterTimeMs,
            };
          },

      ensureWorldMapRuntimeCoordinator() {
            if (this.worldMapRuntimeCoordinator) return this.worldMapRuntimeCoordinator;
            const CoordinatorCtor = WorldMapRuntimeCoordinatorBase || global.WorldMapRuntimeCoordinator;
            if (!CoordinatorCtor) return null;
            this.worldMapRuntimeCoordinator = new CoordinatorCtor({
              host: this,
              worldMapRuntime: this.worldMapRuntime,
              useWorldMapRuntime: this.useWorldMapRuntime,
              renderOnDrag: false,
              getRenderer: () => this.renderer,
              getPresenter: () => this.presenter,
              getState: () => this.state || {},
              getBaseUiState: () => this.territoryController?.uiState
                || this.territoryController?.getUiState?.()
                || this.territoryUiState
                || {},
              getLocalUiState: () => this.territoryUiState || {},
              getTerritoryController: () => this.territoryController,
              getTopBarBottom: (state) => (typeof this.renderer?.getTopBarBottom === 'function'
                ? this.renderer.getTopBarBottom(state, { isMapHome: true })
                : 84),
              getRequestedTab: (state = this.state) => state?.currentTab || this.activeTab || 'resources',
              getMilitaryView: (state = this.state) => state?.militaryView || this.militaryView,
              getForceMapHome: () => this.mapHomeActive,
              canRouteTap: (point) => !this.isPointBlockedByTutorialShield(point),
              onAction: (action) => {
                const handled = this.actionController?.handle?.(action);
                this.advanceTutorialIntroAfterHandled(handled, action);
                return handled;
              },
              onBeforeDrag: ({ phase, runtime }) => {
                if (phase === 'start') {
                  const waterTimeMs = this.startWorldMapSnapshotDrag();
                  if (runtime) runtime.waterTimeMs = waterTimeMs;
                }
              },
              onAfterDrag: ({ phase, handled }) => {
                if (handled && phase === 'move') this.renderWorldMapSnapshotDragFrame();
                if (handled && (phase === 'end' || phase === 'cancel')) this.finishWorldMapSnapshotDrag();
              },
            });
            return this.worldMapRuntimeCoordinator;
          },

      ensureWorldMapRuntime() {
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            if (!coordinator) return this.worldMapRuntime;
            this.worldMapRuntime = coordinator.ensureRuntime();
            return this.worldMapRuntime;
          },

      isWorldMapHomeActive() {
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            if (coordinator) return coordinator.isMapHomeActive(this.state);
            const homeView = this.resolveMapHomeViewState(this.state, {
              requestedTab: this.state?.currentTab || this.activeTab || 'resources',
              militaryView: this.state?.militaryView || this.militaryView,
              forceMapHome: this.mapHomeActive,
            });
            return Boolean(homeView.isMapHome && homeView.activeTab === 'military' && homeView.militaryView === 'world');
          },

      renderRuntimeWorldMap(options = {}) {
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            if (!coordinator) return false;
            const rendered = coordinator.render(this.state, options);
            this.worldMapRuntime = coordinator.getMapRuntime();
            return rendered;
          },

      shouldRenderRuntimeWorldMap(options = {}) {
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            const runtime = coordinator?.getMapRuntime?.();
            if (!coordinator?.canRender?.(this.state)) return false;
            if (!runtime || typeof runtime.isMapBakeDirty !== 'function') return true;
            return Boolean(options.force || runtime.isMapBakeDirty(this.state, options));
          },

      refreshWorldMapLayerFromSnapshot(options = {}) {
            const coordinator = this.ensureWorldMapRuntimeCoordinator();
            const runtime = coordinator?.getMapRuntime?.();
            if (!runtime || !this.renderer || typeof this.renderer.renderWorldMapSnapshotLayer !== 'function') return false;
            const territoryUiState = runtime.getCameraUiState?.() || this.territoryUiState;
            const rendered = this.renderer.renderWorldMapSnapshotLayer(this.state, {
              activeTab: 'military',
              isMapHome: true,
              territoryUiState,
              topBarBottom: typeof this.renderer.getTopBarBottom === 'function'
                ? this.renderer.getTopBarBottom(this.state, { isMapHome: true })
                : 84,
              frameless: true,
              preserveOnMiss: true,
              reuseCachedWorldTileView: true,
              snapshotOnly: true,
              waterTimeMs: options.waterTimeMs ?? this.worldMapDragWaterTimeMs,
              showFpsOverlay: false,
            });
            if (!rendered) return false;
            if (options.commitCamera !== false) runtime.markBakedCamera?.(runtime.camera);
            return true;
          },

      getRequestAnimationFrame() {
            const raf = this.runtime?.requestAnimationFrame || global.requestAnimationFrame;
            return typeof raf === 'function' ? raf.bind(this.runtime || global) : null;
          },

      renderAnimationFrame(activeTab = this.state?.currentTab || this.getActiveTab()) {
            if (this.canvasShell && typeof this.canvasShell.renderAnimationFrame === 'function') {
              return this.canvasShell.renderAnimationFrame();
            }
            const now = this.now();
            const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
            if (this.lastAnimationRenderAt && now - this.lastAnimationRenderAt < frameMs) return false;
            this.lastAnimationRenderAt = now;
            return this.renderCanvasSurface(activeTab);
          },

      requestRenderAnimationFrame(activeTab = this.state?.currentTab || this.getActiveTab()) {
            const resolvedActiveTab = typeof activeTab === 'string'
              ? activeTab
              : (this.state?.currentTab || this.getActiveTab());
            if (this.canvasShell && typeof this.canvasShell.requestRenderAnimationFrame === 'function') {
              return this.canvasShell.requestRenderAnimationFrame();
            }
            if (this.animationRenderQueued) return true;
            const raf = this.getRequestAnimationFrame();
            if (!raf) return this.renderAnimationFrame(resolvedActiveTab);
            this.animationRenderQueued = true;
            raf(() => {
              this.animationRenderQueued = false;
              this.renderAnimationFrame(resolvedActiveTab);
            });
            return true;
          },

      startTransitionTimer() {
            if (this.canvasShell && typeof this.canvasShell.startTransitionTimer === 'function') {
              if (typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = this.pageTransition;
              if (typeof this.canvasShell.buildingTransition !== 'undefined') this.canvasShell.buildingTransition = this.buildingTransition;
              return this.canvasShell.startTransitionTimer();
            }
            if (this.transitionTimer || !this.runtime?.setInterval) return false;
            this.transitionTimer = this.runtime.setInterval(() => {
              const now = this.now();
              const duration = this.getTransitionDurationMs();
              const pageDone = !this.pageTransition || now - this.pageTransition.startedAt >= (this.pageTransition.durationMs || duration);
              const buildingDone = !this.buildingTransition || now - this.buildingTransition.startedAt >= (this.buildingTransition.durationMs || duration);
              if (pageDone) this.pageTransition = null;
              if (buildingDone) this.buildingTransition = null;
              if (!this.pageTransition && !this.buildingTransition) this.stopTransitionTimer();
              this.renderAnimationFrame(this.state?.currentTab || this.getActiveTab());
            }, this.getAnimationFrameMs());
            return true;
          },

      stopTransitionTimer() {
            if (!this.transitionTimer) return;
            this.runtime?.clearInterval?.(this.transitionTimer);
            this.transitionTimer = null;
          },

      startPageTransition(fromTab, toTab, options = {}) {
            const buildingOffset = this.canvasShell && Number.isFinite(Number(this.canvasShell.buildingOffset))
              ? Number(this.canvasShell.buildingOffset)
              : this.buildingOffset;
            if (!fromTab || !toTab || fromTab === toTab) {
              this.pageTransition = null;
              if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') this.canvasShell.pageTransition = null;
              return false;
            }
            const tabs = this.getTabOrder();
            const fromIndex = tabs.indexOf(fromTab);
            const toIndex = tabs.indexOf(toTab);
            this.pageTransition = {
              fromTab,
              toTab,
              direction: toIndex >= 0 && fromIndex >= 0 && toIndex < fromIndex ? -1 : 1,
              startedAt: this.now(),
              durationMs: this.getTransitionDurationMs(),
              fromBuildingOffset: options.fromBuildingOffset ?? buildingOffset,
            };
            if (this.canvasShell && typeof this.canvasShell.pageTransition !== 'undefined') {
              this.canvasShell.pageTransition = this.pageTransition;
            }
            this.startTransitionTimer();
            return true;
          },

      scrollBuildings(action = {}) {
            if (this.canvasShell && typeof this.canvasShell.scrollBuildings === 'function') {
              const scrolled = this.canvasShell.scrollBuildings(action);
              this.buildingOffset = this.canvasShell.buildingOffset;
              this.buildingTransition = this.canvasShell.buildingTransition;
              return scrolled;
            }
            const fromOffset = Math.max(0, Number(this.buildingOffset) || 0);
            const delta = Number(action.delta) || 0;
            const toOffset = Math.max(0, fromOffset + delta);
            this.buildingOffset = toOffset;
            if (toOffset !== fromOffset) {
              this.buildingTransition = {
                fromOffset,
                toOffset,
                direction: toOffset < fromOffset ? -1 : 1,
                startedAt: this.now(),
                durationMs: this.getTransitionDurationMs(),
              };
              this.startTransitionTimer();
            }
            return true;
          },

      selectBuildingCategory(action = {}) {
            const category = action.category || 'all';
            const previous = this.activeBuildingCategory || 'all';
            if (this.canvasShell && typeof this.canvasShell.selectBuildingCategory === 'function') {
              const changed = this.canvasShell.selectBuildingCategory(action);
              this.activeBuildingCategory = this.canvasShell.activeBuildingCategory;
              this.buildingOffset = this.canvasShell.buildingOffset;
              this.buildingTransition = this.canvasShell.buildingTransition;
              return changed !== false && category !== previous;
            }
            this.activeBuildingCategory = category;
            this.buildingOffset = 0;
            this.buildingTransition = null;
            if (this.canvasShell && typeof this.canvasShell.activeBuildingCategory !== 'undefined') {
              this.canvasShell.activeBuildingCategory = category;
              this.canvasShell.buildingOffset = 0;
              this.canvasShell.techTreePanX = 0;
              this.canvasShell.techTreePanY = 0;
              this.canvasShell.techTreeZoom = 1;
              this.canvasShell.buildingTransition = null;
            }
            return category !== previous;
          },

      getCanvasActionState() {
            return this.state;
          },

      getTechTreePan() {
            return {
              x: Number(this.techTreePanX) || 0,
              y: Number(this.techTreePanY) || 0,
            };
          },

      setTechTreePan(pan = {}) {
            const x = Number(pan.x) || 0;
            const y = Number(pan.y) || 0;
            this.techTreePanX = x;
            this.techTreePanY = y;
            if (this.canvasShell && typeof this.canvasShell === 'object') {
              this.canvasShell.techTreePanX = x;
              this.canvasShell.techTreePanY = y;
            }
            return true;
          },

      getTechTreeZoom() {
            return Math.max(0.65, Math.min(1.6, Number(this.techTreeZoom) || 1));
          },

      setTechTreeZoom(zoom = 1) {
            const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
            this.techTreeZoom = nextZoom;
            if (this.canvasShell && typeof this.canvasShell === 'object') this.canvasShell.techTreeZoom = nextZoom;
            return true;
          },

      renderCanvasAction() {
            return this.renderCanvasSurface();
          },

      changeFamousPersonsPage(action = {}) {
            const delta = Number(action.delta) || 0;
            this.famousPersonsPage = Math.max(0, (Number(this.famousPersonsPage) || 0) + delta);
            this.selectedFamousPersonId = '';
            if (this.canvasShell && typeof this.canvasShell === 'object') {
              this.canvasShell.famousPersonsPage = this.famousPersonsPage;
              if ('selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
            }
            this.renderer?.clearFamousSkillTooltip?.();
            return this.renderCanvasSurface();
          },

      openFamousPersonDetail(action = {}) {
            this.selectedFamousPersonId = action.personId || '';
            if (this.canvasShell && typeof this.canvasShell === 'object' && 'selectedFamousPersonId' in this.canvasShell) {
              this.canvasShell.selectedFamousPersonId = this.selectedFamousPersonId;
            }
            this.renderer?.clearFamousSkillTooltip?.();
            return this.renderCanvasSurface();
          },

      closeFamousPersonDetail() {
            this.selectedFamousPersonId = '';
            if (this.canvasShell && typeof this.canvasShell === 'object' && 'selectedFamousPersonId' in this.canvasShell) {
              this.canvasShell.selectedFamousPersonId = '';
            }
            this.renderer?.clearFamousSkillTooltip?.();
            return this.renderCanvasSurface();
          },

      resetForCanvasTabSwitch() {
            this.showResourceDetails = false;
            this.showCitySwitcher = false;
            this.showSubcityList = false;
            this.showCityManagement = false;
            this.activeEventId = null;
            this.showTaskCenter = false;
            this.showGuidebook = false;
            this.showFamousPersons = false;
            this.showTalentPolicy = false;
            this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
            this.activeCommandPanel = '';
            this.rewardReveal = null;
            this.famousPersonsPage = 0;
            this.selectedFamousPersonId = '';
            if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
            if (this.canvasShell) this.canvasShell.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
            this.renderer?.clearFamousSkillTooltip?.();
            this.activeBuildingCategory = 'all';
            this.buildingOffset = 0;
            this.techTreePanX = 0;
            this.techTreePanY = 0;
            this.techTreeZoom = 1;
            this.techDetailOpen = false;
            if (this.canvasShell) this.canvasShell.selectedTechId = '';
            if (this.canvasShell) this.canvasShell.techDetailOpen = false;
            this.state = {
              ...this.state,
              techUiState: {
                ...(this.state.techUiState || {}),
                selectedTechId: '',
                detailOpen: false,
              },
            };
            this.techTreeDragStart = null;
            this.buildingTransition = null;
          },

      resetLocalViewToResources(options = {}) {
            const homeView = this.resolveMapHomeViewState(this.state, { requestedTab: 'resources', forceMapHome: true });
            this.activeTab = homeView.activeTab;
            this.militaryView = homeView.militaryView;
            this.mapHomeActive = homeView.isMapHome;
            this.buildingOffset = 0;
            this.activeBuildingCategory = 'all';
            this.techTreePanX = 0;
            this.techTreePanY = 0;
            this.techTreeZoom = 1;
            this.techDetailOpen = false;
            this.techTreeDragStart = null;
            this.activeEventId = null;
            this.territoryUiState = {
              ...(this.territoryUiState || {}),
              selectedSiteId: '',
              worldMarchTarget: null,
              selectedWorldActorId: '',
              expeditionConfigSiteId: '',
              expeditionSoldiers: '',
              expeditionTroopType: '',
              expeditionLeader: '',
            };
            this.territoryController?.closeSiteDialog?.({ render: false });
            this.showResourceDetails = false;
            this.showCitySwitcher = false;
            this.showSubcityList = false;
            this.showCityManagement = false;
            this.showTaskCenter = false;
            this.showGuidebook = false;
            this.showFamousPersons = false;
            this.showTalentPolicy = false;
            this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
            this.activeCommandPanel = '';
            this.famousPersonsPage = 0;
            this.selectedFamousPersonId = '';
            this.renderer?.clearFamousSkillTooltip?.();
            this.activeTaskCenterTab = 'main';
            this.activeGuidebookTab = 'planning';
            this.activeGuideNavigation = null;
            this.pageTransition = null;
            this.buildingTransition = null;
            if (this.canvasShell) this.canvasShell.selectedTechId = '';
            if (this.canvasShell) this.canvasShell.techDetailOpen = false;
            if (this.canvasShell && 'selectedFamousPersonId' in this.canvasShell) this.canvasShell.selectedFamousPersonId = '';
            if (this.canvasShell) {
              this.canvasShell.territoryUiState = {
                ...(this.canvasShell.territoryUiState || {}),
                selectedSiteId: '',
                worldMarchTarget: null,
                selectedWorldActorId: '',
                expeditionConfigSiteId: '',
                expeditionSoldiers: '',
                expeditionTroopType: '',
                expeditionLeader: '',
              };
              this.canvasShell.closeWorldSiteHud?.({ render: false });
            }
            if (this.canvasShell) this.canvasShell.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], page: 0, saving: false };
            if (this.state && typeof this.state === 'object') {
              this.state = {
                ...this.state,
                currentTab: homeView.activeTab,
                militaryView: homeView.militaryView,
                techUiState: {
                  ...(this.state.techUiState || {}),
                  selectedTechId: '',
                  detailOpen: false,
                },
              };
            }
            if (!options.skipShell && this.canvasShell?.resetLocalViewToResources) {
              this.canvasShell.resetLocalViewToResources({ skipGame: true, skipRender: true });
            }
            if (!options.skipRender) this.renderCanvasSurface(homeView.activeTab);
            return true;
          },

      switchTab(tab) {
            const previousTab = this.getActiveTab();
            const previousBuildingOffset = this.buildingOffset;
            this.resetForCanvasTabSwitch();
            const navigation = this.presenter?.buildTabNavigationViewState?.(this.state, { requestedTab: tab });
            this.activeTab = navigation?.activeTab || tab || 'resources';
            const preferredMilitaryView = this.getPreferredMilitaryView(tab);
            const homeView = this.resolveMapHomeViewState(this.state, {
              requestedTab: this.activeTab,
              militaryView: preferredMilitaryView || this.state?.militaryView || this.militaryView,
              forceMapHome: tab === 'resources',
            });
            this.activeTab = homeView.activeTab;
            this.mapHomeActive = homeView.isMapHome;
            this.state = {
              ...this.state,
              currentTab: this.activeTab,
              militaryView: homeView.militaryView,
              techUiState: {
                ...(this.state.techUiState || {}),
                detailOpen: false,
              },
            };
            if (preferredMilitaryView && !homeView.isMapHome) this.state.militaryView = preferredMilitaryView;
            this.militaryView = this.state.militaryView || homeView.militaryView;
            this.buildingOffset = 0;
            this.techTreePanX = 0;
            this.techTreePanY = 0;
            this.techTreeZoom = 1;
            this.techDetailOpen = false;
            this.techTreeDragStart = null;
            this.buildingTransition = null;
            if (this.canvasShell) this.canvasShell.techDetailOpen = false;
            if (this.canvasShell) this.canvasShell.techTreeZoom = 1;
            this.startPageTransition(previousTab, this.activeTab, { fromBuildingOffset: previousBuildingOffset });
            this.activeEventId = null;
            this.showTalentPolicy = false;
            this.renderMilitaryView();
            this.renderCanvasSurface(this.state.currentTab);
            if (this.skipNextSoftGuideRender) {
              this.skipNextSoftGuideRender = false;
              if (this.activeGuideNavigation?.target === 'scout-action-first') {
                this.activeGuideNavigation = null;
                this.renderSoftGuide();
              }
            } else {
              this.renderSoftGuide();
            }
          },

      getPreferredMilitaryView(tabId) {
            if (tabId === 'territory') return 'world';
            if (tabId !== 'military') return null;
            const guide = this.state?.softGuide || {};
            const target = guide.target || '';
            const message = String(guide.message || '');
            if (target === 'scout-action-first') return 'scout';
            if (target === 'tab-territory') return 'world';
            if (target !== 'tab-military') return null;
            if (/渚﹀療|鎺㈢储/.test(message)) return 'scout';
            if (/棰嗗湡|鐤嗗煙|涓栫晫|鍗犻/.test(message)) return 'world';
            return null;
          },

      switchMilitaryView(view) {
            const allowed = ['army', 'scout', 'world'];
            this.militaryView = allowed.includes(view) ? view : 'army';
            this.mapHomeActive = this.militaryView === 'world' && this.resolveMapHomeViewState(this.state, {
              requestedTab: this.state?.currentTab || this.activeTab,
              militaryView: this.militaryView,
              forceMapHome: this.mapHomeActive,
            }).isMapHome;
            this.state = { ...this.state, militaryView: this.militaryView };
            this.renderMilitaryView();
            this.renderCanvasSurface(this.state?.currentTab);
            return true;
          },

      renderMilitaryView() {
            if (this.resolveMapHomeViewState(this.state, {
              requestedTab: this.state?.currentTab || this.activeTab,
              militaryView: this.state?.militaryView || this.militaryView,
              forceMapHome: this.mapHomeActive,
            }).isMapHome) {
              this.militaryView = 'world';
              if (this.state) this.state.militaryView = 'world';
              return;
            }
            const view = this.presenter?.buildMilitaryNavigationViewState?.(this.state);
            if (view?.activeView) {
              this.militaryView = view.activeView;
              if (this.state) this.state.militaryView = view.activeView;
            }
          },

      updateMilitaryViewLocks() {
            this.renderMilitaryView();
          },

      renderMilitary() {
            this.updateMilitaryViewLocks();
            this.renderCanvasSurface(this.state?.currentTab);
          },

      startScoutCountdownTimer() {
            if (this.scoutCountdownTimer) return;
            this.scoutCountdownTimer = this.scheduler?.setInterval?.(() => {
              if ((this.state?.currentEra || 0) < 5) return;
              if (
                this.canvasShell?.isWorldMapDragging?.()
                || this.canvasShell?.hasPendingWorldMapCompositeCommit?.()
              ) return;
              if (this.state?.currentTab === 'military') this.renderCanvasSurface(this.state.currentTab);
              if (this.state?.currentTab === 'territory') {
                const territories = this.state.territoryState?.territories || [];
                const hasConquestMission = territories.some((site) => site.mission?.status === 'active');
                if (hasConquestMission) this.renderTerritory();
              }
            }, 1000);
          },

      renderTerritory() {
            this.renderCanvasSurface(this.state?.currentTab);
          },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppRenderingRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
