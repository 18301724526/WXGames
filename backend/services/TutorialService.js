const TUTORIAL_STEPS = Object.freeze({
  initial: 0,
  tutorialStarted: 1,
  civilizationTabOpened: 2,
  civilizationPrepReserved: 3,
  eraAdvancedTo1: 4,
  buildingsTabOpened: 5,
  farmPrepReserved: 6,
  farmBuilt: 7,
  houseBuilt: 8,
  era2AdvanceReady: 9,
  eraAdvancedTo2: 10,
  specialEventTabOpened: 11,
  specialEventClaimed: 12,
  buildingsTabOpenedForLumbermill: 13,
  lumbermillBuilt: 14,
  craftsmanAssigned: 15,
  completed: 15,
});

function createCompletedTutorialState(raw = {}) {
  return {
    completed: true,
    currentStep: TUTORIAL_STEPS.completed,
    phaseCompleted: {
      newbie: true,
      era2: true,
    },
    disabled: true,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function createInitialTutorialState() {
  return createCompletedTutorialState();
}

function normalizeTutorialState(raw) {
  return createCompletedTutorialState(raw && typeof raw === 'object' ? raw : {});
}

function canAccessTab() {
  return true;
}

function validateAction() {
  return { allowed: true };
}

function manualAdvance(tutorialState) {
  return normalizeTutorialState(tutorialState);
}

function maybeActivateEra2Tutorial(tutorialState) {
  return normalizeTutorialState(tutorialState);
}

function ensureLumbermillGuideResources() {
  return false;
}

function advanceTutorial(tutorialState) {
  return normalizeTutorialState(tutorialState);
}

module.exports = {
  TUTORIAL_STEPS,
  createInitialTutorialState,
  normalizeTutorialState,
  canAccessTab,
  validateAction,
  manualAdvance,
  maybeActivateEra2Tutorial,
  ensureLumbermillGuideResources,
  advanceTutorial,
};
