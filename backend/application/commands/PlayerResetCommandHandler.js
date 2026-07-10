'use strict';

const { requireOwnerContext } = require('./CommandOwnerContext');

class PlayerResetCommandHandler {
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
    return {
      success: true,
      message: '游戏进度已重置',
    };
  }
}

module.exports = {
  PlayerResetCommandHandler,
};
