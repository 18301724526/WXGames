const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BattleCanvasModel = require('./BattleCanvasModel');
const BattleCanvasRenderer = require('./BattleCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

const BATTLE_DRAWING_METHODS = [
  'addHitTarget',
  'drawButton',
  'drawCircle',
  'drawCoverAsset',
  'drawFamousPortrait',
  'drawPanel',
  'drawText',
  'getAsset',
  'getNow',
  'measureTextWidth',
  'setHitTargets',
  'truncateText',
];

function createBattleSceneView() {
  return {
    visible: true,
    title: 'Battle',
    resultText: 'Fighting',
    turnIndex: 0,
    turnCount: 1,
    ended: false,
    activeTurn: { actor: 'attacker', target: 'defender', action: 'attack' },
    map: {},
    attacker: {
      side: 'attacker',
      name: 'Ada',
      leaderName: 'Ada',
      soldiers: 10,
      soldiersStart: 10,
      groups: [{ ratio: 1 }],
      statuses: [{ label: 'Ready', tone: 'buff' }],
    },
    defender: {
      side: 'defender',
      name: 'Enemy',
      leaderName: 'Enemy',
      soldiers: 8,
      soldiersStart: 8,
      groups: [{ ratio: 1 }],
      statuses: [{ label: 'Guard', tone: 'neutral' }],
    },
    logLines: ['attack'],
  };
}

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, drawImage() {}, globalAlpha: 1 },
    presenter: {
      buildBattleSceneViewState() {
        return createBattleSceneView();
      },
    },
    addHitTarget(_rect, action) {
      calls.push([label, 'addHitTarget', action?.type]);
    },
    drawButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawButton', buttonLabel]);
    },
    drawCircle() {
      calls.push([label, 'drawCircle']);
    },
    drawCoverAsset(assetPath) {
      calls.push([label, 'drawCoverAsset', assetPath]);
      return false;
    },
    drawFamousPortrait() {
      calls.push([label, 'drawFamousPortrait']);
      return false;
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawText(text) {
      calls.push([label, 'drawText', text]);
    },
    getAsset(assetPath) {
      calls.push([label, 'getAsset', assetPath]);
      return null;
    },
    getNow() {
      calls.push([label, 'getNow']);
      return 1000;
    },
    measureTextWidth(text) {
      calls.push([label, 'measureTextWidth', text]);
      return String(text || '').length * 8;
    },
    setHitTargets(targets = []) {
      calls.push([label, 'setHitTargets', targets.length]);
    },
    truncateText(text) {
      calls.push([label, 'truncateText', text]);
      return String(text || '');
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

function renderBattleSentinelPath(renderer, fallbackHost) {
  fallbackHost.presenter = createDrawingSurfaceSentinel('presenter').presenter;
  renderer.render({}, {
    battleScene: {
      report: { turns: [{ actor: 'attacker', target: 'defender', action: 'attack' }] },
      turnIndex: 0,
      turnDurationMs: 1000,
      turnStartedAt: 500,
    },
  });
}

test('BattleCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new BattleCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderBattleSentinelPath(renderer, fallbackHost);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), BATTLE_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('BattleCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new BattleCanvasRenderer({ host: fallbackHost });

  renderBattleSentinelPath(renderer, fallbackHost);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), BATTLE_DRAWING_METHODS);
});

test('BattleCanvasRenderer reads dynamic host state through explicit getters', () => {
  const firstCtx = { fillRect() {}, drawImage() {}, globalAlpha: 1 };
  const secondCtx = { fillRect() {}, drawImage() {}, globalAlpha: 1 };
  const firstPresenter = createDrawingSurfaceSentinel('first').presenter;
  const secondPresenter = createDrawingSurfaceSentinel('second').presenter;
  const host = {
    width: 390,
    height: 844,
    ctx: firstCtx,
    presenter: firstPresenter,
  };
  const renderer = new BattleCanvasRenderer({ host });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.ctx, firstCtx);
  assert.equal(renderer.presenter, firstPresenter);

  host.width = 512;
  host.height = 900;
  host.ctx = secondCtx;
  host.presenter = secondPresenter;

  assert.equal(renderer.width, 512);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.ctx, secondCtx);
  assert.equal(renderer.presenter, secondPresenter);
});

