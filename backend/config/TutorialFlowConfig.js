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
  era3AdvanceReady: 16,
  era3Advanced: 17,
  scoutFamousGranted: 18,
  famousPanelOpened: 19,
  famousCardViewed: 20,
  formationPanelOpened: 21,
  scoutFormationSaved: 22,
  craftsmanAssigned: 23,
  completed: 30,
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
  era3AdvanceReady: TUTORIAL_STEPS.era3AdvanceReady,
  era3Advanced: TUTORIAL_STEPS.era3Advanced,
  scoutFamousGranted: TUTORIAL_STEPS.scoutFamousGranted,
  famousPanelOpened: TUTORIAL_STEPS.famousPanelOpened,
  famousCardViewed: TUTORIAL_STEPS.famousCardViewed,
  formationPanelOpened: TUTORIAL_STEPS.formationPanelOpened,
  scoutFormationSaved: TUTORIAL_STEPS.scoutFormationSaved,
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
  [TUTORIAL_STEPS.famousPanelOpened]: TUTORIAL_STEPS.scoutFamousGranted,
  [TUTORIAL_STEPS.famousCardViewed]: TUTORIAL_STEPS.famousPanelOpened,
  [TUTORIAL_STEPS.formationPanelOpened]: TUTORIAL_STEPS.famousCardViewed,
});

function createPhaseCompleted(currentStep) {
  const step = Number.isFinite(currentStep) ? currentStep : TUTORIAL_STEPS.initial;
  return {
    newbie: step >= TUTORIAL_STEPS.eraAdvancedTo1,
    era2: step >= TUTORIAL_STEPS.lumbermillBuilt,
    scoutFormation: step >= TUTORIAL_STEPS.scoutFormationSaved,
  };
}

module.exports = {
  TUTORIAL_STEPS,
  TUTORIAL_EVENT_STEPS,
  PASS_THROUGH_ACTIONS,
  CLIENT_TUTORIAL_STEP_GATES,
  createPhaseCompleted,
};
