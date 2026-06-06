const {
  ACTIVE_TEMPLATES,
  CIVIL_TEMPLATES,
  GENERATOR_VERSION,
  PASSIVE_TEMPLATES,
  QUALITY_BUDGETS,
  SCOUT_TRAITS,
} = require('./SkillGeneratorConstants');
const {
  clone,
  pick,
  round2,
  sanitizeText,
} = require('./SkillGeneratorShared');
const {
  normalizeAbilityArchetype,
  normalizeQuality,
} = require('./SkillGeneratorNormalizer');
const {
  withAbilityDescription,
} = require('./SkillGeneratorDescriptions');

function addBaseConditions(conditions = []) {
  const result = [{ type: 'cooldownReady' }, { type: 'targetAlive' }];
  conditions.forEach((condition) => {
    if (!condition || typeof condition !== 'object' || !condition.type) return;
    if (result.some((item) => item.type === condition.type)) return;
    result.push({ ...condition });
  });
  return result;
}

function templateFitsEffectPool(template = {}, effectPool = []) {
  const allowed = new Set(Array.isArray(effectPool) ? effectPool : []);
  if (!allowed.size) return true;
  const effects = Array.isArray(template.effects) ? template.effects : [];
  return effects.every((effect) => allowed.has(effect.key));
}

function filterTemplatesForPool(templates = [], effectPool = []) {
  const filtered = templates.filter((template) => templateFitsEffectPool(template, effectPool));
  return filtered.length ? filtered : templates;
}

function clampActiveForQuality(template, quality, scout = false) {
  const budgets = QUALITY_BUDGETS[normalizeQuality(quality)];
  const limit = scout ? budgets.scoutActive : budgets.active;
  const active = clone(template);
  if (active.cost > limit) {
    const ratio = Math.max(0.82, limit / Math.max(1, active.cost));
    active.multiplier = round2(Math.max(1.1, active.multiplier * ratio));
    active.cost = limit;
    active.effects = active.effects.map((effect) => {
      if (effect.key === 'directDamage') return { ...effect, value: active.multiplier };
      if (effect.key === 'secondHit') return { ...effect, multiplier: round2((Number(effect.multiplier) || 0.25) * ratio) };
      return effect;
    });
  }
  return { active, limit };
}

function createActiveSkill(abilityArchetype, quality, randomSource = Math.random, effectPool = null) {
  const archetype = normalizeAbilityArchetype(abilityArchetype);
  const scout = archetype === 'scout';
  const templates = filterTemplatesForPool(ACTIVE_TEMPLATES[archetype] || ACTIVE_TEMPLATES.vanguard, effectPool);
  const template = pick(templates, randomSource) || templates[0];
  const { active, limit } = clampActiveForQuality(template, quality, scout);
  return withAbilityDescription({
    id: `skill_${archetype}_${active.id}`,
    name: active.name,
    slot: 'activeSkill',
    kind: 'active',
    type: 'battle',
    category: active.category,
    damageType: active.damageType,
    multiplier: active.multiplier,
    cooldown: active.cooldown,
    castPolicy: 'conditional',
    castConditions: addBaseConditions(active.castConditions),
    effects: active.effects,
    budget: {
      tier: normalizeQuality(quality),
      cost: active.cost,
      limit,
    },
    generatorVersion: GENERATOR_VERSION,
  });
}

function createBattlePassive(abilityArchetype, quality, randomSource = Math.random, effectPool = null) {
  const archetype = normalizeAbilityArchetype(abilityArchetype);
  const templates = filterTemplatesForPool(PASSIVE_TEMPLATES[archetype] || PASSIVE_TEMPLATES.vanguard, effectPool);
  const template = clone(pick(templates, randomSource) || templates[0]);
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)].passive;
  return withAbilityDescription({
    id: `trait_${archetype}_${template.id}`,
    name: template.name,
    slot: 'passiveTrait',
    kind: 'passive',
    trigger: 'preBattle',
    effects: template.effects,
    budget: {
      tier: normalizeQuality(quality),
      cost: Math.min(template.cost, limit),
      limit,
    },
    generatorVersion: GENERATOR_VERSION,
  });
}

function createCivilAbility(abilityArchetype, slot, quality, randomSource = Math.random, effectPool = null) {
  const archetype = normalizeAbilityArchetype(abilityArchetype, 'governor');
  const templateGroup = CIVIL_TEMPLATES[archetype] || CIVIL_TEMPLATES.governor;
  const groupKey = slot === 'civilSecondary' ? 'secondary' : 'primary';
  const templates = filterTemplatesForPool(templateGroup[groupKey], effectPool);
  const template = clone(pick(templates, randomSource) || templates[0]);
  const limitKey = slot === 'civilSecondary' ? 'civilSecondary' : 'civilPrimary';
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)][limitKey];
  return withAbilityDescription({
    id: `civil_${archetype}_${template.id}`,
    name: template.name,
    slot,
    kind: 'civil',
    category: template.category,
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
    effects: template.effects,
    budget: {
      tier: normalizeQuality(quality),
      cost: Math.min(template.cost, limit),
      limit,
    },
    generatorVersion: GENERATOR_VERSION,
  });
}

function createScoutTrait(quality, randomSource = Math.random, effectPool = null) {
  const templates = filterTemplatesForPool(SCOUT_TRAITS, effectPool);
  const template = clone(pick(templates, randomSource) || templates[0]);
  const limit = QUALITY_BUDGETS[normalizeQuality(quality)].scoutTrait;
  return withAbilityDescription({
    id: `trait_scout_${template.id}`,
    name: template.name,
    slot: 'scoutTrait',
    kind: 'passive',
    category: template.category,
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
    effects: template.effects,
    budget: {
      tier: normalizeQuality(quality),
      cost: Math.min(template.cost, limit),
      limit,
    },
    generatorVersion: GENERATOR_VERSION,
  });
}

function createBudgetChecks(abilities = []) {
  return abilities.map((ability) => {
    const cost = Number(ability?.budget?.cost) || 0;
    const limit = Number(ability?.budget?.limit) || 0;
    return {
      slot: ability?.slot || '',
      id: ability?.id || '',
      cost,
      limit,
      withinLimit: limit <= 0 ? true : cost <= limit,
    };
  });
}

function summarizeBudgetStatus(checks = []) {
  return checks.every((check) => check.withinLimit) ? 'withinLimit' : 'overLimit';
}

function normalizeAbility(raw = {}, normalizeEffect) {
  if (!raw || typeof raw !== 'object') return null;
  const effects = Array.isArray(raw.effects)
    ? raw.effects.map(normalizeEffect).filter(Boolean)
    : [];
  if (!effects.length && raw.kind !== 'active') return null;
  return withAbilityDescription({
    ...raw,
    id: sanitizeText(raw.id, 'ability_generated'),
    name: sanitizeText(raw.name, '能力'),
    slot: sanitizeText(raw.slot, raw.kind === 'active' ? 'activeSkill' : 'passiveTrait'),
    kind: sanitizeText(raw.kind, raw.type === 'battle' ? 'active' : 'passive'),
    effects,
    generatorVersion: sanitizeText(raw.generatorVersion, GENERATOR_VERSION),
  });
}

module.exports = {
  addBaseConditions,
  createActiveSkill,
  createBattlePassive,
  createBudgetChecks,
  createCivilAbility,
  createScoutTrait,
  filterTemplatesForPool,
  normalizeAbility,
  summarizeBudgetStatus,
  templateFitsEffectPool,
};
