const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasGameRendererCoreFacades = require('./CanvasGameRendererCoreFacades');
const CanvasGameRenderer = require('./CanvasGameRenderer');

test('CanvasGameRendererCoreFacades installs surface and asset facade methods', () => {
  class Renderer {}
  CanvasGameRendererCoreFacades.installCoreFacades(Renderer);

  const renderer = new Renderer();
  renderer.width = 390;
  renderer.maxContentWidth = 480;
  renderer.edgePadding = 12;
  renderer.hitTargets = [];
  renderer.suppressHitTargets = false;

  assert.deepEqual(renderer.getLayout(), { contentX: 12, contentWidth: 366, contentRight: 378 });
  renderer.addHitTarget({ x: 1, y: 2, width: 3, height: 4 }, { type: 'tap' });
  assert.deepEqual(renderer.hitTargets, [{ x: 1, y: 2, width: 3, height: 4, action: { type: 'tap' } }]);
  assert.equal(renderer.getAsset('missing'), null);
});

test('CanvasGameRendererCoreFacades delegates before using compatibility fallbacks', () => {
  const renderer = new CanvasGameRenderer({
    surfaceRenderer: {
      getLayout() {
        return { contentX: 5, contentWidth: 10, contentRight: 15 };
      },
    },
    worldTileWaterRenderer: {
      positiveModulo(value, size) {
        return `mod:${value}:${size}`;
      },
    },
    famousRenderer: {
      renderFamousRosterGrid() {
        return { nextY: 99 };
      },
    },
  });

  assert.deepEqual(renderer.getLayout(), { contentX: 5, contentWidth: 10, contentRight: 15 });
  assert.equal(renderer.positiveModulo(-1, 3), 'mod:-1:3');
  assert.deepEqual(renderer.renderFamousRosterGrid({}, 0, 0), { nextY: 99 });
});

test('CanvasGameRendererCoreFacades invalidates world tile view cache when explorer state signature changes', () => {
  let buildCount = 0;
  const territoryState = {
    worldMap: { version: 1, tiles: [] },
    territories: [{ id: 'capital', x: 0, y: 0 }],
  };
  const renderer = new CanvasGameRenderer({
    presenter: {
      getWorldTileMapSignature(sourceTerritory, worldExplorerState) {
        return `explorer:${sourceTerritory.worldMap.version}:${worldExplorerState.version || 0}`;
      },
      buildWorldTileMapViewState(sourceTerritory, options = {}) {
        buildCount += 1;
        return {
          signature: `explorer:${sourceTerritory.worldMap.version}:${options.worldExplorerState.version || 0}`,
          pan: { x: options.panX, y: options.panY },
          tiles: [
            { id: 'tile_0_0', site: { id: 'capital' } },
            ...(options.worldExplorerState.version >= 2
              ? [{ id: 'tile_2_2', site: { id: 'site_2_2' } }]
              : []),
          ],
          sites: [
            { id: 'capital' },
            ...(options.worldExplorerState.version >= 2 ? [{ id: 'site_2_2' }] : []),
          ],
        };
      },
    },
  });

  const firstView = renderer.resolveWorldTileMapView(
    territoryState,
    { worldPanX: 4, worldPanY: 8 },
    { reuseCachedWorldTileView: true, worldExplorerState: { version: 1 } },
  );
  const reusedView = renderer.resolveWorldTileMapView(
    territoryState,
    { worldPanX: 12, worldPanY: 16 },
    { reuseCachedWorldTileView: true, worldExplorerState: { version: 1 } },
  );
  const rebuiltView = renderer.resolveWorldTileMapView(
    territoryState,
    { worldPanX: 20, worldPanY: 24 },
    { reuseCachedWorldTileView: true, worldExplorerState: { version: 2 } },
  );

  assert.equal(buildCount, 2);
  assert.equal(firstView, reusedView);
  assert.deepEqual(reusedView.pan, { x: 12, y: 16 });
  assert.notEqual(rebuiltView, firstView);
  assert.deepEqual(rebuiltView.pan, { x: 20, y: 24 });
  assert.deepEqual(rebuiltView.sites.map((site) => site.id), ['capital', 'site_2_2']);
});

test('CanvasGameRendererCoreFacades loads before CanvasGameRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('CanvasGameRendererCoreFacades.js') > -1);
  assert.ok(html.indexOf('CanvasGameRendererCompositionFactory.js') < html.indexOf('CanvasGameRendererCoreFacades.js'));
  assert.ok(html.indexOf('CanvasGameRendererCoreFacades.js') < html.indexOf('CanvasGameRenderer.js'));
  assert.ok(miniGameEntry.indexOf('CanvasGameRendererCompositionFactory') < miniGameEntry.indexOf('CanvasGameRendererCoreFacades'));
  assert.ok(miniGameEntry.indexOf('CanvasGameRendererCoreFacades') < miniGameEntry.indexOf('MiniGameCanvasRenderer'));
});
