const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const { nowIso } = require('../../../shared/timeUtils');

function createInitialTutorialState() {
  const tutorialSteps = TutorialFlowConfig.TUTORIAL_STEPS;
  return {
    completed: false,
    currentStep: tutorialSteps.initial,
    phaseCompleted: TutorialFlowConfig.createPhaseCompleted(tutorialSteps.initial),
    grants: {},
    updatedAt: nowIso(),
  };
}

function normalizeGrants(raw = {}) {
  return raw && typeof raw === 'object' ? { ...raw } : {};
}

function createCompletedTutorialState(raw = {}) {
  const tutorialSteps = TutorialFlowConfig.TUTORIAL_STEPS;
  return {
    completed: true,
    currentStep: tutorialSteps.completed,
    phaseCompleted: {
      newbie: true,
      era2: true,
      scoutFormation: true,
    },
    grants: normalizeGrants(raw.grants),
    disabled: Boolean(raw.disabled),
    updatedAt: raw.updatedAt || nowIso(),
  };
}

function normalizeTutorialState(raw) {
  const tutorialSteps = TutorialFlowConfig.TUTORIAL_STEPS;
  if (!raw || typeof raw !== 'object') return createInitialTutorialState();
  if (raw.disabled) return createCompletedTutorialState(raw);
  const rawStep = Number(raw.currentStep);
  const currentStep = Number.isFinite(rawStep)
    ? Math.max(tutorialSteps.initial, Math.min(tutorialSteps.completed, Math.floor(rawStep)))
    : tutorialSteps.initial;
  const completed = Boolean(raw.completed || currentStep >= tutorialSteps.completed);
  if (completed) return createCompletedTutorialState({ ...raw, disabled: false, currentStep });
  return {
    completed: false,
    currentStep,
    phaseCompleted: {
      newbie: Boolean(raw.phaseCompleted?.newbie || currentStep >= tutorialSteps.eraAdvancedTo1),
      era2: Boolean(raw.phaseCompleted?.era2 || currentStep >= tutorialSteps.lumbermillBuilt),
      scoutFormation: Boolean(raw.phaseCompleted?.scoutFormation || currentStep >= tutorialSteps.scoutFormationSaved),
    },
    grants: normalizeGrants(raw.grants),
    updatedAt: raw.updatedAt || nowIso(),
  };
}

module.exports = {
  nowIso,
  createInitialTutorialState,
  normalizeTutorialState,
};
