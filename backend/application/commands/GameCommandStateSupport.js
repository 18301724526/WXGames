'use strict';

const EventService = require('../../services/EventService');
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

function generateCommandEvents(gameState) {
  EventService.maybeGenerateRegularEvent(gameState);
  EventService.maybeGenerateThreatEvent(gameState);
}

function buildGameView(gameState, gameStateService, projection = {}) {
  return GameActionProjection.buildGameActionView(
    gameState,
    gameStateService,
    projection,
  );
}

module.exports = {
  buildGameView,
  generateCommandEvents,
  loadProgressedGameState,
  loadProjection,
};
