'use strict';

const test = require('node:test');
const assert = require('node:assert');

const BattleSimService = require('../services/battle/BattleSimService');

function force(generals) {
  return { generals };
}

const SMALL_ARENA = { config: { arena: { w: 200, h: 200 } } };
// Default order is hold; commit both sides so the battle actually resolves.
const ENGAGE = {
  inputStream: [
    { tick: 0, type: 'order', side: 0, order: 'allOut' },
    { tick: 0, type: 'order', side: 1, order: 'allOut' },
  ],
};

test('buildSetup maps formation members to core generals with troops', () => {
  const setup = BattleSimService.buildSetup({
    seed: 7,
    attacker: force([{ gid: 'p1', attributes: { force: 80 }, soldiers: 120 }]),
    defender: force([{ gid: 'd1', attributes: { force: 40 }, soldiers: 60 }]),
  });
  assert.strictEqual(setup.sides.length, 2);
  const a = setup.sides[0].generals[0];
  assert.strictEqual(a.gid, 'p1');
  assert.strictEqual(a.troop.count, 120);
  assert.ok(a.stats.atk > 0 && a.stats.hp > 0);
});

test('generalStats scales with attributes', () => {
  const balance = BattleSimService.DEFAULT_BALANCE;
  const weak = BattleSimService.generalStats(
    { force: 20, command: 20, speed: 20 },
    {
      general: balance.general,
      soldier: balance.soldier,
      arena: balance.arena,
    },
  );
  const strong = BattleSimService.generalStats(
    { force: 95, command: 95, speed: 95 },
    {
      general: balance.general,
      soldier: balance.soldier,
      arena: balance.arena,
    },
  );
  assert.ok(strong.atk > weak.atk, 'higher force => higher attack');
  assert.ok(strong.hp > weak.hp, 'higher force => more hp');
  assert.ok(strong.atkSpeed <= weak.atkSpeed, 'higher speed => faster (lower interval)');
});

test('resolve: stronger attacker wins and keeps survivors', () => {
  const out = BattleSimService.resolve(
    Object.assign(
      {
        seed: 1,
        attacker: force([
          { gid: 'p1', attributes: { force: 95, command: 80, speed: 70 }, soldiers: 100 },
        ]),
        defender: force([
          { gid: 'd1', attributes: { force: 20, command: 20, speed: 20 }, soldiers: 30 },
        ]),
      },
      SMALL_ARENA,
      ENGAGE,
    ),
  );
  assert.strictEqual(out.result.winner, 'attacker');
  assert.ok((out.result.survivorsByGid.p1 || 0) > 0, 'attacker keeps soldiers');
});

test('resolve is deterministic for the same seed', () => {
  const input = Object.assign(
    {
      seed: 99,
      attacker: force([{ gid: 'p1', attributes: { force: 60 }, soldiers: 50 }]),
      defender: force([{ gid: 'd1', attributes: { force: 55 }, soldiers: 50 }]),
    },
    SMALL_ARENA,
    ENGAGE,
  );
  assert.deepStrictEqual(
    BattleSimService.resolve(input).result,
    BattleSimService.resolve(input).result,
  );
});

test('applyCasualtiesToFormationSnapshot writes per-member survivors, capped at committed', () => {
  const snapshot = {
    schema: 'formation-snapshot-v1',
    members: [
      { personId: 'p1', soldiersCommitted: 100, soldiersRemaining: 100 },
      { personId: 'p2', soldiersCommitted: 80, soldiersRemaining: 80 },
    ],
    soldiersCommitted: 180,
    soldiersRemaining: 180,
  };
  const result = { survivorsByGid: { p1: 37, p2: 999 } };
  const next = BattleSimService.applyCasualtiesToFormationSnapshot(snapshot, result);
  assert.strictEqual(next.members[0].soldiersRemaining, 37);
  assert.strictEqual(next.members[1].soldiersRemaining, 80, 'capped at committed');
  assert.strictEqual(next.soldiersRemaining, 117);
  assert.strictEqual(snapshot.members[0].soldiersRemaining, 100, 'original snapshot not mutated');
});
