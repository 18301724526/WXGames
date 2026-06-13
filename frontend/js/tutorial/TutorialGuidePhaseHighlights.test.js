const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuidePhaseHighlights = require('./TutorialGuidePhaseHighlights');

test('TutorialGuidePhaseHighlights installs refreshCurrentHighlight on controller prototype', () => {
  const steps = { houseBuilt: 4, civilizationTabOpened: 5 };
  class Controller {}
  Controller.TUTORIAL_STEPS = steps;

  assert.equal(TutorialGuidePhaseHighlights.install(Controller), true);
  assert.equal(typeof Controller.prototype.refreshCurrentHighlight, 'function');
});

test('TutorialGuidePhaseHighlights preserves first-era highlight behavior', () => {
  const steps = {
    houseBuilt: 4,
    civilizationTabOpened: 5,
    eraAdvancedTo1: 6,
  };
  class Controller {
    constructor() {
      this.game = { canvasShell: { hideTutorialHighlight() {} } };
      this.calls = [];
    }

    isAdvisorOpen() { return false; }
    isRewardRevealOpen() { return false; }
    isFirstEraGuideActive() { return true; }
    getCurrentStep() { return steps.houseBuilt; }
    isOnTab(tab) { return tab === 'military'; }
    prepareCommandPanelGuide(panel) { this.calls.push(['prepareCommandPanelGuide', panel]); }
    showHighlight(type, predicate, message, allowedAction) {
      this.calls.push(['showHighlight', type, message, allowedAction]);
      return true;
    }
  }
  Controller.TUTORIAL_STEPS = steps;
  TutorialGuidePhaseHighlights.install(Controller);

  const controller = new Controller();
  assert.equal(controller.refreshCurrentHighlight(), true);
  assert.deepEqual(controller.calls[0], ['prepareCommandPanelGuide', 'civilization']);
  assert.equal(controller.calls[1][1], 'openCommandPanel');
  assert.deepEqual(controller.calls[1][3], { type: 'openCommandPanel', panel: 'civilization' });
});
