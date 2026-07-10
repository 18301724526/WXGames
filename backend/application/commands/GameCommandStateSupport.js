'use strict';

const EventService = require('../../services/EventService');
const TutorialService = require('../../services/TutorialService');
const { GameConfig } = require('../../services/config/GameplayConfigRuntime');
const { parseFeatureFlagValue } = require('../../../shared/featureFlags');
const GameActionProjection = require('../projections/GameActionProjection');

function loadProjection(repository, playerId) {
  return repository.getClientProjectionForPlayer?.(playerId) || {};
}

function loadProgressedGameState(
  repository,
  gameStateService,
  playerId,
  projection = {},
  options = {},
) {
  const rawState = repository.findByPlayerId(playerId);
  if (!rawState) return null;
  return gameStateService.applyOnlineProgress
    ? gameStateService.applyOnlineProgress(rawState, new Date(), {
      planningContext: projection,
      worldEncounterRepo: repository.worldEncounterRepo,
      sharedWorldEncounters: projection.sharedWorldEncounters,
      resolveEngagedTimeouts: options.resolveEngagedTimeouts,
    })
    : gameStateService.normalizeState(rawState);
}

function isTutorialRuntimeEnabled() {
  return parseFeatureFlagValue(GameConfig.features?.tutorialEnabled, true);
}

function syncEra2Tutorial(gameState, gameStateService, options = {}) {
  const tutorial = TutorialService.normalizeTutorialState(gameState?.tutorial);
  if (!gameState) return tutorial;
  if (options.tutorialEnabled === false || !isTutorialRuntimeEnabled()) {
    gameState.tutorial = tutorial;
    return tutorial;
  }
  const eraProgress = gameStateService.calculateEraProgressFromNormalized
    ? gameStateService.calculateEraProgressFromNormalized(gameState)
    : gameStateService.calculateEraProgress(gameState);
  const nextTutorial = TutorialService.maybeActivateEra2Tutorial(
    tutorial,
    gameState,
    eraProgress,
  );
  gameState.tutorial = nextTutorial;
  return nextTutorial;
}

function generateCommandEvents(gameState) {
  EventService.maybeGenerateRegularEvent(gameState);
  EventService.maybeGenerateThreatEvent(gameState);
}

function normalizeResultTutorial(result = {}, fallback = {}, options = {}) {
  if (options.tutorialEnabled === false || !isTutorialRuntimeEnabled()) {
    return TutorialService.normalizeTutorialState(fallback);
  }
  return result.tutorial
    ? TutorialService.normalizeTutorialState(result.tutorial)
    : TutorialService.normalizeTutorialState(fallback);
}

function buildGameView(gameState, tutorial, gameStateService, projection = {}) {
  return GameActionProjection.buildGameActionView(
    gameState,
    tutorial,
    gameStateService,
    projection,
  );
}

module.exports = {
  buildGameView,
  generateCommandEvents,
  isTutorialRuntimeEnabled,
  loadProgressedGameState,
  loadProjection,
  normalizeResultTutorial,
  syncEra2Tutorial,
};
