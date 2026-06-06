const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BattleCanvasModel = require('./BattleCanvasModel');
const BattleCanvasRenderer = require('./BattleCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

test('BattleCanvasRenderer owns battle playback and unit frame helpers', () => {
  const renderer = new BattleCanvasRenderer({ host: { width: 390, height: 844 } });

  assert.deepEqual(renderer.getBattlePlaybackPhase(0.1, null), { phase: 'ended', phaseProgress: 1 });
  assert.equal(renderer.getBattlePlaybackPhase(0.2, { action: 'attack' }).phase, 'move');
  assert.equal(renderer.getBattlePlaybackPhase(0.72, { action: 'skill' }).phase, 'prepare');
  assert.equal(renderer.getBattleUnitPose('attacker', { actor: 'attacker', target: 'defender' }, 'impact'), 'attack');
  assert.equal(renderer.getBattleTurnSoldierCount({ soldiersAfter: { defender: 3 } }, 'defender'), 3);
  assert.equal(
    renderer.getBattleFrameSpritePath('defender', 'attack', 99, '', 0.6),
    'assets/art/battle/units/enemy/attack/03.png',
  );
});

test('BattleCanvasModel owns battle layout and damage contracts', () => {
  const layout = BattleCanvasModel.getBattleSceneLayout(390, 844);

  assert.deepEqual(
    Object.keys(layout).filter((key) => key.endsWith('Area')),
    ['attackerArea', 'defenderArea'],
  );
  assert.equal(layout.attackerArea.x, 18);
  assert.equal(layout.defenderArea.x, 390 - layout.defenderArea.width - 18);
  assert.equal(BattleCanvasModel.getBattleTurnDamage({
    target: 'defender',
    soldiersBefore: { defender: 12 },
    soldiersAfter: { defender: 7 },
  }), 5);
  assert.equal(BattleCanvasModel.getBattleDamageFloatText({ action: 'skill', damage: 9, damageLabel: 'Burn' }), 'Burn -9');
});

test('BattleCanvasRenderer keeps extracted helper facade compatible', () => {
  const renderer = new BattleCanvasRenderer({ host: { width: 390, height: 844 } });
  const area = { x: 18, y: 254, width: 160, height: 320 };

  assert.deepEqual(renderer.getBattleScenePlayback({ turnDurationMs: 1000, turnStartedAt: 500, report: { turns: [] } }, 1000).playback, {
    phase: 'ended',
    phaseProgress: 1,
  });
  assert.equal(renderer.getBattleUnitEngagementPosition('attacker', area, 0, 4).x < 195, true);
  assert.equal(renderer.getBattleUnitBattlefieldPosition('defender', area, 1, 4, 0.21, 0).ratio, 0);
});

test('CanvasGameRenderer exposes battle helpers through the battle renderer facade', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    battleRendererClass: BattleCanvasRenderer,
  });

  assert.equal(renderer.getBattleUnitPose('attacker', { actor: 'attacker' }, 'impact'), 'attack');
  assert.equal(renderer.getBattleTurnDamage({
    target: 'defender',
    soldiersBefore: { defender: 10 },
    soldiersAfter: { defender: 4 },
  }), 6);
  assert.equal(renderer.getBattleFrameSpritePath('attacker', 'move', 1), 'assets/art/battle/units/player/move/02.png');
});

test('BattleCanvasRenderer render overlay keeps battle hit target contract', () => {
  const calls = [];
  const hitTargets = [];
  const host = {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, drawImage() {}, globalAlpha: 1 },
    presenter: {
      buildBattleSceneViewState() {
        return {
          visible: true,
          title: 'Battle',
          resultText: 'Fighting',
          turnIndex: 0,
          turnCount: 1,
          ended: false,
          activeTurn: { actor: 'attacker', target: 'defender', action: 'attack' },
          map: {},
          attacker: { side: 'attacker', soldiers: 10, soldiersStart: 10, groups: [{ ratio: 1 }], statuses: [] },
          defender: { side: 'defender', soldiers: 8, soldiersStart: 8, groups: [{ ratio: 1 }], statuses: [] },
          logLines: ['attack'],
        };
      },
    },
    getNow() { return 1000; },
    setHitTargets(targets) { hitTargets.length = 0; hitTargets.push(...targets); },
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    drawCoverAsset() { calls.push('drawCoverAsset'); return false; },
    drawPanel() {},
    drawText() {},
    drawButton() {},
    drawCircle() {},
    drawFamousPortrait() { return false; },
    getAsset() { return null; },
    truncateText(text) { return String(text || ''); },
    measureTextWidth(text) { return String(text || '').length * 8; },
  };
  const renderer = new BattleCanvasRenderer({ host });

  assert.equal(renderer.render({}, {
    battleScene: {
      report: { turns: [{ actor: 'attacker', target: 'defender', action: 'attack' }] },
      turnIndex: 0,
      turnDurationMs: 1000,
      turnStartedAt: 500,
    },
  }), undefined);

  assert.equal(calls.includes('drawCoverAsset'), true);
  assert.equal(hitTargets.some((target) => target.action.type === 'closeBattleScene'), true);
  assert.equal(hitTargets.some((target) => target.action.type === 'skipBattleScene'), true);
});

test('frontend html loads battle helpers before the renderer', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
  const modelIndex = html.indexOf('BattleCanvasModel.js');
  const floatingIndex = html.indexOf('BattleFloatingTextRenderer.js');
  const effectsIndex = html.indexOf('BattleEffectRenderer.js');
  const rendererIndex = html.indexOf('BattleCanvasRenderer.js');

  assert.equal(modelIndex >= 0, true);
  assert.equal(floatingIndex > modelIndex, true);
  assert.equal(effectsIndex > floatingIndex, true);
  assert.equal(rendererIndex > effectsIndex, true);
  assert.match(html, /BattleCanvasRenderer\.js\?v=architecture-refactor-battle-renderer-v2/);
});
