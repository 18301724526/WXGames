const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../../shared/faction/factionTreasuryCore');

test('normalize drops non-positive keys and coerces numbers (0 === absent)', () => {
  assert.deepEqual(core.normalize({ food: 100, wood: 0, iron: -5, stone: '30' }), { food: 100, stone: 30 });
  assert.deepEqual(core.normalize(null), {});
});

test('deposit adds positive income and never drains (negative ignored); input untouched', () => {
  const t = { food: 100 };
  const out = core.deposit(t, { food: 50, wood: 20, iron: -9 });
  assert.deepEqual(out, { food: 150, wood: 20 });
  assert.deepEqual(t, { food: 100 }); // input not mutated
});

test('canAfford / shortfall report exactly what is missing', () => {
  const t = { food: 100, wood: 30 };
  assert.equal(core.canAfford(t, { food: 80, wood: 30 }), true);
  assert.equal(core.canAfford(t, { food: 80, iron: 10 }), false);
  assert.deepEqual(core.shortfall(t, { food: 120, wood: 10, iron: 10 }), { food: 20, iron: 10 });
  assert.deepEqual(core.shortfall(t, { food: 100 }), {}); // exactly affordable
});

test('spend subtracts on success, drops spent-to-zero keys, and returns a new treasury', () => {
  const t = { food: 100, wood: 30 };
  const r = core.spend(t, { food: 100, wood: 10 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.treasury, { wood: 20 }); // food spent to 0 → key dropped
  assert.deepEqual(r.shortfall, {});
  assert.deepEqual(t, { food: 100, wood: 30 }); // input not mutated
});

test('spend fails atomically when unaffordable — treasury unchanged, shortfall reported', () => {
  const t = { food: 50 };
  const r = core.spend(t, { food: 80, wood: 10 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.treasury, { food: 50 }); // nothing deducted
  assert.deepEqual(r.shortfall, { food: 30, wood: 10 });
});

test('total is the coarse wealth scalar across resources', () => {
  assert.equal(core.total({ food: 100, wood: 30, iron: 0 }), 130);
  assert.equal(core.total({}), 0);
});
