// Thin re-export of the shared tutorial flow table. The step data and ALL
// ordering helpers live in shared/tutorialFlowConfig.js (single source shared
// with the frontend). This module only keeps the config-pipeline registry
// surface (raw/version/registry metadata) stable for require sites.
const SharedTutorialFlowConfig = require('../../shared/tutorialFlowConfig');

const TUTORIAL_STEPS = SharedTutorialFlowConfig.TUTORIAL_STEPS;
const TUTORIAL_EVENT_STEPS = SharedTutorialFlowConfig.EVENT_STEPS;
const CLIENT_TUTORIAL_STEP_GATES = SharedTutorialFlowConfig.CLIENT_STEP_GATES;
const TASK_CLAIM_STEPS = SharedTutorialFlowConfig.TASK_CLAIM_STEPS;

const PASS_THROUGH_ACTIONS = Object.freeze([
  'applyTalentPolicy',
  'saveTalentPolicy',
  'deleteTalentPolicy',
  'research',
  'seekFamousPerson',
  'acceptFamousPerson',
  'dismissFamousPersonCandidate',
  'assignFamousAttributePoint',
  'switchCity',
]);

const ConfigRegistryContract = require('../services/config/ConfigRegistryContract');
const { clone } = require('../../shared/objectUtils');

// 3.0.0: steps are persisted/projected as NAMES; clientGate entry ids changed
// from numeric step keys to step names (removed entries -> major bump).
// 3.1.0: barracks segment inserted (barracksSuppliesClaimed,
// buildingsTabOpenedForBarracks, barracksBuilt, firstArmyClaimed) plus the
// barracksBuilt event and buildingsTabOpenedForBarracks client gate
// (added entries -> minor bump).
// 4.0.0: march-discovery refactor S5 — the tutorial first city is now PRE-PLACED
// and discovered by march vision (the invent-city engine + its route-truncation are
// deleted). The 6 tutorial steps are UNCHANGED; the retired directional-scout
// passThrough actions (scoutTerritory/claimScout, deleted with the scout system in
// S1) are removed here (removed entries -> major bump).
const CONFIG_VERSION = '4.0.0';
const CONFIG_SCHEMA_VERSION = 1;
const sourcePath = __filename;

function createPhaseCompleted(currentStep) {
  return {
    newbie: SharedTutorialFlowConfig.stepAtLeast(currentStep, TUTORIAL_STEPS.eraAdvancedTo1),
    era2: SharedTutorialFlowConfig.stepAtLeast(currentStep, TUTORIAL_STEPS.lumbermillBuilt),
    scoutFormation: SharedTutorialFlowConfig.stepAtLeast(currentStep, TUTORIAL_STEPS.scoutFormationSaved),
  };
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
    entries[id] = { id, step, minimumStep };
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
  STEP_ORDER: SharedTutorialFlowConfig.STEP_ORDER,
  TUTORIAL_STEPS,
  TUTORIAL_EVENT_STEPS,
  PASS_THROUGH_ACTIONS,
  CLIENT_TUTORIAL_STEP_GATES,
  TASK_CLAIM_STEPS,
  raw,
  getVersion: () => CONFIG_VERSION,
  getSourcePath: () => sourcePath,
  getRegistryMetadata,
  validateRegistry,
  createPhaseCompleted,
};
