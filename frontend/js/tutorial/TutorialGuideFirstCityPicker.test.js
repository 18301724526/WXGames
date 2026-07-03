const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameShell = require('../platform/CanvasGameShell');
const TutorialGuideController = require('./TutorialGuideController');
const TutorialGuideFlowRegistry = require('./TutorialGuideFlowRegistry');

// A guided click on a world site whose tile also carries an actor (intro march
// on the capital, arrived scout on the discovered city) resolves to the
// multi-candidate world target picker (openWorldTargetPicker) instead of a
// direct openWorldSite. The guide must (1) not block that click, and (2) follow
// into the picker and highlight choosing the guided site's candidate — at EVERY
// site-guide step, not just firstCityDiscovered. Regression for the
// world-march post-arrival stall.

const SITE_ID = 'site_-21_1';
const CAPITAL_ID = 'capital';

function makeGuideHost({ step, pickerSiteId = '', pickerCandidateId = 'site-1' }) {
  const highlights = [];
  const host = {
    getCurrentStep: () => step,
    getCapitalCityId: () => CAPITAL_ID,
    getFirstExploreCityId: () => SITE_ID,
    getWorldTargetPickerSiteCandidate: (siteId) =>
      pickerSiteId && String(siteId) === String(pickerSiteId)
        ? { id: pickerCandidateId, kind: 'site' }
        : null,
    isWorldSiteSelected: () => false,
    showFirstCitySiteOpenHighlight: (siteId) => {
      highlights.push({ type: 'openWorldSite', siteId });
      return true;
    },
    showHighlight: (type, _predicate, _message, allowedAction) => {
      highlights.push({ type, allowedAction });
      return true;
    },
  };
  return { host, highlights };
}

test('the picker follow-through rules highlight the guided site candidate at every site-guide step', () => {
  const registry = TutorialGuideFlowRegistry.create();
  const cases = [
    { step: 'famousCardViewed', pickerSiteId: CAPITAL_ID },
    { step: 'firstCityDiscovered', pickerSiteId: SITE_ID },
    { step: 'firstCityConquestStarted', pickerSiteId: SITE_ID },
    { step: 'firstCityOccupied', pickerSiteId: SITE_ID },
  ];
  for (const { step, pickerSiteId } of cases) {
    const { host, highlights } = makeGuideHost({ step, pickerSiteId });
    assert.equal(registry.refresh(host), true, `refresh should render at ${step}`);
    assert.equal(highlights.length, 1, `one highlight at ${step}`);
    assert.deepEqual(
      highlights[0],
      {
        type: 'chooseWorldTarget',
        allowedAction: { type: 'chooseWorldTarget', targetId: 'site-1' },
      },
      `chooseWorldTarget candidate highlighted at ${step}`,
    );
  }
});

test('without an open picker the firstCityDiscovered guide falls back to opening the site', () => {
  const registry = TutorialGuideFlowRegistry.create();
  const { host, highlights } = makeGuideHost({ step: 'firstCityDiscovered', pickerSiteId: '' });
  assert.equal(registry.refresh(host), true);
  assert.deepEqual(highlights, [{ type: 'openWorldSite', siteId: SITE_ID }]);
});

function makeShell() {
  return Object.assign(new CanvasGameShell({}), {});
}

test('matchesTutorialAllowedAction accepts the same-site target picker for an openWorldSite guide', () => {
  const shell = makeShell();
  const allowed = { type: 'openWorldSite', siteId: SITE_ID };
  const pickerAction = {
    type: 'openWorldTargetPicker',
    tileId: 'tile_-21_1',
    candidates: [
      { id: 'actor-0', kind: 'actor', action: { type: 'selectWorldActor', actorId: 'a1' } },
      { id: 'site-1', kind: 'site', action: { type: 'openWorldSite', siteId: SITE_ID } },
    ],
  };
  assert.equal(shell.matchesTutorialAllowedAction(pickerAction, allowed), true);

  // A picker for a DIFFERENT site is not accepted.
  const otherPicker = {
    type: 'openWorldTargetPicker',
    candidates: [
      { id: 'site-x', kind: 'site', action: { type: 'openWorldSite', siteId: 'site_9_9' } },
    ],
  };
  assert.equal(shell.matchesTutorialAllowedAction(otherPicker, allowed), false);

  // Unrelated action types still fall through to the exact-match rule.
  assert.equal(
    shell.matchesTutorialAllowedAction({ type: 'openWorldSite', siteId: SITE_ID }, allowed),
    true,
  );
  assert.equal(
    shell.matchesTutorialAllowedAction({ type: 'conquer', territoryId: SITE_ID }, allowed),
    false,
  );
});

test('getWorldTargetPickerSiteCandidate returns the site candidate from an open world target picker', () => {
  const controller = new TutorialGuideController({
    game: {
      getTargetPickerSnapshot: () => ({
        pickerKind: 'worldTargetPicker',
        picker: {
          candidates: [
            { id: 'actor-0', kind: 'actor', action: { type: 'selectWorldActor', actorId: 'a1' } },
            { id: 'site-1', kind: 'site', action: { type: 'openWorldSite', siteId: SITE_ID } },
          ],
        },
      }),
    },
  });
  const candidate = controller.getWorldTargetPickerSiteCandidate(SITE_ID);
  assert.equal(candidate?.id, 'site-1');

  // Wrong picker kind (formation) is ignored.
  const formationController = new TutorialGuideController({
    game: {
      getTargetPickerSnapshot: () => ({
        pickerKind: 'worldMarchFormation',
        picker: { candidates: [] },
      }),
    },
  });
  assert.equal(formationController.getWorldTargetPickerSiteCandidate(SITE_ID), null);
});
