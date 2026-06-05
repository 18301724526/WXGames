(function (global) {
  class MapCommandCanvasRenderer {
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

    renderMapCommandDock(state = {}, options = {}) {
      const layout = this.getLayout();
      const x = 0;
      const width = this.width;
      const dockHeight = 64;
      const y = this.height - dockHeight;
      const activePanel = options.activeCommandPanel || '';
      if (this.ctx) {
        this.ctx.fillStyle = this.createGradient(
          x, y, x, y + dockHeight,
          [
            [0, 'rgba(44, 35, 25, 0.88)'],
            [1, 'rgba(18, 16, 13, 0.96)'],
          ],
          'rgba(30, 24, 18, 0.94)',
        );
        this.ctx.fillRect(x, y, width, dockHeight);
        this.ctx.fillStyle = 'rgba(255, 226, 177, 0.16)';
        this.ctx.fillRect(0, y, width, 1);
        this.ctx.fillStyle = 'rgba(255, 231, 184, 0.04)';
        this.ctx.fillRect(0, y + 1, width, 1);
      }
      const items = [
        { id: 'tech', label: '科技', icon: 'assets/art/icon-knowledge-cutout.webp', action: { type: 'openCommandPanel', panel: 'tech' } },
        { id: 'civilization', label: '文明', icon: 'assets/art/icon-fire-cutout.webp', action: { type: 'openCommandPanel', panel: 'civilization' } },
        { id: 'famousPersons', label: '名人', icon: 'assets/art/icon-scholar-cutout.webp', action: { type: 'openFamousPersons' } },
        { id: 'tasks', label: '任务', icon: 'assets/art/icon-event-cutout.webp', action: { type: 'openTaskCenter', tab: 'main', source: 'taskIcon' } },
        { id: 'settings', label: '设置', glyph: '⚙', action: { type: 'openSettings' } },
        { id: 'military', label: '军事', icon: 'assets/art/tech-military-cutout.png', action: { type: 'openCommandPanel', panel: 'military' } },
      ];
      const contentX = layout.contentX;
      const contentWidth = layout.contentWidth;
      const itemWidth = contentWidth / items.length;
      items.forEach((item, index) => {
        const itemX = contentX + index * itemWidth;
        const active = activePanel === item.id
          || (item.id === 'tasks' && options.showTaskCenter)
          || (item.id === 'famousPersons' && options.showFamousPersons)
          || (item.id === 'settings' && options.showSettings);
        if (active && this.ctx) {
          this.ctx.fillStyle = '#f0b45b';
          this.ctx.fillRect(itemX + itemWidth * 0.22, y, itemWidth * 0.56, 3);
        }
        const iconSize = active ? 30 : 26;
        const iconX = itemX + itemWidth / 2 - iconSize / 2;
        const iconY = y + 8 - (active ? 1 : 0);
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = item.disabled ? 0.38 : previousAlpha;
        if (!item.icon || !this.drawAsset(item.icon, iconX, iconY, iconSize, iconSize)) {
          this.drawText(item.glyph || item.label.slice(0, 1), itemX + itemWidth / 2, iconY + iconSize / 2, {
            size: item.glyph ? 18 : 14,
            bold: true,
            color: active ? '#ffe6b5' : '#cbbd96',
            baseline: 'middle',
            align: 'center',
          });
        }
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        this.drawText(this.truncateText(item.label, itemWidth - 4, { size: 10, bold: active }), itemX + itemWidth / 2, y + 43, {
          size: 10,
          bold: active,
          color: active ? '#f0b45b' : '#cbbd96',
          align: 'center',
        });
        this.addHitTarget({ x: itemX, y, width: itemWidth, height: dockHeight }, item.action);
      });
    }

    renderFloatingSubcityButton(state = {}, options = {}) {
      const { x, y, size } = this.getMapHomeFloatingButtonLayout(2);
      const active = Boolean(options.showSubcityList);
      this.drawPanel(x, y, size, size, {
        fill: active ? 'rgba(82, 58, 34, 0.94)' : 'rgba(34, 31, 25, 0.82)',
        stroke: active ? 'rgba(247, 215, 116, 0.56)' : 'rgba(255, 226, 177, 0.18)',
        radius: size / 2,
        inset: active ? 'rgba(255, 231, 184, 0.16)' : 'rgba(255, 231, 184, 0.06)',
      });
      this.drawText('分城', x + size / 2, y + 26, {
        size: 12,
        bold: true,
        color: active ? '#f0b45b' : '#aeb0b8',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openSubcityList' });
    }

    renderFloatingEventButton(state = {}, options = {}) {
      const { x, y, size } = this.getMapHomeFloatingButtonLayout(1);
      const active = options.activeCommandPanel === 'events';
      this.drawPanel(x, y, size, size, {
        fill: active ? 'rgba(82, 58, 34, 0.94)' : 'rgba(34, 31, 25, 0.82)',
        stroke: active ? 'rgba(247, 215, 116, 0.56)' : 'rgba(255, 226, 177, 0.18)',
        radius: size / 2,
        inset: active ? 'rgba(255, 231, 184, 0.16)' : 'rgba(255, 231, 184, 0.06)',
      });
      this.drawText('事件', x + size / 2, y + 26, {
        size: 12,
        bold: true,
        color: active ? '#f0b45b' : '#aeb0b8',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openCommandPanel', panel: 'events' });
    }

    renderMapCommandPanel(state = {}, options = {}) {
      const panel = options.activeCommandPanel || '';
      if (!panel) return;
      const layout = this.getLayout();
      const dockTop = this.height - 64;
      const top = Math.max(82, this.getTopBarBottom(state, { isMapHome: true }) + 8);
      const height = Math.max(220, dockTop - top - 12);
      const panelHeight = Math.min(height, panel === 'capital' ? 392 : 470);
      const y = dockTop - panelHeight - 10;
      const x = layout.contentX;
      const width = layout.contentWidth;
      const titleByPanel = {
        capital: '首都',
        buildings: '建设',
        military: '军事',
        tech: '科技',
        civilization: '文明',
        events: '事件',
      };
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCommandPanel', background: true });
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(50, 39, 27, 0.96)'],
            [1, 'rgba(19, 17, 13, 0.97)'],
          ],
          'rgba(34, 27, 20, 0.96)',
        ),
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x, y, width, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      const closeX = x + width - closeSize - 10;
      const closeY = y + 10;
      this.drawText(titleByPanel[panel] || '面板', x + 16, y + 16, { size: 17, bold: true, color: '#ffe6b5' });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeCommandPanel' });

      const contentTop = y + 50;
      const contentHeight = Math.max(120, panelHeight - 62);
      if (panel === 'capital') {
        const populationBottom = this.renderPopulation(state, contentTop);
        this.renderHomeFeatureGrid(state, populationBottom, { maxBottom: y + panelHeight - 10 });
      } else {
        const panelTab = panel === 'military' ? 'military' : panel;
        const renderState = panelTab === 'military'
          ? { ...state, militaryView: state.militaryView === 'world' ? 'army' : (state.militaryView || 'army') }
          : state;
        this.renderMainPanel(renderState, panelTab, contentTop, contentHeight, {
          ...options,
          activeBuildingCategory: options.activeBuildingCategory,
          buildingOffset: options.buildingOffset,
          buildingTransition: options.buildingTransition,
        });
      }
    }
  }

  global.MapCommandCanvasRenderer = MapCommandCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapCommandCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
