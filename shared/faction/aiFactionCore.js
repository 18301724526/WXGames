// aiFactionCore — PURE decision rules for AI 势力 (docs/design/05, slice AIF-4; decisions 08 §05). Given
// a faction snapshot + a world snapshot + a seeded RNG, it produces a bounded list of ActionIntents for
// this thinking cycle. No IO, no state mutation, deterministic — the AiFactionService (later slice) reads
// the DB, builds the snapshots, calls this, and executes the intents.
//
// Single source (respecting doc-05's adversarial review):
//  - 好战 aggression has ONE authoritative home: the ruler's personality nature (personality_natures.
//    aggression). This core derives the effective bias fresh from the ruler's personality; it never reads
//    or stores a duplicated faction.aggression field. The ai_faction_profile row supplies only the
//    ARCHETYPE baseline action weights; personality MODULATES them.
//  - Spawn-protected players (decision 05-1) are excluded from attack candidates here, so the AI never
//    targets a protected player regardless of scores.
//  - All numbers come from the passed-in config rows; rolls come from the injected RNG.

const personalityCore = require('../person/personalityCore');

const ACTIONS = Object.freeze({
  SETTLE_NEUTRAL: 'SETTLE_NEUTRAL', // claim an undefended neutral city (no battle)
  ATTACK_CITY: 'ATTACK_CITY',       // march on a defended neutral / AI / player city (battle)
  BUILD: 'BUILD',
  RESEARCH: 'RESEARCH',
  RECRUIT_OFFICER: 'RECRUIT_OFFICER',
  TRAIN: 'TRAIN',                   // conscript when too weak to attack
  DIPLOMACY: 'DIPLOMACY',
  IDLE: 'IDLE',
});

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp01(v) {
  return Math.max(0, Math.min(1, num(v, 0)));
}

const QUALITY_RANK = { common: 1, good: 2, great: 3, legendary: 4 };
function qualityRank(q) {
  return QUALITY_RANK[q] || 1;
}

// The ruler's 0..1 aggression, authoritative source = personality nature (personality_natures.aggression
// is on a 0..100 scale). Falls back to a neutral 0.5 when unknown.
function rulerAggression(rulerPersonality, natures) {
  const nature = rulerPersonality && rulerPersonality.nature ? rulerPersonality.nature : null;
  return clamp01(personalityCore.behaviorMult(nature, 'aggression', natures, 50) / 100);
}

// The ruler's 0..1 sociability (from the personality axes, -1..1 → 0..1). Drives recruit/diplomacy lean.
function rulerSociability(rulerPersonality) {
  const s = rulerPersonality && rulerPersonality.axes ? num(rulerPersonality.axes.sociability, 0) : 0;
  return clamp01((s + 1) / 2);
}

// Archetype baseline weights (profile row) modulated by the ruler's personality, normalized to sum 1.
// Returns {expand, build, research, recruit, diplo}.
function personalityToWeights(rulerPersonality, profileRow, natures) {
  const p = profileRow || {};
  const aggression = rulerAggression(rulerPersonality, natures); // 0..1
  const sociability = rulerSociability(rulerPersonality); // 0..1
  const expandMult = 0.5 + aggression; // 0.5..1.5
  const socialMult = 0.5 + sociability; // 0.5..1.5
  const raw = {
    expand: num(p.weightExpand, 0.25) * expandMult,
    build: num(p.weightBuild, 0.25),
    research: num(p.weightResearch, 0.2),
    recruit: num(p.weightRecruit, 0.15) * socialMult,
    diplo: num(p.weightDiplomacy, 0.15) * socialMult,
  };
  const total = Object.values(raw).reduce((s, w) => s + Math.max(0, w), 0) || 1;
  const out = {};
  for (const k of Object.keys(raw)) out[k] = Math.max(0, raw[k]) / total;
  return out;
}

// Score expansion/attack candidates. candidates: [{territoryId, distance, ownerKind:'neutral'|'player'|
// 'ai', defenderSoldiers, value, protected}]. opts: {expansionRange, targetPlayerBias, aggression}.
// Excludes out-of-range, own cities (ownerKind==='self'), and spawn-protected players. Returns sorted desc.
function scoreExpansionTargets(candidates, opts = {}) {
  const range = Math.max(1, num(opts.expansionRange, 12));
  const playerBias = clamp01(opts.targetPlayerBias);
  const list = Array.isArray(candidates) ? candidates : [];
  const scored = [];
  for (const c of list) {
    if (!c || c.ownerKind === 'self') continue;
    const distance = num(c.distance, Infinity);
    if (distance > range) continue;
    if (c.ownerKind === 'player' && c.protected) continue; // spawn protection (05-1)
    const value = Math.max(0, num(c.value, 1));
    const defense = Math.max(0, num(c.defenderSoldiers, 0));
    const distanceDecay = Math.max(0, 1 - distance / range);
    const ownerMult = c.ownerKind === 'player' ? 1 + playerBias : 1;
    const score = (value / (1 + defense / 100)) * (0.3 + 0.7 * distanceDecay) * ownerMult;
    scored.push({ territoryId: c.territoryId, ownerKind: c.ownerKind, defenderSoldiers: defense, distance, score });
  }
  scored.sort((a, b) => b.score - a.score || String(a.territoryId).localeCompare(String(b.territoryId)));
  return scored;
}

