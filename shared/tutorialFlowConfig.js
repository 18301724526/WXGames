'use strict';

// Single source of truth for the tutorial flow step table.
//
// The persisted `tutorial.currentStep` stores the step NAME (e.g.
// 'scoutFormationSaved'), which makes the save format insertion-proof: adding a
// step to STEP_ORDER renumbers nothing that is persisted. Legacy numeric steps
// are still accepted everywhere via stepIndex()/stepName().
//
// ALL step-ordering logic lives here. Consumers must never compare steps with
// relational operators directly (scripts/check-tutorial-step-contract.js
// enforces this); they call the helpers below instead.

const STEP_ORDER = Object.freeze([
  'initial',
  'tutorialStarted',
  'cityEntered',
  'houseGuideReady',
  'houseBuilt',
  'civilizationTabOpened',
  'eraAdvancedTo1',
  'buildingsTabOpened',
  'farmPrepReserved',
  'farmBuilt',
  'era2AdvanceReady',
  'eraAdvancedTo2',
  'specialEventTabOpened',
  'specialEventClaimed',
  'buildingsTabOpenedForLumbermill',
  'lumbermillBuilt',
  'era3AdvanceReady',
  'era3Advanced',
  'scoutFamousGranted',
  'famousPanelOpened',
  'famousCardViewed',
  'formationPanelOpened',
  'scoutFormationSaved',
  'scoutWorldPanelOpened',
  'scoutExploreStarted',
  'firstCityDiscovered',
  'firstCityConquestStarted',
  'firstCityOccupied',
  'firstCityNamed',
  'polityNamed',
  'talentPolicyOpened',
  'talentPolicyApplied',
  'manualTalentAssigned',
  'famousSeekOpened',
  'famousSeekCompleted',
  'finalTechOpened',
  'completed',
]);

// name -> name identity map: TUTORIAL_STEPS.houseBuilt === 'houseBuilt'.
const TUTORIAL_STEPS = Object.freeze(Object.fromEntries(STEP_ORDER.map((name) => [name, name])));

const STEP_INDEX_BY_NAME = Object.freeze(
  Object.fromEntries(STEP_ORDER.map((name, index) => [name, index])),
);

// Event name -> step name (event names are not always step names: 'eraAdvanced'
// lands on 'eraAdvancedTo1').
const EVENT_STEPS = Object.freeze({
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
  firstCityDiscovered: TUTORIAL_STEPS.firstCityDiscovered,
  firstCityConquestStarted: TUTORIAL_STEPS.firstCityConquestStarted,
  firstCityOccupied: TUTORIAL_STEPS.firstCityOccupied,
  firstCityNamed: TUTORIAL_STEPS.firstCityNamed,
  polityNamed: TUTORIAL_STEPS.polityNamed,
  talentPolicyApplied: TUTORIAL_STEPS.talentPolicyApplied,
  manualTalentAssigned: TUTORIAL_STEPS.manualTalentAssigned,
  famousSeekCompleted: TUTORIAL_STEPS.famousSeekCompleted,
});

// Client-advanceable step -> minimum currentStep required before the client may
// request it ('tutorialAdvance' API gate).
const CLIENT_STEP_GATES = Object.freeze({
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

// Task-center reward claim -> tutorial step advanced after claiming.
const TASK_CLAIM_STEPS = Object.freeze({
  main_first_supplies: TUTORIAL_STEPS.farmPrepReserved,
  main_lumbermill_supplies: TUTORIAL_STEPS.era3AdvanceReady,
});

// name -> index in STEP_ORDER; legacy number -> that number (floored, clamped
// into [0, STEP_ORDER.length - 1], mirroring the legacy persistence clamp);
// unknown -> -1. Number coercion intentionally follows legacy Number()
// semantics (null/'' -> 0 -> 'initial', undefined/garbage -> -1).
function stepIndex(step) {
  if (typeof step === 'string' && STEP_INDEX_BY_NAME[step] !== undefined) {
    return STEP_INDEX_BY_NAME[step];
  }
  const number = Number(step);
  if (!Number.isFinite(number)) return -1;
  return Math.max(0, Math.min(STEP_ORDER.length - 1, Math.floor(number)));
}

// Canonical step name for a name-or-legacy-number value; unknown -> ''.
function stepName(step) {
  const index = stepIndex(step);
  return index >= 0 ? STEP_ORDER[index] : '';
}

// Resolve a client-supplied payload step (name or legacy number) WITHOUT
// clamping: a numeric payload only resolves when it is an exact index. This
// preserves the legacy API behavior where out-of-range numbers are rejected.
function payloadStepName(step) {
  if (typeof step === 'string' && STEP_INDEX_BY_NAME[step] !== undefined) return step;
  const number = Number(step);
  if (!Number.isFinite(number)) return '';
  return STEP_ORDER[Math.floor(number)] || '';
}

function isValidStep(step) {
  return stepIndex(step) >= 0;
}

// Ordering difference; unknown steps resolve to -1 (sort before 'initial').
function compareSteps(a, b) {
  return stepIndex(a) - stepIndex(b);
}

// The boolean helpers below return false when either side is unknown, matching
// the legacy NaN-comparison semantics (NaN < x, NaN >= x, ... are all false).
function stepEquals(a, b) {
  const left = stepIndex(a);
  return left >= 0 && left === stepIndex(b);
}

function stepAtLeast(current, target) {
  const currentIndex = stepIndex(current);
  const targetIndex = stepIndex(target);
  return currentIndex >= 0 && targetIndex >= 0 && currentIndex >= targetIndex;
}

function stepAtMost(current, target) {
  const currentIndex = stepIndex(current);
  const targetIndex = stepIndex(target);
  return currentIndex >= 0 && targetIndex >= 0 && currentIndex <= targetIndex;
}

function stepBefore(current, target) {
  const currentIndex = stepIndex(current);
  const targetIndex = stepIndex(target);
  return currentIndex >= 0 && targetIndex >= 0 && currentIndex < targetIndex;
}

const api = {
  STEP_ORDER,
  TUTORIAL_STEPS,
  EVENT_STEPS,
  CLIENT_STEP_GATES,
  TASK_CLAIM_STEPS,
  stepIndex,
  stepName,
  payloadStepName,
  isValidStep,
  compareSteps,
  stepEquals,
  stepAtLeast,
  stepAtMost,
  stepBefore,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.TutorialFlowShared = api;
