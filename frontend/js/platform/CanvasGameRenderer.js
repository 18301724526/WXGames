(function (global) {
  class CanvasGameRenderer {
    constructor(options = {}) {
      this.presenter = options.presenter || null;
      this.ctx = options.ctx || null;
      this.canvas = options.canvas || null;
      this.pixelRatio = options.pixelRatio || 1;
      this.width = options.width || 390;
      this.height = options.height || 844;
      this.maxContentWidth = options.maxContentWidth || 480;
      this.edgePadding = options.edgePadding || 12;
      this.bottomSafeArea = options.bottomSafeArea || 12;
      this.assetCache = new Map();
      this.assetsChangedHandler = null;
      this.hitTargets = [];
      if (this.ctx && typeof this.ctx.scale === 'function') this.ctx.scale(1, 1);
    }

    setPresenter(presenter) {
      this.presenter = presenter;
    }

    getLayout() {
      const contentWidth = Math.min(this.maxContentWidth, Math.max(300, this.width - this.edgePadding * 2));
      const contentX = Math.max(this.edgePadding, Math.floor((this.width - contentWidth) / 2));
      return {
        contentX,
        contentWidth,
        contentRight: contentX + contentWidth,
      };
    }

    createGradient(x0, y0, x1, y1, stops = [], fallback = '#000') {
      if (!this.ctx || typeof this.ctx.createLinearGradient !== 'function') return fallback;
      const gradient = this.ctx.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      return gradient;
    }

    roundRectPath(x, y, width, height, radius = 8) {
      if (!this.ctx) return;
      this.ctx.beginPath();
      if (typeof this.ctx.roundRect === 'function') {
        this.ctx.roundRect(x, y, width, height, radius);
      } else {
        this.ctx.rect(x, y, width, height);
      }
    }

    createImage(src) {
      return null;
    }

    getAsset(assetPath) {
      if (!assetPath) return null;
      const cached = this.assetCache.get(assetPath);
      if (cached) return cached.status === 'loaded' ? cached.image : null;

      const image = this.createImage(assetPath);
      if (!image) {
        this.assetCache.set(assetPath, { status: 'error', image: null });
        return null;
      }

      const record = { status: 'loading', image };
      this.assetCache.set(assetPath, record);
      image.onload = () => {
        record.status = 'loaded';
        if (this.assetsChangedHandler) this.assetsChangedHandler();
      };
      image.onerror = () => {
        record.status = 'error';
      };
      image.src = assetPath;
      return null;
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

    setAssetsChangedHandler(handler) {
      this.assetsChangedHandler = typeof handler === 'function' ? handler : null;
    }

    drawAsset(assetPath, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    clear() {
      if (!this.ctx) return;
      // For HUD overlay mode: only clear the HUD regions we actually draw to.
      // The DOM game UI shows through the transparent canvas background.
      // Top bar: y 12 to y 170 approx
      // Bottom tabs: y height-72 to height
      const hudTopY = 0;
      const hudBottomY = Math.max(0, this.height - 72);
      this.ctx.clearRect(0, hudTopY, this.width, hudBottomY - hudTopY);
      this.ctx.clearRect(0, hudBottomY, this.width, this.height - hudBottomY);
      // Optional: draw a subtle top bar backing if needed, but keep transparent for DOM
    }

    drawText(text, x, y, options = {}) {
      if (!this.ctx) return;
      this.ctx.fillStyle = options.color || '#f6e8c8';
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      this.ctx.textBaseline = options.baseline || 'top';
      this.ctx.textAlign = options.align || 'left';
      this.ctx.fillText(String(text ?? ''), x, y);
      this.ctx.textAlign = 'left';
    }

    drawLine(x1, y1, x2, y2, options = {}) {
      if (!this.ctx) return;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    drawPanel(x, y, width, height, options = {}) {
      if (!this.ctx) return;
      this.ctx.fillStyle = options.fill || 'rgba(37, 29, 21, 0.88)';
      this.ctx.strokeStyle = options.stroke || 'rgba(255, 226, 177, 0.14)';
      this.ctx.lineWidth = 1;
      const radius = options.radius || 8;
      this.roundRectPath(x, y, width, height, radius);
      this.ctx.fill();
      this.ctx.stroke();
      if (options.inset) {
        this.ctx.strokeStyle = options.inset;
        this.roundRectPath(x + 1, y + 1, width - 2, height - 2, Math.max(2, radius - 1));
        this.ctx.stroke();
      }
    }

    drawButton(x, y, width, height, label, options = {}) {
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: options.disabled
          ? 'rgba(60, 52, 46, 0.72)'
          : (options.active ? 'rgba(113, 86, 58, 0.98)' : 'rgba(50, 35, 22, 0.94)'),
        stroke: options.active ? 'rgba(240, 180, 91, 0.78)' : 'rgba(240, 180, 91, 0.32)',
        radius: options.radius || 8,
        inset: options.active ? 'rgba(255, 231, 184, 0.14)' : 'rgba(255, 231, 184, 0.08)',
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
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(11, 18, 14, 0.38)',
        stroke: 'rgba(255, 226, 177, 0.16)',
        radius: height / 2,
      });
      const fillWidth = Math.max(0, Math.min(width, width * (Number(percentage) || 0) / 100));
      if (fillWidth <= 0) return;
      this.ctx.fillStyle = this.createGradient(
        x, y, x + fillWidth, y,
        [
          [0, '#d78332'],
          [1, '#f0b45b'],
        ],
        '#d8a94f',
      );
      this.roundRectPath(x, y, fillWidth, height, height / 2);
      this.ctx.fill();
    }

    drawIconCard(x, y, width, height, assetPath, options = {}) {
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: options.fill || 'rgba(96, 67, 39, 0.88)',
        stroke: options.stroke || 'rgba(255, 226, 177, 0.18)',
        radius: options.radius || 8,
        inset: 'rgba(255, 238, 203, 0.12)',
      });
      this.drawAsset(
        assetPath,
        x + (width - (options.iconWidth || 28)) / 2,
        y + (height - (options.iconHeight || 28)) / 2,
        options.iconWidth || 28,
        options.iconHeight || 28,
      );
    }

    renderSectionHeader(title, x, y, icon = '') {
      this.drawText(`${icon ? `${icon} ` : ''}${title}`, x, y, { size: 15, bold: true, color: '#eaeaea' });
    }

    renderTopBar(state = {}) {
      if (!this.presenter) return 84;
      const layout = this.getLayout();
      const resourceView = this.presenter.buildResourceViewState(state);
      const cityView = this.presenter.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      const advisorView = this.presenter.buildAdvisorViewState ? this.presenter.buildAdvisorViewState(state.softGuide) : { hidden: true };
      const x = layout.contentX;
      const y = 12;
      const width = layout.contentWidth;
      const barPaddingX = 14;
      const statusTop = y + 10;
      const statusHeight = 38;
      const resourceTop = y + 57;
      const resourceHeight = 79;
      const cityTop = y + 141;
      const cityHeight = 34;
      const barHeight = cityView.hidden ? 138 : 180;

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
      this.drawText(state.currentEraName || '原始时代', x + barPaddingX + 36, statusTop + 19, { size: 14, bold: true, color: '#d78332', baseline: 'middle' });

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
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openLog' });
        } else if (action.label === '设置') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openSettings' });
        }
        if (index < actionDefs.length - 1) cursor -= 6;
      });

      const resources = [
        { label: '食物', value: resourceView.text.foodValue, rate: resourceView.text.foodRate, icon: 'assets/art/icon-food-cutout.webp' },
        { label: '知识', value: resourceView.text.knowledgeValue, rate: resourceView.text.knowledgeRate, icon: 'assets/art/icon-knowledge-cutout.webp' },
      ];
      if (resourceView.hasWood) {
        resources.push({ label: '木材', value: resourceView.text.woodValue, rate: resourceView.text.woodRate, icon: 'assets/art/icon-wood-cutout.webp' });
      }
      const gap = 8;
      const resourceX = x + barPaddingX;
      const resourceWidth = width - barPaddingX * 2;
      const cardWidth = (resourceWidth - gap * (resources.length - 1)) / resources.length;
      const cardY = resourceTop;
      resources.forEach((resource, index) => {
        const cardX = resourceX + index * (cardWidth + gap);
        this.drawPanel(cardX, cardY, cardWidth, resourceHeight, {
          fill: this.createGradient(
            cardX, cardY, cardX + cardWidth, cardY + resourceHeight,
            [
              [0, 'rgba(68, 48, 31, 0.78)'],
              [1, 'rgba(28, 22, 17, 0.74)'],
            ],
            'rgba(50, 38, 27, 0.82)',
          ),
          stroke: 'rgba(255, 226, 177, 0.14)',
          radius: 10,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        this.drawAsset(resource.icon, cardX + 6, cardY + 24, 30, 30);
        this.drawText(resource.label, cardX + 41, cardY + 16, { size: 10, color: '#a0a0a0' });
        this.drawText(resource.value, cardX + 41, cardY + 34, { size: 17, bold: true, color: '#74d3a0' });
        this.drawText(resource.rate, cardX + 41, cardY + 59, { size: 10, color: '#a0a0a0' });
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

    renderPopulation(state = {}, startY = 84) {
      if (!this.presenter) return startY + 180;
      const view = this.presenter.buildPopulationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const y = startY;
      this.drawPanel(x, y, width, 168, {
        fill: this.createGradient(
          x, y, x + width, y + 168,
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
      this.drawLine(x + 10, y + 162, x + width - 10, y + 162, { color: 'rgba(240, 180, 91, 0.34)', width: 2 });
      this.drawIconCard(x + 14, y + 14, 38, 38, 'assets/art/icon-population-cutout.webp');
      this.drawText('人口管理', x + 62, y + 20, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText('族人职责', x + 62, y + 40, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });

      const stats = [
        { icon: 'assets/art/icon-population-cutout.webp', label: '总人口', value: `${view.text.totalPop}/${view.text.maxPop}`, color: '#74d3a0' },
        { icon: 'assets/art/icon-population-cutout.webp', label: '待分配', value: String(view.text.unassignedPop), color: '#74d3a0' },
        { icon: 'assets/art/icon-happiness-cutout.webp', label: '幸福度', value: `${state.happiness || 100}%`, color: '#f9ca24' },
      ];
      const statWidth = Math.floor((width - 28) / 3);
      stats.forEach((stat, index) => {
        const statX = x + 6 + index * statWidth;
        const statY = y + 62;
        this.drawAsset(stat.icon, statX + 8, statY + 7, 18, 18);
        if (index > 0) this.drawLine(statX, statY + 4, statX, statY + 36, { color: 'rgba(255, 226, 177, 0.1)' });
        this.drawText(stat.label, statX + 30, statY + 4, { size: 10, color: 'rgba(234, 234, 234, 0.64)' });
        this.drawText(stat.value, statX + 30, statY + 18, { size: 13, bold: true, color: stat.color });
      });

      const jobs = view.jobs.filter((job) => job.visible);
      jobs.forEach((job, index) => {
        const rowY = y + 108 + index * 18;
        const jobLabel = { farmer: '农民', scholar: '学者', craftsman: '工匠' }[job.id] || job.id;
        const desc = { farmer: '生产食物', scholar: '口耳相传', craftsman: '钻研技艺' }[job.id] || '';
        const icon = { farmer: 'assets/art/icon-farmer-cutout.webp', scholar: 'assets/art/icon-scholar-cutout.webp', craftsman: 'assets/art/icon-craftsman-cutout.webp' }[job.id];
        this.drawPanel(x + 7, rowY, width - 14, 14, {
          fill: this.createGradient(
            x + 7, rowY, x + width - 7, rowY + 14,
            [
              [0, 'rgba(74, 52, 34, 0.86)'],
              [1, 'rgba(28, 22, 16, 0.84)'],
            ],
            'rgba(52, 38, 27, 0.84)',
          ),
          stroke: 'rgba(255, 226, 177, 0.14)',
          radius: 6,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        this.drawAsset(icon, x + 12, rowY - 4, 24, 24);
        this.drawText(jobLabel, x + 44, rowY + 2, { size: 12, bold: true, color: '#fff1cf' });
        this.drawText(desc, x + 92, rowY + 4, { size: 9, color: 'rgba(234, 234, 234, 0.58)', align: 'center' });
        const minusX = x + width - 72;
        const countX = x + width - 52;
        const plusX = x + width - 22;
        this.drawButton(minusX, rowY - 1, 16, 16, '-', { disabled: !job.canDecrease, size: 12, radius: 4 });
        this.drawPanel(countX, rowY - 3, 38, 20, { fill: 'rgba(11, 18, 14, 0.38)', stroke: 'rgba(116, 211, 160, 0.24)', radius: 8, inset: 'rgba(116, 211, 160, 0.08)' });
        this.drawText(job.count, countX + 19, rowY + 7, { size: 14, bold: true, color: '#74d3a0', baseline: 'middle', align: 'center' });
        this.drawButton(plusX, rowY - 1, 16, 16, '+', { disabled: !job.canIncrease, size: 12, radius: 4 });
        this.addHitTarget({ x: minusX, y: rowY - 1, width: 16, height: 16 }, { type: 'assignJob', job: job.id, delta: -1, disabled: !job.canDecrease });
        this.addHitTarget({ x: plusX, y: rowY - 1, width: 16, height: 16 }, { type: 'assignJob', job: job.id, delta: 1, disabled: !job.canIncrease });
      });
      return y + 180;
    }

    renderBuildings(state = {}, startY = 210, panelHeight = 310) {
      if (!this.presenter) return;
      const view = this.presenter.buildBuildingViewState(state, state.tutorial || {}, state.buildingDefinitions || {});
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('建筑', x + 14, startY + 14, '🏗️');
      if (view.isEmpty) {
        this.drawText(view.emptyText, x + 14, startY + 46, { color: '#cbbd96', size: 13 });
        return;
      }
      view.cards.slice(0, 4).forEach((card, index) => {
        const y = startY + 46 + index * 62;
        this.drawPanel(x + 12, y, width - 24, 50, {
          fill: 'rgba(28, 22, 16, 0.84)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        if (card.art) this.drawAsset(card.art, x + 20, y + 9, 32, 32);
        this.drawText(card.name, x + 60, y + 8, { size: 13, bold: true, color: '#fff1cf' });
        this.drawText(`${card.levelText} ${card.effectText || card.descText || ''}`.trim(), x + 60, y + 27, { color: '#cbbd96', size: 11 });
        this.drawButton(x + width - 96, y + 10, 72, 30, card.button.label, { disabled: card.button.disabled, size: 12 });
        this.addHitTarget(
          { x: x + width - 96, y: y + 10, width: 72, height: 30 },
          { type: card.button.action === 'upgrade' ? 'upgradeBuilding' : 'buildBuilding', buildingId: card.id, disabled: card.button.disabled },
        );
      });
    }

    renderEvents(state = {}, startY = 210, panelHeight = 310) {
      if (!this.presenter) return;
      const view = this.presenter.buildEventViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader(`待处理事件${view.badge.hidden ? '' : ` ${view.badge.text}`}`, x + 14, startY + 14, '📜');
      if (view.pending.isEmpty) {
        this.drawText(view.pending.emptyText, x + 14, startY + 46, { color: '#cbbd96', size: 13 });
        return;
      }
      view.pending.cards.slice(0, 3).forEach((card, index) => {
        const y = startY + 46 + index * 76;
        this.drawPanel(x + 12, y, width - 24, 64, {
          fill: 'rgba(28, 22, 16, 0.84)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        this.drawText(`${card.icon} ${card.title}`, x + 26, y + 8, { size: 14, bold: true });
        this.drawText(card.hint, x + 26, y + 32, { color: '#cbbd96', size: 12 });
        this.addHitTarget({ x: x + 12, y, width: width - 24, height: 64 }, { type: 'openEvent', eventId: card.id });
      });
    }

    renderCivilization(state = {}, startY = 210, panelHeight = 250) {
      if (!this.presenter) return;
      const view = this.presenter.buildCivilizationViewState(state, state.tutorial || {}, { canOpenCivilizationTab: true });
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('文明', x + 14, startY + 14, '🏛️');
      this.drawText(view.text.eraName, x + 14, startY + 44, { size: 18, bold: true });
      this.drawText(`目标：${view.text.eraTargetName}`, x + 14, startY + 74, { color: '#cbbd96', size: 13 });
      this.drawProgressBar(x + 14, startY + 104, width - 28, 12, view.progress.percentage);
      this.drawText(view.text.eraProgressText, x + 14, startY + 124, { color: '#cbbd96', size: 12 });
      view.conditions.slice(0, 4).forEach((condition, index) => {
        this.drawText(`${condition.met ? '✓' : '·'} ${condition.name} ${condition.progressText}`, x + 14, startY + 150 + index * 22, {
          color: condition.met ? '#9ed39a' : '#d6b16e',
          size: 13,
        });
      });
      this.drawButton(x + 14, startY + panelHeight - 40, width - 28, 34, view.text.advanceLabel, { disabled: view.advanceButton.disabled, bold: true });
      this.addHitTarget({ x: x + 14, y: startY + panelHeight - 40, width: width - 28, height: 34 }, { type: 'advanceEra', disabled: view.advanceButton.disabled });
    }

    renderMilitary(state = {}, startY = 210, panelHeight = 310) {
      if (!this.presenter) return;
      const view = this.presenter.buildMilitaryViewState(state);
      const scout = this.presenter.buildScoutControlViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('军事', x + 14, startY + 14, '🛡️');
      this.drawText(`士兵 ${view.text.soldierCount}`, x + 14, startY + 44, { size: 14, bold: true });
      this.drawText(`可用 ${view.text.availableSoldierCount} · 出征中 ${view.text.soldiersOnMission}`, x + 14, startY + 68, { color: '#cbbd96', size: 12 });
      this.drawText(view.text.soldierTrainingText, x + 14, startY + 96, { color: '#cbbd96', size: 12 });
      this.drawProgressBar(x + 14, startY + 118, width - 28, 10, parseFloat(view.training.progressWidth));
      this.drawLine(x + 14, startY + 148, x + width - 14, startY + 148);
      this.drawText(scout.statusText, x + 14, startY + 162, { color: '#cbbd96', size: 12 });
      scout.cells.filter((cell) => cell.type === 'button').slice(0, 8).forEach((cell, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const cellWidth = (width - 40) / 4;
        const cellX = x + 14 + col * (cellWidth + 4);
        const cellY = startY + 194 + row * 42;
        this.drawButton(cellX, cellY, cellWidth, 32, `${cell.label} ${cell.actionText}`, { disabled: cell.disabled, size: 11 });
        this.addHitTarget({ x: cellX, y: cellY, width: cellWidth, height: 32 }, {
          type: cell.action === 'claim' ? 'claimScout' : 'scoutTerritory',
          value: cell.actionValue,
          disabled: cell.disabled || !cell.action,
        });
      });
    }

    renderMainPanel(state = {}, activeTab = 'resources', startY = 210, availableHeight = 310) {
      if (activeTab === 'buildings') this.renderBuildings(state, startY, availableHeight);
      else if (activeTab === 'events') this.renderEvents(state, startY, availableHeight);
      else if (activeTab === 'civilization') this.renderCivilization(state, startY, Math.min(availableHeight, 260));
      else if (activeTab === 'military') this.renderMilitary(state, startY, availableHeight);
    }

    renderTabs(activeTab = 'resources') {
      const tabs = [
        ['resources', '资源', 'assets/art/icon-food-cutout.webp'],
        ['civilization', '文明', 'assets/art/icon-fire-cutout.webp'],
        ['buildings', '建造', 'assets/art/building-house-cutout.png'],
        ['events', '事件', 'assets/art/icon-event-cutout.webp'],
        ['military', '军事', 'assets/art/icon-soldier-cutout.webp'],
      ];
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const tabBarHeight = 58;
      const y = this.height - tabBarHeight;
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
        const isActive = id === activeTab;
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
        this.drawAsset(icon, tabX + tabWidth / 2 - (isActive ? 16 : 14), y + 7 - (isActive ? 2 : 0), isActive ? 32 : 28, isActive ? 32 : 28);
        this.drawText(label, tabX + tabWidth / 2, y + 38, {
          size: 10,
          color: isActive ? '#d78332' : '#a0a0a0',
          align: 'center',
          bold: isActive,
        });
        this.addHitTarget({ x: tabX, y, width: tabWidth, height: tabBarHeight }, { type: 'switchTab', tab: id });
      });
    }

    renderAdvisor(state = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      if (view.hidden || !view.activeAdvisor) return;
      const layout = this.getLayout();
      const width = layout.contentWidth;
      const x = layout.contentX;
      const y = this.height - 132 - this.bottomSafeArea;
      this.drawPanel(x, y, width, 44, {
        fill: 'rgba(42, 35, 24, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.24)',
        radius: 10,
      });
      this.drawText('顾问', x + 12, y + 13, { color: '#ffd98a', size: 14, bold: true });
      this.drawText(view.activeAdvisor.message, x + 64, y + 13, { color: '#f6e8c8', size: 12 });
    }

    renderHudOverlay(state = {}, options = {}) {
      const activeTab = options.activeTab || 'resources';
      this.setHitTargets([]);
      this.clear();
      this.renderTopBar(state);
      this.renderTabs(activeTab);
    }

    render(state = {}, options = {}) {
      if (options.mode === 'hud') {
        this.renderHudOverlay(state, options);
        return;
      }
      const activeTab = options.activeTab || 'resources';
      this.setHitTargets([]);
      this.clear();
      const topBarBottom = this.renderTopBar(state);
      const populationBottom = this.renderPopulation(state, topBarBottom);
      const panelTop = activeTab === 'resources' ? populationBottom : topBarBottom;
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const advisorOffset = this.presenter && typeof this.presenter.buildAdvisorViewState === 'function' && this.presenter.buildAdvisorViewState(state.softGuide).hidden ? 0 : 52;
      const availableHeight = Math.max(120, tabsTop - panelTop - 12 - advisorOffset);
      if (activeTab !== 'resources') this.renderMainPanel(state, activeTab, panelTop, availableHeight);
      this.renderAdvisor(state);
      this.renderTabs(activeTab);
    }
  }

  global.CanvasGameRenderer = CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
