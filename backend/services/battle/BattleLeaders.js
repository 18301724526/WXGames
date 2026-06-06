const {
  clone,
  normalizeAttributes,
  toInteger,
} = require('./BattleShared');

function createBattleLeaders({ BattleConfig }) {
  function getFamousPerson(gameState, leaderId) {
    const id = typeof leaderId === 'string' ? leaderId.trim() : '';
    if (!id || id === 'unavailable') return null;
    return (Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [])
      .find((person) => person?.id === id) || null;
  }

  function getLeaderSnapshot(gameState, leaderId) {
    const person = getFamousPerson(gameState, leaderId);
    if (!person) return null;
    return {
      id: person.id,
      name: person.name || '无名之士',
      title: person.title || person.archetypeLabel || '名人',
      archetype: person.archetype || '',
      abilityArchetype: person.abilityArchetype || person.abilityKit?.archetype || person.archetype || '',
      quality: person.quality || 'common',
      attributes: normalizeAttributes(person.attributes || {}),
      appearance: clone(person.appearance || {}),
      abilityKit: person.abilityKit && typeof person.abilityKit === 'object' ? clone(person.abilityKit) : null,
      skills: Array.isArray(person.skills) ? clone(person.skills).slice(0, 2) : [],
    };
  }

  function getLeaderSnapshotFromMission(mission) {
    const raw = mission?.expedition?.leaderSnapshot;
    if (!raw || typeof raw !== 'object') return null;
    return {
      id: raw.id || mission.expedition?.leader || 'unavailable',
      name: raw.name || '无名之士',
      title: raw.title || raw.archetypeLabel || '名人',
      archetype: raw.archetype || '',
      abilityArchetype: raw.abilityArchetype || raw.abilityKit?.archetype || raw.archetype || '',
      quality: raw.quality || 'common',
      attributes: normalizeAttributes(raw.attributes || {}),
      appearance: clone(raw.appearance || {}),
      abilityKit: raw.abilityKit && typeof raw.abilityKit === 'object' ? clone(raw.abilityKit) : null,
      skills: Array.isArray(raw.skills) ? clone(raw.skills).slice(0, 2) : [],
    };
  }

  function getDefenderLeaderSnapshot(territory = {}) {
    const raw = territory.battleTarget?.defender?.leader || territory.garrison?.leader || territory.defenderLeader;
    if (!raw || typeof raw !== 'object') return null;
    return {
      id: raw.id || `df_${territory.id || 'site'}`,
      name: raw.name || territory.naturalName || '守军',
      title: raw.title || raw.archetypeLabel || '守军',
      archetype: raw.archetype || '',
      archetypeLabel: raw.archetypeLabel || '',
      abilityArchetype: raw.abilityArchetype || raw.abilityKit?.archetype || raw.archetype || '',
      quality: raw.quality || 'common',
      qualityLabel: raw.qualityLabel || '',
      level: toInteger(raw.level, 1),
      attributes: normalizeAttributes(raw.attributes || {}),
      appearance: clone(raw.appearance || {}),
      abilityKit: raw.abilityKit && typeof raw.abilityKit === 'object' ? clone(raw.abilityKit) : null,
      skills: Array.isArray(raw.skills) ? clone(raw.skills).slice(0, 2) : [],
    };
  }

  function inferDamageTypeFromEffects(effects = []) {
    if (effects.some((effect) => ['burn', 'poison', 'ambush', 'firstStrike'].includes(effect.key))) return 'strategy';
    return 'blade';
  }

  function getActiveSkillFromAbilityKit(abilityKit = {}) {
    if (abilityKit?.battlePolicy === 'basicAttackOnly') return null;
    const abilities = Array.isArray(abilityKit?.abilities) ? abilityKit.abilities : [];
    return abilities.find((ability) => (
      ability
      && ability.kind === 'active'
      && (ability.type === 'battle' || ability.slot === 'activeSkill')
    )) || null;
  }

  function getPassiveTraitsFromAbilityKit(abilityKit = {}) {
    const abilities = Array.isArray(abilityKit?.abilities) ? abilityKit.abilities : [];
    return abilities.filter((ability) => (
      ability
      && ability.kind === 'passive'
      && ability.trigger === 'preBattle'
      && (ability.slot === 'passiveTrait' || ability.type === 'battle' || ability.category === 'guard' || ability.category === 'support')
    )).map((ability) => clone(ability));
  }

  function inferSkillMultiplier(effects = []) {
    const keys = effects.map((effect) => effect.key);
    const directDamage = effects.find((effect) => effect.key === 'directDamage');
    if (directDamage && Number.isFinite(Number(directDamage.value))) return Number(directDamage.value);
    if (keys.some((key) => ['combo', 'armorBreak', 'ambush', 'burn', 'poison', 'secondHit', 'firstStrike'].includes(key))) return 1.45;
    if (keys.some((key) => ['shield', 'heal', 'morale', 'attributeBonus'].includes(key))) return 1.2;
    return 1.35;
  }

  function normalizeBattleSkill(skill = {}) {
    const effects = Array.isArray(skill.effects) ? skill.effects : [];
    const damageType = skill.damageType || skill.category || inferDamageTypeFromEffects(effects);
    return {
      ...skill,
      type: skill.type || 'battle',
      category: skill.category || damageType,
      damageType,
      multiplier: Number.isFinite(Number(skill.multiplier)) ? Number(skill.multiplier) : inferSkillMultiplier(effects),
      cooldown: Math.max(2, toInteger(skill.cooldown, 3)),
      effects,
    };
  }

  function getBattleSkill(unit, role = 'attacker') {
    const activeAbility = getActiveSkillFromAbilityKit(unit.leader?.abilityKit);
    if (activeAbility) return normalizeBattleSkill(clone(activeAbility));
    if (unit.leader?.abilityKit?.battlePolicy === 'basicAttackOnly') return null;
    if (Array.isArray(unit.leader?.skills) && unit.leader.skills.length) {
      return normalizeBattleSkill(clone(unit.leader.skills[0]));
    }
    if (unit.leader && unit.leader.id && unit.leader.id !== 'unavailable') return null;
    return normalizeBattleSkill(BattleConfig.getFallbackSkill(role));
  }

  return {
    getActiveSkillFromAbilityKit,
    getBattleSkill,
    getDefenderLeaderSnapshot,
    getLeaderSnapshot,
    getLeaderSnapshotFromMission,
    getPassiveTraitsFromAbilityKit,
    inferDamageTypeFromEffects,
    inferSkillMultiplier,
    normalizeBattleSkill,
  };
}

module.exports = {
  createBattleLeaders,
};
