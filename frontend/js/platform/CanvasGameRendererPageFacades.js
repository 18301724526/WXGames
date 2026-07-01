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
  const PAGE_FACADE_METHODS = Object.freeze({
    clear(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.clear === 'function'
        ? renderer.clear(...args)
        : undefined;
    },

    clearAll(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.clearAll === 'function'
        ? renderer.clearAll(...args)
        : undefined;
    },

    drawText(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawText === 'function'
        ? renderer.drawText(...args)
        : undefined;
    },

    drawTextLines(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawTextLines === 'function'
        ? renderer.drawTextLines(...args)
        : undefined;
    },

    wrapText(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.wrapText === 'function'
        ? renderer.wrapText(...args)
        : undefined;
      return result === undefined ? [String(args[0] ?? '')].filter(Boolean) : result;
    },

    measureTextWidth(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.measureTextWidth === 'function'
        ? renderer.measureTextWidth(...args)
        : undefined;
      const [text, options = {}] = args;
      return result === undefined ? String(text ?? '').length * (options.size || 14) * 0.55 : result;
    },

    truncateText(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.truncateText === 'function'
        ? renderer.truncateText(...args)
        : undefined;
      const [text, maxWidth, options = {}] = args;
      return result === undefined ? String(text ?? '').slice(0, Math.max(0, Number(maxWidth) || 0) || undefined) : result;
    },

    wrapTextLimit(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.wrapTextLimit === 'function'
        ? renderer.wrapTextLimit(...args)
        : undefined;
      return result === undefined ? this.wrapText(args[0], args[1], args[3]).slice(0, Math.max(1, Number(args[2]) || 1)) : result;
    },

    drawLine(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawLine === 'function'
        ? renderer.drawLine(...args)
        : undefined;
    },

    drawPolyline(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawPolyline === 'function'
        ? renderer.drawPolyline(...args)
        : undefined;
    },

    drawCurvePath(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawCurvePath === 'function'
        ? renderer.drawCurvePath(...args)
        : undefined;
    },

    drawCircle(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawCircle === 'function'
        ? renderer.drawCircle(...args)
        : undefined;
    },

    beginFrame(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.beginFrame === 'function'
        ? renderer.beginFrame(...args)
        : undefined;
      return result === undefined ? Date.now() : result;
    },

    endFrame(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.endFrame === 'function'
        ? renderer.endFrame(...args)
        : undefined;
    },

    getNow(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.getNow === 'function'
        ? renderer.getNow(...args)
        : undefined;
      return result === undefined ? (this.frameNow || Date.now()) : result;
    },

    updateFps(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.updateFps === 'function'
        ? renderer.updateFps(...args)
        : undefined;
      return result === undefined ? this.currentFps : result;
    },

    renderFpsOverlay(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.renderFpsOverlay === 'function'
        ? renderer.renderFpsOverlay(...args)
        : undefined;
    },

    drawPanel(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawPanel === 'function'
        ? renderer.drawPanel(...args)
        : undefined;
    },

    drawButton(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawButton === 'function'
        ? renderer.drawButton(...args)
        : undefined;
    },

    drawPrimaryActionButton(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawPrimaryActionButton === 'function'
        ? renderer.drawPrimaryActionButton(...args)
        : undefined;
    },

    drawProgressBar(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawProgressBar === 'function'
        ? renderer.drawProgressBar(...args)
        : undefined;
    },

    drawIconCard(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.drawIconCard === 'function'
        ? renderer.drawIconCard(...args)
        : undefined;
    },

    renderSectionHeader(...args) {
      const renderer = this.surfaceRenderer;
      return typeof renderer?.renderSectionHeader === 'function'
        ? renderer.renderSectionHeader(...args)
        : undefined;
    },

    getTopBarBottom(...args) {
      const renderer = this.surfaceRenderer;
      const result = typeof renderer?.getTopBarBottom === 'function'
        ? renderer.getTopBarBottom(...args)
        : undefined;
      if (result !== undefined) return result;
      const [state = {}, options = {}] = args;
      if (options.isMapHome) return 72;
      if (!this.presenter) return 84;
      const cityView = this.presenter.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      return 12 + (cityView.hidden ? 128 : 166) + 12;
    },

    renderTopBar(...args) {
      const renderer = this.resourceTopBarRenderer;
      const result = typeof renderer?.renderTopBar === 'function'
        ? renderer.renderTopBar(...args)
        : undefined;
      return result === undefined ? 84 : result;
    },

    renderMapHomeTopBar(...args) {
      const renderer = this.resourceTopBarRenderer;
      const result = typeof renderer?.renderMapHomeTopBar === 'function'
        ? renderer.renderMapHomeTopBar(...args)
        : undefined;
      return result === undefined ? 72 : result;
    },

    renderGuideTasks(...args) {
      const renderer = this.guideTaskRenderer;
      const result = typeof renderer?.renderGuideTasks === 'function'
        ? renderer.renderGuideTasks(...args)
        : undefined;
      return result === undefined ? (args.length > 1 ? args[1] : 0) : result;
    },

    renderTaskCenterButton(...args) {
      const renderer = this.guideTaskRenderer;
      return typeof renderer?.renderTaskCenterButton === 'function'
        ? renderer.renderTaskCenterButton(...args)
        : undefined;
    },

    renderGuidebookButton(...args) {
      const renderer = this.guideTaskRenderer;
      return typeof renderer?.renderGuidebookButton === 'function'
        ? renderer.renderGuidebookButton(...args)
        : undefined;
    },

    renderGuidebookPanel(...args) {
      const renderer = this.guideTaskRenderer;
      const result = typeof renderer?.renderGuidebookPanel === 'function'
        ? renderer.renderGuidebookPanel(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderTaskCenterPanel(...args) {
      const renderer = this.guideTaskRenderer;
      const result = typeof renderer?.renderTaskCenterPanel === 'function'
        ? renderer.renderTaskCenterPanel(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderPopulation(...args) {
      const renderer = this.cityPeopleRenderer;
      const result = renderer && typeof renderer.renderPopulation === 'function'
        ? renderer.renderPopulation(...args)
        : undefined;
      return result === undefined ? (Number(args[1]) || 84) + 180 : result;
    },

    renderLoginPanel(...args) {
      const renderer = this.systemRenderer;
      return typeof renderer?.renderLoginPanel === 'function'
        ? renderer.renderLoginPanel(...args)
        : undefined;
    },

    renderLoadingScreen(...args) {
      const renderer = this.systemRenderer;
      return typeof renderer?.renderLoadingScreen === 'function'
        ? renderer.renderLoadingScreen(...args)
        : undefined;
    },

    renderNetworkOverlay(...args) {
      const renderer = this.systemRenderer;
      const result = typeof renderer?.renderNetworkOverlay === 'function'
        ? renderer.renderNetworkOverlay(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderSettingsPanel(...args) {
      const renderer = this.systemRenderer;
      return typeof renderer?.renderSettingsPanel === 'function'
        ? renderer.renderSettingsPanel(...args)
        : undefined;
    },

    renderConfirmDialog(...args) {
      const renderer = this.systemRenderer;
      const result = typeof renderer?.renderConfirmDialog === 'function'
        ? renderer.renderConfirmDialog(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderLogsPanel(...args) {
      const renderer = this.systemRenderer;
      return typeof renderer?.renderLogsPanel === 'function'
        ? renderer.renderLogsPanel(...args)
        : undefined;
    },

    getActiveCitySummary(...args) {
      const renderer = this.cityRenderer;
      const result = typeof renderer?.getActiveCitySummary === 'function'
        ? renderer.getActiveCitySummary(...args)
        : undefined;
      return result === undefined ? {
        id: 'capital',
        name: t('city.capitalName'),
        tag: t('home.city.main'),
        level: '',
        population: {},
        military: {},
        terrainLabel: t('home.planning.terrain.plains'),
      } : result;
    },

    renderCitySwitcherMenu(...args) {
      const renderer = this.cityRenderer;
      return typeof renderer?.renderCitySwitcherMenu === 'function'
        ? renderer.renderCitySwitcherMenu(...args)
        : undefined;
    },

    renderCityManagementPanel(...args) {
      const renderer = this.cityRenderer;
      return typeof renderer?.renderCityManagementPanel === 'function'
        ? renderer.renderCityManagementPanel(...args)
        : undefined;
    },

    renderCityMilitaryPanel(...args) {
      const renderer = this.cityRenderer;
      return typeof renderer?.renderCityMilitaryPanel === 'function'
        ? renderer.renderCityMilitaryPanel(...args)
        : undefined;
    },

    renderSubcityListPanel(...args) {
      const renderer = this.cityRenderer;
      return typeof renderer?.renderSubcityListPanel === 'function'
        ? renderer.renderSubcityListPanel(...args)
        : undefined;
    },

    renderNamingModal(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.renderNamingModal === 'function'
        ? renderer.renderNamingModal(...args)
        : undefined;
    },

    renderFloatingTexts(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.renderFloatingTexts === 'function'
        ? renderer.renderFloatingTexts(...args)
        : undefined;
    },

    drawRewardParticle(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.drawRewardParticle === 'function'
        ? renderer.drawRewardParticle(...args)
        : undefined;
    },

    renderRewardReveal(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.renderRewardReveal === 'function'
        ? renderer.renderRewardReveal(...args)
        : undefined;
    },

    renderResourceDetailsPanel(...args) {
      const renderer = this.overlayRenderer;
      return typeof renderer?.renderResourceDetailsPanel === 'function'
        ? renderer.renderResourceDetailsPanel(...args)
        : undefined;
    },

    renderAdvisor(...args) {
      const renderer = this.advisorRenderer;
      return typeof renderer?.renderAdvisor === 'function'
        ? renderer.renderAdvisor(...args)
        : undefined;
    },

    getMapHomeFloatingButtonLayout(...args) {
      const renderer = this.advisorRenderer;
      const result = typeof renderer?.getMapHomeFloatingButtonLayout === 'function'
        ? renderer.getMapHomeFloatingButtonLayout(...args)
        : undefined;
      return result === undefined ? { x: 0, y: 0, size: 48 } : result;
    },

    renderFloatingAdvisorButton(...args) {
      const renderer = this.advisorRenderer;
      return typeof renderer?.renderFloatingAdvisorButton === 'function'
        ? renderer.renderFloatingAdvisorButton(...args)
        : undefined;
    },

    renderAdvisorPanel(...args) {
      const renderer = this.advisorRenderer;
      return typeof renderer?.renderAdvisorPanel === 'function'
        ? renderer.renderAdvisorPanel(...args)
        : undefined;
    },

    renderFamousPersonItem(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousPersonItem === 'function'
        ? renderer.renderFamousPersonItem(...args)
        : undefined;
      return result === undefined ? args[2] || 0 : result;
    },

    renderFamousSkillTooltip(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousSkillTooltip === 'function'
        ? renderer.renderFamousSkillTooltip(...args)
        : undefined;
      return result === undefined ? undefined : result;
    },

    normalizeFamousPersonsPage(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.normalizeFamousPersonsPage === 'function'
        ? renderer.normalizeFamousPersonsPage(...args)
        : undefined;
      if (result !== undefined) return result;
      const total = args[0];
      const page = args[1];
      const pageSize = args[2];
      const pages = Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, pageSize)));
      const index = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
      return { index, pages };
    },

    renderFamousPersonsPager(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousPersonsPager === 'function'
        ? renderer.renderFamousPersonsPager(...args)
        : undefined;
      return result === undefined ? undefined : result;
    },

    renderFamousPersonsPanel(...args) {
      const renderer = this.famousRenderer;
      const result = typeof renderer?.renderFamousPersonsPanel === 'function'
        ? renderer.renderFamousPersonsPanel(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderArmyFormationEditor(...args) {
      const renderer = this.armyFormationEditorRenderer;
      return typeof renderer?.renderArmyFormationEditor === 'function'
        ? renderer.renderArmyFormationEditor(...args)
        : undefined;
    },

    renderBuildings(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.renderBuildings === 'function'
        ? renderer.renderBuildings(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawBuildingCategoryTabs(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingCategoryTabs === 'function'
        ? renderer.drawBuildingCategoryTabs(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawBuildingInfoLine(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingInfoLine === 'function'
        ? renderer.drawBuildingInfoLine(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawBuildingPlanningBadges(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingPlanningBadges === 'function'
        ? renderer.drawBuildingPlanningBadges(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    resourceShortName(resource) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.resourceShortName === 'function'
        ? renderer.resourceShortName(resource)
        : undefined;
      return result === undefined ? resource : result;
    },

    resourceIconPath(resource) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.resourceIconPath === 'function'
        ? renderer.resourceIconPath(resource)
        : undefined;
      return result === undefined ? '' : result;
    },

    buildingCostResourceAliases(resource) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.buildingCostResourceAliases === 'function'
        ? renderer.buildingCostResourceAliases(resource)
        : undefined;
      return result === undefined ? [resource] : result;
    },

    formatBuildingCostAmount(value) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.formatBuildingCostAmount === 'function'
        ? renderer.formatBuildingCostAmount(value)
        : undefined;
      return result === undefined ? String(value ?? 0) : result;
    },

    getBuildingCostSlot(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.getBuildingCostSlot === 'function'
        ? renderer.getBuildingCostSlot(...args)
        : undefined;
      return result === undefined ? { resource: args[1], value: 0, text: '0', present: false } : result;
    },

    getOwnedBuildingResource(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.getOwnedBuildingResource === 'function'
        ? renderer.getOwnedBuildingResource(...args)
        : undefined;
      return result === undefined ? 0 : result;
    },

    drawBuildingActionButton(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingActionButton === 'function'
        ? renderer.drawBuildingActionButton(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawBuildingCostChips(...args) {
      const renderer = this.buildingRenderer;
      const result = typeof renderer?.drawBuildingCostChips === 'function'
        ? renderer.drawBuildingCostChips(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    eventRowColor(tone) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.eventRowColor === 'function'
        ? renderer.eventRowColor(tone)
        : undefined;
      return result === undefined ? '#cbbd96' : result;
    },

    drawEventDetailRow(...args) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.drawEventDetailRow === 'function'
        ? renderer.drawEventDetailRow(...args)
        : undefined;
      return result === undefined ? 0 : result;
    },

    drawEventParts(...args) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.drawEventParts === 'function'
        ? renderer.drawEventParts(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderEvents(...args) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.renderEvents === 'function'
        ? renderer.renderEvents(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderEventModal(...args) {
      const renderer = this.eventRenderer;
      const result = typeof renderer?.renderEventModal === 'function'
        ? renderer.renderEventModal(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderCivilization(...args) {
      const renderer = this.civilizationRenderer;
      return typeof renderer?.renderCivilization === 'function'
        ? renderer.renderCivilization(...args)
        : undefined;
    },

    getTechRouteCatalog() {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechRouteCatalog === 'function'
        ? renderer.getTechRouteCatalog(...arguments) || {}
        : {};
    },

    getTechRouteMeta(route) {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechRouteMeta === 'function'
        ? renderer.getTechRouteMeta(...arguments) || { lane: 0, label: route || 'route', color: '#f0b45b', icon: 'assets/art/icon-science-cutout.webp' }
        : { lane: 0, label: route || 'route', color: '#f0b45b', icon: 'assets/art/icon-science-cutout.webp' };
    },

    getTechNodeRoutes(node = {}) {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechNodeRoutes === 'function'
        ? renderer.getTechNodeRoutes(...arguments) || []
        : [];
    },

    getTechNodeRouteLabel(node = {}) {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechNodeRouteLabel === 'function'
        ? renderer.getTechNodeRouteLabel(...arguments) || node.routeLabel || 'route'
        : node.routeLabel || 'route';
    },

    getTechNodePrimaryRoute(node = {}) {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechNodePrimaryRoute === 'function'
        ? renderer.getTechNodePrimaryRoute(...arguments) || node.route || ''
        : node.route || '';
    },

    getTechNodeLane(node = {}) {
      const renderer = this.techRenderer;
      const lane = typeof renderer?.getTechNodeLane === 'function'
        ? renderer.getTechNodeLane(...arguments)
        : undefined;
      return Number.isFinite(Number(lane)) ? Number(lane) : 0;
    },

    drawTechRouteSegments(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.drawTechRouteSegments === 'function'
        ? renderer.drawTechRouteSegments(...args)
        : undefined;
    },

    getTechNodeColor(node = {}) {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechNodeColor === 'function'
        ? renderer.getTechNodeColor(...arguments) || { fill: 'rgba(45, 34, 24, 0.82)', stroke: 'rgba(255, 226, 177, 0.18)', accent: '#f0b45b', text: '#ddd0ad', muted: 'rgba(203, 189, 150, 0.58)' }
        : { fill: 'rgba(45, 34, 24, 0.82)', stroke: 'rgba(255, 226, 177, 0.18)', accent: '#f0b45b', text: '#ddd0ad', muted: 'rgba(203, 189, 150, 0.58)' };
    },

    renderTechNode(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.renderTechNode === 'function'
        ? renderer.renderTechNode(...args)
        : undefined;
    },

    renderTechDetailPanel(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.renderTechDetailPanel === 'function'
        ? renderer.renderTechDetailPanel(...args)
        : undefined;
    },

    getTechDetailIcon() {
      const renderer = this.techRenderer;
      return typeof renderer?.getTechDetailIcon === 'function'
        ? renderer.getTechDetailIcon(...arguments) || 'assets/art/icon-science-cutout.webp'
        : 'assets/art/icon-science-cutout.webp';
    },

    renderTechDetailModal(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.renderTechDetailModal === 'function'
        ? renderer.renderTechDetailModal(...args)
        : undefined;
    },

    getTechTreeLayout(view = {}, panel = {}, options = {}) {
      const renderer = this.techRenderer;
      const result = typeof renderer?.getTechTreeLayout === 'function'
        ? renderer.getTechTreeLayout(...arguments)
        : undefined;
      return result || {
        nodes: [],
        eras: [],
        eraPositions: [],
        nodeRects: {},
        panX: Number(options.techTreePanX) || 0,
        panY: Number(options.techTreePanY) || 0,
        zoom: Math.max(0.65, Math.min(1.6, Number(options.techTreeZoom) || 1)),
        minPanX: 0,
        maxPanX: 0,
        minPanY: 0,
        maxPanY: 0,
        contentHeight: Number(panel.height) || 0,
        scaledContentWidth: Number(panel.width) || 0,
        scaledContentHeight: Number(panel.height) || 0,
        contentLeft: Number(panel.x) || 0,
        contentRight: (Number(panel.x) || 0) + (Number(panel.width) || 0),
        minContentY: Number(panel.y) || 0,
        maxContentY: (Number(panel.y) || 0) + (Number(panel.height) || 0),
        routeGuides: [],
        linkPaths: [],
        eraRailWidth: 0,
        eraRailX: 0,
        routeCatalog: {},
        laneToX: () => Number(panel.x) || 0,
        spineX: (Number(panel.x) || 0) + (Number(panel.width) || 0) / 2,
      };
    },

    renderTech(state = {}, startY = 210, panelHeight = 250, options = {}) {
      if (this.techRenderer && typeof this.techRenderer.render === 'function') {
        return this.techRenderer.render(state, startY, panelHeight, options);
      }
      return this.renderTechInternal(state, startY, panelHeight, options);
    },

    renderTechInternal(...args) {
      const renderer = this.techRenderer;
      return typeof renderer?.renderTechInternal === 'function'
        ? renderer.renderTechInternal(...args) || false
        : false;
    },

    renderMilitarySubTabs(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderMilitarySubTabs === 'function'
        ? renderer.renderMilitarySubTabs(...args)
        : undefined;
      return result === undefined ? 0 : result;
    },

    renderMilitaryArmyView(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderMilitaryArmyView === 'function'
        ? renderer.renderMilitaryArmyView(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderArmyFormationPortrait(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderArmyFormationPortrait === 'function'
        ? renderer.renderArmyFormationPortrait(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderArmyFormationCard(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderArmyFormationCard === 'function'
        ? renderer.renderArmyFormationCard(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderArmyFormationStrip(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderArmyFormationStrip === 'function'
        ? renderer.renderArmyFormationStrip(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    getScoutButtonTone(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.getScoutButtonTone === 'function'
        ? renderer.getScoutButtonTone(...args)
        : undefined;
      return result === undefined ? { fill: 'rgba(63, 47, 32, 0.78)', stroke: 'rgba(240, 180, 91, 0.25)' } : result;
    },

    renderMilitaryScoutView(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderMilitaryScoutView === 'function'
        ? renderer.renderMilitaryScoutView(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderWorldReports(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderWorldReports === 'function'
        ? renderer.renderWorldReports(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderTutorialIntro(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntro === 'function'
        ? renderer.renderTutorialIntro(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    disposeTutorialAdvisorSpine(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.disposeTutorialAdvisorSpine === 'function'
        ? renderer.disposeTutorialAdvisorSpine(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    resolveTutorialIntroTarget(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.resolveTutorialIntroTarget === 'function'
        ? renderer.resolveTutorialIntroTarget(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    findHitTarget(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.findHitTarget === 'function'
        ? renderer.findHitTarget(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    inflateRect(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.inflateRect === 'function'
        ? renderer.inflateRect(...args)
        : undefined;
      return result === undefined ? { x: 0, y: 0, width: 0, height: 0, action: null } : result;
    },

    renderTutorialIntroMarch(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroMarch === 'function'
        ? renderer.renderTutorialIntroMarch(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderTutorialIntroUnit(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroUnit === 'function'
        ? renderer.renderTutorialIntroUnit(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderTutorialIntroSpotlight(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroSpotlight === 'function'
        ? renderer.renderTutorialIntroSpotlight(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    normalizeRect(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.normalizeRect === 'function'
        ? renderer.normalizeRect(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    renderTutorialIntroFinger(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroFinger === 'function'
        ? renderer.renderTutorialIntroFinger(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderTutorialIntroDialogue(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroDialogue === 'function'
        ? renderer.renderTutorialIntroDialogue(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderTutorialAdvisorDialogue(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialAdvisorDialogue === 'function'
        ? renderer.renderTutorialAdvisorDialogue(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    clearTutorialAdvisorDialogue(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.clearTutorialAdvisorDialogue === 'function'
        ? renderer.clearTutorialAdvisorDialogue(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderTutorialIntroAdvisorPortrait(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialIntroAdvisorPortrait === 'function'
        ? renderer.renderTutorialIntroAdvisorPortrait(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderTutorialAdvisorSpineLayer(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialAdvisorSpineLayer === 'function'
        ? renderer.renderTutorialAdvisorSpineLayer(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawTutorialAdvisorImageCover(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.drawTutorialAdvisorImageCover === 'function'
        ? renderer.drawTutorialAdvisorImageCover(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderMilitary(...args) {
      const renderer = this.militaryRenderer;
      const result = typeof renderer?.renderMilitary === 'function'
        ? renderer.renderMilitary(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderMainPanel(...args) {
      const renderer = this.hudTabPageRenderer;
      return typeof renderer?.renderMainPanel === 'function'
        ? renderer.renderMainPanel(...args)
        : undefined;
    },

    renderHudTabPage(...args) {
      const renderer = this.hudTabPageRenderer;
      return typeof renderer?.renderHudTabPage === 'function'
        ? renderer.renderHudTabPage(...args)
        : undefined;
    },

    renderHudTabPageWithTransition(...args) {
      const renderer = this.hudTabPageRenderer;
      return typeof renderer?.renderHudTabPageWithTransition === 'function'
        ? renderer.renderHudTabPageWithTransition(...args)
        : undefined;
    },

    getWorldMapLayerLayout(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.getWorldMapLayerLayout === 'function'
        ? renderer.getWorldMapLayerLayout(...args)
        : undefined;
      return result === undefined ? null : result;
    },

    renderMapHomeWorldView(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.renderMapHomeWorldView === 'function'
        ? renderer.renderMapHomeWorldView(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    collectMapHomeWorldSiteHitTargets(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.collectMapHomeWorldSiteHitTargets === 'function'
        ? renderer.collectMapHomeWorldSiteHitTargets(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderMapHomeEmptyWorld(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.renderMapHomeEmptyWorld === 'function'
        ? renderer.renderMapHomeEmptyWorld(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderWorldMapLayer(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.renderWorldMapLayer === 'function'
        ? renderer.renderWorldMapLayer(...args)
        : undefined;
      this.lastWorldTileMapContext = this.worldMapLayerRenderer?.lastWorldTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || this.lastWorldTileMapContext
        || null;
      return result === undefined ? false : result;
    },

    renderWorldMapSnapshotLayer(...args) {
      const renderer = this.worldMapLayerRenderer;
      const result = typeof renderer?.renderWorldMapSnapshotLayer === 'function'
        ? renderer.renderWorldMapSnapshotLayer(...args)
        : undefined;
      this.lastWorldTileMapContext = this.worldMapLayerRenderer?.lastWorldTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || this.lastWorldTileMapContext
        || null;
      return result === undefined ? false : result;
    },

    renderMapCommandDock(...args) {
      const renderer = this.mapCommandRenderer;
      return typeof renderer?.renderMapCommandDock === 'function'
        ? renderer.renderMapCommandDock(...args)
        : undefined;
    },

    renderFloatingSubcityButton(...args) {
      const renderer = this.mapCommandRenderer;
      return typeof renderer?.renderFloatingSubcityButton === 'function'
        ? renderer.renderFloatingSubcityButton(...args)
        : undefined;
    },

    renderFloatingEventButton(...args) {
      const renderer = this.mapCommandRenderer;
      return typeof renderer?.renderFloatingEventButton === 'function'
        ? renderer.renderFloatingEventButton(...args)
        : undefined;
    },

    renderMapCommandPanel(...args) {
      const renderer = this.mapCommandRenderer;
      return typeof renderer?.renderMapCommandPanel === 'function'
        ? renderer.renderMapCommandPanel(...args)
        : undefined;
    },

    renderTabs(...args) {
      const renderer = this.tabBarRenderer;
      return typeof renderer?.renderTabs === 'function' ? renderer.renderTabs(...args) : undefined;
    },

    parsePixelValue(value) {
      if (typeof value === 'number') return value;
      const parsed = Number(String(value ?? '').replace('px', ''));
      return Number.isFinite(parsed) ? parsed : 0;
    },

    easeOutCubic(value) {
      const t = Math.max(0, Math.min(1, Number(value) || 0));
      return 1 - ((1 - t) ** 3);
    },

    getTransitionFrame(transition = null) {
      if (!transition) return null;
      const startedAt = Number(transition.startedAt);
      if (!Number.isFinite(startedAt)) return null;
      const durationMs = Math.max(1, Number(transition.durationMs) || 220);
      const progress = Math.max(0, Math.min(1, (this.getNow() - startedAt) / durationMs));
      if (progress >= 1) return null;
      return {
        progress,
        eased: this.easeOutCubic(progress),
        direction: Number(transition.direction) < 0 ? -1 : 1,
      };
    },

    interpolateRect(fromRect = {}, toRect = {}, progress = 1) {
      const eased = this.easeOutCubic(progress);
      const read = (rect, key, fallback = 0) => Number(rect?.[key] ?? fallback) || 0;
      const lerp = (from, to) => from + (to - from) * eased;
      const left = lerp(read(fromRect, 'left'), read(toRect, 'left'));
      const top = lerp(read(fromRect, 'top'), read(toRect, 'top'));
      const width = lerp(read(fromRect, 'width'), read(toRect, 'width'));
      const height = lerp(read(fromRect, 'height'), read(toRect, 'height'));
      return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
      };
    },

    renderTutorialHighlight(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.renderTutorialHighlight === 'function'
        ? renderer.renderTutorialHighlight(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    addTutorialShield(...args) {
      const renderer = this.tutorialRenderer;
      const result = typeof renderer?.addTutorialShield === 'function'
        ? renderer.addTutorialShield(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderHudOverlay(...args) {
      const renderer = this.hudOverlayRenderer;
      if (!renderer || typeof renderer.renderHudOverlay !== 'function') return undefined;
      return renderer.renderHudOverlay(...args);
    },

    render(state = {}, options = {}) {
      const renderer = this.frameRenderer;
      if (renderer) {
        return typeof renderer.render === 'function' ? renderer.render(...arguments) : undefined;
      }
      if (options.mode === 'hud') return this.renderHudOverlay(state, options);
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clear();
      this.renderTopBar(state, options);
      this.renderTabs(options.activeTab || 'resources', state, options);
      this.endFrame(options);
      return undefined;
    },

    renderMapHomeOverlays() {
      const renderer = this.frameRenderer;
      if (!renderer || typeof renderer.renderMapHomeOverlays !== 'function') return undefined;
      return renderer.renderMapHomeOverlays(...arguments);
    },

    renderMapHomeExplorerHud(...args) {
      const renderer = this.frameRenderer;
      if (!renderer || typeof renderer.renderMapHomeExplorerHud !== 'function') return false;
      return renderer.renderMapHomeExplorerHud(...args);
    },

    renderCanvasDebugResetButton(...args) {
      const renderer = this.frameRenderer;
      if (!renderer || typeof renderer.renderCanvasDebugResetButton !== 'function') return false;
      return renderer.renderCanvasDebugResetButton(...args);
    },
  });

  function installPageFacades(RendererClass) {
    const proto = RendererClass?.prototype;
    if (!proto) return RendererClass;
    const facadeDescriptors = {};
    for (const facadeMethodName of Object.keys(PAGE_FACADE_METHODS)) {
      facadeDescriptors[facadeMethodName] = {
        configurable: true,
        writable: true,
        value: PAGE_FACADE_METHODS[facadeMethodName],
      };
    }
    Object.defineProperties(proto, facadeDescriptors);
    return RendererClass;
  }

  const api = {
    PAGE_FACADE_METHODS,
    installPageFacades,
  };

  global.CanvasGameRendererPageFacades = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
