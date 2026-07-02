const {
  TUTORIAL_STEPS,
  stepEquals,
  stepAtLeast,
  stepAtMost,
  stepBefore,
} = require('../../../shared/tutorialFlowConfig');
const { normalizeTutorialState } = require('./TutorialState');

function canAccessTab(tutorialState, tabKey) {
  const tutorial = normalizeTutorialState(tutorialState);
  if (tutorial.completed || tutorial.disabled) return true;
  const step = tutorial.currentStep;

  if (stepBefore(step, TUTORIAL_STEPS.houseBuilt)) return ['resources', 'buildings', 'military'].includes(tabKey);
  if (stepBefore(step, TUTORIAL_STEPS.eraAdvancedTo1)) return ['resources', 'civilization', 'buildings', 'military'].includes(tabKey);
  if (stepAtMost(step, TUTORIAL_STEPS.farmBuilt)) return ['civilization', 'buildings'].includes(tabKey);
  if (stepEquals(step, TUTORIAL_STEPS.era2AdvanceReady)) return tabKey === 'civilization';
  if (stepEquals(step, TUTORIAL_STEPS.eraAdvancedTo2)) return ['civilization', 'events'].includes(tabKey);
  if (stepEquals(step, TUTORIAL_STEPS.specialEventTabOpened)) return tabKey === 'events';
  if (stepEquals(step, TUTORIAL_STEPS.specialEventClaimed)) return ['events', 'buildings'].includes(tabKey);
  if (stepEquals(step, TUTORIAL_STEPS.buildingsTabOpenedForLumbermill)) return ['buildings', 'resources'].includes(tabKey);
  if (stepEquals(step, TUTORIAL_STEPS.lumbermillBuilt)) return ['buildings', 'resources'].includes(tabKey);
  if (stepEquals(step, TUTORIAL_STEPS.era3AdvanceReady)) return ['civilization', 'buildings', 'tasks'].includes(tabKey);
  if (stepAtLeast(step, TUTORIAL_STEPS.era3Advanced) && stepBefore(step, TUTORIAL_STEPS.scoutFormationSaved)) {
    return ['resources', 'military', 'civilization'].includes(tabKey);
  }
  if (stepAtLeast(step, TUTORIAL_STEPS.polityNamed) && stepAtMost(step, TUTORIAL_STEPS.talentPolicyApplied)) {
    return tabKey === 'military';
  }
  if (stepAtLeast(step, TUTORIAL_STEPS.manualTalentAssigned) && stepBefore(step, TUTORIAL_STEPS.famousSeekCompleted)) {
    return ['resources', 'famousPersons'].includes(tabKey);
  }
  if (stepAtLeast(step, TUTORIAL_STEPS.famousSeekCompleted) && stepBefore(step, TUTORIAL_STEPS.completed)) {
    return tabKey === 'tech';
  }
  return true;
}

module.exports = {
  canAccessTab,
};
