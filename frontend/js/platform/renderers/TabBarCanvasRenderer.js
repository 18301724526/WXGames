(function (global) {
  class TabBarCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    renderTabs(activeTab = 'military', state = {}, options = {}) {
      if (options.isMapHome) {
        this.renderMapCommandDock(state, options);
        return;
      }
      const visualActiveTab = activeTab;
      const tabs = [
        ['military', '地图', 'assets/art/icon-soldier-cutout.webp'],
        ['tech', '科技', 'assets/art/icon-knowledge-cutout.webp'],
        ['events', '事件', 'assets/art/icon-event-cutout.webp'],
        ['famousPersons', '名人', 'assets/art/icon-scholar-cutout.webp'],
        ['civilization', '文明', 'assets/art/icon-fire-cutout.webp'],
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
