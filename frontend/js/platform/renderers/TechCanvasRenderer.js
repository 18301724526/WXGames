(function (global) {
  const TechTreeLayoutModel = global.TechTreeLayoutModel || (typeof require !== 'undefined' ? require('./TechTreeLayoutModel') : null);
  const TechTreeCanvasRenderer = global.TechTreeCanvasRenderer || (typeof require !== 'undefined' ? require('./TechTreeCanvasRenderer') : null);

  class TechCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
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
          if (prop === 'lastTechTreeScroll' && target.host) {
            target.host.lastTechTreeScroll = value;
            return true;
          }
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

    createGradient(...args) {
      return this.callDrawingSurface('createGradient', args);
    }

    drawAsset(...args) {
      return this.callDrawingSurface('drawAsset', args);
    }

    drawButton(...args) {
      return this.callDrawingSurface('drawButton', args);
    }

    drawCircle(...args) {
      return this.callDrawingSurface('drawCircle', args);
    }

    drawPanel(...args) {
      return this.callDrawingSurface('drawPanel', args);
    }

    drawPrimaryActionButton(...args) {
      return this.callDrawingSurface('drawPrimaryActionButton', args);
    }

    drawText(...args) {
      return this.callDrawingSurface('drawText', args);
    }

    drawTextLines(...args) {
      return this.callDrawingSurface('drawTextLines', args);
    }

    getLayout(...args) {
      return this.callDrawingSurface('getLayout', args);
    }

    renderSectionHeader(...args) {
      return this.callDrawingSurface('renderSectionHeader', args);
    }

    truncateText(...args) {
      return this.callDrawingSurface('truncateText', args);
    }

    wrapTextLimit(...args) {
      return this.callDrawingSurface('wrapTextLimit', args);
    }

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
      this.drawText(this.truncateText(node.title || node.name || '科技', titleWidth, { size: 10, bold: true }), cx, rect.y + rect.height - 13, {
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
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(45, 34, 24, 0.82)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      const topY = y + 12;
      this.drawAsset('assets/art/icon-science-cutout.webp', x + 12, topY + 2, iconSize, iconSize, selected ? 0.95 : 0.58);
      const textX = x + 12 + iconSize + 10;
      const contentRight = buttonX - 10;
      const contentWidth = Math.max(116, contentRight - textX);
      const titleWidth = Math.max(80, contentWidth);
      this.drawText(this.truncateText(detail.title || '选择一个科技', titleWidth, { size: 15, bold: true }), textX, y + 14, {
        size: 15,
        bold: true,
        color: '#ffe6b5',
      });
      const meta = selected
        ? [detail.eraName, detail.routeLabel, detail.statusLabel].filter(Boolean).join(' · ')
        : (detail.statusLabel || '未选择');
      this.drawText(this.truncateText(meta, contentWidth, { size: 10, bold: true }), textX, y + 36, {
        size: 10,
        bold: true,
        color: detail.canResearch ? '#74d3a0' : '#f0b45b',
      });
      const summaryWidth = Math.max(120, width - 24);
      const summaryLines = this.wrapTextLimit(detail.summary || '点击科技节点查看效果。', summaryWidth, 1, { size: 10 });
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
          : [{ label: '研究后', text: detail.unlockSummary || '选择一条文明发展方向。' }];
        rows.slice(0, 2).forEach((row, index) => {
          const rowY = infoTop + index * 16;
          this.drawText(`${row.label}：`, infoX, rowY, {
            size: 10,
            bold: true,
            color: index === 0 ? '#d5ffe8' : '#f0b45b',
          });
          this.drawText(this.truncateText(row.text || '无', infoWidth - 58, { size: 10 }), infoX + 58, rowY, {
            size: 10,
            color: '#cbbd96',
          });
        });
        const prerequisiteY = y + height - 18;
        const prerequisiteText = `前置科技：${detail.prerequisiteText || '无'}`;
        this.drawText(this.truncateText(prerequisiteText, width - actionWidth - 42, { size: 10 }), infoX, prerequisiteY, { size: 10, color: '#aeb0b8' });
        this.drawText(this.truncateText(detail.pointsText || '', actionWidth + 8, { size: 10, bold: true }), buttonX + actionWidth / 2, prerequisiteY, {
          size: 10,
          bold: true,
          color: '#f0b45b',
          align: 'center',
        });
      }
      this.drawPrimaryActionButton(buttonX, buttonY, actionWidth, buttonH, detail.buttonLabel || '研究', {
        disabled: !detail.canResearch,
        size: 11,
        radius: 9,
      });
      this.addHitTarget({ x: buttonX, y: buttonY, width: actionWidth, height: buttonH }, {
        type: 'research',
        techId: detail.id,
        disabled: !detail.canResearch || !detail.id,
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
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 24, 360);
      const panelHeight = Math.min(430, this.height - 160);
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(86, (this.height - panelHeight) / 2 - 8);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeTechDetail' });

      const iconSize = 58;
      const iconPath = this.getTechDetailIcon(detail);
      this.drawCircle(x + 45, y + 48, 34, {
        fill: 'rgba(18, 16, 13, 0.64)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        width: 1.5,
      });
      this.drawAsset(iconPath, x + 16, y + 19, iconSize, iconSize, 0.98);
      this.drawText(this.truncateText(detail.title || '科技', panelWidth - 118, { size: 17, bold: true }), x + 84, y + 22, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      const meta = [detail.eraName, detail.routeLabel, detail.statusLabel].filter(Boolean).join(' · ');
      this.drawText(this.truncateText(meta, panelWidth - 118, { size: 11, bold: true }), x + 84, y + 52, {
        size: 11,
        bold: true,
        color: detail.canResearch ? '#74d3a0' : '#f0b45b',
      });

      let cursorY = y + 92;
      const summaryLines = this.wrapTextLimit(detail.summary || '选择科技查看效果。', panelWidth - 32, 3, { size: 12 });
      this.drawTextLines(summaryLines, x + 16, cursorY, {
        size: 12,
        color: '#f6e8c8',
        lineHeight: 17,
      });
      cursorY += summaryLines.length * 17 + 14;

      const rows = Array.isArray(detail.effectRows) && detail.effectRows.length
        ? detail.effectRows
        : [{ label: '研究后', text: detail.unlockSummary || '选择一条文明发展方向。' }];
      rows.slice(0, 4).forEach((row) => {
        const label = `${row.label}：`;
        this.drawText(label, x + 16, cursorY, { size: 11, bold: true, color: '#f0b45b' });
        this.ctx.font = '700 11px sans-serif';
        const labelWidth = Math.max(58, this.ctx.measureText(label).width + 2);
        const rowLines = this.wrapTextLimit(row.text || '无', panelWidth - 32 - labelWidth, 2, { size: 11 });
        this.drawTextLines(rowLines, x + 16 + labelWidth, cursorY, {
          size: 11,
          color: '#cbbd96',
          lineHeight: 15,
        });
        cursorY += Math.max(18, rowLines.length * 15 + 4);
      });

      const prereqText = `前置科技：${detail.prerequisiteText || '无'}`;
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
      this.drawPrimaryActionButton(buttonX, buttonY, buttonW, buttonH, detail.buttonLabel || '研究', {
        disabled: !detail.canResearch,
        size: 13,
        radius: 8,
      });
      this.addHitTarget({ x: buttonX, y: buttonY, width: buttonW, height: buttonH }, {
        type: 'research',
        techId: detail.id,
        disabled: !detail.canResearch || !detail.id,
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
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      const headerHeight = 58;
      this.renderSectionHeader(view.text.title, x + 16, startY + 14, '🔩');
      this.drawText(this.truncateText(view.text.subtitle, width - 32, { size: 10 }), x + 16, startY + 36, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.62)',
      });
      const pillY = startY + 14;
      const pillWidth = 68;
      [
        view.text.points,
        view.text.researched,
        view.text.available,
      ].forEach((label, index) => {
        const pillX = x + width - 12 - pillWidth * (3 - index) - 6 * (2 - index);
        this.drawPanel(pillX, pillY, pillWidth, 24, {
          fill: 'rgba(63, 47, 32, 0.78)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
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
      this.drawPanel(x + 12, panelY, width - 24, panelH, {
        fill: 'rgba(28, 22, 16, 0.74)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });

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
