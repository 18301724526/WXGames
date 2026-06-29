const test = require('node:test');
const assert = require('node:assert/strict');

const BattleStore = require('./BattleStore');

function reset() {
  BattleStore.closeBattleScene();
  BattleStore.closeEntityBattle();
}

test('BattleStore opens, updates, and closes battleScene scalars + report blob', () => {
  reset();
  BattleStore.openBattleScene({
    visible: true,
    report: { id: 'report-1', turns: [{ action: 'attack' }] },
    turnIndex: 0,
    startedAt: 10,
    turnStartedAt: 11,
    turnDurationMs: 900,
  });

  assert.equal(BattleStore.getActiveOverlay(), 'battleScene');
  assert.deepEqual(BattleStore.getBattleScene().report, {
    id: 'report-1',
    turns: [{ action: 'attack' }],
  });
  assert.equal(BattleStore.getBattleScene().turnDurationMs, 900);

  BattleStore.updateBattleScene({ turnIndex: 1, turnStartedAt: 25 });
  assert.equal(BattleStore.getBattleScene().turnIndex, 1);
  assert.equal(BattleStore.getBattleScene().turnStartedAt, 25);
  assert.equal(BattleStore.getBattleScene().turnDurationMs, 900);

  BattleStore.closeBattleScene();
  assert.equal(BattleStore.getBattleScene(), null);
  assert.equal(BattleStore.getActiveOverlay(), 'none');
});

test('BattleStore owns the live entityBattle session reference (no frozen copy)', () => {
  reset();
  const session = {
    visible: true,
    mode: 'interactive',
    battleId: 'battle-1',
    selectedGid: 'g1',
    tickHz: 20,
    battle: { tick: 2, squads: { g1: { side: 0 } } },
    pending: [{ type: 'order', gid: 'g1' }],
    onResolve() {},
  };
  const stored = BattleStore.openEntityBattle(session);

  assert.equal(BattleStore.getActiveOverlay(), 'entityBattle');
  // The store holds the SAME object the app steps -- it is not a frozen mirror.
  assert.equal(stored, session);
  assert.equal(BattleStore.getEntityBattle(), session);
  assert.equal(typeof BattleStore.getEntityBattle().onResolve, 'function');

  // In-place mutation by the app/renderer is visible through the store.
  session.selectedGid = 'g2';
  session.ended = true;
  assert.equal(BattleStore.getEntityBattle().selectedGid, 'g2');
  assert.equal(BattleStore.getEntityBattle().ended, true);

  BattleStore.closeEntityBattle();
  assert.equal(BattleStore.getEntityBattle(), null);
  assert.equal(BattleStore.getActiveOverlay(), 'none');
});

test('BattleStore gives entityBattle active overlay precedence over battleScene', () => {
  reset();
  BattleStore.openBattleScene({ visible: true, report: { id: 'r1' } });
  const session = { visible: true, mode: 'replay' };
  BattleStore.openEntityBattle(session);

  assert.equal(BattleStore.getActiveOverlay(), 'entityBattle');

  session.visible = false;
  assert.equal(BattleStore.getActiveOverlay(), 'battleScene');
  reset();
});

test('deriveActiveOverlay is a pure precedence function', () => {
  assert.equal(BattleStore.deriveActiveOverlay(false, false), 'none');
  assert.equal(BattleStore.deriveActiveOverlay(true, false), 'battleScene');
  assert.equal(BattleStore.deriveActiveOverlay(false, true), 'entityBattle');
  assert.equal(BattleStore.deriveActiveOverlay(true, true), 'entityBattle');
});

test('BattleStore getBattleFacts exposes the renderer-facing facts shape', () => {
  reset();
  BattleStore.openBattleScene({ visible: true, report: { id: 'facts-report' }, turnIndex: 0 });
  const facts = BattleStore.getBattleFacts();
  assert.equal(facts.activeOverlay, 'battleScene');
  assert.equal(facts.battleScene.report.id, 'facts-report');
  assert.equal(facts.entityBattle, null);
  reset();
});
