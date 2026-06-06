const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasGameApp = require('./CanvasGameApp');

const APP_MODULES = [
  'CanvasGameAppStateSync',
  'CanvasGameAppRenderingRuntime',
  'CanvasGameAppBattleScene',
  'CanvasGameAppCommands',
  'CanvasGameAppGuideUi',
  'CanvasGameAppInputRouter',
];

test('CanvasGameApp installs responsibility modules into the compatibility facade', () => {
  const proto = CanvasGameApp.prototype;
  const expectedMethods = {
    stateSync: ['applyState', 'syncFromServer', 'start', 'stop'],
    renderingRuntime: ['renderCanvasSurface', 'ensureWorldMapRuntime', 'switchTab', 'setTechTreeZoom'],
    battleScene: ['startBattleScene', 'skipBattleScene', 'closeBattleScene'],
    commands: ['buildBuilding', 'advanceEra', 'research', 'enterCity', 'showHouseBuiltAdvisorDialogue'],
    guideUi: ['openNaming', 'closeCityManagement', 'renderSoftGuide', 'cacheRequestLog'],
    inputRouter: ['handleTap', 'handleDrag', 'handleGesture', 'isPointBlockedByTutorialShield'],
  };

  Object.entries(expectedMethods).forEach(([group, methods]) => {
    methods.forEach((method) => {
      assert.equal(typeof proto[method], 'function', `${group}.${method} should be installed`);
    });
  });
});

test('html and minigame entries load CanvasGameApp modules before the facade', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  const facadeHtmlPosition = html.indexOf('CanvasGameApp.js');
  const facadeMinigamePosition = minigame.indexOf("require('../js/platform/CanvasGameApp')");
  assert.notEqual(facadeHtmlPosition, -1);
  assert.notEqual(facadeMinigamePosition, -1);

  APP_MODULES.forEach((moduleName) => {
    const htmlPosition = html.indexOf(`${moduleName}.js`);
    const minigamePosition = minigame.indexOf(`require('../js/platform/${moduleName}')`);
    assert.notEqual(htmlPosition, -1, `${moduleName}.js should be loaded by index.html`);
    assert.notEqual(minigamePosition, -1, `${moduleName} should be required by minigame/game.js`);
    assert.equal(htmlPosition < facadeHtmlPosition, true, `${moduleName}.js should load before CanvasGameApp.js`);
    assert.equal(minigamePosition < facadeMinigamePosition, true, `${moduleName} should require before CanvasGameApp`);
  });
});
