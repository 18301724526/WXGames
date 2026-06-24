const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tutorialRoot = __dirname;

function readSource(fileName) {
  return fs.readFileSync(path.join(tutorialRoot, fileName), 'utf8');
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
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

test('TutorialGuidePhaseHighlights stays a thin flow-registry installer', () => {
  const source = readSource('TutorialGuidePhaseHighlights.js');

  assert.ok(
    lineCount(source) <= 40,
    'phase highlight installer should not grow tutorial flow logic',
  );
  assert.match(source, /TutorialGuideFlowRegistry/);
  assert.doesNotMatch(
    source,
    /isFirstEraGuideActive|isEra2GuideActive|isScoutFormationGuideActive/,
  );
  assert.doesNotMatch(
    source,
    /isScoutExploreGuideActive|isFirstCityGuideActive|isPostNamingSystemGuideActive/,
  );
  assert.doesNotMatch(source, /showBuildingGuide|showSoftGuide|claimTaskReward|openFamousPersons/);
});

test('TutorialGuideController legacy event methods stay handleEvent adapters', () => {
  const source = readSource('TutorialGuideController.js');
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

test('tutorial flow and event registries own tutorial step branching', () => {
  const flowSource = readSource('TutorialGuideFlowRegistry.js');
  const eventSource = readSource('TutorialGuideEventRegistry.js');

  assert.match(flowSource, /function createDefaultRules/);
  assert.match(eventSource, /function createDefaultHandlers/);
  assert.match(flowSource, /formationPanelOpened/);
  assert.match(eventSource, /armyFormationSaved/);
});
