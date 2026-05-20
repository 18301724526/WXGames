(function (global) {
  class H5UpdateRuntimeAdapter {
    constructor(runtime = global, options = {}) {
      this.runtime = runtime || {};
      this.document = options.document || this.runtime.document || null;
      this.confirm = options.confirm
        || (typeof this.runtime.confirm === 'function' ? this.runtime.confirm.bind(this.runtime) : null)
        || (() => true);
      this.caches = options.caches || this.runtime.caches || null;
      this.navigator = options.navigator || this.runtime.navigator || null;
      this.location = options.location || this.runtime.location || null;
      this.URLCtor = options.URL || this.runtime.URL || null;
      this.now = options.now || (() => Date.now());
      this.promptCanvas = null;
      this.promptContext = null;
      this.promptPixelRatio = 1;
      this.promptButtonRect = null;
      this.promptVisible = false;
      this.promptResolve = null;
      this.promptVersion = null;
      this.handlePromptPointer = this.handlePromptPointer.bind(this);
      this.handlePromptResize = this.handlePromptResize.bind(this);
      this.handlePromptKeydown = this.handlePromptKeydown.bind(this);
    }

    static fromRuntime(runtime = global, options = {}) {
      return new H5UpdateRuntimeAdapter(runtime, options);
    }

    buildMessage(version) {
      return `游戏有更新，需要重启后继续。${version?.version ? `\n版本：${version.version}` : ''}`;
    }

    getViewportSize() {
      const docElement = this.document?.documentElement || {};
      const width = this.runtime.innerWidth || docElement.clientWidth || 390;
      const height = this.runtime.innerHeight || docElement.clientHeight || 844;
      return {
        width: Math.max(320, Math.floor(width)),
        height: Math.max(320, Math.floor(height)),
      };
    }

    ensurePromptCanvas() {
      if (this.promptCanvas) return this.promptCanvas;
      if (!this.document || typeof this.document.createElement !== 'function' || !this.document.body) return null;
      const canvas = this.document.createElement('canvas');
      if (!canvas || typeof canvas.getContext !== 'function') return null;
      canvas.width = 1;
      canvas.height = 1;
      canvas.setAttribute?.('aria-hidden', 'true');
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.display = 'none';
      canvas.style.zIndex = '9999';
      canvas.style.pointerEvents = 'auto';
      canvas.style.touchAction = 'none';
      canvas.style.background = 'transparent';
      canvas.addEventListener?.('click', this.handlePromptPointer);
      canvas.addEventListener?.('touchend', this.handlePromptPointer, { passive: false });
      this.document.body.appendChild(canvas);
      const resizeHost = this.runtime.addEventListener ? this.runtime : this.document.defaultView;
      resizeHost?.addEventListener?.('resize', this.handlePromptResize);
      resizeHost?.addEventListener?.('keydown', this.handlePromptKeydown);
      this.promptCanvas = canvas;
      this.promptContext = canvas.getContext('2d');
      return this.promptCanvas;
    }

    resizePromptCanvas() {
      const canvas = this.ensurePromptCanvas();
      const ctx = this.promptContext;
      if (!canvas || !ctx) return false;
      const viewport = this.getViewportSize();
      this.promptPixelRatio = Math.max(1, this.runtime.devicePixelRatio || this.runtime.pixelRatio || 1);
      canvas.width = Math.floor(viewport.width * this.promptPixelRatio);
      canvas.height = Math.floor(viewport.height * this.promptPixelRatio);
      if (typeof ctx.setTransform === 'function') ctx.setTransform(this.promptPixelRatio, 0, 0, this.promptPixelRatio, 0, 0);
      else if (typeof ctx.scale === 'function') ctx.scale(this.promptPixelRatio, this.promptPixelRatio);
      return true;
    }

    createGradient(x0, y0, x1, y1, stops = [], fallback = '#000') {
      const ctx = this.promptContext;
      if (!ctx || typeof ctx.createLinearGradient !== 'function') return fallback;
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      return gradient;
    }

    roundRectPath(x, y, width, height, radius = 12) {
      const ctx = this.promptContext;
      if (!ctx) return;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, radius);
      else ctx.rect(x, y, width, height);
    }

    drawPanel(x, y, width, height, options = {}) {
      const ctx = this.promptContext;
      if (!ctx) return;
      ctx.fillStyle = options.fill || 'rgba(37, 29, 21, 0.96)';
      ctx.strokeStyle = options.stroke || 'rgba(255, 226, 177, 0.24)';
      ctx.lineWidth = options.lineWidth || 1;
      this.roundRectPath(x, y, width, height, options.radius || 16);
      ctx.fill();
      ctx.stroke();
      if (options.inset) {
        ctx.strokeStyle = options.inset;
        this.roundRectPath(x + 2, y + 2, width - 4, height - 4, Math.max(6, (options.radius || 16) - 2));
        ctx.stroke();
      }
    }

    drawText(text, x, y, options = {}) {
      const ctx = this.promptContext;
      if (!ctx) return;
      ctx.fillStyle = options.color || '#f6e8c8';
      ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      ctx.textBaseline = options.baseline || 'top';
      ctx.textAlign = options.align || 'left';
      ctx.fillText(String(text ?? ''), x, y);
      ctx.textAlign = 'left';
    }

    measureText(text, options = {}) {
      const ctx = this.promptContext;
      if (!ctx) return (String(text ?? '').length || 1) * ((options.size || 14) * 0.65);
      ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      return ctx.measureText(String(text ?? '')).width;
    }

    wrapText(text, maxWidth, options = {}) {
      const content = String(text ?? '');
      const rawLines = content.split('\n');
      const lines = [];
      rawLines.forEach((rawLine) => {
        if (!rawLine) {
          lines.push('');
          return;
        }
        let buffer = '';
        for (const char of rawLine) {
          const next = buffer + char;
          if (buffer && this.measureText(next, options) > maxWidth) {
            lines.push(buffer);
            buffer = char;
          } else {
            buffer = next;
          }
        }
        if (buffer) lines.push(buffer);
      });
      return lines;
    }

    drawButton(x, y, width, height, label) {
      const ctx = this.promptContext;
      if (!ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: this.createGradient(
          x,
          y,
          x,
          y + height,
          [
            [0, '#f0b45b'],
            [0.5, '#d78332'],
            [1, '#9a5624'],
          ],
          '#d78332',
        ),
        stroke: 'rgba(255, 236, 195, 0.68)',
        inset: 'rgba(255, 245, 218, 0.26)',
        radius: height / 2,
      });
      ctx.fillStyle = 'rgba(86, 43, 16, 0.24)';
      this.roundRectPath(x + 6, y + 6, width - 12, Math.max(8, height * 0.36), Math.max(8, height / 2 - 8));
      ctx.fill();
      this.drawText(label, x + width / 2, y + height / 2, {
        size: 16,
        bold: true,
        color: '#fff5df',
        align: 'center',
        baseline: 'middle',
      });
    }

    drawPrompt(version) {
      const ctx = this.promptContext;
      const canvas = this.promptCanvas;
      if (!ctx || !canvas) return false;
      const viewport = this.getViewportSize();
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      ctx.fillStyle = 'rgba(11, 8, 6, 0.72)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      const panelWidth = Math.min(420, viewport.width - 32);
      const panelHeight = 270;
      const panelX = Math.floor((viewport.width - panelWidth) / 2);
      const panelY = Math.max(48, Math.floor((viewport.height - panelHeight) / 2));
      const buttonWidth = Math.min(panelWidth - 32, 190);
      const buttonHeight = 46;
      const buttonX = panelX + Math.floor((panelWidth - buttonWidth) / 2);
      const buttonY = panelY + panelHeight - 74;
      this.promptButtonRect = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };

      this.drawPanel(panelX, panelY, panelWidth, panelHeight, {
        fill: this.createGradient(
          panelX,
          panelY,
          panelX,
          panelY + panelHeight,
          [
            [0, 'rgba(74, 51, 34, 0.98)'],
            [0.55, 'rgba(43, 29, 20, 0.98)'],
            [1, 'rgba(25, 18, 13, 0.99)'],
          ],
          'rgba(43, 29, 20, 0.98)',
        ),
        stroke: 'rgba(240, 180, 91, 0.55)',
        inset: 'rgba(255, 238, 203, 0.14)',
        radius: 18,
        lineWidth: 1.2,
      });

      ctx.fillStyle = this.createGradient(
        panelX + 20,
        panelY + 18,
        panelX + panelWidth - 20,
        panelY + 18,
        [
          [0, 'rgba(240, 180, 91, 0.05)'],
          [0.5, 'rgba(240, 180, 91, 0.32)'],
          [1, 'rgba(240, 180, 91, 0.05)'],
        ],
        'rgba(240, 180, 91, 0.12)',
      );
      ctx.fillRect(panelX + 18, panelY + 56, panelWidth - 36, 1);

      ctx.fillStyle = 'rgba(240, 180, 91, 0.16)';
      ctx.beginPath();
      ctx.arc(panelX + panelWidth / 2, panelY + 38, 18, 0, Math.PI * 2);
      ctx.fill();
      this.drawText('更', panelX + panelWidth / 2, panelY + 22, {
        size: 20,
        bold: true,
        color: '#f0b45b',
        align: 'center',
      });

      this.drawText('发现新版本', panelX + panelWidth / 2, panelY + 68, {
        size: 22,
        bold: true,
        color: '#f6e8c8',
        align: 'center',
      });

      const bodyLines = this.wrapText('游戏有更新，需要重新载入后继续。', panelWidth - 56, {
        size: 15,
      });
      bodyLines.forEach((line, index) => {
        this.drawText(line, panelX + panelWidth / 2, panelY + 112 + index * 24, {
          size: 15,
          color: '#d9c8a0',
          align: 'center',
        });
      });

      if (version?.version) {
        this.drawText(`版本 ${version.version}`, panelX + panelWidth / 2, panelY + 162, {
          size: 14,
          color: '#f0b45b',
          bold: true,
          align: 'center',
        });
      }

      this.drawText('为保证资源与状态一致，点击按钮后立即重载。', panelX + panelWidth / 2, panelY + 190, {
        size: 13,
        color: '#b9a98a',
        align: 'center',
      });

      this.drawButton(buttonX, buttonY, buttonWidth, buttonHeight, '立即更新');
      return true;
    }

    handlePromptResize() {
      if (!this.promptVisible) return;
      if (!this.resizePromptCanvas()) return;
      this.drawPrompt(this.promptVersion);
    }

    handlePromptKeydown(event) {
      if (!this.promptVisible) return;
      const key = event?.key || '';
      if (!['Enter', ' ', 'Spacebar'].includes(key)) return;
      event.preventDefault?.();
      this.closePrompt(true);
    }

    isPointInsideRect(x, y, rect) {
      return Boolean(
        rect
        && x >= rect.x
        && x <= rect.x + rect.width
        && y >= rect.y
        && y <= rect.y + rect.height
      );
    }

    getPointerPosition(event) {
      const canvas = this.promptCanvas;
      if (!canvas) return null;
      const rect = typeof canvas.getBoundingClientRect === 'function'
        ? canvas.getBoundingClientRect()
        : { left: 0, top: 0, width: this.getViewportSize().width, height: this.getViewportSize().height };
      const point = event?.changedTouches?.[0] || event;
      if (!point) return null;
      const scaleX = rect.width ? this.getViewportSize().width / rect.width : 1;
      const scaleY = rect.height ? this.getViewportSize().height / rect.height : 1;
      return {
        x: (Number(point.clientX) - rect.left) * scaleX,
        y: (Number(point.clientY) - rect.top) * scaleY,
      };
    }

    handlePromptPointer(event) {
      if (!this.promptVisible) return;
      const point = this.getPointerPosition(event);
      if (!point || !this.isPointInsideRect(point.x, point.y, this.promptButtonRect)) return;
      event.preventDefault?.();
      this.closePrompt(true);
    }

    closePrompt(result) {
      if (!this.promptVisible) return;
      this.promptVisible = false;
      this.promptVersion = null;
      this.promptButtonRect = null;
      if (this.promptCanvas) this.promptCanvas.style.display = 'none';
      const resolve = this.promptResolve;
      this.promptResolve = null;
      if (resolve) resolve(result);
    }

    async showCanvasPrompt(version) {
      const canvas = this.ensurePromptCanvas();
      if (!canvas || !this.resizePromptCanvas()) return false;
      this.promptVisible = true;
      this.promptVersion = version || null;
      canvas.style.display = 'block';
      this.drawPrompt(version);
      return new Promise((resolve) => {
        this.promptResolve = resolve;
      });
    }

    async clearCaches() {
      if (this.caches?.keys) {
        const keys = await this.caches.keys();
        await Promise.all(keys.map((key) => this.caches.delete(key)));
      }
      const serviceWorker = this.navigator?.serviceWorker;
      if (serviceWorker?.getRegistrations) {
        const registrations = await serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    }

    buildReloadUrl() {
      const href = this.location?.href || '';
      if (!href) return `?reload=${this.now()}`;
      if (this.URLCtor) {
        try {
          const url = new this.URLCtor(href);
          url.searchParams.set('reload', this.now().toString());
          return url.toString();
        } catch (error) {
          // Some embedded runtimes only expose a partial URL implementation.
        }
      }
      const separator = href.includes('?') ? '&' : '?';
      return `${href}${separator}reload=${this.now()}`;
    }

    async forceReload() {
      await this.clearCaches().catch(() => {});
      const nextUrl = this.buildReloadUrl();
      if (this.location?.replace) this.location.replace(nextUrl);
      return nextUrl;
    }

    async promptAndReload(version) {
      const canvasHandled = await this.showCanvasPrompt(version);
      if (!canvasHandled) {
        const message = this.buildMessage(version);
        try {
          this.confirm(message);
        } catch (error) {
          // Reload is mandatory once a deployment change is detected.
        }
      }
      return this.forceReload();
    }
  }

  global.H5UpdateRuntimeAdapter = H5UpdateRuntimeAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5UpdateRuntimeAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
