const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuideUiStateCoordinator = require('./TutorialGuideUiStateCoordinator');

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
      this.game = {
        showCityManagement: false,
        activeCityManagementTab: '',
        showSubcityList: true,
        activeCommandPanel: 'events',
        ...eventSnapshotMock,
        canvasShell: {
          showCityManagement: false,
          activeCityManagementTab: '',
          showSubcityList: true,
          activeCommandPanel: 'events',
          ...eventSnapshotMock,
        },
      };
    }

    isHouseGuideActive() { return true; }
  }
  TutorialGuideUiStateCoordinator.install(Controller);
  const controller = new Controller();

  assert.equal(controller.ensureHouseGuideVisible(), true);
  assert.equal(controller.game.showCityManagement, true);
  assert.equal(controller.game.activeCityManagementTab, 'buildings');
  assert.equal(controller.game.activeCommandPanel, '');
  assert.equal(controller.game.isEventSnapshotOpen(), false);
  assert.equal(controller.game.canvasShell.showCityManagement, true);
  assert.equal(controller.game.canvasShell.activeCityManagementTab, 'buildings');
  assert.equal(controller.game.canvasShell.activeCommandPanel, '');
});
