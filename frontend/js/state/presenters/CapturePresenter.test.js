const test = require('node:test');
const assert = require('node:assert/strict');

const CapturePresenter = require('./CapturePresenter');

function stateWith(decisions) {
  return { captureDecisions: decisions };
}
const pending = {
  id: 'cap_1', territoryName: '林城', status: 'pending', recruitChance: 0.42,
  captive: { id: 'df_1', name: '林烈', quality: 'good' },
};

test('firstPending returns the first pending decision, else null', () => {
  assert.equal(CapturePresenter.firstPending(stateWith([{ ...pending, status: 'resolved' }, pending])).id, 'cap_1');
  assert.equal(CapturePresenter.firstPending(stateWith([])), null);
  assert.equal(CapturePresenter.firstPending({}), null);
});

test('buildCaptureModalViewState surfaces a pending decision with three choice buttons', () => {
  const view = CapturePresenter.buildCaptureModalViewState(stateWith([pending]));
  assert.equal(view.showModal, true);
  assert.equal(view.id, 'cap_1');
  assert.equal(view.captiveName, '林烈');
  assert.deepEqual(view.buttons.map((b) => b.choice), ['execute', 'recruit', 'release']);
  assert.ok(view.recruitChanceText.includes('42')); // 0.42 -> 42%
});

test('buildCaptureModalViewState hides when no pending decision / resolved / missing id', () => {
  assert.equal(CapturePresenter.buildCaptureModalViewState(stateWith([{ ...pending, status: 'resolved' }])).showModal, false);
  assert.equal(CapturePresenter.buildCaptureModalViewState(stateWith([])).showModal, false);
  assert.equal(CapturePresenter.buildCaptureModalViewState(stateWith([pending]), 'nope').showModal, false);
});

test('toPercent clamps and rounds', () => {
  assert.equal(CapturePresenter.toPercent(0.426), 43);
  assert.equal(CapturePresenter.toPercent(1.5), 100);
  assert.equal(CapturePresenter.toPercent('x'), 0);
});

test('formatOutcome maps each outcome kind to a localized-key string', () => {
  assert.ok(CapturePresenter.formatOutcome('recruited', '林烈'));
  assert.ok(CapturePresenter.formatOutcome('executed', '林烈'));
  assert.equal(CapturePresenter.formatOutcome('unknown', '林烈'), '');
});
