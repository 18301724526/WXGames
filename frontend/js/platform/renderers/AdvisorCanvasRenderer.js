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

  class AdvisorCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get width() {
      return this.host?.width;
    }

    get height() {
      return this.host?.height;
    }

    get bottomSafeArea() {
      return this.host?.bottomSafeArea;
    }

    get presenter() {
      return this.host?.presenter;
    }

    addHitTarget(...args) {
      const surface = this.drawingSurface;
      return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args);
    }

    createGradient(...args) {
      const surface = this.drawingSurface;
      return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args);
    }

    drawButton(...args) {
      const surface = this.drawingSurface;
      return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args);
    }

    drawPanel(...args) {
      const surface = this.drawingSurface;
      return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args);
    }

    drawText(...args) {
      const surface = this.drawingSurface;
      return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args);
    }

    drawTextLines(...args) {
      const surface = this.drawingSurface;
      return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args);
    }

    getLayout(...args) {
      const surface = this.drawingSurface;
      return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args);
    }

    wrapText(...args) {
      const surface = this.drawingSurface;
      return surface && typeof surface.wrapText === 'function' ? surface.wrapText(...args) : this.host?.wrapText?.(...args);
    }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    renderAdvisor(state = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      if (view.hidden || !view.activeAdvisor) return;
      const layout = this.getLayout();
      const width = layout.contentWidth;
      const x = layout.contentX;
      const y = this.height - 132 - this.bottomSafeArea;
      this.drawPanel(x, y, width, 44, {
        fill: 'rgba(42, 35, 24, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.24)',
        radius: 10,
      });
      this.drawText(this.t('shell.advisor.title'), x + 12, y + 13, { color: '#ffd98a', size: 14, bold: true });
      this.drawText(view.activeAdvisor.message, x + 64, y + 13, { color: '#f6e8c8', size: 12 });
    }

    getMapHomeFloatingButtonLayout(slot = 0) {
      const layout = this.getLayout();
      const size = 48;
      const dockTop = this.height - 64;
      const x = layout.contentRight - size - 8;
      const gap = 10;
      const y = Math.max(82, dockTop - (slot + 1) * size - 14 - slot * gap);
      return { x, y, size };
    }

    renderFloatingAdvisorButton(state = {}, _options = {}) {
      const { x, y, size } = this.getMapHomeFloatingButtonLayout(0);
      const view = this.presenter?.buildAdvisorViewState?.(state.softGuide) || { hidden: true };
      const hasAdvice = Boolean(!view.hidden && view.activeAdvisor);
      this.drawPanel(x, y, size, size, {
        fill: hasAdvice ? 'rgba(82, 58, 34, 0.94)' : 'rgba(34, 31, 25, 0.82)',
        stroke: hasAdvice ? 'rgba(247, 215, 116, 0.56)' : 'rgba(255, 226, 177, 0.18)',
        radius: size / 2,
        inset: hasAdvice ? 'rgba(255, 231, 184, 0.16)' : 'rgba(255, 231, 184, 0.06)',
      });
      if (hasAdvice) {
        this.drawPanel(x + size - 15, y + 5, 10, 10, {
          fill: '#74d3a0',
          stroke: 'rgba(18, 16, 13, 0.72)',
          radius: 5,
        });
      }
      this.drawText(this.t('shell.advisor.title'), x + size / 2, y + 26, {
        size: 12,
        bold: true,
        color: hasAdvice ? '#f0b45b' : '#aeb0b8',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openAdvisor' });
    }

    renderAdvisorPanel(state = {}) {
      if (!this.presenter || typeof this.presenter.buildAdvisorViewState !== 'function') return;
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      const hasAdvice = Boolean(!view.hidden && view.activeAdvisor);

      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 28);
      const panelHeight = 276;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(96, (this.height - panelHeight) / 2 - 18);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeAdvisor' });

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
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, this.t('common.close.short'), { size: 16, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeAdvisor' });

      const portraitSize = 64;
      const portraitX = x + panelWidth / 2 - portraitSize / 2;
      const portraitY = y + 24;
      this.drawPanel(portraitX, portraitY, portraitSize, portraitSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: portraitSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawText(this.t('shell.advisor.icon'), x + panelWidth / 2, portraitY + portraitSize / 2, {
        size: 24,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      this.drawText(this.t('shell.advisor.panelTitle'), x + panelWidth / 2, y + 102, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageX = x + 18;
      const messageY = y + 132;
      const messageWidth = panelWidth - 36;
      const messageHeight = 72;
      this.drawPanel(messageX, messageY, messageWidth, messageHeight, {
        fill: 'rgba(23, 18, 13, 0.42)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.04)',
      });
      const message = hasAdvice
        ? (view.text?.message || view.activeAdvisor.message)
        : this.t('shell.advisor.emptyMessage');
      const lines = this.wrapText(message, messageWidth - 24, { size: 13 })
        .slice(0, 3);
      this.drawTextLines(lines, messageX + 12, messageY + 13, {
        size: 13,
        color: '#f6e8c8',
        lineHeight: 18,
      });

      const buttonY = y + panelHeight - 52;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const goX = x + 18;
      const dismissX = goX + buttonWidth + buttonGap;
      this.drawButton(goX, buttonY, buttonWidth, 36, hasAdvice ? this.t('shell.advisor.goToTarget') : this.t('shell.advisor.noTarget'), {
        size: 13,
        bold: true,
        radius: 9,
        disabled: !hasAdvice || Boolean(view.goButton?.disabled),
        active: hasAdvice && !view.goButton?.disabled,
      });
      this.drawButton(dismissX, buttonY, buttonWidth, 36, this.t('shell.advisor.dismiss'), { size: 13, radius: 9 });
      this.addHitTarget(
        { x: goX, y: buttonY, width: buttonWidth, height: 36 },
        { type: 'goToAdvisorTarget', disabled: !hasAdvice || Boolean(view.goButton?.disabled) },
      );
      this.addHitTarget({ x: dismissX, y: buttonY, width: buttonWidth, height: 36 }, { type: 'closeAdvisor' });
    }
  }

  global.AdvisorCanvasRenderer = AdvisorCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvisorCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
