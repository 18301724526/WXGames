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
      let backgroundAction = null;
      for (let index = this.hitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.hitTargets[index];
        if (
          x >= target.x
          && x <= target.x + target.width
          && y >= target.y
          && y <= target.y + target.height
        ) {
          if (target.action?.background) {
            backgroundAction = target.action;
          } else {
            return target.action;
          }
        }
      }
      return backgroundAction;
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
      // Top bar and migrated Canvas-owned pages.
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

    drawTextLines(lines = [], x, y, options = {}) {
      const lineHeight = options.lineHeight || 18;
      lines.forEach((line, index) => {
        this.drawText(line, x, y + index * lineHeight, options);
      });
    }

    wrapText(text, maxWidth, options = {}) {
      const content = String(text ?? '');
      if (!content) return [];
      if (!this.ctx || typeof this.ctx.measureText !== 'function') return [content];
      const previousFont = this.ctx.font;
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      const lines = [];
      content.split('\n').forEach((rawLine) => {
        let buffer = '';
        Array.from(rawLine).forEach((char) => {
          const next = `${buffer}${char}`;
          if (buffer && this.ctx.measureText(next).width > maxWidth) {
            lines.push(buffer);
            buffer = char;
          } else {
            buffer = next;
          }
        });
        if (buffer || rawLine === '') lines.push(buffer);
      });
      this.ctx.font = previousFont;
      return lines;
    }

    measureTextWidth(text, options = {}) {
      const content = String(text ?? '');
      if (!this.ctx || typeof this.ctx.measureText !== 'function') return content.length * (options.size || 14) * 0.55;
      const previousFont = this.ctx.font;
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      const width = this.ctx.measureText(content).width;
      this.ctx.font = previousFont;
      return width;
    }

    truncateText(text, maxWidth, options = {}) {
      const content = String(text ?? '');
      if (!content || this.measureTextWidth(content, options) <= maxWidth) return content;
      const ellipsis = '...';
      let buffer = '';
      Array.from(content).some((char) => {
        const next = `${buffer}${char}`;
        if (this.measureTextWidth(`${next}${ellipsis}`, options) > maxWidth) return true;
        buffer = next;
        return false;
      });
      return buffer ? `${buffer}${ellipsis}` : ellipsis;
    }

    wrapTextLimit(text, maxWidth, maxLines, options = {}) {
      const limit = Math.max(1, Number(maxLines) || 1);
      const lines = this.wrapText(text, maxWidth, options);
      if (lines.length <= limit) return lines;
      const visible = lines.slice(0, limit);
      visible[visible.length - 1] = this.truncateText(`${visible[visible.length - 1]}...`, maxWidth, options);
      return visible;
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
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openLogs' });
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
        this.addHitTarget({ x: cardX, y: cardY, width: cardWidth, height: resourceHeight }, { type: 'openResourceDetails' });
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

    renderCitySwitcherMenu(state = {}) {
      if (!this.presenter || typeof this.presenter.buildCitySwitcherViewState !== 'function') return;
      const view = this.presenter.buildCitySwitcherViewState(state);
      if (view.hidden) return;

      const options = Array.isArray(view.options) ? view.options : [];
      const layout = this.getLayout();
      const panelWidth = Math.min(260, layout.contentWidth - 44);
      const x = (this.width - panelWidth) / 2;
      const y = 194;
      const itemHeight = 50;
      const visibleCount = Math.min(options.length, 5);
      const panelHeight = Math.max(56, 18 + visibleCount * itemHeight);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCitySwitcher' });
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(45, 32, 21, 0.98)'],
            [1, 'rgba(23, 18, 13, 0.98)'],
          ],
          'rgba(35, 26, 19, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 10,
        inset: 'rgba(255, 238, 203, 0.12)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      if (!options.length) {
        this.drawText('暂无城市', x + panelWidth / 2, y + 23, {
          size: 13,
          color: '#cbbd96',
          align: 'center',
        });
        return;
      }

      options.slice(0, visibleCount).forEach((city, index) => {
        const itemX = x + 9;
        const itemY = y + 9 + index * itemHeight;
        const itemWidth = panelWidth - 18;
        const active = Boolean(city.isActive);
        this.drawPanel(itemX, itemY, itemWidth, 43, {
          fill: active
            ? 'rgba(126, 81, 39, 0.92)'
            : 'rgba(45, 34, 24, 0.82)',
          stroke: active
            ? 'rgba(240, 180, 91, 0.6)'
            : 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        if (active) {
          this.drawPanel(itemX, itemY, 4, 43, {
            fill: '#f0b45b',
            stroke: '#f0b45b',
            radius: 2,
          });
        }
        this.drawText(city.name || '未命名城市', itemX + 12, itemY + 8, {
          size: 13,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(city.tag || '', itemX + itemWidth - 12, itemY + 8, {
          size: 11,
          bold: true,
          color: '#f0b45b',
          align: 'right',
        });
        this.drawText(city.metaText || '', itemX + 12, itemY + 26, {
          size: 11,
          color: 'rgba(234, 234, 234, 0.66)',
        });
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: 43 },
          active || !city.id
            ? { type: 'blockCanvasModal' }
            : { type: 'selectCity', cityId: city.id },
        );
      });
    }

    renderPopulation(state = {}, startY = 84) {
      if (!this.presenter || typeof this.presenter.buildPopulationViewState !== 'function') return startY + 180;
      const view = this.presenter.buildPopulationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const y = startY;
      const panelHeight = 268;
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
      this.drawText('人口管理', x + 62, y + 20, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText('族人职责', x + 62, y + 40, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      this.drawLine(x + 16, y + 56, x + width - 16, y + 56, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });

      const stats = [
        { icon: 'assets/art/icon-population-cutout.webp', label: '总人口', value: `${view.text.total}/${view.text.max}`, color: '#74d3a0' },
        { icon: 'assets/art/icon-population-cutout.webp', label: '待分配', value: String(view.text.unassigned), color: '#74d3a0' },
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

      const jobs = view.jobs.filter((job) => job.visible);
      jobs.forEach((job, index) => {
        const rowY = y + 112 + index * (jobRowHeight + jobRowGap);
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

    renderBuildings(state = {}, startY = 210, panelHeight = 310, options = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildBuildingViewState(state, state.tutorial || {}, state.buildingDefinitions || {});
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const panelBottom = startY + panelHeight;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: this.createGradient(
          x, startY, x + width, panelBottom,
          [
            [0, 'rgba(54, 40, 28, 0.94)'],
            [1, 'rgba(24, 19, 14, 0.94)'],
          ],
          'rgba(37, 29, 21, 0.92)',
        ),
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.drawIconCard(x + 14, startY + 14, 38, 38, 'assets/art/building-house-cutout.png');
      this.drawText('建筑', x + 62, startY + 17, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText('建造与升级', x + 62, startY + 38, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      this.drawLine(x + 16, startY + 60, x + width - 16, startY + 60, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });
      if (view.isEmpty) {
        this.drawText(view.emptyText, x + width / 2, startY + 96, { color: '#cbbd96', size: 13, align: 'center' });
        return;
      }
      const rowHeight = 78;
      const rowGap = 8;
      const firstRowY = startY + 76;
      let visibleCount = Math.max(1, Math.floor((panelBottom - firstRowY - 8) / (rowHeight + rowGap)));
      let offset = Math.max(0, Number(options.offset) || 0);
      let maxOffset = Math.max(0, view.cards.length - visibleCount);
      if (view.cards.length > visibleCount || offset > 0) {
        visibleCount = Math.max(1, Math.floor((panelBottom - firstRowY - 42) / (rowHeight + rowGap)));
        maxOffset = Math.max(0, view.cards.length - visibleCount);
      }
      offset = Math.min(offset, maxOffset);
      const visibleCards = view.cards.slice(offset, offset + visibleCount);

      visibleCards.forEach((card, index) => {
        const y = firstRowY + index * (rowHeight + rowGap);
        const isMuted = Boolean(card.isMuted || card.button.disabled);
        this.drawPanel(x + 10, y, width - 20, rowHeight, {
          fill: isMuted
            ? 'rgba(35, 31, 27, 0.78)'
            : this.createGradient(
              x + 10, y, x + width - 10, y + rowHeight,
              [
                [0, 'rgba(79, 57, 38, 0.88)'],
                [1, 'rgba(28, 22, 16, 0.86)'],
              ],
              'rgba(48, 36, 26, 0.86)',
            ),
          stroke: isMuted ? 'rgba(255, 226, 177, 0.1)' : 'rgba(255, 226, 177, 0.16)',
          radius: 8,
          inset: 'rgba(255, 231, 184, 0.07)',
        });
        if (card.art) this.drawAsset(card.art, x + 20, y + 12, 46, 46, isMuted ? 0.62 : 1);
        else this.drawText(card.icon || '', x + 43, y + 35, { size: 24, align: 'center', baseline: 'middle' });

        const textX = x + 76;
        const buttonWidth = 78;
        const buttonX = x + width - buttonWidth - 22;
        const textWidth = Math.max(112, buttonX - textX - 12);
        this.drawText(card.name, textX, y + 10, { size: 13, bold: true, color: '#fff1cf' });
        this.drawText(card.levelText, textX, y + 29, { size: 11, color: 'rgba(234, 234, 234, 0.62)' });

        const detail = card.effectText || (card.militaryLines || [])[0] || card.descText || '';
        const detailLines = this.wrapText(detail, textWidth, { size: 10 }).slice(0, 2);
        this.drawTextLines(detailLines, textX, y + 47, { color: '#cbbd96', size: 10, lineHeight: 13 });

        const costText = card.cost?.text || (card.cost?.parts || []).map((part) => `${this.resourceShortName(part.resource)} ${part.text}`).join(' ');
        if (costText) {
          this.drawText(costText, buttonX + buttonWidth / 2, y + 8, {
            size: 10,
            color: card.cost?.isMax ? '#a0a0a0' : '#f6e8c8',
            align: 'center',
          });
        }
        this.drawButton(buttonX, y + 31, buttonWidth, 34, card.button.label, { disabled: card.button.disabled, size: 12, radius: 8 });
        this.addHitTarget(
          { x: buttonX, y: y + 31, width: buttonWidth, height: 34 },
          { type: card.button.action === 'upgrade' ? 'upgradeBuilding' : 'buildBuilding', buildingId: card.id, disabled: card.button.disabled },
        );
      });
      if (view.cards.length > visibleCount) {
        const pagerY = panelBottom - 32;
        const buttonWidth = 68;
        const gap = 8;
        const prevX = x + width / 2 - buttonWidth - gap - 42;
        const nextX = x + width / 2 + 42 + gap;
        const canPrev = offset > 0;
        const canNext = offset < maxOffset;
        this.drawButton(prevX, pagerY, buttonWidth, 24, '上一页', { disabled: !canPrev, size: 11, radius: 7 });
        this.drawText(`${offset + 1}-${offset + visibleCards.length}/${view.cards.length}`, x + width / 2, pagerY + 12, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.62)',
          baseline: 'middle',
          align: 'center',
        });
        this.drawButton(nextX, pagerY, buttonWidth, 24, '下一页', { disabled: !canNext, size: 11, radius: 7 });
        this.addHitTarget({ x: prevX, y: pagerY, width: buttonWidth, height: 24 }, { type: 'scrollBuildings', delta: -1, disabled: !canPrev });
        this.addHitTarget({ x: nextX, y: pagerY, width: buttonWidth, height: 24 }, { type: 'scrollBuildings', delta: 1, disabled: !canNext });
      }
    }

    resourceShortName(resource) {
      return {
        food: '食物',
        wood: '木材',
        knowledge: '知识',
        stone: '石料',
        metal: '金属',
      }[resource] || resource;
    }

    eventRowColor(tone) {
      return {
        reward: '#74d3a0',
        cost: '#f7d774',
        penalty: '#ff9aa2',
        requirement: '#ffd98a',
        time: '#f7d774',
        neutral: '#cbbd96',
      }[tone] || '#cbbd96';
    }

    drawEventDetailRow(row, x, y, width, options = {}) {
      if (!row) return 0;
      const size = options.size || 11;
      const lineHeight = options.lineHeight || 15;
      const maxLines = options.maxLines || 1;
      const labelWidth = options.labelWidth || 38;
      const label = row.label ? `${row.label}:` : '';
      this.drawText(label, x, y, {
        size,
        bold: true,
        color: this.eventRowColor(row.tone),
      });
      const textX = x + labelWidth;
      const textWidth = Math.max(24, width - labelWidth);
      const lines = this.wrapTextLimit(row.text || '', textWidth, maxLines, { size });
      this.drawTextLines(lines, textX, y, {
        size,
        color: options.color || '#cbbd96',
        lineHeight,
      });
      return Math.max(lineHeight, lines.length * lineHeight);
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
      const contentX = x + 12;
      const contentWidth = width - 24;
      const pendingTop = startY + 44;
      const historyTitleY = Math.max(pendingTop + 92, Math.min(startY + panelHeight - 128, pendingTop + 250));
      const cardHeight = 78;
      const cardGap = 8;
      const maxPendingCards = Math.max(1, Math.floor((historyTitleY - pendingTop - 10) / (cardHeight + cardGap)));

      if (view.pending.isEmpty) {
        this.drawPanel(contentX, pendingTop, contentWidth, 54, {
          fill: 'rgba(28, 22, 16, 0.58)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawText(view.pending.emptyText, x + width / 2, pendingTop + 27, {
          color: '#cbbd96',
          size: 13,
          baseline: 'middle',
          align: 'center',
        });
      } else {
        view.pending.cards.slice(0, maxPendingCards).forEach((card, index) => {
          const y = pendingTop + index * (cardHeight + cardGap);
          const isThreat = Boolean(card.classState?.['is-threat']);
          const isSpecial = Boolean(card.classState?.['is-special']);
          this.drawPanel(contentX, y, contentWidth, cardHeight, {
            fill: isThreat ? 'rgba(58, 28, 28, 0.84)' : 'rgba(28, 22, 16, 0.84)',
            stroke: isThreat
              ? 'rgba(233, 69, 96, 0.5)'
              : (isSpecial ? 'rgba(247, 215, 116, 0.48)' : 'rgba(255, 226, 177, 0.12)'),
            radius: 8,
          });
          const textX = contentX + 12;
          const textWidth = contentWidth - 24;
          const title = this.truncateText(`${card.icon} ${card.title}`, textWidth, { size: 14, bold: true });
          const descriptionLines = this.wrapTextLimit(card.description, textWidth, 2, { size: 11 });
          const hint = this.truncateText(card.hint, textWidth, { size: 11 });
          this.drawText(title, textX, y + 8, { size: 14, bold: true });
          this.drawTextLines(descriptionLines, textX, y + 29, {
            color: '#aeb0b8',
            size: 11,
            lineHeight: 15,
          });
          this.drawText(hint, contentX + contentWidth - 12, y + cardHeight - 18, {
            color: isThreat ? '#ff9aa2' : '#f7d774',
            size: 11,
            align: 'right',
          });
          this.addHitTarget({ x: contentX, y, width: contentWidth, height: cardHeight }, { type: 'openEvent', eventId: card.id });
        });
        if (view.pending.cards.length > maxPendingCards) {
          this.drawText(`还有 ${view.pending.cards.length - maxPendingCards} 个事件`, x + width - 14, historyTitleY - 20, {
            color: 'rgba(234, 234, 234, 0.56)',
            size: 11,
            align: 'right',
          });
        }
      }

      this.drawLine(x + 14, historyTitleY - 8, x + width - 14, historyTitleY - 8, {
        color: 'rgba(240, 180, 91, 0.18)',
      });
      this.renderSectionHeader('最近事件', x + 14, historyTitleY, '📜');
      if (view.history.isEmpty) {
        this.drawText(view.history.emptyText, x + 14, historyTitleY + 30, { color: '#cbbd96', size: 12 });
      } else {
        const historyTop = historyTitleY + 30;
        const maxHistoryItems = Math.max(1, Math.floor((startY + panelHeight - historyTop - 10) / 38));
        view.history.items.slice(0, maxHistoryItems).forEach((item, index) => {
          const y = historyTop + index * 38;
          const isThreat = item.className === 'threat';
          this.drawPanel(contentX, y, contentWidth, 30, {
            fill: 'rgba(28, 22, 16, 0.58)',
            stroke: isThreat ? 'rgba(233, 69, 96, 0.3)' : 'rgba(116, 211, 160, 0.24)',
            radius: 7,
          });
          this.drawText(item.icon, x + 26, y + 15, { size: 14, baseline: 'middle' });
          this.drawText(item.title, x + 48, y + 7, { size: 12, bold: true, color: '#f6e8c8' });
          this.drawText(item.result, x + width - 24, y + 7, {
            size: 11,
            color: isThreat ? '#ff9aa2' : '#74d3a0',
            align: 'right',
          });
        });
      }
    }

    renderEventModal(state = {}, activeEventId = null) {
      if (!this.presenter || !activeEventId) return;
      const eventData = (state.eventQueue || []).find((item) => item.id === activeEventId);
      if (!eventData) return;
      const view = this.presenter.buildEventModalViewState(eventData);
      if (!view.showModal) return;

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeEvent' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const options = view.options.length ? view.options : [{
        id: view.claimButton.optionId,
        label: view.claimButton.label,
        preview: view.text.reward,
        rows: [{ label: '奖励', text: view.text.reward, tone: 'reward' }],
      }];
      const optionCount = Math.max(1, options.length);
      const panelHeight = Math.min(this.height - 96, Math.max(382, 270 + optionCount * 94));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(48, (this.height - panelHeight) / 2 - 8);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeEvent' });

      const descX = x + 18;
      const descWidth = panelWidth - 36;
      const titleWidth = panelWidth - 84;
      const titleLines = this.wrapTextLimit(view.text.title, titleWidth, 2, { size: 17, bold: true });
      const titleY = y + 22;
      this.drawTextLines(titleLines, x + panelWidth / 2, titleY, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
        lineHeight: 21,
      });

      const descY = titleY + Math.max(24, titleLines.length * 21) + 10;
      const descHeight = 80;
      const descLines = this.wrapTextLimit(view.text.description, descWidth - 24, 4, { size: 13 });
      this.drawPanel(descX, descY, descWidth, descHeight, {
        fill: 'rgba(23, 18, 13, 0.36)',
        stroke: 'rgba(255, 226, 177, 0.1)',
        radius: 9,
      });
      this.drawTextLines(descLines, descX + 12, descY + 10, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 16,
      });

      const metaRows = Array.isArray(view.metaRows) && view.metaRows.length
        ? view.metaRows
        : [{ label: optionCount > 1 ? '选项' : '奖励', text: view.text.reward, tone: optionCount > 1 ? 'neutral' : 'reward' }];
      const metaY = descY + descHeight + 8;
      const metaHeight = Math.min(54, 12 + metaRows.slice(0, 2).length * 18);
      this.drawPanel(descX, metaY, descWidth, metaHeight, {
        fill: 'rgba(23, 18, 13, 0.48)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 9,
      });
      metaRows.slice(0, 2).forEach((row, index) => {
        this.drawEventDetailRow(row, descX + 12, metaY + 8 + index * 18, descWidth - 24, {
          size: 11,
          lineHeight: 15,
          labelWidth: 38,
          maxLines: 1,
        });
      });

      const laterY = y + panelHeight - 42;
      const optionTop = metaY + metaHeight + 12;
      const optionGap = 8;
      const optionAreaHeight = Math.max(72, laterY - optionTop - 12);
      const roomyHeight = optionCount >= 4 ? 76 : 92;
      const optionHeight = Math.max(68, Math.min(roomyHeight, Math.floor((optionAreaHeight - (optionCount - 1) * optionGap) / optionCount)));
      const visibleCount = Math.max(1, Math.min(optionCount, Math.floor((optionAreaHeight + optionGap) / (optionHeight + optionGap))));
      options.slice(0, visibleCount).forEach((option, index) => {
        const optionY = optionTop + index * (optionHeight + optionGap);
        this.drawPanel(descX, optionY, descWidth, optionHeight, {
          fill: 'rgba(69, 48, 30, 0.92)',
          stroke: 'rgba(240, 180, 91, 0.34)',
          radius: 9,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        const label = this.truncateText(option.label || '处理事件', descWidth - 24, { size: 13, bold: true });
        this.drawText(label, descX + 12, optionY + 9, {
          size: 13,
          bold: true,
          color: '#f6e8c8',
        });
        const rows = Array.isArray(option.rows) && option.rows.length
          ? option.rows
          : [{ label: '结果', text: option.preview || '', tone: 'neutral' }];
        const maxRows = Math.max(1, Math.floor((optionHeight - 30) / 14));
        rows.slice(0, maxRows).forEach((row, rowIndex) => {
          this.drawEventDetailRow(row, descX + 12, optionY + 30 + rowIndex * 14, descWidth - 24, {
            size: 10,
            lineHeight: 13,
            labelWidth: 36,
            maxLines: rows.length === 1 && maxRows > 1 ? 2 : 1,
          });
        });
        this.addHitTarget({ x: descX, y: optionY, width: descWidth, height: optionHeight }, {
          type: 'claimEvent',
          eventId: eventData.id,
          optionId: option.id,
        });
      });

      if (visibleCount < optionCount) {
        this.drawText(`还有 ${optionCount - visibleCount} 个选项未显示`, descX + descWidth - 2, laterY - 10, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.56)',
          align: 'right',
        });
      }
      this.drawButton(descX, laterY, descWidth, 30, '稍后查看', { size: 12, radius: 8 });
      this.addHitTarget({ x: descX, y: laterY, width: descWidth, height: 30 }, { type: 'closeEvent' });
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

    renderMainPanel(state = {}, activeTab = 'resources', startY = 210, availableHeight = 310, options = {}) {
      if (activeTab === 'buildings') this.renderBuildings(state, startY, availableHeight, { offset: options.buildingOffset });
      else if (activeTab === 'events') this.renderEvents(state, startY, availableHeight);
      else if (activeTab === 'civilization') this.renderCivilization(state, startY, Math.min(availableHeight, 260));
      else if (activeTab === 'military') this.renderMilitary(state, startY, availableHeight);
    }

    renderTabs(activeTab = 'resources', state = {}) {
      const tabs = [
        ['resources', '资源', 'assets/art/icon-food-cutout.webp'],
        ['buildings', '建造', 'assets/art/building-house-cutout.png'],
        ['tech', '科技', 'assets/art/icon-knowledge-cutout.webp'],
        ['events', '事件', 'assets/art/icon-event-cutout.webp'],
        ['civilization', '文明', 'assets/art/icon-fire-cutout.webp'],
        ['military', '军事', 'assets/art/icon-soldier-cutout.webp'],
      ];
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const tabBarHeight = 58;
      const y = this.height - tabBarHeight;
      const eventBadge = this.presenter && typeof this.presenter.buildEventViewState === 'function'
        ? this.presenter.buildEventViewState(state).badge
        : { hidden: true };
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

    renderAdvisorPanel(state = {}) {
      if (!this.presenter || typeof this.presenter.buildAdvisorViewState !== 'function') return;
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      if (view.hidden || !view.activeAdvisor) return;

      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 28);
      const panelHeight = 276;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(96, (this.height - panelHeight) / 2 - 18);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeAdvisor' });

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeAdvisor' });

      const portraitSize = 64;
      const portraitX = x + panelWidth / 2 - portraitSize / 2;
      const portraitY = y + 24;
      this.drawPanel(portraitX, portraitY, portraitSize, portraitSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: portraitSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawText('谋', x + panelWidth / 2, portraitY + portraitSize / 2, {
        size: 24,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      this.drawText('顾问建议', x + panelWidth / 2, y + 102, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageX = x + 18;
      const messageY = y + 132;
      const messageWidth = panelWidth - 36;
      const messageHeight = 72;
      this.drawPanel(messageX, messageY, messageWidth, messageHeight, {
        fill: 'rgba(23, 18, 13, 0.42)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.04)',
      });
      const lines = this.wrapText(view.text?.message || view.activeAdvisor.message, messageWidth - 24, { size: 13 })
        .slice(0, 3);
      this.drawTextLines(lines, messageX + 12, messageY + 13, {
        size: 13,
        color: '#f6e8c8',
        lineHeight: 18,
      });

      const buttonY = y + panelHeight - 52;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const goX = x + 18;
      const dismissX = goX + buttonWidth + buttonGap;
      this.drawButton(goX, buttonY, buttonWidth, 36, '前往处理', {
        size: 13,
        bold: true,
        radius: 9,
        disabled: Boolean(view.goButton?.disabled),
        active: !view.goButton?.disabled,
      });
      this.drawButton(dismissX, buttonY, buttonWidth, 36, '稍后再说', { size: 13, radius: 9 });
      this.addHitTarget(
        { x: goX, y: buttonY, width: buttonWidth, height: 36 },
        { type: 'goToAdvisorTarget', disabled: Boolean(view.goButton?.disabled) },
      );
      this.addHitTarget({ x: dismissX, y: buttonY, width: buttonWidth, height: 36 }, { type: 'closeAdvisor' });
    }

    renderHudOverlay(state = {}, options = {}) {
      const activeTab = options.activeTab || 'resources';
      this.setHitTargets([]);
      this.clear();
      const topBarBottom = this.renderTopBar(state);
      if (activeTab === 'resources') {
        this.renderPopulation(state, topBarBottom);
      } else if (activeTab === 'buildings') {
        const tabsTop = this.height - 60 - this.bottomSafeArea;
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderBuildings(
          { ...state, tutorial: options.tutorial || state.tutorial || {} },
          topBarBottom,
          availableHeight,
          { offset: options.buildingOffset },
        );
      } else if (activeTab === 'events') {
        const tabsTop = this.height - 60 - this.bottomSafeArea;
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderEvents(state, topBarBottom, availableHeight);
      }
      this.renderTabs(activeTab, state);
      if (options.showResourceDetails) {
        this.renderResourceDetailsPanel(state);
      }
      if (options.showSettings) {
        this.renderSettingsPanel();
      }
      if (options.showLogs) {
        this.renderLogsPanel(options.logs || []);
      }
      if (options.showCitySwitcher) {
        this.renderCitySwitcherMenu(state);
      }
      if (options.showAdvisor) {
        this.renderAdvisorPanel(state);
      }
      if (options.activeEventId) {
        this.renderEventModal(state, options.activeEventId);
      }
    }

    renderSettingsPanel() {
      const layout = this.getLayout();
      const panelWidth = 200;
      const panelHeight = 120;
      const x = layout.contentRight - panelWidth - 8;
      const y = 62;

      // 绘制面板背景
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.2)',
        radius: 10,
      });

      // 绘制标题
      this.drawText('设置', x + panelWidth / 2, y + 18, {
        size: 14,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      // 绘制分隔线
      if (this.ctx) {
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 28);
        this.ctx.lineTo(x + panelWidth - 10, y + 28);
        this.ctx.stroke();
      }

      // 重置游戏按钮
      const btnHeight = 36;
      const btnY1 = y + 38;
      this.drawButton(x + 10, btnY1, panelWidth - 20, btnHeight, '重置游戏', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY1, width: panelWidth - 20, height: btnHeight }, { type: 'resetGame' });

      // 退出登录按钮
      const btnY2 = btnY1 + btnHeight + 8;
      this.drawButton(x + 10, btnY2, panelWidth - 20, btnHeight, '退出登录', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY2, width: panelWidth - 20, height: btnHeight }, { type: 'logout' });

      // 面板外部点击关闭
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeSettings', background: true });
    }

    renderLogsPanel(logs = []) {
      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 24);
      const panelHeight = 420;
      const x = (this.width - panelWidth) / 2;
      const y = (this.height - panelHeight) / 2;

      // 绘制面板背景
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.2)',
        radius: 12,
      });

      // 绘制标题
      this.drawText('📜 最近请求日志', x + panelWidth / 2, y + 22, {
        size: 16,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      // 绘制关闭按钮
      const closeBtnSize = 28;
      const closeBtnX = x + panelWidth - closeBtnSize - 10;
      const closeBtnY = y + 10;
      this.drawButton(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, '✕', {
        size: 14,
        radius: 6,
        active: false,
      });
      this.addHitTarget({ x: closeBtnX, y: closeBtnY, width: closeBtnSize, height: closeBtnSize }, { type: 'closeLogs' });

      // 绘制分隔线
      if (this.ctx) {
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 12, y + 42);
        this.ctx.lineTo(x + panelWidth - 12, y + 42);
        this.ctx.stroke();
      }

      // 日志列表区域
      const listX = x + 12;
      const listY = y + 52;
      const listWidth = panelWidth - 24;
      const listHeight = panelHeight - 110;

      // 绘制日志列表背景
      this.drawPanel(listX, listY, listWidth, listHeight, {
        fill: 'rgba(0, 0, 0, 0.2)',
        stroke: 'rgba(255, 255, 255, 0.05)',
        radius: 8,
      });

      // 绘制日志条目
      const itemHeight = 28;
      const maxItems = Math.floor(listHeight / itemHeight);
      const displayLogs = logs.slice(0, maxItems);

      if (displayLogs.length === 0) {
        this.drawText('暂无日志', listX + listWidth / 2, listY + listHeight / 2, {
          size: 12,
          color: '#888',
          align: 'center',
        });
      } else {
        displayLogs.forEach((log, index) => {
          const itemY = listY + 6 + index * itemHeight;
          const time = log.timestamp || '';
          const method = (log.method || '') + ' ' + (log.path || '');
          const status = log.statusCode || 0;
          const isOk = status >= 200 && status < 300;
          const statusColor = isOk ? '#74d3a0' : '#ff6b6b';

          // 时间
          this.drawText(time, listX + 8, itemY + 10, { size: 10, color: '#aaa' });
          // 方法
          this.drawText(method, listX + 70, itemY + 10, { size: 10, color: '#f6e8c8' });
          // 状态码
          this.drawText(String(status), listX + listWidth - 40, itemY + 10, { size: 10, color: statusColor });
        });
      }

      // 清空日志按钮
      const clearBtnY = y + panelHeight - 48;
      this.drawButton(x + 12, clearBtnY, panelWidth - 24, 36, '清空日志', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 12, y: clearBtnY, width: panelWidth - 24, height: 36 }, { type: 'clearLogs' });

      // 面板外部点击关闭
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeLogs', background: true });
    }

    renderResourceDetailsPanel(state = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildResourceViewState(state);
      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 24);
      const resourceCount = view.hasWood ? 3 : 2;
      const panelHeight = 92 + resourceCount * 86;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(76, (this.height - panelHeight) / 2 - 20);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeResourceDetails' });

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.97)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 12,
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      this.drawText('资源详情', x + panelWidth / 2, y + 22, {
        size: 16,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      const closeBtnSize = 28;
      const closeBtnX = x + panelWidth - closeBtnSize - 10;
      const closeBtnY = y + 10;
      this.drawButton(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, 'x', {
        size: 14,
        radius: 6,
      });
      this.addHitTarget({ x: closeBtnX, y: closeBtnY, width: closeBtnSize, height: closeBtnSize }, { type: 'closeResourceDetails' });

      const cards = [
        {
          label: '食物',
          icon: 'assets/art/icon-food-cutout.webp',
          value: view.text.foodDetailValue,
          lines: [
            `产出 ${view.text.foodOutputRate}`,
            `消耗 ${view.text.foodConsumptionRate}`,
            `净增长 ${view.text.foodNetRate}`,
          ],
        },
        {
          label: '知识',
          icon: 'assets/art/icon-knowledge-cutout.webp',
          value: view.text.knowledgeDetailValue,
          lines: [`产出 ${view.text.knowledgeDetailRate}`],
        },
      ];

      if (view.hasWood) {
        cards.push({
          label: '木材',
          icon: 'assets/art/icon-wood-cutout.webp',
          value: view.text.woodDetailValue,
          lines: [`产出 ${view.text.woodDetailRate}`],
        });
      }

      const cardX = x + 12;
      const cardWidth = panelWidth - 24;
      cards.forEach((card, index) => {
        const cardY = y + 56 + index * 86;
        this.drawPanel(cardX, cardY, cardWidth, 74, {
          fill: 'rgba(27, 22, 17, 0.74)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 10,
        });
        this.drawAsset(card.icon, cardX + 12, cardY + 19, 34, 34);
        this.drawText(card.label, cardX + 58, cardY + 12, { size: 13, bold: true, color: '#f6e8c8' });
        this.drawText(String(card.value), cardX + cardWidth - 12, cardY + 12, {
          size: 18,
          bold: true,
          color: '#74d3a0',
          align: 'right',
        });
        this.drawTextLines(card.lines, cardX + 58, cardY + 36, { size: 11, color: '#aeb0b8', lineHeight: 16 });
      });

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
      if (activeTab !== 'resources') this.renderMainPanel(state, activeTab, panelTop, availableHeight, options);
      this.renderAdvisor(state);
      this.renderTabs(activeTab, state);
      if (options.showResourceDetails) this.renderResourceDetailsPanel(state);
      if (options.showCitySwitcher) this.renderCitySwitcherMenu(state);
      if (options.activeEventId) this.renderEventModal(state, options.activeEventId);
    }
  }

  global.CanvasGameRenderer = CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
