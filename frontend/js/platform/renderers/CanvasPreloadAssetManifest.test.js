const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasPreloadAssetManifest = require('./CanvasPreloadAssetManifest');
const CanvasGameRenderer = require('../CanvasGameRenderer');

test('CanvasPreloadAssetManifest exposes stable base preload asset keys', () => {
  const keys = CanvasPreloadAssetManifest.getBasePreloadAssetKeys();

  assert.equal(keys.includes('background:civilization'), true);
  assert.equal(keys.includes('ui:icon:home'), true);
  assert.equal(keys.includes('ui-hud:icon:capital'), true);
  assert.equal(keys.includes('ui-hud:icon:account'), true);
  assert.equal(keys.includes('ui-hud:resource:food'), true);
  assert.equal(keys.includes('world-site:city'), true);
  assert.equal(keys.includes('battle:background:forest-camp'), true);

  keys.push('mutated:key');
  assert.equal(CanvasPreloadAssetManifest.getBasePreloadAssetKeys().includes('mutated:key'), false);
});

test('CanvasPreloadAssetManifest preserves base preload assets', () => {
  const base = CanvasPreloadAssetManifest.getBasePreloadAssetPaths();

  assert.equal(base.includes('assets/art/civilization-bg.webp'), true);
  assert.equal(base.includes('assets/art/icon-home-cutout.png'), true);
  assert.equal(base.includes('assets/art/ui-hud/hud-icon-capital.png'), true);
  assert.equal(base.includes('assets/art/ui-hud/hud-icon-account.png'), true);
  assert.equal(base.includes('assets/art/ui-hud/hud-resource-food.png'), true);
  assert.equal(base.includes('assets/art/world-site-city-cutout.png'), true);
  assert.equal(base.includes('assets/art/spine/tutorial/advisor/tutorial_advisor.png'), true);
  assert.equal(base.includes('assets/art/battle/battlefield-forest-camp.png'), true);
  assert.equal(base.includes('assets/art/units/spearman/move/001.png'), true);
  assert.equal(base.includes('assets/art/units/spearman/move/011.png'), true);
  assert.equal(new Set(base).size, base.length);

  base.push('mutated.png');
  assert.equal(CanvasPreloadAssetManifest.getBasePreloadAssetPaths().includes('mutated.png'), false);
});

test('CanvasPreloadAssetManifest exposes immutable tutorial march frame paths', () => {
  const frames = CanvasPreloadAssetManifest.getTutorialMarchUnitFramePaths();

  assert.equal(frames.length, 11);
  assert.equal(frames[0], 'assets/art/units/spearman/move/001.png');
  assert.equal(frames[10], 'assets/art/units/spearman/move/011.png');

  frames.length = 0;
  assert.equal(CanvasPreloadAssetManifest.getTutorialMarchUnitFramePaths().length, 11);
});

test('CanvasPreloadAssetManifest exposes scout squad frame paths separately', () => {
  const frames = CanvasPreloadAssetManifest.getWorldScoutUnitFramePaths();

  assert.equal(frames.length, 11);
  assert.equal(frames[0], 'assets/art/units/spearman/move/001.png');
  frames.length = 0;
  assert.equal(CanvasPreloadAssetManifest.getWorldScoutUnitFramePaths().length, 11);
});

test('CanvasPreloadAssetManifest composes tile map, battle frame, and famous portrait paths', () => {
  class StubRendererClass {
    static getBattleUnitFramePaths() {
      return ['battle-a.png', 'battle-b.png'];
    }
  }

  const paths = CanvasPreloadAssetManifest.getPreloadAssetPaths({
    rendererClass: StubRendererClass,
    tileMapManifest: {
      getPreloadAssetPaths() {
        return ['tile-a.png', 'tile-b.png'];
      },
    },
    famousPortraitLayout: {
      layers: {
        face: { file: 'face.png' },
        missing: {},
        hair: { file: 'hair.webp' },
      },
    },
  });

  assert.equal(paths.includes('assets/art/icon-food-cutout.webp'), true);
  assert.equal(paths.includes('assets/art/ui-hud/hud-icon-tasks.png'), true);
  assert.equal(paths.includes('tile-a.png'), true);
  assert.equal(paths.includes('battle-b.png'), true);
  assert.equal(paths.includes('assets/art/famous-person/layers/face.png'), true);
  assert.equal(paths.includes('assets/art/famous-person/layers/hair.webp'), true);
});

test('CanvasGameRenderer keeps preload asset path facade compatible', () => {
  const paths = CanvasGameRenderer.getPreloadAssetPaths();

  assert.equal(paths.includes('assets/art/icon-fire-cutout.webp'), true);
  assert.equal(paths.includes('assets/art/ui-hud/hud-icon-signal.png'), true);
  assert.equal(paths.includes('assets/art/battle/battlefield-forest-camp.png'), true);
  assert.equal(paths.includes(CanvasGameRenderer.getBattleUnitFramePath('player', 'idle', 0)), true);
});
