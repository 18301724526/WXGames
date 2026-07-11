const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialHostContext = require('./TutorialHostContext');
const ChangeEventBus = require('../state/ChangeEventBus');
const TutorialGuideEventRegistry = require('./TutorialGuideEventRegistry');
const TutorialGuideFlowRegistry = require('./TutorialGuideFlowRegistry');
const TutorialFlowShared = require('../../../shared/tutorialFlowConfig');

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

test('synchronous modal refresh reentry is traced and coalesced into one trailing refresh', async (t) => {
  TutorialHostContext.resetRefreshReentryTrace();
  const traceEvents = [];
  const previousTrace = global.TutorialHostContextTrace;
  global.TutorialHostContextTrace = {
    log(eventName, detail) {
      traceEvents.push({ eventName, detail });
    },
  };
  t.after(() => {
    global.TutorialHostContextTrace = previousTrace;
  });

  const tutorial = { completed: false, currentStep: 'cityEntered' };
  const bus = ChangeEventBus.createEventBus();
  let refreshCount = 0;
  let activeDepth = 0;
  let maxDepth = 0;
  let panelOpen = false;
  let finalHighlight = '';
  const context = new TutorialHostContext({
    state: tutorial,
    game: { tutorial, state: { tutorial } },
    changeEventBus: bus,
    stepScriptConfig: {},
    flowRegistry: {
      refresh() {
        refreshCount += 1;
        activeDepth += 1;
        maxDepth = Math.max(maxDepth, activeDepth);
        if (!panelOpen) {
          panelOpen = true;
          bus.emit('modal.changed', { source: 'test-house-rule', subtype: 'modal:cityManagement' });
        }
        finalHighlight = panelOpen ? 'buildBuilding:house' : '';
        activeDepth -= 1;
        return true;
      },
    },
    targetResolver: null,
    queryTable: null,
  });

  assert.equal(context.refreshCurrentHighlight(), true);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(refreshCount, 2);
  assert.equal(maxDepth, 1);
  assert.equal(finalHighlight, 'buildBuilding:house');
  assert.deepEqual(TutorialHostContext.getRefreshReentryTrace(), {
    schema: 'tutorial-highlight-refresh-reentry-trace/v1',
    count: 1,
    traces: [{ stepKey: 'cityEntered', phase: 'primary', trailingScheduled: true }],
  });
  assert.equal(traceEvents.length, 1);
  assert.equal(traceEvents[0].eventName, 'tutorial-highlight-refresh-reentry');
  context.disconnectChangeEventBus();
});

test('reentry during a trailing refresh schedules one more non-recursive refresh', async () => {
  TutorialHostContext.resetRefreshReentryTrace();
  const tutorial = { completed: false, currentStep: 'cityEntered' };
  const bus = ChangeEventBus.createEventBus();
  let refreshCount = 0;
  let activeDepth = 0;
  let maxDepth = 0;
  const context = new TutorialHostContext({
    state: tutorial,
    game: { tutorial, state: { tutorial } },
    changeEventBus: bus,
    stepScriptConfig: {},
    flowRegistry: {
      refresh() {
        refreshCount += 1;
        activeDepth += 1;
        maxDepth = Math.max(maxDepth, activeDepth);
        if (refreshCount <= 2) {
          bus.emit('modal.changed', { source: 'test-trailing-reentry', subtype: 'modal:cityManagement' });
        }
        activeDepth -= 1;
        return true;
      },
    },
    targetResolver: null,
    queryTable: null,
  });

  assert.equal(context.refreshCurrentHighlight(), true);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(refreshCount, 3);
  assert.equal(maxDepth, 1);
  assert.deepEqual(TutorialHostContext.getRefreshReentryTrace().traces, [
    { stepKey: 'cityEntered', phase: 'primary', trailingScheduled: true },
    { stepKey: 'cityEntered', phase: 'trailing', trailingScheduled: false },
  ]);
  context.disconnectChangeEventBus();
});

