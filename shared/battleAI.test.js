'use strict';

const test = require('node:test');
const assert = require('node:assert');

const Core = require('./battleSimCore');
const AI = require('./battleAI');

// One general + a few soldiers per side, generals far apart by default formation.
function battle(opts = {}) {
  const tpl = { hp: 10, atk: 5, def: 0, range: 12, moveSpeed: 60, atkSpeed: 8 };
  return Core.createBattle({
    seed: opts.seed || 1,
    arena: { w: 400, h: 200 },
    sides: [
      {
        side: 'L',
        generals: [
          { gid: 'L1', stats: { hp: 100, atk: 20, def: 5 }, troop: { count: 4, template: tpl } },
        ],
      },
      {
        side: 'R',
        generals: [
          { gid: 'R1', stats: { hp: 100, atk: 20, def: 5 }, troop: { count: 4, template: tpl } },
        ],
      },
    ],
  });
}

function orderFor(inputs, gid) {
  const e = inputs.find((i) => i.gid === gid);
  return e ? e.order : null;
}

test('enemy far away: AI advances to close the distance', () => {
  const b = battle();
  const inputs = AI.decideSideOrders(b, 1);
  assert.strictEqual(orderFor(inputs, 'R1'), 'advance');
});

test('enemy within reach: AI commits soldiers', () => {
  const b = battle();
  const rGen = b.units[b.squads.R1.generalId];
  // Drop an L unit right next to the R general.
  const lUnit = b.units.find((u) => u.side === 0 && u.alive);
  lUnit.x = rGen.x - 10;
  lUnit.y = rGen.y;
  const inputs = AI.decideSideOrders(b, 1, { engageDist: 90 });
  assert.strictEqual(orderFor(inputs, 'R1'), 'soldierAttack');
});

test('general hurt: AI pulls the general back', () => {
  const b = battle();
  const rGen = b.units[b.squads.R1.generalId];
  rGen.hp = 10; // 10/100 = 0.1 < 0.25
  const inputs = AI.decideSideOrders(b, 1);
  assert.strictEqual(orderFor(inputs, 'R1'), 'generalRetreat');
});

test('respects order cooldown (no spam)', () => {
  const b = battle();
  b.squads.R1.orderCdLeft = 50;
  assert.strictEqual(AI.decideSideOrders(b, 1).length, 0);
});

test('no entry when the desired order already matches', () => {
  const b = battle();
  b.squads.R1.order = 'advance'; // already advancing toward a far enemy
  assert.strictEqual(AI.decideSideOrders(b, 1).length, 0);
});

test('only emits for the requested side', () => {
  const b = battle();
  const inputs = AI.decideSideOrders(b, 1);
  assert.ok(inputs.every((i) => i.gid === 'R1'));
});
