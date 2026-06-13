(function (global) {
  class TutorialGuideTargetResolver {
    constructor(options = {}) {
      this.host = options.host || options.controller || null;
    }

    getGame() {
      return this.host?.game || null;
    }

    getShell() {
      return this.getGame()?.canvasShell || null;
    }

    getActiveRenderTab() {
      const game = this.getGame();
      return game?.state?.currentTab || game?.activeTab || 'military';
    }

    getCanvasTarget(type, predicate = null) {
      return this.getShell()?.getCanvasTarget?.(type, predicate) || null;
    }

    showHighlight(type, predicate, message, allowedAction, options = {}) {
      const game = this.getGame();
      const shell = this.getShell();
      let target = this.getCanvasTarget(type, predicate);
      if (!target && this.host && !this.host.retryingHighlightAfterRender) {
        this.host.retryingHighlightAfterRender = true;
        game?.renderCanvasSurface?.(this.getActiveRenderTab());
        target = this.getCanvasTarget(type, predicate);
        this.host.retryingHighlightAfterRender = false;
      }
      if (!target) {
        shell?.hideTutorialHighlight?.();
        return false;
      }
      return shell?.showTutorialHighlight?.(
        target,
        message,
        { ...options, allowedAction, source: options.source || 'strongTutorial' },
      ) || false;
    }

    getCanvasTargetRect(target = {}) {
      const rect = typeof target.getRect === 'function'
        ? target.getRect()
        : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
      const left = Number(rect?.left ?? rect?.x);
      const top = Number(rect?.top ?? rect?.y);
      const width = Number(rect?.width);
      const height = Number(rect?.height);
      if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        left,
        top,
        width,
        height,
        right: Number(rect?.right) || left + width,
        bottom: Number(rect?.bottom) || top + height,
      };
    }

    isCanvasTargetVisible(target = {}, padding = 8) {
      const rect = this.getCanvasTargetRect(target);
      if (!rect) return false;
      const shell = this.getShell() || {};
      const width = Number(shell.runtime?.width || shell.renderer?.width || shell.width || 0);
      const height = Number(shell.runtime?.height || shell.renderer?.height || shell.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return true;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return centerX >= padding
        && centerX <= width - padding
        && centerY >= padding
        && centerY <= height - padding;
    }

    showOpenWorldSiteHighlight(options = {}) {
      const siteId = options.siteId || '';
      const target = this.getCanvasTarget(
        'openWorldSite',
        (action) => !action.disabled && (!siteId || action.siteId === siteId || action.territoryId === siteId),
      );
      if (!target) return false;
      if (!this.isCanvasTargetVisible(target, options.padding)) return false;
      return this.getShell()?.showTutorialHighlight?.(
        target,
        options.message || '',
        {
          allowedAction: options.allowedAction || { type: 'openWorldSite', siteId },
          source: options.source || 'strongTutorial',
        },
      ) || false;
    }
  }

  global.TutorialGuideTargetResolver = TutorialGuideTargetResolver;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideTargetResolver;
})(typeof window !== 'undefined' ? window : globalThis);
