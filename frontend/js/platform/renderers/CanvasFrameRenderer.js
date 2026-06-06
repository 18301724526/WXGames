(function (global) {
  class CanvasFrameRenderer {
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
      if (options.skipWorldMapLayer) this.collectMapHomeWorldSiteHitTargets(state, topBarBottom, options);
      else this.renderMapHomeWorldView(state, topBarBottom, options);
      this.renderMapHomeExplorerHud(state, topBarBottom, options);
      this.renderTabs(activeTab, state, options);
      this.renderMapHomeOverlays(state, options);
      this.renderFrameFeedback(state, options, {
        includeTutorialIntro: true,
        skipTutorialAdvisorDialogue: true,
      });
      this.endFrame(options);
    }

    renderStandardFrame(state = {}, topBarBottom = 84, activeTab = 'resources', options = {}) {
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const populationBottom = activeTab === 'resources'
        ? this.renderPopulation(state, topBarBottom)
        : topBarBottom;
      const homeFeatureBottom = activeTab === 'resources'
        ? this.renderHomeFeatureGrid(state, populationBottom, { maxBottom: tabsTop - 8 })
        : populationBottom;
      const panelTop = activeTab === 'resources' ? homeFeatureBottom : topBarBottom;
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
      if (options.showTalentPolicy) this.renderTalentPolicyPanel(state, options);
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
        options.tutorialAdvisorDialogue.advisorName || '谋士',
        { action: { type: 'closeAdvisor', source: options.tutorialAdvisorDialogue.source || 'tutorialAdvisorDialogue' } },
      );
      this.renderTutorialHighlight(options.tutorialHighlight || null);
      this.renderFloatingTexts(options.floatingTexts || []);
      this.renderRewardReveal(options.rewardReveal || null);
      this.renderNetworkOverlay(options.network || null);
      this.renderCanvasDebugResetButton(options);
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
        options.tutorialAdvisorDialogue.advisorName || '谋士',
        { action: { type: 'closeAdvisor', source: options.tutorialAdvisorDialogue.source || 'tutorialAdvisorDialogue' } },
      );
      else if (options.showAdvisor) this.renderAdvisorPanel(state);
      if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);
      if (options.showGuidebook) this.renderGuidebookPanel(state, options);
      if (options.showFamousPersons) this.renderFamousPersonsPanel(state, options);
      if (options.showTalentPolicy) this.renderTalentPolicyPanel(state, options);
      if (options.armyFormationEditor?.open) this.renderArmyFormationEditor(state, options);
      if (options.activeEventId) this.renderEventModal(state, options.activeEventId);
      this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
    }

    renderMapHomeExplorerHud(state = {}, topBarBottom = 84, options = {}) {
      const layout = this.getWorldMapLayerLayout?.(state, topBarBottom, { ...options, isMapHome: true }) || null;
      const map = layout?.map || { x: 0, y: topBarBottom, width: this.width, height: Math.max(160, this.height - topBarBottom - 64) };
      const explorer = state.worldExplorerState || {};
      const active = explorer.activeMission || null;
      const ready = Array.isArray(explorer.readyMissions) ? explorer.readyMissions[0] : null;
      const panelWidth = Math.min(184, Math.max(132, map.width - 24));
      const panelHeight = active || ready ? 48 : 34;
      const x = Math.max(8, map.x + 12);
      const y = Math.max(map.y + 10, topBarBottom + 10);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(19, 18, 14, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      if (ready) {
        this.drawText('探索队已返回', x + 12, y + 14, { size: 11, bold: true, color: '#ffe6b5' });
        const buttonW = 58;
        const buttonH = 24;
        const buttonX = x + panelWidth - buttonW - 8;
        const buttonY = y + 12;
        this.drawButton(buttonX, buttonY, buttonW, buttonH, '归队', { size: 11, radius: 7 });
        this.addHitTarget({ x: buttonX, y: buttonY, width: buttonW, height: buttonH }, { type: 'claimExplore', missionId: ready.id });
      } else if (active) {
        const route = Array.isArray(active.route) ? active.route : [];
        const done = route.filter((step) => step.revealed).length;
        const total = Math.max(1, route.length || active.revealedTileIds?.length || 1);
        const remainingSeconds = this.getExplorerMissionRemainingSeconds(active);
        this.drawText(`探索中 ${done}/${total}`, x + 12, y + 14, { size: 11, bold: true, color: '#ffe6b5' });
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
        this.drawText('点选地图行军', x + 12, y + 12, { size: 11, bold: true, color: '#ffe6b5' });
        this.drawText('选择目标后派出队伍', x + panelWidth - 12, y + 12, {
          size: 10,
          color: '#74d3a0',
          align: 'right',
        });
      }
      const resetW = 76;
      const resetH = 28;
      const resetX = Math.max(8, map.x + map.width - resetW - 12);
      const resetY = Math.max(map.y + 10, topBarBottom + 10);
      this.drawButton(resetX, resetY, resetW, resetH, '回到本城', { size: 11, radius: 8 });
      this.addHitTarget({ x: resetX, y: resetY, width: resetW, height: resetH }, { type: 'resetWorldPan' });
      return true;
    }

    getExplorerMissionRemainingSeconds(mission = {}, nowMs = this.getNow?.() || Date.now()) {
      if (!mission || mission.status === 'ready') return 0;
      const nextStepAtMs = new Date(mission.nextStepAt).getTime();
      if (Number.isFinite(nextStepAtMs)) {
        return Math.max(0, Math.ceil((nextStepAtMs - Number(nowMs)) / 1000));
      }
      const completesAtMs = new Date(mission.completesAt).getTime();
      if (Number.isFinite(completesAtMs)) {
        return Math.max(0, Math.ceil((completesAtMs - Number(nowMs)) / 1000));
      }
      return Math.max(0, Math.ceil(Number(mission.remainingSeconds) || 0));
    }

    renderCanvasDebugResetButton(options = {}) {
      if (options.debugResetAccount === false) return false;
      const width = 76;
      const height = 28;
      const margin = 8;
      const dockTop = this.height - 60 - (Number(this.bottomSafeArea) || 0);
      const x = Math.max(margin, this.width - width - margin);
      const y = Math.max(92, Math.min(dockTop - height - margin, this.height - height - margin));
      this.drawButton(x, y, width, height, '重置账号', {
        size: 11,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x, y, width, height }, { type: 'resetGame', source: 'debugResetAccount' });
      return true;
    }
  }

  global.CanvasFrameRenderer = CanvasFrameRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasFrameRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
