const TUTORIAL_STEPS = Object.freeze({
  initial: 0,
  tutorialStarted: 1,
  cityEntered: 2,
  houseGuideReady: 3,
  houseBuilt: 4,
  civilizationTabOpened: 5,
  eraAdvancedTo1: 6,
  buildingsTabOpened: 7,
  farmPrepReserved: 8,
  farmBuilt: 9,
  era2AdvanceReady: 10,
  eraAdvancedTo2: 11,
  specialEventTabOpened: 12,
  specialEventClaimed: 13,
  buildingsTabOpenedForLumbermill: 14,
  lumbermillBuilt: 15,
  craftsmanAssigned: 16,
  completed: 16,
});

const TUTORIAL_EVENT_STEPS = Object.freeze({
  tutorialStarted: TUTORIAL_STEPS.tutorialStarted,
  cityEntered: TUTORIAL_STEPS.cityEntered,
  houseGuideReady: TUTORIAL_STEPS.houseGuideReady,
  houseBuilt: TUTORIAL_STEPS.houseBuilt,
  civilizationTabOpened: TUTORIAL_STEPS.civilizationTabOpened,
  eraAdvanced: TUTORIAL_STEPS.eraAdvancedTo1,
  eraAdvancedTo2: TUTORIAL_STEPS.eraAdvancedTo2,
  buildingsTabOpened: TUTORIAL_STEPS.buildingsTabOpened,
  farmBuilt: TUTORIAL_STEPS.farmBuilt,
  era2AdvanceReady: TUTORIAL_STEPS.era2AdvanceReady,
  specialEventTabOpened: TUTORIAL_STEPS.specialEventTabOpened,
  specialEventClaimed: TUTORIAL_STEPS.specialEventClaimed,
  buildingsTabOpenedForLumbermill: TUTORIAL_STEPS.buildingsTabOpenedForLumbermill,
  lumbermillBuilt: TUTORIAL_STEPS.lumbermillBuilt,
  craftsmanAssigned: TUTORIAL_STEPS.craftsmanAssigned,
});

const PASS_THROUGH_ACTIONS = Object.freeze([
  'applyTalentPolicy',
  'saveTalentPolicy',
  'deleteTalentPolicy',
  'research',
  'seekFamousPerson',
  'acceptFamousPerson',
  'dismissFamousPersonCandidate',
  'assignFamousAttributePoint',
  'setArmyFormation',
  'startExplore',
  'claimExplore',
  'scoutTerritory',
  'claimScout',
  'startConquest',
  'claimConquest',
  'renameCity',
  'renamePolity',
  'switchCity',
]);

const CLIENT_TUTORIAL_STEP_GATES = Object.freeze({
  [TUTORIAL_STEPS.tutorialStarted]: TUTORIAL_STEPS.initial,
  [TUTORIAL_STEPS.cityEntered]: TUTORIAL_STEPS.initial,
  [TUTORIAL_STEPS.houseGuideReady]: TUTORIAL_STEPS.cityEntered,
  [TUTORIAL_STEPS.civilizationTabOpened]: TUTORIAL_STEPS.houseBuilt,
  [TUTORIAL_STEPS.buildingsTabOpened]: TUTORIAL_STEPS.eraAdvancedTo1,
  [TUTORIAL_STEPS.specialEventTabOpened]: TUTORIAL_STEPS.eraAdvancedTo2,
  [TUTORIAL_STEPS.buildingsTabOpenedForLumbermill]: TUTORIAL_STEPS.specialEventClaimed,
});

function createPhaseCompleted(currentStep) {
  const step = Number.isFinite(currentStep) ? currentStep : TUTORIAL_STEPS.initial;
  return {
    newbie: step >= TUTORIAL_STEPS.eraAdvancedTo1,
    era2: step >= TUTORIAL_STEPS.completed,
  };
}

module.exports = {
  TUTORIAL_STEPS,
  TUTORIAL_EVENT_STEPS,
  PASS_THROUGH_ACTIONS,
  CLIENT_TUTORIAL_STEP_GATES,
  createPhaseCompleted,
};
