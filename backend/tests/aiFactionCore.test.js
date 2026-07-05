const test = require('node:test');
const assert = require('node:assert/strict');

const aiFactionCore = require('../../shared/faction/aiFactionCore');
const personalityCore = require('../../shared/person/personalityCore');
const ConfigTables = require('../config/ConfigTables');

const NATURES = ConfigTables.getRows('personality_natures');
const PROFILES = ConfigTables.getRows('ai_faction_profile');
const profile = (id) => PROFILES.find((p) => p.profileId === id);

// A ruler with a chosen nature (so aggression is well-defined). valiant = aggression 70; stoic = 25.
function ruler(natureId) {
  const row = NATURES.find((n) => n.natureId === natureId);
  return { nature: natureId, axes: { boldness: row.aBoldness, sociability: row.aSociability, integrity: row.aIntegrity } };
}

test('ai_faction_profile config table loaded with the four archetypes', () => {
  assert.deepEqual(PROFILES.map((p) => p.profileId).sort(), ['aggressive', 'balanced', 'diplomatic', 'economic']);
});

test('rulerAggression reads the single source (personality_natures.aggression)', () => {
  assert.ok(aiFactionCore.rulerAggression(ruler('valiant'), NATURES) > aiFactionCore.rulerAggression(ruler('stoic'), NATURES));
  assert.equal(aiFactionCore.rulerAggression({ nature: 'unknown' }, NATURES), 0.5); // neutral fallback
});

test('personalityToWeights: aggressive ruler leans expand; economic profile leans build; sums to 1', () => {
  const wAgg = aiFactionCore.personalityToWeights(ruler('reckless'), profile('aggressive'), NATURES); // aggression 80
  const wEco = aiFactionCore.personalityToWeights(ruler('stoic'), profile('economic'), NATURES); // aggression 25
  assert.ok(Math.abs(Object.values(wAgg).reduce((s, x) => s + x, 0) - 1) < 1e-9);
  assert.ok(wAgg.expand > wEco.expand, `agg expand ${wAgg.expand} vs eco ${wEco.expand}`);
  assert.ok(wEco.build > wAgg.build);
});

test('scoreExpansionTargets excludes out-of-range, own, and spawn-protected players', () => {
  const targets = aiFactionCore.scoreExpansionTargets([
    { territoryId: 'far', distance: 50, ownerKind: 'neutral', value: 9 },
    { territoryId: 'self', distance: 1, ownerKind: 'self', value: 9 },
    { territoryId: 'protP', distance: 3, ownerKind: 'player', value: 9, protected: true },
    { territoryId: 'neu', distance: 4, ownerKind: 'neutral', value: 5, defenderSoldiers: 0 },
    { territoryId: 'openP', distance: 5, ownerKind: 'player', value: 5, defenderSoldiers: 100 },
  ], { expansionRange: 14, targetPlayerBias: 0.6 });
  const ids = targets.map((t) => t.territoryId);
  assert.ok(!ids.includes('far') && !ids.includes('self') && !ids.includes('protP'));
  assert.ok(ids.includes('neu') && ids.includes('openP'));
});

test('targetPlayerBias lifts a player city above an equal neutral one', () => {
  const targets = aiFactionCore.scoreExpansionTargets([
    { territoryId: 'neu', distance: 5, ownerKind: 'neutral', value: 5, defenderSoldiers: 100 },
    { territoryId: 'ply', distance: 5, ownerKind: 'player', value: 5, defenderSoldiers: 100 },
  ], { expansionRange: 14, targetPlayerBias: 0.8 });
  assert.equal(targets[0].territoryId, 'ply');
});

test('scoreRecruitCandidates ranks by quality + role gap', () => {
  const ranked = aiFactionCore.scoreRecruitCandidates([
    { personId: 'a', quality: 'common', primaryRole: 'general' },
    { personId: 'b', quality: 'legendary', primaryRole: 'general' },
    { personId: 'c', quality: 'common', primaryRole: 'strategist' },
  ], { roleGaps: ['strategist'] });
  assert.equal(ranked[0].personId, 'b'); // legendary wins outright
  assert.ok(ranked.findIndex((r) => r.personId === 'c') < ranked.findIndex((r) => r.personId === 'a')); // role-gap lifts c over a
});

test('chooseFactionActions is budget-bounded, deterministic, and situation-aware', () => {
  const snapshot = {
    profileRow: profile('aggressive'),
    natures: NATURES,
    faction: {
      factionId: 'ai_1',
      actionBudget: 3,
      rulerPersonality: ruler('reckless'),
      canResearch: true,
      nextResearchId: 'tech_x',
      cities: [{ cityId: 'c1', soldiers: 500, canBuild: true, nextBuildingId: 'barracks' }],
    },
  };
  const world = {
    expansionCandidates: [{ territoryId: 't_neu', distance: 3, ownerKind: 'neutral', value: 6, defenderSoldiers: 0 }],
    roamingPeople: [{ personId: 'wp', quality: 'good', primaryRole: 'general' }],
  };
  const a = aiFactionCore.chooseFactionActions(snapshot, world, personalityCore.makePrng('seed1'));
  const b = aiFactionCore.chooseFactionActions(snapshot, world, personalityCore.makePrng('seed1'));
  assert.deepEqual(a, b); // deterministic from seed
  assert.ok(a.length >= 1 && a.length <= 3); // budget-bounded
  assert.ok(a.every((i) => Object.values(aiFactionCore.ACTIONS).includes(i.type)));
});

test('a weak faction with an attack target trains instead of attacking', () => {
  const snapshot = {
    profileRow: profile('aggressive'), // minSoldiersToAttack 300
    natures: NATURES,
    faction: { factionId: 'ai_2', actionBudget: 1, rulerPersonality: ruler('valiant'), cities: [{ cityId: 'c1', soldiers: 100 }] },
  };
  const world = { expansionCandidates: [{ territoryId: 't_def', distance: 4, ownerKind: 'neutral', value: 8, defenderSoldiers: 400 }] };
  const intents = aiFactionCore.chooseFactionActions(snapshot, world, personalityCore.makePrng('s'));
  assert.equal(intents[0].type, aiFactionCore.ACTIONS.TRAIN);
});

test('nothing to do yields a single IDLE intent', () => {
  const snapshot = { profileRow: profile('balanced'), natures: NATURES, faction: { factionId: 'ai_3', actionBudget: 2, rulerPersonality: ruler('stoic'), cities: [] } };
  const intents = aiFactionCore.chooseFactionActions(snapshot, {}, personalityCore.makePrng('s'));
  assert.deepEqual(intents, [{ type: aiFactionCore.ACTIONS.IDLE }]);
});
