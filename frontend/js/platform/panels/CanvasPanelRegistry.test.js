const test = require('node:test');
const assert = require('node:assert/strict');

const ModalStore = require('../../state/ModalStore');
const CanvasPanelRegistry = require('./CanvasPanelRegistry');
const FamousPersonsPanel = require('./FamousPersonsPanel');
const { makeModalOwnerHost } = require('../../../test-support/CanvasOwnerTestHarness');

test.beforeEach(() => {
  ModalStore.closeAll();
});

test('CanvasPanelRegistry exposes famous persons as a rich panel entry', () => {
  const entry = CanvasPanelRegistry.get('famousPersons');

  assert.equal(entry.key, 'famousPersons');
  assert.equal(entry.modalKey, 'showFamousPersons');
  assert.equal(entry.band, 'panel');
  assert.equal(entry.renderPriority, 100);
  assert.equal(entry.hitTargetPriority, 100);
  assert.equal(entry.closesOnOutsideClick, true);
  assert.equal(entry.blocksBaseHitTargets, true);
  assert.equal(entry.module, FamousPersonsPanel);
  assert.equal(typeof entry.open, 'function');
  assert.equal(typeof entry.close, 'function');
  assert.equal(typeof entry.actions.openDetail, 'function');
  assert.deepEqual(CanvasPanelRegistry.keys(), ['famousPersons']);
});

test('CanvasPanelRegistry rich entry delegates lifecycle and actions to the panel module', () => {
  const calls = [];
  const host = makeModalOwnerHost({
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearTooltip']);
      },
      setPinnedFamousSkillTooltip(action) {
        calls.push(['showTooltip', action.skillId]);
      },
    },
  });
  const entry = CanvasPanelRegistry.get('famousPersons');

  assert.equal(entry.open(host, { clearTooltip: false }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), true);
  assert.equal(entry.actions.openDetail(host, { personId: 'fp-1' }), true);
  assert.equal(entry.actions.showTooltip(host, { skillId: 'command' }), true);
  assert.equal(entry.actions.clearTooltip(host), true);
  assert.equal(entry.close(host, { clearTooltip: false }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.equal(host.selectedFamousPersonId, '');
  assert.deepEqual(calls, [
    ['clearTooltip'],
    ['showTooltip', 'command'],
    ['clearTooltip'],
  ]);
});
