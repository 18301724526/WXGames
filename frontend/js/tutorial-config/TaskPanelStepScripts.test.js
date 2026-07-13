const test = require('node:test');
const assert = require('node:assert/strict');

const StepScriptRunner = require('../tutorial-engine/StepScriptRunner');
const config = require('./TaskPanelStepScripts');

function createContext(state = {}) {
  return {
    queries(queryName, ...args) {
      if (queryName === 'isTaskCenterOpen') return state.taskCenterOpen === true;
      if (queryName === 'isCommandPanelOpen') return state.commandPanel === args[0];
      throw new TypeError(`unknown query: ${queryName}`);
    },
  };
}

test('task-panel StepScript config owns 14 step keys', () => {
  assert.deepEqual(Object.keys(config), [
    'eraAdvancedTo1',
    'era2AdvanceReady',
    'eraAdvancedTo2',
    'lumbermillBuilt',
    'era3AdvanceReady',
    'era3Advanced',
    'barracksBuilt',
    'firstArmyClaimed',
    'famousCardViewed',
    'formationPanelOpened',
    'scoutFormationSaved',
    'scoutWorldPanelOpened',
    'famousSeekCompleted',
    'finalTechOpened',
  ]);
});

test('task claim steps switch between fixed open and claim targets', () => {
  const runner = StepScriptRunner.create();
  const taskSteps = [
    ['eraAdvancedTo1', 'first-era-open-task-center', 'first-era-claim-supplies'],
    ['lumbermillBuilt', 'lumbermill-open-task-center', 'lumbermill-claim-task'],
    ['era3Advanced', 'barracks-open-task-center', 'barracks-claim-supplies'],
    ['barracksBuilt', 'first-army-open-task-center', 'first-army-claim'],
    ['firstArmyClaimed', 'scout-officer-open-task-center', 'scout-officer-claim'],
  ];

  taskSteps.forEach(([stepKey, openRuleId, claimRuleId]) => {
    const closed = runner.evaluate({ stepKey, config, ctx: createContext({ taskCenterOpen: false }) });
    const open = runner.evaluate({ stepKey, config, ctx: createContext({ taskCenterOpen: true }) });
    assert.equal(closed.matchedRuleId, openRuleId);
    assert.equal(closed.instructions[0].target, 'openTaskCenter');
    assert.equal(open.matchedRuleId, claimRuleId);
    assert.match(open.instructions[0].target, /^claimTaskReward:/);
  });
});

test('single-phase panel steps emit instructions only while the named panel is closed', () => {
  const runner = StepScriptRunner.create();
  const panelSteps = [
    ['eraAdvancedTo2', 'events'],
    ['famousSeekCompleted', 'tech'],
    ['finalTechOpened', 'tech'],
  ];

  panelSteps.forEach(([stepKey, panel]) => {
    const closed = runner.evaluate({ stepKey, config, ctx: createContext({ commandPanel: '' }) });
    const open = runner.evaluate({ stepKey, config, ctx: createContext({ commandPanel: panel }) });
    assert.equal(closed.instructions[0].type, 'ensureSurfaceThenHighlight');
    assert.equal(closed.instructions[0].panel, panel);
    assert.equal(open.handled, false);
  });
});

test('era advance steps open civilization first, then highlight advanceEra', () => {
  const runner = StepScriptRunner.create();
  const eraSteps = [
    [
      'era2AdvanceReady',
      'era2-open-civilization',
      'era2-advance',
      'tutorial.guide.openCivilizationForEra2',
      'tutorial.guide.advanceToEra2',
    ],
    [
      'era3AdvanceReady',
      'era3-open-civilization',
      'era3-advance',
      'tutorial.guide.openCivilizationForEra3',
      'tutorial.guide.advanceToEra3',
    ],
  ];

  eraSteps.forEach(([stepKey, openRuleId, advanceRuleId, openMessageKey, advanceMessageKey]) => {
    const closed = runner.evaluate({ stepKey, config, ctx: createContext({ commandPanel: '' }) });
    const open = runner.evaluate({ stepKey, config, ctx: createContext({ commandPanel: 'civilization' }) });

    assert.equal(closed.matchedRuleId, openRuleId);
    assert.deepEqual(closed.instructions[0], {
      type: 'highlightActionWait',
      target: 'openCommandPanel',
      messageKey: openMessageKey,
      eventName: 'commandPanelOpened',
      panel: 'civilization',
    });
    assert.equal(open.matchedRuleId, advanceRuleId);
    assert.deepEqual(open.instructions[0], {
      type: 'highlightActionWait',
      target: 'advanceEra',
      messageKey: advanceMessageKey,
      eventName: 'eraAdvanced',
      panel: '',
    });
  });
});
