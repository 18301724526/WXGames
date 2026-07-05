const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { FactionDiplomacyRepository } = require('../repositories/FactionDiplomacyRepository');
const { createFactionDiplomacyService } = require('../services/faction/FactionDiplomacyService');
const ConfigTables = require('../config/ConfigTables');

const CFG = Object.fromEntries(
  ConfigTables.getRows('diplomacy_tuning').map((row) => [row.paramKey, row.value]),
);

function setup() {
  const db = new Database(':memory:');
  const repo = new FactionDiplomacyRepository(db);
  repo.init();
  const svc = createFactionDiplomacyService({ diplomacyRepo: repo, config: CFG });
  return { repo, svc };
}

test('absent edge reads as default neutral (never stored until it changes)', () => {
  const { svc } = setup();
  const e = svc.getEdge('ai_wei', 'ai_wu');
  assert.equal(e.state, 'neutral');
  assert.equal(e.favorability, 0);
});

test('adjustFavorability is directed (one side only); mutualFavorability takes the min', () => {
  const { svc } = setup();
  svc.adjustFavorability('ai_wei', 'ai_wu', 60, 'now');
  assert.equal(svc.getEdge('ai_wei', 'ai_wu').favorability, 60);
  assert.equal(svc.getEdge('ai_wu', 'ai_wei').favorability, 0); // other side unchanged
  assert.equal(svc.mutualFavorability('ai_wei', 'ai_wu'), 0); // min(60, 0)
});

test('applyStateChange mirrors the symmetric state onto BOTH ordered rows', () => {
  const { svc } = setup();
  svc.applyStateChange('ai_wei', 'ai_wu', 'allied', 'now');
  assert.equal(svc.state('ai_wei', 'ai_wu'), 'allied');
  assert.equal(svc.state('ai_wu', 'ai_wei'), 'allied'); // mirrored
});

test('performAction: declare war, accept alliance (needs favor), betray ally', () => {
  const { svc } = setup();
  assert.deepEqual(svc.performAction('ai_wei', 'ai_wu', 'declareWar', {}, 'now'), { ok: true, state: 'hostile' });
  assert.equal(svc.state('ai_wu', 'ai_wei'), 'hostile'); // symmetric

  const { svc: svc2 } = setup();
  // alliance rejected without enough favor
  assert.equal(svc2.performAction('ai_wei', 'ai_wu', 'acceptAlliance', { theirFavorabilityToUs: 20 }, 'now').ok, false);
  // accepted with enough favor
  assert.equal(svc2.performAction('ai_wei', 'ai_wu', 'acceptAlliance', { theirFavorabilityToUs: 60 }, 'now').state, 'allied');
  // betraying the ally by declaring war applies the harsher betrayal favorability hit to the target.
  svc2.performAction('ai_wei', 'ai_wu', 'declareWar', {}, 'now');
  assert.equal(svc2.state('ai_wei', 'ai_wu'), 'hostile');
  assert.ok(svc2.getEdge('ai_wu', 'ai_wei').favorability <= CFG.actBetrayAllyFav);
});

test('advanceEdge: favorability drifts and can flip the symmetric state', () => {
  const { svc } = setup();
  // seed both sides high, then advance with shared enemies -> should climb to friendly
  svc.adjustFavorability('ai_wei', 'ai_wu', 45, 'now');
  svc.adjustFavorability('ai_wu', 'ai_wei', 45, 'now');
  svc.advanceEdge('ai_wei', 'ai_wu', { sharedEnemies: 2 }, { sharedEnemies: 2 }, 'now');
  assert.equal(svc.state('ai_wei', 'ai_wu'), 'friendly'); // mutualFav >= 40 -> friendly
});

// Regression C1: fractional per-tick drift must ACCUMULATE (no per-tick rounding). Before the fix,
// clampFavorability rounded every write so any |drift| < 0.5/tick was silently discarded and favorability
// stayed frozen — the passive-drift subsystem was inert.
test('fractional favorability accumulates across ticks (no per-tick rounding)', () => {
  const { svc } = setup();
  for (let i = 0; i < 10; i += 1) svc.adjustFavorability('ai_a', 'ai_b', 0.3, 'now');
  assert.ok(svc.getEdge('ai_a', 'ai_b').favorability >= 2.9, `expected ~3, got ${svc.getEdge('ai_a', 'ai_b').favorability}`);
});

// Regression C2: nemesisStreak drives a SYMMETRIC transition, so it must advance regardless of
// advanceEdge argument order. Before the fix it lived on only the (a,b) row, so alternating
// advanceEdge(a,b)/advanceEdge(b,a) split the streak and never reached the threshold.
test('nemesisStreak advances symmetrically regardless of advanceEdge argument order', () => {
  const { svc } = setup();
  // Drive both sides deeply hostile so mutualFav stays <= nemesisAt for well over nemesisTicks.
  svc.adjustFavorability('ai_a', 'ai_b', -100, 'now');
  svc.adjustFavorability('ai_b', 'ai_a', -100, 'now');
  svc.applyStateChange('ai_a', 'ai_b', 'hostile', 'now');
  const ctx = {};
  for (let i = 0; i < CFG.nemesisTicks + 2; i += 1) {
    if (i % 2 === 0) svc.advanceEdge('ai_a', 'ai_b', ctx, ctx, 'now');
    else svc.advanceEdge('ai_b', 'ai_a', ctx, ctx, 'now');
  }
  assert.equal(svc.state('ai_a', 'ai_b'), 'nemesis');
});

test('effects/canAttack derive from state (allied cannot attack, shares vision)', () => {
  const { svc } = setup();
  svc.applyStateChange('ai_wei', 'ai_wu', 'allied', 'now');
  assert.equal(svc.canAttack('ai_wei', 'ai_wu'), false);
  assert.equal(svc.effects('ai_wei', 'ai_wu').sharedVision, true);
  svc.applyStateChange('ai_wei', 'ai_wu', 'nemesis', 'now');
  assert.equal(svc.canAttack('ai_wei', 'ai_wu'), true);
});
