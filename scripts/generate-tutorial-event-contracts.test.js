const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_OUTPUT,
  SERVER_RESULT_EVENTS,
  buildContracts,
} = require('./generate-tutorial-event-contracts');

function fields(event) {
  return event.requiredFields.map((field) => field.name);
}

test('generated artifact matches 18 real EventRegistry handlers', () => {
  const generated = buildContracts();
  const artifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', DEFAULT_OUTPUT), 'utf8'));
  assert.deepEqual(artifact, generated);
  assert.equal(generated.events.length, 18);
});

test('three representative event payload contracts are field-level precise', () => {
  const byName = new Map(buildContracts().events.map((event) => [event.eventName, event]));
  assert.deepEqual(fields(byName.get('tabClicked')), ['tabId']);
  assert.deepEqual(fields(byName.get('buildingAction')), ['buildingId', 'action']);
  assert.deepEqual(fields(byName.get('famousPersonDetailOpened')), ['personId']);
});

test('five syncFromResult events carry a server command result object', () => {
  const resultEvents = buildContracts().events.filter((event) => event.carriesServerCommandResult);
  assert.deepEqual(new Set(resultEvents.map((event) => event.eventName)), SERVER_RESULT_EVENTS);
  resultEvents.forEach((event) => {
    assert.deepEqual(fields(event), ['result']);
    assert.equal(event.requiredFields[0].description, '服务端命令结果对象');
  });
});

test('canOpenTab is explicitly excluded with the current descriptor hook names', () => {
  const exclusion = buildContracts().exclusions.find((entry) => entry.name === 'canOpenTab');
  assert.equal(exclusion.reason, '否决式询问，不上事件总线');
  assert.equal(exclusion.onlyVetoSeam, 'CanvasPanelActionRunner descriptor hooks');
  assert.deepEqual(exclusion.hooks, ['tutorialCanOpenTab', 'tutorialVetoFeedback']);
});
