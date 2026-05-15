const test = require('node:test');
const assert = require('node:assert/strict');
const TutorialService = require('../services/TutorialService');
const gameStateService = require('../services/GameStateService');

test('教程步骤限制时代进阶', () => {
  const state = gameStateService.createInitialGameState('p1');
  const result = TutorialService.validateAction(state.tutorial, 'advanceEra', {}, state);
  assert.equal(result.allowed, false);
});

test('教程事件推进到完成', () => {
  let tutorial = TutorialService.createInitialTutorialState();
  tutorial = TutorialService.advanceTutorial(tutorial, 'tutorialStarted');
  tutorial = TutorialService.advanceTutorial(tutorial, 'civilizationTabOpened');
  tutorial = TutorialService.advanceTutorial(tutorial, 'eraAdvanced');
  tutorial = TutorialService.advanceTutorial(tutorial, 'buildingsTabOpened');
  tutorial = TutorialService.advanceTutorial(tutorial, 'farmBuilt');
  assert.equal(tutorial.completed, true);
  assert.equal(tutorial.currentStep, 7);
});
