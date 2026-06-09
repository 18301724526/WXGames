const test = require('node:test');
const assert = require('node:assert/strict');

const RandomAuthority = require('../services/random/ServerRandomAuthorityContract');

test('ServerRandomAuthorityContract creates bounded server-owned roll metadata', () => {
  const roll = RandomAuthority.createRoll({
    domain: 'territory',
    action: 'scoutOutcome',
    subjectId: 'mission-1',
    seed: 'player-1',
    sequence: 3,
  }, {
    now: new Date('2026-06-09T00:00:00.000Z'),
    randomSource: () => 1.5,
  });

  assert.equal(roll.schema, RandomAuthority.SCHEMA);
  assert.equal(roll.authority, RandomAuthority.AUTHORITY);
  assert.equal(roll.domain, 'territory');
  assert.equal(roll.action, 'scoutOutcome');
  assert.equal(roll.subjectId, 'mission-1');
  assert.equal(roll.seed, 'player-1');
  assert.equal(roll.sequence, 3);
  assert.equal(roll.serverTime, '2026-06-09T00:00:00.000Z');
  assert.equal(roll.value, RandomAuthority.MAX_UNIT_ROLL);
  assert.match(roll.rollId, /^[a-f0-9]{16}$/);
});

test('ServerRandomAuthorityContract keeps injected random sources deterministic for tests', () => {
  const values = [0.12, 0.34, 0.56];
  const source = RandomAuthority.createRandomSource({
    domain: 'territory',
    action: 'scoutTemplate',
    subjectId: 'mission-2',
    seed: 'seed-2',
  }, {
    now: new Date('2026-06-09T00:01:00.000Z'),
    randomSource: () => values.shift(),
  });

  assert.equal(source(), 0.12);
  assert.equal(source(), 0.34);
  assert.equal(source(), 0.56);
  assert.deepEqual(source.authorityScope, {
    schema: RandomAuthority.SCHEMA,
    authority: RandomAuthority.AUTHORITY,
    domain: 'territory',
    action: 'scoutTemplate',
    subjectId: 'mission-2',
    seed: 'seed-2',
    sequence: 0,
    serverTime: '2026-06-09T00:01:00.000Z',
  });
});

test('ServerRandomAuthorityContract rolls chance with explicit threshold and roll envelope', () => {
  const fail = RandomAuthority.rollChance(0.4, {
    domain: 'territory',
    action: 'scoutOutcome',
  }, {
    now: new Date('2026-06-09T00:02:00.000Z'),
    randomSource: () => 0.4,
  });
  const pass = RandomAuthority.rollChance(0.4, {
    domain: 'territory',
    action: 'scoutOutcome',
  }, {
    now: new Date('2026-06-09T00:02:00.000Z'),
    randomSource: () => 0.399,
  });

  assert.equal(fail.threshold, 0.4);
  assert.equal(fail.success, false);
  assert.equal(fail.roll.authority, 'server');
  assert.equal(pass.success, true);
});
