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

  const UiThemeTokens = (() => {
    if (global.UiThemeTokens) return global.UiThemeTokens;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/UiThemeTokens');
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
    drawAsset(...args) { return this.host?.drawAsset?.(...args) || false; }
    drawPanel(...args) { return this.host?.drawPanel?.(...args); }
    drawText(...args) { return this.host?.drawText?.(...args); }
    drawButton(...args) { return this.host?.drawButton?.(...args); }
    truncateText(...args) {
      return typeof this.host?.truncateText === 'function'
        ? this.host.truncateText(...args)
        : String(args[0] ?? '');
    }
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
    renderCaptureModal(...args) { return this.host?.renderCaptureModal?.(...args); }
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
    renderFloatingAccountButton(...args) { return this.host?.renderFloatingAccountButton?.(...args); }
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
      this.renderCaptureModal(state); // ②b: auto-surfaces while a pending capture decision exists
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
      this.renderFloatingAccountButton(state, options);
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
      this.renderCaptureModal(state); // ②b: auto-surfaces while a pending capture decision exists
      this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
    }

    getDockTop() {
      return UiThemeTokens?.getDockMetrics?.(this.width, this.height)?.top ?? (this.height - 64);
    }

    // UI-REDO knife 3 map-home explorer HUD = two independent pieces:
    //   - bottom-left squad quick panel (presenter-projected rows)
    //   - top strip explore-progress chip + back-to-city button
    renderMapHomeExplorerHud(state = {}, topBarBottom = 84, options = {}) {
      const layout = this.getWorldMapLayerLayout?.(state, topBarBottom, { ...options, isMapHome: true }) || null;
      const map = layout?.map || { x: 0, y: topBarBottom, width: this.width, height: Math.max(160, this.height - topBarBottom - 64) };
      this.renderMapHomeSquadPanel(state, map);
      this.renderMapHomeExploreChip(state, map, topBarBottom, options);
      return true;
    }

    // Bottom-left squad quick panel (layout-reference-v2): dark plate list,
    // row = colored crest chip + real formation name + march dot + chevron.
    // ALL row data/visibility comes from the presenter projection -- this
    // renderer never reads military/explorer state itself. Empty slots are
    // absent from the projection; zero rows hides the whole panel.
    renderMapHomeSquadPanel(state = {}, map = {}) {
      const view = typeof this.presenter?.buildSquadQuickPanelViewState === 'function'
        ? this.presenter.buildSquadQuickPanelViewState(state, { nowMs: this.getEpochNowMs() })
        : { hidden: true, rows: [] };
      if (view.hidden || !Array.isArray(view.rows) || !view.rows.length) return false;
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const tokens = UiThemeTokens?.squadPanel || {};
      const rows = view.rows.slice(0, 3);
      const rowHeight = Number(tokens.rowHeightPx) || 32;
      const rowGap = Number(tokens.rowGapPx) || 6;
      const pad = 6;
      const layout = this.getLayout();
      const panelWidth = Math.min(
        Number(tokens.maxWidthPx) || 156,
        Math.max(Number(tokens.minWidthPx) || 118, Math.floor(this.width * (Number(tokens.widthRatio) || 0.3))),
      );
      const panelHeight = pad * 2 + rows.length * rowHeight + (rows.length - 1) * rowGap;
      const dockTop = this.getDockTop();
      // Anchor on the safe-area content box, never the raw map rect, so the
      // crest chips cannot clip off the left canvas edge on device.
      const x = Math.max(8, (Number(layout.contentX) || 0) + (Number(tokens.edgeInsetPx) || 10) - 4);
      const y = Math.max((Number(map.y) || 84) + 10, dockTop - panelHeight - 12);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(15, 13, 10, 0.78)',
        stroke: hairline.dividerOnIron,
        radius: UiThemeTokens?.radius?.plate || 8,
        inset: hairline.insetHighlight,
      });
      const chipColorBySlot = {
        1: palette.squadChipBlue,
        2: palette.squadChipRed,
        3: palette.squadChipGreen,
      };
      rows.forEach((row, index) => {
        const rowX = x + pad;
        const rowY = y + pad + index * (rowHeight + rowGap);
        const rowWidth = panelWidth - pad * 2;
        this.drawPanel(rowX, rowY, rowWidth, rowHeight, {
          fill: palette.squadPanelBg,
          stroke: hairline.dividerOnIron,
          radius: UiThemeTokens?.radius?.panel || 6,
          inset: hairline.insetHighlight,
        });
        const chipSize = Number(tokens.chipSizePx) || 22;
        const chipX = rowX + 5;
        const chipY = rowY + Math.floor((rowHeight - chipSize) / 2);
        this.drawPanel(chipX, chipY, chipSize, chipSize, {
          fill: chipColorBySlot[row.slot] || palette.squadChipBlue,
          stroke: hairline.insetHighlight,
          radius: UiThemeTokens?.radius?.chip || 4,
        });
        const crestInset = 2;
        if (!this.drawAsset(`assets/art/ui-hud/hud-squad-crest-${row.slot}.png`, chipX + crestInset, chipY + crestInset, chipSize - crestInset * 2, chipSize - crestInset * 2)) {
          this.drawText(String(row.slot), chipX + chipSize / 2, chipY + chipSize / 2, {
            size: typeScale.label || 10,
            bold: true,
            color: palette.textPrimary,
            baseline: 'middle',
            align: 'center',
          });
        }
        const chevronReserve = 18;
        const dotReserve = row.marching ? 12 : 0;
        const nameX = chipX + chipSize + 8;
        const nameMax = rowX + rowWidth - chevronReserve - dotReserve - nameX;
        this.drawText(this.truncateText(row.name, nameMax, { size: typeScale.body || 12, bold: true }), nameX, rowY + rowHeight / 2, {
          size: typeScale.body || 12,
          bold: true,
          color: palette.textPrimary,
          baseline: 'middle',
        });
        if (row.marching && this.ctx && typeof this.ctx.arc === 'function') {
          this.ctx.save?.();
          this.ctx.beginPath();
          this.ctx.arc(rowX + rowWidth - chevronReserve - 5, rowY + rowHeight / 2, 3, 0, Math.PI * 2);
          this.ctx.fillStyle = palette.accentJade;
          this.ctx.fill();
          this.ctx.restore?.();
        }
        this.drawText('»', rowX + rowWidth - 8, rowY + rowHeight / 2, {
          size: typeScale.value || 14,
          bold: true,
          color: palette.badgeTextGold,
          baseline: 'middle',
          align: 'right',
        });
        this.addHitTarget({ x: rowX, y: rowY, width: rowWidth, height: rowHeight }, row.action);
      });
      return true;
    }

    // Top strip right below the top bar: explore-progress chip (dark plate +
    // thin jade progress line, only while a mission is actively exploring)
    // and the back-to-city button (action stays resetWorldPan).
    renderMapHomeExploreChip(state = {}, map = {}, topBarBottom = 84, _options = {}) {
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const explorer = state.worldExplorerState || {};
      const nowMs = this.getEpochNowMs();
      const derivedMission = explorer.activeMission && SharedWorldMarchSystem?.deriveMissionForTime
        ? SharedWorldMarchSystem.deriveMissionForTime(explorer.activeMission, { nowMs })
        : explorer.activeMission || null;
      const active = derivedMission?.status === 'active' ? derivedMission : null;
      const chipTop = Math.max((Number(map.y) || 84) + 10, topBarBottom + 10);
      const buttonWidth = 76;
      const buttonHeight = 28;
      const buttonX = Math.max(8, (Number(map.x) || 0) + (Number(map.width) || this.width) - buttonWidth - 12);
      this.drawPanel(buttonX, chipTop, buttonWidth, buttonHeight, {
        fill: 'rgba(15, 13, 10, 0.82)',
        stroke: hairline.dividerOnIron,
        radius: UiThemeTokens?.radius?.plate || 8,
        inset: hairline.insetHighlight,
      });
      this.drawText(this.t('worldMap.backToCity'), buttonX + buttonWidth / 2, chipTop + buttonHeight / 2, {
        size: typeScale.label || 10,
        bold: true,
        color: palette.badgeTextGold,
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x: buttonX, y: chipTop, width: buttonWidth, height: buttonHeight }, { type: 'resetWorldPan' });
      if (!active) return true;
      const route = Array.isArray(active.route) ? active.route : [];
      const done = route.filter((step) => step.revealed).length;
      const total = Math.max(1, route.length || active.revealedTileIds?.length || 1);
      const chipWidth = Math.min(168, Math.max(128, Math.floor((Number(map.width) || this.width) * 0.4)));
      const chipHeight = 30;
      const chipX = Math.max(8, (Number(map.x) || 0) + 12);
      this.drawPanel(chipX, chipTop, chipWidth, chipHeight, {
        fill: 'rgba(15, 13, 10, 0.82)',
        stroke: hairline.dividerOnIron,
        radius: UiThemeTokens?.radius?.plate || 8,
        inset: hairline.insetHighlight,
      });
      this.drawText(this.t('worldMap.exploreProgress', { done, total }), chipX + 10, chipTop + 6, {
        size: typeScale.label || 10,
        bold: true,
        color: palette.textPrimary,
      });
      if (this.ctx) {
        const barX = chipX + 10;
        const barY = chipTop + chipHeight - 7;
        const barWidth = chipWidth - 20;
        const progress = Math.max(0, Math.min(1, done / total));
        this.ctx.fillStyle = hairline.dividerOnIron;
        this.ctx.fillRect(barX, barY, barWidth, 2);
        this.ctx.fillStyle = palette.accentJade;
        this.ctx.fillRect(barX, barY, Math.max(2, Math.round(barWidth * progress)), 2);
      }
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
      // Map home already exposes the same requestResetGame action through the
      // right-edge account float button -- drawing this chip there too stacked
      // two reset controls on top of each other (device report, knife 3).
      if (options.isMapHome) return false;
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const width = 76;
      const height = 28;
      const margin = 8;
      const dockTop = this.height - 60 - (Number(this.bottomSafeArea) || 0);
      const x = Math.max(margin, this.width - width - margin);
      const y = Math.max(92, Math.min(dockTop - height - margin, this.height - height - margin));
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(15, 13, 10, 0.82)',
        stroke: hairline.dividerOnIron,
        radius: UiThemeTokens?.radius?.plate || 8,
        inset: hairline.insetHighlight,
      });
      this.drawText(this.t('worldMap.resetAccount'), x + width / 2, y + height / 2, {
        size: typeScale.label || 10,
        bold: true,
        color: palette.badgeTextGold,
        baseline: 'middle',
        align: 'center',
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
