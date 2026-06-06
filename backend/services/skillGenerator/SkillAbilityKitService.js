const {
  GENERATOR_VERSION,
  QUALITY_BUDGETS,
} = require('./SkillGeneratorConstants');
const {
  clone,
  createSeedRandom,
} = require('./SkillGeneratorShared');
const {
  createGeneratorInput,
  getAbilityMeta,
  getQualityLabel,
  normalizeAbilityArchetype,
  normalizeEffect,
  normalizeGeneratorInput,
  normalizeQuality,
} = require('./SkillGeneratorNormalizer');
const {
  addBaseConditions,
  createActiveSkill,
  createBattlePassive,
  createBudgetChecks,
  createCivilAbility,
  createScoutTrait,
  normalizeAbility,
  summarizeBudgetStatus,
} = require('./SkillAbilityFactory');
const {
  withAbilityDescription,
} = require('./SkillGeneratorDescriptions');

function findAbilityBySlot(abilities = [], slot) {
  return abilities.find((ability) => ability?.slot === slot) || null;
}

function findActiveAbility(abilities = []) {
  return findAbilityBySlot(abilities, 'activeSkill')
    || abilities.find((ability) => ability?.kind === 'active' || ability?.type === 'battle')
    || null;
}

function findPassiveAbility(abilities = []) {
  return findAbilityBySlot(abilities, 'passiveTrait')
    || abilities.find((ability) => ability?.kind === 'passive' && ability?.trigger === 'preBattle')
    || null;
}

function findCivilAbility(abilities = [], slot) {
  return findAbilityBySlot(abilities, slot)
    || abilities.find((ability) => ability?.kind === 'civil' && !['civilPrimary', 'civilSecondary'].includes(ability?.slot))
    || null;
}

function normalizeActiveAbility(raw = {}) {
  const normalized = normalizeAbility({
    ...raw,
    type: 'battle',
    slot: 'activeSkill',
    kind: 'active',
  }, normalizeEffect);
  if (!normalized) return null;
  if (!Array.isArray(normalized.effects) || !normalized.effects.length) return null;
  const cooldown = Number(normalized.cooldown);
  return withAbilityDescription({
    ...normalized,
    type: 'battle',
    slot: 'activeSkill',
    kind: 'active',
    cooldown: Number.isFinite(cooldown) ? Math.max(1, Math.floor(cooldown)) : 3,
    castPolicy: normalized.castPolicy || 'conditional',
    castConditions: addBaseConditions(normalized.castConditions),
    generatorVersion: GENERATOR_VERSION,
  });
}

function normalizeBattlePassive(raw = {}) {
  const normalized = normalizeAbility({
    ...raw,
    slot: 'passiveTrait',
    kind: 'passive',
    trigger: 'preBattle',
  }, normalizeEffect);
  if (!normalized) return null;
  return withAbilityDescription({
    ...normalized,
    slot: 'passiveTrait',
    kind: 'passive',
    trigger: 'preBattle',
    generatorVersion: GENERATOR_VERSION,
  });
}

function normalizeCivilStoredAbility(raw = {}, slot) {
  const normalized = normalizeAbility({
    ...raw,
    slot,
    kind: 'civil',
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
  }, normalizeEffect);
  if (!normalized) return null;
  return withAbilityDescription({
    ...normalized,
    slot,
    kind: 'civil',
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
    generatorVersion: GENERATOR_VERSION,
  });
}

function normalizeScoutTrait(raw = {}) {
  const normalized = normalizeAbility({
    ...raw,
    slot: 'scoutTrait',
    kind: 'passive',
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
  }, normalizeEffect);
  if (!normalized) return null;
  return withAbilityDescription({
    ...normalized,
    slot: 'scoutTrait',
    kind: 'passive',
    trigger: 'passiveStored',
    implementationStatus: 'storedOnly',
    generatorVersion: GENERATOR_VERSION,
  });
}

