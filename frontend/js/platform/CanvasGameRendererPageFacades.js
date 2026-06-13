(function (global) {
  const PAGE_FACADE_METHODS = Object.freeze({
    clear(...args) {
      return this.delegateSurfaceRenderer('clear', args);
    },

    clearAll(...args) {
      return this.delegateSurfaceRenderer('clearAll', args);
    },

    drawText(...args) {
      return this.delegateSurfaceRenderer('drawText', args);
    },

    drawTextLines(...args) {
      return this.delegateSurfaceRenderer('drawTextLines', args);
    },

    wrapText(...args) {
      const result = this.delegateSurfaceRenderer('wrapText', args);
      return result === undefined ? [String(args[0] ?? '')].filter(Boolean) : result;
    },

    measureTextWidth(...args) {
      const result = this.delegateSurfaceRenderer('measureTextWidth', args);
      const [text, options = {}] = args;
      return result === undefined ? String(text ?? '').length * (options.size || 14) * 0.55 : result;
    },

    truncateText(...args) {
      const result = this.delegateSurfaceRenderer('truncateText', args);
      const [text, maxWidth, options = {}] = args;
      return result === undefined ? String(text ?? '').slice(0, Math.max(0, Number(maxWidth) || 0) || undefined) : result;
    },

    wrapTextLimit(...args) {
      const result = this.delegateSurfaceRenderer('wrapTextLimit', args);
      return result === undefined ? this.wrapText(args[0], args[1], args[3]).slice(0, Math.max(1, Number(args[2]) || 1)) : result;
    },

    drawLine(...args) {
      return this.delegateSurfaceRenderer('drawLine', args);
    },

    drawPolyline(...args) {
      return this.delegateSurfaceRenderer('drawPolyline', args);
    },

    drawCurvePath(...args) {
      return this.delegateSurfaceRenderer('drawCurvePath', args);
    },

    drawCircle(...args) {
      return this.delegateSurfaceRenderer('drawCircle', args);
    },

    beginFrame(...args) {
      const result = this.delegateSurfaceRenderer('beginFrame', args);
      return result === undefined ? Date.now() : result;
    },

    endFrame(...args) {
      return this.delegateSurfaceRenderer('endFrame', args);
    },

    getNow(...args) {
      const result = this.delegateSurfaceRenderer('getNow', args);
      return result === undefined ? (this.frameNow || Date.now()) : result;
    },

    updateFps(...args) {
      const result = this.delegateSurfaceRenderer('updateFps', args);
      return result === undefined ? this.currentFps : result;
    },

    renderFpsOverlay(...args) {
      return this.delegateSurfaceRenderer('renderFpsOverlay', args);
    },

    drawPanel(...args) {
      return this.delegateSurfaceRenderer('drawPanel', args);
    },

    drawButton(...args) {
      return this.delegateSurfaceRenderer('drawButton', args);
    },

    drawPrimaryActionButton(...args) {
      return this.delegateSurfaceRenderer('drawPrimaryActionButton', args);
    },

    drawProgressBar(...args) {
      return this.delegateSurfaceRenderer('drawProgressBar', args);
    },

    drawIconCard(...args) {
      return this.delegateSurfaceRenderer('drawIconCard', args);
    },

    renderSectionHeader(...args) {
      return this.delegateSurfaceRenderer('renderSectionHeader', args);
    },

    getTopBarBottom(...args) {
      const result = this.delegateSurfaceRenderer('getTopBarBottom', args);
      if (result !== undefined) return result;
      const [state = {}, options = {}] = args;
      if (options.isMapHome) return 72;
      if (!this.presenter) return 84;
      const cityView = this.presenter.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      return 12 + (cityView.hidden ? 128 : 166) + 12;
    },

    delegateHomeRenderer(method, args = []) {
      const renderer = this.homeRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderTopBar(...args) {
      const result = this.delegateHomeRenderer('renderTopBar', args);
      return result === undefined ? 84 : result;
    },

    renderMapHomeTopBar(...args) {
      const result = this.delegateHomeRenderer('renderMapHomeTopBar', args);
      return result === undefined ? 72 : result;
    },

    delegateGuideTaskRenderer(method, args = []) {
      const renderer = this.guideTaskRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderGuideTasks(...args) {
      const result = this.delegateGuideTaskRenderer('renderGuideTasks', args);
      return result === undefined ? (args.length > 1 ? args[1] : 0) : result;
    },

    renderTaskCenterButton(...args) {
      return this.delegateGuideTaskRenderer('renderTaskCenterButton', args);
    },

    renderGuidebookButton(...args) {
      return this.delegateGuideTaskRenderer('renderGuidebookButton', args);
    },

    renderGuidebookPanel(...args) {
      const result = this.delegateGuideTaskRenderer('renderGuidebookPanel', args);
      return result === undefined ? false : result;
    },

    renderTaskCenterPanel(...args) {
      const result = this.delegateGuideTaskRenderer('renderTaskCenterPanel', args);
      return result === undefined ? false : result;
    },

    renderPopulation(...args) {
      const renderer = this.cityPeopleRenderer;
      const result = renderer && typeof renderer.renderPopulation === 'function'
        ? renderer.renderPopulation(...args)
        : undefined;
      return result === undefined ? (Number(args[1]) || 84) + 180 : result;
    },

    renderHomeFeatureGrid(...args) {
      const result = this.delegateHomeRenderer('renderHomeFeatureGrid', args);
      return result === undefined ? (Number(args[1]) || 400) : result;
    },

    delegateSystemRenderer(method, args = []) {
      const renderer = this.systemRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderLoginPanel(...args) {
      return this.delegateSystemRenderer('renderLoginPanel', args);
    },

    renderLoadingScreen(...args) {
      return this.delegateSystemRenderer('renderLoadingScreen', args);
    },

    renderNetworkOverlay(...args) {
      const result = this.delegateSystemRenderer('renderNetworkOverlay', args);
      return result === undefined ? false : result;
    },

    renderSettingsPanel(...args) {
      return this.delegateSystemRenderer('renderSettingsPanel', args);
    },

    renderConfirmDialog(...args) {
      const result = this.delegateSystemRenderer('renderConfirmDialog', args);
      return result === undefined ? false : result;
    },

    renderLogsPanel(...args) {
      return this.delegateSystemRenderer('renderLogsPanel', args);
    },

    delegateCityRenderer(method, args = []) {
      const renderer = this.cityRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    getActiveCitySummary(...args) {
      const result = this.delegateCityRenderer('getActiveCitySummary', args);
      return result === undefined ? {
        id: 'capital',
        name: '棣栭兘',
        tag: '涓诲煄',
        level: '',
        population: {},
        military: {},
        terrainLabel: '骞冲師',
      } : result;
    },

    renderCitySwitcherMenu(...args) {
      return this.delegateCityRenderer('renderCitySwitcherMenu', args);
    },

    renderCityManagementPanel(...args) {
      return this.delegateCityRenderer('renderCityManagementPanel', args);
    },

    renderCityMilitaryPanel(...args) {
      return this.delegateCityRenderer('renderCityMilitaryPanel', args);
    },

    renderSubcityListPanel(...args) {
      return this.delegateCityRenderer('renderSubcityListPanel', args);
    },

    delegateOverlayRenderer(method, args = []) {
      const renderer = this.overlayRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderNamingModal(...args) {
      return this.delegateOverlayRenderer('renderNamingModal', args);
    },

    renderFloatingTexts(...args) {
      return this.delegateOverlayRenderer('renderFloatingTexts', args);
    },

    drawRewardParticle(...args) {
      return this.delegateOverlayRenderer('drawRewardParticle', args);
    },

    renderRewardReveal(...args) {
      return this.delegateOverlayRenderer('renderRewardReveal', args);
    },

    renderResourceDetailsPanel(...args) {
      return this.delegateOverlayRenderer('renderResourceDetailsPanel', args);
    },

    delegateAdvisorRenderer(method, args = []) {
      const renderer = this.advisorRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderAdvisor(...args) {
      return this.delegateAdvisorRenderer('renderAdvisor', args);
    },

    getMapHomeFloatingButtonLayout(...args) {
      const result = this.delegateAdvisorRenderer('getMapHomeFloatingButtonLayout', args);
      return result === undefined ? { x: 0, y: 0, size: 48 } : result;
    },

    renderFloatingAdvisorButton(...args) {
      return this.delegateAdvisorRenderer('renderFloatingAdvisorButton', args);
    },

    renderAdvisorPanel(...args) {
      return this.delegateAdvisorRenderer('renderAdvisorPanel', args);
    },

    renderFamousPersonItem(...args) {
      const result = this.delegateFamousRenderer('renderFamousPersonItem', args);
      return result === undefined ? args[2] || 0 : result;
    },

    renderFamousSkillTooltip(...args) {
      const result = this.delegateFamousRenderer('renderFamousSkillTooltip', args);
      return result === undefined ? undefined : result;
    },

    normalizeFamousPersonsPage(...args) {
      const result = this.delegateFamousRenderer('normalizeFamousPersonsPage', args);
      if (result !== undefined) return result;
      const total = args[0];
      const page = args[1];
      const pageSize = args[2];
      const pages = Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, pageSize)));
      const index = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
      return { index, pages };
    },

    renderFamousPersonsPager(...args) {
      const result = this.delegateFamousRenderer('renderFamousPersonsPager', args);
      return result === undefined ? undefined : result;
    },

    renderFamousPersonsPanel(...args) {
      const result = this.delegateFamousRenderer('renderFamousPersonsPanel', args);
      return result === undefined ? false : result;
    },

    delegateArmyFormationEditorRenderer(method, args = []) {
      const renderer = this.armyFormationEditorRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderArmyFormationEditor(...args) {
      return this.delegateArmyFormationEditorRenderer('renderArmyFormationEditor', args);
    },

    delegateBuildingRenderer(method, args = []) {
      const renderer = this.buildingRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderBuildings(...args) {
      const result = this.delegateBuildingRenderer('renderBuildings', args);
      return result === undefined ? false : result;
    },

    drawBuildingCategoryTabs(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingCategoryTabs', args);
      return result === undefined ? false : result;
    },

    drawBuildingInfoLine(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingInfoLine', args);
      return result === undefined ? false : result;
    },

    drawBuildingPlanningBadges(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingPlanningBadges', args);
      return result === undefined ? false : result;
    },

    resourceShortName(resource) {
      const result = this.delegateBuildingRenderer('resourceShortName', [resource]);
      return result === undefined ? resource : result;
    },

    resourceIconPath(resource) {
      const result = this.delegateBuildingRenderer('resourceIconPath', [resource]);
      return result === undefined ? '' : result;
    },

    buildingCostResourceAliases(resource) {
      const result = this.delegateBuildingRenderer('buildingCostResourceAliases', [resource]);
      return result === undefined ? [resource] : result;
    },

    formatBuildingCostAmount(value) {
      const result = this.delegateBuildingRenderer('formatBuildingCostAmount', [value]);
      return result === undefined ? String(value ?? 0) : result;
    },

    getBuildingCostSlot(...args) {
      const result = this.delegateBuildingRenderer('getBuildingCostSlot', args);
      return result === undefined ? { resource: args[1], value: 0, text: '0', present: false } : result;
    },

    getOwnedBuildingResource(...args) {
      const result = this.delegateBuildingRenderer('getOwnedBuildingResource', args);
      return result === undefined ? 0 : result;
    },

    drawBuildingActionButton(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingActionButton', args);
      return result === undefined ? false : result;
    },

    drawBuildingCostChips(...args) {
      const result = this.delegateBuildingRenderer('drawBuildingCostChips', args);
      return result === undefined ? false : result;
    },

    delegateEventRenderer(method, args = []) {
      const renderer = this.eventRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    eventRowColor(tone) {
      const result = this.delegateEventRenderer('eventRowColor', [tone]);
      return result === undefined ? '#cbbd96' : result;
    },

    drawEventDetailRow(...args) {
      const result = this.delegateEventRenderer('drawEventDetailRow', args);
      return result === undefined ? 0 : result;
    },

    drawEventParts(...args) {
      const result = this.delegateEventRenderer('drawEventParts', args);
      return result === undefined ? false : result;
    },

    renderEvents(...args) {
      const result = this.delegateEventRenderer('renderEvents', args);
      return result === undefined ? false : result;
    },

    renderEventModal(...args) {
      const result = this.delegateEventRenderer('renderEventModal', args);
      return result === undefined ? false : result;
    },

    delegateCivilizationRenderer(method, args = []) {
      const renderer = this.civilizationRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderCivilization(...args) {
      return this.delegateCivilizationRenderer('renderCivilization', args);
    },

    delegateTechRenderer(method, args = []) {
      const renderer = this.techRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    },

    getTechRouteCatalog() {
      return this.delegateTechRenderer('getTechRouteCatalog', arguments) || {};
    },

    getTechRouteMeta(route) {
      return this.delegateTechRenderer('getTechRouteMeta', arguments) || { lane: 0, label: route || 'route', color: '#f0b45b', icon: 'assets/art/icon-science-cutout.webp' };
    },

    getTechNodeRoutes(node = {}) {
      return this.delegateTechRenderer('getTechNodeRoutes', arguments) || [];
    },

    getTechNodeRouteLabel(node = {}) {
      return this.delegateTechRenderer('getTechNodeRouteLabel', arguments) || node.routeLabel || 'route';
    },

    getTechNodePrimaryRoute(node = {}) {
      return this.delegateTechRenderer('getTechNodePrimaryRoute', arguments) || node.route || '';
    },

    getTechNodeLane(node = {}) {
      const lane = this.delegateTechRenderer('getTechNodeLane', arguments);
      return Number.isFinite(Number(lane)) ? Number(lane) : 0;
    },

    drawTechRouteSegments(...args) {
      return this.delegateTechRenderer('drawTechRouteSegments', args);
    },

    getTechNodeColor(node = {}) {
      return this.delegateTechRenderer('getTechNodeColor', arguments) || { fill: 'rgba(45, 34, 24, 0.82)', stroke: 'rgba(255, 226, 177, 0.18)', accent: '#f0b45b', text: '#ddd0ad', muted: 'rgba(203, 189, 150, 0.58)' };
    },

    renderTechNode(...args) {
      return this.delegateTechRenderer('renderTechNode', args);
    },

    renderTechDetailPanel(...args) {
      return this.delegateTechRenderer('renderTechDetailPanel', args);
    },

    getTechDetailIcon() {
      return this.delegateTechRenderer('getTechDetailIcon', arguments) || 'assets/art/icon-science-cutout.webp';
    },

    renderTechDetailModal(...args) {
      return this.delegateTechRenderer('renderTechDetailModal', args);
    },

    getTechTreeLayout(view = {}, panel = {}, options = {}) {
      return this.delegateTechRenderer('getTechTreeLayout', arguments) || {
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
      return this.delegateTechRenderer('renderTechInternal', args) || false;
    },

    delegateMilitaryRenderer(method, args = []) {
      const renderer = this.militaryRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderMilitarySubTabs(...args) {
      const result = this.delegateMilitaryRenderer('renderMilitarySubTabs', args);
      return result === undefined ? 0 : result;
    },

    renderMilitaryArmyView(...args) {
      const result = this.delegateMilitaryRenderer('renderMilitaryArmyView', args);
      return result === undefined ? false : result;
    },

    renderArmyFormationPortrait(...args) {
      const result = this.delegateMilitaryRenderer('renderArmyFormationPortrait', args);
      return result === undefined ? false : result;
    },

    renderArmyFormationCard(...args) {
      const result = this.delegateMilitaryRenderer('renderArmyFormationCard', args);
      return result === undefined ? false : result;
    },

    renderArmyFormationStrip(...args) {
      const result = this.delegateMilitaryRenderer('renderArmyFormationStrip', args);
      return result === undefined ? false : result;
    },

    getScoutButtonTone(...args) {
      const result = this.delegateMilitaryRenderer('getScoutButtonTone', args);
      return result === undefined ? { fill: 'rgba(63, 47, 32, 0.78)', stroke: 'rgba(240, 180, 91, 0.25)' } : result;
    },

    renderMilitaryScoutView(...args) {
      const result = this.delegateMilitaryRenderer('renderMilitaryScoutView', args);
      return result === undefined ? false : result;
    },

    renderWorldReports(...args) {
      const result = this.delegateMilitaryRenderer('renderWorldReports', args);
      return result === undefined ? false : result;
    },

    delegateTutorialRenderer(method, args = []) {
      const renderer = this.tutorialRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderTutorialIntro(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntro', args);
      return result === undefined ? false : result;
    },

    disposeTutorialAdvisorSpine(...args) {
      const result = this.delegateTutorialRenderer('disposeTutorialAdvisorSpine', args);
      return result === undefined ? false : result;
    },

    resolveTutorialIntroTarget(...args) {
      const result = this.delegateTutorialRenderer('resolveTutorialIntroTarget', args);
      return result === undefined ? null : result;
    },

    findHitTarget(...args) {
      const result = this.delegateTutorialRenderer('findHitTarget', args);
      return result === undefined ? null : result;
    },

    inflateRect(...args) {
      const result = this.delegateTutorialRenderer('inflateRect', args);
      return result === undefined ? { x: 0, y: 0, width: 0, height: 0, action: null } : result;
    },

    renderTutorialIntroMarch(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroMarch', args);
      return result === undefined ? false : result;
    },

    renderTutorialIntroUnit(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroUnit', args);
      return result === undefined ? false : result;
    },

    renderTutorialIntroSpotlight(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroSpotlight', args);
      return result === undefined ? false : result;
    },

    normalizeRect(...args) {
      const result = this.delegateTutorialRenderer('normalizeRect', args);
      return result === undefined ? null : result;
    },

    renderTutorialIntroFinger(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroFinger', args);
      return result === undefined ? false : result;
    },

    renderTutorialIntroDialogue(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroDialogue', args);
      return result === undefined ? false : result;
    },

    renderTutorialAdvisorDialogue(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialAdvisorDialogue', args);
      return result === undefined ? false : result;
    },

    clearTutorialAdvisorDialogue(...args) {
      const result = this.delegateTutorialRenderer('clearTutorialAdvisorDialogue', args);
      return result === undefined ? false : result;
    },

    renderTutorialIntroAdvisorPortrait(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialIntroAdvisorPortrait', args);
      return result === undefined ? false : result;
    },

    renderTutorialAdvisorSpineLayer(...args) {
      const result = this.delegateTutorialRenderer('renderTutorialAdvisorSpineLayer', args);
      return result === undefined ? false : result;
    },

    drawTutorialAdvisorImageCover(...args) {
      const result = this.delegateTutorialRenderer('drawTutorialAdvisorImageCover', args);
      return result === undefined ? false : result;
    },

    getTutorialAdvisorSpineFrame(...args) {
      const result = this.delegateTutorialRenderer('getTutorialAdvisorSpineFrame', args);
      return result === undefined ? null : result;
    },

    renderMilitary(...args) {
      const result = this.delegateMilitaryRenderer('renderMilitary', args);
      return result === undefined ? false : result;
    },

    delegateHudTabPageRenderer(method, args = []) {
      const renderer = this.hudTabPageRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderMainPanel(...args) {
      return this.delegateHudTabPageRenderer('renderMainPanel', args);
    },

    renderHudTabPage(...args) {
      return this.delegateHudTabPageRenderer('renderHudTabPage', args);
    },

    renderHudTabPageWithTransition(...args) {
      return this.delegateHudTabPageRenderer('renderHudTabPageWithTransition', args);
    },

    delegateWorldMapLayerRenderer(method, args = []) {
      const renderer = this.worldMapLayerRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    getWorldMapLayerLayout(...args) {
      const result = this.delegateWorldMapLayerRenderer('getWorldMapLayerLayout', args);
      return result === undefined ? null : result;
    },

    renderMapHomeWorldView(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderMapHomeWorldView', args);
      return result === undefined ? false : result;
    },

    collectMapHomeWorldSiteHitTargets(...args) {
      const result = this.delegateWorldMapLayerRenderer('collectMapHomeWorldSiteHitTargets', args);
      return result === undefined ? false : result;
    },

    renderMapHomeEmptyWorld(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderMapHomeEmptyWorld', args);
      return result === undefined ? false : result;
    },

    renderWorldMapLayer(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderWorldMapLayer', args);
      this.lastWorldTileMapContext = this.worldMapLayerRenderer?.lastWorldTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || this.lastWorldTileMapContext
        || null;
      return result === undefined ? false : result;
    },

    renderWorldMapSnapshotLayer(...args) {
      const result = this.delegateWorldMapLayerRenderer('renderWorldMapSnapshotLayer', args);
      this.lastWorldTileMapContext = this.worldMapLayerRenderer?.lastWorldTileMapContext
        || this.worldMapRenderer?.lastWorldTileMapContext
        || this.lastWorldTileMapContext
        || null;
      return result === undefined ? false : result;
    },

    delegateMapCommandRenderer(method, args = []) {
      const renderer = this.mapCommandRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderMapCommandDock(...args) {
      return this.delegateMapCommandRenderer('renderMapCommandDock', args);
    },

    renderFloatingSubcityButton(...args) {
      return this.delegateMapCommandRenderer('renderFloatingSubcityButton', args);
    },

    renderFloatingEventButton(...args) {
      return this.delegateMapCommandRenderer('renderFloatingEventButton', args);
    },

    renderMapCommandPanel(...args) {
      return this.delegateMapCommandRenderer('renderMapCommandPanel', args);
    },

    delegateTabBarRenderer(method, args = []) {
      const renderer = this.tabBarRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderTabs(...args) {
      return this.delegateTabBarRenderer('renderTabs', args);
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
      const result = this.delegateTutorialRenderer('renderTutorialHighlight', args);
      return result === undefined ? false : result;
    },

    addTutorialShield(...args) {
      const result = this.delegateTutorialRenderer('addTutorialShield', args);
      return result === undefined ? false : result;
    },

    delegateHudOverlayRenderer(method, args = []) {
      const renderer = this.hudOverlayRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    },

    renderHudOverlay(...args) {
      return this.delegateHudOverlayRenderer('renderHudOverlay', args);
    },

    delegateFrameRenderer(method, args = []) {
      const renderer = this.frameRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...Array.from(args));
    },

    render(state = {}, options = {}) {
      const result = this.delegateFrameRenderer('render', arguments);
      if (result !== undefined || this.frameRenderer) return result;
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
      const result = this.delegateFrameRenderer('renderMapHomeOverlays', arguments);
      return result === undefined ? undefined : result;
    },

    renderMapHomeExplorerHud(...args) {
      const result = this.delegateFrameRenderer('renderMapHomeExplorerHud', args);
      return result === undefined ? false : result;
    },

    renderCanvasDebugResetButton(...args) {
      const result = this.delegateFrameRenderer('renderCanvasDebugResetButton', args);
      return result === undefined ? false : result;
    },
  });

  function installPageFacades(RendererClass) {
    const proto = RendererClass?.prototype;
    if (!proto) return RendererClass;
    Object.entries(PAGE_FACADE_METHODS).forEach(([method, value]) => {
      Object.defineProperty(proto, method, {
        configurable: true,
        writable: true,
        value,
      });
    });
    return RendererClass;
  }

  const api = {
    PAGE_FACADE_METHODS,
    installPageFacades,
  };

  global.CanvasGameRendererPageFacades = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
