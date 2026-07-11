const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialEngineQueryTable = require('./TutorialEngineQueryTable');
const TutorialHostContext = require('./TutorialHostContext');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');

function createContext(game) {
  return new TutorialHostContext({
    game,
    flowRegistry: {},
    eventRegistry: { subscribeToBus: () => null },
    changeEventBus: { subscribe: () => () => false },
  });
}

test('TutorialEngineQueryTable keeps one justification per query', () => {
  const entries = Object.entries(TutorialEngineQueryTable.QUERY_DEFINITIONS);

  assert.equal(entries.length, 2);
  entries.forEach(([queryName, definition]) => {
    assert.equal(typeof definition.hostMethod, 'string', queryName);
    assert.equal(typeof definition.justification, 'string', queryName);
    assert.notEqual(definition.justification.trim(), '', queryName);
  });
});

test('isTaskCenterOpen reads the modal fact through TutorialHostContext', () => {
  const game = makeModalOwnerHost();
  const context = createContext(game);

  assert.equal(context.queries('isTaskCenterOpen'), false);
  game.openBlockingPanelSnapshot('showTaskCenter');
  assert.equal(context.queries('isTaskCenterOpen'), true);
});

test('isCommandPanelOpen reads the named panel through TutorialHostContext', () => {
  const game = makeModalOwnerHost();
  const context = createContext(game);

  assert.equal(context.queries('isCommandPanelOpen', 'civilization'), false);
  game.openBlockingPanelSnapshot('activeCommandPanel', 'civilization');
  assert.equal(context.queries('isCommandPanelOpen', 'civilization'), true);
  assert.equal(context.queries('isCommandPanelOpen', 'events'), false);
});

test('TutorialHostContext queries reject methods outside the escape-hatch table', () => {
  const context = createContext(makeModalOwnerHost());

  assert.throws(
    () => context.queries('isCompleted'),
    /TutorialEngineQueryTable unknown query: isCompleted/,
  );
});
