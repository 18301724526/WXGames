const test = require('node:test');
const assert = require('node:assert/strict');
const TutorialActionMatches = require('./TutorialActionMatches');

const TARGET_ID_KEYS = ['siteId', 'territoryId', 'cityId', 'targetId'];

test('TutorialActionMatches accepts every target-id alias pair', () => {
  for (const allowedKey of TARGET_ID_KEYS) {
    for (const actionKey of TARGET_ID_KEYS) {
      assert.equal(
        TutorialActionMatches.actionMatches(
          { type: 'openWorldSite', [actionKey]: 'site_1' },
          { type: 'openWorldSite', [allowedKey]: 'site_1' },
        ),
        true,
        `${allowedKey} -> ${actionKey}`,
      );
    }
  }
});

test('TutorialActionMatches preserves ordinary field matching and target-id omissions', () => {
  const equivalentPairs = [
    [{ type: 'assignJob', job: 'farmer' }, { type: 'assignJob', job: 'farmer' }],
    [{ type: 'openWorldSite' }, { type: 'openWorldSite', siteId: 'site_1' }],
    [{ type: 'openWorldSite', siteId: 'site_1' }, { type: 'openWorldSite' }],
    [{ type: 'assignJob' }, { type: 'assignJob', job: undefined }],
  ];
  for (const [action, allowedAction] of equivalentPairs) {
    assert.equal(TutorialActionMatches.actionMatches(action, allowedAction), true);
  }
});

test('TutorialActionMatches accepts each openWorldSite picker equivalent', () => {
  const equivalentActions = [
    { type: 'openWorldTargetPicker', candidates: [{ type: 'openWorldSite', siteId: 'site_1' }] },
    { type: 'openWorldTargetPicker', candidates: [{ action: { type: 'openWorldSite', cityId: 'site_1' } }] },
    { type: 'openWorldTargetPicker', candidates: [{ kind: 'site', territoryId: 'site_1' }] },
    { type: 'openWorldTargetPicker', candidates: [{ kind: 'site', siteId: 'any' }] },
  ];
  const allowedActions = [
    { type: 'openWorldSite', siteId: 'site_1' },
    { type: 'openWorldSite', cityId: 'site_1' },
    { type: 'openWorldSite', territoryId: 'site_1' },
    { type: 'openWorldSite' },
  ];
  equivalentActions.forEach((action, index) => {
    assert.equal(TutorialActionMatches.actionMatches(action, allowedActions[index]), true);
  });
});

test('TutorialActionMatches rejects every non-equivalent action boundary', () => {
  const rejectedPairs = [
    [{}, { type: 'openWorldSite' }],
    [{ type: 'openWorldSite' }, null],
    [{ type: 'enterCity' }, { type: 'openWorldSite' }],
    [{ type: 'openWorldSite', siteId: 'site_2' }, { type: 'openWorldSite', cityId: 'site_1' }],
    [{ type: 'assignJob', job: 'builder' }, { type: 'assignJob', job: 'farmer' }],
    [{ type: 'openWorldSite' }, { type: 'openWorldTargetPicker' }],
    [{ type: 'openWorldTargetPicker', candidates: [] }, { type: 'openWorldSite', siteId: 'site_1' }],
    [{ type: 'openWorldTargetPicker', candidates: [{ type: 'enterCity', siteId: 'site_1' }] }, { type: 'openWorldSite', siteId: 'site_1' }],
    [{ type: 'openWorldTargetPicker', candidates: [{ kind: 'site', siteId: 'site_2' }] }, { type: 'openWorldSite', siteId: 'site_1' }],
  ];
  for (const [action, allowedAction] of rejectedPairs) {
    assert.equal(TutorialActionMatches.actionMatches(action, allowedAction), false);
  }
});

test('TutorialActionMatches enumerates close-action whitelist equivalents', () => {
  assert.equal(TutorialActionMatches.isRewardRevealCloseAllowed(
    { type: 'closeRewardReveal' },
    true,
  ), true);
  const equivalentPairs = [
    [{ type: 'closeAdvisor' }, { source: 'houseBuilt' }],
    [{ type: 'closeAdvisor', source: 'tutorialAdvisorDialogue' }, { source: 'houseBuilt' }],
    [{ type: 'closeAdvisor', source: 'houseBuilt' }, { source: 'houseBuilt' }],
    [{ type: 'closeAdvisor', source: 'anything' }, {}],
  ];
  for (const [action, dialogue] of equivalentPairs) {
    assert.equal(TutorialActionMatches.isAdvisorCloseAllowed(action, dialogue), true);
  }
});

test('TutorialActionMatches enumerates close-action whitelist rejections', () => {
  assert.equal(TutorialActionMatches.isRewardRevealCloseAllowed(
    { type: 'closeRewardReveal' },
    false,
  ), false);
  assert.equal(TutorialActionMatches.isRewardRevealCloseAllowed(
    { type: 'assignJob' },
    true,
  ), false);
  const rejectedPairs = [
    [{ type: 'closeAdvisor' }, null],
    [{ type: 'closeAdvisor', source: 'staleDialogue' }, { source: 'houseBuilt' }],
    [{ type: 'closeRewardReveal' }, { source: 'houseBuilt' }],
    [{ type: 'assignJob' }, {}],
  ];
  for (const [action, dialogue] of rejectedPairs) {
    assert.equal(TutorialActionMatches.isAdvisorCloseAllowed(action, dialogue), false);
  }
});
