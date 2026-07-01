(function (global) {
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
      return Number(this.host?.height) || 0;
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
      return Number(this.host?.width) || 0;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    containsPoint(...args) { const surface = this.drawingSurface; return surface && typeof surface.containsPoint === 'function' ? surface.containsPoint(...args) : this.host?.containsPoint?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawLine(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawLine === 'function' ? surface.drawLine(...args) : this.host?.drawLine?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    drawTextLines(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args); }
    getAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.getAsset === 'function' ? surface.getAsset(...args) : this.host?.getAsset?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    roundRectPath(...args) { const surface = this.drawingSurface; return surface && typeof surface.roundRectPath === 'function' ? surface.roundRectPath(...args) : this.host?.roundRectPath?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    wrapTextLimit(...args) { const surface = this.drawingSurface; return surface && typeof surface.wrapTextLimit === 'function' ? surface.wrapTextLimit(...args) : this.host?.wrapTextLimit?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
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
