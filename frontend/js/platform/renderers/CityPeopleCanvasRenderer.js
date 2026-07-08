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

  class CityPeopleCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get presenter() {
      return this.host?.presenter;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAsset === 'function' ? surface.drawAsset(...args) : this.host?.drawAsset?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawIconCard(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawIconCard === 'function' ? surface.drawIconCard(...args) : this.host?.drawIconCard?.(...args); }
    drawLine(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawLine === 'function' ? surface.drawLine(...args) : this.host?.drawLine?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
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
      ModalPlate.drawModalCard(this, x, y, width, panelHeight, { tone: 'accent' });
      this.drawIconCard(x + 14, y + 14, 38, 38, 'assets/art/icon-population-cutout.webp');
      this.drawText(view.text.title || this.t('home.population.title', {}), x + 62, y + 20, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText(view.text.subtitle || this.t('home.population.subtitle', {}), x + 62, y + 40, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      const policyButtonWidth = 58;
      const policyButtonHeight = 28;
      const policyButtonX = x + width - policyButtonWidth - 14;
      const policyButtonY = y + 18;
      ModalPlate.drawModalButton(this, policyButtonX, policyButtonY, policyButtonWidth, policyButtonHeight, this.t('home.population.policy', {}), {
        variant: 'primary',
        size: 12,
        bold: true,
        radius: 8,
      });
      this.addHitTarget(
        { x: policyButtonX, y: policyButtonY, width: policyButtonWidth, height: policyButtonHeight },
        { type: 'openCityManagement', tab: 'people', source: 'cityPeoplePolicyButton' },
      );
      this.drawLine(x + 16, y + 56, x + width - 16, y + 56, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });

      const stats = [
        { icon: 'assets/art/icon-population-cutout.webp', label: this.t('home.population.people', {}), value: String(view.text.total), color: '#74d3a0' },
        { icon: 'assets/art/icon-population-cutout.webp', label: this.t('home.population.unassigned', {}), value: String(view.text.unassigned), color: '#74d3a0' },
        { icon: 'assets/art/icon-happiness-cutout.webp', label: this.t('home.population.happiness', {}), value: `${state.happiness || 100}%`, color: '#f9ca24' },
      ];
      const statGap = 6;
      const statWidth = Math.floor((width - 28 - statGap * 2) / 3);
      stats.forEach((stat, index) => {
        const statX = x + 14 + index * (statWidth + statGap);
        const statY = y + 64;
        ModalPlate.drawModalCard(this, statX, statY, statWidth, 34, {
          tone: 'muted',
          radius: 7,
          fill: 'rgba(21, 19, 16, 0.66)',
          stroke: 'rgba(255, 226, 177, 0.12)',
        });
        this.drawAsset(stat.icon, statX + 8, statY + 8, 16, 16);
        this.drawText(stat.label, statX + 28, statY + 5, { size: 9, color: 'rgba(234, 234, 234, 0.62)' });
        this.drawText(stat.value, statX + 28, statY + 19, { size: 12, bold: true, color: stat.color });
      });

      const planning = view.planning || {};
      const planningY = y + 106;
      ModalPlate.drawModalCard(this, x + 7, planningY, width - 14, 42, {
        tone: 'muted',
        fill: 'rgba(24, 36, 29, 0.72)',
        stroke: 'rgba(116, 211, 160, 0.16)',
        radius: 8,
      });
      const terrainLabel = planning.terrainLabel || this.t('home.planning.terrain.plains', {});
      this.drawText(this.t('home.planning.geography', { terrain: terrainLabel }), x + 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#d5ffe8',
      });
      this.drawText(`${planning.text?.habitabilityStatus || this.t('home.planning.habitabilityStatus', { label: this.t('home.planning.habitability.stable', {}) })} \u00b7 ${planning.text?.populationGrowthStatus || this.t('home.population.growth.steady', {})}`, x + width - 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#74d3a0',
        align: 'right',
      });
      this.drawText(this.truncateText(planning.text?.note || this.t('home.planning.terrainHint', {}), width - 40, { size: 10 }), x + 20, planningY + 27, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.62)',
      });

      const jobs = view.jobs.filter((job) => job.visible);
      jobs.forEach((job, index) => {
        const rowY = y + 156 + index * (jobRowHeight + jobRowGap);
        const jobLabel = {
          farmer: this.t('home.job.farmer', {}),
          scholar: this.t('home.job.scholar', {}),
          craftsman: this.t('home.job.craftsman', {}),
        }[job.id] || job.id;
        const desc = {
          farmer: this.t('home.job.farmerDesc', {}),
          scholar: this.t('home.job.scholarDesc', {}),
          craftsman: this.t('home.job.craftsmanDesc', {}),
        }[job.id] || '';
        const icon = { farmer: 'assets/art/icon-farmer-cutout.webp', scholar: 'assets/art/icon-scholar-cutout.webp', craftsman: 'assets/art/icon-craftsman-cutout.webp' }[job.id];
        const jobPanelX = x + 7;
        const jobPanelRight = x + width - 7;
        const jobPanelInset = 8;
        ModalPlate.drawModalCard(this, jobPanelX, rowY, width - 14, jobRowHeight, {
          tone: job.count > 0 ? 'accent' : 'default',
          radius: 9,
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
        ModalPlate.drawModalButton(this, minusX, controlY, controlButtonWidth, 22, '-', { disabled: !job.canDecrease, size: 13, radius: 6 });
        ModalPlate.drawModalCard(this, countX, rowY + 9, 40, 24, {
          fill: 'rgba(11, 18, 14, 0.5)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          radius: 8,
        });
        this.drawText(job.count, countX + 20, rowY + 21, { size: 14, bold: true, color: '#74d3a0', baseline: 'middle', align: 'center' });
        ModalPlate.drawModalButton(this, plusX, controlY, controlButtonWidth, 22, '+', { disabled: !job.canIncrease, size: 13, radius: 6 });
        this.addHitTarget({ x: minusX, y: controlY, width: controlButtonWidth, height: 22 }, { type: 'assignJob', job: job.id, delta: -1, disabled: !job.canDecrease });
        this.addHitTarget({ x: plusX, y: controlY, width: controlButtonWidth, height: 22 }, { type: 'assignJob', job: job.id, delta: 1, disabled: !job.canIncrease });
      });
      return y + panelHeight + 12;
    }
  }

  global.CityPeopleCanvasRenderer = CityPeopleCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CityPeopleCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
