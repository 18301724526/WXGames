'use strict';

const { requireOwnerContext } = require('./CommandOwnerContext');

class PlayerResetCommandHandler {
  constructor(options = {}) {
    this.createResetStateForPlayer = options.createResetStateForPlayer;
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
    const gameState = this.createResetStateForPlayer(context.envelope.playerId);
    context.state = gameState;
    return {
      success: true,
      message: '游戏进度已重置',
    };
  }
}

module.exports = {
  PlayerResetCommandHandler,
};
