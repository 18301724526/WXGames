const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const SharedTutorialFlowConfig = require('../../../shared/tutorialFlowConfig');
const { normalizeTutorialState, nowIso } = require('./TutorialState');
const { hasBuiltHouse, hasBuiltFarm } = require('./TutorialSelectors');

function manualAdvance(tutorialState, nextStep) {
  const normalized = normalizeTutorialState(tutorialState);
  const tutorialSteps = SharedTutorialFlowConfig.TUTORIAL_STEPS;
  if (normalized.completed || normalized.disabled) return normalized;
  // Accept step names and legacy numbers; stepName clamps numbers into the
  // valid range (legacy Math.min(completed, floor(step)) behavior).
  const currentStep = SharedTutorialFlowConfig.stepName(nextStep);
  if (!currentStep || SharedTutorialFlowConfig.compareSteps(currentStep, normalized.currentStep) <= 0) {
    return normalized;
  }
  return {
    ...normalized,
    currentStep,
    phaseCompleted: TutorialFlowConfig.createPhaseCompleted(currentStep),
    completed: SharedTutorialFlowConfig.stepAtLeast(currentStep, tutorialSteps.completed),
    updatedAt: nowIso(),
  };
}

function advanceClientStep(tutorialState, requestedStep) {
  const tutorial = normalizeTutorialState(tutorialState);
  const clientTutorialStepGates = SharedTutorialFlowConfig.CLIENT_STEP_GATES;
  if (tutorial.completed || tutorial.disabled) return { success: true, tutorial };
  // Mixed-version tolerance: the client may send the step NAME (new clients)
  // or the legacy step NUMBER (old clients still deployed).
  if (!SharedTutorialFlowConfig.isValidStep(requestedStep)
    && !Number.isFinite(Number(requestedStep))) {
    return {
      success: false,
      error: 'TUTORIAL_STEP_INVALID',
      message: 'Tutorial step is invalid.',
      tutorial,
    };
  }
  const step = SharedTutorialFlowConfig.payloadStepName(requestedStep);
  const requiredCurrentStep = step ? clientTutorialStepGates[step] : undefined;
  if (!SharedTutorialFlowConfig.isValidStep(requiredCurrentStep)) {
    return {
      success: false,
      error: 'TUTORIAL_STEP_LOCKED',
      message: 'Tutorial step must be advanced by a real game action.',
      tutorial,
    };
  }
  if (SharedTutorialFlowConfig.stepBefore(tutorial.currentStep, requiredCurrentStep)) {
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
  const tutorialSteps = SharedTutorialFlowConfig.TUTORIAL_STEPS;
  if (tutorial.completed || tutorial.disabled || tutorial.phaseCompleted.era2) return tutorial;
  if (gameState.currentEra >= 2
    && SharedTutorialFlowConfig.stepBefore(tutorial.currentStep, tutorialSteps.eraAdvancedTo2)) {
    return manualAdvance(tutorial, tutorialSteps.eraAdvancedTo2);
  }
  if (hasBuiltHouse(gameState)
    && SharedTutorialFlowConfig.stepBefore(tutorial.currentStep, tutorialSteps.houseBuilt)) {
    tutorial = manualAdvance(tutorial, tutorialSteps.houseBuilt);
  }
  const readyForEra2 = gameState.currentEra === 1
    && eraProgress?.canAdvance
    && hasBuiltHouse(gameState)
    && hasBuiltFarm(gameState)
    && SharedTutorialFlowConfig.stepAtLeast(tutorial.currentStep, tutorialSteps.farmBuilt);
  if (readyForEra2
    && SharedTutorialFlowConfig.stepBefore(tutorial.currentStep, tutorialSteps.era2AdvanceReady)) {
    return manualAdvance(tutorial, tutorialSteps.era2AdvanceReady);
  }
  return tutorial;
}

function advanceTutorial(tutorialState, eventName) {
  const nextStep = SharedTutorialFlowConfig.EVENT_STEPS[eventName];
  if (!nextStep) return normalizeTutorialState(tutorialState);
  return manualAdvance(tutorialState, nextStep);
}

module.exports = {
  manualAdvance,
  advanceClientStep,
  maybeActivateEra2Tutorial,
  advanceTutorial,
};
