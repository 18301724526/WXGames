const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuideStepPolicy = require('./TutorialGuideStepPolicy');

const { TUTORIAL_STEPS } = TutorialGuideStepPolicy;

test('TutorialGuideStepPolicy exposes the shared step-name table', () => {
  assert.equal(TUTORIAL_STEPS.initial, 'initial');
  assert.equal(TUTORIAL_STEPS.cityEntered, 'cityEntered');
  assert.equal(TUTORIAL_STEPS.completed, 'completed');
  assert.equal(TutorialGuideStepPolicy.normalizeStep('not-a-step'), 'initial');
  // Legacy numeric steps stay accepted and canonicalize onto the step name.
  assert.equal(TutorialGuideStepPolicy.normalizeStep(2), 'cityEntered');
});

test('TutorialGuideStepPolicy gates tab access by current tutorial step', () => {
  assert.equal(TutorialGuideStepPolicy.canOpenTab('events', {
    step: TUTORIAL_STEPS.cityEntered,
    completed: false,
  }), false);
  assert.equal(TutorialGuideStepPolicy.canOpenTab('civilization', {
    step: TUTORIAL_STEPS.houseBuilt,
    completed: false,
  }), true);
  assert.equal(TutorialGuideStepPolicy.canOpenTab('military', {
    step: TUTORIAL_STEPS.polityNamed,
    completed: false,
  }), true);
  assert.equal(TutorialGuideStepPolicy.canOpenTab('tech', {
    step: TUTORIAL_STEPS.polityNamed,
    completed: false,
  }), false);
  assert.equal(TutorialGuideStepPolicy.canOpenTab('famousPersons', {
    step: TUTORIAL_STEPS.manualTalentAssigned,
    completed: false,
  }), true);
  assert.equal(TutorialGuideStepPolicy.canOpenTab('tech', {
    step: TUTORIAL_STEPS.famousSeekCompleted,
    completed: false,
  }), true);
  assert.equal(TutorialGuideStepPolicy.canOpenTab('military', {
    step: TUTORIAL_STEPS.famousSeekCompleted,
    completed: false,
  }), false);
  assert.equal(TutorialGuideStepPolicy.canOpenTab('military', {
    step: TUTORIAL_STEPS.famousSeekCompleted,
    completed: true,
  }), true);
});

test('TutorialGuideStepPolicy owns guide active ranges', () => {
  assert.equal(TutorialGuideStepPolicy.isHouseGuideActive(TUTORIAL_STEPS.cityEntered, false), true);
  assert.equal(TutorialGuideStepPolicy.isHouseGuideActive(TUTORIAL_STEPS.houseBuilt, false), false);
  assert.equal(TutorialGuideStepPolicy.isFirstEraGuideActive(TUTORIAL_STEPS.houseBuilt, false), true);
  assert.equal(TutorialGuideStepPolicy.isFarmGuideActive(TUTORIAL_STEPS.farmPrepReserved, false), true);
  assert.equal(TutorialGuideStepPolicy.isFarmGuideActive(TUTORIAL_STEPS.farmBuilt, false), false);
  assert.equal(TutorialGuideStepPolicy.isEra2GuideActive(TUTORIAL_STEPS.lumbermillBuilt, false), true);
  assert.equal(TutorialGuideStepPolicy.isScoutFormationGuideActive(TUTORIAL_STEPS.era3AdvanceReady, false), true);
  assert.equal(TutorialGuideStepPolicy.isScoutExploreGuideActive(TUTORIAL_STEPS.scoutFormationSaved, false), true);
  assert.equal(TutorialGuideStepPolicy.isFirstCityGuideActive(TUTORIAL_STEPS.firstCityDiscovered, false), true);
  assert.equal(TutorialGuideStepPolicy.isPostNamingSystemGuideActive(TUTORIAL_STEPS.polityNamed, false), true);
  assert.equal(TutorialGuideStepPolicy.isFinalTechGuideActive(TUTORIAL_STEPS.famousSeekCompleted, false), true);
  assert.equal(TutorialGuideStepPolicy.isFinalTechGuideActive(TUTORIAL_STEPS.famousSeekCompleted, true), false);
});
