// CaptureCanvasRenderer — draws the ②b capture-decision modal (斩杀/招降/放生) on canvas. Parallel to
// EventCanvasRenderer: gets its draw primitives from host/drawingSurface, builds the view via
// CapturePresenter, and registers hit targets so a button click dispatches { type:'resolveCapture',
// decisionId, choice }. Fail-closed: no ctx / no pending decision → draws nothing.
(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('../../ecs/resource/LocaleText'); } catch (_e) { return null; }
    }
    return null;
  })();
  const CapturePresenter = (() => {
    if (global.CapturePresenter) return global.CapturePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('../../state/presenters/CapturePresenter'); } catch (_e) { return null; }
    }
    return null;
  })();

  const BUTTON_TONE_FILL = {
    danger: 'rgba(150, 52, 40, 0.95)',
    primary: 'rgba(58, 104, 74, 0.95)',
    neutral: 'rgba(70, 62, 48, 0.95)',
  };

  class CaptureCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get width() { return Number(this.host && this.host.width) || 0; }
    get height() { return Number(this.host && this.host.height) || 0; }
    get ctx() { return this.host && this.host.ctx; }

    surfaceCall(name, args) {
      const surface = this.drawingSurface;
      if (surface && typeof surface[name] === 'function') return surface[name](...args);
      return this.host && typeof this.host[name] === 'function' ? this.host[name](...args) : undefined;
    }
    addHitTarget(...a) { return this.surfaceCall('addHitTarget', a); }
    createGradient(...a) { return this.surfaceCall('createGradient', a); }
    drawPanel(...a) { return this.surfaceCall('drawPanel', a); }
    drawButton(...a) { return this.surfaceCall('drawButton', a); }
    getLayout(...a) { return this.surfaceCall('getLayout', a); }

    t(key = '', params = {}) { return LocaleText ? LocaleText.t(key, params) : key; }

    renderCaptureModal(state = {}, activeDecisionId = null) {
      if (!CapturePresenter) return;
      const view = CapturePresenter.buildCaptureModalViewState(state, activeDecisionId);
      if (!view.showModal) return;

      const width = this.width;
      const height = this.height;
      // Must-choose modal: the full-screen scrim BLOCKS background input (a captive must be
      // dispositioned via one of the three buttons — there is no dismiss).
      this.addHitTarget({ x: 0, y: 0, width, height }, { type: 'blockCanvasModal' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
        this.ctx.fillRect(0, 0, width, height);
      }

      const layout = this.getLayout() || { contentWidth: width };
      const panelWidth = Math.min(360, (layout.contentWidth || width) - 16);
      const panelHeight = Math.min(height - 96, 300);
      const x = (width - panelWidth) / 2;
      const y = Math.max(48, (height - panelHeight) / 2 - 8);

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(x, y, x, y + panelHeight,
          [[0, 'rgba(54, 39, 26, 0.98)'], [1, 'rgba(22, 18, 13, 0.98)']],
          'rgba(36, 28, 20, 0.98)'),
        stroke: 'rgba(255, 226, 177, 0.24)', radius: 14, inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const ctx = this.ctx;
      if (ctx) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 231, 184, 0.96)';
        ctx.font = '600 18px sans-serif';
        ctx.fillText(view.title, x + panelWidth / 2, y + 40);
        ctx.fillStyle = 'rgba(255, 246, 224, 0.98)';
        ctx.font = '700 22px sans-serif';
        ctx.fillText(view.subtitle, x + panelWidth / 2, y + 76);
        ctx.fillStyle = 'rgba(210, 226, 196, 0.95)';
        ctx.font = '500 15px sans-serif';
        ctx.fillText(view.recruitChanceText, x + panelWidth / 2, y + 104);
        ctx.fillStyle = 'rgba(226, 214, 190, 0.85)';
        ctx.font = '400 13px sans-serif';
        ctx.fillText(view.hint, x + panelWidth / 2, y + 130);
        ctx.textAlign = 'left';
      }

      // three stacked choice buttons
      const btnW = panelWidth - 44;
      const btnH = 40;
      const btnX = x + 22;
      let btnY = y + 150;
      for (const btn of view.buttons) {
        this.drawButton(btnX, btnY, btnW, btnH, btn.label, {
          size: 16, radius: 9, fill: BUTTON_TONE_FILL[btn.tone] || BUTTON_TONE_FILL.neutral,
        });
        this.addHitTarget({ x: btnX, y: btnY, width: btnW, height: btnH },
          { type: 'resolveCapture', decisionId: view.id, choice: btn.choice });
        btnY += btnH + 8;
      }
    }
  }

  global.CaptureCanvasRenderer = CaptureCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CaptureCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
