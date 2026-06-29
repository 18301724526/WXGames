const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasGameRendererPageFacades = require('./CanvasGameRendererPageFacades');
const CanvasGameRenderer = require('./CanvasGameRenderer');

test('CanvasGameRendererPageFacades installs page rendering facade methods', () => {
  class Renderer {}
  CanvasGameRendererPageFacades.installPageFacades(Renderer);

  const renderer = new Renderer();
  renderer.currentFps = 61;
  renderer.frameNow = 1234;
  renderer.surfaceRenderer = { getNow: () => 9876 };
  renderer.tabBarRenderer = { renderTabs: () => 'tabs' };

  assert.equal(renderer.getNow(), 9876);
  assert.equal(renderer.renderTopBar({}, {}), 84);
  assert.equal(renderer.renderTabs('resources', {}, {}), 'tabs');
  assert.deepEqual(renderer.getWorldMapLayerLayout(), null);
  assert.equal(typeof renderer.renderHomeFeatureGrid, 'undefined');
});

test('CanvasGameRenderer uses installed page facades for child renderer delegation', () => {
  const renderer = new CanvasGameRenderer({
    resourceTopBarRenderer: {
      renderTopBar() {
        return 121;
      },
      renderPopulation() {
        throw new Error('resource top bar renderer must not own population rendering');
      },
    },
    cityPeopleRenderer: {
      renderPopulation(...args) {
        return { owner: 'city-people', args };
      },
    },
    buildingRenderer: {
      resourceIconPath(resource) {
        return `icon:${resource}`;
      },
    },
    frameRenderer: {
      render() {
        return 'frame-rendered';
      },
    },
  });

  assert.equal(typeof renderer.delegateResourceTopBarRenderer, 'undefined');
  assert.equal(typeof renderer.delegateTabBarRenderer, 'undefined');
  assert.equal(renderer.renderTopBar({}, {}), 121);
  assert.deepEqual(renderer.renderPopulation({ id: 'state' }, 200), {
    owner: 'city-people',
    args: [{ id: 'state' }, 200],
  });
  assert.equal(renderer.resourceIconPath('wood'), 'icon:wood');
  assert.equal(renderer.render({}, {}), 'frame-rendered');
});

test('CanvasGameRendererPageFacades exposes frame and HUD renderers without generic method delegates', () => {
  const renderer = new CanvasGameRenderer({
    hudOverlayRenderer: {
      renderHudOverlay(...args) {
        return { owner: 'hud-overlay', args };
      },
    },
    frameRenderer: {
      render(...args) {
        return { owner: 'frame', method: 'render', args };
      },
      renderMapHomeExplorerHud(...args) {
        return { owner: 'frame', method: 'renderMapHomeExplorerHud', args };
      },
      renderCanvasDebugResetButton(...args) {
        return { owner: 'frame', method: 'renderCanvasDebugResetButton', args };
      },
    },
  });

  assert.equal(typeof renderer.delegateHudOverlayRenderer, 'undefined');
  assert.equal(typeof renderer.delegateFrameRenderer, 'undefined');
  assert.equal(renderer.renderHudOverlay({ id: 'state' }, { mode: 'hud' }).owner, 'hud-overlay');
  assert.equal(renderer.render({ id: 'state' }, {}).method, 'render');
  assert.equal(renderer.renderMapHomeExplorerHud({}, 96, {}).method, 'renderMapHomeExplorerHud');
  assert.equal(renderer.renderCanvasDebugResetButton({}).method, 'renderCanvasDebugResetButton');
});

test('CanvasGameRendererPageFacades promotes freshly rendered layer context over stale child map context', () => {
  class Renderer {}
  CanvasGameRendererPageFacades.installPageFacades(Renderer);

  const staleContext = {
    viewport: { originX: 150, originY: 100, panX: 0, panY: 0, scale: 1 },
  };
  const freshContext = {
    viewport: { originX: 150, originY: 100, panX: 48, panY: -24, scale: 1 },
  };
  const renderer = new Renderer();
  renderer.worldMapRenderer = { lastWorldTileMapContext: staleContext };
  renderer.worldMapLayerRenderer = {
    lastWorldTileMapContext: null,
    renderWorldMapSnapshotLayer() {
      this.lastWorldTileMapContext = freshContext;
      return true;
    },
  };

  assert.equal(renderer.renderWorldMapSnapshotLayer({ id: 'state-1' }, { isMapHome: true }), true);
  assert.equal(renderer.lastWorldTileMapContext, freshContext);
});

test('CanvasGameRendererPageFacades loads before CanvasGameRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('CanvasGameRendererPageFacades.js') > -1);
  assert.ok(html.indexOf('CanvasGameRendererCoreFacades.js') < html.indexOf('CanvasGameRendererPageFacades.js'));
  assert.ok(html.indexOf('CanvasGameRendererPageFacades.js') < html.indexOf('CanvasGameRenderer.js'));
  assert.ok(miniGameEntry.indexOf('CanvasGameRendererCoreFacades') < miniGameEntry.indexOf('CanvasGameRendererPageFacades'));
  assert.ok(miniGameEntry.indexOf('CanvasGameRendererPageFacades') < miniGameEntry.indexOf('MiniGameCanvasRenderer'));
});
