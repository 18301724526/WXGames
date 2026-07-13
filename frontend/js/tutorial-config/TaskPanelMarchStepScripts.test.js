const test = require('node:test');
const assert = require('node:assert/strict');

const StepScriptRunner = require('../tutorial-engine/StepScriptRunner');
const TutorialGuideEventRegistry = require('../tutorial/TutorialGuideEventRegistry');
const TutorialHostContext = require('../tutorial/TutorialHostContext');
const config = require('./TaskPanelStepScripts');
const TutorialFlowShared = require('../../../shared/tutorialFlowConfig');

function createTargetContext(availableTargets = {}, calls = []) {
  return {
    resolveTarget(methodName, request = {}) {
      calls.push({ methodName, request });
      return { available: availableTargets[request.target] === true };
    },
  };
}

test('R20-R21 select the first available city-management target', () => {
  const runner = StepScriptRunner.create();
  const switchOnly = runner.evaluate({
    stepKey: 'famousCardViewed',
    config,
    ctx: createTargetContext({ 'hitTarget:switchCityManagementTab': true }),
  });
  const formationAvailable = runner.evaluate({
    stepKey: 'famousCardViewed',
    config,
    ctx: createTargetContext({
      'hitTarget:openArmyFormation': true,
      'hitTarget:switchCityManagementTab': true,
    }),
  });

  assert.equal(switchOnly.matchedRuleId, 'scout-switch-city-military-tab');
  assert.deepEqual(switchOnly.instructions[0].action, {
    type: 'switchCityManagementTab',
    tab: 'military',
  });
  assert.equal(formationAvailable.matchedRuleId, 'scout-open-formation');
  assert.deepEqual(formationAvailable.instructions[0].targetArgs, {
    cityAlias: 'capitalCity',
    slot: 1,
  });
});

test('R22 projects member, replenish, and save targets in availability order', () => {
  const runner = StepScriptRunner.create();
  const evaluate = (availableTargets) => runner.evaluate({
    stepKey: 'formationPanelOpened',
    config,
    ctx: createTargetContext(availableTargets),
  });

  const member = evaluate({
    'hitTarget:toggleArmyFormationMember': true,
    'hitTarget:autoReplenishArmyFormation': true,
    'hitTarget:saveArmyFormation': true,
  });
  const replenish = evaluate({
    'hitTarget:autoReplenishArmyFormation': true,
    'hitTarget:saveArmyFormation': true,
  });
  const save = evaluate({ 'hitTarget:saveArmyFormation': true });

  assert.equal(member.instructions[0].target, 'hitTarget:toggleArmyFormationMember');
  assert.deepEqual(member.instructions[0].targetArgs, { personAlias: 'scoutFamousPerson' });
  assert.equal(replenish.instructions[0].target, 'hitTarget:autoReplenishArmyFormation');
  assert.equal(save.instructions[0].target, 'hitTarget:saveArmyFormation');
  assert.equal(save.instructions[0].eventName, 'armyFormationSaved');
});

test('R23 clears the old march target once and falls back to the generic target', () => {
  const tutorial = { completed: false, currentStep: 'scoutFormationSaved' };
  const allowedActions = [];
  let clearCount = 0;
  const context = new TutorialHostContext({
    state: tutorial,
    game: { tutorial, state: { tutorial } },
    subscribeToBus: false,
    stepScriptConfig: config,
    flowRegistry: {
      refresh() {
        throw new Error('R23 must stay on StepScripts');
      },
    },
    targetResolver: {
      resolveTarget(request = {}) {
        return { available: request.allowedAction?.targetQ === undefined, target: null };
      },
      showHighlight(_type, _predicate, _message, allowedAction) {
        allowedActions.push(allowedAction);
        return allowedAction.targetQ === undefined;
      },
    },
  });
  context.getFirstExploreCityTarget = () => ({ q: 7, r: -3 });
  context.clearWorldMarchTarget = () => {
    clearCount += 1;
    return true;
  };

  assert.equal(context.refreshCurrentHighlight(), true);
  assert.equal(context.refreshCurrentHighlight(), true);

  assert.equal(clearCount, 1);
  assert.deepEqual(allowedActions.slice(0, 2), [
    { type: 'selectWorldMarchTarget', targetQ: 7, targetR: -3 },
    { type: 'selectWorldMarchTarget' },
  ]);
  assert.deepEqual(allowedActions.slice(2, 4), allowedActions.slice(0, 2));
});

test('R24 commits the modal cursor before projecting R25', () => {
  const calls = [];
  const runner = StepScriptRunner.create();
  const input = {
    stepKey: 'scoutWorldPanelOpened',
    config,
    ctx: createTargetContext({
      'hitTarget:openWorldMarchFormationPicker': true,
      'hitTarget:startWorldMarch': true,
    }, calls),
  };

  const initial = runner.evaluate(input);
  const unrelated = runner.handleEvent({
    ...input,
    eventName: 'modal.changed',
    payload: {
      operation: 'open',
      subtype: 'modal:targetPicker',
      payload: { pickerKind: 'worldTargetPicker' },
    },
  });
  calls.length = 0;
  const transition = runner.handleEvent({
    ...input,
    eventName: 'modal.changed',
    payload: {
      operation: 'open',
      subtype: 'modal:targetPicker',
      payload: { pickerKind: 'worldMarchFormation' },
    },
  });

  assert.equal(initial.matchedRuleId, 'scout-open-world-formation-picker');
  assert.equal(unrelated.handled, false);
  assert.equal(transition.handled, true);
  assert.equal(transition.nextCursor, 'formationPickerOpen');
  assert.equal(transition.projection.trace.cursor, 'formationPickerOpen');
  assert.equal(transition.projection.matchedRuleId, 'scout-start-world-march');
  assert.deepEqual(calls.map((call) => call.request.target), ['hitTarget:startWorldMarch']);
  assert.doesNotMatch(JSON.stringify(config.scoutWorldPanelOpened), /state\.changed/);
});

test('R21 and R23 refresh their next projections from success events', async () => {
  const steps = TutorialFlowShared.TUTORIAL_STEPS;
  const registry = TutorialGuideEventRegistry.create({ steps });
  const createHost = (initialStep) => {
    let currentStep = initialStep;
    let refreshCount = 0;
    return {
      state: { currentStep },
      getCurrentStep: () => currentStep,
      async advanceTo(nextStep) {
        currentStep = nextStep;
        this.state = { currentStep };
        return this.state;
      },
      refreshCurrentHighlight() {
        refreshCount += 1;
        return true;
      },
      currentStep: () => currentStep,
      refreshCount: () => refreshCount,
    };
  };
  const formationHost = createHost(steps.famousCardViewed);
  const worldTargetHost = createHost(steps.scoutFormationSaved);

  await registry.handle(formationHost, 'armyFormationOpened', {});
  await registry.handle(worldTargetHost, 'worldMarchTargetSelected', {});

  assert.equal(formationHost.currentStep(), steps.formationPanelOpened);
  assert.equal(formationHost.refreshCount(), 1);
  assert.equal(worldTargetHost.currentStep(), steps.scoutWorldPanelOpened);
  assert.equal(worldTargetHost.refreshCount(), 1);
});
