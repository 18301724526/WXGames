(function (global) {
  const sharedFamousPortraitLayout = (() => {
    if (global.FamousPortraitLayout) return global.FamousPortraitLayout;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/FamousPortraitLayout');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const FamousCanvasModel = global.FamousCanvasModel || (typeof require !== 'undefined' ? require('./FamousCanvasModel') : null);
  const FamousPortraitCanvasRenderer = global.FamousPortraitCanvasRenderer || (typeof require !== 'undefined' ? require('./FamousPortraitCanvasRenderer') : null);
  const FamousSkillCanvasRenderer = global.FamousSkillCanvasRenderer || (typeof require !== 'undefined' ? require('./FamousSkillCanvasRenderer') : null);
  const FamousPanelCanvasRenderer = global.FamousPanelCanvasRenderer || (typeof require !== 'undefined' ? require('./FamousPanelCanvasRenderer') : null);

  class FamousCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get activeFamousSkillTooltip() {
      return this.host?.activeFamousSkillTooltip;
    }

    set activeFamousSkillTooltip(value) {
      if (this.host) this.host.activeFamousSkillTooltip = value;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get famousSkillHitTargets() {
      return this.host?.famousSkillHitTargets;
    }

    get height() {
      return this.host?.height;
    }

    get hoverPoint() {
      return this.host?.hoverPoint;
    }

    set hoverPoint(value) {
      if (this.host) this.host.hoverPoint = value;
    }

    get pinnedFamousSkillTooltip() {
      return this.host?.pinnedFamousSkillTooltip;
    }

    set pinnedFamousSkillTooltip(value) {
      if (this.host) this.host.pinnedFamousSkillTooltip = value;
    }

    get presenter() {
      return this.host?.presenter;
    }

    get width() {
      return this.host?.width;
    }

    callDrawingSurface(method, args = []) {
      const explicitSurface = this.drawingSurface;
      if (explicitSurface && typeof explicitSurface[method] === 'function') {
        return explicitSurface[method](...Array.from(args));
      }
      const fallbackSurface = this.host;
      if (fallbackSurface && typeof fallbackSurface[method] === 'function') {
        return fallbackSurface[method](...Array.from(args));
      }
      return undefined;
    }

    addHitTarget(...args) {
      return this.callDrawingSurface('addHitTarget', args);
    }

    containsPoint(...args) {
      return this.callDrawingSurface('containsPoint', args);
    }

    createGradient(...args) {
      return this.callDrawingSurface('createGradient', args);
    }

    drawButton(...args) {
      return this.callDrawingSurface('drawButton', args);
    }

    drawLine(...args) {
      return this.callDrawingSurface('drawLine', args);
    }

    drawPanel(...args) {
      return this.callDrawingSurface('drawPanel', args);
    }

    drawText(...args) {
      return this.callDrawingSurface('drawText', args);
    }

    drawTextLines(...args) {
      return this.callDrawingSurface('drawTextLines', args);
    }

    getAsset(...args) {
      return this.callDrawingSurface('getAsset', args);
    }

    getLayout(...args) {
      return this.callDrawingSurface('getLayout', args);
    }

    roundRectPath(...args) {
      return this.callDrawingSurface('roundRectPath', args);
    }

    truncateText(...args) {
      return this.callDrawingSurface('truncateText', args);
    }

    wrapTextLimit(...args) {
      return this.callDrawingSurface('wrapTextLimit', args);
    }

    static getFamousPortraitLayerLayout() {
      return sharedFamousPortraitLayout || {};
    }

    render(state = {}, options = {}) {
      return this.renderFamousPersonsPanel(state, options);
    }

    isSameFamousSkillTooltipAction(left = null, right = null) {
      return FamousCanvasModel.isSameFamousSkillTooltipAction(left, right);
    }

    clearFamousSkillTooltip() {
      return FamousCanvasModel.clearFamousSkillTooltip(this);
    }

    setPinnedFamousSkillTooltip(action = null) {
      return FamousCanvasModel.setPinnedFamousSkillTooltip(this, action);
    }

    getFamousSkillTooltipAction(point = {}) {
      return FamousCanvasModel.getFamousSkillTooltipAction(this, point);
    }

    drawFamousPortraitLayer(assetPath, key, baseFrame, layerLayout) {
      return FamousPortraitCanvasRenderer.drawFamousPortraitLayer(this, assetPath, key, baseFrame, layerLayout);
    }

    drawFamousPortrait(card = {}, x, y, size, options = {}) {
      return FamousPortraitCanvasRenderer.drawFamousPortrait(this, card, x, y, size, options);
    }

    drawFamousAttributeRadar(attributes = [], x, y, size) {
      return FamousPortraitCanvasRenderer.drawFamousAttributeRadar(this, attributes, x, y, size);
    }

    drawFamousAttributePointControls(card = {}, x, y, width) {
      return FamousPortraitCanvasRenderer.drawFamousAttributePointControls(this, card, x, y, width);
    }

    getFamousQualityStyle(frame = 'white') {
      return FamousCanvasModel.getFamousQualityStyle(frame);
    }

    drawFamousAvatarCard(card = {}, x, y, width, height, options = {}) {
      return FamousPanelCanvasRenderer.drawFamousAvatarCard(this, card, x, y, width, height, options);
    }

    renderFamousRosterGrid(people = [], x, y, width, maxBottom, page = 0) {
      return FamousPanelCanvasRenderer.renderFamousRosterGrid(this, people, x, y, width, maxBottom, page);
    }

    renderFamousPersonDetail(card = {}, x, y, width, height) {
      return FamousPanelCanvasRenderer.renderFamousPersonDetail(this, card, x, y, width, height);
    }

    renderFamousPersonItem(card = {}, x, y, width, options = {}) {
      return FamousPanelCanvasRenderer.renderFamousPersonItem(this, card, x, y, width, options);
    }

    renderSkillBadges(card = {}, x, y, width, options = {}) {
      return FamousSkillCanvasRenderer.renderSkillBadges(this, card, x, y, width, options);
    }

    renderFamousSkillTooltip(action = null) {
      return FamousSkillCanvasRenderer.renderFamousSkillTooltip(this, action);
    }

    normalizeFamousPersonsPage(total, page, pageSize) {
      return FamousCanvasModel.normalizeFamousPersonsPage(total, page, pageSize);
    }

    renderFamousPersonsPager(x, y, width, page, pages) {
      return FamousPanelCanvasRenderer.renderFamousPersonsPager(this, x, y, width, page, pages);
    }

    renderFamousPersonsPanel(state = {}, options = {}) {
      return FamousPanelCanvasRenderer.renderFamousPersonsPanel(this, state, options);
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = FamousCanvasRenderer;
  else global.FamousCanvasRenderer = FamousCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
