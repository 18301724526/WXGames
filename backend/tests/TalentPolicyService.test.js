const test = require('node:test');
const assert = require('node:assert/strict');

const TalentPolicyService = require('../services/TalentPolicyService');

test('TalentPolicyService creates crypto-backed custom policy ids', () => {
  const id = TalentPolicyService.createCustomPolicyId(
    new Date('2026-06-09T00:00:00.000Z').getTime(),
    Buffer.from([0xab, 0xcd, 0xef]),
  );

  assert.equal(id, 'custom_mq5vi800_abcdef');
  assert.match(TalentPolicyService.createCustomPolicyId(), /^custom_[a-z0-9]+_[a-f0-9]{6}$/);
});

test('TalentPolicyService saves custom policies with generated ids and keeps explicit ids stable', () => {
  const gameState = {
    currentEra: 2,
    population: { farmers: 2, scholars: 1, craftsmen: 1, unassigned: 0 },
    talentPolicies: TalentPolicyService.createInitialTalentPolicyState(),
  };

  const generated = TalentPolicyService.saveCustomPolicy(gameState, {
    basePolicyId: 'balanced',
    tiers: { agriculture: 3, knowledge: 2, industry: 1 },
  });
  const explicit = TalentPolicyService.saveCustomPolicy(gameState, {
    policyId: 'custom_manual',
    basePolicyId: 'balanced',
    tiers: { agriculture: 2, knowledge: 3, industry: 1 },
  });

  assert.equal(generated.success, true);
  assert.match(generated.policy.id, /^custom_[a-z0-9]+_[a-f0-9]{6}$/);
  assert.equal(explicit.policy.id, 'custom_manual');
  assert.equal(gameState.talentPolicies.custom.length, 2);
});
