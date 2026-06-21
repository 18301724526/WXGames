'use strict';

const test = require('node:test');
const assert = require('node:assert');

const core = require('./battleSimCore');
const { createBattle, step, simulate, applyInput } = core;

// Compact test setup: two single-general sides on a small arena so battles
// resolve quickly. Tunable stats per side.
function setup(opts = {}) {
  const o = Object.assign(
    { seed: 1, lHp: 20, lAtk: 30, rHp: 20, rAtk: 5, lSold: 0, rSold: 0, config: {} },
    opts,
  );
  const tpl = { hp: 10, atk: 5, def: 0, range: 12, moveSpeed: 120, atkSpeed: 8 };
  return {
    seed: o.seed,
    arena: { w: 200, h: 200 },
    config: o.config,
    sides: [
      {
        side: 'L',
        generals: [
          {
            gid: 'L1',
            stats: { hp: o.lHp, atk: o.lAtk, def: 0, range: 14, moveSpeed: 120, atkSpeed: 5 },
            troop: { count: o.lSold, template: tpl },
          },
        ],
      },
      {
        side: 'R',
        generals: [
          {
            gid: 'R1',
            stats: { hp: o.rHp, atk: o.rAtk, def: 0, range: 14, moveSpeed: 120, atkSpeed: 8 },
            troop: { count: o.rSold, template: tpl },
          },
        ],
      },
    ],
  };
}

function runToEnd(battle, cap = 2000) {
  let res = null;
  for (let i = 0; i < cap && !res; i += 1) res = step(battle, null);
  return res;
}

// Default order is now 待命/hold (no auto-clash), so combat tests must commit.
function bothAllOut() {
  return [
    { tick: 0, type: 'order', side: 0, order: 'allOut' },
    { tick: 0, type: 'order', side: 1, order: 'allOut' },
  ];
}
function clashToEnd(opts, cap) {
  const b = createBattle(setup(opts));
  applyInput(b, { type: 'order', side: 0, order: 'allOut' });
  applyInput(b, { type: 'order', side: 1, order: 'allOut' });
  return { b, res: runToEnd(b, cap) };
}

test('default order holds: neither side advances without a command', () => {
  const b = createBattle(setup({ lHp: 9999, rHp: 9999, lAtk: 1, rAtk: 1 }));
  const lx0 = b.units[0].x;
  for (let i = 0; i < 60; i += 1) step(b, null);
  assert.ok(Math.abs(b.units[0].x - lx0) < 1, 'units hold position until ordered');
  assert.strictEqual(b.result, null, 'no auto-clash, battle not resolved');
});

test('createBattle builds generals and soldiers per side', () => {
  const b = createBattle(setup({ lSold: 3, rSold: 2 }));
  const left = b.units.filter((u) => u.side === 0);
  const right = b.units.filter((u) => u.side === 1);
  assert.strictEqual(left.length, 1 + 3);
  assert.strictEqual(right.length, 1 + 2);
  assert.strictEqual(b.units.filter((u) => u.kind === 'general').length, 2);
  assert.strictEqual(b.squads.L1.soldierIds.length, 3);
});

test('annihilation: stronger side wins by wiping the other', () => {
  const { res } = clashToEnd({ lAtk: 30, rAtk: 1 });
  assert.ok(res, 'battle should resolve');
  assert.strictEqual(res.winner, 'L');
  assert.strictEqual(res.onField[1], 0);
});

test('same seed + inputs is deterministic', () => {
  const a = simulate(setup({ lSold: 5, rSold: 5, seed: 42 }), bothAllOut());
  const b = simulate(setup({ lSold: 5, rSold: 5, seed: 42 }), bothAllOut());
  assert.deepStrictEqual(a, b);
});

test('sticky targeting keeps the same target while it is alive', () => {
  const b = createBattle(setup({ lHp: 9999, rHp: 9999, lAtk: 1, rAtk: 1 }));
  let captured = -1;
  for (let i = 0; i < 300 && captured < 0; i += 1) {
    step(b, null);
    if (b.units[0].targetId >= 0) captured = b.units[0].targetId;
  }
  assert.ok(captured >= 0, 'a unit should acquire a target');
  const t = b.units[0].targetId;
  const tgt = b.units[t];
  step(b, null);
  if (tgt.alive && !tgt.left) {
    assert.strictEqual(b.units[0].targetId, t, 'target should persist, not be re-searched');
  }
});

