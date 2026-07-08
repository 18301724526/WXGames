'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('./tutorialFlowConfig');

test('STEP_ORDER keeps the 41-step order (initial..completed, barracks segment inserted)', () => {
  assert.equal(STEP_ORDER.length, 41);
  assert.equal(STEP_ORDER[0], 'initial');
  assert.equal(STEP_ORDER[1], 'tutorialStarted');
  assert.equal(STEP_ORDER[4], 'houseBuilt');
  assert.equal(STEP_ORDER[9], 'farmBuilt');
  assert.equal(STEP_ORDER[15], 'lumbermillBuilt');
  // Barracks segment between era3Advanced and scoutFamousGranted.
  assert.deepEqual(STEP_ORDER.slice(17, 23), [
    'era3Advanced',
    'barracksSuppliesClaimed',
    'buildingsTabOpenedForBarracks',
    'barracksBuilt',
    'firstArmyClaimed',
    'scoutFamousGranted',
  ]);
  assert.equal(STEP_ORDER[26], 'scoutFormationSaved');
  assert.equal(STEP_ORDER[33], 'polityNamed');
  assert.equal(STEP_ORDER[40], 'completed');
  assert.equal(new Set(STEP_ORDER).size, STEP_ORDER.length);
});

test('TUTORIAL_STEPS is a frozen name->name identity map over STEP_ORDER', () => {
  assert.ok(Object.isFrozen(TUTORIAL_STEPS));
  assert.deepEqual(Object.keys(TUTORIAL_STEPS), [...STEP_ORDER]);
  for (const name of STEP_ORDER) {
    assert.equal(TUTORIAL_STEPS[name], name);
  }
});

test('stepIndex maps names to their order and accepts legacy numbers', () => {
  assert.equal(stepIndex('initial'), 0);
  assert.equal(stepIndex('houseBuilt'), 4);
  assert.equal(stepIndex('completed'), 40);
  assert.equal(stepIndex(22), 22);
  assert.equal(stepIndex('22'), 22);
  assert.equal(stepIndex(22.9), 22);
  assert.equal(stepIndex(-3), 0);
  assert.equal(stepIndex(99), 40);
  assert.equal(stepIndex('bogusStep'), -1);
  assert.equal(stepIndex(undefined), -1);
  assert.equal(stepIndex(NaN), -1);
  assert.equal(stepIndex(null), 0);
});

test('stepName canonicalizes names and legacy numbers; unknown -> empty', () => {
  assert.equal(stepName('scoutFormationSaved'), 'scoutFormationSaved');
  assert.equal(stepName(26), 'scoutFormationSaved');
  assert.equal(stepName(99), 'completed');
  assert.equal(stepName(-1), 'initial');
  assert.equal(stepName('nope'), '');
  assert.equal(stepName(undefined), '');
});

test('payloadStepName resolves names and exact legacy indexes without clamping', () => {
  assert.equal(payloadStepName('talentPolicyOpened'), 'talentPolicyOpened');
  assert.equal(payloadStepName(34), 'talentPolicyOpened');
  assert.equal(payloadStepName('34'), 'talentPolicyOpened');
  assert.equal(payloadStepName(44), '');
  assert.equal(payloadStepName(-1), '');
  assert.equal(payloadStepName('nope'), '');
  assert.equal(payloadStepName(undefined), '');
});

test('compare helpers order steps and reject unknowns like legacy NaN math', () => {
  assert.ok(compareSteps('houseBuilt', 'farmBuilt') < 0);
  assert.ok(compareSteps('completed', 'initial') > 0);
  assert.equal(compareSteps('farmBuilt', 9), 0);
  assert.ok(stepEquals('farmBuilt', 9));
  assert.ok(!stepEquals('bogus', 'bogus'));
  assert.ok(stepAtLeast('farmBuilt', 'houseBuilt'));
  assert.ok(stepAtLeast('farmBuilt', 'farmBuilt'));
  assert.ok(!stepAtLeast('houseBuilt', 'farmBuilt'));
  assert.ok(!stepAtLeast(undefined, 'initial'));
  assert.ok(stepAtMost('houseBuilt', 'farmBuilt'));
  assert.ok(stepAtMost('farmBuilt', 'farmBuilt'));
  assert.ok(!stepAtMost('farmBuilt', 'houseBuilt'));
  assert.ok(stepBefore('houseBuilt', 'farmBuilt'));
  assert.ok(!stepBefore('farmBuilt', 'farmBuilt'));
  assert.ok(!stepBefore(undefined, 'completed'));
  assert.ok(isValidStep('era3Advanced'));
  assert.ok(isValidStep(17));
  assert.ok(!isValidStep('era99'));
  assert.ok(!isValidStep(undefined));
});

test('EVENT_STEPS mirrors the event->step table 1:1', () => {
  assert.equal(Object.keys(EVENT_STEPS).length, 32);
  assert.equal(EVENT_STEPS.eraAdvanced, 'eraAdvancedTo1');
  assert.equal(EVENT_STEPS.eraAdvancedTo2, 'eraAdvancedTo2');
  assert.equal(EVENT_STEPS.specialEventClaimed, 'specialEventClaimed');
  assert.equal(EVENT_STEPS.barracksBuilt, 'barracksBuilt');
  assert.equal(EVENT_STEPS.famousSeekCompleted, 'famousSeekCompleted');
  for (const step of Object.values(EVENT_STEPS)) {
    assert.ok(isValidStep(step), `event step ${step} must be a valid step name`);
  }
});

test('CLIENT_STEP_GATES mirrors the client gate table 1:1', () => {
  assert.equal(Object.keys(CLIENT_STEP_GATES).length, 17);
  assert.equal(CLIENT_STEP_GATES.tutorialStarted, 'initial');
  assert.equal(CLIENT_STEP_GATES.civilizationTabOpened, 'houseBuilt');
  assert.equal(CLIENT_STEP_GATES.buildingsTabOpenedForBarracks, 'barracksSuppliesClaimed');
  assert.equal(CLIENT_STEP_GATES.scoutWorldPanelOpened, 'scoutFormationSaved');
  assert.equal(CLIENT_STEP_GATES.completed, 'finalTechOpened');
  for (const [step, minimum] of Object.entries(CLIENT_STEP_GATES)) {
    assert.ok(isValidStep(step), `gate step ${step} must be valid`);
    assert.ok(isValidStep(minimum), `gate minimum ${minimum} must be valid`);
    assert.ok(stepBefore(minimum, step), `gate minimum ${minimum} must precede ${step}`);
  }
});

test('TASK_CLAIM_STEPS carries the task-center claim advances', () => {
  assert.deepEqual(TASK_CLAIM_STEPS, {
    main_first_supplies: 'farmPrepReserved',
    main_lumbermill_supplies: 'era3AdvanceReady',
    main_barracks_supplies: 'barracksSuppliesClaimed',
    main_first_army: 'firstArmyClaimed',
    main_scout_officer: 'scoutFamousGranted',
  });
});
