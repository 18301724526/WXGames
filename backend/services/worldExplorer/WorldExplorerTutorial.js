const SharedTutorialFlowConfig = require('../../../shared/tutorialFlowConfig');
const { getTutorialScoutPersonId, getFormationSnapshot } = require('../tutorial/TutorialSelectors');

function validateTutorialFormation(gameState = {}, options = {}) {
  const TUTORIAL_STEPS = SharedTutorialFlowConfig.TUTORIAL_STEPS;
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const step = SharedTutorialFlowConfig.stepName(tutorial.currentStep) || TUTORIAL_STEPS.initial;
  if (SharedTutorialFlowConfig.stepBefore(step, TUTORIAL_STEPS.scoutFormationSaved)) {
    return { success: false, error: 'EXPLORE_TUTORIAL_LOCKED', message: '请先完成探索编队引导，再进行探索。' };
  }
  if (SharedTutorialFlowConfig.stepAtLeast(step, TUTORIAL_STEPS.firstCityDiscovered)) return { success: true, formation: getFormationSnapshot(gameState, options) };
  const scoutPersonId = getTutorialScoutPersonId(gameState);
  const formation = getFormationSnapshot(gameState, options);
  if (!scoutPersonId || !formation.memberIds.includes(scoutPersonId)) {
    return { success: false, error: 'EXPLORE_TUTORIAL_FORMATION_REQUIRED', message: '请让教程赠送的先驱名人留在一号编队后再探索。' };
  }
  return { success: true, formation };
}

module.exports = {
  validateTutorialFormation,
};
