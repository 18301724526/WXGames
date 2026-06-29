const test = require('node:test');
const assert = require('node:assert/strict');

const BattleOwner = require('./BattleOwner');

test('BattleOwner opens, updates, and closes battleScene snapshots', () => {
  let owner = BattleOwner.createBattleOwner();
  owner = BattleOwner.openBattleScene(owner, {
    visible: true,
    report: { id: 'report-1', turns: [{ action: 'attack', ignored: undefined }] },
    turnIndex: 0,
    startedAt: 10,
    turnStartedAt: 11,
    turnDurationMs: 900,
  });

  assert.equal(owner.schema, 'battle-owner-v1');
  assert.equal(Object.isFrozen(owner), true);
  assert.equal(Object.isFrozen(owner.battleScene), true);
  assert.equal(owner.activeOverlay, 'battleScene');
  assert.deepEqual(owner.battleScene.report, {
    id: 'report-1',
    turns: [{ action: 'attack' }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(owner)).schema, 'battle-owner-v1');

  owner = BattleOwner.updateBattleScene(owner, { turnIndex: 1, turnStartedAt: 25 });
  assert.equal(owner.battleScene.turnIndex, 1);
  assert.equal(owner.battleScene.turnStartedAt, 25);
  assert.equal(owner.battleScene.turnDurationMs, 900);

  owner = BattleOwner.closeBattleScene(owner);
  assert.equal(owner.battleScene, null);
  assert.equal(owner.activeOverlay, 'none');
});

test('BattleOwner preserves entityBattle renderer-facing session facts', () => {
  let owner = BattleOwner.createBattleOwner();
  owner = BattleOwner.openEntityBattle(owner, {
    visible: true,
    mode: 'interactive',
    battleId: 'battle-1',
    selectedGid: 'g1',
    tickHz: 20,
    battle: { tick: 2, squads: { g1: { side: 0 } } },
    pending: [{ type: 'order', gid: 'g1' }],
    onResolve() {},
  });

  assert.equal(owner.activeOverlay, 'entityBattle');
  assert.equal(Object.isFrozen(owner.entityBattle), true);
  assert.equal(owner.entityBattle.mode, 'interactive');
  assert.equal(owner.entityBattle.battle.tick, 2);
  assert.deepEqual(owner.entityBattle.pending, [{ gid: 'g1', type: 'order' }]);
  assert.equal(owner.entityBattle.onResolve, undefined);

  owner = BattleOwner.updateEntityBattle(owner, { selectedGid: 'g2', ended: true });
  assert.equal(owner.entityBattle.selectedGid, 'g2');
  assert.equal(owner.entityBattle.ended, true);

  owner = BattleOwner.closeEntityBattle(owner);
  assert.equal(owner.entityBattle, null);
  assert.equal(owner.activeOverlay, 'none');
});

test('BattleOwner gives entityBattle active overlay precedence', () => {
  let owner = BattleOwner.createBattleOwner();
  owner = BattleOwner.openBattleScene(owner, { visible: true, report: { id: 'r1' } });
  owner = BattleOwner.openEntityBattle(owner, { visible: true, mode: 'replay' });

  assert.equal(owner.activeOverlay, 'entityBattle');

  owner = BattleOwner.updateEntityBattle(owner, { visible: false });
  assert.equal(owner.activeOverlay, 'battleScene');
});
