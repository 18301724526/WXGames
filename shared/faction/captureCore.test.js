const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('./captureCore');
const ConfigTables = require('../../backend/config/ConfigTables');

const CFG = Object.fromEntries(
  ConfigTables.getRows('capture_tuning').map((row) => [row.paramKey, row.value]),
);

test('config loads: capture tuning present', () => {
  assert.equal(CFG.recruitCap, 0.9);
  assert.equal(CFG.charismaWeight, 0.3);
});

test('rollCapture: captured iff roll < captureChance', () => {
  assert.equal(core.rollCapture(0.25, 0.1), true);
  assert.equal(core.rollCapture(0.25, 0.3), false);
  assert.equal(core.rollCapture(0, 0), false); // 0 chance never captures
});

test('recruitSuccessChance: base + charisma + compat + relationship, capped', () => {
  const low = core.recruitSuccessChance({ recruitBaseRate: 0.4, rulerCharisma: 0, rulerCaptiveCompat: 0, relationshipModifier: 0 }, CFG);
  assert.ok(Math.abs(low - 0.4) < 1e-9);
  // high charisma + good compat + sworn friend in ranks -> higher, but capped at 0.9
  const high = core.recruitSuccessChance({ recruitBaseRate: 0.5, rulerCharisma: 100, rulerCaptiveCompat: 100, relationshipModifier: 0.4 }, CFG);
  assert.equal(high, 0.9); // 0.5+0.3+0.2+0.4 = 1.4 -> capped
  // negative compat lowers it
  const clash = core.recruitSuccessChance({ recruitBaseRate: 0.5, rulerCharisma: 0, rulerCaptiveCompat: -100, relationshipModifier: 0 }, CFG);
  assert.ok(clash < 0.5 && clash >= 0);
});

test('recruitSuccessChance: 宿敌在军中 -> 宁死不降 (success 0)', () => {
  const refuse = core.recruitSuccessChance(
    { recruitBaseRate: 0.9, rulerCharisma: 100, rulerCaptiveCompat: 100, relationshipModifier: 0.4, nemesisInArmy: true },
    CFG,
  );
  assert.equal(refuse, 0); // hard refuse overrides everything
});

test('rollRecruit + dispositionOutcome for each choice', () => {
  assert.equal(core.rollRecruit(0.6, 0.5), true);
  assert.equal(core.rollRecruit(0.6, 0.7), false);

  assert.deepEqual(core.dispositionOutcome('execute', false, CFG), { kind: 'executed', joinsFaction: false, captiveLost: true });
  assert.deepEqual(core.dispositionOutcome('recruit', true, CFG), { kind: 'recruited', joinsFaction: true, captiveLost: false });
  assert.deepEqual(core.dispositionOutcome('recruit', false, CFG), { kind: 'recruitRefused', joinsFaction: false, captiveLost: true });
  const released = core.dispositionOutcome('release', false, CFG);
  assert.equal(released.kind, 'released');
  assert.equal(released.homeFactionFavor, CFG.releaseReputation);
});
