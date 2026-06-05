const TutorialService = require('./TutorialService');
const CityService = require('./CityService');

const DEFAULT_TIERS = Object.freeze({
  agriculture: 2,
  knowledge: 2,
  industry: 2,
});

const ROLE_DEFINITIONS = Object.freeze({
  farmer: {
    label: '农民',
    populationKey: 'farmers',
    minEra: 0,
  },
  scholar: {
    label: '学者',
    populationKey: 'scholars',
    minEra: 0,
  },
  craftsman: {
    label: '工匠',
    populationKey: 'craftsmen',
    minEra: 2,
  },
});

const TENDENCY_DEFINITIONS = Object.freeze([
  {
    id: 'agriculture',
    label: '农业',
    role: 'farmer',
    descriptions: ['维持基础耕作', '稳态耕作', '偏重农业'],
  },
  {
    id: 'knowledge',
    label: '知识',
    role: 'scholar',
    descriptions: ['保留传承', '稳态传承', '偏重知识'],
  },
  {
    id: 'industry',
    label: '工业',
    role: 'craftsman',
    minEra: 2,
    descriptions: ['少量工匠', '稳态工匠', '偏重工业'],
  },
]);

const SYSTEM_POLICIES = Object.freeze([
  {
    id: 'balanced',
    label: '均衡发展',
    description: '维持食物、知识与工艺的稳定分工。',
    weights: { farmer: 2, scholar: 1, craftsman: 1 },
    priority: ['farmer', 'scholar', 'craftsman'],
  },
  {
    id: 'agriculture',
    label: '农业优先',
    description: '优先保证食物供给和人口成长。',
    weights: { farmer: 4, scholar: 1, craftsman: 1 },
    priority: ['farmer', 'scholar', 'craftsman'],
  },
  {
    id: 'knowledge',
    label: '知识优先',
    description: '保留基础生产，更多人才转向知识积累。',
    weights: { farmer: 2, scholar: 3, craftsman: 1 },
    priority: ['scholar', 'farmer', 'craftsman'],
  },
  {
    id: 'industry',
    label: '工业优先',
    description: '解锁工匠后，优先支持建造与工艺生产。',
    weights: { farmer: 2, scholar: 1, craftsman: 3 },
    priority: ['craftsman', 'farmer', 'scholar'],
    minEra: 2,
  },
  {
    id: 'expansion',
    label: '扩张准备',
    description: '兼顾食物储备与建设能力，适合连续建造。',
    weights: { farmer: 3, scholar: 1, craftsman: 2 },
    priority: ['farmer', 'craftsman', 'scholar'],
  },
]);

function clampTier(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return 2;
  return Math.max(1, Math.min(3, number));
}

function normalizeTiers(tiers = {}) {
  return Object.keys(DEFAULT_TIERS).reduce((result, key) => {
    result[key] = clampTier(tiers[key] ?? DEFAULT_TIERS[key]);
    return result;
  }, {});
}

function getSystemPolicy(policyId) {
  return SYSTEM_POLICIES.find((policy) => policy.id === policyId) || SYSTEM_POLICIES[0];
}

