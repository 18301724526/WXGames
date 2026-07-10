const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateNormalizer = require('../services/GameStateNormalizer');
const GameStateService = require('../services/GameStateService');
const { GameConfig } = require('../services/config/GameplayConfigRuntime');

test('client game state projects tutorialEnabled from backend GameConfig features', () => {
  const state = GameStateNormalizer.createInitialGameState('tutorial-feature-projection-test');
  const clientState = GameStateService.getClientGameStateFromNormalized(state);

  assert.equal(GameConfig.features.tutorialEnabled, 1);
  assert.equal(clientState.tutorialEnabled, true);
});
