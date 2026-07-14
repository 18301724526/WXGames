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

  class TaskCanvasRenderer {
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
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    drawTextLines(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    wrapTextLimit(...args) { const surface = this.drawingSurface; return surface && typeof surface.wrapTextLimit === 'function' ? surface.wrapTextLimit(...args) : this.host?.wrapTextLimit?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    // Structured resources use the shared localized formatter. Other reward types keep
    // the server-projected display text because they cannot be represented as resources.
    formatTaskRewardText(task = {}) {
      const resources = task.reward?.resources;
      const resourceKeys = Object.entries(resources || {})
        .filter(([, value]) => Number(value) > 0)
        .map(([key]) => key);
      const onlyCanonicalResources = resourceKeys.length > 0 && resourceKeys.every(
        (key) => SharedRewardText?.RESOURCE_KEYS?.includes(key),
      );
      if (onlyCanonicalResources) {
        return SharedRewardText.formatResources(resources);
      }
      const rewardText = String(task.rewardText || '').trim();
      if (rewardText && rewardText.toLowerCase() !== 'none') return rewardText;
      if (SharedRewardText?.hasResources?.(resources)) {
        return SharedRewardText.formatResources(resources);
      }
      return this.t('task.reward.none');
    }

    // The task center uses the shared ModalPlate painter for consistent modal chrome.
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
        const buttonAction = claimable ? task.action : null;
        const showButton = claimable || completed;
        const buttonDisabled = !claimable;
        ModalPlate.drawModalCard(this, listX, itemY, listWidth, itemHeight, {
          tone: completed ? 'muted' : (claimable ? 'accent' : 'default'),
        });
        this.drawText(this.truncateText(task.title || this.t('task.fallback.title'), listWidth - 26, { size: 14, bold: true }), listX + 12, itemY + 10, {
          size: 14,
          bold: true,
          color: completed ? palette.textLabel : palette.textPrimary,
        });
        const desc = [task.description, task.progressText].filter(Boolean).join(' / ') || task.rewardText || '';
        this.drawTextLines(this.wrapTextLimit(desc, showButton ? listWidth - 104 : listWidth - 24, 2, { size: 11 }), listX + 12, itemY + 34, {
          size: 11,
          color: completed ? palette.textSecondary : palette.textLabel,
          lineHeight: 15,
        });
        this.drawText(this.truncateText(this.formatTaskRewardText(task), listWidth - buttonWidth - 34, { size: 12, bold: true }), listX + 12, itemY + 76, {
          size: 12,
          bold: true,
          color: claimable ? palette.champagneGoldBright : palette.accentJade,
        });
        if (showButton) {
          ModalPlate.drawModalButton(this, buttonX, buttonY, buttonWidth, buttonHeight, task.actionLabel || (completed ? this.t('task.action.completed') : this.t('task.action.claim')), {
            variant: claimable ? 'primary' : 'secondary',
            disabled: buttonDisabled,
            size: 12,
          });
          if (buttonAction) {
            this.addHitTarget(
              { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight },
              ClientCommandSemantics?.isCommandAction?.(buttonAction)
                ? { ...buttonAction, visualDisabled: buttonDisabled }
                : { ...buttonAction, disabled: buttonDisabled },
            );
          }
        }
      });
    }

  }

  global.TaskCanvasRenderer = TaskCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TaskCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
