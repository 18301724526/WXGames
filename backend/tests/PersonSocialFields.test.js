const test = require('node:test');
const assert = require('node:assert/strict');

const PersonSocialFields = require('../services/person/PersonSocialFields');
const personalityCore = require('../../shared/person/personalityCore');
const ConfigTables = require('../config/ConfigTables');

const NATURES = ConfigTables.getRows('personality_natures');

test('normalizeSocial backfills a deterministic personality + gender + orientation for an old person', () => {
  const a = PersonSocialFields.normalizeSocial({}, 'fp_1');
  const b = PersonSocialFields.normalizeSocial({}, 'fp_1');
  assert.deepEqual(a, b); // deterministic from the person id
  assert.ok(NATURES.some((n) => n.natureId === a.personality.nature));
  assert.ok(['male', 'female'].includes(a.gender));
  assert.ok(['hetero', 'same'].includes(a.orientation));
  assert.deepEqual(a.relationships, []);
  assert.equal(a.factionId, null); // 在野 by default
});

test('normalizeSocial preserves an existing personality (axes authoritative, nature recomputed)', () => {
  const raw = { personality: { nature: 'stale', axes: { boldness: 0.85, sociability: 0.1, integrity: 0.2 } } };
  const out = PersonSocialFields.normalizeSocial(raw, 'fp_2');
  assert.equal(out.personality.nature, 'valiant'); // recomputed from axes, not the stale label
});

test('normalizeSocial keeps explicit gender/orientation/factionId and normalizes relationships', () => {
  const raw = {
    gender: 'female',
    orientation: 'same',
    factionId: 'ai_wei',
    relationships: [
      { toPersonId: 'fp_x', affinity: 50, meetCount: 5 }, // -> friend
      { toPersonId: '', affinity: 10 }, // dropped (no target)
    ],
  };
  const out = PersonSocialFields.normalizeSocial(raw, 'fp_3');
  assert.equal(out.gender, 'female');
  assert.equal(out.orientation, 'same');
  assert.equal(out.factionId, 'ai_wei');
  assert.equal(out.relationships.length, 1);
  assert.equal(out.relationships[0].kind, 'friend');
});

test('gender/orientation follow the configured ratios across many seeds (roughly)', () => {
  let females = 0;
  let same = 0;
  const N = 400;
  for (let i = 0; i < N; i += 1) {
    const s = PersonSocialFields.normalizeSocial({}, `p${i}`);
    if (s.gender === 'female') females += 1;
    if (s.orientation === 'same') same += 1;
  }
  assert.ok(females > 0 && females < N * 0.5, `females=${females}`); // ~18%, well under half
  assert.ok(same >= 0 && same < N * 0.2, `same=${same}`); // ~5%
});

test('personality assignment matches personalityCore directly (single source)', () => {
  const viaSocial = PersonSocialFields.normalizeSocial({}, 'seed-xyz').personality;
  const tuning = Object.fromEntries(ConfigTables.getRows('personality_tuning').map((r) => [r.paramKey, r.value]));
  const direct = personalityCore.assignPersonality('seed-xyz', NATURES, tuning);
  assert.deepEqual(viaSocial, direct);
});
