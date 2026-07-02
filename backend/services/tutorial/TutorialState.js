const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const SharedTutorialFlowConfig = require('../../../shared/tutorialFlowConfig');
const { nowIso } = require('../../../shared/timeUtils');

function createInitialTutorialState() {
  const initialStep = SharedTutorialFlowConfig.TUTORIAL_STEPS.initial;
  return {
    completed: false,
    currentStep: initialStep,
    phaseCompleted: TutorialFlowConfig.createPhaseCompleted(initialStep),
    grants: {},
    updatedAt: nowIso(),
  };
}

function normalizeGrants(raw = {}) {
  return raw && typeof raw === 'object' ? { ...raw } : {};
}

function createCompletedTutorialState(raw = {}) {
  return {
    completed: true,
    currentStep: SharedTutorialFlowConfig.TUTORIAL_STEPS.completed,
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

// Load boundary + one-shot lazy migration: legacy saves persisted the step as
// a NUMBER; stepName() maps it onto the step NAME (clamped like the legacy
// normalize), so every normalized state carries the insertion-proof name.
function normalizeTutorialState(raw) {
  const tutorialSteps = SharedTutorialFlowConfig.TUTORIAL_STEPS;
  if (!raw || typeof raw !== 'object') return createInitialTutorialState();
  if (raw.disabled) return createCompletedTutorialState(raw);
  const currentStep = SharedTutorialFlowConfig.stepName(raw.currentStep) || tutorialSteps.initial;
  const completed = Boolean(
    raw.completed || SharedTutorialFlowConfig.stepAtLeast(currentStep, tutorialSteps.completed),
  );
  if (completed) return createCompletedTutorialState({ ...raw, disabled: false, currentStep });
  return {
    completed: false,
    currentStep,
    phaseCompleted: {
      newbie: Boolean(
        raw.phaseCompleted?.newbie
        || SharedTutorialFlowConfig.stepAtLeast(currentStep, tutorialSteps.eraAdvancedTo1),
      ),
      era2: Boolean(
        raw.phaseCompleted?.era2
        || SharedTutorialFlowConfig.stepAtLeast(currentStep, tutorialSteps.lumbermillBuilt),
      ),
      scoutFormation: Boolean(
        raw.phaseCompleted?.scoutFormation
        || SharedTutorialFlowConfig.stepAtLeast(currentStep, tutorialSteps.scoutFormationSaved),
      ),
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
