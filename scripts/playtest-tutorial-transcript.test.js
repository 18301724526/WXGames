const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyExclusionPolicy,
  buildTutorialTranscript,
  loadExclusionPolicy,
} = require('./playtest-tutorial-transcript');

test('tutorial transcript exclusion policy removes unstable evidence fields', () => {
  const policy = loadExclusionPolicy();
  const filtered = applyExclusionPolicy({
    runId: 'run-a',
    durationMs: 12,
    waitedMs: 34,
    personId: 'person-a',
    name: 'random-name',
    x: 10,
    cropMetrics: { goldPixels: 20 },
    action: { type: 'claimTask', panel: 'tasks' },
  }, policy);

  assert.deepEqual(filtered, {
    action: { type: 'claimTask', panel: 'tasks' },
  });
});

test('tutorial transcript projects ordered stable step and target facts', () => {
  const transcript = buildTutorialTranscript({
    verificationReports: [
      {
        label: 'guided-open',
        beforeStepName: 'buildingsTabOpened',
        action: { type: 'openCommandPanel', panel: 'buildings', durationMs: 4 },
      },
      {
        label: 'picker-choice',
        beforeStepName: 'firstCitySelected',
        action: { type: 'chooseWorldTarget', targetId: 'site-random' },
      },
    ],
    actionEvidence: [
      {
        label: 'guided-open-before',
        target: { action: { type: 'openCommandPanel', panel: 'buildings', x: 20 } },
        highlight: { allowedAction: { type: 'openCommandPanel', panel: 'buildings' } },
      },
      {
        label: 'picker-choice-before',
        target: { action: { type: 'chooseWorldTarget', targetId: 'site-random' } },
        highlight: { allowedAction: { type: 'openWorldSite', siteId: 'site-random' } },
      },
    ],
  });

  assert.deepEqual(transcript, [
    {
      stepKey: 'buildingsTabOpened',
      actionType: 'openCommandPanel',
      targetType: 'openCommandPanel',
      panelKey: 'buildings',
    },
    {
      stepKey: 'firstCitySelected',
      actionType: 'openWorldSite',
      targetType: 'chooseWorldTarget',
      panelKey: '',
    },
  ]);
});

test('tutorial transcript appends the observed completed terminal state once', () => {
  const transcript = buildTutorialTranscript({
    verificationReports: [{
      label: 'close-final-advisor',
      beforeStepName: 'finalTechOpened',
      action: { type: 'closeAdvisor' },
    }],
    actionEvidence: [],
    finalStepName: 'completed',
    tutorialCompleted: true,
  });

  assert.deepEqual(transcript, [
    {
      stepKey: 'finalTechOpened',
      actionType: 'closeAdvisor',
      targetType: 'closeAdvisor',
      panelKey: '',
    },
    {
      stepKey: 'completed',
      actionType: '',
      targetType: '',
      panelKey: '',
    },
  ]);
});

test('tutorial transcript policy excludes timing-only march arrival reports', () => {
  const transcript = buildTutorialTranscript({
    verificationReports: [
      {
        label: 'march-arrived-51',
        beforeStepName: 'firstCityDiscovered',
        action: { type: 'wait', reason: 'guided march arrived', waitedMs: 3714 },
      },
      {
        label: 'highlight-openWorldSite-52',
        beforeStepName: 'firstCityDiscovered',
        action: { type: 'openWorldSite' },
      },
    ],
    actionEvidence: [],
  });

  assert.deepEqual(transcript, [{
    stepKey: 'firstCityDiscovered',
    actionType: 'openWorldSite',
    targetType: 'openWorldSite',
    panelKey: '',
  }]);
});
