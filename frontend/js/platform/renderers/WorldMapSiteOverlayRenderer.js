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

  const sharedUIStatePresenter = (() => {
    if (global.UIStatePresenter) return global.UIStatePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../state/UIStatePresenter');
      } catch (error) {
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

  const ClientCommandSemantics = (() => {
    if (global.ClientCommandSemantics) return global.ClientCommandSemantics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ClientCommandSemantics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMapSiteOverlayRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get width() {
      return Number(this.host?.width) || 0;
    }

    get height() {
      return Number(this.host?.height) || 0;
    }

    get bottomSafeArea() {
      return Number(this.host?.bottomSafeArea) || 12;
    }

    get viewportOffsetX() {
      return Number(this.host?.viewportOffsetX) || 0;
    }

    get viewportOffsetY() {
      return Number(this.host?.viewportOffsetY) || 0;
    }

    get viewportWidth() {
      return Number(this.host?.viewportWidth) || 0;
    }

    get viewportHeight() {
      return Number(this.host?.viewportHeight) || 0;
    }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    addHitTarget(...args) {
      return this.host?.addHitTarget?.(...args);
    }

    createGradient(...args) {
      return this.host?.createGradient?.(...args) ?? args[5] ?? '#000';
    }

    drawAsset(...args) {
      return this.host?.drawAsset?.(...args);
    }

    drawButton(...args) {
      return this.host?.drawButton?.(...args);
    }

    drawCircle(...args) {
      return this.host?.drawCircle?.(...args);
    }

    drawPanel(...args) {
      return this.host?.drawPanel?.(...args);
    }

    drawText(...args) {
      return this.host?.drawText?.(...args);
    }

    drawTextLines(...args) {
      return this.host?.drawTextLines?.(...args);
    }

    getLayout(...args) {
      return this.host?.getLayout?.(...args) || { contentWidth: this.width || 0, contentX: 0, contentRight: this.width || 0 };
    }

    getTopBarBottom(...args) {
      return this.host?.getTopBarBottom?.(...args) || 84;
    }

    measureTextWidth(...args) {
      return this.host?.measureTextWidth?.(...args) || 0;
    }

    truncateText(text, maxWidth, options = {}) {
      return this.host?.truncateText?.(text, maxWidth, options) ?? String(text ?? '');
    }

    wrapTextLimit(text, maxWidth, maxLines, options = {}) {
      return this.host?.wrapTextLimit?.(text, maxWidth, maxLines, options) || [String(text || '')].filter(Boolean);
    }

    getWorldMapLayerLayout(...args) {
      return this.host?.getWorldMapLayerLayout?.(...args) || null;
    }

    resolveWorldTileMapView(...args) {
      return this.host?.resolveWorldTileMapView?.(...args) || null;
    }

    getWorldTileScreenCenter(...args) {
      return this.host?.getWorldTileScreenCenter?.(...args) || { x: 0, y: 0 };
    }

    getWorldTileRenderedDiamondCenter(...args) {
      return this.host?.getWorldTileRenderedDiamondCenter?.(...args) || null;
    }

    getWorldTileRenderEntries(...args) {
      return this.host?.getWorldTileRenderEntries?.(...args) || [];
    }

    getWorldTileSiteLayout(...args) {
      return this.host?.getWorldTileSiteLayout?.(...args) || null;
    }

    getWorldSiteDialogPresenter() {
      return [
        this.presenter,
        this.host?.presenter,
        this.host?.host?.presenter,
        sharedUIStatePresenter,
      ].find((presenter) => presenter && typeof presenter.buildWorldSiteDialogViewState === 'function') || null;
    }

    buildWorldSiteDialogViewState(territories = [], territoryState = {}, uiState = {}) {
      const presenter = this.getWorldSiteDialogPresenter();
      if (presenter && typeof presenter.buildWorldSiteDialogViewState === 'function') {
        return presenter.buildWorldSiteDialogViewState(territories, territoryState, uiState);
      }
      return this.buildFallbackWorldSiteDialogViewState(territories, territoryState, uiState);
    }

    buildFallbackWorldSiteDialogViewState(territories = [], territoryState = {}, uiState = {}) {
      const selectedSiteId = uiState.selectedSiteId || '';
      const makeButton = (label, action, territoryId, options = {}) => ({
        label,
        action: action || '',
        territoryId: territoryId || '',
        disabled: Boolean(options.disabled),
        secondary: Boolean(options.secondary),
      });
      const makeAction = (site = {}) => {
        if (site.status === 'occupied') {
          return {
            kind: 'city-command',
            buttons: [
              makeButton(this.t('world.site.action.enterCity'), 'enter-city', site.id),
              makeButton(this.t('world.site.action.marchCity'), 'march-city', site.id, { disabled: true, secondary: true }),
              makeButton(this.t('world.site.action.transferCity'), 'transfer-city', site.id, { disabled: true, secondary: true }),
              makeButton(this.t('world.site.action.garrisonCity'), 'garrison-city', site.id, { disabled: true, secondary: true }),
              makeButton(this.t('world.site.action.laborCity'), 'labor-city', site.id, { secondary: true }),
              makeButton(this.t('world.site.action.rename'), 'rename-city', site.id, { secondary: true }),
            ],
            hint: '',
            expeditionConfig: null,
          };
        }
        return {
          kind: 'single',
          buttons: [makeButton(this.t('world.site.action.waitScout'), '', site.id, { disabled: true })],
          hint: '',
          expeditionConfig: null,
        };
      };
      const details = (territories || []).map((site) => ({
        id: site.id || '',
        visible: site.id === selectedSiteId,
        text: {
          name: site.cityName || site.naturalName || site.name || '',
          status: site.status === 'occupied' ? this.t('world.site.status.occupied') : (site.status || ''),
          owner: site.owner === 'player' ? this.t('world.site.owner.player') : (site.owner || ''),
          distance: this.t('world.site.metric.distance', { value: site.originDistance ?? site.distance ?? 0 }),
          scale: this.t('world.site.metric.scale', { value: site.scale || 1 }),
          threat: this.t('world.site.metric.threat', { value: site.threat || 0 }),
          summary: site.summary || '',
          defense: this.t('world.site.metric.defense', { value: site.defense || 0 }),
          soldiers: this.t('world.site.metric.recommendedSoldiers', { soldiers: site.recommendedSoldiers || 0 }),
        },
        action: makeAction(site),
      }));
      const view = {
        selectedSiteId,
        showModal: details.some((detail) => detail.id === selectedSiteId),
        details,
      };
      return {
        ...view,
        signature: JSON.stringify(view),
      };
    }

    renderWorldSiteAction(actionView = {}, x, y, width) {
      const buttons = actionView.buttons || [];
      if (!buttons.length) return y;
      if (actionView.kind === 'city-command') {
        // UI-REDO knife 8: the fallback city-command cluster reuses the same
        // painter-backed primary/side button helpers as the anchored overlay.
        const primary = buttons.find((button) => button.action === 'enter-city') || buttons[0];
        const sideButtons = buttons.filter((button) => button !== primary).slice(0, 5);
        const primarySize = 74;
        const primaryX = x + Math.max(8, Math.floor(width * 0.26));
        const primaryY = y + 12;
        this.drawWorldCityCommandPrimaryButton(primary, primaryX, primaryY, primarySize);
        this.addHitTarget({ x: primaryX, y: primaryY, width: primarySize, height: primarySize }, {
          type: 'enterCity',
          territoryId: primary.territoryId,
          cityId: primary.territoryId,
          disabled: primary.disabled || !primary.action,
        });

        const commandX = Math.min(x + width - 116, primaryX + primarySize + 20);
        const commandY = y;
        sideButtons.forEach((button, index) => {
          const buttonY = commandY + index * 38;
          const type = button.action === 'rename-city'
            ? 'renameCity'
            : (button.action === 'labor-city' ? 'enterCity' : 'territoryAction');
          this.drawWorldCityCommandSideButton(button, commandX, buttonY, 108, 32);
          this.addHitTarget({ x: commandX, y: buttonY, width: 108, height: 32 }, {
            type,
            territoryId: button.territoryId,
            cityId: button.territoryId,
            tab: button.action === 'labor-city' ? 'people' : undefined,
            disabled: button.disabled || !button.action,
          });
        });
        return y + Math.max(primarySize + 18, sideButtons.length * 38 + 4);
      }
      const gap = 8;
      const buttonWidth = Math.max(72, (width - gap * (buttons.length - 1)) / Math.max(1, buttons.length));
      buttons.forEach((button, index) => {
        const buttonX = x + index * (buttonWidth + gap);
        this.drawButton(buttonX, y, buttonWidth, 34, button.label, {
          size: 12,
          radius: 8,
          disabled: !button.action,
          visualDisabled: Boolean(button.disabled),
          active: !button.secondary && !button.disabled && Boolean(button.action),
        });
        const targetAction = {
          type: button.action === 'conquer' ? 'conquer' :
            button.action === 'launch-expedition' ? 'launchExpedition' :
            button.action === 'claim' ? 'claimConquest' :
            button.action === 'enter-battle' ? 'enterBattleScene' :
            button.action === 'enter-city' ? 'enterCity' :
            button.action === 'labor-city' ? 'enterCity' :
            button.action === 'manage-city' ? 'manageCity' :
            button.action === 'rename-city' ? 'renameCity' :
            button.action === 'open-expedition' ? 'openExpedition' :
            button.action === 'close-expedition' ? 'closeExpedition' : 'territoryAction',
          territoryId: button.territoryId,
          cityId: button.territoryId,
          tab: button.action === 'labor-city' ? 'people' : undefined,
          visualDisabled: Boolean(button.disabled),
        };
        if (!ClientCommandSemantics?.isCommandAction?.(targetAction)) {
          targetAction.disabled = button.disabled || !button.action;
        }
        this.addHitTarget({ x: buttonX, y, width: buttonWidth, height: 34 }, targetAction);
      });
      return y + 44;
    }

    renderWorldExpeditionConfig(config = {}, x, y, width) {
      if (!config) return y;
      this.drawPanel(x, y, width, 136, {
        fill: 'rgba(0, 0, 0, 0.16)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 9,
      });
      const leaderOptions = config.fields?.leader?.options || [];
      const activeLeader = leaderOptions.find((option) => option.value === config.fields?.leader?.value) || leaderOptions[0] || null;
      this.drawText(this.t('world.site.expedition.leaderPrefix', {
        leader: activeLeader?.label || this.t('world.site.expedition.noLeader'),
      }), x + 12, y + 12, { size: 12, bold: true, color: '#f6e8c8' });
      const leaderY = y + 34;
      const leaderButtonWidth = Math.max(82, Math.min(118, (width - 24 - 8 * Math.max(0, leaderOptions.length - 1)) / Math.max(1, Math.min(3, leaderOptions.length || 1))));
      leaderOptions.slice(0, 3).forEach((option, index) => {
        const buttonX = x + 12 + index * (leaderButtonWidth + 8);
        const active = option.value === config.fields?.leader?.value;
        this.drawButton(buttonX, leaderY, leaderButtonWidth, 26, this.truncateText(option.label, leaderButtonWidth - 12, { size: 10 }), {
          size: 10,
          radius: 7,
          active,
          disabled: false,
        });
        this.addHitTarget({ x: buttonX, y: leaderY, width: leaderButtonWidth, height: 26 }, {
          type: 'changeExpeditionLeader',
          siteId: config.siteId,
          value: option.value,
          disabled: false,
        });
      });
      this.drawText(this.t('world.site.expedition.soldierCount', {
        count: config.fields?.soldiers?.value || 1,
      }), x + 12, y + 70, { size: 12, bold: true, color: '#f6e8c8' });
      this.drawText(config.note || '', x + 12, y + 92, { size: 10, color: '#aeb0b8' });
      const value = Number(config.fields?.soldiers?.value) || 1;
      const controlsY = y + 112;
      this.drawButton(x + 12, controlsY, 34, 28, '-', { size: 14, radius: 7, disabled: value <= 1 });
      this.drawButton(x + width - 46, controlsY, 34, 28, '+', { size: 14, radius: 7 });
      this.drawButton(x + width - 132, controlsY, 78, 28, config.buttons?.launch?.label || this.t('world.site.action.launch'), {
        size: 12,
        radius: 7,
        visualDisabled: config.disabled,
        active: !config.disabled,
      });
      this.addHitTarget({ x: x + 12, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: -1,
        value: Math.max(1, value - 1),
        disabled: value <= 1,
      });
      this.addHitTarget({ x: x + width - 46, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: 1,
        value: value + 1,
      });
      this.addHitTarget({ x: x + width - 132, y: controlsY, width: 78, height: 28 }, {
        type: 'launchExpedition',
        territoryId: config.siteId,
        visualDisabled: config.disabled,
      });
      return y + 148;
    }

    renderWorldSiteModal(state = {}, options = {}) {
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      const uiState = options.territoryUiState || {};
      const view = this.buildWorldSiteDialogViewState(territories, territoryState, uiState);
      if (!view.showModal) return;
      const detail = view.details.find((item) => item.id === view.selectedSiteId);
      if (!detail) return;
      if (detail.action?.kind === 'city-command') {
        this.renderWorldCityCommandOverlay(detail, territories, state, options);
        return;
      }

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeWorldSite' });
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 24, 360);
      const panelHeight = Math.min(500, this.height - 150);
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 12);
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
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, this.t('common.close.short'), { size: 16, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeWorldSite' });

      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      this.drawAsset(selectedSite.art, x + 16, y + 20, 58, 58);
      this.drawText(this.truncateText(detail.text.name || this.t('world.site.defaultName'), panelWidth - 112, { size: 17, bold: true }), x + 84, y + 22, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(`${detail.text.status} · ${detail.text.owner}`, x + 84, y + 50, { size: 11, color: '#aeb0b8' });
      this.drawText(`${detail.text.distance} · ${detail.text.scale} · ${detail.text.threat}`, x + 84, y + 68, { size: 11, color: '#aeb0b8' });
      let cursorY = y + 94;
      const summaryLines = this.wrapTextLimit(detail.text.summary || this.t('world.site.summary.none'), panelWidth - 32, 3, { size: 12 });
      this.drawTextLines(summaryLines, x + 16, cursorY, { size: 12, color: '#f6e8c8', lineHeight: 17 });
      cursorY += summaryLines.length * 17 + 12;
      this.drawText(`${detail.text.defense} · ${detail.text.soldiers}`, x + 16, cursorY, { size: 12, color: '#74d3a0' });
      cursorY += 22;
      if (detail.text.defenderLeader) {
        this.drawText(detail.text.defenderLeader, x + 16, cursorY, { size: 11, color: '#ffba8a' });
        cursorY += 18;
      }
      if (detail.text.defenderSkill) {
        this.drawText(detail.text.defenderSkill, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 18;
      }
      if (detail.text.march) {
        this.drawText(detail.text.march, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (detail.text.note) {
        this.drawText(detail.text.note, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (Array.isArray(detail.text.battleReport) && detail.text.battleReport.length) {
        detail.text.battleReport.slice(0, 4).forEach((line) => {
          const lines = this.wrapTextLimit(line, panelWidth - 32, 1, { size: 11 });
          this.drawTextLines(lines, x + 16, cursorY, { size: 11, color: '#f0b45b', lineHeight: 15 });
          cursorY += lines.length * 15 + 3;
        });
        cursorY += 6;
      }
      if (detail.action?.hint) {
        const hintLines = this.wrapTextLimit(detail.action.hint, panelWidth - 32, 2, { size: 11 });
        this.drawTextLines(hintLines, x + 16, cursorY, { size: 11, color: '#aeb0b8', lineHeight: 15 });
        cursorY += hintLines.length * 15 + 10;
      }
      cursorY = this.renderWorldSiteAction(detail.action, x + 16, cursorY, panelWidth - 32);
      if (detail.action?.expeditionConfig) {
        this.renderWorldExpeditionConfig(detail.action.expeditionConfig, x + 16, cursorY, panelWidth - 32);
      }
    }

    getWorldCityCommandAnchor(detail = {}, territories = [], state = {}, options = {}) {
      const contextAnchor = this.getWorldSiteCanvasAnchor(detail.id, state, options);
      if (contextAnchor) {
        const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state, { isMapHome: true });
        const layout = typeof this.getWorldMapLayerLayout === 'function'
          ? this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true })
          : {
            map: {
              x: 0,
              y: topBarBottom,
              width: this.width,
              height: Math.max(160, this.height - topBarBottom - 64),
            },
          };
        const scale = Number(contextAnchor.viewport?.scale || options.worldMapRuntimeContext?.viewport?.scale) || 1;
        const geometry = contextAnchor.geometry || options.worldMapRuntimeContext?.geometry || options.worldMapRuntimeContext?.tileMapView?.geometry || {};
        const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
        const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
        return {
          map: layout?.map || null,
          site: contextAnchor.site || territories.find((site) => site?.id === detail.id) || {},
          siteLayout: contextAnchor,
          tileCenter: contextAnchor.center,
          tileWidth,
          tileHeight,
          anchorX: contextAnchor.center.x,
          anchorY: contextAnchor.center.y,
          titleY: contextAnchor.center.y - Math.max(34, tileHeight * 0.48),
        };
      }
      if (options.worldMapRuntimeContext) return null;
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) return null;
      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      const selectedTile = tileMapView.tiles.find((tile) => (
        tile?.site?.id === detail.id
        || tile?.siteId === detail.id
        || selectedSite.id && (tile?.siteId === selectedSite.id || tile?.site?.id === selectedSite.id)
      ));
      if (!selectedTile) return null;
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state, { isMapHome: true });
      const layout = typeof this.getWorldMapLayerLayout === 'function'
        ? this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true })
        : {
          map: {
            x: 0,
            y: topBarBottom,
            width: this.width,
            height: Math.max(160, this.height - topBarBottom - 64),
          },
        };
      if (!layout?.map) return null;
      const geometry = tileMapView.geometry || {};
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
      const scale = Math.max(0.38, Math.min(0.78, Math.min(visibleWidth / 520, visibleMapH / 420)));
      const viewport = {
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
        worldOrigin: tileMapView.origin || tileMapView.worldOrigin || { q: 0, r: 0 },
      };
      const projectedCenter = this.getWorldTileScreenCenter(selectedTile, viewport, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const frame = {
        x: Number(layout.map.x) || 0,
        y: Number(layout.map.y) || 0,
        width: Number(layout.map.width) || this.width,
        height: Number(layout.map.height) || this.height,
      };
      const entries = this.getWorldTileRenderEntries(tileMapView, viewport, frame, geometry);
      const selectedEntry = entries.find(({ tile }) => (
        tile?.id === selectedTile.id
        || tile?.site?.id === detail.id
        || tile?.siteId === detail.id
      ));
      const center = selectedEntry
        ? this.getWorldTileRenderedDiamondCenter(selectedEntry.tile, selectedEntry.drawRect)
        : projectedCenter;
      const siteLayout = this.getWorldTileSiteLayout(selectedTile, viewport, geometry, tileWidth, tileHeight, projectedCenter);
      if (!siteLayout) return null;
      return {
        map: layout.map,
        site: siteLayout.site || selectedSite,
        siteLayout,
        tileCenter: center,
        tileWidth,
        tileHeight,
        anchorX: center.x,
        anchorY: center.y,
        titleY: center.y - Math.max(34, tileHeight * 0.48),
      };
    }

    getWorldSiteTile(siteId = '', tileMapView = {}, territories = []) {
      if (!siteId || !Array.isArray(tileMapView?.tiles)) return null;
      const selectedSite = (Array.isArray(territories) ? territories : []).find((site) => site?.id === siteId) || {};
      return tileMapView.tiles.find((tile) => (
        tile?.site?.id === siteId
        || tile?.siteId === siteId
        || selectedSite.id && (tile?.siteId === selectedSite.id || tile?.site?.id === selectedSite.id)
      )) || null;
    }

    isSameWorldSiteTile(first = null, second = null) {
      if (!first || !second) return true;
      if (first.id && second.id && first.id !== second.id) return false;
      const firstQ = Number(first.q ?? first.x);
      const firstR = Number(first.r ?? first.y);
      const secondQ = Number(second.q ?? second.x);
      const secondR = Number(second.r ?? second.y);
      if (Number.isFinite(firstQ) && Number.isFinite(secondQ) && firstQ !== secondQ) return false;
      if (Number.isFinite(firstR) && Number.isFinite(secondR) && firstR !== secondR) return false;
      return true;
    }

    getWorldSiteLayerOffset(options = {}) {
      const context = options.worldMapRuntimeContext || null;
      const contextX = Number(context?.viewportOffsetX);
      const contextY = Number(context?.viewportOffsetY);
      if (Number.isFinite(contextX) || Number.isFinite(contextY)) {
        return {
          x: Number.isFinite(contextX) ? contextX : 0,
          y: Number.isFinite(contextY) ? contextY : 0,
        };
      }
      const candidates = [
        options.worldMapRenderer,
        this.host?.worldMapRenderer,
        this.host?.host?.worldMapRenderer,
        this.worldMapRenderer,
        this.host,
        this.host?.host,
        this,
      ];
      for (let index = 0; index < candidates.length; index += 1) {
        const source = candidates[index];
        const x = Number(source?.viewportOffsetX);
        const y = Number(source?.viewportOffsetY);
        if (Number.isFinite(x) || Number.isFinite(y)) {
          return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
          };
        }
      }
      return { x: 0, y: 0 };
    }

    resolveWorldSiteCanvasAnchorFromContext(siteId = '', state = {}, options = {}) {
      const context = options.worldMapRuntimeContext || null;
      const tileMapView = context?.tileMapView || context?.renderSnapshot?.tileMapView || null;
      const viewport = context?.viewport || context?.renderSnapshot?.viewport || null;
      if (!siteId || !tileMapView?.tiles?.length || !viewport) return null;
      const territories = state.territoryState?.territories || [];
      const selectedTile = this.getWorldSiteTile(siteId, tileMapView, territories);
      if (!selectedTile) return null;
      const stateTile = this.getWorldSiteTile(siteId, state.territoryState?.worldMap || {}, territories);
      if (stateTile && !this.isSameWorldSiteTile(stateTile, selectedTile)) return null;
      const geometry = context.geometry || context.renderSnapshot?.geometry || tileMapView.geometry || viewport.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const projectedCenter = this.getWorldTileScreenCenter(selectedTile, viewport, geometry);
      const siteLayout = this.getWorldTileSiteLayout(selectedTile, viewport, geometry, tileWidth, tileHeight, projectedCenter);
      if (!siteLayout?.hitRect) return null;
      const layerOffset = this.getWorldSiteLayerOffset(options);
      const toHudRect = (rect = {}) => ({
        x: (Number(rect.x ?? rect.left) || 0) - layerOffset.x,
        y: (Number(rect.y ?? rect.top) || 0) - layerOffset.y,
        width: Number(rect.width) || 0,
        height: Number(rect.height) || 0,
      });
      return {
        ...siteLayout,
        hitRect: toHudRect(siteLayout.hitRect),
        site: siteLayout.site || selectedTile.site || territories.find((site) => site?.id === siteId) || { id: siteId },
        tile: selectedTile,
        center: {
          x: projectedCenter.x - layerOffset.x,
          y: projectedCenter.y - layerOffset.y,
        },
        layerCenter: projectedCenter,
        layerOffset,
      };
    }

    getWorldSiteCanvasAnchor(siteId = '', state = {}, options = {}) {
      if (!siteId) return null;
      const hasRuntimeContext = Boolean(options.worldMapRuntimeContext);
      const contextAnchor = this.resolveWorldSiteCanvasAnchorFromContext(siteId, state, options);
      if (contextAnchor) return contextAnchor;
      if (hasRuntimeContext) return null;
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      const tileMapView = this.resolveWorldTileMapView(territoryState, options.territoryUiState || {}, {
        ...options,
        worldExplorerState: state.worldExplorerState || {},
      });
      if (!tileMapView?.tiles?.length) return null;
      const selectedSite = territories.find((site) => site.id === siteId) || {};
      const selectedTile = this.getWorldSiteTile(siteId, tileMapView, territories);
      if (!selectedTile) return null;
      const topBarBottom = options.topBarBottom ?? this.getTopBarBottom(state, { isMapHome: true });
      const geometry = tileMapView.geometry || {};
      const offsetX = Number(this.viewportOffsetX) || 0;
      const offsetY = Number(this.viewportOffsetY) || 0;
      const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
      const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
      const visibleMapY = Math.max(0, topBarBottom ?? 84);
      const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
      const scale = Math.max(0.38, Math.min(0.78, Math.min(visibleWidth / 520, visibleMapH / 420)));
      const viewport = {
        originX: offsetX + visibleWidth * 0.5,
        originY: offsetY + visibleMapY + visibleMapH * 0.42,
        panX: Number(tileMapView.pan?.x) || 0,
        panY: Number(tileMapView.pan?.y) || 0,
        scale,
        seed: tileMapView.seed || 'scout-tile-v1',
        geometry,
        worldOrigin: tileMapView.origin || tileMapView.worldOrigin || { q: 0, r: 0 },
      };
      const projectedCenter = this.getWorldTileScreenCenter(selectedTile, viewport, geometry);
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const siteLayout = this.getWorldTileSiteLayout(selectedTile, viewport, geometry, tileWidth, tileHeight, projectedCenter);
      if (!siteLayout) return null;
      return {
        ...siteLayout,
        site: siteLayout.site || selectedSite,
        tile: selectedTile,
        center: projectedCenter,
      };
    }

    getWorldCityCommandButtonAction(button = {}) {
      return {
        type: button.action === 'rename-city'
          ? 'renameCity'
          : (button.action === 'labor-city' ? 'enterCity' :
            button.action === 'enter-city' ? 'enterCity' : 'territoryAction'),
        territoryId: button.territoryId,
        cityId: button.territoryId,
        tab: button.action === 'labor-city' ? 'people' : undefined,
        disabled: !button.action,
        visualDisabled: Boolean(button.disabled),
      };
    }

    // UI-REDO knife 8: unified painter buttons. Primary (入城) = warm forged
    // face + champagne edge, round; side commands = secondary iron; disabled
    // (行军/调动/驻守 before their systems land) = flat grey, clearly apart.
    drawWorldCityCommandPrimaryButton(button = {}, x, y, size) {
      ModalPlate.drawModalButton(this, x, y, size, size, button.label || this.t('world.site.action.enterCity'), {
        variant: 'primary',
        disabled: button.disabled || !button.action,
        radius: size / 2,
        size: Math.max(13, Math.floor(size * 0.27)),
      });
    }

    drawWorldCityCommandSideButton(button = {}, x, y, width, height) {
      const active = !button.secondary && !button.disabled && Boolean(button.action);
      ModalPlate.drawModalButton(this, x, y, width, height, button.label || '', {
        variant: active ? 'primary' : 'secondary',
        disabled: button.disabled || !button.action,
        radius: 5,
        size: 12,
        bold: active,
      });
    }

    renderWorldCityCommandOverlay(detail = {}, territories = [], state = {}, options = {}) {
      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      const buttons = detail.action?.buttons || [];
      if (!buttons.length) return;
      const primary = buttons.find((button) => button.action === 'enter-city') || buttons[0];
      const renameButton = buttons.find((button) => button.action === 'rename-city') || null;
      const sideButtons = buttons.filter((button) => (
        button !== primary
        && button.action !== 'labor-city'
        && button.action !== 'rename-city'
      )).slice(0, 5);
      const anchor = this.getWorldCityCommandAnchor(detail, territories, state, options);
      if (!anchor) {
        const width = Math.min(this.getLayout().contentWidth - 24, 320);
        const x = Math.max(12, (this.width - width) / 2);
        const y = Math.max(this.getTopBarBottom(state, { isMapHome: true }) + 16, this.height - 260);
        const fallbackButtons = [primary, ...sideButtons, renameButton].filter(Boolean);
        this.renderWorldSiteAction({ ...detail.action, buttons: fallbackButtons }, x, y, width);
        return;
      }

      const topLimit = Math.max(4, Number(anchor.map?.y) || this.getTopBarBottom(state, { isMapHome: true }) || 84);
      const bottomLimit = Math.max(topLimit + 120, Math.min(this.height - 66 - this.bottomSafeArea, (Number(anchor.map?.y) || 0) + (Number(anchor.map?.height) || this.height)));
      const primarySize = Math.max(41, Math.min(52, (Number(anchor.siteLayout?.drawW) || 110) * 0.5));
      const sideWidth = Math.min(88, Math.max(73, this.width * 0.2));
      const sideHeight = 27;
      const sideGap = 5;
      const sideTotalHeight = sideButtons.length * sideHeight + Math.max(0, sideButtons.length - 1) * sideGap;
      const clusterHeight = Math.max(primarySize, sideTotalHeight || primarySize);
      const hudLift = clusterHeight / 3;
      const gap = 8;
      const clusterWidth = primarySize + gap + (sideButtons.length ? sideWidth : 0);
      const preferRight = anchor.anchorX + clusterWidth * 0.5 + 8 <= this.width;
      const sideOnRight = preferRight || anchor.anchorX - clusterWidth * 0.5 - 8 < 0;
      const primaryXRaw = anchor.anchorX - primarySize * 0.5;
      const primaryYRaw = anchor.anchorY - hudLift - primarySize * 0.5;
      const minPrimaryX = sideOnRight ? 8 : sideWidth + gap + 8;
      const maxPrimaryX = sideOnRight ? this.width - clusterWidth - 8 : this.width - primarySize - 8;
      const primaryX = Math.max(minPrimaryX, Math.min(primaryXRaw, Math.max(minPrimaryX, maxPrimaryX)));
      const primaryY = Math.max(topLimit + 38, Math.min(primaryYRaw, bottomLimit - primarySize - 8));
      const sideX = sideOnRight ? primaryX + primarySize + gap : primaryX - sideWidth - gap;
      const sideYRaw = primaryY + (primarySize - sideTotalHeight) / 2;
      const sideY = Math.max(topLimit + 8, Math.min(sideYRaw, bottomLimit - sideTotalHeight - 8));
      const title = detail.text?.name || selectedSite.cityName || selectedSite.naturalName || this.t('world.site.cityFallback');
      const renameWidth = renameButton ? 38 : 0;
      const titleWidth = this.measureTextWidth(title, { size: 12, bold: true });
      const badgeWidth = Math.min(190, Math.max(98, titleWidth + renameWidth + 30));
      const badgeX = Math.max(8, Math.min(anchor.anchorX - badgeWidth / 2, this.width - badgeWidth - 8));
      const titleGap = Math.max(9, primarySize * 0.22);
      const badgeYRaw = Math.min(anchor.titleY - 25 - hudLift, Math.min(primaryY, sideY) - 24 - titleGap);
      const badgeY = Math.max(topLimit + 6, Math.min(badgeYRaw, bottomLimit - 30));

      // Knife 8: the floating name badge is a small forged plate (iron card
      // face + hairline edge) with champagne title, matching the modal family.
      const palette = UiThemeTokens?.palette || {};
      ModalPlate.drawModalCard(this, badgeX, badgeY, badgeWidth, 24, {
        radius: UiThemeTokens?.radius?.panel || 6,
      });
      const titleMaxWidth = badgeWidth - renameWidth - 22;
      this.drawText(this.truncateText(title, titleMaxWidth, { size: 12, bold: true }), badgeX + 12 + titleMaxWidth / 2, badgeY + 12, {
        size: 12,
        bold: true,
        color: palette.champagneGoldBright,
        baseline: 'middle',
        align: 'center',
      });
      if (renameButton) {
        const renameX = badgeX + badgeWidth - renameWidth - 7;
        const renameY = badgeY + 4;
        this.drawText(this.t('world.site.action.rename'), renameX + renameWidth / 2, badgeY + 12, {
          size: 10,
          color: renameButton.disabled || !renameButton.action ? palette.textDisabled : palette.champagneGold,
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: renameX - 4, y: renameY - 4, width: renameWidth + 8, height: 24 }, this.getWorldCityCommandButtonAction(renameButton));
      }

      this.drawCircle(anchor.anchorX, anchor.anchorY - hudLift, Math.max(12, primarySize * 0.32), {
        fill: 'rgba(116, 211, 160, 0.08)',
        stroke: 'rgba(116, 211, 160, 0.42)',
        width: 2,
      });
      this.drawWorldCityCommandPrimaryButton(primary, primaryX, primaryY, primarySize);
      this.addHitTarget({ x: primaryX, y: primaryY, width: primarySize, height: primarySize }, this.getWorldCityCommandButtonAction(primary));

      sideButtons.forEach((button, index) => {
        const buttonY = sideY + index * (sideHeight + sideGap);
        this.drawWorldCityCommandSideButton(button, sideX, buttonY, sideWidth, sideHeight);
        this.addHitTarget({ x: sideX, y: buttonY, width: sideWidth, height: sideHeight }, this.getWorldCityCommandButtonAction(button));
      });
    }
  }

  global.WorldMapSiteOverlayRenderer = WorldMapSiteOverlayRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapSiteOverlayRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
