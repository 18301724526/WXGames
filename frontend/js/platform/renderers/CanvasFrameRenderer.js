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
      this.renderTabs(activeTab, state, options);
      this.renderMapHomeOverlays(state, options);
      this.renderFrameFeedback(state, options, { includeTutorialIntro: true });
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
      this.renderAdvisor(state);
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
      this.renderTutorialHighlight(options.tutorialHighlight || null);
      this.renderFloatingTexts(options.floatingTexts || []);
      this.renderRewardReveal(options.rewardReveal || null);
      this.renderNetworkOverlay(options.network || null);
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
      if (options.showAdvisor) this.renderAdvisorPanel(state);
      if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);
      if (options.showGuidebook) this.renderGuidebookPanel(state, options);
      if (options.showFamousPersons) this.renderFamousPersonsPanel(state, options);
      if (options.showTalentPolicy) this.renderTalentPolicyPanel(state, options);
      if (options.armyFormationEditor?.open) this.renderArmyFormationEditor(state, options);
      if (options.activeEventId) this.renderEventModal(state, options.activeEventId);
      this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
    }
  }

  global.CanvasFrameRenderer = CanvasFrameRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasFrameRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
