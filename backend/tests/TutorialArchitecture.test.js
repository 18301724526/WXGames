const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TutorialService = require('../services/TutorialService');
const TutorialState = require('../services/tutorial/TutorialState');
const TutorialTabAccess = require('../services/tutorial/TutorialTabAccess');
const TutorialActionValidator = require('../services/tutorial/TutorialActionValidator');
const TutorialProgression = require('../services/tutorial/TutorialProgression');
const TutorialGrantService = require('../services/tutorial/TutorialGrantService');

const serviceRoot = path.join(__dirname, '..', 'services');
const tutorialRoot = path.join(serviceRoot, 'tutorial');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('TutorialProgressService stays a facade over focused tutorial modules', () => {
  const facadePath = path.join(serviceRoot, 'TutorialProgressService.js');
  const moduleFiles = fs.readdirSync(tutorialRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(lineCount(facadePath) < 80);
  assert.deepEqual(moduleFiles, [
    'TutorialActionValidator.js',
    'TutorialGrantService.js',
    'TutorialProgression.js',
    'TutorialSelectors.js',
    'TutorialState.js',
    'TutorialTabAccess.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(tutorialRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('tutorial module responsibilities remain split by public contract', () => {
  const initial = TutorialState.createInitialTutorialState();
  const houseReady = TutorialProgression.manualAdvance(initial, TutorialService.TUTORIAL_STEPS.houseGuideReady);
  const gameState = { currentEra: 0, buildings: {}, resources: { food: 100 } };

  assert.equal(TutorialTabAccess.canAccessTab(houseReady, 'buildings'), true);
  assert.equal(TutorialActionValidator.validateAction(houseReady, 'build', { target: 'house' }, gameState).allowed, true);
  assert.equal(TutorialActionValidator.validateAction(houseReady, 'build', { target: 'farm' }, gameState).allowed, false);
  assert.deepEqual(TutorialGrantService.getHouseGuideMinimumResources(), TutorialService.getHouseGuideMinimumResources());
});

test('TutorialService facade preserves the legacy tutorial API', () => {
  const expectedApi = [
    'TUTORIAL_STEPS',
    'advanceClientStep',
    'advanceTutorial',
    'canAccessTab',
    'createInitialTutorialState',
    'ensureHouseGuideResources',
    'ensureLumbermillGuideResources',
    'ensureScoutFamousPersonGrant',
    'getHouseGuideMinimumResources',
    'manualAdvance',
    'maybeActivateEra2Tutorial',
    'normalizeTutorialState',
    'validateAction',
  ];

  assert.deepEqual(Object.keys(TutorialService).sort(), expectedApi.sort());
});
