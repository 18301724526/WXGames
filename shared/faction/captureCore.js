// captureCore — pure rules for 占城捕获招降 (task ②b, docs garrison + design/03/08). On winning a
// garrison battle you may CAPTURE the defeated defender general (garrison band captureChance); a
// captured general opens a panel: 斩杀(execute) / 招降(recruit) / 放生(release). 招降 success builds on
// the garrison band's recruitBaseRate + the recruiter ruler's 魅力(charisma) + ruler↔captive 相性
// (personalityCore.compatScore) + relationship ties in your ranks (relationshipCore.recruitModifier),
// capped (硬上限, 保留失败戏剧性); a 宿敌 in your army makes the captive 宁死不降 (success 0).
//
// PURE: the compat value and the relationship modifier are computed by the caller (via personalityCore
// / relationshipCore) and passed in, so captureCore stays a single-purpose math core; all numbers come
// from the passed-in config rows (capture_tuning). rolls are supplied by the caller (seeded RNG).

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function cfgVal(cfg, key, fallback) {
  const v = cfg && typeof cfg === 'object' ? cfg[key] : undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp01(v) {
  return Math.max(0, Math.min(1, toNumber(v, 0)));
}

// Did the defeated defender get captured? captureChance in 0..1 (garrison band), roll in [0,1).
function rollCapture(captureChance, roll) {
  return toNumber(roll, 1) < clamp01(captureChance);
}

// 招降 success probability in [floor, cap]. inputs:
//   recruitBaseRate     0..1  (garrison band recruitBaseRate)
//   rulerCharisma       0..100 (recruiting faction ruler 魅力)
//   rulerCaptiveCompat  -100..100 (personalityCore.compatScore between ruler and captive)
//   relationshipModifier -1..1 (relationshipCore.recruitModifier: friends/sworn +, nemesis -)
//   nemesisInArmy       bool  (captive has a 宿敌 among your officers)
function recruitSuccessChance(inputs, cfg) {
  const p = inputs && typeof inputs === 'object' ? inputs : {};
  const floor = clamp01(cfgVal(cfg, 'recruitFloor', 0));
  const cap = clamp01(cfgVal(cfg, 'recruitCap', 0.9));
  // 宁死不降: a nemesis in your ranks makes recruitment impossible when the hard-refuse flag is set.
  if (p.nemesisInArmy && cfgVal(cfg, 'nemesisHardRefuse', 1) >= 1) return floor;
  const base = clamp01(p.recruitBaseRate);
  const charismaBonus = (Math.max(0, Math.min(100, toNumber(p.rulerCharisma, 0))) / 100) * cfgVal(cfg, 'charismaWeight', 0.3);
  const compatBonus = (Math.max(-100, Math.min(100, toNumber(p.rulerCaptiveCompat, 0))) / 100) * cfgVal(cfg, 'compatWeight', 0.2);
  const relationshipBonus = Math.max(-1, Math.min(1, toNumber(p.relationshipModifier, 0)));
  const chance = base + charismaBonus + compatBonus + relationshipBonus;
  return Math.max(floor, Math.min(cap, chance));
}

// Roll the 招降 outcome given its chance and a [0,1) roll.
function rollRecruit(chance, roll) {
  return toNumber(roll, 1) < clamp01(chance);
}

// Resolve the player's disposition choice into an outcome. `recruitSucceeded` is only consulted for
// the 'recruit' choice (the caller rolls it via rollRecruit first).
function dispositionOutcome(choice, recruitSucceeded, cfg) {
  switch (choice) {
    case 'execute':
      return { kind: 'executed', joinsFaction: false, captiveLost: true };
    case 'recruit':
      return recruitSucceeded
        ? { kind: 'recruited', joinsFaction: true, captiveLost: false }
        : { kind: 'recruitRefused', joinsFaction: false, captiveLost: true };
    case 'release':
      return {
        kind: 'released',
        joinsFaction: false,
        captiveLost: true,
        // 放生 = 仁德: favor/reputation toward the captive's home faction.
        homeFactionFavor: cfgVal(cfg, 'releaseReputation', 3),
      };
    default:
      return { kind: 'none', joinsFaction: false, captiveLost: false };
  }
}

module.exports = {
  rollCapture,
  recruitSuccessChance,
  rollRecruit,
  dispositionOutcome,
};
