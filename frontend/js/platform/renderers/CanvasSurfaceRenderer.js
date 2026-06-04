(function (global) {
  class CanvasSurfaceRenderer {
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

    createRadialGradient(x0, y0, r0, x1, y1, r1, stops = [], fallback = '#000') {
      if (!this.ctx || typeof this.ctx.createRadialGradient !== 'function') return fallback;
      const gradient = this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
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

    setHitTargets(targets = []) {
      this.hitTargets = targets;
    }

    addHitTarget(rect, action) {
      if (this.suppressHitTargets) return;
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
      let tutorialShieldAction = null;
      const tutorialAllowedActions = [];
      for (let index = this.hitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.hitTargets[index];
        if (
          x >= target.x
          && x <= target.x + target.width
          && y >= target.y
          && y <= target.y + target.height
        ) {
          if (target.action?.type === 'blockCanvasModal') {
            tutorialShieldAction = target.action;
            if (target.action.allowedAction) tutorialAllowedActions.push(target.action.allowedAction);
          } else if (tutorialShieldAction && !this.isAllowedUnderTutorialShield(target.action)) {
            return (
              tutorialAllowedActions.some((allowed) => this.matchesTutorialShieldAllowedAction(target.action, allowed))
              || this.matchesCurrentTutorialIntroAction(target.action)
            )
              ? target.action
              : tutorialShieldAction;
          } else if (target.action?.background) {
            backgroundAction = target.action;
          } else {
            return target.action;
          }
        }
      }
      if (tutorialShieldAction) return tutorialShieldAction;
      return backgroundAction;
    }

    containsPoint(rect = {}, point = {}) {
      const x = Number(point.x);
      const y = Number(point.y);
      return Number.isFinite(x)
        && Number.isFinite(y)
        && x >= Number(rect.x)
        && x <= Number(rect.x) + Number(rect.width)
        && y >= Number(rect.y)
        && y <= Number(rect.y) + Number(rect.height);
    }

    setHoverPoint(point = null) {
      if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
        this.hoverPoint = null;
        return false;
      }
      this.hoverPoint = { x: Number(point.x), y: Number(point.y) };
      return true;
    }

    isAllowedUnderTutorialShield(action = {}) {
      if (action.type === 'goToGuideTaskTarget') return true;
      if (action.type === 'openTaskCenter') {
        return action.source === 'taskIcon';
      }
      if (action.type === 'claimTaskReward' || action.type === 'claimGuideTaskReward') {
        return (action.category || 'main') === 'main';
      }
      return false;
    }

    matchesTutorialShieldAllowedAction(action = {}, allowed = null) {
      if (!action?.type || !allowed?.type || action.type !== allowed.type) return false;
      const getId = (item = {}) => item.cityId || item.territoryId || item.siteId || item.targetId || '';
      const allowedId = getId(allowed);
      const actionId = getId(action);
      return !allowedId || !actionId || allowedId === actionId;
    }

    matchesCurrentTutorialIntroAction(action = {}) {
      const intro = this.lastRenderOptions?.tutorialIntro || null;
      if (!intro?.active || !action?.type) return false;
      const capitalCityId = intro.capitalCityId || 'capital';
      const actionId = action.cityId || action.territoryId || action.siteId || '';
      if (intro.step === 'city') {
        return action.type === 'openWorldSite' && (!actionId || actionId === capitalCityId);
      }
      if (intro.step === 'enter') {
        return action.type === 'enterCity' && (!actionId || actionId === capitalCityId);
      }
      return false;
    }

    withSuppressedHitTargets(callback) {
      const previous = this.suppressHitTargets;
      this.suppressHitTargets = true;
      try {
        return callback?.();
      } finally {
        this.suppressHitTargets = previous;
      }
    }

    withSlideClip(x, y, width, height, offsetX, callback) {
      return this.withTranslatedClip(x, y, width, height, offsetX, 0, callback);
    }

    withTranslatedClip(x, y, width, height, offsetX = 0, offsetY = 0, callback) {
      if (!this.ctx || typeof callback !== 'function') return callback?.();
      const canClip = typeof this.ctx.save === 'function'
        && typeof this.ctx.restore === 'function'
        && typeof this.ctx.beginPath === 'function'
        && typeof this.ctx.rect === 'function'
        && typeof this.ctx.clip === 'function';
      if (!canClip) return callback();
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();
      if (typeof this.ctx.translate === 'function') this.ctx.translate(offsetX, offsetY);
      try {
        return callback();
      } finally {
        this.ctx.restore();
      }
    }

    withTransformedClip(x, y, width, height, offsetX = 0, offsetY = 0, scale = 1, callback) {
      if (!this.ctx || typeof callback !== 'function') return callback?.();
      const canClip = typeof this.ctx.save === 'function'
        && typeof this.ctx.restore === 'function'
        && typeof this.ctx.beginPath === 'function'
        && typeof this.ctx.rect === 'function'
        && typeof this.ctx.clip === 'function';
      if (!canClip) return callback();
      const safeScale = Math.max(0.01, Number(scale) || 1);
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();
      if (typeof this.ctx.translate === 'function') this.ctx.translate(x + offsetX, y + offsetY);
      if (typeof this.ctx.scale === 'function') this.ctx.scale(safeScale, safeScale);
      if (typeof this.ctx.translate === 'function') this.ctx.translate(-x, -y);
      try {
        return callback();
      } finally {
        this.ctx.restore();
      }
    }

    clear() {
      if (!this.ctx) return;
      const hudTopY = 0;
      const hudBottomY = Math.max(0, this.height - 72);
      this.ctx.clearRect(0, hudTopY, this.width, hudBottomY - hudTopY);
      this.ctx.clearRect(0, hudBottomY, this.width, this.height - hudBottomY);
    }

    clearAll() {
      if (!this.ctx || typeof this.ctx.clearRect !== 'function') return;
      this.ctx.clearRect(0, 0, this.width, this.height);
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

    drawPolyline(points = [], options = {}) {
      if (!this.ctx || points.length < 2) return;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => this.ctx.lineTo(point.x, point.y));
      this.ctx.stroke();
    }

    drawCurvePath(path = {}, options = {}) {
      if (!this.ctx || !path.start || !path.end) return;
      const previousLineCap = this.ctx.lineCap;
      const previousLineJoin = this.ctx.lineJoin;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.lineCap = options.lineCap || 'round';
      this.ctx.lineJoin = options.lineJoin || 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(path.start.x, path.start.y);
      if (typeof this.ctx.bezierCurveTo === 'function' && path.c1 && path.c2) {
        this.ctx.bezierCurveTo(path.c1.x, path.c1.y, path.c2.x, path.c2.y, path.end.x, path.end.y);
      } else {
        this.ctx.lineTo(path.end.x, path.end.y);
      }
      this.ctx.stroke();
      if (previousLineCap !== undefined) this.ctx.lineCap = previousLineCap;
      if (previousLineJoin !== undefined) this.ctx.lineJoin = previousLineJoin;
    }

    drawCircle(x, y, radius, options = {}) {
      if (!this.ctx || typeof this.ctx.arc !== 'function') return;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (options.fill) {
        this.ctx.fillStyle = options.fill;
        this.ctx.fill();
      }
      if (options.stroke) {
        this.ctx.strokeStyle = options.stroke;
        this.ctx.lineWidth = options.width || 1;
        this.ctx.stroke();
      }
    }

    beginFrame(options = {}) {
      const optionNow = Number(options.now);
      const now = Number.isFinite(optionNow) ? optionNow : Date.now();
      this.frameNow = now;
      this.lastRenderOptions = options || {};
      this.famousSkillHitTargets = [];
      this.activeFamousSkillTooltip = null;
      this.updateFps(now);
      return now;
    }

    endFrame(options = {}) {
      this.renderFpsOverlay(options);
      this.frameNow = 0;
    }

    getNow() {
      return this.frameNow || Date.now();
    }

    updateFps(now = Date.now()) {
      const timestamp = Number(now);
      if (!Number.isFinite(timestamp)) return this.currentFps;
      if (!this.fpsLastFrameAt) {
        this.fpsLastFrameAt = timestamp;
        this.fpsLastPaintAt = timestamp;
        return this.currentFps;
      }
      const delta = Math.max(4, timestamp - this.fpsLastFrameAt);
      this.fpsLastFrameAt = timestamp;
      if (delta > 250) return this.currentFps;
      const fps = Math.min(120, 1000 / delta);
      this.fpsSamples.push(fps);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
      const average = this.fpsSamples.reduce((sum, value) => sum + value, 0) / this.fpsSamples.length;
      this.currentFps = Math.round(average >= 58 && average <= 64 ? 60 : average);
      return this.currentFps;
    }

    renderFpsOverlay(options = {}) {
      if (!this.showFpsOverlay || options.showFpsOverlay === false || !this.ctx) return;
      const now = this.getNow();
      if (!this.fpsLastPaintAt || now - this.fpsLastPaintAt >= 180 || (!this.fpsLastPaintedValue && this.currentFps)) {
        this.fpsLastPaintAt = now;
        this.fpsLastPaintedValue = Math.max(0, Math.round(Number(options.fps ?? this.currentFps) || 0));
      }
      const fps = this.fpsLastPaintedValue;
      const label = fps ? `FPS ${fps}` : 'FPS --';
      const width = Math.max(66, Math.min(84, Math.ceil(this.measureTextWidth(label, { size: 11, bold: true }) + 18)));
      const color = fps >= 55 ? '#74d3a0' : (fps >= 30 ? '#ffd98a' : '#ff6b6b');
      this.drawPanel(8, 8, width, 22, {
        fill: 'rgba(11, 18, 14, 0.72)',
        stroke: 'rgba(255, 226, 177, 0.16)',
        radius: 6,
        inset: 'rgba(255, 255, 255, 0.03)',
      });
      this.drawText(label, 17, 19, {
        size: 11,
        bold: true,
        color,
        baseline: 'middle',
      });
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

    drawPrimaryActionButton(x, y, width, height, label, options = {}) {
      if (!this.ctx) return;
      const disabled = Boolean(options.disabled);
      const radius = options.radius || Math.min(10, Math.floor(height / 2));
      const fill = disabled
        ? 'rgba(60, 52, 46, 0.72)'
        : this.createGradient(
          x, y, x, y + height,
          [
            [0, 'rgba(247, 202, 104, 0.98)'],
            [1, 'rgba(176, 92, 39, 0.98)'],
          ],
          'rgba(214, 137, 58, 0.98)',
        );
      this.drawPanel(x, y, width, height, {
        fill,
        stroke: disabled ? 'rgba(240, 180, 91, 0.22)' : 'rgba(255, 235, 166, 0.82)',
        radius,
        inset: disabled ? 'rgba(255, 231, 184, 0.06)' : 'rgba(255, 252, 218, 0.22)',
      });
      if (!disabled) {
        this.drawLine(x + 9, y + 4, x + width - 9, y + 4, { color: 'rgba(255, 255, 220, 0.5)' });
        this.drawLine(x + 10, y + height - 3, x + width - 10, y + height - 3, { color: 'rgba(80, 36, 18, 0.28)' });
      }
      this.drawText(label, x + width / 2, y + height / 2, {
        color: disabled ? '#8d8f99' : '#24170e',
        size: options.size || 13,
        bold: true,
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

    getTopBarBottom(state = {}, options = {}) {
      if (options.isMapHome) return 72;
      if (!this.presenter) return 84;
      const cityView = this.presenter.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      return 12 + (cityView.hidden ? 128 : 166) + 12;
    }
  }

  global.CanvasSurfaceRenderer = CanvasSurfaceRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasSurfaceRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
