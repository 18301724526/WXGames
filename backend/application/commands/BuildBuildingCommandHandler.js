'use strict';

const BuildingActionService = require('../../services/BuildingActionService');
const { requireOwnerContext } = require('./CommandOwnerContext');
const {
  generateCommandEvents,
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
    return { success: true };
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
      payload.buildingId,
    );
    if (!result.success) return result;
    generateCommandEvents(context.state);
    return result;
  }
}

module.exports = {
  BuildBuildingCommandHandler,
};
