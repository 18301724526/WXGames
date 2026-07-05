const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('./personalityCore');
const ConfigTables = require('../../backend/config/ConfigTables');

const NATURES = ConfigTables.getRows('personality_natures');
const TUNING = Object.fromEntries(
  ConfigTables.getRows('personality_tuning').map((row) => [row.paramKey, row.value]),
);

test('config tables load: 8 natures + tuning params', () => {
  assert.equal(NATURES.length, 8);
  assert.equal(TUNING.rapportScale, 100);
  assert.ok(NATURES.every((n) => typeof n.natureId === 'string' && n.natureId));
});

test('assignPersonality is deterministic and produces valid axes + a real nature', () => {
  const a = core.assignPersonality('person-seed-1', NATURES, TUNING);
  const b = core.assignPersonality('person-seed-1', NATURES, TUNING);
  assert.deepEqual(a, b); // same seed -> same personality
  const c = core.assignPersonality('person-seed-2', NATURES, TUNING);
  assert.notDeepEqual(a, c); // different seed -> (almost surely) different
  for (const key of core.AXES) {
    assert.ok(a.axes[key] >= -1 && a.axes[key] <= 1, `${key} in range`);
  }
  assert.ok(NATURES.some((n) => n.natureId === a.nature)); // nature is a real config nature
});

test('assignPersonality spreads across natures over many seeds (weighted, not stuck)', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) seen.add(core.assignPersonality(`p${i}`, NATURES, TUNING).nature);
  assert.ok(seen.size >= 5, `saw ${seen.size} distinct natures`);
});

test('compatScore: identical axes are maximally compatible, fully-opposite are incompatible', () => {
  const axes = { boldness: 0.5, sociability: 0.5, integrity: 0.5 };
  assert.equal(core.compatScore(axes, axes, TUNING), 100); // identical -> +scale
  const full = { boldness: 1, sociability: 1, integrity: 1 };
  const opposite = { boldness: -1, sociability: -1, integrity: -1 };
  assert.equal(core.compatScore(full, opposite, TUNING), -100); // fully opposite -> -scale
  // half-opposed (0.5 vs -0.5) sits at the neutral midpoint.
  assert.equal(core.compatScore(axes, { boldness: -0.5, sociability: -0.5, integrity: -0.5 }, TUNING), 0);
});

test('compatScore reflects RTK 相性: aligned values 投缘, clashing 义理 相克', () => {
  const dutiful = core.assignPersonality('dutiful-ish', NATURES, TUNING);
  // Two people both high-integrity should be more compatible than integrity opposites.
  const highIntegrityA = { boldness: 0.1, sociability: 0.0, integrity: 0.9 };
  const highIntegrityB = { boldness: 0.0, sociability: 0.1, integrity: 0.8 };
  const ambitious = { boldness: 0.5, sociability: 0.2, integrity: -0.8 };
  const same = core.compatScore(highIntegrityA, highIntegrityB, TUNING);
  const clash = core.compatScore(highIntegrityA, ambitious, TUNING);
  assert.ok(same > clash, `aligned(${same}) should beat clashing(${clash})`);
  assert.ok(dutiful.nature); // sanity
});

test('nearestNature picks the anchor whose axes align best', () => {
  // near the valiant anchor (+0.8,+0.1,+0.2)
  assert.equal(core.nearestNature({ boldness: 0.85, sociability: 0.1, integrity: 0.2 }, NATURES), 'valiant');
  // near the ambitious anchor (+0.5,+0.2,-0.8)
  assert.equal(core.nearestNature({ boldness: 0.5, sociability: 0.2, integrity: -0.9 }, NATURES), 'ambitious');
});

test('behaviorMult reads the nature row hooks', () => {
  assert.equal(core.behaviorMult('romantic', 'meetRateMult', NATURES), 1.8); // 风流爱出游
  assert.equal(core.behaviorMult('ambitious', 'betrayalBias', NATURES), 1.8); // 野心易叛
  assert.equal(core.behaviorMult('dutiful', 'loyaltyDriftMult', NATURES), 0.5); // 义理忠诚稳
  assert.equal(core.behaviorMult('unknown', 'meetRateMult', NATURES, 1), 1); // fallback
});

test('normalizeAxes clamps + normalizePersonality keeps axes authoritative', () => {
  const clamped = core.normalizeAxes({ boldness: 5, sociability: -9, integrity: 'x' });
  assert.deepEqual(clamped, { boldness: 1, sociability: -1, integrity: 0 });
  const p = core.normalizePersonality({ nature: 'stale', axes: { boldness: 0.85, sociability: 0.1, integrity: 0.2 } }, NATURES);
  assert.equal(p.nature, 'valiant'); // nature recomputed from axes, not the stale label
});