// Score roaming (在野) people for 登用. people: [{personId, quality, primaryRole}]. opts.roleGaps: Set/array
// of role keys the faction is missing (bonus). compat placeholder = 0 until the ruler↔candidate compat is
// wired by the caller. Returns sorted desc.
function scoreRecruitCandidates(people, opts = {}) {
  const gaps = new Set(Array.isArray(opts.roleGaps) ? opts.roleGaps : []);
  const list = Array.isArray(people) ? people : [];
  const scored = list
    .filter((p) => p && p.personId)
    .map((p) => ({
      personId: p.personId,
      score: qualityRank(p.quality) + (gaps.has(p.primaryRole) ? 1.5 : 0) + num(p.compat, 0) / 100,
    }));
  scored.sort((a, b) => b.score - a.score || String(a.personId).localeCompare(String(b.personId)));
  return scored;
}

// Which action categories are viable given the situation, and the concrete intent each would emit.
function availableActions(snapshot, world) {
  const faction = snapshot.faction || {};
  const cities = Array.isArray(faction.cities) ? faction.cities : [];
  const profile = snapshot.profileRow || {};
  const minSoldiers = num(profile.minSoldiersToAttack, 300);
  const strongestCity = cities.reduce((best, c) => (num(c && c.soldiers) > num(best && best.soldiers) ? c : best), null);
  const available = {};

  const targets = scoreExpansionTargets(world.expansionCandidates, {
    expansionRange: profile.expansionRange,
    targetPlayerBias: profile.targetPlayerBias,
  });
  const undefended = targets.find((t) => t.ownerKind === 'neutral' && t.defenderSoldiers <= 0);
  if (undefended) available.expandSettle = { type: ACTIONS.SETTLE_NEUTRAL, targetTerritoryId: undefended.territoryId };
  const attackTarget = targets.find((t) => t.defenderSoldiers > 0);
  if (attackTarget) {
    if (strongestCity && num(strongestCity.soldiers) >= minSoldiers) {
      available.expandAttack = { type: ACTIONS.ATTACK_CITY, targetTerritoryId: attackTarget.territoryId, fromCityId: strongestCity.cityId };
    } else if (strongestCity) {
      // wants to attack but too weak → train first
      available.train = { type: ACTIONS.TRAIN, cityId: strongestCity.cityId };
    }
  }

  const buildable = cities.find((c) => c && c.canBuild && c.nextBuildingId);
  if (buildable) available.build = { type: ACTIONS.BUILD, cityId: buildable.cityId, buildingId: buildable.nextBuildingId };

  if (faction.canResearch && faction.nextResearchId) available.research = { type: ACTIONS.RESEARCH, nodeId: faction.nextResearchId };

  const recruits = scoreRecruitCandidates(world.roamingPeople, { roleGaps: faction.roleGaps });
  if (recruits.length) available.recruit = { type: ACTIONS.RECRUIT_OFFICER, personId: recruits[0].personId };

  if (Array.isArray(world.diplomacyOptions) && world.diplomacyOptions.length) {
    available.diplo = { type: ACTIONS.DIPLOMACY, ...world.diplomacyOptions[0] };
  }
  return available;
}

// Map an available-category key to its decision weight.
function categoryWeight(key, weights) {
  switch (key) {
    case 'expandSettle': case 'expandAttack': case 'train': return weights.expand;
    case 'build': return weights.build;
    case 'research': return weights.research;
    case 'recruit': return weights.recruit;
    case 'diplo': return weights.diplo;
    default: return 0;
  }
}

// Produce up to actionBudget intents for this cycle. rng is a seeded [0,1) function.
function chooseFactionActions(snapshot, world = {}, rng) {
  const faction = (snapshot && snapshot.faction) || {};
  const roll = typeof rng === 'function' ? rng : personalityCore.makePrng(`ai:${faction.factionId || 'x'}`);
  const budget = Math.max(0, Math.floor(num(faction.actionBudget, 3)));
  const weights = personalityToWeights(faction.rulerPersonality, snapshot.profileRow, snapshot.natures);
  const intents = [];
  const usedSingletons = new Set(); // don't pick the same one-shot category twice in a cycle

  for (let i = 0; i < budget; i += 1) {
    const available = availableActions({ ...snapshot, faction }, world);
    const keys = Object.keys(available).filter((k) => !usedSingletons.has(k));
    if (!keys.length) break;
    const wts = keys.map((k) => Math.max(0.0001, categoryWeight(k, weights)));
    const idx = weightedPick(wts, roll());
    const key = keys[idx];
    intents.push(available[key]);
    usedSingletons.add(key);
  }
  if (!intents.length) intents.push({ type: ACTIONS.IDLE });
  return intents;
}

// Weighted index pick over weights via a [0,1) roll (uniform fallback on zero total).
function weightedPick(weights, r) {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return Math.min(weights.length - 1, Math.floor(num(r) * weights.length));
  let target = num(r) * total;
  for (let i = 0; i < weights.length; i += 1) {
    target -= Math.max(0, weights[i]);
    if (target < 0) return i;
  }
  return weights.length - 1;
}

module.exports = {
  ACTIONS,
  rulerAggression,
  rulerSociability,
  personalityToWeights,
  scoreExpansionTargets,
  scoreRecruitCandidates,
  availableActions,
  chooseFactionActions,
  weightedPick,
};
