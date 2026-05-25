(function (global) {
  class TutorialCanvasRenderer {
    constructor(options = {}) {
      this.canvasShell = options.canvasShell || null;
      this.onSoftGuide = null;
      this.activeTarget = null;
      this.activeMessage = '';
    }

    setCanvasShell(canvasShell) {
      this.canvasShell = canvasShell || null;
      if (this.activeTarget && this.activeMessage) {
        this.canvasShell?.showTutorialHighlight?.(this.activeTarget, this.activeMessage);
      }
    }

    clearHighlight() {
      this.activeTarget = null;
      this.activeMessage = '';
    }

    isOwnedCanvasHighlight() {
      const highlight = this.canvasShell?.tutorialHighlight;
      if (!highlight) return Boolean(this.activeTarget || this.activeMessage);
      return highlight.source === 'tutorial'
        || (!highlight.source && Boolean(this.activeTarget || this.activeMessage));
    }

    hide(options = {}) {
      const shouldHideCanvas = Boolean(options.force) || this.isOwnedCanvasHighlight();
      this.clearHighlight();
      if (shouldHideCanvas) this.canvasShell?.hideTutorialHighlight?.();
      return shouldHideCanvas;
    }

    clearOwnedHighlight() {
      return this.hide();
    }

    show(target, message) {
      if (!target) {
        this.hide();
        return;
      }
      this.activeTarget = target;
      this.activeMessage = String(message ?? '');
      this.canvasShell?.showTutorialHighlight?.(target, this.activeMessage, { source: 'tutorial' });
    }

    showSoft(message) {
      this.hide({ force: true });
      if (typeof this.onSoftGuide === 'function') this.onSoftGuide(message);
    }
  }

  global.TutorialCanvasRenderer = TutorialCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
