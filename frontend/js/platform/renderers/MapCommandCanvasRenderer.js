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

  class MapCommandCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
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

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAsset === 'function' ? surface.drawAsset(...args) : this.host?.drawAsset?.(...args); }
    drawAssetClipped(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAssetClipped === 'function' ? surface.drawAssetClipped(...args) : this.host?.drawAssetClipped?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    getDockMetrics() {
      return UiThemeTokens?.getDockMetrics?.(this.width, this.height)
        || { height: 64, top: this.height - 64, badgeDiameter: 76, badgeOvershoot: 27, badgeIconSize: 32, stripHeight: 53, stripGap: 8, stripCellIconSize: 26 };
    }

    getMapHomeFloatingButtonLayout(slot = 0) {
      const layout = this.getLayout();
      const metrics = UiThemeTokens?.getFloatButtonMetrics?.(this.width)
        || { size: 44, gap: 10, rightInset: 8, iconSize: 20, ringWidth: 1.5 };
      const size = metrics.size;
      const dockMetrics = this.getDockMetrics();
      // Stack sits above the tasks badge overshoot so the bottom button never
      // collides with the badge poking out of the dock bar.
      const stackBottom = dockMetrics.top - dockMetrics.badgeOvershoot - 12;
      const x = layout.contentRight - size - metrics.rightInset;
      const y = Math.max(82, stackBottom - (slot + 1) * size - slot * metrics.gap);
      return { x, y, size, iconSize: metrics.iconSize, ringWidth: metrics.ringWidth };
    }
    getTopBarBottom(...args) { const surface = this.drawingSurface; return surface && typeof surface.getTopBarBottom === 'function' ? surface.getTopBarBottom(...args) : this.host?.getTopBarBottom?.(...args); }
    renderMainPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.renderMainPanel === 'function' ? surface.renderMainPanel(...args) : this.host?.renderMainPanel?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    resolveCapitalSiteId(state = {}) {
      const cityState = state.cityState || {};
      const cities = Array.isArray(cityState.cities) ? cityState.cities : [];
      const capital = cities.find((city) => city?.id && (
        city.id === cityState.capitalCityId
        || city.isCapital
        || city.kind === 'capital'
        || city.type === 'capital'
      ));
      return cityState.capitalCityId || state.capitalCityId || capital?.id || 'capital';
    }

    // UI-REDO dock item set (layout-reference-v2): two round edge badges
    // (capital / tasks) + four square center buttons. The former 'more'
    // (openGuidebook) dock item was removed with the redesign -- no tutorial
    // rule or highlight ever targeted it (TutorialGuideFlowRegistry has zero
    // guidebook references); the openGuidebook action handler stays intact.
    getDockCommandItems(state = {}) {
      return {
        capital: {
          id: 'capital',
          label: this.t('world.map.command.capital'),
          icon: 'assets/art/ui-hud/hud-dock-icon-capital.png',
          action: { type: 'openWorldSite', siteId: this.resolveCapitalSiteId(state) },
        },
        tasks: {
          id: 'tasks',
          label: this.t('world.map.command.tasks'),
          icon: 'assets/art/ui-hud/hud-dock-icon-tasks.png',
          action: { type: 'openTaskCenter', tab: 'main', source: 'taskIcon' },
        },
        center: [
          { id: 'tech', label: this.t('world.map.command.tech'), icon: 'assets/art/ui-hud/hud-dock-icon-tech.png', action: { type: 'openCommandPanel', panel: 'tech' } },
          { id: 'civilization', label: this.t('world.map.command.civilization'), icon: 'assets/art/ui-hud/hud-dock-icon-civilization.png', action: { type: 'openCommandPanel', panel: 'civilization' } },
          { id: 'famousPersons', label: this.t('world.map.command.famousPersons'), icon: 'assets/art/ui-hud/hud-dock-icon-famous.png', action: { type: 'openFamousPersons' } },
          { id: 'settings', label: this.t('world.map.command.settings'), icon: 'assets/art/ui-hud/hud-dock-icon-settings.png', action: { type: 'openSettings' } },
        ],
      };
    }

    isDockItemActive(item = {}, options = {}) {
      // Active-state decisions live on the mode-owner side (buildRendererPanelFacts →
      // panel.activeDockItemIds); this renderer only consumes the pre-decided list.
      if ((options.activeCommandPanel || '') === item.id) return true;
      return Array.isArray(options.activeDockItemIds) && options.activeDockItemIds.includes(item.id);
    }

    // UI-REDO: big round edge badge (capital / tasks). Aged bronze plate asset
    // with a token-gradient circle fallback while the asset is not loaded yet.
    // Active state is a code overlay (champagne ring highlight), not extra art.
    renderDockBadge(item = {}, rect = {}, options = {}) {
      const palette = UiThemeTokens?.palette || {};
      const dock = UiThemeTokens?.dock || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const active = this.isDockItemActive(item, options);
      const { x, y, width, height } = rect;
      const size = Math.min(width, height);
      const centerX = x + width / 2;
      const iconSize = Number(rect.iconSize) || Math.round(size * 0.42);
      const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = item.disabled ? (dock.disabledAlpha || 0.38) : previousAlpha;
      if (!this.drawAsset(dock.badgeAssetPath, x, y, size, size)) {
        this.drawPanel(x, y, size, size, {
          fill: this.createGradient(
            x, y, x, y + size,
            [
              [0, palette.badgeBronzeFace],
              [1, palette.dockCopperBottom],
            ],
            palette.badgeBronzeFace,
          ),
          stroke: palette.badgeRing,
          radius: size / 2,
          inset: UiThemeTokens?.hairline?.insetHighlight,
        });
      }
      const iconY = y + size * 0.16;
      if (!item.icon || !this.drawAsset(item.icon, centerX - iconSize / 2, iconY, iconSize, iconSize)) {
        this.drawText(String(item.label || '').slice(0, 1), centerX, iconY + iconSize / 2, {
          size: typeScale.title || 16,
          bold: true,
          color: palette.champagneGold,
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText(this.truncateText(item.label, size - 18, { size: typeScale.title || 16, bold: true }), centerX, y + size * 0.64, {
        size: typeScale.title || 16,
        bold: true,
        color: active ? palette.champagneGoldBright : palette.badgeTextGold,
        align: 'center',
      });
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      if (active && this.ctx && typeof this.ctx.arc === 'function') {
        this.ctx.save?.();
        this.ctx.beginPath();
        this.ctx.arc(centerX, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
        this.ctx.strokeStyle = palette.champagneGoldBright;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.restore?.();
      }
      this.addHitTarget({ x, y, width: size, height: size }, item.action);
    }

    // UI-REDO knife 3: the recessed strip band chrome. 9-slices the aged
    // hud-dock-button-cell plate across the band (same technique as the top
    // bar plate); falls back to a token recessed panel until the asset loads.
    drawDockStripPlate(x, y, width, height) {
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const dock = UiThemeTokens?.dock || {};
      const slice = dock.stripSlice || {};
      const assetPath = dock.cellAssetPath || '';
      const sourceWidth = Number(slice.sourceWidth) || 0;
      const sourceHeight = Number(slice.sourceHeight) || 0;
      const sourceInset = Number(slice.sourceInset) || 0;
      const destInset = Number(slice.destInset) || 0;
      let drewAsset = Boolean(assetPath)
        && sourceInset > 0
        && destInset > 0
        && sourceWidth > sourceInset * 2
        && sourceHeight > sourceInset * 2
        && width > destInset * 2
        && height > destInset * 2;
      if (drewAsset) {
        const sourceX = [0, sourceInset, sourceWidth - sourceInset, sourceWidth];
        const sourceY = [0, sourceInset, sourceHeight - sourceInset, sourceHeight];
        const destX = [x, x + destInset, x + width - destInset, x + width];
        const destY = [y, y + destInset, y + height - destInset, y + height];
        for (let row = 0; row < 3 && drewAsset; row += 1) {
          for (let col = 0; col < 3 && drewAsset; col += 1) {
            drewAsset = this.drawAssetClipped(
              assetPath,
              {
                x: sourceX[col],
                y: sourceY[row],
                width: sourceX[col + 1] - sourceX[col],
                height: sourceY[row + 1] - sourceY[row],
              },
              destX[col],
              destY[row],
              destX[col + 1] - destX[col],
              destY[row + 1] - destY[row],
            ) === true;
          }
        }
      }
      if (!drewAsset) {
        this.drawPanel(x, y, width, height, {
          fill: palette.dockTrayCell,
          stroke: hairline.dividerOnIron,
          radius: UiThemeTokens?.radius?.panel || 6,
          inset: hairline.frameShadow,
        });
      }
      return drewAsset;
    }

    // UI-REDO knife 3: one cell inside the recessed center strip. The cell has
    // no own plate -- the strip supplies the recessed face -- so a cell draws
    // only icon (top) + label (bottom) and its active overlay.
    renderDockStripCell(item = {}, rect = {}, options = {}) {
      const palette = UiThemeTokens?.palette || {};
      const dock = UiThemeTokens?.dock || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const active = this.isDockItemActive(item, options);
      const { x, y, width, height } = rect;
      const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = item.disabled ? (dock.disabledAlpha || 0.38) : previousAlpha;
      const labelSize = typeScale.label || 10;
      const labelBaseY = y + height - labelSize - 5;
      const iconSize = Number(rect.iconSize) || Math.round(height * 0.5);
      const iconY = y + Math.max(4, Math.floor((labelBaseY - y - iconSize) / 2));
      if (!item.icon || !this.drawAsset(item.icon, x + width / 2 - iconSize / 2, iconY, iconSize, iconSize)) {
        this.drawText(String(item.label || '').slice(0, 1), x + width / 2, iconY + iconSize / 2, {
          size: typeScale.body || 12,
          bold: true,
          color: palette.dockIconGold,
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText(this.truncateText(item.label, width - 8, { size: labelSize, bold: active }), x + width / 2, labelBaseY, {
        size: labelSize,
        bold: active,
        color: active ? palette.champagneGoldBright : palette.dockLabelGold,
        align: 'center',
      });
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      if (active) {
        this.drawPanel(x + 1, y + 1, width - 2, height - 2, {
          fill: 'rgba(0, 0, 0, 0)',
          stroke: palette.champagneGoldBright,
          radius: UiThemeTokens?.radius?.panel || 6,
        });
      }
      this.addHitTarget({ x, y, width, height }, item.action);
    }

    // UI-REDO bottom dock (layout-reference-v2, knife-3 geometry): full-width
    // copper bar sized off the canvas width (UiThemeTokens.getDockMetrics),
    // two round edge badges overshooting the bar top by ~35% of their
    // diameter, and one RECESSED STRIP between them holding the four command
    // cells (equal split, hairline separators, icon over label).
    renderMapCommandDock(state = {}, options = {}) {
      const layout = this.getLayout();
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const metrics = this.getDockMetrics();
      const width = this.width;
      const dockHeight = metrics.height;
      const y = this.height - dockHeight;
      if (this.ctx) {
        this.ctx.fillStyle = this.createGradient(
          0, y, 0, y + dockHeight,
          [
            [0, palette.dockCopperTop],
            [1, palette.dockCopperBottom],
          ],
          palette.dockCopperTop,
        );
        this.ctx.fillRect(0, y, width, dockHeight);
        this.ctx.fillStyle = hairline.dividerOnIron;
        this.ctx.fillRect(0, y, width, hairline.widthPx || 1);
        this.ctx.fillStyle = hairline.insetHighlight;
        this.ctx.fillRect(0, y + 1, width, hairline.widthPx || 1);
      }
      const contentX = layout.contentX;
      const contentWidth = layout.contentWidth;
      const dockItems = this.getDockCommandItems(state);
      const badgeSize = metrics.badgeDiameter;
      const badgeY = y - metrics.badgeOvershoot;
      // Recessed strip: spans between the two badges minus a small gap, its
      // top inset keeps the reference's slightly bottom-heavy placement.
      const stripGap = metrics.stripGap;
      const stripX = contentX + badgeSize + stripGap;
      const stripWidth = Math.max(60, contentWidth - 2 * (badgeSize + stripGap));
      const stripHeight = metrics.stripHeight;
      const stripY = y + Math.max(3, Math.floor((dockHeight - stripHeight) * 0.72));
      this.drawDockStripPlate(stripX, stripY, stripWidth, stripHeight);
      const centerCount = dockItems.center.length;
      const cellWidth = centerCount > 0 ? stripWidth / centerCount : stripWidth;
      dockItems.center.forEach((item, index) => {
        const cellX = stripX + index * cellWidth;
        if (index > 0 && this.ctx) {
          this.ctx.fillStyle = hairline.dividerOnIron;
          this.ctx.fillRect(Math.round(cellX), stripY + 4, hairline.widthPx || 1, stripHeight - 8);
        }
        this.renderDockStripCell(item, {
          x: Math.round(cellX),
          y: stripY,
          width: Math.round(cellWidth),
          height: stripHeight,
          iconSize: metrics.stripCellIconSize,
        }, options);
      });
      this.renderDockBadge(dockItems.capital, { x: contentX, y: badgeY, width: badgeSize, height: badgeSize, iconSize: metrics.badgeIconSize }, options);
      this.renderDockBadge(dockItems.tasks, { x: contentX + contentWidth - badgeSize, y: badgeY, width: badgeSize, height: badgeSize, iconSize: metrics.badgeIconSize }, options);
    }

    // UI-REDO knife 3 (layout-reference-v2 right edge): dark iron disc + thin
    // muted worn ring + gold line icon + small gold caption inside the disc.
    // All colors come from UiThemeTokens; active = brightened ring + label.
    renderFloatingMapButton(slot = 0, config = {}) {
      const { x, y, size, iconSize, ringWidth } = this.getMapHomeFloatingButtonLayout(slot);
      const palette = UiThemeTokens?.palette || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const active = Boolean(config.active);
      this.drawPanel(x, y, size, size, {
        fill: this.createGradient(
          x, y, x, y + size,
          [
            [0, palette.roundButtonFace],
            [1, palette.plateIronBottom],
          ],
          palette.roundButtonFace,
        ),
        stroke: 'rgba(0, 0, 0, 0.5)',
        radius: size / 2,
        inset: UiThemeTokens?.hairline?.insetHighlight,
      });
      // Thin ring just inside the disc edge (muted worn copper; champagne when active).
      if (this.ctx && typeof this.ctx.arc === 'function') {
        this.ctx.save?.();
        this.ctx.beginPath();
        this.ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
        this.ctx.strokeStyle = active ? palette.champagneGoldBright : palette.roundButtonRing;
        this.ctx.lineWidth = Number(ringWidth) || 1.5;
        this.ctx.globalAlpha = active ? 0.9 : 0.55;
        this.ctx.stroke();
        this.ctx.restore?.();
        if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = 1;
      }
      const icon = Number(iconSize) || Math.round(size * 0.46);
      const iconY = y + Math.round(size * 0.14);
      if (!config.icon || !this.drawAsset(config.icon, x + size / 2 - icon / 2, iconY, icon, icon)) {
        this.drawText(String(config.label || '').slice(0, 1), x + size / 2, iconY + icon / 2, {
          size: typeScale.value || 14,
          bold: true,
          color: active ? palette.champagneGoldBright : palette.champagneGold,
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText(this.truncateText(config.label, size - 10, { size: typeScale.label || 10, bold: true }), x + size / 2, y + size - Math.round(size * 0.32), {
        size: typeScale.label || 10,
        bold: true,
        color: active ? palette.champagneGoldBright : palette.badgeTextGold,
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, config.action);
    }

    renderFloatingSubcityButton(_state = {}, options = {}) {
      this.renderFloatingMapButton(2, {
        label: this.t('world.map.command.subcity'),
        icon: 'assets/art/ui-hud/hud-float-icon-subcity.png',
        active: Boolean(options.showSubcityList),
        action: { type: 'openSubcityList' },
      });
    }

    renderFloatingEventButton(_state = {}, options = {}) {
      this.renderFloatingMapButton(1, {
        label: this.t('world.map.command.events'),
        icon: 'assets/art/ui-hud/hud-float-icon-event.png',
        active: options.activeCommandPanel === 'events',
        action: { type: 'openCommandPanel', panel: 'events' },
      });
    }

    renderFloatingAccountButton(_state = {}, options = {}) {
      this.renderFloatingMapButton(0, {
        label: this.t('world.map.command.account'),
        icon: 'assets/art/ui-hud/hud-float-icon-account.png',
        active: Array.isArray(options.activeDockItemIds) && options.activeDockItemIds.includes('account'),
        action: { type: 'requestResetGame', source: 'debugResetAccount' },
      });
    }

    renderMapCommandPanel(state = {}, options = {}) {
      const panel = options.activeCommandPanel || '';
      if (!panel) return;
      const renderablePanels = new Set(['buildings', 'military', 'tech', 'civilization', 'events']);
      if (!renderablePanels.has(panel)) return;
      const layout = this.getLayout();
      const dockTop = this.getDockMetrics().top;
      const top = Math.max(82, this.getTopBarBottom(state, { isMapHome: true }) + 8);
      const height = Math.max(220, dockTop - top - 12);
      const panelHeight = Math.min(height, 470);
      const y = dockTop - panelHeight - 10;
      const x = layout.contentX;
      const width = layout.contentWidth;
      const titleByPanel = {
        buildings: this.t('world.map.panel.buildings'),
        military: this.t('world.map.panel.military'),
        tech: this.t('world.map.panel.tech'),
        civilization: this.t('world.map.panel.civilization'),
        events: this.t('world.map.panel.events'),
      };
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCommandPanel', background: true });
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(50, 39, 27, 0.96)'],
            [1, 'rgba(19, 17, 13, 0.97)'],
          ],
          'rgba(34, 27, 20, 0.96)',
        ),
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      const closeX = x + width - closeSize - 10;
      const closeY = y + 10;
      this.drawText(titleByPanel[panel] || this.t('world.map.panel.fallback'), x + 16, y + 16, { size: 17, bold: true, color: '#ffe6b5' });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeCommandPanel' });

      const contentTop = y + 50;
      const contentHeight = Math.max(120, panelHeight - 62);
      const panelTab = panel === 'military' ? 'military' : panel;
      const renderState = panelTab === 'military'
        ? { ...state, militaryView: state.militaryView === 'world' ? 'army' : (state.militaryView || 'army') }
        : state;
      this.renderMainPanel(renderState, panelTab, contentTop, contentHeight, {
        ...options,
        activeBuildingCategory: options.activeBuildingCategory,
        buildingOffset: options.buildingOffset,
        buildingTransition: options.buildingTransition,
      });
    }
  }

  global.MapCommandCanvasRenderer = MapCommandCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapCommandCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
