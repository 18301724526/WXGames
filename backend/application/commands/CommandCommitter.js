'use strict';

const { requireOwnerContext } = require('./CommandOwnerContext');

function uniqueSorted(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value)))).sort();
}

function diplomacyOwnerKey(mutation = {}) {
  const ids = uniqueSorted([mutation.fromFactionId, mutation.toFactionId]);
  return ids.length === 2 ? `diplomacy:${ids.join('--')}` : '';
}

function collectMutationOwnerKeys(sharedMutations = {}) {
  return uniqueSorted([
    ...(sharedMutations.encounters || []).map((mutation) => {
      const encounter = mutation?.encounter || mutation;
      return encounter?.id ? `encounter:${encounter.id}` : '';
    }),
    ...(sharedMutations.people || []).map((mutation) => {
      const person = mutation?.person || mutation;
      return person?.id ? `person:${person.id}` : '';
    }),
    ...(sharedMutations.diplomacyEdges || []).map(diplomacyOwnerKey),
    ...(sharedMutations.playerStates || []).map((mutation) => {
      const state = mutation?.state || mutation;
      return state?.playerId ? `player:${state.playerId}` : '';
    }),
  ]);
}

function assertSharedMutationOwners(context = {}, sharedMutations = {}) {
  const lockedOwnerKeys = new Set(context.ownerResolution?.ownerKeys || []);
  const missingOwnerKeys = collectMutationOwnerKeys(sharedMutations)
    .filter((ownerKey) => !lockedOwnerKeys.has(ownerKey));
  if (!missingOwnerKeys.length) return;
  const error = new Error(`Shared command mutations are missing owner locks: ${missingOwnerKeys.join(', ')}`);
  error.code = 'COMMAND_SHARED_MUTATION_OWNER_NOT_LOCKED';
  error.status = 500;
  error.missingOwnerKeys = missingOwnerKeys;
  throw error;
}

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
    assertSharedMutationOwners(context, sharedMutations);
    const ownerKeys = [...(context.ownerResolution?.ownerKeys || [])];
    const hasSharedMutations = ['encounters', 'people', 'diplomacyEdges', 'playerStates']
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
          { persistState, ownerKeys },
        );
        savedState = committed.savedState || context.state;
        sharedCommit = committed.shared;
      } else if (persistState) {
        savedState = this.repository.save(context.state, { ownerKeys });
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
        {
          ownerKeys,
          createState: persistence.createState,
        },
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
module.exports.assertSharedMutationOwners = assertSharedMutationOwners;
module.exports.collectMutationOwnerKeys = collectMutationOwnerKeys;
