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
    isOnTab(tab) { return tab === 'resources'; }
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

test('TutorialGuidePhaseHighlights moves post-naming people guide into city management', () => {
  const steps = {
    polityNamed: 29,
    talentPolicyOpened: 30,
    talentPolicyApplied: 31,
    manualTalentAssigned: 32,
    famousSeekCompleted: 34,
  };
  class Controller {
    constructor() {
      this.game = { canvasShell: { hideTutorialHighlight: () => this.calls.push(['hideTutorialHighlight']) } };
      this.calls = [];
    }

    isAdvisorOpen() { return false; }
    isRewardRevealOpen() { return false; }
    isFirstEraGuideActive() { return false; }
    isFarmGuideActive() { return false; }
    isEra2GuideActive() { return false; }
    isLumbermillGuideActive() { return false; }
    isScoutFormationGuideActive() { return false; }
    isScoutExploreGuideActive() { return false; }
    isFirstCityGuideActive() { return false; }
    isFinalTechGuideActive() { return false; }
    isPostNamingSystemGuideActive() { return true; }
    getCurrentStep() { return steps.polityNamed; }
    ensureResourcesGuideVisible() { this.calls.push(['ensureResourcesGuideVisible']); }
    ensureCityPeopleGuideVisible() { this.calls.push(['ensureCityPeopleGuideVisible']); }
    onTalentPolicyOpened() {
      this.calls.push(['onTalentPolicyOpened']);
      return true;
    }
    refreshCurrentHighlight() {
      this.calls.push(['refreshCurrentHighlight']);
      return true;
    }
    showHighlight(type) {
      this.calls.push(['showHighlight', type]);
      return true;
    }
  }
  Controller.TUTORIAL_STEPS = steps;
  TutorialGuidePhaseHighlights.install(Controller);

  const controller = new Controller();
  assert.equal(controller.refreshCurrentHighlight(), false);
  assert.equal(controller.calls.some((call) => call[0] === 'ensureResourcesGuideVisible'), false);
  assert.deepEqual(controller.calls.slice(0, 3), [
    ['ensureCityPeopleGuideVisible'],
    ['onTalentPolicyOpened'],
    ['hideTutorialHighlight'],
  ]);
});
