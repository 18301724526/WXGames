(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class TabBarCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get height() {
      return this.host?.height;
    }

    get presenter() {
      return this.host?.presenter;
    }

    t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    callDrawingSurface(method, args = []) {
      const surface = this.drawingSurface;
      if (surface && typeof surface[method] === 'function') {
        return surface[method](...args);
      }
      return this.host?.[method]?.(...args);
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

    drawPanel(...args) {
      return this.callDrawingSurface('drawPanel', args);
    }

    drawText(...args) {
      return this.callDrawingSurface('drawText', args);
    }

    getLayout(...args) {
      return this.callDrawingSurface('getLayout', args);
    }

    renderMapCommandDock(...args) {
      return this.host?.renderMapCommandDock?.(...args);
    }

    renderTabs(activeTab = 'resources', state = {}, options = {}) {
      if (options.isMapHome) {
        this.renderMapCommandDock(state, options);
        return;
      }
      const visualActiveTab = options.isMapHome ? 'resources' : activeTab;
      const tabs = [
        ['resources', this.t('tab.home', {}, '主页'), 'assets/art/icon-home-cutout.png'],
        ['tech', this.t('tab.tech', {}, '科技'), 'assets/art/icon-knowledge-cutout.webp'],
        ['events', this.t('tab.events', {}, '事件'), 'assets/art/icon-event-cutout.webp'],
        ['famousPersons', this.t('tab.famousPersons', {}, '名人'), 'assets/art/icon-scholar-cutout.webp'],
        ['civilization', this.t('tab.civilization', {}, '文明'), 'assets/art/icon-fire-cutout.webp'],
      ];
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const tabBarHeight = 58;
      const y = this.height - tabBarHeight;
      const eventBadge = this.presenter && typeof this.presenter.buildEventViewState === 'function'
        ? this.presenter.buildEventViewState(state).badge
        : { hidden: true };
      const lockById = new Map((options.tabLocks || []).map((item) => [item.id, item]));
      this.drawPanel(x, y, width, tabBarHeight, {
        fill: this.createGradient(
          x, y, x, y + tabBarHeight,
          [
            [0, 'rgba(47, 35, 25, 0.92)'],
            [1, 'rgba(23, 18, 13, 0.96)'],
          ],
          'rgba(34, 25, 18, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 0,
      });
      const tabWidth = width / tabs.length;
      tabs.forEach(([id, label, icon], index) => {
        const tabX = x + index * tabWidth;
        const isActionTab = id === 'famousPersons';
        const isActive = isActionTab ? Boolean(options.showFamousPersons) : id === visualActiveTab;
        const lock = lockById.get(id) || { disabled: false, isLocked: false };
        const isLocked = Boolean(lock.disabled || lock.isLocked);
        if (isActive && this.ctx) {
          this.ctx.fillStyle = this.createGradient(
            tabX + tabWidth * 0.2, y, tabX + tabWidth * 0.8, y,
            [
              [0, '#d78332'],
              [1, '#f0b45b'],
            ],
            '#d78332',
          );
          this.ctx.fillRect(tabX + tabWidth * 0.2, y, tabWidth * 0.6, 3);
        }
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = isLocked ? 0.38 : previousAlpha;
        this.drawAsset(icon, tabX + tabWidth / 2 - (isActive ? 16 : 14), y + 7 - (isActive ? 2 : 0), isActive ? 32 : 28, isActive ? 32 : 28);
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        this.drawText(label, tabX + tabWidth / 2, y + 38, {
          size: 10,
          color: isLocked ? '#666' : (isActive ? '#d78332' : '#a0a0a0'),
          align: 'center',
          bold: isActive,
        });
        if (id === 'events' && !eventBadge.hidden) {
          const badgeX = tabX + tabWidth / 2 + 10;
          const badgeY = y + 6;
          this.drawPanel(badgeX, badgeY, 18, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.16)',
            radius: 9,
          });
          this.drawText(eventBadge.text, badgeX + 9, badgeY + 9, {
            size: 10,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget(
          { x: tabX, y, width: tabWidth, height: tabBarHeight },
          isActionTab ? { type: 'openFamousPersons', disabled: isLocked } : { type: 'switchTab', tab: id, disabled: isLocked },
        );
      });
    }
  }

  global.TabBarCanvasRenderer = TabBarCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabBarCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
