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
    const sharedMutations = context.sharedMutations || {};
    const hasSharedMutations = ['encounters', 'people', 'diplomacyEdges']
      .some((key) => Array.isArray(sharedMutations[key]) && sharedMutations[key].length > 0);
    let savedState = context.state;
    let sharedCommit = null;
    if (strategy === 'save' || strategy === 'save-if-changed' || strategy === 'shared-only') {
      const persistState = strategy === 'save'
        || (strategy === 'save-if-changed' && context.execution?.changed);
      if (hasSharedMutations) {
        const committed = this.repository.commitCommandState(
          context.state,
          sharedMutations,
          { persistState },
        );
        savedState = committed.savedState || context.state;
        sharedCommit = committed.shared;
      } else if (persistState) {
        savedState = this.repository.save(context.state);
      }
    } else if (strategy === 'reset-player-state') {
      if (hasSharedMutations) {
        const error = new Error('Player reset cannot carry shared command mutations');
        error.code = 'COMMAND_SHARED_MUTATION_STRATEGY_INVALID';
        throw error;
      }
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
      shared: sharedCommit,
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
