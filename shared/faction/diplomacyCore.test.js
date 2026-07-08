const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('./diplomacyCore');
const ConfigTables = require('../../backend/config/ConfigTables');

const CFG = Object.fromEntries(
  ConfigTables.getRows('diplomacy_tuning').map((row) => [row.paramKey, row.value]),
);

test('config loads: diplomacy thresholds present', () => {
  assert.equal(CFG.friendlyAt, 40);
  assert.equal(CFG.hostileAt, -40);
  assert.equal(CFG.nemesisAt, -80);
});

test('mutualFavorability takes the min (one cold side caps the relation)', () => {
  assert.equal(core.mutualFavorability(80, 10), 10);
  assert.equal(core.mutualFavorability(-30, 50), -30);
});

test('passiveTransition: neutral climbs to friendly / falls to hostile by mutualFav', () => {
  assert.equal(core.passiveTransition('neutral', 45, 0, CFG).state, 'friendly');
  assert.equal(core.passiveTransition('neutral', -50, 0, CFG).state, 'hostile');
  assert.equal(core.passiveTransition('neutral', 10, 0, CFG).state, 'neutral');
});

test('passiveTransition: hysteresis keeps friendly/hostile until it crosses the exit band', () => {
  assert.equal(core.passiveTransition('friendly', 30, 0, CFG).state, 'friendly'); // above exit 25
  assert.equal(core.passiveTransition('friendly', 20, 0, CFG).state, 'neutral');  // below exit
  assert.equal(core.passiveTransition('hostile', -30, 0, CFG).state, 'hostile');  // below exit -25
  assert.equal(core.passiveTransition('hostile', -10, 0, CFG).state, 'neutral');  // recovered
});

test('passiveTransition: hostile escalates to nemesis only after sustained low favorability', () => {
  let streak = 0;
  let state = 'hostile';
  for (let i = 0; i < CFG.nemesisTicks - 1; i += 1) {
    const r = core.passiveTransition(state, -90, streak, CFG);
    state = r.state; streak = r.nemesisStreak;
  }
  assert.equal(state, 'hostile'); // not yet
  const final = core.passiveTransition(state, -90, streak, CFG);
  assert.equal(final.state, 'nemesis'); // sustained -> nemesis
  // recovery from nemesis
  assert.equal(core.passiveTransition('nemesis', 0, 30, CFG).state, 'neutral');
});

test('actionTransition: war/alliance/break/peace', () => {
  assert.equal(core.actionTransition('neutral', 'declareWar', {}, CFG), 'hostile');
  assert.equal(core.actionTransition('allied', 'declareWar', {}, CFG), 'hostile'); // betrayal
  assert.equal(core.actionTransition('hostile', 'declareWar', {}, CFG), null); // already at war
  // alliance needs the other side's favorability high enough
  assert.equal(core.actionTransition('friendly', 'acceptAlliance', { theirFavorabilityToUs: 60 }, CFG), 'allied');
  assert.equal(core.actionTransition('friendly', 'acceptAlliance', { theirFavorabilityToUs: 20 }, CFG), null);
  assert.equal(core.actionTransition('hostile', 'acceptAlliance', { theirFavorabilityToUs: 90 }, CFG), null);
  assert.equal(core.actionTransition('allied', 'breakAlliance', {}, CFG), 'neutral');
  assert.equal(core.actionTransition('hostile', 'sueForPeace', {}, CFG), 'neutral');
});

test('actionFavorabilityDelta: betrayal hurts far more than an honest war declaration', () => {
  assert.ok(core.actionFavorabilityDelta('betrayAlliance', CFG) < core.actionFavorabilityDelta('declareWar', CFG));
  assert.ok(core.actionFavorabilityDelta('gift', CFG) > 0);
});

test('favorabilityDrift: decays toward 0, shared enemies raise, border pressure lowers', () => {
  assert.ok(core.favorabilityDrift({ favorability: 50 }, {}, CFG) < 0); // decays down
  assert.ok(core.favorabilityDrift({ favorability: -50 }, {}, CFG) > 0); // decays up
  const withEnemies = core.favorabilityDrift({ favorability: 0 }, { sharedEnemies: 3 }, CFG);
  assert.ok(withEnemies > 0); // 敌人的敌人是朋友
  const bordering = core.favorabilityDrift({ favorability: 0 }, { bordering: true }, CFG);
  assert.ok(bordering < 0); // 接壤压力
});

test('stateEffects: allied shares vision + no attack; hostile/nemesis are war', () => {
  assert.equal(core.stateEffects('allied').sharedVision, true);
  assert.equal(core.stateEffects('allied').canAttack, false);
  assert.equal(core.canAttack('hostile'), true);
  assert.equal(core.canAttack('nemesis'), true);
  assert.equal(core.stateEffects('nemesis').atWar, true);
});
