const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialHostContext = require('./TutorialHostContext');

function createHarness(options = {}) {
  const tutorial = {
    completed: false,
    currentStep: options.stepKey || 'eraAdvancedTo1',
  };
  const queryState = {
    taskCenterOpen: false,
    commandPanel: '',
    ...(options.queryState || {}),
  };
  const calls = [];
  let legacyRefreshCount = 0;
  const context = new TutorialHostContext({
    state: tutorial,
    game: { tutorial, state: { tutorial } },
    eventRegistry: { subscribeToBus: () => null },
    flowRegistry: {
      refresh() {
        legacyRefreshCount += 1;
        calls.push({ type: 'legacyRefresh' });
        return options.legacyResult !== false;
      },
    },
    queryTable: {
      invoke(queryName, ...args) {
        if (queryName === 'isTaskCenterOpen') return queryState.taskCenterOpen === true;
        if (queryName === 'isCommandPanelOpen') return queryState.commandPanel === args[0];
        throw new TypeError(`unknown query: ${queryName}`);
      },
    },
    targetResolver: {
      showHighlight(type, predicate, message, allowedAction) {
        calls.push({ type, predicate, message, allowedAction });
        return true;
      },
    },
  });
  context.isAdvisorOpen = () => options.advisorOpen === true;
  context.isRewardRevealOpen = () => options.rewardRevealOpen === true;
  context.prepareCommandPanelGuide = (panel) => {
    calls.push({ type: 'prepareCommandPanelGuide', panel });
    return true;
  };
  return {
    calls,
    context,
    queryState,
    legacyRefreshCount: () => legacyRefreshCount,
  };
}

test('task-panel steps execute engine projections without entering the legacy registry', () => {
  TutorialHostContext.resetStepScriptTrace();
  const harness = createHarness();

  assert.equal(harness.context.refreshCurrentHighlight(), true);
  assert.equal(harness.legacyRefreshCount(), 0);
  assert.deepEqual(harness.calls.at(-1).allowedAction, { type: 'openTaskCenter' });

  harness.queryState.taskCenterOpen = true;
  assert.equal(harness.context.refreshCurrentHighlight(), true);
  assert.deepEqual(harness.calls.at(-1).allowedAction, {
    type: 'claimTaskReward',
    taskId: 'main_first_supplies',
    category: 'main',
  });

  const trace = TutorialHostContext.getStepScriptTrace();
  assert.equal(trace.totalEvaluations, 2);
  assert.equal(trace.steps.eraAdvancedTo1.count, 2);
  assert.equal(trace.steps.eraAdvancedTo1.first.ruleId, 'first-era-open-task-center');
  assert.equal(trace.steps.eraAdvancedTo1.last.ruleId, 'first-era-claim-supplies');
});

test('engine-owned step falls back to residual legacy rules when its projection is empty', () => {
  TutorialHostContext.resetStepScriptTrace();
  const harness = createHarness({
    stepKey: 'era2AdvanceReady',
    queryState: { commandPanel: '' },
  });

  assert.equal(harness.context.refreshCurrentHighlight(), true);
  assert.equal(harness.legacyRefreshCount(), 0);
  assert.deepEqual(harness.calls.at(-1).allowedAction, {
    type: 'openCommandPanel',
    panel: 'civilization',
  });

  harness.queryState.commandPanel = 'civilization';
  assert.equal(harness.context.refreshCurrentHighlight(), true);
  assert.equal(harness.legacyRefreshCount(), 1);
  assert.equal(harness.calls.at(-1).type, 'legacyRefresh');

  const trace = TutorialHostContext.getStepScriptTrace();
  assert.equal(trace.steps.era2AdvanceReady.count, 2);
  assert.equal(trace.steps.era2AdvanceReady.first.ruleId, 'era2-open-civilization');
  assert.equal(trace.steps.era2AdvanceReady.last.ruleId, '');
});

test('legacy modal overlays keep priority while engine evaluation is still traced', () => {
  TutorialHostContext.resetStepScriptTrace();
  const harness = createHarness({ advisorOpen: true });

  assert.equal(harness.context.refreshCurrentHighlight(), true);
  assert.equal(harness.legacyRefreshCount(), 1);
  assert.deepEqual(harness.calls, [{ type: 'legacyRefresh' }]);
  assert.equal(TutorialHostContext.getStepScriptTrace().steps.eraAdvancedTo1.count, 1);
});

test('steps outside the config stay entirely on the legacy registry', () => {
  TutorialHostContext.resetStepScriptTrace();
  const harness = createHarness({ stepKey: 'houseBuilt' });

  assert.equal(harness.context.refreshCurrentHighlight(), true);
  assert.equal(harness.legacyRefreshCount(), 1);
  assert.deepEqual(TutorialHostContext.getStepScriptTrace(), {
    schema: 'tutorial-step-script-trace/v1',
    totalEvaluations: 0,
    steps: {},
  });
});
