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

    hide() {
      this.clearHighlight();
      this.canvasShell?.hideTutorialHighlight?.();
    }

    show(target, message) {
      if (!target) {
        this.hide();
        return;
      }
      this.activeTarget = target;
      this.activeMessage = String(message ?? '');
      this.canvasShell?.showTutorialHighlight?.(target, this.activeMessage);
    }

    showSoft(message) {
      this.hide();
      if (typeof this.onSoftGuide === 'function') this.onSoftGuide(message);
    }
  }

  global.TutorialCanvasRenderer = TutorialCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
