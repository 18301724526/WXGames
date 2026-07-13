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

test('StepScript type registry exposes the five S9a C2 types', () => {
  assert.deepEqual(StepScriptTypeRegistry.SCRIPT_TYPE_NAMES, [
    'highlightActionWait',
    'ensureSurfaceThenHighlight',
    'waitEventThenNext',
    'orderedTargetFlow',
    'effectSequence',
  ]);
});

function createTargetContext(availability = {}, calls = []) {
  return {
    resolveTarget(methodName, request) {
      calls.push({ methodName, target: request.target });
      return { available: availability[request.target] === true };
    },
  };
}

test('orderedTargetFlow selects the first available target in declaration order', () => {
  const calls = [];
  const config = {
    formationStep: {
      type: 'orderedTargetFlow',
      clauses: [
        { ruleId: 'toggle', target: 'hitTarget:toggle', action: { type: 'toggle' } },
        { ruleId: 'save', target: 'hitTarget:save', action: { type: 'save' } },
        { ruleId: 'later', target: 'hitTarget:later', action: { type: 'later' } },
      ],
    },
  };

  const projection = StepScriptRunner.create().evaluate({
    stepKey: 'formationStep',
    config,
    ctx: createTargetContext({ 'hitTarget:save': true, 'hitTarget:later': true }, calls),
  });

  assert.equal(projection.matchedRuleId, 'save');
  assert.deepEqual(calls.map((call) => call.target), ['hitTarget:toggle', 'hitTarget:save']);
  assert.deepEqual(projection.instructions[0].action, { type: 'save' });
});

test('orderedTargetFlow commits its client cursor before reprojecting an event match', () => {
  const calls = [];
  const config = {
    eventStep: {
      type: 'orderedTargetFlow',
      cursorKey: 'eventFlow',
      initialCursor: 'pending',
      clauses: [
        {
          cursor: 'pending',
          ruleId: 'open',
          target: 'hitTarget:open',
          eventName: 'modal.changed',
          eventFilter: { operation: 'open', payload: { eventId: 'evt-1' } },
          nextCursor: 'opened',
        },
        {
          cursor: 'opened',
          ruleId: 'claim',
          target: 'hitTarget:claim',
          eventName: 'eventClaimed',
        },
      ],
    },
  };
  const runner = StepScriptRunner.create();
  const input = {
    stepKey: 'eventStep',
    config,
    ctx: createTargetContext({ 'hitTarget:open': true, 'hitTarget:claim': true }, calls),
  };

  assert.equal(runner.evaluate(input).matchedRuleId, 'open');
  calls.length = 0;
  const transition = runner.handleEvent({
    ...input,
    eventName: 'modal.changed',
    payload: { operation: 'open', payload: { eventId: 'evt-1', extra: true } },
  });

  assert.equal(transition.handled, true);
  assert.equal(transition.nextCursor, 'opened');
  assert.equal(transition.projection.trace.cursor, 'opened');
  assert.equal(transition.projection.matchedRuleId, 'claim');
  assert.deepEqual(calls.map((call) => call.target), ['hitTarget:claim']);
});

test('orderedTargetFlow projects nextStep when no target is available', () => {
  const config = {
    exhaustedStep: {
      type: 'orderedTargetFlow',
      nextStep: 'doneStep',
      clauses: [{ ruleId: 'missing', target: 'hitTarget:missing' }],
    },
  };

  const projection = StepScriptRunner.create().evaluate({
    stepKey: 'exhaustedStep',
    config,
    ctx: createTargetContext(),
  });

  assert.deepEqual(projection.instructions, [{ type: 'nextStep', nextStep: 'doneStep' }]);
});

test('orderedTargetFlow repeated projections are idempotent and resolve once per candidate', () => {
  const calls = [];
  const config = {
    stableFlow: {
      type: 'orderedTargetFlow',
      clauses: [
        { ruleId: 'first', target: 'hitTarget:first' },
        { ruleId: 'second', target: 'hitTarget:second' },
      ],
    },
  };
  const runner = StepScriptRunner.create();
  const input = {
    stepKey: 'stableFlow',
    config,
    ctx: createTargetContext({ 'hitTarget:second': true }, calls),
  };
  const expected = runner.evaluate(input);

  for (let index = 0; index < 7; index += 1) {
    assert.deepEqual(runner.evaluate(input), expected);
  }
  assert.equal(calls.length, 16);
});

test('orderedTargetFlow emits frozen beforeEffects only once per step entry', () => {
  const config = {
    effectfulFlow: {
      type: 'orderedTargetFlow',
      beforeEffects: [{ effect: 'hideTutorialHighlight' }],
      clauses: [{ ruleId: 'target', target: 'hitTarget:target' }],
    },
  };
  const runner = StepScriptRunner.create();
  const input = {
    stepKey: 'effectfulFlow',
    config,
    ctx: createTargetContext({ 'hitTarget:target': true }),
  };

  assert.deepEqual(runner.evaluate(input).trace.instructionTypes, [
    'beforeEffects',
    'orderedTargetFlow',
  ]);
  assert.deepEqual(runner.evaluate(input).trace.instructionTypes, ['orderedTargetFlow']);
  runner.evaluate({ stepKey: 'other', config: {}, ctx: input.ctx });
  assert.deepEqual(runner.evaluate(input).trace.instructionTypes, [
    'beforeEffects',
    'orderedTargetFlow',
  ]);
});

test('effectSequence preserves effects, target resolution, action request, and wait order', () => {
  const config = {
    sequenceStep: {
      type: 'effectSequence',
      ruleId: 'sequence-rule',
      effects: [{ effect: 'hideTutorialHighlight', args: [{ source: 'unit' }] }],
      target: 'hitTarget:selectWorldMarchTarget',
      targetArgs: { targetAlias: 'firstExploreCityCoord' },
      action: { type: 'selectWorldMarchTarget' },
      eventName: 'worldMarchTargetSelected',
      nextStep: 'pickerStep',
    },
  };

  const projection = StepScriptRunner.create().evaluate({
    stepKey: 'sequenceStep',
    config,
  });
  const operations = projection.instructions[0].operations;

  assert.deepEqual(operations.map((operation) => operation.type), [
    'effects',
    'resolveTarget',
    'requestAction',
    'waitFor',
  ]);
  assert.equal(operations[0].methodName, 'hideTutorialHighlight');
  assert.equal(operations[1].methodName, 'resolveStepScriptTarget');
  assert.equal(operations[2].methodName, 'renderStepScriptTarget');
  assert.equal(operations[3].nextStep, 'pickerStep');
});

test('effectSequence FIRE rejects effects outside the frozen host table', () => {
  assert.throws(
    () => StepScriptRunner.create().evaluate({
      stepKey: 'badSequence',
      config: {
        badSequence: {
          type: 'effectSequence',
          effects: [{ effect: 'ensureMapHomeGuideVisible' }],
        },
      },
    }),
    /unknown effect: ensureMapHomeGuideVisible/,
  );
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
