const test = require('node:test');
const assert = require('node:assert/strict');

const StepScriptTypeRegistry = require('./StepScriptTypeRegistry');
const StepScriptRunner = require('./StepScriptRunner');

function createQueryContext(state) {
  return {
    queries(queryName, ...args) {
      if (queryName === 'isTaskCenterOpen') return state.taskCenterOpen === true;
      if (queryName === 'isCommandPanelOpen') return state.commandPanel === args[0];
      throw new TypeError(`unknown synthetic query: ${queryName}`);
    },
  };
}

test('StepScript type registry exposes the three S7 budgeted types', () => {
  assert.deepEqual(StepScriptTypeRegistry.SCRIPT_TYPE_NAMES, [
    'highlightActionWait',
    'ensureSurfaceThenHighlight',
    'waitEventThenNext',
  ]);
});

test('highlightActionWait evaluates ordered when-to-target clauses', () => {
  const state = { taskCenterOpen: false };
  const config = {
    claimStep: {
      type: 'highlightActionWait',
      clauses: [
        {
          ruleId: 'open-task-center',
          when: { query: 'isTaskCenterOpen', equals: false },
          target: 'taskCenterButton',
          messageKey: 'tutorial.openTaskCenter',
        },
        {
          ruleId: 'claim-task',
          when: { query: 'isTaskCenterOpen', equals: true },
          target: 'mainTaskClaim',
          messageKey: 'tutorial.claimTask',
        },
      ],
    },
  };
  const runner = StepScriptRunner.create();
  const ctx = createQueryContext(state);

  assert.equal(runner.evaluate({ stepKey: 'claimStep', config, ctx }).matchedRuleId, 'open-task-center');
  state.taskCenterOpen = true;
  assert.equal(runner.evaluate({ stepKey: 'claimStep', config, ctx }).matchedRuleId, 'claim-task');
});

test('highlightActionWait keeps first-match priority when multiple clauses match', () => {
  const config = {
    priorityStep: {
      type: 'highlightActionWait',
      clauses: [
        { ruleId: 'first', when: true, target: 'firstTarget' },
        { ruleId: 'second', when: true, target: 'secondTarget' },
      ],
    },
  };

  const result = StepScriptRunner.create().evaluate({ stepKey: 'priorityStep', config, ctx: null });

  assert.equal(result.matchedRuleId, 'first');
  assert.equal(result.instructions[0].target, 'firstTarget');
});

test('runner is reentrant for any repeated evaluation of the same state', () => {
  const state = { taskCenterOpen: true };
  const config = {
    claimStep: {
      type: 'highlightActionWait',
      clauses: [{
        ruleId: 'claim-task',
        when: { query: 'isTaskCenterOpen' },
        target: 'mainTaskClaim',
        messageKey: 'tutorial.claimTask',
      }],
    },
  };
  const runner = StepScriptRunner.create();
  const input = { stepKey: 'claimStep', config, ctx: createQueryContext(state) };
  const expected = runner.evaluate(input);

  for (let index = 0; index < 17; index += 1) {
    assert.deepEqual(runner.evaluate(input), expected);
  }
});

test('mutating one projection cannot leak into the next evaluation', () => {
  const config = {
    stableStep: {
      type: 'highlightActionWait',
      ruleId: 'stable-rule',
      target: 'stableTarget',
      messageKey: 'tutorial.stable',
    },
  };
  const runner = StepScriptRunner.create();
  const input = { stepKey: 'stableStep', config, ctx: null };
  const first = runner.evaluate(input);

  first.instructions[0].target = 'mutatedTarget';
  const second = runner.evaluate(input);

  assert.equal(second.instructions[0].target, 'stableTarget');
  assert.equal(config.stableStep.target, 'stableTarget');
});

test('replaceable step-key source switches projections without residual cursor state', () => {
  let currentStep = 'openPanel';
  const runner = StepScriptRunner.create({ stepKeySource: () => currentStep });
  const config = {
    openPanel: {
      type: 'ensureSurfaceThenHighlight',
      ruleId: 'open-civilization',
      panel: 'civilization',
      target: 'civilizationPanelButton',
      messageKey: 'tutorial.openCivilization',
    },
    awaitEvent: {
      type: 'waitEventThenNext',
      ruleId: 'await-panel-open',
      eventName: 'commandPanelOpened',
      nextStep: 'panelOpened',
    },
  };

  const first = runner.evaluate({ stepKey: 'ignored', config, ctx: createQueryContext({}) });
  currentStep = 'awaitEvent';
  const second = runner.evaluate({ stepKey: 'ignored', config, ctx: createQueryContext({}) });
  currentStep = 'openPanel';
  const third = runner.evaluate({ stepKey: 'ignored', config, ctx: createQueryContext({}) });

  assert.equal(first.instructions[0].type, 'ensureSurfaceThenHighlight');
  assert.equal(second.instructions[0].type, 'waitEventThenNext');
  assert.deepEqual(third, first);
});

test('runner returns an explicit empty projection for an unowned step', () => {
  const result = StepScriptRunner.create().evaluate({ stepKey: 'legacyStep', config: {}, ctx: null });

  assert.equal(result.handled, false);
  assert.deepEqual(result.instructions, []);
  assert.deepEqual(result.trace.instructionTypes, []);
});
