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
      const dockTop = this.height - 64;
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

    getDockCommandItems(state = {}) {
      return {
        capital: {
          id: 'capital',
          label: this.t('world.map.command.capital'),
          icon: 'assets/art/ui-hud/hud-icon-capital.png',
          action: { type: 'openWorldSite', siteId: this.resolveCapitalSiteId(state) },
        },
        tasks: {
          id: 'tasks',
          label: this.t('world.map.command.tasks'),
          icon: 'assets/art/ui-hud/hud-icon-tasks.png',
          action: { type: 'openTaskCenter', tab: 'main', source: 'taskIcon' },
        },
        center: [
          { id: 'tech', label: this.t('world.map.command.tech'), icon: 'assets/art/ui-hud/hud-icon-tech.png', action: { type: 'openCommandPanel', panel: 'tech' } },
          { id: 'civilization', label: this.t('world.map.command.civilization'), icon: 'assets/art/ui-hud/hud-icon-civilization.png', action: { type: 'openCommandPanel', panel: 'civilization' } },
          { id: 'famousPersons', label: this.t('world.map.command.famousPersons'), icon: 'assets/art/ui-hud/hud-icon-famous.png', action: { type: 'openFamousPersons' } },
          { id: 'more', label: this.t('world.map.command.more'), icon: 'assets/art/ui-hud/hud-icon-more.png', action: { type: 'openGuidebook', tab: 'planning', source: 'mapCommandMore' } },
          { id: 'settings', label: this.t('world.map.command.settings'), icon: 'assets/art/ui-hud/hud-icon-settings.png', action: { type: 'openSettings' } },
        ],
      };
    }

    isDockItemActive(item = {}, options = {}) {
      // Active-state decisions live on the mode-owner side (buildRendererPanelFacts →
      // panel.activeDockItemIds); this renderer only consumes the pre-decided list.
      if ((options.activeCommandPanel || '') === item.id) return true;
      return Array.isArray(options.activeDockItemIds) && options.activeDockItemIds.includes(item.id);
    }

    renderDockItem(item = {}, rect = {}, options = {}) {
      const active = this.isDockItemActive(item, options);
      const isMajor = Boolean(options.major);
      const { x, y, width, height } = rect;
      const iconSize = isMajor ? 32 : 23;
      const iconX = x + width / 2 - iconSize / 2;
      const iconY = y + (isMajor ? 8 : 7) - (active ? 1 : 0);
      if (isMajor) {
        this.drawPanel(x + 3, y + 4, width - 6, height - 8, {
          fill: active ? 'rgba(96, 55, 34, 0.9)' : 'rgba(21, 20, 17, 0.58)',
          stroke: active ? 'rgba(247, 215, 116, 0.58)' : 'rgba(220, 203, 164, 0.18)',
          radius: Math.min(16, Math.floor((height - 8) / 2)),
          inset: 'rgba(255, 255, 255, 0.045)',
        });
      } else if (active && this.ctx) {
        this.ctx.fillStyle = '#d6a85d';
        this.ctx.fillRect(x + width * 0.22, y + 2, width * 0.56, 2);
      }
      const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = item.disabled ? 0.38 : previousAlpha;
      if (!item.icon || !this.drawAsset(item.icon, iconX, iconY, iconSize, iconSize)) {
        this.drawText(String(item.label || '').slice(0, 1), x + width / 2, iconY + iconSize / 2, {
          size: isMajor ? 16 : 12,
          bold: true,
          color: active ? '#ffe6b5' : '#cbbd96',
          baseline: 'middle',
          align: 'center',
        });
      }
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      this.drawText(this.truncateText(item.label, width - 8, { size: isMajor ? 12 : 9, bold: active }), x + width / 2, y + height - (isMajor ? 16 : 15), {
        size: isMajor ? 12 : 9,
        bold: active || isMajor,
        color: active ? '#f0b45b' : '#d2c5a4',
        align: 'center',
      });
      this.addHitTarget({ x, y, width, height }, item.action);
    }

    renderMapCommandDock(state = {}, options = {}) {
      const layout = this.getLayout();
      const x = 0;
      const width = this.width;
      const dockHeight = 64;
      const y = this.height - dockHeight;
      if (this.ctx) {
        this.ctx.fillStyle = this.createGradient(
          x, y, x, y + dockHeight,
          [
            [0, 'rgba(44, 35, 25, 0.88)'],
            [1, 'rgba(18, 16, 13, 0.96)'],
          ],
          'rgba(30, 24, 18, 0.94)',
        );
        this.ctx.fillRect(x, y, width, dockHeight);
        this.ctx.fillStyle = 'rgba(255, 226, 177, 0.16)';
        this.ctx.fillRect(0, y, width, 1);
        this.ctx.fillStyle = 'rgba(255, 231, 184, 0.04)';
        this.ctx.fillRect(0, y + 1, width, 1);
      }
      const contentX = layout.contentX;
      const contentWidth = layout.contentWidth;
      const dockItems = this.getDockCommandItems(state);
      const edgeWidth = Math.max(62, Math.min(76, Math.floor(contentWidth * 0.2)));
      const gutter = 4;
      const centerWidth = Math.max(0, contentWidth - edgeWidth * 2 - gutter * 2);
      const centerItemWidth = centerWidth / dockItems.center.length;
      const itemY = y;
      const itemHeight = dockHeight;
      this.renderDockItem(dockItems.capital, { x: contentX, y: itemY, width: edgeWidth, height: itemHeight }, { ...options, major: true });
      dockItems.center.forEach((item, index) => {
        this.renderDockItem(item, {
          x: contentX + edgeWidth + gutter + index * centerItemWidth,
          y: itemY,
          width: centerItemWidth,
          height: itemHeight,
        }, options);
      });
      this.renderDockItem(dockItems.tasks, { x: contentX + contentWidth - edgeWidth, y: itemY, width: edgeWidth, height: itemHeight }, { ...options, major: true });
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
      const dockTop = this.height - 64;
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
