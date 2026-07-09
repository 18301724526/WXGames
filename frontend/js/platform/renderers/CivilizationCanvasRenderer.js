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

  class CivilizationCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get presenter() {
      return this.host?.presenter;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAsset === 'function' ? surface.drawAsset(...args) : this.host?.drawAsset?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawLine(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawLine === 'function' ? surface.drawLine(...args) : this.host?.drawLine?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawProgressBar(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawProgressBar === 'function' ? surface.drawProgressBar(...args) : this.host?.drawProgressBar?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    drawTextLines(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    renderSectionHeader(...args) { const surface = this.drawingSurface; return surface && typeof surface.renderSectionHeader === 'function' ? surface.renderSectionHeader(...args) : this.host?.renderSectionHeader?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    wrapTextLimit(...args) { const surface = this.drawingSurface; return surface && typeof surface.wrapTextLimit === 'function' ? surface.wrapTextLimit(...args) : this.host?.wrapTextLimit?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    renderCivilization(state = {}, startY = 210, panelHeight = 420, options = {}) {
      if (!this.presenter || typeof this.presenter.buildCivilizationViewState !== 'function') return;
      const view = this.presenter.buildCivilizationViewState(
        state,
        options.tutorial || state.tutorial || {},
        { canOpenCivilizationTab: options.canOpenCivilizationTab !== false },
      );
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const panelBottom = startY + panelHeight;
      const compact = panelHeight < 430;
      const sectionGap = compact ? 8 : 10;
      const overviewX = x + 12;
      const overviewY = startY + 12;
      const overviewWidth = width - 24;
      const overviewHeight = panelHeight < 390 ? 128 : (panelHeight < 500 ? 136 : 148);
      const eraY = overviewY + overviewHeight + sectionGap;
      const innerBottom = panelBottom - 12;
      const availableAfterOverview = Math.max(0, innerBottom - eraY);
      const minEraHeight = compact ? 188 : 214;
      const canShowFeature = availableAfterOverview >= minEraHeight + sectionGap + 64;
      const eraHeight = canShowFeature
        ? Math.min(compact ? 244 : 300, Math.max(minEraHeight, Math.floor((availableAfterOverview - sectionGap) * 0.72)))
        : Math.max(168, availableAfterOverview);
      const featureY = eraY + eraHeight + sectionGap;
      const featureHeight = canShowFeature ? Math.max(58, innerBottom - featureY) : 0;

      // UI-REDO knife 8: forged-iron skin via the shared ModalPlate painter;
      // layout/presenter/hit targets unchanged.
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      ModalPlate.drawModalPlate(this, x, startY, width, panelHeight);

      ModalPlate.drawModalCard(this, overviewX, overviewY, overviewWidth, overviewHeight);
      this.drawAsset('assets/art/icon-fire-cutout.webp', overviewX + 12, overviewY + 12, 32, 32);
      this.drawText(view.text.eraName, overviewX + 50, overviewY + 19, {
        size: 16,
        bold: true,
        color: palette.champagneGoldBright,
        fontFamily: UiThemeTokens?.fontFamily?.display,
      });
      this.drawText(view.text.civOverviewDay, overviewX + overviewWidth - 12, overviewY + 20, {
        size: 12,
        color: palette.textSecondary,
        align: 'right',
      });
      this.drawLine(overviewX + 12, overviewY + 54, overviewX + overviewWidth - 12, overviewY + 54, {
        color: hairline.dividerOnIron,
      });

      const stats = [
        { label: this.t('civilization.stat.population', {}), value: view.text.civOverviewPop, icon: 'assets/art/icon-population-cutout.webp' },
        { label: this.t('civilization.stat.buildings', {}), value: view.text.civOverviewBuildings, icon: 'assets/art/building-house-cutout.png' },
        { label: this.t('civilization.stat.techs', {}), value: view.text.civOverviewTechs, icon: 'assets/art/icon-science-cutout.webp' },
        { label: this.t('civilization.stat.happiness', {}), value: view.text.civOverviewHappiness, icon: 'assets/art/icon-happiness-cutout.webp' },
      ];
      const compactOverview = overviewHeight < 140;
      const statGap = 8;
      const statLeft = overviewX + 12;
      const statRight = overviewX + overviewWidth - 12;
      const statWidth = Math.floor((statRight - statLeft - statGap) / 2);
      const statTop = overviewY + (compactOverview ? 58 : 62);
      const statBottom = overviewY + overviewHeight - 8;
      const statRowGap = compactOverview ? 5 : 7;
      const statHeight = Math.floor((statBottom - statTop - statRowGap) / 2);
      const statIconSize = compactOverview ? 20 : 26;
      stats.forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const statX = col === 0 ? statLeft : statRight - statWidth;
        const statY = row === 0 ? statTop : statBottom - statHeight;
        ModalPlate.drawModalCard(this, statX, statY, statWidth, statHeight, {
          tone: 'muted',
          radius: UiThemeTokens?.radius?.panel || 6,
        });
        this.drawAsset(item.icon, statX + 8, statY + (statHeight - statIconSize) / 2, statIconSize, statIconSize);
        this.drawText(item.label, statX + 34, statY + (compactOverview ? 3 : 6), { size: compactOverview ? 9 : 10, color: palette.textLabel });
        this.drawText(String(item.value), statX + 34, statY + (compactOverview ? 16 : 21), { size: compactOverview ? 12 : 14, bold: true, color: palette.accentJade });
      });

      const eraX = x + 12;
      const eraWidth = width - 24;
      ModalPlate.drawModalCard(this, eraX, eraY, eraWidth, eraHeight);
      this.renderSectionHeader(this.t('civilization.section.advance', {}), eraX + 12, eraY + 14, '🔥');
      this.drawAsset('assets/art/icon-food-cutout.webp', eraX + eraWidth / 2 - 42, eraY + 40, 38, 38);
      this.drawText(this.truncateText(view.text.eraTargetName, eraWidth - 112, { size: 15, bold: true }), eraX + eraWidth / 2 + 4, eraY + 59, {
        size: 15,
        bold: true,
        color: palette.textPrimary,
        baseline: 'middle',
      });
      ModalPlate.drawModalProgressBar(this, eraX + 12, eraY + 84, eraWidth - 24, 10, view.progress.percentage);
      this.drawText(this.truncateText(view.text.eraProgressText, eraWidth - 32, { size: 11 }), eraX + eraWidth / 2, eraY + 102, {
        size: 11,
        color: palette.textSecondary,
        align: 'center',
      });

      const conditions = view.conditions || [];
      const buttonY = eraY + eraHeight - 42;
      const conditionTop = eraY + 114;
      const conditionRowHeight = 22;
      const conditionRowGap = 5;
      const conditionRows = Math.max(
        0,
        Math.floor((buttonY - conditionTop - conditionRowHeight - 2) / (conditionRowHeight + conditionRowGap)) + 1,
      );
      const conditionWidth = Math.floor((eraWidth - 32) / 2);
      conditions.slice(0, Math.min(4, conditionRows * 2)).forEach((condition, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const itemX = eraX + 12 + col * (conditionWidth + 8);
        const itemY = conditionTop + row * (conditionRowHeight + conditionRowGap);
        // 达标勾 = 青玉描边+青玉勾;未达标 = 灰点+默认发丝边 (knife 8 spec).
        ModalPlate.drawModalCard(this, itemX, itemY, conditionWidth, conditionRowHeight, {
          tone: 'muted',
          radius: UiThemeTokens?.radius?.panel || 6,
          stroke: condition.met ? UiThemeTokens?.modal?.cardMetStroke : undefined,
        });
        this.drawText(condition.met ? '✓' : '•', itemX + 9, itemY + 11, {
          size: 12,
          bold: true,
          color: condition.met ? palette.accentJade : palette.textDisabled,
          baseline: 'middle',
        });
        this.drawText(this.truncateText(condition.name, conditionWidth - 52, { size: 11, bold: true }), itemX + 24, itemY + 6, {
          size: 11,
          bold: true,
          color: palette.textPrimary,
        });
        this.drawText(condition.progressText, itemX + conditionWidth - 8, itemY + 6, {
          size: 10,
          color: condition.met ? palette.accentJade : palette.textSecondary,
          align: 'right',
        });
      });

      const advanceLabel = this.truncateText(view.text.advanceLabel, eraWidth - 52, { size: 13, bold: true });
      ModalPlate.drawModalButton(this, eraX + 12, buttonY, eraWidth - 24, 32, advanceLabel, {
        variant: 'primary',
        disabled: view.advanceButton.disabled,
        size: 13,
      });
      this.addHitTarget(
        { x: eraX + 12, y: buttonY, width: eraWidth - 24, height: 32 },
        { type: 'advanceEra', visualDisabled: view.advanceButton.disabled },
      );

      if (featureHeight > 0) {
        ModalPlate.drawModalCard(this, x + 12, featureY, width - 24, featureHeight);
        this.renderSectionHeader(this.t('civilization.section.features', {}), x + 26, featureY + 14, '✓');
        const featureLineLimit = Math.max(1, Math.floor((featureHeight - 44) / 18));
        const featureLines = this.wrapTextLimit(view.text.featureDescription, width - 58, featureLineLimit, { size: 12 });
        this.drawTextLines(featureLines, x + 26, featureY + 44, {
          size: 12,
          color: palette.textPrimary,
          lineHeight: 18,
        });
      }
    }

  }

  global.CivilizationCanvasRenderer = CivilizationCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CivilizationCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
