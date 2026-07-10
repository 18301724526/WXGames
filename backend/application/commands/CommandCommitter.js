'use strict';

const { requireOwnerContext } = require('./CommandOwnerContext');

class CommandCommitter {
  constructor(options = {}) {
    this.repository = options.repository;
    this.idempotencyStore = options.idempotencyStore;
  }

  commit(context = {}, definition = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    const revisionBefore = context.trace?.revisionBefore ?? context.state?.revision ?? null;
    const persistence = definition.persistence || {};
    const strategy = persistence.strategy || 'save';
    let savedState = context.state;
    if (strategy === 'save') {
      savedState = this.repository.save(context.state);
    } else if (strategy === 'save-if-changed') {
      if (context.execution?.changed) savedState = this.repository.save(context.state);
    } else if (strategy === 'reset-player-state') {
      savedState = this.repository.resetPlayerState(
        context.envelope.playerId,
        context.state,
      );
    } else if (strategy !== 'none') {
      const error = new Error(`Unsupported command persistence strategy: ${strategy}`);
      error.code = 'COMMAND_PERSISTENCE_STRATEGY_INVALID';
      throw error;
    }
    const authoritativeState = savedState || context.state;
    return {
      schema: 'command-commit-result-v1',
      status: 'committed',
      persistenceStrategy: strategy,
      state: authoritativeState,
      revisionBefore,
      revisionAfter: authoritativeState?.revision ?? context.state?.revision ?? null,
    };
  }

  recordResult(record, response, options = {}) {
    return this.idempotencyStore.recordResult(record, response, options);
  }

  abandon(record) {
    return this.idempotencyStore.abandon(record);
  }
}

module.exports = CommandCommitter;
