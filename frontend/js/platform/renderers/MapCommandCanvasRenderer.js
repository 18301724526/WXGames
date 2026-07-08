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
    drawLine(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawLine === 'function' ? surface.drawLine(...args) : this.host?.drawLine?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    getDockMetrics() {
      return UiThemeTokens?.getDockMetrics?.(this.width, this.height)
        || { height: 92, top: this.height - 92, badgeDiameter: 85, badgeOvershoot: 0, badgeInset: 12, badgeIconSize: 34, ledgeHeight: 21, wellHeight: 53, wellGap: 8, wellPadX: 3, cellIconSize: 26 };
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

    // UI-REDO knife 6: big round edge badge (capital / tasks), fully EMBEDDED
    // in the tray (zero overshoot, PIL-verified). A socket shadow disc under
    // the sprite plus a light-catching lower lip make it sit IN the plate
    // instead of floating on it. Aged iron/bronze medallion asset (v3) with a
    // token-gradient circle fallback while the asset is not loaded yet.
    // Active state is a code overlay (champagne ring highlight), not extra art.
    renderDockBadge(item = {}, rect = {}, options = {}) {
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const dock = UiThemeTokens?.dock || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const active = this.isDockItemActive(item, options);
      const { x, y, width, height } = rect;
      const size = Math.min(width, height);
      const centerX = x + width / 2;
      const centerY = y + size / 2;
      const iconSize = Number(rect.iconSize) || Math.round(size * 0.4);
      // Socket: the tray is visibly darker in a ring under the badge, and the
      // socket's lower lip catches the shared top light — one light source.
      const socketPad = Number(dock.badgeSocketPadPx) || 3;
      if (this.ctx && typeof this.ctx.arc === 'function') {
        this.ctx.save?.();
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, size / 2 + socketPad, 0, Math.PI * 2);
        this.ctx.fillStyle = hairline.badgeSocketShadow || 'rgba(0, 0, 0, 0.5)';
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, size / 2 + socketPad, Math.PI * 0.15, Math.PI * 0.85);
        this.ctx.strokeStyle = hairline.badgeSocketRim || 'rgba(109, 100, 87, 0.35)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.restore?.();
      }
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
      // Reference medallion composition: icon center at ~0.36 of the circle,
      // caption center at ~0.66 (both inside the ring).
      const iconY = y + size * 0.36 - iconSize / 2;
      if (!item.icon || !this.drawAsset(item.icon, centerX - iconSize / 2, iconY, iconSize, iconSize)) {
        this.drawText(String(item.label || '').slice(0, 1), centerX, iconY + iconSize / 2, {
          size: typeScale.title || 16,
          bold: true,
          color: palette.champagneGold,
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText(this.truncateText(item.label, size - 22, { size: typeScale.title || 16, bold: true }), centerX, y + size * 0.66, {
        size: typeScale.title || 16,
        bold: true,
        color: active ? palette.champagneGoldBright : palette.badgeTextGold,
        baseline: 'middle',
        align: 'center',
      });
      if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      if (active && this.ctx && typeof this.ctx.arc === 'function') {
        this.ctx.save?.();
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, size / 2 - 1, 0, Math.PI * 2);
        this.ctx.strokeStyle = palette.champagneGoldBright;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.restore?.();
      }
      this.addHitTarget({ x, y, width: size, height: size }, item.action);
    }

    // UI-REDO knife 6: the tray is ONE forged plate (拼图感修正的"地").
    // Token-painted per the reference anatomy: warm vertical face gradient,
    // 1px top bevel light + shadow under it, warm bottom edge line over the
    // terminal dark row. All colors/stops come from UiThemeTokens.
    drawDockTrayPlate(x, y, width, height) {
      if (!this.ctx || typeof this.ctx.fillRect !== 'function') return false;
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const dock = UiThemeTokens?.dock || {};
      const stops = Array.isArray(dock.trayGradientStops) && dock.trayGradientStops.length
        ? dock.trayGradientStops.map((stop) => [stop[0], stop[1]])
        : [[0, palette.dockTrayLedge], [1, palette.dockApron]];
      this.ctx.fillStyle = this.createGradient(x, y, x, y + height, stops, palette.dockTrayLedge);
      this.ctx.fillRect(x, y, width, height);
      const px = hairline.widthPx || 1;
      this.ctx.fillStyle = palette.dockBevelLight;
      this.ctx.fillRect(x, y, width, px);
      this.ctx.fillStyle = hairline.frameShadow;
      this.ctx.fillRect(x, y + px, width, px);
      this.ctx.fillStyle = palette.plateEdgeWarmLine;
      this.ctx.fillRect(x, y + height - 2 * px, width, px);
      this.ctx.fillStyle = hairline.frameShadow;
      this.ctx.fillRect(x, y + height - px, width, px);
      return true;
    }

    // UI-REDO knife 6: the center command area is a RECESSED WELL sunk into
    // the tray, not a floating box: ridge light above the lip, darker
    // interior gradient, inner top shadow, faint rim light at the bottom
    // edge. Same single top-light logic as the tray bevel and badge sockets.
    drawDockWell(x, y, width, height) {
      if (!this.ctx || typeof this.ctx.fillRect !== 'function') return false;
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const dock = UiThemeTokens?.dock || {};
      const px = hairline.widthPx || 1;
      const stops = Array.isArray(dock.wellGradientStops) && dock.wellGradientStops.length
        ? dock.wellGradientStops.map((stop) => [stop[0], stop[1]])
        : [[0, palette.dockWellTop], [1, palette.dockWellBottom]];
      // Ridge light on the tray just above the well lip.
      this.ctx.fillStyle = palette.dockBevelLight;
      this.ctx.fillRect(x - px, y - px, width + 2 * px, px);
      // Recessed interior.
      this.ctx.fillStyle = this.createGradient(x, y, x, y + height, stops, palette.dockWellTop);
      this.ctx.fillRect(x, y, width, height);
      // Inner top shadow (2px falloff) — the lip shades the interior.
      this.ctx.fillStyle = hairline.wellInnerShadow;
      this.ctx.fillRect(x + px, y + px, width - 2 * px, px);
      this.ctx.fillStyle = hairline.wellInnerShadowSoft;
      this.ctx.fillRect(x + px, y + 2 * px, width - 2 * px, px);
      // Bottom inner rim catching the light (just inside the frame).
      this.ctx.fillStyle = palette.dockWellRim;
      this.ctx.fillRect(x + px, y + height - 2 * px, width - 2 * px, px);
      // Cell frame outline around the well band (the reference cells read as
      // framed boxes; the matching dividers are drawn by the cell loop).
      this.ctx.fillStyle = palette.dockCellFrame;
      this.ctx.fillRect(x, y, width, px);
      this.ctx.fillRect(x, y + height - px, width, px);
      this.ctx.fillRect(x, y, px, height);
      this.ctx.fillRect(x + width - px, y, px, height);
      return true;
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

    // UI-REDO knife 6 (dock 一体化): the dock is ONE forged tray, not three
    // floating parts. Full-width token-painted tray plate (visible warm face,
    // bevel, apron), a recessed well sunk between the badges holding the four
    // command cells (equal split, hairline separators), and two round badges
    // fully EMBEDDED in the tray (zero overshoot — PIL-verified against the
    // reference) sitting in socket shadows. One top-light for everything.
    renderMapCommandDock(state = {}, options = {}) {
      const hairline = UiThemeTokens?.hairline || {};
      const metrics = this.getDockMetrics();
      const width = this.width;
      const dockHeight = metrics.height;
      const y = this.height - dockHeight;
      this.drawDockTrayPlate(0, y, width, dockHeight);
      const dockItems = this.getDockCommandItems(state);
      const badgeSize = metrics.badgeDiameter;
      const badgeInset = metrics.badgeInset;
      // Embedded: badge circle vertically centered in the tray band.
      const badgeY = y + Math.round((dockHeight - badgeSize) / 2) - metrics.badgeOvershoot;
      // Recessed well: runs badge-to-badge (small gap), top edge at the
      // ledge/well ridge from the reference anatomy.
      const wellGap = metrics.wellGap;
      const wellX = badgeInset + badgeSize + wellGap;
      const wellWidth = Math.max(60, width - 2 * (badgeInset + badgeSize + wellGap));
      const wellY = y + metrics.ledgeHeight;
      const wellHeight = metrics.wellHeight;
      this.drawDockWell(wellX, wellY, wellWidth, wellHeight);
      const padX = metrics.wellPadX || 0;
      const cellsX = wellX + padX;
      const cellsWidth = wellWidth - 2 * padX;
      const centerCount = dockItems.center.length;
      const cellWidth = centerCount > 0 ? cellsWidth / centerCount : cellsWidth;
      dockItems.center.forEach((item, index) => {
        const cellX = cellsX + index * cellWidth;
        if (index > 0 && this.ctx) {
          // Full-height cell frame divider (reference cells are framed boxes).
          this.ctx.fillStyle = UiThemeTokens?.palette?.dockCellFrame || hairline.dividerOnIron;
          this.ctx.fillRect(Math.round(cellX), wellY, hairline.widthPx || 1, wellHeight);
        }
        this.renderDockStripCell(item, {
          x: Math.round(cellX),
          y: wellY,
          width: Math.round(cellWidth),
          height: wellHeight,
          iconSize: metrics.cellIconSize,
        }, options);
      });
      this.renderDockBadge(dockItems.capital, { x: badgeInset, y: badgeY, width: badgeSize, height: badgeSize, iconSize: metrics.badgeIconSize }, options);
      this.renderDockBadge(dockItems.tasks, { x: width - badgeInset - badgeSize, y: badgeY, width: badgeSize, height: badgeSize, iconSize: metrics.badgeIconSize }, options);
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
      ModalPlate.drawModalPlate(this, x, y, width, panelHeight);
      this.addHitTarget({ x, y, width, height: panelHeight }, { type: 'blockCanvasModal' });
      const titleBar = ModalPlate.drawModalTitleBar(this, x, y, width, {
        title: titleByPanel[panel] || this.t('world.map.panel.fallback'),
        withClose: true,
      });
      if (titleBar.closeRect) this.addHitTarget(titleBar.closeRect, { type: 'closeCommandPanel' });

      const contentTop = titleBar.contentTop;
      const contentHeight = Math.max(120, y + panelHeight - contentTop - 12);
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