test('per-squad order has a 5s cooldown', () => {
  const b = createBattle(setup({ lHp: 9999, rHp: 9999, lAtk: 1, rAtk: 1 }));
  assert.ok(applyInput(b, { type: 'order', gid: 'L1', order: 'defend' }), 'first order accepted');
  assert.ok(!applyInput(b, { type: 'order', gid: 'L1', order: 'advance' }), 'blocked by cooldown');
  for (let i = 0; i < b.config.orderCdTicks; i += 1) step(b, null);
  assert.ok(
    applyInput(b, { type: 'order', gid: 'L1', order: 'advance' }),
    'accepted after cooldown',
  );
});

test('master order is once per side and hands control to auto', () => {
  const b = createBattle(setup({}));
  assert.ok(applyInput(b, { type: 'order', side: 0, order: 'allOut' }), 'master order accepted');
  assert.strictEqual(b.auto, true, 'auto takeover after master order');
  assert.ok(!applyInput(b, { type: 'order', side: 0, order: 'allOut' }), 'master order only once');
});

test('all-retreat master order loses by leaving the field', () => {
  const b = createBattle(setup({ lHp: 80, rHp: 80, lAtk: 1, rAtk: 1 }));
  applyInput(b, { type: 'order', side: 0, order: 'allRetreat' });
  const res = runToEnd(b);
  assert.ok(res, 'battle should resolve');
  assert.strictEqual(res.winner, 'R', 'retreating side loses');
});

test('general death halves squad damage and routs soldiers (seeded)', () => {
  const { b, res } = clashToEnd({
    lAtk: 999,
    lHp: 9999,
    rHp: 20,
    rAtk: 1,
    rSold: 4,
    config: { routChance: 1 },
  });
  const rsq = b.squads.R1;
  assert.strictEqual(rsq.leaderAlive, false, 'R general died');
  assert.strictEqual(rsq.damageMult, 0.5, 'surviving soldiers fight at half power');
  assert.strictEqual(res.winner, 'L');
});

test('skill input entries are accepted by the stream but ignored for now', () => {
  const b = createBattle(setup({}));
  assert.strictEqual(applyInput(b, { type: 'skill', side: 0, gid: 'L1', skillId: 'x' }), false);
});

// ---- step 2: per-kind order behaviors ----
// Far-apart, immortal-ish stats so movement is observable without anyone dying.
function squadOrderBattle(order) {
  const b = createBattle(setup({ lSold: 4, lHp: 99999, rHp: 99999, lAtk: 1, rAtk: 1 }));
  // Enemy holds so it does not charge across and spoil the observation.
  assert.ok(applyInput(b, { type: 'order', gid: 'R1', order: 'defend' }), 'enemy holds');
  assert.ok(applyInput(b, { type: 'order', gid: 'L1', order }), 'order accepted');
  return b;
}
function firstSoldier(b) {
  return b.units.find((u) => u.side === 0 && u.kind === 'soldier');
}

test('士兵出击: soldiers advance, general holds the rear', () => {
  const b = squadOrderBattle('soldierAttack');
  const gen = b.units[0];
  const gx0 = gen.x;
  const sol = firstSoldier(b);
  const sx0 = sol.x;
  for (let i = 0; i < 30; i += 1) step(b, null);
  assert.ok(sol.x > sx0 + 5, 'soldier pushed toward the enemy');
  assert.ok(Math.abs(gen.x - gx0) < 2, 'general stayed at the rear');
});

test('武将出击: general charges, soldiers stand guard', () => {
  const b = squadOrderBattle('generalCharge');
  const gen = b.units[0];
  const gx0 = gen.x;
  const sol = firstSoldier(b);
  const sx0 = sol.x;
  for (let i = 0; i < 30; i += 1) step(b, null);
  assert.ok(gen.x > gx0 + 5, 'general charged toward the enemy');
  assert.ok(Math.abs(sol.x - sx0) < 2, 'soldiers held position');
});

test('武将后退: general pulls back but stays on field, soldiers cover', () => {
  const b = squadOrderBattle('generalRetreat');
  const gen = b.units[0];
  const gx0 = gen.x;
  for (let i = 0; i < 30; i += 1) step(b, null);
  assert.ok(gen.x < gx0 - 2, 'general moved back toward home edge');
  assert.strictEqual(gen.left, false, 'general did not leave the field');
  const covering = b.units.some(
    (u) => u.side === 0 && u.kind === 'soldier' && u.state === 'covering',
  );
  assert.ok(covering, 'soldiers entered cover');
});

test('掩护: soldiers screen the general', () => {
  const b = squadOrderBattle('cover');
  for (let i = 0; i < 20; i += 1) step(b, null);
  const covering = b.units.some(
    (u) => u.side === 0 && u.kind === 'soldier' && u.state === 'covering',
  );
  assert.ok(covering, 'soldiers are covering the general');
});

