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
  renderer.delegateSurfaceRenderer = (method) => (method === 'getNow' ? 9876 : undefined);
  renderer.delegateHomeRenderer = () => undefined;
  renderer.delegateTabBarRenderer = () => 'tabs';

  assert.equal(renderer.getNow(), 9876);
  assert.equal(renderer.renderTopBar({}, {}), 84);
  assert.equal(renderer.renderTabs('resources', {}, {}), 'tabs');
  assert.deepEqual(renderer.getWorldMapLayerLayout(), null);
});

test('CanvasGameRenderer uses installed page facades for child renderer delegation', () => {
  const renderer = new CanvasGameRenderer({
    homeRenderer: {
      renderTopBar() {
        return 121;
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

  assert.equal(renderer.renderTopBar({}, {}), 121);
  assert.equal(renderer.resourceIconPath('wood'), 'icon:wood');
  assert.equal(renderer.render({}, {}), 'frame-rendered');
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
