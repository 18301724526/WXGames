'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const CommandCommitter = require('../application/commands/CommandCommitter');
const { runWithOwnerContext } = require('../application/commands/CommandOwnerContext');

function commitInsideOwnerContext(committer, context, definition) {
  const ownerResolution = context.ownerResolution;
  return runWithOwnerContext({
    ownerKey: ownerResolution.ownerKey,
    ownerKeys: ownerResolution.ownerKeys,
    scope: 'command-committer-test',
    commandId: 'cmd-committer-test',
  }, () => committer.commit(context, definition));
}

test('CommandCommitter supports shared-only mutations with a null player state', () => {
  const calls = [];
  const repository = {
    commitCommandState(state, mutations, options) {
      calls.push({ state, mutations, options });
      return { savedState: state, shared: { peopleCount: mutations.people.length } };
    },
  };
  const committer = new CommandCommitter({ repository });
  const context = {
    state: null,
    ownerResolution: {
      ownerKey: 'person:shared-person',
      ownerKeys: ['person:shared-person'],
    },
    sharedMutations: {
      people: [{ person: { id: 'shared-person' }, now: '2026-07-10T00:00:00.000Z' }],
    },
  };

  const result = commitInsideOwnerContext(
    committer,
    context,
    { persistence: { strategy: 'shared-only' } },
  );

  assert.equal(result.state, null);
  assert.equal(result.persistenceStrategy, 'shared-only');
  assert.deepEqual(result.shared, { peopleCount: 1 });
  assert.deepEqual(calls[0].options, {
    persistState: false,
    ownerKeys: ['person:shared-person'],
  });
});

test('CommandCommitter rejects a shared mutation whose owner was not locked', () => {
  let commitCalls = 0;
  const committer = new CommandCommitter({
    repository: {
      commitCommandState() {
        commitCalls += 1;
      },
    },
  });
  const context = {
    state: null,
    ownerResolution: {
      ownerKey: 'encounter:locked-a',
      ownerKeys: ['encounter:locked-a'],
    },
    sharedMutations: {
      encounters: [{ encounter: { id: 'unlocked-b' } }],
    },
  };

  assert.throws(
    () => commitInsideOwnerContext(
      committer,
      context,
      { persistence: { strategy: 'shared-only' } },
    ),
    (error) => (
      error.code === 'COMMAND_SHARED_MUTATION_OWNER_NOT_LOCKED'
      && error.missingOwnerKeys.includes('encounter:unlocked-b')
    ),
  );
  assert.equal(commitCalls, 0);
});

test('CommandCommitter forwards owner keys to player-state persistence', () => {
  const calls = [];
  const state = { playerId: 'player-1', revision: 3 };
  const committer = new CommandCommitter({
    repository: {
      save(nextState, options) {
        calls.push({ nextState, options });
        return { ...nextState, revision: 4 };
      },
    },
  });
  const context = {
    state,
    ownerResolution: {
      ownerKey: 'territory:site-1',
      ownerKeys: ['player:player-1', 'territory:site-1'],
    },
    sharedMutations: {},
  };

  const result = commitInsideOwnerContext(committer, context, { persistence: { strategy: 'save' } });

  assert.equal(result.revisionAfter, 4);
  assert.deepEqual(calls[0].options, {
    ownerKeys: ['player:player-1', 'territory:site-1'],
  });
});
