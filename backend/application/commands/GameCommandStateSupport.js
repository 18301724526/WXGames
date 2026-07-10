'use strict';

const EventService = require('../../services/EventService');
const TutorialService = require('../../services/TutorialService');
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

function syncEra2Tutorial(gameState, gameStateService) {
  const tutorial = TutorialService.normalizeTutorialState(gameState?.tutorial);
  if (!gameState) return tutorial;
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

function normalizeResultTutorial(result = {}, fallback = {}) {
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
  loadProgressedGameState,
  loadProjection,
  normalizeResultTutorial,
  syncEra2Tutorial,
};
