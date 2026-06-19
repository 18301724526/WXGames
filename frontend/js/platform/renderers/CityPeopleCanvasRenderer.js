(function (global) {
  class CityPeopleCanvasRenderer {
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

    drawIconCard(...args) {
      return this.callDrawingSurface('drawIconCard', args);
    }

    drawLine(...args) {
      return this.callDrawingSurface('drawLine', args);
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

    truncateText(...args) {
      return this.callDrawingSurface('truncateText', args);
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
      this.drawText(view.text.title || '\u4eba\u624d\u5206\u914d', x + 62, y + 20, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText(view.text.subtitle || '\u6838\u5fc3\u5c97\u4f4d', x + 62, y + 40, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      const policyButtonWidth = 58;
      const policyButtonHeight = 28;
      const policyButtonX = x + width - policyButtonWidth - 14;
      const policyButtonY = y + 18;
      this.drawButton(policyButtonX, policyButtonY, policyButtonWidth, policyButtonHeight, '\u65b9\u9488', {
        size: 12,
        bold: true,
        active: true,
        radius: 8,
      });
      this.addHitTarget(
        { x: policyButtonX, y: policyButtonY, width: policyButtonWidth, height: policyButtonHeight },
        { type: 'openCityManagement', tab: 'people', source: 'cityPeoplePolicyButton' },
      );
      this.drawLine(x + 16, y + 56, x + width - 16, y + 56, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });

      const stats = [
        { icon: 'assets/art/icon-population-cutout.webp', label: '\u4eba\u624d', value: String(view.text.total), color: '#74d3a0' },
        { icon: 'assets/art/icon-population-cutout.webp', label: '\u5f85\u5206\u914d\u4eba\u624d', value: String(view.text.unassigned), color: '#74d3a0' },
        { icon: 'assets/art/icon-happiness-cutout.webp', label: '\u5e78\u798f\u5ea6', value: `${state.happiness || 100}%`, color: '#f9ca24' },
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
      this.drawText(`\u5730\u7406 ${planning.terrainLabel || '\u5e73\u539f'}`, x + 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#d5ffe8',
      });
      this.drawText(`${planning.text?.habitabilityStatus || '\u5b9c\u5c45\u5ea6\u5e73\u7a33'} \u00b7 ${planning.text?.populationGrowthStatus || '\u4eba\u53e3\u6210\u957f\u5e73\u7a33'}`, x + width - 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#74d3a0',
        align: 'right',
      });
      this.drawText(this.truncateText(planning.text?.note || '\u4fdd\u6301\u5efa\u7b51\u642d\u914d\uff0c\u4f1a\u8ba9\u57ce\u5e02\u66f4\u7a33\u5b9a\u3002', width - 40, { size: 10 }), x + 20, planningY + 27, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.62)',
      });

      const jobs = view.jobs.filter((job) => job.visible);
      jobs.forEach((job, index) => {
        const rowY = y + 156 + index * (jobRowHeight + jobRowGap);
        const jobLabel = { farmer: '\u519c\u6c11', scholar: '\u5b66\u8005', craftsman: '\u5de5\u5320' }[job.id] || job.id;
        const desc = { farmer: '\u751f\u4ea7\u98df\u7269', scholar: '\u7814\u7a76\u77e5\u8bc6', craftsman: '\u94bb\u7814\u5de5\u827a' }[job.id] || '';
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
  }

  global.CityPeopleCanvasRenderer = CityPeopleCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CityPeopleCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
