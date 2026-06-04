(function (global) {
  class HomeCanvasRenderer {
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
        if (typeof this.presenter?.formatRate === 'function') return this.presenter.formatRate(value);
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
      const cityView = this.presenter?.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      const advisorView = this.presenter?.buildAdvisorViewState ? this.presenter.buildAdvisorViewState(state.softGuide) : { hidden: true };
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
      this.drawText(state.currentEraName || '原始时代', x + barPaddingX + 36, statusTop + 13, { size: 14, bold: true, color: '#d78332', baseline: 'middle' });
      this.drawText(
        populationStatus || `人口：${populationScale}`,
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
      if (!advisorView.hidden) actionDefs.push({ label: '顾问', width: 62 });
      actionDefs.push({ label: '日志', width: 44 });
      actionDefs.push({ label: '设置', width: 44 });
      let cursor = x + width - barPaddingX;
      actionDefs.slice().reverse().forEach((action, index) => {
        cursor -= action.width;
        const actionY = statusTop + 1;
        const actionHeight = action.label === '顾问' ? statusHeight : 36;
        this.drawButton(cursor, actionY, action.width, actionHeight, action.label, { size: 12, bold: true, active: false, radius: 18 });
        if (action.label === '顾问') {
          this.drawText('谋', cursor + 14, statusTop + 20, { size: 12, bold: true, color: '#f0b45b', baseline: 'middle', align: 'center' });
          this.drawText('●', cursor + action.width - 10, statusTop + 20, { size: 7, color: '#74d3a0', baseline: 'middle', align: 'center' });
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openAdvisor' });
        } else if (action.label === '日志') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openLogs' });
        } else if (action.label === '设置') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openSettings' });
        }
        if (index < actionDefs.length - 1) cursor -= 6;
      });

      const resources = [
        { label: '木材', value: resourceView.text.woodValue, rate: resourceView.text.woodRate, icon: 'assets/art/icon-wood-cutout.webp' },
        { label: '铁矿', value: resourceView.text.ironValue, rate: resourceView.text.ironRate, icon: 'assets/art/icon-iron-cutout.webp' },
        { label: '石料', value: resourceView.text.stoneValue, rate: resourceView.text.stoneRate, icon: 'assets/art/icon-stone-cutout.webp' },
        { label: '粮食', value: resourceView.text.foodValue, rate: resourceView.text.foodRate, icon: 'assets/art/icon-food-cutout.webp' },
        { label: '知识', value: resourceView.text.knowledgeValue, rate: resourceView.text.knowledgeRate, icon: 'assets/art/icon-knowledge-cutout.webp' },
      ];
      const compactResources = resources.length >= 5;
      const gap = compactResources ? 4 : 8;
      const resourceX = x + barPaddingX;
      const resourceWidth = width - barPaddingX * 2;
      const itemWidth = (resourceWidth - gap * (resources.length - 1)) / resources.length;
      const itemY = resourceTop;
      resources.forEach((resource, index) => {
        const itemX = resourceX + index * (itemWidth + gap);
        const iconSize = compactResources ? 30 : 30;
        const valueSize = compactResources ? 11 : 16;
        const rateSize = compactResources ? 9 : 10;
        const labelSize = compactResources ? 8 : 10;
        const textWidth = Math.max(24, itemWidth - 2);
        if (compactResources) {
          const centerX = itemX + itemWidth / 2;
          const iconX = centerX - iconSize / 2;
          this.drawAsset(resource.icon, iconX, itemY, iconSize, iconSize);
          this.drawText(resource.label, centerX, itemY + 31, { size: labelSize, color: '#cbbd96', align: 'center' });
          this.drawText(this.truncateText(resource.value, textWidth, { size: valueSize, bold: true }), centerX, itemY + 41, {
            size: valueSize,
            bold: true,
            color: '#74d3a0',
            align: 'center',
          });
          this.drawText(this.truncateText(resource.rate, textWidth, { size: rateSize }), centerX, itemY + 52, {
            size: rateSize,
            color: '#a0a0a0',
            align: 'center',
          });
        } else {
          const iconX = itemX + 4;
          const valueX = itemX + 41;
          const wideTextWidth = Math.max(18, itemWidth - (valueX - itemX));
          this.drawAsset(resource.icon, iconX, itemY + 3, iconSize, iconSize);
          this.drawText(resource.label, iconX + iconSize / 2, itemY + 32, { size: labelSize, color: '#cbbd96', align: 'center' });
          this.drawText(this.truncateText(resource.value, wideTextWidth, { size: valueSize, bold: true }), valueX, itemY + 8, { size: valueSize, bold: true, color: '#74d3a0' });
          this.drawText(this.truncateText(resource.rate, wideTextWidth, { size: rateSize }), valueX, itemY + 29, { size: rateSize, color: '#a0a0a0' });
        }
        this.addHitTarget({ x: itemX, y: itemY, width: itemWidth, height: resourceHeight }, { type: 'openResourceDetails' });
      });

      if (!cityView.hidden) {
        const triggerWidth = Math.min(190, width * 0.64);
        const triggerX = x + Math.floor((width - triggerWidth) / 2) - 8;
        const triggerY = cityTop;
        this.drawPanel(triggerX, triggerY - 5, triggerWidth, 9, {
          fill: 'rgba(93, 63, 35, 0.88)',
          stroke: 'rgba(255, 225, 177, 0.14)',
          radius: 5,
        });
        this.drawButton(triggerX, triggerY, triggerWidth, cityHeight, cityView.activeCityName || '首都', { size: 13, bold: true, active: true, radius: 8 });
        this.drawText('▾', triggerX + triggerWidth - 18, triggerY + 17, {
          size: 14,
          bold: true,
          color: '#ffd994',
          baseline: 'middle',
          align: 'center',
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
          x, y, x, y + height,
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
        { label: '粮食', value: text.foodValue ?? '0', icon: 'assets/art/icon-food-cutout.webp' },
        { label: '木材', value: text.woodValue ?? '0', icon: 'assets/art/icon-wood-cutout.webp' },
        { label: '石料', value: text.stoneValue ?? '0', icon: 'assets/art/icon-stone-cutout.webp' },
        { label: '铁矿', value: text.ironValue ?? '0', icon: 'assets/art/icon-iron-cutout.webp' },
        { label: '知识', value: text.knowledgeValue ?? '0', icon: 'assets/art/icon-knowledge-cutout.webp' },
        { label: '人口', value: text.populationValue ?? this.presenter?.toDisplayPopulation?.(state.population?.total ?? state.totalPop) ?? '0', icon: 'assets/art/icon-population-cutout.webp' },
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

    renderPopulation(state = {}, startY = 84) {
      if (!this.presenter || typeof this.presenter.buildPopulationViewState !== 'function') return startY + 180;
      const view = this.presenter.buildPopulationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const y = startY;
      const panelHeight = 304;
      const jobRowHeight = 42;
      const jobRowGap = 8;
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x + width, y + panelHeight,
          [
            [0, 'rgba(61, 43, 28, 0.94)'],
            [1, 'rgba(24, 19, 14, 0.94)'],
          ],
          'rgba(43, 31, 22, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      this.drawLine(x + 10, y + 6, x + width - 10, y + 6, { color: 'rgba(240, 180, 91, 0.34)', width: 2 });
      this.drawLine(x + 10, y + panelHeight - 6, x + width - 10, y + panelHeight - 6, { color: 'rgba(240, 180, 91, 0.34)', width: 2 });
      this.drawIconCard(x + 14, y + 14, 38, 38, 'assets/art/icon-population-cutout.webp');
      this.drawText(view.text.title || '人才分配', x + 62, y + 20, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText(view.text.subtitle || '核心岗位', x + 62, y + 40, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      const policyButtonWidth = 58;
      const policyButtonHeight = 28;
      const policyButtonX = x + width - policyButtonWidth - 14;
      const policyButtonY = y + 18;
      this.drawButton(policyButtonX, policyButtonY, policyButtonWidth, policyButtonHeight, '方针', {
        size: 12,
        bold: true,
        active: true,
        radius: 8,
      });
      this.addHitTarget(
        { x: policyButtonX, y: policyButtonY, width: policyButtonWidth, height: policyButtonHeight },
        { type: 'openTalentPolicy' },
      );
      this.drawLine(x + 16, y + 56, x + width - 16, y + 56, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });

      const stats = [
        { icon: 'assets/art/icon-population-cutout.webp', label: '人才', value: String(view.text.total), color: '#74d3a0' },
        { icon: 'assets/art/icon-population-cutout.webp', label: '待分配人才', value: String(view.text.unassigned), color: '#74d3a0' },
        { icon: 'assets/art/icon-happiness-cutout.webp', label: '幸福度', value: `${state.happiness || 100}%`, color: '#f9ca24' },
      ];
      const statWidth = Math.floor((width - 28) / 3);
      stats.forEach((stat, index) => {
        const statX = x + 6 + index * statWidth;
        const statY = y + 64;
        this.drawAsset(stat.icon, statX + 8, statY + 7, 18, 18);
        if (index > 0) this.drawLine(statX, statY + 4, statX, statY + 36, { color: 'rgba(255, 226, 177, 0.1)' });
        this.drawText(stat.label, statX + 30, statY + 4, { size: 10, color: 'rgba(234, 234, 234, 0.64)' });
        this.drawText(stat.value, statX + 30, statY + 18, { size: 13, bold: true, color: stat.color });
      });

      const planning = view.planning || {};
      const planningY = y + 106;
      this.drawPanel(x + 7, planningY, width - 14, 42, {
        fill: 'rgba(24, 36, 29, 0.72)',
        stroke: 'rgba(116, 211, 160, 0.16)',
        radius: 8,
        inset: 'rgba(116, 211, 160, 0.05)',
      });
      this.drawText(`地理 ${planning.terrainLabel || '平原'}`, x + 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#d5ffe8',
      });
      this.drawText(`${planning.text?.habitabilityStatus || '宜居度平稳'} · ${planning.text?.populationGrowthStatus || '人口成长平稳'}`, x + width - 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#74d3a0',
        align: 'right',
      });
      this.drawText(this.truncateText(planning.text?.note || '保持建筑搭配，会让城市更稳定。', width - 40, { size: 10 }), x + 20, planningY + 27, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.62)',
      });

      const jobs = view.jobs.filter((job) => job.visible);
      jobs.forEach((job, index) => {
        const rowY = y + 156 + index * (jobRowHeight + jobRowGap);
        const jobLabel = { farmer: '农民', scholar: '学者', craftsman: '工匠' }[job.id] || job.id;
        const desc = { farmer: '生产食物', scholar: '口耳相传', craftsman: '钻研技艺' }[job.id] || '';
        const icon = { farmer: 'assets/art/icon-farmer-cutout.webp', scholar: 'assets/art/icon-scholar-cutout.webp', craftsman: 'assets/art/icon-craftsman-cutout.webp' }[job.id];
        const jobPanelX = x + 7;
        const jobPanelRight = x + width - 7;
        const jobPanelInset = 8;
        this.drawPanel(jobPanelX, rowY, width - 14, jobRowHeight, {
          fill: this.createGradient(
            jobPanelX, rowY, jobPanelRight, rowY + jobRowHeight,
            [
              [0, 'rgba(74, 52, 34, 0.86)'],
              [1, 'rgba(28, 22, 16, 0.84)'],
            ],
            'rgba(52, 38, 27, 0.84)',
          ),
          stroke: 'rgba(255, 226, 177, 0.14)',
          radius: 9,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        this.drawAsset(icon, jobPanelX + jobPanelInset, rowY + 9, 24, 24);
        this.drawText(jobLabel, x + 48, rowY + 8, { size: 13, bold: true, color: '#fff1cf' });
        this.drawText(desc, x + 48, rowY + 26, { size: 10, color: 'rgba(234, 234, 234, 0.58)' });
        const controlGap = 6;
        const controlButtonWidth = 22;
        const countWidth = 40;
        const controlGroupWidth = controlButtonWidth * 2 + countWidth + controlGap * 2;
        const minusX = jobPanelRight - jobPanelInset - controlGroupWidth;
        const countX = minusX + controlButtonWidth + controlGap;
        const plusX = countX + countWidth + controlGap;
        const controlY = rowY + 10;
        this.drawButton(minusX, controlY, controlButtonWidth, 22, '-', { disabled: !job.canDecrease, size: 13, radius: 6 });
        this.drawPanel(countX, rowY + 9, 40, 24, { fill: 'rgba(11, 18, 14, 0.38)', stroke: 'rgba(116, 211, 160, 0.24)', radius: 8, inset: 'rgba(116, 211, 160, 0.08)' });
        this.drawText(job.count, countX + 20, rowY + 21, { size: 14, bold: true, color: '#74d3a0', baseline: 'middle', align: 'center' });
        this.drawButton(plusX, controlY, controlButtonWidth, 22, '+', { disabled: !job.canIncrease, size: 13, radius: 6 });
        this.addHitTarget({ x: minusX, y: controlY, width: controlButtonWidth, height: 22 }, { type: 'assignJob', job: job.id, delta: -1, disabled: !job.canDecrease });
        this.addHitTarget({ x: plusX, y: controlY, width: controlButtonWidth, height: 22 }, { type: 'assignJob', job: job.id, delta: 1, disabled: !job.canIncrease });
      });
      return y + panelHeight + 12;
    }

    renderHomeFeatureGrid(state = {}, startY = 400, options = {}) {
      if (!this.presenter || typeof this.presenter.buildHomeFeatureViewState !== 'function') return startY;
      const view = this.presenter.buildHomeFeatureViewState(state);
      const entries = Array.isArray(view.entries) ? view.entries : [];
      if (!entries.length) return startY;
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const maxBottom = Number(options.maxBottom) || tabsTop - 8;
      const y = startY;
      const panelHeight = Math.min(146, Math.max(106, maxBottom - y));
      if (panelHeight < 86) return startY;
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x + width, y + panelHeight,
          [
            [0, 'rgba(44, 35, 25, 0.9)'],
            [1, 'rgba(20, 18, 14, 0.9)'],
          ],
          'rgba(32, 26, 20, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.07)',
      });
      this.drawText(view.title || '功能', x + 16, y + 12, { size: 14, bold: true, color: '#ffe6b5' });
      this.drawText(this.truncateText(view.subtitle || '', width - 92, { size: 10 }), x + 16, y + 32, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.58)',
      });

      const top = y + 52;
      const availableHeight = Math.max(42, y + panelHeight - top - 12);
      const visibleEntries = entries.slice(0, 4);
      const gap = 8;
      const itemWidth = Math.floor((width - 28 - gap * (visibleEntries.length - 1)) / Math.max(1, visibleEntries.length));
      const itemHeight = Math.min(76, availableHeight);
      visibleEntries.forEach((entry, index) => {
        const itemX = x + 14 + index * (itemWidth + gap);
        const itemY = top;
        const disabled = Boolean(entry.disabled || entry.action?.disabled);
        const active = Boolean(entry.badge);
        this.drawPanel(itemX, itemY, itemWidth, itemHeight, {
          fill: active ? 'rgba(76, 50, 30, 0.86)' : 'rgba(27, 23, 18, 0.72)',
          stroke: active ? 'rgba(240, 180, 91, 0.48)' : 'rgba(255, 226, 177, 0.12)',
          radius: 8,
          inset: active ? 'rgba(255, 231, 184, 0.1)' : 'rgba(255, 231, 184, 0.04)',
        });
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = disabled ? 0.45 : previousAlpha;
        const iconSize = 34;
        this.drawAsset(entry.icon, itemX + itemWidth / 2 - iconSize / 2, itemY + 7, iconSize, iconSize);
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        this.drawText(this.truncateText(entry.label || '', itemWidth - 12, { size: 12, bold: true }), itemX + itemWidth / 2, itemY + 44, {
          size: 12,
          bold: true,
          color: disabled ? '#777' : '#fff1cf',
          align: 'center',
        });
        this.drawText(this.truncateText(entry.statusText || '', itemWidth - 10, { size: 9 }), itemX + itemWidth / 2, itemY + 61, {
          size: 9,
          color: disabled ? '#666' : '#aeb0b8',
          align: 'center',
        });
        if (entry.badge > 0) {
          const badgeText = entry.badge > 9 ? '9+' : String(entry.badge);
          this.drawPanel(itemX + itemWidth - 23, itemY + 4, 22, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.16)',
            radius: 9,
          });
          this.drawText(badgeText, itemX + itemWidth - 12, itemY + 13, {
            size: 9,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: itemHeight },
          { ...(entry.action || { type: 'blockCanvasModal' }), disabled },
        );
      });
      return y + panelHeight + 12;
    }

  }

  global.HomeCanvasRenderer = HomeCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = HomeCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
