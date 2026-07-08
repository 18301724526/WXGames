const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasActionController = require('./CanvasActionController');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');

const makeModalHost = makeModalOwnerHost;

test('CanvasActionController closePanels closes blocking panels through the snapshot owner before side-effects', () => {
  const calls = [];
  const host = makeModalHost({
    armyFormationEditor: { open: true, slot: 1 },
    __eventSnapshot: { eventId: 'event-1', visible: true },
    openEventSnapshot(eventId) {
      this.__eventSnapshot = { eventId, visible: true };
      return eventId;
    },
    closeEventSnapshot() {
      calls.push(['closeEventSnapshot', this.__eventSnapshot?.eventId ?? null]);
      this.__eventSnapshot = null;
    },
    isEventSnapshotOpen() {
      return Boolean(this.__eventSnapshot);
    },
  });
  host.openBlockingPanelSnapshot('showSettings', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'events');
  const controller = new CanvasActionController({ host });

  // Snapshot the blocking-panel state and event modal observed at sweep time so we
  // can confirm the owner close happens before the armyFormationEditor + event
  // side-effects fire.
  const originalCloseAll = host.closeBlockingPanelsSnapshot.bind(host);
  host.closeBlockingPanelsSnapshot = (except) => {
    calls.push([
      'closeBlockingPanelsSnapshot',
      [...(except || [])],
      host.isBlockingPanelSnapshotOpen('showSettings'),
      host.getCommandPanelValue(),
    ]);
    return originalCloseAll(except);
  };

  controller.closePanels();

  assert.deepEqual(calls, [
    ['closeBlockingPanelsSnapshot', [], true, 'events'],
    ['closeEventSnapshot', 'event-1'],
  ]);
  assert.equal(host.isBlockingPanelSnapshotOpen('showSettings'), false);
  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(host.armyFormationEditor, false);
  assert.equal(host.isEventSnapshotOpen(), false);
});

test('CanvasActionController closePanels honours the keep-set and skips the event close when activeEventId is kept', () => {
  const host = makeModalHost({
    armyFormationEditor: { open: true, slot: 1 },
    __eventSnapshot: { eventId: 'event-1', visible: true },
    closeEventSnapshot() {
      this.__eventSnapshot = null;
    },
    isEventSnapshotOpen() {
      return Boolean(this.__eventSnapshot);
    },
  });
  host.openBlockingPanelSnapshot('showSettings', true);
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  const controller = new CanvasActionController({ host });

  controller.closePanels(['showTaskCenter', 'armyFormationEditor', 'activeEventId']);

  // The keep-set leaves showTaskCenter + armyFormationEditor untouched and keeps the
  // event modal open; showSettings is swept.
  assert.equal(host.isBlockingPanelSnapshotOpen('showSettings'), false);
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), true);
  assert.deepEqual(host.armyFormationEditor, { open: true, slot: 1 });
  assert.equal(host.isEventSnapshotOpen(), true);
});

test('CanvasActionController closePanelsEverywhere routes owner close across host, game, and shell', () => {
  const calls = [];
  const shell = makeModalHost({
    closeEventSnapshot() {
      calls.push(['shellEvent']);
    },
  });
  const game = makeModalHost({
    canvasShell: shell,
    closeEventSnapshot() {
      calls.push(['gameEvent']);
    },
  });
  const host = makeModalHost({
    lastGame: game,
    closeEventSnapshot() {
      calls.push(['hostEvent']);
    },
  });
  shell.lastGame = game;
  host.openBlockingPanelSnapshot('showSettings', true);
  game.openBlockingPanelSnapshot('showSettings', true);
  shell.openBlockingPanelSnapshot('showSettings', true);
  const controller = new CanvasActionController({ host });

  controller.closePanelsEverywhere(['showTaskCenter']);

  assert.deepEqual(calls, [['hostEvent'], ['gameEvent'], ['shellEvent']]);
  // Each host owns its own modal owner; closePanelsEverywhere closes all three. The
  // per-host isModalOpen live check is the source of truth (the merged renderer
  // snapshot is only rebuilt per frame, not after every individual close).
  assert.equal(host.isModalOpen('modal:settings'), false);
  assert.equal(game.isModalOpen('modal:settings'), false);
  assert.equal(shell.isModalOpen('modal:settings'), false);
});

test('CanvasActionController keeps tap trace metadata out of frozen actions', () => {
  const host = makeModalHost();
  host.closeConfirmDialog = () => host.closeConfirmDialogSnapshot();
  host.openConfirmDialogSnapshot({ visible: true, kind: 'worldMarchDeploymentBlocked' });
  const controller = new CanvasActionController({ host });
  const action = Object.freeze({ type: 'closeConfirmDialog' });

  assert.doesNotThrow(() => controller.handle(action, { tapTraceId: 'tap-frozen-confirm' }));
  assert.equal(action.__tapTraceId, undefined);
  assert.equal(controller.getActionTapTraceId(action), 'tap-frozen-confirm');
  assert.equal(host.isConfirmDialogSnapshotOpen(), false);
});
