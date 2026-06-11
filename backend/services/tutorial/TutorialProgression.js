const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const { normalizeTutorialState, nowIso } = require('./TutorialState');
const { hasBuiltHouse, hasBuiltFarm } = require('./TutorialSelectors');

function manualAdvance(tutorialState, nextStep) {
  const normalized = normalizeTutorialState(tutorialState);
  const tutorialSteps = TutorialFlowConfig.TUTORIAL_STEPS;
  if (normalized.completed || normalized.disabled) return normalized;
  const step = Number(nextStep);
  if (!Number.isFinite(step) || step <= normalized.currentStep) return normalized;
  const currentStep = Math.min(tutorialSteps.completed, Math.floor(step));
  return {
    ...normalized,
    currentStep,
    phaseCompleted: TutorialFlowConfig.createPhaseCompleted(currentStep),
    completed: currentStep >= tutorialSteps.completed,
    updatedAt: nowIso(),
  };
}

function advanceClientStep(tutorialState, requestedStep) {
  const tutorial = normalizeTutorialState(tutorialState);
  const clientTutorialStepGates = TutorialFlowConfig.CLIENT_TUTORIAL_STEP_GATES;
  if (tutorial.completed || tutorial.disabled) return { success: true, tutorial };
  const nextStep = Number(requestedStep);
  if (!Number.isFinite(nextStep)) {
    return {
      success: false,
      error: 'TUTORIAL_STEP_INVALID',
      message: 'Tutorial step is invalid.',
      tutorial,
    };
  }
  const step = Math.floor(nextStep);
  const requiredCurrentStep = clientTutorialStepGates[step];
  if (!Number.isFinite(requiredCurrentStep)) {
    return {
      success: false,
      error: 'TUTORIAL_STEP_LOCKED',
      message: 'Tutorial step must be advanced by a real game action.',
      tutorial,
    };
  }
  if (tutorial.currentStep < requiredCurrentStep) {
    return {
      success: false,
      error: 'TUTORIAL_STEP_LOCKED',
      message: 'Tutorial step prerequisite is not complete.',
      tutorial,
    };
  }
  return {
    success: true,
    tutorial: manualAdvance(tutorial, step),
  };
}

function maybeActivateEra2Tutorial(tutorialState, gameState, eraProgress) {
  let tutorial = normalizeTutorialState(tutorialState);
  const tutorialSteps = TutorialFlowConfig.TUTORIAL_STEPS;
  if (tutorial.completed || tutorial.disabled || tutorial.phaseCompleted.era2) return tutorial;
  if (gameState.currentEra >= 2 && tutorial.currentStep < tutorialSteps.eraAdvancedTo2) {
    return manualAdvance(tutorial, tutorialSteps.eraAdvancedTo2);
  }
  if (hasBuiltHouse(gameState) && tutorial.currentStep < tutorialSteps.houseBuilt) {
    tutorial = manualAdvance(tutorial, tutorialSteps.houseBuilt);
  }
  const readyForEra2 = gameState.currentEra === 1
    && eraProgress?.canAdvance
    && hasBuiltHouse(gameState)
    && hasBuiltFarm(gameState)
    && tutorial.currentStep >= tutorialSteps.farmBuilt;
  if (readyForEra2 && tutorial.currentStep < tutorialSteps.era2AdvanceReady) {
    return manualAdvance(tutorial, tutorialSteps.era2AdvanceReady);
  }
  return tutorial;
}

function advanceTutorial(tutorialState, eventName) {
  const nextStep = TutorialFlowConfig.TUTORIAL_EVENT_STEPS[eventName];
  if (!nextStep) return normalizeTutorialState(tutorialState);
  return manualAdvance(tutorialState, nextStep);
}

module.exports = {
  manualAdvance,
  advanceClientStep,
  maybeActivateEra2Tutorial,
  advanceTutorial,
};
