(function (global) {
  class MiniGameCanvasRenderer {
    constructor(options = {}) {
      this.runtime = options.runtime;
      this.presenter = options.presenter || null;
      this.canvas = options.canvas || this.runtime.createCanvas();
      this.ctx = this.canvas.getContext('2d');
      this.systemInfo = this.runtime.getSystemInfo();
      this.pixelRatio = this.systemInfo.pixelRatio || 1;
      this.width = this.systemInfo.windowWidth || this.canvas.width || 390;
      this.height = this.systemInfo.windowHeight || this.canvas.height || 844;
      this.canvas.width = Math.floor(this.width * this.pixelRatio);
      this.canvas.height = Math.floor(this.height * this.pixelRatio);
      this.hitTargets = [];
      if (this.ctx && typeof this.ctx.scale === 'function') this.ctx.scale(this.pixelRatio, this.pixelRatio);
    }

    setHitTargets(targets = []) {
      this.hitTargets = targets;
    }

    addHitTarget(rect, action) {
      if (!action || !rect) return;
      this.hitTargets.push({
        x: Number(rect.x) || 0,
        y: Number(rect.y) || 0,
        width: Number(rect.width) || 0,
        height: Number(rect.height) || 0,
        action,
      });
    }

    getHitTarget(point = {}) {
      const x = Number(point.x);
      const y = Number(point.y);
      for (let index = this.hitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.hitTargets[index];
        if (
          x >= target.x
          && x <= target.x + target.width
          && y >= target.y
          && y <= target.y + target.height
        ) {
          return target.action;
        }
      }
      return null;
    }

    clear() {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = '#10131f';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawText(text, x, y, options = {}) {
      this.ctx.fillStyle = options.color || '#f6e8c8';
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px sans-serif`;
      this.ctx.textBaseline = options.baseline || 'top';
      this.ctx.textAlign = options.align || 'left';
      this.ctx.fillText(String(text ?? ''), x, y);
      this.ctx.textAlign = 'left';
    }

    drawLine(x1, y1, x2, y2, options = {}) {
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    drawPanel(x, y, width, height, options = {}) {
      this.ctx.fillStyle = options.fill || 'rgba(24, 28, 43, 0.92)';
      this.ctx.strokeStyle = options.stroke || 'rgba(232, 199, 128, 0.42)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      const radius = options.radius || 8;
      if (typeof this.ctx.roundRect === 'function') {
        this.ctx.roundRect(x, y, width, height, radius);
      } else {
        this.ctx.rect(x, y, width, height);
      }
      this.ctx.fill();
      this.ctx.stroke();
    }

    drawButton(x, y, width, height, label, options = {}) {
      this.drawPanel(x, y, width, height, {
        fill: options.disabled ? 'rgba(55, 57, 68, 0.72)' : (options.active ? 'rgba(113, 86, 40, 0.95)' : 'rgba(34, 39, 56, 0.95)'),
        stroke: options.active ? 'rgba(255, 217, 138, 0.88)' : 'rgba(232, 199, 128, 0.36)',
        radius: options.radius || 8,
      });
      this.drawText(label, x + width / 2, y + height / 2, {
        color: options.disabled ? '#8d8f99' : '#f6e8c8',
        size: options.size || 13,
        bold: Boolean(options.bold),
        baseline: 'middle',
        align: 'center',
      });
    }

    drawProgressBar(x, y, width, height, percentage) {
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(8, 10, 18, 0.7)',
        stroke: 'rgba(232, 199, 128, 0.25)',
        radius: height / 2,
      });
      const fillWidth = Math.max(0, Math.min(width, width * (Number(percentage) || 0) / 100));
      if (fillWidth <= 0) return;
      this.ctx.fillStyle = '#d8a94f';
      this.ctx.beginPath();
      if (typeof this.ctx.roundRect === 'function') {
        this.ctx.roundRect(x, y, fillWidth, height, height / 2);
      } else {
        this.ctx.rect(x, y, fillWidth, height);
      }
      this.ctx.fill();
    }

    renderResourceStrip(state = {}) {
      const view = this.presenter.buildResourceViewState(state);
      this.drawPanel(12, 12, this.width - 24, 58);
      const resources = [
        ['食物', view.text.foodValue, view.text.foodRate],
        ['知识', view.text.knowledgeValue, view.text.knowledgeRate],
      ];
      if (view.hasWood) resources.push(['木材', view.text.woodValue, view.text.woodRate]);
      const columnWidth = (this.width - 48) / resources.length;
      resources.forEach(([label, value, rate], index) => {
        const x = 24 + index * columnWidth;
        this.drawText(label, x, 22, { color: '#cbbd96', size: 12 });
        this.drawText(value, x, 38, { color: '#fff3d6', size: 18, bold: true });
        this.drawText(rate, x + 72, 43, { color: '#9ed39a', size: 12 });
      });
    }

    renderPopulation(state = {}) {
      const view = this.presenter.buildPopulationViewState(state);
      this.drawPanel(12, 84, this.width - 24, 110);
      this.drawText(`人口 ${view.text.totalPop}/${view.text.maxPop}`, 24, 98, { size: 16, bold: true });
      this.drawText(`待分配 ${view.text.unassignedPop}`, 160, 100, { color: '#cbbd96', size: 14 });
      const jobs = view.jobs.filter((job) => job.visible);
      jobs.forEach((job, index) => {
        const x = 24 + index * 112;
        const label = { farmer: '农民', scholar: '学者', craftsman: '工匠' }[job.id] || job.id;
        this.drawText(label, x, 132, { color: '#cbbd96', size: 13 });
        this.drawButton(x, 150, 24, 24, '-', { disabled: !job.canDecrease, size: 16 });
        this.drawText(job.count, x + 42, 154, { color: '#fff3d6', size: 18, bold: true });
        this.drawButton(x + 70, 150, 24, 24, '+', { disabled: !job.canIncrease, size: 16 });
        this.addHitTarget({ x, y: 150, width: 24, height: 24 }, { type: 'assignJob', job: job.id, delta: -1, disabled: !job.canDecrease });
        this.addHitTarget({ x: x + 70, y: 150, width: 24, height: 24 }, { type: 'assignJob', job: job.id, delta: 1, disabled: !job.canIncrease });
      });
    }

    renderBuildings(state = {}) {
      const view = this.presenter.buildBuildingViewState(state, state.tutorial || {}, state.buildingDefinitions || {});
      this.drawPanel(12, 210, this.width - 24, 310);
      this.drawText('建造', 24, 224, { size: 18, bold: true });
      if (view.isEmpty) {
        this.drawText(view.emptyText, 24, 254, { color: '#cbbd96', size: 13 });
        return;
      }
      view.cards.slice(0, 4).forEach((card, index) => {
        const y = 254 + index * 62;
        this.drawPanel(24, y, this.width - 48, 50, { fill: 'rgba(16, 20, 32, 0.72)' });
        this.drawText(card.name, 38, y + 8, { size: 14, bold: true });
        this.drawText(`${card.levelText} ${card.effectText || card.descText || ''}`.trim(), 38, y + 28, { color: '#cbbd96', size: 12 });
        this.drawButton(this.width - 108, y + 10, 72, 30, card.button.label, { disabled: card.button.disabled, size: 12 });
        this.addHitTarget(
          { x: this.width - 108, y: y + 10, width: 72, height: 30 },
          { type: card.button.action === 'upgrade' ? 'upgradeBuilding' : 'buildBuilding', buildingId: card.id, disabled: card.button.disabled },
        );
      });
    }

    renderEvents(state = {}) {
      const view = this.presenter.buildEventViewState(state);
      this.drawPanel(12, 210, this.width - 24, 310);
      this.drawText(`事件 ${view.badge.hidden ? '' : view.badge.text}`, 24, 224, { size: 18, bold: true });
      if (view.pending.isEmpty) {
        this.drawText(view.pending.emptyText, 24, 254, { color: '#cbbd96', size: 13 });
        return;
      }
      view.pending.cards.slice(0, 3).forEach((card, index) => {
        const y = 254 + index * 76;
        this.drawPanel(24, y, this.width - 48, 64, { fill: 'rgba(16, 20, 32, 0.72)' });
        this.drawText(`${card.icon} ${card.title}`, 38, y + 8, { size: 14, bold: true });
        this.drawText(card.hint, 38, y + 32, { color: '#cbbd96', size: 12 });
        this.addHitTarget({ x: 24, y, width: this.width - 48, height: 64 }, { type: 'openEvent', eventId: card.id });
      });
    }

    renderCivilization(state = {}) {
      const view = this.presenter.buildCivilizationViewState(state, state.tutorial || {}, { canOpenCivilizationTab: true });
      this.drawPanel(12, 210, this.width - 24, 250);
      this.drawText(view.text.eraName, 24, 224, { size: 18, bold: true });
      this.drawText(`目标：${view.text.eraTargetName}`, 24, 254, { color: '#cbbd96', size: 13 });
      this.drawProgressBar(24, 284, this.width - 48, 12, view.progress.percentage);
      this.drawText(view.text.eraProgressText, 24, 304, { color: '#cbbd96', size: 12 });
      view.conditions.slice(0, 4).forEach((condition, index) => {
        this.drawText(`${condition.met ? '✓' : '·'} ${condition.name} ${condition.progressText}`, 24, 330 + index * 22, {
          color: condition.met ? '#9ed39a' : '#d6b16e',
          size: 13,
        });
      });
      this.drawButton(24, 420, this.width - 48, 34, view.text.advanceLabel, { disabled: view.advanceButton.disabled, bold: true });
      this.addHitTarget({ x: 24, y: 420, width: this.width - 48, height: 34 }, { type: 'advanceEra', disabled: view.advanceButton.disabled });
    }

    renderMilitary(state = {}) {
      const view = this.presenter.buildMilitaryViewState(state);
      const scout = this.presenter.buildScoutControlViewState(state);
      this.drawPanel(12, 210, this.width - 24, 310);
      this.drawText('军事', 24, 224, { size: 18, bold: true });
      this.drawText(`士兵 ${view.text.soldierCount}`, 24, 254, { size: 14, bold: true });
      this.drawText(`可用 ${view.text.availableSoldierCount} · 出征中 ${view.text.soldiersOnMission}`, 24, 278, { color: '#cbbd96', size: 12 });
      this.drawText(view.text.soldierTrainingText, 24, 306, { color: '#cbbd96', size: 12 });
      this.drawProgressBar(24, 328, this.width - 48, 10, parseFloat(view.training.progressWidth));
      this.drawLine(24, 358, this.width - 24, 358);
      this.drawText(scout.statusText, 24, 372, { color: '#cbbd96', size: 12 });
      scout.cells.filter((cell) => cell.type === 'button').slice(0, 8).forEach((cell, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const x = 24 + col * ((this.width - 48) / 4);
        const y = 404 + row * 42;
        const width = ((this.width - 64) / 4);
        this.drawButton(x, y, width, 32, `${cell.label} ${cell.actionText}`, { disabled: cell.disabled, size: 11 });
        this.addHitTarget({ x, y, width, height: 32 }, {
          type: cell.action === 'claim' ? 'claimScout' : 'scoutTerritory',
          value: cell.actionValue,
          disabled: cell.disabled || !cell.action,
        });
      });
    }

    renderMainPanel(state = {}, activeTab = 'resources') {
      if (activeTab === 'buildings') this.renderBuildings(state);
      else if (activeTab === 'events') this.renderEvents(state);
      else if (activeTab === 'civilization') this.renderCivilization(state);
      else if (activeTab === 'military') this.renderMilitary(state);
    }

    renderTabs(activeTab = 'resources') {
      const tabs = [
        ['resources', '资源'],
        ['buildings', '建造'],
        ['events', '事件'],
        ['civilization', '文明'],
        ['military', '军事'],
      ];
      const padding = 8;
      const tabWidth = (this.width - padding * 2) / tabs.length;
      const y = this.height - 54;
      tabs.forEach(([id, label], index) => {
        const x = padding + index * tabWidth;
        this.drawButton(x + 2, y, tabWidth - 4, 42, label, { active: id === activeTab, size: 12 });
        this.addHitTarget({ x, y, width: tabWidth, height: 48 }, { type: 'switchTab', tab: id });
      });
    }

    renderAdvisor(state = {}) {
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      if (view.hidden || !view.activeAdvisor) return;
      this.drawPanel(12, this.height - 120, this.width - 24, 52, { fill: 'rgba(42, 35, 24, 0.94)' });
      this.drawText('顾问', 24, this.height - 108, { color: '#ffd98a', size: 14, bold: true });
      this.drawText(view.activeAdvisor.message, 76, this.height - 106, { color: '#f6e8c8', size: 12 });
    }

    render(state = {}, options = {}) {
      const activeTab = options.activeTab || 'resources';
      this.setHitTargets([]);
      this.clear();
      this.renderResourceStrip(state);
      this.renderPopulation(state);
      this.renderMainPanel(state, activeTab);
      this.renderAdvisor(state);
      this.renderTabs(activeTab);
    }
  }

  global.MiniGameCanvasRenderer = MiniGameCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = MiniGameCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
