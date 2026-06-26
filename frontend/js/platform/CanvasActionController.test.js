const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasActionController = require('./CanvasActionController');

test('CanvasActionController closePanels routes blockingPanel owner before mirror clears', () => {
  const calls = [];
  const host = {
    showSettings: true,
    activeCommandPanel: 'events',
    __eventSnapshot: { eventId: 'event-1', visible: true },
    closeBlockingPanelsOwner(except) {
      calls.push([
        'closeBlockingPanelsOwner',
        [...except],
        this.showSettings,
        this.activeCommandPanel,
      ]);
    },
    closeEventSnapshot() {
      calls.push(['closeEventSnapshot', this.__eventSnapshot?.eventId ?? null]);
      this.__eventSnapshot = null;
    },
    isEventSnapshotOpen() {
      return Boolean(this.__eventSnapshot);
    },
  };
  const controller = new CanvasActionController({ host });

  controller.closePanels();

  assert.deepEqual(calls, [
    ['closeBlockingPanelsOwner', [], true, 'events'],
    ['closeEventSnapshot', 'event-1'],
  ]);
  assert.equal(host.showSettings, false);
  assert.equal(host.activeCommandPanel, '');
  assert.equal(host.isEventSnapshotOpen(), false);
});

test('CanvasActionController closePanelsEverywhere routes owner close across host, game, and shell', () => {
  const calls = [];
  const shell = {
    showSettings: true,
    closeBlockingPanelsOwner(except) {
      calls.push(['shell', [...except], this.showSettings]);
    },
  };
  const game = {
    showSettings: true,
    canvasShell: shell,
    closeBlockingPanelsOwner(except) {
      calls.push(['game', [...except], this.showSettings]);
    },
  };
  const host = {
    showSettings: true,
    lastGame: game,
    closeBlockingPanelsOwner(except) {
      calls.push(['host', [...except], this.showSettings]);
    },
  };
  const controller = new CanvasActionController({ host });

  controller.closePanelsEverywhere(['showTaskCenter']);

  assert.deepEqual(calls, [
    ['host', ['showTaskCenter'], true],
    ['game', ['showTaskCenter'], true],
    ['shell', ['showTaskCenter'], true],
  ]);
  assert.equal(host.showSettings, false);
  assert.equal(game.showSettings, false);
  assert.equal(shell.showSettings, false);
});
