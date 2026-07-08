const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuideUiController = require('./TutorialGuideUiController');

// SHAPE-B single-owner contract: the controller owns the highlight blob on the state
// host; the render surface is resolved per call (host.canvasShell for a mounted game,
// the host itself for a standalone shell). Both wirings must behave identically.

function makeSurface() {
  return {
    calls: [],
    now() {
      return 1000;
    },
    startFloatTimer() {
      this.calls.push(['startFloatTimer']);
    },
    renderGuideHighlightFrame(highlight) {
      this.calls.push(['renderFrame', highlight.message]);
      return true;
    },
    renderActive() {
      this.calls.push(['renderActive']);
      return true;
    },
  };
}

function makeMountedGameHost(state) {
  const surface = makeSurface();
  return { host: { state, canvasShell: surface }, surface };
}

function makeStandaloneShellHost(state) {
  const surface = makeSurface();
  surface.state = state;
  return { host: surface, surface };
}

for (const [shape, makeHost] of [
  ['mounted-game', makeMountedGameHost],
  ['standalone-shell', makeStandaloneShellHost],
]) {
  test(`show builds the highlight blob and drives the surface; hide clears and re-renders (${shape})`, () => {
    const { host, surface } = makeHost({});
    const controller = new TutorialGuideUiController({ host });

    assert.equal(controller.show(surface, null, 'msg'), false);

    assert.equal(
      controller.show(
        surface,
        { x: 10, y: 20, width: 30, height: 40, action: { type: 'openArmyFormation' } },
        'do the thing',
        { allowedAction: { type: 'openArmyFormation' }, source: 'tutorial' },
      ),
      true,
    );
    assert.deepEqual(controller.highlight.rect, {
      left: 10,
      top: 20,
      width: 30,
      height: 40,
      right: 40,
      bottom: 60,
    });
    assert.equal(controller.highlight.message, 'do the thing');
    assert.deepEqual(controller.highlight.allowedAction, { type: 'openArmyFormation' });
    assert.deepEqual(controller.highlight.targetAction, { type: 'openArmyFormation' });
    assert.equal(controller.highlight.source, 'tutorial');
    assert.equal(controller.highlight.transition.durationMs, 260);
    assert.equal(controller.highlight.pulseStartedAt, 1000);
    assert.deepEqual(surface.calls, [['startFloatTimer'], ['renderFrame', 'do the thing']]);

    // An unresolvable target keeps an existing highlight alive.
    assert.equal(controller.show(surface, { width: -1 }, 'x'), true);

    surface.calls.length = 0;
    assert.equal(controller.hide(surface), true);
    assert.equal(controller.highlight, null);
    assert.deepEqual(surface.calls, [['renderActive']]);
    assert.equal(controller.hide(surface), false);
    assert.equal(surface.calls.length, 1);
  });
}

test('refreshTarget re-anchors worldSite locators through the surface world-map renderer', () => {
  const { host, surface } = makeMountedGameHost({ world: true });
  surface.worldMapRenderer = {
    getWorldSiteCanvasAnchor(siteId, state, options) {
      assert.equal(siteId, 'site-1');
      assert.deepEqual(state, { world: true });
      assert.equal(options.territoryUiState.marker, 'shell');
      return {
        hitRect: { x: 5, y: 6, width: 7, height: 8 },
        site: { id: 'site-1' },
        tile: { id: 'tile_9' },
      };
    },
  };
  surface.territoryUiState = { marker: 'shell' };
  const controller = new TutorialGuideUiController({ host });
  const highlight = {
    rect: { left: 0, top: 0, width: 1, height: 1 },
    locator: { type: 'worldSite', siteId: 'site-1' },
    targetAction: { type: 'openWorldSite', siteId: 'site-1' },
    transition: { durationMs: 260 },
  };

  const refreshed = controller.refreshTarget(surface, highlight);
  assert.deepEqual(refreshed.rect, { left: 5, top: 6, width: 7, height: 8, right: 12, bottom: 14 });
  assert.equal(refreshed.targetAction.tileId, 'tile_9');
  // rect changed -> the transition restarts (nulled).
  assert.equal(refreshed.transition, null);

  // non-worldSite locators pass through untouched.
  const plain = { rect: { left: 1, top: 1, width: 1, height: 1 } };
  assert.equal(controller.refreshTarget(surface, plain), plain);

  // a vanished anchor drops the highlight.
  surface.worldMapRenderer.getWorldSiteCanvasAnchor = () => null;
  assert.equal(controller.refreshTarget(surface, highlight), null);
});

test('resolveTutorialRect normalizes rects and rejects degenerate ones', () => {
  const resolve = TutorialGuideUiController.resolveTutorialRect;
  assert.equal(resolve(null), null);
  assert.equal(resolve({ width: 0, height: 5, x: 1, y: 1 }), null);
  assert.deepEqual(resolve({ left: 1, top: 2, width: 3, height: 4 }), {
    left: 1,
    top: 2,
    width: 3,
    height: 4,
    right: 4,
    bottom: 6,
  });
  assert.deepEqual(
    resolve({
      getRect() {
        return { x: 9, y: 8, width: 7, height: 6, right: 16, bottom: 14 };
      },
    }),
    { left: 9, top: 8, width: 7, height: 6, right: 16, bottom: 14 },
  );
});