// ---- step 3: skills / rage (data-driven + effect registry) ----
function skillBattle(skills) {
  return createBattle({
    seed: 1,
    arena: { w: 200, h: 200 },
    sides: [
      {
        side: 'L',
        generals: [
          {
            gid: 'L1',
            stats: {
              hp: 500,
              atk: 10,
              def: 0,
              range: 14,
              moveSpeed: 0,
              atkSpeed: 10,
              skills: skills,
            },
            troop: { count: 0, template: {} },
          },
        ],
      },
      {
        side: 'R',
        generals: [
          {
            gid: 'R1',
            stats: { hp: 500, atk: 10, def: 0, range: 14, moveSpeed: 0, atkSpeed: 10 },
            troop: {
              count: 3,
              template: { hp: 30, atk: 1, def: 0, range: 10, moveSpeed: 0, atkSpeed: 10 },
            },
          },
        ],
      },
    ],
  });
}
function gen(b) {
  return b.units[b.squads.L1.generalId];
}

test('ultimate is gated by rage and consumes it; aoeDamage hits nearby enemies', () => {
  const b = skillBattle([
    {
      id: 'ult',
      kind: 'ultimate',
      effect: 'aoeDamage',
      params: { radius: 300, damage: 35 },
      rageCost: 50,
      cooldownTicks: 100,
    },
  ]);
  const g = gen(b);
  assert.strictEqual(core.skillReady(b, g, g.skills[0], 0), false, 'not ready at 0 rage');
  g.rage = 60;
  assert.strictEqual(core.skillReady(b, g, g.skills[0], 0), true, 'ready once rage met');
  b._dead = [];
  const before = core.countOnField(b)[1];
  assert.ok(core.castSkill(b, g, 0));
  assert.strictEqual(g.rage, 10, 'rage consumed (60-50)');
  assert.ok(core.countOnField(b)[1] < before, 'enemies in radius died');
  assert.ok(g.action && g.action.kind === 'skill', 'cast occupies the action slot');
});

test('minor skill is gated by cooldown', () => {
  const b = skillBattle([
    { id: 'm', kind: 'minor', effect: 'rallyAtk', params: { mult: 2 }, cooldownTicks: 60 },
  ]);
  const g = gen(b);
  assert.strictEqual(core.skillReady(b, g, g.skills[0], 0), true, 'minor ready immediately');
  assert.ok(core.castSkill(b, g, 0));
  assert.strictEqual(g.skillCds[0], 60, 'on cooldown after cast');
  assert.strictEqual(core.skillReady(b, g, g.skills[0], 0), false);
  assert.strictEqual(b.squads.L1.damageMult, 2, 'rallyAtk buff applied');
});

test('auto skills fire from skillPhase during step', () => {
  const b = skillBattle([
    {
      id: 'm',
      kind: 'minor',
      effect: 'rallyAtk',
      params: { mult: 2 },
      cooldownTicks: 60,
      auto: true,
    },
  ]);
  step(b, null);
  assert.strictEqual(b.squads.L1.damageMult, 2, 'auto-cast applied the buff');
});

test('manual skill cast via the input stream', () => {
  const b = skillBattle([
    {
      id: 'ult',
      kind: 'ultimate',
      effect: 'rallyAtk',
      params: { mult: 2 },
      rageCost: 0,
      cooldownTicks: 10,
    },
  ]);
  assert.strictEqual(applyInput(b, { type: 'skill', gid: 'L1', skillId: 'ult' }), true);
  assert.strictEqual(b.squads.L1.damageMult, 2);
  assert.strictEqual(
    applyInput(b, { type: 'skill', gid: 'L1', skillId: 'nope' }),
    false,
    'unknown skill rejected',
  );
});

test('general rage regenerates over ticks', () => {
  const b = skillBattle([]);
  const g = gen(b);
  g.rage = 0;
  step(b, null);
  assert.ok(g.rage > 0, 'rage regenerated');
});

test('effect registry is extensible (register a new effect)', () => {
  core.EFFECT_REGISTRY.testFx = function (battle, caster, skill) {
    caster._flag = skill.params.v;
  };
  const b = skillBattle([
    { id: 't', kind: 'minor', effect: 'testFx', params: { v: 42 }, cooldownTicks: 5 },
  ]);
  const g = gen(b);
  core.castSkill(b, g, 0);
  assert.strictEqual(g._flag, 42);
  delete core.EFFECT_REGISTRY.testFx;
});
