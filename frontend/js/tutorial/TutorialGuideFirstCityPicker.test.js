const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameShell = require('../platform/CanvasGameShell');
const TutorialGuideController = require('./TutorialGuideController');

// After the scout marches to the discovered empty city, the actor still overlaps
// the site tile for a moment, so a click resolves to the multi-candidate world
// target picker (openWorldTargetPicker) instead of a direct openWorldSite. The
// firstCityDiscovered guide must (1) not block that click, and (2) then guide the
// player to choose the site candidate out of the picker. Regression for the
// world-march post-arrival stall.

const SITE_ID = 'site_-21_1';

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
