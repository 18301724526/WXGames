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
  scoutWorldPanelOpened: 23,
  scoutExploreStarted: 24,
  scoutExploreClaimed: 25,
  firstCityConquestStarted: 26,
  firstCityOccupied: 27,
  firstCityNamed: 28,
  polityNamed: 29,
  talentPolicyOpened: 30,
  talentPolicyApplied: 31,
  manualTalentAssigned: 32,
  famousSeekOpened: 33,
  famousSeekCompleted: 34,
  finalTechOpened: 35,
  completed: 36,
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
  scoutWorldPanelOpened: TUTORIAL_STEPS.scoutWorldPanelOpened,
  scoutExploreStarted: TUTORIAL_STEPS.scoutExploreStarted,
  scoutExploreClaimed: TUTORIAL_STEPS.scoutExploreClaimed,
  firstCityConquestStarted: TUTORIAL_STEPS.firstCityConquestStarted,
  firstCityOccupied: TUTORIAL_STEPS.firstCityOccupied,
  firstCityNamed: TUTORIAL_STEPS.firstCityNamed,
  polityNamed: TUTORIAL_STEPS.polityNamed,
  talentPolicyApplied: TUTORIAL_STEPS.talentPolicyApplied,
  manualTalentAssigned: TUTORIAL_STEPS.manualTalentAssigned,
  famousSeekCompleted: TUTORIAL_STEPS.famousSeekCompleted,
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
  'scoutTerritory',
  'claimScout',
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
  [TUTORIAL_STEPS.scoutWorldPanelOpened]: TUTORIAL_STEPS.scoutFormationSaved,
  [TUTORIAL_STEPS.talentPolicyOpened]: TUTORIAL_STEPS.polityNamed,
  [TUTORIAL_STEPS.talentPolicyApplied]: TUTORIAL_STEPS.talentPolicyOpened,
  [TUTORIAL_STEPS.famousSeekOpened]: TUTORIAL_STEPS.manualTalentAssigned,
  [TUTORIAL_STEPS.finalTechOpened]: TUTORIAL_STEPS.famousSeekCompleted,
  [TUTORIAL_STEPS.completed]: TUTORIAL_STEPS.finalTechOpened,
});

const ConfigRegistryContract = require('../services/config/ConfigRegistryContract');

const CONFIG_VERSION = '1.0.0';
const CONFIG_SCHEMA_VERSION = 1;
const sourcePath = __filename;

function createPhaseCompleted(currentStep) {
  const step = Number.isFinite(currentStep) ? currentStep : TUTORIAL_STEPS.initial;
  return {
    newbie: step >= TUTORIAL_STEPS.eraAdvancedTo1,
    era2: step >= TUTORIAL_STEPS.lumbermillBuilt,
    scoutFormation: step >= TUTORIAL_STEPS.scoutFormationSaved,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function raw() {
  return clone({
    steps: TUTORIAL_STEPS,
    eventSteps: TUTORIAL_EVENT_STEPS,
    passThroughActions: PASS_THROUGH_ACTIONS,
    clientStepGates: CLIENT_TUTORIAL_STEP_GATES,
  });
}

function createRegistryEntries() {
  const entries = {};
  Object.entries(TUTORIAL_STEPS).forEach(([key, value]) => {
    const id = `step:${key}`;
    entries[id] = { id, key, value };
  });
  Object.entries(TUTORIAL_EVENT_STEPS).forEach(([key, value]) => {
    const id = `event:${key}`;
    entries[id] = { id, key, value };
  });
  PASS_THROUGH_ACTIONS.forEach((action) => {
    const id = `passThrough:${action}`;
    entries[id] = { id, action };
  });
  Object.entries(CLIENT_TUTORIAL_STEP_GATES).forEach(([step, minimumStep]) => {
    const id = `clientGate:${step}`;
    entries[id] = { id, step: Number(step), minimumStep };
  });
  return entries;
}

function getRegistryMetadata() {
  return ConfigRegistryContract.createRegistryMetadata({
    id: 'tutorial-flow-config',
    schema: 'tutorial-flow-config-registry',
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: CONFIG_VERSION,
    source: sourcePath,
    entries: createRegistryEntries(),
    content: raw(),
  });
}

function validateRegistry() {
  return ConfigRegistryContract.validateRegistry({
    id: 'tutorial-flow-config',
    schema: 'tutorial-flow-config-registry',
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: CONFIG_VERSION,
    source: sourcePath,
    entries: createRegistryEntries(),
    content: raw(),
  }, {
    requireEntries: true,
    requireVersion: true,
    requireObjectKeyMatch: true,
  });
}

module.exports = {
  TUTORIAL_STEPS,
  TUTORIAL_EVENT_STEPS,
  PASS_THROUGH_ACTIONS,
  CLIENT_TUTORIAL_STEP_GATES,
  raw,
  getVersion: () => CONFIG_VERSION,
  getSourcePath: () => sourcePath,
  getRegistryMetadata,
  validateRegistry,
  createPhaseCompleted,
};
