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

  const SharedRewardText = (() => {
    if (global.RewardText) return global.RewardText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/RewardText');
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

  class GuideTaskCanvasRenderer {
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

    get presenter() {
      return this.host?.presenter;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    drawTextLines(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    wrapTextLimit(...args) { const surface = this.drawingSurface; return surface && typeof surface.wrapTextLimit === 'function' ? surface.wrapTextLimit(...args) : this.host?.wrapTextLimit?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    // Localize the reward from the structured reward.resources the server sends, rather
    // than the pre-baked English `task.rewardText` (e.g. "food+120 / knowledge+5" / "none").
    formatTaskRewardText(task = {}) {
      if (SharedRewardText) return SharedRewardText.formatResources(task.reward?.resources);
      return task.rewardText || this.t('task.reward.none');
    }

    renderGuideTasks(state = {}, startY = 0) {
      return startY;
    }

    renderTaskCenterButton(state = {}) {
      return undefined;
    }

    renderGuidebookButton(state = {}) {
      return undefined;
    }

    renderGuidebookPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildGuidebookViewState !== 'function') return;
      const view = this.presenter.buildGuidebookViewState(state, { activeTab: options.activeGuidebookTab });
      const layout = this.getLayout();
      const panelWidth = Math.min(372, layout.contentWidth - 10);
      const panelHeight = Math.min(510, Math.max(390, this.height - 210));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(76, (this.height - panelHeight) / 2 - 10);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeGuidebook' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(38, 51, 42, 0.99)'],
            [1, 'rgba(19, 20, 16, 0.99)'],
          ],
          'rgba(30, 36, 29, 0.99)',
        ),
        stroke: 'rgba(116, 211, 160, 0.28)',
        radius: 14,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText(view.title || this.t('guidebook.title'), x + 18, y + 18, { size: 18, bold: true, color: '#d5ffe8' });
      this.drawText(this.truncateText(view.subtitle || '', panelWidth - 76, { size: 12 }), x + 18, y + 44, {
        size: 12,
        color: '#9ccfaf',
      });
      this.drawButton(closeX, closeY, closeSize, closeSize, this.t('common.close.short'), { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeGuidebook' });

      const tabs = Array.isArray(view.categories) ? view.categories : [];
      const tabY = y + 74;
      const tabGap = 5;
      const tabWidth = Math.max(52, (panelWidth - 28 - tabGap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length));
      tabs.slice(0, 5).forEach((tab, index) => {
        const tabX = x + 14 + index * (tabWidth + tabGap);
        this.drawButton(tabX, tabY, tabWidth, 32, tab.label, {
          size: 11,
          bold: tab.isActive,
          active: tab.isActive,
          radius: 8,
        });
        this.addHitTarget({ x: tabX, y: tabY, width: tabWidth, height: 32 }, { type: 'switchGuidebookTab', tab: tab.id });
      });

      const contentX = x + 14;
      const contentY = tabY + 46;
      const contentWidth = panelWidth - 28;
      const contentHeight = y + panelHeight - contentY - 18;
      this.drawPanel(contentX, contentY, contentWidth, contentHeight, {
        fill: 'rgba(18, 24, 20, 0.64)',
        stroke: 'rgba(116, 211, 160, 0.16)',
        radius: 10,
      });

      const active = view.activeCategory || {};
      this.drawText(active.title || this.t('guidebook.planning.title'), contentX + 14, contentY + 16, {
        size: 15,
        bold: true,
        color: '#d5ffe8',
      });
      let cursorY = contentY + 46;
      const lines = Array.isArray(active.lines) ? active.lines : [];
      lines.slice(0, 4).forEach((line) => {
        const wrapped = this.wrapTextLimit(line, contentWidth - 28, 2, { size: 12 });
        this.drawTextLines(wrapped, contentX + 14, cursorY, {
          size: 12,
          color: '#c5d8c9',
          lineHeight: 17,
        });
        cursorY += wrapped.length * 17 + 10;
      });

      if (active.id === 'planning' && view.planning) {
        const planningY = Math.min(cursorY + 2, contentY + contentHeight - 96);
        const planningHeight = Math.max(76, contentY + contentHeight - planningY - 12);
        this.drawPanel(contentX + 12, planningY, contentWidth - 24, planningHeight, {
          fill: 'rgba(36, 50, 41, 0.72)',
          stroke: 'rgba(116, 211, 160, 0.18)',
          radius: 9,
        });
        this.drawText(this.t('guidebook.planning.geography', { terrain: view.planning.terrainLabel || this.t('home.planning.terrain.plains') }), contentX + 26, planningY + 16, {
          size: 12,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(this.t('guidebook.planning.statusLine', {
          habitability: view.planning.text.habitabilityStatus || this.t('home.planning.habitabilityStatus', { label: this.t('home.planning.habitability.stable') }),
          growth: view.planning.text.populationGrowthStatus || this.t('home.population.growth.steady'),
        }), contentX + 26, planningY + 36, {
          size: 12,
          bold: true,
          color: '#74d3a0',
        });
        this.drawTextLines(this.wrapTextLimit(view.planning.text.note, contentWidth - 52, 2, { size: 11 }), contentX + 26, planningY + 58, {
          size: 11,
          color: '#c5d8c9',
          lineHeight: 15,
        });
      }
    }

    // UI-REDO knife 8: forged-iron modal language via the shared ModalPlate
    // painter (plate/title bar/tab strip/cards/buttons all token-painted).
    // Layout, presenter reads and hit-target actions are unchanged.
    renderTaskCenterPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildTaskCenterViewState !== 'function') return;
      const view = this.presenter.buildTaskCenterViewState(state, { activeTab: options.activeTaskCenterTab });
      const palette = UiThemeTokens?.palette || {};
      const layout = this.getLayout();
      const panelWidth = Math.min(372, layout.contentWidth - 10);
      const panelHeight = Math.min(540, Math.max(390, this.height - 188));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 14);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeTaskCenter' });
      ModalPlate.drawModalMask(this);
      ModalPlate.drawModalPlate(this, x, y, panelWidth, panelHeight);
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const titleBar = ModalPlate.drawModalTitleBar(this, x, y, panelWidth, {
        title: this.t('task.center.title'),
        subtitle: this.t('task.center.claimableCount', { count: view.summary?.claimableCount || 0 }),
        withClose: true,
      });
      if (titleBar.closeRect) this.addHitTarget(titleBar.closeRect, { type: 'closeTaskCenter' });

      const tabs = Array.isArray(view.tabs) ? view.tabs : [];
      const tabY = y + 72;
      const tabRects = ModalPlate.drawModalTabStrip(this, x + 14, tabY, panelWidth - 28, tabs);
      tabRects.forEach((rect, index) => {
        this.addHitTarget(rect, { type: 'switchTaskCenterTab', tab: tabs[index].id });
      });

      const listX = x + 14;
      const listY = tabY + 48;
      const listWidth = panelWidth - 28;
      const listBottom = y + panelHeight - 18;
      const tasks = Array.isArray(view.activeCategory?.tasks) ? view.activeCategory.tasks : [];
      if (!tasks.length) {
        ModalPlate.drawModalCard(this, listX, listY, listWidth, listBottom - listY, { tone: 'muted' });
        this.drawText(view.activeCategory?.emptyText || this.t('task.empty.main'), listX + listWidth / 2, listY + 72, {
          size: 14,
          color: palette.textLabel,
          align: 'center',
        });
        return;
      }

      const itemGap = 10;
      const itemHeight = 104;
      tasks.slice(0, 4).forEach((task, index) => {
        const itemY = listY + index * (itemHeight + itemGap);
        if (itemY + itemHeight > listBottom) return;
        const claimable = task.status === 'claimable' && !task.claimed;
        const completed = task.status === 'completed';
        const buttonWidth = 78;
        const buttonHeight = 34;
        const buttonX = listX + listWidth - buttonWidth - 12;
        const buttonY = itemY + itemHeight - buttonHeight - 12;
        const buttonAction = task.action || (
          claimable
            ? { type: 'claimTaskReward', taskId: task.id, category: task.category || view.activeTab }
            : { type: 'goToGuideTaskTarget', taskId: task.id, target: task.target }
        );
        const buttonDisabled = completed || (!claimable && !task.target && buttonAction.type !== 'goToGuideTaskTarget');
        ModalPlate.drawModalCard(this, listX, itemY, listWidth, itemHeight, {
          tone: completed ? 'muted' : (claimable ? 'accent' : 'default'),
        });
        this.drawText(this.truncateText(task.title || this.t('task.fallback.title'), listWidth - 26, { size: 14, bold: true }), listX + 12, itemY + 10, {
          size: 14,
          bold: true,
          color: completed ? palette.textLabel : palette.textPrimary,
        });
        const desc = task.description || task.rewardText || '';
        this.drawTextLines(this.wrapTextLimit(desc, listWidth - 104, 2, { size: 11 }), listX + 12, itemY + 34, {
          size: 11,
          color: completed ? palette.textSecondary : palette.textLabel,
          lineHeight: 15,
        });
        this.drawText(this.truncateText(this.formatTaskRewardText(task), listWidth - buttonWidth - 34, { size: 12, bold: true }), listX + 12, itemY + 76, {
          size: 12,
          bold: true,
          color: claimable ? palette.champagneGoldBright : palette.accentJade,
        });
        ModalPlate.drawModalButton(this, buttonX, buttonY, buttonWidth, buttonHeight, task.actionLabel || (completed ? this.t('task.action.completed') : (claimable ? this.t('task.action.claim') : this.t('task.action.go'))), {
          variant: claimable ? 'primary' : 'secondary',
          disabled: buttonDisabled,
          size: 12,
        });
        this.addHitTarget(
          { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight },
          { ...buttonAction, disabled: buttonDisabled },
        );
      });
    }

  }

  global.GuideTaskCanvasRenderer = GuideTaskCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = GuideTaskCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
