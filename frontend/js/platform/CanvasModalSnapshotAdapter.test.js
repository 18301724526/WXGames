const test = require('node:test');
const assert = require('node:assert/strict');

global.EcsModeRuntime = require('../ecs/mode/EcsModeRuntimeEntry');
const CanvasModeOwnershipBridge = require('./CanvasModeOwnershipBridge');
const CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');

test('CanvasModalSnapshotAdapter reads naming from renderer snapshot modal owner', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const host = new Host();

  host.openNamingSnapshot({
    visible: true,
    view: { title: 'Name city' },
    prompt: { type: 'city', territoryId: 'site-1' },
    inputValue: '',
    submitting: false,
  });

  const snapshot = host.getRendererSnapshot();

  assert.deepEqual(CanvasModalSnapshotAdapter.getNamingSnapshotFromRendererSnapshot(snapshot), {
    visible: true,
    view: { title: 'Name city' },
    prompt: { type: 'city', territoryId: 'site-1' },
    inputValue: '',
    submitting: false,
  });
  assert.equal(host.getNamingInputValue(), '');

  host.updateNamingSnapshot({ inputValue: 'River City' });

  assert.equal(host.getNamingInputValue(), 'River City');
  assert.equal(host.getRendererSnapshot().modal['modal:naming'].payload.inputValue, 'River City');
});

test('CanvasModalSnapshotAdapter routes shell updates to the open naming owner host', () => {
  class Host {}
  CanvasModeOwnershipBridge.install(Host);
  CanvasModalSnapshotAdapter.install(Host);
  const game = new Host();
  const shell = new Host();
  game.canvasShell = shell;
  shell.lastGame = game;

  game.openNamingSnapshot({
    visible: true,
    view: { title: 'Name polity' },
    prompt: { type: 'polity' },
    inputValue: '',
  });

  shell.updateNamingSnapshot({ inputValue: 'River League' });

  assert.equal(game.getModalPayload('modal:naming').inputValue, 'River League');
  assert.equal(shell.isModalOpen('modal:naming'), false);
  assert.equal(shell.getNamingInputValue(), 'River League');
});
