const test = require('node:test');
const assert = require('node:assert/strict');

const { check, coerce } = require('./build-config-tables');
const ConfigTables = require('../backend/config/ConfigTables');

test('config-tables coerce maps cell values to typed config values', () => {
  assert.equal(coerce('int', '42'), 42);
  assert.equal(coerce('int', '3.9'), 3); // truncates
  assert.equal(coerce('float', '0.35'), 0.35);
  assert.equal(coerce('bool', 'true'), true);
  assert.equal(coerce('bool', '是'), true);
  assert.equal(coerce('bool', ''), false);
  assert.equal(coerce('bool', '0'), false);
  assert.deepEqual(coerce('csv', 'a, b ,c'), ['a', 'b', 'c']);
  assert.deepEqual(coerce('csv', ''), []);
  assert.deepEqual(coerce('json', '{"x":1}'), { x: 1 });
  assert.equal(coerce('string', ''), '');
  assert.equal(coerce('string', 'hi'), 'hi');
  assert.equal(coerce('int', ''), 0);
});

test('config-tables committed JSON is fresh (deploy freshness gate is green)', () => {
  const stale = check();
  assert.deepEqual(stale, [], `stale generated tables: ${stale.join(', ')} — run npm run build:config-tables`);
});

test('ConfigTables loader exposes the generated garrison + veteran_camp tables', () => {
  ConfigTables.clearCache();
  const tables = ConfigTables.listTables();
  assert.ok(tables.includes('garrison'));
  assert.ok(tables.includes('veteran_camp'));

  // Row-by-id lookup + type fidelity through the whole xlsx -> json -> loader round-trip.
  const safe = ConfigTables.getById('garrison', 'safe');
  assert.equal(safe.defended, false); // the tutorial/spawn safe zone is undefended
  assert.equal(safe.captureChance, 0); // no defender in the spawn zone -> nothing to capture
  assert.equal(typeof safe.maxDistance, 'number');
  const near = ConfigTables.getById('garrison', 'near');
  assert.equal(near.defended, true);
  assert.equal(near.ownerType, 'city_state');
  assert.ok(near.captureChance > 0 && near.captureChance <= 1); // capture-defender rate is a fraction

  const camp1 = ConfigTables.getById('veteran_camp', '1');
  assert.ok(camp1.capacity > 0); // level 1 can hold dismissed soldiers
  assert.ok(camp1.retentionHours > 0); // regret window before they drain away
  assert.equal(camp1.refundRatio, 0.5); // each drained soldier refunds 50% value
});