function normalizeCustomPolicy(raw = {}) {
  const basePolicyId = getSystemPolicy(raw.basePolicyId || raw.baseId || 'balanced').id;
  const tiers = normalizeTiers(raw.tiers);
  const id = String(raw.id || '').trim();
  if (!id) return null;
  return {
    id,
    type: 'custom',
    basePolicyId,
    displayName: makeCustomPolicyName(basePolicyId, tiers),
    tiers,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function normalizeTalentPolicyState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const custom = Array.isArray(source.custom)
    ? source.custom.map(normalizeCustomPolicy).filter(Boolean).slice(0, 8)
    : [];
  const activePolicyId = String(source.activePolicyId || 'balanced');
  return {
    activePolicyId,
    activeDraft: source.activeDraft && typeof source.activeDraft === 'object'
      ? {
        id: 'draft',
        type: 'draft',
        basePolicyId: getSystemPolicy(source.activeDraft.basePolicyId || 'balanced').id,
        displayName: makeCustomPolicyName(source.activeDraft.basePolicyId || 'balanced', source.activeDraft.tiers),
        tiers: normalizeTiers(source.activeDraft.tiers),
        updatedAt: source.activeDraft.updatedAt || null,
      }
      : null,
    custom,
    lastAppliedAt: source.lastAppliedAt || null,
  };
}

function createInitialTalentPolicyState() {
  return normalizeTalentPolicyState({
    activePolicyId: 'balanced',
    custom: [],
  });
}

function ensureTalentPolicyState(gameState) {
  gameState.talentPolicies = normalizeTalentPolicyState(gameState.talentPolicies);
  return gameState.talentPolicies;
}

function getAvailableRoleIds(currentEra) {
  return Object.entries(ROLE_DEFINITIONS)
    .filter(([, role]) => (Number(currentEra) || 0) >= (role.minEra || 0))
    .map(([id]) => id);
}

function getAvailableTendencies(currentEra) {
  const era = Number(currentEra) || 0;
  return TENDENCY_DEFINITIONS.map((item) => {
    const role = ROLE_DEFINITIONS[item.role] || {};
    const minEra = Math.max(item.minEra || 0, role.minEra || 0);
    return {
      id: item.id,
      label: item.label,
      role: item.role,
      minEra,
      disabled: era < minEra,
      descriptions: item.descriptions,
    };
  });
}

function getPolicyById(gameState, policyId) {
  const id = String(policyId || '');
  const system = SYSTEM_POLICIES.find((policy) => policy.id === id);
  if (system) return { ...system, type: 'system', tiers: DEFAULT_TIERS };
  const state = ensureTalentPolicyState(gameState);
  if (id === 'draft' && state.activeDraft) {
    const base = getSystemPolicy(state.activeDraft.basePolicyId);
    return {
      ...base,
      id: 'draft',
      type: 'draft',
      label: state.activeDraft.displayName,
      displayName: state.activeDraft.displayName,
      basePolicyId: state.activeDraft.basePolicyId,
      tiers: state.activeDraft.tiers,
    };
  }
  const custom = state.custom.find((policy) => policy.id === id);
  if (!custom) return null;
  const base = getSystemPolicy(custom.basePolicyId);
  return {
    ...base,
    id: custom.id,
    type: 'custom',
    label: custom.displayName,
    displayName: custom.displayName,
    basePolicyId: custom.basePolicyId,
    tiers: custom.tiers,
  };
}

function buildDraftPolicy(payload = {}) {
  const draft = payload.policy && typeof payload.policy === 'object' ? payload.policy : payload;
  const basePolicyId = getSystemPolicy(draft.basePolicyId || draft.baseId || 'balanced').id;
  const base = getSystemPolicy(basePolicyId);
  const tiers = normalizeTiers(draft.tiers);
  return {
    ...base,
    id: 'draft',
    type: 'draft',
    label: makeCustomPolicyName(basePolicyId, tiers),
    displayName: makeCustomPolicyName(basePolicyId, tiers),
    basePolicyId,
    tiers,
  };
}

function resolvePolicy(gameState, payload = {}) {
  if (payload.policyId) return getPolicyById(gameState, payload.policyId);
  if (payload.basePolicyId || payload.policy?.basePolicyId || payload.tiers || payload.policy?.tiers) {
    return buildDraftPolicy(payload);
  }
  const state = ensureTalentPolicyState(gameState);
  return getPolicyById(gameState, state.activePolicyId) || getSystemPolicy('balanced');
}

function applyTierModifiers(weights, tiers = {}, currentEra = 0) {
  const nextWeights = { ...weights };
  getAvailableTendencies(currentEra).forEach((tendency) => {
    if (tendency.disabled) return;
    const role = tendency.role;
    if (!role || !Object.prototype.hasOwnProperty.call(nextWeights, role)) return;
    const tier = clampTier(tiers[tendency.id]);
    const modifier = tier === 3 ? 2 : (tier === 1 ? -1 : 0);
    nextWeights[role] = Math.max(1, (Number(nextWeights[role]) || 1) + modifier);
  });
  return nextWeights;
}

function getEffectiveWeights(policy = {}, currentEra = 0) {
  const availableRoles = getAvailableRoleIds(currentEra);
  const baseWeights = policy.type === 'custom' || policy.type === 'draft'
    ? applyTierModifiers(policy.weights || {}, policy.tiers || DEFAULT_TIERS, currentEra)
    : { ...(policy.weights || {}) };
  return availableRoles.reduce((result, roleId) => {
    result[roleId] = Math.max(1, Number(baseWeights[roleId]) || 1);
    return result;
  }, {});
}

function allocateByWeights(total, weights = {}, priority = []) {
  const amount = Math.max(0, Math.floor(Number(total) || 0));
  const roles = Object.keys(weights);
  if (!roles.length) return {};
  const weightSum = roles.reduce((sum, role) => sum + Math.max(1, Number(weights[role]) || 1), 0);
  const allocation = roles.reduce((result, role) => {
    result[role] = 0;
    return result;
  }, {});
  if (amount <= 0 || weightSum <= 0) return allocation;

  const raw = roles.map((role) => {
    const weight = Math.max(1, Number(weights[role]) || 1);
    const exact = (amount * weight) / weightSum;
    return {
      role,
      weight,
      exact,
      floor: Math.floor(exact),
      remainder: exact - Math.floor(exact),
      priority: priority.indexOf(role) >= 0 ? priority.indexOf(role) : priority.length,
    };
  });
  raw.forEach((item) => {
    allocation[item.role] = item.floor;
  });
  let remaining = amount - Object.values(allocation).reduce((sum, value) => sum + value, 0);
  raw
    .sort((a, b) => b.weight - a.weight || b.remainder - a.remainder || a.priority - b.priority || a.role.localeCompare(b.role))
    .forEach((item) => {
      if (remaining <= 0) return;
      allocation[item.role] += 1;
      remaining -= 1;
    });
  return allocation;
}

function buildAllocationPreview(gameState, policyInput = null) {
  CityService.normalizeCities(gameState);
  const city = CityService.getActiveCity(gameState);
  const policy = policyInput || resolvePolicy(gameState, {});
  const weights = getEffectiveWeights(policy, gameState.currentEra);
  const allocation = allocateByWeights(city.population?.total || 0, weights, policy.priority || []);
  return {
    policyId: policy.id,
    policyLabel: policy.label || policy.displayName || '均衡发展',
    weights,
    allocation: {
      farmer: allocation.farmer || 0,
      scholar: allocation.scholar || 0,
      craftsman: allocation.craftsman || 0,
    },
  };
}

function applyPopulationAllocation(city, allocation = {}) {
  const population = city.population || {};
  const nextPopulation = {
    ...population,
    farmers: allocation.farmer || 0,
    scholars: allocation.scholar || 0,
    craftsmen: allocation.craftsman || 0,
  };
  const assigned = nextPopulation.farmers + nextPopulation.scholars + nextPopulation.craftsmen;
  nextPopulation.unassigned = Math.max(0, (Number(nextPopulation.total) || 0) - assigned);
  city.population = nextPopulation;
  return nextPopulation;
}

function applyPolicy(gameState, tutorial, payload = {}) {
  const policy = resolvePolicy(gameState, payload);
  if (!policy) {
    return { success: false, error: 'TALENT_POLICY_NOT_FOUND', message: '方针不存在', tutorial };
  }
  if ((Number(gameState.currentEra) || 0) < (policy.minEra || 0)) {
    return { success: false, error: 'TALENT_POLICY_LOCKED', message: '当前时代尚未解锁该方针', tutorial };
  }
  CityService.normalizeCities(gameState);
  const preview = buildAllocationPreview(gameState, policy);
  const city = CityService.getActiveCity(gameState);
  const beforeCraftsmen = Number(city.population?.craftsmen) || 0;
  applyPopulationAllocation(city, preview.allocation);
  CityService.applyDerivedStatsToCity(city, gameState);
  CityService.syncActiveCityToLegacyFields(gameState);

  const state = ensureTalentPolicyState(gameState);
  if (policy.id === 'draft') {
    state.activePolicyId = 'draft';
    state.activeDraft = {
      id: 'draft',
      type: 'draft',
      basePolicyId: policy.basePolicyId || 'balanced',
      displayName: policy.displayName || policy.label,
      tiers: normalizeTiers(policy.tiers),
      updatedAt: new Date().toISOString(),
    };
  } else {
    state.activePolicyId = policy.id;
    state.activeDraft = null;
  }
  state.lastAppliedAt = new Date().toISOString();
  const normalizedTutorial = TutorialService.normalizeTutorialState(tutorial);
  const nextTutorial = normalizedTutorial.currentStep === TutorialService.TUTORIAL_STEPS.talentPolicyOpened
    ? TutorialService.advanceTutorial(normalizedTutorial, 'talentPolicyApplied')
    : (preview.allocation.craftsman || 0) > beforeCraftsmen
      ? TutorialService.advanceTutorial(normalizedTutorial, 'craftsmanAssigned')
      : normalizedTutorial;

  return {
    success: true,
    message: `已应用${preview.policyLabel}`,
    talentPolicy: {
      id: policy.id,
      label: preview.policyLabel,
      allocation: preview.allocation,
    },
    tutorial: nextTutorial,
  };
}

function makeCustomPolicyName(basePolicyId, tiers = {}) {
  const base = getSystemPolicy(basePolicyId);
  const normalized = normalizeTiers(tiers);
  const emphasis = TENDENCY_DEFINITIONS
    .filter((item) => normalized[item.id] === 3)
    .map((item) => item.label);
  if (emphasis.length) return `${base.label}·偏${emphasis.slice(0, 2).join('与')}`;
  const low = TENDENCY_DEFINITIONS
    .filter((item) => normalized[item.id] === 1)
    .map((item) => item.label);
  if (low.length) return `${base.label}·轻${low.slice(0, 2).join('与')}`;
  return `${base.label}·微调`;
}

function saveCustomPolicy(gameState, payload = {}) {
  const state = ensureTalentPolicyState(gameState);
  const draft = buildDraftPolicy(payload);
  const now = new Date().toISOString();
  const id = String(payload.policyId || payload.id || '').trim()
    || `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const existing = state.custom.find((policy) => policy.id === id);
  const custom = {
    id,
    type: 'custom',
    basePolicyId: draft.basePolicyId,
    displayName: draft.displayName,
    tiers: normalizeTiers(draft.tiers),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  state.custom = [
    custom,
    ...state.custom.filter((policy) => policy.id !== id),
  ].slice(0, 8);
  if (state.activePolicyId === 'draft') state.activeDraft = null;
  return {
    success: true,
    message: `已保存${custom.displayName}`,
    policy: custom,
  };
}

function deleteCustomPolicy(gameState, payload = {}) {
  const state = ensureTalentPolicyState(gameState);
  const policyId = String(payload.policyId || payload.id || '').trim();
  const before = state.custom.length;
  state.custom = state.custom.filter((policy) => policy.id !== policyId);
  if (state.activePolicyId === policyId) state.activePolicyId = 'balanced';
  return before === state.custom.length
    ? { success: false, error: 'TALENT_POLICY_NOT_FOUND', message: '方针不存在' }
    : { success: true, message: '已删除自定义方针' };
}

function getClientState(gameState) {
  const state = ensureTalentPolicyState(gameState);
  const currentEra = Number(gameState.currentEra) || 0;
  const activePolicy = getPolicyById(gameState, state.activePolicyId) || getSystemPolicy('balanced');
  return {
    activePolicyId: activePolicy.id,
    activePolicyLabel: activePolicy.label || activePolicy.displayName,
    systemPolicies: SYSTEM_POLICIES.map((policy) => ({
      id: policy.id,
      type: 'system',
      label: policy.label,
      description: policy.description,
      basePolicyId: policy.id,
      weights: { ...policy.weights },
      priority: [...(policy.priority || [])],
      minEra: policy.minEra || 0,
      disabled: currentEra < (policy.minEra || 0),
      active: activePolicy.id === policy.id,
    })),
    customPolicies: state.custom.map((policy) => ({
      ...policy,
      active: activePolicy.id === policy.id,
    })),
    activeDraft: state.activeDraft,
    tendencies: getAvailableTendencies(currentEra),
    defaultTiers: { ...DEFAULT_TIERS },
    preview: buildAllocationPreview(gameState, activePolicy),
    lastAppliedAt: state.lastAppliedAt,
  };
}

module.exports = {
  DEFAULT_TIERS,
  ROLE_DEFINITIONS,
  TENDENCY_DEFINITIONS,
  SYSTEM_POLICIES,
  createInitialTalentPolicyState,
  normalizeTalentPolicyState,
  normalizeTiers,
  makeCustomPolicyName,
  getClientState,
  buildAllocationPreview,
  applyPolicy,
  saveCustomPolicy,
  deleteCustomPolicy,
};
