const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuideUiStateCoordinator = require('./TutorialGuideUiStateCoordinator');
const CanvasModeOwnershipRuntime = require('../platform/CanvasModeOwnershipRuntime');
const CanvasModalSnapshotAdapter = require('../platform/CanvasModalSnapshotAdapter');

// Batch 8F: the blocking panels are owned modal subtypes. A modal-capable host carries
// the ownership bridge (openModal/isModalOpen/getRendererSnapshot) and the snapshot
// adapter (openBlockingPanelSnapshot/closeBlockingPanelSnapshot/
// isBlockingPanelSnapshotOpen/getCommandPanelValue) so the coordinator can route
// through the canonical owner instead of host mirrors. Shell reads resolve back to
// the game owner when shell.lastGame links them.
class ModalHost {}
CanvasModeOwnershipRuntime.install(ModalHost);
CanvasModalSnapshotAdapter.install(ModalHost);

function makeModalHost(fields = {}) {
  return Object.assign(new ModalHost(), fields);
}

test('TutorialGuideUiStateCoordinator installs UI state helper methods', () => {
  class Controller {}

  assert.equal(TutorialGuideUiStateCoordinator.install(Controller), true);
  assert.equal(typeof Controller.prototype.ensureResourcesGuideVisible, 'undefined');
  assert.equal(typeof Controller.prototype.ensureCityPeopleGuideVisible, 'function');
  assert.equal(typeof Controller.prototype.showBuildingGuide, 'function');
  assert.equal(typeof Controller.prototype.showSoftGuide, 'function');
});

test('TutorialGuideUiStateCoordinator keeps house guide visibility sync on game and shell', () => {
  const eventStore = { snapshot: { eventId: 'evt', visible: true } };
  const eventSnapshotMock = {
    closeEventSnapshot() {
      eventStore.snapshot = null;
    },
    isEventSnapshotOpen() {
      return Boolean(eventStore.snapshot);
    },
  };
  class Controller {
    constructor() {
      const shell = makeModalHost({
        activeCityManagementTab: '',
        ...eventSnapshotMock,
      });
      const game = makeModalHost({
        activeCityManagementTab: '',
        ...eventSnapshotMock,
        canvasShell: shell,
      });
      shell.lastGame = game;
      // Seed the pre-guide state through the owner: subcity list open + the events
      // command panel open, so the guide's close/open transitions are observable.
      game.openBlockingPanelSnapshot('showSubcityList', true);
      game.openBlockingPanelSnapshot('activeCommandPanel', 'events');
      this.game = game;
    }

    isHouseGuideActive() { return true; }
  }
  TutorialGuideUiStateCoordinator.install(Controller);
  const controller = new Controller();
  const game = controller.game;
  const shell = game.canvasShell;

  assert.equal(controller.ensureHouseGuideVisible(), true);
  assert.equal(game.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(game.activeCityManagementTab, 'buildings');
  assert.equal(game.isBlockingPanelSnapshotOpen('showSubcityList'), false);
  assert.equal(game.getCommandPanelValue(), '');
  assert.equal(game.isEventSnapshotOpen(), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(shell.activeCityManagementTab, '');
  assert.equal(shell.getCommandPanelValue(), '');
});
