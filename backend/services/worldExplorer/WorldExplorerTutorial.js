const SharedTutorialFlowConfig = require('../../../shared/tutorialFlowConfig');
const { getTutorialScoutPersonId, getFormationSnapshot } = require('../tutorial/TutorialSelectors');

function validateTutorialFormation(gameState = {}, options = {}) {
  const TUTORIAL_STEPS = SharedTutorialFlowConfig.TUTORIAL_STEPS;
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const step = SharedTutorialFlowConfig.stepName(tutorial.currentStep) || TUTORIAL_STEPS.initial;
  if (SharedTutorialFlowConfig.stepBefore(step, TUTORIAL_STEPS.scoutFormationSaved)) {
    return { success: false, error: 'EXPLORE_TUTORIAL_LOCKED', message: 'Please finish the scout formation guide before exploring.' };
  }
  if (SharedTutorialFlowConfig.stepAtLeast(step, TUTORIAL_STEPS.firstCityDiscovered)) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const scoutPersonId = getTutorialScoutPersonId(gameState);
  const formation = getFormationSnapshot(gameState, options);
  if (!scoutPersonId || !formation.memberIds.includes(scoutPersonId)) {
    return { success: false, error: 'EXPLORE_TUTORIAL_FORMATION_REQUIRED', message: 'Please keep the tutorial scout famous person in formation 1 before exploring.' };
  }
  return { success: true, formation };
}

module.exports = {
  validateTutorialFormation,
};
