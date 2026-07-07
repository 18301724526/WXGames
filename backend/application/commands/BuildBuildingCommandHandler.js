const TutorialService = require('../../services/TutorialService');
const EventService = require('../../services/EventService');
const BuildingActionService = require('../../services/BuildingActionService');
const GameActionProjection = require('../projections/GameActionProjection');
const CommandTrace = require('./CommandTrace');

function isGameStateRevisionConflict(error = {}) {
  return error?.code === 'GAME_STATE_REVISION_CONFLICT';
}

function loadProjection(repository, playerId) {
  return repository.getClientProjectionForPlayer?.(playerId) || {};
}

function loadProgressedGameState(repository, gameStateService, playerId, options = {}) {
  const rawState = repository.findByPlayerId(playerId);
  if (!rawState) return null;
  return gameStateService.applyOnlineProgress
    ? gameStateService.applyOnlineProgress(rawState, new Date(), options)
    : gameStateService.normalizeState(rawState);
}

function syncEra2Tutorial(gameState, gameStateService) {
  const tutorial = TutorialService.normalizeTutorialState(gameState.tutorial);
  const eraProgress = gameStateService.calculateEraProgressFromNormalized
    ? gameStateService.calculateEraProgressFromNormalized(gameState)
    : gameStateService.calculateEraProgress(gameState);
  const nextTutorial = TutorialService.maybeActivateEra2Tutorial(tutorial, gameState, eraProgress);
  gameState.tutorial = nextTutorial;
  return nextTutorial;
}

function buildFailurePayload(error, trace, options = {}) {
  const command = trace.toPayload({
    committed: options.committed ?? trace.committed,
    phase: options.phase || trace.phase,
  });
  return {
    success: Boolean(options.success),
    error: options.error || 'COMMAND_FAILED',
    message: options.message || error?.message || 'Command failed',
    command,
    commandId: command.commandId,
    requestId: command.requestId,
    phase: command.phase,
    committed: command.committed,
    revisionBefore: command.revisionBefore,
    revisionAfter: command.revisionAfter,
    retryable: Boolean(options.retryable),
    resyncRequired: Boolean(options.resyncRequired),
  };
}

function logCommandFailure(error, trace, options = {}) {
  try {
    console.error('[BuildBuildingCommand] failed', {
      command: trace.toPayload({
        phase: options.phase || trace.phase,
        committed: options.committed ?? trace.committed,
      }),
      error: {
        name: error?.name || 'Error',
        code: error?.code || '',
        message: error?.message || '',
        stack: error?.stack || '',
      },
    });
  } catch (_error) {
    return undefined;
  }
}

class BuildBuildingCommandHandler {
  constructor(options = {}) {
    this.repository = options.repository;
    this.gameStateService = options.gameStateService;
    this.projectionService = options.projectionService || GameActionProjection;
  }

  execute(command = {}, options = {}) {
    const trace = new CommandTrace(command, { retryAttempt: options.retryAttempt || 0 });
    let projection = {};
    let gameState = null;
    let syncedTutorial = null;

    try {
      trace.mark('projection_context_loading');
      projection = loadProjection(this.repository, command.playerId);

      trace.mark('state_loading');
      gameState = loadProgressedGameState(
        this.repository,
        this.gameStateService,
        command.playerId,
        {
          planningContext: projection,
          worldEncounterRepo: this.repository.worldEncounterRepo,
          sharedWorldEncounters: projection.sharedWorldEncounters,
        },
      );
      if (!gameState) {
        trace.mark('state_missing');
        return {
          statusCode: 404,
          payload: buildFailurePayload(new Error('Game state not found'), trace, {
            error: 'GAME_STATE_NOT_FOUND',
            message: '游戏状态不存在',
          }),
        };
      }
      trace.setRevisionBefore(gameState.revision);

      trace.mark('tutorial_syncing');
      const tutorial = syncEra2Tutorial(gameState, this.gameStateService);

      trace.mark('policy_checking');
      const tutorialCheck = TutorialService.validateAction(
        tutorial,
        'build',
        {
          target: command.payload?.buildingId,
          cityId: command.payload?.cityId,
        },
        gameState,
      );
      if (!tutorialCheck.allowed) {
        trace.mark('policy_rejected', { code: tutorialCheck.code || '' });
        return {
          statusCode: 403,
          payload: buildFailurePayload(new Error(tutorialCheck.message), trace, {
            error: tutorialCheck.code,
            message: tutorialCheck.message,
          }),
        };
      }

      trace.mark('events_generating_before');
      EventService.maybeGenerateRegularEvent(gameState);
      EventService.maybeGenerateThreatEvent(gameState);

      trace.mark('domain_executing');
      const result = BuildingActionService.build(gameState, tutorial, command.payload?.buildingId);
      if (!result.success) {
        trace.mark('domain_rejected', { code: result.error || '' });
        return {
          statusCode: 400,
          payload: {
            ...result,
            command: trace.toPayload(),
            commandId: command.commandId,
            requestId: command.requestId,
            phase: trace.phase,
            committed: false,
          },
        };
      }

      trace.mark('tutorial_persisting');
      const nextTutorial = result.tutorial
        ? TutorialService.normalizeTutorialState(result.tutorial)
        : tutorial;
      gameState.tutorial = nextTutorial;
      syncedTutorial = syncEra2Tutorial(gameState, this.gameStateService);

      trace.mark('events_generating_after');
      EventService.maybeGenerateRegularEvent(gameState);
      EventService.maybeGenerateThreatEvent(gameState);

      trace.mark('persisting');
      const savedState = this.repository.save(gameState);
      trace.setCommitted(savedState?.revision ?? gameState.revision);

      trace.mark('projecting');
      const responseProjection = loadProjection(this.repository, command.playerId);
      const view = this.projectionService.buildGameActionView(
        gameState,
        syncedTutorial,
        this.gameStateService,
        responseProjection,
      );

      trace.mark('responding');
      return {
        statusCode: 200,
        payload: {
          ...result,
          ...view,
          command: trace.toPayload({ phase: 'responding' }),
          commandId: command.commandId,
          requestId: command.requestId,
          phase: 'responding',
          committed: true,
          resyncRequired: false,
        },
      };
    } catch (error) {
      if (isGameStateRevisionConflict(error)) {
        error.commandFailure = trace.toPayload({
          phase: trace.phase,
          committed: trace.committed,
        });
        throw error;
      }

      if (trace.committed) {
        logCommandFailure(error, trace, { phase: trace.phase, committed: true });
        return {
          statusCode: 202,
          payload: buildFailurePayload(error, trace, {
            success: true,
            error: 'PROJECTION_FAILED_AFTER_COMMIT',
            message: '操作已生效，请重新同步游戏状态',
            committed: true,
            phase: trace.phase,
            resyncRequired: true,
          }),
        };
      }

      logCommandFailure(error, trace, { phase: trace.phase, committed: false });
      return {
        statusCode: 500,
        payload: buildFailurePayload(error, trace, {
          error: 'COMMAND_INTERNAL_ERROR',
          message: '建造操作未能完成，请重试',
          committed: false,
          phase: trace.phase,
        }),
      };
    }
  }
}

module.exports = {
  BuildBuildingCommandHandler,
  buildFailurePayload,
  isGameStateRevisionConflict,
};
