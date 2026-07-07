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
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    getMapHomeFloatingButtonLayout(slot = 0) {
      const layout = this.getLayout();
      const size = 48;
      const dockTop = this.height - (Number(UiThemeTokens?.dock?.height) || 64);
      const x = layout.contentRight - size - 8;
      const gap = 10;
      const y = Math.max(82, dockTop - (slot + 1) * size - 14 - slot * gap);
      return { x, y, size };
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

    // UI-REDO: big round edge badge (capital / tasks). Bronze plate asset with
    // a token-gradient circle fallback while the asset is not loaded yet.
    // Active state is a code overlay (champagne ring highlight), not extra art.
    renderDockBadge(item = {}, rect = {}, options = {}) {
      const palette = UiThemeTokens?.palette || {};
      const dock = UiThemeTokens?.dock || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const active = this.isDockItemActive(item, options);
      const { x, y, width, height } = rect;
      const size = Math.min(width, height);
      const centerX = x + width / 2;
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
      const iconSize = Number(dock.badgeIconSize) || 34;
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
      this.drawText(this.truncateText(item.label, size - 16, { size: typeScale.value || 14, bold: true }), centerX, y + size * 0.66, {
        size: typeScale.value || 14,
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

    // UI-REDO: square center dock button. Dark iron cell asset with a token
    // panel fallback; active = champagne border + brightened label overlay.
    renderDockCell(item = {}, rect = {}, options = {}) {
      const palette = UiThemeTokens?.palette || {};
      const dock = UiThemeTokens?.dock || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const active = this.isDockItemActive(item, options);
      const { x, y, width, height } = rect;
      const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = item.disabled ? (dock.disabledAlpha || 0.38) : previousAlpha;
      if (!this.drawAsset(dock.cellAssetPath, x, y, width, height)) {
        this.drawPanel(x, y, width, height, {
          fill: palette.dockTrayCell,
          stroke: palette.dockIconGold,
          radius: UiThemeTokens?.radius?.plate || 8,
          inset: UiThemeTokens?.hairline?.insetHighlight,
        });
      }
      const iconSize = Number(dock.cellIconSize) || 24;
      const iconY = y + 4;
      if (!item.icon || !this.drawAsset(item.icon, x + width / 2 - iconSize / 2, iconY, iconSize, iconSize)) {
        this.drawText(String(item.label || '').slice(0, 1), x + width / 2, iconY + iconSize / 2, {
          size: typeScale.body || 12,
          bold: true,
          color: palette.dockIconGold,
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText(this.truncateText(item.label, width - 6, { size: typeScale.caption || 9, bold: active }), x + width / 2, y + height - 12, {
        size: typeScale.caption || 9,
        bold: active,
        color: active ? palette.champagneGoldBright : palette.dockLabelGold,
        align: 'center',
      });
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      if (active) {
        this.drawPanel(x, y, width, height, {
          fill: 'rgba(0, 0, 0, 0)',
          stroke: palette.champagneGoldBright,
          radius: UiThemeTokens?.radius?.plate || 8,
        });
      }
      this.addHitTarget({ x, y, width, height }, item.action);
    }

    // UI-REDO bottom dock (layout-reference-v2): full-width copper bar, two
    // round edge badges overshooting the bar's top edge, four square buttons
    // centered between them. The 64px bar height stays a layout contract
    // (UiThemeTokens.dock.height) -- panels/floating buttons key off it.
    renderMapCommandDock(state = {}, options = {}) {
      const layout = this.getLayout();
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const dock = UiThemeTokens?.dock || {};
      const width = this.width;
      const dockHeight = Number(dock.height) || 64;
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
      const badgeSize = Number(dock.badgeDiameter) || 76;
      const badgeY = this.height - badgeSize - (Number(dock.badgeBottomInset) || 2);
      const cellSize = Number(dock.cellSize) || 46;
      const cellGap = Number(dock.cellGap) || 8;
      const cellY = y + (Number(dock.cellTopInset) || 3);
      const centerCount = dockItems.center.length;
      const centerSpan = centerCount * cellSize + Math.max(0, centerCount - 1) * cellGap;
      const centerStart = contentX + Math.floor((contentWidth - centerSpan) / 2);
      this.renderDockBadge(dockItems.capital, { x: contentX, y: badgeY, width: badgeSize, height: badgeSize }, options);
      dockItems.center.forEach((item, index) => {
        this.renderDockCell(item, {
          x: centerStart + index * (cellSize + cellGap),
          y: cellY,
          width: cellSize,
          height: cellSize,
        }, options);
      });
      this.renderDockBadge(dockItems.tasks, { x: contentX + contentWidth - badgeSize, y: badgeY, width: badgeSize, height: badgeSize }, options);
    }

    renderFloatingMapButton(slot = 0, config = {}) {
      const { x, y, size } = this.getMapHomeFloatingButtonLayout(slot);
      const active = Boolean(config.active);
      this.drawPanel(x, y, size, size, {
        fill: active ? 'rgba(82, 58, 34, 0.94)' : 'rgba(23, 23, 20, 0.82)',
        stroke: active ? 'rgba(247, 215, 116, 0.56)' : 'rgba(255, 226, 177, 0.18)',
        radius: size / 2,
        inset: active ? 'rgba(255, 231, 184, 0.16)' : 'rgba(255, 231, 184, 0.06)',
      });
      const iconSize = 22;
      if (!config.icon || !this.drawAsset(config.icon, x + size / 2 - iconSize / 2, y + 7, iconSize, iconSize)) {
        this.drawText(String(config.label || '').slice(0, 1), x + size / 2, y + 18, {
          size: 13,
          bold: true,
          color: active ? '#ffe6b5' : '#cbbd96',
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText(this.truncateText(config.label, size - 8, { size: 9, bold: true }), x + size / 2, y + size - 15, {
        size: 9,
        bold: true,
        color: active ? '#f0b45b' : '#aeb0b8',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, config.action);
    }

    renderFloatingSubcityButton(state = {}, options = {}) {
      this.renderFloatingMapButton(2, {
        label: this.t('world.map.command.subcity'),
        icon: 'assets/art/ui-hud/hud-icon-subcity.png',
        active: Boolean(options.showSubcityList),
        action: { type: 'openSubcityList' },
      });
    }

    renderFloatingEventButton(state = {}, options = {}) {
      this.renderFloatingMapButton(1, {
        label: this.t('world.map.command.events'),
        icon: 'assets/art/ui-hud/hud-icon-event.png',
        active: options.activeCommandPanel === 'events',
        action: { type: 'openCommandPanel', panel: 'events' },
      });
    }

    renderFloatingAccountButton(state = {}, options = {}) {
      this.renderFloatingMapButton(0, {
        label: this.t('world.map.command.account'),
        icon: 'assets/art/ui-hud/hud-icon-account.png',
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
      const dockTop = this.height - (Number(UiThemeTokens?.dock?.height) || 64);
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
