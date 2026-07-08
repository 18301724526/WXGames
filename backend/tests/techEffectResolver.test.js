const test = require('node:test');
const assert = require('node:assert/strict');

const resolver = require('../../shared/tech/techEffectResolver');
const schema = require('../../shared/techEffectSchema');
const TechTreeConfig = require('../config/TechTreeConfig');

const { EFFECT_TYPES: T, OPS } = schema;

const NEW_NODES = [
  { id: 'n_food', effects: [{ type: T.RESOURCE_OUTPUT, op: OPS.MUL, target: 'food', value: 0.2 }] },
  { id: 'n_food2', effects: [{ type: T.RESOURCE_OUTPUT, op: OPS.MUL, target: 'food', value: 0.2 }] },
  { id: 'n_units', effects: [{ type: T.UNLOCK_UNIT, op: OPS.FLAG, target: 'barbarian_infantry' }, { type: T.GLOBAL_OUTPUT, op: OPS.MUL, value: 0.1 }] },
  { id: 'n_combat', effects: [{ type: T.COMBAT_MODIFIER, op: OPS.MUL, target: 'attack', value: 0.15 }] },
  { id: 'n_pop', effects: [{ type: T.POPULATION_BONUS, op: OPS.ADD, target: 'cap', value: 50 }] },
];

test('resolve folds typed effects; mul deltas ADD (1+0.2+0.2 semantics, not compounding)', () => {
  const snap = resolver.resolve(['n_food', 'n_food2', 'n_units'], NEW_NODES);
  assert.equal(snap.resourceOutput.food.mul, 0.4); // additive delta, => ×1.4 later, not ×1.44
  assert.equal(snap.globalOutputMul, 0.1);
  assert.deepEqual(snap.unlockedUnits, ['barbarian_infantry']);
});

test('resolve accepts the researched MAP shape and unknown ids are skipped', () => {
  const snap = resolver.resolve({ n_combat: { id: 'n_combat' }, ghost: {} }, NEW_NODES);
  assert.equal(snap.combat.attack.mul, 0.15);
  assert.equal(snap.resourceOutput.food, undefined); // ghost contributes nothing
});

test('resolve reads the LEGACY object effect shape (unlockedBuildings + resourceEntrances)', () => {
  const legacy = [
    { id: 'l_quarry', effects: { resourceEntrances: ['stone'], unlockedBuildings: ['quarry'] } },
    { id: 'l_food', effects: { resourceEntrances: ['food'] } },
  ];
  const snap = resolver.resolve(['l_quarry', 'l_food'], legacy);
  assert.deepEqual(snap.unlockedBuildings, ['quarry']);
  assert.deepEqual(snap.resourceEntrances, ['food', 'stone']); // display-only, preserved + sorted
  assert.deepEqual(snap.resourceOutput, {}); // entrances are NOT numeric effects
});

test('getUnlockedBuildings over the REAL 38-node config is stable and matches a resolve of the same', () => {
  const nodes = Object.values(TechTreeConfig.TECH_BY_ID);
  const allIds = nodes.map((n) => n.id);
  // resolve every node as if researched → the union of all legacy unlockedBuildings, deterministically.
  const a = resolver.getUnlockedBuildings(allIds, nodes);
  const b = resolver.resolve(allIds, nodes).unlockedBuildings;
  assert.deepEqual(a, b);
  assert.ok(a.includes('quarry')); // a known legacy unlock
  assert.deepEqual(a, [...a].sort()); // deterministic order
});

test('an invalid effect is ignored fail-closed (never corrupts the snapshot)', () => {
  const bad = [{ id: 'x', effects: [{ type: 'bogus', op: 'mul', value: 5 }, { type: T.RESOURCE_OUTPUT, op: OPS.ADD, target: 'wood', value: 3 }] }];
  const snap = resolver.resolve(['x'], bad);
  assert.equal(snap.resourceOutput.wood.add, 3); // the valid one still applied
  assert.equal(Object.keys(snap.resourceOutput).length, 1); // the bogus one added nothing
});
