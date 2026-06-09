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
