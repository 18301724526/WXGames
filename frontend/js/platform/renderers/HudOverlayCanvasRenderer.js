(function (global) {

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }
  const SharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class HudOverlayCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    getMapHomeWorldHudContext(options = {}) {
      const contexts = [
        this.lastMapHomeWorldHudContext,
        this.worldMapLayerRenderer?.lastMapHomeWorldHudContext,
        options.worldMapRuntimeContext,
        this.lastWorldTileMapContext,
        this.worldMapRenderer?.lastWorldTileMapContext,
        this.worldMapLayerRenderer?.lastWorldTileMapContext,
      ].filter(Boolean);
      const selectedActorId = options.territoryUiState?.selectedWorldActorId || '';
      if (selectedActorId) {
        const matchingContext = contexts.find((context) => {
          const actors = this.getMapHomeWorldHudActors(context, options);
          return actors.some((actor) => actor?.id === selectedActorId || actor?.missionId === selectedActorId);
        });
        if (matchingContext) return matchingContext;
      }
      return contexts[0] || null;
    }

    getMapHomeWorldHudActors(context = null, options = {}) {
      const contextActors = Array.isArray(context?.actors)
        ? context.actors
        : (Array.isArray(context?.renderSnapshot?.actors) ? context.renderSnapshot.actors : []);
      if (contextActors.length) return contextActors;
      const state = options.state || this.lastGame?.state || this.host?.lastGame?.state || {};
      const explorerState = state?.worldExplorerState;
      if (!explorerState || !SharedWorldMarchSystem?.buildActors) return contextActors;
      return SharedWorldMarchSystem.buildActors(explorerState, {
        nowMs: options.epochNowMs ?? options.nowMs ?? Date.now(),
      });
    }

    renderMapHomeWorldMarchHud(state = {}, options = {}) {
      if (options.isMapHome !== true || (options.activeTab || 'resources') !== 'military') return false;
      if (typeof this.renderWorldMarchHud !== 'function') return false;
      const context = this.getMapHomeWorldHudContext({ ...options, state: options.state || state });
      const renderSnapshot = context?.renderSnapshot || null;
      const uiState = options.territoryUiState || context?.uiState || renderSnapshot?.ui || {};
      const actors = this.getMapHomeWorldHudActors(context, { ...options, state: options.state || state });
      const viewport = context?.viewport || renderSnapshot?.viewport || {};
      const geometry = context?.geometry || renderSnapshot?.geometry || context?.tileMapView?.geometry || {};
      const frame = context?.frame || renderSnapshot?.frame || {};
      return this.renderWorldMarchHud(options.state || state, uiState, actors, viewport, geometry, frame, options.targetPicker || null);
    }

    isCanvasDebugResetBlocked(options = {}) {
      return Boolean(
        options.tutorialAdvisorDialogue
        || options.tutorialIntro?.active
        || options.tutorialHighlight,
      );
    }

    renderCanvasDebugResetIfAllowed(options = {}) {
      if (this.isCanvasDebugResetBlocked(options)) return false;
      return this.renderCanvasDebugResetButton?.(options) || false;
    }

    renderHudOverlay(state = {}, options = {}) {
      const activeTab = options.activeTab || 'resources';
      this.beginFrame(options);
      this.setHitTargets([]);
      if (!options.preserveCanvas) this.clear();
      if (options.auth?.view?.loginPanelVisible) {
        if (options.preserveCanvas) this.clear();
        this.renderLoginPanel(options.auth);
        this.endFrame(options);
        return;
      }
      if (options.loading?.visible) {
        if (options.preserveCanvas) this.clear();
        this.renderLoadingScreen(options.loading);
        this.endFrame(options);
        return;
      }
      if (options.entityBattle?.visible) {
        if (options.preserveCanvas) this.clear();
        this.renderEntityBattleOverlay(state, options);
        this.endFrame(options);
        return;
      }
      if (options.battleScene?.visible) {
        if (options.preserveCanvas) this.clear();
        this.renderBattleSceneOverlay(state, options);
        this.endFrame(options);
        return;
      }
      const topBarBottom = this.renderTopBar(state, options);
      this.renderHudTabPageWithTransition(state, activeTab, topBarBottom, options);
      if (options.isMapHome && activeTab === 'military' && options.skipWorldMapLayer) {
        const runtimeTargetsAppended = Boolean(this.appendWorldMapRuntimeHitTargets?.(options.worldMapRuntimeHitTargets));
        this.collectMapHomeWorldSiteHitTargets(state, topBarBottom, {
          ...options,
          collectHitTargets: !runtimeTargetsAppended,
        });
      }
      if (options.isMapHome && activeTab === 'military') {
        this.renderMapHomeWorldMarchHud(state, options);
        this.renderMapHomeExplorerHud?.(state, topBarBottom, options);
      }
      this.renderTabs(activeTab, state, options);
      if (options.isMapHome && activeTab === 'military') {
        this.renderMapHomeOverlays(state, options);
        this.renderTutorialIntro(state, options);
        this.renderTutorialHighlight(options.tutorialHighlight || null);
        this.renderFloatingTexts(options.floatingTexts || []);
        this.renderRewardReveal(options.rewardReveal || null);
        this.renderNetworkOverlay(options.network || null);
        this.renderCanvasDebugResetIfAllowed(options);
        this.renderConfirmDialog?.(options.confirmDialog || null);
        this.endFrame(options);
        return;
      }
      if (options.showResourceDetails) {
        this.renderResourceDetailsPanel(state);
      }
      if (options.showSettings) {
        this.renderSettingsPanel();
      }
      if (options.showLogs) {
        this.renderLogsPanel(options.logs || []);
      }
      if (options.showCitySwitcher) {
        this.renderCitySwitcherMenu(state);
      }
      if (options.tutorialAdvisorDialogue) {
        this.renderTutorialAdvisorDialogue(
          options.tutorialAdvisorDialogue.message,
          options.tutorialAdvisorDialogue.advisorName || t('tutorial.advisorName'),
          { action: { type: 'closeAdvisor', source: options.tutorialAdvisorDialogue.source || 'tutorialAdvisorDialogue' } },
        );
      } else if (options.showAdvisor) {
        this.renderAdvisorPanel(state);
      }
      if (options.showTaskCenter) {
        this.renderTaskCenterPanel(state, options);
      }
      if (options.showGuidebook) {
        this.renderGuidebookPanel(state, options);
      }
      if (options.showFamousPersons) {
        this.renderFamousPersonsPanel(state, options);
      }
      if (options.armyFormationEditor?.open) {
        this.renderArmyFormationEditor(state, options);
      }
      if (options.activeEventId) {
        this.renderEventModal(state, options.activeEventId);
      }
      if (activeTab === 'tech' && (options.techDetailOpen || state.techUiState?.detailOpen)) {
        const view = this.presenter?.buildTechViewState?.({
          ...state,
          techUiState: {
            ...(state.techUiState || {}),
            ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
          },
          ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
        });
        this.renderTechDetailModal(view?.detail);
      }
      if (activeTab === 'military') {
        this.renderWorldSiteModal(state, options);
      }
      if (options.naming) {
        this.renderNamingModal(options.naming);
      }
      this.renderTutorialHighlight(options.tutorialHighlight || null);
      this.renderFloatingTexts(options.floatingTexts || []);
      this.renderRewardReveal(options.rewardReveal || null);
      this.renderNetworkOverlay(options.network || null);
      this.renderCanvasDebugResetIfAllowed(options);
      this.renderConfirmDialog?.(options.confirmDialog || null);
      this.endFrame(options);
    }
  }

  global.HudOverlayCanvasRenderer = HudOverlayCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HudOverlayCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
