(function (global) {
  const TutorialHostContext = (() => {
    if (global.TutorialHostContext) return global.TutorialHostContext;
    if (typeof module !== 'undefined' && module.exports) {
      return require('./TutorialHostContext');
    }
    return null;
  })();

  if (!TutorialHostContext) throw new Error('TutorialHostContext is required');

  class TutorialGuideController extends TutorialHostContext {}

  TutorialGuideController.TUTORIAL_STEPS = TutorialHostContext.TUTORIAL_STEPS;
  TutorialGuideController.TutorialGuideStepPolicy = TutorialHostContext.TutorialGuideStepPolicy;
  TutorialGuideController.TutorialGuideTargetResolver = TutorialHostContext.TutorialGuideTargetResolver;
  TutorialGuideController.getDivergenceWitness = TutorialHostContext.getDivergenceWitness;
  TutorialGuideController.resetDivergenceWitness = TutorialHostContext.resetDivergenceWitness;

  global.TutorialGuideController = TutorialGuideController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideController;
})(typeof window !== 'undefined' ? window : globalThis);
