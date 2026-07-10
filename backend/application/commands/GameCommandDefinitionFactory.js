'use strict';

const TutorialService = require('../../services/TutorialService');
const { BuildBuildingCommandHandler } = require('./BuildBuildingCommandHandler');
const { GameActionCommandHandler } = require('./GameActionCommandHandler');
const { HeartbeatCommandHandler } = require('./HeartbeatCommandHandler');
const { PlayerResetCommandHandler } = require('./PlayerResetCommandHandler');
const { TaskClaimCommandHandler } = require('./TaskClaimCommandHandler');
const {
  buildGameView,
  loadProgressedGameState,
  loadProjection,
} = require('./GameCommandStateSupport');

class GameCommandDefinitionFactory {
  constructor(options = {}) {
    if (!options.repository) throw new Error('GameCommandDefinitionFactory requires repository');
    if (!options.gameStateService) {
      throw new Error('GameCommandDefinitionFactory requires gameStateService');
    }
    this.repository = options.repository;
    this.gameStateService = options.gameStateService;
    this.now = options.now || (() => new Date());
    this.buildHandler = new BuildBuildingCommandHandler({
      gameStateService: this.gameStateService,
    });
    this.gameActionHandler = new GameActionCommandHandler({
      gameStateService: this.gameStateService,
    });
    this.taskClaimHandler = new TaskClaimCommandHandler({
      gameStateService: this.gameStateService,
    });
    this.heartbeatHandler = new HeartbeatCommandHandler({
      gameStateService: this.gameStateService,
      now: this.now,
    });
  }

  _prepareApplication(context, options = {}) {
    const projection = loadProjection(this.repository, context.envelope.playerId);
    context.application = {
      projection,
      traceEnabled: Boolean(options.traceEnabled),
      worldEncounterRepo: this.repository.worldEncounterRepo || null,
    };
    return context.application;
  }

  _loadProgressedState(context, options = {}) {
    const application = this._prepareApplication(context, options);
    return loadProgressedGameState(
      this.repository,
      this.gameStateService,
      context.envelope.playerId,
      application.projection,
    );
  }

  _projectGameView(context) {
    const responseProjection = loadProjection(this.repository, context.envelope.playerId);
    const tutorial = context.application.tutorial
      || TutorialService.normalizeTutorialState(context.state?.tutorial);
    return {
      result: context.execution || {},
      view: buildGameView(
        context.state,
        tutorial,
        this.gameStateService,
        responseProjection,
      ),
    };
  }

  _createProjectedDefinition(handler, options = {}) {
    return {
      load: (context) => this._loadProgressedState(context, options),
      validate: (context) => handler.validate(context),
      execute: (context) => handler.execute(context),
      commitRejected: options.commitRejected === true,
      persistence: { strategy: 'save' },
      project: (context) => this._projectGameView(context),
      respond: (context) => ({
        statusCode: context.execution?.success === false ? 400 : 200,
        payload: {
          ...(context.projection?.result || {}),
          ...(context.projection?.view || {}),
        },
      }),
    };
  }

  createGameActionDefinition(commandType, options = {}) {
    const handler = commandType === 'build' ? this.buildHandler : this.gameActionHandler;
    return this._createProjectedDefinition(handler, {
      ...options,
      commitRejected: commandType !== 'build',
    });
  }

  createTaskClaimDefinition(options = {}) {
    return this._createProjectedDefinition(this.taskClaimHandler, {
      ...options,
      commitRejected: true,
    });
  }

  createHeartbeatDefinition(options = {}) {
    return {
      allowMissingState: true,
      load: (context) => {
        this._prepareApplication(context, options);
        return this.repository.findByPlayerId?.(context.envelope.playerId) || null;
      },
      validate: (context) => this.heartbeatHandler.validate(context),
      execute: (context) => this.heartbeatHandler.execute(context),
      persistence: { strategy: 'save-if-changed' },
      project: (context) => ({
        worldMarchVerification: context.state?.worldMarchVerification || null,
      }),
      respond: (context) => ({
        statusCode: 200,
        payload: {
          type: 'heartbeat',
          serverTime: context.execution.serverTime,
          heartbeatSeq: context.execution.heartbeatSeq,
          worldMarchVerification: context.projection.worldMarchVerification,
        },
      }),
    };
  }

  createPlayerResetDefinition(options = {}) {
    const handler = new PlayerResetCommandHandler({
      createResetStateForPlayer: options.createResetStateForPlayer,
    });
    return {
      allowMissingState: true,
      load: (context) => {
        context.application = {};
        return null;
      },
      validate: (context) => handler.validate(context),
      execute: (context) => handler.execute(context),
      persistence: { strategy: 'reset-player-state' },
      project: (context) => {
        const projection = loadProjection(this.repository, context.envelope.playerId);
        const clientState = this.gameStateService.getClientGameStateFromNormalized
          ? this.gameStateService.getClientGameStateFromNormalized(context.state, projection)
          : this.gameStateService.getClientGameState(context.state, projection);
        const eraProgress = this.gameStateService.calculateEraProgressFromNormalized
          ? this.gameStateService.calculateEraProgressFromNormalized(context.state)
          : this.gameStateService.calculateEraProgress(context.state);
        return {
          gameState: clientState,
          tutorial: context.state.tutorial,
          eraProgress,
        };
      },
      respond: (context) => ({
        statusCode: 200,
        payload: {
          ...context.execution,
          ...context.projection,
        },
      }),
    };
  }
}

module.exports = {
  GameCommandDefinitionFactory,
};
