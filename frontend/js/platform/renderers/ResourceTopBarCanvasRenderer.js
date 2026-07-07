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

  // UI-REDO token single source (docs/design/ui-hud-reference/user-references/
  // layout-reference-v2.webp). All redesigned top-bar colors/metrics come from here.
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

  class ResourceTopBarCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get presenter() {
      return this.host?.presenter;
    }

    get width() {
      return Number(this.host?.width) || 0;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAsset === 'function' ? surface.drawAsset(...args) : this.host?.drawAsset?.(...args); }
    drawAssetClipped(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAssetClipped === 'function' ? surface.drawAssetClipped(...args) : this.host?.drawAssetClipped?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    measureTextWidth(...args) { const surface = this.drawingSurface; return surface && typeof surface.measureTextWidth === 'function' ? surface.measureTextWidth(...args) : this.host?.measureTextWidth?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    buildResourceViewState(state = {}) {
      if (typeof this.presenter?.buildResourceViewState === 'function') {
        return this.presenter.buildResourceViewState(state);
      }
      const resources = state.resources || {};
      const population = state.population || {};
      const formatAmount = (value) => {
        if (typeof this.presenter?.formatResourceAmount === 'function') return this.presenter.formatResourceAmount(value);
        const number = Number(value);
        return Number.isFinite(number) ? String(Math.floor(number)) : '0';
      };
      const formatRate = (value) => {
        if (typeof this.presenter?.formatRate === 'function') return this.presenter.formatRate(value);
        const number = Number(value) || 0;
        return `${number >= 0 ? '+' : ''}${number}/s`;
      };
      const populationTotal = Number(population.total ?? state.totalPop) || 0;
      const displayPopulation = typeof this.presenter?.toDisplayPopulation === 'function'
        ? this.presenter.toDisplayPopulation(populationTotal)
        : Math.floor(populationTotal) * 100;
      const foodNet = Object.prototype.hasOwnProperty.call(resources, 'foodNetPerSecond')
        ? Number(resources.foodNetPerSecond) || 0
        : Number(resources.foodPerSecond) || 0;
      return {
        text: {
          foodValue: formatAmount(resources.food),
          woodValue: formatAmount(resources.wood),
          ironValue: formatAmount(resources.iron ?? resources.metal),
          stoneValue: formatAmount(resources.stone),
          knowledgeValue: formatAmount(resources.knowledge),
          foodRate: formatRate(foodNet),
          woodRate: formatRate(resources.woodPerSecond),
          ironRate: formatRate(resources.ironPerSecond ?? resources.metalPerSecond),
          stoneRate: formatRate(resources.stonePerSecond),
          knowledgeRate: formatRate(resources.knowledgePerSecond),
          populationValue: displayPopulation,
          populationStatus: '',
        },
      };
    }

    renderTopBar(state = {}, options = {}) {
      if (options.isMapHome) return this.renderMapHomeTopBar(state, options);
      const layout = this.getLayout();
      const resourceView = this.buildResourceViewState(state);
      const cityView = this.presenter?.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      const advisorView = this.presenter?.buildAdvisorViewState ? this.presenter.buildAdvisorViewState(state.softGuide) : { hidden: true };
      const populationScale = resourceView.text?.populationValue
        ?? (typeof this.presenter?.toDisplayPopulation === 'function'
          ? this.presenter.toDisplayPopulation(state.population?.total ?? state.totalPop)
          : (Number(state.population?.total ?? state.totalPop) || 0) * 100);
      const populationStatus = resourceView.text?.populationStatus || '';
      const x = layout.contentX;
      const y = 12;
      const width = layout.contentWidth;
      const barPaddingX = 14;
      const statusTop = y + 10;
      const statusHeight = 38;
      const resourceTop = y + 56;
      const resourceHeight = 62;
      const cityTop = y + 126;
      const cityHeight = 32;
      const barHeight = cityView.hidden ? 128 : 166;

      this.drawPanel(x, y, width, barHeight, {
        fill: this.createGradient(
          x, y, x + width, y + barHeight,
          [
            [0, 'rgba(73, 50, 31, 0.9)'],
            [1, 'rgba(34, 25, 18, 0.9)'],
          ],
          'rgba(48, 35, 25, 0.92)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 12,
        inset: 'rgba(255, 232, 185, 0.12)',
      });

      this.drawAsset('assets/art/icon-fire-cutout.webp', x + barPaddingX, statusTop + 4, 30, 30);
      this.drawText(state.currentEraName || this.t('shell.topBar.eraFallback'), x + barPaddingX + 36, statusTop + 13, { size: 14, bold: true, color: '#d78332', baseline: 'middle' });
      this.drawText(
        populationStatus || this.t('shell.topBar.population', { population: populationScale }),
        x + barPaddingX + 36,
        statusTop + 31,
        {
          size: populationStatus ? 9 : 10,
          bold: Boolean(populationStatus),
          color: populationStatus ? '#ffd98a' : 'rgba(234, 234, 234, 0.72)',
          baseline: 'middle',
        },
      );

      const actionDefs = [];
      if (!advisorView.hidden) actionDefs.push({ id: 'advisor', label: this.t('shell.topBar.advisor'), width: 62 });
      actionDefs.push({ id: 'logs', label: this.t('shell.topBar.logs'), width: 44 });
      actionDefs.push({ id: 'settings', label: this.t('shell.topBar.settings'), width: 44 });
      let cursor = x + width - barPaddingX;
      actionDefs.slice().reverse().forEach((action, index) => {
        cursor -= action.width;
        const actionY = statusTop + 1;
        const actionHeight = action.id === 'advisor' ? statusHeight : 36;
        this.drawButton(cursor, actionY, action.width, actionHeight, action.label, { size: 12, bold: true, active: false, radius: 18 });
        if (action.id === 'advisor') {
          this.drawText(this.t('shell.advisor.icon'), cursor + 14, statusTop + 20, { size: 12, bold: true, color: '#f0b45b', baseline: 'middle', align: 'center' });
          this.drawText('●', cursor + action.width - 10, statusTop + 20, { size: 7, color: '#74d3a0', baseline: 'middle', align: 'center' });
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openAdvisor' });
        } else if (action.id === 'logs') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openLogs' });
        } else if (action.id === 'settings') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openSettings' });
        }
        if (index < actionDefs.length - 1) cursor -= 6;
      });

      const resources = [
        { label: this.t('resource.wood'), value: resourceView.text.woodValue, rate: resourceView.text.woodRate, icon: 'assets/art/icon-wood-cutout.webp' },
        { label: this.t('resource.iron'), value: resourceView.text.ironValue, rate: resourceView.text.ironRate, icon: 'assets/art/icon-iron-cutout.webp' },
        { label: this.t('resource.stone'), value: resourceView.text.stoneValue, rate: resourceView.text.stoneRate, icon: 'assets/art/icon-stone-cutout.webp' },
        { label: this.t('resource.food'), value: resourceView.text.foodValue, rate: resourceView.text.foodRate, icon: 'assets/art/icon-food-cutout.webp' },
        { label: this.t('resource.knowledge'), value: resourceView.text.knowledgeValue, rate: resourceView.text.knowledgeRate, icon: 'assets/art/icon-knowledge-cutout.webp' },
      ];
      const compactResources = resources.length >= 5;
      const gap = compactResources ? 4 : 8;
      const resourceX = x + barPaddingX;
      const resourceWidth = width - barPaddingX * 2;
      const itemWidth = (resourceWidth - gap * (resources.length - 1)) / resources.length;
      const itemY = resourceTop;
      resources.forEach((resource, index) => {
        const itemX = resourceX + index * (itemWidth + gap);
        const iconSize = compactResources ? 30 : 30;
        const valueSize = compactResources ? 11 : 16;
        const rateSize = compactResources ? 9 : 10;
        const labelSize = compactResources ? 8 : 10;
        const textWidth = Math.max(24, itemWidth - 2);
        if (compactResources) {
          const centerX = itemX + itemWidth / 2;
          const iconX = centerX - iconSize / 2;
          this.drawAsset(resource.icon, iconX, itemY, iconSize, iconSize);
          this.drawText(resource.label, centerX, itemY + 31, { size: labelSize, color: '#cbbd96', align: 'center' });
          this.drawText(this.truncateText(resource.value, textWidth, { size: valueSize, bold: true }), centerX, itemY + 41, {
            size: valueSize,
            bold: true,
            color: '#74d3a0',
            align: 'center',
          });
          this.drawText(this.truncateText(resource.rate, textWidth, { size: rateSize }), centerX, itemY + 52, {
            size: rateSize,
            color: '#a0a0a0',
            align: 'center',
          });
        } else {
          const iconX = itemX + 4;
          const valueX = itemX + 41;
          const wideTextWidth = Math.max(18, itemWidth - (valueX - itemX));
          this.drawAsset(resource.icon, iconX, itemY + 3, iconSize, iconSize);
          this.drawText(resource.label, iconX + iconSize / 2, itemY + 32, { size: labelSize, color: '#cbbd96', align: 'center' });
          this.drawText(this.truncateText(resource.value, wideTextWidth, { size: valueSize, bold: true }), valueX, itemY + 8, { size: valueSize, bold: true, color: '#74d3a0' });
          this.drawText(this.truncateText(resource.rate, wideTextWidth, { size: rateSize }), valueX, itemY + 29, { size: rateSize, color: '#a0a0a0' });
        }
        this.addHitTarget({ x: itemX, y: itemY, width: itemWidth, height: resourceHeight }, { type: 'openResourceDetails' });
      });

      if (!cityView.hidden) {
        const triggerWidth = Math.min(190, width * 0.64);
        const triggerX = x + Math.floor((width - triggerWidth) / 2) - 8;
        const triggerY = cityTop;
        this.drawPanel(triggerX, triggerY - 5, triggerWidth, 9, {
          fill: 'rgba(93, 63, 35, 0.88)',
          stroke: 'rgba(255, 225, 177, 0.14)',
          radius: 5,
        });
        this.drawButton(triggerX, triggerY, triggerWidth, cityHeight, cityView.activeCityName || this.t('shell.city.capital'), { size: 13, bold: true, active: true, radius: 8 });
        this.drawText('▾', triggerX + triggerWidth - 18, triggerY + 17, {
          size: 14,
          bold: true,
          color: '#ffd994',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: triggerX, y: triggerY, width: triggerWidth, height: cityHeight }, { type: 'openCitySwitcher' });
      }

      return y + barHeight + 12;
    }

    resolveMapHomeFps(options = {}) {
      const fps = Number(options.fps ?? this.host?.surfaceState?.fpsLastPaintedValue ?? this.host?.surfaceState?.currentFps);
      return Number.isFinite(fps) && fps > 0 ? Math.round(fps) : 0;
    }

    resolveMapHomeLatencyMs(state = {}, options = {}) {
      const network = options.network || state.networkState || this.host?.networkState || {};
      const value = network.latencyMs
        ?? network.pingMs
        ?? network.roundTripMs
        ?? network.rttMs
        ?? network.lastLatencyMs;
      const latency = Number(value);
      return Number.isFinite(latency) && latency >= 0 ? Math.round(latency) : null;
    }

    resolveMapHomeServerTimeMs(state = {}, options = {}) {
      const candidates = [
        options.serverNowMs,
        this.host?.serverNowMs,
        this.host?.surfaceState?.serverNowMs,
        options.epochNowMs,
        this.host?.epochNowMs,
        this.host?.surfaceState?.epochNowMs,
        state.serverNowMs,
        state.epochNowMs,
        options.network?.serverTime,
        state.networkState?.serverTime,
        state.serverTime,
      ];
      for (let index = 0; index < candidates.length; index += 1) {
        const value = candidates[index];
        const parsed = value instanceof Date ? value.getTime() : (typeof value === 'string' ? Date.parse(value) : Number(value));
        if (Number.isFinite(parsed)) return parsed;
      }
      return Date.now();
    }

    formatMapHomeClock(ms = Date.now()) {
      const date = new Date(ms);
      if (Number.isNaN(date.getTime())) return '--:--:--';
      return [
        String(date.getHours()).padStart(2, '0'),
        String(date.getMinutes()).padStart(2, '0'),
        String(date.getSeconds()).padStart(2, '0'),
      ].join(':');
    }

    // UI-REDO: 9-slice iron plate sliced from layout-reference-v2 (see
    // hud-plate-top.pipeline-meta.json). Falls back to a token gradient panel
    // until the asset is loaded (or when the runtime lacks drawAssetClipped).
    drawMapHomeTopBarPlate(x, y, width, height) {
      const topBar = UiThemeTokens?.topBar || {};
      const slice = topBar.plateSlice || {};
      const assetPath = topBar.plateAssetPath || '';
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
        const palette = UiThemeTokens?.palette || {};
        this.drawPanel(x, y, width, height, {
          fill: this.createGradient(
            x, y, x, y + height,
            [
              [0, palette.plateIronTop],
              [1, palette.plateIronBottom],
            ],
            palette.plateIronBottom,
          ),
          stroke: palette.plateFrameLine,
          radius: UiThemeTokens?.radius?.panel || 6,
          inset: UiThemeTokens?.hairline?.insetHighlight,
        });
      }
      return drewAsset;
    }

    drawMapHomeTopBarHairline(x, y0, y1) {
      if (!this.ctx || typeof this.ctx.fillRect !== 'function') return;
      const hairline = UiThemeTokens?.hairline || {};
      this.ctx.fillStyle = hairline.dividerOnIron;
      this.ctx.fillRect(x, y0, hairline.widthPx || 1, Math.max(0, y1 - y0));
    }

    // Standard HUD stats block (FPS/latency/clock) per the approved reference — the
    // caller decides visibility: CanvasModeOwnershipRuntime.buildRendererPanelFacts
    // supplies panel.showTopBarDebugStats (always on since 2026-07-08); this renderer
    // only consumes the pre-decided boolean and never reads mode facts itself.
    renderMapHomeTopBarDebugStats(state = {}, options = {}, layout = {}) {
      const palette = UiThemeTokens?.palette || {};
      const numericFont = UiThemeTokens?.fontFamily?.numeric;
      const size = UiThemeTokens?.typeScale?.caption || 9;
      const fps = this.resolveMapHomeFps(options);
      const latencyMs = this.resolveMapHomeLatencyMs(state, options);
      const clockText = this.formatMapHomeClock(this.resolveMapHomeServerTimeMs(state, options));
      const x = Number(layout.x) || 0;
      const rowY = Array.isArray(layout.rowY) ? layout.rowY : [12, 28, 44];
      this.drawText(fps ? `FPS ${fps}` : 'FPS --', x, rowY[0], {
        size,
        bold: true,
        color: palette.debugFpsGreen,
        baseline: 'middle',
        fontFamily: numericFont,
      });
      this.drawAsset('assets/art/ui-hud/hud-icon-signal.png', x, rowY[1] - 6, 12, 12);
      this.drawText(latencyMs === null ? '--ms' : `${latencyMs}ms`, x + 16, rowY[1], {
        size,
        color: palette.debugLatencyText,
        baseline: 'middle',
        fontFamily: numericFont,
      });
      this.drawText(clockText, x, rowY[2], {
        size,
        color: palette.textSecondary,
        baseline: 'middle',
        fontFamily: numericFont,
      });
    }

    // UI-REDO map-home top bar: iron plate + 6 resource slots in the approved
    // order 粮食/木材/石料/铁矿/知识/人口, hairline slot dividers, mono digits.
    // All colors/metrics come from UiThemeTokens (single source).
    renderMapHomeTopBar(state = {}, options = {}) {
      const layout = this.getLayout();
      const topBar = UiThemeTokens?.topBar || {};
      const palette = UiThemeTokens?.palette || {};
      const typeScale = UiThemeTokens?.typeScale || {};
      const spacing = UiThemeTokens?.spacing || {};
      const numericFont = UiThemeTokens?.fontFamily?.numeric;
      const resourceView = this.buildResourceViewState(state);
      const text = resourceView.text || {};
      const width = this.width;
      const height = Number(topBar.height) || 64;
      const plateX = Number(topBar.plateMarginX) || 4;
      const plateY = Number(topBar.plateMarginTop) || 4;
      const plateWidth = Math.max(0, width - plateX * 2);
      const plateHeight = Number(topBar.plateHeight) || 56;
      this.drawMapHomeTopBarPlate(plateX, plateY, plateWidth, plateHeight);

      const contentPaddingX = Number(topBar.contentPaddingX) || 12;
      const contentLeft = Math.max(plateX + contentPaddingX, Number(layout.contentX) || 0);
      const contentRight = Math.min(plateX + plateWidth - contentPaddingX, Number(layout.contentRight) || width);
      const dividerTop = plateY + 10;
      const dividerBottom = plateY + plateHeight - 10;

      let resourcesLeft = contentLeft;
      if (options.showTopBarDebugStats === true) {
        const debugWidth = Number(topBar.debugBlockWidth) || 66;
        this.renderMapHomeTopBarDebugStats(state, options, {
          x: contentLeft,
          rowY: [plateY + 12, plateY + 28, plateY + 44],
        });
        const dividerX = contentLeft + debugWidth + (spacing.sm || 6);
        this.drawMapHomeTopBarHairline(dividerX, dividerTop, dividerBottom);
        resourcesLeft = dividerX + (spacing.lg || 12);
      }

      const resources = [
        { label: this.t('resource.food'), value: text.foodValue ?? '0', icon: 'assets/art/ui-hud/hud-resource-food.png' },
        { label: this.t('resource.wood'), value: text.woodValue ?? '0', icon: 'assets/art/ui-hud/hud-resource-wood.png' },
        { label: this.t('resource.stone'), value: text.stoneValue ?? '0', icon: 'assets/art/ui-hud/hud-resource-stone.png' },
        { label: this.t('resource.iron'), value: text.ironValue ?? '0', icon: 'assets/art/ui-hud/hud-resource-iron.png' },
        { label: this.t('resource.knowledge'), value: text.knowledgeValue ?? '0', icon: 'assets/art/ui-hud/hud-resource-knowledge.png' },
        { label: this.t('resource.population'), value: text.populationValue ?? this.presenter?.toDisplayPopulation?.(state.population?.total ?? state.totalPop) ?? '0', icon: 'assets/art/ui-hud/hud-resource-population.png' },
      ];
      const slotCount = resources.length;
      const resourcesWidth = Math.max(0, contentRight - resourcesLeft);
      const slotWidth = slotCount ? resourcesWidth / slotCount : 0;
      const iconSize = Number(topBar.iconSize) || 18;
      const labelIconGap = Number(topBar.labelIconGap) || 4;
      const labelSize = typeScale.label || 10;
      const valueSize = typeScale.value || 14;
      const labelRowCenterY = plateY + 17;
      const valueTop = plateY + 30;
      resources.forEach((resource, index) => {
        const slotX = resourcesLeft + index * slotWidth;
        const centerX = slotX + slotWidth / 2;
        if (index > 0) this.drawMapHomeTopBarHairline(Math.round(slotX), dividerTop, dividerBottom);
        const label = this.truncateText(
          resource.label,
          Math.max(16, slotWidth - iconSize - labelIconGap - 8),
          { size: labelSize, bold: true },
        );
        const measured = Number(this.measureTextWidth(label, { size: labelSize, bold: true }));
        const labelWidth = Number.isFinite(measured) && measured > 0
          ? measured
          : String(label).length * labelSize;
        const groupWidth = iconSize + labelIconGap + labelWidth;
        const iconX = centerX - groupWidth / 2;
        this.drawAsset(resource.icon, iconX, labelRowCenterY - iconSize / 2, iconSize, iconSize);
        this.drawText(label, iconX + iconSize + labelIconGap, labelRowCenterY, {
          size: labelSize,
          bold: true,
          color: palette.textLabel,
          baseline: 'middle',
        });
        const value = this.truncateText(
          String(resource.value ?? '0'),
          Math.max(20, slotWidth - 8),
          { size: valueSize, bold: true, fontFamily: numericFont },
        );
        this.drawText(value, centerX, valueTop, {
          size: valueSize,
          bold: true,
          color: palette.textPrimary,
          align: 'center',
          fontFamily: numericFont,
        });
        this.addHitTarget({ x: slotX, y: plateY, width: slotWidth, height: plateHeight }, { type: 'openResourceDetails' });
      });
      return height;
    }

  }

  global.ResourceTopBarCanvasRenderer = ResourceTopBarCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = ResourceTopBarCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
