(function (global) {
  class CivilizationCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get presenter() {
      return this.host?.presenter;
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

    drawLine(...args) {
      return this.callDrawingSurface('drawLine', args);
    }

    drawPanel(...args) {
      return this.callDrawingSurface('drawPanel', args);
    }

    drawProgressBar(...args) {
      return this.callDrawingSurface('drawProgressBar', args);
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

      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });

      this.drawPanel(overviewX, overviewY, overviewWidth, overviewHeight, {
        fill: this.createGradient(
          overviewX, overviewY, overviewX, overviewY + overviewHeight,
          [
            [0, 'rgba(54, 40, 28, 0.92)'],
            [1, 'rgba(28, 22, 17, 0.9)'],
          ],
          'rgba(44, 32, 23, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', overviewX + 12, overviewY + 12, 32, 32);
      this.drawText(view.text.eraName, overviewX + 50, overviewY + 19, { size: 16, bold: true, color: '#f0b45b' });
      this.drawText(view.text.civOverviewDay, overviewX + overviewWidth - 12, overviewY + 20, {
        size: 12,
        color: '#a0a0a0',
        align: 'right',
      });
      this.drawLine(overviewX + 12, overviewY + 54, overviewX + overviewWidth - 12, overviewY + 54, {
        color: 'rgba(255, 226, 177, 0.14)',
      });

      const stats = [
        { label: '人口', value: view.text.civOverviewPop, icon: 'assets/art/icon-population-cutout.webp' },
        { label: '建筑', value: view.text.civOverviewBuildings, icon: 'assets/art/building-house-cutout.png' },
        { label: '科技', value: view.text.civOverviewTechs, icon: 'assets/art/icon-science-cutout.webp' },
        { label: '幸福度', value: view.text.civOverviewHappiness, icon: 'assets/art/icon-happiness-cutout.webp' },
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
        this.drawPanel(statX, statY, statWidth, statHeight, {
          fill: 'rgba(63, 47, 32, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawAsset(item.icon, statX + 8, statY + (statHeight - statIconSize) / 2, statIconSize, statIconSize);
        this.drawText(item.label, statX + 34, statY + (compactOverview ? 3 : 6), { size: compactOverview ? 9 : 10, color: '#a0a0a0' });
        this.drawText(String(item.value), statX + 34, statY + (compactOverview ? 16 : 21), { size: compactOverview ? 12 : 14, bold: true, color: '#74d3a0' });
      });

      const eraX = x + 12;
      const eraWidth = width - 24;
      this.drawPanel(eraX, eraY, eraWidth, eraHeight, {
        fill: this.createGradient(
          eraX, eraY, eraX, eraY + eraHeight,
          [
            [0, 'rgba(54, 40, 28, 0.92)'],
            [1, 'rgba(28, 22, 17, 0.9)'],
          ],
          'rgba(44, 32, 23, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('时代进阶', eraX + 12, eraY + 14, '🔥');
      this.drawAsset('assets/art/icon-food-cutout.webp', eraX + eraWidth / 2 - 42, eraY + 40, 38, 38);
      this.drawText(this.truncateText(view.text.eraTargetName, eraWidth - 112, { size: 15, bold: true }), eraX + eraWidth / 2 + 4, eraY + 59, {
        size: 15,
        bold: true,
        color: '#f6e8c8',
        baseline: 'middle',
      });
      this.drawProgressBar(eraX + 12, eraY + 84, eraWidth - 24, 10, view.progress.percentage);
      this.drawText(this.truncateText(view.text.eraProgressText, eraWidth - 32, { size: 11 }), eraX + eraWidth / 2, eraY + 102, {
        size: 11,
        color: '#a0a0a0',
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
        this.drawPanel(itemX, itemY, conditionWidth, conditionRowHeight, {
          fill: 'rgba(63, 47, 32, 0.62)',
          stroke: condition.met ? 'rgba(78, 204, 163, 0.3)' : 'rgba(233, 69, 96, 0.15)',
          radius: 7,
        });
        this.drawText(condition.met ? '✓' : '•', itemX + 9, itemY + 11, {
          size: 12,
          bold: true,
          color: condition.met ? '#4ecca3' : '#d6b16e',
          baseline: 'middle',
        });
        this.drawText(this.truncateText(condition.name, conditionWidth - 52, { size: 11, bold: true }), itemX + 24, itemY + 6, {
          size: 11,
          bold: true,
          color: '#f6e8c8',
        });
        this.drawText(condition.progressText, itemX + conditionWidth - 8, itemY + 6, {
          size: 10,
          color: condition.met ? '#4ecca3' : '#a0a0a0',
          align: 'right',
        });
      });

      const advanceLabel = this.truncateText(view.text.advanceLabel, eraWidth - 52, { size: 13, bold: true });
      this.drawButton(eraX + 12, buttonY, eraWidth - 24, 32, advanceLabel, {
        disabled: view.advanceButton.disabled,
        bold: true,
        radius: 8,
        active: !view.advanceButton.disabled,
      });
      this.addHitTarget(
        { x: eraX + 12, y: buttonY, width: eraWidth - 24, height: 32 },
        { type: 'advanceEra', disabled: view.advanceButton.disabled },
      );

      if (featureHeight > 0) {
        this.drawPanel(x + 12, featureY, width - 24, featureHeight, {
          fill: 'rgba(37, 29, 21, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 10,
        });
        this.renderSectionHeader('当前时代特性', x + 26, featureY + 14, '✓');
        const featureLineLimit = Math.max(1, Math.floor((featureHeight - 44) / 18));
        const featureLines = this.wrapTextLimit(view.text.featureDescription, width - 58, featureLineLimit, { size: 12 });
        this.drawTextLines(featureLines, x + 26, featureY + 44, {
          size: 12,
          color: '#f6e8c8',
          lineHeight: 18,
        });
      }
    }

  }

  global.CivilizationCanvasRenderer = CivilizationCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CivilizationCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
