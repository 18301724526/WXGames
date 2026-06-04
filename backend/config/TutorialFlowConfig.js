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

const TUTORIAL_EVENT_STEPS = Object.freeze({
  tutorialStarted: TUTORIAL_STEPS.tutorialStarted,
  civilizationTabOpened: TUTORIAL_STEPS.civilizationTabOpened,
  eraAdvanced: TUTORIAL_STEPS.eraAdvancedTo1,
  eraAdvancedTo2: TUTORIAL_STEPS.eraAdvancedTo2,
  buildingsTabOpened: TUTORIAL_STEPS.buildingsTabOpened,
  farmBuilt: TUTORIAL_STEPS.farmBuilt,
  houseBuilt: TUTORIAL_STEPS.houseBuilt,
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
  [TUTORIAL_STEPS.civilizationTabOpened]: TUTORIAL_STEPS.initial,
  [TUTORIAL_STEPS.buildingsTabOpened]: TUTORIAL_STEPS.eraAdvancedTo1,
  [TUTORIAL_STEPS.specialEventTabOpened]: TUTORIAL_STEPS.eraAdvancedTo2,
  [TUTORIAL_STEPS.buildingsTabOpenedForLumbermill]: TUTORIAL_STEPS.specialEventClaimed,
});

function createPhaseCompleted(currentStep) {
  const step = Number.isFinite(currentStep) ? currentStep : TUTORIAL_STEPS.initial;
  return {
    newbie: step >= TUTORIAL_STEPS.houseBuilt,
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
