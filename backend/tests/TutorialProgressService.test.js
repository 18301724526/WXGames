const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialService = require('../services/TutorialService');

test('initial tutorial state starts active instead of completed', () => {
  const tutorial = TutorialService.createInitialTutorialState();

  assert.equal(tutorial.completed, false);
  assert.equal(tutorial.currentStep, TutorialService.TUTORIAL_STEPS.initial);
  assert.deepEqual(tutorial.phaseCompleted, { newbie: false, era2: false });
});

test('disabled legacy tutorial states stay completed and pass validation', () => {
  const tutorial = TutorialService.normalizeTutorialState({ disabled: true, currentStep: 0 });
  const validation = TutorialService.validateAction(tutorial, 'advanceEra', {}, { currentEra: 99 });

  assert.equal(tutorial.completed, true);
  assert.equal(tutorial.disabled, true);
  assert.equal(validation.allowed, true);
});

test('tutorial validation blocks early era advancement until civilization is opened', () => {
  const tutorial = TutorialService.createInitialTutorialState();
  const validation = TutorialService.validateAction(tutorial, 'advanceEra', {}, { currentEra: 0 });

  assert.equal(validation.allowed, false);
  assert.equal(validation.code, 'TUTORIAL_BLOCKED');
});

test('tutorial house guide only allows the first house build before era advancement', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.houseGuideReady,
  );
  const gameState = { currentEra: 0, buildings: {}, resources: { food: 130 } };

  assert.equal(TutorialService.validateAction(tutorial, 'build', { target: 'house' }, gameState).allowed, true);
  assert.equal(TutorialService.validateAction(tutorial, 'build', { target: 'farm' }, gameState).allowed, false);
  assert.equal(TutorialService.validateAction(tutorial, 'advanceEra', {}, gameState).allowed, false);
});

test('tutorial grants first house supplies once without overwriting richer players', () => {
  const gameState = {
    currentEra: 0,
    resources: { food: 1, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    tutorial: TutorialService.createInitialTutorialState(),
  };

  assert.equal(TutorialService.ensureHouseGuideResources(gameState), true);
  assert.equal(gameState.resources.food, TutorialService.getHouseGuideMinimumResources().food);
  assert.equal(gameState.tutorial.grants.houseGuideSupplies, true);
  gameState.resources.food = 999;
  assert.equal(TutorialService.ensureHouseGuideResources(gameState), false);
  assert.equal(gameState.resources.food, 999);
});

test('tutorial advances monotonically by named events', () => {
  const initial = TutorialService.createInitialTutorialState();
  const opened = TutorialService.advanceTutorial(initial, 'civilizationTabOpened');
  const stale = TutorialService.advanceTutorial(opened, 'tutorialStarted');

  assert.equal(opened.currentStep, TutorialService.TUTORIAL_STEPS.civilizationTabOpened);
  assert.equal(stale.currentStep, opened.currentStep);
});

test('completed tutorial states continue to allow every action', () => {
  const tutorial = TutorialService.manualAdvance(
    TutorialService.createInitialTutorialState(),
    TutorialService.TUTORIAL_STEPS.completed,
  );

  assert.equal(tutorial.completed, true);
  assert.equal(TutorialService.validateAction(tutorial, 'upgrade', {}, {}).allowed, true);
});
