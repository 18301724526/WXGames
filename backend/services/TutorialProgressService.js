const TutorialState = require('./tutorial/TutorialState');
const TutorialTabAccess = require('./tutorial/TutorialTabAccess');
const TutorialActionValidator = require('./tutorial/TutorialActionValidator');
const TutorialProgression = require('./tutorial/TutorialProgression');

module.exports = {
  createInitialTutorialState: TutorialState.createInitialTutorialState,
  normalizeTutorialState: TutorialState.normalizeTutorialState,
  canAccessTab: TutorialTabAccess.canAccessTab,
  validateAction: TutorialActionValidator.validateAction,
  manualAdvance: TutorialProgression.manualAdvance,
  maybeActivateEra2Tutorial: TutorialProgression.maybeActivateEra2Tutorial,
  advanceTutorial: TutorialProgression.advanceTutorial,
  advanceClientStep: TutorialProgression.advanceClientStep,
};
