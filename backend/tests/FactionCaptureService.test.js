const test = require('node:test');
const assert = require('node:assert/strict');

const { createFactionCaptureService } = require('../services/faction/FactionCaptureService');
const personalityCore = require('../../shared/person/personalityCore');
const ConfigTables = require('../config/ConfigTables');

const NATURES = ConfigTables.getRows('personality_natures');
const PTUNING = Object.fromEntries(ConfigTables.getRows('personality_tuning').map((r) => [r.paramKey, r.value]));

function person(seed, charisma) {
  return {
    id: seed,
    attributes: { charisma },
    personality: personalityCore.assignPersonality(seed, NATURES, PTUNING),
    relationships: [],
  };
}

const svc = createFactionCaptureService();
const BAND = { captureChance: 0.5, recruitBaseRate: 0.4 };

test('rollCapture honors the garrison band captureChance', () => {
  assert.equal(svc.rollCapture(BAND, 0.2), true); // 0.2 < 0.5
  assert.equal(svc.rollCapture(BAND, 0.7), false); // 0.7 >= 0.5
  assert.equal(svc.rollCapture({ captureChance: 0 }, 0), false); // never
});

test('recruitChance adds ruler 魅力 on top of the band base rate', () => {
  const captive = person('cap-1');
  const lowCha = svc.recruitChance(captive, person('ruler-1', 0), () => null, BAND);
  const highCha = svc.recruitChance(captive, person('ruler-1', 100), () => null, BAND);
  assert.ok(highCha > lowCha, `high=${highCha} low=${lowCha}`);
  assert.ok(highCha <= 0.9); // recruitCap
});

test('a 宿敌 in your ranks makes the captive 宁死不降 (chance floors to 0)', () => {
  const captive = person('cap-2', 0);
  captive.relationships = [{ toPersonId: 'enemy-x', affinity: -90, meetCount: 4, flags: { rival_declared: true } }];
  const inFactionKind = (pid) => (pid === 'enemy-x' ? 'nemesis' : null);
  const chance = svc.recruitChance(captive, person('ruler-2', 100), inFactionKind, BAND);
  assert.equal(chance, 0);
});

test('a sworn brother already serving you lifts the 招降 chance', () => {
  const captive = person('cap-3', 0);
  captive.relationships = [{ toPersonId: 'bro-x', affinity: 90, meetCount: 6, flags: { sworn: true } }];
  const withBro = svc.recruitChance(captive, person('ruler-3', 0), (pid) => (pid === 'bro-x' ? 'sworn' : null), BAND);
  const without = svc.recruitChance(captive, person('ruler-3', 0), () => null, BAND);
  assert.ok(withBro > without, `withBro=${withBro} without=${without}`);
});

test('resolveDisposition: execute drops the captive, release grants 仁德 favor', () => {
  const exe = svc.resolveDisposition('execute', null, null);
  assert.equal(exe.kind, 'executed');
  assert.equal(exe.joinsFaction, false);

  const rel = svc.resolveDisposition('release', null, null);
  assert.equal(rel.kind, 'released');
  assert.ok(rel.homeFactionFavor > 0);
});

test('resolveDisposition: recruit joins on a winning roll, refuses otherwise', () => {
  const win = svc.resolveDisposition('recruit', 0.8, 0.1); // 0.1 < 0.8
  assert.equal(win.kind, 'recruited');
  assert.equal(win.joinsFaction, true);
  assert.equal(win.recruitChance, 0.8);

  const lose = svc.resolveDisposition('recruit', 0.3, 0.9); // 0.9 >= 0.3
  assert.equal(lose.kind, 'recruitRefused');
  assert.equal(lose.joinsFaction, false);
});
