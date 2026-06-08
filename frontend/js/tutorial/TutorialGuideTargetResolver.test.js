const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialGuideTargetResolver = require('./TutorialGuideTargetResolver');

test('TutorialGuideTargetResolver retries target lookup after render and shows highlight', () => {
  const calls = [];
  let rendered = false;
  const shell = {
    getCanvasTarget(type, predicate) {
      calls.push(['getCanvasTarget', type]);
      if (!rendered) return null;
      const action = { type: 'buildBuilding', buildingId: 'house' };
      if (predicate && !predicate(action)) return null;
      return { x: 10, y: 20, width: 100, height: 30 };
    },
    showTutorialHighlight(target, message, options) {
      calls.push(['showTutorialHighlight', message, options]);
      return true;
    },
  };
  const host = {
    game: {
      state: { currentTab: 'buildings' },
      canvasShell: shell,
      renderCanvasSurface(tab) {
        calls.push(['renderCanvasSurface', tab]);
        rendered = true;
      },
    },
  };
  const resolver = new TutorialGuideTargetResolver({ host });

  assert.equal(resolver.showHighlight(
    'buildBuilding',
    (action) => action.buildingId === 'house',
    'build a house',
    { type: 'buildBuilding', buildingId: 'house' },
  ), true);
  assert.deepEqual(calls.map((call) => call[0]), [
    'getCanvasTarget',
    'renderCanvasSurface',
    'getCanvasTarget',
    'showTutorialHighlight',
  ]);
  assert.equal(calls.at(-1)[2].allowedAction.buildingId, 'house');
  assert.equal(host.retryingHighlightAfterRender, false);
});

test('TutorialGuideTargetResolver hides stale highlight when target is unavailable', () => {
  const calls = [];
  const resolver = new TutorialGuideTargetResolver({
    host: {
      game: {
        canvasShell: {
          getCanvasTarget() {
            return null;
          },
          hideTutorialHighlight() {
            calls.push('hideTutorialHighlight');
          },
        },
      },
    },
  });

  assert.equal(resolver.showHighlight('missing', null, 'missing', { type: 'missing' }), false);
  assert.deepEqual(calls, ['hideTutorialHighlight']);
});

test('TutorialGuideTargetResolver normalizes rects and checks viewport visibility', () => {
  const resolver = new TutorialGuideTargetResolver({
    host: {
      game: {
        canvasShell: {
          runtime: { width: 200, height: 100 },
        },
      },
    },
  });

  assert.deepEqual(resolver.getCanvasTargetRect({ x: 10, y: 20, width: 30, height: 40 }), {
    left: 10,
    top: 20,
    width: 30,
    height: 40,
    right: 40,
    bottom: 60,
  });
  assert.equal(resolver.isCanvasTargetVisible({ x: 10, y: 20, width: 30, height: 40 }), true);
  assert.equal(resolver.isCanvasTargetVisible({ x: -30, y: 20, width: 20, height: 40 }), false);
  assert.equal(resolver.getCanvasTargetRect({ x: 10, y: 20, width: 0, height: 40 }), null);
});

test('TutorialGuideTargetResolver shows open-world-site highlight only for visible matching targets', () => {
  const calls = [];
  const shell = {
    runtime: { width: 320, height: 240 },
    getCanvasTarget(type, predicate) {
      const action = { type: 'openWorldSite', siteId: 'city-1' };
      if (type !== 'openWorldSite' || !predicate(action)) return null;
      return { x: 100, y: 80, width: 40, height: 40 };
    },
    showTutorialHighlight(target, message, options) {
      calls.push({ target, message, options });
      return true;
    },
  };
  const resolver = new TutorialGuideTargetResolver({
    host: { game: { canvasShell: shell } },
  });

  assert.equal(resolver.showOpenWorldSiteHighlight({
    siteId: 'city-1',
    message: 'open city',
  }), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options.allowedAction, { type: 'openWorldSite', siteId: 'city-1' });
});
