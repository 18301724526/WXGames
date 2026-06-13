const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuideUiStateCoordinator = require('./TutorialGuideUiStateCoordinator');

test('TutorialGuideUiStateCoordinator installs UI state helper methods', () => {
  class Controller {}

  assert.equal(TutorialGuideUiStateCoordinator.install(Controller), true);
  assert.equal(typeof Controller.prototype.ensureResourcesGuideVisible, 'function');
  assert.equal(typeof Controller.prototype.showBuildingGuide, 'function');
  assert.equal(typeof Controller.prototype.showSoftGuide, 'function');
});

test('TutorialGuideUiStateCoordinator keeps house guide visibility sync on game and shell', () => {
  class Controller {
    constructor() {
      this.game = {
        showCityManagement: false,
        activeCityManagementTab: '',
        showSubcityList: true,
        activeCommandPanel: 'events',
        activeEventId: 'evt',
        canvasShell: {
          showCityManagement: false,
          activeCityManagementTab: '',
          showSubcityList: true,
          activeCommandPanel: 'events',
          activeEventId: 'evt',
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
  assert.equal(controller.game.canvasShell.showCityManagement, true);
  assert.equal(controller.game.canvasShell.activeCityManagementTab, 'buildings');
  assert.equal(controller.game.canvasShell.activeCommandPanel, '');
});
