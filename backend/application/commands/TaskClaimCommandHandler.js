'use strict';

const TaskCenterService = require('../../services/TaskCenterService');
const { requireOwnerContext } = require('./CommandOwnerContext');
const {
  generateCommandEvents,
  normalizeResultTutorial,
  syncEra2Tutorial,
} = require('./GameCommandStateSupport');

function markTaskRuntimeError(error) {
  if (error?.code === 'TASK_DEFINITIONS_RUNTIME_NOT_READY'
      || error?.code === 'TASK_DEFINITIONS_SOURCE_OVERRIDE_DISABLED') {
    error.status = 503;
  }
  return error;
}

class TaskClaimCommandHandler {
  constructor(options = {}) {
    this.gameStateService = options.gameStateService;
  }

  validate(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    context.application.tutorial = syncEra2Tutorial(context.state, this.gameStateService);
    return { success: true };
  }

  execute(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    try {
      generateCommandEvents(context.state);
      const payload = context.envelope?.payload || {};
      const result = TaskCenterService.claimTask(
        context.state,
        payload.taskId,
        payload.category,
      );
      context.state.tutorial = normalizeResultTutorial(
        result,
        context.state.tutorial || context.application.tutorial,
      );
      context.application.tutorial = syncEra2Tutorial(context.state, this.gameStateService);
      generateCommandEvents(context.state);
      return result;
    } catch (error) {
      throw markTaskRuntimeError(error);
    }
  }
}

module.exports = {
  TaskClaimCommandHandler,
  markTaskRuntimeError,
};
