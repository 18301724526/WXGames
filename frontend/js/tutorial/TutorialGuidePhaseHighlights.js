(function (global) {
  const SharedTutorialGuideFlowRegistry = (() => {
    if (global.TutorialGuideFlowRegistry) return global.TutorialGuideFlowRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TutorialGuideFlowRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function install(TutorialGuideController) {
    if (!TutorialGuideController?.prototype) return false;
    TutorialGuideController.prototype.refreshCurrentHighlight = function refreshCurrentHighlight() {
      if (!this.flowRegistry && SharedTutorialGuideFlowRegistry?.create) {
        this.flowRegistry = SharedTutorialGuideFlowRegistry.create({
          steps: TutorialGuideController.TUTORIAL_STEPS || {},
        });
      }
      return this.flowRegistry?.refresh?.(this) || false;
    };
    return true;
  }

  const TutorialGuidePhaseHighlights = { install };
  global.TutorialGuidePhaseHighlights = TutorialGuidePhaseHighlights;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuidePhaseHighlights;
})(typeof window !== 'undefined' ? window : globalThis);
