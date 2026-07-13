(function (global) {
  class HudTabPageCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get bottomSafeArea() {
      return Number(this.host?.bottomSafeArea) || 12;
    }

    get height() {
      return Number(this.host?.height) || 0;
    }

    get viewportOffsetY() {
      return Number(this.host?.viewportOffsetY) || 0;
    }

    get width() {
      return Number(this.host?.width) || 0;
    }

    getTransitionFrame(...args) {
      return this.host?.getTransitionFrame?.(...args);
    }

    renderBuildings(...args) {
      return this.host?.renderBuildings?.(...args);
    }

    renderCivilization(...args) {
      return this.host?.renderCivilization?.(...args);
    }

    renderEvents(...args) {
      return this.host?.renderEvents?.(...args);
    }

    renderMapHomeWorldView(...args) {
      return this.host?.renderMapHomeWorldView?.(...args);
    }

    renderMilitary(...args) {
      return this.host?.renderMilitary?.(...args);
    }

    renderTech(...args) {
      return this.host?.renderTech?.(...args);
    }

    withSlideClip(...args) {
      return this.host?.withSlideClip?.(...args);
    }

    withSuppressedHitTargets(...args) {
      return this.host?.withSuppressedHitTargets?.(...args);
    }

    renderMainPanel(state = {}, activeTab = 'resources', startY = 210, availableHeight = 310, options = {}) {
      if (activeTab === 'buildings') this.renderBuildings(state, startY, availableHeight, {
        offset: options.buildingOffset,
        buildingTransition: options.buildingTransition,
        activeBuildingCategory: options.activeBuildingCategory,
      });
      else if (activeTab === 'events') this.renderEvents(state, startY, availableHeight);
      else if (activeTab === 'tech') this.renderTech(state, startY, availableHeight, options);
      else if (activeTab === 'civilization') this.renderCivilization(state, startY, availableHeight, options);
      else if (activeTab === 'military') this.renderMilitary(state, startY, availableHeight, options);
    }

    renderHudTabPage(state = {}, activeTab = 'resources', topBarBottom = 84, options = {}) {
      const offsetY = Number(this.viewportOffsetY) || 0;
      const viewportBottom = this.height - Math.max(0, offsetY);
      const tabsTop = viewportBottom - 60 - this.bottomSafeArea;
      if (options.isMapHome && activeTab === 'military') {
        if (!options.skipWorldMapLayer) this.renderMapHomeWorldView(state, topBarBottom, options);
        return;
      }
      if (activeTab === 'buildings') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderBuildings(
          state,
          topBarBottom,
          availableHeight,
          {
            offset: options.buildingOffset,
            buildingTransition: options.buildingTransition,
            activeBuildingCategory: options.activeBuildingCategory,
          },
        );
      } else if (activeTab === 'events') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderEvents(state, topBarBottom, availableHeight);
      } else if (activeTab === 'tech') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderTech(state, topBarBottom, availableHeight, options);
      } else if (activeTab === 'civilization') {
        const availableHeight = Math.max(260, tabsTop - topBarBottom - 12);
        this.renderCivilization(
          state,
          topBarBottom,
          availableHeight,
          options,
        );
      } else if (activeTab === 'military') {
        const availableHeight = Math.max(360, tabsTop - topBarBottom - 12);
        this.renderMilitary(state, topBarBottom, availableHeight, options);
      }
    }

    renderHudTabPageWithTransition(state = {}, activeTab = 'resources', topBarBottom = 84, options = {}) {
      const pageTransition = options.pageTransition || null;
      const transition = this.getTransitionFrame(pageTransition);
      const fromTab = pageTransition?.fromTab;
      const toTab = pageTransition?.toTab || activeTab;
      if (!transition || !fromTab || fromTab === activeTab || toTab !== activeTab) {
        this.renderHudTabPage(state, activeTab, topBarBottom, options);
        return;
      }
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const clipY = topBarBottom;
      const clipHeight = Math.max(120, tabsTop - clipY);
      const travel = this.width + 24;
      this.withSlideClip(0, clipY, this.width, clipHeight, -transition.direction * travel * transition.eased, () => {
        this.withSuppressedHitTargets(() => this.renderHudTabPage(state, fromTab, topBarBottom, {
          ...options,
          buildingOffset: pageTransition.fromBuildingOffset ?? options.buildingOffset,
          buildingTransition: null,
        }));
      });
      this.withSlideClip(0, clipY, this.width, clipHeight, transition.direction * travel * (1 - transition.eased), () => {
        this.renderHudTabPage(state, activeTab, topBarBottom, options);
      });
    }
  }

  global.HudTabPageCanvasRenderer = HudTabPageCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HudTabPageCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
