(function (global) {
  const SharedWorldTime = (() => {
    if (global.WorldTime) return global.WorldTime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/foundation/WorldTime');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/system/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasFrameRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get ctx() { return this.host?.ctx || null; }
    get width() { return Number(this.host?.width) || 0; }
    get height() { return Number(this.host?.height) || 0; }
    get bottomSafeArea() { return Number(this.host?.bottomSafeArea) || 0; }
    get presenter() { return this.host?.presenter || null; }
    get lastGame() { return this.host?.lastGame || null; }
    get worldMapRenderer() { return this.host?.worldMapRenderer || null; }
    get worldMapLayerRenderer() { return this.host?.worldMapLayerRenderer || null; }
    get lastWorldTileMapContext() { return this.host?.lastWorldTileMapContext || null; }
    get lastMapHomeWorldHudContext() { return this.host?.lastMapHomeWorldHudContext || null; }
    get epochNowMs() { return this.host?.epochNowMs; }
    get serverNowMs() { return this.host?.serverNowMs; }
    get nowEpochMs() { return this.host?.nowEpochMs; }
    get worldClock() { return this.host?.worldClock || null; }
    get lastRenderOptions() { return this.host?.lastRenderOptions || null; }

    t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    renderHudOverlay(...args) {
      const renderer = this.host?.hudOverlayRenderer;
      if (renderer && renderer !== this && typeof renderer.renderHudOverlay === 'function') return renderer.renderHudOverlay(...args);
      return this.host?.renderHudOverlay?.(...args);
    }

    renderWorldSiteModal(...args) { return this.host?.renderWorldSiteModal?.(...args) || false; }
    renderWorldMarchHud(...args) { return this.host?.renderWorldMarchHud?.(...args) || false; }
    beginFrame(...args) { return this.host?.beginFrame?.(...args); }
    setHitTargets(...args) { return this.host?.setHitTargets?.(...args); }
    clear(...args) { return this.host?.clear?.(...args); }
    clearAll(...args) { return this.host?.clearAll?.(...args); }
    endFrame(...args) { return this.host?.endFrame?.(...args); }
    addHitTarget(...args) { return this.host?.addHitTarget?.(...args); }
    appendWorldMapRuntimeHitTargets(...args) { return this.host?.appendWorldMapRuntimeHitTargets?.(...args) || false; }
    collectMapHomeWorldSiteHitTargets(...args) { return this.host?.collectMapHomeWorldSiteHitTargets?.(...args) || false; }
    renderMapHomeWorldView(...args) { return this.host?.renderMapHomeWorldView?.(...args) || false; }
    getWorldMapLayerLayout(...args) { return this.host?.getWorldMapLayerLayout?.(...args) || null; }
    getTransitionFrame(...args) { return this.host?.getTransitionFrame?.(...args) || null; }
    getLayout(...args) { return this.host?.getLayout?.(...args) || { contentX: 0, contentWidth: this.width, contentRight: this.width }; }
    withSlideClip(...args) { return this.host?.withSlideClip?.(...args) ?? args[5]?.(); }
    withSuppressedHitTargets(...args) { return this.host?.withSuppressedHitTargets?.(...args) ?? args[0]?.(); }
    createGradient(...args) { return this.host?.createGradient?.(...args) ?? args[5] ?? '#000'; }
    drawPanel(...args) { return this.host?.drawPanel?.(...args); }
    drawText(...args) { return this.host?.drawText?.(...args); }
    drawButton(...args) { return this.host?.drawButton?.(...args); }
    renderLoginPanel(...args) { return this.host?.renderLoginPanel?.(...args); }
    renderLoadingScreen(...args) { return this.host?.renderLoadingScreen?.(...args); }
    renderEntityBattleOverlay(...args) { return this.host?.renderEntityBattleOverlay?.(...args); }
    renderBattleSceneOverlay(...args) { return this.host?.renderBattleSceneOverlay?.(...args); }
    renderTopBar(...args) { return this.host?.renderTopBar?.(...args) ?? 84; }
    renderTabs(...args) { return this.host?.renderTabs?.(...args); }
    renderAdvisor(...args) { return this.host?.renderAdvisor?.(...args); }
    renderMainPanel(...args) { return this.host?.renderMainPanel?.(...args); }
    renderResourceDetailsPanel(...args) { return this.host?.renderResourceDetailsPanel?.(...args); }
    renderCitySwitcherMenu(...args) { return this.host?.renderCitySwitcherMenu?.(...args); }
    renderTaskCenterPanel(...args) { return this.host?.renderTaskCenterPanel?.(...args); }
    renderGuidebookPanel(...args) { return this.host?.renderGuidebookPanel?.(...args); }
    renderFamousPersonsPanel(...args) { return this.host?.renderFamousPersonsPanel?.(...args); }
    renderArmyFormationEditor(...args) { return this.host?.renderArmyFormationEditor?.(...args); }
    renderEventModal(...args) { return this.host?.renderEventModal?.(...args); }
    renderTechDetailModal(...args) { return this.host?.renderTechDetailModal?.(...args); }
    renderNamingModal(...args) { return this.host?.renderNamingModal?.(...args); }
    renderTutorialIntro(...args) { return this.host?.renderTutorialIntro?.(...args); }
    renderTutorialAdvisorDialogue(...args) { return this.host?.renderTutorialAdvisorDialogue?.(...args); }
    renderTutorialHighlight(...args) { return this.host?.renderTutorialHighlight?.(...args); }
    renderFloatingTexts(...args) { return this.host?.renderFloatingTexts?.(...args); }
    renderRewardReveal(...args) { return this.host?.renderRewardReveal?.(...args); }
    renderNetworkOverlay(...args) { return this.host?.renderNetworkOverlay?.(...args); }
    renderConfirmDialog(...args) { return this.host?.renderConfirmDialog?.(...args); }
    renderFloatingSubcityButton(...args) { return this.host?.renderFloatingSubcityButton?.(...args); }
    renderFloatingEventButton(...args) { return this.host?.renderFloatingEventButton?.(...args); }
    renderFloatingAdvisorButton(...args) { return this.host?.renderFloatingAdvisorButton?.(...args); }
    renderMapCommandPanel(...args) { return this.host?.renderMapCommandPanel?.(...args); }
    renderSubcityListPanel(...args) { return this.host?.renderSubcityListPanel?.(...args); }
    renderCityManagementPanel(...args) { return this.host?.renderCityManagementPanel?.(...args); }
    renderSettingsPanel(...args) { return this.host?.renderSettingsPanel?.(...args); }
    renderAdvisorPanel(...args) { return this.host?.renderAdvisorPanel?.(...args); }

    render(state = {}, options = {}) {
      if (options.mode === 'hud') {
        this.renderHudOverlay(state, options);
        return undefined;
      }
      const activeTab = options.activeTab || 'resources';
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clear();
      if (options.auth?.view?.loginPanelVisible) {
        this.renderLoginPanel(options.auth);
        this.endFrame(options);
        return undefined;
      }
      if (options.loading?.visible) {
        this.renderLoadingScreen(options.loading);
        this.endFrame(options);
        return undefined;
      }
      if (options.entityBattle?.visible) {
        this.renderEntityBattleOverlay(state, options);
        this.endFrame(options);
        return undefined;
      }
      if (options.battleScene?.visible) {
        this.renderBattleSceneOverlay(state, options);
        this.endFrame(options);
        return undefined;
      }
      const topBarBottom = this.renderTopBar(state, options);
      if (options.isMapHome && activeTab === 'military') {
        this.renderMapHomeMilitaryFrame(state, topBarBottom, activeTab, options);
        return undefined;
      }
      this.renderStandardFrame(state, topBarBottom, activeTab, options);
      return undefined;
    }

    renderMapHomeMilitaryFrame(state = {}, topBarBottom = 84, activeTab = 'military', options = {}) {
      if (options.skipWorldMapLayer) {
        const runtimeTargetsAppended = Boolean(this.appendWorldMapRuntimeHitTargets?.(options.worldMapRuntimeHitTargets));
        this.collectMapHomeWorldSiteHitTargets(state, topBarBottom, {
          ...options,
          collectHitTargets: !runtimeTargetsAppended,
        });
      }
      else this.renderMapHomeWorldView(state, topBarBottom, options);
      this.renderMapHomeWorldMarchHud(state, options);
      this.renderMapHomeExplorerHud(state, topBarBottom, options);
      this.renderTabs(activeTab, state, options);
      this.renderMapHomeOverlays(state, options);
      this.renderFrameFeedback(state, options, {
        includeTutorialIntro: true,
        skipTutorialAdvisorDialogue: true,
      });
      this.endFrame(options);
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
      const renderSnapshot = context?.renderSnapshot || null;
      const contextActors = Array.isArray(context?.actors)
        ? context.actors
        : (Array.isArray(renderSnapshot?.actors) ? renderSnapshot.actors : []);
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

    renderStandardFrame(state = {}, topBarBottom = 84, activeTab = 'resources', options = {}) {
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const panelTop = topBarBottom;
      const advisorOffset = this.getAdvisorFrameOffset(state);
      const availableHeight = Math.max(120, tabsTop - panelTop - 12 - advisorOffset);
      this.renderFrameMainPanel(state, activeTab, panelTop, availableHeight, tabsTop, options);
      if (!options.tutorialAdvisorDialogue) this.renderAdvisor(state);
      this.renderTabs(activeTab, state, options);
      this.renderStandardOverlays(state, activeTab, options);
      this.renderFrameFeedback(state, options);
      this.endFrame(options);
    }

    getAdvisorFrameOffset(state = {}) {
      const view = this.presenter && typeof this.presenter.buildAdvisorViewState === 'function'
        ? this.presenter.buildAdvisorViewState(state.softGuide)
        : null;
      return view?.hidden ? 0 : 52;
    }

    renderFrameMainPanel(state = {}, activeTab = 'resources', panelTop = 84, availableHeight = 120, tabsTop = 0, options = {}) {
      const transition = this.getTransitionFrame(options.pageTransition);
      const fromTab = options.pageTransition?.fromTab;
      const toTab = options.pageTransition?.toTab || activeTab;
      if (transition && fromTab && fromTab !== activeTab && toTab === activeTab && activeTab !== 'resources') {
        const travel = this.width + 24;
        this.withSlideClip(0, panelTop, this.width, Math.max(120, tabsTop - panelTop), -transition.direction * travel * transition.eased, () => {
          this.withSuppressedHitTargets(() => this.renderMainPanel(state, fromTab, panelTop, availableHeight, {
            ...options,
            buildingOffset: options.pageTransition.fromBuildingOffset ?? options.buildingOffset,
            buildingTransition: null,
          }));
        });
        this.withSlideClip(0, panelTop, this.width, Math.max(120, tabsTop - panelTop), transition.direction * travel * (1 - transition.eased), () => {
          this.renderMainPanel(state, activeTab, panelTop, availableHeight, options);
        });
      } else if (activeTab !== 'resources') {
        this.renderMainPanel(state, activeTab, panelTop, availableHeight, options);
      }
    }

    renderStandardOverlays(state = {}, activeTab = 'resources', options = {}) {
      if (options.showResourceDetails) this.renderResourceDetailsPanel(state);
      if (options.showCitySwitcher) this.renderCitySwitcherMenu(state);
      if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);
      if (options.showGuidebook) this.renderGuidebookPanel(state, options);
      if (options.showFamousPersons) this.renderFamousPersonsPanel(state, options);
      if (options.armyFormationEditor?.open) this.renderArmyFormationEditor(state, options);
      if (options.activeEventId) this.renderEventModal(state, options.activeEventId);
      this.renderTechDetailIfNeeded(state, activeTab, options);
      if (activeTab === 'military') this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
    }

    renderTechDetailIfNeeded(state = {}, activeTab = 'resources', options = {}) {
      if (activeTab !== 'tech' || (!options.techDetailOpen && !state.techUiState?.detailOpen)) return;
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

    renderFrameFeedback(state = {}, options = {}, flags = {}) {
      if (flags.includeTutorialIntro) this.renderTutorialIntro(state, options);
      if (options.tutorialAdvisorDialogue && !flags.skipTutorialAdvisorDialogue) this.renderTutorialAdvisorDialogue(
        options.tutorialAdvisorDialogue.message,
        options.tutorialAdvisorDialogue.advisorName || this.t('tutorial.advisorName'),
        { action: { type: 'closeAdvisor', source: options.tutorialAdvisorDialogue.source || 'tutorialAdvisorDialogue' } },
      );
      this.renderTutorialHighlight(options.tutorialHighlight || null);
      this.renderFloatingTexts(options.floatingTexts || []);
      this.renderRewardReveal(options.rewardReveal || null);
      this.renderNetworkOverlay(options.network || null);
      this.renderCanvasDebugResetButton(options);
      this.renderConfirmDialog(options.confirmDialog || null);
    }

    renderMapHomeOverlays(state = {}, options = {}) {
      this.renderFloatingSubcityButton(state, options);
      this.renderFloatingEventButton(state, options);
      this.renderFloatingAdvisorButton(state, options);
      if (options.activeCommandPanel) this.renderMapCommandPanel(state, options);
      if (options.showSubcityList) this.renderSubcityListPanel(state, options);
      if (options.showCityManagement) this.renderCityManagementPanel(state, options);
      if (options.showResourceDetails) this.renderResourceDetailsPanel(state);
      if (options.showSettings) this.renderSettingsPanel();
      if (options.showCitySwitcher) this.renderCitySwitcherMenu(state);
      if (options.tutorialAdvisorDialogue) this.renderTutorialAdvisorDialogue(
        options.tutorialAdvisorDialogue.message,
        options.tutorialAdvisorDialogue.advisorName || this.t('tutorial.advisorName'),
        { action: { type: 'closeAdvisor', source: options.tutorialAdvisorDialogue.source || 'tutorialAdvisorDialogue' } },
      );
      else if (options.showAdvisor) this.renderAdvisorPanel(state);
      if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);
      if (options.showGuidebook) this.renderGuidebookPanel(state, options);
      if (options.showFamousPersons) this.renderFamousPersonsPanel(state, options);
      if (options.armyFormationEditor?.open) this.renderArmyFormationEditor(state, options);
      if (options.activeEventId) this.renderEventModal(state, options.activeEventId);
      this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
    }

    renderMapHomeExplorerHud(state = {}, topBarBottom = 84, options = {}) {
      const layout = this.getWorldMapLayerLayout?.(state, topBarBottom, { ...options, isMapHome: true }) || null;
      const map = layout?.map || { x: 0, y: topBarBottom, width: this.width, height: Math.max(160, this.height - topBarBottom - 64) };
      const explorer = state.worldExplorerState || {};
      const nowMs = this.getEpochNowMs();
      const activeMission = explorer.activeMission && SharedWorldMarchSystem?.deriveMissionForTime
        ? SharedWorldMarchSystem.deriveMissionForTime(explorer.activeMission, { nowMs })
        : explorer.activeMission || null;
      const active = activeMission?.status === 'active' ? activeMission : null;
      const panelWidth = Math.min(184, Math.max(132, map.width - 24));
      const panelHeight = active ? 48 : 34;
      const x = Math.max(8, map.x + 12);
      const y = Math.max(map.y + 10, topBarBottom + 10);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(19, 18, 14, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      if (active) {

        const route = Array.isArray(active.route) ? active.route : [];
        const done = route.filter((step) => step.revealed).length;
        const total = Math.max(1, route.length || active.revealedTileIds?.length || 1);
        const remainingSeconds = this.getExplorerMissionRemainingSeconds(active);
        this.drawText(this.t('worldMap.exploreProgress', { done, total }), x + 12, y + 14, {
          size: 11,
          bold: true,
          color: '#ffe6b5',
        });
        this.drawText(`${remainingSeconds}s`, x + panelWidth - 12, y + 14, {
          size: 11,
          color: '#f0b45b',
          align: 'right',
        });
        const barX = x + 12;
        const barY = y + 32;
        const barW = panelWidth - 24;
        const progress = Math.max(0, Math.min(1, done / total));
        this.ctx.fillStyle = 'rgba(255, 226, 177, 0.14)';
        this.ctx.fillRect(barX, barY, barW, 4);
        this.ctx.fillStyle = '#74d3a0';
        this.ctx.fillRect(barX, barY, Math.max(3, barW * progress), 4);
      } else {
        this.drawText(this.t('worldMap.marchHint.title'), x + 12, y + 12, { size: 11, bold: true, color: '#ffe6b5' });
        this.drawText(this.t('worldMap.marchHint.subtitle'), x + panelWidth - 12, y + 12, {
          size: 10,
          color: '#74d3a0',
          align: 'right',
        });
      }
      const resetW = 76;
      const resetH = 28;
      const resetX = Math.max(8, map.x + map.width - resetW - 12);
      const resetY = Math.max(map.y + 10, topBarBottom + 10);
      this.drawButton(resetX, resetY, resetW, resetH, this.t('worldMap.backToCity'), { size: 11, radius: 8 });
      this.addHitTarget({ x: resetX, y: resetY, width: resetW, height: resetH }, { type: 'resetWorldPan' });
      return true;
    }

    getEpochNowMs() {
      return SharedWorldTime?.getEpochNowMs?.(this) ?? Date.now();
    }

    getExplorerMissionRemainingSeconds(mission = {}, nowMs = this.getEpochNowMs()) {
      return SharedWorldTime?.getRemainingSeconds?.(mission, nowMs) ?? Math.max(0, Math.ceil(Number(mission.remainingSeconds) || 0));
    }

    isCanvasDebugResetBlocked(options = {}) {
      return Boolean(
        options.tutorialAdvisorDialogue
        || options.tutorialIntro?.active
        || options.tutorialHighlight,
      );
    }

    renderCanvasDebugResetButton(options = {}) {
      if (options.debugResetAccount === false) return false;
      if (this.isCanvasDebugResetBlocked(options)) return false;
      const width = 76;
      const height = 28;
      const margin = 8;
      const dockTop = this.height - 60 - (Number(this.bottomSafeArea) || 0);
      const x = Math.max(margin, this.width - width - margin);
      const y = Math.max(92, Math.min(dockTop - height - margin, this.height - height - margin));
      this.drawButton(x, y, width, height, this.t('worldMap.resetAccount'), {
        size: 11,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x, y, width, height }, { type: 'requestResetGame', source: 'debugResetAccount' });
      return true;
    }
  }

  global.CanvasFrameRenderer = CanvasFrameRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasFrameRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
