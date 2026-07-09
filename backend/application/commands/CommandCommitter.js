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
    const revisionBefore = context.state?.revision ?? null;
    const savedState = typeof definition.commit === 'function'
      ? definition.commit(context)
      : this.repository.save(context.state);
    const authoritativeState = savedState || context.state;
    return {
      schema: 'command-commit-result-v1',
      status: 'committed',
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
