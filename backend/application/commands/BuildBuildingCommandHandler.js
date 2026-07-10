'use strict';

const BuildingActionService = require('../../services/BuildingActionService');
const TutorialService = require('../../services/TutorialService');
const { requireOwnerContext } = require('./CommandOwnerContext');
const {
  generateCommandEvents,
  isTutorialRuntimeEnabled,
  normalizeResultTutorial,
  syncEra2Tutorial,
} = require('./GameCommandStateSupport');

class BuildBuildingCommandHandler {
  constructor(options = {}) {
    this.gameStateService = options.gameStateService;
  }

  validate(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    const tutorialEnabled = isTutorialRuntimeEnabled();
    context.application.tutorialEnabled = tutorialEnabled;
    const tutorial = syncEra2Tutorial(context.state, this.gameStateService, { tutorialEnabled });
    context.application.tutorial = tutorial;
    if (!tutorialEnabled) return { success: true };
    const payload = context.envelope?.payload || {};
    const result = TutorialService.validateAction(tutorial, 'build', {
      target: payload.buildingId,
      cityId: payload.cityId,
    }, context.state);
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
    const payload = context.envelope?.payload || {};
    const result = BuildingActionService.build(
      context.state,
      context.application.tutorial,
      payload.buildingId,
    );
    if (!result.success) return result;
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
  BuildBuildingCommandHandler,
};
