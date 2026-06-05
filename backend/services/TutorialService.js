const { TUTORIAL_STEPS } = require('../config/TutorialFlowConfig');
const TutorialProgressService = require('./TutorialProgressService');

module.exports = {
  TUTORIAL_STEPS,
  createInitialTutorialState: TutorialProgressService.createInitialTutorialState,
  normalizeTutorialState: TutorialProgressService.normalizeTutorialState,
  canAccessTab: TutorialProgressService.canAccessTab,
  validateAction: TutorialProgressService.validateAction,
  manualAdvance: TutorialProgressService.manualAdvance,
  maybeActivateEra2Tutorial: TutorialProgressService.maybeActivateEra2Tutorial,
  ensureHouseGuideResources: TutorialProgressService.ensureHouseGuideResources,
  ensureLumbermillGuideResources: TutorialProgressService.ensureLumbermillGuideResources,
  ensureScoutFamousPersonGrant: TutorialProgressService.ensureScoutFamousPersonGrant,
  advanceTutorial: TutorialProgressService.advanceTutorial,
  advanceClientStep: TutorialProgressService.advanceClientStep,
  getHouseGuideMinimumResources: TutorialProgressService.getHouseGuideMinimumResources,
};