test('state.changed back-edge is coalesced across contexts sharing one game owner', async () => {
  TutorialHostContext.resetRefreshReentryTrace();
  const tutorial = { completed: false, currentStep: 'cityEntered' };
  const game = { tutorial, state: { tutorial } };
  const bus = ChangeEventBus.createEventBus();
  let firstRefreshCount = 0;
  let secondRefreshCount = 0;
  let activeDepth = 0;
  let maxDepth = 0;

  const first = new TutorialHostContext({
    state: tutorial,
    game,
    changeEventBus: bus,
    stepScriptConfig: {},
    flowRegistry: {
      refresh() {
        firstRefreshCount += 1;
        activeDepth += 1;
        maxDepth = Math.max(maxDepth, activeDepth);
        bus.emit('state.changed', { owner: game, source: 'renderActive:getActiveTab' });
        activeDepth -= 1;
        return true;
      },
    },
    targetResolver: null,
    queryTable: null,
  });
  const second = new TutorialHostContext({
    state: tutorial,
    game,
    changeEventBus: bus,
    stepScriptConfig: {},
    flowRegistry: {
      refresh() {
        secondRefreshCount += 1;
        activeDepth += 1;
        maxDepth = Math.max(maxDepth, activeDepth);
        activeDepth -= 1;
        return true;
      },
    },
    targetResolver: null,
    queryTable: null,
  });

  assert.equal(first.refreshCurrentHighlight(), true);
  await Promise.resolve();

  assert.equal(firstRefreshCount, 1);
  assert.equal(secondRefreshCount, 0);
  assert.equal(maxDepth, 1);
  assert.deepEqual(TutorialHostContext.getRefreshReentryTrace().traces, [
    { stepKey: 'cityEntered', phase: 'primary', trailingScheduled: false },
    { stepKey: 'cityEntered', phase: 'primary', trailingScheduled: false },
  ]);
  first.disconnectChangeEventBus();
  second.disconnectChangeEventBus();
});

test('cityEntered advances before refreshing its pure projection', async () => {
  const steps = TutorialFlowShared.TUTORIAL_STEPS;
  const calls = [];
  let step = steps.initial;
  const host = {
    constructor: { TUTORIAL_STEPS: steps },
    state: { currentStep: step },
    isCompleted: () => false,
    getCurrentStep: () => step,
    async advanceTo(nextStep) {
      calls.push(`advance:${nextStep}`);
      step = nextStep;
      this.state = { currentStep: nextStep };
      return this.state;
    },
    refreshCurrentHighlight() {
      calls.push('refreshCurrentHighlight');
      return true;
    },
  };

  const handlers = TutorialGuideEventRegistry.createDefaultHandlers(steps);
  const result = await handlers.cityEntered(host);

  assert.deepEqual(calls, [
    `advance:${steps.cityEntered}`,
    'refreshCurrentHighlight',
  ]);
  assert.equal(result.currentStep, steps.cityEntered);
});

test('house-build residual rule projects the highlight without mutating panel state', () => {
  const steps = TutorialFlowShared.TUTORIAL_STEPS;
  const rule = TutorialGuideFlowRegistry.createDefaultRules(steps)
    .find((entry) => entry.id === 'house-build');
  let shown = null;
  const target = { action: { type: 'buildBuilding', buildingId: 'house' } };
  const host = {
    constructor: { TUTORIAL_STEPS: steps },
    getCurrentStep: () => steps.cityEntered,
    isHouseGuideActive: () => true,
    getCanvasTarget: () => target,
    showTutorialHighlight(actualTarget, _message, options) {
      shown = { actualTarget, options };
      return true;
    },
  };

  assert.equal(rule.matches(host), true);
  assert.equal(rule.render(host), true);
  assert.equal(shown.actualTarget, target);
  assert.deepEqual(shown.options.allowedAction, { type: 'buildBuilding', buildingId: 'house' });
});