function completeAbilitySlots(abilities = [], abilityArchetype, quality, meta, generatorInput) {
  const source = createSeedRandom(`${generatorInput.seed}:ability-kit-upgrade:${abilityArchetype}:${quality}`);
  const effectPool = generatorInput.availableEffectPool;
  if (meta.domain === 'civil') {
    const rawPrimary = findCivilAbility(abilities, 'civilPrimary');
    const rawSecondary = findCivilAbility(
      abilities.filter((ability) => ability !== rawPrimary),
      'civilSecondary',
    );
    const primary = normalizeCivilStoredAbility(rawPrimary, 'civilPrimary')
      || createCivilAbility(abilityArchetype, 'civilPrimary', quality, source, effectPool);
    const secondary = normalizeCivilStoredAbility(rawSecondary, 'civilSecondary')
      || createCivilAbility(abilityArchetype, 'civilSecondary', quality, source, effectPool);
    return [primary, secondary];
  }
  if (meta.domain === 'hybrid') {
    const active = normalizeActiveAbility(findActiveAbility(abilities))
      || createActiveSkill('scout', quality, source, effectPool);
    const scoutTrait = normalizeScoutTrait(findAbilityBySlot(abilities, 'scoutTrait'))
      || createScoutTrait(quality, source, effectPool);
    return [active, scoutTrait];
  }
  const active = normalizeActiveAbility(findActiveAbility(abilities))
    || createActiveSkill(abilityArchetype, quality, source, effectPool);
  const passive = normalizeBattlePassive(findPassiveAbility(abilities))
    || createBattlePassive(abilityArchetype, quality, source, effectPool);
  return [active, passive];
}

function createAbilityKit(options = {}, randomSource = null) {
  const abilityArchetype = normalizeAbilityArchetype(options.abilityArchetype || options.archetype);
  const quality = normalizeQuality(options.quality);
  const meta = getAbilityMeta(abilityArchetype);
  const generatorInput = createGeneratorInput(options, abilityArchetype, quality, meta);
  const source = typeof randomSource === 'function' ? randomSource : createSeedRandom(generatorInput.seed);
  const abilities = [];
  if (meta.domain === 'civil') {
    abilities.push(createCivilAbility(abilityArchetype, 'civilPrimary', quality, source, generatorInput.availableEffectPool));
    abilities.push(createCivilAbility(abilityArchetype, 'civilSecondary', quality, source, generatorInput.availableEffectPool));
  } else if (meta.domain === 'hybrid') {
    abilities.push(createActiveSkill('scout', quality, source, generatorInput.availableEffectPool));
    abilities.push(createScoutTrait(quality, source, generatorInput.availableEffectPool));
  } else {
    abilities.push(createActiveSkill(abilityArchetype, quality, source, generatorInput.availableEffectPool));
    abilities.push(createBattlePassive(abilityArchetype, quality, source, generatorInput.availableEffectPool));
  }
  const budgetChecks = createBudgetChecks(abilities);
  return {
    archetype: abilityArchetype,
    quality,
    qualityLabel: getQualityLabel(quality),
    domain: meta.domain,
    battlePolicy: meta.battlePolicy,
    source: generatorInput.source,
    seed: generatorInput.seed,
    generatorInput,
    abilities,
    budget: clone(QUALITY_BUDGETS[quality]),
    budgetChecks,
    budgetStatus: summarizeBudgetStatus(budgetChecks),
    availableEffectPool: [...generatorInput.availableEffectPool],
    generatorVersion: GENERATOR_VERSION,
  };
}

