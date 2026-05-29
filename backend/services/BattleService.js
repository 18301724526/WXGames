const BattleConfig = require('../config/BattleConfig');

const {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
  BATTLE_SYSTEM,
  MORALE_EFFECT_ENABLED,
} = BattleConfig;

const DAMAGE_TYPE_LABELS = {
  blade: '兵刃伤害',
  strategy: '谋略伤害',
  support: '支援效果',
  guard: '守御效果',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getFamousPerson(gameState, leaderId) {
  const id = typeof leaderId === 'string' ? leaderId.trim() : '';
  if (!id || id === 'unavailable') return null;
  return (Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [])
    .find((person) => person?.id === id) || null;
}

function normalizeAttributes(raw = {}) {
  const strategy = raw.intelligence ?? raw.strategy;
  const politics = raw.politics ?? raw.governance;
  return {
    command: toInteger(raw.command, 50),
    force: toInteger(raw.force, 50),
    intelligence: toInteger(strategy, 50),
    strategy: toInteger(strategy, 50),
    charisma: toInteger(raw.charisma, 50),
    politics: toInteger(politics, 50),
    speed: toInteger(raw.speed, Math.round(
      toInteger(raw.force, 50) * 0.28
      + toInteger(raw.command, 50) * 0.24
      + toInteger(strategy, 50) * 0.18
      + toInteger(raw.charisma, 50) * 0.14
      + toInteger(politics, 50) * 0.06,
    )),
  };
}

function getLeaderSnapshot(gameState, leaderId) {
  const person = getFamousPerson(gameState, leaderId);
  if (!person) return null;
  return {
    id: person.id,
    name: person.name || '无名之士',
    title: person.title || person.archetypeLabel || '名人',
    archetype: person.archetype || '',
    attributes: normalizeAttributes(person.attributes || {}),
    appearance: clone(person.appearance || {}),
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
    attributes: normalizeAttributes(raw.attributes || {}),
    appearance: clone(raw.appearance || {}),
    skills: Array.isArray(raw.skills) ? clone(raw.skills).slice(0, 2) : [],
  };
}

function getEffectiveAttribute(value) {
  const attribute = Math.max(1, Number(value) || 1);
  if (attribute <= 100) return attribute;
  return 100 + 2 * Math.pow(attribute - 100, 0.75);
}

function getBattleSpeed(unit) {
  return Math.max(1, Math.round(getEffectiveAttribute(unit.attributes?.speed ?? 45)));
}

function inferDamageTypeFromEffects(effects = []) {
  if (effects.some((effect) => ['burn', 'poison', 'ambush'].includes(effect.key))) return 'strategy';
  return 'blade';
}

function getBattleSkill(unit, role = 'attacker') {
  if (Array.isArray(unit.leader?.skills) && unit.leader.skills.length) {
    return normalizeBattleSkill(clone(unit.leader.skills[0]));
  }
  return normalizeBattleSkill(BattleConfig.getFallbackSkill(role));
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

function inferSkillMultiplier(effects = []) {
  const keys = effects.map((effect) => effect.key);
  if (keys.some((key) => ['combo', 'armorBreak', 'ambush', 'burn', 'poison'].includes(key))) return 1.45;
  if (keys.some((key) => ['shield', 'heal', 'morale'].includes(key))) return 1.2;
  return 1.35;
}

function getSkillCooldown(skill = {}) {
  return Math.max(2, toInteger(skill.cooldown, 3));
}

function calculateDamage(attacker, defender, options = {}) {
  const damageType = options.damageType || 'blade';
  const multiplier = Number.isFinite(Number(options.multiplier)) ? Number(options.multiplier) : 1;
  const attackAttributeKey = damageType === 'strategy' ? 'intelligence' : 'force';
  const effectiveAttack = getEffectiveAttribute(attacker.attributes?.[attackAttributeKey] ?? 45);
  const effectiveDefense = getEffectiveAttribute(defender.attributes?.command ?? 45);
  const soldierFactor = Math.pow(Math.max(1, attacker.soldiers) / DEFAULT_SOLDIER_SCALE, 0.65);
  const attackFactor = 0.75 + effectiveAttack / 120;
  const damageReduction = clamp(effectiveDefense / (effectiveDefense + 180), 0.05, 0.6);
  const moraleFactor = MORALE_EFFECT_ENABLED ? clamp((attacker.morale || 100) / 100, 0.75, 1.25) : 1;
  const rawDamage = 35 * soldierFactor * attackFactor * (1 - damageReduction) * moraleFactor * multiplier;
  return Math.max(1, Math.min(defender.soldiers, Math.round(rawDamage)));
}

function applyDamage(target, damage) {
  const actual = Math.max(0, Math.min(target.soldiers, Math.floor(Number(damage) || 0)));
  target.soldiers = Math.max(0, target.soldiers - actual);
  return actual;
}

function healSoldiers(unit, amount) {
  const recovered = Math.max(0, Math.min(unit.maxSoldiers - unit.soldiers, Math.floor(Number(amount) || 0)));
  unit.soldiers += recovered;
  return recovered;
}

function applySkillSideEffects(unit, target, skill = {}, dealt = 0) {
  const effects = Array.isArray(skill.effects) ? skill.effects : [];
  const notes = [];
  const structured = [];
  effects.forEach((effect) => {
    if (!effect || typeof effect !== 'object') return;
    if (effect.key === 'lifesteal') {
      const recovered = healSoldiers(unit, Math.round(dealt * (Number(effect.value) || 0)));
      if (recovered > 0) {
        notes.push(`恢复 ${recovered} 士兵`);
        structured.push({ type: 'heal', target: unit.side, value: recovered, text: `[${unit.name}] 恢复兵力 ${recovered}（${unit.soldiers}）` });
      }
    } else if (effect.key === 'heal') {
      const recovered = healSoldiers(unit, Math.round(unit.maxSoldiers * (Number(effect.value) || 0)));
      if (recovered > 0) {
        notes.push(`整队恢复 ${recovered} 士兵`);
        structured.push({ type: 'heal', target: unit.side, value: recovered, text: `[${unit.name}] 整队恢复兵力 ${recovered}（${unit.soldiers}）` });
      }
    } else if (effect.key === 'shield') {
      const shield = Math.round(calculateDamage(target, unit, { damageType: 'blade', multiplier: Number(effect.value) || 0.08 }));
      if (shield > 0) {
        notes.push(`护势抵消约 ${shield} 伤害`);
        structured.push({ type: 'shield', target: unit.side, value: shield, text: `[${unit.name}] 获得守御，预计抵消 ${shield} 伤害` });
      }
    } else if (effect.key === 'morale') {
      structured.push({ type: 'morale', target: unit.side, value: unit.morale, text: `[${unit.name}] 士气保持 ${unit.morale}` });
      notes.push('士气保持');
    } else if (effect.key === 'armorBreak') {
      structured.push({ type: 'debuff', target: target.side, key: effect.key, value: effect.value || 0, text: `[${target.name}] 受到破甲压制` });
      notes.push('破甲压制');
    } else if (effect.key === 'burn' || effect.key === 'poison') {
      structured.push({ type: 'debuff', target: target.side, key: effect.key, value: effect.value || 0, text: `[${target.name}] 受到${effect.key === 'burn' ? '灼烧' : '中毒'}影响` });
      notes.push(effect.key === 'burn' ? '灼烧' : '中毒');
    }
  });
  return { notes, structured };
}

function getBattleMapForTerritory(territory = {}) {
  return BattleConfig.getBattleMapForType(territory.type);
}

function getBattleStageForTerritory(territory = {}) {
  return BattleConfig.getBattleStageForType(territory.type);
}

function getBattleVisualGroups(soldiers, groupSize = DEFAULT_SOLDIER_SCALE) {
  const total = Math.max(0, toInteger(soldiers, 0));
  if (total <= 0) return [];
  const count = Math.ceil(total / groupSize);
  return Array.from({ length: count }, (_, index) => {
    const remaining = total - index * groupSize;
    return {
      index: index + 1,
      soldiers: Math.max(0, Math.min(groupSize, remaining)),
      capacity: groupSize,
    };
  });
}

function getDefenderProfile(territory) {
  const profile = BattleConfig.getDefenderProfileForOwner(territory.owner, territory.naturalName);
  const soldiers = Math.max(MIN_BATTLE_SOLDIERS, toInteger(territory.defense, MIN_BATTLE_SOLDIERS));
  return {
    id: territory.id,
    name: profile.name,
    soldiers,
    maxSoldiers: soldiers,
    morale: profile.morale,
    attributes: normalizeAttributes(profile),
  };
}

function createLegacyBattleReport(mission, territory, result, now = new Date()) {
  return {
    id: `battle_${territory.id}_${now.getTime()}`,
    mode: 'legacy',
    result: result.success ? 'victory' : 'defeat',
    summary: result.success
      ? `部队凭借兵力优势控制了${territory.naturalName}。`
      : `${territory.naturalName}守备坚决，部队未能建立优势。`,
    rounds: [],
    attacker: {
      leaderId: mission.expedition?.leader || 'unavailable',
      leaderName: '无名领队',
      soldiersStart: mission.soldiersCommitted,
      soldiersEnd: Math.max(0, mission.soldiersCommitted - result.casualties),
    },
    defender: {
      name: territory.naturalName || '守军',
      soldiersStart: territory.defense || 0,
      soldiersEnd: result.success ? 0 : Math.max(0, (territory.defense || 0) - Math.floor(mission.soldiersCommitted / 2)),
    },
    visual: {
      groupSize: DEFAULT_SOLDIER_SCALE,
      map: getBattleMapForTerritory(territory),
    },
  };
}

function makeUnit(side, base) {
  return {
    ...base,
    side,
    morale: toInteger(base.morale, 100),
    moraleEffectEnabled: MORALE_EFFECT_ENABLED,
    attributes: normalizeAttributes(base.attributes || {}),
    skillCooldownRemaining: 0,
  };
}

function formatDamageLine(targetName, damageType, dealt, remaining) {
  const label = DAMAGE_TYPE_LABELS[damageType] || '伤害';
  return `[${targetName}] 受到${label} ${dealt}（${remaining}）`;
}

function createPreparationEvents(attacker, defender) {
  return [
    {
      phase: 'preparation',
      type: 'status',
      lines: [
        `[${attacker.name}] 士气 ${attacker.morale}`,
        `[${defender.name}] 士气 ${defender.morale}`,
        `士气影响：${MORALE_EFFECT_ENABLED ? '生效' : '未启用'}`,
      ],
    },
  ];
}

function createExperienceSummary(attacker, defender, success) {
  const enemyLoss = Math.max(0, defender.maxSoldiers - defender.soldiers);
  const ownLoss = Math.max(0, attacker.maxSoldiers - attacker.soldiers);
  const victoryBonus = success ? Math.max(20, Math.round(defender.maxSoldiers * 0.05)) : 0;
  const total = Math.max(0, Math.round(enemyLoss * 1 + ownLoss * 0.25 + victoryBonus));
  return {
    total,
    enemyLoss,
    ownLoss,
    victoryBonus,
    formula: 'enemyLoss * 1 + ownLoss * 0.25 + victoryBonus',
  };
}

function simulateConquestBattle(gameState, mission, territory, now = new Date()) {
  const leader = getLeaderSnapshot(gameState, mission.expedition?.leader)
    || getLeaderSnapshotFromMission(mission);
  const fallbackLeader = leader || BattleConfig.getFallbackLeader();
  const attackerSoldiers = Math.max(MIN_BATTLE_SOLDIERS, toInteger(mission.soldiersCommitted, MIN_BATTLE_SOLDIERS));
  const attacker = makeUnit('attacker', {
    leader: fallbackLeader,
    name: fallbackLeader.name,
    soldiers: attackerSoldiers,
    maxSoldiers: attackerSoldiers,
    morale: 100,
    attributes: fallbackLeader.attributes,
    skill: getBattleSkill({ leader: fallbackLeader }, 'attacker'),
  });
  const defender = makeUnit('defender', {
    ...getDefenderProfile(territory),
    skill: getBattleSkill({}, 'defender'),
  });

  const turns = [];
  const rounds = [];
  const detailEvents = [];
  const preparation = createPreparationEvents(attacker, defender);
  const attackerFirst = getBattleSpeed(attacker) >= getBattleSpeed(defender);
  const order = attackerFirst
    ? [{ key: 'attacker', unit: attacker, target: defender }, { key: 'defender', unit: defender, target: attacker }]
    : [{ key: 'defender', unit: defender, target: attacker }, { key: 'attacker', unit: attacker, target: defender }];

  const recordAction = (actor, round) => {
    const beforeAttacker = attacker.soldiers;
    const beforeDefender = defender.soldiers;
    const actorName = actor.unit.name;
    const targetName = actor.target.name;
    const useSkill = actor.unit.skillCooldownRemaining <= 0;
    const action = useSkill ? 'skill' : 'basicAttack';
    const skill = useSkill ? actor.unit.skill : null;
    const damageType = useSkill ? skill.damageType : 'blade';
    const multiplier = useSkill ? skill.multiplier : 1;
    const damage = calculateDamage(actor.unit, actor.target, { damageType, multiplier });
    const dealt = applyDamage(actor.target, damage);
    const sideEffects = useSkill ? applySkillSideEffects(actor.unit, actor.target, skill, dealt) : { notes: [], structured: [] };
    const cooldownBefore = actor.unit.skillCooldownRemaining;
    if (useSkill) actor.unit.skillCooldownRemaining = getSkillCooldown(skill);
    else actor.unit.skillCooldownRemaining = Math.max(0, actor.unit.skillCooldownRemaining - 1);
    const cooldownAfter = actor.unit.skillCooldownRemaining;
    const actionLine = useSkill
      ? `[${actorName}] 发动战法 [${skill?.name || '技能'}]`
      : `[${actorName}] 对 [${targetName}] 发动普通攻击`;
    const damageLine = formatDamageLine(targetName, damageType, dealt, actor.target.soldiers);
    const lines = [
      `[${actorName}] 开始行动`,
      actionLine,
      damageLine,
      ...sideEffects.structured.map((effect) => effect.text),
    ];
    const text = useSkill
      ? `${actorName}队发动${skill?.name || '技能'}，${targetName}损失 ${dealt} 士兵${sideEffects.notes.length ? `，${sideEffects.notes.join('，')}` : ''}`
      : `${actorName}队普攻接战，${targetName}损失 ${dealt} 士兵`;
    const turn = {
      index: turns.length + 1,
      round,
      actor: actor.key,
      target: actor.key === 'attacker' ? 'defender' : 'attacker',
      action,
      actionType: action,
      actorName,
      targetName,
      damage: dealt,
      damageType,
      damageLabel: DAMAGE_TYPE_LABELS[damageType] || '伤害',
      skillId: skill?.id || '',
      skillName: skill?.name || '',
      skillCooldown: useSkill ? getSkillCooldown(skill) : getSkillCooldown(actor.unit.skill),
      cooldownBefore,
      cooldownAfter,
      morale: {
        actor: actor.unit.morale,
        target: actor.target.morale,
        effectEnabled: MORALE_EFFECT_ENABLED,
      },
      soldiersBefore: { attacker: beforeAttacker, defender: beforeDefender },
      soldiersAfter: { attacker: attacker.soldiers, defender: defender.soldiers },
      lines,
      text,
      attackerSoldiersBefore: beforeAttacker,
      defenderSoldiersBefore: beforeDefender,
      attackerSoldiersAfter: attacker.soldiers,
      defenderSoldiersAfter: defender.soldiers,
      attackerGroupsAfter: getBattleVisualGroups(attacker.soldiers),
      defenderGroupsAfter: getBattleVisualGroups(defender.soldiers),
    };
    turns.push(turn);
    detailEvents.push({
      round,
      actor: turn.actor,
      actorName,
      target: turn.target,
      targetName,
      actionType: action,
      skillName: turn.skillName,
      damageType,
      damage: dealt,
      soldiersBefore: turn.soldiersBefore,
      soldiersAfter: turn.soldiersAfter,
      lines,
    });
    return text;
  };

  for (let round = 1; round <= MAX_BATTLE_ROUNDS; round += 1) {
    const events = [];
    for (const actor of order) {
      if (attacker.soldiers <= 0 || defender.soldiers <= 0) break;
      events.push(recordAction(actor, round));
    }
    rounds.push({ round, attackerSoldiers: attacker.soldiers, defenderSoldiers: defender.soldiers, events });
    if (attacker.soldiers <= 0 || defender.soldiers <= 0) break;
  }

  const success = defender.soldiers <= 0 || (attacker.soldiers > 0 && attacker.soldiers >= defender.soldiers);
  const casualties = Math.max(0, attacker.maxSoldiers - attacker.soldiers);
  const experience = createExperienceSummary(attacker, defender, success);
  const report = {
    id: `battle_${territory.id}_${now.getTime()}`,
    mode: 'auto-round',
    maxRounds: MAX_BATTLE_ROUNDS,
    result: success ? 'victory' : 'defeat',
    summary: success
      ? `${fallbackLeader.name}队压制了${territory.naturalName}。`
      : `${fallbackLeader.name}队未能突破${territory.naturalName}的防线。`,
    system: BATTLE_SYSTEM,
    groupSize: DEFAULT_SOLDIER_SCALE,
    firstActor: attackerFirst ? 'attacker' : 'defender',
    moraleEffectEnabled: MORALE_EFFECT_ENABLED,
    skillRules: BattleConfig.getBattleRules().skillRules,
    preparation,
    detailEvents,
    turns,
    rounds,
    experience,
    attacker: {
      leaderId: fallbackLeader.id,
      leaderName: fallbackLeader.name,
      leaderTitle: fallbackLeader.title,
      speed: getBattleSpeed(attacker),
      morale: attacker.morale,
      moraleEffectEnabled: MORALE_EFFECT_ENABLED,
      attributes: clone(attacker.attributes || {}),
      soldiersStart: attacker.maxSoldiers,
      soldiersEnd: attacker.soldiers,
      groupsStart: getBattleVisualGroups(attacker.maxSoldiers),
      groupsEnd: getBattleVisualGroups(attacker.soldiers),
      appearance: clone(fallbackLeader.appearance || {}),
      skill: clone(attacker.skill || {}),
    },
    defender: {
      name: defender.name,
      speed: getBattleSpeed(defender),
      morale: defender.morale,
      moraleEffectEnabled: MORALE_EFFECT_ENABLED,
      attributes: clone(defender.attributes || {}),
      soldiersStart: defender.maxSoldiers,
      soldiersEnd: defender.soldiers,
      groupsStart: getBattleVisualGroups(defender.maxSoldiers),
      groupsEnd: getBattleVisualGroups(defender.soldiers),
      skill: clone(defender.skill || {}),
    },
    visual: {
      groupSize: DEFAULT_SOLDIER_SCALE,
      map: getBattleStageForTerritory(territory),
    },
  };
  return { success, casualties, experience, report };
}

module.exports = {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
  getLeaderSnapshot,
  getEffectiveAttribute,
  calculateDamage,
  getBattleVisualGroups,
  getBattleMapForTerritory,
  getBattleStageForTerritory,
  createLegacyBattleReport,
  simulateConquestBattle,
};
