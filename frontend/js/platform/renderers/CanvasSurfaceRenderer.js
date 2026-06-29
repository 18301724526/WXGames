(function (global) {
  const TextLayout = global.CanvasSurfaceTextLayout || (() => {
    if (typeof require === 'function') {
      try {
        return require('./CanvasSurfaceTextLayout');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const HitTargets = global.CanvasSurfaceHitTargets || (() => {
    if (typeof require === 'function') {
      try {
        return require('./CanvasSurfaceHitTargets');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasSurfaceRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.localHitTargets = [];
      this.localFpsSamples = [];
    }
    get ctx() { return this.host?.ctx || null; }
    get width() { return Number(this.host?.width) || 0; }
    get height() { return Number(this.host?.height) || 0; }
    get maxContentWidth() { return Number(this.host?.maxContentWidth) || 480; }
    get edgePadding() { return Number(this.host?.edgePadding) || 12; }
    get presenter() { return this.host?.presenter || null; }
    get hitTargets() {
      if (!this.host) return this.localHitTargets;
      if (!Array.isArray(this.host.hitTargets)) this.host.hitTargets = [];
      return this.host.hitTargets;
    }
    set hitTargets(value) { if (this.host) this.host.hitTargets = Array.isArray(value) ? value : []; else this.localHitTargets = Array.isArray(value) ? value : []; }
    get suppressHitTargets() { return Boolean(this.host?.suppressHitTargets); }
    set suppressHitTargets(value) { if (this.host) this.host.suppressHitTargets = Boolean(value); }
    get lastRenderOptions() { return this.host?.lastRenderOptions || null; }
    set lastRenderOptions(value) { if (this.host) this.host.lastRenderOptions = value || {}; }
    get hoverPoint() { return this.host?.hoverPoint || null; }
    set hoverPoint(value) { if (this.host) this.host.hoverPoint = value || null; }
    get famousSkillHitTargets() { return this.host?.famousSkillHitTargets || []; }
    set famousSkillHitTargets(value) { if (this.host) this.host.famousSkillHitTargets = Array.isArray(value) ? value : []; }
    get activeFamousSkillTooltip() { return this.host?.activeFamousSkillTooltip || null; }
    set activeFamousSkillTooltip(value) { if (this.host) this.host.activeFamousSkillTooltip = value || null; }
    get frameNow() { return Number(this.host?.frameNow) || 0; }
    set frameNow(value) { if (this.host) this.host.frameNow = Number(value) || 0; }
    get fpsLastFrameAt() { return Number(this.host?.fpsLastFrameAt) || 0; }
    set fpsLastFrameAt(value) { if (this.host) this.host.fpsLastFrameAt = Number(value) || 0; }
    get fpsLastPaintAt() { return Number(this.host?.fpsLastPaintAt) || 0; }
    set fpsLastPaintAt(value) { if (this.host) this.host.fpsLastPaintAt = Number(value) || 0; }
    get fpsLastPaintedValue() { return Number(this.host?.fpsLastPaintedValue) || 0; }
    set fpsLastPaintedValue(value) { if (this.host) this.host.fpsLastPaintedValue = Number(value) || 0; }
    get fpsSamples() {
      if (!this.host) return this.localFpsSamples;
      if (!Array.isArray(this.host.fpsSamples)) this.host.fpsSamples = [];
      return this.host.fpsSamples;
    }
    set fpsSamples(value) { if (this.host) this.host.fpsSamples = Array.isArray(value) ? value : []; else this.localFpsSamples = Array.isArray(value) ? value : []; }
    get currentFps() { return Number(this.host?.currentFps) || 0; }
    set currentFps(value) { if (this.host) this.host.currentFps = Number(value) || 0; }
    get showFpsOverlay() { return this.host?.showFpsOverlay !== false; }

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
      const target = HitTargets.normalizeHitTarget(rect, action);
      if (target) this.hitTargets.push(target);
    }

    getHitTarget(point = {}) {
      return HitTargets.resolveHitTarget(this.hitTargets, point, this.lastRenderOptions?.tutorialIntro || null);
    }

    containsPoint(rect = {}, point = {}) {
      return HitTargets.containsPoint(rect, point);
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
      return HitTargets.isAllowedUnderTutorialShield(action);
    }

    matchesTutorialShieldAllowedAction(action = {}, allowed = null) {
      return HitTargets.matchesTutorialShieldAllowedAction(action, allowed);
    }

    matchesCurrentTutorialIntroAction(action = {}) {
      return HitTargets.matchesCurrentTutorialIntroAction(action, this.lastRenderOptions?.tutorialIntro || null);
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
      this.ctx.font = TextLayout?.buildFont
        ? TextLayout.buildFont(options)
        : `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
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
      return TextLayout.wrapText(this.ctx, text, maxWidth, options);
    }

    measureTextWidth(text, options = {}) {
      return TextLayout.measureTextWidth(this.ctx, text, options);
    }

    truncateText(text, maxWidth, options = {}) {
      return TextLayout.truncateText(this.ctx, text, maxWidth, options);
    }

    wrapTextLimit(text, maxWidth, maxLines, options = {}) {
      return TextLayout.wrapTextLimit(this.ctx, text, maxWidth, maxLines, options);
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
      if (this.host && typeof this.host === 'object') {
        this.host.frameNow = now;
        this.host.lastRenderOptions = this.lastRenderOptions;
        if (options.epochNowMs !== undefined) this.host.epochNowMs = options.epochNowMs;
        if (options.serverNowMs !== undefined) this.host.serverNowMs = options.serverNowMs;
      }
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
    drawAsset(...args) {
      return this.host?.drawAsset?.(...args) || false;
    }
  }

  global.CanvasSurfaceRenderer = CanvasSurfaceRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasSurfaceRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
