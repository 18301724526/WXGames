(function (global) {
  class ResourceTopBarCanvasRenderer {
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
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
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
      if (options.isMapHome) return this.renderMapHomeTopBar(state);
      const layout = this.getLayout();
      const resourceView = this.buildResourceViewState(state);
      const cityView = this.presenter?.buildCitySwitcherViewState
        ? this.presenter.buildCitySwitcherViewState(state)
        : { hidden: true };
      const advisorView = this.presenter?.buildAdvisorViewState
        ? this.presenter.buildAdvisorViewState(state.softGuide)
        : { hidden: true };
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
      this.drawText(state.currentEraName || '\u539f\u59cb\u65f6\u4ee3', x + barPaddingX + 36, statusTop + 13, {
        size: 14,
        bold: true,
        color: '#d78332',
        baseline: 'middle',
      });
      this.drawText(
        populationStatus || `\u4eba\u53e3: ${populationScale}`,
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
      if (!advisorView.hidden) actionDefs.push({ label: '\u987e\u95ee', width: 62 });
      actionDefs.push({ label: '\u65e5\u5fd7', width: 44 });
      actionDefs.push({ label: '\u8bbe\u7f6e', width: 44 });
      let cursor = x + width - barPaddingX;
      actionDefs.slice().reverse().forEach((action, index) => {
        cursor -= action.width;
        const actionY = statusTop + 1;
        const actionHeight = action.label === '\u987e\u95ee' ? statusHeight : 36;
        this.drawButton(cursor, actionY, action.width, actionHeight, action.label, {
          size: 12,
          bold: true,
          active: false,
          radius: 18,
        });
        if (action.label === '\u987e\u95ee') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openAdvisor' });
        } else if (action.label === '\u65e5\u5fd7') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openLogs' });
        } else if (action.label === '\u8bbe\u7f6e') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openSettings' });
        }
        if (index < actionDefs.length - 1) cursor -= 6;
      });

      const resources = [
        { label: '\u6728\u6750', value: resourceView.text.woodValue, rate: resourceView.text.woodRate, icon: 'assets/art/icon-wood-cutout.webp' },
        { label: '\u94c1\u77ff', value: resourceView.text.ironValue, rate: resourceView.text.ironRate, icon: 'assets/art/icon-iron-cutout.webp' },
        { label: '\u77f3\u6599', value: resourceView.text.stoneValue, rate: resourceView.text.stoneRate, icon: 'assets/art/icon-stone-cutout.webp' },
        { label: '\u7cae\u98df', value: resourceView.text.foodValue, rate: resourceView.text.foodRate, icon: 'assets/art/icon-food-cutout.webp' },
        { label: '\u77e5\u8bc6', value: resourceView.text.knowledgeValue, rate: resourceView.text.knowledgeRate, icon: 'assets/art/icon-knowledge-cutout.webp' },
      ];
      const gap = 4;
      const resourceX = x + barPaddingX;
      const resourceWidth = width - barPaddingX * 2;
      const itemWidth = (resourceWidth - gap * (resources.length - 1)) / resources.length;
      const itemY = resourceTop;
      resources.forEach((resource, index) => {
        const itemX = resourceX + index * (itemWidth + gap);
        const centerX = itemX + itemWidth / 2;
        const iconSize = 30;
        const textWidth = Math.max(24, itemWidth - 2);
        this.drawAsset(resource.icon, centerX - iconSize / 2, itemY, iconSize, iconSize);
        this.drawText(resource.label, centerX, itemY + 31, { size: 8, color: '#cbbd96', align: 'center' });
        this.drawText(this.truncateText(resource.value, textWidth, { size: 11, bold: true }), centerX, itemY + 41, {
          size: 11,
          bold: true,
          color: '#74d3a0',
          align: 'center',
        });
        this.drawText(this.truncateText(resource.rate, textWidth, { size: 9 }), centerX, itemY + 52, {
          size: 9,
          color: '#a0a0a0',
          align: 'center',
        });
        this.addHitTarget({ x: itemX, y: itemY, width: itemWidth, height: resourceHeight }, { type: 'openResourceDetails' });
      });

      if (!cityView.hidden) {
        const triggerWidth = Math.min(190, width * 0.64);
        const triggerX = x + Math.floor((width - triggerWidth) / 2) - 8;
        const triggerY = cityTop;
        this.drawButton(triggerX, triggerY, triggerWidth, cityHeight, cityView.activeCityName || '\u9996\u90fd', {
          size: 13,
          bold: true,
          active: true,
          radius: 8,
        });
        this.addHitTarget({ x: triggerX, y: triggerY, width: triggerWidth, height: cityHeight }, { type: 'openCitySwitcher' });
      }

      return y + barHeight + 12;
    }

    renderMapHomeTopBar(state = {}) {
      const layout = this.getLayout();
      const resourceView = this.buildResourceViewState(state);
      const text = resourceView.text || {};
      const x = 0;
      const y = 0;
      const width = this.width;
      const height = 72;
      if (this.ctx) {
        this.ctx.fillStyle = this.createGradient(
          x,
          y,
          x,
          y + height,
          [
            [0, 'rgba(46, 37, 25, 0.86)'],
            [1, 'rgba(19, 18, 14, 0.88)'],
          ],
          'rgba(32, 26, 19, 0.86)',
        );
        this.ctx.fillRect(x, y, width, height);
        this.ctx.fillStyle = 'rgba(255, 231, 184, 0.06)';
        this.ctx.fillRect(0, 0, width, 1);
        this.ctx.fillStyle = 'rgba(255, 226, 177, 0.16)';
        this.ctx.fillRect(0, height - 1, width, 1);
      }
      const resources = [
        { label: '\u7cae\u98df', value: text.foodValue ?? '0', icon: 'assets/art/icon-food-cutout.webp' },
        { label: '\u6728\u6750', value: text.woodValue ?? '0', icon: 'assets/art/icon-wood-cutout.webp' },
        { label: '\u77f3\u6599', value: text.stoneValue ?? '0', icon: 'assets/art/icon-stone-cutout.webp' },
        { label: '\u94c1\u77ff', value: text.ironValue ?? '0', icon: 'assets/art/icon-iron-cutout.webp' },
        { label: '\u77e5\u8bc6', value: text.knowledgeValue ?? '0', icon: 'assets/art/icon-knowledge-cutout.webp' },
        {
          label: '\u4eba\u53e3',
          value: text.populationValue ?? this.presenter?.toDisplayPopulation?.(state.population?.total ?? state.totalPop) ?? '0',
          icon: 'assets/art/icon-population-cutout.webp',
        },
      ];
      const contentX = layout.contentX;
      const contentWidth = layout.contentWidth;
      const gap = 3;
      const itemWidth = Math.max(42, Math.floor((contentWidth - 16 - gap * (resources.length - 1)) / resources.length));
      const itemY = y + 8;
      resources.forEach((resource, index) => {
        const itemX = contentX + 8 + index * (itemWidth + gap);
        const iconSize = 14;
        const centerX = itemX + itemWidth / 2;
        this.drawAsset(resource.icon, centerX - iconSize / 2, itemY + 5, iconSize, iconSize);
        this.drawText(resource.label, centerX, itemY + 23, {
          size: 8,
          bold: true,
          color: '#cbbd96',
          align: 'center',
        });
        this.drawText(this.truncateText(String(resource.value), itemWidth - 4, { size: 9, bold: true }), centerX, itemY + 40, {
          size: 9,
          bold: true,
          color: '#d5ffe8',
          align: 'center',
        });
        this.addHitTarget({ x: itemX, y: itemY, width: itemWidth, height: 42 }, { type: 'openResourceDetails' });
      });
      return 72;
    }
  }

  global.ResourceTopBarCanvasRenderer = ResourceTopBarCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = ResourceTopBarCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
