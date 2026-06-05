const {
  TUTORIAL_STEPS,
  createPhaseCompleted,
} = require('../../config/TutorialFlowConfig');

function nowIso() {
  return new Date().toISOString();
}

function createInitialTutorialState() {
  return {
    completed: false,
    currentStep: TUTORIAL_STEPS.initial,
    phaseCompleted: createPhaseCompleted(TUTORIAL_STEPS.initial),
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
    currentStep: TUTORIAL_STEPS.completed,
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
  if (!raw || typeof raw !== 'object') return createInitialTutorialState();
  if (raw.disabled) return createCompletedTutorialState(raw);
  const rawStep = Number(raw.currentStep);
  const currentStep = Number.isFinite(rawStep)
    ? Math.max(TUTORIAL_STEPS.initial, Math.min(TUTORIAL_STEPS.completed, Math.floor(rawStep)))
    : TUTORIAL_STEPS.initial;
  const completed = Boolean(raw.completed || currentStep >= TUTORIAL_STEPS.completed);
  if (completed) return createCompletedTutorialState({ ...raw, disabled: false, currentStep });
  return {
    completed: false,
    currentStep,
    phaseCompleted: {
      newbie: Boolean(raw.phaseCompleted?.newbie || currentStep >= TUTORIAL_STEPS.eraAdvancedTo1),
      era2: Boolean(raw.phaseCompleted?.era2 || currentStep >= TUTORIAL_STEPS.lumbermillBuilt),
      scoutFormation: Boolean(raw.phaseCompleted?.scoutFormation || currentStep >= TUTORIAL_STEPS.scoutFormationSaved),
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
