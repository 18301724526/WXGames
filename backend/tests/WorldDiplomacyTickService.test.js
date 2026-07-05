const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { FactionDiplomacyRepository } = require('../repositories/FactionDiplomacyRepository');
const { createFactionDiplomacyService } = require('../services/faction/FactionDiplomacyService');
const { createWorldDiplomacyTickService } = require('../services/faction/WorldDiplomacyTickService');
const personalityCore = require('../../shared/person/personalityCore');
const ConfigTables = require('../config/ConfigTables');

const DCFG = Object.fromEntries(ConfigTables.getRows('diplomacy_tuning').map((r) => [r.paramKey, r.value]));
const NATURES = ConfigTables.getRows('personality_natures');
const PTUNING = Object.fromEntries(ConfigTables.getRows('personality_tuning').map((r) => [r.paramKey, r.value]));

function setup() {
  const db = new Database(':memory:');
  const repo = new FactionDiplomacyRepository(db);
  repo.init();
  const diplomacyService = createFactionDiplomacyService({ diplomacyRepo: repo, config: DCFG });
  const tick = createWorldDiplomacyTickService({ diplomacyService, personalityTuning: PTUNING });
  return { diplomacyService, tick };
}

test('sharedEnemyCount counts a third faction both are hostile toward', () => {
  const { diplomacyService, tick } = setup();
  diplomacyService.applyStateChange('ai_a', 'ai_c', 'hostile', 'now');
  diplomacyService.applyStateChange('ai_b', 'ai_c', 'hostile', 'now');
  assert.equal(tick.sharedEnemyCount('ai_a', 'ai_b', ['ai_a', 'ai_b', 'ai_c']), 1);
  assert.equal(tick.sharedEnemyCount('ai_a', 'ai_c', ['ai_a', 'ai_b', 'ai_c']), 0); // c isn't hostile to itself
});

test('rulerCompat returns compatScore of the two rulers (0 when a ruler is unknown)', () => {
  const { tick } = setup();
  const axes = { boldness: 0.4, sociability: 0.4, integrity: 0.4 };
  const rulerOf = (id) => (id === 'x' ? { personality: personalityCore.normalizePersonality({ axes }, NATURES) }
    : id === 'y' ? { personality: personalityCore.normalizePersonality({ axes }, NATURES) } : null);
  assert.ok(tick.rulerCompat('x', 'y', rulerOf) > 0); // identical axes => positive rapport
  assert.equal(tick.rulerCompat('x', 'unknown', rulerOf), 0);
});

test('advanceAll advances every unordered pair once', () => {
  const { tick } = setup();
  const pairs = tick.advanceAll({ factionIds: ['ai_a', 'ai_b', 'ai_c'], now: 'now' });
  assert.equal(pairs, 3); // C(3,2)
});

// Regression L2: a duplicated faction id must not double-count a shared enemy or create a self-pair.
test('duplicate faction ids are deduped (no double-count, no self-pair)', () => {
  const { diplomacyService, tick } = setup();
  diplomacyService.applyStateChange('ai_a', 'ai_c', 'hostile', 'now');
  diplomacyService.applyStateChange('ai_b', 'ai_c', 'hostile', 'now');
  assert.equal(tick.sharedEnemyCount('ai_a', 'ai_b', ['ai_a', 'ai_b', 'ai_c', 'ai_c']), 1); // c counted once
  assert.equal(tick.advanceAll({ factionIds: ['ai_a', 'ai_b', 'ai_c', 'ai_c'], now: 'now' }), 3); // C(3,2), no c-c self-pair
});

test('shared enemies + compatible rulers drift a pair toward friendly over ticks', () => {
  const { diplomacyService, tick } = setup();
  const ids = ['ai_a', 'ai_b', 'ai_c'];
  // a and b both hate c; a and b have identical rulers (max compat) => favorability should climb.
  diplomacyService.applyStateChange('ai_a', 'ai_c', 'hostile', 'now');
  diplomacyService.applyStateChange('ai_b', 'ai_c', 'hostile', 'now');
  const axes = { boldness: 0.3, sociability: 0.6, integrity: 0.3 };
  const rulerOf = () => ({ personality: personalityCore.normalizePersonality({ axes }, NATURES) });
  const before = diplomacyService.mutualFavorability('ai_a', 'ai_b');
  for (let i = 0; i < 200; i += 1) {
    tick.advanceAll({ factionIds: ids, now: `t${i}`, rulerOf });
  }
  const after = diplomacyService.mutualFavorability('ai_a', 'ai_b');
  assert.ok(after > before, `favorability should rise: before=${before} after=${after}`);
  assert.equal(diplomacyService.state('ai_a', 'ai_b'), 'friendly');
});
