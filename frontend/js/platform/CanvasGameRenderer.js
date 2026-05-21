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

    renderCivilization(state = {}, startY = 210, panelHeight = 420, options = {}) {
      if (!this.presenter || typeof this.presenter.buildCivilizationViewState !== 'function') return;
      const view = this.presenter.buildCivilizationViewState(
        state,
        options.tutorial || state.tutorial || {},
        { canOpenCivilizationTab: options.canOpenCivilizationTab !== false },
      );
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const panelBottom = startY + panelHeight;
      const sectionGap = 10;
      const overviewX = x + 12;
      const overviewY = startY + 12;
      const overviewWidth = width - 24;
      const overviewHeight = 148;
      const eraY = overviewY + overviewHeight + sectionGap;
      const eraHeight = Math.min(190, Math.max(156, panelBottom - eraY - 96));
      const featureY = eraY + eraHeight + sectionGap;
      const featureHeight = Math.max(72, panelBottom - featureY - 12);

      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });

      this.drawPanel(overviewX, overviewY, overviewWidth, overviewHeight, {
        fill: this.createGradient(
          overviewX, overviewY, overviewX, overviewY + overviewHeight,
          [
            [0, 'rgba(54, 40, 28, 0.92)'],
            [1, 'rgba(28, 22, 17, 0.9)'],
          ],
          'rgba(44, 32, 23, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', overviewX + 12, overviewY + 12, 32, 32);
      this.drawText(view.text.eraName, overviewX + 50, overviewY + 19, { size: 16, bold: true, color: '#f0b45b' });
      this.drawText(view.text.civOverviewDay, overviewX + overviewWidth - 12, overviewY + 20, {
        size: 12,
        color: '#a0a0a0',
        align: 'right',
      });
      this.drawLine(overviewX + 12, overviewY + 54, overviewX + overviewWidth - 12, overviewY + 54, {
        color: 'rgba(255, 226, 177, 0.14)',
      });

      const stats = [
        { label: '总人口', value: view.text.civOverviewPop, icon: 'assets/art/icon-population-cutout.webp' },
        { label: '建筑', value: view.text.civOverviewBuildings, icon: 'assets/art/building-house-cutout.png' },
        { label: '科技', value: view.text.civOverviewTechs, icon: 'assets/art/icon-science-cutout.webp' },
        { label: '幸福度', value: view.text.civOverviewHappiness, icon: 'assets/art/icon-happiness-cutout.webp' },
      ];
      const statGap = 8;
      const statWidth = (overviewWidth - 24 - statGap) / 2;
      const statHeight = 38;
      stats.forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const statX = overviewX + 12 + col * (statWidth + statGap);
        const statY = overviewY + 66 + row * (statHeight + 7);
        this.drawPanel(statX, statY, statWidth, statHeight, {
          fill: 'rgba(63, 47, 32, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawAsset(item.icon, statX + 8, statY + 6, 26, 26);
        this.drawText(item.label, statX + 40, statY + 6, { size: 10, color: '#a0a0a0' });
        this.drawText(String(item.value), statX + 40, statY + 21, { size: 14, bold: true, color: '#74d3a0' });
      });

      const eraX = x + 12;
      const eraWidth = width - 24;
      this.drawPanel(eraX, eraY, eraWidth, eraHeight, {
        fill: this.createGradient(
          eraX, eraY, eraX, eraY + eraHeight,
          [
            [0, 'rgba(54, 40, 28, 0.92)'],
            [1, 'rgba(28, 22, 17, 0.9)'],
          ],
          'rgba(44, 32, 23, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('时代进阶', eraX + 12, eraY + 14, '🔥');
      this.drawAsset('assets/art/icon-food-cutout.webp', eraX + eraWidth / 2 - 42, eraY + 40, 38, 38);
      this.drawText(view.text.eraTargetName, eraX + eraWidth / 2 + 4, eraY + 59, {
        size: 15,
        bold: true,
        color: '#f6e8c8',
        baseline: 'middle',
      });
      this.drawProgressBar(eraX + 12, eraY + 84, eraWidth - 24, 10, view.progress.percentage);
      this.drawText(view.text.eraProgressText, eraX + eraWidth / 2, eraY + 102, {
        size: 11,
        color: '#a0a0a0',
        align: 'center',
      });

      const conditions = view.conditions || [];
      const conditionWidth = Math.floor((eraWidth - 32) / 2);
      conditions.slice(0, 4).forEach((condition, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const itemX = eraX + 12 + col * (conditionWidth + 8);
        const itemY = eraY + 122 + row * 27;
        this.drawPanel(itemX, itemY, conditionWidth, 22, {
          fill: 'rgba(63, 47, 32, 0.62)',
          stroke: condition.met ? 'rgba(78, 204, 163, 0.3)' : 'rgba(233, 69, 96, 0.15)',
          radius: 7,
        });
        this.drawText(condition.met ? '✓' : '•', itemX + 9, itemY + 11, {
          size: 12,
          bold: true,
          color: condition.met ? '#4ecca3' : '#d6b16e',
          baseline: 'middle',
        });
        this.drawText(this.truncateText(condition.name, conditionWidth - 52, { size: 11, bold: true }), itemX + 24, itemY + 6, {
          size: 11,
          bold: true,
          color: '#f6e8c8',
        });
        this.drawText(condition.progressText, itemX + conditionWidth - 8, itemY + 6, {
          size: 10,
          color: condition.met ? '#4ecca3' : '#a0a0a0',
          align: 'right',
        });
      });

      const buttonY = eraY + eraHeight - 42;
      this.drawButton(eraX + 12, buttonY, eraWidth - 24, 32, view.text.advanceLabel, {
        disabled: view.advanceButton.disabled,
        bold: true,
        radius: 8,
        active: !view.advanceButton.disabled,
      });
      this.addHitTarget(
        { x: eraX + 12, y: buttonY, width: eraWidth - 24, height: 32 },
        { type: 'advanceEra', disabled: view.advanceButton.disabled },
      );

      this.drawPanel(x + 12, featureY, width - 24, featureHeight, {
        fill: 'rgba(37, 29, 21, 0.82)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.renderSectionHeader('当前时代特性', x + 26, featureY + 14, '✓');
      const featureLines = this.wrapTextLimit(view.text.featureDescription, width - 58, 3, { size: 12 });
      this.drawTextLines(featureLines, x + 26, featureY + 44, {
        size: 12,
        color: '#f6e8c8',
        lineHeight: 18,
      });
    }

    renderTech(state = {}, startY = 210, panelHeight = 250) {
      if (!this.presenter || typeof this.presenter.buildTechViewState !== 'function') return;
      const view = this.presenter.buildTechViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      const headerHeight = 72;
      this.drawPanel(x + 12, startY + 12, width - 24, headerHeight, {
        fill: 'rgba(45, 34, 24, 0.82)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawAsset('assets/art/icon-knowledge-cutout.webp', x + 28, startY + 27, 40, 40);
      this.drawText('当前知识产出', x + 78, startY + 28, {
        size: 12,
        color: '#a0a0a0',
      });
      this.drawText(view.text.knowledgeRate, x + 78, startY + 48, {
        size: 22,
        bold: true,
        color: '#74d3a0',
      });

      const panelY = startY + 96;
      const panelBottom = startY + panelHeight - 14;
      const panelH = Math.max(116, panelBottom - panelY);
      this.drawPanel(x + 12, panelY, width - 24, panelH, {
        fill: 'rgba(28, 22, 16, 0.74)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.renderSectionHeader(view.text.title, x + 28, panelY + 16, '🔬');
      const centerY = panelY + Math.max(66, panelH / 2 + 6);
      this.drawAsset('assets/art/icon-science-cutout.webp', x + width / 2 - 34, centerY - 52, 68, 68, 0.62);
      this.drawText(view.text.placeholder, x + width / 2, centerY + 24, {
        size: 15,
        bold: true,
        color: '#cbbd96',
        align: 'center',
      });
      this.drawText(view.text.subtitle, x + width / 2, centerY + 48, {
        size: 11,
        color: 'rgba(234, 234, 234, 0.58)',
        align: 'center',
      });
    }

    renderMilitarySubTabs(nav = {}, x, y, width) {
      const labels = { army: '军队', scout: '侦察', world: '世界' };
      const tabs = nav.views || [];
      const gap = 6;
      const tabWidth = (width - gap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length);
      tabs.forEach((tab, index) => {
        const tabX = x + index * (tabWidth + gap);
        this.drawButton(tabX, y, tabWidth, 34, labels[tab.id] || tab.id, {
          size: 12,
          bold: true,
          radius: 9,
          disabled: tab.disabled,
          active: tab.isActive,
        });
        this.addHitTarget({ x: tabX, y, width: tabWidth, height: 34 }, {
          type: 'switchMilitaryView',
          view: tab.id,
          disabled: tab.disabled,
        });
      });
      return y + 46;
    }

    renderMilitaryArmyView(view = {}, x, y, width, height) {
      const cardHeight = Math.min(150, Math.max(126, height - 18));
      this.drawPanel(x, y, width, cardHeight, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawAsset('assets/art/icon-soldier-cutout.webp', x + 16, y + 24, 58, 72);
      const textX = x + 88;
      this.drawText('军队状态', textX, y + 16, { size: 14, bold: true, color: '#f6e8c8' });
      this.drawText(`士兵 ${view.text?.soldierCount || '0/0'}`, textX, y + 42, { size: 18, bold: true, color: '#74d3a0' });
      this.drawText(`防御 ${view.text?.militaryDefense ?? 0}`, textX, y + 68, { size: 12, color: '#cbbd96' });
      this.drawText(`可用 ${view.text?.availableSoldierCount ?? 0} · 出征中 ${view.text?.soldiersOnMission ?? 0}`, textX, y + 88, {
        size: 12,
        color: '#aeb0b8',
      });
      const progressY = y + cardHeight - 38;
      this.drawText(view.text?.soldierTrainingText || '等待兵营', x + 16, progressY - 18, { size: 12, color: '#cbbd96' });
      this.drawProgressBar(x + 16, progressY, width - 32, 12, parseFloat(view.training?.progressWidth || '0'));
    }

    getScoutButtonTone(cell = {}) {
      if (cell.status === 'ready') return { fill: 'rgba(40, 84, 62, 0.72)', stroke: 'rgba(116, 211, 160, 0.42)' };
      if (cell.status === 'active') return { fill: 'rgba(75, 58, 37, 0.66)', stroke: 'rgba(240, 180, 91, 0.28)' };
      if (cell.status === 'locked') return { fill: 'rgba(42, 40, 39, 0.62)', stroke: 'rgba(255, 255, 255, 0.08)' };
      return { fill: 'rgba(63, 47, 32, 0.78)', stroke: 'rgba(240, 180, 91, 0.25)' };
    }

    renderMilitaryScoutView(scout = {}, x, y, width, height) {
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      const statusLines = this.wrapTextLimit(scout.statusText || '', width - 28, 2, { size: 12 });
      this.drawTextLines(statusLines, x + 14, y + 14, { size: 12, color: '#cbbd96', lineHeight: 16 });

      const gridTop = y + 56;
      const gridSize = Math.min(width - 28, Math.max(210, Math.min(height - 70, 286)));
      const gridX = x + (width - gridSize) / 2;
      this.drawPanel(gridX, gridTop, gridSize, gridSize, {
        fill: 'rgba(18, 16, 13, 0.38)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 18,
      });
      const order = ['nw', 'n', 'ne', 'w', 'center', 'e', 'sw', 's', 'se'];
      const cellsById = new Map((scout.cells || []).map((cell) => [cell.id || cell.type, cell]));
      const cellGap = 7;
      const cellSize = (gridSize - 28 - cellGap * 2) / 3;
      order.forEach((id, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const cellX = gridX + 14 + col * (cellSize + cellGap);
        const cellY = gridTop + 14 + row * (cellSize + cellGap);
        const cell = id === 'center'
          ? { type: 'center', label: '城', subLabel: '本城' }
          : cellsById.get(id);
        if (!cell) return;
        if (cell.type === 'center') {
          this.drawPanel(cellX, cellY, cellSize, cellSize, {
            fill: 'rgba(75, 49, 25, 0.82)',
            stroke: 'rgba(240, 180, 91, 0.38)',
            radius: Math.min(22, cellSize / 2),
            inset: 'rgba(255, 231, 184, 0.12)',
          });
          this.drawText(cell.label || '城', cellX + cellSize / 2, cellY + cellSize / 2 - 7, {
            size: 18,
            bold: true,
            color: '#f0b45b',
            baseline: 'middle',
            align: 'center',
          });
          this.drawText(cell.subLabel || '本城', cellX + cellSize / 2, cellY + cellSize / 2 + 14, {
            size: 10,
            color: '#a0a0a0',
            baseline: 'middle',
            align: 'center',
          });
          return;
        }
        const tone = this.getScoutButtonTone(cell);
        this.drawPanel(cellX, cellY, cellSize, cellSize, {
          fill: tone.fill,
          stroke: tone.stroke,
          radius: 12,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(cell.label, cellX + cellSize / 2, cellY + cellSize / 2 - 8, {
          size: 13,
          bold: true,
          color: '#f6e8c8',
          baseline: 'middle',
          align: 'center',
        });
        this.drawText(cell.actionText, cellX + cellSize / 2, cellY + cellSize / 2 + 12, {
          size: 10,
          color: cell.status === 'ready' ? '#74d3a0' : '#aeb0b8',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: cellX, y: cellY, width: cellSize, height: cellSize }, {
          type: cell.action === 'claim' ? 'claimScout' : 'scoutTerritory',
          value: cell.actionValue,
          direction: cell.action === 'scout' ? cell.actionValue : undefined,
          missionId: cell.action === 'claim' ? cell.actionValue : undefined,
          disabled: cell.disabled || !cell.action,
        });
      });
    }

    renderWorldReports(reports = [], x, y, width, maxHeight) {
      this.drawText('侦察报告', x, y, { size: 13, bold: true, color: '#f6e8c8' });
      if (!reports.length) {
        this.drawTextLines(this.wrapTextLimit('暂无侦察报告。派出侦察队后，外部世界会从这里开始显现。', width, 2, { size: 11 }), x, y + 24, {
          size: 11,
          color: '#aeb0b8',
          lineHeight: 15,
        });
        return;
      }
      let cursorY = y + 24;
      reports.slice().reverse().slice(0, Math.max(1, Math.floor(maxHeight / 54))).forEach((report) => {
        this.drawPanel(x, cursorY, width, 48, {
          fill: 'rgba(0, 0, 0, 0.16)',
          stroke: 'rgba(240, 180, 91, 0.18)',
          radius: 9,
        });
        this.drawText(this.truncateText(report.title || '侦察报告', width - 20, { size: 12, bold: true }), x + 10, cursorY + 8, {
          size: 12,
          bold: true,
          color: '#f6e8c8',
        });
        this.drawText(this.truncateText(report.text || '', width - 20, { size: 11 }), x + 10, cursorY + 27, {
          size: 11,
          color: '#aeb0b8',
        });
        cursorY += 56;
      });
    }

    renderMilitaryWorldView(state = {}, x, y, width, height, options = {}) {
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const summary = this.presenter.buildTerritorySummaryViewState(territoryState);
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawText(summary.text?.polityName || '未命名势力', x + 14, y + 13, { size: 14, bold: true, color: '#f0b45b' });
      this.drawText(summary.text?.territoryCount || '0/0 已控制', x + width - 14, y + 15, {
        size: 11,
        color: '#74d3a0',
        align: 'right',
      });
      if ((state.currentEra || 0) < 5) {
        this.drawTextLines(this.wrapTextLimit('进入古典时代后，外部世界将在这里逐步显现。', width - 40, 3, { size: 13 }), x + 20, y + 70, {
          size: 13,
          color: '#cbbd96',
          lineHeight: 18,
        });
        return;
      }

      const territories = territoryState.territories || [];
      const radarView = this.presenter.buildWorldRadarViewState(territories, {
        panX: uiState.worldPanX || 0,
        panY: uiState.worldPanY || 0,
      });
      const radarSize = Math.min(width - 28, Math.max(190, Math.min(height - 140, 286)));
      const radarX = x + (width - radarSize) / 2;
      const radarY = y + 46;
      this.drawPanel(radarX, radarY, radarSize, radarSize, {
        fill: this.createGradient(
          radarX, radarY, radarX + radarSize, radarY + radarSize,
          [
            [0, 'rgba(39, 56, 42, 0.78)'],
            [1, 'rgba(18, 16, 13, 0.9)'],
          ],
          'rgba(24, 30, 24, 0.86)',
        ),
        stroke: 'rgba(240, 180, 91, 0.22)',
        radius: radarSize / 2,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.drawLine(radarX + radarSize / 2, radarY + 12, radarX + radarSize / 2, radarY + radarSize - 12, {
        color: 'rgba(240, 180, 91, 0.16)',
      });
      this.drawLine(radarX + 12, radarY + radarSize / 2, radarX + radarSize - 12, radarY + radarSize / 2, {
        color: 'rgba(240, 180, 91, 0.16)',
      });
      this.drawText('N', radarX + radarSize / 2, radarY + 12, { size: 10, color: '#d6b16e', align: 'center' });
      this.drawText('S', radarX + radarSize / 2, radarY + radarSize - 22, { size: 10, color: '#d6b16e', align: 'center' });
      this.drawText('W', radarX + 12, radarY + radarSize / 2 - 5, { size: 10, color: '#d6b16e' });
      this.drawText('E', radarX + radarSize - 18, radarY + radarSize / 2 - 5, { size: 10, color: '#d6b16e' });

      radarView.sites.forEach((site) => {
        const left = Math.max(8, Math.min(92, Number(site.position?.left) || 50));
        const top = Math.max(8, Math.min(92, Number(site.position?.top) || 50));
        const siteX = radarX + radarSize * left / 100 - 18;
        const siteY = radarY + radarSize * top / 100 - 18;
        const isSelected = uiState.selectedSiteId === site.id;
        this.drawPanel(siteX, siteY, 36, 36, {
          fill: isSelected ? 'rgba(116, 211, 160, 0.3)' : 'rgba(42, 35, 24, 0.86)',
          stroke: isSelected ? 'rgba(116, 211, 160, 0.76)' : 'rgba(240, 180, 91, 0.3)',
          radius: 18,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        if (!this.drawAsset(site.art, siteX + 5, siteY + 5, 26, 26)) {
          this.drawText('●', siteX + 18, siteY + 18, {
            size: 14,
            color: site.owner === 'player' ? '#74d3a0' : '#f0b45b',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.drawText(this.truncateText(site.name || site.title || '地点', 64, { size: 9 }), siteX + 18, siteY + 39, {
          size: 9,
          color: '#eaeaea',
          align: 'center',
        });
        this.addHitTarget({ x: siteX - 6, y: siteY - 6, width: 48, height: 54 }, { type: 'openWorldSite', siteId: site.id });
      });

      const resetW = 76;
      this.drawButton(radarX + radarSize - resetW - 8, radarY + 8, resetW, 28, '回到本城', { size: 11, radius: 14 });
      this.addHitTarget({ x: radarX + radarSize - resetW - 8, y: radarY + 8, width: resetW, height: 28 }, { type: 'resetWorldPan' });

      const reportsY = radarY + radarSize + 20;
      if (reportsY < y + height - 48) {
        this.renderWorldReports(territoryState.scoutReports || [], x + 14, reportsY, width - 28, y + height - reportsY - 10);
      }
    }

    renderWorldSiteAction(actionView = {}, x, y, width) {
      const buttons = actionView.buttons || [];
      if (!buttons.length) return y;
      const gap = 8;
      const buttonWidth = Math.max(72, (width - gap * (buttons.length - 1)) / Math.max(1, buttons.length));
      buttons.forEach((button, index) => {
        const buttonX = x + index * (buttonWidth + gap);
        this.drawButton(buttonX, y, buttonWidth, 34, button.label, {
          size: 12,
          radius: 8,
          disabled: button.disabled || !button.action,
          active: !button.secondary && !button.disabled && Boolean(button.action),
        });
        this.addHitTarget({ x: buttonX, y, width: buttonWidth, height: 34 }, {
          type: 'territoryAction',
          territoryId: button.territoryId,
          action: button.action,
          disabled: button.disabled || !button.action,
        });
      });
      return y + 44;
    }

    renderWorldExpeditionConfig(config = {}, x, y, width) {
      if (!config) return y;
      this.drawPanel(x, y, width, 94, {
        fill: 'rgba(0, 0, 0, 0.16)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 9,
      });
      this.drawText(`出征数量 ${config.fields?.soldiers?.value || 1}`, x + 12, y + 12, { size: 12, bold: true, color: '#f6e8c8' });
      this.drawText(config.note || '', x + 12, y + 34, { size: 10, color: '#aeb0b8' });
      const value = Number(config.fields?.soldiers?.value) || 1;
      const controlsY = y + 54;
      this.drawButton(x + 12, controlsY, 34, 28, '-', { size: 14, radius: 7, disabled: value <= 1 });
      this.drawButton(x + width - 46, controlsY, 34, 28, '+', { size: 14, radius: 7 });
      this.drawButton(x + width - 132, controlsY, 78, 28, config.buttons?.launch?.label || '出发', {
        size: 12,
        radius: 7,
        disabled: config.disabled,
        active: !config.disabled,
      });
      this.addHitTarget({ x: x + 12, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: -1,
        value: Math.max(1, value - 1),
        disabled: value <= 1,
      });
      this.addHitTarget({ x: x + width - 46, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: 1,
        value: value + 1,
      });
      this.addHitTarget({ x: x + width - 132, y: controlsY, width: 78, height: 28 }, {
        type: 'territoryAction',
        territoryId: config.siteId,
        action: config.buttons?.launch?.action || 'launch-expedition',
        disabled: config.disabled,
      });
      return y + 106;
    }

    renderWorldSiteModal(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildWorldSiteDialogViewState !== 'function') return;
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      const uiState = options.territoryUiState || {};
      const view = this.presenter.buildWorldSiteDialogViewState(territories, territoryState, uiState);
      if (!view.showModal) return;
      const detail = view.details.find((item) => item.id === view.selectedSiteId);
      if (!detail) return;

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeWorldSite' });
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 24, 360);
      const panelHeight = Math.min(500, this.height - 150);
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 12);
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
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeWorldSite' });

      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      this.drawAsset(selectedSite.art, x + 16, y + 20, 58, 58);
      this.drawText(this.truncateText(detail.text.name || '地点', panelWidth - 112, { size: 17, bold: true }), x + 84, y + 22, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(`${detail.text.status} · ${detail.text.owner}`, x + 84, y + 50, { size: 11, color: '#aeb0b8' });
      this.drawText(`${detail.text.distance} · ${detail.text.scale} · ${detail.text.threat}`, x + 84, y + 68, { size: 11, color: '#aeb0b8' });
      let cursorY = y + 94;
      const summaryLines = this.wrapTextLimit(detail.text.summary || '无', panelWidth - 32, 3, { size: 12 });
      this.drawTextLines(summaryLines, x + 16, cursorY, { size: 12, color: '#f6e8c8', lineHeight: 17 });
      cursorY += summaryLines.length * 17 + 12;
      this.drawText(`${detail.text.defense} · ${detail.text.soldiers}`, x + 16, cursorY, { size: 12, color: '#74d3a0' });
      cursorY += 22;
      if (detail.text.march) {
        this.drawText(detail.text.march, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (detail.text.note) {
        this.drawText(detail.text.note, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (detail.action?.hint) {
        const hintLines = this.wrapTextLimit(detail.action.hint, panelWidth - 32, 2, { size: 11 });
        this.drawTextLines(hintLines, x + 16, cursorY, { size: 11, color: '#aeb0b8', lineHeight: 15 });
        cursorY += hintLines.length * 15 + 10;
      }
      cursorY = this.renderWorldSiteAction(detail.action, x + 16, cursorY, panelWidth - 32);
      if (detail.action?.expeditionConfig) {
        this.renderWorldExpeditionConfig(detail.action.expeditionConfig, x + 16, cursorY, panelWidth - 32);
      }
    }

    renderMilitary(state = {}, startY = 210, panelHeight = 310, options = {}) {
      if (!this.presenter) return;
      const nav = this.presenter.buildMilitaryNavigationViewState(state);
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
      const contentTop = this.renderMilitarySubTabs(nav, x + 12, startY + 42, width - 24);
      const viewY = contentTop;
      const viewHeight = Math.max(120, startY + panelHeight - viewY - 12);
      if (nav.activeView === 'scout') {
        this.renderMilitaryScoutView(this.presenter.buildScoutControlViewState(state), x + 12, viewY, width - 24, viewHeight);
      } else if (nav.activeView === 'world') {
        this.renderMilitaryWorldView(state, x + 12, viewY, width - 24, viewHeight, options);
      } else {
        this.renderMilitaryArmyView(this.presenter.buildMilitaryViewState(state), x + 12, viewY, width - 24, viewHeight);
      }
    }

    renderMainPanel(state = {}, activeTab = 'resources', startY = 210, availableHeight = 310, options = {}) {
      if (activeTab === 'buildings') this.renderBuildings(state, startY, availableHeight, { offset: options.buildingOffset });
      else if (activeTab === 'events') this.renderEvents(state, startY, availableHeight);
      else if (activeTab === 'tech') this.renderTech(state, startY, availableHeight);
      else if (activeTab === 'civilization') this.renderCivilization(state, startY, availableHeight, options);
      else if (activeTab === 'military') this.renderMilitary(state, startY, availableHeight, options);
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

    renderNamingModal(naming = {}) {
      if (!naming || !naming.visible || !naming.view) return;
      const view = naming.view || {};
      const inputValue = String(naming.inputValue || '');
      const isSubmitting = Boolean(naming.submitting);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeNaming' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.54)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const panelHeight = 286;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 12);
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
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeNaming' });

      const iconSize = 58;
      const iconX = x + panelWidth / 2 - iconSize / 2;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawText('城', x + panelWidth / 2, iconY + iconSize / 2, {
        size: 22,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });

      this.drawText(this.truncateText(view.title || '命名', panelWidth - 84, { size: 17, bold: true }), x + panelWidth / 2, y + 98, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageLines = this.wrapTextLimit(view.message || '', panelWidth - 48, 2, { size: 13 });
      this.drawTextLines(messageLines, x + 24, y + 128, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 17,
      });

      const inputX = x + 18;
      const inputY = y + 174;
      const inputWidth = panelWidth - 36;
      const inputHeight = 42;
      this.drawPanel(inputX, inputY, inputWidth, inputHeight, {
        fill: 'rgba(23, 18, 13, 0.56)',
        stroke: 'rgba(116, 211, 160, 0.24)',
        radius: 9,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      const displayValue = inputValue || view.placeholder || '请输入名称';
      this.drawText(this.truncateText(displayValue, inputWidth - 24, { size: 14 }), inputX + 12, inputY + 21, {
        size: 14,
        color: inputValue ? '#f6e8c8' : 'rgba(234, 234, 234, 0.48)',
        baseline: 'middle',
      });
      this.addHitTarget({ x: inputX, y: inputY, width: inputWidth, height: inputHeight }, { type: 'requestNamingInput' });

      const buttonY = y + panelHeight - 52;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const cancelX = x + 18;
      const submitX = cancelX + buttonWidth + buttonGap;
      this.drawButton(cancelX, buttonY, buttonWidth, 36, '取消', { size: 13, radius: 9 });
      this.drawButton(submitX, buttonY, buttonWidth, 36, isSubmitting ? '提交中' : '确定', {
        size: 13,
        bold: true,
        radius: 9,
        active: true,
        disabled: isSubmitting || !inputValue.trim(),
      });
      this.addHitTarget({ x: cancelX, y: buttonY, width: buttonWidth, height: 36 }, { type: 'closeNaming' });
      this.addHitTarget(
        { x: submitX, y: buttonY, width: buttonWidth, height: 36 },
        { type: 'submitNaming', disabled: isSubmitting || !inputValue.trim() },
      );
    }

    renderFloatingTexts(effects = []) {
      if (!Array.isArray(effects) || !effects.length) return;
      const layout = this.getLayout();
      const centerX = layout.contentX + layout.contentWidth / 2;
      effects.slice(0, 4).forEach((effect, index) => {
        const progress = Math.max(0, Math.min(1, Number(effect.progress) || 0));
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Math.max(0, 1 - progress);
        const y = 128 - progress * 58 - index * 22;
        const text = this.truncateText(effect.text || '', layout.contentWidth - 52, { size: 15, bold: true });
        const textWidth = Math.min(layout.contentWidth - 36, Math.max(96, this.measureTextWidth(text, { size: 15, bold: true }) + 28));
        this.drawPanel(centerX - textWidth / 2, y - 8, textWidth, 30, {
          fill: 'rgba(16, 20, 14, 0.62)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          radius: 15,
          inset: 'rgba(116, 211, 160, 0.08)',
        });
        this.drawText(text, centerX, y + 7, {
          size: 15,
          bold: true,
          color: effect.color || '#74d3a0',
          baseline: 'middle',
          align: 'center',
        });
        if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      });
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
      } else if (activeTab === 'tech') {
        const tabsTop = this.height - 60 - this.bottomSafeArea;
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderTech(state, topBarBottom, availableHeight);
      } else if (activeTab === 'civilization') {
        const tabsTop = this.height - 60 - this.bottomSafeArea;
        const availableHeight = Math.max(360, tabsTop - topBarBottom - 12);
        this.renderCivilization(
          state,
          topBarBottom,
          availableHeight,
          { tutorial: options.tutorial || state.tutorial || {} },
        );
      } else if (activeTab === 'military') {
        const tabsTop = this.height - 60 - this.bottomSafeArea;
        const availableHeight = Math.max(360, tabsTop - topBarBottom - 12);
        this.renderMilitary(state, topBarBottom, availableHeight, options);
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
      if (activeTab === 'military') {
        this.renderWorldSiteModal(state, options);
      }
      if (options.naming) {
        this.renderNamingModal(options.naming);
      }
      this.renderFloatingTexts(options.floatingTexts || []);
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
      if (activeTab === 'military') this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
      this.renderFloatingTexts(options.floatingTexts || []);
    }
  }

  global.CanvasGameRenderer = CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
