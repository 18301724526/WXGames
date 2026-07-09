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

  const TechTreeLayoutModel = global.TechTreeLayoutModel || (typeof require !== 'undefined' ? require('./TechTreeLayoutModel') : null);
  const TechTreeCanvasRenderer = global.TechTreeCanvasRenderer || (typeof require !== 'undefined' ? require('./TechTreeCanvasRenderer') : null);
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
  const ModalPlate = (() => {
    if (global.ModalPlateRenderer) return global.ModalPlateRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./ModalPlateRenderer');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class TechCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
      this.techRenderState = options.techRenderState || this.host?.techRenderState || { lastTechTreeScroll: null };
    }

    get width() {
      return Number(this.host?.width) || 0;
    }

    get height() {
      return Number(this.host?.height) || 0;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get presenter() {
      return this.host?.presenter;
    }

    t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    get lastTechTreeScroll() {
      return this.techRenderState?.lastTechTreeScroll || null;
    }

    set lastTechTreeScroll(value) {
      if (this.techRenderState) this.techRenderState.lastTechTreeScroll = value || null;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAsset === 'function' ? surface.drawAsset(...args) : this.host?.drawAsset?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawCircle(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawCircle === 'function' ? surface.drawCircle(...args) : this.host?.drawCircle?.(...args); }
    drawCurvePath(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawCurvePath === 'function' ? surface.drawCurvePath(...args) : this.host?.drawCurvePath?.(...args); }
    drawLine(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawLine === 'function' ? surface.drawLine(...args) : this.host?.drawLine?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawPrimaryActionButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPrimaryActionButton === 'function' ? surface.drawPrimaryActionButton(...args) : this.host?.drawPrimaryActionButton?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    drawTextLines(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    renderSectionHeader(...args) { const surface = this.drawingSurface; return surface && typeof surface.renderSectionHeader === 'function' ? surface.renderSectionHeader(...args) : this.host?.renderSectionHeader?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    wrapTextLimit(...args) { const surface = this.drawingSurface; return surface && typeof surface.wrapTextLimit === 'function' ? surface.wrapTextLimit(...args) : this.host?.wrapTextLimit?.(...args); }
    withTransformedClip(...args) { const surface = this.drawingSurface; return surface && typeof surface.withTransformedClip === 'function' ? surface.withTransformedClip(...args) : this.host?.withTransformedClip?.(...args); }
    withTranslatedClip(...args) { const surface = this.drawingSurface; return surface && typeof surface.withTranslatedClip === 'function' ? surface.withTranslatedClip(...args) : this.host?.withTranslatedClip?.(...args); }

    render(state = {}, startY = 210, panelHeight = 250, options = {}) {
      return this.renderTechInternal(state, startY, panelHeight, options);
    }

    getTechRouteCatalog() {
      return TechTreeLayoutModel.getTechRouteCatalog();
    }

    getTechRouteMeta(route) {
      return TechTreeLayoutModel.getTechRouteMeta(route);
    }

    getTechNodeRoutes(node = {}) {
      return TechTreeLayoutModel.getTechNodeRoutes(node);
    }

    getTechNodeRouteLabel(node = {}) {
      return TechTreeLayoutModel.getTechNodeRouteLabel(node);
    }

    getTechNodePrimaryRoute(node = {}) {
      return TechTreeLayoutModel.getTechNodePrimaryRoute(node);
    }

    getTechNodeLane(node = {}) {
      return TechTreeLayoutModel.getTechNodeLane(node);
    }

    drawTechRouteSegments(x, y, width, height, routes = [], alpha = 1) {
      if (!this.ctx || typeof this.ctx.fillRect !== 'function') return;
      const activeRoutes = routes.length ? routes : [''];
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      const segmentWidth = width / activeRoutes.length;
      activeRoutes.forEach((route, index) => {
        this.ctx.fillStyle = this.getTechRouteMeta(route).color;
        this.ctx.fillRect(x + segmentWidth * index, y, segmentWidth + 0.5, height);
      });
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
    }

    getTechNodeColor(node = {}) {
      return TechTreeLayoutModel.getTechNodeColor(node);
    }

    renderTechNode(node, rect, options = {}) {
      const palette = this.getTechNodeColor(node);
      const routes = this.getTechNodeRoutes(node);
      const selected = Boolean(options.selected);
      const primaryRoute = this.getTechNodePrimaryRoute(node);
      const routeMeta = this.getTechRouteMeta(primaryRoute);
      const cx = Number(rect.centerX) || rect.x + rect.width / 2;
      const cy = Number(rect.centerY) || rect.y + 30;
      const iconSize = Math.min(50, Math.max(40, rect.width * 0.58));
      const iconRadius = iconSize / 2;
      const alpha = node.disabled && !node.researched ? 0.52 : 1;
      if (selected) {
        this.drawCircle(cx, cy, iconRadius + 10, {
          fill: `${routeMeta.color}22`,
          stroke: '#ffe6b5',
          width: 2,
        });
      }
      this.drawCircle(cx, cy, iconRadius + 5, {
        fill: node.researched ? 'rgba(34, 82, 58, 0.68)' : 'rgba(18, 16, 13, 0.7)',
        stroke: node.researched ? '#74d3a0' : (node.disabled ? 'rgba(174, 176, 184, 0.38)' : routeMeta.color),
        width: node.researched || selected ? 2 : 1.5,
      });
      if (!this.drawAsset(routeMeta.icon, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize, alpha)) {
        this.drawText(this.truncateText(this.getTechNodeRouteLabel(node), iconSize - 10, { size: 13, bold: true }).slice(0, 2), cx, cy, {
          size: 13,
          bold: true,
          align: 'center',
          baseline: 'middle',
          color: palette.accent,
        });
      }
      if (routes.length > 1) {
        this.drawTechRouteSegments(cx - 23, cy + iconRadius + 8, 46, 4, routes, node.disabled && !node.researched ? 0.46 : 0.92);
      }
      this.drawCircle(cx + iconRadius + 2, cy + iconRadius + 1, 5, {
        fill: node.researched ? '#74d3a0' : (!node.disabled ? '#f0b45b' : '#7d8590'),
        stroke: 'rgba(18, 16, 13, 0.86)',
        width: 1.5,
      });
      const titleWidth = Math.max(54, rect.width + 16);
      this.drawText(this.truncateText(node.title || node.name || this.t('tech.generic', {}), titleWidth, { size: 10, bold: true }), cx, rect.y + rect.height - 13, {
        size: 11,
        bold: true,
        align: 'center',
        color: palette.text,
      });
      return;
    }

    renderTechDetailPanel(detail = {}, x, y, width, height) {
      const selected = detail && !detail.empty;
      const compact = width < 360;
      const iconSize = compact ? 32 : 36;
      const actionWidth = Math.min(90, Math.max(70, width * 0.22));
      const buttonX = x + width - actionWidth - 12;
      const buttonY = y + 14;
      const buttonH = 30;
      ModalPlate.drawModalCard(this, x, y, width, height, { tone: selected ? 'accent' : 'default' });
      const topY = y + 12;
      this.drawAsset('assets/art/icon-science-cutout.webp', x + 12, topY + 2, iconSize, iconSize, selected ? 0.95 : 0.58);
      const textX = x + 12 + iconSize + 10;
      const contentRight = buttonX - 10;
      const contentWidth = Math.max(116, contentRight - textX);
      const titleWidth = Math.max(80, contentWidth);
      this.drawText(this.truncateText(detail.title || this.t('tech.detail.emptyTitle', {}), titleWidth, { size: 15, bold: true }), textX, y + 14, {
        size: 15,
        bold: true,
        color: '#ffe6b5',
      });
      const meta = selected
        ? [detail.eraName, detail.routeLabel, detail.statusLabel].filter(Boolean).join(' · ')
        : (detail.statusLabel || this.t('tech.status.unselected', {}));
      this.drawText(this.truncateText(meta, contentWidth, { size: 10, bold: true }), textX, y + 36, {
        size: 10,
        bold: true,
        color: detail.canResearch ? '#74d3a0' : '#f0b45b',
      });
      const summaryWidth = Math.max(120, width - 24);
      const summaryLines = this.wrapTextLimit(detail.summary || this.t('tech.detail.emptySummary', {}), summaryWidth, 1, { size: 10 });
      this.drawTextLines(summaryLines, textX, y + 54, {
        size: 10,
        color: '#cbbd96',
        lineHeight: 13,
      });
      if (selected) {
        const infoX = x + 12;
        const infoTop = y + 78;
        const infoWidth = width - 24;
        const rows = Array.isArray(detail.effectRows) && detail.effectRows.length
          ? detail.effectRows
          : [{ label: this.t('tech.row.afterResearch', {}), text: detail.unlockSummary || this.t('tech.detail.directionFallback', {}) }];
        rows.slice(0, 2).forEach((row, index) => {
          const rowY = infoTop + index * 16;
          this.drawText(`${row.label}${this.t('common.labelSeparator', {})}`, infoX, rowY, {
            size: 10,
            bold: true,
            color: index === 0 ? '#d5ffe8' : '#f0b45b',
          });
          this.drawText(this.truncateText(row.text || this.t('common.none', {}), infoWidth - 58, { size: 10 }), infoX + 58, rowY, {
            size: 10,
            color: '#cbbd96',
          });
        });
        const prerequisiteY = y + height - 18;
        const prerequisiteText = this.t(
          'tech.detail.prerequisite',
          { text: detail.prerequisiteText || this.t('tech.noPrerequisite', {}) });
        this.drawText(this.truncateText(prerequisiteText, width - actionWidth - 42, { size: 10 }), infoX, prerequisiteY, { size: 10, color: '#aeb0b8' });
        this.drawText(this.truncateText(detail.pointsText || '', actionWidth + 8, { size: 10, bold: true }), buttonX + actionWidth / 2, prerequisiteY, {
          size: 10,
          bold: true,
          color: '#f0b45b',
          align: 'center',
        });
      }
      ModalPlate.drawModalButton(this, buttonX, buttonY, actionWidth, buttonH, detail.buttonLabel || this.t('tech.action.research', {}), {
        variant: 'primary',
        disabled: !detail.canResearch,
        size: 11,
        radius: 9,
      });
      this.addHitTarget({ x: buttonX, y: buttonY, width: actionWidth, height: buttonH }, {
        type: 'research',
        techId: detail.id,
        visualDisabled: !detail.canResearch || !detail.id,
      });
      if (!detail.canResearch && detail.disabledReason) {
        this.drawText(this.truncateText(detail.disabledReason, actionWidth + 18, { size: 9 }), buttonX + actionWidth / 2, buttonY + buttonH + 12, {
          size: 9,
          color: '#aeb0b8',
          align: 'center',
        });
      }
    }

    getTechDetailIcon(detail = {}) {
      const routes = Array.isArray(detail.routes) && detail.routes.length
        ? detail.routes
        : (detail.routeId ? [detail.routeId] : []);
      return this.getTechRouteMeta(detail.routeId || routes[0] || '').icon;
    }

    renderTechDetailModal(detail = {}) {
      if (!detail || detail.empty) return;
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeTechDetail' });
      ModalPlate.drawModalMask(this);
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 24, 360);
      const panelHeight = Math.min(430, this.height - 160);
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(86, (this.height - panelHeight) / 2 - 8);
      ModalPlate.drawModalPlate(this, x, y, panelWidth, panelHeight);
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });
      const titleBar = ModalPlate.drawModalTitleBar(this, x, y, panelWidth, {
        title: detail.title || this.t('tech.generic', {}),
        subtitle: [detail.eraName, detail.routeLabel, detail.statusLabel].filter(Boolean).join(' · '),
        withClose: true,
      });
      if (titleBar.closeRect) this.addHitTarget(titleBar.closeRect, { type: 'closeTechDetail' });

      const iconSize = 58;
      const iconPath = this.getTechDetailIcon(detail);
      const contentTop = titleBar.contentTop + 12;
      this.drawCircle(x + 45, contentTop + 28, 34, {
        fill: 'rgba(18, 16, 13, 0.64)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        width: 1.5,
      });
      this.drawAsset(iconPath, x + 16, contentTop - 1, iconSize, iconSize, 0.98);
      this.drawText(this.truncateText(detail.pointsText || '', panelWidth - 112, { size: 11, bold: true }), x + 84, contentTop + 24, {
        size: 11,
        bold: true,
        color: detail.canResearch ? '#74d3a0' : '#f0b45b',
      });

      let cursorY = contentTop + 72;
      const summaryLines = this.wrapTextLimit(detail.summary || this.t('tech.detail.defaultSummary', {}), panelWidth - 32, 3, { size: 12 });
      this.drawTextLines(summaryLines, x + 16, cursorY, {
        size: 12,
        color: '#f6e8c8',
        lineHeight: 17,
      });
      cursorY += summaryLines.length * 17 + 14;

      const rows = Array.isArray(detail.effectRows) && detail.effectRows.length
        ? detail.effectRows
        : [{ label: this.t('tech.row.afterResearch', {}), text: detail.unlockSummary || this.t('tech.detail.directionFallback', {}) }];
      rows.slice(0, 4).forEach((row) => {
        const label = `${row.label}${this.t('common.labelSeparator', {})}`;
        this.drawText(label, x + 16, cursorY, { size: 11, bold: true, color: '#f0b45b' });
        this.ctx.font = '700 11px sans-serif';
        const labelWidth = Math.max(58, this.ctx.measureText(label).width + 2);
        const rowLines = this.wrapTextLimit(row.text || this.t('common.none', {}), panelWidth - 32 - labelWidth, 2, { size: 11 });
        this.drawTextLines(rowLines, x + 16 + labelWidth, cursorY, {
          size: 11,
          color: '#cbbd96',
          lineHeight: 15,
        });
        cursorY += Math.max(18, rowLines.length * 15 + 4);
      });

      const prereqText = this.t(
        'tech.detail.prerequisite',
        { text: detail.prerequisiteText || this.t('tech.noPrerequisite', {}) });
      this.drawText(this.truncateText(prereqText, panelWidth - 32, { size: 11 }), x + 16, cursorY + 4, {
        size: 11,
        color: '#aeb0b8',
      });
      cursorY += 30;

      if (!detail.canResearch && detail.disabledReason) {
        this.drawText(this.truncateText(detail.disabledReason, panelWidth - 32, { size: 11 }), x + 16, cursorY, {
          size: 11,
          color: '#d6b16e',
        });
      }
      const buttonW = Math.min(128, panelWidth - 32);
      const buttonH = 36;
      const buttonX = x + panelWidth - buttonW - 16;
      const buttonY = y + panelHeight - buttonH - 16;
      this.drawText(this.truncateText(detail.pointsText || '', panelWidth - buttonW - 44, { size: 11, bold: true }), x + 16, buttonY + 11, {
        size: 11,
        bold: true,
        color: '#f0b45b',
      });
      ModalPlate.drawModalButton(this, buttonX, buttonY, buttonW, buttonH, detail.buttonLabel || this.t('tech.action.research', {}), {
        variant: 'primary',
        disabled: !detail.canResearch,
        size: 13,
        radius: 8,
      });
      this.addHitTarget({ x: buttonX, y: buttonY, width: buttonW, height: buttonH }, {
        type: 'research',
        techId: detail.id,
        visualDisabled: !detail.canResearch || !detail.id,
      });
    }

    getTechTreeLayout(view = {}, panel = {}, options = {}) {
      return TechTreeLayoutModel.getTechTreeLayout(view, panel, options);
    }

    renderTechInternal(state = {}, startY = 210, panelHeight = 250, options = {}) {
      if (!this.presenter || typeof this.presenter.buildTechViewState !== 'function') return;
      const view = this.presenter.buildTechViewState({
        ...state,
        techUiState: {
          ...(state.techUiState || {}),
          ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
        },
        ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
      });
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      ModalPlate.drawModalCard(this, x, startY, width, panelHeight);
      const palette = UiThemeTokens?.palette || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const headerHeight = 58;
      this.drawAsset('assets/art/icon-science-cutout.webp', x + 16, startY + 14, 30, 30, 0.95);
      this.drawText(this.truncateText(view.text.title, width - 150, { size: 16, bold: true }), x + 52, startY + 15, {
        size: typeScale.title || 16,
        bold: true,
        color: palette.champagneGoldBright || '#ffe6b5',
        fontFamily: UiThemeTokens?.fontFamily?.display,
      });
      this.drawText(this.truncateText(view.text.subtitle, width - 32, { size: 10 }), x + 52, startY + 38, {
        size: 10,
        color: palette.textLabel || 'rgba(234, 234, 234, 0.62)',
      });
      const pillY = startY + 14;
      const pillWidth = 68;
      [
        view.text.points,
        view.text.researched,
        view.text.available,
      ].forEach((label, index) => {
        const pillX = x + width - 12 - pillWidth * (3 - index) - 6 * (2 - index);
        ModalPlate.drawModalCard(this, pillX, pillY, pillWidth, 24, { tone: index === 0 ? 'accent' : 'default', radius: 8 });
        this.drawText(this.truncateText(label, pillWidth - 14, { size: 10, bold: index === 0 }), pillX + pillWidth / 2, pillY + 7, {
          size: 10,
          bold: index === 0,
          color: index === 0 ? '#f0b45b' : '#cbbd96',
          align: 'center',
        });
      });

      const panelY = startY + headerHeight;
      const panelBottom = startY + panelHeight - 14;
      const panelH = Math.max(116, panelBottom - panelY);
      ModalPlate.drawModalCard(this, x + 12, panelY, width - 24, panelH, { tone: 'muted' });

      const tree = view.tree || {};
      const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
      const treeTop = panelY + 14;
      const treeBottom = startY + panelHeight - 26;
      const treeHeight = Math.max(128, treeBottom - treeTop);
      const treeX = x + 24;
      const treeWidth = width - 48;
      const treePanel = {
        x: treeX,
        y: treeTop,
        width: treeWidth,
        height: treeHeight,
      };
      const { renderedCards = 0 } = TechTreeCanvasRenderer.renderTechTreePanel(this, view, treePanel, options);

      if (!renderedCards) {
        TechTreeCanvasRenderer.renderEmptyTechTree(this, view, { x, width, panelY, panelH });
      }
    }

  }

  if (typeof module !== 'undefined' && module.exports) module.exports = TechCanvasRenderer;
  else global.TechCanvasRenderer = TechCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
