const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldSocialTickService, weightedPick } = require('../services/person/WorldSocialTickService');
const personalityCore = require('../../shared/person/personalityCore');
const ConfigTables = require('../config/ConfigTables');

const NATURES = ConfigTables.getRows('personality_natures');
const PTUNING = Object.fromEntries(ConfigTables.getRows('personality_tuning').map((r) => [r.paramKey, r.value]));
const RTUNING = Object.fromEntries(ConfigTables.getRows('relationship_tuning').map((r) => [r.paramKey, r.value]));

function person(id) {
  return { id, personality: personalityCore.assignPersonality(id, NATURES, PTUNING), relationships: [] };
}

function svc() {
  return createWorldSocialTickService({ natures: NATURES });
}

const OPTS = { meetPairs: 5, nowMs: 1000, natures: NATURES, personalityTuning: PTUNING, relTuning: RTUNING };

test('weightedPick honors weights and falls back to uniform on zero total', () => {
  assert.equal(weightedPick([0, 0, 5], 0.5), 2); // all weight on index 2
  assert.equal(weightedPick([1, 0, 0], 0.1), 0);
  assert.equal(weightedPick([0, 0, 0], 0.99), 2); // uniform fallback
});

test('advanceRelationships builds edges deterministically and never mutates the input', () => {
  const s = svc();
  const input = [person('a'), person('b'), person('c'), person('d')];
  const r1 = s.advanceRelationships(input, { ...OPTS, prng: personalityCore.makePrng('tick-1') });
  const r2 = s.advanceRelationships(input, { ...OPTS, prng: personalityCore.makePrng('tick-1') });
  // input untouched
  assert.deepEqual(input.map((p) => p.relationships), [[], [], [], []]);
  // deterministic from the same seed
  assert.deepEqual(r1.meets, r2.meets);
  // edges actually formed (5 meets over 4 people => at least one directed edge somewhere)
  const totalEdges = r1.people.reduce((n, p) => n + p.relationships.length, 0);
  assert.ok(totalEdges > 0, `edges=${totalEdges}`);
});

test('meetings are symmetric — each side gets a directed edge to the other', () => {
  const s = svc();
  const r = s.advanceRelationships([person('a'), person('b')], { ...OPTS, meetPairs: 3, prng: personalityCore.makePrng('pair') });
  const a = r.people.find((p) => p.id === 'a');
  const b = r.people.find((p) => p.id === 'b');
  assert.equal(a.relationships.length, 1);
  assert.equal(b.relationships.length, 1);
  assert.equal(a.relationships[0].toPersonId, 'b');
  assert.equal(b.relationships[0].toPersonId, 'a');
  // repeated meets raise meetCount
  assert.equal(a.relationships[0].meetCount, 3);
});

test('a fewer-than-2 population is a no-op', () => {
  const s = svc();
  const r = s.advanceRelationships([person('solo')], OPTS);
  assert.deepEqual(r.meets, []);
  assert.deepEqual(r.crossings, []);
});

test('high compat pair crosses into friendship and records a became_friend crossing', () => {
  const s = svc();
  // two identical-axes people => maximal compat => affinity climbs to friend over enough meets
  const axes = { boldness: 0.5, sociability: 0.9, integrity: 0.5 };
  const a = { id: 'a', personality: personalityCore.normalizePersonality({ axes }, NATURES), relationships: [] };
  const b = { id: 'b', personality: personalityCore.normalizePersonality({ axes }, NATURES), relationships: [] };
  let people = [a, b];
  let sawFriend = false;
  for (let i = 0; i < 40 && !sawFriend; i += 1) {
    const r = s.advanceRelationships(people, { ...OPTS, meetPairs: 4, nowMs: 1000 + i, prng: personalityCore.makePrng(`c${i}`) });
    people = r.people;
    if (r.crossings.some((c) => c.type === 'became_friend')) sawFriend = true;
  }
  assert.ok(sawFriend, 'high-compat pair should eventually become friends');
});

test('decay pass bleeds an idle positive edge toward zero', () => {
  const s = svc();
  const day = 24 * 60 * 60 * 1000;
  const people = [{ id: 'a', personality: personalityCore.assignPersonality('a', NATURES, PTUNING), relationships: [{ toPersonId: 'b', affinity: 30, meetCount: 3, lastInteractAt: 0, flags: [] }] }];
  s.decayAll(people, 5 * day, RTUNING);
  assert.ok(people[0].relationships[0].affinity < 30, `decayed to ${people[0].relationships[0].affinity}`);
});
