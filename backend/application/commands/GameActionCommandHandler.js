'use strict';

const GameActionRegistry = require('../../actions/GameActionRegistry');
const TutorialService = require('../../services/TutorialService');
const WorldExplorerTrace = require('../../services/worldExplorer/WorldExplorerTrace');
const { requireOwnerContext } = require('./CommandOwnerContext');
const {
  generateCommandEvents,
  isTutorialRuntimeEnabled,
  normalizeResultTutorial,
  syncEra2Tutorial,
} = require('./GameCommandStateSupport');

function buildTutorialPayload(payload = {}) {
  return {
    ...payload,
    target: payload.target ?? payload.buildingId ?? payload.job,
  };
}

class GameActionCommandHandler {
  constructor(options = {}) {
    this.gameStateService = options.gameStateService;
    this.repository = options.repository;
  }

  validate(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    const action = context.envelope?.type || '';
    if (!GameActionRegistry.has(action)) {
      return {
        success: false,
        statusCode: 400,
        error: 'UNKNOWN_ACTION',
        message: '未知操作',
      };
    }
    if (action === 'startConquest' || action === 'claimConquest' || action === 'renameCity') {
      const territoryId = String(context.envelope?.payload?.territoryId || '').trim();
      const sharedTerritory = this.repository?.getSharedWorldTerritory?.(territoryId);
      if (sharedTerritory?.ownerPlayerId
          && sharedTerritory.ownerPlayerId !== context.envelope.playerId) {
        return {
          success: false,
          statusCode: 409,
          error: 'TERRITORY_ALREADY_OCCUPIED',
          message: '该地点已被其他势力占领',
        };
      }
    }
    const tutorialEnabled = isTutorialRuntimeEnabled();
    context.application.tutorialEnabled = tutorialEnabled;
    const tutorial = syncEra2Tutorial(context.state, this.gameStateService, { tutorialEnabled });
    context.application.tutorial = tutorial;
    if (!tutorialEnabled) return { success: true };
    const result = TutorialService.validateAction(
      tutorial,
      action,
      buildTutorialPayload(context.envelope?.payload || {}),
      context.state,
    );
    if (result.allowed) return { success: true };
    return {
      success: false,
      statusCode: 403,
      error: result.code,
      message: result.message,
    };
  }

  execute(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    generateCommandEvents(context.state);
    const payload = { ...(context.envelope?.payload || {}) };
    if (context.envelope?.type === 'startWorldMarch'
        && context.ownerResolution?.lookupPerformed) {
      payload.ownerEncounterLookupPerformed = true;
      if (context.ownerResolution.targetId) payload.encounterId = context.ownerResolution.targetId;
    }
    const result = WorldExplorerTrace.run(
      Boolean(context.application.traceEnabled),
      () => GameActionRegistry.execute({
        action: context.envelope.type,
        body: payload,
        gameState: context.state,
        tutorial: context.application.tutorial,
        planningContext: context.application.projection,
        worldEncounterRepo: context.application.worldEncounterRepo,
        sharedWorldEncounters: context.application.projection?.sharedWorldEncounters,
      }),
    );
    context.state.tutorial = normalizeResultTutorial(
      result,
      context.application.tutorial,
      { tutorialEnabled: context.application.tutorialEnabled },
    );
    context.application.tutorial = syncEra2Tutorial(context.state, this.gameStateService, {
      tutorialEnabled: context.application.tutorialEnabled,
    });
    generateCommandEvents(context.state);
    return result;
  }
}

module.exports = {
  GameActionCommandHandler,
  buildTutorialPayload,
};