test('BattleCanvasRenderer does not proxy unknown host properties', () => {
  const host = {
    width: 390,
    height: 844,
    someRandomProp: 'host-only',
  };
  const renderer = new BattleCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

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

test('BattleCanvasRenderer owns battle helper methods directly', () => {
  const renderer = new BattleCanvasRenderer({ host: { width: 390, height: 844 } });
  const area = { x: 18, y: 254, width: 160, height: 320 };

  assert.deepEqual(renderer.getBattleScenePlayback({ turnDurationMs: 1000, turnStartedAt: 500, report: { turns: [] } }, 1000).playback, {
    phase: 'ended',
    phaseProgress: 1,
  });
  assert.equal(renderer.getBattleUnitEngagementPosition('attacker', area, 0, 4).x < 195, true);
  assert.equal(renderer.getBattleUnitBattlefieldPosition('defender', area, 1, 4, 0.21, 0).ratio, 0);
  assert.equal(BattleCanvasRenderer.prototype.hasOwnProperty('getBattleScenePlayback'), true);
  assert.equal(BattleCanvasRenderer.prototype.hasOwnProperty('drawBattleArmy'), true);
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

function makeEntityRendererHost() {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: {
      fillRect() {}, drawImage() {}, save() {}, restore() {}, translate() {}, scale() {},
      beginPath() {}, rect() {}, clip() {},
      clearRect() {}, globalAlpha: 1,
    },
    getNow() { return 1000; },
    setHitTargets(targets) { hitTargets.length = 0; hitTargets.push(...targets); },
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    drawCoverAsset() { calls.push('drawCoverAsset'); return false; },
    drawPanel() {},
    drawText() {},
    drawButton() {},
    getAsset() { return null; },
    truncateText(text) { return String(text || ''); },
    measureTextWidth(text) { return String(text || '').length * 8; },
  };
  return { host, hitTargets, calls };
}

test('renderEntityBattleOverlay keeps entity background and units in the same battle camera context', () => {
  const prevCore = globalThis.BattleSimCore;
  globalThis.BattleSimCore = { countOnField() { return [1, 0]; }, skillReady() { return false; } };
  try {
    const coverCalls = [];
    const fillRects = [];
    const clips = [];
    const host = {
      width: 390,
      height: 844,
      ctx: {
        fillStyle: '',
        globalAlpha: 1,
        fillRect(x, y, width, height) { fillRects.push({ x, y, width, height }); },
        drawImage() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
        beginPath() {},
        rect(x, y, width, height) { clips.push({ x, y, width, height }); },
        clip() {},
      },
      getNow() { return 1000; },
      setHitTargets() {},
      addHitTarget() {},
      drawCoverAsset(assetPath, x, y, width, height) {
        coverCalls.push({ assetPath, x, y, width, height });
        return true;
      },
      drawPanel() {},
      drawText() {},
      drawButton() {},
      getAsset() { return null; },
      truncateText(text) { return String(text || ''); },
      measureTextWidth(text) { return String(text || '').length * 8; },
    };
    const renderer = new BattleCanvasRenderer({ host });
    const unit = { id: 1, side: 0, kind: 'soldier', alive: true, x: 30, y: 40, state: 'advance' };
    const battle = {
      tick: 5,
      result: null,
      config: { tickHz: 20 },
      squads: { A: { side: 0, generalId: 1, orderCdLeft: 0 } },
      units: [unit],
    };
    renderer.renderEntityBattleOverlay({}, {
      entityBattle: {
        visible: true,
        mode: 'interactive',
        battle,
        arena: { w: 100, h: 100 },
        camera: { zoom: 2, offsetX: 10, offsetY: -20 },
        selectedGid: 'A',
        _rstate: {},
      },
    });

    const background = coverCalls.find((call) => call.assetPath.includes('battlefield-forest-camp'));
    assert.ok(background);
    const unitMarker = fillRects.find((rect) => rect.width === 3 && rect.height === 3);
    assert.ok(unitMarker);
    const unitScreenX = unitMarker.x + 1.5;
    const unitScreenY = unitMarker.y + 1.5;
    const bgScaleX = background.width / 100;
    const bgScaleY = background.height / 100;

    assert.equal(Math.round((unitScreenX - background.x) / bgScaleX), unit.x);
    assert.equal(Math.round((unitScreenY - background.y) / bgScaleY), unit.y);
    assert.deepEqual(clips[0], { x: 0, y: 30, width: 390, height: 554 });
  } finally {
    globalThis.BattleSimCore = prevCore;
  }
});

test('renderEntityBattleOverlay draws interactive 军令 controls as canvas hit targets', () => {
  const prevCore = globalThis.BattleSimCore;
  globalThis.BattleSimCore = { countOnField() { return [3, 2]; }, skillReady() { return true; } };
  try {
    const { host, hitTargets, calls } = makeEntityRendererHost();
    const renderer = new BattleCanvasRenderer({ host });
    const general = {
      id: 1, side: 0, kind: 'general', alive: true, x: 10, y: 10, state: 'advance',
      rage: 0, skillCds: [0], skills: [{ id: 's1', name: '冲锋', kind: 'active' }],
    };
    const battle = {
      tick: 5, result: null, config: { tickHz: 20, rageMax: 100 }, masterUsed: { 0: {} },
      squads: { A: { side: 0, generalId: 1, orderCdLeft: 0 } },
      units: [{ id: 0, side: 1, alive: false }, general],
    };
    renderer.renderEntityBattleOverlay({}, {
      entityBattle: {
        visible: true, mode: 'interactive', battle, tickHz: 20, selectedGid: 'A',
        arena: { w: 100, h: 100 }, _rstate: {},
      },
    });
    assert.equal(calls.includes('drawCoverAsset'), true);
    assert.equal(hitTargets.some((t) => t.action.type === 'entityBattleSelectGeneral'), true);
    assert.equal(hitTargets.some((t) => t.action.type === 'entityBattleOrder'), true);
    assert.equal(hitTargets.some((t) => t.action.type === 'entityBattleMaster'), true);
    assert.equal(hitTargets.some((t) => t.action.type === 'entityBattleSkill'), true);
    assert.equal(hitTargets.some((t) => t.action.type === 'entityBattleAuto'), true);
  } finally {
    globalThis.BattleSimCore = prevCore;
  }
});

test('renderEntityBattleOverlay replay mode exposes a close hit target', () => {
  const prevCore = globalThis.BattleSimCore;
  globalThis.BattleSimCore = { countOnField() { return [0, 0]; }, skillReady() { return false; } };
  try {
    const { host, hitTargets } = makeEntityRendererHost();
    const renderer = new BattleCanvasRenderer({ host });
    const battle = {
      tick: 9, result: { winner: 'attacker' }, config: { tickHz: 20 },
      squads: { A: { side: 0, generalId: 1 } }, units: [],
    };
    renderer.renderEntityBattleOverlay({}, {
      entityBattle: {
        visible: true, mode: 'replay', battle, tickHz: 20,
        report: { summary: '胜利' }, arena: { w: 100, h: 100 }, _rstate: {},
      },
    });
    assert.equal(hitTargets.some((t) => t.action.type === 'entityBattleClose'), true);
  } finally {
    globalThis.BattleSimCore = prevCore;
  }
});

test('frontend html loads battle model render helpers before the renderer', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
  const modelIndex = html.indexOf('BattleCanvasModel.js');
  const floatingIndex = html.indexOf('BattleFloatingTextRenderer.js');
  const effectsIndex = html.indexOf('BattleEffectRenderer.js');
  const rendererIndex = html.indexOf('BattleCanvasRenderer.js');

  assert.equal(modelIndex >= 0, true);
  assert.equal(floatingIndex > modelIndex, true);
  assert.equal(effectsIndex > floatingIndex, true);
  assert.equal(rendererIndex > effectsIndex, true);
  assert.equal(html.includes('BattleLayoutModel.js'), false);
  assert.equal(html.includes('BattleSpriteRenderer.js'), false);
  assert.match(html, /BattleCanvasRenderer\.js\?v=entity-battle-render-context-v1/);
});

test('retired battle prototype modules stay deleted', () => {
  [
    'BattleLayoutModel.js',
    'BattleSpriteRenderer.js',
  ].forEach((fileName) => {
    assert.equal(fs.existsSync(path.resolve(__dirname, fileName)), false);
  });
});
