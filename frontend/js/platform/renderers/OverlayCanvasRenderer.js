(function (global) {
  class OverlayCanvasRenderer {
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

    get ctx() {
      return this.host?.ctx;
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

    drawPanel(...args) {
      return this.callDrawingSurface('drawPanel', args);
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

    getNow(...args) {
      return this.callDrawingSurface('getNow', args);
    }

    measureTextWidth(...args) {
      return this.callDrawingSurface('measureTextWidth', args);
    }

    truncateText(...args) {
      return this.callDrawingSurface('truncateText', args);
    }

    wrapTextLimit(...args) {
      return this.callDrawingSurface('wrapTextLimit', args);
    }

    buildResourceViewState(state = {}) {
      if (typeof this.presenter?.buildResourceViewState === 'function') {
        return this.presenter.buildResourceViewState(state);
      }
      const resources = state.resources || {};
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
      const formatNegativeRate = (value) => {
        if (typeof this.presenter?.formatNegativeRate === 'function') return this.presenter.formatNegativeRate(value);
        const number = Math.abs(Number(value) || 0);
        return `-${number}/s`;
      };
      const foodNet = Object.prototype.hasOwnProperty.call(resources, 'foodNetPerSecond')
        ? Number(resources.foodNetPerSecond) || 0
        : Number(resources.foodPerSecond) || 0;
      const food = formatAmount(resources.food);
      const wood = formatAmount(resources.wood);
      const iron = formatAmount(resources.iron ?? resources.metal);
      const stone = formatAmount(resources.stone);
      const knowledge = formatAmount(resources.knowledge);
      return {
        text: {
          foodDetailValue: food,
          woodDetailValue: wood,
          ironDetailValue: iron,
          stoneDetailValue: stone,
          knowledgeDetailValue: knowledge,
          foodOutputRate: formatRate(resources.foodOutputPerSecond),
          foodConsumptionRate: formatNegativeRate(resources.foodConsumptionPerSecond),
          foodNetRate: formatRate(foodNet),
          woodDetailRate: formatRate(resources.woodPerSecond),
          ironDetailRate: formatRate(resources.ironPerSecond ?? resources.metalPerSecond),
          stoneDetailRate: formatRate(resources.stonePerSecond),
          knowledgeDetailRate: formatRate(resources.knowledgePerSecond),
        },
      };
    }

    renderNamingModal(naming = {}) {
      if (!naming || !naming.visible || !naming.view) return;
      const view = naming.view || {};
      const inputValue = String(naming.inputValue || '');
      const isSubmitting = Boolean(naming.submitting);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeNaming' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.54)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const panelHeight = 286;
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
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeNaming' });

      const iconSize = 58;
      const iconX = x + panelWidth / 2 - iconSize / 2;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawText('城', x + panelWidth / 2, iconY + iconSize / 2, {
        size: 22,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });

      this.drawText(this.truncateText(view.title || '命名', panelWidth - 84, { size: 17, bold: true }), x + panelWidth / 2, y + 98, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageLines = this.wrapTextLimit(view.message || '', panelWidth - 48, 2, { size: 13 });
      this.drawTextLines(messageLines, x + 24, y + 128, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 17,
      });

      const inputX = x + 18;
      const inputY = y + 174;
      const inputWidth = panelWidth - 36;
      const inputHeight = 42;
      this.drawPanel(inputX, inputY, inputWidth, inputHeight, {
        fill: 'rgba(23, 18, 13, 0.56)',
        stroke: 'rgba(116, 211, 160, 0.24)',
        radius: 9,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      const displayValue = inputValue || view.placeholder || '请输入名称';
      this.drawText(this.truncateText(displayValue, inputWidth - 24, { size: 14 }), inputX + 12, inputY + 21, {
        size: 14,
        color: inputValue ? '#f6e8c8' : 'rgba(234, 234, 234, 0.48)',
        baseline: 'middle',
      });
      this.addHitTarget({ x: inputX, y: inputY, width: inputWidth, height: inputHeight }, { type: 'requestNamingInput' });

      const buttonY = y + panelHeight - 52;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const cancelX = x + 18;
      const submitX = cancelX + buttonWidth + buttonGap;
      this.drawButton(cancelX, buttonY, buttonWidth, 36, '取消', { size: 13, radius: 9 });
      this.drawButton(submitX, buttonY, buttonWidth, 36, isSubmitting ? '提交中' : '确定', {
        size: 13,
        bold: true,
        radius: 9,
        active: true,
        disabled: isSubmitting || !inputValue.trim(),
      });
      this.addHitTarget({ x: cancelX, y: buttonY, width: buttonWidth, height: 36 }, { type: 'closeNaming' });
      this.addHitTarget(
        { x: submitX, y: buttonY, width: buttonWidth, height: 36 },
        { type: 'submitNaming', disabled: isSubmitting || !inputValue.trim() },
      );
    }

    renderFloatingTexts(effects = []) {
      if (!Array.isArray(effects) || !effects.length) return;
      const layout = this.getLayout();
      const centerX = layout.contentX + layout.contentWidth / 2;
      effects.slice(0, 4).forEach((effect, index) => {
        const progress = Math.max(0, Math.min(1, Number(effect.progress) || 0));
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Math.max(0, 1 - progress);
        const y = 128 - progress * 58 - index * 22;
        const text = this.truncateText(effect.text || '', layout.contentWidth - 52, { size: 15, bold: true });
        const textWidth = Math.min(layout.contentWidth - 36, Math.max(96, this.measureTextWidth(text, { size: 15, bold: true }) + 28));
        this.drawPanel(centerX - textWidth / 2, y - 8, textWidth, 30, {
          fill: 'rgba(16, 20, 14, 0.62)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          radius: 15,
          inset: 'rgba(116, 211, 160, 0.08)',
        });
        this.drawText(text, centerX, y + 7, {
          size: 15,
          bold: true,
          color: effect.color || '#74d3a0',
          baseline: 'middle',
          align: 'center',
        });
        if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      });
    }

    drawRewardParticle(cx, cy, radius, angle, progress, index) {
      if (!this.ctx) return;
      const distance = radius * (0.44 + progress * 0.36 + (index % 3) * 0.04);
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      const size = 2 + (index % 4);
      this.ctx.fillStyle = index % 2 ? 'rgba(255, 245, 190, 0.86)' : 'rgba(247, 215, 116, 0.78)';
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    renderRewardReveal(reveal = null) {
      if (!reveal || !this.ctx) return;
      const now = this.getNow();
      const startedAt = Number(reveal.createdAt) || now;
      const progress = Math.max(0, Math.min(1, (now - startedAt) / 900));
      const pulse = 0.5 + Math.sin(now / 180) * 0.5;
      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 22);
      const panelHeight = 254;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(96, (this.height - panelHeight) / 2 - 14);
      const cx = x + panelWidth / 2;
      const glowY = y + 72;

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeRewardReveal' });

      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      this.ctx.globalAlpha = 0.78;
      this.ctx.fillStyle = this.createGradient(
        cx - 86, glowY - 86, cx + 86, glowY + 86,
        [
          [0, 'rgba(255, 248, 189, 0.02)'],
          [0.5, `rgba(247, 215, 116, ${0.26 + pulse * 0.16})`],
          [1, 'rgba(255, 248, 189, 0.02)'],
        ],
        'rgba(247, 215, 116, 0.24)',
      );
      this.ctx.beginPath();
      this.ctx.arc(cx, glowY, 86 + pulse * 10, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = previousAlpha;

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(69, 48, 26, 0.99)'],
            [0.52, 'rgba(33, 26, 18, 0.99)'],
            [1, 'rgba(20, 18, 14, 0.99)'],
          ],
          'rgba(35, 28, 20, 0.99)',
        ),
        stroke: 'rgba(247, 215, 116, 0.52)',
        radius: 14,
        inset: 'rgba(255, 245, 190, 0.12)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const sweepWidth = 72;
      const sweepX = x - sweepWidth + (panelWidth + sweepWidth * 2) * progress;
      this.ctx.globalAlpha = 0.28;
      this.ctx.fillStyle = this.createGradient(
        sweepX, y, sweepX + sweepWidth, y,
        [
          [0, 'rgba(255, 255, 255, 0)'],
          [0.5, 'rgba(255, 255, 255, 0.82)'],
          [1, 'rgba(255, 255, 255, 0)'],
        ],
        'rgba(255, 255, 255, 0.28)',
      );
      this.ctx.fillRect(Math.max(x, sweepX), y + 1, Math.min(sweepWidth, x + panelWidth - sweepX), panelHeight - 2);
      this.ctx.globalAlpha = previousAlpha;

      for (let index = 0; index < 18; index += 1) {
        this.drawRewardParticle(cx, glowY, 94, (Math.PI * 2 * index) / 18 + now / 900, progress, index);
      }

      this.drawText(reveal.title || '获得奖励', cx, y + 30, {
        size: 20,
        bold: true,
        color: '#fff1cf',
        align: 'center',
      });
      this.drawText(reveal.subtitle || '', cx, y + 60, {
        size: 13,
        color: '#ffd98a',
        align: 'center',
      });

      const rewardText = reveal.rewardText || '';
      const rewardLines = this.wrapTextLimit(rewardText, panelWidth - 58, 3, { size: 15, bold: true });
      this.drawPanel(x + 22, y + 96, panelWidth - 44, 72, {
        fill: 'rgba(11, 18, 14, 0.42)',
        stroke: 'rgba(116, 211, 160, 0.28)',
        radius: 10,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      this.drawTextLines(rewardLines, x + 34, y + 111, {
        size: 15,
        bold: true,
        color: '#74d3a0',
        lineHeight: 22,
      });

      const buttonWidth = panelWidth - 44;
      const buttonY = y + panelHeight - 58;
      this.drawButton(x + 22, buttonY, buttonWidth, 40, '收下', {
        size: 14,
        bold: true,
        active: true,
        radius: 10,
      });
      this.addHitTarget({ x: x + 22, y: buttonY, width: buttonWidth, height: 40 }, { type: 'closeRewardReveal' });
    }

    renderResourceDetailsPanel(state = {}) {
      if (!this.presenter) return;
      const view = this.buildResourceViewState(state);
      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 24);
      const resourceCount = 5;
      const panelHeight = 92 + resourceCount * 86;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(76, (this.height - panelHeight) / 2 - 20);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeResourceDetails' });

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.97)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 12,
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      this.drawText('资源详情', x + panelWidth / 2, y + 22, {
        size: 16,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      const closeBtnSize = 28;
      const closeBtnX = x + panelWidth - closeBtnSize - 10;
      const closeBtnY = y + 10;
      this.drawButton(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, 'x', {
        size: 14,
        radius: 6,
      });
      this.addHitTarget({ x: closeBtnX, y: closeBtnY, width: closeBtnSize, height: closeBtnSize }, { type: 'closeResourceDetails' });

      const cards = [
        {
          label: '木材',
          icon: 'assets/art/icon-wood-cutout.webp',
          value: view.text.woodDetailValue,
          lines: [`产出 ${view.text.woodDetailRate}`],
        },
        {
          label: '铁矿',
          icon: 'assets/art/icon-iron-cutout.webp',
          value: view.text.ironDetailValue,
          lines: [`产出 ${view.text.ironDetailRate}`],
        },
        {
          label: '石料',
          icon: 'assets/art/icon-stone-cutout.webp',
          value: view.text.stoneDetailValue,
          lines: [`产出 ${view.text.stoneDetailRate}`],
        },
        {
          label: '粮食',
          icon: 'assets/art/icon-food-cutout.webp',
          value: view.text.foodDetailValue,
          lines: [
            `产出 ${view.text.foodOutputRate}`,
            `消耗 ${view.text.foodConsumptionRate}`,
            `净增长 ${view.text.foodNetRate}`,
          ],
        },
        {
          label: '知识',
          icon: 'assets/art/icon-knowledge-cutout.webp',
          value: view.text.knowledgeDetailValue,
          lines: [`产出 ${view.text.knowledgeDetailRate}`],
        },
      ];

      const cardX = x + 12;
      const cardWidth = panelWidth - 24;
      cards.forEach((card, index) => {
        const cardY = y + 56 + index * 86;
        this.drawPanel(cardX, cardY, cardWidth, 74, {
          fill: 'rgba(27, 22, 17, 0.74)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 10,
        });
        this.drawAsset(card.icon, cardX + 12, cardY + 19, 34, 34);
        this.drawText(card.label, cardX + 58, cardY + 12, { size: 13, bold: true, color: '#f6e8c8' });
        this.drawText(String(card.value), cardX + cardWidth - 12, cardY + 12, {
          size: 18,
          bold: true,
          color: '#74d3a0',
          align: 'right',
        });
        this.drawTextLines(card.lines, cardX + 58, cardY + 36, { size: 11, color: '#aeb0b8', lineHeight: 16 });
      });
    }
  }

  global.OverlayCanvasRenderer = OverlayCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