function createLegacyAbilityKit(archetype, abilityArchetype, quality, skills = [], fallback = {}) {
  const activeSkill = Array.isArray(skills) ? skills.find((skill) => skill?.type === 'battle' || skill?.kind === 'active') : null;
  const meta = getAbilityMeta(abilityArchetype);
  const abilities = [];
  if (activeSkill && meta.battlePolicy === 'useBattleSkill') {
    abilities.push({
      ...clone(activeSkill),
      slot: 'activeSkill',
      kind: 'active',
      castPolicy: activeSkill.castPolicy || 'conditional',
      castConditions: addBaseConditions(activeSkill.castConditions),
      generatorVersion: activeSkill.generatorVersion || 'legacy-skill',
    });
  }
  const generatorInput = normalizeGeneratorInput(archetype?.generatorInput, {
    abilityArchetype,
    quality,
    source: archetype?.source || fallback.source,
    seed: archetype?.seed || fallback.seed,
    availableEffectPool: archetype?.availableEffectPool || fallback.availableEffectPool,
  });
  const upgradedAbilities = completeAbilitySlots(abilities, abilityArchetype, quality, meta, generatorInput);
  const budgetChecks = createBudgetChecks(upgradedAbilities);
  return {
    archetype: normalizeAbilityArchetype(abilityArchetype),
    quality: normalizeQuality(quality),
    qualityLabel: getQualityLabel(quality),
    domain: meta.domain,
    battlePolicy: meta.battlePolicy,
    source: generatorInput.source,
    seed: generatorInput.seed,
    generatorInput,
    abilities: upgradedAbilities,
    budget: clone(QUALITY_BUDGETS[normalizeQuality(quality)]),
    budgetChecks,
    budgetStatus: summarizeBudgetStatus(budgetChecks),
    availableEffectPool: [...generatorInput.availableEffectPool],
    generatorVersion: GENERATOR_VERSION,
  };
}

function normalizeAbilityKit(raw = {}, options = {}) {
  const abilityArchetype = normalizeAbilityArchetype(
    raw?.archetype || options.abilityArchetype || options.archetype,
    'vanguard',
  );
  const quality = normalizeQuality(raw?.quality || options.quality);
  const meta = getAbilityMeta(abilityArchetype);
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.abilities)) {
    return createLegacyAbilityKit(raw, abilityArchetype, quality, options.skills, options);
  }
  const generatorInput = normalizeGeneratorInput(raw.generatorInput, {
    abilityArchetype,
    quality,
    source: raw.source || options.source,
    seed: raw.seed || options.seed,
    availableEffectPool: raw.availableEffectPool || options.availableEffectPool,
  });
  const abilities = completeAbilitySlots(
    raw.abilities.map((ability) => normalizeAbility(ability, normalizeEffect)).filter(Boolean),
    abilityArchetype,
    quality,
    meta,
    generatorInput,
  );
  const budgetChecks = createBudgetChecks(abilities);
  return {
    archetype: abilityArchetype,
    quality,
    qualityLabel: getQualityLabel(quality),
    domain: meta.domain,
    battlePolicy: meta.battlePolicy,
    source: generatorInput.source,
    seed: generatorInput.seed,
    generatorInput,
    abilities,
    budget: raw.budget && typeof raw.budget === 'object' ? clone(raw.budget) : clone(QUALITY_BUDGETS[quality]),
    budgetChecks,
    budgetStatus: summarizeBudgetStatus(budgetChecks),
    availableEffectPool: [...generatorInput.availableEffectPool],
    generatorVersion: GENERATOR_VERSION,
  };
}

function getActiveBattleSkill(abilityKit = {}) {
  if (abilityKit?.battlePolicy === 'basicAttackOnly') return null;
  const abilities = Array.isArray(abilityKit?.abilities) ? abilityKit.abilities : [];
  return abilities.find((ability) => (
    ability
    && ability.kind === 'active'
    && (ability.type === 'battle' || ability.slot === 'activeSkill')
  )) || null;
}

module.exports = {
  completeAbilitySlots,
  createAbilityKit,
  createLegacyAbilityKit,
  findAbilityBySlot,
  getActiveBattleSkill,
  normalizeAbilityKit,
};
