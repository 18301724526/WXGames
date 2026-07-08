const test = require('node:test');
const assert = require('node:assert/strict');

const schema = require('../../shared/techEffectSchema');

const { EFFECT_TYPES: T, OPS } = schema;

test('validateEffect accepts well-formed effects per type', () => {
  assert.ok(schema.validateEffect({ type: T.UNLOCK_BUILDING, op: OPS.FLAG, target: 'farm' }).ok);
  assert.ok(schema.validateEffect({ type: T.RESOURCE_OUTPUT, op: OPS.MUL, target: 'food', value: 0.2 }).ok);
  assert.ok(schema.validateEffect({ type: T.GLOBAL_OUTPUT, op: OPS.MUL, value: 0.1 }).ok);
  assert.ok(schema.validateEffect({ type: T.POPULATION_BONUS, op: OPS.ADD, target: 'cap', value: 50 }).ok);
});

test('validateEffect rejects bad type/op/target/value', () => {
  assert.ok(!schema.validateEffect({ type: 'nope', op: OPS.FLAG, target: 'x' }).ok);
  assert.ok(!schema.validateEffect({ type: T.UNLOCK_BUILDING, op: OPS.MUL, target: 'farm', value: 1 }).ok); // flag-only type
  assert.ok(!schema.validateEffect({ type: T.RESOURCE_OUTPUT, op: OPS.MUL, target: 'gold', value: 1 }).ok); // bad resource
  assert.ok(!schema.validateEffect({ type: T.RESOURCE_OUTPUT, op: OPS.MUL, target: 'food' }).ok); // missing value
  assert.ok(!schema.validateEffect({ type: T.COMBAT_MODIFIER, op: OPS.ADD, value: 5 }).ok); // missing target
});

test('normalizeEffect canonicalizes and drops value on flags; returns null on invalid', () => {
  assert.deepEqual(schema.normalizeEffect({ type: T.UNLOCK_UNIT, op: OPS.FLAG, target: 42 }), { type: 'unlockUnit', op: 'flag', target: '42' });
  assert.deepEqual(schema.normalizeEffect({ type: T.RESOURCE_OUTPUT, op: OPS.ADD, target: 'wood', value: 3 }), { type: 'resourceOutput', op: 'add', target: 'wood', value: 3 });
  assert.equal(schema.normalizeEffect({ type: 'bogus', op: 'flag' }), null);
});

test('describeEffectKey yields a stable key + numeric params, no baked text', () => {
  const d = schema.describeEffectKey({ type: T.RESOURCE_OUTPUT, op: OPS.MUL, target: 'food', value: 0.2 });
  assert.equal(d.key, 'tech.effect.resourceOutput.mul');
  assert.equal(d.params.target, 'food');
  assert.equal(d.params.percent, 20);
  const f = schema.describeEffectKey({ type: T.UNLOCK_BUILDING, op: OPS.FLAG, target: 'farm' });
  assert.equal(f.key, 'tech.effect.unlockBuilding');
  assert.equal(f.params.target, 'farm');
  assert.equal(f.params.value, undefined); // flags carry no value
});
