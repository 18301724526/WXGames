const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameRenderer = require('../CanvasGameRenderer');
const {
  BATTLE_FACADE_METHODS,
  installBattleFacade,
} = require('./CanvasBattleFacade');

test('CanvasBattleFacade installs every battle compatibility method', () => {
  class Host {}
  installBattleFacade(Host);

  const retiredGenericDelegate = ['delegate', 'Battle', 'Renderer'].join('');
  assert.equal(typeof Host.prototype[retiredGenericDelegate], 'undefined');
  Object.keys(BATTLE_FACADE_METHODS).forEach((method) => {
    assert.equal(typeof Host.prototype[method], 'function', `${method} should be installed`);
  });
});

test('CanvasBattleFacade delegates calls with original arguments', () => {
  class Host {}
  installBattleFacade(Host);
  const calls = [];
  const host = new Host();
  host.battleRenderer = {
    getBattleUnitPose(...args) {
      calls.push(['getBattleUnitPose', args]);
      return 'attack';
    },
    renderBattleSceneOverlay(...args) {
      calls.push(['renderBattleSceneOverlay', args]);
      return true;
    },
  };
  const turn = { actor: 'attacker', target: 'defender' };
  const options = { battleScene: { visible: true } };

  assert.equal(host.getBattleUnitPose('attacker', turn, 'impact'), 'attack');
  assert.equal(host.renderBattleSceneOverlay({ battle: {} }, options), true);
  assert.deepEqual(calls, [
    ['getBattleUnitPose', ['attacker', turn, 'impact']],
    ['renderBattleSceneOverlay', [{ battle: {} }, options]],
  ]);
});

test('CanvasBattleFacade keeps object fallbacks isolated and host-aware', () => {
  class Host {
    static getBattleUnitFrameCount() {
      return 6;
    }

    static getBattleUnitFramePath(unit, pose, frameIndex) {
      return `custom/${unit}/${pose}/${frameIndex}.png`;
    }
  }
  installBattleFacade(Host);
  const host = new Host();
  host.battleRenderer = {};

  const phase = host.getBattlePlaybackPhase();
  phase.phase = 'mutated';
  assert.deepEqual(host.getBattlePlaybackPhase(), { phase: 'ended', phaseProgress: 1 });

  const position = host.getBattleUnitBattlefieldPosition();
  position.formation.x = 99;
  assert.deepEqual(host.getBattleUnitBattlefieldPosition(), { x: 0, y: 0, formation: {}, engaged: {}, ratio: 1 });

  assert.deepEqual(host.getBattleUnitSpec(), {
    unit: 'player',
    root: 'assets/art/battle/units/player',
    frameCount: 6,
    width: 500,
    height: 400,
  });
  assert.equal(host.getBattleFrameSpritePath(), 'custom/player/idle/0.png');
  assert.equal(host.getBattleTurnSoldierCount(null, null, null, 12), 12);
  assert.equal(host.drawBattleSoldierFrame(), false);
});

test('CanvasGameRenderer exposes battle facade through the extracted installer', () => {
  const calls = [];
  const battleRenderer = {
    getBattleTurnDamage(...args) {
      calls.push(['getBattleTurnDamage', args]);
      return 8;
    },
    getBattleFrameSpritePath(...args) {
      calls.push(['getBattleFrameSpritePath', args]);
      return 'assets/art/battle/units/player/attack/02.png';
    },
  };
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    battleRenderer,
  });
  const turn = { target: 'defender' };

  assert.equal(renderer.getBattleTurnDamage(turn), 8);
  assert.equal(renderer.getBattleFrameSpritePath('attacker', 'attack', 1), 'assets/art/battle/units/player/attack/02.png');
  assert.deepEqual(calls, [
    ['getBattleTurnDamage', [turn]],
    ['getBattleFrameSpritePath', ['attacker', 'attack', 1]],
  ]);
});
