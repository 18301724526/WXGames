const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateService = require('../services/GameStateService');
const TalentPolicyService = require('../services/TalentPolicyService');

test('initial client state exposes talent policy presets and allocation preview', () => {
  const state = GameStateService.createInitialGameState('talent-preview');
  const normalized = GameStateService.normalizeState(state);
  const client = GameStateService.getClientGameState(normalized);

  assert.equal(client.talentPolicies.activePolicyId, 'balanced');
  assert.ok(client.talentPolicies.systemPolicies.some((policy) => policy.id === 'agriculture'));
  assert.deepEqual(client.talentPolicies.preview.allocation, {
    farmer: 2,
    scholar: 1,
    craftsman: 0,
  });
});

test('era 1 policy application never allocates locked craftsman role', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('talent-era1'));
  state.currentEra = 1;
  state.population = {
    total: 3,
    max: 3,
    maxPop: 3,
    farmers: 2,
    scholars: 1,
    craftsmen: 0,
    unassigned: 0,
    growthProgress: 50,
  };
  state.cities.capital.population = { ...state.population };

  const result = TalentPolicyService.applyPolicy(state, state.tutorial, { policyId: 'industry' });

  assert.equal(result.success, false);
  assert.equal(result.error, 'TALENT_POLICY_LOCKED');

  const balanced = TalentPolicyService.applyPolicy(state, state.tutorial, { policyId: 'balanced' });
  assert.equal(balanced.success, true);
  assert.equal(state.population.craftsmen, 0);
  assert.equal(state.population.farmers + state.population.scholars + state.population.unassigned, 3);
  assert.equal(state.population.growthProgress, 50);
});

test('industry policy allocates craftsmen after the role is unlocked', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('talent-era2'));
  state.currentEra = 2;
  state.population = {
    total: 3,
    max: 3,
    maxPop: 3,
    farmers: 3,
    scholars: 0,
    craftsmen: 0,
    unassigned: 0,
    growthProgress: 30,
  };
  state.cities.capital.population = { ...state.population };

  const result = TalentPolicyService.applyPolicy(state, state.tutorial, { policyId: 'industry' });

  assert.equal(result.success, true);
  assert.equal(state.population.total, 3);
  assert.equal(state.population.craftsmen, 2);
  assert.equal(state.population.unassigned, 0);
  assert.equal(state.population.growthProgress, 30);
});

test('custom tier policy can be saved, applied, and deleted', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('talent-custom'));
  state.currentEra = 2;
  state.population = {
    total: 3,
    max: 3,
    maxPop: 3,
    farmers: 3,
    scholars: 0,
    craftsmen: 0,
    unassigned: 0,
    growthProgress: 0,
  };
  state.cities.capital.population = { ...state.population };

  const saved = TalentPolicyService.saveCustomPolicy(state, {
    basePolicyId: 'balanced',
    tiers: { agriculture: 1, knowledge: 2, industry: 3 },
  });

  assert.equal(saved.success, true);
  assert.match(saved.policy.displayName, /工业/);
  assert.equal(state.talentPolicies.custom.length, 1);

  const applied = TalentPolicyService.applyPolicy(state, state.tutorial, { policyId: saved.policy.id });
  assert.equal(applied.success, true);
  assert.equal(state.population.craftsmen > state.population.scholars, true);

  const deleted = TalentPolicyService.deleteCustomPolicy(state, { policyId: saved.policy.id });
  assert.equal(deleted.success, true);
  assert.equal(state.talentPolicies.custom.length, 0);
});

test('draft policy application preserves the active draft label in client state', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('talent-draft'));
  state.currentEra = 2;

  const applied = TalentPolicyService.applyPolicy(state, state.tutorial, {
    basePolicyId: 'balanced',
    tiers: { agriculture: 3, knowledge: 2, industry: 1 },
  });
  const client = TalentPolicyService.getClientState(state);

  assert.equal(applied.success, true);
  assert.equal(client.activePolicyId, 'draft');
  assert.equal(client.activePolicyLabel, '均衡发展·偏农业');
  assert.equal(client.activeDraft.displayName, '均衡发展·偏农业');
});
