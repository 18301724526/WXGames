const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TutorialHostContext = require('./TutorialHostContext');
const TaskPanelStepScripts = require('../tutorial-config/TaskPanelStepScripts');

const tutorialRoot = __dirname;

function readSource(fileName) {
  return fs.readFileSync(path.join(tutorialRoot, fileName), 'utf8');
}

function getMethodBody(source, methodName) {
  const match = new RegExp(`\\n\\s*(?:async\\s+)?${methodName}\\([^)]*\\)\\s*\\{`).exec(source);
  assert.ok(match, `${methodName} should exist`);
  let depth = 0;
  const start = match.index + match[0].lastIndexOf('{');
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }
  assert.fail(`${methodName} body should close`);
}

test('TutorialGuideController is a thin facade over TutorialHostContext', () => {
  const controllerSource = readSource('TutorialGuideController.js');
  const contextSource = readSource('TutorialHostContext.js');

  assert.equal(fs.existsSync(path.join(tutorialRoot, 'TutorialGuidePhaseHighlights.js')), false);
  assert.equal(fs.existsSync(path.join(tutorialRoot, 'TutorialGuideUiStateCoordinator.js')), false);
  assert.match(controllerSource, /class TutorialGuideController extends TutorialHostContext \{\}/);
  assert.doesNotMatch(controllerSource, /this\.game|\bgame\s*\.|\bcanvasShell\s*\./);
  assert.match(contextSource, /refreshCurrentHighlight\(/);
  assert.doesNotMatch(contextSource, /ensureHouseGuideVisible\(/);
  assert.match(contextSource, /ensureCityPeopleGuideVisible\(/);
  assert.match(contextSource, /TutorialGuideFlowRegistry/);
});

test('TutorialHostContext legacy event methods stay handleEvent adapters', () => {
  const source = readSource('TutorialHostContext.js');
  const adapters = [
    ['onTabClicked', 'tabClicked'],
    ['onCommandPanelOpened', 'commandPanelOpened'],
    ['markCityEntered', 'cityEntered'],
    ['onBuildingAction', 'buildingAction'],
    ['onEraAdvanced', 'eraAdvanced'],
    ['onTaskRewardClaimed', 'taskRewardClaimed'],
    ['onFamousPersonsOpened', 'famousPersonsOpened'],
    ['onTalentPolicyOpened', 'talentPolicyOpened'],
    ['onTalentPolicyApplied', 'tutorialStateChanged'],
    ['onManualTalentAssigned', 'tutorialStateChanged'],
    ['onFamousPersonSought', 'tutorialStateChanged'],
    ['onFamousPersonDetailOpened', 'famousPersonDetailOpened'],
    ['onArmyFormationOpened', 'armyFormationOpened'],
    ['onArmyFormationSaved', 'armyFormationSaved'],
    ['onMilitaryViewSwitched', 'militaryViewSwitched'],
    ['onFamousPersonsClosed', 'famousPersonsClosed'],
    ['onCityManagementOpened', 'cityManagementOpened'],
    ['onWorldMarchTargetSelected', 'worldMarchTargetSelected'],
    ['onExploreStarted', 'exploreStarted'],
    ['onAdvisorClosed', 'advisorClosed'],
  ];

  adapters.forEach(([methodName, eventName]) => {
    const body = getMethodBody(source, methodName);
    assert.match(body, new RegExp(`return this\\.handleEvent\\('${eventName}'`), methodName);
    assert.doesNotMatch(
      body,
      /TUTORIAL_STEPS|getCurrentStep\(|advanceTo\(|sync\(|showSoftGuide\(/,
      methodName,
    );
  });
});

test('tutorial host access outside TutorialHostContext is zero', () => {
  const productFiles = fs.readdirSync(tutorialRoot)
    .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js'))
    .filter((file) => file !== 'TutorialHostContext.js');
  const forbidden = /\bgame\s*\.|\bcanvasShell\s*\.|host\?*\.game|this\.game/;

  for (const file of productFiles) {
    assert.doesNotMatch(readSource(file), forbidden, file);
  }
});

test('TutorialHostContext exposes six interfaces and divergence witness preserves call-site order', () => {
  const source = readSource('TutorialHostContext.js');
  for (const interfaceName of ['effects', 'waitFor', 'requestAction', 'resolveTarget', 'queries', 'next']) {
    assert.match(source, new RegExp(`\\n\\s+${interfaceName}\\(`), interfaceName);
  }

  const state = { currentStep: 'cityEntered' };
  const gameTutorial = { currentStep: 'houseBuilt' };
  const gameStateTutorial = { currentStep: 'farmBuilt' };
  const context = new TutorialHostContext({
    state,
    game: { tutorial: gameTutorial, state: { tutorial: gameStateTutorial } },
    targetResolver: {},
  });

  TutorialHostContext.resetDivergenceWitness();
  assert.equal(context.getCurrentStep(), 'cityEntered', 'Controller call site keeps state first');
  assert.equal(context.getDivergenceWitness().count, 1);
  assert.match(context.getDivergenceWitness().traces[0].callSite, /state>gameTutorial>gameStateTutorial/);

  context.syncFromResultPayload({ tutorial: null, gameState: { tutorial: null } });
  assert.equal(context.state, gameTutorial, 'EventRegistry call site keeps host state last');
  assert.ok(context.getDivergenceWitness().count >= 2);

  TutorialHostContext.resetDivergenceWitness();
  const equal = { currentStep: 'cityEntered', completed: false };
  const equalContext = new TutorialHostContext({
    state: { ...equal },
    game: { tutorial: { ...equal }, state: { tutorial: { ...equal } } },
    targetResolver: {},
  });
  equalContext.getCurrentStep();
  assert.equal(equalContext.getDivergenceWitness().count, 0);
});

test('TutorialHostContext owns StepScript division while registries retain residual branching', () => {
  const contextSource = readSource('TutorialHostContext.js');
  const flowSource = readSource('TutorialGuideFlowRegistry.js');
  const eventSource = readSource('TutorialGuideEventRegistry.js');

  assert.match(contextSource, /hasStepScript\(/);
  assert.match(contextSource, /evaluateStepScript\(/);
  assert.match(contextSource, /refreshLegacyHighlight\(/);
  assert.match(flowSource, /function createDefaultRules/);
  assert.match(eventSource, /function createDefaultHandlers/);
  assert.doesNotMatch(flowSource, /formationPanelOpened/);
  assert.equal(
    TaskPanelStepScripts.formationPanelOpened.ruleId,
    'scout-formation-member-or-save',
  );
  assert.match(eventSource, /armyFormationSaved/);
});
