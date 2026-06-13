const { TutorialFlowConfig } = require('../config/GameplayConfigRuntime');
const { normalizeTutorialState } = require('./TutorialState');

function canAccessTab(tutorialState, tabKey) {
  const TUTORIAL_STEPS = TutorialFlowConfig.TUTORIAL_STEPS;
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return true;
  const step = tutorial.currentStep;

  if (step < TUTORIAL_STEPS.houseBuilt) return ['buildings', 'military'].includes(tabKey);
  if (step < TUTORIAL_STEPS.eraAdvancedTo1) return ['civilization', 'buildings', 'military'].includes(tabKey);
  if (step <= TUTORIAL_STEPS.farmBuilt) return ['civilization', 'buildings'].includes(tabKey);
  if (step === TUTORIAL_STEPS.era2AdvanceReady) return tabKey === 'civilization';
  if (step === TUTORIAL_STEPS.eraAdvancedTo2) return ['civilization', 'events'].includes(tabKey);
  if (step === TUTORIAL_STEPS.specialEventTabOpened) return tabKey === 'events';
  if (step === TUTORIAL_STEPS.specialEventClaimed) return ['events', 'buildings'].includes(tabKey);
  if (step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill) return tabKey === 'buildings';
  if (step === TUTORIAL_STEPS.lumbermillBuilt) return tabKey === 'buildings';
  if (step === TUTORIAL_STEPS.era3AdvanceReady) return ['civilization', 'buildings', 'tasks'].includes(tabKey);
  if (step >= TUTORIAL_STEPS.era3Advanced && step < TUTORIAL_STEPS.scoutFormationSaved) {
    return ['military', 'civilization'].includes(tabKey);
  }
  if (step >= TUTORIAL_STEPS.polityNamed && step <= TUTORIAL_STEPS.manualTalentReady) {
    return tabKey === 'military';
  }
  if (step >= TUTORIAL_STEPS.manualTalentAssigned && step < TUTORIAL_STEPS.famousSeekCompleted) {
    return ['military', 'famousPersons'].includes(tabKey);
  }
  if (step >= TUTORIAL_STEPS.famousSeekCompleted && step < TUTORIAL_STEPS.completed) {
    return tabKey === 'tech';
  }
  return true;
}

module.exports = {
  canAccessTab,
};
